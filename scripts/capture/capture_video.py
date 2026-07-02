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

        for name, fn in [("mobile-order", clip_mobile), ("pos-tablelist", clip_pos),
                         ("kds", clip_kds), ("pos-payment", clip_pos_payment),
                         ("admin-menu", clip_admin)]:
            try:
                webm = fn()
                to_mp4(webm, name)
            except Exception as e:
                print(f"[video] FAIL {name}: {e}")

        browser.close()
    print("[video] 완료 →", OUT)


if __name__ == "__main__":
    main()
