// GET /api/health — AI가 켜져 있는지만 알려준다 (키 값은 절대 내보내지 않음)
import { cors } from './_cors.js';

export default function handler(req, res) {
  if (cors(req, res)) return;
  res.status(200).json({ ok: true, ai: !!process.env.GEMINI_API_KEY, youtube: false, provider: 'gemini' });
}
