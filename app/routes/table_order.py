from app.routes import table_order_bp
from app.models.order import make_order
from app.models.staff_call import get_staff_call_items, record_staff_call

from flask import render_template, request, jsonify
from flask_login import login_required, current_user

from app import socketio
from flask_socketio import join_room, emit

# 실시간 접속 테이블 추적 (Key: store_id, Value: {table_id: sid})
CONNECTED_TABLES = {}

def get_active_tables(store_id):
    if store_id in CONNECTED_TABLES:
        return list(CONNECTED_TABLES[store_id].keys())
    return []

def broadcast_table_status(store_id):
    active_tables = get_active_tables(store_id)
    emit('table_status_update', {'active_tables': active_tables}, room=f'store_{store_id}_login')

@socketio.on('join_table_order')
def on_join_table_order(data):
    store_id = data.get('store_id')
    table_id = str(data.get('table_id'))
    sid = request.sid

    if not store_id or not table_id:
        return

    # 중복 접속 처리 (기존 접속 강제 로그아웃)
    if store_id in CONNECTED_TABLES and table_id in CONNECTED_TABLES[store_id]:
        old_sid = CONNECTED_TABLES[store_id][table_id]
        if old_sid != sid:
            emit('force_logout', {'message': '다른 기기에서 접속하여 로그아웃됩니다.'}, room=old_sid)
    
    if store_id not in CONNECTED_TABLES:
        CONNECTED_TABLES[store_id] = {}
    
    CONNECTED_TABLES[store_id][table_id] = sid
    
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
        for table_id, t_sid in list(tables.items()):
            if t_sid == sid:
                del tables[table_id]
                print(f'Table Order Disconnected: Store {store_id}, Table {table_id}, SID {sid}')
                broadcast_table_status(store_id)
                return

@socketio.on('table_order_login')
def table_order_login(data):
  if data.get('user_type') == 'table_order':
    join_room('table_order_group')
    print('data::',data)
    emit('login_response', {'message': '로그인이 성공하여 table_order_group 그룹에 추가되었습니다.'})
    return {'msg': '로그인이 성공하여 table_order 그룹에 추가되었습니다.'}

@socketio.on('new_order_pos_update')
def new_order_pos_update(data):
  store_id = data.get('store_id')
  table_id = data.get('table_id')
  order_list = data.get('order_list')

  make_order(store_id, table_id, order_list)

  # 포스기에 주문 업데이트 요청
  emit('update_pos', data, room='pos_group')
  # KDS에 새 주문 알림
  socketio.emit('kds_new_order', {'table_id': table_id, 'store_id': store_id}, room=f'store_{store_id}_kds')

@table_order_bp.route('/get_info', methods=['GET'])
def get_info():
    if not current_user.is_authenticated:
        return jsonify({'error': 'Unauthorized', 'code': 401}), 401
    return jsonify({
        'store_id': current_user.id
    })

# 특정 테이블 접속(로그인) 함수
@table_order_bp.route('/login', methods=['GET', 'POST'])
@login_required
def login():
  if request.method == 'GET':
    return render_template('/table_order/login.html') 
  if request.method == 'POST':
    table_number = request.form.get('table_number')
    # 테이블 번호로 DB에 아이디 조회
    response = jsonify({
      'message': 'Success',
      'code' : 200,
      'data' : {'table_id' : 1}
    }) 
    return response


@table_order_bp.route('/main', methods=['GET', 'POST'])
@login_required
def main():
  if request.method == 'GET':
    table_id = request.args.get('table_id')
    table_name = ''
    if table_id:
        from app.models import Table
        table = Table.query.get(table_id)
        if table:
            table_name = table.name
            
    return render_template('/table_order/main.html', table_name=table_name)
  if request.method == 'POST':
    table_id = request.form.get('table_id')
    # 테이블 주문 내역 리턴?
    response = jsonify({
      'message': 'Success',
      'code' : 200,
      'data' : {'table_id' : 1}
    }) 
    return response

@table_order_bp.route('/get_order_history/<int:table_id>', methods=['GET'])
@login_required
def get_order_history(table_id):
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

from datetime import datetime

# 직원 호출 항목 조회 API (테이블 오더용)
@table_order_bp.route('/get_staff_call_items', methods=['GET'])
def api_table_get_staff_call_items():
    from app.models import Store
    store_id = request.args.get('store_id')
    if not store_id:
        return jsonify({'error': 'Store ID required'}), 400
    
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
    data = request.get_json()
    store_id = data.get('store_id')
    table_id = data.get('table_id')
    requests_data = data.get('requests', []) # List of {item_id, quantity}
    
    if not store_id or not table_id:
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