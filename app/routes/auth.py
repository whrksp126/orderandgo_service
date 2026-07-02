from flask import render_template, request, jsonify, session
from flask_login import current_user, login_required, logout_user, login_user
from app.models import User
from app.routes import auth_bp
from flask import redirect, url_for


from app.models.user import create_admin_user, create_store_user, get_store_user_login, get_admin_user_login, update_store_logo_img, get_user_by_tel, reset_user_password
from app.models.store import get_store
from app.site_config import FIREBASE


def _verify_firebase_phone(id_token):
    """Firebase ID 토큰을 Google Identity Toolkit 로 검증하고 인증된 전화번호(E.164) 반환. 실패 시 None."""
    try:
        api_key = FIREBASE.get('apiKey')
        res = requests.post(
            f'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key={api_key}',
            json={'idToken': id_token}, timeout=5)
        if res.status_code != 200:
            return None
        users = res.json().get('users') or []
        return users[0].get('phoneNumber') if users else None
    except Exception as e:
        print(f'[Firebase] 토큰 검증 오류: {e}')
        return None


def _same_phone(e164, local):
    """+821012345678 == 01012345678 비교 (숫자만)."""
    a = ''.join(filter(str.isdigit, e164 or ''))
    if a.startswith('82'):
        a = '0' + a[2:]
    b = ''.join(filter(str.isdigit, local or ''))
    return a == b

import os
import random
import requests

# 로그인
@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'GET':
        # 관리자로 로그인된 경우 → 매장 선택 화면
        # (user_loader가 Store만 로드하므로 current_user.is_authenticated로 판단 불가, session 직접 사용)
        if session.get('user_type') == 'admin' and session.get('admin_user_id'):
            stores = get_store(session['admin_user_id'])
            store_list = [{'store_id': s.store_id, 'name': s.name} for s in stores]
            return render_template('login.html', store_list=store_list)
        # 스토어로 이미 로그인된 경우 → 대시보드로
        if current_user.is_authenticated:
            return redirect(url_for('main.dashboard'))

        return render_template('login.html')
    
    if request.method == 'POST':
        json_data = {}
        if request.form.get('admin_tel') is not None:       # 관리자 로그인
            tel = request.form.get('admin_tel')
            password = request.form.get('password')
            result = get_admin_user_login(tel, password)
            if result:
                session['user_type'] = 'admin'
                session['admin_user_id'] = result.id
                stores = get_store(result.id)
                json_data['store_list'] = [{'store_id': s.store_id, 'name': s.name} for s in stores]
        elif session.get('user_type') == 'admin':           # 관리자가 매장 선택 (비밀번호 불필요)
            from app.models import Store
            store_id_str = request.form.get('store_id')
            admin_user_id = session.get('admin_user_id')
            store = Store.query.filter_by(store_id=store_id_str, user_id=admin_user_id).first()
            if store:
                login_user(store)
                session['user_type'] = 'store'
                session.pop('admin_user_id', None)
                result = store
            else:
                result = False
        else:                                               # 스토어 직접 로그인
            store_id = request.form.get('store_id')
            password = request.form.get('password')
            result = get_store_user_login(store_id, password)
            if result:
                session['user_type'] = 'store'
                session.pop('admin_user_id', None)
        if result == False:
            print("로그인 실패")
            response = jsonify({
                'message': '로그인 실패, 일치하는 정보가 없습니다.',
                'code' : 400
            })
            return response
        
        response = jsonify({
            'message': 'Success',
            'code' : 200,
            'json_data' : json_data
            })
        return response


# 인증번호 발송
@auth_bp.route('/send_verify_code', methods=['POST'])
def send_verify_code():
    tel = request.form.get('tel')
    if not tel or len(tel) < 11:
        return jsonify({'code': 400, 'message': '올바른 전화번호를 입력해주세요.'})

    code = str(random.randint(100000, 999999))
    session['verify_code'] = code
    session['verify_tel'] = tel

    appkey    = os.environ.get('NHN_SMS_APPKEY')
    secret    = os.environ.get('NHN_SMS_SECRET_KEY')
    sender    = os.environ.get('NHN_SMS_SENDER')
    sms_url   = os.environ.get('NHN_SMS_URL')

    url = f'{sms_url}/sms/v3.0/appKeys/{appkey}/sender/sms'
    headers = {
        'Content-Type': 'application/json;charset=UTF-8',
        'X-Secret-Key': secret,
    }
    body = {
        'body': f'[orderandgo] 인증번호 [{code}]를 입력해주세요.',
        'sendNo': sender,
        'recipientList': [{'recipientNo': tel}]
    }

    try:
        res = requests.post(url, json=body, headers=headers, timeout=5)
        result = res.json()
        header = result.get('header', {})
        if not header.get('isSuccessful'):
            print(f'[SMS 발송 실패] {result}')
            return jsonify({'code': 200, 'message': 'SMS 발송 실패 (임시: 코드 확인)', 'verify_code': code})
    except Exception as e:
        print(f'[SMS 오류] {e}')
        return jsonify({'code': 200, 'message': 'SMS 오류 (임시: 코드 확인)', 'verify_code': code})

    return jsonify({'code': 200, 'message': '인증번호가 발송되었습니다.', 'verify_code': code})


# 관리자 회원가입
@auth_bp.route("/register_admin", methods=['GET', 'POST'])
def register_admin_user():
    if request.method == 'GET':
        return render_template('/register.html')

    if request.method == 'POST':
        tel = request.form.get('tel')
        password = request.form.get('password')
        code_number = request.form.get('code_number')
        firebase_token = request.form.get('firebase_id_token')

        # 전화번호 인증 검증: Firebase 우선, 없으면 세션 코드(폴백)
        if firebase_token:
            verified_phone = _verify_firebase_phone(firebase_token)
            if not verified_phone:
                return jsonify({'code': 400, 'message': '전화번호 인증에 실패했습니다.'})
            if not _same_phone(verified_phone, tel):
                return jsonify({'code': 400, 'message': '인증한 번호와 입력한 번호가 다릅니다.'})
        else:
            saved_code = session.get('verify_code')
            saved_tel = session.get('verify_tel')
            if not saved_code or saved_code != code_number or saved_tel != tel:
                return jsonify({'code': 400, 'message': '인증번호가 올바르지 않습니다.'})

        print(tel, password)
        result = create_admin_user(tel, password)

        if result == 'duplicate':
            return jsonify({'code': 409, 'message': '이미 가입된 전화번호입니다.'})
        if result == False:
            return jsonify({'code': 400, 'message': '회원가입 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'})
        
        print("회원가입 성공", result)
        response = jsonify({
            'code' : 200,
            'message': 'Success'
        })
        return response
    

# 스토어 회원가입
@login_required
@auth_bp.route("/register_store", methods=['GET', 'POST'])
def register_store_user():
    if request.method == 'GET':
        return render_template('/store_create.html')
    
    if request.method == 'POST':
        user_id = current_user.id
        store_id = request.form.get('store_id')
        name = request.form.get('name')
        password = request.form.get('password')
        logo_img = ''
        result = create_store_user(user_id, store_id, password, name, logo_img)

        # # store 이미지 넣기
        # store_image = request.files['store_image']
        # UPLOAD_FOLDER = 'app/static/images/user/'
        # upload_path = '{}{}/{}/store_img'.format(UPLOAD_FOLDER, user_id, result.id)
        # if not os.path.exists(upload_path):
        #     os.makedirs(upload_path)        
        # store_image.save(os.path.join(upload_path, store_image))
        # store_image_path = '{}/{}'.format(upload_path, store_image.filename)

        # update_store_logo_img(result, upload_path)

        if result == 'duplicate':
            return jsonify({'message': '이미 사용 중인 스토어 아이디입니다.', 'code': 409})
        if result == 'duplicate_name':
            return jsonify({'message': '이미 사용 중인 매장 이름입니다.', 'code': 409})
        if result == False:
            print("회원가입 실패")
            return jsonify({'message': '회원가입 실패', 'code': 400})

        print("회원가입 성공", result)
        return jsonify({'message': 'Success', 'code': 200})

# 비밀번호 찾기 (재설정)
@auth_bp.route('/find_password', methods=['GET', 'POST'])
def find_password():
    if request.method == 'GET':
        return render_template('find_password.html')

    tel = request.form.get('tel')
    new_password = request.form.get('new_password')
    firebase_token = request.form.get('firebase_id_token')

    if not tel or not new_password:
        return jsonify({'code': 400, 'message': '전화번호와 새 비밀번호를 입력해주세요.'})

    # 전화번호 인증 필수 (본인 확인)
    if not firebase_token:
        return jsonify({'code': 400, 'message': '전화번호 인증이 필요합니다.'})
    verified_phone = _verify_firebase_phone(firebase_token)
    if not verified_phone or not _same_phone(verified_phone, tel):
        return jsonify({'code': 400, 'message': '전화번호 인증에 실패했습니다.'})

    user = get_user_by_tel(tel)
    if not user:
        return jsonify({'code': 404, 'message': '등록된 전화번호가 없습니다.'})

    reset_user_password(tel, new_password)
    return jsonify({'code': 200, 'message': '비밀번호가 변경되었습니다.'})


# 로그아웃
@login_required
@auth_bp.route("/logout", methods=['GET'])
def logout():
    logout_user()
    session.pop('user_type', None)
    session.pop('admin_user_id', None)
    return jsonify({
        'message': '로그아웃 성공',
        'code' : 200
        })