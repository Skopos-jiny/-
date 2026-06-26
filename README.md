# 💛 KooEnglish

아름이를 위한 **비즈니스 영어 회화 연습 앱**입니다. (스픽 스타일)
마이크로 영어를 말하면 AI가 알아듣고, 상황에 맞게 대답하고 소리 내어 읽어주며,
아름이가 한 영어를 **더 자연스럽게 고쳐주고 한국어로 설명**해 줍니다.

> 남편과 곧 태어날 땡스가 함께 만든 선물 🎁👨‍👩‍👶

---

## ✨ 주요 기능

- 🎙️ **말하기 연습** — 브라우저 마이크로 영어를 말하면 자동으로 인식
- 🔊 **듣기 연습** — AI의 답변을 원어민 발음으로 읽어줌
- 💬 **6가지 비즈니스 상황** — 팀 회의, 협상, 프레젠테이션 Q&A, 영어 면접, 스몰토크, 고객 응대
- 💡 **즉시 피드백** — 아름이가 한 영어를 더 자연스러운 표현으로 고쳐주고 이유를 한국어로 설명
- 🇰🇷 **한글 번역 보기** — AI가 한 말을 한국어로 함께 확인 (켜고 끌 수 있음)
- 🤍 AI가 아름이의 이름을 불러주며 따뜻하게 대화해요

---

## 🍎 macOS에서 시작하기

### 1. Node.js 설치 (Homebrew)

터미널(스팟라이트에서 "터미널" 검색)을 열고:

```bash
# Homebrew가 없다면 먼저 설치 (있으면 건너뛰기)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Node.js 설치
brew install node
```

### 2. 프로젝트 준비

```bash
cd ~/KooEnglish        # 프로젝트를 내려받은 폴더로 이동
npm install
```

### 3. AI 두뇌(API 키) 연결

이 앱의 대화는 Anthropic의 Claude AI가 담당합니다. API 키가 필요해요.

1. [console.anthropic.com](https://console.anthropic.com) 에 가입/로그인
2. **Settings → API Keys → Create Key** 로 키를 발급 (`sk-ant-...` 형태)
3. `.env` 파일을 만들고 키를 넣습니다:

```bash
cp .env.example .env
open -e .env           # 텍스트 편집기로 열림 → 키 붙여넣고 저장
```

`.env` 내용:
```
ANTHROPIC_API_KEY=sk-ant-실제로-발급받은-키
```

> 💡 API는 사용한 만큼만 소액 과금됩니다. 회화 한 번당 비용은 매우 적어요.

### 4. 실행

```bash
npm start
```

맥에서 브라우저로 **http://localhost:3000** 접속하면 끝! 🎉 (Chrome 권장)

---

## 📱 아름이 휴대폰에서 쓰게 하려면? (배포)

> ⚠️ **중요 — 마이크는 HTTPS에서만 작동해요.** 브라우저 보안 정책상,
> 휴대폰에서 마이크(말하기)를 쓰려면 주소가 `https://` 여야 합니다.
> `localhost`(맥 본인)만 예외예요. 그래서 폰에서 **말하기**까지 쓰려면 아래 방법이 필요합니다.
> (타이핑으로만 연습한다면 집 와이파이 접속만으로도 충분해요.)

### 방법 A — 집 와이파이로 접속 (가장 간단, 타이핑 위주)

맥과 폰이 **같은 와이파이**에 있을 때:

```bash
# 맥의 로컬 IP 확인
ipconfig getifaddr en0
```

나온 주소로 폰 브라우저에서 접속 → 예: `http://192.168.0.10:3000`
- ✅ 타이핑 대화·듣기(소리)는 잘 됩니다.
- ⚠️ 말하기(마이크)는 http라서 폰에서 막힐 수 있어요. (맥 본체에서는 됩니다)

### 방법 B — Cloudflare 터널로 집에서 HTTPS 주소 만들기 (말하기 O, 무료)

맥에서 앱을 켜둔 채, HTTPS 주소를 임시로 만들어 줍니다:

```bash
brew install cloudflared
# 앱(npm start)이 켜진 상태에서, 새 터미널 창에:
cloudflared tunnel --url http://localhost:3000
```

출력되는 `https://....trycloudflare.com` 주소를 폰에서 열면 **말하기까지** 작동합니다.
(맥을 켜두고 앱이 돌아가는 동안에만 접속 가능)

### 방법 C — 무료 클라우드 배포 (어디서나 접속, 말하기 O) ⭐추천

아름이가 집 밖에서도, 맥을 안 켜도 폰으로 항상 쓸 수 있는 방법입니다.
무료 호스팅 [Render](https://render.com) 기준:

1. 이 프로젝트를 GitHub 저장소(예: `KooEnglish`)에 올립니다.
2. Render 가입 → **New → Web Service** → 그 저장소 선택
3. 설정값:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment → Add Environment Variable**:
     `ANTHROPIC_API_KEY` = 발급받은 키
4. 배포가 끝나면 `https://kooenglish.onrender.com` 같은 주소가 나옵니다.
   이 주소를 아름이 폰 홈 화면에 추가해 주면 앱처럼 쓸 수 있어요. 📲

> 💡 폰 홈 화면 추가: 사파리/크롬에서 주소 접속 → 공유 → "홈 화면에 추가"

---

## 🍎 맥에서 항상 켜두고 싶다면 (선택)

맥을 끄지 않는 동안 앱이 계속 돌아가게 하려면 `pm2`를 쓰면 편해요:

```bash
npm install -g pm2
pm2 start server.js --name kooenglish
pm2 save
pm2 startup        # 출력되는 명령을 한 번 복사해 실행하면, 재부팅 후 자동 시작
```

---

## 🧩 어떻게 동작하나요?

```
[브라우저]                          [서버 (Node.js)]            [Claude AI]
 마이크 음성 ──인식──> 영어 텍스트
 영어 텍스트 ─────────POST /api/chat───────────> 시스템 프롬프트 + 대화기록 ──> Claude
                                                                              │
 화면에 답변 표시 <──── 답변 + 한국어번역 + 피드백 (JSON) <──────────────────┘
 답변 음성으로 읽기
```

- **음성 인식 / 음성 합성**: 브라우저 내장 Web Speech API (추가 키 불필요)
- **대화 AI**: Claude (`claude-opus-4-8`) — 서버가 API 키를 안전하게 보관
- **구조화된 응답**: AI가 `답변 / 한국어 번역 / 피드백`을 한 번에 JSON으로 반환

---

## 📂 파일 구조

```
.
├── server.js          # Express 서버 + Claude API 연동
├── package.json
├── .env.example       # API 키 설정 템플릿
└── public/
    ├── index.html     # 화면 구조
    ├── styles.css     # 디자인
    └── app.js         # 음성 인식/합성 + 대화 로직
```

## 🔧 새로운 상황(시나리오) 추가하기

`server.js` 의 `SCENARIOS` 객체에 항목을 하나 추가하면 됩니다.
`role`(AI가 연기할 역할)과 `opener`(AI의 첫 인사)만 적어주면 자동으로 화면에 나타나요.

---

아름이의 영어가 매일 한 뼘씩 자라기를 바라며,
남편과 땡스가 마음을 담아 💛
