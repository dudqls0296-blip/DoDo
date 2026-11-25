// 고민저장소 · 결과 만들기 (요약 · 한 걸음 · 추천곡 조건)
// 사용자가 직접 밝힌 내용과 고른 답만 옮긴다. 말하지 않은 사실을 덧붙이지 않는다.
import { ACTIONS, CATEGORIES, HELP_ACTIONS, HELP_CHEER, type Help } from '../data/flow';
import type { CategoryId, Need } from '../data/songs';
import { computeFacts, pickQuote, type Prefs, type Turn } from './conversation';

export interface ResultData {
  lead: string;
  quote: string;
  phrase?: string;
  cheer: string;
  action: string;
  need: Need;
  help?: Help;
  sticking?: string;
  prefs: Prefs;
  crisis: boolean;
  /** AI가 쓴 결과인지 */
  ai?: boolean;
  /** AI 분석: 지금 당신의 마음 */
  emotion?: { label: string; text: string };
  /** AI의 답변 */
  reply?: string;
  /** 작은 조언 */
  advice?: string[];
}

const CRISIS = /(죽고\s?싶|죽을까|자살|자해|사라지고\s?싶|살기\s?싫|없어지고\s?싶|끝내고\s?싶)/;

export function buildResult(category: CategoryId, worry: string, turns: Turn[]): ResultData {
  const facts = computeFacts(worry, turns);
  const cat = CATEGORIES.find((c) => c.id === category)!;
  const quote = pickQuote(worry);

  // 요약: 1) 무엇을 적었는지 2~3) 직접 고르거나 덧붙인 내용
  const sentences: string[] = [`${cat.label}에 관한 고민을 직접 적어주셨어요.`];
  const order = ['sticking', 'event', 'help', 'music'];
  const sorted = [...turns].sort((a, b) => order.indexOf(a.q.slot) - order.indexOf(b.q.slot));
  for (const t of sorted) {
    if (sentences.length >= 3) break;
    if (t.a.kind === 'option') sentences.push(t.a.summary);
    else if (t.a.kind === 'text' && t.a.text.trim()) {
      const tx = t.a.text.trim();
      sentences.push(`“${tx.length > 40 ? tx.slice(0, 38) + '…' : tx}”라고 덧붙였어요.`);
    }
  }
  if (sentences.length === 1) sentences.push('이어지는 질문은 건너뛰었고, 적어준 문장을 그대로 읽고 정리했어요.');

  const help = facts.help;
  const need: Need = facts.music ?? (help === 'push' || help === 'method' ? 'energy' : help === 'listen' ? 'same' : 'calm');

  // 질문에 인용했던 사용자 표현 (있다면)
  const phrase = turns.find((t) => t.q.context && t.q.slot === 'sticking')?.q.context
    || (quote.length <= 24 && !/(노래|곡|음악)/.test(quote) ? quote.replace(/[.!?…]+$/u, '') : undefined);

  const action = (facts.sticking && ACTIONS[facts.sticking]) || HELP_ACTIONS[help ?? 'organize'];
  const short = quote.length <= 32 ? quote.replace(/[.!?。…]+$/u, '') : phrase;
  const cheer = (short ? `“${short}”라고 적은 마음을 오늘 하루에 다 풀지 않아도 돼요. ` : '') + HELP_CHEER[help ?? 'listen'];

  return {
    lead: sentences.join(' '),
    quote,
    phrase,
    cheer,
    action,
    need,
    help,
    sticking: facts.sticking,
    prefs: facts.prefs,
    crisis: CRISIS.test(worry + ' ' + turns.map((t) => (t.a.kind === 'text' ? t.a.text : '')).join(' ')),
  };
}
