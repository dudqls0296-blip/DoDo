// 결과: 지금 마음의 요약 → 오늘의 추천곡 → 오늘의 한 걸음 → 내 고민저장소 유형
import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES, NEED_LABEL } from '../data/flow';
import { SONGS, type Song } from '../data/songs';
import { AXES, TYPE_NAMES, scoreType, type Axis } from '../data/typeQuiz';
import { formatDate, type Record_ } from '../lib/storage';
import { reason, recommend, seedOf, type RecInput } from '../lib/recommend';
import { getServerInfo } from '../lib/conversation';
import { Footer, Header } from '../components/Header';
import Vinyl from '../vinyl/Vinyl';
import { SongButtons, VideoSlot, useMusic } from '../music/Music';

type Availability = 'embed' | 'link' | 'search';
import TypeQuiz from '../components/TypeQuiz';
import ReplyBox from '../components/ReplyBox';

// 이번 세션에 이미 보여준 곡 (가능한 한 반복하지 않기)
const SESSION_KEY = 'gominjeojangso.shown';
export function sessionShown(): string[] {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || '[]'); } catch { return []; }
}
export function markShown(id: string) {
  try {
    const s = sessionShown().filter((x) => x !== id);
    s.push(id);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s.slice(-60)));
  } catch { /* noop */ }
}

export function recInput(rec: Record_, extraExclude: string[] = []): RecInput {
  return {
    category: rec.category,
    need: rec.result.need,
    prefs: rec.result.prefs,
    sticking: rec.result.sticking,
    seed: seedOf(rec.worry),
    soundAxis: rec.type ? (rec.type.code[3] as 'S' | 'M') : undefined,
    exclude: Array.from(new Set([...sessionShown(), ...rec.songHistory, ...extraExclude])),
  };
}

function useAvailability(song: Song): Availability {
  const fileMode = typeof location !== 'undefined' && location.protocol === 'file:';
  const [mode, setMode] = useState<Availability>(fileMode ? 'link' : 'embed');
  useEffect(() => {
    let alive = true;
    if (fileMode) return;
    setMode('embed');
    getServerInfo().then(async (info) => {
      if (!info.youtube) return;
      try {
        const r = await fetch(`/api/youtube/check?ids=${song.videoId}`);
        if (!r.ok) return;
        const j = await r.json();
        const v = j[song.videoId];
        if (!alive) return;
        if (!v || !v.public) setMode('search');
        else if (!v.embeddable) setMode('link');
      } catch { /* 확인 실패 시 그대로 둔다 */ }
    });
    return () => { alive = false; };
  }, [song.videoId]);
  return mode;
}

interface Props {
  rec: Record_;
  saved: boolean;
  saveError: boolean;
  onUpdate: (r: Record_) => void;
  onSave: () => void;
  onReport: () => void;
  onRestart: () => void;
}

export default function Result({ rec, saved, saveError, onUpdate, onSave, onReport, onRestart }: Props) {
  const R = rec.result;
  const cat = CATEGORIES.find((c) => c.id === rec.category)!;
  const song = SONGS.find((s) => s.id === rec.songId)!;
  const music = useMusic();
  const [quiz, setQuiz] = useState(false);
  const mode = useAvailability(song);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const why = useMemo(() => rec.reasons?.[song.id] ?? reason(song, recInput(rec), R.phrase), [song.id, rec.type?.code, rec.reasons]);
  useEffect(() => { titleRef.current?.focus(); markShown(song.id); }, []);
  useEffect(() => { markShown(song.id); }, [song.id]);

  const another = () => {
    const next = recommend(recInput(rec, [song.id]));
    markShown(next.id);
    onUpdate({ ...rec, songId: next.id, songHistory: [...rec.songHistory, next.id] });
  };

  const finishQuiz = (answers: ('a' | 'b')[]) => {
    const { code } = scoreType(answers);
    const base = { ...rec, type: { code, answers } };
    const tSong = recommend(recInput(base, [song.id]));
    markShown(tSong.id);
    onUpdate({ ...base, type: { code, answers, songId: tSong.id } });
    setQuiz(false);
  };

  const type = rec.type ? TYPE_NAMES[rec.type.code] : null;
  const typeSong = rec.type?.songId ? SONGS.find((s) => s.id === rec.type!.songId) : undefined;

  return (
    <div className="page result">
      <Header tone="light" />
      <main id="main">
        {R.crisis && (
          <aside className="care" role="note" aria-label="도움 받을 수 있는 곳">
            <p><b>혼자 감당하기 어려울 만큼 힘들다면, 지금 바로 이야기할 수 있는 곳이 있어요.</b></p>
            <p>자살예방 상담전화 <b>109</b> (24시간) · 청소년 상담 <b>1388</b> (전화·문자·카카오톡) · 가까운 어른이나 선생님에게도 꼭 알려주세요.</p>
          </aside>
        )}

        {/* 1 · 지금 마음의 요약 */}
        <section className="letter-band" aria-labelledby="sum-title">
          <article className="letter">
            <header className="letter__head">
              <p className="letter__from">고민저장소에서 온 편지</p>
              <p className="letter__meta">{formatDate(rec.createdAt)} · {cat.label} · No. {rec.docNo}</p>
            </header>
            <p className="badge">{R.ai ? 'AI가 당신의 문장을 읽고 쓴 편지' : '답변 기반 요약'}</p>
            <h1 id="sum-title" ref={titleRef} tabIndex={-1} className="letter__title">지금 마음의 요약</h1>
            <figure className="quote">
              <blockquote><p>{R.quote}</p></blockquote>
              <figcaption>내가 직접 쓴 문장에서</figcaption>
            </figure>
            <p className="letter__lead">{R.lead}</p>
          </article>
        </section>

        {/* 2 · 오늘의 추천곡 */}
        <section className="record-band" aria-labelledby="track-title">
          <div className="record">
            <div className="record__disc">
              <Vinyl spinning={music.isPlaying(song.id)} priority="player" label={{ top: '고민저장소 · 오늘의 추천곡', center: '오늘의 곡', bottom: song.artist.slice(0, 18) }} />
            </div>
            <div className="record__info">
              <p className="record__kicker">오늘의 추천곡 <span className="need">{NEED_LABEL[R.need]}</span></p>
              <h2 id="track-title" className="record__title">{song.title}</h2>
              <p className="record__artist">{song.artist} <span>· {song.genre}</span></p>
              <p className="record__why">{why}</p>
              <div className="yt">
                {mode === 'embed' && <VideoSlot song={song} />}
                <SongButtons song={song} linkOnly={mode !== 'embed'} />
                <p className="yt__src">공식 영상 · {song.channel} · 자동재생 없음 · 화면을 내리거나 리포트로 넘어가도 화면 구석 플레이어로 이어져요. ‘PIP로 띄우기’를 누르면 다른 창 위에도 떠 있어요.</p>
              </div>
              <div className="record__more">
                <button type="button" className="btn btn--ghost-dark" onClick={another}>
                  <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10a6 6 0 0 1 10.2-4.2M16 4v3.5h-3.5M16 10a6 6 0 0 1-10.2 4.2M4 16v-3.5h3.5" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
                  다른 곡 추천
                </button>
                <span>같은 ‘{NEED_LABEL[R.need]}’ 기준으로 아직 듣지 않은 곡을 골라요 · 이번 기록에서 {rec.songHistory.length}곡째</span>
              </div>
            </div>
          </div>
        </section>

        {/* 3 · 오늘의 한 걸음 */}
        <section className="step-band" aria-labelledby="today-title">
          <div className="note">
            <h2 id="today-title" className="note__title">오늘의 한 걸음</h2>
            <p className="note__cheer">{R.cheer}</p>
            <p className="note__action">{R.action}</p>
          </div>

          <ReplyBox rec={rec} onUpdate={onUpdate} />

          {/* 4 · 내 고민저장소 유형 */}
          <div className="typebox" aria-labelledby="type-title">
            <h2 id="type-title" className="typebox__title">내 고민저장소 유형</h2>
            {!rec.type && !quiz && (
              <div className="typebox__intro">
                <p>R/T · P/A · E/F · S/M 네 가지 축, 12문항으로 나를 다루는 방식을 알아봐요. 같은 유형이라도 오늘의 고민과 원하는 노래에 따라 곡은 달라져요.</p>
                <button type="button" className="btn btn--sage btn--lg" onClick={() => setQuiz(true)}>내 유형 알아보기</button>
              </div>
            )}
            {quiz && <TypeQuiz onDone={finishQuiz} onCancel={() => setQuiz(false)} />}
            {rec.type && type && !quiz && (
              <div className="typecard">
                <div className="typecard__code" aria-label={`유형 코드 ${rec.type.code}`}>
                  {rec.type.code.split('').map((ch, i) => <span key={i}>{ch}</span>)}
                </div>
                <div className="typecard__body">
                  <h3>{type.name}</h3>
                  <p className="typecard__line">{type.line}</p>
                  <ul className="typecard__axes">
                    {(['RT', 'PA', 'EF', 'SM'] as Axis[]).map((ax, i) => (
                      <li key={ax}><b>{AXES[ax].name}</b> {AXES[ax].desc[rec.type!.code[i]]}</li>
                    ))}
                  </ul>
                  {typeSong && (
                    <p className="typecard__song">
                      유형과 오늘의 고민으로 고른 한 곡 · <b>{typeSong.title}</b> — {typeSong.artist}{' '}
                    </p>
                  )}
                  {typeSong && (
                    <div className="typecard__play"><SongButtons song={typeSong} size="md" /></div>
                  )}
                  <button type="button" className="btn btn--text" onClick={() => setQuiz(true)}>다시 하기</button>
                </div>
              </div>
            )}
          </div>

          <div className="actions" role="group" aria-label="결과 저장과 리포트">
            <button type="button" className="btn btn--sage btn--lg" onClick={onReport}>리포트 보기</button>
            <button type="button" className="btn btn--line btn--lg" onClick={onSave} disabled={saved}>{saved ? '보관함에 저장됨' : '내 보관함에 저장'}</button>
            <button type="button" className="btn btn--text" onClick={onRestart}>새로 기록하기</button>
          </div>
          {saved && <p className="actions__msg">이 브라우저의 <a href="#archive">내 보관함</a>에 저장했어요. 이후에 바꾼 곡이나 유형도 함께 저장돼요.</p>}
          {saveError && <p className="actions__msg is-error" role="alert">이 브라우저에서는 저장 공간을 쓸 수 없어 저장하지 못했어요.</p>}
          {rec.sample && <p className="actions__msg">예시 기록이에요. 직접 기록하면 내 문장에 맞춰 질문과 결과가 달라져요.</p>}
        </section>
      </main>
      <Footer tone="light" />
    </div>
  );
}
