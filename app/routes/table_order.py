from app.routes import table_order_bp

from flask import render_template, request, jsonify
from flask_login import login_required

from app import socketio
from flask_socketio import join_room, emit

@socketio.on('table_order_login')
def table_order_login(data):
  if data.get('user_type') == 'table_order':
    join_room('table_order_group')
    print('data::',data)
    emit('login_response', {'message': '로그인이 성공하여 table_order_group 그룹에 추가되었습니다.'})
    return {'msg': '로그인이 성공하여 table_order 그룹에 추가되었습니다.'}

@socketio.on('new_order_pos_update')
def new_order_pos_update(data):
  # 포스기에 주문 업데이트 요청
  emit('update_pos', data, room='pos_group')

# 특정 테이블 접속(로그인) 함수
@table_order_bp.route('/login', methods=['GET', 'POST'])
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
def main():
  if request.method == 'GET':
    return render_template('/table_order/main.html')
  if request.method == 'POST':
    table_id = request.form.get('table_id')
    # 테이블 주문 내역 리턴?
    response = jsonify({
      'message': 'Success',
      'code' : 200,
      'data' : {'table_id' : 1}
    }) 
    return response
  
  