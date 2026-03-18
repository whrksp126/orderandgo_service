# CLAUDE.md — orderandgo_service

레스토랑 주문 관리 시스템. 고객 주문, POS, 어드민, 결제, 실시간 통신을 포함한 멀티테넌트 SaaS.

## 프로젝트 구조

```
orderandgo_service/
├── app/
│   ├── __init__.py       # Flask app factory, socketio/db 초기화
│   ├── models/           # SQLAlchemy 모델
│   └── routes/           # Blueprint별 라우트
│       ├── auth.py       # 인증
│       ├── pos.py        # POS 시스템 (/pos)
│       ├── adm.py        # 어드민 (/adm)
│       ├── order.py      # 주문 관리 (/order)
│       ├── store.py      # 매장/메뉴 CRUD (/store)
│       ├── payment.py    # 결제 (/payment)
│       └── table_order.py  # 테이블 주문 (/table_order)
├── migrations/           # Alembic 마이그레이션
├── nginx-proxy/          # 서버용 글로벌 nginx conf (배포 전용)
│   └── conf.d/orderandgo.conf
├── db/backups/           # DB 백업 (git 제외)
├── app.py                # 엔트리포인트
├── Dockerfile
├── requirements.txt
├── docker-compose.local.yml  # 로컬 개발 (hot reload)
├── docker-compose.dev.yml    # Dev 서버
├── docker-compose.stg.yml    # Staging 서버
├── docker-compose.yml        # Production 서버
├── deploy.sh             # 배포 자동화
└── SETUP.md              # 서버 초기 세팅 가이드
```

## 기술 스택

| 항목 | 기술 |
|------|------|
| 언어 | Python 3.x |
| 프레임워크 | Flask 2.3.2 |
| ORM | SQLAlchemy 2.0.45 + Flask-SQLAlchemy |
| DB | MySQL (`orderandgo` 데이터베이스) |
| WebSocket | Flask-SocketIO 5.6.0 + eventlet 0.40.4 |
| 인증 | Flask-Login 0.6.2 + bcrypt |
| DB 마이그레이션 | Flask-Migrate 4.0.4 (Alembic) |
| CORS | flask-cors 6.0.2 |
| 설정 | python-dotenv |

## 로컬 실행

```bash
docker compose -f docker-compose.local.yml up --build -d
docker compose -f docker-compose.local.yml logs -f
docker compose -f docker-compose.local.yml down
```

## 서버 배포

```bash
./deploy.sh dev    # dev 배포 (서버에서 git pull → build & up)
./deploy.sh stg    # stg 배포 (서버에서 git pull → build & up)
./deploy.sh prod   # prod 배포 (서버에서 git pull → build & up)
```

> Docker Hub 불필요. 서버에서 직접 빌드.

## 환경별 도메인

| 환경 | 도메인 |
|------|--------|
| local | http://{내부IP}:5001 |
| dev  | https://dev-order.ghmate.com |
| stg  | https://stg-order.ghmate.com |
| prod | https://order.ghmate.com |

## Git

- 레포: `github.com/whrksp126/orderandgo_service`
- 브랜치: `develop` (작업 브랜치), `main` (배포 브랜치)

## DB 모델 (주요)

- `User` - 관리자 계정
- `Store` - 매장 (멀티테넌트 단위)
  - `terminal_serial` - 토스 단말기 시리얼 번호 (단말기 로그인 시 자동 저장)
  - `toss_merchant_id` - 토스 가맹점 ID (Integer, 관리자 페이지에서 입력)
  - `toss_business_number` - 사업자등록번호 (관리자 페이지에서 입력)
- `Table`, `TableCategory` - 테이블 관리
- `MainCategory` → `SubCategory` → `Menu` - 메뉴 계층
- `MenuOptionGroup`, `MenuOption` - 메뉴 옵션
- `Order`, `TableOrderList` - 주문
- `Payment`, `Payment_method`, `Payment_status`, `TablePaymentList` - 결제
- `StaffCallItem`, `StaffCallLog` - 직원 호출
- `TerminalToken` - 토스 단말기 인증 토큰 (store_id, token, created_at)

## 매장 관리 페이지 (/store/product)

POS 관리 허브. `store_product.html` → 각 관리 페이지로 이동하는 네비게이션.

| 페이지 | 경로 | 설명 |
|--------|------|------|
| 상품 정보 수정 | `/store/set_menu` | 메뉴 CRUD |
| 상품 배치 수정 | `/store/set_menu_position` | 메뉴 위치 편집 |
| 카테고리 관리 | `/store/category_mgmt` | 대/소분류 관리 |
| 테이블 설정 | `/store/set_table` | 테이블 레이아웃 편집 |
| 단말기 관리 | `/store/terminal_mgmt` | 토스 단말기 연결 설정 |
| 직원 호출 관리 | `/store/staff_call_mgmt` | 직원 호출 항목 설정 |

### 단말기 관리 페이지 (`/store/terminal_mgmt`)

`store_terminal_mgmt.html` + `store_terminal_mgmt.js`

- 연결 상태 표시 (TerminalToken 존재 여부)
- 매장 아이디 표시 + 클립보드 복사
- 토스 가맹점 ID 입력 (`Store.toss_merchant_id`)
- 사업자등록번호 입력 (`Store.toss_business_number`)
- 단말기 시리얼 번호 입력/초기화 (`Store.terminal_serial`)
- 연결 방법 5단계 가이드

**API**:
- `GET /store/get_terminal_info` → 단말기 정보 조회
- `PATCH /store/update_terminal_info` → 단말기 정보 저장

## 토스 프론트 단말기 연동 (Toss Place)

**위치**: `../toss-front-plugin-template/front-plugin-js/`

**파일 구성**:
- `sdk.js` - TossFrontSDK 초기화. serialNumber + merchant 정보 모두 localStorage에서 동적 로드
- `home.html` - 단말기 메인. 로그인 → serialNumber 자동수집 → merchant 정보 localStorage 저장 → `renderIdlePage` → 1초 폴링
- `order.html` - 결제 화면. sessionStorage에서 paymentData 읽어 `renderOrderPage` 호출

**배포**: `front-plugin-js.zip` 으로 패키징 → 토스 개발자센터 업로드
```bash
cd front-plugin-js && zip ../front-plugin-js.zip *.html *.css *.js
```

> zip은 공통 1개. 가맹점 정보는 각 매장 단말기 로그인 시 localStorage에 동적 세팅되므로 매장마다 별도 배포 불필요.

### 가맹점 정보 동적화 흐름

1. 관리자가 `/store/terminal_mgmt`에서 `toss_merchant_id`, `toss_business_number` 입력 → DB 저장
2. 단말기에서 로그인 → `POST /pos/toss/auth/login` 응답에 merchant 정보 포함
3. `home.html`이 localStorage에 `orderandgo_merchant_id`, `orderandgo_merchant_name`, `orderandgo_business_number` 저장 + SDK 재초기화
4. `sdk.js`가 다음 실행 시 localStorage에서 읽어 SDK 초기화

### 결제 흐름 (HTTP Polling 방식 — 토스 공식 권장)

1. 단말기 로그인 시 `sdk.app.getSerialNumber()`로 시리얼 자동 수집 → 서버 DB 저장 + localStorage 캐시
2. POS에서 카드결제 클릭 → `POST /pos/toss/pending` 생성 (in-memory `_pending_payments`)
   - **가맹점 정보 미설정 시 422 반환** → POS에 에러 메시지 표시
3. 단말기 1초 폴링 `GET /pos/toss/pending?token=X` → `pending: true` 감지 → sessionStorage 저장 → `order.html` 이동
4. `order.html`에서 `sdk.template.renderOrderPage()` → 결제 버튼 클릭 → `sdk.payment.requestPayment()`
5. 결제 결과 `POST /pos/toss/result` → POS 화면 업데이트

> **WebSocket/socket.io는 사용 불가**: 단말기 WebView가 동적 스크립트 로딩 차단 + HTTPS mixed content 차단(`ws://`)
> HTTP polling만 안정적으로 작동함

### pos.py 주요 엔드포인트

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/pos/toss/auth/login` | POST | 단말기 매장 로그인. serialNumber 저장, token 발급, merchant 정보 응답에 포함 |
| `/pos/toss/pending` | POST | POS가 결제 대기 생성. 가맹점 정보 미설정 시 422 |
| `/pos/toss/pending?token=X` | GET | 단말기 폴링. store_id로 필터링 |
| `/pos/toss/result` | POST | 단말기 결제 결과 전송 |

## 작업 규칙

- DB 크리덴셜은 `.env`로만 관리, 코드 하드코딩 금지
- Flask app factory 패턴 유지
- Blueprint 구조 유지
- WebSocket은 eventlet 기반 → gunicorn eventlet worker (prod/stg) 또는 `socketio.run()` (local/dev)
- 마이그레이션은 Alembic/Flask-Migrate 사용. 서버에서 `flask db migrate && flask db upgrade` 실행
- 토스 단말기 통신은 반드시 HTTP polling 사용 (WebSocket/socket.io 불가)
- 프론트엔드: Vanilla JS + Jinja2 템플릿. Phosphor Icons. Plain CSS. fetch API (Axios 없음)
