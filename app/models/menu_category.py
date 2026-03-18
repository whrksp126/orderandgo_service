from flask import session
from app.models import Menu, db, MainCategory, SubCategory
from sqlalchemy import func

# 마지막+1 메인카테고리 포지션 리턴
def find_last_main_category_position(store_id):
    last_position = db.session.query(func.max(MainCategory.position))\
                            .filter(MainCategory.store_id == store_id)\
                            .first()
    return (last_position[0] or 0) + 1

# 마지막+1 서브카테고리 포지션 리턴
def find_last_sub_category_position(main_category_id):
    last_position = db.session.query(func.max(SubCategory.position))\
                            .filter(SubCategory.main_category_id == main_category_id)\
                            .first()
    return (last_position[0] or 0) + 1

# 메인카테고리 생성
def create_main_category(store_id, name):
    position = find_last_main_category_position(store_id)
    main_category = MainCategory(store_id=store_id, name=name, position=position)
    db.session.add(main_category)
    db.session.commit()
    return main_category

# 서브카테고리 생성
def create_sub_category(main_category_id, name):
    position = find_last_sub_category_position(main_category_id)
    sub_category = SubCategory(main_category_id=main_category_id, name=name, position=position)
    db.session.add(sub_category)
    db.session.commit()
    return True

# 메뉴id 생성에 필요한 메인, 서브 카테고리 id 조회
def select_main_and_sub_category_by_store_id(store_id):
    main_category = MainCategory.query.filter(MainCategory.store_id == store_id).first()
    main_id = main_category.id
    menu_category = SubCategory.query.filter(SubCategory.main_category_id == main_category.id).first()
    menu_id = menu_category.id
    return menu_id

# 메뉴로 메인, 서브 카테고리 모두 조회
def get_main_and_sub_category_by_menu_id(menu):
    try:

        if not menu:
            return None, None  # 메뉴가 없으면 None을 반환합니다.

        # 메뉴와 연결된 서브 카테고리를 조회합니다.
        sub_category = SubCategory.query.get(menu.menu_category_id)

        if not sub_category:
            return None, None  # 서브 카테고리가 없으면 None을 반환합니다.

        # 서브 카테고리와 연결된 메인 카테고리를 조회합니다.
        main_category = MainCategory.query.get(sub_category.main_category_id)

        if not main_category:
            return None, None  # 메인 카테고리가 없으면 None을 반환합니다.

        return main_category, sub_category  # 메인 카테고리와 서브 카테고리를 반환합니다.

    except Exception as e:
        print(f"Error: {str(e)}")
        return None, None  # 오류 발생 시 None을 반환합니다.


# pos->테이블 클릭시 메인->서브 카테고리로 띄우기
def get_all_category_menu(store_id, main_categoty_id, sub_category_id):
    query = session.query(Menu)\
                    .join(SubCategory, SubCategory.id == Menu.menu_category_id)\
                    .join(MainCategory, MainCategory.id == SubCategory.main_category_id)\
                    .filter(MainCategory.store_id == store_id)\
                            
    if main_categoty_id is not None:
        query = query.filter(MainCategory.id == main_categoty_id)
    if sub_category_id is not None:
        query = query.filter(SubCategory.id == sub_category_id)

    all_menu_items = query.all()

    return all_menu_items