import json
from flask import render_template, request, jsonify
from flask_login import login_required, current_user
from app.models.menu_category import get_main_and_sub_category_by_menu_id
from app.routes import payment_bp, require_login

require_login(payment_bp)

from app.models import db, Store
from app.models.store import create_store, update_store
from app.models.payment import create_payment_database
from app.models.menu import select_main_category, select_menu, select_sub_category, select_menu_option_all, find_all_menu
from app.login_manager import update_store_session

from datetime import datetime



@login_required
@payment_bp.route('/payment', methods=['GET', 'POST'])
def api_payment():
    # 받을 더미 데이터
    dummy = {
        'table_id': 1,
        'total_price': 22000,   # 추가됨!
        'first_order_time': '2023-10-18 17:11:08',   # 추가됨!
        'payment':  {
            'payment_history': {},  # 추가됨!
            'extra_charge': 0,  # 추가됨!
            'discount': 0,  # 할인된 금액
            'method': 1,    # 1-cash/2-card
            'price': 2000,
        },
        'order_list': [
            {
                "count" : 1,
                "name" : "짜장면",
                "price" : 7000,
                "option" : [
                {
                    "count" : 1,
                    "name" : "곱빼기",
                    "price" : 1000
                }
                ]
            },
            {
                "count" : 1,
                "name" : "탕수육",
                "price" : 24000,
                "option" : []
            }
        ]
    }

    # 분할결제중 전^^기^^ 나가고 결제클릭시 보내줄 데이터
    new_dummy = {
        'paid': True,   # 분할결제 이력 있는지-True/없는지-False
        'extra_charge': 0,  # 추가됨!
        'discount': 0,
        'payment': [    # paid False일 경우 빈 리스트
            {   
                'method': 1,    # 1-cash/2-card
                'price': 35000,
            }
        ]
    }

    result = create_payment_database(dummy)

    return result