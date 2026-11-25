// 고민저장소 · AI 연결 (Google Gemini)
// 브라우저는 AI 키를 갖지 않는다. 고민 문장은 우리 서버(로컬 server/index.mjs 또는
// 서버리스 함수 api/)로만 보내고, 서버가 환경 변수의 GEMINI_API_KEY로 Gemini에 묻는다.
// 서버 주소는 같은 사이트의 /api, 또는 config.json 의 apiBase(GitHub Pages용)이다.
import type { QA } from '../../shared/prompts.mjs';
import { apiUrl, getServerInfo } from './conversation';

export type Provider = 'server' | null;

let providerPromise: Promise<Provider> | null = null;
export function getProvider(): Promise<Provider> {
  if (!providerPromise) providerPromise = getServerInfo().then((info) => (info.ai ? 'server' : null));
  return providerPromise;
}

export type AiError = 'unavailable' | 'network' | 'timeout' | 'rate_limited' | 'failed';
export class AiFailure extends Error { constructor(public reason: AiError) { super(reason); } }

async function call(task: 'question' | 'result' | 'reply', body: unknown, timeoutMs: number): Promise<any> {
  if (!(await getProvider())) throw new AiFailure('unavailable');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(await apiUrl(`/api/${task}`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    if (r.status === 429) throw new AiFailure('rate_limited');
    if (r.status === 503) throw new AiFailure('unavailable');
    if (!r.ok) throw new AiFailure('failed');
    return await r.json();
  } catch (e: any) {
    if (e instanceof AiFailure) throw e;
    if (e?.name === 'AbortError') throw new AiFailure('timeout');
    throw new AiFailure('network');
  } finally {
    clearTimeout(timer);
  }
}

/** 실패해도 흐름이 멈추지 않아야 하는 곳(후속 질문·답장)용: 실패하면 null */
async function soft(task: 'question' | 'reply', body: unknown, timeoutMs: number) {
  try { return await call(task, body, timeoutMs); } catch { return null; }
}

export function aiQuestion(a: { category: string; worry: string; turns: QA[]; slot: string }) {
  return soft('question', a, 16000);
}

export interface Candidate { id: string; title: string; artist: string; lang: string; needs: string[]; sound: string; story: string }
/** 결과(감정·정리·답변·조언·음악 3곡). 실패하면 AiFailure를 던진다 */
export function aiResult(a: { category: string; worry: string; turns: QA[]; need: string; prefs: { lang?: string; vocal?: string }; candidates: Candidate[] }) {
  return call('result', a, 40000);
}

export function aiReply(a: { category: string; worry: string; summary: string; chat: { role: 'user' | 'assistant'; text: string }[] }) {
  return soft('reply', a, 25000);
}

export const providerNote = (p: Provider) =>
  p === 'server' ? '적은 고민 문장이 분석과 답변을 만들기 위해 이 사이트의 서버를 거쳐 Google Gemini로 전송돼요.' : '';

export const AI_ERROR_TEXT: Record<AiError, string> = {
  unavailable: 'AI 서버가 아직 연결되어 있지 않거나 잠시 꺼져 있어요.',
  network: '네트워크 문제로 AI에 연결하지 못했어요. 인터넷 연결을 확인해주세요.',
  timeout: 'AI 응답이 너무 오래 걸려 멈췄어요.',
  rate_limited: '짧은 시간에 요청이 너무 많았어요. 1분쯤 뒤에 다시 시도해주세요.',
  failed: 'AI가 답변을 만들지 못했어요.',
};
