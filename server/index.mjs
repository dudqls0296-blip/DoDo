// 고민저장소 서버 (의존성 없음, Node 18+)
// - 정적 파일: dist/ (vite build 결과)가 있으면 그것을, 없으면 preview/ 를 제공
// - POST /api/question : 고민 원문 기반 후속 질문 생성 (ANTHROPIC_API_KEY 필요)
// - GET  /api/youtube/check?ids=a,b : 영상 존재·삽입 가능 여부 확인 (YOUTUBE_API_KEY 선택)
// - GET  /api/health
// API 키는 서버 환경 변수(.env)에만 둔다. 브라우저로 내려보내지 않는다.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QUESTION_SYSTEM, questionUser, RESULT_SYSTEM, resultUser, REPLY_SYSTEM, replyUser, parseJson } from '../shared/prompts.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// .env 읽기 (간단한 KEY=VALUE 형식)
const envFile = join(ROOT, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const PORT = Number(process.env.PORT || 8787);
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const AI_KEY = process.env.ANTHROPIC_API_KEY || '';
const AI_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const AI_BASE = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
const YT_KEY = process.env.YOUTUBE_API_KEY || '';
const STATIC = existsSync(join(ROOT, 'dist', 'index.html')) ? join(ROOT, 'dist') : join(ROOT, 'preview');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

async function readBody(req, limit = 16_000) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw Object.assign(new Error('too large'), { code: 413 });
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

// 같은 IP에서 1분에 30번까지만 (로컬·소규모 배포용 간단 제한)
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 30;
}

const clip = (v, n) => String(v ?? '').slice(0, n);
const cleanTurns = (t) => (Array.isArray(t) ? t.slice(0, 4).map((x) => ({ question: clip(x.question, 200), answer: clip(x.answer, 300) })) : []);

async function claude(system, user, maxTokens) {
  const r = await fetch(`${AI_BASE}/v1/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': AI_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: AI_MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error('ai ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const j = await r.json();
  return parseJson((j.content || []).map((c) => c.text || '').join(''));
}

async function gemini(system, user, maxTokens = 1000) {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY_MISSING');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`;
  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: system ? `${system}\n\n---\n${user}` : user }],
      },
    ],
    generationConfig: {
      response_mime_type: 'application/json',
      temperature: 0.7,
      maxOutputTokens: maxTokens,
    },
  };
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  });
  if (!r.ok) {
    const errText = await r.text().catch(() => '');
    throw new Error(`gemini_error_${r.status}: ${errText.slice(0, 160)}`);
  }
  const j = await r.json();
  const text = j.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('empty_gemini_response');
  return parseJson(text);
}

async function handleGeminiQuestion(b) {
  const category = clip(b.category, 30);
  const worry = clip(b.worry, 1200);
  const turns = cleanTurns(b.turns);
  const slot = ['event', 'sticking', 'help'].includes(b.slot) ? b.slot : 'sticking';
  const raw = await gemini(QUESTION_SYSTEM, questionUser({ category, worry, turns, slot }), 600);
  if (!raw || typeof raw !== 'object') throw new Error('invalid_gemini_question_payload');
  if (raw.skip) {
    return {
      provider: 'gemini',
      model: GEMINI_MODEL,
      stage: 'question',
      result: { skip: true, crisis: !!raw.crisis },
    };
  }
  const question = typeof raw.question === 'string' ? raw.question.trim() : typeof raw.text === 'string' ? raw.text.trim() : '';
  if (!question || question.length < 5) throw new Error('invalid_question_text');
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
  return {
    provider: 'gemini',
    model: GEMINI_MODEL,
    stage: 'question',
    result: { skip: false, context, question, options },
  };
}

async function handleGeminiAnalysis(b) {
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

  const raw = await gemini(RESULT_SYSTEM, resultUser({ category, worry, turns, need, prefs, candidates }), 1000);
  if (!raw || typeof raw !== 'object') throw new Error('invalid_gemini_analysis_payload');
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

  return {
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
  };
}

const TASKS = {
  question: (b) => claude(QUESTION_SYSTEM, questionUser({ category: clip(b.category, 20), worry: clip(b.worry, 1200), turns: cleanTurns(b.turns), slot: ['event', 'sticking', 'help'].includes(b.slot) ? b.slot : 'sticking' }), 500),
  result: (b) => claude(RESULT_SYSTEM, resultUser({
    category: clip(b.category, 20), worry: clip(b.worry, 1200), turns: cleanTurns(b.turns), need: clip(b.need, 20),
    prefs: { lang: clip(b.prefs?.lang, 8), vocal: clip(b.prefs?.vocal, 8) },
    candidates: (Array.isArray(b.candidates) ? b.candidates : []).slice(0, 10).map((c) => ({ id: clip(c.id, 60), title: clip(c.title, 80), artist: clip(c.artist, 60), lang: clip(c.lang, 6), needs: (c.needs || []).map((n) => clip(n, 8)).slice(0, 3), sound: clip(c.sound, 160), story: clip(c.story, 160) })),
  }), 900),
  reply: (b) => claude(REPLY_SYSTEM, replyUser({ category: clip(b.category, 20), worry: clip(b.worry, 1200), summary: clip(b.summary, 600), chat: (Array.isArray(b.chat) ? b.chat : []).slice(-10).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', text: clip(m.text, 600) })) }), 500),
};

async function ytCheck(ids) {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=status,snippet&id=${ids.map(encodeURIComponent).join(',')}&key=${YT_KEY}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error('yt ' + r.status);
  const j = await r.json();
  return Object.fromEntries((j.items || []).map((it) => [it.id, { embeddable: !!it.status?.embeddable, public: it.status?.privacyStatus === 'public', title: it.snippet?.title, channel: it.snippet?.channelTitle }]));
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/health') {
      return send(res, 200, {
        ok: true,
        gemini: !!GEMINI_KEY,
        geminiModel: GEMINI_MODEL,
        ai: !!(GEMINI_KEY || AI_KEY),
        youtube: !!YT_KEY,
      });
    }

    if (url.pathname === '/api/gemini/question' && req.method === 'POST') {
      if (!GEMINI_KEY) return send(res, 503, { error: 'gemini_not_configured', message: 'GEMINI_API_KEY environment variable is not set.' });
      if (limited(req.socket.remoteAddress || '')) return send(res, 429, { error: 'rate_limited' });
      const body = await readBody(req, 24_000);
      try {
        const data = await handleGeminiQuestion(body);
        return send(res, 200, data);
      } catch (e) {
        console.warn(`[고민저장소] Gemini question 실패:`, e.message);
        return send(res, 502, { error: 'gemini_failed', message: e.message });
      }
    }

    if (url.pathname === '/api/gemini/analysis' && req.method === 'POST') {
      if (!GEMINI_KEY) return send(res, 503, { error: 'gemini_not_configured', message: 'GEMINI_API_KEY environment variable is not set.' });
      if (limited(req.socket.remoteAddress || '')) return send(res, 429, { error: 'rate_limited' });
      const body = await readBody(req, 32_000);
      try {
        const data = await handleGeminiAnalysis(body);
        return send(res, 200, data);
      } catch (e) {
        console.warn(`[고민저장소] Gemini analysis 실패:`, e.message);
        return send(res, 502, { error: 'gemini_failed', message: e.message });
      }
    }

    const task = url.pathname.match(/^\/api\/(question|result|reply)$/)?.[1];
    if (task && req.method === 'POST') {
      if (!AI_KEY && !GEMINI_KEY) return send(res, 503, { error: 'ai_disabled' });
      if (limited(req.socket.remoteAddress || '')) return send(res, 429, { error: 'rate_limited' });
      const body = await readBody(req, 24_000);
      try {
        if (task === 'question' && GEMINI_KEY) {
          const gq = await handleGeminiQuestion(body);
          return send(res, 200, gq.result);
        }
        if (task === 'result' && GEMINI_KEY) {
          const ga = await handleGeminiAnalysis(body);
          return send(res, 200, ga.result);
        }
        return send(res, 200, await TASKS[task](body));
      } catch (e) {
        console.warn(`[고민저장소] AI(${task}) 실패:`, e.message);
        return send(res, 502, { error: 'ai_failed' });
      }
    }

    if (url.pathname === '/api/youtube/check') {
      if (!YT_KEY) return send(res, 503, { error: 'youtube_disabled' });
      const ids = (url.searchParams.get('ids') || '').split(',').filter((x) => /^[\w-]{11}$/.test(x)).slice(0, 20);
      if (!ids.length) return send(res, 400, { error: 'no_ids' });
      return send(res, 200, await ytCheck(ids));
    }

    if (url.pathname.startsWith('/api/')) return send(res, 404, { error: 'not_found' });

    // 정적 파일
    let p = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
    if (p.includes('..')) return send(res, 400, 'bad path', 'text/plain');
    let file = join(STATIC, p || 'index.html');
    const s = await stat(file).catch(() => null);
    if (!s || s.isDirectory()) file = join(STATIC, 'index.html');
    const data = await readFile(file);
    return send(res, 200, data, TYPES[extname(file)] || 'application/octet-stream');
  } catch (e) {
    return send(res, e.code === 413 ? 413 : 500, { error: 'server_error' });
  }
});

server.listen(PORT, () => {
  console.log(`고민저장소 → http://localhost:${PORT}`);
  console.log(`  정적 파일: ${STATIC.replace(ROOT, '.')}`);
  console.log(`  Gemini AI (POST /api/gemini/question, /api/gemini/analysis): ${GEMINI_KEY ? `켜짐 (${GEMINI_MODEL})` : '꺼짐 — .env 에 GEMINI_API_KEY 를 넣으면 켜져요'}`);
  console.log(`  YouTube 확인: ${YT_KEY ? '켜짐' : '꺼짐 — 검증된 큐레이션 목록 사용'}`);
});
