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
├── nginx-proxy/          # 서버용 nginx conf (배포 전용)
├── db/backups/           # DB 백업 (git 제외)
├── docker-compose.local.yml  # 로컬 개발 (hot reload)
├── docker-compose.dev.yml    # Dev 서버
├── docker-compose.yml        # Production 서버
├── deploy.sh             # 배포 자동화 (SSH → git pull → docker up)
└── .claude/
    ├── commands/         # 슬래시 커맨드 (/local-setup /dev-setup /prod-deploy)
    └── rules/            # 상세 규칙 파일
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
| 프론트엔드 | Vanilla JS + Jinja2 + Phosphor Icons + Plain CSS + fetch API |

## 환경별 도메인

| 환경 | 도메인 |
|------|--------|
| local | `http://{내부IP}:5200` |
| dev | `https://dev-order.ghmate.com` |
| prod | `https://order.ghmate.com` |

## 실행 / 배포

**로컬**: `/local-setup` → `../local-setup.sh` 실행  
**Dev 배포**: `/dev-setup` → `../dev-setup.sh` 실행  
**Prod 배포**: `/prod-deploy` → `../prod-deploy.sh` 실행

수동:
```bash
docker compose -f docker-compose.local.yml up --build -d   # 로컬
git push && ./deploy.sh dev   # dev 배포
git push && ./deploy.sh prod  # prod 배포
```

> deploy.sh는 SSH로 원격 서버에 접속해서 git pull → docker build & up 수행.
> **반드시 git push 후 deploy.sh 실행할 것.**

## Git

- 레포: `github.com/whrksp126/orderandgo_service`
- 브랜치: `develop` (작업 브랜치), `main` (배포 브랜치)

## 작업 규칙

- DB 크리덴셜은 `.env`로만 관리, 코드 하드코딩 금지
- Flask app factory 패턴 유지
- Blueprint 구조 유지
- WebSocket은 eventlet 기반 → gunicorn eventlet worker (prod), `socketio.run()` (local/dev)
- 마이그레이션은 Alembic/Flask-Migrate 사용
- 토스 단말기 통신은 반드시 HTTP polling 사용 (WebSocket/socket.io 불가)
- 배포 전 반드시 `git push` 먼저 실행

## 상세 규칙 참조

- DB 모델: @.claude/rules/models.md
- 매장 관리 페이지: @.claude/rules/store-pages.md
- 토스 단말기 연동: @.claude/rules/toss.md
- Python/Flask 코드 스타일: @.claude/rules/code-style.md
- 보안 규칙: @.claude/rules/security.md
