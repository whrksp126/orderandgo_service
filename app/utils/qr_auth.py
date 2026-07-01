"""QR 셀프 주문용 손님 익명 세션 유틸.

Flask-Login(매장/관리자 세션)과 완전히 분리된 별도의 서명 쿠키로
손님(익명)의 store_id/table_id 컨텍스트를 안전하게 전달한다.

- 토큰 자체는 추측 불가(secrets) → 열거 방지
- 쿠키는 itsdangerous 서명 → 위변조 방지 + 만료(TTL)
- 주문 수락 시 지오펜스(GPS) + (옵션)세션 게이트로 가짜 주문 방지
"""

import math
from functools import wraps

from flask import current_app, request, g, jsonify
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

QR_COOKIE_NAME = 'qr_session'
QR_COOKIE_SALT = 'qr-customer-session'
QR_COOKIE_MAX_AGE = 60 * 60 * 12  # 12시간


def _serializer():
    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'], salt=QR_COOKIE_SALT)


def issue_qr_session(store_id, table_id, qr_token):
    """서명된 손님 세션 문자열 발급."""
    return _serializer().dumps({
        'store_id': int(store_id),
        'table_id': int(table_id),
        'qr_token': qr_token,
    })


def load_qr_session():
    """요청 쿠키에서 손님 세션 payload를 복원. 없거나 위조/만료면 None."""
    raw = request.cookies.get(QR_COOKIE_NAME)
    if not raw:
        return None
    try:
        return _serializer().loads(raw, max_age=QR_COOKIE_MAX_AGE)
    except (BadSignature, SignatureExpired):
        return None


def set_qr_session_cookie(response, payload):
    """응답에 손님 세션 쿠키를 심는다."""
    secure = not current_app.debug  # prod(https)에서는 secure 쿠키
    response.set_cookie(
        QR_COOKIE_NAME,
        payload,
        max_age=QR_COOKIE_MAX_AGE,
        httponly=True,
        samesite='Lax',
        secure=secure,
    )
    return response


def clear_qr_session_cookie(response):
    response.delete_cookie(QR_COOKIE_NAME)
    return response


def qr_customer_required(f):
    """손님 세션 쿠키를 검증하고 g.qr_store_id / g.qr_table_id / g.qr_token 주입.

    토큰이 현재도 유효한 테이블에 매핑되는지 DB로 재확인한다(재발급/삭제 대응).
    실패 시 401 JSON.
    """
    @wraps(f)
    def wrapper(*args, **kwargs):
        sess = load_qr_session()
        if not sess:
            return jsonify({'error': 'QR 세션이 없습니다. QR을 다시 스캔해 주세요.', 'code': 401}), 401

        # 토큰 재검증: 토큰 → (table, store_id)가 세션과 일치해야 함
        from app.models.table import get_table_by_qr_token
        table, store_id = get_table_by_qr_token(sess.get('qr_token'))
        if not table or store_id is None:
            return jsonify({'error': '만료되었거나 유효하지 않은 QR입니다.', 'code': 401}), 401
        if int(store_id) != int(sess.get('store_id')) or int(table.id) != int(sess.get('table_id')):
            return jsonify({'error': 'QR 정보가 변경되었습니다. 다시 스캔해 주세요.', 'code': 401}), 401

        g.qr_store_id = int(store_id)
        g.qr_table_id = int(table.id)
        g.qr_token = sess.get('qr_token')
        return f(*args, **kwargs)
    return wrapper


def resolve_customer_context():
    """소켓 핸들러 등 데코레이터를 못 쓰는 곳에서 손님 컨텍스트를 반환.

    반환: (store_id, table_id) 또는 (None, None)
    """
    sess = load_qr_session()
    if not sess:
        return None, None
    from app.models.table import get_table_by_qr_token
    table, store_id = get_table_by_qr_token(sess.get('qr_token'))
    if not table or store_id is None:
        return None, None
    if int(store_id) != int(sess.get('store_id')) or int(table.id) != int(sess.get('table_id')):
        return None, None
    return int(store_id), int(table.id)


# ── 지오펜스(GPS) ─────────────────────────────────────────────────────────────

def _haversine_m(lat1, lon1, lat2, lon2):
    """두 좌표 간 거리(m)."""
    R = 6371000.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def check_geofence(store, lat, lng):
    """지오펜스 검증 결과 반환.

    반환: (ok: bool, reason: str)
    - 매장이 지오펜스 비활성이거나 좌표 미설정이면 통과(ok=True, 'skipped')
    - 손님 좌표가 없으면 실패(ok=False, 'no_location')
    - 반경 내면 통과, 밖이면 실패
    """
    if not store or not getattr(store, 'qr_geofence_enabled', True):
        return True, 'disabled'
    if store.latitude is None or store.longitude is None:
        return True, 'store_no_coords'
    if lat is None or lng is None:
        return False, 'no_location'
    try:
        dist = _haversine_m(float(store.latitude), float(store.longitude), float(lat), float(lng))
    except (TypeError, ValueError):
        return False, 'invalid_location'
    radius = store.geofence_radius_m or 200
    if dist <= radius:
        return True, 'within'
    return False, 'out_of_range'
