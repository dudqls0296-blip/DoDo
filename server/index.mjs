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
const AI_KEY = process.env.ANTHROPIC_API_KEY || '';
const AI_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const AI_BASE = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
const YT_KEY = process.env.YOUTUBE_API_KEY || '';
const STATIC = existsSync(join(ROOT, 'dist', 'index.html')) ? join(ROOT, 'dist') : join(ROOT, 'preview');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
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
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/health') return send(res, 200, { ok: true, ai: !!AI_KEY, youtube: !!YT_KEY });

    const task = url.pathname.match(/^\/api\/(question|result|reply)$/)?.[1];
    if (task && req.method === 'POST') {
      if (!AI_KEY) return send(res, 503, { error: 'ai_disabled' });
      if (limited(req.socket.remoteAddress || '')) return send(res, 429, { error: 'rate_limited' });
      const body = await readBody(req, 24_000);
      try {
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
  console.log(`  AI 상담(질문·답장·곡 선택): ${AI_KEY ? `켜짐 (${AI_MODEL})` : '꺼짐 — .env 에 ANTHROPIC_API_KEY 를 넣으면 켜져요. 지금은 내장 질문으로 진행'}`);
  console.log(`  YouTube 확인: ${YT_KEY ? '켜짐' : '꺼짐 — 검증된 큐레이션 목록 사용'}`);
});
