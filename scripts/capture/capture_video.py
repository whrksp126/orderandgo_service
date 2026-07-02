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

        # ── 1. 모바일 QR 주문: 메뉴 스크롤 + 카테고리 전환 ──
        def clip_mobile():
            ctx = new_ctx(390, 844, mobile=True)
            pg = ctx.new_page()
            pg.goto(f"{BASE}/table_order/t/{IDS['qr_tokens'][1]}", wait_until="networkidle", timeout=20000)
            pg.wait_for_timeout(1500)
            for _ in range(5):
                pg.mouse.wheel(0, 260); pg.wait_for_timeout(500)
            pg.wait_for_timeout(600)
            for _ in range(5):
                pg.mouse.wheel(0, -260); pg.wait_for_timeout(400)
            pg.wait_for_timeout(800)
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

        for name, fn in [("mobile-order", clip_mobile), ("pos-tablelist", clip_pos), ("kds", clip_kds)]:
            try:
                webm = fn()
                to_mp4(webm, name)
            except Exception as e:
                print(f"[video] FAIL {name}: {e}")

        browser.close()
    print("[video] 완료 →", OUT)


if __name__ == "__main__":
    main()
