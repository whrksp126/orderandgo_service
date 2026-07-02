# -*- coding: utf-8 -*-
"""
사이트/회사 공통 설정 — 푸터 법정정보, 약관/개인정보처리방침, SEO 기본값.

⚠️ 아래 COMPANY 값 중 "[사용자입력]" 항목은 사용자가 제공한 실제 사업자 정보로 교체해야 함.
    (전자상거래법·정보통신망법·개인정보보호법상 필수 표기)
템플릿에서는 context_processor 를 통해 `company`, `site` 로 접근한다.
"""

# ---------------------------------------------------------------------------
# 사업자 법정 필수정보 (푸터 · 약관 · 개인정보처리방침 공통 소스)
# ---------------------------------------------------------------------------
COMPANY = {
    "service_name": "오더앤고",              # 서비스명
    "service_name_en": "OrderAndGo",
    "company_name": "슬기로운 사업",
    "ceo_name": "조건호",
    "business_number": "315-27-01645",
    "mail_order_number": "제2025-부산진-1148호",
    "address": "부산광역시 부산진구 동천로 116, 3층 오픈오피스 12호(전포동, 한신빌딩 티움)",
    "tel": "010-2085-2374",
    "email": "ceo@ghmate.com",
    # 개인정보보호책임자
    "privacy_officer_name": "조건호",
    "privacy_officer_title": "대표",
    "privacy_officer_contact": "ceo@ghmate.com",
    # 약관/방침 시행일 (실제 공개일로 갱신)
    "terms_effective_date": "2026-07-02",
    "privacy_effective_date": "2026-07-02",
}

# ---------------------------------------------------------------------------
# SEO / 사이트 메타 기본값 (base.html 에서 페이지별 override 가능)
# ---------------------------------------------------------------------------
SITE = {
    "name": "오더앤고 | 요식업 포스·테이블오더·매장관리 올인원",
    "short_name": "오더앤고",
    "default_title": "오더앤고 — 소상공인 사장님을 위한 포스·QR주문·매장관리 올인원",
    "default_description": (
        "오더앤고는 포스(POS), 테이블오더 QR주문, 주방 KDS, 토스 단말기 카드결제, "
        "메뉴·테이블 매장관리까지 하나로 제공하는 요식업 올인원 솔루션입니다. "
        "지금 무료로 시작하세요."
    ),
    "keywords": (
        "포스기, POS, 테이블오더, QR주문, 매장관리, 주문관리, KDS, 주방디스플레이, "
        "토스 결제 단말기, 식당 포스, 카페 포스, 무인주문, 오더앤고, 소상공인 포스"
    ),
    "og_image": "/static/images/common/og-cover.png",   # 캡처 단계에서 생성
    "locale": "ko_KR",
    "twitter_card": "summary_large_image",
}

# ---------------------------------------------------------------------------
# Firebase 전화 인증 (웹 config — apiKey 는 클라이언트 노출값이라 비밀 아님)
# 콘솔: Authentication > Phone 사용, 승인된 도메인에 dev/stg/prod 도메인 등록 필요
# ---------------------------------------------------------------------------
FIREBASE = {
    "apiKey": "AIzaSyDSQrz00mHmXYwGHtalnpTCjTlIgIWntp0",
    "authDomain": "orderandgo-2b26f.firebaseapp.com",
    "projectId": "orderandgo-2b26f",
    "storageBucket": "orderandgo-2b26f.firebasestorage.app",
    "messagingSenderId": "908233506018",
    "appId": "1:908233506018:web:3e4ce28ba3c0d8d814f2bb",
}

# robots.txt 에서 크롤러에 허용할 공개 경로 (그 외 앱 화면은 Disallow)
PUBLIC_PATHS = ["/", "/start", "/login", "/terms", "/privacy"]
DISALLOW_PATHS = ["/pos", "/kds", "/store", "/adm", "/order", "/payment", "/table_order", "/dashboard"]
