from flask import render_template, Response, request, redirect
from app.routes import main_bp
from app.site_config import PUBLIC_PATHS, DISALLOW_PATHS
from flask_login import login_required


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
# 온보딩 진입 (Phase 5 구현 예정) — 임시로 로그인으로 리다이렉트
# ---------------------------------------------------------------------------
@main_bp.route('/start')
def start():
    # TODO(Phase5): Duolingo식 익명 온보딩 위저드로 교체
    return redirect('/login')


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
