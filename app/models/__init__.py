import json
from app import db
from datetime import datetime

'''
class User(db.Model):
    __tablename__ = 'user'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True)
    email = db.Column(db.String(120), unique=True)
    password = db.Column(db.String(512), nullable=False)

    def __repr__(self):
        return f'<User {self.username}>'



class Post(db.Model):
    __tablename__ = 'post'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100))
    body = db.Column(db.Text)
    test = db.Column(db.Text)

    def __repr__(self):
        return f'<Post {self.title}>'
    
class Test(db.Model):
    __tablename__ = 'test'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100))
    body = db.Column(db.Text)
    test2 = db.Column(db.Text)

    def __repr__(self):
        return f'<Post {self.title}>'
'''

class User(db.Model):
    __tablename__ = 'user'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    tel = db.Column(db.String(50), nullable=False, unique=True)
    password = db.Column(db.String(120), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.now)
    last_logged_at = db.Column(db.DateTime, nullable=True)

    def is_authenticated(self):
        # 사용자가 인증된 경우 True 반환
        return True

    def is_active(self):
        return True

    def get_id(self):
        return self.id

    #def __repr__(self):
    #    return f'<User {self.title}>'


class Store(db.Model):
    __tablename__ = 'store'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    store_id = db.Column(db.String(50), unique=True)
    store_pw = db.Column(db.String(120), nullable=False)
    name = db.Column(db.String(50), unique=True)
    logo_img = db.Column(db.String(150), nullable=False)
    staff_call_grid_rows = db.Column(db.Integer, default=4)
    staff_call_grid_cols = db.Column(db.Integer, default=4)
    business_number = db.Column(db.String(50), nullable=True) # 사업자등록번호
    representative_name = db.Column(db.String(50), nullable=True) # 대표자명
    address = db.Column(db.String(255), nullable=True) # 매장 주소
    tel = db.Column(db.String(50), nullable=True) # 매장 전화번호
    receipt_header = db.Column(db.Text, nullable=True) # 영수증 머릿말
    receipt_footer = db.Column(db.Text, nullable=True) # 영수증 꼬릿말
    terminal_serial = db.Column(db.String(50), nullable=True) # 토스 프론트 단말기 시리얼 번호
    created_at = db.Column(db.DateTime, default=datetime.now)
    last_logged_at = db.Column(db.DateTime, nullable=True)

    def is_authenticated(self):
        # 사용자가 인증된 경우 True 반환
        return True

    def is_active(self):
        return True

    def get_id(self):
        return self.id
    
    #def __repr__(self):
    #    return f'<Store {self.title}>'


class TableCategory(db.Model):
    __tablename__ = 'table_category'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    store_id = db.Column(db.Integer, db.ForeignKey('store.id'))
    category_name = db.Column(db.String(50), nullable=True)
    position = db.Column(db.Integer, nullable=True)

    #def __repr__(self):
    #    return f'<TableCategory {self.title}>'


# class TableCategoryPage(db.Model):
#     __tablename__ ='table_category_page'
#     id = db.Column(db.Integer, primary_key=True, autoincrement=True)
#     table_category_id = db.Column(db.Integer, db.ForeignKey('table_category.id'))
#     page = db.Column(db.Integer, nullable=False)


class Table(db.Model):
    __tablename__ = 'table'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(150), nullable=True)
    seat_count = db.Column(db.Integer, nullable=True)
    
    # number = db.Column(db.Integer, nullable=True)
    # order = db.Column(db.Integer, nullable=True)
    
    is_group = db.Column(db.Integer, nullable=True)
    group_color = db.Column(db.String(50), nullable=True)
    table_category_id = db.Column(db.Integer, db.ForeignKey('table_category.id'))
    page = db.Column(db.Integer, nullable=True)
    position = db.Column(db.Integer, nullable=True)
    grid_x = db.Column(db.Integer, nullable=True)
    grid_y = db.Column(db.Integer, nullable=True)
    grid_w = db.Column(db.Integer, nullable=True)
    grid_h = db.Column(db.Integer, nullable=True)
    # category_page_id = db.Column(db.Integer, db.ForeignKey('table_category_page.id'))

    #def __repr__(self):
    #    return f'<Table {self.title}>'


class MainCategory(db.Model):
    __tablename__ = 'main_category'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    store_id = db.Column(db.Integer, db.ForeignKey('store.id'))
    name = db.Column(db.String(150), nullable=False)
    position = db.Column(db.Integer, nullable=False)

    #def __repr__(self):
    #    return f'<MainCategory {self.title}>'


class SubCategory(db.Model):
    __tablename__ = 'sub_category'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    main_category_id = db.Column(db.Integer, db.ForeignKey('main_category.id'))
    name = db.Column(db.String(150), nullable=False)
    position = db.Column(db.Integer, nullable=False)

    #def __repr__(self):
    #    return f'<SubCategory {self.title}>'


class MenuOptionGroup(db.Model):
    __tablename__ = 'menu_option_group'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    menu_id = db.Column(db.Integer, db.ForeignKey('menu.id'))
    name = db.Column(db.String(150), nullable=False)
    option_type = db.Column(db.String(50), nullable=False) # REQUIRED_SINGLE, OPTIONAL_SINGLE, MULTIPLE, QUANTITY
    position = db.Column(db.Integer, nullable=True)
    show_price = db.Column(db.Boolean, default=True)

class MenuOption(db.Model):
    __tablename__ = 'menu_option'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    group_id = db.Column(db.Integer, db.ForeignKey('menu_option_group.id'))
    name = db.Column(db.String(150), nullable=False)
    price = db.Column(db.Integer, nullable=False)
    description = db.Column(db.Text, nullable=True)
    page = db.Column(db.Integer, nullable=True)
    position = db.Column(db.Integer, nullable=True)

    #def __repr__(self):
    #    return f'<MenuOption {self.title}>'


class Menu(db.Model):
    __tablename__ = 'menu'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(150), nullable=False)
    price = db.Column(db.Integer, nullable=False)
    image = db.Column(db.Text, nullable=True)
    main_description = db.Column(db.Text, nullable=True)
    sub_description = db.Column(db.Text, nullable=True)
    is_soldout = db.Column(db.Boolean, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.now)
    page = db.Column(db.Integer, nullable=True)
    position = db.Column(db.Integer, nullable=True)
    store_id = db.Column(db.Integer, db.ForeignKey('store.id'))
    menu_category_id = db.Column(db.Integer, db.ForeignKey('sub_category.id'))
    #def __repr__(self):
    #    return f'<Menu {self.title}>'


# class MenuHasOption(db.Model):
#     __tablename__ = 'menu_has_option'
#     id = db.Column(db.Integer, primary_key=True, autoincrement=True)
#     menu_id = db.Column(db.Integer, db.ForeignKey('menu.id'))
#     option_id = db.Column(db.Integer, db.ForeignKey('menu_option.id'))


class OrderStatus(db.Model):
    __tablename__ = 'order_status'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    status = db.Column(db.String(150), nullable=False)

    #def __repr__(self):
    #    return f'<OrderStatus {self.title}>'


class Order(db.Model):
    __tablename__ = 'order'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    order_status_id = db.Column(db.Integer, db.ForeignKey('order_status.id'))
    menu_id = db.Column(db.Integer, db.ForeignKey('menu.id'))
    table_id = db.Column(db.Integer, db.ForeignKey('table.id'))
    order_list_id = db.Column(db.Integer, db.ForeignKey('table_order_list.id'))
    menu_options = db.Column(db.Text)
    ordered_at = db.Column(db.DateTime, default=datetime.now)
    is_pos = db.Column(db.Boolean, default=False)
    
    def set_menu_options(self, options_dict):
          # Python Dictionary를 JSON 형식으로 변환하여 저장
        self.menu_options = json.dumps(options_dict)

    def get_menu_options(self):
        # JSON 형식의 데이터를 Python Dictionary로 변환하여 반환
        return json.loads(self.menu_options) if self.menu_options else {}

    #def __repr__(self):
    #    return f'<Order {self.title}>'


# class OrderHasOption(db.Model):
#     __tablename__ = 'order_has_option'
#     id = db.Column(db.Integer, primary_key=True, autoincrement=True)
#     order_id = db.Column(db.Integer, db.ForeignKey('order.id'))
#     menu_option_id = db.Column(db.Integer, db.ForeignKey('menu_option.id'))


class TableOrderList(db.Model):
    __tablename__ = 'table_order_list'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    store_id = db.Column(db.Integer, db.ForeignKey('store.id'))
    table_id = db.Column(db.Integer, db.ForeignKey('table.id'))
    checkingin_at = db.Column(db.DateTime, nullable=False, default=datetime.now)
    checkingout_at = db.Column(db.DateTime, index=True, nullable=True)

    #def __repr__(self):
    #    return f'<TableOrderList {self.title}>'


class Payment_method(db.Model):
    __tablename__ = 'payment_method'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    method = db.Column(db.String(50), nullable=False)
    # 카드, 현금,

    #def __repr__(self):
    #    return f'<Payment_method {self.title}>'
    
class Payment_status(db.Model):
    __tablename__ = 'payment_status'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    status = db.Column(db.String(50), nullable=False)
    # 결제 완료, 결제 진행 중, 결제 취소


class Payment(db.Model):
    __tablename__ = 'payment'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    table_payment_list_id = db.Column(db.Integer, db.ForeignKey('table_payment_list.id'))
    payment_method_id = db.Column(db.Integer, db.ForeignKey('payment_method.id'))  # 결제 수단 컬럼
    payment_status = db.Column(db.Integer, db.ForeignKey('payment_status.id'))  # 결제 상태 컬럼
    payment_amount = db.Column(db.Integer, nullable=False)  # 결제 금액 컬럼 (실수형)
    payment_datetime = db.Column(db.DateTime, default=datetime.now)  # 결제 시간 컬럼

    
    # payment_amount = db.Column(db.Integer, nullable=False)
    # payment_datetime = db.Column(db.DateTime, default=datetime.now)
    # store_id = db.Column(db.Integer, db.ForeignKey('store.id'))
    # payment_method_id = db.Column(db.Integer, db.ForeignKey('payment_method.id'))
    # table_order_list_id = db.Column(db.Integer, db.ForeignKey('table_order_list.id'))

    #def __repr__(self):
    #    return f'<Payment {self.title}>'


class TablePaymentList(db.Model):
    __tablename__ = 'table_payment_list'
    __table_args__ = (db.UniqueConstraint('store_id', 'table_id', 'first_order_time'),)
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    store_id = db.Column(db.Integer, db.ForeignKey('store.id'))
    table_id = db.Column(db.Integer, db.ForeignKey('table.id'), nullable=True)
    # table_order_list_id = db.Column(db.Integer, db.ForeignKey('table_order_list.id'))
    first_order_time = db.Column(db.DateTime) # 첫 주문 시간
    order_details = db.Column(db.Text)  # 주문 내역 컬럼 (문자열로 저장됨), orderDetails.json
    discount = db.Column(db.Integer)        # 할인 금액
    extra_charge = db.Column(db.Integer)    # 추가 금액 # 추가됨
    payment_history = db.Column(db.String(512))    # 추가됨
    payment_time = db.Column(db.DateTime, default=datetime.now)  # 결제 시간 컬럼(분할 시 최근 결제 마다 업데이트)

    ### store_id/table_id/first_order_time을 unique key로 걸자!


class StaffCallItem(db.Model):
    __tablename__ = 'staff_call_item'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    store_id = db.Column(db.Integer, db.ForeignKey('store.id'))
    name = db.Column(db.String(150), nullable=False)
    image = db.Column(db.String(255), nullable=True)
    position = db.Column(db.Integer, default=0)
    use_quantity = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True)


class StaffCallLog(db.Model):
    __tablename__ = 'staff_call_log'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    table_id = db.Column(db.Integer, db.ForeignKey('table.id'))
    staff_call_item_id = db.Column(db.Integer, db.ForeignKey('staff_call_item.id'), nullable=True)
    quantity = db.Column(db.Integer, default=1)
    status = db.Column(db.String(50), default='REQUESTED') # REQUESTED, CONFIRMED
    called_at = db.Column(db.DateTime, default=datetime.now)
    confirmed_at = db.Column(db.DateTime, nullable=True)
    request_id = db.Column(db.String(36), nullable=True)


class TerminalToken(db.Model):
    __tablename__ = 'terminal_token'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    token = db.Column(db.String(36), unique=True, nullable=False, index=True)
    store_id = db.Column(db.Integer, db.ForeignKey('store.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.now)