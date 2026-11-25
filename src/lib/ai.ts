// 고민저장소 · AI 연결
// 1) 공유 페이지(claude.ai): claude.use('sample')로 Claude에 직접 묻는다 (API 키 없음, 첫 호출 때 사용자 동의)
// 2) 로컬 서버(npm start / 시작.bat): /api/* 로 묻고, 키는 서버 .env 에만 있다
// 3) 둘 다 없으면 null → 앱은 내장 규칙으로 같은 흐름을 진행한다
import { QUESTION_SYSTEM, questionUser, RESULT_SYSTEM, resultUser, REPLY_SYSTEM, replyUser, parseJson, type QA } from '../../shared/prompts.mjs';
import { getServerInfo } from './conversation';

export type Provider = 'artifact' | 'server' | null;

let samplePromise: Promise<any> | null = null;
function getSample(): Promise<any> {
  if (!samplePromise) {
    const c = (window as any).claude;
    samplePromise = c && typeof c.use === 'function'
      ? Promise.race([c.use('sample'), new Promise((r) => setTimeout(() => r(null), 11000))]).catch(() => null)
      : Promise.resolve(null);
  }
  return samplePromise;
}

let providerPromise: Promise<Provider> | null = null;
export function getProvider(): Promise<Provider> {
  if (!providerPromise) {
    providerPromise = (async () => {
      if (await getSample()) return 'artifact';
      const info = await getServerInfo();
      return info.ai ? 'server' : null;
    })();
  }
  return providerPromise;
}

let blocked = false; // 동의 거절·권한 없음이면 이번 방문에서는 다시 묻지 않는다

async function ask(task: 'question' | 'result' | 'reply', system: string, user: string, body: unknown, timeoutMs: number): Promise<any | null> {
  if (blocked) return null;
  const p = await getProvider();
  if (!p) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    if (p === 'artifact') {
      const sample = await getSample();
      const r = await sample(`${system}\n\n---\n${user}`, { signal: ctrl.signal, modelTier: task === 'question' ? 'quick' : 'default', cache: false });
      return parseJson(r.text);
    }
    const r = await fetch(`/api/${task}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch (e: any) {
    if (e && (e.code === 'not_granted')) blocked = true;
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function aiQuestion(a: { category: string; worry: string; turns: QA[]; slot: string }) {
  return ask('question', QUESTION_SYSTEM, questionUser(a), a, 14000);
}

export interface Candidate { id: string; title: string; artist: string; lang: string; needs: string[]; sound: string; story: string }
export function aiResult(a: { category: string; worry: string; turns: QA[]; need: string; prefs: { lang?: string; vocal?: string }; candidates: Candidate[] }) {
  return ask('result', RESULT_SYSTEM, resultUser(a), a, 25000);
}

export function aiReply(a: { category: string; worry: string; summary: string; chat: { role: 'user' | 'assistant'; text: string }[] }) {
  return ask('reply', REPLY_SYSTEM, replyUser(a), a, 25000);
}

export const providerNote = (p: Provider) =>
  p === 'artifact' ? '적은 고민 문장이 질문과 답장을 만들기 위해 Claude로 전송돼요.'
  : p === 'server' ? '적은 고민 문장이 질문과 답장을 만들기 위해 이 사이트의 서버를 거쳐 AI로 전송돼요.'
  : '';
