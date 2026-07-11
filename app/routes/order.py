from flask import render_template, request, jsonify
from app.routes import order_bp
from flask_login import login_required, current_user
import traceback

from app.models.order import make_order, delete_order

# 주문하기 클릭
@order_bp.route('/', methods=['POST'])
@login_required
def menu_order():
    try:
        store_id = current_user.id
        order_data = request.get_json()
        table_id = int(order_data['table_id'])
        order_list = order_data['order_list']
        is_pos = order_data.get('is_pos', False)
        make_order(store_id, table_id, order_list, is_pos=is_pos)
        from app import socketio
        if not is_pos:
            # 손님 주문일 때만 포스기에 알림 전송
            from app.models import Table
            _t = Table.query.get(table_id)
            socketio.emit('update_pos', {
                'table_id': table_id,
                'table_name': _t.name if _t else f'테이블 {table_id}',
                'message': '새로운 주문이 들어왔습니다.',
                'is_pos': is_pos,
                'order_list': order_list
            }, room='pos_group')
        # 테이블 오더(손님)에게 알림 전송
        socketio.emit('new_order_notification', {'message': '새로운 주문이 등록되었습니다.'}, room=f'table_{store_id}_{table_id}')
        # KDS에 새 주문 알림
        socketio.emit('kds_new_order', {
            'table_id': table_id,
            'store_id': store_id,
        }, room=f'store_{store_id}_kds')
    except Exception as e:
        print(f"Error making order: {e}")
        traceback.print_exc()
        from app import db
        db.session.rollback()
        return jsonify("failed"), 400
    
    return jsonify({
        'message': 'Success',
        'code' : 200
        }), 200


# 테이블 주문 취소
@order_bp.route('/delete_order', methods=['POST'])
@login_required
def api_delete_order():
    order_id_list = request.get_json()['order_id_list']
    print("order###", order_id_list)
    res = delete_order(order_id_list)
    if res:
        from app import socketio
        store_id = current_user.id
        socketio.emit('kds_orders_cancelled', {'order_ids': order_id_list}, room=f'store_{store_id}_kds')
        return jsonify({'message': 'Success', 'code': 200}), 200


# 결제
@order_bp.route('/payment/<table_id>', methods=['GET'])
def table_payment(table_id):
    return "temp"