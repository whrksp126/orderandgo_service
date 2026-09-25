from flask import Blueprint

main_bp = Blueprint('main', __name__)
auth_bp = Blueprint('auth', __name__)
pos_bp = Blueprint('pos', __name__, url_prefix='/pos')
adm_bp = Blueprint('adm', __name__, url_prefix='/adm')
order_bp = Blueprint('order', __name__, url_prefix='/order')
store_bp = Blueprint('store', __name__, url_prefix='/store')
payment_bp = Blueprint('payment', __name__, url_prefix='/payment')
table_order_bp = Blueprint('table_order', __name__, url_prefix='/table_order')


def require_login(bp, public=()):
    """블루프린트 전체를 로그인 필수로 만든다.

    일부 라우트는 @login_required가 @route 위에 있어(데코레이터 순서 오류) 실제로 적용되지 않았다.
    라우트별 누락을 막기 위해 블루프린트 단위로 강제한다.
    public: 비로그인 허용 뷰 함수명 (단말기 토큰 인증 API, QR 손님 API, 공개 페이지 등 — 각 뷰가 자체 인가 수행)
    """
    public = set(public)

    @bp.before_request
    def _require_login():
        from flask import request, current_app
        from flask_login import current_user
        view = (request.endpoint or '').rsplit('.', 1)[-1]
        if view in public:
            return None
        if not current_user.is_authenticated:
            # current_app.login_manager: LoginManager 인스턴스 (from app import login_manager는
            # 요청 시점에 app/login_manager.py 서브모듈로 가려질 수 있어 사용하지 않음)
            return current_app.login_manager.unauthorized()
