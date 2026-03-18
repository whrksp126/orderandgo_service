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

- 레포: `github.com/whrksp126/orderandgo`
- 브랜치: `main`

## DB 모델 (주요)

- `User` - 관리자 계정
- `Store` - 매장 (멀티테넌트 단위)
- `Table`, `TableCategory` - 테이블 관리
- `MainCategory` → `SubCategory` → `Menu` - 메뉴 계층
- `MenuOptionGroup`, `MenuOption` - 메뉴 옵션
- `Order`, `TableOrderList` - 주문
- `Payment`, `Payment_method`, `Payment_status`, `TablePaymentList` - 결제
- `StaffCallItem`, `StaffCallLog` - 직원 호출

## 작업 규칙

- DB 크리덴셜은 `.env`로만 관리, 코드 하드코딩 금지
- Flask app factory 패턴 유지
- Blueprint 구조 유지
- WebSocket은 eventlet 기반 → gunicorn eventlet worker (prod/stg) 또는 `socketio.run()` (local/dev)
- 마이그레이션은 Alembic/Flask-Migrate 사용
