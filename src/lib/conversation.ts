// 고민저장소 · 이어지는 질문 엔진
// 첫 답에서 이미 말한 것(상황·마음에 걸리는 부분·원하는 도움·노래 방향)을 파악하고,
// 빠진 것만 사용자가 쓴 표현을 바탕으로 한 번에 하나씩 묻는다. 1~3문항 안에서 끝낸다.
import { EVENT_Q, GENERIC_STICKING, HELP_OPTIONS, MUSIC_OPTIONS, PATTERNS, CATEGORIES, type Help, type Option, type Slot } from '../data/flow';
import type { CategoryId, Lang, Need } from '../data/songs';

export interface Question {
  id: string;
  slot: Slot;
  /** 사용자의 표현을 그대로 인용한 부분 */
  context?: string;
  text: string;
  options: Option[];
  source: 'local' | 'ai';
}

export type Answer =
  | { kind: 'option'; value: string; label: string; summary: string }
  | { kind: 'text'; text: string }
  | { kind: 'skip' };

export interface Turn { q: Question; a: Answer }

export interface Prefs { lang: Lang | 'any'; vocal: 'any' | 'vocal' | 'inst' }

export interface Facts {
  event?: string;
  sticking?: string;
  help?: Help;
  music?: Need;
  prefs: Prefs;
  /** 질문에서 다룬 슬롯 (건너뛰기 포함) */
  covered: Set<Slot>;
}

export const MAX_Q = 3;

// ── 문장에서 이미 말한 것 찾기 ──
const HELP_RX: [Help, RegExp][] = [
  ['listen', /(들어\s?줬으면|들어\s?주면|들어줄|털어놓|공감해|위로가?\s?필요|위로받|알아줬으면)/],
  ['method', /(방법을?\s?알|어떻게\s?해야\s?할지|조언|해결하고|알려\s?줬으면|해결책)/],
  ['organize', /(정리하고|정리가\s?안|생각이\s?너무\s?많|머리가\s?복잡)/],
  ['push', /(힘을\s?내고|힘내고\s?싶|동기\s?부여|다시\s?시작하고|의지를\s?갖고)/],
];
const MUSIC_RX: [Need, RegExp][] = [
  ['calm', /(잔잔한|조용한|편안한|차분한|마음이\s?편해지는)\s?(노래|곡|음악)/],
  ['energy', /(신나는|힘\s?나는|힘이\s?나는|텐션|빠른|집중(할|되는|하기\s?좋은))\s?(노래|곡|음악)/],
  ['same', /(슬픈|공감되는|우울한|비슷한\s?기분의?)\s?(노래|곡|음악)/],
];
const STICKING_SAID = /(가장|제일|특히|무엇보다)\s?(\S+\s)?(걸리|힘든|힘들|무서|걱정|싫|괴로|속상)/;

export function detectPrefs(text: string, base: Prefs = { lang: 'any', vocal: 'any' }): Prefs {
  const p = { ...base };
  if (/(가사\s?없|가사가\s?없|연주곡|피아노\s?곡|클래식|보컬\s?없)/.test(text)) p.vocal = 'inst';
  else if (/(가사\s?있는|목소리가?\s?있는|보컬\s?있는)/.test(text)) p.vocal = 'vocal';
  if (/(팝송|영어\s?노래|해외\s?노래|외국\s?노래)/.test(text)) p.lang = 'en';
  else if (/(케이팝|k-?pop|한국\s?노래|국내\s?노래|가요)/i.test(text)) p.lang = 'ko';
  return p;
}

function detectHelp(text: string): Help | undefined {
  return HELP_RX.find(([, rx]) => rx.test(text))?.[0];
}
function detectMusic(text: string): Need | undefined {
  return MUSIC_RX.find(([, rx]) => rx.test(text))?.[0];
}

/** 정규식의 최상위 대안(a|b|c)을 순서대로 시도해, 앞에 적은 대안을 우선한다 */
function firstAlternative(text: string, rx: RegExp): RegExpMatchArray | null {
  const src = rx.source.replace(/^\(/, '').replace(/\)$/, '');
  const alts: string[] = [];
  let depth = 0, cur = '';
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '\\') { cur += ch + src[i + 1]; i++; continue; }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === '|' && depth === 0) { alts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  alts.push(cur);
  for (const a of alts) {
    try { const m = text.match(new RegExp(a, rx.flags)); if (m) return m; } catch { /* noop */ }
  }
  return text.match(rx);
}

/** 일치한 표현이 들어 있는 짧은 절을 원문 그대로 인용한다 (예: ‘한 시간씩 멍하니’) */
export function phraseAround(text: string, m: RegExpMatchArray): string {
  const start = m.index ?? 0;
  // 왼쪽: 쉼표·마침표나 연결 어미(-는데, -지만, -고, -도, -서) 뒤에서 끊는다. 최대 두 어절.
  const before = text.slice(0, start);
  const words = before.split(/(\s+)/);
  let s = start, taken = 0;
  for (let i = words.length - 1; i >= 0 && taken < 2; i--) {
    const w = words[i];
    if (!w) continue;
    if (/^\s+$/.test(w)) { s -= w.length; continue; }
    if (/[,.!?…]$/.test(w) || /(는데|은데|인데|지만|하고|해서|어서|아서|펴도|해도|어도|아도|니까)$/.test(w)) break;
    s -= w.length; taken++;
  }
  // 오른쪽: 어절 끝까지, 부정어(안·못·잘)로 끝나면 한 어절 더
  let e = start + m[0].length;
  const grab = () => { const r = text.slice(e).match(/^[^\s.,!?…~"'”’)\]]*/u); if (r) e += r[0].length; };
  grab();
  if (/(안|못|잘)$/.test(text.slice(s, e))) { const sp = text.slice(e).match(/^\s+/); if (sp) { e += sp[0].length; grab(); } }
  // 말이 끝나는 자리(-요, -다, -는데, -고, -서 …)까지 자연스럽게 늘린다
  const END = /(요|다|죠|는데|은데|인데|지만|하고|해서|어서|아서|니까|[,.!?…])$/;
  for (let k = 0; k < 4; k++) {
    const cur = text.slice(s, e);
    if (END.test(cur) || cur.length >= 22) break;
    if (cur.length >= 10 && /(로|에|서|도|고)$/.test(cur)) break;
    const sp = text.slice(e).match(/^\s+/); if (!sp) break;
    const save = e; e += sp[0].length; grab();
    if (text.slice(s, e).length > 26) { e = save; break; }
  }
  let out = text.slice(s, e).trim().replace(/^[\s,.!?…]+|[\s,.!?…]+$/gu, '');
  if (out.length > 24) out = text.slice(start, e).trim();
  return out;
}

export function computeFacts(worry: string, turns: Turn[]): Facts {
  const facts: Facts = { prefs: detectPrefs(worry), covered: new Set() };
  facts.help = detectHelp(worry);
  facts.music = detectMusic(worry);
  if (STICKING_SAID.test(worry)) facts.sticking = 'said';
  for (const t of turns) {
    facts.covered.add(t.q.slot);
    const a = t.a;
    if (a.kind === 'option') {
      if (t.q.slot === 'event') facts.event = a.value;
      if (t.q.slot === 'sticking') facts.sticking = a.value;
      if (t.q.slot === 'help') facts.help = a.value.split('#')[0] as Help;
      if (t.q.slot === 'music') facts.music = a.value as Need;
    } else if (a.kind === 'text') {
      if (t.q.slot === 'sticking') facts.sticking = 'text';
      if (t.q.slot === 'event') facts.event = 'text';
      facts.help = facts.help ?? detectHelp(a.text);
      facts.music = facts.music ?? detectMusic(a.text);
      if (t.q.slot === 'help' && !facts.help) facts.help = 'listen';
      facts.prefs = detectPrefs(a.text, facts.prefs);
    }
  }
  return facts;
}

/** 아직 필요한 슬롯 목록 (묻는 순서대로) */
export function missingSlots(worry: string, facts: Facts): Slot[] {
  const out: Slot[] = [];
  const short = worry.replace(/\s/g, '').length < 12;
  if (short && !facts.covered.has('event') && !facts.event) out.push('event');
  if (!facts.sticking && !facts.covered.has('sticking')) out.push('sticking');
  if (!facts.help && !facts.covered.has('help')) out.push('help');
  if (!facts.music && !facts.covered.has('music')) out.push('music');
  return out;
}

/** 다음에 물을 슬롯. 노래 방향이 불분명하면 마지막 자리는 항상 노래 질문이 된다. */
export function nextSlot(worry: string, turns: Turn[]): Slot | null {
  if (turns.length >= MAX_Q) return null;
  const facts = computeFacts(worry, turns);
  const miss = missingSlots(worry, facts);
  if (!miss.length) return turns.length === 0 ? null : null;
  const left = MAX_Q - turns.length;
  if (miss.includes('music') && left === 1) return 'music';
  return miss[0];
}

export function localQuestion(category: CategoryId, worry: string, slot: Slot): Question {
  const cat = CATEGORIES.find((c) => c.id === category)!;
  if (slot === 'event') {
    return {
      id: `event:${category}`, slot, source: 'local',
      context: worry.trim(),
      text: '조금만 더 들려줄래요? 지금 어떤 상황에 가까워요?',
      options: EVENT_Q[category],
    };
  }
  if (slot === 'sticking') {
    for (const p of PATTERNS[category]) {
      const m = p.test.test(worry) ? firstAlternative(worry, p.test) : null;
      if (m) {
        const phrase = phraseAround(worry, m);
        return { id: `sticking:${category}:${p.id}`, slot, source: 'local', context: phrase, text: p.text(phrase), options: p.options };
      }
    }
    const g = GENERIC_STICKING[category];
    return { id: `sticking:${category}:generic`, slot, source: 'local', text: g.text, options: g.options };
  }
  if (slot === 'help') {
    return {
      id: 'help', slot, source: 'local',
      text: `이 ${cat.label} 고민에서, 지금 가장 받고 싶은 도움은 무엇에 가까워요?`,
      options: HELP_OPTIONS,
    };
  }
  return { id: 'music', slot, source: 'local', text: '지금 어떤 노래가 필요해요?', options: MUSIC_OPTIONS };
}

// ── 서버 AI 연동 (선택) ──
export interface ServerInfo { ok: boolean; ai: boolean; youtube: boolean }
let serverInfo: Promise<ServerInfo> | null = null;

/** AI 서버 주소. GitHub Pages처럼 서버가 없는 곳에서는 config.json 의 apiBase(서버리스 함수 주소)를 쓴다 */
let apiBasePromise: Promise<string> | null = null;
export function getApiBase(): Promise<string> {
  if (!apiBasePromise) {
    apiBasePromise = (async () => {
      try {
        const r = await fetch('./config.json', { cache: 'no-store' });
        if (!r.ok) return '';
        const j = await r.json();
        const b = typeof j?.apiBase === 'string' ? j.apiBase.trim().replace(/\/+$/, '') : '';
        return /^https:\/\//.test(b) || /^http:\/\/(localhost|127\.0\.0\.1)/.test(b) ? b : '';
      } catch { return ''; }
    })();
  }
  return apiBasePromise;
}
export async function apiUrl(path: string) { return (await getApiBase()) + path; }

export function getServerInfo(): Promise<ServerInfo> {
  if (!serverInfo) {
    serverInfo = (async () => {
      if (location.protocol === 'file:') return { ok: false, ai: false, youtube: false };
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 6000);
        const r = await fetch(await apiUrl('/api/health'), { signal: ctrl.signal });
        clearTimeout(t);
        if (!r.ok) throw new Error();
        const j = await r.json();
        return { ok: true, ai: !!j.ai, youtube: !!j.youtube };
      } catch {
        return { ok: false, ai: false, youtube: false };
      }
    })();
  }
  return serverInfo;
}

const HELPS = ['listen', 'organize', 'method', 'push'];

function fromAi(j: any, worry: string, slot: Slot): Question | null {
  if (!j || j.skip) return null;
  const text = typeof j.question === 'string' ? j.question.trim() : typeof j.text === 'string' ? j.text.trim() : '';
  const opts = Array.isArray(j.options) ? j.options : [];
  if (text.length < 6 || text.length > 160 || opts.length < 2 || opts.length > 4) return null;
  if (!opts.every((o: any) => typeof o?.label === 'string' && o.label.trim().length > 0 && o.label.length <= 40)) return null;
  if (slot === 'help' && !opts.every((o: any) => HELPS.includes(o.help))) return null;
  // AI가 인용한 표현이 실제 원문에 없으면 인용을 버린다 (말하지 않은 사실을 덧붙이지 않기)
  const context = typeof j.context === 'string' && j.context.trim() && worry.includes(j.context.trim()) ? j.context.trim() : undefined;
  let h = 0;
  for (const ch of worry + slot) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return {
    id: `${slot}:ai:${(h >>> 0).toString(36)}`,
    slot, source: 'ai', context, text,
    options: opts.slice(0, 4).map((o: any, i: number) => ({
      label: o.label.trim(),
      value: slot === 'help' ? `${o.help}#${i}` : `ai${i}`,
      summary: typeof o.summary === 'string' && o.summary.trim() ? o.summary.trim() : `‘${o.label.trim()}’라고 답했어요.`,
    })),
  };
}

async function aiQuestionFor(category: CategoryId, worry: string, turns: Turn[], slot: Slot): Promise<Question | null> {
  const { aiQuestion } = await import('./ai');
  const j = await aiQuestion({
    category: CATEGORIES.find((c) => c.id === category)?.label || '',
    worry,
    slot,
    turns: turns.map((x) => ({ question: x.q.text, answer: x.a.kind === 'option' ? x.a.label : x.a.kind === 'text' ? x.a.text : '(건너뜀)' })),
  });
  return fromAi(j, worry, slot);
}

/** 다음 질문 만들기. AI 사용이 허락되고 서버가 연결되어 있으면 AI → 실패 시 로컬 풀. */
export async function nextQuestion(category: CategoryId, worry: string, turns: Turn[], useAi: boolean): Promise<Question | null> {
  const slot = nextSlot(worry, turns);
  if (!slot) return null;
  if (useAi && slot !== 'music') {
    const q = await aiQuestionFor(category, worry, turns, slot);
    if (q) return q;
  }
  return localQuestion(category, worry, slot);
}

/** 고민 원문에서 요약에 인용할 짧은 구절 */
export function pickQuote(worry: string): string {
  const all = worry.split(/(?<=[.!?。…])\s+|\n+/u).map((s) => s.trim()).filter((s) => s.length >= 4);
  // 노래 취향을 말한 문장은 인용에서 빼고 고민 내용을 고른다
  const about = all.filter((s) => !/(노래|곡|음악|추천해|플레이리스트)/.test(s));
  const parts = about.length ? about : all;
  if (!parts.length) return worry.trim().slice(0, 60);
  const scored = parts.map((s) => ({ s, k: (/(멍|무서|힘들|싫|모르|걱정|불안|지쳐|외로|부족|떨어|못)/.test(s) ? 2 : 0) - Math.abs(s.length - 34) / 40 }));
  scored.sort((a, b) => b.k - a.k);
  let q = scored[0].s;
  if (q.length > 70) {
    const cut = q.split(/(?<=[,，])\s*/)[0];
    q = cut.length >= 8 && cut.length <= 70 ? cut.replace(/,$/, '') + '…' : q.slice(0, 68) + '…';
  }
  return q;
}
