from flask import render_template, request, jsonify, session
from flask_login import current_user, login_required, logout_user, login_user
from app.models import User, Store
from app.routes import auth_bp
from flask import redirect, url_for


from app.models.user import create_admin_user, create_store_user, get_store_user_login, get_admin_user_login, update_store_logo_img, get_user_by_tel, get_user_by_id, reset_user_password
from app.models.store import get_store
from app.models.table import ensure_default_table_layout
from app.models.onboarding import create_store_from_onboarding, _unique_store_id
from app.site_config import FIREBASE
import json
import os
import time
import requests
from google.auth import jwt as google_jwt

MIN_PASSWORD_LEN = 8

# Firebase ID 토큰 서명 검증용 Google 공개 인증서 (1시간 캐시)
_FIREBASE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
_firebase_certs = {'certs': None, 'fetched_at': 0}


def _get_firebase_certs():
    if _firebase_certs['certs'] and time.time() - _firebase_certs['fetched_at'] < 3600:
        return _firebase_certs['certs']
    res = requests.get(_FIREBASE_CERTS_URL, timeout=5)
    res.raise_for_status()
    _firebase_certs['certs'] = res.json()
    _firebase_certs['fetched_at'] = time.time()
    return _firebase_certs['certs']


def _verify_firebase_phone_local(id_token):
    """ID 토큰을 서버에서 직접 검증(서명·만료·발급자·대상). 요청마다 Google 을 호출하지 않아 빠르다."""
    project_id = FIREBASE.get('projectId')
    claims = google_jwt.decode(id_token, certs=_get_firebase_certs(), audience=project_id)
    if claims.get('iss') != f'https://securetoken.google.com/{project_id}' or not claims.get('sub'):
        return None
    return claims.get('phone_number')


def _verify_firebase_phone(id_token):
    """Firebase ID 토큰을 검증하고 인증된 전화번호(E.164) 반환. 실패 시 None."""
    try:
        return _verify_firebase_phone_local(id_token)
    except ValueError:
        return None  # 서명/만료/형식 오류 = 유효하지 않은 토큰
    except Exception as e:
        print(f'[Firebase] 로컬 검증 불가, Identity Toolkit 로 폴백: {e}')
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


# ── 세션 구조 ──
#   session['admin_user_id'] : 사장님(휴대폰 번호) 계정 로그인 상태. 매장에 들어간 뒤에도 유지 → 매장 전환/추가 가능
#   session['user_type']     : 'admin' = 사장님 로그인만 된 상태(매장 미선택), 'store' = 매장에 들어간 상태
#   Flask-Login current_user : 항상 Store (선택된 매장). 사장님(User)은 login_user 하지 않는다.
def _admin_user_id():
    return session.get('admin_user_id')


def _enter_store(store):
    ensure_default_table_layout(store.id)
    login_user(store)
    session['user_type'] = 'store'


def _store_item(store, current_id=None):
    return {'store_id': store.store_id, 'name': store.name, 'current': store.id == current_id}


# 로그인
@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'GET':
        if current_user.is_authenticated:
            return redirect(url_for('main.dashboard'))
        if _admin_user_id():
            return redirect('/stores')
        return render_template('login.html')

    if request.form.get('admin_tel') is not None:       # 사장님 로그인 (휴대폰 번호)
        user = get_admin_user_login(request.form.get('admin_tel'), request.form.get('password'))
        if not user:
            return jsonify({'code': 400, 'message': '휴대폰 번호 또는 비밀번호가 올바르지 않습니다.'})
        logout_user()
        session['admin_user_id'] = user.id
        session['user_type'] = 'admin'
        # 사장님은 여러 매장을 가질 수 있음 → 내 매장 목록에서 선택/생성
        return jsonify({'code': 200, 'message': 'Success', 'redirect': '/stores'})

    # 매장 로그인 (매장 아이디) → 해당 매장으로 바로 입장
    result = get_store_user_login(request.form.get('store_id'), request.form.get('password'))
    if not result:
        return jsonify({'code': 400, 'message': '매장 아이디 또는 비밀번호가 올바르지 않습니다.'})
    ensure_default_table_layout(result.id)
    session['user_type'] = 'store'
    session.pop('admin_user_id', None)
    return jsonify({'code': 200, 'message': 'Success', 'redirect': '/dashboard'})


# 매장 선택 (사장님 로그인 상태)
@auth_bp.route('/stores', methods=['GET'])
def stores():
    if not _admin_user_id():
        return redirect('/login')
    current_id = current_user.id if current_user.is_authenticated else None
    store_list = [_store_item(s, current_id) for s in get_store(_admin_user_id())]
    return render_template('stores.html', store_list=store_list)


@auth_bp.route('/stores/enter', methods=['POST'])
def stores_enter():
    if not _admin_user_id():
        return jsonify({'code': 401, 'message': '로그인이 필요합니다.', 'redirect': '/login'})
    store = Store.query.filter_by(store_id=request.form.get('store_id'), user_id=_admin_user_id()).first()
    if not store:
        return jsonify({'code': 404, 'message': '매장을 찾을 수 없습니다.'})
    _enter_store(store)
    return jsonify({'code': 200, 'message': 'Success', 'redirect': '/dashboard'})


# 매장 만들기 (사장님 로그인 상태)
@auth_bp.route('/stores/new', methods=['GET'])
def stores_new():
    if not _admin_user_id():
        return redirect('/login')
    return render_template('store_create.html')


# 관리자 회원가입
@auth_bp.route("/register_admin", methods=['GET', 'POST'])
def register_admin_user():
    if request.method == 'GET':
        return render_template('phone_flow.html', mode='register')

    if request.method == 'POST':
        tel = request.form.get('tel')
        password = request.form.get('password') or ''
        firebase_token = request.form.get('firebase_id_token')

        if len(password) < MIN_PASSWORD_LEN:
            return jsonify({'code': 400, 'message': f'비밀번호는 {MIN_PASSWORD_LEN}자 이상으로 입력해주세요.'})

        # 전화번호 인증 검증 (Firebase 전화 인증 토큰 필수)
        verified_phone = _verify_firebase_phone(firebase_token) if firebase_token else None
        if not verified_phone:
            return jsonify({'code': 400, 'message': '전화번호 인증에 실패했습니다.'})
        if not _same_phone(verified_phone, tel):
            return jsonify({'code': 400, 'message': '인증한 번호와 입력한 번호가 다릅니다.'})

        result = create_admin_user(tel, password)

        if result == 'duplicate':
            return jsonify({'code': 409, 'message': '이미 가입된 전화번호입니다.'})
        if result == False:
            return jsonify({'code': 400, 'message': '회원가입 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'})

        # 가입 즉시 사장님 계정으로 로그인 상태가 됨 (다시 로그인할 필요 없음)
        user = get_user_by_tel(tel)
        logout_user()
        session['admin_user_id'] = user.id
        session['user_type'] = 'admin'

        # ── 온보딩 데이터가 있으면 매장/메뉴/테이블 즉시 생성 후 매장으로 입장 ──
        onboarding_raw = request.form.get('onboarding')
        if onboarding_raw:
            try:
                onboarding = json.loads(onboarding_raw)
            except (ValueError, TypeError):
                onboarding = None
            # 매장 비밀번호 = 가입 비밀번호 (해시 재사용 → bcrypt 를 한 번 더 돌리지 않음)
            store = create_store_from_onboarding(user.id, password, onboarding, password_hash=user.password) if onboarding else None
            if store:
                _enter_store(store)
                return jsonify({'code': 200, 'message': 'Success', 'redirect': '/setup?welcome=1'})

        # 매장이 아직 없음 → 매장 만들기로
        return jsonify({'code': 200, 'message': 'Success', 'redirect': '/stores/new'})


# 매장 생성
@auth_bp.route("/register_store", methods=['GET', 'POST'])
def register_store_user():
    if request.method == 'GET':
        return redirect('/stores/new')

    user = get_user_by_id(_admin_user_id()) if _admin_user_id() else None
    if not user:
        return jsonify({'message': '로그인이 필요합니다.', 'code': 401, 'redirect': '/login'})

    name = (request.form.get('name') or '').strip()
    if not name:
        return jsonify({'message': '매장 이름을 입력해주세요.', 'code': 400})

    # 매장 계정: 아이디는 자동 발급, 비밀번호는 사장님 계정 비밀번호와 동일
    result = create_store_user(user.id, _unique_store_id(), '', name, '', password_hash=user.password)

    if result == 'duplicate_name':
        return jsonify({'message': '이미 사용 중인 매장 이름입니다.', 'code': 409})
    if result == False:
        return jsonify({'message': '매장을 만드는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', 'code': 400})

    _enter_store(result)
    return jsonify({'message': 'Success', 'code': 200, 'redirect': '/setup?welcome=1'})

# 전화번호 가입 여부 확인 (가입=중복 방지 / 재설정=존재 확인)
@auth_bp.route('/check_tel', methods=['GET'])
def check_tel():
    tel = request.args.get('tel', '')
    exists = bool(get_user_by_tel(tel)) if tel else False
    return jsonify({'exists': exists})


# 비밀번호 찾기 (재설정)
@auth_bp.route('/find_password', methods=['GET', 'POST'])
def find_password():
    if request.method == 'GET':
        return render_template('phone_flow.html', mode='reset')

    tel = request.form.get('tel')
    new_password = request.form.get('new_password')
    firebase_token = request.form.get('firebase_id_token')

    if not tel or not new_password:
        return jsonify({'code': 400, 'message': '전화번호와 새 비밀번호를 입력해주세요.'})
    if len(new_password) < MIN_PASSWORD_LEN:
        return jsonify({'code': 400, 'message': f'비밀번호는 {MIN_PASSWORD_LEN}자 이상으로 입력해주세요.'})

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
@auth_bp.route("/logout", methods=['GET'])
def logout():
    logout_user()
    session.pop('user_type', None)
    session.pop('admin_user_id', None)
    return jsonify({
        'message': '로그아웃 성공',
        'code' : 200
        })
