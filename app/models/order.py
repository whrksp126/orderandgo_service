import json
from flask import session, jsonify
from sqlalchemy import and_
from app.models import db, Table, TableCategory, Order, TableOrderList, Menu, MenuOption

# Store 전체 주문 내역 조회
def get_orders_by_store_id(store_id):
    # TableOrderList 테이블에서 store_id가 일치하고 checkingout_at 값이 없는 레코드들의 id 값을 조회
    table_order_ids = db.session.query(TableOrderList.id).filter(
        and_(
            TableOrderList.store_id == store_id,
            TableOrderList.checkingout_at == None
        )
    ).all()

    # 조회한 id 값을 이용하여 Order 테이블에서 해당하는 데이터들을 가져옴
    orders = db.session.query(Order).filter(
        Order.order_list_id.in_([item[0] for item in table_order_ids])
    ).all()

    return orders

# 주문하기 클릭 시
def make_order(store_id, table_id, order_list):
    
    # 현재 이용중인 TableOrderList를 가져옴
    table_order_list_item = db.session\
        .query(TableOrderList)\
        .filter(TableOrderList.table_id == table_id)\
        .filter(TableOrderList.checkingout_at.is_(None))\
        .first()
        
    # table_order_list_item이 None이면 첫 주문
    if table_order_list_item is None:
        table_order_list_item = TableOrderList(table_id=table_id, store_id=store_id)
        db.session.add(table_order_list_item)
        db.session.commit()
        
    for o in order_list:
        option_data = []
        for option in o['options']:
            option_data.append({
                'id': option['id'],
                'count': option['count']
            })
        # order_status_id는 임의로 1로 함. temp
        order_item = Order(
            order_status_id = 1, 
            menu_id = o['id'], 
            table_id = table_id, 
            order_list_id = table_order_list_item.id,
            menu_options = json.dumps(option_data)
        )
        db.session.add(order_item)
        db.session.commit()

    return True
    
# Table 전체 주문 내역 조회
def find_order_list(table_id):
    # TableOrderList 테이블에서 table_id가 일치하고 checkingout_at 값이 없는 레코드들의 id 값을 조회
    table_order_ids = db.session.query(TableOrderList.id).filter(
        and_(
            TableOrderList.table_id == table_id,
            TableOrderList.checkingout_at == None
        )
    ).all()

    # 조회한 id 값을 이용하여 Order 테이블에서 해당하는 데이터들을 가져옴
    orders = db.session.query(Order).filter(
        Order.order_list_id.in_([item[0] for item in table_order_ids])
    ).all()

    return orders


# # 주문만 출력
# def find_order_list(table_id):
#     items = db.session\
#         .query(Menu.id, Menu.name, Menu.price, Order.id.label('order_id'))\
#         .join(Order, Order.menu_id == Menu.id)\
#         .join(TableOrderList, TableOrderList.id == Order.order_list_id)\
#         .join(Table, Table.id == TableOrderList.table_id)\
#         .filter(TableOrderList.checkingout_at.is_(None), Table.id == table_id)\
#         .all()
#     if items is None:
#         return "잘못됨"
#     return items


# 주문 취소 클릭시
def delete_order(order_id_list):
    if not order_id_list:
        return True
        
    # 삭제할 주문들이 속한 order_list_id 리스트를 먼저 가져옴
    order_list_ids = db.session.query(Order.order_list_id)\
        .filter(Order.id.in_(order_id_list))\
        .distinct().all()
    order_list_ids = [item[0] for item in order_list_ids]

    # 주문 삭제
    for order_id in order_id_list:
        order_item = db.session.query(Order).filter(Order.id == order_id).first()
        if order_item:
            db.session.delete(order_item)
    
    db.session.commit()

    # 삭제 후 각 TableOrderList가 비어있는지 확인하고 비어있으면 삭제
    for ol_id in order_list_ids:
        remaining_count = db.session.query(Order).filter(Order.order_list_id == ol_id).count()
        if remaining_count == 0:
            ol_item = db.session.query(TableOrderList).filter(TableOrderList.id == ol_id).first()
            if ol_item:
                db.session.delete(ol_item)
                db.session.commit()
                print(f"Empty table session (TableOrderList ID: {ol_id}) deleted.")
                
    return True