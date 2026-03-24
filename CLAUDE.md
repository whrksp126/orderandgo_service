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
> deploy.sh는 SSH로 원격 서버에 접속해서 git pull → docker build & up 수행.
> **반드시 git push 후 deploy.sh 실행할 것.** push 없이 deploy하면 구버전이 배포됨.

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
  - `toss_merchant_id` - 토스 가맹점 ID (단말기 로그인 시 `getMerchant()`로 자동 저장)
  - `toss_business_number` - 사업자등록번호 (단말기 로그인 시 `getMerchant()`로 자동 저장)
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

- 연결 상태 표시 (TerminalToken 존재 여부, 5초 폴링)
- 매장 아이디 표시 + 클립보드 복사
- 토스 가맹점 ID / 사업자등록번호: **읽기 전용 표시** (단말기 로그인 시 자동 등록, 수동 입력 불가)
- VAN 대리점 통한 최초 설정 가이드 (플러그인 ID: `orderandgo-front`)
- 단말기 로그아웃 버튼 (연결 중일 때만 표시)

**API**:
- `GET /store/get_terminal_info` → 단말기 정보 조회
- `PATCH /store/update_terminal_info` → 단말기 정보 저장 (시리얼 번호 등)

## 토스 프론트 단말기 연동 (Toss Place)

### 개요

토스플레이스 프론트 단말기(결제 단말기)에 오더앤고 플러그인을 연동하는 구조.
공식 문서: https://docs.tossplace.com/guide/front-integration/plugin/develop/develop-tutorial.html

- **플러그인 타입**: 프론트 플러그인 (포스 플러그인 아님)
- **플러그인 ID**: `orderandgo-front`
- **배포 방식**: HTML/JS/CSS 파일을 ZIP으로 압축 → 토스 개발자센터 업로드
- **개발 배포**: 검수 없이 즉시, 최대 5개 단말기
- **라이브 배포**: 검수(1영업일) 후 전체 단말기 적용
- **실제 가맹점 연동**: VAN 대리점이 토스플레이스 파트너스에서 플러그인 활성화 처리

### 플러그인 파일 위치 및 구성

**위치**: `../toss-front-plugin-template/front-plugin-js/`

| 파일 | 역할 |
|------|------|
| `sdk.js` | TossFrontSDK 초기화. serialNumber + merchant 정보를 localStorage에서 동적 로드 |
| `home.html` | 단말기 메인. 로그인 → serial/merchant 자동수집 → `renderIdlePage` → 1초 폴링 |
| `order.html` | 결제 화면. sessionStorage에서 paymentData 읽어 `renderOrderPage` 호출 |
| `global.css` | 공통 스타일 |

**ZIP 빌드 및 배포**:
```bash
cd front-plugin-js && zip ../front-plugin-js.zip *.html *.css *.js
# 빌드 후 토스 개발자센터에서 ZIP 업로드
```

> zip은 공통 1개. 가맹점 정보는 각 매장 단말기 로그인 시 자동 세팅되므로 매장마다 별도 배포 불필요.

### 가맹점 정보 자동화 흐름

VAN 대리점이 단말기를 해당 가맹점 Toss 계정으로 등록해두면, 단말기 자체에 가맹점 정보가 내장됨.
오더앤고 로그인 시 `sdk.app.getMerchant()`로 자동 수집하여 서버에 저장.

1. VAN 대리점이 단말기를 가맹점 Toss 계정으로 등록 (최초 1회)
2. 사장님이 단말기에서 오더앤고 로그인 시:
   - `sdk.app.getSerialNumber()` → 시리얼 번호 자동 수집
   - `sdk.app.getMerchant()` → 가맹점 ID, 사업자번호 자동 수집
   - `POST /pos/toss/auth/login` 에 모두 포함하여 서버 DB 자동 저장
3. `home.html`이 localStorage에 `orderandgo_merchant_id`, `orderandgo_merchant_name`, `orderandgo_business_number` 저장 + SDK 재초기화
4. `sdk.js`가 다음 실행 시 localStorage에서 읽어 SDK 초기화

> 사장님이 가맹점 ID를 찾아서 수동 입력할 필요 없음.

### 결제 흐름 (HTTP Polling 방식 — 토스 공식 권장)

1. 단말기 로그인 시 serial/merchant 자동 수집 → 서버 DB 저장
2. POS에서 카드결제 클릭 → `POST /pos/toss/pending` 생성 (in-memory `_pending_payments`)
   - **가맹점 정보 미설정 시 422 반환** → POS에 에러 메시지 표시
3. 단말기 1초 폴링 `GET /pos/toss/pending?token=X` → `pending: true` 감지 → sessionStorage 저장 → `order.html` 이동
4. `order.html`에서 `sdk.template.renderOrderPage()` → 결제 버튼 클릭 → `sdk.payment.requestPayment()`
5. 결제 결과 `POST /pos/toss/result` → POS 화면 업데이트

> **WebSocket/socket.io는 사용 불가**: 단말기 WebView가 동적 스크립트 로딩 차단 + HTTPS mixed content 차단(`ws://`)
> HTTP polling만 안정적으로 작동함.

### 토스 플레이스 프론트 플러그인 SDK 주요 API

| API | 용도 |
|-----|------|
| `sdk.app.getSerialNumber()` | 단말기 시리얼 번호 조회 |
| `sdk.app.getMerchant()` | 단말기에 등록된 가맹점 정보 조회 (id, name, businessNumber) |
| `sdk.overrides({ serialNumber, merchant })` | SDK에 단말기/가맹점 정보 주입 |
| `sdk.template.renderIdlePage()` | 대기 화면 렌더링 |
| `sdk.template.renderInputPage()` | 입력 화면 렌더링 |
| `sdk.template.renderOrderPage()` | 주문/결제 화면 렌더링 |
| `sdk.template.openToast()` | 토스트 메시지 표시 |
| `sdk.payment.requestPayment()` | 카드/간편결제 요청 |
| `sdk.payment.requestCashPayment()` | 현금결제 요청 |
| `sdk.payment.requestPaymentCancel()` | 결제 취소 요청 |

### pos.py 주요 엔드포인트

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/pos/toss/auth/login` | POST | 단말기 로그인. serial/merchant 자동 저장, token 발급 |
| `/pos/toss/auth/verify` | GET | 단말기 토큰 유효성 검사 |
| `/pos/toss/pending` | POST | POS가 결제 대기 생성. 가맹점 정보 미설정 시 422 |
| `/pos/toss/pending?token=X` | GET | 단말기 폴링. store_id로 필터링 |
| `/pos/toss/cancel` | POST | POS에서 결제 취소 |
| `/pos/toss/status?payment_id=X` | GET | 단말기가 취소 여부 폴링 |
| `/pos/toss/result` | POST | 단말기 결제 결과 전송 → POS 소켓 emit |

### 실제 가맹점 라이브 배포 절차

1. `home.html` SERVER_URL을 prod(`https://order.ghmate.com`)로 변경
2. ZIP 재빌드 후 토스 개발자센터 → 라이브 배포 탭 → 업로드 → 검수 요청
3. 검수 통과 (1영업일) 후 VAN 대리점에 연락:
   > "토스플레이스 파트너스에서 오더앤고 프론트 플러그인(ID: orderandgo-front)을 저희 매장 단말기에 활성화해주세요."
4. VAN 대리점 활성화 완료 → 단말기에서 오더앤고 로그인

> 현재 `home.html`의 SERVER_URL은 `https://dev-order.ghmate.com` (dev 환경).
> 라이브 배포 시 prod URL로 변경 필요.

## 작업 규칙

- DB 크리덴셜은 `.env`로만 관리, 코드 하드코딩 금지
- Flask app factory 패턴 유지
- Blueprint 구조 유지
- WebSocket은 eventlet 기반 → gunicorn eventlet worker (prod/stg) 또는 `socketio.run()` (local/dev)
- 마이그레이션은 Alembic/Flask-Migrate 사용. 서버에서 `flask db migrate && flask db upgrade` 실행
- 토스 단말기 통신은 반드시 HTTP polling 사용 (WebSocket/socket.io 불가)
- 프론트엔드: Vanilla JS + Jinja2 템플릿. Phosphor Icons. Plain CSS. fetch API (Axios 없음)
- 배포 전 반드시 `git push` 먼저 실행 (deploy.sh는 서버에서 git pull하는 방식)
