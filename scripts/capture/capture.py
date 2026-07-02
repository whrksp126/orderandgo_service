# -*- coding: utf-8 -*-
"""
랜딩용 실제 화면 자동 캡처 (Playwright).

전제: 로컬 앱(http://localhost:5200) 기동 + seed_demo.py 실행 완료.
실행:
    scripts/capture/.venv/bin/python scripts/capture/capture.py

서비스별 최적 뷰포트로 캡처하여 app/static/images/landing/ 에 저장.
기기 목업 프레임(폰/태블릿/모니터)은 랜딩 CSS에서 입힘 → 여기선 순수 화면만.
"""
import os
import json
from playwright.sync_api import sync_playwright

BASE = os.environ.get("CAPTURE_BASE", "http://localhost:5200")

# seed_demo.py 가 생성한 실제 ID 로드
IDS_FILE = os.path.join(os.path.dirname(__file__), "demo_ids.json")
with open(IDS_FILE) as f:
    IDS = json.load(f)
STORE_ID = IDS["store_id"]
STORE_PW = IDS["store_pw"]
KDS_STATION = str(IDS["kds_station_id"])
ORDER_TABLE = str(IDS["order_table_id"])
QR_TOKEN = IDS["qr_tokens"][1]  # 2번 테이블 QR (주문 있음)
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "app", "static", "images", "landing")
OUT = os.path.abspath(OUT)

# (name, path, width, height, wait_ms)
AUTH_SHOTS = [
    ("pos-tablelist",     "/pos/tableList",            1024, 768, 2500),
    ("pos-menulist",      f"/pos/menuList/{ORDER_TABLE}", 1024, 768, 2500),
    ("pos-payment",       f"/pos/payment/{ORDER_TABLE}",  1024, 768, 2500),
    ("kds",               f"/kds/station/{KDS_STATION}", 1024, 768, 2500),
    ("store-hub",         "/store/product",            1440, 900, 2000),
    ("store-menu-canvas", "/store/set_menu_position",  1440, 900, 2500),
    ("store-table-canvas","/store/set_table_position", 1440, 900, 2500),
    ("table-order-tablet","/table_order/login",        1024, 768, 2000),
]
# 모바일(비로그인 QR): (name, path, width, height, wait)
MOBILE_SHOTS = [
    ("mobile-order", f"/table_order/t/{QR_TOKEN}", 390, 844, 3000),
]


def main():
    os.makedirs(OUT, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()

        # ── 로그인 컨텍스트 (매장 세션) ──
        ctx = browser.new_context(viewport={"width": 1440, "height": 900},
                                  device_scale_factor=2)
        resp = ctx.request.post(f"{BASE}/login", form={"store_id": STORE_ID, "password": STORE_PW})
        print("[capture] login:", resp.status)
        page = ctx.new_page()
        for name, path, w, h, wait in AUTH_SHOTS:
            try:
                page.set_viewport_size({"width": w, "height": h})
                page.goto(f"{BASE}{path}", wait_until="networkidle", timeout=20000)
                page.wait_for_timeout(wait)
                out = os.path.join(OUT, f"{name}.png")
                page.screenshot(path=out)
                print(f"[capture] {name:20s} {w}x{h} -> {out}")
            except Exception as e:
                print(f"[capture] FAIL {name}: {e}")
        ctx.close()

        # ── 모바일 (QR 비로그인) ──
        for name, path, w, h, wait in MOBILE_SHOTS:
            mctx = browser.new_context(
                viewport={"width": w, "height": h},
                device_scale_factor=3, is_mobile=True, has_touch=True,
                user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                           "AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
            )
            mp = mctx.new_page()
            try:
                mp.goto(f"{BASE}{path}", wait_until="networkidle", timeout=20000)
                mp.wait_for_timeout(wait)
                out = os.path.join(OUT, f"{name}.png")
                mp.screenshot(path=out)
                print(f"[capture] {name:20s} {w}x{h} -> {out}")
            except Exception as e:
                print(f"[capture] FAIL {name}: {e}")
            mctx.close()

        browser.close()
    print("[capture] 완료 →", OUT)


if __name__ == "__main__":
    main()
