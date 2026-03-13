from flask import render_template, request, jsonify
from app.routes import order_bp
from flask_login import login_required, current_user

from app.models.order import make_order, delete_order

# 주문하기 클릭
@order_bp.route('/', methods=['POST'])
def menu_order():
    store_id = current_user.id
    order_data = request.get_json()
    table_id = order_data['table_id']
    order_list = order_data['order_list']

    try:
        is_pos = order_data.get('is_pos', False)
        make_order(store_id, table_id, order_list)
        # 포스기에 주문 업데이트 알림 전송
        from app import socketio
        from flask_socketio import emit
        print(f"Emitting update_pos to table {table_id}")
        socketio.emit('update_pos', {
            'table_id': table_id, 
            'message': '새로운 주문이 들어왔습니다.',
            'is_pos': is_pos,
            'order_list': order_list
        }, room='pos_group')
        # 테이블 오더(손님)에게 알림 전송
        socketio.emit('new_order_notification', {'message': '새로운 주문이 등록되었습니다.'}, room=f'table_{store_id}_{table_id}')
    except Exception as e:
        print(f"Error making order: {e}")
        return jsonify("failed"), 400
    
    return jsonify({
        'message': 'Success',
        'code' : 200
        }), 200


# 테이블 주문 취소
@order_bp.route('/delete_order', methods=['POST'])
def api_delete_order():
    order_id_list = request.get_json(force=True)
    order_id_list = request.get_json()['order_id_list']
    print("order###", order_id_list)
    res = delete_order(order_id_list)
    if res:  
        response = jsonify({
        'message': 'Success',
        'code' : 200
        })
        response.status_code = 200
        return response


# 결제
@order_bp.route('/payment/<table_id>', methods=['GET'])
def table_payment(table_id):
    return "temp"