from flask import render_template, jsonify, request, session
from flask_login import current_user
import os

from app.routes import adm_bp
from app.models import db, Store, TableCategory, Table, MainCategory, SubCategory, Menu, Order
# from app.models.user import create_user
from app.models.menu_category import create_main_category, create_sub_category, find_last_main_category_position, find_last_sub_category_position
from app.models.store import create_store, delete_store, update_store
from app.models.menu import create_menu, create_menu_option, delete_menu, update_menu
from app.models.table import update_table_name, update_table_position, create_table, delete_table

@adm_bp.route('/')
def index():
    return render_template('adm.html')

####################
### 유저 시작 ###
        
@adm_bp.route('/user/<user_id>', methods=['GET'])
def get_user(user_id):
    # 유저 조회 로직 수행
    # ...
    user_data = {'id': user_id, 'name': 'John Doe', 'email': 'john@example.com'}  # 예시 데이터
    return jsonify(user_data), 200

@adm_bp.route('/user/<user_id>', methods=['PATCH'])
def update_user(user_id):
    # 유저 업데이트 로직 수행
    # ...
    return jsonify({'message': 'User updated successfully'}), 200

@adm_bp.route('/user/<user_id>', methods=['DELETE'])
def delete_user(user_id):
    # 유저 삭제 로직 수행
    # ...
    return jsonify({'message': 'User deleted successfully'}), 204
### 유저 끝 ###
####################

####################
### 스토어 시작 ###


'''
#  스토어 생성
@adm_bp.route('/store', methods=['GET', 'POST'])
def create_store_py():
    # 매장 생성 페이지로 옮긴 후 path 수정 필요
    # if request.method == 'GET':
    #    return render_template('/register.html')

    if request.method == 'POST':
        store_data = request.get_json()
        
        #user_id = store_data['user_id']
        # 유저 아이디 코드 수정 필요 !!!
        user_id = 14
        name = store_data['name']
        address = store_data['address']
        tel = store_data['tel']
        manager_name = store_data['manager_name']
        manager_tel = store_data['manager_tel']
        logo_img = store_data['logo_img']
        store_image = store_data['store_image']
        main_description = store_data['main_description']
        sub_description = store_data['sub_description']

        store = create_store(user_id, name, address, tel, manager_name, manager_tel, logo_img, store_image, main_description, sub_description)
        print("매장생성 1차 성공", store)

        # # store 이미지 다시 넣기
        # store_image = request.files['store_image']
        # UPLOAD_FOLDER = 'app/static/images/user/'
        # upload_path = '{}{}/{}/store_img'.format(UPLOAD_FOLDER, user_id, store.id)
        # if not os.path.exists(upload_path):
        #     os.makedirs(upload_path)        
        # store_image.save(os.path.join(upload_path, store_image))
        # store_image_path = '{}/{}'.format(upload_path, store_image.filename)

        response = jsonify({'message': 'Success'})
        response.status_code = 200
        print('Received JSON data:', store_data)
        return response
        #return jsonify({'message': '매장이 성공적으로 생성되었습니다.'}), 201
'''

        
@adm_bp.route('/store/<store_id>', methods=['GET'])
def get_store_py(store_id):
    # 스토어 조회 로직 수행
    store_data = {'id': store_id, 'name': 'John Doe', 'email': 'john@example.com'}  # 예시 데이터
    return jsonify(store_data), 200

# 스토어 수정
@adm_bp.route('/store/<store_id>', methods=['PATCH'])
def update_store_py(store_id):
    # 스토어 업데이트 로직 수행
    if request.method == 'PATCH':
        store_data = request.get_json()
        
        #user_id = store_data['user_id']
        user_id = 14 # temp
        store_id = 2 # temp
        name = store_data['name']
        address = store_data['address']
        tel = store_data['tel']
        manager_name = store_data['manager_name']
        manager_tel = store_data['manager_tel']
        logo_img = store_data['logo_img']
        store_image = store_data['store_image']
        main_description = store_data['main_description']
        sub_description = store_data['sub_description']

        store = update_store(user_id, store_id, name, address, tel, manager_name, manager_tel, logo_img, store_image, main_description, sub_description)
        print("스토어 수정 1차 성공", store)

        response = jsonify({'message': 'Success'})
        response.status_code = 200
        print('Received JSON data:', store_data)
    return jsonify({'message': '스토어가 성공적으로 업데이트되었습니다.'}), 200

# 스토어 삭제
@adm_bp.route('/store/<store_id>', methods=['DELETE'])
def delete_store_py(store_id):
    if request.method == 'DELETE':
        delete_store(store_id)
        print('스토어 삭제 성공')
    return jsonify({'message': '스토어가 성공적으로 삭제되었습니다.'}), 204
### 스토어 끝 ###
####################


####################
### 메뉴 시작 ###

# 메뉴 생성
@adm_bp.route('/menu', methods=['GET', 'POST'])
def create_menu_py():
    # 메뉴 생성 페이지로 옮긴 후 path 수정 필요
    # if request.method == 'GET':
    #    return render_template('/register.html')

    if request.method == 'POST':
        menu_data = request.get_json()

        # store_id, menu_category_id 수정 필요
        name = menu_data['name']
        price = menu_data['price']
        image = menu_data['image']
        main_description = menu_data['main_description']
        sub_description = menu_data['sub_description']
        is_soldout = menu_data['is_soldout']
        store_id = 1 #menu_data['store_id']
        menu_category_id = menu_data['menu_category_id']
        menu = create_menu(name, price, image, main_description, sub_description, is_soldout, store_id, menu_category_id)
        print("메뉴생성 성공", menu)
        response = jsonify({'message': 'Success'})
        response.status_code = 200
        print('Received JSON data:', menu_data)
        return response

# 메뉴 조회
@adm_bp.route('/menu/<menu_id>', methods=['GET'])
def get_menu(menu_id):
    # 메뉴 조회 로직 수행
    # ...
    menu_data = {'id': menu_id, 'name': 'John Doe', 'email': 'john@example.com'}  # 예시 데이터
    return jsonify(menu_data), 200

# 메뉴 수정
@adm_bp.route('/menu/<menu_id>', methods=['PATCH'])
def update_menu_py(menu_id):
    if request.method == 'PATCH':
        menu_data = request.get_json()

        menu_id = 5 # temp

        name = menu_data['name']
        price = menu_data['price']
        image = menu_data['image']
        main_description = menu_data['main_description']
        sub_description = menu_data['sub_description']
        is_soldout = menu_data['is_soldout']
        menu = update_menu(menu_id, name, price, image, main_description, sub_description, is_soldout)
        
        print("메뉴수정 성공", menu)

        response = jsonify({'message': 'Success'})
        response.status_code = 200
        print('Received JSON data:', menu_data)

    return jsonify({'message': '메뉴가 성공적으로 업데이트되었습니다.'}), 200

# 메뉴 삭제
@adm_bp.route('/menu/<menu_id>', methods=['DELETE'])
def delete_menu_py(menu_id):
    if request.method == 'DELETE':
        delete_menu(menu_id)
        print('메뉴 삭제 성공')
        return jsonify({'message': '메뉴가 성공적으로 삭제되었습니다.'}), 204
### 메뉴 끝 ###
####################



####################
### 메뉴옵션 시작 ###
@adm_bp.route('/menu_option', methods=['POST'])
def create_menu_option_py():
    if request.method == 'POST':
        menu_option_data = request.get_json()
        # create_menu_option(name, price, description, store_id)
        name = menu_option_data['optionName']
        price = menu_option_data['optionPrice']
        description = menu_option_data['optionDescription']
        store_id = 1 #menu_option_data['store_id']
        menu_option = create_menu_option(name, price, description,store_id)
        print("메뉴생성 성공", menu_option)
        print('Received JSON data:', menu_option_data)
        return jsonify({'message': '메뉴 옵션이 성공적으로 생성되었습니다.'}), 201

@adm_bp.route('/menu_option/<menu_option_id>', methods=['GET'])
def get_menu_option(menu_option_id):
    # 메뉴옵션 조회 로직 수행
    # ...
    menu_option_data = {'id': menu_option_id, 'name': 'John Doe', 'email': 'john@example.com'}  # 예시 데이터
    return jsonify(menu_option_data), 200

@adm_bp.route('/menu_option/<menu_option_id>', methods=['PATCH'])
def update_menu_option(menu_option_id):
    # 메뉴옵션 업데이트 로직 수행
    # ...
    return jsonify({'message': '메뉴 옵션을 성공적으로 업데이트되었습니다.'}), 200

@adm_bp.route('/menu_option/<menu_option_id>', methods=['DELETE'])
def delete_menu_option(menu_option_id):
    # 메뉴옵션 삭제 로직 수행
    # ...
    return jsonify({'message': '메뉴 옵션을 성공적으로 삭제되었습니다.'}), 204
### 메뉴옵션 끝 ###
####################


####################
### 메뉴 메인 카테고리 시작 ###
@adm_bp.route('/menu_main_category', methods=['POST'])
def create_menu_main_category():
    # 메뉴 메인 카테고리 생성 로직 수행
    if request.method == 'POST':
        menu_main_category_data = request.get_json()
        # store_id  = menu_main_category_data['store_id']
        store_id = 1    # temp
        name = menu_main_category_data['mainCategoryName']
        last_position = find_last_main_category_position(store_id)
        main_category = create_main_category(store_id, name, last_position)
        #create_sub_category(main_category.id, '{}-1'.format(main_category.name))

    return jsonify({'message': '메뉴 메인 카테고리를 성공적으로 생성되었습니다.'}), 201

@adm_bp.route('/menu_main_category/<menu_main_category_id>', methods=['GET'])
def get_menu_main_category(menu_main_category_id):
    # 메뉴 메인 카테고리 조회 로직 수행
    # ...
    menu_main_category_data = {'id': menu_main_category_id, 'name': 'John Doe', 'email': 'john@example.com'}  # 예시 데이터
    return jsonify(menu_main_category_data), 200

@adm_bp.route('/menu_main_category/<menu_main_category_id>', methods=['PATCH'])
def update_menu_main_category(menu_main_category_id):
    # 메뉴 메인 카테고리 업데이트 로직 수행
    # ...
    return jsonify({'message': '메뉴 메인 카테고리를 성공적으로 업데이트되었습니다.'}), 200

@adm_bp.route('/menu_main_category/<menu_main_category_id>', methods=['DELETE'])
def delete_menu_main_category(menu_main_category_id):
    # 메뉴 메인 카테고리 삭제 로직 수행
    # ...
    return jsonify({'message': '메뉴 메인 카테고리를 성공적으로 삭제되었습니다.'}), 204
### 메뉴 메인 카테고리 끝 ###
####################

####################
### 메뉴 서브 카테고리 시작 ###
@adm_bp.route('/menu_sub_category', methods=['POST'])
def create_menu_sub_category():
    # 메뉴 서브 카테고리 생성 로직 수행
    menu_sub_category_data = request.get_json()
    main_category_id = menu_sub_category_data['mainCategoryId']
    name = menu_sub_category_data['subCategoryName']

    last_position = find_last_sub_category_position(main_category_id)
    create_sub_category(main_category_id, name, last_position)

    return jsonify({'message': '메뉴 서브 카테고리를 성공적으로 생성되었습니다.'}), 201

@adm_bp.route('/menu_sub_category/<menu_sub_category_id>', methods=['GET'])
def get_menu_sub_category(menu_sub_category_id):
    # 메뉴 서브 카테고리 조회 로직 수행
    # ...
    menu_sub_category_data = {'id': menu_sub_category_id, 'name': 'John Doe', 'email': 'john@example.com'}  # 예시 데이터
    return jsonify(menu_sub_category_data), 200

@adm_bp.route('/menu_sub_category/<menu_sub_category_id>', methods=['PATCH'])
def update_menu_sub_category(menu_sub_category_id):
    # 메뉴 서브 카테고리 업데이트 로직 수행
    # ...
    return jsonify({'message': '메뉴 서브 카테고리를 성공적으로 업데이트되었습니다.'}), 200

@adm_bp.route('/menu_sub_category/<menu_sub_category_id>', methods=['DELETE'])
def delete_menu_sub_category(menu_sub_category_id):
    # 메뉴 서브 카테고리 삭제 로직 수행
    # ...
    return jsonify({'message': '메뉴 서브 카테고리를 성공적으로 삭제되었습니다.'}), 204
### 메뉴 서브 카테고리 끝 ###
####################

####################
### 테이블 카테고리 시작 ###
@adm_bp.route('/table_category', methods=['POST'])
def create_table_category():
    # 테이블 카테고리 생성 로직 수행
    table_category_data = request.get_json()
    store_id = int(table_category_data['storeId'])
    category_name = table_category_data['categoryName']
    print('Received JSON data:', table_category_data)

    store_id = 1    # temp

    table_category = TableCategory(store_id=store_id, category_name=category_name)
    db.session.add(table_category)
    db.session.commit()

    return jsonify({'message': '테이블 카테고리를 성공적으로 생성되었습니다.'}), 201

@adm_bp.route('/table_category/<table_category_id>', methods=['GET'])
def get_table_category(table_category_id):
    # 테이블 카테고리 조회 로직 수행
    # ...
    table_category_data = {'id': table_category_id, 'name': 'John Doe', 'email': 'john@example.com'}  # 예시 데이터
    return jsonify(table_category_data), 200

@adm_bp.route('/table_category/<table_category_id>', methods=['PATCH'])
def update_table_category(table_category_id):
    # 테이블 카테고리 업데이트 로직 수행
    # ...
    return jsonify({'message': '테이블 카테고리를 성공적으로 업데이트되었습니다.'}), 200

@adm_bp.route('/table_category/<table_category_id>', methods=['DELETE'])
def delete_table_category(table_category_id):
    # 테이블 카테고리 삭제 로직 수행
    # ...
    return jsonify({'message': '테이블 카테고리를 성공적으로 삭제되었습니다.'}), 204
### 테이블 카테고리 끝 ###
####################

####################
### 테이블 시작 ###

@adm_bp.route('/table/<table_id>', methods=['GET'])
def get_table(table_id):
    # 테이블 조회 로직 수행
    # ...
    table_data = {'id': table_id, 'name': 'John Doe', 'email': 'john@example.com'}  # 예시 데이터
    return jsonify(table_data), 200

@adm_bp.route('/table/<table_id>', methods=['PATCH'])
def update_table(table_id):
    # 테이블 업데이트 로직 수행
    # ...
    return jsonify({'message': '테이블을 성공적으로 업데이트되었습니다.'}), 200

@adm_bp.route('/table/<table_id>', methods=['DELETE'])
def api_delete_table(table_id):
    # 테이블 삭제 로직 수행
    if delete_table(table_id):
        return jsonify({'message': '테이블을 성공적으로 삭제되었습니다.'}), 204



@adm_bp.route('/create_table', methods=['POST'])
def api_create_table():
    data = request.get_json()
    return create_table(data)

@adm_bp.route('/update_table_name', methods=['PATCH'])
def api_update_table_name():
    data = request.get_json()
    print(data)
    table_id = data['table_id']
    name = data['name']

    return update_table_name(table_id, name)


@adm_bp.route('/update_table_position', methods=['PATCH'])
def api_update_table_position():
    data = request.get_json()
    print('data,',data)
    table_id_fir = data['table_id_fir']
    table_id_sec = data['table_id_sec']

    return update_table_position(table_id_fir, table_id_sec)

### 테이블 끝 ###
####################

# 메인카테고리 수정
@adm_bp.route('/update_main_category', methods=['PATCH'])
def api_update_main_category():
    data = request.get_json()
    main_category_list = data['main_category_list']
    dummy = [
        {
            'id': 1,
            'name': '식사',
            'position': 1,
        },
        {
            'id': 12,
            'name': '식사2',
            'position': 2,
        },
    ]

    store_id = current_user.id
    main_categories = db.session.query(MainCategory)\
                                    .filter(MainCategory.store_id == store_id)\
                                    .all()
    main_category_id_list = [m.id for m in main_categories]
    left_main_category_id_list = [m.id for m in main_categories]
    for main_category in main_category_list:
        if main_category['id'] in main_category_id_list:     # 원래 있던 카테고리
            category_item = db.session.query(MainCategory)\
                                .filter(MainCategory.id == main_category['id']).first()
            category_item.name = main_category['name']
            category_item.position = main_category['position']

            left_main_category_id_list.remove(main_category['id'])
        else:                               # 새로 생성된 카테고리
            item = MainCategory(store_id=store_id, name=main_category['name'], position=main_category['position'])
            db.session.add(item)
            db.session.commit()
            new_sub = SubCategory(main_category_id=item.id, name=main_category['name'], position=1)
            db.session.add(new_sub)
            
        db.session.commit()

    if len(left_main_category_id_list) > 0:                # 삭제된 카테고리
        for main_category in left_main_category_id_list:
            main_category = db.session.query(MainCategory).filter(MainCategory.id == main_category).first()
            sub_categories = db.session.query(SubCategory)\
                                        .filter(SubCategory.main_category_id == main_category.id)\
                                        .all()
            for s in sub_categories:
                menus = db.session.query(Menu)\
                                    .filter(Menu.menu_category_id == s.id)\
                                    .all()
                for m in menus:
                    db.session.delete(m)
                db.session.commit()
                db.session.delete(s)
            db.session.commit()
            item = db.session.query(MainCategory)\
                            .filter(MainCategory.id == main_category.id).first()
            db.session.delete(item)
        db.session.commit()
    return jsonify({'code':200})


# 서브카테고리 수정
@adm_bp.route('/update_sub_category', methods=['PATCH'])
def api_update_sub_category():
    data = request.get_json()
    sub_category_list = data['sub_category_list']
    sub_category_list = sorted(sub_category_list, key=lambda x: x['id'], reverse=True)  # id 큰 순으로 정렬해서 main_category_id 찾을 수 있도록
    # dummy = [
    #     {
    #         'id': 1,
    #         'name': '식사',
    #         'position': 1,
    #     },
    #     {
    #         'id': 12,
    #         'name': '식사2',
    #         'position': 2,
    #     },
    # ]


    main_category_id = db.session.query(SubCategory.main_category_id)\
                                .filter(SubCategory.id == sub_category_list[0]['id'])\
                                .scalar()
    sub_categories = db.session.query(SubCategory)\
                                    .filter(SubCategory.main_category_id == main_category_id)\
                                    .all()
    sub_category_id_list = [m.id for m in sub_categories]
    left_sub_category_id_list = [m.id for m in sub_categories]
    for sub_category in sub_category_list:
        if sub_category['id'] in sub_category_id_list:     # 원래 있던 카테고리
            category_item = db.session.query(SubCategory)\
                                .filter(SubCategory.id == sub_category['id']).first()
            category_item.name = sub_category['name']
            category_item.position = sub_category['position']

            left_sub_category_id_list.remove(sub_category['id'])
        else:                               # 새로 생성된 카테고리
            item = SubCategory(main_category_id=main_category_id, name=sub_category['name'], position=sub_category['position'])
            db.session.add(item)

        db.session.commit()

    if len(left_sub_category_id_list) > 0:                # 삭제된 카테고리
        for s in left_sub_category_id_list:
            s = db.session.query(SubCategory).filter(SubCategory.id == s).first()
            menus = db.session.query(Menu)\
                                .filter(Menu.menu_category_id == s.id)\
                                .all()
            for m in menus:
                db.session.delete(m)
            db.session.commit()
            db.session.delete(s)
        db.session.commit()
    return jsonify({'code':200})


# 카테고리 수정 가능 여부 체크
@adm_bp.route('/check_delete_category', methods=['GET'])
def api_check_delete_category():
    main_category_id = request.args.get('main_category_id', None)
    sub_category_id = request.args.get('sub_category_id', None)

    store_id = current_user.id
    if main_category_id is not None:
        check = db.session.query(Order)\
                            .join(Menu, Menu.id == Order.menu_id)\
                            .join(SubCategory, SubCategory.id == Menu.menu_category_id)\
                            .join(MainCategory, MainCategory.id == SubCategory.main_category_id)\
                            .filter(MainCategory.id == main_category_id)\
                            .all()
    elif sub_category_id is not None:
        check = db.session.query(Order)\
                            .join(Menu, Menu.id == Order.menu_id)\
                            .join(SubCategory, SubCategory.id == Menu.menu_category_id)\
                            .filter(SubCategory.id == sub_category_id)\
                            .all()
    if len(check) == 0:
        return jsonify({'status': True}), 200
    else:
        return jsonify({'status': False}), 200

####################
### 카테고리 수정 시작 ###

### 카테고리 수정 끝 ###
####################
