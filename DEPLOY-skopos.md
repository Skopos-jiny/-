# 🌐 skopos.kr/kooenglish 에 올리기 (테스트 웹버전)

`skopos.kr` 아래 **하위 경로 `/kooenglish`** 로 KooEnglish를 띄우는 방법입니다.
이렇게 하면 skopos.kr의 **HTTPS를 그대로 사용**하므로, 아름이 폰에서 **마이크(말하기)까지**
바로 작동합니다. (마이크는 HTTPS에서만 동작해요.)

```
아름이 폰 ──https──> skopos.kr/kooenglish/ ──(리버스 프록시)──> 127.0.0.1:3000 (KooEnglish 앱)
```

---

## 1. 서버에 앱 올리고 실행

skopos.kr를 서비스하는 서버에 코드를 올린 뒤:

```bash
cd /var/www/kooenglish      # 코드를 둔 위치 (예시)
npm install

# 환경변수 설정
cp .env.example .env
# .env 편집 →  ANTHROPIC_API_KEY=sk-ant-...   그리고   BASE_PATH=/kooenglish
```

`.env` 예시:
```
ANTHROPIC_API_KEY=sk-ant-발급받은-키
BASE_PATH=/kooenglish
PORT=3000
```

앱을 상시 실행 (pm2 권장):
```bash
npm install -g pm2
pm2 start server.js --name kooenglish
pm2 save
pm2 startup     # 출력 명령 1회 실행 → 재부팅 후 자동 시작
```

확인:
```bash
curl -s http://localhost:3000/kooenglish/health
# {"ok":true,"hasApiKey":true} 가 나오면 정상
```

---

## 2. 리버스 프록시 설정

### Nginx (skopos.kr 서버 블록 안에 추가)

```nginx
# skopos.kr/kooenglish → 로컬 3000 포트로 전달
location = /kooenglish {
    return 301 /kooenglish/;          # 슬래시 없이 들어오면 보정
}

location /kooenglish/ {
    proxy_pass         http://127.0.0.1:3000;   # 경로(/kooenglish/)를 그대로 전달
    proxy_http_version 1.1;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
}
```

> ⚠️ `proxy_pass` 끝에 경로를 붙이지 마세요(`http://127.0.0.1:3000;` 로 끝). 그래야
> `/kooenglish/` 접두어가 그대로 앱(`BASE_PATH=/kooenglish`)으로 전달됩니다.

적용:
```bash
sudo nginx -t && sudo nginx -s reload
```

### Caddy를 쓴다면 (더 간단)

```caddy
skopos.kr {
    handle_path /kooenglish/* {
        reverse_proxy 127.0.0.1:3000
    }
    redir /kooenglish /kooenglish/
}
```
> Caddy의 `handle_path`는 접두어를 **떼고** 전달하므로, 이 경우엔 앱의 `BASE_PATH`를
> **비워두거나** 빼고 실행하세요. (Nginx 예시는 접두어를 유지하므로 `BASE_PATH=/kooenglish` 필요)
> 헷갈리면 **Nginx + BASE_PATH=/kooenglish** 조합을 권장합니다.

---

## 3. 접속 확인

브라우저에서 **https://skopos.kr/kooenglish/** 접속 →
아름이 폰에서도 같은 주소로 열고, "홈 화면에 추가"하면 앱처럼 쓸 수 있어요. 📲

- 마이크 권한을 물으면 "허용"
- Chrome / Safari 모두 HTTPS이므로 말하기 정상 작동

---

## 자주 막히는 곳 체크리스트

| 증상 | 원인/해결 |
|---|---|
| 화면은 뜨는데 CSS·버튼이 깨짐 | `BASE_PATH`와 프록시 경로 불일치. Nginx면 `BASE_PATH=/kooenglish` 확인 |
| `/kooenglish` (슬래시 없이) 404 | 위 `location = /kooenglish { return 301 ... }` 추가 |
| 대화 시 "API 키 미설정" 안내 | `.env`의 `ANTHROPIC_API_KEY` 누락 → 넣고 `pm2 restart kooenglish` |
| 폰에서 마이크 안 됨 | 주소가 `https://` 인지 확인 (http면 브라우저가 마이크 차단) |
| 502 Bad Gateway | 앱이 안 떠 있음 → `pm2 status`, `pm2 logs kooenglish` 확인 |

설정 변경 후에는 항상 `pm2 restart kooenglish` 로 반영하세요.
