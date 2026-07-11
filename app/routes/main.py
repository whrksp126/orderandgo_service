from flask import render_template, Response, request, redirect
from app.routes import main_bp
from app.site_config import PUBLIC_PATHS, DISALLOW_PATHS
from flask_login import login_required, current_user


# ---------------------------------------------------------------------------
# 공개 랜딩 (비로그인 접근 가능) — SEO 진입점
# ---------------------------------------------------------------------------
@main_bp.route('/')
def landing():
    return render_template('landing.html')


# ---------------------------------------------------------------------------
# 로그인 후 대시보드 (기존 index) — /dashboard 로 이동
# ---------------------------------------------------------------------------
@main_bp.route('/dashboard')
@login_required
def dashboard():
    return render_template('index.html')


# ---------------------------------------------------------------------------
# 온보딩 (Duolingo식 익명 위저드) — 가입은 마지막, 진행상황은 localStorage
# ---------------------------------------------------------------------------
@main_bp.route('/start')
def start():
    return render_template('onboarding.html')


# ---------------------------------------------------------------------------
# 가입 직후 설정 체크리스트 (로그인 후 하드 세팅 안내) — Duolingo식 후반부
# ---------------------------------------------------------------------------
@main_bp.route('/setup')
@login_required
def setup():
    from app.models import (db, Menu, Table, TableCategory, TerminalToken,
                            KdsStation, PrinterEnvironment)
    store = current_user
    menu_count = Menu.query.filter_by(store_id=store.id).count()
    table_count = db.session.query(Table).join(
        TableCategory, Table.table_category_id == TableCategory.id
    ).filter(TableCategory.store_id == store.id).count()
    terminal_connected = bool(
        TerminalToken.query.filter_by(store_id=store.id).first()
        or getattr(store, 'terminal_serial', None)
    )
    kds_ready = bool(KdsStation.query.filter_by(store_id=store.id).first())
    printer_ready = bool(PrinterEnvironment.query.filter_by(store_id=store.id).first())
    status = {
        'store_name': store.name,
        'menu_count': menu_count,
        'table_count': table_count,
        'terminal_connected': terminal_connected,
        'kds_ready': kds_ready,
        'printer_ready': printer_ready,
    }
    return render_template('setup.html', status=status)


# ---------------------------------------------------------------------------
# 법정 필수 페이지
# ---------------------------------------------------------------------------
@main_bp.route('/terms')
def terms():
    return render_template('terms.html')


@main_bp.route('/privacy')
def privacy():
    return render_template('privacy.html')


# ---------------------------------------------------------------------------
# SEO: robots.txt / sitemap.xml (도메인 동적 반영)
# ---------------------------------------------------------------------------
@main_bp.route('/robots.txt')
def robots_txt():
    root = request.url_root.rstrip('/')
    lines = ["User-agent: *"]
    lines += [f"Allow: {p}" for p in PUBLIC_PATHS]
    lines += [f"Disallow: {p}" for p in DISALLOW_PATHS]
    lines.append(f"Sitemap: {root}/sitemap.xml")
    return Response("\n".join(lines) + "\n", mimetype="text/plain")


@main_bp.route('/sitemap.xml')
def sitemap_xml():
    root = request.url_root.rstrip('/')
    urls = ["/", "/start", "/terms", "/privacy", "/login"]
    items = "".join(
        f"<url><loc>{root}{u}</loc><changefreq>weekly</changefreq></url>" for u in urls
    )
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        f'{items}</urlset>'
    )
    return Response(xml, mimetype="application/xml")


# PWA 매니페스트: scope "/" 로 전 화면(POS/KDS/테이블오더)이 홈 앱 안에서 전체화면 유지되게 함
@main_bp.route('/manifest.json')
def manifest_json():
    import json
    data = {
        "name": "오더앤고",
        "short_name": "오더앤고",
        "start_url": "/dashboard",
        "scope": "/",
        "display": "standalone",
        "orientation": "any",
        "background_color": "#ffffff",
        "theme_color": "#1FAA9C",
        "icons": [
            {"src": "/static/images/common/icon-192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "/static/images/common/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
            {"src": "/static/images/common/apple-touch-icon.png", "sizes": "180x180", "type": "image/png"},
        ],
    }
    return Response(json.dumps(data, ensure_ascii=False), mimetype="application/manifest+json")
