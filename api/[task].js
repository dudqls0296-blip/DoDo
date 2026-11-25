// POST /api/question | /api/result | /api/reply — Google Gemini로 질문·결과·답장을 만든다
import { cors } from './_cors.js';
import { createAi, makeLimiter, TASK_NAMES } from '../shared/ai-core.mjs';

const ai = createAi({ key: process.env.GEMINI_API_KEY || '', model: process.env.GEMINI_MODEL });
const limited = makeLimiter(30);

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const task = String(req.query?.task || '');
  if (!TASK_NAMES.includes(task)) return res.status(404).json({ error: 'not_found' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!ai.enabled) return res.status(503).json({ error: 'ai_disabled' });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (limited(ip)) return res.status(429).json({ error: 'rate_limited' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'bad_request' });
  if (JSON.stringify(body).length > 24_000) return res.status(413).json({ error: 'too_large' });

  try {
    return res.status(200).json(await ai[task](body));
  } catch (e) {
    console.warn(`[고민저장소] Gemini(${task}) 실패:`, e?.message);
    return res.status(502).json({ error: 'ai_failed' });
  }
}
