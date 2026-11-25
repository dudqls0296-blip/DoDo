// 발표 자료: 고민저장소 기능 소개 (사이트 안에서 바로 발표)
// ← → 넘기기 · N 발표자 메모 · O 전체 보기 · F 전체화면
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BRAND } from '../data/brand';
import { CATEGORIES } from '../data/flow';
import { SONGS } from '../data/songs';
import { TYPE_NAMES } from '../data/typeQuiz';
import { localQuestion } from '../lib/conversation';
import { Seal } from '../components/Header';
import { isFullscreen, toggleFullscreen } from '../lib/fullscreen';
import { MusicToggle } from '../music/Music';

interface PSlide { title: string; notes: string; body: () => ReactNode; dark?: boolean }

const EX_A = '시험은 얼마 안 남았는데 책을 펴도 한 시간씩 멍하니 있어요.';
const EX_B = '공부는 했는데 지난번에 성적이 떨어져서 또 실망할까 봐 무서워요.';

function Flow() {
  const steps = ['홈', '고민 고르기', '직접 쓰기', '이어지는 질문', '결과 · 추천곡', '음악 듣기', '리포트 · 보관함'];
  return (
    <ol className="p-flow">
      {steps.map((s, i) => (
        <li key={s}><span className="p-flow__no">{String(i + 1).padStart(2, '0')}</span><span className="p-flow__label">{s}</span></li>
      ))}
    </ol>
  );
}

export default function Present({ startAt }: { startAt?: number }) {
  const qa = useMemo(() => localQuestion('study', EX_A, 'sticking'), []);
  const qb = useMemo(() => localQuestion('study', EX_B, 'sticking'), []);
  const counts = useMemo(() => ({
    ko: SONGS.filter((s) => s.lang === 'ko').length,
    en: SONGS.filter((s) => s.lang === 'en').length,
    inst: SONGS.filter((s) => s.lang === 'inst').length,
    same: SONGS.filter((s) => s.needs.includes('same')).length,
    calm: SONGS.filter((s) => s.needs.includes('calm')).length,
    energy: SONGS.filter((s) => s.needs.includes('energy')).length,
  }), []);

  const SLIDES: PSlide[] = [
    {
      title: '표지', dark: true,
      notes: '안녕하세요. 오늘 소개할 웹사이트는 ‘고민저장소’입니다. 혼자 품어온 고민을 조용히 꺼내놓고, 내 문장에 맞는 질문과 실제 노래, 오늘 해볼 작은 행동 하나를 받는 곳입니다.',
      body: () => (
        <div className="p-cover">
          <div className="p-cover__text">
            <p className="p-kicker">웹사이트 기능 소개</p>
            <h2 className="p-cover__title">{BRAND}</h2>
            <p className="p-cover__line">혼자 품어온 고민을,<br />조용히 꺼내놓는 곳.</p>
            <p className="p-cover__sub">내 문장을 읽고 이어지는 질문 · 실제 발매곡 추천 · 오늘의 한 걸음</p>
          </div>
          <div className="p-cover__art" aria-hidden="true">
            <div className="p-sleeve"><Seal size={64} /><span>{BRAND}</span></div>
            <div className="p-disc"><span /></div>
          </div>
        </div>
      ),
    },
    {
      title: '왜 만들었나',
      notes: '청소년과 청년 시기에는 진로, 성적, 관계, 자존감 고민이 한꺼번에 몰립니다. 그런데 이 고민은 마음속에 묻히거나, 커뮤니티에 한 번 털어놓고 흘러가버리기 쉽습니다. 고민저장소는 고민을 내 말로 적고, 이해하고, 작은 행동으로 이어지게 하는 공간을 목표로 했습니다.',
      body: () => (
        <div className="p-two">
          <div>
            <p className="p-kicker">02 · 기획 배경</p>
            <h2 className="p-title">고민은 많은데,<br />꺼내놓을 곳이 없다</h2>
            <p className="p-lead">진로·성적·관계·자존감 고민은 마음속에 묻히거나, 한 번의 한탄으로 흘러가버리기 쉬워요.</p>
          </div>
          <ol className="p-cards">
            <li><b>적기</b><span>정답을 고르는 대신, 내 말로 고민을 적는다</span></li>
            <li><b>이해하기</b><span>내가 쓴 문장을 바탕으로 질문을 이어가며 마음을 정리한다</span></li>
            <li><b>움직이기</b><span>지금 어울리는 노래와 오늘 할 수 있는 행동 하나를 받는다</span></li>
          </ol>
        </div>
      ),
    },
    {
      title: '전체 흐름',
      notes: '사용자 흐름은 일곱 단계입니다. 고민 카테고리를 고르고, 직접 적고, 내 답에서 이어지는 질문에 1~3개 답하면 결과와 추천곡이 나옵니다. 음악을 들으며 리포트를 보고, 원하면 보관함에 저장합니다.',
      body: () => (
        <div>
          <p className="p-kicker">03 · 사용자 흐름</p>
          <h2 className="p-title">3분이면 끝나는 일곱 단계</h2>
          <Flow />
          <ul className="p-chips">
            {CATEGORIES.map((c) => <li key={c.id}>{c.label}</li>)}
          </ul>
          <p className="p-foot">고민 카테고리 6가지 · 질문은 1~3개 · 저장은 ‘내 보관함에 저장’을 눌렀을 때만</p>
        </div>
      ),
    },
    {
      title: '내 말을 읽는 질문',
      notes: '가장 신경 쓴 기능입니다. 같은 학업·시험 고민이라도 쓴 내용이 다르면 다른 질문이 나옵니다. 화면의 두 질문은 지금 이 사이트의 질문 엔진이 실제로 만든 결과입니다. 이미 말한 정보는 다시 묻지 않고, 이전 답을 고치면 그 답에 기대는 질문만 다시 만듭니다.',
      body: () => (
        <div>
          <p className="p-kicker">04 · 이어지는 질문</p>
          <h2 className="p-title">같은 카테고리, 다른 고민 → 다른 질문</h2>
          <div className="p-compare">
            {[{ w: EX_A, q: qa }, { w: EX_B, q: qb }].map((x, i) => (
              <div key={i} className="p-qcard">
                <p className="p-qcard__tag">학업·시험 · 예시 {i ? 'B' : 'A'}</p>
                <p className="p-qcard__worry">“{x.w}”</p>
                {x.q.context && <p className="p-qcard__echo">짚은 표현 · “{x.q.context}”</p>}
                <p className="p-qcard__q">{x.q.text}</p>
                <p className="p-qcard__opts">{x.q.options.map((o) => o.label).join(' / ')} / 직접 입력 / 건너뛰기</p>
              </div>
            ))}
          </div>
          <p className="p-foot">이 화면의 질문은 사이트의 질문 엔진이 지금 만든 실제 결과예요 · 이미 말한 건 다시 묻지 않기 · 답을 고치면 의존하는 질문만 다시</p>
        </div>
      ),
    },
    {
      title: 'AI 상담',
      notes: 'AI가 연결되면 질문이 더 세밀해집니다. AI는 사용자의 표현을 짚어 질문을 만들고, 결과 편지를 쓰고, 검증된 후보곡 안에서만 노래를 고르고, 답장 대화를 이어갑니다. AI 응답은 모두 검증하고, 형식이 틀리거나 원문에 없는 인용을 하면 그 부분만 내장 규칙으로 대신합니다.',
      body: () => (
        <div className="p-two">
          <div>
            <p className="p-kicker">05 · AI 연결</p>
            <h2 className="p-title">AI가 하는 네 가지</h2>
            <ol className="p-list">
              <li><b>질문</b> 상황 · 특히 마음에 걸리는 부분 · 원하는 도움을 내 표현을 짚어 묻기</li>
              <li><b>편지</b> 원문 인용 + 2~3문장 요약 + 응원 + 오늘의 행동</li>
              <li><b>곡 선택</b> 검증된 후보 8곡 안에서만 고르고 이유 쓰기</li>
              <li><b>답장 쓰기</b> 결과 뒤 최대 6번 이어지는 짧은 대화</li>
            </ol>
          </div>
          <div className="p-diagram">
            <div className="p-node">내 고민 문장</div>
            <div className="p-arrow">↓</div>
            <div className="p-split">
              <div className="p-node p-node--brass">공유 페이지<small>AI에 바로 연결</small></div>
              <div className="p-node p-node--brass">내 컴퓨터 서버<small>.env 키는 서버에만</small></div>
            </div>
            <div className="p-arrow">↓</div>
            <div className="p-node p-node--sage">응답 검증<small>인용이 원문에 있는가 · 형식 · 후보곡 안인가</small></div>
            <div className="p-arrow">↓ 실패하면</div>
            <div className="p-node">내장 질문 풀 · 규칙 결과로 끝까지 진행</div>
          </div>
        </div>
      ),
    },
    {
      title: '실제 곡 추천',
      notes: '추천곡은 실제 발매곡입니다. 32곡 모두 YouTube에서 공식 채널, 제목, 삽입 가능 여부를 확인했습니다. 추천 순서는 지금 원하는 노래, 고민의 맥락, 사용자가 말한 취향 순입니다. 다른 곡 추천을 누르면 고민과 결과는 그대로 두고 이번 세션에 들은 곡을 피해 새 곡을 보여줍니다.',
      body: () => (
        <div className="p-two">
          <div>
            <p className="p-kicker">06 · 오늘의 추천곡</p>
            <p className="p-big">{SONGS.length}<small>곡</small></p>
            <p className="p-lead">공식 채널·레이블 영상만, 제목·채널·삽입 가능 여부를 확인한 곡만 추천해요. 목록 밖 곡이나 주소는 만들지 않아요.</p>
            <div className="p-bars">
              {[['한국어', counts.ko], ['영어', counts.en], ['연주곡', counts.inst]].map(([l, n]) => (
                <div key={l as string}><span>{l}</span><i style={{ width: `${((n as number) / SONGS.length) * 100}%` }} /><b>{n}</b></div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="p-h3">추천 우선순위</h3>
            <ol className="p-steps">
              <li><b>1</b><span>지금 원하는 노래<small>닮은 곡 {counts.same} · 편안해지는 곡 {counts.calm} · 힘이 나는 곡 {counts.energy}</small></span></li>
              <li><b>2</b><span>고민의 맥락<small>예: 학업 고민에는 가사 없는 연주곡 가산점</small></span></li>
              <li><b>3</b><span>내가 말한 취향<small>한국어·영어·가사 없는 곡</small></span></li>
            </ol>
            <p className="p-note">‘다른 곡 추천’ → 고민과 결과는 그대로, 이번 세션에 들은 곡은 피해서</p>
          </div>
        </div>
      ),
    },
    {
      title: '끊기지 않는 음악',
      notes: '음악은 사이트 전체에서 하나의 플레이어로 재생됩니다. 한 번 켜면 기록하고, 결과를 보고, 리포트를 넘기는 동안에도 끊기지 않습니다. 화면 위쪽의 음악 ON/OFF로 언제든 켜고 끌 수 있고, 곡이 끝나면 다음 곡으로 이어집니다. 자동재생은 하지 않습니다.',
      body: () => (
        <div className="p-two">
          <div>
            <p className="p-kicker">07 · 음악 플레이어</p>
            <h2 className="p-title">한 번 켜면,<br />리포트까지 계속</h2>
            <ul className="p-list p-list--dots">
              <li>기록·결과·리포트 화면의 <b>음악 ON/OFF</b> 스위치</li>
              <li>페이지를 옮겨도 플레이어는 하나 — 끊기지 않음</li>
              <li>곡이 끝나면 잔잔한 목록으로 자동 이어짐</li>
              <li>결과·리포트의 ‘여기서 듣기’도 같은 플레이어</li>
              <li>재생 중에는 3D 바이닐이 회전</li>
            </ul>
          </div>
          <div className="p-dockmock" aria-hidden="true">
            <div className="p-dockmock__video"><span>▶ YouTube 공식 영상</span></div>
            <div className="p-dockmock__bar"><div><b>River Flows in You</b><small>이루마 (Yiruma)</small></div><i>❚❚</i><i>▶❙</i><i>✕</i></div>
            <div className="p-dockmock__chip"><span className="p-eq"><i /><i /><i /></span>음악 ON</div>
          </div>
        </div>
      ),
    },
    {
      title: '결과와 리포트',
      notes: '결과 화면은 네 부분입니다. 지금 마음의 요약에는 내가 쓴 원문 구절이 그대로 인용되고, 오늘의 추천곡, 오늘의 한 걸음, 그리고 원하면 16가지 고민저장소 유형까지 알아볼 수 있습니다. 결과는 6장짜리 리포트로 넘겨 보고, 보관함에 저장하면 새로고침해도 다시 열 수 있습니다.',
      body: () => (
        <div className="p-two">
          <div>
            <p className="p-kicker">08 · 결과 · 리포트 · 보관함</p>
            <ol className="p-list">
              <li><b>지금 마음의 요약</b> 내가 쓴 구절을 원문 그대로 인용, 말하지 않은 사실은 덧붙이지 않음</li>
              <li><b>오늘의 추천곡</b> 제목 · 아티스트 · 추천 이유 · 재생</li>
              <li><b>오늘의 한 걸음</b> 언제·무엇을·얼마나가 분명한 행동 하나</li>
              <li><b>내 고민저장소 유형</b> R/T · P/A · E/F · S/M 12문항, 16유형</li>
            </ol>
            <p className="p-note">리포트 6장 · 전체 보기 · 텍스트 복사 · 내 보관함(날짜별, 새로고침 후에도 유지)</p>
          </div>
          <div className="p-types">
            {Object.entries(TYPE_NAMES).map(([code, t]) => (
              <div key={code}><b>{code}</b><span>{t.name}</span></div>
            ))}
          </div>
        </div>
      ),
    },
    {
      title: '디자인',
      notes: '디자인 콘셉트는 밤에 문을 여는 개인 서재 겸 음악 감상실입니다. 홈과 음악은 어두운 딥 포레스트, 고민을 쓰는 곳과 리포트는 종이 같은 웜 아이보리로 나눴고, 첫 화면의 바이닐은 WebGL로 직접 그려 따뜻한 측면광과 그림자를 넣었습니다. 화면 크기에 따라 전체 비율이 함께 커지고, 모바일에서도 확대 없이 읽힙니다.',
      body: () => (
        <div className="p-two">
          <div>
            <p className="p-kicker">09 · 아트 디렉션</p>
            <h2 className="p-title">밤에 문을 여는<br />개인 서재 겸 음악 감상실</h2>
            <ul className="p-list p-list--dots">
              <li>홈은 조도가 낮은 감상실, 기록은 책상 위 기록지, 결과는 편지와 음반</li>
              <li>WebGL로 그린 3D 바이닐 — 동심원 홈·브라스 라벨·측면광·그림자</li>
              <li>Noto Serif KR 제목 + Pretendard 본문</li>
              <li>모든 화면 크기에 맞춰 비율이 함께 커지는 반응형</li>
            </ul>
          </div>
          <div className="p-swatches">
            {[['딥 포레스트', '#14221E', '홈 · 음악'], ['웜 아이보리', '#F5F0E7', '기록 · 리포트'], ['세이지 그린', '#3D5A52', '주요 버튼'], ['뮤트 세이지', '#A8BAAD', '보조 글자'], ['브러시드 브라스', '#B89A63', '라벨 · 가장자리'], ['잉크 차콜', '#232823', '본문']].map(([n, c, r]) => (
              <div key={c}><i style={{ background: c }} /><b>{n}</b><span>{c} · {r}</span></div>
            ))}
          </div>
        </div>
      ),
    },
    {
      title: '안전과 개인정보',
      notes: '고민을 다루는 서비스라 안전과 개인정보를 가장 먼저 챙겼습니다. AI를 쓸 때는 입력 전에 전송 사실을 안내하고 끌 수 있게 했고, YouTube에는 고민 원문을 보내지 않습니다. 저장은 사용자가 누를 때만 이 브라우저에 됩니다. 자해나 자살 관련 표현이 보이면 109와 1388 상담 안내를 먼저 보여줍니다.',
      body: () => (
        <div>
          <p className="p-kicker">10 · 안전 · 개인정보</p>
          <h2 className="p-title">고민을 다루는 만큼, 조심스럽게</h2>
          <div className="p-grid4">
            <div><b>전송 안내</b><span>AI를 쓰면 입력 전에 알리고, 스위치로 끌 수 있어요</span></div>
            <div><b>원문 보호</b><span>YouTube에는 고민 원문을 보내지 않아요 · API 키는 서버에만</span></div>
            <div><b>저장은 내가 누를 때만</b><span>이 브라우저의 내 보관함에만 저장돼요</span></div>
            <div><b>위기 안내</b><span>위험한 표현에는 자살예방 상담전화 109 · 청소년 상담 1388을 먼저 안내</span></div>
          </div>
          <p className="p-foot">고민저장소는 AI이고 전문 상담사가 아니라는 점을 화면에서 분명히 알려요</p>
        </div>
      ),
    },
    {
      title: '기술 구성',
      notes: '기술적으로는 React와 TypeScript로 화면을 만들고, 3D 바이닐은 WebGL 셰이더로 직접 그렸습니다. 음악은 YouTube IFrame API로 재생하고, AI 기능은 같은 프롬프트 파일을 공유 페이지와 Node 서버가 함께 씁니다. 개발은 Google Antigravity로 진행했습니다. 별도 설치 없이 시작 파일을 더블클릭하면 실행됩니다.',
      body: () => (
        <div>
          <p className="p-kicker">11 · 기술 구성</p>
          <h2 className="p-title">설치 없이, 더블클릭으로 실행</h2>
          <div className="p-stack">
            {[['화면', 'React 19 + TypeScript', '해시 라우팅 · 반응형 · 키보드 탐색'], ['3D', 'WebGL2 셰이더', '바이닐 직접 렌더링 · CSS 대체 화면'], ['음악', 'YouTube IFrame API', '사이트 전체 플레이어 · 공식 영상 32곡'], ['개발', 'Google Antigravity', 'AI 에이전트 개발 환경으로 제작'], ['AI', 'LLM + 규칙 엔진', '질문·편지·답장 · 실패 시 내장 규칙으로 대체'], ['저장', 'LocalStorage', '내 보관함 · 새로고침 후 복원'], ['실행', '고민저장소 시작.bat', 'Node 서버 또는 PowerShell 간단 서버'], ['발표', '이 화면', 'F 발표 화면 · N 대본 · ← → · O 전체 보기']].map(([a, b, c]) => (
              <div key={a}><span>{a}</span><b>{b}</b><small>{c}</small></div>
            ))}
          </div>
        </div>
      ),
    },
    {
      title: '시연', dark: true,
      notes: '이제 직접 시연해보겠습니다. 고민을 하나 적어 이어지는 질문에 답하고, 결과와 추천곡을 확인한 뒤 음악을 켠 채로 리포트까지 넘겨보겠습니다. 감사합니다.',
      body: () => (
        <div className="p-end">
          <p className="p-kicker">12 · 시연</p>
          <h2 className="p-cover__title p-end__title">직접 써볼게요</h2>
          <p className="p-cover__sub">고민 적기 → 이어지는 질문 → 결과와 추천곡 → 음악 켜기 → 리포트</p>
          <div className="p-end__actions">
            <a className="btn btn--ivory btn--lg" href="#write">고민 기록하기 →</a>
            <a className="btn btn--line-dark btn--lg" href="#home">홈으로</a>
          </div>
          <p className="p-end__thanks">감사합니다 · {BRAND}</p>
        </div>
      ),
    },
  ];

  const N = SLIDES.length;
  const [i, setI] = useState(() => Math.max(0, Math.min(N - 1, (startAt ?? 1) - 1)));
  const [notes, setNotes] = useState(true);
  const [fs, setFs] = useState(isFullscreen());
  useEffect(() => {
    const f = () => setFs(isFullscreen());
    document.addEventListener('fullscreenchange', f);
    document.addEventListener('webkitfullscreenchange', f);
    return () => { document.removeEventListener('fullscreenchange', f); document.removeEventListener('webkitfullscreenchange', f); };
  }, []);
  const [overview, setOverview] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const go = useCallback((n: number) => setI(Math.max(0, Math.min(N - 1, n))), [N]);

  useEffect(() => { history.replaceState(null, '', `#present-${i + 1}`); }, [i]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'KeyN') { setNotes((v) => !v); return; }
      if (e.code === 'KeyO') { setOverview((v) => !v); return; }
      if (e.key === 'Escape' && overview) { setOverview(false); return; }
      if (overview) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); go(i + 1); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(i - 1); }
      if (e.key === 'Home') go(0);
      if (e.key === 'End') go(N - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [i, overview, go, N]);
  useEffect(() => { stage.current?.focus({ preventScroll: true }); }, [i, overview]);

  const S = SLIDES[i];
  return (
    <div className={`page page--paper report present ${fs ? 'is-presenting' : ''} ${notes ? 'has-script' : ''}`}>
      <header className="deck-bar">
        <a className="btn btn--text" href="#home">← 홈</a>
        <div className="deck-bar__title"><Seal size={26} /><span>{BRAND} 발표 자료</span></div>
        <div className="deck-bar__tools">
          <MusicToggle className="music-toggle--chip" />
          <button type="button" className="btn btn--chip btn--chip-sage p-start" onClick={() => toggleFullscreen()}>
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 8V3h5M17 8V3h-5M3 12v5h5M17 12v5h-5" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
            발표 시작 <kbd className="p-kbd">F</kbd>
          </button>
          <button type="button" className="btn btn--chip" onClick={() => setOverview((v) => !v)} aria-pressed={overview}>{overview ? '한 장씩 보기' : '전체 보기'} <kbd className="p-kbd">O</kbd></button>
          <button type="button" className="btn btn--chip" onClick={() => setNotes((v) => !v)} aria-pressed={notes}>대본 <kbd className="p-kbd">N</kbd></button>
        </div>
      </header>
      <main id="main" className="deck">
        {overview ? (
          <div className="overview" ref={stage} tabIndex={-1} aria-label="발표 자료 전체 보기">
            <h1 className="sr-only">발표 자료 전체 보기</h1>
            <ol className="overview__grid">
              {SLIDES.map((s, k) => (
                <li key={k}>
                  <button type="button" className={`thumb ${k === i ? 'is-current' : ''}`} onClick={() => { setI(k); setOverview(false); }} aria-label={`${k + 1}장 ${s.title} 열기`}>
                    <span className="thumb__frame" aria-hidden="true"><div className={`slide p-slide ${s.dark ? 'p-slide--dark' : ''}`}>{s.body()}</div></span>
                    <span className="thumb__title"><b>{String(k + 1).padStart(2, '0')}</b> {s.title}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <>
            <div className="deck__stage" ref={stage} tabIndex={-1} aria-roledescription="슬라이드" aria-label={`${i + 1} / ${N} · ${S.title}`}>
              <h1 className="sr-only">{BRAND} 발표 {i + 1}장 {S.title}</h1>
              <div key={i} className="deck__slide"><div className={`slide p-slide ${S.dark ? 'p-slide--dark' : ''}`}>{S.body()}</div></div>
            </div>
            <nav className="deck__nav" aria-label="슬라이드 이동">
              <button type="button" className="deck__arrow" onClick={() => go(i - 1)} disabled={i === 0} aria-label="이전 장">‹</button>
              <ol className="deck__dots">
                {SLIDES.map((s, k) => (
                  <li key={k}><button type="button" className={k === i ? 'is-on' : ''} onClick={() => go(k)} aria-label={`${k + 1}장 ${s.title}`} aria-current={k === i ? 'step' : undefined} /></li>
                ))}
              </ol>
              <p className="deck__count"><strong>{i + 1}</strong> / {N} · {S.title}</p>
              <button type="button" className="deck__arrow" onClick={() => go(i + 1)} disabled={i === N - 1} aria-label="다음 장">›</button>
            </nav>
            {notes && (
              <aside className="p-notes" aria-label="발표 대본">
                <div className="p-notes__head"><b>대본 · {i + 1} / {N} {S.title}</b><span>{i + 1 < N ? `다음 · ${SLIDES[i + 1].title}` : '마지막 장'}</span></div>
                <p>{S.notes}</p>
              </aside>
            )}
            <p className="deck__hint">{fs ? '← → 넘기기 · N 대본 숨기기/보이기 · F 또는 Esc 전체화면 끝내기' : 'F를 누르면 발표 화면(전체화면)으로 · ← → 넘기기 · N 대본 · O 전체 보기'}</p>
          </>
        )}
      </main>
    </div>
  );
}
