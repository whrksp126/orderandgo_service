import os
from flask import Flask, render_template, jsonify, request
from flask_socketio import SocketIO
from config import Config
from app.site_config import COMPANY, SITE, FIREBASE
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager
from flask_cors import CORS

from sqlalchemy.ext.declarative import declarative_base
from contextlib import contextmanager
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine, text

db = SQLAlchemy()
migrate = Migrate()     
login_manager = LoginManager()
socketio = SocketIO() 

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    # 세션 쿠키 보안 (config.py 는 배포 비추적이므로 여기서 강제 — 기존 QR 인증과 동일 정책)
    app.config.update(
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE='Lax',
        SESSION_COOKIE_SECURE=(os.environ.get('FLASK_DEBUG', '0') != '1'),
    )
    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)
    _toss_origins = [
        "https://orderandgo-front.plugin.tossplace.com",
        "https://orderandgo-front.plugin-dev.tossplace.com",
    ]
    CORS(app, resources={
        r"/pos/toss/*": {"origins": _toss_origins}
    })
    socketio.init_app(app, cors_allowed_origins="*")
    
    # 모든 모델 클래스들을 한번에 import
    from app import models
    
    with app.app_context():
        db.create_all()    
        
    from app.routes.main import main_bp
    from app.routes.auth import auth_bp
    from app.routes.pos import pos_bp
    from app.routes.adm import adm_bp
    from app.routes.order import order_bp
    from app.routes.store import store_bp
    from app.routes.payment import payment_bp
    from app.routes.table_order import table_order_bp
    from app.routes.kds import kds_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(pos_bp)
    app.register_blueprint(adm_bp)
    app.register_blueprint(order_bp)
    app.register_blueprint(store_bp)
    app.register_blueprint(payment_bp)
    app.register_blueprint(table_order_bp)
    app.register_blueprint(kds_bp, url_prefix='/kds')

    # 템플릿 전역 컨텍스트: 회사 법정정보 / SEO 기본값 / GA4
    @app.context_processor
    def inject_site_context():
        return {
            "company": COMPANY,
            "site": SITE,
            "firebase": FIREBASE,
            "ga4_id": os.environ.get("GA4_MEASUREMENT_ID"),
        }

    # 커스텀 에러 페이지 (API 요청은 JSON, 그 외 HTML)
    def _wants_json():
        return request.accept_mimetypes.accept_json and \
            not request.accept_mimetypes.accept_html

    @app.errorhandler(404)
    def not_found(e):
        if _wants_json():
            return jsonify({"error": "Not found"}), 404
        return render_template("errors/404.html"), 404

    @app.errorhandler(500)
    def server_error(e):
        if _wants_json():
            return jsonify({"error": "Internal server error"}), 500
        return render_template("errors/500.html"), 500

    return app
