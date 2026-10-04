from flask import session, jsonify, request, render_template, redirect
from flask_login import LoginManager, UserMixin, login_required

from app.models import db, Store, User
from app.models.user import get_user_by_userid, get_store_by_storeid

from app import login_manager # Flask-login의 변수


# 사용자 로드 함수
@login_manager.user_loader
def load_user(store_id):
    # current_user 는 항상 Store. 사장님 로그인만 된 세션(user_type='admin')은 매장 인증으로 취급하지 않는다
    # (과거 세션은 사장님 User.id 가 저장돼 있어 같은 번호의 다른 매장으로 로드될 수 있었음)
    if session.get('user_type') == 'admin':
        return None
    return get_store_by_storeid(store_id)


# 로그인이 되어있지 않은 경우
@login_manager.unauthorized_handler
def unauthorized_callback():
    # 사장님 로그인은 됐지만 매장을 고르지 않은 경우 → 매장 선택으로
    if session.get('admin_user_id') and request.method == 'GET':
        return redirect('/stores')
    return render_template('login.html')


# # 유저 세선 등록
# def update_user_session(user_item):
#     session['user_item'] = user_item
#     return jsonify({'message': '유저 세션 등록 성공'}), 200


# 스토어 세선 등록
def update_store_session(store_id):
    store_item = db.query(Store).filter(Store.id == store_id).first()
    if store_item is None:
        return jsonify({'message': '스토어 세션 등록 실패'}), 400

    session['store_item'] = store_item

    return jsonify({'message': '스토어 세션 등록 성공'}), 200