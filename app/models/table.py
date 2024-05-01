from flask import session, jsonify
from app.models import Order, TableOrderList, TablePaymentList, db, Table, TableCategory

#################
# 테이블 카테고리
#################

# 테이블 카테고리 생성/수정
def create_table_category(table_category_list, store_id):
    result = False
    # DB에 있는 테이블 카테고리 정보
    table_categories = db.session.query(TableCategory)\
                                .filter(TableCategory.store_id == store_id)\
                                .all()
    # DB에서 조회한 테이블 카테고리 id만 리스트에 담기
    table_category_id_list = [t.id for t in table_categories]
    left_table_category_id_list = [t.id for t in table_categories] # 삭제할 때 사용

    # UPDATE OR CREATE
    for tc in table_category_list:
        if tc['id'] in table_category_id_list: # DB에 있는 카테고리 - UPDATE
            table_category = TableCategory.query.filter(TableCategory.id == tc['id']).first()
            table_category.category_name = tc['category_name']
            table_category.position = tc['position']
            db.session.commit()
            left_table_category_id_list.remove(tc['id']) # id 있으면 제거
        else: # DB에 없는 카테고리 - CREATE
            table_category = TableCategory(store_id=store_id, category_name=tc['category_name'], position=tc['position'])
            db.session.add(table_category)
            db.session.commit()
            for i in range(20): # 신규 생성한 카테고리에 테이블 자동 생성
                data = {
                    'name': tc['category_name'] + str(i+1),
                    'seat_count' : None, 
                    'is_group' : None,
                    'table_category_id' : table_category.id,
                    'page': 1,
                    'position' : i+1
                }
                item = Table(name=data['name'], seat_count=data['seat_count'], is_group=data['is_group'], table_category_id=data['table_category_id'], page=data['page'], position=data['position'])
                db.session.add(item)
            db.session.commit()
        result = True
    
    # DELETE
    if len(left_table_category_id_list) > 0: # 삭제할 테이블 카테고리
        for table_category_id in left_table_category_id_list:
            delete_result = delete_table_category(table_category_id)
            if delete_result == True:
                result = True
            else:
                result = False
    return result

# 테이블 카테고리 조회
def select_table_category(store_id):
    item = TableCategory.query.filter(TableCategory.store_id == store_id).all()
    if not item:
        return '잘못됨'
    return item

# 테이블 카테고리 삭제
def delete_table_category(table_category_id):
    item = TableCategory.query.filter(TableCategory.id == table_category_id).first()
    if not item:
        return False
    delete_table_all_result = delete_table_all(table_category_id) # 카테고리에 속한 테이블 삭제
    if delete_table_all_result == True:
        db.session.delete(item)
        db.session.commit()
        return True

# 특정 테이블 카테고리에 속한 테이블 전체 삭제
def delete_table_all(table_category_id):
    items = Table.query.filter(Table.table_category_id == table_category_id).all()
    if items:
        for item in items:
            db.session.delete(item)
        db.session.commit()
    return True

#########
# 테이블
#########

# 테이블 조회
def select_table(table_category_id):
    item = Table.query.filter(Table.table_category_id == table_category_id).all()
    if not item:
        return '잘못됨'
    
    return item

# 테이블 이동/합석
def move_table(end_id, start_id):
    #print('이동하고픈 테이블 : ', start_id)
    #print('가만히 있는 테이블 : ', end_id)
    for s in start_id:
        # order 테이블에 table 번호 변경
        order_table = Order.query.filter(Order.table_id == s).update({'table_id': end_id})\
        # table_order_list 테이블에 table 번호 변경
        list_table = TableOrderList.query.filter(TableOrderList.table_id == s).update({'table_id': end_id})

        if not order_table:
            return '없는 정보입니다.'
        elif not list_table:
            return '없는 정보입니다.'
        
    db.session.commit()
    print('테이블 이동/합석 완료')
    return True

# 테이블 수정
def update_table(table_id, change_dict):
    item = Table.query.filter(Table.id == table_id).first()
    if not item:
        return '잘못됨'
    
    change_list = ['seat_count', 'table_category', 'x_axis', 'y_axis', 'page', 'is_group']
    for c in change_dict.keys():
        if c in change_list:
            item[c] = change_dict[c]
            db.session.commit()
    return True


# 테이블 삭제
def delete_table(table_id):
    # TablePaymentList 테이블에 table_id 가 fk라 null로 변경 후 테이블 삭제 진행

    # 1.결제내역에 table_id null 처리하기
    payment_list = TablePaymentList.query.filter(TablePaymentList.table_id == table_id).all()
    if payment_list:
        for p in payment_list:
            p.table_id = None
            db.session.commit()
    # 2.테이블 삭제
    item = Table.query.filter(Table.id == table_id).first()
    if not item:
        return False
    else:
        db.session.delete(item)
        db.session.commit()
        return True


# 테이블 그룹 설정
def set_table_group(table_list):
    for t in table_list:
        item = db.session.query(Table).filter(Table.id == t['table_id']).first()
        if not item:
            return jsonify({'message': 'Not found table id'}), 400
        
        item.is_group = t['group_id']
        item.group_color = t['group_color']
        db.session.commit()

    return jsonify({'message': 'User updated successfully'}), 200  


# 테이블 이름 수정
def update_table_name(table_id, name):
    table_item = db.session.query(Table)\
                        .filter(Table.id == table_id)\
                        .first()
    if not table_item:
        return jsonify({
            'code': 400,
            'msg': '테이블 ID를 찾을 수 없습니다.'
        }), 400
    table_item.name = name
    db.session.commit()
    return jsonify({
        'code' : 200,
        'msg': '테이블 이름이 업데이트되었습니다.'
    }), 200  


# 테이블 위치 수정
def update_table_position(table_id_fir, table_id_sec):
    fir_table_item = db.session.query(Table)\
                        .filter(Table.id == table_id_fir)\
                        .first()
    
    sec_table_item = db.session.query(Table)\
                        .filter(Table.id == table_id_sec)\
                        .first()
    if fir_table_item is None or sec_table_item is None:
        return jsonify({'message': 'Not found table id'}), 400
    
    fir_table_item.position = sec_table_item.position
    sec_table_item.position = fir_table_item.position
    db.session.commit()
    return jsonify({'message': 'Table position updated successfully'}), 200  


# 테이블 생성
def create_table(data):
    item = Table(name=data['name'], seat_count=data['seat_count'], is_group=0, table_category_id=data['table_category'], page=data['page'], position=data['position'])
    db.session.add(item)
    db.session.commit()
    db.session.refresh(item)
    return jsonify({'table_id': item.id, 'table_name': item.name}), 200

# 테이블 조회 - 테이블에 해당 테이블 카테고리가 있는지 조회
# 테이블 카테고리 삭제 시 테이블 이용 유무 확인하기 위함
def select_table_id(id):
    table_list = Table.query.filter(Table.table_category_id == id).all()
    cnt = 0
    for t in table_list:
        item = db.session.query(TableOrderList).filter(TableOrderList.table_id == t.id).first()
        if not item:
            continue
        else:
            cnt += 1
        if cnt > 0: # 이용 중인 테이블이 하나라도 있으면 False
            return False
    return True

# 테이블 사용유무 조회
def select_table_yn(id):
    table = Table.query.filter(Table.id == id).first()
    if table:
        item = TableOrderList.query.filter(TableOrderList.table_id == table.id).first()
        if item: # 테이블오더리스트에 있을 경우
            if item.checkingout_at is None: # 체킹아웃 시간 없으면 이용 중이므로 삭제 불가능
                return False
            else: # 체킹아웃 시간 있으면 이용완료이므로 삭제 가능
                return True
        else: # 테이블오더리스트에 없으면 삭제 가능
            return True
    else:  # table에 데이터가 없으므로 잘못된 접근: 삭제 불가능 -> False
        return jsonify({'msg': '없는 테이블입니다.', 'code': 400}), 200