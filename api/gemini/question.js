// Serverless function for /api/gemini/question (Vercel / Node.js)
import { QUESTION_SYSTEM, questionUser, parseJson } from '../../shared/prompts.mjs';

const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const clip = (v, n) => String(v ?? '').slice(0, n);
const cleanTurns = (t) => (Array.isArray(t) ? t.slice(0, 4).map((x) => ({ question: clip(x.question, 200), answer: clip(x.answer, 300) })) : []);

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!GEMINI_KEY) return res.status(503).json({ error: 'gemini_not_configured', message: 'GEMINI_API_KEY is not set' });

  const b = req.body || {};
  const category = clip(b.category, 30);
  const worry = clip(b.worry, 1200);
  const turns = cleanTurns(b.turns);
  const slot = ['event', 'sticking', 'help'].includes(b.slot) ? b.slot : 'sticking';

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`;
    const system = QUESTION_SYSTEM;
    const user = questionUser({ category, worry, turns, slot });
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `${system}\n\n---\n${user}` }] }],
        generationConfig: { response_mime_type: 'application/json', temperature: 0.7, maxOutputTokens: 600 },
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!r.ok) {
      const err = await r.text().catch(() => '');
      return res.status(502).json({ error: 'gemini_failed', message: err.slice(0, 160) });
    }
    const j = await r.json();
    const text = j.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('empty_gemini_response');
    const raw = parseJson(text);

    if (raw.skip) {
      return res.status(200).json({
        provider: 'gemini',
        model: GEMINI_MODEL,
        stage: 'question',
        result: { skip: true, crisis: !!raw.crisis },
      });
    }

    const question = typeof raw.question === 'string' ? raw.question.trim() : typeof raw.text === 'string' ? raw.text.trim() : '';
    const options = Array.isArray(raw.options)
      ? raw.options
          .filter((o) => typeof o?.label === 'string' && o.label.trim())
          .map((o) => ({
            label: clip(o.label.trim(), 40),
            summary: clip(typeof o.summary === 'string' && o.summary.trim() ? o.summary.trim() : `${o.label.trim()}라고 했어요.`, 100),
            help: clip(o.help, 20),
          }))
      : [];
    const context = typeof raw.context === 'string' && raw.context.trim() ? clip(raw.context.trim(), 50) : undefined;

    return res.status(200).json({
      provider: 'gemini',
      model: GEMINI_MODEL,
      stage: 'question',
      result: { skip: false, context, question, options },
    });
  } catch (e) {
    return res.status(502).json({ error: 'gemini_failed', message: e.message });
  }
}
