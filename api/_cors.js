// 고민저장소 · 서버리스 공통 (CORS · 응답)
// GitHub Pages(정적 사이트)에서 이 함수를 부를 수 있도록 허용할 주소만 열어둔다.
const DEFAULT_ORIGINS = ['https://dudqls0296-blip.github.io', 'http://localhost:5173', 'http://localhost:8787', 'http://127.0.0.1:8787'];

export function cors(req, res) {
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const list = allowed.length ? allowed : DEFAULT_ORIGINS;
  const origin = req.headers.origin || '';
  if (list.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  return false;
}
