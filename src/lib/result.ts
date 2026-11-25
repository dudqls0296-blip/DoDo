// 고민저장소 · 결과 만들기 (질문 종합 분석 · 오늘의 한 걸음 · 추천곡 조건)
// 100% 클라이언트 환경에서 안전하게 동작하며, 외부 API 키나 데이터 유출 없이 사용자의 고민과 질문 답변을 깊이 있게 종합 분석한다.
import { ACTIONS, CATEGORIES, HELP_ACTIONS, HELP_CHEER, type Help } from '../data/flow';
import type { CategoryId, Need } from '../data/songs';
import { computeFacts, pickQuote, type Facts, type Prefs, type Turn } from './conversation';
import { hasBatchim } from './josa';

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
}

const CRISIS = /(죽고\s?싶|죽을까|자살|자해|사라지고\s?싶|살기\s?싫|없어지고\s?싶|끝내고\s?싶)/;

// 마음에 걸리는 부분(sticking)에 대한 심층 원인 진단
const STICKING_DIAGNOSIS: Record<string, string> = {
  lost: '어디서부터 손을 대야 할지 시작점이 보이지 않아 머릿속이 하얘지는 막막함이 가장 큰 부담으로 자리잡고 있어요.',
  noenergy: '의지의 문제라기보다 마음과 몸의 에너지가 이미 바닥나 있어, 시작 버튼을 누를 힘조차 부족한 상태예요.',
  lost_noenergy: '무엇부터 해야 할지 막막한 생각과 이미 바닥난 에너지가 겹쳐, 한 걸음 떼기가 몇 배는 무겁게 느껴지고 있어요.',
  score: '노력의 과정보다 당장 눈앞에 닥친 결과와 점수가 마음에 큰 파도를 일으키고 있어요.',
  others: '내 안의 기준보다 결과를 마주했을 때 전해질 주변의 시선과 반응이 더 무겁게 어깨를 누르고 있어요.',
  score_others: '점수 자체에 대한 걱정과 주변 사람들의 기대라는 두 가지 시선이 동시에 마음에 걸려 있어요.',
  volume: '남은 시간에 비해 감당해야 할 양의 무게가 너무 커서, 압박감에 숨이 가빠지는 순간을 지나고 있어요.',
  order: '할 일은 많은데 우선순위의 실타래가 엉켜 있어 어디를 먼저 잡아야 할지 멈추어 있는 상태예요.',
  compare_skill: '다른 사람의 앞서가는 모습과 나를 나란히 놓으면서, 스스로의 가능성과 실력을 작게 의심하게 되었어요.',
  compare_effort: '나름대로 애쓰고 있음에도 그 노력이 겉으로 드러나지 않아 속상함과 억울함이 마음에 머물러 있어요.',
  start: '시작하기 전 책상 앞에 앉아 첫 발을 떼기까지의 망설임이 가장 큰 벽처럼 느껴지는 순간이에요.',
  focus: '하려는 마음은 분명하지만 자꾸만 집중이 흩어져 스스로를 답답하게 채근하게 되는 상태예요.',
  result: '과정을 지나 마침내 마주하게 될 결과 앞에서 초조함과 불안이 커지는 때예요.',
  blank: '좋아하는 것이나 가고 싶은 방향이 뚜렷하게 떠오르지 않아, 나만 제자리에 서 있는 듯한 불안이 있어요.',
  choose: '마음이 가는 갈래는 여러 가지이지만, 하나의 선택이 가져올 무게 때문에 쉽게 결정을 내리지 못하고 있어요.',
  family_diff: '가장 가까운 가족의 시선과 내가 바라는 삶의 방향이 부딪히며 생기는 고립감이 마음에 걸려 있어요.',
  family_fear: '주변과 가족의 기대를 저버리거나 실망시키고 싶지 않다는 다정한 마음이 도리어 무거운 짐이 되었어요.',
  stuck: '세상은 빠르게 흘러가는데 나만 제자리에 멈추어 뒤처지고 있는 것 같다는 고립감이 자리 잡고 있어요.',
  unsure: '지금 가고 있는 이 길이 과연 내게 맞는 선택인지 확신이 서지 않아 발걸음이 자꾸 무거워져요.',
  fail: '혹시 실패할지도 모른다는 두려움이 첫 걸음을 떼는 순간마다 조심스럽게 발을 멈추게 만들고 있어요.',
  info: '판단할 수 있는 확신과 정보가 부족해 안개 속을 걷는 듯한 답답함이 마음에 있어요.',
  eyes: '선택 앞에서 다른 사람들의 평가와 눈치가 자꾸만 내 진짜 마음보다 앞서 신경 쓰이고 있어요.',
  first_move: '틀어진 관계를 바로잡고 싶지만, 먼저 손을 내밀었을 때 마주할 반응이 두려워 망설여지는 상태예요.',
  their_mind: '상대의 진심이나 속마음을 알 수 없어 마음속에 오해와 답답함이 계속 쌓여가고 있어요.',
  no_one: '속마음을 온전히 털어놓고 함께 나눌 사람이 곁에 없다는 쓸쓸함이 마음을 시리게 하고 있어요.',
  distance: '물리적으로는 곁에 사람이 있어도 마음이 온전히 닿지 않아 군중 속의 외로움을 느끼고 있어요.',
  mistake: '관계 속에서 작은 말실수나 행동 하나가 오해를 만들까 봐 조심스러움이 지나치게 커진 상태예요.',
  disliked: '상대가 나를 싫어하거나 오해하고 있을까 봐 불안해하며 혼자 마음을 졸이고 있어요.',
  unresolved: '아직 지나간 일이나 감정의 매듭이 완전히 풀리지 않아 일상 속에서도 불쑥 마음이 흔들려요.',
  what_to_do: '어떻게 대처해야 할지 분명한 방법을 찾지 못해 혼자 끙끙 앓고 있는 모습이 보여요.',
  specific: '어떤 특정한 사건이나 기억이 마음에 상처를 남겨 스스로를 작게 느끼게 만들었어요.',
  vague: '특별한 계기가 없어도 문득문득 밀려오는 자책과 위축감이 마음을 그늘지게 하고 있어요.',
  envy: '다른 사람이 이룬 빛나는 순간을 보며 상대적 박탈감과 부러움이 마음에 그늘을 만들었어요.',
  cant_see: '남들과 비교하다 보니 정작 내가 가진 장점과 지금까지 걸어온 길을 잊어버리고 있어요.',
  want_someone: '내가 한 노력과 진심을 누군가 알아봐주고 따뜻하게 인정해주기를 바라는 결핍이 있어요.',
  self_praise: '남들에게는 관대하면서도 유독 스스로에게는 칭찬 한마디 건네기 어려워 매섭게 대하고 있어요.',
  days: '지치고 무기력한 기운이 며칠간 맴돌며 일상의 리듬을 흐트러뜨리고 있는 상태예요.',
  weeks: '몇 주 동안 이어진 만성적인 피로가 마음에 누적되어 회복할 여유를 주지 않고 있어요.',
  months: '몇 달 넘게 스스로를 돌보지 못한 채 달려오느라 마음에 깊은 쉼표가 절실히 필요한 상태예요.',
  no_rest: '몸은 쉬고 있지만 머릿속의 걱정과 스위치가 꺼지지 않아 진정한 쉼을 누리지 못하고 있어요.',
  body: '육체적인 피로가 한계에 다다라 마음의 여유까지 함께 좁아져 있는 상태예요.',
  mind: '몸보다 마음의 탈진이 먼저 찾아와, 아무것도 채워 넣을 수 없을 만큼 텅 빈 기분을 느끼고 있어요.',
  feeling: '그 순간 느꼈던 생생한 감정이 마음 한구석에 오랫동안 남아 파도를 일으키고 있어요.',
  future: '앞으로 어떤 일이 벌어질지 모른다는 불확실성이 불안의 불씨를 지피고 있어요.',
  people: '복잡하게 얽힌 사람들과의 관계 속에서 마음의 거리를 정하지 못해 고민하고 있어요.',
};

// 원하는 도움(help)에 따른 정서적 솔루션 방향
const HELP_INSIGHT: Record<Help, string> = {
  listen: '지금 당신에게 필요한 것은 서두른 해결책이나 성급한 위로가 아니라, 그동안 애써온 내 마음을 있는 그대로 인정받고 깊이 털어놓는 시간이에요.',
  organize: '엉켜 있는 생각들을 한 번에 풀려 하지 말고, 오늘 내가 통제할 수 있는 것과 없는 것을 분리해 머릿속을 차분히 정돈하는 여유가 필요해요.',
  method: '막연한 다짐보다는 오늘 바로 손에 쥘 수 있는 아주 작고 구체적인 한 걸음이 복잡한 마음을 풀어줄 실마리가 되어줄 거예요.',
  push: '지친 마음을 따뜻하게 안아준 뒤, 멈추어 있던 내 안의 엔진에 다시 시동을 걸 수 있는 다정한 응원과 활력이 필요한 때예요.',
};

// 음악 성향(need)에 따른 연결 문장
const NEED_BRIDGE: Record<Need, string> = {
  same: '서둘러 밝아지려 애쓰기보다 지금 마음에 조용히 곁을 내어주는, 공감과 위로의 노래를 준비했어요.',
  calm: '가쁜 숨을 고르고 마음의 속도를 한 템포 늦출 수 있도록, 잔잔하고 평온한 울림의 음악을 전해드려요.',
  energy: '무거운 마음을 털어내고 다시 앞으로 나아갈 용기를 채워줄 수 있도록, 힘차고 벅차오르는 노래를 골랐어요.',
};

/** 질문과 답변을 종합하여 깊이 있는 맞춤 분석 편지 생성 */
function synthesizeLead(category: CategoryId, worry: string, facts: Facts, quote: string): string {
  const cat = CATEGORIES.find((c) => c.id === category)!;
  const parts: string[] = [];

  // 1. 공감 및 상황 진단
  const shortQuote = quote.length <= 28 ? quote.replace(/[.!?…]+$/u, '') : '';
  if (shortQuote) {
    const josa = hasBatchim(shortQuote) ? '이라며' : '라며';
    parts.push(`“${shortQuote}”${josa} 적어주신 문장에서, ${cat.label}의 무게 앞에 혼자 멈춰 서 있는 마음이 깊이 와닿아요.`);
  } else {
    parts.push(`${cat.label}에 대해 직접 적어주신 문장에서, 마음속에 오랫동안 품어온 고민의 무게가 고스란히 전해져요.`);
  }

  // 2. 마음에 걸리는 구체적 지점 종합 분석
  if (facts.sticking && STICKING_DIAGNOSIS[facts.sticking]) {
    parts.push(STICKING_DIAGNOSIS[facts.sticking]);
  } else if (facts.event) {
    parts.push('상황을 마주하며 혼자 짊어져온 감정의 무게가 결코 가볍지 않았음을 보여주고 있어요.');
  }

  // 3. 바라는 도움에 대한 분석과 처방
  const helpKey = facts.help ?? 'organize';
  parts.push(HELP_INSIGHT[helpKey]);

  // 4. 음악적 처방 연결
  const needKey: Need = facts.music ?? (helpKey === 'push' || helpKey === 'method' ? 'energy' : helpKey === 'listen' ? 'same' : 'calm');
  parts.push(NEED_BRIDGE[needKey]);

  return parts.join(' ');
}

export function buildResult(category: CategoryId, worry: string, turns: Turn[]): ResultData {
  const facts = computeFacts(worry, turns);
  const quote = pickQuote(worry);

  const help = facts.help;
  const need: Need = facts.music ?? (help === 'push' || help === 'method' ? 'energy' : help === 'listen' ? 'same' : 'calm');

  // 질문에 인용했던 사용자 표현 (있다면)
  const phrase = turns.find((t) => t.q.context && t.q.slot === 'sticking')?.q.context
    || (quote.length <= 24 && !/(노래|곡|음악)/.test(quote) ? quote.replace(/[.!?…]+$/u, '') : undefined);

  // 질문과 답변 전체를 종합 분석하여 깊이 있는 분석문 도출
  const lead = synthesizeLead(category, worry, facts, quote);

  const action = (facts.sticking && ACTIONS[facts.sticking]) || HELP_ACTIONS[help ?? 'organize'];
  const short = quote.length <= 32 ? quote.replace(/[.!?。…]+$/u, '') : phrase;
  const cheer = (short ? `“${short}”라고 적은 마음을 오늘 하루에 다 풀지 않아도 돼요. ` : '') + HELP_CHEER[help ?? 'listen'];

  return {
    lead,
    quote,
    phrase,
    cheer,
    action,
    need,
    help,
    sticking: facts.sticking,
    prefs: facts.prefs,
    crisis: CRISIS.test(worry + ' ' + turns.map((t) => (t.a.kind === 'text' ? t.a.text : '')).join(' ')),
    ai: false,
  };
}
