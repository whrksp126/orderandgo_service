from flask import session
from flask_login import current_user
from app.models import db, User, Store
import bcrypt

from datetime import datetime
from flask_login import login_user, logout_user

from app.models.menu_category import create_main_category, create_sub_category
from app.models.table import create_table_category


# 아이디(PK)로 유저 조회
def get_user_by_id(id):
    return User.query.filter_by(id=id).first()

# 유저아이디로 유저 조회
def get_user_by_userid(user_id):
    return User.query.filter_by(id=user_id).first()



# 회원정보 수정 (마이페이지)
# 비밀번호, 성명, 생년월일, 전화번호, 이메일, 주소
def update_user(id, password, name, birthday, tel, email, address):
    # id(PK)로 유저 확인
    select_user = User.query.filter_by(id=id).all()
    if len(select_user) == 0:
        return "유저 정보가 없습니다."
    else: # 유저가 맞으면 update
        user = User.query.filter_by(id=id).first()
        if password != bcrypt.checkpw(password.encode('utf-8'), user.password.encode('utf-8')):
            user.password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        else:
            return "기존 비밀번호와 동일합니다."
        user.name = name
        user.birthday = birthday
        user.tel = tel
        user.email = email
        user.address = address

        db.session.commit()
        return user
    
# 아이디(PK)로 유저 삭제
def delete_user_by_id(id):
    user = User.query.get(id)
    if user:
        db.session.delete(user)
        db.session.commit()
        return True
    return False


### 회원가입
# 관리자 회원가입
def create_admin_user(tel, password):
    if User.query.filter_by(tel=tel).first():
        return 'duplicate'
    try:
        user = User(tel=tel, password=bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()))
        db.session.add(user)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f'[회원가입 오류] {e}')
        return False
    return True

# 스토어 회원가입
def create_store_user(user_id, store_id, password, name, logo_img):
    existing = Store.query.filter_by(store_id=store_id).first()
    if existing:
        print(f"[중복] store_id='{store_id}' 이미 존재: id={existing.id}, name={existing.name}")
        return 'duplicate'
    existing_name = Store.query.filter_by(name=name).first()
    if existing_name:
        print(f"[중복] name='{name}' 이미 존재: id={existing_name.id}, store_id={existing_name.store_id}")
        return 'duplicate_name'
    try:
        store = Store(user_id=user_id, store_id=store_id, store_pw=bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()), name=name, logo_img=logo_img)
        db.session.add(store)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"스토어 생성 실패: {e}")
        return False

    # 메뉴 메인, 서브 카테고리 생성
    main_category = create_main_category(store.id, '메인')
    create_sub_category(main_category.id, '메인')
    # 테이블 카테고리 생성
    table_category_item = create_table_category([{'id': None, 'category_name': '매장', 'position': 1}], store.id)

    return store


# 스토어 회원가입시 logo_img 업데이트
def update_store_logo_img(store_item, logo_img):
    store_item.logo_img = logo_img
    db.session.commit()
    return True


# 로그아웃
def logout():
    logout_user()



### 로그인
# 관리자 유저 로그인
def get_admin_user_login(tel, password):
    user = User.query.filter_by(tel=tel).first()
    if user and bcrypt.checkpw(password.encode('utf-8'), user.password.encode('utf-8')):
        login_user(user)        # current_user로 조회 가능
        return user
    return False

# 스토어 유저 로그인
def get_store_user_login(store_id, password):
    store_user = Store.query.filter_by(store_id=store_id).first()
    if store_user and bcrypt.checkpw(password.encode('utf-8'), store_user.store_pw.encode('utf-8')):
        if current_user:
            logout()
        login_user(store_user)        # current_user로 조회 가능
        return store_user
    return False

# 스토어 아이디로 유저 조회
def get_store_by_storeid(store_id):
    return Store.query.filter_by(id=store_id).first()


# 전화번호로 관리자 유저 조회
def get_user_by_tel(tel):
    return User.query.filter_by(tel=tel).first()


# 비밀번호 재설정
def reset_user_password(tel, new_password):
    user = User.query.filter_by(tel=tel).first()
    if not user:
        return False
    user.password = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
    db.session.commit()
    return True


