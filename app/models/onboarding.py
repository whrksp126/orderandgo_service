import secrets
import bcrypt
from datetime import datetime
from app.models import db, Store, MainCategory, SubCategory, TableCategory, Table, Menu


def _unique_store_id(base='og'):
    """추측 불가한 매장 로그인 아이디 생성 (온보딩 가입은 아이디를 따로 받지 않음)."""
    for _ in range(20):
        candidate = base + secrets.token_hex(4)
        if not Store.query.filter_by(store_id=candidate).first():
            return candidate
    return base + secrets.token_hex(8)


def _unique_store_name(name):
    """매장 이름은 unique 제약 → 충돌 시 뒤에 번호를 붙여 회피."""
    name = (name or '내 매장').strip()[:30] or '내 매장'
    if not Store.query.filter_by(name=name).first():
        return name
    i = 2
    while True:
        candidate = f'{name} {i}'[:50]
        if not Store.query.filter_by(name=candidate).first():
            return candidate
        i += 1


def create_store_from_onboarding(user_id, password, data):
    """온보딩(localStorage) 데이터를 실제 매장/메뉴/테이블로 커밋.

    data = { storeName, menus:[{name, price}], tables:int, industry, hasTerminal, hasPrinter }
    성공 시 Store 객체, 실패 시 None 반환.
    """
    store_name = (data.get('storeName') or '내 매장').strip()[:30] or '내 매장'
    menus = data.get('menus') or []
    try:
        table_count = int(data.get('tables') or 6)
    except (TypeError, ValueError):
        table_count = 6
    table_count = max(1, min(table_count, 60))

    try:
        store = Store(
            user_id=user_id,
            store_id=_unique_store_id(),
            store_pw=bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()),
            name=_unique_store_name(store_name),
            logo_img='',
        )
        db.session.add(store)
        db.session.flush()  # store.id 확보

        # ── 메뉴 카테고리 (기본 '메인' > '메인') ──
        main_category = MainCategory(store_id=store.id, name='메인', position=1)
        db.session.add(main_category)
        db.session.flush()
        sub_category = SubCategory(main_category_id=main_category.id, name='메인', position=1)
        db.session.add(sub_category)
        db.session.flush()

        # ── 메뉴 ──
        pos = 1
        for m in menus:
            nm = (m.get('name') or '').strip()
            try:
                price = int(m.get('price'))
            except (TypeError, ValueError):
                price = 0
            if not nm or price <= 0:
                continue
            db.session.add(Menu(
                name=nm[:150], price=price, image=None, main_description=None,
                is_soldout=False, store_id=store.id, menu_category_id=sub_category.id,
                page=1, position=pos,
            ))
            pos += 1

        # ── 테이블 카테고리 + 테이블 (데모 시드와 동일: 4열, grid 3×3, 5/4 간격) ──
        tcat = TableCategory(store_id=store.id, category_name='1층 홀', position=1)
        db.session.add(tcat)
        db.session.flush()
        cols = 4
        for i in range(table_count):
            gx = (i % cols) * 5
            gy = (i // cols) * 4
            db.session.add(Table(
                name=f'{i + 1}번', seat_count=4, is_group=0,
                table_category_id=tcat.id, position=i + 1,
                grid_x=gx, grid_y=gy, grid_w=3, grid_h=3,
                qr_token=secrets.token_urlsafe(32), qr_generated_at=datetime.now(),
            ))

        db.session.commit()
        return store
    except Exception as e:
        db.session.rollback()
        print(f'[온보딩 커밋 오류] {e}')
        return None
