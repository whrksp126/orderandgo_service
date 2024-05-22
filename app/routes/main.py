from flask import render_template, redirect, url_for, request, session, jsonify
from app.routes import main_bp
from app.models.store import create_store, update_store
from flask_login import current_user, login_required, login_user

import json

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaIoBaseDownload


@main_bp.route('/')
@login_required
def index():
    return render_template('index.html')



from requests_oauthlib import OAuth2Session
from google.cloud import firestore
from config import OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REDIRECT_URI


# Firestore 인스턴스 생성
db = None

def create_firestore_client():
    global db
    if db is None:
        key_path = 'app/vocaandgo-be62cab96920.json'
        # Firestore 클라이언트 생성
        db = firestore.Client.from_service_account_json(key_path)
    return db

# Firestore에서 사용자의 데이터를 가져오는 함수
def get_user_data(user_id):
    db = create_firestore_client()
    user_ref = db.collection('users').document(user_id)
    user_data = user_ref.get().to_dict()
    return user_data if user_data else {}

# Firestore에 사용자의 데이터를 저장하는 함수
def save_user_data(user_id, data):
    db = create_firestore_client()
    user_ref = db.collection('users').document(user_id)
    user_ref.set(data)



# 로그인 라우트: 구글 OAuth2 인증 요청
@main_bp.route('/login/google')
def login_google():
    # OAuth2Session 생성
    oauth = OAuth2Session(OAUTH_CLIENT_ID, redirect_uri=OAUTH_REDIRECT_URI, scope=['https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email', 'openid'])

    # 인증 요청을 생성합니다.
    authorization_url, state = oauth.authorization_url(
        'https://accounts.google.com/o/oauth2/auth',
        access_type="offline",
        prompt="consent"
    )

    # 상태(state)를 세션에 저장
    session['oauth_state'] = state

    return redirect(authorization_url)


# 인증 콜백 라우트: OAuth2 인증 완료 후 실행
@main_bp.route('/login_google/callback')
def authorize_google():
    # 상태(state)를 가져옴
    state = session.pop('oauth_state', None)

    # 사용자가 리디렉션된 후에 받은 정보를 가져옵니다.
    authorization_response = request.url

    # 사용자가 인증을 마치고 리디렉션 된 후, 코드를 얻어서 토큰을 교환합니다.
    oauth = OAuth2Session(OAUTH_CLIENT_ID, redirect_uri=OAUTH_REDIRECT_URI, state=state, 
                          scope=[
                                'https://www.googleapis.com/auth/userinfo.profile',
                                'https://www.googleapis.com/auth/userinfo.email',
                                'openid',
                                'https://www.googleapis.com/auth/drive.file'
                              ]
                        )

    # 상태(state) 확인
    if state is None or state != request.args.get('state'):
        return 'Invalid OAuth state', 400

    token = oauth.fetch_token(
        'https://accounts.google.com/o/oauth2/token',
        authorization_response=authorization_response,
        client_secret=OAUTH_CLIENT_SECRET
    )
    print("@@@token", token)

    # 토큰에서 사용자 정보 추출
    userinfo = oauth.get('https://www.googleapis.com/oauth2/v1/userinfo').json()
    email = userinfo['email']
    print("@@@userinfo", userinfo)
    print("['credentials']", userinfo['credentials'])


    # # firestore 테스트
    # user_id = userinfo['id']
    # # words = request.json.get('words', [])
    # words = 'test'
    # save_user_data(user_id, {'words': words})


    # # 이메일 주소로 사용자 조회
    # user = User.query.filter_by(email=email).first()

    # # 사용자가 존재하지 않으면 회원가입
    # if not user:
    #     # 회원가입을 위한 정보를 세션에 저장
    #     session['oauth_userinfo'] = userinfo
    #     return redirect(url_for('main_bp.register'))

    # # 사용자가 존재하면 로그인
    # login_user(user)

    return "Authentication Successful!"


# # 회원가입 라우트
# @main_bp.route('/register', methods=['GET', 'POST'])
# def register():
#     # 회원가입 양식 제출 처리
#     if request.method == 'POST':
#         # 세션에서 사용자 정보 가져오기
#         userinfo = session.get('oauth_userinfo')
#         if not userinfo:
#             return "Error: No userinfo found", 400

#         # 이메일과 기타 정보 추출
#         email = userinfo['email']
#         # 추가 필요한 사용자 정보가 있다면 여기에서 추출

#         # 사용자 생성
#         new_user = User(email=email)
#         # 기타 정보가 있다면 여기에서 추가

#         db.session.add(new_user)
#         db.session.commit()

#         # 회원가입 후 로그인
#         login_user(new_user)

#         # 회원가입 완료 후, 세션에서 사용자 정보 제거
#         session.pop('oauth_userinfo', None)

#         return "Registration Successful!"

#     # GET 요청일 경우 회원가입 양식 보여주기 => 쓸 일 없음
#     return render_template('register.html')


@main_bp.route('/backup')
def backup():
    # if 'credentials' not in session:
        # return redirect(url_for('login'))
    
    credentials = Credentials(**session['credentials'])
    drive_service = build('drive', 'v3', credentials=credentials)
    
    file_metadata = {'name': 'wordlist_backup.json'}
    media = MediaFileUpload('wordlist_backup.json', mimetype='application/json')
    file = drive_service.files().create(body=file_metadata, media_body=media, fields='id').execute()
    
    return jsonify({"file_id": file.get('id')})