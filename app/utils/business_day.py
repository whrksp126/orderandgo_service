"""영업일(business day) 계산 공용 헬퍼.

매장 설정 business_day_cutoff('HH:MM', 미설정 시 06:00)를 기준으로
'현재 영업일 시작 시각'을 반환한다. 예) cutoff=06:00 이고 현재가 새벽 3시면
전날 06:00이 영업일 시작(아직 전날 영업일).
"""
from datetime import datetime, timedelta


def business_day_start(cutoff_str, now=None):
    now = now or datetime.now()
    try:
        hh, mm = (int(x) for x in (cutoff_str or '06:00').split(':'))
    except (ValueError, AttributeError):
        hh, mm = 6, 0
    cutoff_today = now.replace(hour=hh, minute=mm, second=0, microsecond=0)
    return cutoff_today if now >= cutoff_today else cutoff_today - timedelta(days=1)
