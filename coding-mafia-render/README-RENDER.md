
# Coding Mafia - Render 배포 가이드

## 1) 이 폴더 구조를 Git 리포로 만들어 Render에 연결
```
coding-mafia-render/
 ├─ server.js           # CORS 허용, Socket.IO 서버
 ├─ package.json
 ├─ Dockerfile          # Render Docker 서비스
 ├─ render.yaml         # Render 인프라 설정(선택)
 └─ public/             # (선택) 정적 파일
```

## 2) Render 설정
- Dashboard → New → Web Service → "Build from a Dockerfile"
- GitHub 리포 선택
- Region / Plan 선택 (Free 가능)
- 나머지 기본값으로 생성

## 3) 포트/헬스체크
- Dockerfile의 `PORT=10000` 과 `EXPOSE 10000`을 사용합니다.
- server.js는 `process.env.PORT` 를 사용하므로 Render가 지정하는 포트로 자동 수신합니다.
- Health check path: `/health`

## 4) 배포 후 서버 URL
- 예: `https://coding-mafia-server.onrender.com`
- 이 URL을 GitHub Pages의 `config.js` 에 `SERVER_URL` 로 설정하세요.
