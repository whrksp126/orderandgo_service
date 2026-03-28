로컬 개발 환경을 세팅한다. 아래 스크립트를 실행해라.

```
/Users/whrksp126/other/project/orderandgo/local-setup.sh
```

스크립트가 자동으로 처리하는 내용:
1. 현재 공유기 내부 IP 확인
2. Docker 컨테이너 재시작 (down → up --build)
3. 기존 cmux 레이아웃 정리
4. cmux 레이아웃 생성 (app 로그 | mysql 로그)
5. Claude 터미널로 포커스 복귀

완료 후 결과 보고:
- 내부 IP 및 서비스 접속 주소 (`http://{IP}:5200`)
- MySQL 포트 (`localhost:3320`)
- 컨테이너 상태
