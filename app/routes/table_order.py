from app.routes import table_order_bp
from app.models.order import make_order
from app.models.staff_call import get_staff_call_items, record_staff_call
from app.models.table import get_table_by_qr_token, has_active_table_session

from flask import render_template, request, jsonify, redirect, make_response
from flask_login import login_required, current_user

from app import socketio
from flask_socketio import join_room, emit

from app.utils.qr_auth import (
    issue_qr_session, set_qr_session_cookie,
    resolve_customer_context, check_geofence,
)

from datetime import datetime

# 실시간 접속 테이블 추적 (Key: store_id(str), Value: {table_id(str): set(sid)})
# 한 테이블에 여러 기기(손님)가 동시에 접속할 수 있도록 sid를 Set으로 관리한다.
CONNECTED_TABLES = {}


def get_active_tables(store_id):
    store_id = str(store_id)
    if store_id in CONNECTED_TABLES:
        return [t for t, sids in CONNECTED_TABLES[store_id].items() if sids]
    return []


def broadcast_table_status(store_id):
    active_tables = get_active_tables(store_id)
    emit('table_status_update', {'active_tables': active_tables}, room=f'store_{store_id}_login')


def _current_context():
    """현재 요청의 (store_id, table_id, mode) 반환.

    - QR 손님 쿠키가 있으면 우선 사용 → mode='customer' (table_id 포함)
    - 없고 로그인 매장이면 → mode='store' (table_id=None)
    - 둘 다 아니면 (None, None, None)
    """
    store_id, table_id = resolve_customer_context()
    if store_id is not None:
        return store_id, table_id, 'customer'
    if current_user.is_authenticated:
        return int(current_user.id), None, 'store'
    return None, None, None


# ── QR 진입 라우트 ─────────────────────────────────────────────────────────────
# 손님이 테이블 QR을 스캔하면 여기로 들어온다. 토큰 해석 → 손님 세션 쿠키 발급 → 주문 화면.
@table_order_bp.route('/t/<qr_token>', methods=['GET'])
def qr_entry(qr_token):
    table, store_id = get_table_by_qr_token(qr_token)
    if not table or store_id is None:
        return render_template('table_order/invalid_qr.html'), 404
    payload = issue_qr_session(store_id, table.id, qr_token)
    resp = make_response(redirect(f'/table_order/main?table_id={table.id}'))
    return set_qr_session_cookie(resp, payload)


# ── SocketIO ──────────────────────────────────────────────────────────────────
@socketio.on('join_table_order')
def on_join_table_order(data):
    # 손님(QR)이면 쿠키에서 컨텍스트를 강제, 매장 프리뷰(로그인)면 클라이언트 값 사용
    c_store, c_table = resolve_customer_context()
    if c_store is not None:
        store_id = str(c_store)
        table_id = str(c_table)
    else:
        if not current_user.is_authenticated:
            return
        store_id = str(data.get('store_id'))
        table_id = str(data.get('table_id'))

    sid = request.sid
    if not store_id or not table_id or table_id == 'None':
        return

    # 다중 기기 허용: 강제 로그아웃 없이 sid를 Set에 추가
    CONNECTED_TABLES.setdefault(store_id, {}).setdefault(table_id, set()).add(sid)

    join_room(f'table_{store_id}_{table_id}')
    print(f'Table Order Connected: Store {store_id}, Table {table_id}, SID {sid}')

    broadcast_table_status(store_id)


@socketio.on('join_login_page')
def on_join_login_page(data):
    store_id = data.get('store_id')
    if store_id:
        join_room(f'store_{store_id}_login')
        # 현재 접속 상태 즉시 전송
        emit('table_status_update', {'active_tables': get_active_tables(store_id)})


@socketio.on('disconnect')
def on_disconnect():
    sid = request.sid
    for store_id, tables in CONNECTED_TABLES.items():
        for table_id, sids in list(tables.items()):
            if sid in sids:
                sids.discard(sid)
                if not sids:
                    del tables[table_id]
                print(f'Table Order Disconnected: Store {store_id}, Table {table_id}, SID {sid}')
                broadcast_table_status(store_id)
                return


@socketio.on('table_order_login')
def table_order_login(data):
    if data.get('user_type') == 'table_order':
        join_room('table_order_group')
        emit('login_response', {'message': '로그인이 성공하여 table_order_group 그룹에 추가되었습니다.'})
        return {'msg': '로그인이 성공하여 table_order 그룹에 추가되었습니다.'}


@socketio.on('new_order_pos_update')
def new_order_pos_update(data):
    """손님 주문 진입점. 가짜 주문 방지 게이트를 통과해야 수락한다.

    게이트: ① 손님 세션(토큰) 유효 ② GPS 지오펜스 ③ (옵션)활성 세션.
    매장 프리뷰(로그인)는 신뢰 경로로 게이트를 건너뛴다.
    """
    c_store, c_table = resolve_customer_context()

    if c_store is not None:
        store_id = c_store
        table_id = c_table
        from app.models import Store
        store = Store.query.get(store_id)

        # ② 지오펜스
        ok, reason = check_geofence(store, data.get('lat'), data.get('lng'))
        if not ok:
            msg = {
                'no_location': '위치 확인이 필요합니다. 위치 권한을 허용해 주세요.',
                'out_of_range': '매장 근처에서만 주문할 수 있습니다.',
                'invalid_location': '위치 정보가 올바르지 않습니다.',
            }.get(reason, '주문할 수 없습니다.')
            emit('order_rejected', {'reason': reason, 'message': msg})
            return {'ok': False, 'reason': reason, 'message': msg}

        # ③ 세션 게이트(매장 설정 시)
        if store and store.qr_require_open_session and not has_active_table_session(table_id):
            msg = '직원 안내 후 주문할 수 있습니다.'
            emit('order_rejected', {'reason': 'no_session', 'message': msg})
            return {'ok': False, 'reason': 'no_session', 'message': msg}

    elif current_user.is_authenticated:
        store_id = int(current_user.id)
        table_id = data.get('table_id')
    else:
        msg = '주문 권한이 없습니다. QR을 다시 스캔해 주세요.'
        emit('order_rejected', {'reason': 'unauthorized', 'message': msg})
        return {'ok': False, 'reason': 'unauthorized', 'message': msg}

    order_list = data.get('order_list')
    make_order(store_id, table_id, order_list)

    # 포스기에 주문 업데이트 요청
    socketio.emit('update_pos', {
        'store_id': store_id,
        'table_id': table_id,
        'message': '새로운 주문이 들어왔습니다.',
        'is_pos': False,
        'order_list': order_list,
    }, room='pos_group')
    # KDS에 새 주문 알림
    socketio.emit('kds_new_order', {'table_id': table_id, 'store_id': store_id}, room=f'store_{store_id}_kds')

    return {'ok': True}


# ── HTTP ──────────────────────────────────────────────────────────────────────
@table_order_bp.route('/get_info', methods=['GET'])
def get_info():
    store_id, table_id, mode = _current_context()
    if store_id is None:
        return jsonify({'error': 'Unauthorized', 'code': 401}), 401
    return jsonify({
        'store_id': store_id,
        'table_id': table_id,
        'mode': mode,
    })


# 매장 프리뷰용 테이블 선택 화면(로그인 매장 전용)
@table_order_bp.route('/login', methods=['GET'])
@login_required
def login():
    return render_template('/table_order/login.html')


# 주문 화면 — QR 손님 또는 로그인 매장 모두 접근 가능
@table_order_bp.route('/main', methods=['GET'])
def main():
    store_id, ctx_table, mode = _current_context()
    if store_id is None:
        return render_template('table_order/invalid_qr.html'), 401

    table_id = request.args.get('table_id') or ctx_table
    table_name = ''
    if table_id:
        from app.models import Table
        table = Table.query.get(table_id)
        if table:
            table_name = table.name

    return render_template('/table_order/main.html', table_name=table_name)


@table_order_bp.route('/get_order_history/<int:table_id>', methods=['GET'])
def get_order_history(table_id):
    store_id, ctx_table, mode = _current_context()
    if store_id is None:
        return jsonify({'error': 'Unauthorized', 'code': 401}), 401
    # 손님은 자기 테이블만 조회 가능
    if mode == 'customer':
        table_id = ctx_table

    from app.models.order import find_order_list
    from app.models import Menu, MenuOption

    orders = find_order_list(table_id)

    result = []
    for order in orders:
        menu = Menu.query.get(order.menu_id)
        if not menu:
            continue

        options_data = order.get_menu_options()
        options_info = []
        total_option_price = 0

        for opt in options_data:
            option_item = MenuOption.query.get(opt['id'])
            if option_item:
                options_info.append({
                    'name': option_item.name,
                    'price': option_item.price,
                    'count': opt['count']
                })
                total_option_price += option_item.price * opt['count']

        result.append({
            'order_id': order.id,
            'menu_name': menu.name,
            'price': menu.price,
            'options': options_info,
            'total_price': menu.price + total_option_price,
            'ordered_at': order.ordered_at.strftime('%Y-%m-%d %H:%M:%S')
        })

    return jsonify({
        'message': 'Success',
        'code': 200,
        'data': result
    })


# 손님 결제 내역 조회 (읽기 전용)
@table_order_bp.route('/get_payment_history', methods=['GET'])
def get_payment_history():
    store_id, ctx_table, mode = _current_context()
    if store_id is None:
        return jsonify({'error': 'Unauthorized', 'code': 401}), 401
    table_id = ctx_table if mode == 'customer' else request.args.get('table_id')
    if not table_id:
        return jsonify({'message': 'Success', 'code': 200, 'data': []})

    import json
    from app.models import TablePaymentList, Payment, Payment_method, Payment_status

    lists = TablePaymentList.query\
        .filter(TablePaymentList.store_id == store_id)\
        .filter(TablePaymentList.table_id == table_id)\
        .order_by(TablePaymentList.payment_time.desc())\
        .all()

    result = []
    for tpl in lists:
        payments = Payment.query.filter(Payment.table_payment_list_id == tpl.id).all()
        pay_rows = []
        for p in payments:
            method = Payment_method.query.get(p.payment_method_id)
            status = Payment_status.query.get(p.payment_status)
            pay_rows.append({
                'amount': p.payment_amount,
                'method': method.method if method else None,
                'status': status.status if status else None,
                'paid_at': p.payment_datetime.strftime('%Y-%m-%d %H:%M:%S') if p.payment_datetime else None,
            })
        try:
            order_details = json.loads(tpl.order_details) if tpl.order_details else []
        except (ValueError, TypeError):
            order_details = []
        result.append({
            'id': tpl.id,
            'table_name': tpl.table_name,
            'discount': tpl.discount,
            'extra_charge': tpl.extra_charge,
            'order_details': order_details,
            'payments': pay_rows,
            'payment_time': tpl.payment_time.strftime('%Y-%m-%d %H:%M:%S') if tpl.payment_time else None,
        })

    return jsonify({'message': 'Success', 'code': 200, 'data': result})


# 직원 호출 항목 조회 API (테이블 오더용)
@table_order_bp.route('/get_staff_call_items', methods=['GET'])
def api_table_get_staff_call_items():
    from app.models import Store
    store_id, ctx_table, mode = _current_context()
    if store_id is None:
        return jsonify({'error': 'Unauthorized', 'code': 401}), 401

    store = Store.query.get(store_id)
    items = get_staff_call_items(store_id)
    item_list = []
    for i in items:
        item_list.append({
            'id': i.id,
            'name': i.name,
            'image': i.image,
            'use_quantity': i.use_quantity,
            'position': i.position
        })
    return jsonify({
        'items': item_list,
        'grid': {
            'rows': store.staff_call_grid_rows or 4,
            'cols': store.staff_call_grid_cols or 4
        }
    })


# 직원 호출 실행 API (테이블 오더용)
@table_order_bp.route('/request_staff_call', methods=['POST'])
def api_request_staff_call():
    import uuid
    store_id, ctx_table, mode = _current_context()
    if store_id is None:
        return jsonify({'error': 'Unauthorized', 'code': 401}), 401

    data = request.get_json() or {}
    table_id = ctx_table if mode == 'customer' else data.get('table_id')
    requests_data = data.get('requests', [])  # List of {item_id, quantity}

    if not table_id:
        return jsonify({'error': 'Invalid data'}), 400

    # Generate unique request ID for grouping
    request_id = str(uuid.uuid4())
    call_messages = []

    # Handle "Staff Call Only" (Empty Request)
    if not requests_data:
        log = record_staff_call(table_id, None, 1, request_id)
        call_messages.append({
            'id': log.id,
            'name': '직원 호출',
            'quantity': 1,
            'is_staff_call_only': True
        })
    else:
        # Handle Items
        from app.models import StaffCallItem
        for req in requests_data:
            item_id = req.get('item_id')
            quantity = req.get('quantity', 1)
            if item_id:
                log = record_staff_call(table_id, item_id, quantity, request_id)
                item = StaffCallItem.query.get(item_id)
                if item:
                    call_messages.append({
                        'id': log.id,
                        'name': item.name,
                        'quantity': quantity,
                        'use_quantity': item.use_quantity,
                        'is_staff_call_only': False
                    })

    # 포스기 및 상점 관리자에게 소켓 알림 전송
    from app.models import Table
    table = Table.query.get(table_id)
    table_name = table.name if table else f"테이블 {table_id}"

    socketio.emit('staff_call_notification', {
        'request_id': request_id,
        'table_id': table_id,
        'table_name': table_name,
        'calls': call_messages,
        'timestamp': datetime.now().strftime('%H:%M:%S')
    }, room='pos_group')

    return jsonify({'message': 'Success'}), 200
