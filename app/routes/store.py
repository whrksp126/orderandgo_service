import json
import os
from flask import render_template, request, jsonify
from flask_login import login_required, current_user
from sqlalchemy import or_, func
from app.models.menu_category import get_main_and_sub_category_by_menu_id, select_main_and_sub_category_by_store_id
from app.models.table import create_table_category, delete_table, select_table, select_table_category, select_table_id, select_table_yn
from app.routes import store_bp
from app.models import MainCategory, SubCategory, db, Menu, MenuOption


from app.models.store import create_store, update_store
from app.models.menu import check_image_exsit, check_options_exist, create_menu, create_menu_option, delete_menu, find_last_menu_page, move_menu, select_main_category, select_menu, select_menu_all, select_menu_yn, select_pre_menu_id, select_sub_category, select_menu_option_all, find_all_menu, update_menu
from app.login_manager import update_store_session

# 매장 생성
@login_required
@store_bp.route('/create_or_update', methods=['GET', 'POST'])
def api_create_or_update_store():
    if request.method == 'GET':
        return render_template('/store_register.html')  # TODO
    
    if request.method == 'POST':
        store_id = request.form.get('store_id')
        user_id = request.form.get('user_id')
        name = request.form.get('name')
        address = request.form.get('address')
        tel = request.form.get('tel')
        manager_name = request.form.get('manager_name')
        manager_tel = request.form.get('manager_tel')
        logo_img = request.form.get('logo_img')
        store_image = request.form.get('username')
        main_description = request.form.get('main_description')
        sub_description = request.form.get('sub_description')

        if store_id is not None:    # update
            store = update_store(store_id, user_id, name, address, tel, manager_name, manager_tel,
                                logo_img, store_image, main_description, sub_description)
        else:                       # create
            store = create_store(user_id, name, address, tel, manager_name, manager_tel,
                                logo_img, store_image, main_description, sub_description)

        print("스토어 성공", store)
        response = jsonify({'message': 'Success'})
        response.status_code = 200
        return response
    

# 매장 리스트
@store_bp.route('/store_list', methods=['GET', 'POST'])
def api_store_list(user_id):
    dummy = [
        {'id':1, 'name':'할맥'},
        {'id':12, 'name':'할맥2'},
    ]

    store_list = []
    store_items = db.session.query(Store).filter(Store.user_id == user_id).all()
    for s in store_items:
        store_list.append({
            'id': s.id,
            'name': s.name
        })

    return store_list


# 매장 클릭 시 세션 접속
@store_bp.route('/session_store', methods=['GET', 'POST'])
def api_update_store_session(store_id):
    res = update_store_session(store_id)

    return res



# @store_bp.route('/')
# def index():
#     return render_template('adm.html');

@store_bp.route('/')
def index():
    return render_template('store.html')


@store_bp.route('/login')
def login():
    return render_template('store_login.html')

@store_bp.route('/create')
def create():
    return render_template('store_create.html')

  
@store_bp.route('/product')
def product():
    return render_template('store_product.html')


@store_bp.route('/get_main_category', methods=['GET'])
def get_main_category():
    '''
    # JSON 파일 경로 설정
    json_file_path = 'app/static/json/setMenuProductMainCategory.json'
    # JSON 파일 로드
    with open(json_file_path, 'r', encoding='UTF-8') as file:
        json_data = json.load(file)
    # JSON 데이터를 프론트에 반환
    return jsonify(json_data)
    '''

    # TODO : store_id 세션에서 받아오기, 현재 임시로 값 넣음
    # store_id = 1
    store_id = current_user.id
    items = select_main_category(store_id)
    main_category_list = []
    for i in items:
        main_category_list.append({
            'id': i.id,
            "name": i.name,
            "checked": False,
        })

    print("\n\n###main_category_list",main_category_list)
    return main_category_list

@store_bp.route('/get_sub_category', methods=['GET'])
def get_sub_category():

    main_category_id = request.args.get('main_category_id')

    # 메인카테고리 아무것도 선택 안했을 때 기본값 설정
    if main_category_id is None:
        # TODO : store_id 세션에서 받아오기, 현재 임시로 값 넣음
        # store_id = 1
        store_id = current_user.id
        main_categorys = select_main_category(store_id)
        main_category_id = main_categorys[0].id

    items = select_sub_category(main_category_id)
    
    sub_category_list = []
    for i in items:
        sub_category_list.append({
            'id': i.id,
            "name": i.name,
            "checked" : False,
        })

    
    return sub_category_list


# POS -> 매장관리 -> 상품 정보 수정 -> 전체 메뉴 조회 기능
@store_bp.route('/all_menu_list', methods=['GET'])
def all_menu_list():
    get_main_category_id = request.args.get('main_category_id', None)
    get_sub_category_id = request.args.get('sub_category_id', None)
    get_is_name = request.args.get('is_name', 0)
    get_search = request.args.get('search', None)

    store_id = current_user.id
    all_menu_list = []
    # select_main_category(store_id) # 메인 카테고리 조회
    main_categories = db.session.query(MainCategory)\
                                .filter(MainCategory.store_id == store_id)
    if get_main_category_id is not None:
        main_categories = main_categories.filter(MainCategory.id == get_main_category_id)
    main_categories = main_categories.all()

    for t in main_categories:
        main_category_id = t.id # 메인 카테고리 ID
        main_category_name = t.name # 메인 카테고리명

        # sub_categories = select_sub_category(main_category_id) # 서브 카테고리 조회
        sub_categories = db.session.query(SubCategory)\
                                    .filter(SubCategory.main_category_id == main_category_id)
        if get_sub_category_id is not None:
            sub_categories = sub_categories.filter(SubCategory.id == get_sub_category_id)
        sub_categories = sub_categories.all()

        for s in sub_categories:
            sub_category_id = s.id # 메인 카테고리 ID
            sub_category_name = s.name # 메인 카테고리명
            # menus = select_menu_all(sub_category_id) # 메뉴 조회
            menus = db.session.query(Menu.id, Menu.name, Menu.price, Menu.image, Menu.main_description, 
                                     Menu.sub_description, Menu.is_soldout, Menu.created_at, Menu.page,
                                    Menu.position, Menu.menu_category_id, 
                                    func.group_concat(MenuOption.name).label('option_name'))\
                                .outerjoin(MenuOption, MenuOption.menu_id == Menu.id)\
                                .filter(Menu.menu_category_id == sub_category_id)
            if get_search is not None:
                if get_is_name == 0:
                    menus = menus.filter(or_(
                                                Menu.name.ilike('%{}%'.format(get_search.replace(' ', '%'))),
                                                MenuOption.name.ilike('%{}%'.format(get_search.replace(' ', '%'))),
                                                Menu.price.ilike('%{}%'.format(get_search.replace(' ', '%')))
                                            )
                                        )
                else:
                    menus = menus.filter(Menu.name.ilike('%{}%'.format(get_search.replace(' ', '%'))))
            menus = menus.group_by(Menu.id).all()
            #sorted_menus = sorted(menus, key=lambda menu: (menu.page, menu.position))

            for m in menus:
                option_list = []
                all_option_list = select_menu_option_all(m.id)
                if all_option_list:
                    for o in all_option_list:
                        option_list.append({
                            'option_id': o.id,
                            'option_name': o.name,
                            'option_price': o.price
                        })

                all_menu_list.append({
                    'id': m.id,
                    'name': m.name,
                    'price': m.price,
                    #'image': m.image,
                    'main_description': m.main_description,
                    'sub_description': m.sub_description,
                    #'is_soldout': m.is_soldout,
                    'main_category_id': main_category_id,
                    'main_category_name': main_category_name,
                    'sub_category_id': sub_category_id,
                    'sub_category_name': sub_category_name,
                    'is_soldout': m.is_soldout,
                    'option': option_list
                })
    '''
    menu_items = find_all_menu(store_id)
    # print("@$#", menu_items)

    all_menu_list = []
    for i in menu_items:
        # 옵션 있으면 어떻게?
        option_list = []
        all_option_list = select_menu_option_all(i.id)
        for o in all_option_list:
            option_list.append({
                'option_id': o.id,
                'option_name': o.name,
                'option_price': o.price
            })

        all_menu_list.append({
            'id': i.id,
            'main_category': i.main_category_name,
            'sub_category': i.sub_category_name,
            'name': i.name,
            'price': i.price,
            'option': option_list
        })

    print("@@@", all_menu_list)
    '''
    return jsonify(all_menu_list)


@store_bp.route('/get_menu', methods=['GET'])
def get_menu():
    menu_id = request.args.get('menu_id')
    menu = select_menu(menu_id)[0]
    options = select_menu_option_all(menu_id)
    option_data = []
    if options:
        for option in options:
            option_data.append({
                'name' : option.name,
                'price' : option.price
            })
    menu_data = {}
    
    cur_main_category, cur_sub_category = get_main_and_sub_category_by_menu_id(menu);
    main_category_list = get_main_category()
    sub_category_list = get_sub_category()
    for main_category in main_category_list:
        print(main_category['id'], cur_main_category.id)
        if main_category['id'] == cur_main_category.id:
            
            main_category['checked'] = True
        else:
            main_category['checked'] = False
    
    for sub_category in sub_category_list:
        if sub_category['id'] == cur_sub_category.id:
            sub_category['checked'] = True
        else:
            sub_category['checked'] = False
    
    
    menu_data = {
        'id' : menu.id,
        'name' : menu.name,
        'price': menu.price,
        'is_soldout' : menu.is_soldout,
        'imgList' : [],
        'description': menu.main_description,
        'options' : option_data,
        'category': {
            'main' : main_category_list,
            'sub' : sub_category_list,
        },
    }
    return menu_data


# POS -> 매장관리 -> 상품 정보 수정 -> 생성, 수정
@store_bp.route('/set_menu', methods=['GET', 'POST', 'PATCH', 'DELETE'])
def set_menu():
    if request.method == 'GET':
        return render_template('set_menu_product.html')

    # 새 메뉴 추가
    if request.method == 'POST':
        # TODO : page, position 데이터 받기, 현재 null 처리
        store_id = current_user.id
        json_data = json.loads(request.form.get('json_data'))
        name = json_data['name']
        price = int(json_data['price'])
        main_description = json_data['main_description']
        #sub_description = json_data['sub_description']
        is_soldout = False # null 허용X -> false 기본값으로 넣고 있음
        print(type(json_data['main_category']))
        menu_category_id = json_data['main_category']
        options = json_data['options']
        
        '''
        1. 페이지 마지막 값 가져오기
        2. 페이지 마지막 값에서 포지션 제일 마지막꺼 가져오기
        3. 거기서 +1 한 값 사용 (메뉴 한 페이지당 24개)
        '''
        page_position_num = find_last_menu_page(store_id)
        page = page_position_num.page
        position = page_position_num.position

        if position == 24: # 24이므로 page 넘김
            page += 1
            position = 1
        elif position < 24: # 24를 넘기지 않으므로 position 더하기
            position += 1
        elif position > 24:
            print('ERROR : position 24를 초과할 수 없습니다.')

        # page와 position이 null이면 1로 초기화
        page = page if page is not None else 1
        position = position if position is not None else 1

        images = []
        # 현재 menu 마지막 행의 id 가져오기
        # 이미지 저장 경로에 필요
        pre_menu_id = select_pre_menu_id(store_id)
        current_menu_id = pre_menu_id + 1

        # 이미지 저장
        for index, menu_name in enumerate(json_data['image']):
            file = request.files.get(menu_name)
            UPLOAD_FOLDER = 'app/static/images/store_'
            upload_path = f'{UPLOAD_FOLDER}{store_id}/menu_{current_menu_id}' # app/static/images/store_16/menu_30
            
            # 서버에 스토어 아이디에 해당하는 폴더 유무 확인 후 생성
            if not os.path.exists(upload_path):
                os.makedirs(upload_path)
            file_name = f'{name}_{index}.png'

            # 저장
            file.save(os.path.join(upload_path, file_name))

            # 디비에 저장할 이미지 경로
            images.append(upload_path + file_name)
        print('이미지 저장 완료')

        # 'image' 키의 값을 리스트에서 문자열로 변환
        images_as_string = ', '.join(images)

        # 메뉴 create
        menu = create_menu(name, price, images_as_string, main_description, is_soldout, store_id, menu_category_id, page, position)

        # 메뉴 옵션 create
        if options:
            create_menu_option(options, menu.id)

        return jsonify({'message': '메뉴가 성공적으로 생성되었습니다.'}), 201
    
    # 기존 메뉴 수정
    if request.method == 'PATCH':
        # TODO : page, position 데이터 받기, 현재 null 처리
        store_id = current_user.id
        json_data = json.loads(request.form.get('json_data'))
        menu_id = json_data['id']
        name = json_data['name']
        price = json_data['price']
        main_description = json_data['main_description']
        #sub_description = json_data['sub_description']
        is_soldout = False # null 허용X -> false 기본값으로 넣고 있음
        #print(type(json_data['main_category']))
        menu_category_id = json_data['main_category']
        #page = menu_data['page']
        #position = menu_data['position']
        options = json_data['options']
        
        images = []

        UPLOAD_FOLDER = 'app/static/images/store_'
        upload_path = f'{UPLOAD_FOLDER}{store_id}/menu_{menu_id}'
        print(upload_path)
        print(os.path.isfile(upload_path))

        import shutil
        # 이미지 저장
        if json_data['image']:
            # 서버에 스토어 아이디에 해당하는 폴더 유무 확인 후 있으면 폴더 삭제
            if os.path.exists(upload_path):
                try:
                    shutil.rmtree(upload_path)
                    print('폴더 삭제 완료')
                except Exception as e:
                    print(f'폴더 삭제 오류: {str(e)}')
            
            # 이미지 저장하기
            for index, menu_name in enumerate(json_data['image']):
                file = request.files.get(menu_name)

                # 서버에 스토어 아이디에 해당하는 폴더 유무 확인 후 생성
                if not os.path.exists(upload_path):
                    os.makedirs(upload_path)
                file_name = f'{name}_{index}.png'

                # 저장
                file.save(os.path.join(upload_path, file_name))

                # 디비에 저장할 이미지 경로
                images.append(upload_path + file_name)

        # 'image' 키의 값을 리스트에서 문자열로 변환
        images_as_string = ', '.join(images)

        # 메뉴 update
        menu = update_menu(menu_id, name, price, images_as_string, main_description, is_soldout, store_id, menu_category_id)
        
        # 메뉴 옵션 update
        if options:
            check_options_exist(menu.id) # DB에 등록된 옵션이 있는지 확인 후 있으면 삭제하고
            create_menu_option(options, menu.id) # 메뉴 옵션 재등록함

        return jsonify({
            'code' : 200,
            'msg': '저장이 완료되었습니다.'
            }), 200
    
    # 메뉴 삭제
    if request.method == 'DELETE':
        menu_id = request.args.get('id')
        # 해당 메뉴가 이용 중인 테이블에 있는지 조회
        menu_yn = select_menu_yn(menu_id) # 삭제 가능 True, 삭제 불가능 False
        if menu_yn == True:
            # 삭제 진행
            is_delete_menu = delete_menu(menu_id)
            if is_delete_menu == True:
                return jsonify({'message': '메뉴가 성공적으로 삭제되었습니다.', 'code': 200}), 200
            else:
                return jsonify({'message': '없는 메뉴입니다.', 'code': 400}), 200
        else:
            return jsonify({'message': '이용 중인 메뉴로 삭제가 불가능합니다.', 'code': 422}), 200

# 매장관리 -> POS관리 -> 테이블 설정
@store_bp.route('/set_table', methods=['GET', 'POST', 'PATCH', 'DELETE'])
def set_table():
    if request.method == 'GET':
        return render_template('set_table_position.html')
    
    # 테이블 삭제
    if request.method == 'DELETE':
        table_id = request.args.get('id')
        # 해당 테이블 이용 유무 확인
        table_yn = select_table_yn(table_id) # 삭제 가능 True, 삭제 불가능 False
        if table_yn == True:
            # 삭제 진행
            is_delete_talbe = delete_table(table_id)
            if is_delete_talbe == True:
                return jsonify({'msg': '테이블이 성공적으로 삭제되었습니다.', 'code': 200}), 200
            else:
                return jsonify({'msg': '없는 테이블입니다.', 'code': 400}), 200
        elif table_yn == False:
            return jsonify({'msg': '이용 중인 테이블로 삭제가 불가능합니다.', 'code': 422}), 200
        else:
            return table_yn
    
@store_bp.route('/get_table', methods=['GET'])
def get_table():
    store_id = current_user.id
    table_categorys = select_table_category(store_id)
    data=[]
    for table_category in table_categorys:
        tables = select_table(table_category.id)
        table_list = []
        for table in tables:
            table_list.append({
                'id' : table.id,
                'name' : table.name,
                'page' : table.page,
                'position' : table.position
            })
        
        # page 그룹화, position 정렬
        grouped_data = {}
        for item in table_list:
            page = item['page']
            if page not in grouped_data:
                grouped_data[page] = []
            grouped_data[page].append(item)
        for page, tables in grouped_data.items():
            grouped_data[page] = sorted(tables, key=lambda x: x['position'])
        page_list = [{'page': page, 'tables': tables} for page, tables in grouped_data.items()]
          
        data.append({
            'id' : table_category.id,
            'name': table_category.category_name,
            'position': table_category.position,
            'pages': page_list
        })
    return data
    
# POS -> 매장관리 -> 메뉴 위치 설정 
@store_bp.route('/set_menu_position', methods=['GET', 'POST', 'PATCH'])
def set_menu_position():
    if request.method == 'GET':
        return render_template('set_menu_position.html')
    
    # 메뉴 위치 수정
    if request.method == 'PATCH':
        json_data = request.get_json()
        set_menu_psn = move_menu(json_data)
        if set_menu_psn == True:
            return jsonify({
                'code' : 200,
                'message': '메뉴 위치가 변경되었습니다.'}), 200
        else:
            return jsonify({
                'code' : 400,
                'message': '메뉴 이동 실패'
                }), 400
    
# 테이블 카테고리 생성/수정
@store_bp.route('/set_table_category', methods=['POST'])
def set_table_category():
    if request.method == 'POST':
        # (수정) 카테고리 id가 있을 경우
        # (생성) 없을 경우
        # id, store_id, category_name, position
        store_id = current_user.id
        json_data = request.get_json()
        table_category = create_table_category(json_data, store_id)

        '''
        json_data = [
            {
                "id": 1,
                "category_name": "1층",
                "position": 1
            },
            {
                "id": None,
                "category_name": "2층",
                "position": 2
            }
        ]
        '''
        if table_category == True:
            return jsonify({
                'code' : 200,
                'msg': '테이블 카테고리가 성공적으로 저장되었습니다.'
            }), 200
        else:
            return jsonify({
                'code' : 400,
                'msg': '테이블 카테고리 저장에 실패하였습니다.'
            }), 400

# 테이블 카테고리 삭제 시 테이블 이용 중 유무 확인 API
# 테이블 카테고리 삭제 버튼 클릭 시 해당 카테고리에 테이블 있는지 조회하는 기능
# True, False 리턴
@store_bp.route('/get_table_id_yn', methods=['GET'])
def get_table_id_yn():
    if request.method == 'GET':
        table_category_id = request.args.get('id')
        table_id_yn = select_table_id(table_category_id)
        if table_id_yn == True:
            return jsonify({'status': True}), 200
        else:
            return jsonify({'status': False}), 200