# OrderAndGo 서버 세팅 가이드

## 사전 조건

- 서버에 Docker, Docker Compose 설치 완료
- `nginx_proxy` 네트워크 및 nginx-proxy 컨테이너 실행 중 (heyvoca와 공유)
- SSH 키: `~/.ssh/ghmate_server`

---

## 1. 서버 초기 세팅 (최초 1회)

서버에는 소스코드 없이 **compose 파일 + .env 파일만** 둡니다. 이미지는 Docker Hub에서 pull.

**로컬 맥에서:**
```bash
# 서버에 프로젝트 디렉토리 생성
ssh -i ~/.ssh/ghmate_server -p 222 ghmate@ghmate.iptime.org "mkdir -p /srv/projects/orderandgo"

# compose 파일만 SCP로 전송
scp -i ~/.ssh/ghmate_server -P 222 \
    docker-compose.dev.yml \
    docker-compose.stg.yml \
    docker-compose.yml \
    ghmate@ghmate.iptime.org:/srv/projects/orderandgo/
```

---

## 2. 환경 파일 준비 (서버에서)

git에 포함되지 않으므로 서버에서 직접 생성:

```bash
ssh -i ~/.ssh/ghmate_server -p 222 ghmate@ghmate.iptime.org

cd /srv/projects/orderandgo

# dev
vi .env.dev

# stg (필요 시)
vi .env.stg

# prod (필요 시)
vi .env
```

각 파일 내용 형식:
```
MYSQL_ROOT_PASSWORD=...
MYSQL_DATABASE=orderandgo
MYSQL_USER=orderuser
MYSQL_PASSWORD=...
SECRET_KEY=...
DATABASE_URL=mysql+pymysql://orderuser:...@mysql:3306/orderandgo
FLASK_ENV=development
FLASK_DEBUG=1
```

---

## 3. nginx-proxy에 orderandgo conf 추가 (최초 1회)

서버의 nginx-proxy conf 디렉토리에 복사:

```bash
# 로컬 맥에서
scp -i ~/.ssh/ghmate_server -P 222 \
    nginx-proxy/conf.d/orderandgo.conf \
    ghmate@ghmate.iptime.org:/srv/nginx-proxy/conf.d/

# 서버에서 nginx 리로드
ssh -i ~/.ssh/ghmate_server -p 222 ghmate@ghmate.iptime.org \
    "docker exec nginx_proxy nginx -s reload"
```

---

## 4. 첫 배포

로컬 맥에서:

```bash
./deploy.sh dev   # 또는 stg, prod
```

---

## 5. DB 초기 데이터 복원 (최초 1회, 필요 시)

```bash
# 서버에서
docker exec -i orderandgo_mysql_dev mysql -u root -p{MYSQL_ROOT_PASSWORD} orderandgo < backup.sql
```

---

## 이후 배포

```bash
./deploy.sh dev    # dev 배포
./deploy.sh stg    # stg 배포
./deploy.sh prod   # prod 배포
```

---

## 환경별 도메인

| 환경 | 도메인 |
|------|--------|
| dev  | https://dev-order.ghmate.com |
| stg  | https://stg-order.ghmate.com |
| prod | https://order.ghmate.com |

---

## 로그 확인

```bash
docker logs -f orderandgo_service_dev   # dev
docker logs -f orderandgo_service_stg   # stg
docker logs -f orderandgo_service_prod  # prod
```
