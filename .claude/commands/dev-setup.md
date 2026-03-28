dev 서버에 배포하고 cmux 레이아웃을 세팅한다. 아래 스크립트를 실행해라.

```
/Users/whrksp126/other/project/orderandgo/dev-setup.sh
```

스크립트가 자동으로 처리하는 내용:
1. git push (서버는 git pull 방식이므로 push 먼저)
2. dev 서버 배포 (SSH → git pull → docker compose up --build)
3. 기존 cmux 레이아웃 정리
4. cmux 레이아웃 생성 (app 로그 | mysql 로그, SSH tailing)
5. Claude 터미널로 포커스 복귀

완료 후 결과 보고:
- 서비스 주소: `https://dev-order.ghmate.com`
- 컨테이너 상태
