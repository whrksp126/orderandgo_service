from flask import render_template, jsonify, request
import json
import uuid
import time
from datetime import datetime
from app.models.menu import select_main_category, select_sub_category, select_menu_all, select_menu, select_menu_option, select_menu_option_all, select_menu_all_to_main_category
from app.models.order import find_order_list, get_orders_by_store_id
from flask_login import login_required, current_user
from app.routes import pos_bp
from app.models.table import \
    move_table, \
    select_table_category, \
    delete_table_category, \
    select_table, \
    set_table_group
from app.models import db, Menu, MenuOption, MenuOptionGroup, StaffCallLog, StaffCallItem, Table, Order, CarryoverDeletionLog
from app.models.staff_call import get_staff_call_logs
from app.utils.business_day import business_day_start

from app import socketio
from flask_socketio import join_room, emit
from flask import request as flask_request


@socketio.on('pos_login')
def pos_login(data):
    if data.get('user_type') == 'pos':
        join_room('pos_group')
        emit('login_response', {'message': '로그인이 성공하여 POS 그룹에 추가되었습니다.'})
        return {'msg': '로그인이 성공하여 POS 그룹에 추가되었습니다.'}


@socketio.on('store_history_login')
def store_history_login(data):
    """결제 이력 페이지 소켓 룸 참여 (환불 결과 수신용)"""
    store_id = data.get('store_id')
    if store_id:
        join_room(f'store_history_{store_id}')
        emit('store_history_login_response', {'status': 'ok'})


# ─── Toss Front Plugin ────────────────────────────────────────────────────────

# 메모리 내 저장소 (서버 재시작과 무관한 단기 데이터만)
_pending_payments = {}       # payment_id → payment data
_terminal_ws = {}            # store_id → ws_address (단말기 WS 서버 주소)
_socket_store_map = {}       # sid → store_id (단말기 연결 추적)
_completed_payments = {}     # payment_id → 승인 완료 데이터 + 확정/취소 상태
_cash_receipt_cancels = {}   # payment_id → 현금영수증 취소 대기 데이터


@pos_bp.route('/toss/auth/verify', methods=['GET'])
def terminal_auth_verify():
    """단말기 토큰 유효성 검사"""
    from app.models import TerminalToken
    token = request.args.get('token', '').strip()
    if not token:
        return jsonify({'valid': False}), 200
    record = TerminalToken.query.filter_by(token=token).first()
    return jsonify({'valid': record is not None}), 200


@pos_bp.route('/toss/auth/login', methods=['POST'])
def terminal_auth_login():
    """단말기 플러그인 로그인 → 토큰 발급 (DB 저장)"""
    data = request.get_json()
    store_id_str = data.get('store_id', '').strip()
    password = data.get('password', '')

    from app.models import Store, TerminalToken
    import bcrypt as _bcrypt
    serial_number = data.get('serial_number', '').strip()
    store = Store.query.filter_by(store_id=store_id_str).first()
    if not store or not _bcrypt.checkpw(password.encode('utf-8'), store.store_pw.encode('utf-8')):
        return jsonify({'error': '아이디 또는 비밀번호가 올바르지 않습니다.'}), 401

    if serial_number:
        store.terminal_serial = serial_number
    merchant_id = data.get('merchant_id')
    merchant_business_number = data.get('merchant_business_number')
    if merchant_id:
        store.toss_merchant_id = int(merchant_id)
    if merchant_business_number:
        store.toss_business_number = merchant_business_number
    db.session.commit()

    token = str(uuid.uuid4())
    db.session.add(TerminalToken(token=token, store_id=store.id))
    db.session.commit()
    print(f'[Terminal] 로그인 성공: store={store.id} ({store.name}), serial={serial_number or store.terminal_serial}')
    return jsonify({
        'token': token,
        'store_id': store.id,
        'store_name': store.name,
        'serial_number': serial_number or store.terminal_serial,
        'merchant_id': store.toss_merchant_id,
        'merchant_name': store.name,
        'business_number': store.toss_business_number,
    })


@pos_bp.route('/toss/terminal/register', methods=['POST'])
def terminal_register():
    """단말기 sdk.websocket 서버 주소 등록"""
    from app.models import TerminalToken
    data = request.get_json()
    token = data.get('token')
    ws_address = data.get('ws_address')

    record = TerminalToken.query.filter_by(token=token).first()
    if not record:
        return jsonify({'error': '인증 실패'}), 401

    store_id = record.store_id
    _terminal_ws[store_id] = ws_address
    print(f'[Terminal] WS 등록: store={store_id}, address={ws_address}')
    return jsonify({'status': 'ok'})


@socketio.on('terminal_join')
def terminal_join(data):
    """단말기가 소켓 연결 후 인증 (DB 토큰 검증)"""
    from app.models import TerminalToken
    token = data.get('token')
    if not token:
        emit('terminal_auth_error', {'message': '인증 실패. 다시 로그인해주세요.'})
        return

    record = TerminalToken.query.filter_by(token=token).first()
    if not record:
        emit('terminal_auth_error', {'message': '인증 실패. 다시 로그인해주세요.'})
        return

    store_id = record.store_id
    room = f'terminal_{store_id}'
    join_room(room)
    _socket_store_map[flask_request.sid] = store_id

    emit('terminal_join_success', {'store_id': store_id})
    socketio.emit('terminal_online', {'store_id': store_id}, to='pos_group')
    print(f'[Terminal] 연결됨: store={store_id}, sid={flask_request.sid}')


@socketio.on('terminal_status_update')
def terminal_status_update(data):
    """단말기 화면 상태 변경 → POS 전달"""
    from app.models import TerminalToken
    token = data.get('token')
    if not token:
        return
    record = TerminalToken.query.filter_by(token=token).first()
    if not record:
        return
    socketio.emit('terminal_status', {
        'status': data.get('status'),
        'payment_id': data.get('payment_id'),
        'store_id': record.store_id,
    }, to='pos_group')


@socketio.on('request_cancel_payment')
def request_cancel_payment(data):
    """POS에서 결제 취소 요청 → 단말기 전달"""
    payment_id = data.get('payment_id')
    store_id = data.get('store_id')

    if payment_id and payment_id in _pending_payments:
        _pending_payments[payment_id]['status'] = 'cancelled'

    socketio.emit('payment_cancelled', {'payment_id': payment_id}, to=f'terminal_{store_id}')
    print(f'[Toss] 결제 취소 요청: payment_id={payment_id}, store={store_id}')


@socketio.on('disconnect')
def on_disconnect():
    """단말기 연결 해제 감지"""
    sid = flask_request.sid
    if sid in _socket_store_map:
        store_id = _socket_store_map.pop(sid)
        socketio.emit('terminal_offline', {'store_id': store_id}, to='pos_group')
        print(f'[Terminal] 연결 해제: store={store_id}')


@pos_bp.route('/toss/pending', methods=['POST'])
@login_required
def create_toss_pending():
    """POS 카드결제 클릭 시 pending payment 생성 + 단말기에 소켓 푸시"""
    from app.models import Store
    data = request.get_json()
    payment_id = str(uuid.uuid4())[:8]
    store = Store.query.get(current_user.id)
    store_id = store.id

    if not store.toss_merchant_id or not store.toss_business_number:
        return jsonify({
            'code': 422,
            'msg': '단말기 가맹점 정보가 설정되지 않았습니다.\n매장관리 → 단말기 관리에서 토스 가맹점 ID와 사업자등록번호를 입력해주세요.',
        }), 422

    payment = {
        'payment_id': payment_id,
        'store_id': store_id,
        'table_id': data.get('table_id'),
        'order': data.get('order'),
        'tax': data.get('tax'),
        'supply_value': data.get('supply_value'),
        'payment_key': data.get('payment_key'),
        'payment_type': data.get('payment_type', 'card'),  # 'card' or 'cash'
        'identity_number': data.get('identity_number'),    # 현금영수증 번호 (휴대폰/사업자)
        'issuer_type': data.get('issuer_type'),            # 'CONSUMER' | 'BUSINESS'
        'status': 'pending',
        'order_version': 1,                                # 주문 데이터 버전 (단말기 재렌더링 감지용)
        'last_active_at': time.time(),                     # POS heartbeat 타임스탬프 (TTL용)
    }
    _pending_payments[payment_id] = payment

    ws_address = _terminal_ws.get(store_id)
    print(f'[Toss] 결제 요청 생성: {payment_id}, store={store_id}, table={data.get("table_id")}, ws={ws_address}')

    return jsonify({'payment_id': payment_id, 'store_id': store_id, 'ws_address': ws_address, 'status': 'ok'})

@pos_bp.route('/toss/pending', methods=['GET'])
def get_toss_pending():
    """단말기 플러그인이 pending payment 폴링"""
    from app.models import TerminalToken
    from datetime import datetime
    token = request.args.get('token')
    record = TerminalToken.query.filter_by(token=token).first() if token else None

    # 토큰이 제공됐는데 DB에 없으면 → 로그아웃 처리됨
    if token and not record:
        return jsonify({'logout': True})

    store_id = record.store_id if record else None

    # 마지막 폴링 시각 갱신 → 실제 연결 상태 감지용
    if record:
        record.last_polled_at = datetime.now()
        db.session.commit()

    for payment_id, payment in list(_pending_payments.items()):
        if payment['status'] == 'pending':
            if store_id and payment.get('store_id') != store_id:
                continue
            payment['status'] = 'processing'
            return jsonify({'pending': True, **payment})
    return jsonify({'pending': False})

@pos_bp.route('/toss/update_pending', methods=['POST'])
@login_required
def update_toss_pending():
    """POS에서 display pending → card/cash 전환 또는 order 데이터 갱신"""
    data = request.get_json()
    payment_id = data.get('payment_id')
    if not payment_id or payment_id not in _pending_payments:
        return jsonify({'error': 'not_found'}), 404
    payment = _pending_payments[payment_id]
    if 'payment_type' in data and data['payment_type']:
        payment['payment_type'] = data['payment_type']
    order_changed = False
    if 'order' in data and data['order']:
        payment['order'] = data['order']
        order_changed = True
    if 'tax' in data:
        payment['tax'] = data['tax']
        order_changed = True
    if 'supply_value' in data:
        payment['supply_value'] = data['supply_value']
        order_changed = True
    if 'payment_key' in data and data['payment_key']:
        payment['payment_key'] = data['payment_key']
    if order_changed:
        payment['order_version'] = payment.get('order_version', 1) + 1
    payment['last_active_at'] = time.time()   # heartbeat 갱신
    return jsonify({'status': 'ok'})


@pos_bp.route('/toss/payment_type_status', methods=['GET'])
def get_payment_type_status():
    """단말기가 payment_type 변경 여부 폴링 (display → card/cash)"""
    from app.models import TerminalToken
    from datetime import datetime
    token = request.args.get('token')
    payment_id = request.args.get('payment_id')
    if token:
        record = TerminalToken.query.filter_by(token=token).first()
        if record:
            record.last_polled_at = datetime.now()
            db.session.commit()
    if not payment_id or payment_id not in _pending_payments:
        return jsonify({'cancelled': True})
    payment = _pending_payments[payment_id]
    if payment.get('status') == 'cancelled':
        return jsonify({'cancelled': True})
    # display 모드에서 POS heartbeat가 20초 이상 없으면 자동 취소 (POS가 페이지를 이탈한 경우)
    if payment.get('payment_type') == 'display':
        last_active = payment.get('last_active_at', time.time())
        if time.time() - last_active > 20:
            _pending_payments.pop(payment_id, None)
            return jsonify({'cancelled': True})
    return jsonify({
        'payment_type': payment.get('payment_type', 'display'),
        'order': payment.get('order'),
        'tax': payment.get('tax'),
        'supply_value': payment.get('supply_value'),
        'payment_key': payment.get('payment_key'),
        'order_version': payment.get('order_version', 1),
        'cancelled': False,
    })


@pos_bp.route('/toss/cash_ready', methods=['POST'])
@login_required
def cash_payment_ready():
    """POS에서 현금 금액 확인 + 영수증 정보 확정 → 단말기가 폴링으로 감지"""
    data = request.get_json()
    payment_id = data.get('payment_id')
    if payment_id and payment_id in _pending_payments:
        _pending_payments[payment_id]['cash_ready'] = True
        _pending_payments[payment_id]['identity_number'] = data.get('identity_number')
        _pending_payments[payment_id]['issuer_type'] = data.get('issuer_type')
    return jsonify({'status': 'ok'})


@pos_bp.route('/toss/cash_ready_status', methods=['GET'])
def get_cash_ready_status():
    """단말기가 현금 결제 POS 확정 여부 폴링"""
    from app.models import TerminalToken
    from datetime import datetime
    token = request.args.get('token')
    payment_id = request.args.get('payment_id')

    if token:
        record = TerminalToken.query.filter_by(token=token).first()
        if record:
            record.last_polled_at = datetime.now()
            db.session.commit()

    if not payment_id or payment_id not in _pending_payments:
        return jsonify({'ready': False, 'cancelled': True})
    payment = _pending_payments[payment_id]
    if payment.get('status') == 'cancelled':
        return jsonify({'ready': False, 'cancelled': True})
    return jsonify({
        'ready': payment.get('cash_ready', False),
        'identity_number': payment.get('identity_number'),
        'issuer_type': payment.get('issuer_type'),
        'cancelled': False,
    })


@pos_bp.route('/toss/terminal_update_type', methods=['POST'])
def terminal_update_type():
    """단말기가 결제 방식 선택 시 payment_type 업데이트 → POS에 소켓 알림"""
    from app.models import TerminalToken
    data = request.get_json()
    token = data.get('token')
    payment_id = data.get('payment_id')
    payment_type = data.get('payment_type')

    if not token or not payment_id or not payment_type:
        return jsonify({'error': 'missing_params'}), 400

    record = TerminalToken.query.filter_by(token=token).first()
    if not record:
        return jsonify({'error': '인증 실패'}), 401

    if payment_id not in _pending_payments:
        return jsonify({'error': 'not_found'}), 404

    _pending_payments[payment_id]['payment_type'] = payment_type

    socketio.emit('terminal_payment_type_changed', {
        'payment_id': payment_id,
        'payment_type': payment_type,
    }, to='pos_group')
    print(f'[Terminal] 결제 방식 선택: payment_id={payment_id}, type={payment_type}')
    return jsonify({'status': 'ok'})


@pos_bp.route('/toss/cancel', methods=['POST'])
def cancel_toss_pending():
    """POS에서 결제 취소 요청 → 단말기가 폴링으로 감지 (sendBeacon 포함)"""
    data = request.get_json(silent=True) or {}
    if not data:
        try:
            import json as _json
            data = _json.loads(request.data or b'{}')
        except Exception:
            data = {}
    payment_id = data.get('payment_id')
    if payment_id and payment_id in _pending_payments:
        _pending_payments[payment_id]['status'] = 'cancelled'
    print(f'[Toss] 결제 취소: payment_id={payment_id}')
    return jsonify({'status': 'ok'})


@pos_bp.route('/toss/status', methods=['GET'])
def get_toss_status():
    """단말기가 결제 취소 여부를 폴링"""
    payment_id = request.args.get('payment_id')
    if not payment_id:
        return jsonify({'status': 'not_found'})
    payment = _pending_payments.get(payment_id)
    if not payment:
        return jsonify({'status': 'not_found'})
    status = payment.get('status', 'processing')
    if status == 'cancelled':
        _pending_payments.pop(payment_id, None)
    return jsonify({'status': status})


@pos_bp.route('/toss/result', methods=['POST'])
def submit_toss_result():
    """단말기 플러그인이 결제 결과 제출 → POS에 socket emit"""
    data = request.get_json()
    payment_id = data.get('payment_id')
    table_id = data.get('table_id')
    result = data.get('result')
    tax = data.get('tax')
    supply_value = data.get('supply_value')

    # pop 전에 payment_type 추출 (현금/카드 구분)
    pending = _pending_payments.get(payment_id)
    payment_type = pending.get('payment_type', 'card') if pending else data.get('payment_type', 'card')

    # ── payment_type == 'cancel': 이력 페이지 뒤늦은 취소 처리 ──────────────
    if payment_type == 'cancel':
        import json as _j, sys as _s
        _s.stdout.write(f'[Toss][CANCEL] payment_id={payment_id} pending={bool(pending)} tpl_id={pending.get("table_payment_list_id") if pending else None} result={_j.dumps(result, ensure_ascii=False)}\n')
        _s.stdout.flush()
        _pending_payments.pop(payment_id, None)
        tpl_id = pending.get('table_payment_list_id') if pending else data.get('table_payment_list_id')
        cancel_store_id = pending.get('store_id') if pending else data.get('store_id')
        db_payment_id = pending.get('db_payment_id') if pending else None
        result_type = result.get('type') if result else None

        # 1차 DB 저장 시도 (실패해도 소켓 전송은 반드시 수행)
        try:
            if result and result_type in ('SUCCESS', 'CANCEL_SUCCESS') and tpl_id:
                from app.models import TablePaymentList, Payment
                from datetime import datetime as dt
                tpl = db.session.query(TablePaymentList).filter_by(id=tpl_id).first()
                if tpl:
                    now_iso = dt.now().isoformat()
                    if db_payment_id:
                        # 개별 Payment만 취소
                        p = Payment.query.get(db_payment_id)
                        if p and p.table_payment_list_id == tpl_id and p.payment_status != 2:
                            p.payment_status = 2
                            pi = json.loads(p.payment_info) if p.payment_info else {}
                            pi['toss_cancel_result'] = result
                            pi['toss_cancel_time'] = now_iso
                            p.payment_info = json.dumps(pi)
                    else:
                        for p in Payment.query.filter_by(table_payment_list_id=tpl_id).all():
                            if p.payment_status != 2:
                                p.payment_status = 2
                        ph = json.loads(tpl.payment_history) if tpl.payment_history else {}
                        ph['toss_cancel_result'] = result
                        ph['toss_cancel_time'] = now_iso
                        tpl.payment_history = json.dumps(ph)
                    db.session.commit()
        except Exception as _e:
            import sys as _s2
            _s2.stdout.write(f'[Toss][CANCEL] DB 1차 저장 실패 (프론트 폴백): {_e}\n')
            _s2.stdout.flush()

        _s.stdout.write(f'[Toss][CANCEL] result_type={result_type} tpl_id={tpl_id} → db_updated={bool(result and result_type in ("SUCCESS","CANCEL_SUCCESS") and tpl_id)}\n')
        _s.stdout.flush()

        # 소켓은 DB 결과와 무관하게 항상 전송 (카드 결제와 동일 패턴)
        event_data = {
            'payment_id': payment_id,
            'table_id': table_id,
            'result': result,
            'table_payment_list_id': tpl_id,   # 프론트 2차 저장용
            'db_payment_id': db_payment_id,
        }
        socketio.emit('toss_history_cancel_result', event_data, to='pos_group')
        if cancel_store_id:
            socketio.emit('toss_history_cancel_result', event_data, to=f'store_history_{cancel_store_id}')
        return jsonify({'status': 'ok'})

    result_type = result.get('type') if result else None
    if result_type != 'SUCCESS' and pending:
        # 결제 실패(취소·타임아웃·금액오류 등) → display로 복귀 (단말기가 주문 내역 재표시)
        _pending_payments[payment_id]['payment_type'] = 'display'
        _pending_payments[payment_id]['status'] = 'pending'   # pop 대신 pending 복귀 (KeyError 방지)
        _pending_payments[payment_id].pop('cash_ready', None)  # 현금 재시도 가능하도록 초기화
    else:
        _pending_payments.pop(payment_id, None)

    print(f'[Toss] 결제 결과 수신: payment_id={payment_id}, type={result.get("type")}, payment_type={payment_type}')
    if result.get('type') == 'SUCCESS' and payment_type != 'cash':
        print(f'[Toss][DEBUG] 카드 결제 결과 전체: {json.dumps(result, ensure_ascii=False, default=str)}')

    # 결제 성공 시 승인 취소를 위한 데이터 보관 (카드만)
    if result.get('type') == 'SUCCESS' and payment_type != 'cash':
        _completed_payments[payment_id] = {
            'payment_id': payment_id,
            'table_id': table_id,
            'result': result,
            'tax': tax,
            'supply_value': supply_value,
            'status': 'pending_confirmation',  # pending_confirmation / cancel_requested / confirmed
        }

    # 현금영수증 발급 성공 시 취소 대기 등록
    if result.get('type') == 'SUCCESS' and payment_type == 'cash':
        resp = result.get('response') or {}
        if resp.get('cash'):
            _cash_receipt_cancels[payment_id] = {
                'status': 'pending',
                'table_id': table_id,
                'table_payment_list_id': None,
            }

    # POS에 결과 전송 (payment_type 포함 — 현금/카드 구분용)
    # pending은 이미 pop됐어도 변수에 참조가 남아있음
    orig_payment_key = pending.get('payment_key', '') if pending else ''
    socketio.emit('toss_payment_result', {
        'payment_id': payment_id,
        'table_id': table_id,
        'result': result,
        'payment_type': payment_type,
        'tax': tax,
        'supply_value': supply_value,
        'payment_key': orig_payment_key,
    }, to='pos_group')

    return jsonify({'status': 'ok'})


@pos_bp.route('/toss/approval_status', methods=['GET'])
def get_toss_approval_status():
    """단말기가 결제 승인 후 확정/취소 신호를 폴링"""
    token = request.args.get('token')
    payment_id = request.args.get('payment_id')
    if token:
        record = TerminalToken.query.filter_by(token=token).first()
        if record:
            record.last_polled_at = datetime.now()
            db.session.commit()
    if not payment_id:
        return jsonify({'status': 'not_found'})
    payment = _completed_payments.get(payment_id)
    if not payment:
        return jsonify({'status': 'not_found'})
    return jsonify({'status': payment['status']})


@pos_bp.route('/toss/cancel_approval', methods=['POST'])
@login_required
def cancel_toss_approval():
    """POS에서 카드 승인 취소 요청 → 단말기가 폴링으로 감지 후 requestPaymentCancel() 호출"""
    data = request.get_json()
    payment_id = data.get('payment_id')
    payment = _completed_payments.get(payment_id)
    if not payment:
        return jsonify({'error': '결제 정보를 찾을 수 없습니다.'}), 404
    payment['status'] = 'cancel_requested'
    print(f'[Toss] 승인 취소 요청: payment_id={payment_id}')
    return jsonify({'status': 'ok'})


@pos_bp.route('/toss/confirm_approval', methods=['POST'])
@login_required
def confirm_toss_approval():
    """POS에서 카드 승인 확정 (취소 없이 결제 완료 처리)"""
    data = request.get_json()
    payment_id = data.get('payment_id')
    payment = _completed_payments.get(payment_id)
    if payment:
        payment['status'] = 'confirmed'
    print(f'[Toss] 승인 확정: payment_id={payment_id}')
    return jsonify({'status': 'ok'})


@pos_bp.route('/toss/cancel_result', methods=['POST'])
def submit_toss_cancel_result():
    """단말기가 requestPaymentCancel() 결과 전송 → POS에 socket emit"""
    data = request.get_json()
    payment_id = data.get('payment_id')
    table_id = data.get('table_id')
    result = data.get('result')

    _completed_payments.pop(payment_id, None)

    print(f'[Toss] 승인 취소 결과: payment_id={payment_id}, type={result.get("type") if result else "N/A"}')

    socketio.emit('toss_cancel_result', {
        'payment_id': payment_id,
        'table_id': table_id,
        'result': result,
    }, to='pos_group')

    return jsonify({'status': 'ok'})

@pos_bp.route('/toss/terminal_online', methods=['GET'])
@login_required
def check_terminal_online():
    """단말기 폴링 기반 온라인 상태 확인 (POS에서 주기적으로 호출)"""
    from app.models import Store, TerminalToken
    from datetime import datetime, timedelta
    store = Store.query.get(current_user.id)
    if not store:
        return jsonify({'online': False})
    record = TerminalToken.query.filter_by(store_id=store.id)\
        .order_by(TerminalToken.created_at.desc()).first()
    if not record or not record.last_polled_at:
        return jsonify({'online': False})
    is_online = (datetime.now() - record.last_polled_at).total_seconds() < 5
    return jsonify({'online': is_online})

# ─────────────────────────────────────────────────────────────────────────────


@pos_bp.route('/tableList')
def tableList():
    return render_template('pos/pos_shell.html')


@pos_bp.route('/set_group', methods=['GET', 'POST'])
def set_group():
    group_data = request.get_json()
    return set_table_group(group_data)


@pos_bp.route('/get_table_page', methods=['GET'])
def get_table_page():

    store_id = current_user.id

    # 실행할 코드
    orders = get_orders_by_store_id(store_id)
    

    # # 가져온 데이터 사용 예시
    # for order in orders:
    #     print(order.id, order.ordered_at, order.menu_id, order.table_id, order.menu_options)
    
    # table_id를 기준으로 중복 제거하여 딕셔너리로 구성
    orders_by_table = {}
    for order in orders:
        table_id = order.table_id
        if table_id not in orders_by_table:
            orders_by_table[table_id] = []
        orders_by_table[table_id].append(order)
    
    all_table_list = []
    
    
    table_categories = select_table_category(store_id)

    
    for t in table_categories:
        category_name = t.category_name
        category_id = t.id

        

        tables = select_table(category_id)
        sorted_tables = sorted(tables, key=lambda table: (table.position or 0))

        def sort_table(table):
            
            if table.id in dict(orders_by_table):
                # print("있음")
                orders = orders_by_table[table.id]
                orderList = []
                for order in orders:

                    optionList = []
                    options = json.loads(order.menu_options) if order.menu_options else []
                    for option_data in options:
                        option = select_menu_option(option_data['id'])
                        if option :
                            option = option[0]
                            optionList.append({
                                "optionId" : option.id,
                                "option" : option.name,
                                "price" : option.price,
                                "count" : option_data['count']
                            })
                    menu = select_menu(order.menu_id)[0]
                    orderList.append({
                        "menuId" : order.menu_id,
                        "menu" : menu.name,
                        "price" : menu.price,
                        "count" : 1,
                        "optionList" : optionList
                    })
                # 미완료 주문이 하나라도 있으면 '조리 중'(1), 모두 완료면 '조리완료'(2)
                pending_count = sum(1 for o in orders if o.order_status_id == 1)
                statusId = 1 if pending_count > 0 else 2
                return {
                    "tableId": table.id,
                    "table": table.name,
                    "position": table.position,
                    "gridX": table.grid_x,
                    "gridY": table.grid_y,
                    "gridW": table.grid_w,
                    "gridH": table.grid_h,
                    "statusId": statusId,
                    "status": "",
                    "groupId" : table.is_group,
                    "groupNum" : None,
                    "groupColor" : table.group_color,
                    "orderList" : orderList,
                }
            else :
                # print("없음")
                return {
                    "tableId": table.id,
                    "table": table.name,
                    "position": table.position,
                    "gridX": table.grid_x,
                    "gridY": table.grid_y,
                    "gridW": table.grid_w,
                    "gridH": table.grid_h,
                    "statusId": 0,
                    "status": "",
                    "groupId" : table.is_group,
                    "groupNum" : None,
                    "groupColor" : table.group_color,
                    "orderList" : [],
                }

        all_table_list.append({
            "categoryId" : category_id,
            "category" : category_name,
            "tableList" : [sort_table(t) for t in sorted_tables],
        })

    return jsonify(all_table_list)


# ── 이전 영업일에서 넘어온 미처리(미결제·미완료) 테이블 ──────────────────────────
def _carryover_tables(store_id, cutoff):
    """이전 영업일에 시작됐는데 아직 정산되지 않은(열린 세션) 테이블 목록.
    결제 완료 시 주문/세션이 삭제되므로, 열린 세션 + 최초 주문이 현재 영업일 시작 이전이면
    '넘어온 건'(미결제 또는 조리 미완료)으로 본다."""
    day_start = business_day_start(cutoff)
    orders = get_orders_by_store_id(store_id)  # 열린 세션 주문만
    by_table = {}
    for o in orders:
        by_table.setdefault(o.table_id, []).append(o)

    result = []
    for table_id, ords in by_table.items():
        ats = [o.ordered_at for o in ords if o.ordered_at]
        first_at = min(ats) if ats else None
        if not first_at or first_at >= day_start:
            continue  # 이번 영업일 건 → 제외
        table = Table.query.get(table_id)
        table_name = table.name if table else f"테이블 {table_id}"
        item_map = {}
        for o in ords:
            m = select_menu(o.menu_id)
            name = m[0].name if m else f"메뉴 {o.menu_id}"
            item_map[name] = item_map.get(name, 0) + 1
        items = [{"name": n, "count": c} for n, c in item_map.items()]
        pending = sum(1 for o in ords if o.order_status_id == 1)
        result.append({
            "table_id": table_id,
            "table_name": table_name,
            "order_ids": [o.id for o in ords],
            "items": items,
            "order_count": len(ords),
            "pending_count": pending,   # >0 이면 조리 미완료 포함
            "first_order_time": first_at.strftime('%Y-%m-%d %H:%M'),
        })
    result.sort(key=lambda x: x['first_order_time'])
    return day_start, result


@pos_bp.route('/carryover_check', methods=['GET'])
@login_required
def carryover_check():
    store_id = current_user.id
    day_start, tables = _carryover_tables(store_id, getattr(current_user, 'business_day_cutoff', None))
    return jsonify({
        "business_day": day_start.strftime('%Y-%m-%d'),
        "tables": tables,
    })


@pos_bp.route('/carryover_delete', methods=['POST'])
@login_required
def carryover_delete():
    store_id = current_user.id
    data = request.get_json() or {}
    table_ids = data.get('table_ids', [])
    if not isinstance(table_ids, list) or not table_ids:
        return jsonify({'code': 400, 'msg': 'table_ids required'}), 400

    from app.models.payment import delete_order_tableorderlist
    day_start, tables = _carryover_tables(store_id, getattr(current_user, 'business_day_cutoff', None))
    by_id = {t['table_id']: t for t in tables}
    biz = day_start.strftime('%Y-%m-%d')
    deleted, all_order_ids = [], []
    try:
        for tid in table_ids:
            info = by_id.get(tid)
            if not info:
                continue  # 이미 처리됐거나 대상 아님
            db.session.add(CarryoverDeletionLog(
                store_id=store_id,
                table_id=tid,
                table_name=info['table_name'],
                business_day=biz,
                order_summary=json.dumps(info['items'], ensure_ascii=False),
                order_count=info['order_count'],
                first_order_time=datetime.strptime(info['first_order_time'], '%Y-%m-%d %H:%M'),
            ))
            all_order_ids.extend(info['order_ids'])
            delete_order_tableorderlist(store_id, tid)  # 주문 + 테이블 세션 제거(내부 commit)
            deleted.append(tid)
    except Exception as e:
        db.session.rollback()
        return jsonify({'code': 500, 'msg': str(e)}), 500

    if all_order_ids:
        # 삭제된 주문 반영: KDS는 재로드(취소 카드 노이즈 방지), 다른 POS 단말도 테이블 목록 갱신
        socketio.emit('kds_order_completed', {'order_ids': all_order_ids}, room=f'store_{store_id}_kds')
        socketio.emit('kds_order_completed', {'order_ids': all_order_ids}, room='pos_group')
    return jsonify({'code': 200, 'deleted': deleted})

    # # JSON 파일 로드
    # with open(json_file_path, 'r', encoding='UTF-8') as file:
    #     json_data = json.load(file)

    # # JSON 데이터를 프론트에 반환
    # return jsonify(json_data)


# 테이블 -> 메뉴리스트 페이지
@pos_bp.route('/menuList/<table_id>', methods=['GET'])
def menuList(table_id):
    return render_template('pos/pos_shell.html')

# 테이블 주문내역 조회
@pos_bp.route('/get_table_order_list/<table_id>', methods=['GET'])
def get_table_order_list(table_id):
    orders = find_order_list(table_id)
    order_list = []
    for order in orders:
        menu = select_menu(order.menu_id)[0]
        options = []
        for menu_option in json.loads(order.menu_options):
            option = select_menu_option(menu_option['id'])
            if option :
                option = option[0]
                options.append({
                    "id" : option.id,
                    "name" : option.name,
                    "price" : option.price,
                    "count" : menu_option['count']
                })
        order_list.append({
            "order_id" : order.id,
            "id" : menu.id,
            "name" : menu.name,
            "price" : menu.price,
            "count" : 1,
            "options" : options
        })
    
    return jsonify(order_list)



# pos->테이블 클릭시
@pos_bp.route('/get_menu_list', methods=['GET'])
def get_main_sub_menu_list():
    # 로그인 매장(POS)은 current_user, QR 손님은 세션 쿠키 컨텍스트에서 store_id 확보
    if current_user.is_authenticated:
        store_id = current_user.id
    else:
        from app.utils.qr_auth import resolve_customer_context
        store_id, _ = resolve_customer_context()
    if store_id is None:
        return jsonify({'error': 'Unauthorized'}), 401

    all_menu_list = []
    menu_categories = select_main_category(store_id) # 메인 카테고리 조회
    for main_category in menu_categories:
        sub_categories = select_sub_category(main_category.id)
        sub_category_list = []
        for sub_category in sub_categories:
            # sub_category_page = ~~~(sub_category.id)
            page_list = []

            all_menu = db.session.query(Menu)\
                                .filter(Menu.menu_category_id == sub_category.id)\
                                .all()
            for menu in all_menu:
                option_list = select_menu_option_all(menu.id)
                if not option_list:
                    option_list = []
                # for option in all_option:
                #     option_list.append({
                #         'optionId': option.id,
                #         'option': option.name,
                #         'price': option.price
                #     })
                menu_dict = {
                    'menuId': menu.id,
                    'menu': menu.name,
                    'price': menu.price,
                    'page': menu.page,
                    'position': menu.position,
                    'optionList': option_list,
                    'mainDescription': menu.main_description,
                    'imageUrl': menu.image.split(', ')[0] if menu.image else '',
                    'imageList': menu.image.split(', ') if menu.image else []
                }


                # page_list = []
                for p in page_list:
                    if p['page'] == menu.page:
                        p['menuList'].append(menu_dict)
                        break
                else:
                    page_list.append({
                        'page':menu.page,
                        'menuList':[menu_dict]
                    })


            sub_category_list.append({
                'subCategoryId': sub_category.id,
                'subCategory': sub_category.name,
                'pageList' : page_list
            })

        all_menu_list.append({
            'categoryId': main_category.id,
            'category': main_category.name,
            'subCategoryList': sub_category_list
        })


    # dummy = [
    #     {
    #         'categoryId': 1,
    #         'category': '식사류',
    #         'subCategoryList': [
    #             {
    #                 'subCategoryId': 1,
    #                 'subCategory': '식사류',
    #                 'pageList' : [
    #                     {
    #                         'page': 1,
    #                         'menuList': [
    #                             {
    #                                 'menuId': 1,
    #                                 'menu': '짜장면',
    #                                 'price': 6000,
    #                                 'page': 1,
    #                                 'position': 1,
    #                                 'optionList': [
    #                                     {
    #                                         'optionId':42,
    #                                         'option':'소시지',
    #                                         'price':1000
    #                                     },
    #                                     {
    #                                         'optionId':42,
    #                                         'option':'소시지',
    #                                         'price':1000
    #                                     },
    #                                 ]
    #                             }
    #                         ]
    #                     }
    #                 ]
    #             },
    #         ]
    #     },
    # ]



    return jsonify(all_menu_list)


'''
# 테이블 -> 메뉴리스트에 필요한 메뉴 데이터 (json)
@pos_bp.route('/get_menu_list/<table_id>', methods=['GET'])
def get_menu_list(table_id):
    
    store_id = current_user.id
    all_menu_list = []
    menu_categories = select_main_category(store_id) # 메인 카테고리 조회
    for t in menu_categories:
        category_name = t.name
        category_id = t.id
        menus = select_menu_all_to_main_category(category_id)
        
        sorted_menus = sorted(menus, key=lambda menu: (menu.page, menu.position))
        
        def sort_menu(menu):
            option_list = []
            menu_options = select_menu_option_all(menu.id)
            if isinstance(menu_options, list):
                for option in menu_options:
                    option_data = {
                        "optionId" : option.id,
                        "option" : option.name,
                        "price" : option.price
                    }
                    option_list.append(option_data)
            return {
                "menuId": menu.id, 
                "menu": menu.name,
                "price": menu.price,
                "page": menu.page,
                "position" : menu.position,
                "optionList" : option_list
            }

        # 페이지별로 그룹화
        page_list = [];
        current_page = None
        if len(sorted_menus) > 0:    
            for menu in sorted_menus:
                if menu.page != current_page:
                    current_page = menu.page
                    page_list.append({
                        "page": current_page, 
                        "menuList": [sort_menu(menu)]
                    })
                else:
                    page_list[-1]["menuList"].append(sort_menu(menu))
        else:
            page_list.append({
                "page": 1, 
                "menuList": []
            })
        all_menu_list.append({
            "categoryId" : category_id,
            "category" : category_name,
            "pageList" : page_list
        })


    # print("@@@#$",get_main_sub_menu_list())
    # print("allll_menu_list", all_menu_list)
    return jsonify(all_menu_list)

    # # JSON 파일 경로 설정
    # json_file_path = 'app/static/json/menuList.json'
        
    # # JSON 파일 로드
    # with open(json_file_path, 'r', encoding='UTF-8') as file:
    #     json_data = json.load(file)
    # print(json_data)
    # return jsonify(json_data)
'''


# 테이블 이동/합석
@pos_bp.route('/set_table', methods=['PUT'])
def set_table_list():
    table_data = request.get_json()
    for data in table_data:       
        end_id = data['end_table_id']
        start_id = data['start_table_id'] # end_id로 이동할 테이블
        set_table = move_table(end_id, start_id)
    response = jsonify({'message': 'Success'})
    response.status_code = 200
    print('Received JSON data:', set_table)
    return response


# 테이블 -> 메뉴리스트 페이지
@pos_bp.route('/payment/<table_id>', methods=['GET'])
def payment(table_id):
    from app.models import Table
    t = Table.query.get(table_id)
    return render_template('pos/pos_shell.html', pos_table_name=(t.name if t else None))

# 현금 결제 후 영수증 정보 업데이트
@pos_bp.route('/payment/update_cash_receipt', methods=['PATCH'])
@login_required
def update_cash_receipt():
    from app.models import TablePaymentList
    data = request.get_json()
    tpl_id = data.get('table_payment_list_id')
    cash_receipt = data.get('cash_receipt')
    if not tpl_id:
        return jsonify({'error': 'table_payment_list_id required'}), 400
    store_id = current_user.id
    item = db.session.query(TablePaymentList).filter_by(id=tpl_id, store_id=store_id).first()
    if not item:
        return jsonify({'error': 'not found'}), 404
    ph = json.loads(item.payment_history) if item.payment_history else {}
    if cash_receipt:
        ph['toss_cash_receipt'] = cash_receipt
    if data.get('payment_key'):
        ph['toss_payment_key'] = data['payment_key']
    if data.get('tax') is not None:
        ph['toss_tax'] = data['tax']
    if data.get('supply_value') is not None:
        ph['toss_supply_value'] = data['supply_value']
    if data.get('timestamp'):
        ph['toss_timestamp'] = data['timestamp']
    item.payment_history = json.dumps(ph)
    db.session.commit()
    # 현금영수증 취소 대기에 tpl_id 연결
    payment_id = data.get('payment_id')
    if payment_id and payment_id in _cash_receipt_cancels:
        _cash_receipt_cancels[payment_id]['table_payment_list_id'] = tpl_id
    return jsonify({'status': 'ok'})


@pos_bp.route('/payment/save_refund_result', methods=['PATCH'])
@login_required
def save_refund_result():
    """환불 성공 결과 DB 저장 — payment_status=2, toss_cancel_result 기록"""
    from app.models import TablePaymentList, Payment
    from datetime import datetime as dt
    data = request.get_json()
    tpl_id = data.get('table_payment_list_id')
    cancel_result = data.get('cancel_result')
    if not tpl_id:
        return jsonify({'error': 'table_payment_list_id required'}), 400
    store_id = current_user.id
    tpl = db.session.query(TablePaymentList).filter_by(id=tpl_id, store_id=store_id).first()
    if not tpl:
        return jsonify({'error': 'not found'}), 404
    for p in Payment.query.filter_by(table_payment_list_id=tpl_id).all():
        if p.payment_status != 2:
            p.payment_status = 2
    ph = json.loads(tpl.payment_history) if tpl.payment_history else {}
    if cancel_result:
        ph['toss_cancel_result'] = cancel_result
    ph['toss_cancel_time'] = dt.now().isoformat()
    tpl.payment_history = json.dumps(ph)
    db.session.commit()
    return jsonify({'status': 'ok'})


@pos_bp.route('/toss/cash_receipt_cancel', methods=['POST'])
@login_required
def cash_receipt_cancel():
    """POS에서 현금영수증 취소 요청 → 단말기 폴링으로 감지"""
    data = request.get_json()
    payment_id = data.get('payment_id')
    if not payment_id or payment_id not in _cash_receipt_cancels:
        return jsonify({'error': '취소 정보를 찾을 수 없습니다.'}), 404
    _cash_receipt_cancels[payment_id]['status'] = 'cancel_requested'
    print(f'[Toss] 현금영수증 취소 요청: payment_id={payment_id}')
    return jsonify({'status': 'ok'})


@pos_bp.route('/toss/cash_receipt_cancel_status', methods=['GET'])
def get_cash_receipt_cancel_status():
    """단말기가 현금영수증 취소 여부 폴링"""
    from app.models import TerminalToken
    from datetime import datetime
    token = request.args.get('token')
    payment_id = request.args.get('payment_id')
    if token:
        record = TerminalToken.query.filter_by(token=token).first()
        if record:
            record.last_polled_at = datetime.now()
            db.session.commit()
    if not payment_id or payment_id not in _cash_receipt_cancels:
        return jsonify({'status': 'expired'})
    return jsonify({'status': _cash_receipt_cancels[payment_id].get('status', 'pending')})


@pos_bp.route('/toss/cash_receipt_cancel_result', methods=['POST'])
def submit_cash_receipt_cancel_result():
    """단말기가 현금영수증 취소 결과 전송 → DB 저장 + POS emit"""
    from app.models import TablePaymentList, Payment
    from datetime import datetime as dt
    data = request.get_json()
    payment_id = data.get('payment_id')
    table_id = data.get('table_id')
    result = data.get('result')

    cancel_info = _cash_receipt_cancels.pop(payment_id, None)
    tpl_id = cancel_info.get('table_payment_list_id') if cancel_info else None

    if result and result.get('type') == 'SUCCESS' and tpl_id:
        tpl = db.session.query(TablePaymentList).filter_by(id=tpl_id).first()
        if tpl:
            for p in Payment.query.filter_by(table_payment_list_id=tpl_id).all():
                if p.payment_status != 2:
                    p.payment_status = 2
            ph = json.loads(tpl.payment_history) if tpl.payment_history else {}
            ph['toss_cancel_result'] = result
            ph['toss_cancel_time'] = dt.now().isoformat()
            tpl.payment_history = json.dumps(ph)
            db.session.commit()

    print(f'[Toss] 현금영수증 취소 결과: payment_id={payment_id}, type={result.get("type") if result else "N/A"}')
    socketio.emit('toss_cash_receipt_cancel_result', {
        'payment_id': payment_id,
        'table_id': table_id,
        'result': result,
    }, to='pos_group')
    return jsonify({'status': 'ok'})


# 테이블 결제 내역 조회
@pos_bp.route('/payment_history/<table_id>', methods=['GET', 'POST'])
@login_required
def payment_history(table_id):

    from app.models.payment import make_payment_history, create_payment_database
    store_id = current_user.id

    if request.method == 'GET':     # 첫 결제하기 들어왔을 때
        print("###",'get')
        table_payment_data = make_payment_history(store_id, table_id)
    else:                           # 결제중
        print("###",'post')
        payment_data = request.get_json()
        table_payment_data = create_payment_database(store_id, payment_data)

    return table_payment_data

# 직원 호출 로그 조회 (최근 20개)
@pos_bp.route('/get_staff_call_logs', methods=['GET'])
@login_required
def api_get_staff_call_logs():
    store_id = current_user.id
    
    # 1. Fetch Staff Call Logs
    logs = get_staff_call_logs(store_id, limit=50) # Fetch more to account for grouping
    
    # Grouping logic for Staff Calls
    grouped_data = {}
    
    for log, item, table_name in logs:
        key = log.request_id if log.request_id else f"log_{log.id}"
        
        if key not in grouped_data:
            grouped_data[key] = {
                'id': log.id, # Use representative ID
                'type': 'staff_call',
                'table_name': table_name if table_name else f'테이블 {log.table_id}',
                'requestTime': log.called_at,
                'confirmTime': log.confirmed_at,
                'items': []
            }
        
        item_name = item.name if item else '직원 호출'
        if item and item.use_quantity:
            grouped_data[key]['items'].append(f"{item_name} {log.quantity}개")
        else:
            grouped_data[key]['items'].append(f"{item_name}")

    # 2. Fetch Orders (Recent 50)
    # Order Status: 1 (Requested/Cooking), 2 (Confirmed/Finished), 0 (Cooking? - check logic)
    # Assuming 1 is new order, 2 is confirmed/completed.
    # We want to show orders as notifications.
    from app.models import Order, Table, TableCategory
    
    orders = db.session.query(Order, Table.name)\
        .join(Table, Order.table_id == Table.id)\
        .join(TableCategory, Table.table_category_id == TableCategory.id)\
        .filter(TableCategory.store_id == store_id)\
        .filter(Order.order_status_id.in_([1, 2]))\
        .order_by(Order.ordered_at.desc())\
        .limit(50).all()

    orders_data = []
    for order, table_name in orders:
        menu = select_menu(order.menu_id)
        menu_name = menu[0].name if menu else 'Unknown Menu'

        options = []
        try:
            options_data = json.loads(order.menu_options) if order.menu_options else []
            for opt in options_data:
                opt_obj = select_menu_option(opt['id'])
                if opt_obj:
                    options.append(f"{opt_obj[0].name}")
        except:
            pass

        item_str = f"{menu_name}"
        if options:
            item_str += f" ({', '.join(options)})"

        orders_data.append({
            'id': order.id,
            'table_name': table_name,
            'ordered_at': order.ordered_at,
            'status': order.order_status_id,
            'item': item_str,
            'is_pos': order.is_pos,
            'acknowledged_at': order.acknowledged_at,
        })

    # Group orders by (table_name + ordered_at 초 단위)
    grouped_orders = {}
    for o in orders_data:
        key = f"order_{o['table_name']}_{o['ordered_at'].strftime('%Y%m%d%H%M%S')}"

        if key not in grouped_orders:
            grouped_orders[key] = {
                'id': f"order_{o['id']}",
                'type': 'order',
                'table_name': o['table_name'],
                'requestTime': o['ordered_at'],
                'confirmTime': None,
                'source': '포스기' if o['is_pos'] else '테이블 오더',
                'items': [],
                '_is_pos': o['is_pos'],
                '_unacked': False,          # 확인 안 된 항목이 하나라도 있는지
                '_acked_at': None,          # 확인 시각(가장 이른 것)
            }

        grouped_orders[key]['items'].append(o['item'])
        # 알림 '확인' 여부는 acknowledged_at 기준(조리 상태와 무관)
        if o['acknowledged_at'] is None:
            grouped_orders[key]['_unacked'] = True
        else:
            prev = grouped_orders[key]['_acked_at']
            if prev is None or o['acknowledged_at'] < prev:
                grouped_orders[key]['_acked_at'] = o['acknowledged_at']

    # 확인 상태 결정: 포스기 주문은 자동 확인, 그 외에는 그룹 전체가 확인(acknowledged)됐을 때만 확인됨
    for g in grouped_orders.values():
        if g['_is_pos']:
            g['confirmTime'] = g['requestTime']
        elif not g['_unacked'] and g['_acked_at'] is not None:
            g['confirmTime'] = g['_acked_at']

    # Merge & Sort
    final_list = list(grouped_data.values()) + list(grouped_orders.values())
    final_list.sort(key=lambda x: x['requestTime'], reverse=True)

    result = []
    for group in final_list[:50]:
        if group['type'] == 'staff_call':
            is_generic = len(group['items']) == 1 and '직원 호출' in group['items'][0]
            if is_generic:
                text = f"<b>{group['table_name']}</b>에서 직원을 호출했습니다."
            else:
                items_html = '<br>'.join([f"- {item}" for item in group['items']])
                text = f"<b>{group['table_name']}</b><br>{items_html}"
            items_text = ', '.join(group['items'])
            source = None
        else:
            items_html = '<br>'.join([f"- {item}" for item in group['items']])
            source = group.get('source', '테이블 오더')
            text = f"<b>{group['table_name']}</b> 주문 <span class='noti-source'>[{source}]</span><br>{items_html}"
            items_text = ', '.join(group['items'])

        result.append({
            'id': group['id'],
            'table_name': group['table_name'],
            'items_text': items_text,
            'requestTime': group['requestTime'].strftime('%H:%M:%S'),
            'confirmTime': group['confirmTime'].strftime('%H:%M:%S') if group['confirmTime'] else None,
            'text': text,
            'is_order': group['type'] == 'order',
            'source': source,
        })

    return jsonify(result)


# 매장 정보 조회 (영수증용)
@pos_bp.route('/get_store_info', methods=['GET'])
@login_required
def get_store_info():
    from app.models import Store
    store = Store.query.filter_by(id=current_user.id).first()
    if not store:
        return jsonify({})

    return jsonify({
        "name": store.name,
        "business_number": store.business_number,
        "representative_name": store.representative_name,
        "address": store.address,
        "tel": store.tel
    })
