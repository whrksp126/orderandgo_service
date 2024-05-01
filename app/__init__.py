from flask import Flask
from flask_socketio import SocketIO 
from config import Config
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager

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
    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)
    socketio.init_app(app)
    
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
    
    app.register_blueprint(main_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(pos_bp)
    app.register_blueprint(adm_bp)
    app.register_blueprint(order_bp)
    app.register_blueprint(store_bp)
    app.register_blueprint(payment_bp)
    app.register_blueprint(table_order_bp)
    
    return app
