// 고민저장소 · 답변 기반 요약 (로컬 규칙 기반 분석)
// 선택지 분기 + 자유 입력 키워드만으로 결과를 만든다. 고민 원문은 브라우저 밖으로 나가지 않는다.
import { ARCHETYPES, QUESTIONS, TRACKS, type ArchetypeCode, type TrackId, type Archetype } from '../data/content';
import { j, hasBatchim } from './josa';
const ira = (w: string) => `‘${w}’${hasBatchim(w) ? '이라는' : '라는'}`;
const irago = (w: string) => `‘${w}’${hasBatchim(w) ? '이라고' : '라고'}`;

export type StepKey = 'worry' | 'comfort' | 'vision' | 'habit';
export type Answers = Partial<Record<StepKey, string>>;
export type Notes = Partial<Record<StepKey, string>>;

interface KeywordGroup {
  id: string;
  words: string[];
  weight: Partial<Record<ArchetypeCode, number>>;
  metric: Partial<Record<keyof Archetype['metrics'], number>>;
  reading: (w: string) => string;
  tag: string;
  /** 문장에서 어절 끝까지 늘려 인용할지 */
  extend?: boolean;
}

const GROUPS: KeywordGroup[] = [
  {
    id: 'anxiety', extend: true, words: ['불안', '걱정', '무서', '두려', '초조', '막막', '겁나'],
    weight: { CALM: 1 }, metric: { reflection: 2 }, tag: '#불안을_다루는_연습',
    reading: (w) => `${ira(w)} 말이 문장에 들어 있어요. 그래서 이 요약은 답을 서둘러 내기보다, 불안이 커지는 시간을 조금 줄이는 쪽에 무게를 두었어요.`,
  },
  {
    id: 'tired', extend: true, words: ['지쳐', '지친', '지침', '피곤', '힘들', '무기력', '귀찮', '하기 싫', '번아웃', '멍해', '아무것도'],
    weight: { CALM: 1, IRON: 1 }, metric: { resilience: -3 }, tag: '#에너지_아껴쓰기',
    reading: (w) => `${irago(w)} 적어주셨어요. 지금은 더 애쓰는 방법보다, 남은 힘을 아껴 쓰는 방법을 먼저 골랐어요.`,
  },
  {
    id: 'compare', extend: true, words: ['비교', '남들', '다들', '뒤처', '나만', '다른 애들', '친구들은'],
    weight: { DRIV: 1, HOPE: 1 }, metric: { focus: -2 }, tag: '#내_속도',
    reading: (w) => `${ira(w)} 표현에서 다른 사람과 나를 나란히 놓고 보는 장면이 보여요. 그래서 기준을 바깥이 아니라 어제의 나에게 두는 행동을 제안해요.`,
  },
  {
    id: 'lonely', extend: true, words: ['외로', '혼자', '아무도', '말할 사람', '털어놓'],
    weight: { HOPE: 2 }, metric: { reflection: 1 }, tag: '#말할_곳',
    reading: (w) => `${ira(w)} 말이 있어요. 혼자 감당하는 시간이 길었다는 뜻일 수 있어서, 오늘의 한 걸음에 이야기를 꺼내놓는 방법을 함께 담았어요.`,
  },
  {
    id: 'unsure', extend: true, words: ['모르겠', '모르는', '헷갈', '뭘 해야', '무엇을 해야', '어떻게 해야', '갈피'],
    weight: { DRIV: 2 }, metric: { action: -2, reflection: 2 }, tag: '#작은_확인',
    reading: (w) => `${irago(w)} 적었어요. 아직 모르는 상태 자체는 문제가 아니에요. 다만 막연함이 길어지지 않도록, 확인해볼 수 있는 작은 단위로 나눠 정리했어요.`,
  },
  {
    id: 'pressure', words: ['시험', '성적', '점수', '등급', '수능', '입시', '내신', '공부', '과제'],
    weight: { IRON: 1, DRIV: 1 }, metric: { focus: 2 }, tag: '#결과보다_과정',
    reading: (w) => `문장에 ‘${w}’ 이야기가 나와요. 결과를 당장 바꿀 수는 없으니, 오늘 내가 쥘 수 있는 과정 하나에 집중하도록 정리했어요.`,
  },
  {
    id: 'family', words: ['부모', '엄마', '아빠', '가족', '집에서', '기대'],
    weight: { HOPE: 1 }, metric: {}, tag: '#기대와_나',
    reading: (w) => `${ira(w)} 단어가 보여요. 가까운 사람의 기대와 내 바람을 따로 적어보면, 무엇이 내 고민인지 조금 더 또렷해져요.`,
  },
  {
    id: 'people', words: ['친구', '관계', '시선', '눈치', '평가', '미움', '싫어할'],
    weight: { HOPE: 2 }, metric: {}, tag: '#관계의_거리',
    reading: (w) => `‘${w}’ 이야기가 나와요. 다른 사람의 반응은 내가 정할 수 없는 영역이라, 내가 정할 수 있는 말과 행동 쪽으로 시선을 옮겨보는 행동을 골랐어요.`,
  },
  {
    id: 'sleep', words: ['잠', '새벽', '밤에', '밤마다', '수면', '못 자'],
    weight: { CALM: 1 }, metric: { resilience: -1 }, tag: '#밤의_정리',
    reading: (w) => `‘${w}’ 이야기가 있어요. 고민이 밤에 커지는 편이라면, 잠들기 전 시간을 정리하는 루틴이 도움이 될 수 있어요.`,
  },
  {
    id: 'phone', words: ['휴대폰', '핸드폰', '폰', '스마트폰', '유튜브', '인스타', '쇼츠', 'sns', 'SNS', '게임'],
    weight: { CALM: 1 }, metric: { focus: -2 }, tag: '#화면_끄기',
    reading: (w) => `${j(`‘${w}’`, '을/를')} 적어주셨어요. 의지만으로 줄이기보다, 손이 닿지 않는 거리를 만드는 방법을 먼저 제안해요.`,
  },
  {
    id: 'want', extend: true, words: ['하고 싶', '되고 싶', '좋아하', '꿈', '해보고 싶', '배우고 싶'],
    weight: { DRIV: 1, HOPE: 1 }, metric: { action: 2 }, tag: '#하고_싶은_것',
    reading: (w) => `${ira(w)} 말이 있어요. 하고 싶은 것이 이미 문장 안에 들어 있다는 뜻이라, 그것을 오늘 10분만 해보는 쪽으로 이어갔어요.`,
  },
  {
    id: 'body', words: ['운동', '체력', '몸이', '헬스', '근력', '살', '달리기'],
    weight: { IRON: 2 }, metric: { resilience: 2 }, tag: '#몸부터',
    reading: (w) => `‘${w}’ 이야기가 나와요. 생각이 많을 때 몸을 먼저 움직이는 방법이 잘 맞을 수 있어서, 짧은 운동을 행동에 넣었어요.`,
  },
  {
    id: 'self', extend: true, words: ['자존감', '못나', '부족', '쓸모', '한심', '자신감', '못하는'],
    weight: { HOPE: 1, CALM: 1 }, metric: { resilience: -2, reflection: 2 }, tag: '#나에게_다정하게',
    reading: (w) => `${ira(w)} 표현이 있어요. 스스로에게 하는 말이 날카로워지는 순간을 알아차리는 것만으로도 시작이 될 수 있어서, 기록하는 행동과 연결했어요.`,
  },
];

const WORRY_PHRASE: Record<string, string> = {
  career: '진로와 꿈의 방향',
  burnout: '번아웃과 무기력',
  relation: '인간관계와 다른 사람의 시선',
  exam: '시험과 성적에 대한 압박',
};
const COMFORT_PHRASE: Record<string, string> = {
  silence: '해결책보다 조용히 곁에 있어주는 공감',
  direction: '다음에 무엇을 하면 될지 알려주는 분명한 방향',
  push: '움직일 수 있게 등을 밀어주는 자극',
  talk: '솔직하게 주고받는 따뜻한 대화',
};
const VISION_PHRASE: Record<string, string> = {
  expert: '단단한 내면을 가진 전문가',
  leader: '선한 영향력을 주는 리더',
  doer: '한계를 깨부수는 실행가',
  thinker: '여유로운 사색가',
};
const HABIT_PHRASE: Record<string, string> = {
  morning: '아침 기상 루틴',
  phone: '스마트폰 사용 시간 줄이기',
  workout: '매일 30분 근력 운동',
  journal: '하루 한 줄 기록',
};

// 곡 × 위로 방식 연결 문장
const MUSIC_BRIDGE: Record<TrackId, Record<string, string>> = {
  '01': {
    silence: '가사 없이 피아노만 천천히 이어져서, 조용한 공감을 원한다고 한 지금 마음에 말을 더 얹지 않아요.',
    direction: '느린 박자 덕분에 생각이 한 번에 하나씩만 떠올라서, 방향을 정리하기 전 머릿속을 비우기에 좋아요.',
    push: '조용히 시작해 조금씩 소리가 쌓이는 구성이라, 움직이기 전 호흡을 가다듬는 준비 운동처럼 들을 수 있어요.',
    talk: '피아노가 묻고 스트링이 답하듯 이어져서, 따뜻한 대화를 원한다고 한 마음과 닮아 있어요.',
  },
  '02': {
    silence: '빗소리와 낮은 피아노가 배경처럼 깔려서, 말 대신 곁에 있어주는 소리가 필요할 때 부담 없이 틀어둘 수 있어요.',
    direction: '같은 리듬이 일정하게 반복되는 동안 할 일을 하나씩 적어보기 좋아서, 명확한 방향이 필요하다고 한 지금에 맞춰 골랐어요.',
    push: '느슨하지만 끊기지 않는 비트가 작은 일부터 시작하게 도와줘서, 실천적 자극을 원한다고 한 마음과 이어져요.',
    talk: '창밖 빗소리를 들으며 누군가와 마주 앉은 듯한 분위기라, 솔직한 대화를 원하는 마음에 어울려요.',
  },
  '03': {
    silence: '넓게 퍼지는 패드가 공간을 채우고 말은 없어서, 조용한 공감을 원하는 지금 오래 머물기 좋아요.',
    direction: '반복되는 아르페지오가 한 방향으로 흘러가서, 흐트러진 생각을 한 줄로 모으는 데 도움이 돼요.',
    push: '선율이 점점 밝아지는 흐름이라, 다시 움직일 힘을 천천히 채워주는 곡으로 골랐어요.',
    talk: '맑은 선율이 서로를 받쳐주며 이어져서, 따뜻한 대화를 원한다고 한 마음과 가장 가까운 소리예요.',
  },
  '04': {
    silence: '말 대신 박자만 남은 곡이라, 생각을 멈추고 몸에 집중하고 싶을 때 조용한 위로가 되어줄 수 있어요.',
    direction: '한 박자도 흔들리지 않는 132BPM이 지금 할 일 하나에만 집중하게 해줘서, 방향을 원한다고 한 마음과 이어져요.',
    push: '강한 킥과 묵직한 베이스가 몸을 먼저 움직이게 해서, 실천적 자극을 원한다고 한 지금에 가장 직접적인 곡이에요.',
    talk: '함께 운동하는 친구가 옆에서 박자를 세어주는 느낌이라, 혼자가 아니라는 감각을 줄 수 있어요.',
  },
};

const ACTIONS: Record<string, { action: string; when: string; why: string }> = {
  journal: {
    action: '잠들기 전, 오늘 가장 마음에 남았던 순간을 한 줄만 적어보세요.',
    when: '오늘 밤 · 잠들기 전 3분',
    why: '한 줄이면 충분해요. 잘 쓴 문장이 아니어도, 오늘을 내 말로 남겼다는 사실이 쌓여요.',
  },
  morning: {
    action: '내일 알람을 평소보다 15분 이르게 맞추고, 일어나면 휴대폰보다 커튼을 먼저 열어보세요.',
    when: '오늘 밤 알람 설정 · 내일 아침',
    why: '하루의 첫 5분을 내가 정하면, 나머지 시간도 조금 덜 끌려다니게 돼요.',
  },
  phone: {
    action: '오늘 밤 10시가 되면 휴대폰을 책상 서랍이나 다른 방에 두고, 잠들 때까지 꺼내지 않아보세요.',
    when: '오늘 밤 10시부터',
    why: '의지로 참는 것보다 손이 닿지 않는 거리를 만드는 쪽이 훨씬 덜 힘들어요.',
  },
  workout: {
    action: '오늘 저녁, 스쿼트 15회와 푸시업 10회를 3세트만 해보세요. 30분을 다 채우지 않아도 괜찮아요.',
    when: '오늘 저녁 · 약 10분',
    why: '몸이 먼저 움직이면, 머릿속에서 맴돌던 생각의 볼륨이 조금 줄어들어요.',
  },
};

const WORRY_CHEER: Record<string, string> = {
  career: '방향은 한 번에 정해지지 않아요. 오늘은 정답 대신, 내 마음을 확인하는 작은 단서 하나만 모아봐요.',
  burnout: '지금은 더 잘하려는 날이 아니라, 덜 지치는 방법을 찾는 날이에요. 아래 한 가지만 해도 충분해요.',
  relation: '다른 사람의 마음은 내가 정할 수 없지만, 오늘 나를 대하는 방식은 내가 고를 수 있어요.',
  exam: '점수는 지난 시간의 기록일 뿐, 내일의 나를 정하지 않아요. 오늘 쥘 수 있는 것 하나에만 집중해봐요.',
};

export interface Analysis {
  archetype: ArchetypeCode;
  scores: Record<ArchetypeCode, number>;
  keywords: { group: string; word: string }[];
  summary: { lead: string; quote: { text: string; step: number; question: string } | null; reading: string };
  music: { track: TrackId; why: string };
  today: { cheer: string; action: string; when: string; why: string };
  metrics: Archetype['metrics'];
  strengths: string[];
  pitfalls: string[];
  hashtags: string[];
  careers: string[];
  vision: string;
  routine: { time: string; title: string; body: string }[];
  workout: { move: 'squat' | 'pushup' | 'deadlift'; name: string; reps: string; sets: number; cue: string }[];
  roadmap: { week: string; title: string; items: string[] }[];
  letter: string;
  overall: string;
}

function findKeywords(text: string) {
  const hits: { group: KeywordGroup; word: string; index: number }[] = [];
  for (const g of GROUPS) {
    let best: { word: string; index: number } | null = null;
    for (const w of g.words) {
      const i = text.indexOf(w);
      if (i >= 0 && (!best || i < best.index)) best = { word: w, index: i };
    }
    if (best) {
      let word = best.word;
      if (g.extend) {
        const rest = text.slice(best.index + best.word.length);
        const m = rest.match(/^[^\s.,!?…~"'”’)\]]*/u);
        word = (best.word + (m ? m[0] : '')).slice(0, 14);
      }
      hits.push({ group: g, word, index: best.index });
    }
  }
  return hits.sort((a, b) => a.index - b.index);
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?。…])\s+|\n+/u)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4);
}

/** 원문 그대로의 연속된 구간만 인용한다 */
function pickQuote(notes: Notes) {
  const order: StepKey[] = ['worry', 'comfort', 'vision', 'habit'];
  let best: { text: string; step: number; score: number } | null = null;
  order.forEach((key, idx) => {
    const raw = (notes[key] || '').trim();
    if (!raw) return;
    for (const s of splitSentences(raw)) {
      const kw = findKeywords(s).length;
      const score = kw * 3 + Math.min(s.length, 60) / 20 + (idx === 0 ? 1.5 : 0);
      if (!best || score > best.score) best = { text: s, step: idx + 1, score };
    }
  });
  if (!best) return null;
  const b = best as { text: string; step: number; score: number };
  let text = b.text;
  if (text.length > 90) {
    // 쉼표 단위로 잘라 키워드가 들어 있는 구간을 남긴다 (원문 연속 구간 유지)
    const parts = text.split(/(?<=,)\s*/);
    const withKw = parts.find((p) => findKeywords(p).length > 0) || parts[0];
    text = withKw.length > 90 ? withKw.slice(0, 88) + '…' : withKw.replace(/,$/, '') + '…';
  }
  return { text, step: b.step, question: QUESTIONS[b.step - 1].title };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function analyze(answers: Answers, notes: Notes): Analysis {
  const allText = (['worry', 'comfort', 'vision', 'habit'] as StepKey[]).map((k) => notes[k] || '').join('\n');
  const hits = findKeywords(allText);

  // 1) 아키타입 점수: 선택지 가중치 + 키워드 가중치
  const scores: Record<ArchetypeCode, number> = { CALM: 0, DRIV: 0, HOPE: 0, IRON: 0 };
  QUESTIONS.forEach((q) => {
    const opt = q.options.find((o) => o.id === answers[q.key]);
    if (!opt) return;
    for (const [k, v] of Object.entries(opt.weight)) scores[k as ArchetypeCode] += v as number;
  });
  hits.forEach((h) => {
    for (const [k, v] of Object.entries(h.group.weight)) scores[k as ArchetypeCode] += (v as number) * 0.75;
  });
  // 동점이면 고른 위로 방식을 우선
  const comfortPref: Record<string, ArchetypeCode> = { silence: 'CALM', direction: 'DRIV', push: 'IRON', talk: 'HOPE' };
  const pref = comfortPref[answers.comfort || 'silence'];
  const archetype = (Object.keys(scores) as ArchetypeCode[]).sort(
    (a, b) => scores[b] - scores[a] || (b === pref ? 1 : 0) - (a === pref ? 1 : 0),
  )[0];
  const A = ARCHETYPES[archetype];

  const worry = WORRY_PHRASE[answers.worry || 'career'];
  const comfort = COMFORT_PHRASE[answers.comfort || 'silence'];
  const vision = VISION_PHRASE[answers.vision || 'expert'];
  const habit = HABIT_PHRASE[answers.habit || 'journal'];

  // 2) 지금 마음의 요약
  const lead =
    `요즘 밤마다 가장 오래 머무는 생각은 ${worry}에 관한 것이에요. ` +
    `지금 필요한 위로로는 ${j(comfort, '을/를')} 골라주셨어요. ` +
    `3년 뒤에는 ${j(vision, '이/가')} 되고 싶다고 했으니, 오늘의 고민도 그 방향 위에 놓고 정리해볼게요.`;
  const quote = pickQuote(notes);
  const reading = hits.length
    ? hits.slice(0, 2).map((h) => h.group.reading(h.word)).join(' ')
    : quote
      ? `적어준 문장을 그대로 옮겨두었어요. 문장 속 단어만으로 마음을 짐작하기보다, 고른 답과 함께 읽어서 ${worry} 고민을 ${j(comfort, '으로/로')} 풀어가는 방향으로 정리했어요.`
      : '직접 적은 문장이 없어서 고른 답만으로 정리했어요. ‘왜 이 답을 골랐나요?’에 한 줄을 더하면 이 요약이 그 문장에 맞춰 달라져요.';

  // 3) 추천곡
  const track = A.track;
  const music = { track, why: `${j(TRACKS[track].mood, '이에요/예요')}. ${MUSIC_BRIDGE[track][answers.comfort || 'silence']}` };

  // 4) 오늘의 한 걸음
  const base = ACTIONS[answers.habit || 'journal'];
  const shortQuote = quote && quote.text.length <= 40 ? quote.text.replace(/[.!?。]+$/u, '') : null;
  const cheer = shortQuote
    ? `“${shortQuote}”라고 적은 마음을 오늘 하루에 다 풀지 않아도 돼요. ${WORRY_CHEER[answers.worry || 'career']}`
    : WORRY_CHEER[answers.worry || 'career'];
  let action = base.action;
  if (answers.habit === 'journal' && answers.worry === 'exam') action = '잠들기 전, 오늘 공부하면서 가장 마음에 남았던 순간을 한 줄만 적어보세요. 잘한 것이든 아쉬운 것이든 괜찮아요.';
  if (answers.habit === 'journal' && answers.worry === 'relation') action = '잠들기 전, 오늘 누군가와 나눈 말 중 가장 마음에 남은 한 마디를 한 줄로 적어보세요.';
  const phoneHit = hits.find((h) => h.group.id === 'phone');
  if (answers.habit === 'phone' && phoneHit && phoneHit.word !== '폰' && phoneHit.word !== '휴대폰' && phoneHit.word !== '핸드폰' && phoneHit.word !== '스마트폰')
    action = `오늘 밤 10시가 되면 ${j(phoneHit.word, '을/를')} 로그아웃하고, 휴대폰은 책상 서랍에 둔 채 잠들어보세요.`;
  if (answers.habit === 'workout' && hits.some((h) => h.group.id === 'tired'))
    action = '오늘 저녁, 스쿼트 10회만 천천히 해보세요. 더 하고 싶으면 한 세트 더, 아니면 거기서 멈춰도 괜찮아요.';

  // 5) 리포트용 확장 데이터
  const metrics = { ...A.metrics };
  hits.forEach((h) => {
    for (const [k, v] of Object.entries(h.group.metric)) metrics[k as keyof typeof metrics] += v as number;
  });
  metrics.reflection += Math.min(4, Math.floor(allText.trim().length / 60));
  if (answers.habit === 'workout') metrics.resilience += 2;
  if (answers.habit === 'morning') metrics.action += 2;
  (Object.keys(metrics) as (keyof typeof metrics)[]).forEach((k) => (metrics[k] = clamp(metrics[k], 55, 98)));

  const hashtags = [...A.hashtags, ...hits.slice(0, 2).map((h) => h.group.tag)];
  const visionQuote = (notes.vision || '').trim();
  const visionText =
    `3년 뒤의 나는 ${j(vision, '으로/로')}서, ${j(worry, '으로/로')} 흔들리던 밤을 ` +
    `${ira(habit)} 작은 약속으로 건너온 사람이 되어 있을 것입니다.` +
    (visionQuote ? ` 그때의 나는 지금 적은 이 문장을 기억할 거예요. “${visionQuote.length > 70 ? visionQuote.slice(0, 68) + '…' : visionQuote}”` : '');

  const ROUTINES: Record<string, { time: string; title: string; body: string }[]> = {
    journal: [
      { time: '아침', title: '오늘의 한 단어', body: '일어나서 오늘 바라는 마음을 한 단어로 적어요. 예: 천천히, 용기.' },
      { time: '낮', title: '마음 체크 10초', body: '점심 뒤에 지금 기분을 1~5 숫자로만 표시해요.' },
      { time: '밤', title: '한 줄 기록', body: '오늘 가장 마음에 남은 순간을 한 줄로 남겨요.' },
    ],
    morning: [
      { time: '전날 밤', title: '알람 15분 당기기', body: '알람을 평소보다 15분 이르게, 휴대폰은 손이 닿지 않는 곳에.' },
      { time: '기상 직후', title: '커튼 열고 물 한 컵', body: '빛과 물로 몸에 아침이 왔다고 알려줘요.' },
      { time: '첫 10분', title: '오늘 할 일 3개', body: '가장 작은 것부터 세 줄로 적어요.' },
    ],
    phone: [
      { time: '아침', title: '첫 30분 비행기 모드', body: '일어나서 30분은 알림 없이 시작해요.' },
      { time: '낮', title: '앱 하나 숨기기', body: '가장 자주 여는 앱을 홈 화면 마지막 페이지로 옮겨요.' },
      { time: '밤 10시', title: '서랍에 넣기', body: '휴대폰을 서랍에 두고 충전도 거기서 해요.' },
    ],
    workout: [
      { time: '아침', title: '스트레칭 3분', body: '목, 어깨, 허리를 천천히 풀어요.' },
      { time: '저녁', title: '근력 30분', body: '스쿼트·푸시업·데드리프트를 순서대로.' },
      { time: '자기 전', title: '오늘 세트 기록', body: '몇 세트를 했는지 숫자만 남겨요.' },
    ],
  };

  const heavy = archetype === 'IRON' ? 1 : 0;
  const workout: Analysis['workout'] = [
    { move: 'squat', name: '스쿼트', reps: `${12 + heavy * 3}회`, sets: 3 + heavy, cue: '무릎과 발끝 방향을 맞추고, 의자에 앉듯 엉덩이를 뒤로.' },
    { move: 'pushup', name: '푸시업', reps: `${8 + heavy * 4}회`, sets: 3 + heavy, cue: '어려우면 무릎을 대고 시작해도 충분해요.' },
    { move: 'deadlift', name: '데드리프트', reps: `${10 + heavy * 2}회`, sets: 3, cue: '물병이나 가방으로 시작. 허리는 곧게, 엉덩이로 들어올려요.' },
  ];

  const roadmap: Analysis['roadmap'] = [
    { week: '1주차', title: '자기이해', items: ['매일 밤 한 줄로 오늘의 마음 남기기', `${worry} 고민이 커지는 시간대 적어보기`] },
    { week: '2주차', title: '기초습관', items: [`‘${habit}’ 하루 10분으로 시작`, '못 한 날은 다음 날 다시 시작하기'] },
    { week: '3주차', title: '도전실행', items: [`3년 뒤의 ${vision}에게 필요한 일 하나 해보기`, '한 사람에게 내 고민을 한 문장으로 말해보기'] },
    { week: '4주차', title: '지속가능성', items: ['30일 기록을 다시 읽고 달라진 점 세 가지 적기', '다음 달에도 남길 습관 하나 고르기'] },
  ];

  const overall = hits.length
    ? `적어준 문장에서 ${hits.slice(0, 3).map((h) => `‘${h.word}’`).join(', ')} 같은 말이 보였어요. 이 말들과 고른 답을 함께 읽어, ${A.name}의 방식으로 정리했어요.`
    : `고른 답을 기준으로 ${A.name}의 방식으로 정리했어요. 자유 입력이 더해지면 문장에 맞춰 내용이 달라져요.`;

  const letter =
    `혼자 끌어안고 있던 고민은 약해서 생긴 것이 아니에요. ${worry}에 대해 이렇게 오래 생각한다는 건, 그만큼 잘 살고 싶다는 뜻이기도 해요. ` +
    `30일 동안 ‘${habit}’ 하나만 붙잡아보세요. 다 해내지 못한 날이 있어도 괜찮아요. 이 기록은 언제든 다시 꺼내볼 수 있게 여기 보관해둘게요.`;

  return {
    archetype,
    scores,
    keywords: hits.map((h) => ({ group: h.group.id, word: h.word })),
    summary: { lead, quote, reading },
    music,
    today: { cheer, action, when: base.when, why: base.why },
    metrics,
    strengths: A.strengths,
    pitfalls: A.pitfalls,
    hashtags,
    careers: A.careers,
    vision: visionText,
    routine: ROUTINES[answers.habit || 'journal'],
    workout,
    roadmap,
    letter,
    overall,
  };
}
