from flask import render_template, jsonify, request
import json
from app.models.menu import select_main_category, select_sub_category, select_menu_all, select_menu, select_menu_option, select_menu_option_all, select_menu_all_to_main_category
from app.models.order import find_order_list, get_orders_by_store_id
from flask_login import login_required, current_user
from app.routes import pos_bp
from app.models.table import \
    move_table, \
    select_table_category, \
    delete_table_category, \
    select_table, \
    set_table_group
from app.models import db, Menu, MenuOption, MenuOptionGroup, StaffCallLog, StaffCallItem, Table, Order
from app.models.staff_call import get_staff_call_logs

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
                option_list = select_menu_option_all(menu.id)
                if not option_list:
                    option_list = []
                # for option in all_option:
                #     option_list.append({
                #         'optionId': option.id,
                #         'option': option.name,
                #         'price': option.price
                #     })
                menu_dict = {
                    'menuId': menu.id,
                    'menu': menu.name,
                    'price': menu.price,
                    'page': menu.page,
                    'position': menu.position,
                    'optionList': option_list,
                    'mainDescription': menu.main_description,
                    'imageUrl': menu.image.split(', ')[0] if menu.image else '',
                    'imageList': menu.image.split(', ') if menu.image else []
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



    return jsonify(all_menu_list)


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

    return table_payment_data

# 직원 호출 로그 조회 (최근 20개)
@pos_bp.route('/get_staff_call_logs', methods=['GET'])
@login_required
def api_get_staff_call_logs():
    store_id = current_user.id
    
    # 1. Fetch Staff Call Logs
    logs = get_staff_call_logs(store_id, limit=50) # Fetch more to account for grouping
    
    # Grouping logic for Staff Calls
    grouped_data = {}
    
    for log, item, table_name in logs:
        key = log.request_id if log.request_id else f"log_{log.id}"
        
        if key not in grouped_data:
            grouped_data[key] = {
                'id': log.id, # Use representative ID
                'type': 'staff_call',
                'table_name': table_name if table_name else f'테이블 {log.table_id}',
                'requestTime': log.called_at,
                'confirmTime': log.confirmed_at,
                'items': []
            }
        
        item_name = item.name if item else '직원 호출'
        if item and item.use_quantity:
            grouped_data[key]['items'].append(f"{item_name} {log.quantity}개")
        else:
            grouped_data[key]['items'].append(f"{item_name}")

    # 2. Fetch Orders (Recent 50)
    # Order Status: 1 (Requested/Cooking), 2 (Confirmed/Finished), 0 (Cooking? - check logic)
    # Assuming 1 is new order, 2 is confirmed/completed.
    # We want to show orders as notifications.
    from app.models import Order, Table, TableCategory
    
    orders = db.session.query(Order, Table.name)\
        .join(Table, Order.table_id == Table.id)\
        .join(TableCategory, Table.table_category_id == TableCategory.id)\
        .filter(TableCategory.store_id == store_id)\
        .filter(Order.order_status_id.in_([1, 2]))\
        .order_by(Order.ordered_at.desc())\
        .limit(50).all()
        
    for order, table_name in orders:
        # Group orders by table and time (rough grouping to avoid clutter?)
        # For now, let's treat each order *item* or *table order group*?
        # The prompt says "adding menu ordering also to notification history".
        # Creating a notification per order might be too much if they order 10 items.
        # But `Order` table structure seems to be one row per menu item.
        # However, they might share `order_list_id` or similar time.
        # Use `order_list_id` + `ordered_at` for grouping? 
        # Actually `order_list_id` is for the whole session.
        # Let's group by `table_id` and `ordered_at` (within a few seconds).
        # Or just list them individually? Grouping is better.
        # Let's simple check: if we have `ordered_at` close to each other.
        # For simplicity, let's treat each order row as an item, and group by (table_id, ordered_at minute/second).
        # But `Order` has `menu_options`.
        
        # Unique key for grouping: table_id + ordered_at (down to minute or specific batch)
        # Check if `TableOrderList` is used.
        pass

    # Let's refine order fetching to group by 'order_list_id' isn't enough because it spans the whole meal.
    # Group by (table_id, ordered_at). `ordered_at` should be same for a batch order.
    
    # Re-fetching with grouping logic in python
    orders_data = []
    
    for order, table_name in orders:
        menu = select_menu(order.menu_id)
        menu_name = menu[0].name if menu else 'Unknown Menu'
        
        # Parse options
        options = []
        try:
            options_data = json.loads(order.menu_options) if order.menu_options else []
            for opt in options_data:
                # We need option name. This might require fetching option.
                # Optimization: select_menu_option might be heavy in loop.
                # For now, just show menu name or count.
                # Let's try to get option name if possible.
                opt_obj = select_menu_option(opt['id'])
                if opt_obj:
                    options.append(f"{opt_obj[0].name}")
        except:
            pass
            
        item_str = f"{menu_name}"
        if options:
            item_str += f" ({', '.join(options)})"
            
        orders_data.append({
            'id': order.id,
            'table_name': table_name,
            'ordered_at': order.ordered_at,
            'status': order.order_status_id,
            'item': item_str
        })
        
    # Group orders
    grouped_orders = {}
    for o in orders_data:
        # Key: table_name + ordered_at (formatted)
        key = f"order_{o['table_name']}_{o['ordered_at'].strftime('%Y%m%d%H%M%S')}"
        
        if key not in grouped_orders:
            grouped_orders[key] = {
                'id': f"order_{o['id']}", # Representative ID (string)
                'type': 'order',
                'table_name': o['table_name'],
                'requestTime': o['ordered_at'],
                'confirmTime': o['ordered_at'] if o['status'] == 2 else None, # If status 2, it's confirmed.
                'items': []
            }
        
        grouped_orders[key]['items'].append(o['item'])
        # If any item in the group is unconfirmed (1), the whole group should be unconfirmed?
        # Simpler: If any item is status 1, confirmTime should be None.
        if o['status'] == 1:
            grouped_orders[key]['confirmTime'] = None

    # Merge Collections
    final_list = list(grouped_data.values()) + list(grouped_orders.values())
    
    # Sort by requestTime desc
    final_list.sort(key=lambda x: x['requestTime'], reverse=True)
    
    # Format for JSON
    result = []
    for group in final_list[:50]: # Limit combined
        
        # Text Generation
        if group['type'] == 'staff_call':
            is_generic = len(group['items']) == 1 and '직원 호출' in group['items'][0] and '1개' in group['items'][0]
            if is_generic:
                text = f"<b>{group['table_name']}</b>에서 직원을 호출했습니다."
            else:
                items_html = '<br>'.join([f"- {item}" for item in group['items']])
                text = f"<b>{group['table_name']}</b><br>{items_html}"
            items_text = ', '.join(group['items'])
            
        else: # Order
            items_html = '<br>'.join([f"- {item}" for item in group['items']])
            text = f"<b>{group['table_name']}</b> 주문<br>{items_html}"
            items_text = ', '.join(group['items'])

        result.append({
            'id': group['id'], # Can be int or string
            'table_name': group['table_name'],
            'items_text': items_text,
            'requestTime': group['requestTime'].strftime('%H:%M:%S'),
            'confirmTime': group['confirmTime'].strftime('%H:%M:%S') if group['confirmTime'] else None,
            'text': text,
            'is_order': group['type'] == 'order'
        })

    return jsonify(result)


# 매장 정보 조회 (영수증용)
@pos_bp.route('/get_store_info', methods=['GET'])
@login_required
def get_store_info():
    from app.models import Store
    store = Store.query.filter_by(id=current_user.id).first()
    if not store:
        return jsonify({})

    return jsonify({
        "name": store.name,
        "business_number": store.business_number,
        "representative_name": store.representative_name,
        "address": store.address,
        "tel": store.tel
    })