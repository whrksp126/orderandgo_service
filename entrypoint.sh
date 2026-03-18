#!/bin/bash
set -e

echo "[Entrypoint] DB 마이그레이션 확인 중..."

# alembic_version 테이블 존재 여부 확인 (존재하면 기존 DB, 없으면 신규 DB)
HAS_VERSION=$(python -c "
from app import create_app, db
from sqlalchemy import inspect, text
app = create_app()
with app.app_context():
    insp = inspect(db.engine)
    if insp.has_table('alembic_version'):
        try:
            row = db.session.execute(text('SELECT version_num FROM alembic_version LIMIT 1')).fetchone()
            print('yes' if row else 'no')
        except:
            print('no')
    else:
        print('no')
" 2>/dev/null)

if [ "$HAS_VERSION" = "yes" ]; then
    echo "[Entrypoint] 기존 DB - flask db upgrade 실행"
    flask db upgrade
else
    echo "[Entrypoint] 신규 DB - stamp head (db.create_all()이 이미 처리함)"
    flask db stamp head
fi

echo "[Entrypoint] 시드 데이터 확인 중..."
python -c "
from app import create_app, db
from sqlalchemy import text
app = create_app()
with app.app_context():
    count = db.session.execute(text('SELECT COUNT(*) FROM order_status')).scalar()
    if count == 0:
        db.session.execute(text(\"INSERT INTO order_status (id, status) VALUES (1,'조리중'),(2,'완료'),(3,'취소')\"))
        db.session.commit()
        print('[Seed] order_status 초기 데이터 삽입 완료')
    else:
        print('[Seed] order_status 이미 존재')
" 2>/dev/null

echo "[Entrypoint] 앱 시작"
# APP_CMD 환경변수로 실행 명령 오버라이드 가능 (gunicorn 등)
exec ${APP_CMD:-python app.py}
