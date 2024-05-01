from flask import Blueprint

main_bp = Blueprint('main', __name__)
auth_bp = Blueprint('auth', __name__)
pos_bp = Blueprint('pos', __name__, url_prefix='/pos')
adm_bp = Blueprint('adm', __name__, url_prefix='/adm')
order_bp = Blueprint('order', __name__, url_prefix='/order')
store_bp = Blueprint('store', __name__, url_prefix='/store')
payment_bp = Blueprint('payment', __name__, url_prefix='/payment')
table_order_bp = Blueprint('table_order', __name__, url_prefix='/table_order')
