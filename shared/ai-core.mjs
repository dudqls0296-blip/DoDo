// 고민저장소 · AI 핵심 (Google Gemini API)
// 로컬 서버(server/index.mjs)와 서버리스 함수(api/[task].js)가 함께 쓴다.
// API 키는 서버 환경 변수 GEMINI_API_KEY 에만 둔다. 브라우저로는 절대 내려보내지 않는다.
import { QUESTION_SYSTEM, questionUser, RESULT_SYSTEM, resultUser, REPLY_SYSTEM, replyUser, parseJson } from './prompts.mjs';

export const DEFAULT_MODEL = 'gemini-3.7-flash';
const FALLBACK_MODEL = 'gemini-3.5-flash';
const API = (typeof process !== 'undefined' && process.env.GEMINI_API_BASE) || 'https://generativelanguage.googleapis.com/v1beta/models';

const clip = (v, n) => String(v ?? '').slice(0, n);
const cleanTurns = (t) => (Array.isArray(t) ? t.slice(0, 4).map((x) => ({ question: clip(x.question, 200), answer: clip(x.answer, 300) })) : []);

/** Gemini에 한 번 묻고 JSON을 돌려받는다 */
async function callGemini({ key, model }, system, user, { maxTokens = 1500, temperature = 0.9, timeout = 25000 } = {}) {
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: { responseMimeType: 'application/json', temperature, maxOutputTokens: maxTokens },
  };
  const tryModel = async (m) => {
    const r = await fetch(`${API}/${encodeURIComponent(m)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });
    if (!r.ok) {
      const err = new Error(`gemini ${r.status} ${(await r.text()).slice(0, 200)}`);
      err.status = r.status;
      throw err;
    }
    const j = await r.json();
    const text = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
    return parseJson(text);
  };
  try {
    return await tryModel(model);
  } catch (e) {
    // 지정한 모델 이름이 없거나 바뀌었으면 기본 모델로 한 번 더
    if (e.status === 404 && model !== FALLBACK_MODEL) return tryModel(FALLBACK_MODEL);
    throw e;
  }
}

/** 작업별 입력을 정리하고(길이 제한) Gemini에 묻는다 */
export function createAi({ key, model = DEFAULT_MODEL }) {
  const cfg = { key, model: model || DEFAULT_MODEL };
  return {
    enabled: !!key,
    model: cfg.model,
    question: (b) => callGemini(cfg, QUESTION_SYSTEM, questionUser({
      category: clip(b.category, 20), worry: clip(b.worry, 1200), turns: cleanTurns(b.turns),
      slot: ['event', 'sticking', 'help'].includes(b.slot) ? b.slot : 'sticking',
    }), { maxTokens: 1024, temperature: 0.8, timeout: 15000 }),
    result: (b) => callGemini(cfg, RESULT_SYSTEM, resultUser({
      category: clip(b.category, 20), worry: clip(b.worry, 1200), turns: cleanTurns(b.turns), need: clip(b.need, 20),
      prefs: { lang: clip(b.prefs?.lang, 8), vocal: clip(b.prefs?.vocal, 8) },
      candidates: (Array.isArray(b.candidates) ? b.candidates : []).slice(0, 14).map((c) => ({
        id: clip(c.id, 60), title: clip(c.title, 80), artist: clip(c.artist, 60), lang: clip(c.lang, 6),
        needs: (Array.isArray(c.needs) ? c.needs : []).map((n) => clip(n, 8)).slice(0, 3), sound: clip(c.sound, 160), story: clip(c.story, 160),
      })),
    }), { maxTokens: 3000, temperature: 0.9, timeout: 30000 }),
    reply: (b) => callGemini(cfg, REPLY_SYSTEM, replyUser({
      category: clip(b.category, 20), worry: clip(b.worry, 1200), summary: clip(b.summary, 600),
      chat: (Array.isArray(b.chat) ? b.chat : []).slice(-10).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', text: clip(m.text, 600) })),
    }), { maxTokens: 1024, temperature: 0.85, timeout: 20000 }),
  };
}

export const TASK_NAMES = ['question', 'result', 'reply'];

/** 같은 IP에서 1분에 limit번까지만 (인스턴스 안에서의 간단한 제한) */
export function makeLimiter(limit = 30) {
  const hits = new Map();
  return (ip) => {
    const now = Date.now();
    const arr = (hits.get(ip) || []).filter((t) => now - t < 60_000);
    arr.push(now);
    hits.set(ip, arr);
    if (hits.size > 5000) hits.clear();
    return arr.length > limit;
  };
}
