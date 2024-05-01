from flask import render_template, redirect, url_for, request
from app.routes import main_bp
from app.models.store import create_store, update_store
from flask_login import current_user, login_required


@main_bp.route('/')
@login_required
def index():
    return render_template('index.html')



from requests_oauthlib import OAuth2Session

# Google OAuth2 정보 설정
CLIENT_ID = '1029120969045-qe419opo6hme2kdk45j98qghc3tafo2u.apps.googleusercontent.com'
CLIENT_SECRET = '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'
REDIRECT_URI = 'https://order.ghmate.com/login_google/callback'  # 이 값은 Google API Console에서 설정한 리디렉션 URI와 동일해야 합니다.


# 인증 콜백 라우트: OAuth2 인증 완료 후 실행
@main_bp.route('/login_google/callback')
def authorize_google():
    # OAuth2Session 생성
    oauth = OAuth2Session(CLIENT_ID, redirect_uri=REDIRECT_URI, scope=['openid', 'email', 'profile'])

    # 인증 요청을 생성합니다.
    authorization_url, state = oauth.authorization_url(
        'https://accounts.google.com/o/oauth2/auth',
    )

    # 사용자에게 인증을 받기 위해 authorization_url로 리다이렉트합니다.
    print('Please go to %s and authorize access.' % authorization_url)

    # 사용자가 리디렉션된 후에 받은 정보를 가져옵니다.
    authorization_response = request.url

    # 사용자가 인증을 마치고 리디렉션 된 후, 코드를 얻어서 토큰을 교환합니다.
    token = oauth.fetch_token(
        'https://accounts.google.com/o/oauth2/token',
        authorization_response=authorization_response,
        client_secret=CLIENT_SECRET
    )

    print(token)