// Serverless function for /api/gemini/analysis (Vercel / Node.js)
import { RESULT_SYSTEM, resultUser, parseJson } from '../../shared/prompts.mjs';

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
  const need = clip(b.need, 40) || '조금 편안해지는 곡';
  const prefs = { lang: clip(b.prefs?.lang, 10), vocal: clip(b.prefs?.vocal, 10) };
  const rawCandidates = Array.isArray(b.candidates) ? b.candidates : [];
  const candidates = rawCandidates.slice(0, 12).map((c) => ({
    id: clip(c.id, 60),
    title: clip(c.title, 80),
    artist: clip(c.artist, 60),
    lang: clip(c.lang, 10),
    needs: (c.needs || []).map((n) => clip(n, 12)).slice(0, 3),
    sound: clip(c.sound, 160),
    story: clip(c.story, 160),
  }));

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`;
    const system = RESULT_SYSTEM;
    const user = resultUser({ category, worry, turns, need, prefs, candidates });
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `${system}\n\n---\n${user}` }] }],
        generationConfig: { response_mime_type: 'application/json', temperature: 0.7, maxOutputTokens: 1000 },
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

    const quote = typeof raw.quote === 'string' && raw.quote.trim() ? clip(raw.quote.trim(), 100) : clip(worry.slice(0, 50), 100);
    const summary = typeof raw.summary === 'string' && raw.summary.trim() ? clip(raw.summary.trim(), 800) : '';
    if (!summary || summary.length < 10) throw new Error('invalid_summary');

    let songId = typeof raw.songId === 'string' ? raw.songId.trim() : '';
    if (!candidates.some((c) => c.id === songId)) {
      songId = candidates[0]?.id || 'yiruma-river-flows-in-you';
    }
    const chosenCand = candidates.find((c) => c.id === songId);
    const reason = typeof raw.reason === 'string' && raw.reason.trim() ? clip(raw.reason.trim(), 400) : '';
    const cheer = typeof raw.cheer === 'string' ? clip(raw.cheer.trim(), 300) : '';
    const action = typeof raw.action === 'string' ? clip(raw.action.trim(), 160) : '';

    return res.status(200).json({
      provider: 'gemini',
      model: GEMINI_MODEL,
      stage: 'analysis',
      result: {
        quote,
        summary,
        songId,
        songTitle: chosenCand?.title,
        songArtist: chosenCand?.artist,
        reason,
        cheer,
        action,
      },
    });
  } catch (e) {
    return res.status(502).json({ error: 'gemini_failed', message: e.message });
  }
}
