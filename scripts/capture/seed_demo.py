# -*- coding: utf-8 -*-
"""
랜딩 캡처용 데모 매장 시드 스크립트 (현재 스키마 기준, 재실행 가능).

앱 컨테이너에서 실행:
    docker exec -i <app> python scripts/capture/seed_demo.py

데모 매장: store_id='demo' / pw='demo1234' / name='빨간중식'
메뉴 이미지는 기존 app/static/images/store_16/menu_* 를 재사용.
테이블 QR 토큰은 결정적(demoqr1..N)이라 캡처 스크립트가 그대로 사용.
"""
import bcrypt
import json
import os
from datetime import datetime, timedelta

from app import create_app, db
from app.models import (
    Store, MainCategory, SubCategory, Menu, MenuOptionGroup, MenuOption,
    TableCategory, Table, KdsStation, StaffCallItem, StaffCallLog, OrderStatus,
    TableOrderList, Order,
    Payment, Payment_method, Payment_status, TablePaymentList,
)

IDS_FILE = os.path.join(os.path.dirname(__file__), "demo_ids.json")

STORE_ID = "order"
STORE_PW = "order1234"
STORE_NAME = "빨간중식"
IMG_BASE = "/static/images/store_16"


def imgs(menu_dir, dish, n=4):
    return ", ".join(f"{IMG_BASE}/{menu_dir}/{dish}_{i}.png" for i in range(1, n + 1))


def teardown(store):
    """데모 매장의 모든 종속 데이터 제거 (재실행용)."""
    sid = store.id
    menu_ids = [m.id for m in Menu.query.filter_by(store_id=sid).all()]
    table_ids = [t.id for t in Table.query.join(
        TableCategory, Table.table_category_id == TableCategory.id
    ).filter(TableCategory.store_id == sid).all()]

    if menu_ids:
        grp_ids = [g.id for g in MenuOptionGroup.query.filter(MenuOptionGroup.menu_id.in_(menu_ids)).all()]
        if grp_ids:
            MenuOption.query.filter(MenuOption.group_id.in_(grp_ids)).delete(synchronize_session=False)
            MenuOptionGroup.query.filter(MenuOptionGroup.id.in_(grp_ids)).delete(synchronize_session=False)
        Order.query.filter(Order.menu_id.in_(menu_ids)).delete(synchronize_session=False)
    # 결제 내역(TablePaymentList/Payment) 정리 (재실행용)
    pay_list_ids = [p.id for p in TablePaymentList.query.filter_by(store_id=sid).all()]
    if pay_list_ids:
        Payment.query.filter(Payment.table_payment_list_id.in_(pay_list_ids)).delete(synchronize_session=False)
    TablePaymentList.query.filter_by(store_id=sid).delete(synchronize_session=False)
    TableOrderList.query.filter_by(store_id=sid).delete(synchronize_session=False)
    if table_ids:
        Order.query.filter(Order.table_id.in_(table_ids)).delete(synchronize_session=False)
        # 직원 호출 로그(FK: table_id) 정리 후 테이블 삭제
        StaffCallLog.query.filter(StaffCallLog.table_id.in_(table_ids)).delete(synchronize_session=False)
        Table.query.filter(Table.id.in_(table_ids)).delete(synchronize_session=False)
    Menu.query.filter_by(store_id=sid).delete(synchronize_session=False)
    sub_ids = [s.id for s in SubCategory.query.join(
        MainCategory, SubCategory.main_category_id == MainCategory.id
    ).filter(MainCategory.store_id == sid).all()]
    if sub_ids:
        SubCategory.query.filter(SubCategory.id.in_(sub_ids)).delete(synchronize_session=False)
    MainCategory.query.filter_by(store_id=sid).delete(synchronize_session=False)
    TableCategory.query.filter_by(store_id=sid).delete(synchronize_session=False)
    KdsStation.query.filter_by(store_id=sid).delete(synchronize_session=False)
    StaffCallItem.query.filter_by(store_id=sid).delete(synchronize_session=False)
    db.session.commit()


def ensure_order_status():
    """order_status 1/2 보장 (1=조리중, 2=조리완료)."""
    wanted = {1: "조리중", 2: "조리완료", 3: "취소"}
    for i, name in wanted.items():
        if not OrderStatus.query.get(i):
            db.session.add(OrderStatus(id=i, status=name))
    db.session.commit()


def ensure_payment_meta():
    """payment_method(1=카드,2=현금) / payment_status(1=완료,2=취소,3=진행중) 보장."""
    for i, name in {1: "카드", 2: "현금"}.items():
        if not Payment_method.query.get(i):
            db.session.add(Payment_method(id=i, method=name))
    for i, name in {1: "결제 완료", 2: "결제 취소", 3: "결제 진행 중"}.items():
        if not Payment_status.query.get(i):
            db.session.add(Payment_status(id=i, status=name))
    db.session.commit()


def run():
    app = create_app()
    with app.app_context():
        existing = Store.query.filter_by(store_id=STORE_ID).first()
        if existing:
            print(f"[seed] 기존 데모 매장(id={existing.id}) 정리 후 재생성")
            teardown(existing)
            store = existing
            store.name = STORE_NAME
            store.store_pw = bcrypt.hashpw(STORE_PW.encode(), bcrypt.gensalt()).decode()
        else:
            store = Store(
                store_id=STORE_ID,
                store_pw=bcrypt.hashpw(STORE_PW.encode(), bcrypt.gensalt()).decode(),
                name=STORE_NAME,
                logo_img="/static/images/common/logo.png",
            )
            db.session.add(store)
        store.business_number = "315-27-01645"
        store.representative_name = "조건호"
        store.address = "부산광역시 부산진구 동천로 116"
        store.tel = "051-000-0000"
        store.qr_geofence_enabled = False  # 캡처 편의: 위치검증 off
        db.session.commit()
        sid = store.id
        print(f"[seed] store id={sid} store_id={STORE_ID}")

        # ── 카테고리 ──
        mc_meal = MainCategory(store_id=sid, name="식사 메뉴", position=1)
        mc_liquor = MainCategory(store_id=sid, name="주류", position=2)
        mc_drink = MainCategory(store_id=sid, name="음료", position=3)
        db.session.add_all([mc_meal, mc_liquor, mc_drink]); db.session.commit()

        sc_noodle = SubCategory(main_category_id=mc_meal.id, name="면류", position=1)
        sc_rice = SubCategory(main_category_id=mc_meal.id, name="밥류", position=2)
        sc_fry = SubCategory(main_category_id=mc_meal.id, name="튀김류", position=3)
        sc_soju = SubCategory(main_category_id=mc_liquor.id, name="주류", position=1)
        sc_soda = SubCategory(main_category_id=mc_drink.id, name="음료", position=1)
        db.session.add_all([sc_noodle, sc_rice, sc_fry, sc_soju, sc_soda]); db.session.commit()

        # ── 메뉴 (page/position 으로 그리드 배치) ──
        # 이미지 경로 규칙: /static/images/store_16/{폴더}/{메뉴명}_{1..4}.png (각 4장)
        menus = [
            # 면류
            ("짜장면", 8000, imgs("menu_50", "짜장면"), "춘장을 충분히 볶아 진하게 낸 기본 짜장면입니다.", sc_noodle.id, 1),
            ("짬뽕", 11000, imgs("menu_51", "짬뽕"), "여러 해산물을 넣어 얼큰하게 끓인 해물 짬뽕입니다.", sc_noodle.id, 2),
            ("간짜장", 8500, imgs("menu_60", "간짜장"), "면과 짜장을 따로 볶아 불맛을 살린 간짜장입니다.", sc_noodle.id, 3),
            ("울면", 9500, imgs("menu_61", "울면"), "부드러운 녹말 국물에 해산물과 계란을 푼 울면입니다.", sc_noodle.id, 4),
            # 밥류
            ("볶음밥", 9000, imgs("menu_52", "볶음밥"), "계란과 채소를 넣고 센 불에 볶아낸 볶음밥입니다.", sc_rice.id, 5),
            ("잡채밥", 10000, imgs("menu_62", "잡채밥"), "당면 잡채를 밥과 함께 낸 든든한 한 그릇입니다.", sc_rice.id, 6),
            ("마파두부덮밥", 9500, imgs("menu_63", "마파두부덮밥"), "얼얼한 마파 소스와 두부를 밥 위에 올린 덮밥입니다.", sc_rice.id, 7),
            # 튀김류
            ("탕수육", 12000, imgs("menu_55", "탕수육"), "새콤달콤한 소스를 곁들여 바삭하게 튀겨낸 탕수육입니다.", sc_fry.id, 8),
            ("깐풍기", 22000, imgs("menu_64", "깐풍기"), "매콤달콤 깐풍 소스에 버무린 바삭한 닭튀김입니다.", sc_fry.id, 9),
            ("유린기", 22000, imgs("menu_65", "유린기"), "채 썬 채소와 새콤한 간장소스를 올린 닭튀김입니다.", sc_fry.id, 10),
            ("군만두", 7000, imgs("menu_66", "군만두"), "겉은 바삭하고 속은 촉촉하게 구워낸 군만두입니다.", sc_fry.id, 11),
            # 주류 (4종) — 신규 음료는 이미지 1장(n=1)
            ("소주", 5000, imgs("menu_56", "소주"), "", sc_soju.id, 12),
            ("맥주", 5000, imgs("menu_67", "맥주", 1), "", sc_soju.id, 13),
            ("고량주", 12000, imgs("menu_68", "고량주", 1), "", sc_soju.id, 14),
            ("하이볼", 7000, imgs("menu_69", "하이볼", 1), "", sc_soju.id, 15),
            # 음료 (4종)
            ("코카콜라", 2000, imgs("menu_57", "코카콜라"), "", sc_soda.id, 16),
            ("사이다", 2000, imgs("menu_70", "사이다", 1), "", sc_soda.id, 17),
            ("환타", 2000, imgs("menu_71", "환타", 1), "", sc_soda.id, 18),
            ("옥수수수염차", 2000, imgs("menu_72", "옥수수수염차", 1), "", sc_soda.id, 19),
        ]
        menu_objs = {}
        for name, price, image, desc, subid, pos in menus:
            m = Menu(name=name, price=price, image=image, main_description=desc,
                     is_soldout=False, store_id=sid, menu_category_id=subid, page=1, position=pos)
            db.session.add(m); menu_objs[name] = m
        db.session.commit()

        # ── 옵션 그룹 ──
        g1 = MenuOptionGroup(menu_id=menu_objs["짜장면"].id, name="양 선택", option_type="OPTIONAL_SINGLE", position=1, show_price=True)
        g2 = MenuOptionGroup(menu_id=menu_objs["짜장면"].id, name="추가 반찬", option_type="MULTIPLE", position=2, show_price=False)
        g3 = MenuOptionGroup(menu_id=menu_objs["탕수육"].id, name="소스", option_type="REQUIRED_SINGLE", position=1, show_price=False)
        db.session.add_all([g1, g2, g3]); db.session.commit()
        db.session.add_all([
            MenuOption(group_id=g1.id, name="곱빼기", price=1500, position=1),
            MenuOption(group_id=g2.id, name="단무지 추가", price=0, position=1),
            MenuOption(group_id=g2.id, name="양파 추가", price=0, position=2),
            MenuOption(group_id=g3.id, name="부먹", price=0, position=1),
            MenuOption(group_id=g3.id, name="찍먹", price=0, position=2),
        ]); db.session.commit()

        # ── 테이블 ──
        tcat = TableCategory(store_id=sid, category_name="1층 홀", position=1)
        db.session.add(tcat); db.session.commit()
        tables = []
        # 12 테이블: 4열 × 3행, 각 카드 3×3 (제목+주문내역이 잘리지 않는 크기)
        coords = [(gx, gy) for gy in (0, 4, 8) for gx in (0, 5, 10, 15)]
        for i, (gx, gy) in enumerate(coords, start=1):
            t = Table(name=f"{i}번", seat_count=4 if i % 2 else 2, is_group=0,
                      table_category_id=tcat.id, position=i,
                      grid_x=gx, grid_y=gy, grid_w=3, grid_h=3,
                      qr_token=f"demoqr{i}", qr_generated_at=datetime.now())
            db.session.add(t); tables.append(t)
        db.session.commit()

        # ── KDS 스테이션 / 직원호출 항목 ──
        kds = KdsStation(store_id=sid, name="주방", show_all=True, position=1)
        db.session.add(kds)
        for pos, nm in enumerate(["물", "냅킨", "젓가락", "직원호출"], start=1):
            db.session.add(StaffCallItem(store_id=sid, name=nm, position=pos,
                                         use_quantity=(nm in ("물", "냅킨")), is_active=True))
        db.session.commit()

        # ── 활성 주문 (POS/ODS 생동감) : 다양한 상태를 한 화면에 ──
        # 조리중(status=1): 2·6번 / 조리완료(status=2): 4·10번 / 나머지(3·5·7·8·9·11·12번)는 빈 테이블
        # → 8번(demoqr8)은 realtime-order 클립의 신규 주문용, 3번(demoqr3)은 staff-call/mobile 클립용으로 비워둠
        ensure_order_status()
        now = datetime.now()
        # (테이블, 주문항목, 조리상태)
        active = [
            (tables[1], [("짜장면", 2), ("탕수육", 1)], 1),                  # 2번 조리중
            (tables[5], [("짬뽕", 1), ("볶음밥", 1), ("코카콜라", 2)], 1),   # 6번 조리중
            (tables[3], [("간짜장", 1), ("군만두", 1)], 2),                  # 4번 조리완료
            (tables[9], [("유린기", 1), ("깐풍기", 1), ("맥주", 2)], 2),     # 10번 조리완료
        ]
        for t, items, status in active:
            tol = TableOrderList(store_id=sid, table_id=t.id, checkingin_at=now - timedelta(minutes=9))
            db.session.add(tol); db.session.commit()
            for nm, qty in items:
                for _ in range(qty):
                    o = Order(order_status_id=status, menu_id=menu_objs[nm].id, table_id=t.id,
                              order_list_id=tol.id, menu_options="{}", is_pos=False,
                              ordered_at=now - timedelta(minutes=8))
                    db.session.add(o)
        db.session.commit()

        # ── 결제 완료 내역 (매출·정산 클립용) : 오늘 영업일 기준 여러 건 ──
        ensure_payment_meta()

        def _od(items):
            """order_details 문자열(list repr) 생성 + 총액 반환."""
            rows = []
            total = 0
            for nm, qty in items:
                m = menu_objs[nm]
                rows.append({"name": nm, "price": m.price, "count": qty, "options": []})
                total += m.price * qty
            return str(rows), total

        _ph = {"isDirect": False, "direct": 0, "isDutch": False,
               "totalDutch": 0, "curDutch": 1, "dutchPrice": 0}
        # (테이블번호1based, 주문항목, 결제수단id(1카드/2현금), 상태(1완료/2취소), 몇분전)
        pays = [
            (1,  [("탕수육", 1), ("짜장면", 2), ("소주", 1)], 1, 1, 25),
            (5,  [("짬뽕", 2), ("군만두", 1)], 2, 1, 52),
            (7,  [("마파두부덮밥", 1), ("코카콜라", 1)], 1, 1, 95),
            (11, [("깐풍기", 1), ("고량주", 1), ("맥주", 2)], 1, 1, 140),
            (9,  [("잡채밥", 1), ("사이다", 2)], 1, 2, 175),  # 결제 취소 건
        ]
        for tnum, items, method_id, pstatus, mins_ago in pays:
            t = tables[tnum - 1]
            details, total = _od(items)
            ptime = now - timedelta(minutes=mins_ago)
            tpl = TablePaymentList(
                store_id=sid, table_id=t.id, table_name=t.name,
                first_order_time=ptime - timedelta(minutes=30),
                order_details=details, discount=0, extra_charge=0,
                payment_history=json.dumps(_ph, ensure_ascii=False), payment_time=ptime,
            )
            db.session.add(tpl); db.session.commit()
            db.session.add(Payment(
                table_payment_list_id=tpl.id, payment_method_id=method_id,
                payment_status=pstatus, payment_amount=total, payment_datetime=ptime,
                payment_info=None,
            ))
        db.session.commit()

        # ── 캡처 스크립트용 ID 덤프 ──
        ids = {
            "store_pk": sid,
            "store_id": STORE_ID,
            "store_pw": STORE_PW,
            "kds_station_id": kds.id,
            "order_table_id": tables[1].id,   # 2번 (조리중 주문 있음 → 결제 클립용)
            "order_table_id2": tables[5].id,  # 6번 (조리중 주문 있음)
            "realtime_qr": tables[7].qr_token,   # 8번 (빈 테이블 → realtime-order 신규 주문용)
            "staffcall_qr": tables[2].qr_token,  # 3번 (빈 테이블 → staff-call 트리거용)
            "qr_tokens": [t.qr_token for t in tables],
        }
        with open(IDS_FILE, "w") as f:
            json.dump(ids, f, ensure_ascii=False, indent=2)

        print("[seed] 완료")
        print(f"[seed] 로그인: store_id={STORE_ID} / pw={STORE_PW}")
        print(f"[seed] kds_station_id={kds.id}, order_table_id={tables[1].id}")
        print(f"[seed] ids -> {IDS_FILE}")


if __name__ == "__main__":
    run()
