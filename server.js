import "dotenv/config";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json({ limit: "1mb" }));
app.set("trust proxy", true); // skopos.kr 등 리버스 프록시 뒤에서 동작

const PORT = process.env.PORT || 3000;
const MODEL = "claude-opus-4-8";

// 하위 경로 배포 지원: 예) BASE_PATH=/kooenglish → skopos.kr/kooenglish
// 비어 있으면 루트(/)에서 동작합니다.
const BASE_PATH = (process.env.BASE_PATH || "").replace(/\/+$/, "");

const publicDir = path.join(__dirname, "public");
const indexTemplate = fs.readFileSync(path.join(publicDir, "index.html"), "utf8");

// API 키가 없어도 서버는 뜨고, 호출 시점에 안내합니다.
const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

// ── 비즈니스 회화 시나리오 ──────────────────────────────────────────────
// 각 시나리오는 AI가 연기할 "역할"과 상황을 정의합니다.
const SCENARIOS = {
  meeting: {
    title: "팀 회의",
    emoji: "👥",
    desc: "프로젝트 진행 상황을 공유하고 의견을 나누는 회의",
    role: "You are Sarah, a friendly project manager at the user's company. You are running a weekly team meeting and want to hear the user's progress update. Ask about blockers and next steps naturally.",
    opener: "Hi Areum! Thanks for joining. Let's get started — could you give us a quick update on how your part of the project is going?",
  },
  negotiation: {
    title: "협상",
    emoji: "🤝",
    desc: "납품 단가나 일정을 두고 거래처와 조율하는 상황",
    role: "You are Daniel, a procurement manager from a client company. You are negotiating pricing and delivery timelines with the user, who is a vendor. Be reasonable but push for better terms.",
    opener: "Good to see you. Before we sign off, I'd like to revisit the pricing. Your quote came in a bit higher than we expected — can we talk about that?",
  },
  presentation: {
    title: "프레젠테이션 Q&A",
    emoji: "📊",
    desc: "발표 후 청중의 질문에 답하는 상황",
    role: "You are an audience member at the user's business presentation. You ask thoughtful, slightly challenging questions about their proposal. One question at a time.",
    opener: "Thanks for the presentation — it was really insightful. I do have a question: how does your solution scale if our user base doubles next year?",
  },
  interview: {
    title: "영어 면접",
    emoji: "💼",
    desc: "외국계 기업 채용 면접 연습",
    role: "You are Michelle, a hiring manager interviewing the user for a position at a global company. Ask common but realistic interview questions, one at a time, and react warmly to their answers.",
    opener: "Hi Areum, it's great to meet you! Let's begin. Could you start by telling me a little bit about yourself and your background?",
  },
  smalltalk: {
    title: "비즈니스 스몰토크",
    emoji: "☕",
    desc: "회의 전후 가볍게 나누는 친목 대화",
    role: "You are Alex, a colleague from an overseas office, chatting casually with the user before a meeting starts. Keep it light — weekend plans, the weather, recent work, coffee.",
    opener: "Hey! We've still got a few minutes before everyone joins. How's your week going so far?",
  },
  clientcall: {
    title: "고객 응대 전화",
    emoji: "📞",
    desc: "해외 고객의 문의에 응대하는 전화 통화",
    role: "You are James, an overseas customer calling the user (a customer success representative) with a question about a product or service. Be polite but have a real concern to resolve.",
    opener: "Hi, thanks for taking my call. I'm having a bit of trouble with the service we signed up for last month — do you have a moment to help?",
  },
};

// ── 시스템 프롬프트 ─────────────────────────────────────────────────────
function buildSystemPrompt(scenario) {
  return `You are a warm, encouraging business-English conversation partner for a Korean learner named 아름 (Areum). This is a spoken roleplay practice app (like the Speak language app) that her husband built for her.

ABOUT THE LEARNER:
- Her name is 아름 (Areum). You may address her by name naturally and warmly when it fits the role (e.g. greetings).
- Be especially kind and patient. This is a personal gift, so the tone should feel supportive and human.

ROLE FOR THIS SESSION:
${scenario.role}

HOW TO BEHAVE:
- Stay fully in character. Speak natural, professional, conversational business English.
- Keep each reply SHORT — 1 to 3 sentences. This is spoken conversation, not an essay. Ask one question at a time so the learner can respond.
- Match the learner's level: if they write simply, keep your English clear and accessible. Never lecture.
- Always move the conversation forward with a natural follow-up question.

FEEDBACK (very important — this is a learning app):
- After each user message, gently evaluate their English.
- If they made grammar mistakes or used awkward/unnatural phrasing, provide a corrected, more natural version and a SHORT tip explaining it in Korean.
- If their English was already good and natural, set has_feedback to false. Do NOT invent problems or nitpick — only give feedback when it genuinely helps.
- Feedback is about THEIR message, never about your own reply.

You MUST respond using the provided JSON schema. "reply" is what you say out loud in character. "reply_korean" is a natural Korean translation of your reply so the learner can follow along.`;
}

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    reply: {
      type: "string",
      description: "Your in-character spoken reply in English (1-3 sentences).",
    },
    reply_korean: {
      type: "string",
      description: "A natural Korean translation of your reply.",
    },
    feedback: {
      type: "object",
      properties: {
        has_feedback: {
          type: "boolean",
          description: "True only if the user's English genuinely needs improvement.",
        },
        corrected: {
          type: "string",
          description:
            "A more natural/correct version of the user's last message in English. Empty string if has_feedback is false.",
        },
        tip_korean: {
          type: "string",
          description:
            "A short, friendly explanation in Korean of what to improve. Empty string if has_feedback is false.",
        },
      },
      required: ["has_feedback", "corrected", "tip_korean"],
      additionalProperties: false,
    },
  },
  required: ["reply", "reply_korean", "feedback"],
  additionalProperties: false,
};

// ── 라우터 (BASE_PATH 하위에 마운트) ────────────────────────────────────
const router = express.Router();

// index.html — <base href>를 주입해 어떤 경로에서도 자산/요청 경로가 맞도록 함
router.get("/", (_req, res) => {
  const html = indexTemplate.replace(/__BASE_HREF__/g, `${BASE_PATH}/`);
  res.type("html").send(html);
});

// 정적 자산 (자동 index 비활성화 — 위의 주입된 index를 사용)
router.use(express.static(publicDir, { index: false }));

// 헬스체크 (배포 모니터링용)
router.get("/health", (_req, res) => res.json({ ok: true, hasApiKey: Boolean(client) }));

// 사용 가능한 시나리오 목록 (오프너 포함)
router.get("/api/scenarios", (_req, res) => {
  const list = Object.entries(SCENARIOS).map(([id, s]) => ({
    id,
    title: s.title,
    emoji: s.emoji,
    desc: s.desc,
    opener: s.opener,
  }));
  res.json({ scenarios: list, hasApiKey: Boolean(client) });
});

// 대화 한 턴 처리
router.post("/api/chat", async (req, res) => {
  if (!client) {
    return res.status(503).json({
      error:
        "AI 두뇌(Claude API 키)가 아직 설정되지 않았어요. README의 안내대로 .env 파일에 ANTHROPIC_API_KEY를 넣어주세요.",
    });
  }

  const { scenarioId, messages } = req.body || {};
  const scenario = SCENARIOS[scenarioId];
  if (!scenario) {
    return res.status(400).json({ error: "알 수 없는 시나리오예요." });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "대화 내용이 비어 있어요." });
  }

  // 프런트에서 온 {role, content} 메시지를 그대로 사용 (role: user | assistant)
  const apiMessages = messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content }));

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: buildSystemPrompt(scenario),
      messages: apiMessages,
      output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    });

    const text = response.content.find((b) => b.type === "text")?.text ?? "{}";
    const data = JSON.parse(text);
    res.json(data);
  } catch (err) {
    console.error("Claude API error:", err?.message || err);
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(401).json({ error: "API 키가 올바르지 않아요. .env 파일의 ANTHROPIC_API_KEY를 확인해 주세요." });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: "요청이 잠시 많아요. 잠깐 후에 다시 시도해 주세요." });
    }
    res.status(500).json({ error: "AI 응답을 가져오지 못했어요. 잠시 후 다시 시도해 주세요." });
  }
});

app.use(BASE_PATH || "/", router);

// 하위 경로 배포 시, 루트로 들어오면 앱 경로로 안내
if (BASE_PATH) {
  app.get("/", (_req, res) => res.redirect(`${BASE_PATH}/`));
}

app.listen(PORT, () => {
  const where = BASE_PATH || "";
  console.log(`\n💛 KooEnglish 서버 실행 중`);
  console.log(`   ➜  http://localhost:${PORT}${where}/`);
  if (BASE_PATH) console.log(`   (하위 경로 배포: BASE_PATH=${BASE_PATH})`);
  if (!client) {
    console.log(`\n⚠️  아직 ANTHROPIC_API_KEY가 없어요. .env 파일에 키를 넣으면 실제 대화가 작동합니다.`);
    console.log(`   (README.md의 "API 키 발급" 안내를 참고하세요)\n`);
  }
});
