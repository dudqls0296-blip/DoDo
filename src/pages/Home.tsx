import Vinyl from '../vinyl/Vinyl';
import { Footer, Header, Seal } from '../components/Header';
import { useMusic } from '../music/Music';

const SIDES = [
  { no: 'A1', title: '고민 고르기', body: '진로·미래, 학업·시험, 인간관계, 자존감, 번아웃·무기력, 기타 중 하나를 골라요.', time: '10초' },
  { no: 'A2', title: '내 말로 쓰기', body: '“어떤 일이 마음에 남았나요?” 짧게 적어도 시작할 수 있어요.', time: '1분' },
  { no: 'B1', title: '내 답에서 이어지는 질문', body: '적은 문장을 읽고, 빠진 것만 한 번에 하나씩 물어요. 1~3개면 끝나요.', time: '1분' },
  { no: 'B2', title: '결과와 오늘의 추천곡', body: '마음의 요약, 실제 발매곡 한 곡, 오늘의 한 걸음. 원하면 보관함에 저장해요.', time: '바로' },
];

export default function Home({ onStart }: { onStart: () => void }) {
  const m = useMusic();
  const playing = m.on && m.status === 'playing';
  return (
    <div className="page page--dark home">
      <div className="room" aria-hidden="true">
        <div className="room__glow" />
        <div className="room__beam" />
        <div className="room__floor" />
        <div className="room__grain" />
      </div>
      <Header tone="dark" current="home" />
      <main id="main">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero__copy">
            <p className="hero__eyebrow reveal" style={{ ['--d' as any]: '0ms' }}>밤에 문을 여는 개인 서재 · 음악 감상실</p>
            <h1 id="hero-title" className="hero__title" tabIndex={-1}>
              <span className="line"><span className="reveal-up" style={{ ['--d' as any]: '80ms' }}>혼자 품어온 고민을,</span></span>
              <span className="line"><span className="reveal-up" style={{ ['--d' as any]: '200ms' }}>조용히 꺼내놓는 곳.</span></span>
            </h1>
            <p className="hero__desc reveal" style={{ ['--d' as any]: '380ms' }}>지금 마음을 기록하면, 당신에게 맞는 음악과 오늘의 작은 한 걸음을 건네요.</p>
            <div className="hero__actions reveal" style={{ ['--d' as any]: '480ms' }}>
              <button type="button" className="btn btn--ivory btn--lg" onClick={onStart}>
                고민 기록하기
                <svg className="btn__arrow" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
              </button>
              <a className="btn btn--line-dark btn--lg" href="#archive">내 보관함</a>
            </div>
            <p className="hero__note reveal" style={{ ['--d' as any]: '580ms' }}>약 3분 · 질문은 1~3개 · 노래는 직접 눌렀을 때만 재생돼요</p>
          </div>

          <div className="hero__stage">
            <div className="sleeve-cover" aria-hidden="true">
              <div className="sleeve-cover__top">
                <Seal size={44} />
                <div>
                  <p className="sleeve-cover__title">고민저장소</p>
                  <p className="sleeve-cover__sub">제1집 · 밤의 기록 · 오늘의 한 곡</p>
                </div>
              </div>
              <div className="sleeve-cover__rings"><span /><span /><span /></div>
            </div>
            <Vinyl interactive spinning={playing} priority="hero" className="hero__vinyl" />
          </div>
          <a className="scroll-cue" href="#sleeve-title" onClick={(e) => { e.preventDefault(); document.getElementById('back')?.scrollIntoView({ behavior: 'smooth' }); }}>
          <span>오늘 밤의 순서</span>
          <i aria-hidden="true" />
        </a>
        </section>



        <section className="back" id="back" aria-labelledby="sleeve-title">
          <div className="back__inner">
            <div className="back__head">
              <p className="back__label">고민저장소 · 제1집 뒷면</p>
              <h2 id="sleeve-title">오늘 밤의 순서</h2>
              <p>음반 뒷면의 곡 목록처럼, 기록은 네 단계로 이어져요. 내가 쓴 문장을 읽고 다음 질문을 건네요.</p>
              <div className="back__btns">
                <button type="button" className="btn btn--sage btn--lg" onClick={onStart}>A1부터 시작하기</button>
                <a className="btn btn--line btn--lg" href="#present">기능 소개 발표 자료</a>
              </div>
            </div>
            <ol className="tracks">
              {SIDES.map((s) => (
                <li key={s.no}>
                  <span className="tracks__no">{s.no}</span>
                  <div>
                    <h3>{s.title}</h3>
                    <p>{s.body}</p>
                  </div>
                  <span className="tracks__time">{s.time}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="back__credits">
            <p><b>기록</b> 당신</p>
            <p><b>질문</b> 내 문장을 읽고 이어지는 질문</p>
            <p><b>음악</b> 공식 영상을 확인한 실제 발매곡</p>
            <p><b>보관</b> 이 브라우저의 내 보관함</p>
          </div>
        </section>
      </main>
      <Footer tone="dark" />
    </div>
  );
}
