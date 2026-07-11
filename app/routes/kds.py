from collections import defaultdict
from datetime import datetime, timedelta

from flask import Blueprint, render_template, request, jsonify, abort
from flask_login import login_required, current_user
from flask_socketio import join_room

from app.models import (
    db, KdsStation, KdsStationMenu, KdsStationStaffCall,
    Order, Table, TableOrderList, Menu, MenuOption
)
from app.models.order import get_orders_by_store_id

kds_bp = Blueprint('kds', __name__)


# ── 페이지 라우트 ────────────────────────────────────────────────────────────

@kds_bp.route('/')
@login_required
def kds_select():
    store_id = current_user.id
    stations = KdsStation.query.filter_by(store_id=store_id).order_by(KdsStation.position).all()
    station_data = []
    for s in stations:
        menu_count = KdsStationMenu.query.filter_by(station_id=s.id).count()
        staff_count = KdsStationStaffCall.query.filter_by(station_id=s.id).count()
        station_data.append({
            'id': s.id,
            'name': s.name,
            'show_all': s.show_all,
            'menu_count': menu_count,
            'staff_count': staff_count,
        })
    return render_template('kds_select.html', stations=station_data)


@kds_bp.route('/station/<int:station_id>')
@login_required
def kds_main(station_id):
    store_id = current_user.id
    station = KdsStation.query.filter_by(id=station_id, store_id=store_id).first()
    if not station:
        abort(404)

    staff_call_ids = [
        r.staff_call_item_id
        for r in KdsStationStaffCall.query.filter_by(station_id=station_id).all()
    ]
    return render_template('kds.html', station=station, staff_call_ids=staff_call_ids)


# ── API ──────────────────────────────────────────────────────────────────────

@kds_bp.route('/api/orders')
@login_required
def api_kds_orders():
    store_id = current_user.id
    station_id = request.args.get('station_id', type=int)
    if not station_id:
        return jsonify({'error': 'station_id required'}), 400

    station = KdsStation.query.filter_by(id=station_id, store_id=store_id).first()
    if not station:
        return jsonify({'error': 'Not found'}), 404

    allowed_menu_ids = _get_allowed_menu_ids(station)
    orders = get_orders_by_store_id(store_id)
    pending = [o for o in orders if o.order_status_id == 1]
    if allowed_menu_ids is not None:
        pending = [o for o in pending if o.menu_id in allowed_menu_ids]

    return jsonify(_group_orders(pending))


@kds_bp.route('/api/completed')
@login_required
def api_kds_completed():
    store_id = current_user.id
    station_id = request.args.get('station_id', type=int)
    if not station_id:
        return jsonify({'error': 'station_id required'}), 400

    station = KdsStation.query.filter_by(id=station_id, store_id=store_id).first()
    if not station:
        return jsonify({'error': 'Not found'}), 404

    allowed_menu_ids = _get_allowed_menu_ids(station)
    orders = get_orders_by_store_id(store_id)
    done = [o for o in orders if o.order_status_id == 2]
    if allowed_menu_ids is not None:
        done = [o for o in done if o.menu_id in allowed_menu_ids]

    # 현재 영업일(매장 설정 기준 시각으로 하루 구분) 완료 건만 표시
    day_start = _business_day_start(getattr(current_user, 'business_day_cutoff', None))
    done = [o for o in done if o.ordered_at and o.ordered_at >= day_start]

    # 최근 순 정렬 후 배치 그루핑, 최대 30배치
    done.sort(key=lambda o: o.ordered_at, reverse=True)
    return jsonify(_group_orders(done, limit_batches=30))


@kds_bp.route('/api/complete_batch', methods=['POST'])
@login_required
def api_complete_batch():
    store_id = current_user.id
    data = request.get_json()
    order_ids = data.get('order_ids', [])
    if not order_ids:
        return jsonify({'error': 'order_ids required'}), 400

    try:
        orders = Order.query.filter(Order.id.in_(order_ids)).all()
        for o in orders:
            order_list_item = TableOrderList.query.get(o.order_list_id)
            if not order_list_item or order_list_item.store_id != store_id:
                return jsonify({'error': 'Unauthorized'}), 403
            o.order_status_id = 2
        db.session.commit()

        from app import socketio
        socketio.emit('kds_order_completed', {
            'order_ids': order_ids,
        }, room=f'store_{store_id}_kds')
        # POS 테이블 목록 실시간 갱신
        socketio.emit('kds_order_completed', {
            'order_ids': order_ids,
        }, room='pos_group')

        return jsonify({'code': 200, 'message': 'Success'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ── SocketIO ─────────────────────────────────────────────────────────────────

from app import socketio

@socketio.on('join_kds')
def on_join_kds(data):
    store_id = data.get('store_id')
    if store_id:
        join_room(f'store_{store_id}_kds')


# ── 내부 헬퍼 ────────────────────────────────────────────────────────────────

def _business_day_start(cutoff_str):
    """영업일 시작 시각. cutoff_str='HH:MM'(미설정 시 06:00) 기준으로
    현재가 오늘 cutoff 이후면 오늘 cutoff, 이전이면 어제 cutoff 반환."""
    now = datetime.now()
    try:
        hh, mm = (int(x) for x in (cutoff_str or '06:00').split(':'))
    except (ValueError, AttributeError):
        hh, mm = 6, 0
    cutoff_today = now.replace(hour=hh, minute=mm, second=0, microsecond=0)
    return cutoff_today if now >= cutoff_today else cutoff_today - timedelta(days=1)


def _get_allowed_menu_ids(station):
    """show_all=False면 연동된 menu_id set, True면 None(제한없음)"""
    if station.show_all:
        return None
    return {r.menu_id for r in KdsStationMenu.query.filter_by(station_id=station.id).all()}


def _group_orders(orders, limit_batches=None):
    """(table_id, ordered_at초) 기준으로 배치 그루핑"""
    batches = defaultdict(list)
    for o in orders:
        key = f"{o.table_id}_{o.ordered_at.strftime('%Y-%m-%dT%H:%M:%S')}"
        batches[key].append(o)

    result = []
    for batch_key, batch_orders in batches.items():
        first = batch_orders[0]
        table = Table.query.get(first.table_id)
        table_name = table.name if table else f"테이블 {first.table_id}"

        # (메뉴명+옵션) 조합별 수량 합산
        item_map = defaultdict(lambda: {'menu_name': '', 'options': [], 'quantity': 0, 'order_ids': []})
        for o in batch_orders:
            menu = Menu.query.get(o.menu_id)
            menu_name = menu.name if menu else f"메뉴 {o.menu_id}"

            option_names = []
            raw_opts = o.get_menu_options()
            if raw_opts:
                for opt in raw_opts:
                    mo = MenuOption.query.get(opt.get('id'))
                    if mo:
                        count = opt.get('count', 1)
                        label = f"{mo.name}" if count <= 1 else f"{mo.name}x{count}"
                        option_names.append(label)

            item_key = f"{menu_name}|{'|'.join(sorted(option_names))}"
            item_map[item_key]['menu_name'] = menu_name
            item_map[item_key]['options'] = option_names
            item_map[item_key]['quantity'] += 1
            item_map[item_key]['order_ids'].append(o.id)

        items = [
            {'menu_name': v['menu_name'], 'quantity': v['quantity'], 'options': v['options'], 'order_ids': v['order_ids']}
            for v in item_map.values()
        ]

        elapsed = int((datetime.now() - first.ordered_at).total_seconds())
        all_done = all(o.order_status_id == 2 for o in batch_orders)

        result.append({
            'batch_key': batch_key,
            'table_id': first.table_id,
            'table_name': table_name,
            'ordered_at': first.ordered_at.strftime('%Y-%m-%dT%H:%M:%SZ'),
            'elapsed_seconds': elapsed,
            'items': items,
            'status': 'done' if all_done else 'pending',
            'order_ids': [o.id for o in batch_orders],
        })

    result.sort(key=lambda x: x['ordered_at'])
    if limit_batches:
        result = result[:limit_batches]
    return result
