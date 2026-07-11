# -*- coding: utf-8 -*-
"""
랜딩용 실제 조작 영상 녹화 (Playwright webm) → mp4 루프 변환(ffmpeg).

전제: 로컬 앱 기동 + seed_demo.py 실행 완료.
실행:
    scripts/capture/.venv/bin/python scripts/capture/capture_video.py

각 화면의 대표 조작을 녹화하여 app/static/videos/landing/*.mp4 로 저장.
랜딩에서 <video autoplay muted loop playsinline> 로 사용.
"""
import os
import json
import subprocess
from playwright.sync_api import sync_playwright

BASE = os.environ.get("CAPTURE_BASE", "http://localhost:5200")
HERE = os.path.dirname(__file__)
with open(os.path.join(HERE, "demo_ids.json")) as f:
    IDS = json.load(f)

RAW = "/tmp/og_video_raw"
OUT = os.path.abspath(os.path.join(HERE, "..", "..", "app", "static", "videos", "landing"))
os.makedirs(RAW, exist_ok=True)
os.makedirs(OUT, exist_ok=True)


def to_mp4(webm, name):
    mp4 = os.path.join(OUT, f"{name}.mp4")
    subprocess.run([
        "ffmpeg", "-y", "-i", webm,
        "-movflags", "+faststart", "-pix_fmt", "yuv420p", "-an",
        "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
        "-crf", "26", mp4,
    ], check=True, capture_output=True)
    print(f"[video] {name}.mp4 -> {mp4} ({os.path.getsize(mp4)//1024}KB)")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()

        def new_ctx(w, h, mobile=False, auth=False):
            ctx = browser.new_context(
                viewport={"width": w, "height": h},
                record_video_dir=RAW, record_video_size={"width": w, "height": h},
                is_mobile=mobile, has_touch=mobile,
                device_scale_factor=2 if not mobile else 3,
            )
            if auth:
                ctx.request.post(f"{BASE}/login", form={"store_id": IDS["store_id"], "password": IDS["store_pw"]})
            return ctx

        # ── 1. 모바일 QR 주문: 메뉴 담기 → 옵션 선택 → 장바구니 → 주문하기 ──
        def clip_mobile():
            ctx = new_ctx(390, 844, mobile=True)
            pg = ctx.new_page()
            pg.goto(f"{BASE}/table_order/t/{IDS['qr_tokens'][2]}", wait_until="networkidle", timeout=20000)
            pg.wait_for_timeout(1600)
            try:
                # 짜장면 탭 → 옵션 모달
                pg.click(".mo-menu-row:has-text('짜장면')", timeout=5000); pg.wait_for_timeout(1100)
                pg.click(".mo-option-item:has-text('곱빼기')", timeout=3000); pg.wait_for_timeout(700)
                pg.click(".mo-option-item:has-text('단무지')", timeout=3000); pg.wait_for_timeout(700)
                pg.click(".mo-btn-confirm", timeout=3000); pg.wait_for_timeout(1100)  # 장바구니 담기
                # 볶음밥 담기 (상세 모달 → 장바구니 담기)
                pg.click(".mo-menu-row:has-text('볶음밥')", timeout=3000); pg.wait_for_timeout(1200)
                pg.click(".mo-btn-confirm", timeout=3000); pg.wait_for_timeout(1100)
                # 장바구니 열기 → 주문하기
                pg.click("#moCartBar", timeout=3000); pg.wait_for_timeout(1400)
                pg.click(".mo-order-btn", timeout=3000); pg.wait_for_timeout(2800)
            except Exception as e:
                print("[video] mobile interaction skip:", e); pg.wait_for_timeout(1000)
            v = pg.video.path(); ctx.close()
            return v

        # ── 2. POS: 테이블 클릭 → 주문 상세 진입 ──
        def clip_pos():
            ctx = new_ctx(1024, 768, auth=True)
            pg = ctx.new_page()
            pg.goto(f"{BASE}/pos/tableList", wait_until="networkidle", timeout=20000)
            pg.wait_for_timeout(2200)
            try:
                pg.click("text=2번", timeout=4000)
                pg.wait_for_timeout(3000)
            except Exception as e:
                print("[video] pos interaction skip:", e); pg.wait_for_timeout(1500)
            v = pg.video.path(); ctx.close()
            return v

        # ── 3. KDS: 완료처리 클릭 ──
        def clip_kds():
            ctx = new_ctx(1024, 768, auth=True)
            pg = ctx.new_page()
            pg.goto(f"{BASE}/kds/station/{IDS['kds_station_id']}", wait_until="networkidle", timeout=20000)
            pg.wait_for_timeout(2200)
            try:
                pg.click("text=완료처리", timeout=4000)
                pg.wait_for_timeout(2500)
            except Exception as e:
                print("[video] kds interaction skip:", e); pg.wait_for_timeout(1500)
            v = pg.video.path(); ctx.close()
            return v

        # ── 4. POS 카드결제 → 진행중 → 결제완료 → 영수증 (실제 UI 함수 구동) ──
        def clip_pos_payment():
            ctx = new_ctx(1024, 768, auth=True)
            pg = ctx.new_page()
            tid = IDS['order_table_id']
            pg.goto(f"{BASE}/pos/payment/{tid}", wait_until="networkidle", timeout=20000)
            pg.wait_for_timeout(2600)  # 주문/결제 데이터 로드
            try:
                # 카드 결제 버튼 시각적 클릭(단말기 게이트로 실패해도 무시) → 진행중 모달 강제 표시
                try: pg.hover(".card_btn", timeout=1500)
                except Exception: pass
                pg.wait_for_timeout(500)
                pg.evaluate("() => { try{ if(window._closeCardPaymentModal) _closeCardPaymentModal(); }catch(e){}; "
                            "try{ _openCardPaymentModal('DEMO-APPROVAL', 0); }catch(e){} }")
                pg.wait_for_timeout(2600)  # '카드 결제 진행 중'
                pg.evaluate("() => { try{ _closeCardPaymentModal(); }catch(e){}; "
                            "try{ createCompletedPaymentModal({preventDefault(){}}, 'CARD', null); }catch(e){} }")
                pg.wait_for_timeout(2600)  # '결제 완료'
                pg.evaluate("() => { try{ openReceiptDetailModal('CARD'); }catch(e){} }")
                pg.wait_for_timeout(3400)  # 영수증 미리보기
            except Exception as e:
                print("[video] pos_payment skip:", e); pg.wait_for_timeout(1500)
            v = pg.video.path(); ctx.close()
            return v

        # ── 5. 관리자 메뉴 설정: 메뉴 목록 → 클릭 → 편집 폼(이미지·가격·옵션) ──
        def clip_admin():
            ctx = new_ctx(1440, 900, auth=True)
            pg = ctx.new_page()
            pg.goto(f"{BASE}/store/set_menu", wait_until="networkidle", timeout=20000)
            pg.wait_for_timeout(2600)
            try:
                sel = ".set_menu_product main article .article_bottom ul li[data-id]"
                pg.wait_for_selector(sel, timeout=6000)
                rows = pg.query_selector_all(sel)
                if rows:
                    rows[0].click(); pg.wait_for_timeout(2800)          # 첫 메뉴 편집 폼
                    if len(rows) > 3:
                        rows[3].click(); pg.wait_for_timeout(2800)      # 다른 메뉴 설정
                    elif len(rows) > 1:
                        rows[1].click(); pg.wait_for_timeout(2800)
                else:
                    pg.wait_for_timeout(1500)
            except Exception as e:
                print("[video] admin skip:", e); pg.wait_for_timeout(1500)
            v = pg.video.path(); ctx.close()
            return v

        # ── 6. 관리자 테이블 배치: 캔버스에서 테이블 카드 드래그(자유 배치) ──
        def clip_admin_table():
            ctx = new_ctx(1440, 900, auth=True)
            pg = ctx.new_page()
            pg.goto(f"{BASE}/store/set_table", wait_until="networkidle", timeout=20000)
            pg.wait_for_timeout(2600)
            try:
                pg.wait_for_selector("#table-canvas .table-card", timeout=6000)
                cards = pg.query_selector_all("#table-canvas .table-card")
                if cards:
                    box = cards[-1].bounding_box()  # 마지막(빈 위치 여유 큰) 카드 드래그
                    if box:
                        cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
                        pg.mouse.move(cx, cy); pg.wait_for_timeout(600)
                        pg.mouse.down(); pg.wait_for_timeout(400)
                        # 오른쪽/아래로 부드럽게 이동 후 스냅
                        for step in range(1, 11):
                            pg.mouse.move(cx + step * 14, cy + step * 6); pg.wait_for_timeout(45)
                        pg.wait_for_timeout(500)
                        pg.mouse.up(); pg.wait_for_timeout(1600)
                    # 한 카드 hover 로 마무리
                    b2 = cards[0].bounding_box()
                    if b2:
                        pg.mouse.move(b2["x"] + b2["width"] / 2, b2["y"] + b2["height"] / 2)
                        pg.wait_for_timeout(1400)
                else:
                    pg.wait_for_timeout(1500)
            except Exception as e:
                print("[video] admin_table skip:", e); pg.wait_for_timeout(1500)
            v = pg.video.path(); ctx.close()
            return v

        # ── 7. 매출·결제 내역 정산: 목록 → 결제 항목 클릭 → 상세 모달 ──
        def clip_payment_history():
            ctx = new_ctx(1440, 900, auth=True)
            pg = ctx.new_page()
            pg.goto(f"{BASE}/store/payment_history", wait_until="networkidle", timeout=20000)
            pg.wait_for_timeout(2800)  # 목록 로드
            try:
                pg.wait_for_selector(".payment_list li.table_row", timeout=6000)
                pg.wait_for_timeout(1400)  # 요약/목록 훑기
                rows = pg.query_selector_all(".payment_list li.table_row")
                if rows:
                    rows[0].click(); pg.wait_for_timeout(3200)   # 상세 모달
                    # 모달 닫고 다른 항목
                    try: pg.click("#payment-detail-modal .modal-close, #payment-detail-modal .close-btn", timeout=1500)
                    except Exception: pass
                    pg.wait_for_timeout(600)
                    if len(rows) > 2:
                        rows[2].click(); pg.wait_for_timeout(2600)
                else:
                    pg.wait_for_timeout(1500)
            except Exception as e:
                print("[video] payment_history skip:", e); pg.wait_for_timeout(1500)
            v = pg.video.path(); ctx.close()
            return v

        # ── 8. 실시간 주문 수신: POS 테이블목록 녹화 중 모바일에서 주문 → POS에 반영 ──
        def clip_realtime_order():
            pos_ctx = new_ctx(1024, 768, auth=True)
            pos = pos_ctx.new_page()
            pos.goto(f"{BASE}/pos/tableList", wait_until="networkidle", timeout=20000)
            pos.wait_for_timeout(3200)  # 소켓 연결 + 테이블 렌더
            try:
                # 트리거용 모바일 컨텍스트(빈 테이블 QR)에서 실제 주문 발생 → 소켓 emit
                mo_ctx = browser.new_context(viewport={"width": 390, "height": 844},
                                             is_mobile=True, has_touch=True, device_scale_factor=2)
                mo = mo_ctx.new_page()
                mo.goto(f"{BASE}/table_order/t/{IDS['realtime_qr']}", wait_until="networkidle", timeout=20000)
                mo.wait_for_timeout(1500)
                try:
                    mo.click(".mo-menu-row:has-text('탕수육')", timeout=5000); mo.wait_for_timeout(700)
                    # 필수옵션(소스) 선택 후 담기
                    try: mo.click(".mo-option-item:has-text('찍먹')", timeout=2000)
                    except Exception: pass
                    mo.wait_for_timeout(500)
                    mo.click(".mo-btn-confirm", timeout=3000); mo.wait_for_timeout(900)
                    mo.click("#moCartBar", timeout=3000); mo.wait_for_timeout(900)
                    mo.click(".mo-order-btn", timeout=3000)
                except Exception as e:
                    print("[video] realtime trigger skip:", e)
                # POS가 실시간 수신하는 순간 캡처
                pos.wait_for_timeout(2800)   # 테이블 카드가 조리중으로 전환 + 알림/토스트
                try: pos.evaluate("() => { try{ openNotificationSidebar(); }catch(e){} }")
                except Exception: pass
                pos.wait_for_timeout(3200)   # 알림 사이드바에 신규 주문 표시
                mo_ctx.close()
            except Exception as e:
                print("[video] realtime_order skip:", e); pos.wait_for_timeout(1500)
            v = pos.video.path(); pos_ctx.close()
            return v

        # ── 9. 직원 호출: POS 테이블목록 녹화 중 모바일에서 직원호출 → POS 알림 ──
        def clip_staff_call():
            pos_ctx = new_ctx(1024, 768, auth=True)
            pos = pos_ctx.new_page()
            pos.goto(f"{BASE}/pos/tableList", wait_until="networkidle", timeout=20000)
            pos.wait_for_timeout(3200)
            try:
                mo_ctx = browser.new_context(viewport={"width": 390, "height": 844},
                                             is_mobile=True, has_touch=True, device_scale_factor=2)
                mo = mo_ctx.new_page()
                mo.goto(f"{BASE}/table_order/t/{IDS['staffcall_qr']}", wait_until="networkidle", timeout=20000)
                mo.wait_for_timeout(1600)
                try:
                    mo.click("text=직원호출", timeout=4000); mo.wait_for_timeout(1000)
                    # 항목 하나 선택(물) 후 호출
                    try: mo.click(".mo-staff-item:has-text('물')", timeout=2500)
                    except Exception: pass
                    mo.wait_for_timeout(700)
                    mo.click(".mo-btn-confirm:has-text('호출하기')", timeout=3000)
                except Exception as e:
                    print("[video] staff trigger skip:", e)
                pos.wait_for_timeout(2600)   # POS 벨/토스트 등장
                try: pos.evaluate("() => { try{ openNotificationSidebar(); }catch(e){} }")
                except Exception: pass
                pos.wait_for_timeout(3200)   # 알림 사이드바에 직원호출 표시
                mo_ctx.close()
            except Exception as e:
                print("[video] staff_call skip:", e); pos.wait_for_timeout(1500)
            v = pos.video.path(); pos_ctx.close()
            return v

        for name, fn in [("mobile-order", clip_mobile), ("pos-tablelist", clip_pos),
                         ("kds", clip_kds), ("pos-payment", clip_pos_payment),
                         ("admin-menu", clip_admin), ("admin-table", clip_admin_table),
                         ("payment-history", clip_payment_history),
                         ("realtime-order", clip_realtime_order), ("staff-call", clip_staff_call)]:
            try:
                webm = fn()
                to_mp4(webm, name)
            except Exception as e:
                print(f"[video] FAIL {name}: {e}")

        browser.close()
    print("[video] 완료 →", OUT)


if __name__ == "__main__":
    main()
