// 고민저장소 · 콘텐츠 원본
// README(고민저장소 공식 README)의 4단계 질문, 4대 아키타입, 4곡 트랙 정보를 그대로 옮겼다.

export type ArchetypeCode = 'CALM' | 'DRIV' | 'HOPE' | 'IRON';
export type TrackId = '01' | '02' | '03' | '04';

export interface Option {
  id: string;
  label: string;
  detail: string;
  /** 아키타입 가중치 */
  weight: Partial<Record<ArchetypeCode, number>>;
}

export interface Question {
  step: number;
  key: 'worry' | 'comfort' | 'vision' | 'habit';
  title: string;
  hint: string;
  placeholder: string;
  options: Option[];
}

export const BRAND = '고민저장소';

export const QUESTIONS: Question[] = [
  {
    step: 1,
    key: 'worry',
    title: '밤마다 가장 깊게 머무는 고민',
    hint: '잠들기 전, 가장 오래 붙잡고 있는 생각에 가까운 것을 골라주세요.',
    placeholder: '예: 다들 하고 싶은 게 있는 것 같은데, 나만 아직 모르겠어서 불안해요.',
    options: [
      { id: 'career', label: '진로 및 꿈의 방향', detail: '무엇을 하고 싶은지, 이 길이 맞는지', weight: { DRIV: 2, CALM: 1 } },
      { id: 'burnout', label: '번아웃과 무기력', detail: '해야 할 일 앞에서 몸과 마음이 멈춰요', weight: { CALM: 2, IRON: 1 } },
      { id: 'relation', label: '인간관계와 시선', detail: '친구, 가족, 다른 사람의 평가', weight: { HOPE: 2, CALM: 1 } },
      { id: 'exam', label: '시험 및 성적 압박', detail: '점수와 결과가 나를 정하는 것 같아요', weight: { IRON: 2, DRIV: 1 } },
    ],
  },
  {
    step: 2,
    key: 'comfort',
    title: '지금 내게 가장 필요한 위로의 형태',
    hint: '누군가 곁에 있다면, 어떤 방식으로 도와주면 좋을까요?',
    placeholder: '예: 해결책보다 그냥 조용히 들어주는 사람이 있으면 좋겠어요.',
    options: [
      { id: 'silence', label: '조용한 침묵과 공감', detail: '말없이 곁에 있어주는 시간', weight: { CALM: 3 } },
      { id: 'direction', label: '명확한 방향 제시', detail: '다음에 무엇을 하면 될지 알려주기', weight: { DRIV: 3 } },
      { id: 'push', label: '실천적 자극과 동기부여', detail: '등을 밀어주는 힘 있는 한마디', weight: { IRON: 3 } },
      { id: 'talk', label: '솔직하고 따뜻한 대화', detail: '내 이야기를 주고받을 수 있는 사람', weight: { HOPE: 3 } },
    ],
  },
  {
    step: 3,
    key: 'vision',
    title: '3년 뒤 내가 가장 바라는 나의 모습',
    hint: '거창하지 않아도 괜찮아요. 가장 끌리는 모습을 골라주세요.',
    placeholder: '예: 내가 좋아하는 일을 꾸준히 하면서, 남과 덜 비교하는 사람이요.',
    options: [
      { id: 'expert', label: '단단한 내면의 전문가', detail: '한 분야를 깊게 아는 사람', weight: { CALM: 2, DRIV: 1 } },
      { id: 'leader', label: '선한 영향력을 주는 리더', detail: '주변 사람을 함께 성장시키는 사람', weight: { HOPE: 2, DRIV: 1 } },
      { id: 'doer', label: '한계를 깨부수는 실행가', detail: '생각보다 먼저 움직이는 사람', weight: { IRON: 2, DRIV: 1 } },
      { id: 'thinker', label: '여유로운 사색가', detail: '서두르지 않고 나만의 속도로 사는 사람', weight: { CALM: 2, HOPE: 1 } },
    ],
  },
  {
    step: 4,
    key: 'habit',
    title: '내일부터 당장 바꾸고 싶은 하루 습관',
    hint: '내일 아침 바로 시작할 수 있는 것 하나를 골라주세요.',
    placeholder: '예: 일어나자마자 휴대폰을 보다가 오전이 다 지나가요.',
    options: [
      { id: 'morning', label: '아침 기상 루틴', detail: '같은 시간에 일어나 하루를 여는 순서', weight: { DRIV: 2 } },
      { id: 'phone', label: '스마트폰 사용 시간 단축', detail: '무심코 여는 앱을 줄이기', weight: { CALM: 1, DRIV: 1 } },
      { id: 'workout', label: '매일 30분 근력 운동', detail: '몸을 움직여 생각을 비우기', weight: { IRON: 2 } },
      { id: 'journal', label: '하루 한 줄 기록', detail: '오늘의 마음을 한 문장으로 남기기', weight: { CALM: 1, HOPE: 1 } },
    ],
  },
];

export interface Archetype {
  code: ArchetypeCode;
  name: string;
  tagline: string;
  metrics: { reflection: number; action: number; resilience: number; focus: number };
  careers: string[];
  track: TrackId;
  strengths: string[];
  pitfalls: string[];
  hashtags: string[];
}

export const ARCHETYPES: Record<ArchetypeCode, Archetype> = {
  CALM: {
    code: 'CALM',
    name: '새벽을 건너는 사색가',
    tagline: '조용한 성찰과 깊이 있는 기록으로 나만의 세계를 빚어내는 사람',
    metrics: { reflection: 94, action: 74, resilience: 85, focus: 90 },
    careers: ['콘텐츠 기획자', 'UX 디자이너', '에세이스트', '아키비스트'],
    track: '01',
    strengths: ['감정의 결을 세밀하게 알아차림', '혼자 있는 시간을 생각의 재료로 바꿈', '오래 붙잡고 깊게 파고드는 끈기'],
    pitfalls: ['생각이 길어져 시작이 늦어지는 순간', '괜찮다고 말하며 피로를 쌓아두는 습관'],
    hashtags: ['#깊이', '#기록', '#나만의속도'],
  },
  DRIV: {
    code: 'DRIV',
    name: '내일을 여는 개척자',
    tagline: '작은 실행을 매일 쌓아 올려 스스로의 길을 개척하는 비저너리',
    metrics: { reflection: 82, action: 95, resilience: 88, focus: 91 },
    careers: ['스타트업 창업가', '크리에이티브 디렉터', '전략 컨설턴트', '프로덕트 매니저'],
    track: '02',
    strengths: ['막연한 고민을 다음 행동으로 쪼개는 힘', '방향이 보이면 빠르게 움직이는 추진력', '실패를 데이터로 다루는 태도'],
    pitfalls: ['쉬는 시간까지 성과로 채우려는 조급함', '정답을 빨리 찾으려다 마음을 건너뛰는 것'],
    hashtags: ['#방향', '#작은실행', '#개척'],
  },
  HOPE: {
    code: 'HOPE',
    name: '마음을 잇는 등대지기',
    tagline: '따뜻한 공감과 진심 어린 연대로 세상과 자신을 밝히는 성장가',
    metrics: { reflection: 89, action: 81, resilience: 91, focus: 86 },
    careers: ['심리상담·교육가', '소셜 임팩트 기획자', 'HR 리더', '커뮤니티 매니저'],
    track: '03',
    strengths: ['다른 사람의 마음을 섬세하게 읽는 감각', '대화로 관계를 회복시키는 힘', '함께일 때 더 오래 버티는 연대감'],
    pitfalls: ['남의 기대를 내 바람보다 먼저 두는 것', '거절하지 못해 내 시간이 줄어드는 것'],
    hashtags: ['#연결', '#공감', '#따뜻한대화'],
  },
  IRON: {
    code: 'IRON',
    name: '한계를 넘는 강철 러너',
    tagline: '흔들리지 않는 체력과 자기 규율로 모든 시련을 돌파하는 실천가',
    metrics: { reflection: 78, action: 92, resilience: 96, focus: 94 },
    careers: ['헬스케어 전문가', '퍼포먼스 코치', '아키텍트', '스포츠 데이터 분석가'],
    track: '04',
    strengths: ['몸을 움직여 생각을 정리하는 회복력', '정한 일을 끝까지 해내는 규율', '압박 속에서도 집중을 유지하는 힘'],
    pitfalls: ['결과가 나쁘면 자신을 몰아세우는 것', '쉬어야 할 때도 멈추지 못하는 것'],
    hashtags: ['#체력', '#규율', '#돌파'],
  },
};

export interface Track {
  id: TrackId;
  title: string;
  style: string;
  bpm: number;
  key: string;
  fullLength: string;
  mood: string;
  guide: string;
}

export const TRACKS: Record<TrackId, Track> = {
  '01': {
    id: '01',
    title: '새벽 2시, 고민을 접는 피아노',
    style: '펠트 피아노 & 스트링 패드',
    bpm: 76,
    key: 'F Maj',
    fullLength: '02:48',
    mood: '느린 템포와 부드러운 피아노가 생각의 속도를 천천히 낮춰주는 곡',
    guide: '불을 조금 낮추고, 곡이 끝날 때까지 아무것도 하지 않아도 괜찮아요.',
  },
  '02': {
    id: '02',
    title: '창밖 빗소리와 내일의 스케치',
    style: '로파이 일렉트릭 피아노(Rhodes) & 빗소리 질감',
    bpm: 84,
    key: 'A Min',
    fullLength: '02:40',
    mood: '일정하게 반복되는 로파이 비트가 머릿속 생각을 차례대로 줄 세워주는 곡',
    guide: '종이 한 장을 옆에 두고, 떠오르는 할 일을 순서 없이 적어보며 들어보세요.',
  },
  '03': {
    id: '03',
    title: '흔들리는 마음을 붙잡는 별빛',
    style: '깊은 앰비언트 패드 & 청명한 아르페지오 신스 선율',
    bpm: 92,
    key: 'D Maj',
    fullLength: '02:54',
    mood: '넓게 퍼지는 패드 위로 맑은 선율이 이어져, 누군가와 나란히 걷는 듯한 곡',
    guide: '고마운 사람 한 명을 떠올리면서, 그 사람에게 하고 싶은 말을 속으로 정리해보세요.',
  },
  '04': {
    id: '04',
    title: '한계를 돌파하는 132BPM 헬창 비트',
    style: '강력한 킥 드럼 & 서브 베이스 운동 전용 고에너지 트랙',
    bpm: 132,
    key: 'E Min',
    fullLength: '02:32',
    mood: '심장 박동보다 빠른 킥과 묵직한 베이스가 몸을 먼저 움직이게 하는 곡',
    guide: '곡이 시작되면 자리에서 일어나 스쿼트 10회로 몸을 깨워보세요.',
  },
};

export const METRIC_LABELS: Record<keyof Archetype['metrics'], string> = {
  reflection: '자기성찰',
  action: '실행력',
  resilience: '회복탄력성',
  focus: '몰입도',
};
