// 리포트: 표지 → 나의 이야기 → 지금 마음의 요약 → 오늘의 추천곡 → 오늘의 한 걸음 → 내 유형
import { useCallback, useEffect, useRef, useState } from 'react';
import { BRAND } from '../data/brand';
import { CATEGORIES, NEED_LABEL } from '../data/flow';
import { SONGS, watchUrl } from '../data/songs';
import { AXES, TYPE_NAMES, type Axis } from '../data/typeQuiz';
import { formatDate, type Record_ } from '../lib/storage';
import { reason } from '../lib/recommend';
import { recInput } from './Result';
import { Seal, FullscreenButton } from '../components/Header';
import { MusicToggle, SongButtons, useMusic } from '../music/Music';

const TITLES = ['표지', '나의 이야기', '지금 마음의 요약', '오늘의 추천곡', '오늘의 한 걸음', '내 유형'];

function Slide({ i, rec, onType, thumb = false }: { i: number; rec: Record_; onType: () => void; thumb?: boolean }) {
  const music = useMusic();
  const R = rec.result;
  const cat = CATEGORIES.find((c) => c.id === rec.category)!;
  const song = SONGS.find((s) => s.id === rec.songId)!;
  const type = rec.type ? TYPE_NAMES[rec.type.code] : null;
  switch (i) {
    case 0:
      return (
        <div className="slide s-cover">
          <div className="s-cover__left">
            <Seal size={96} />
            <p className="s-cover__brand">{BRAND}</p>
            <p className="s-cover__doc">No. {rec.docNo}<br />{formatDate(rec.createdAt)}</p>
          </div>
          <div className="s-cover__right">
            <p className="s-kicker">오늘 밤의 기록</p>
            <p className="s-cover__code s-cover__code--cat">{cat.label}</p>
            <h2 className="s-cover__name">“{R.quote}”</h2>
            <p className="s-cover__tag">오늘의 추천곡 · {song.title} — {song.artist}</p>
            <p className="s-foot">내가 직접 쓴 문장과 고른 답으로 만든 리포트예요.</p>
          </div>
        </div>
      );
    case 1:
      return (
        <div className="slide s-notes">
          <p className="s-kicker">02 · 나의 이야기</p>
          <h2 className="s-title">내가 쓴 고민과 이어진 질문</h2>
          <blockquote className="s-story">{rec.worry}</blockquote>
          <ol className="s-qa">
            {rec.turns.map((t, k) => (
              <li key={k}>
                <p className="s-qa__q">{t.q.text}</p>
                <p className="s-qa__a">{t.a.kind === 'option' ? t.a.label : t.a.kind === 'text' ? `“${t.a.text}”` : '건너뜀'}</p>
              </li>
            ))}
            {!rec.turns.length && <li><p className="s-qa__a">이어지는 질문 없이 바로 결과로 넘어갔어요.</p></li>}
          </ol>
        </div>
      );
    case 2:
      return (
        <div className="slide s-vision">
          <p className="s-kicker">03 · 지금 마음의 요약</p>
          <p className="s-vision__text">{R.lead}</p>
          <p className="s-vision__tags">“{R.quote}”</p>
        </div>
      );
    case 3:
      return (
        <div className="slide s-music">
          <div className={`s-music__disc ${music.isPlaying(song.id) ? 'is-spinning' : ''}`} aria-hidden="true"><span>♪</span></div>
          <div>
            <p className="s-kicker">04 · 오늘의 추천곡 · {NEED_LABEL[R.need]}</p>
            <h2 className="s-title">{song.title}</h2>
            <p className="s-music__meta">{song.artist} · {song.genre} · 공식 영상 {song.channel}</p>
            <p>{rec.reasons?.[song.id] ?? reason(song, recInput(rec), R.phrase)}</p>
            {thumb ? <p className="s-music__guide">YouTube 영상</p> : (
              <div className="yt__frame is-on" style={{ marginTop: '1rem', maxWidth: '420px' }}>
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${song.videoId}?rel=0&playsinline=1`}
                  title={`${song.title} - ${song.artist}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            )}
            {!thumb && music.on && music.current && music.current.id !== song.id && <p className="s-music__now">지금 흐르는 곡 · {music.current.title}</p>}
          </div>
        </div>
      );
    case 4:
      return (
        <div className="slide s-routine">
          <div className="s-routine__essay">
            <p className="s-kicker">05 · 오늘의 한 걸음</p>
            <h2 className="s-title">오늘 해볼 한 가지</h2>
            <p>{R.cheer}</p>
          </div>
          <p className="s-action">{R.action}</p>
        </div>
      );
    default:
      return (
        <div className="slide s-metrics">
          <div>
            <p className="s-kicker">06 · 내 고민저장소 유형</p>
            {rec.type && type ? (
              <>
                <p className="s-cover__code">{rec.type.code}</p>
                <h2 className="s-title">{type.name}</h2>
                <p>{type.line}</p>
              </>
            ) : (
              <>
                <h2 className="s-title">아직 알아보지 않았어요</h2>
                <p>12문항으로 R/T · P/A · E/F · S/M 유형을 알아볼 수 있어요.</p>
                <button type="button" className="btn btn--sage" onClick={onType}>결과 화면에서 알아보기</button>
              </>
            )}
          </div>
          {rec.type && (
            <ul className="s-metrics__side s-axes">
              {(['RT', 'PA', 'EF', 'SM'] as Axis[]).map((ax, k) => (
                <li key={ax}><h3>{AXES[ax].name}</h3><p>{AXES[ax].desc[rec.type!.code[k]]}</p></li>
              ))}
            </ul>
          )}
        </div>
      );
  }
}

function reportText(rec: Record_): string {
  const R = rec.result;
  const song = SONGS.find((s) => s.id === rec.songId)!;
  const cat = CATEGORIES.find((c) => c.id === rec.category)!;
  return [
    `${BRAND} 리포트 No. ${rec.docNo} (${formatDate(rec.createdAt)}) · ${cat.label}`,
    '', '[지금 마음의 요약]', `“${R.quote}”`, R.lead,
    '', `[오늘의 추천곡] ${song.title} — ${song.artist}`, watchUrl(song),
    '', '[오늘의 한 걸음]', R.action,
    ...(rec.type ? ['', `[내 유형] ${rec.type.code} · ${TYPE_NAMES[rec.type.code].name}`] : []),
  ].join('\n');
}

export default function Report({ rec, saved, onSave, onBack }: { rec: Record_; saved: boolean; onSave: () => void; onBack: () => void }) {
  const [i, setI] = useState(0);
  const [overview, setOverview] = useState(false);
  const [copied, setCopied] = useState<'' | 'ok' | 'fail'>('');
  const stage = useRef<HTMLDivElement>(null);
  const N = TITLES.length;
  const go = useCallback((n: number) => setI(Math.max(0, Math.min(N - 1, n))), [N]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Escape' && overview) { setOverview(false); return; }
      if (overview) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(i + 1); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(i - 1); }
      if (e.key === 'Home') go(0);
      if (e.key === 'End') go(N - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [i, overview, go, N]);

  useEffect(() => { stage.current?.focus({ preventScroll: true }); }, [i, overview]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(reportText(rec)); setCopied('ok'); }
    catch { setCopied('fail'); }
    setTimeout(() => setCopied(''), 2400);
  };

  return (
    <div className="page page--paper report">
      <header className="deck-bar">
        <button type="button" className="btn btn--text" onClick={onBack}>← 결과로</button>
        <div className="deck-bar__title">
          <Seal size={26} />
          <span>{BRAND} 리포트</span>
          <span className="deck-bar__doc">No. {rec.docNo}</span>
        </div>
        <div className="deck-bar__tools">
          <MusicToggle className="music-toggle--chip" />
          <FullscreenButton className="fs-btn--chip" />
          <button type="button" className="btn btn--chip" onClick={() => setOverview((v) => !v)} aria-pressed={overview}>{overview ? '한 장씩 보기' : '전체 보기'}</button>
          <button type="button" className="btn btn--chip" onClick={copy}>{copied === 'ok' ? '복사했어요' : copied === 'fail' ? '복사 실패' : '텍스트 복사'}</button>
          <button type="button" className="btn btn--chip btn--chip-sage" onClick={onSave} disabled={saved}>{saved ? '저장됨' : '내 보관함에 저장'}</button>
        </div>
      </header>

      <main id="main" className="deck">
        {overview ? (
          <div className="overview" ref={stage} tabIndex={-1} aria-label="리포트 전체 보기">
            <h1 className="sr-only">리포트 전체 보기</h1>
            <ol className="overview__grid">
              {TITLES.map((t, k) => (
                <li key={t}>
                  <button type="button" className={`thumb ${k === i ? 'is-current' : ''}`} onClick={() => { setI(k); setOverview(false); }} aria-label={`${k + 1}장 ${t} 열기`}>
                    <span className="thumb__frame" aria-hidden="true"><Slide i={k} rec={rec} onType={onBack} thumb /></span>
                    <span className="thumb__title"><b>{String(k + 1).padStart(2, '0')}</b> {t}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <>
            <div className="deck__stage" ref={stage} tabIndex={-1} aria-roledescription="슬라이드" aria-label={`${i + 1} / ${N} · ${TITLES[i]}`}>
              <h1 className="sr-only">{BRAND} 리포트 {i + 1}장 {TITLES[i]}</h1>
              <div key={i} className="deck__slide"><Slide i={i} rec={rec} onType={onBack} /></div>
            </div>
            <nav className="deck__nav" aria-label="슬라이드 이동">
              <button type="button" className="deck__arrow" onClick={() => go(i - 1)} disabled={i === 0} aria-label="이전 장">‹</button>
              <ol className="deck__dots">
                {TITLES.map((t, k) => (
                  <li key={t}><button type="button" className={k === i ? 'is-on' : ''} onClick={() => go(k)} aria-label={`${k + 1}장 ${t}`} aria-current={k === i ? 'step' : undefined} /></li>
                ))}
              </ol>
              <p className="deck__count"><strong>{i + 1}</strong> / {N} · {TITLES[i]}</p>
              <button type="button" className="deck__arrow" onClick={() => go(i + 1)} disabled={i === N - 1} aria-label="다음 장">›</button>
            </nav>
            <p className="deck__hint">← → 로 넘기고, F로 전체화면</p>
          </>
        )}
      </main>
    </div>
  );
}
