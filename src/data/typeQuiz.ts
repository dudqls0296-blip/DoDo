// 고민저장소 유형 검사 · R/T, P/A, E/F, S/M 4축 16유형
// ⚠ 기획서의 ‘기존 성향 문항과 고정 채점 규칙’은 전달받은 README·소스에 없어서
//   아래 문항을 새로 작성했다. 기존 문항이 있다면 QUESTIONS 배열만 교체하면 된다.
//
// 고정 채점 규칙
//  - 축마다 3문항, 각 문항은 두 극 중 하나에 1점.
//  - 축별로 2점 이상 받은 극이 그 축의 글자가 된다 (3문항이라 동점 없음).
//  - 유형 코드 = R|T + P|A + E|F + S|M (예: RPES)

export type Axis = 'RT' | 'PA' | 'EF' | 'SM';
export type Pole = 'R' | 'T' | 'P' | 'A' | 'E' | 'F' | 'S' | 'M';

export interface TypeQuestion {
  axis: Axis;
  text: string;
  a: { label: string; pole: Pole };
  b: { label: string; pole: Pole };
}

export const AXES: Record<Axis, { name: string; poles: [Pole, Pole]; desc: Record<string, string> }> = {
  RT: { name: '고민을 다루는 방식', poles: ['R', 'T'], desc: { R: 'Reflect · 혼자 곱씹으며 정리해요', T: 'Talk · 털어놓으며 정리해요' } },
  PA: { name: '움직이는 방식', poles: ['P', 'A'], desc: { P: 'Plan · 계획을 세우고 움직여요', A: 'Act · 일단 해보며 길을 찾아요' } },
  EF: { name: '먼저 보는 것', poles: ['E', 'F'], desc: { E: 'Emotion · 마음의 결을 먼저 봐요', F: 'Fact · 사실과 조건을 먼저 봐요' } },
  SM: { name: '위로가 되는 소리', poles: ['S', 'M'], desc: { S: 'Still · 잔잔한 소리에 기대요', M: 'Move · 리듬이 있는 소리에 기대요' } },
};

export const TYPE_QUESTIONS: TypeQuestion[] = [
  { axis: 'RT', text: '고민이 생기면 먼저 하는 일은?', a: { label: '혼자 조용히 생각해본다', pole: 'R' }, b: { label: '누군가에게 이야기해본다', pole: 'T' } },
  { axis: 'PA', text: '해야 할 일이 많을 때 나는', a: { label: '순서부터 정한다', pole: 'P' }, b: { label: '손에 잡히는 것부터 한다', pole: 'A' } },
  { axis: 'EF', text: '친구가 힘들다고 할 때 먼저 드는 생각은', a: { label: '얼마나 속상했을까', pole: 'E' }, b: { label: '무슨 일이 있었을까', pole: 'F' } },
  { axis: 'SM', text: '지친 밤에 더 끌리는 소리는', a: { label: '빗소리, 피아노', pole: 'S' }, b: { label: '드럼, 빠른 비트', pole: 'M' } },
  { axis: 'RT', text: '마음이 복잡한 날 더 편한 건', a: { label: '일기나 메모 쓰기', pole: 'R' }, b: { label: '통화하거나 만나기', pole: 'T' } },
  { axis: 'PA', text: '새로운 걸 시작할 때 나는', a: { label: '알아보고 준비한 뒤 시작', pole: 'P' }, b: { label: '시작하면서 알아간다', pole: 'A' } },
  { axis: 'EF', text: '중요한 결정을 내릴 때 더 믿는 건', a: { label: '내 마음이 가는 쪽', pole: 'E' }, b: { label: '따져본 장단점', pole: 'F' } },
  { axis: 'SM', text: '집중하고 싶을 때 틀어두는 건', a: { label: '조용한 연주곡', pole: 'S' }, b: { label: '신나는 노래', pole: 'M' } },
  { axis: 'RT', text: '좋은 일이 생겼을 때 나는', a: { label: '혼자 오래 곱씹는다', pole: 'R' }, b: { label: '바로 누군가에게 알린다', pole: 'T' } },
  { axis: 'PA', text: '여행을 간다면', a: { label: '일정표를 만든다', pole: 'P' }, b: { label: '가서 정한다', pole: 'A' } },
  { axis: 'EF', text: '조언을 들을 때 더 고마운 건', a: { label: '내 마음을 알아주는 말', pole: 'E' }, b: { label: '바로 써먹을 수 있는 말', pole: 'F' } },
  { axis: 'SM', text: '기분을 바꾸고 싶을 때 나는', a: { label: '조용히 이어폰을 낀다', pole: 'S' }, b: { label: '볼륨을 키우고 몸을 움직인다', pole: 'M' } },
];

export const TYPE_NAMES: Record<string, { name: string; line: string }> = {
  RPES: { name: '새벽 서재의 기록가', line: '혼자 차분히 적어 내려가며 마음의 순서를 찾는 사람' },
  RPEM: { name: '밤길을 걷는 작곡가', line: '생각을 오래 다듬고, 리듬을 타며 다시 일어서는 사람' },
  RPFS: { name: '조용한 지도 제작자', line: '사실을 하나씩 모아 고요하게 길을 그려가는 사람' },
  RPFM: { name: '묵묵한 장거리 러너', line: '계획한 거리를 꾸준한 박자로 달려가는 사람' },
  RAES: { name: '비 오는 창가의 산책자', line: '마음 가는 대로 걸으며 혼자 생각을 풀어내는 사람' },
  RAEM: { name: '혼자 떠나는 여행자', line: '느낌을 따라 일단 떠나고, 길 위에서 답을 찾는 사람' },
  RAFS: { name: '고요한 실험가', line: '조용히 직접 해보며 무엇이 맞는지 확인하는 사람' },
  RAFM: { name: '홀로 오르는 등반가', line: '스스로 판단하고, 몸을 움직여 한계를 넘어가는 사람' },
  TPES: { name: '마음을 잇는 편지가', line: '마음을 나누며 함께 갈 길을 차근차근 그리는 사람' },
  TPEM: { name: '무대를 준비하는 밴드 리더', line: '사람들과 계획을 맞추고, 함께 리듬을 만드는 사람' },
  TPFS: { name: '함께 그리는 설계자', line: '대화로 정보를 모아 차분하게 계획을 세우는 사람' },
  TPFM: { name: '팀을 이끄는 코치', line: '사실을 짚고 계획을 나누며 모두를 움직이게 하는 사람' },
  TAES: { name: '곁을 지키는 등대지기', line: '먼저 곁에 다가가 마음을 비추는 사람' },
  TAEM: { name: '축제를 여는 사람', line: '사람들과 함께 일단 시작하고, 분위기를 끌어올리는 사람' },
  TAFS: { name: '담담한 해결사', line: '이야기를 듣고 바로 할 수 있는 일을 찾아내는 사람' },
  TAFM: { name: '앞장서는 개척자', line: '사람들과 함께 빠르게 움직이며 길을 여는 사람' },
};

/** 고정 채점: 답(문항 순서대로 'a' | 'b') → 유형 코드 */
export function scoreType(answers: ('a' | 'b')[]): { code: string; tally: Record<Pole, number> } {
  const tally: Record<Pole, number> = { R: 0, T: 0, P: 0, A: 0, E: 0, F: 0, S: 0, M: 0 };
  TYPE_QUESTIONS.forEach((q, i) => {
    const pick = answers[i];
    if (!pick) return;
    tally[q[pick].pole] += 1;
  });
  const code = (['RT', 'PA', 'EF', 'SM'] as Axis[]).map((ax) => {
    const [x, y] = AXES[ax].poles;
    return tally[x] >= tally[y] ? x : y;
  }).join('');
  return { code, tally };
}
