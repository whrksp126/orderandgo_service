"""멀티테넌트 소유권 확인 헬퍼.

모델 헬퍼(select_*/update_*/delete_*)는 id로만 조회하므로, 클라이언트가 보낸 id를 쓰는 라우트는
반드시 여기 함수로 '로그인 매장(current_user.id) 소유'인지 확인한 뒤 처리한다.
모든 함수는 대상이 없거나 id가 잘못되면 False를 반환한다.
"""
from flask import jsonify
from flask_login import current_user

from app.models import (
    db, Menu, MenuOption, MenuOptionGroup, MainCategory, SubCategory,
    TableCategory, Table, Order, TableOrderList, StaffCallItem, StaffCallLog,
)


def forbidden():
    return jsonify({'code': 403, 'msg': '접근 권한이 없습니다.'}), 403


def _get(model, obj_id):
    try:
        return db.session.get(model, int(obj_id))
    except (TypeError, ValueError):
        return None


def owns_store(store_id):
    try:
        return (store_id is not None and current_user.is_authenticated
                and int(store_id) == int(current_user.id))
    except (TypeError, ValueError):
        return False


def owns_table(table_id):
    t = _get(Table, table_id)
    tc = _get(TableCategory, t.table_category_id) if t else None
    return bool(tc) and owns_store(tc.store_id)


def owns_table_category(table_category_id):
    tc = _get(TableCategory, table_category_id)
    return bool(tc) and owns_store(tc.store_id)


def owns_menu(menu_id):
    m = _get(Menu, menu_id)
    return bool(m) and owns_store(m.store_id)


def owns_main_category(main_category_id):
    mc = _get(MainCategory, main_category_id)
    return bool(mc) and owns_store(mc.store_id)


def owns_sub_category(sub_category_id):
    sc = _get(SubCategory, sub_category_id)
    return bool(sc) and owns_main_category(sc.main_category_id)


def owns_menu_option(option_id):
    o = _get(MenuOption, option_id)
    g = _get(MenuOptionGroup, o.group_id) if o else None
    return bool(g) and owns_menu(g.menu_id)


def owns_order(order_id):
    o = _get(Order, order_id)
    tol = _get(TableOrderList, o.order_list_id) if o else None
    return bool(tol) and owns_store(tol.store_id)


def owns_staff_call_item(item_id):
    it = _get(StaffCallItem, item_id)
    return bool(it) and owns_store(it.store_id)


def owns_staff_call_log(log_id):
    lg = _get(StaffCallLog, log_id)
    return bool(lg) and owns_table(lg.table_id)
