import json
import os
from datetime import datetime
from app.utils.storage import upload_image, delete_image, delete_prefix, menu_image_key, staff_call_image_key, image_url_for_key, url_to_key
from flask import render_template, request, jsonify
from flask_login import login_required, current_user
from sqlalchemy import or_, func
from app.models.menu_category import get_main_and_sub_category_by_menu_id, select_main_and_sub_category_by_store_id
from app.models.table import create_table_category, delete_table, select_table, select_table_category, select_table_id, select_table_yn, update_table_layout
from app.routes import store_bp
from app.models import MainCategory, SubCategory, db, Menu, MenuOption, MenuOptionGroup, Store


from app.models.store import create_store, update_store
from app.models.menu import check_image_exsit, check_options_exist, create_menu, create_menu_option, create_menu_option_group, delete_menu, find_last_menu_page, move_menu, select_main_category, select_menu, select_menu_all, select_menu_yn, select_pre_menu_id, select_sub_category, select_menu_option_all, find_all_menu, update_menu
from app.login_manager import update_store_session
from app.models.staff_call import get_staff_call_items, create_staff_call_item, update_staff_call_item, delete_staff_call_item, get_staff_call_logs, confirm_staff_call
from app.models import Order

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
        store_id = current_user.id
        main_categorys = select_main_category(store_id)
        if not main_categorys:
            return []
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
                                .outerjoin(MenuOptionGroup, MenuOptionGroup.menu_id == Menu.id)\
                                .outerjoin(MenuOption, MenuOption.group_id == MenuOptionGroup.id)\
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
                all_option_groups = select_menu_option_all(m.id)
                if all_option_groups:
                    for group in all_option_groups:
                        for o in group['options']:
                            option_list.append({
                                'option_id': o['id'],
                                'option_name': o['name'],
                                'option_price': o['price']
                            })

                all_menu_list.append({
                    'id': m.id,
                    'name': m.name,
                    'price': m.price,
                    'imageUrl': m.image.split(', ')[0] if m.image else '',
                    'imageList': m.image.split(', ') if m.image else [],
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
    menu_data = {}
    
    cur_main_category, cur_sub_category = get_main_and_sub_category_by_menu_id(menu)
    
    # 해당 매장의 모든 메인 카테고리 조회
    main_items = select_main_category(current_user.id)
    main_category_list = [{
        'id': i.id,
        'name': i.name,
        'checked': i.id == cur_main_category.id
    } for i in main_items]

    # 메뉴가 속한 실제 메인 카테고리의 서브 카테고리들 조회
    sub_items = select_sub_category(cur_main_category.id)
    sub_category_list = [{
        'id': i.id,
        'name': i.name,
        'checked': i.id == cur_sub_category.id
    } for i in sub_items]

    image_list = menu.image.split(', ') if getattr(menu, 'image', None) else []
    menu_data = {
        'id' : menu.id,
        'name' : menu.name,
        'price': menu.price,
        'is_soldout' : menu.is_soldout,
        'imgList' : image_list,
        'description': menu.main_description,
        'option_groups' : options if options else [],
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
        menu_category_id = json_data['sub_category']
        option_groups = json_data.get('option_groups', [])
        
        '''
        1. 페이지 마지막 값 가져오기
        2. 페이지 마지막 값에서 포지션 제일 마지막꺼 가져오기
        3. 거기서 +1 한 값 사용 (메뉴 한 페이지당 24개)
        '''
        page_position_num = find_last_menu_page(store_id)
        
        if page_position_num:
            page = page_position_num.page
            position = page_position_num.position

            if position == 24: # 24이므로 page 넘김
                page += 1
                position = 1
            elif position < 24: # 24를 넘기지 않으므로 position 더하기
                position += 1
            elif position > 24:
                print('ERROR : position 24를 초과할 수 없습니다.')
        else:
            # 메뉴가 하나도 없는 경우
            page = 1
            position = 1

        # page와 position이 null이면 1로 초기화 (추가 안전장치)
        page = page if page is not None else 1
        position = position if position is not None else 1

        images = []
        # 현재 menu 마지막 행의 id 가져오기
        # 이미지 저장 경로에 필요
        pre_menu_id = select_pre_menu_id(store_id)
        current_menu_id = pre_menu_id + 1

        # 이미지 저장
        print("[DEBUG] json_data['image']:", json_data.get('image', 'KEY_NOT_FOUND'))
        print("[DEBUG] request.files keys:", list(request.files.keys()))
        for index, menu_name in enumerate(json_data.get('image', [])):
            file = request.files.get(menu_name)
            menu_num = menu_name[9:]
            file_name = f'{name}_{menu_num}.png'
            key = menu_image_key(store_id, current_menu_id, file_name)
            image_url = upload_image(file, key)
            images.append(image_url)
        images_as_string = ', '.join(images)
        # 메뉴 create
        menu = create_menu(name, price, images_as_string, main_description, is_soldout, store_id, menu_category_id, page, position)

        if option_groups: # 메뉴 옵션 그룹 및 옵션 create
            create_menu_option_group(option_groups, menu.id)

        return jsonify({
            'message': '메뉴가 성공적으로 생성되었습니다.',
            'code': 201
        }), 201
    
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
        menu_category_id = json_data['sub_category']
        #page = menu_data['page']
        #position = menu_data['position']
        option_groups = json_data.get('option_groups', [])
        
        # # 이미지 저장
        images = []
        menu = select_menu(menu_id)[0]
        db_image_list = menu.image.split(', ') if getattr(menu, 'image', None) else []
        # 이미지 저장하기
        for index, menu_name in enumerate(json_data.get('image', [])):
            file = request.files.get(menu_name)
            menu_num = menu_name[9:]
            file_name = f'{name}_{menu_num}.png'
            key = menu_image_key(store_id, menu_id, file_name)
            image_url = image_url_for_key(key)
            db_image_list = [item for item in db_image_list if item != image_url]
            if file is None: # 변경된 파일이 없음
                images.append(image_url)
            else: # 변경된 파일이 있음 → 덮어쓰기 업로드
                image_url = upload_image(file, key)
                images.append(image_url)
        for old_url in db_image_list: # 삭제된 이미지 제거
            old_key = url_to_key(old_url)
            if old_key:
                delete_image(old_key)
        # 'image' 키의 값을 리스트에서 문자열로 변환
        images_as_string = ', '.join(images)

        # 메뉴 update
        menu = update_menu(menu_id, name, price, images_as_string, main_description, is_soldout, store_id, menu_category_id)
        
        # 메뉴 옵션 update
        if option_groups:
            check_options_exist(menu.id) # DB에 등록된 옵션이 있는지 확인 후 있으면 삭제하고
            create_menu_option_group(option_groups, menu.id) # 메뉴 옵션 그룹 재등록함
        else:
            # 옵션이 하나도 없는 경우에도 기존 옵션 삭제 필요
            check_options_exist(menu.id)

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

            # ObjectStore에서 해당 메뉴 이미지 폴더 삭제
            store_id = current_user.id
            try:
                delete_prefix(f'stores/{store_id}/menus/{menu_id}/')
                print('ObjectStore 이미지 삭제 완료')
            except Exception as e:
                print(f'ObjectStore 이미지 삭제 오류: {str(e)}')
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
    data = []
    for table_category in table_categorys:
        tables = select_table(table_category.id)
        table_list = [{
            'id': t.id,
            'name': t.name,
            'position': t.position,
            'grid_x': t.grid_x,
            'grid_y': t.grid_y,
            'grid_w': t.grid_w,
            'grid_h': t.grid_h,
        } for t in tables]
        data.append({
            'id': table_category.id,
            'name': table_category.category_name,
            'position': table_category.position,
            'tables': table_list,
        })
    return jsonify(data)


@store_bp.route('/update_table_layout', methods=['PATCH'])
def api_update_table_layout():
    json_data = request.get_json()
    tables = json_data.get('tables', [])
    result = update_table_layout(tables)
    if result:
        return jsonify({'code': 200, 'msg': '레이아웃이 저장되었습니다.'})
    return jsonify({'code': 400, 'msg': '저장에 실패하였습니다.'})
    
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

# 프린터 관리 페이지
@store_bp.route('/printer_mgmt')
@login_required
def printer_mgmt():
    return render_template('store_printer_mgmt.html')

# 프린터 진단 출력용 매장/서버 정보
@store_bp.route('/get_diagnostic_info', methods=['GET'])
@login_required
def api_get_diagnostic_info():
    import os
    return jsonify({
        'store_name': current_user.name or '',
        'store_id': current_user.store_id or '',
        'address': current_user.address or '',
        'tel': current_user.tel or '',
        'representative': current_user.representative_name or '',
    }), 200

# 기본 프린터 정보 조회 (영수증 출력용)
@store_bp.route('/get_default_printer', methods=['GET'])
@login_required
def api_get_default_printer():
    from app.models import PrinterEnvironment, Printer
    store_id = current_user.id

    # is_default 환경 우선, 없으면 첫 번째 환경
    env = PrinterEnvironment.query.filter_by(store_id=store_id, is_default=True).first()
    if not env:
        env = PrinterEnvironment.query.filter_by(store_id=store_id).order_by(PrinterEnvironment.position).first()

    if not env or not env.printers:
        return jsonify({'has_printer': False}), 200

    printer = env.printers[0]
    return jsonify({
        'has_printer': True,
        'name': printer.name or '',
        'baud_rate': printer.baud_rate or 9600,
        'usb_vendor_id': printer.usb_vendor_id,
        'usb_product_id': printer.usb_product_id,
    }), 200


# 프린터 환경 목록 조회 (환경 없으면 포스용 기본 생성)
@store_bp.route('/get_printer_environments', methods=['GET'])
@login_required
def api_get_printer_environments():
    from app.models import PrinterEnvironment, Printer
    store_id = current_user.id

    envs = PrinterEnvironment.query.filter_by(store_id=store_id).order_by(PrinterEnvironment.position).all()
    if not envs:
        default_env = PrinterEnvironment(store_id=store_id, name='포스용', is_default=True, position=0)
        db.session.add(default_env)
        db.session.commit()
        envs = [default_env]

    result = []
    for env in envs:
        printers = []
        for p in env.printers:
            printers.append({
                'id': p.id,
                'name': p.name,
                'baud_rate': p.baud_rate,
                'description': p.description or '',
                'usb_vendor_id': p.usb_vendor_id,
                'usb_product_id': p.usb_product_id,
                'position': p.position
            })
        result.append({
            'id': env.id,
            'name': env.name,
            'is_default': env.is_default,
            'position': env.position,
            'printers': printers
        })

    return jsonify({'environments': result}), 200

# 프린터 환경 생성
@store_bp.route('/create_printer_environment', methods=['POST'])
@login_required
def api_create_printer_environment():
    from app.models import PrinterEnvironment
    store_id = current_user.id
    data = request.get_json()
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'message': '환경 이름을 입력해주세요.'}), 400

    count = PrinterEnvironment.query.filter_by(store_id=store_id).count()
    env = PrinterEnvironment(store_id=store_id, name=name, is_default=False, position=count)
    db.session.add(env)
    db.session.commit()
    return jsonify({'message': 'Success', 'id': env.id}), 201

# 프린터 환경 수정
@store_bp.route('/update_printer_environment', methods=['PATCH'])
@login_required
def api_update_printer_environment():
    from app.models import PrinterEnvironment
    store_id = current_user.id
    data = request.get_json()
    env_id = data.get('env_id')
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'message': '환경 이름을 입력해주세요.'}), 400

    env = PrinterEnvironment.query.filter_by(id=env_id, store_id=store_id).first()
    if not env:
        return jsonify({'message': '환경을 찾을 수 없습니다.'}), 404

    env.name = name
    db.session.commit()
    return jsonify({'message': 'Success'}), 200

# 프린터 환경 삭제
@store_bp.route('/delete_printer_environment', methods=['DELETE'])
@login_required
def api_delete_printer_environment():
    from app.models import PrinterEnvironment
    store_id = current_user.id
    data = request.get_json()
    env_id = data.get('env_id')

    env = PrinterEnvironment.query.filter_by(id=env_id, store_id=store_id).first()
    if not env:
        return jsonify({'message': '환경을 찾을 수 없습니다.'}), 404
    if env.is_default:
        return jsonify({'message': '기본 환경(포스용)은 삭제할 수 없습니다.'}), 400

    db.session.delete(env)
    db.session.commit()
    return jsonify({'message': 'Success'}), 200

# 프린터 추가
@store_bp.route('/create_printer', methods=['POST'])
@login_required
def api_create_printer():
    from app.models import Printer, PrinterEnvironment
    store_id = current_user.id
    data = request.get_json()
    env_id = data.get('environment_id')
    name = (data.get('name') or '').strip()
    baud_rate = int(data.get('baud_rate') or 19200)
    description = (data.get('description') or '').strip()
    usb_vendor_id = data.get('usb_vendor_id')
    usb_product_id = data.get('usb_product_id')

    if not name:
        return jsonify({'message': '프린터 이름을 입력해주세요.'}), 400

    env = PrinterEnvironment.query.filter_by(id=env_id, store_id=store_id).first()
    if not env:
        return jsonify({'message': '환경을 찾을 수 없습니다.'}), 404

    count = Printer.query.filter_by(environment_id=env_id).count()
    printer = Printer(store_id=store_id, environment_id=env_id, name=name,
                      baud_rate=baud_rate, description=description,
                      usb_vendor_id=usb_vendor_id, usb_product_id=usb_product_id,
                      position=count)
    db.session.add(printer)
    db.session.commit()
    return jsonify({'message': 'Success', 'id': printer.id}), 201

# 프린터 수정
@store_bp.route('/update_printer', methods=['PATCH'])
@login_required
def api_update_printer():
    from app.models import Printer
    store_id = current_user.id
    data = request.get_json()
    printer_id = data.get('printer_id')
    name = (data.get('name') or '').strip()
    baud_rate = int(data.get('baud_rate') or 19200)
    description = (data.get('description') or '').strip()
    usb_vendor_id = data.get('usb_vendor_id')
    usb_product_id = data.get('usb_product_id')

    if not name:
        return jsonify({'message': '프린터 이름을 입력해주세요.'}), 400

    printer = Printer.query.filter_by(id=printer_id, store_id=store_id).first()
    if not printer:
        return jsonify({'message': '프린터를 찾을 수 없습니다.'}), 404

    printer.name = name
    printer.baud_rate = baud_rate
    printer.description = description
    printer.usb_vendor_id = usb_vendor_id
    printer.usb_product_id = usb_product_id
    db.session.commit()
    return jsonify({'message': 'Success'}), 200

# 프린터 삭제
@store_bp.route('/delete_printer', methods=['DELETE'])
@login_required
def api_delete_printer():
    from app.models import Printer
    store_id = current_user.id
    data = request.get_json()
    printer_id = data.get('printer_id')

    printer = Printer.query.filter_by(id=printer_id, store_id=store_id).first()
    if not printer:
        return jsonify({'message': '프린터를 찾을 수 없습니다.'}), 404

    db.session.delete(printer)
    db.session.commit()
    return jsonify({'message': 'Success'}), 200

# 한글→EUC-KR 인코딩 API (Web Serial API용)
@store_bp.route('/encode_euckr', methods=['POST'])
@login_required
def api_encode_euckr():
    data = request.get_json()
    text = data.get('text', '')
    try:
        encoded = text.encode('euc-kr')
    except (UnicodeEncodeError, LookupError):
        encoded = text.encode('utf-8')
    return jsonify({'bytes': list(encoded)}), 200

# 직원 호출 항목 관리 페이지
@store_bp.route('/staff_call_mgmt')
@login_required
def staff_call_mgmt():
    return render_template('staff_call_mgmt.html')

# 직원 호출 항목 리스트 조회 API
@store_bp.route('/get_staff_call_items', methods=['GET'])
@login_required
def api_get_staff_call_items():
    from app.models import Store
    store_id = current_user.id
    store = Store.query.get(store_id)
    items = get_staff_call_items(store_id)
    
    item_list = []
    for i in items:
        item_list.append({
            'id': i.id,
            'name': i.name,
            'image': i.image,
            'position': i.position,
            'use_quantity': i.use_quantity,
            'is_active': i.is_active
        })
        
    return jsonify({
        'items': item_list,
        'grid': {
            'rows': store.staff_call_grid_rows or 4,
            'cols': store.staff_call_grid_cols or 4
        }
    })

# 직원 호출 항목 생성/수정/삭제 API
@store_bp.route('/set_staff_call_item', methods=['POST', 'PATCH', 'DELETE'])
@login_required
def api_set_staff_call_item():
    store_id = current_user.id
    
    if request.method in ['POST', 'PATCH']:
        # JSON 또는 FormData 대응 (이미지 업로드 때문)
        if request.is_json:
            data = request.get_json()
        else:
            data = request.form
            
        name = data.get('name')
        use_quantity = data.get('use_quantity') == 'true' if not request.is_json else data.get('use_quantity', False)
        position = int(data.get('position', 0))
        item_id = data.get('id')
        
        image_url = data.get('image') if request.is_json else None
        
        # 이미지 파일 처리
        file = request.files.get('image_file')
        if file:
            filename = f"item_{item_id or 'new'}_{int(datetime.now().timestamp())}.png"
            key = staff_call_image_key(store_id, filename)
            image_url = upload_image(file, key)

        if request.method == 'POST':
            item = create_staff_call_item(store_id, name, image_url, use_quantity, position)
            # 신규 생성 후 파일명에 ID 반영하고 싶다면 여기서 재저장 로직이 필요할 수 있으나 생략 가능
            return jsonify({'message': 'Success', 'id': item.id, 'code': 201}), 201
            
        if request.method == 'PATCH':
            item = update_staff_call_item(item_id, name, image_url, use_quantity, position)
            if item:
                return jsonify({'message': 'Success', 'code': 200}), 200
            return jsonify({'message': 'Not Found'}), 404
        
    if request.method == 'DELETE':
        item_id = request.args.get('id')
        if delete_staff_call_item(item_id):
            return jsonify({'message': 'Success', 'code': 200}), 200
        return jsonify({'message': 'Not Found'}), 404

# 직원 호출 그리드 설정 저장 API
@store_bp.route('/set_staff_call_grid', methods=['POST'])
@login_required
def api_set_staff_call_grid():
    store_id = current_user.id
    data = request.get_json()
    rows = data.get('rows')
    cols = data.get('cols')
    
    from app.models.staff_call import update_staff_call_grid
    if update_staff_call_grid(store_id, rows, cols):
        return jsonify({'message': 'Success', 'code': 200}), 200
    return jsonify({'message': 'Failed', 'code': 400}), 400

# 단말기 관리 페이지
@store_bp.route('/terminal_mgmt', methods=['GET'])
@login_required
def terminal_mgmt():
    return render_template('store_terminal_mgmt.html')


# 단말기 정보 조회 API
@store_bp.route('/get_terminal_info', methods=['GET'])
@login_required
def api_get_terminal_info():
    from app.models import Store, TerminalToken
    store = Store.query.filter_by(user_id=current_user.id).first()
    if not store:
        return jsonify({'code': 404, 'msg': '매장 정보를 찾을 수 없습니다.'}), 404

    from datetime import datetime, timedelta
    latest_token = TerminalToken.query.filter_by(store_id=store.id)\
        .order_by(TerminalToken.created_at.desc()).first()

    # 10초 이내 폴링 + 가맹점 정보 모두 있어야 연결됨으로 판단
    is_connected = (
        latest_token is not None and
        latest_token.last_polled_at is not None and
        datetime.now() - latest_token.last_polled_at < timedelta(seconds=10) and
        bool(store.toss_merchant_id) and
        bool(store.toss_business_number)
    )
    last_polled = latest_token.last_polled_at.isoformat() if (latest_token and latest_token.last_polled_at) else None

    return jsonify({
        'toss_merchant_id': store.toss_merchant_id or '',
        'toss_business_number': store.toss_business_number or '',
        'is_connected': is_connected,
        'last_connected_at': last_polled,
    })


@store_bp.route('/terminal_logout', methods=['POST'])
@login_required
def api_terminal_logout():
    """단말기 토큰 삭제 → 단말기 폴링 시 logout 감지"""
    from app.models import Store, TerminalToken
    store = Store.query.filter_by(user_id=current_user.id).first()
    if not store:
        return jsonify({'code': 404, 'msg': '매장 정보를 찾을 수 없습니다.'}), 404
    TerminalToken.query.filter_by(store_id=store.id).delete()
    db.session.commit()
    return jsonify({'code': 200, 'msg': '단말기 로그아웃 처리되었습니다.'})


# 단말기 시리얼 저장 API
@store_bp.route('/update_terminal_info', methods=['PATCH'])
@login_required
def api_update_terminal_info():
    from app.models import Store
    data = request.get_json() or {}
    store = Store.query.filter_by(user_id=current_user.id).first()
    if not store:
        return jsonify({'code': 404, 'msg': '매장 정보를 찾을 수 없습니다.'}), 404

    merchant_id = data.get('toss_merchant_id')
    store.toss_merchant_id = int(merchant_id) if merchant_id else None
    store.toss_business_number = data.get('toss_business_number', '').strip() or None
    db.session.commit()
    return jsonify({'code': 200, 'msg': '저장되었습니다.'})


# ── 테이블 QR 발급 / 지오펜스 관리 ─────────────────────────────────────────────
@store_bp.route('/table_qr_mgmt', methods=['GET'])
@login_required
def table_qr_mgmt():
    return render_template('store_table_qr_mgmt.html')


# QR 주문 설정(지오펜스/보안) — 별도 페이지
@store_bp.route('/qr_settings', methods=['GET'])
@login_required
def qr_settings():
    return render_template('store_qr_settings.html')


# QR 발급 페이지용 테이블 목록 (QR 발급 상태 포함)
@store_bp.route('/get_table_qr_list', methods=['GET'])
@login_required
def api_get_table_qr_list():
    store_id = current_user.id
    table_categorys = select_table_category(store_id)
    data = []
    for table_category in table_categorys:
        tables = select_table(table_category.id)
        table_list = [{
            'id': t.id,
            'name': t.name,
            'position': t.position,
            'grid_x': t.grid_x,
            'grid_y': t.grid_y,
            'grid_w': t.grid_w,
            'grid_h': t.grid_h,
            'has_qr': bool(t.qr_token),
            'qr_generated_at': t.qr_generated_at.strftime('%Y-%m-%d %H:%M') if t.qr_generated_at else None,
        } for t in tables]
        data.append({
            'id': table_category.id,
            'name': table_category.category_name,
            'position': table_category.position,
            'tables': table_list,
        })
    return jsonify(data)


# 테이블 QR 생성/재발급 → QR 이미지(PNG data URI) 반환
@store_bp.route('/generate_table_qr', methods=['POST'])
@login_required
def api_generate_table_qr():
    import io
    import base64
    import segno
    from app.models.table import generate_table_qr_token, get_store_id_by_table_id

    data = request.get_json() or {}
    table_id = data.get('table_id')
    if not table_id:
        return jsonify({'code': 400, 'msg': 'table_id가 필요합니다.'}), 400

    # 소유권 검증: 해당 테이블이 현재 매장 소속인지
    owner_store_id = get_store_id_by_table_id(table_id)
    if owner_store_id is None or int(owner_store_id) != int(current_user.id):
        return jsonify({'code': 403, 'msg': '접근 권한이 없습니다.'}), 403

    token = generate_table_qr_token(table_id)
    if not token:
        return jsonify({'code': 404, 'msg': '테이블을 찾을 수 없습니다.'}), 404

    from app.models import Table, TableCategory
    table = Table.query.get(table_id)
    cat = TableCategory.query.get(table.table_category_id) if table else None
    store = Store.query.get(current_user.id)

    qr_url = request.host_url.rstrip('/') + '/table_order/t/' + token
    buff = io.BytesIO()
    segno.make(qr_url, error='m').save(buff, kind='png', scale=8, border=2)
    b64 = base64.b64encode(buff.getvalue()).decode('ascii')
    return jsonify({
        'code': 200,
        'qr_token': token,
        'qr_url': qr_url,
        'qr_png': 'data:image/png;base64,' + b64,
        'store_name': store.name if store else '',
        'category_name': cat.category_name if cat else '',
        'table_name': table.name if table else '',
    })


# 특정 테이블 QR 이미지 조회 (이미 발급된 토큰 기준)
@store_bp.route('/get_table_qr/<int:table_id>', methods=['GET'])
@login_required
def api_get_table_qr(table_id):
    import io
    import base64
    import segno
    from app.models import Table
    from app.models.table import get_store_id_by_table_id

    owner_store_id = get_store_id_by_table_id(table_id)
    if owner_store_id is None or int(owner_store_id) != int(current_user.id):
        return jsonify({'code': 403, 'msg': '접근 권한이 없습니다.'}), 403

    table = Table.query.get(table_id)
    if not table or not table.qr_token:
        return jsonify({'code': 404, 'msg': '발급된 QR이 없습니다.'}), 404

    from app.models import TableCategory
    cat = TableCategory.query.get(table.table_category_id)
    store = Store.query.get(current_user.id)

    qr_url = request.host_url.rstrip('/') + '/table_order/t/' + table.qr_token
    buff = io.BytesIO()
    segno.make(qr_url, error='m').save(buff, kind='png', scale=8, border=2)
    b64 = base64.b64encode(buff.getvalue()).decode('ascii')
    return jsonify({
        'code': 200,
        'table_name': table.name,
        'qr_token': table.qr_token,
        'qr_url': qr_url,
        'qr_png': 'data:image/png;base64,' + b64,
        'store_name': store.name if store else '',
        'category_name': cat.category_name if cat else '',
    })


# 매장 위치/지오펜스 설정 조회
@store_bp.route('/get_store_location', methods=['GET'])
@login_required
def api_get_store_location():
    store = Store.query.get(current_user.id)
    if not store:
        return jsonify({'code': 404, 'msg': '매장 정보를 찾을 수 없습니다.'}), 404
    return jsonify({
        'latitude': store.latitude,
        'longitude': store.longitude,
        'geofence_radius_m': store.geofence_radius_m or 200,
        'qr_geofence_enabled': bool(store.qr_geofence_enabled) if store.qr_geofence_enabled is not None else True,
        'qr_require_open_session': bool(store.qr_require_open_session),
    })


# 매장 위치/지오펜스 설정 저장
@store_bp.route('/set_store_location', methods=['POST'])
@login_required
def api_set_store_location():
    store = Store.query.get(current_user.id)
    if not store:
        return jsonify({'code': 404, 'msg': '매장 정보를 찾을 수 없습니다.'}), 404
    data = request.get_json() or {}
    if 'latitude' in data:
        store.latitude = data['latitude']
    if 'longitude' in data:
        store.longitude = data['longitude']
    if 'geofence_radius_m' in data and data['geofence_radius_m'] is not None:
        store.geofence_radius_m = int(data['geofence_radius_m'])
    if 'qr_geofence_enabled' in data:
        store.qr_geofence_enabled = bool(data['qr_geofence_enabled'])
    if 'qr_require_open_session' in data:
        store.qr_require_open_session = bool(data['qr_require_open_session'])
    db.session.commit()
    return jsonify({'code': 200, 'msg': '저장되었습니다.'})


# 직원 호출 로그 확인(Confirm) API
@store_bp.route('/payment_history', methods=['GET'])
@login_required
def payment_history_page():
    store = current_user
    store_id = store.id
    store_info = {
        'name': store.name or '',
        'business_number': store.business_number or '',
        'representative_name': store.representative_name or '',
        'address': store.address or '',
        'tel': store.tel or '',
        'receipt_header': store.receipt_header or '',
        'receipt_footer': store.receipt_footer or '',
    }
    return render_template('store_payment_history.html', store_id=store_id, store_info=store_info)


@store_bp.route('/store_info', methods=['GET'])
@login_required
def store_info_page():
    store = current_user
    store_data = {
        'name': store.name or '',
        'business_number': store.business_number or '',
        'representative_name': store.representative_name or '',
        'address': store.address or '',
        'tel': store.tel or '',
    }
    return render_template('store_info.html', store_data=store_data)


@store_bp.route('/update_store_info', methods=['POST'])
@login_required
def api_update_store_info():
    store = Store.query.filter_by(id=current_user.id).first()
    if not store:
        return jsonify({'code': 404, 'msg': '매장 정보를 찾을 수 없습니다.'}), 404
    data = request.get_json() or {}
    store.business_number = data.get('business_number', '').strip() or None
    store.representative_name = data.get('representative_name', '').strip() or None
    store.address = data.get('address', '').strip() or None
    store.tel = data.get('tel', '').strip() or None
    db.session.commit()
    return jsonify({'code': 200, 'msg': '저장되었습니다.'})


@store_bp.route('/get_receipt_store_info', methods=['GET'])
@login_required
def api_get_receipt_store_info():
    """영수증 출력에 필요한 최신 매장 정보 반환"""
    store = current_user
    return jsonify({
        'name': store.name or '',
        'business_number': store.business_number or '',
        'representative_name': store.representative_name or '',
        'address': store.address or '',
        'tel': store.tel or '',
        'receipt_header': store.receipt_header or '',
        'receipt_footer': store.receipt_footer or '',
    })


@store_bp.route('/get_payment_history', methods=['GET'])
@login_required
def get_payment_history():
    import ast
    from app.models import TablePaymentList, Payment, Payment_method, Table

    store_id = current_user.id
    date_str = request.args.get('date', '')
    filter_type = request.args.get('filter', 'all')  # all, paid, cancelled
    sort = request.args.get('sort', 'time_desc')     # time_desc, time_asc, amount_desc, amount_asc
    page = max(1, int(request.args.get('page', 1)))
    per_page = max(1, min(100, int(request.args.get('per_page', 20))))
    receipt_id_str = request.args.get('receipt_id', '').strip()

    base_query = db.session.query(TablePaymentList, Table.name)\
        .outerjoin(Table, Table.id == TablePaymentList.table_id)\
        .filter(TablePaymentList.store_id == store_id)

    # 영수증 번호 검색 (payment.id 기반)
    if receipt_id_str:
        try:
            receipt_id_int = int(receipt_id_str)
            matched_payment = Payment.query.filter_by(id=receipt_id_int).first()
            if matched_payment:
                base_query = base_query.filter(TablePaymentList.id == matched_payment.table_payment_list_id)
            else:
                return jsonify({'list': [], 'has_more': False, 'summary': {'count': 0, 'total_paid': 0, 'total_cancelled': 0}})
        except ValueError:
            return jsonify({'list': [], 'has_more': False, 'summary': {'count': 0, 'total_paid': 0, 'total_cancelled': 0}})
        tpl_list = base_query.all()
        has_more = False
    elif date_str:
        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d')
        except ValueError:
            target_date = datetime.now()
        date_start = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
        date_end = target_date.replace(hour=23, minute=59, second=59, microsecond=999999)
        base_query = base_query.filter(
            TablePaymentList.payment_time >= date_start,
            TablePaymentList.payment_time <= date_end
        )
        if sort == 'time_asc':
            base_query = base_query.order_by(TablePaymentList.payment_time.asc())
        else:
            base_query = base_query.order_by(TablePaymentList.payment_time.desc())
        tpl_list = base_query.all()
        has_more = False
    else:
        base_query = base_query.order_by(TablePaymentList.payment_time.desc())
        raw = base_query.offset((page - 1) * per_page).limit(per_page + 1).all()
        has_more = len(raw) > per_page
        tpl_list = raw[:per_page]

    result = []
    for tpl, table_name in tpl_list:
        payments_q = db.session.query(Payment, Payment_method.method)\
            .join(Payment_method, Payment_method.id == Payment.payment_method_id)\
            .filter(Payment.table_payment_list_id == tpl.id)\
            .all()

        payment_list = []
        total_paid = 0
        total_cancelled = 0
        has_cancelled = False

        for p, method_name in payments_q:
            is_cancelled = p.payment_status == 2
            payment_list.append({
                'id': p.id,
                'method': method_name,
                'method_id': p.payment_method_id,
                'amount': p.payment_amount,
                'status': p.payment_status,
                'datetime': p.payment_datetime.strftime('%H:%M:%S') if p.payment_datetime else '',
                'payment_info': json.loads(p.payment_info) if p.payment_info else {},
            })
            if is_cancelled:
                has_cancelled = True
                total_cancelled += p.payment_amount
            else:
                total_paid += p.payment_amount

        # order_details는 str(list) 형식으로 저장됨 → ast.literal_eval로 파싱
        order_items = []
        try:
            if tpl.order_details:
                parsed = ast.literal_eval(tpl.order_details)
                for item in parsed:
                    order_items.append({
                        'name': item.get('name', ''),
                        'price': item.get('price', 0),
                        'count': item.get('count', 1),
                        'options': [
                            {'name': o.get('name', ''), 'price': o.get('price', 0), 'count': o.get('count', 1)}
                            for o in (item.get('options') or item.get('option') or [])
                        ],
                    })
        except Exception:
            pass

        # 분할 결제 미완료 판단: 주문 총액 계산 후 실제 결제액과 비교
        item_total = sum(
            oi['price'] * oi['count'] + sum(o['price'] * o['count'] for o in oi.get('options', []))
            for oi in order_items
        )
        order_total = item_total + (tpl.extra_charge or 0) - (tpl.discount or 0)
        all_cancelled = len(payment_list) > 0 and all(p['status'] == 2 for p in payment_list)
        # 분할 결제 진행 중: 취소 없이 총액 미달 (취소가 있으면 부분취소로 처리)
        is_partial = total_paid > 0 and total_paid < order_total and not all_cancelled and not has_cancelled
        remaining_amount = max(0, order_total - total_paid) if is_partial else 0

        if filter_type == 'paid' and (has_cancelled or is_partial):
            continue
        if filter_type == 'cancelled' and not has_cancelled:
            continue

        try:
            ph = json.loads(tpl.payment_history) if tpl.payment_history else {}
        except Exception:
            ph = {}

        result.append({
            'id': tpl.id,
            'table_id': tpl.table_id,
            'table_name': tpl.table_name or table_name or '(삭제된 테이블)',
            'payment_date': tpl.payment_time.strftime('%Y-%m-%d') if tpl.payment_time else '',
            'first_order_time': tpl.first_order_time.strftime('%H:%M') if tpl.first_order_time else '',
            'payment_time': tpl.payment_time.strftime('%H:%M:%S') if tpl.payment_time else '',
            'order_items': order_items,
            'discount': tpl.discount or 0,
            'extra_charge': tpl.extra_charge or 0,
            'payment_history': ph,
            'total_paid': total_paid,
            'total_cancelled': total_cancelled,
            'payments': payment_list,
            'has_cancelled': has_cancelled,
            'is_partial': is_partial,
            'remaining_amount': remaining_amount,
            'order_total': order_total,
        })

    if date_str:
        if sort == 'amount_desc':
            result.sort(key=lambda x: x['total_paid'], reverse=True)
        elif sort == 'amount_asc':
            result.sort(key=lambda x: x['total_paid'])

    summary = {
        'total_count': len(result),
        'paid_count': sum(1 for r in result if not r['has_cancelled'] and not r.get('is_partial')),
        'cancelled_count': sum(1 for r in result if r['has_cancelled']),
        'partial_count': sum(1 for r in result if r.get('is_partial')),
        'total_paid': sum(r['total_paid'] for r in result),
        'total_cancelled': sum(r['total_cancelled'] for r in result),
    }

    return jsonify({'list': result, 'summary': summary, 'has_more': has_more})


@store_bp.route('/cancel_payment', methods=['POST'])
@login_required
def cancel_payment():
    from app.models import TablePaymentList, Payment

    data = request.get_json()
    payment_list_id = data.get('payment_list_id')
    if not payment_list_id:
        return jsonify({'error': '잘못된 요청입니다.'}), 400

    tpl = TablePaymentList.query.filter_by(id=payment_list_id, store_id=current_user.id).first()
    if not tpl:
        return jsonify({'error': '결제 내역을 찾을 수 없습니다.'}), 404

    payments = Payment.query.filter_by(table_payment_list_id=payment_list_id).all()
    for p in payments:
        if p.payment_status != 2:
            p.payment_status = 2

    # 취소 시각 기록
    ph = json.loads(tpl.payment_history) if tpl.payment_history else {}
    ph['cancelled_at'] = datetime.now().isoformat()
    tpl.payment_history = json.dumps(ph, ensure_ascii=False)

    db.session.commit()

    return jsonify({'status': 'ok', 'message': '환불이 완료되었습니다.'})


@store_bp.route('/cancel_payment_item', methods=['POST'])
@login_required
def cancel_payment_item():
    """개별 Payment 현금 환불"""
    from app.models import Payment, TablePaymentList

    data = request.get_json()
    payment_id = data.get('payment_id')
    if not payment_id:
        return jsonify({'error': '잘못된 요청입니다.'}), 400

    p = Payment.query.get(payment_id)
    if not p:
        return jsonify({'error': '결제 내역을 찾을 수 없습니다.'}), 404

    tpl = TablePaymentList.query.filter_by(id=p.table_payment_list_id, store_id=current_user.id).first()
    if not tpl:
        return jsonify({'error': '권한이 없습니다.'}), 403

    if p.payment_status == 2:
        return jsonify({'error': '이미 취소된 결제입니다.'}), 400

    p.payment_status = 2
    pi = json.loads(p.payment_info) if p.payment_info else {}
    pi['cancelled_at'] = datetime.now().isoformat()
    p.payment_info = json.dumps(pi, ensure_ascii=False)

    db.session.commit()
    return jsonify({'status': 'ok', 'message': '환불이 완료되었습니다.'})


@store_bp.route('/cancel_toss_payment_item', methods=['POST'])
@login_required
def cancel_toss_payment_item():
    """개별 Payment 토스 단말기 환불"""
    import uuid as _uuid
    import time as _time
    from app.models import Payment, TablePaymentList
    from app.routes.pos import _pending_payments

    data = request.get_json()
    payment_id = data.get('payment_id')
    if not payment_id:
        return jsonify({'error': '잘못된 요청입니다.'}), 400

    p = Payment.query.get(payment_id)
    if not p:
        return jsonify({'error': '결제 내역을 찾을 수 없습니다.'}), 404

    tpl = TablePaymentList.query.filter_by(id=p.table_payment_list_id, store_id=current_user.id).first()
    if not tpl:
        return jsonify({'error': '권한이 없습니다.'}), 403

    if p.payment_status == 2:
        return jsonify({'error': '이미 취소된 결제입니다.'}), 400

    pi = json.loads(p.payment_info) if p.payment_info else {}

    cancel_data = None
    if pi.get('toss_details'):
        details = pi['toss_details']
        card = details.get('card') or {}
        ts = card.get('timestamp') or details.get('timestamp') or pi.get('toss_timestamp')
        cancel_data = {
            'paymentKey': details.get('paymentKey') or pi.get('toss_payment_key', ''),
            'paymentMethod': details.get('paymentMethod', 'CARD'),
            'timestamp': ts if isinstance(ts, (int, float)) else 0,
            'approvalNumber': (
                card.get('approvalNumber')
                or card.get('approvalNo')
                or details.get('approvalNumber', '')
                or pi.get('toss_approval_no', '')
            ),
            'tax': pi.get('toss_tax') or round((details.get('totalAmount') or 0) / 11),
            'supplyValue': pi.get('toss_supply_value') or round((details.get('totalAmount') or 0) * 10 / 11),
            'tip': 0,
        }
    elif pi.get('toss_payment_key') and pi.get('toss_cash_receipt'):
        cash_ts = pi.get('toss_timestamp')
        cancel_data = {
            'paymentKey': pi.get('toss_payment_key', ''),
            'paymentMethod': 'CASH',
            'timestamp': cash_ts if isinstance(cash_ts, (int, float)) else 0,
            'approvalNumber': (pi.get('toss_cash_receipt') or {}).get('approvalNumber', ''),
            'tax': pi.get('toss_tax', 0),
            'supplyValue': pi.get('toss_supply_value', 0),
            'tip': 0,
            'isSelfIssuance': (pi.get('toss_cash_receipt') or {}).get('isSelfIssuance', False),
        }

    if not cancel_data:
        return jsonify({'error': 'Toss 결제 정보가 없어 단말기 취소를 진행할 수 없습니다.'}), 400

    if not cancel_data.get('paymentKey'):
        return jsonify({'error': '환불에 필요한 정보(결제 키)가 저장되어 있지 않습니다.\n해당 결제는 단말기 직접 취소가 필요합니다.'}), 400

    tmp_id = str(_uuid.uuid4())[:8]
    _pending_payments[tmp_id] = {
        'payment_id': tmp_id,
        'store_id': current_user.id,
        'table_id': tpl.table_id,
        'order': None,
        'payment_type': 'cancel',
        'cancel_data': cancel_data,
        'table_payment_list_id': tpl.id,
        'db_payment_id': payment_id,
        'status': 'pending',
        'last_active_at': _time.time(),
    }

    return jsonify({'payment_id': tmp_id, 'status': 'ok'})


@store_bp.route('/cancel_toss_payment', methods=['POST'])
@login_required
def cancel_toss_payment():
    """결제 이력 페이지에서 뒤늦은 단말기 취소 요청"""
    import uuid as _uuid
    import time as _time
    from app.models import TablePaymentList
    from app.routes.pos import _pending_payments

    data = request.get_json()
    tpl_id = data.get('table_payment_list_id')
    if not tpl_id:
        return jsonify({'error': '잘못된 요청입니다.'}), 400

    tpl = TablePaymentList.query.filter_by(id=tpl_id, store_id=current_user.id).first()
    if not tpl:
        return jsonify({'error': '결제 내역을 찾을 수 없습니다.'}), 404

    ph = json.loads(tpl.payment_history) if tpl.payment_history else {}

    cancel_data = None
    if ph.get('toss_details'):
        # 카드 결제
        details = ph['toss_details']
        card = details.get('card') or {}
        ts = card.get('timestamp') or details.get('timestamp') or ph.get('toss_timestamp')
        cancel_data = {
            'paymentKey': details.get('paymentKey') or ph.get('toss_payment_key', ''),
            'paymentMethod': details.get('paymentMethod', 'CARD'),
            'timestamp': ts if isinstance(ts, (int, float)) else 0,
            'approvalNumber': (
                card.get('approvalNumber')
                or card.get('approvalNo')
                or details.get('approvalNumber', '')
                or ph.get('toss_approval_no', '')
            ),
            'tax': ph.get('toss_tax') or round((details.get('totalAmount') or 0) / 11),
            'supplyValue': ph.get('toss_supply_value') or round((details.get('totalAmount') or 0) * 10 / 11),
            'tip': 0,
        }
    elif ph.get('toss_payment_key') and ph.get('toss_cash_receipt'):
        # 현금 영수증 결제
        cash_ts = ph.get('toss_timestamp')
        cancel_data = {
            'paymentKey': ph.get('toss_payment_key', ''),
            'paymentMethod': 'CASH',
            'timestamp': cash_ts if isinstance(cash_ts, (int, float)) else 0,
            'approvalNumber': (ph.get('toss_cash_receipt') or {}).get('approvalNumber', ''),
            'tax': ph.get('toss_tax', 0),
            'supplyValue': ph.get('toss_supply_value', 0),
            'tip': 0,
            'isSelfIssuance': (ph.get('toss_cash_receipt') or {}).get('isSelfIssuance', False),
        }

    if not cancel_data:
        return jsonify({'error': 'Toss 결제 정보가 없어 단말기 취소를 진행할 수 없습니다.'}), 400

    print(f'[cancel_toss_payment][DEBUG] tpl_id={tpl_id}, ph_keys={list(ph.keys())}, cancel_data={json.dumps(cancel_data, ensure_ascii=False, default=str)}')

    # paymentKey만 필수 검증 (approvalNumber는 단말기 SDK가 판단)
    if not cancel_data.get('paymentKey'):
        return jsonify({'error': '환불에 필요한 정보(결제 키)가 저장되어 있지 않습니다.\n해당 결제는 단말기 직접 취소가 필요합니다.'}), 400

    payment_id = str(_uuid.uuid4())[:8]
    _pending_payments[payment_id] = {
        'payment_id': payment_id,
        'store_id': current_user.id,
        'table_id': tpl.table_id,
        'order': None,
        'payment_type': 'cancel',
        'cancel_data': cancel_data,
        'table_payment_list_id': tpl_id,
        'status': 'pending',
        'last_active_at': _time.time(),
    }

    return jsonify({'payment_id': payment_id, 'status': 'ok'})


@store_bp.route('/save_toss_cancel', methods=['POST'])
@login_required
def save_toss_cancel():
    from app.models import TablePaymentList, Payment
    data = request.get_json()
    tpl_id = data.get('table_payment_list_id')
    result = data.get('result')
    db_payment_id = data.get('db_payment_id')
    if not tpl_id or not result:
        return jsonify({'error': '잘못된 요청입니다.'}), 400
    tpl = TablePaymentList.query.filter_by(id=tpl_id, store_id=current_user.id).first()
    if not tpl:
        return jsonify({'error': '결제 내역을 찾을 수 없습니다.'}), 404

    now_iso = datetime.now().isoformat()

    if db_payment_id:
        # 개별 Payment만 취소 처리
        p = Payment.query.get(db_payment_id)
        if p and p.table_payment_list_id == tpl_id and p.payment_status != 2:
            p.payment_status = 2
            pi = json.loads(p.payment_info) if p.payment_info else {}
            pi['toss_cancel_result'] = result
            pi['toss_cancel_time'] = now_iso
            p.payment_info = json.dumps(pi, ensure_ascii=False)
    else:
        # 전체 취소 (기존 동작)
        for p in Payment.query.filter_by(table_payment_list_id=tpl_id).all():
            if p.payment_status != 2:
                p.payment_status = 2
        ph = json.loads(tpl.payment_history) if tpl.payment_history else {}
        ph['toss_cancel_result'] = result
        ph['toss_cancel_time'] = now_iso
        tpl.payment_history = json.dumps(ph, ensure_ascii=False)

    db.session.commit()
    return jsonify({'status': 'ok'})


@store_bp.route('/confirm_staff_call', methods=['POST'])
@login_required
def api_confirm_staff_call():
    data = request.get_json()
    log_id = data.get('log_id')
    
    # Check if it's an order
    if isinstance(log_id, str) and log_id.startswith('order_'):
        try:
            order_id = int(log_id.split('_')[1])
            from app.models import Order
            # Update specific order status
            # However, we grouped orders. The ID passed is representative.
            # We strictly should find the group, but we used a representative ID.
            # If we confirm the representative order, we should probably confirm the hole group?
            # Or just that order?
            # In `get_staff_call_logs`, we grouped by (table, time).
            # If we just confirm the single order ID, others in same group might remain unconfirmed if they have different IDs.
            # But we passed `id: "order_{id}"` as representative.
            
            # Let's find the order.
            order = Order.query.get(order_id)
            if order:
                from datetime import timedelta
                # 같은 테이블, 같은 초(second)에 들어온 주문을 같은 배치로 간주
                window_start = order.ordered_at.replace(microsecond=0)
                window_end = window_start + timedelta(seconds=1)
                related_orders = Order.query.filter(
                    Order.table_id == order.table_id,
                    Order.ordered_at >= window_start,
                    Order.ordered_at < window_end
                ).all()

                for o in related_orders:
                    if o.order_status_id == 1:
                        o.order_status_id = 2

                db.session.commit()
                return jsonify({'message': 'Success'}), 200
        except Exception as e:
            print(f"Error confirming order: {e}")
            return jsonify({'message': 'Error'}), 500
            
    # Regular Staff Call
    if confirm_staff_call(log_id):
        return jsonify({'message': 'Success'}), 200
    return jsonify({'message': 'Not Found'}), 404


# ── KDS 스테이션 관리 ──────────────────────────────────────────────────────────

@store_bp.route('/kds_station_mgmt')
@login_required
def kds_station_mgmt():
    return render_template('kds_station_mgmt.html')


@store_bp.route('/get_kds_stations', methods=['GET'])
@login_required
def api_get_kds_stations():
    from app.models import KdsStation, KdsStationMenu, KdsStationStaffCall
    store_id = current_user.id
    stations = KdsStation.query.filter_by(store_id=store_id).order_by(KdsStation.position).all()
    result = []
    for s in stations:
        menu_ids = [r.menu_id for r in KdsStationMenu.query.filter_by(station_id=s.id).all()]
        staff_call_ids = [r.staff_call_item_id for r in KdsStationStaffCall.query.filter_by(station_id=s.id).all()]
        result.append({
            'id': s.id,
            'name': s.name,
            'show_all': s.show_all,
            'position': s.position,
            'menu_ids': menu_ids,
            'staff_call_ids': staff_call_ids
        })
    return jsonify(result)


@store_bp.route('/set_kds_station', methods=['POST', 'PATCH', 'DELETE'])
@login_required
def api_set_kds_station():
    from app.models import KdsStation, KdsStationMenu, KdsStationStaffCall
    store_id = current_user.id

    if request.method == 'POST':
        data = request.get_json()
        name = data.get('name', '').strip()
        show_all = bool(data.get('show_all', False))
        if not name:
            return jsonify({'message': '스테이션명을 입력해주세요.', 'code': 400}), 400
        count = KdsStation.query.filter_by(store_id=store_id).count()
        station = KdsStation(store_id=store_id, name=name, show_all=show_all, position=count)
        db.session.add(station)
        db.session.commit()
        return jsonify({'message': 'Success', 'id': station.id, 'code': 201}), 201

    if request.method == 'PATCH':
        data = request.get_json()
        station_id = data.get('id')
        station = KdsStation.query.filter_by(id=station_id, store_id=store_id).first()
        if not station:
            return jsonify({'message': 'Not Found', 'code': 404}), 404
        name = data.get('name', '').strip()
        if not name:
            return jsonify({'message': '스테이션명을 입력해주세요.', 'code': 400}), 400
        station.name = name
        station.show_all = bool(data.get('show_all', False))
        db.session.commit()
        return jsonify({'message': 'Success', 'code': 200})

    if request.method == 'DELETE':
        station_id = request.args.get('id')
        station = KdsStation.query.filter_by(id=station_id, store_id=store_id).first()
        if not station:
            return jsonify({'message': 'Not Found', 'code': 404}), 404
        KdsStationMenu.query.filter_by(station_id=station.id).delete()
        KdsStationStaffCall.query.filter_by(station_id=station.id).delete()
        db.session.delete(station)
        db.session.commit()
        return jsonify({'message': 'Success', 'code': 200})


@store_bp.route('/set_kds_station_items', methods=['POST'])
@login_required
def api_set_kds_station_items():
    from app.models import KdsStation, KdsStationMenu, KdsStationStaffCall
    store_id = current_user.id
    data = request.get_json()
    station_id = data.get('station_id')
    menu_ids = data.get('menu_ids', [])
    staff_call_ids = data.get('staff_call_ids', [])

    station = KdsStation.query.filter_by(id=station_id, store_id=store_id).first()
    if not station:
        return jsonify({'message': 'Not Found', 'code': 404}), 404

    # 전체 교체
    KdsStationMenu.query.filter_by(station_id=station_id).delete()
    KdsStationStaffCall.query.filter_by(station_id=station_id).delete()

    for mid in menu_ids:
        db.session.add(KdsStationMenu(station_id=station_id, menu_id=mid))
    for scid in staff_call_ids:
        db.session.add(KdsStationStaffCall(station_id=station_id, staff_call_item_id=scid))

    db.session.commit()
    return jsonify({'message': 'Success', 'code': 200})
