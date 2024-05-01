from flask import render_template, jsonify, request
from app.models.menu import select_main_category, select_sub_category, select_menu_all, select_menu, select_menu_option, select_menu_option_all, select_menu_all_to_main_category
from app.models.order import find_order_list, get_orders_by_store_id
from flask_login import login_required, current_user
from app.routes import pos_bp
import json

from app.routes import pos_bp
from app.models.table import \
    move_table, \
    select_table_category, \
    delete_table_category, \
    select_table, \
    set_table_group
from app.models import db, Menu, MenuOption

from app import socketio
from flask_socketio import join_room, emit


@socketio.on('pos_login')
def pos_login(data):
    if data.get('user_type') == 'pos':
        # 포스기 클라이언트를 'pos_group'이라는 방에 추가
        join_room('pos_group')
        print('data::',data)
        emit('login_response', {'message': '로그인이 성공하여 POS 그룹에 추가되었습니다.'})
        return {'msg': '로그인이 성공하여 POS 그룹에 추가되었습니다.'}



@pos_bp.route('/tableList')
def tableList():    
    return render_template('pos/table_list.html')


@pos_bp.route('/set_group', methods=['GET', 'POST'])
def set_group():
    group_data = request.get_json()
    return set_table_group(group_data)


@pos_bp.route('/get_table_page', methods=['GET'])
def get_table_page():

    store_id = current_user.id

    # 실행할 코드
    orders = get_orders_by_store_id(store_id)
    

    # # 가져온 데이터 사용 예시
    # for order in orders:
    #     print(order.id, order.ordered_at, order.menu_id, order.table_id, order.menu_options)
    
    # table_id를 기준으로 중복 제거하여 딕셔너리로 구성
    orders_by_table = {}
    for order in orders:
        table_id = order.table_id
        if table_id not in orders_by_table:
            orders_by_table[table_id] = []
        orders_by_table[table_id].append(order)
    
    all_table_list = []
    
    
    table_categories = select_table_category(store_id)

    
    for t in table_categories:
        category_name = t.category_name
        category_id = t.id

        

        tables = select_table(category_id)
        sorted_tables = sorted(tables, key=lambda table: (table.page, table.position))

        def sort_table(table):
            
            if table.id in dict(orders_by_table):
                # print("있음")
                orders = orders_by_table[table.id]
                statusId = 1
                orderList = []
                for order in orders:
                    
                    optionList = []
                    options = json.loads(order.menu_options) if order.menu_options else []
                    for option_data in options:
                        option = select_menu_option(option_data['id'])
                        if option :
                            option = option[0]
                            optionList.append({
                                "optionId" : option.id,
                                "option" : option.name,
                                "price" : option.price,
                                "count" : option_data['count']
                            })
                    menu = select_menu(order.menu_id)[0]
                    orderList.append({
                        "menuId" : order.menu_id,
                        "menu" : menu.name,
                        "price" : menu.price,
                        "count" : 1,
                        "optionList" : optionList
                    })
                    if order.order_status_id == 2:
                        statusId = 2
                return {
                    "tableId": table.id, 
                    "table": table.name,
                    "position": table.position,
                    "statusId": statusId,
                    "status": "",
                    "groupId" : table.is_group,
                    "groupNum" : None,
                    "groupColor" : table.group_color,
                    "orderList" : orderList,
                }
            else :
                # print("없음")
                return {
                    "tableId": table.id, 
                    "table": table.name,
                    "position": table.position,
                    "statusId": 0,
                    "status": "",
                    "groupId" : table.is_group,
                    "groupNum" : None,
                    "groupColor" : table.group_color,
                    "orderList" : [],
                }

        # 페이지별로 그룹화
        page_list = []
        current_page = None
        for table in sorted_tables:
            if table.page != current_page:
                current_page = table.page
                page_list.append({
                    "page": current_page, 
                    "tableList": [sort_table(table)]
                })
            else:
                page_list[-1]["tableList"].append(sort_table(table))

        all_table_list.append({
            "categoryId" : category_id,
            "category" : category_name,
            "pageList" : page_list
        })

    return jsonify(all_table_list)

    # # JSON 파일 경로 설정
    # json_file_path = 'app/static/json/tableList.json'

    # # JSON 파일 로드
    # with open(json_file_path, 'r', encoding='UTF-8') as file:
    #     json_data = json.load(file)

    # # JSON 데이터를 프론트에 반환
    # return jsonify(json_data)


# 테이블 -> 메뉴리스트 페이지
@pos_bp.route('/menuList/<table_id>', methods=['GET'])
def menuList(table_id): 
    # JSON 데이터를 프론트에 반환
    return render_template('/pos/menu_list.html')

# 테이블 주문내역 조회
@pos_bp.route('/get_table_order_list/<table_id>', methods=['GET'])
def get_table_order_list(table_id):
    orders = find_order_list(table_id)
    order_list = []
    for order in orders:
        menu = select_menu(order.menu_id)[0]
        options = []
        for menu_option in json.loads(order.menu_options):
            option = select_menu_option(menu_option['id'])
            if option :
                option = option[0]
                options.append({
                    "id" : option.id,
                    "name" : option.name,
                    "price" : option.price,
                    "count" : menu_option['count']
                })
        order_list.append({
            "order_id" : order.id,
            "id" : menu.id,
            "name" : menu.name,
            "price" : menu.price,
            "count" : 1,
            "options" : options
        })
    
    return jsonify(order_list)



# pos->테이블 클릭시
@pos_bp.route('/get_menu_list', methods=['GET'])
def get_main_sub_menu_list():
    store_id = current_user.id

    all_menu_list = []
    menu_categories = select_main_category(store_id) # 메인 카테고리 조회
    for main_category in menu_categories:
        sub_categories = select_sub_category(main_category.id)
        sub_category_list = []
        for sub_category in sub_categories:
            # sub_category_page = ~~~(sub_category.id)
            page_list = []

            all_menu = db.session.query(Menu)\
                                .filter(Menu.menu_category_id == sub_category.id)\
                                .all()
            for menu in all_menu:
                all_option = db.session.query(MenuOption)\
                                    .filter(MenuOption.menu_id == menu.id)\
                                    .all()
                option_list = []
                for option in all_option:
                    option_list.append({
                        'optionId': option.id,
                        'option': option.name,
                        'price': option.price
                    })
                menu_dict = {
                    'menuId': menu.id,
                    'menu': menu.name,
                    'price': menu.price,
                    'page': menu.page,
                    'position': menu.position,
                    'optionList': option_list
                }


                # page_list = []
                for p in page_list:
                    if p['page'] == menu.page:
                        p['menuList'].append(menu_dict)
                        break
                else:
                    page_list.append({
                        'page':menu.page,
                        'menuList':[menu_dict]
                    })


            sub_category_list.append({
                'subCategoryId': sub_category.id,
                'subCategory': sub_category.name,
                'pageList' : page_list
            })

        all_menu_list.append({
            'categoryId': main_category.id,
            'category': main_category.name,
            'subCategoryList': sub_category_list
        })


    # dummy = [
    #     {
    #         'categoryId': 1,
    #         'category': '식사류',
    #         'subCategoryList': [
    #             {
    #                 'subCategoryId': 1,
    #                 'subCategory': '식사류',
    #                 'pageList' : [
    #                     {
    #                         'page': 1,
    #                         'menuList': [
    #                             {
    #                                 'menuId': 1,
    #                                 'menu': '짜장면',
    #                                 'price': 6000,
    #                                 'page': 1,
    #                                 'position': 1,
    #                                 'optionList': [
    #                                     {
    #                                         'optionId':42,
    #                                         'option':'소시지',
    #                                         'price':1000
    #                                     },
    #                                     {
    #                                         'optionId':42,
    #                                         'option':'소시지',
    #                                         'price':1000
    #                                     },
    #                                 ]
    #                             }
    #                         ]
    #                     }
    #                 ]
    #             },
    #         ]
    #     },
    # ]



    return all_menu_list


'''
# 테이블 -> 메뉴리스트에 필요한 메뉴 데이터 (json)
@pos_bp.route('/get_menu_list/<table_id>', methods=['GET'])
def get_menu_list(table_id):
    
    store_id = current_user.id
    all_menu_list = []
    menu_categories = select_main_category(store_id) # 메인 카테고리 조회
    for t in menu_categories:
        category_name = t.name
        category_id = t.id
        menus = select_menu_all_to_main_category(category_id)
        
        sorted_menus = sorted(menus, key=lambda menu: (menu.page, menu.position))
        
        def sort_menu(menu):
            option_list = []
            menu_options = select_menu_option_all(menu.id)
            if isinstance(menu_options, list):
                for option in menu_options:
                    option_data = {
                        "optionId" : option.id,
                        "option" : option.name,
                        "price" : option.price
                    }
                    option_list.append(option_data)
            return {
                "menuId": menu.id, 
                "menu": menu.name,
                "price": menu.price,
                "page": menu.page,
                "position" : menu.position,
                "optionList" : option_list
            }

        # 페이지별로 그룹화
        page_list = [];
        current_page = None
        if len(sorted_menus) > 0:    
            for menu in sorted_menus:
                if menu.page != current_page:
                    current_page = menu.page
                    page_list.append({
                        "page": current_page, 
                        "menuList": [sort_menu(menu)]
                    })
                else:
                    page_list[-1]["menuList"].append(sort_menu(menu))
        else:
            page_list.append({
                "page": 1, 
                "menuList": []
            })
        all_menu_list.append({
            "categoryId" : category_id,
            "category" : category_name,
            "pageList" : page_list
        })


    # print("@@@#$",get_main_sub_menu_list())
    # print("allll_menu_list", all_menu_list)
    return jsonify(all_menu_list)

    # # JSON 파일 경로 설정
    # json_file_path = 'app/static/json/menuList.json'
        
    # # JSON 파일 로드
    # with open(json_file_path, 'r', encoding='UTF-8') as file:
    #     json_data = json.load(file)
    # print(json_data)
    # return jsonify(json_data)
'''


# 테이블 이동/합석
@pos_bp.route('/set_table', methods=['PUT'])
def set_table_list():
    table_data = request.get_json()
    for data in table_data:       
        end_id = data['end_table_id']
        start_id = data['start_table_id'] # end_id로 이동할 테이블
        set_table = move_table(end_id, start_id)
    response = jsonify({'message': 'Success'})
    response.status_code = 200
    print('Received JSON data:', set_table)
    return response


# 테이블 -> 메뉴리스트 페이지
@pos_bp.route('/payment/<table_id>', methods=['GET'])
def payment(table_id): 

    return render_template('/pos/payment.html')

# 테이블 결제 내역 조회
@pos_bp.route('/payment_history/<table_id>', methods=['GET', 'POST'])
def payment_history(table_id): 

    from app.models.payment import make_payment_history, create_payment_database
    store_id = current_user.id

    if request.method == 'GET':     # 첫 결제하기 들어왔을 때
        print("###",'get')
        table_payment_data = make_payment_history(store_id, table_id, False, False)
    else:                           # 결제중
        print("###",'post')
        payment_data = request.get_json()
        table_payment_data = create_payment_database(store_id, payment_data)

    '''
    table_payment_data = {
        'is_finished': False,  # 추가됨. 결제끝났는지아닌지
        'paid': False,  # 분할결제 이력 있는지-True/없는지-False
        'first_order_time': 0,   # 추가됨
        'discount': 0,
        'extra_charge': 0,
        'payment_history': {},
        # 'payment_history': {'isDirect' : False, # 분할결제 - 직접입력이면 True
        #     'direct' : 0,
        #     'isDutch' : False,
        #     'totalDutch' : 1,
        #     'curDutch' : 1,
        #     'dutchPrice' : 0},
        'payment': [
            # {   
            #     'method': 1,    # 1-cash/2-card
            #     'price': 5000,
            # },
            # {   
            #     'method': 1,    # 1-cash/2-card
            #     'price': 5000,
            # }
        ]
    }
    '''
    return table_payment_data