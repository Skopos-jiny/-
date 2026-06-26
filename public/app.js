// ── 상태 ────────────────────────────────────────────────
let scenarios = [];
let current = null; // 현재 시나리오 객체
let history = []; // [{role, content}] — API로 보낼 대화 기록
let recognition = null;
let listening = false;

// ── DOM ─────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const homeScreen = $("home");
const chatScreen = $("chat");
const grid = $("scenario-grid");
const messagesEl = $("messages");
const textInput = $("text-input");
const micBtn = $("mic-btn");
const sendBtn = $("send-btn");
const interimEl = $("interim");
const showKoreanEl = $("show-korean");
const composerHint = $("composer-hint");

// ── 초기화 ──────────────────────────────────────────────
init();

async function init() {
  try {
    const res = await fetch("api/scenarios");
    const data = await res.json();
    scenarios = data.scenarios;
    if (!data.hasApiKey) $("api-warning").classList.remove("hidden");
    renderScenarios();
  } catch {
    grid.innerHTML = "<p>시나리오를 불러오지 못했어요. 서버가 켜져 있는지 확인해 주세요.</p>";
  }

  setupSpeech();

  $("back-btn").addEventListener("click", goHome);
  sendBtn.addEventListener("click", handleSend);
  textInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSend();
  });
  micBtn.addEventListener("click", toggleMic);
  showKoreanEl.addEventListener("change", () => {
    document.body.classList.toggle("show-ko", showKoreanEl.checked);
    renderKoreanVisibility();
  });
}

// ── 시나리오 카드 ───────────────────────────────────────
function renderScenarios() {
  grid.innerHTML = "";
  for (const s of scenarios) {
    const card = document.createElement("button");
    card.className = "scenario-card";
    card.innerHTML = `
      <span class="emoji">${s.emoji}</span>
      <span class="title">${s.title}</span>
      <span class="desc">${s.desc}</span>`;
    card.addEventListener("click", () => startScenario(s));
    grid.appendChild(card);
  }
}

// ── 화면 전환 ───────────────────────────────────────────
function startScenario(s) {
  current = s;
  history = [];
  messagesEl.innerHTML = "";
  $("chat-emoji").textContent = s.emoji;
  $("chat-scenario-title").textContent = s.title;
  homeScreen.classList.remove("active");
  chatScreen.classList.add("active");

  // AI의 첫 인사 (오프너) — 서버 호출 없이 미리 정의된 문장 사용
  history.push({ role: "assistant", content: s.opener });
  addAiMessage(s.opener, null, null);
  speak(s.opener);
}

function goHome() {
  stopListening();
  window.speechSynthesis?.cancel();
  chatScreen.classList.remove("active");
  homeScreen.classList.add("active");
}

// ── 메시지 렌더링 ───────────────────────────────────────
function addAiMessage(reply, korean, feedback) {
  // 피드백 카드 (직전 사용자 메시지에 대한 것) 먼저 표시
  if (feedback && feedback.has_feedback) {
    const fb = document.createElement("div");
    fb.className = "feedback";
    fb.innerHTML = `
      <div class="fb-label">💡 이렇게 말하면 더 자연스러워요</div>
      <div class="fb-corrected">"${escapeHtml(feedback.corrected)}"</div>
      ${feedback.tip_korean ? `<div class="fb-tip">${escapeHtml(feedback.tip_korean)}</div>` : ""}`;
    messagesEl.appendChild(fb);
  }

  const msg = document.createElement("div");
  msg.className = "msg ai";
  const koHtml = korean
    ? `<span class="korean" ${showKoreanEl.checked ? "" : "style='display:none'"}>${escapeHtml(korean)}</span>`
    : "";
  msg.innerHTML = `
    <div class="bubble">${escapeHtml(reply)}${koHtml}</div>
    <button class="speak-btn">🔊 다시 듣기</button>`;
  msg.querySelector(".speak-btn").addEventListener("click", () => speak(reply));
  messagesEl.appendChild(msg);
  scrollDown();
}

function addUserMessage(text) {
  const msg = document.createElement("div");
  msg.className = "msg user";
  msg.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>`;
  messagesEl.appendChild(msg);
  scrollDown();
}

function showTyping() {
  const t = document.createElement("div");
  t.className = "msg ai typing";
  t.id = "typing-indicator";
  t.innerHTML = `<div class="bubble"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>`;
  messagesEl.appendChild(t);
  scrollDown();
}
function hideTyping() {
  $("typing-indicator")?.remove();
}

function renderKoreanVisibility() {
  const show = showKoreanEl.checked;
  document.querySelectorAll(".bubble .korean").forEach((el) => {
    el.style.display = show ? "block" : "none";
  });
}

// ── 메시지 전송 ─────────────────────────────────────────
async function handleSend() {
  const text = textInput.value.trim();
  if (!text) return;
  stopListening();
  textInput.value = "";
  interimEl.classList.add("hidden");

  addUserMessage(text);
  history.push({ role: "user", content: text });

  sendBtn.disabled = true;
  showTyping();

  try {
    const res = await fetch("api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioId: current.id, messages: history }),
    });
    hideTyping();

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      addSystemNote(err.error || "오류가 발생했어요. 다시 시도해 주세요.");
      return;
    }

    const data = await res.json();
    history.push({ role: "assistant", content: data.reply });
    addAiMessage(data.reply, data.reply_korean, data.feedback);
    speak(data.reply);
  } catch {
    hideTyping();
    addSystemNote("네트워크 오류예요. 연결을 확인해 주세요.");
  } finally {
    sendBtn.disabled = false;
    textInput.focus();
  }
}

function addSystemNote(text) {
  const msg = document.createElement("div");
  msg.className = "feedback";
  msg.style.alignSelf = "center";
  msg.innerHTML = `<div class="fb-tip" style="margin:0">${escapeHtml(text)}</div>`;
  messagesEl.appendChild(msg);
  scrollDown();
}

// ── 음성 인식 (말하기 → 텍스트) ─────────────────────────
function setupSpeech() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    micBtn.disabled = true;
    micBtn.style.opacity = "0.4";
    composerHint.textContent = "이 브라우저는 음성 인식을 지원하지 않아요. Chrome을 사용하시면 말하기가 가능해요.";
    return;
  }
  recognition = new SR();
  recognition.lang = "en-US";
  recognition.interimResults = true;
  recognition.continuous = false;

  recognition.onresult = (event) => {
    let interim = "";
    let final = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) final += transcript;
      else interim += transcript;
    }
    if (interim) {
      interimEl.textContent = "🎙️ " + interim;
      interimEl.classList.remove("hidden");
    }
    if (final) {
      textInput.value = (textInput.value + " " + final).trim();
      interimEl.classList.add("hidden");
    }
  };
  recognition.onerror = () => stopListening();
  recognition.onend = () => {
    if (listening) stopListening();
  };
}

function toggleMic() {
  if (!recognition) return;
  if (listening) {
    stopListening();
    // 말이 끝나면 자동으로 전송
    if (textInput.value.trim()) handleSend();
  } else {
    startListening();
  }
}

function startListening() {
  window.speechSynthesis?.cancel(); // AI가 말하는 중이면 멈추고 듣기
  try {
    recognition.start();
    listening = true;
    micBtn.classList.add("listening");
    composerHint.textContent = "듣고 있어요… 영어로 말해보세요. 다 말하면 🎙️ 버튼을 다시 누르세요.";
  } catch {
    /* 이미 시작된 경우 무시 */
  }
}

function stopListening() {
  if (!recognition) return;
  listening = false;
  micBtn.classList.remove("listening");
  composerHint.textContent = "🎙️ 버튼을 누르고 영어로 말해보세요";
  try {
    recognition.stop();
  } catch {
    /* noop */
  }
}

// ── 음성 합성 (텍스트 → 듣기) ───────────────────────────
function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = 0.95;
  // 가능하면 자연스러운 영어 보이스 선택
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find((v) => /en-US/i.test(v.lang) && /natural|google|samantha/i.test(v.name))
    || voices.find((v) => /en-US/i.test(v.lang));
  if (preferred) u.voice = preferred;
  window.speechSynthesis.speak(u);
}

// ── 유틸 ────────────────────────────────────────────────
function scrollDown() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
