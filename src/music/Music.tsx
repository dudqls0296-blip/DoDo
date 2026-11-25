// 고민저장소 · 사이트 전체 음악 플레이어
// 플레이어는 앱 맨 바깥에 한 번만 만들어져, 홈 → 기록 → 결과 → 리포트로 이동해도 끊기지 않는다.
// YouTube 정책에 따라 영상 화면(200px 이상)이 보이는 작은 플레이어(도크)로 재생한다. 자동재생 없음.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { SONGS, watchUrl, searchUrl, type Song } from '../data/songs';

declare global {
  interface Window { YT?: any; onYouTubeIframeAPIReady?: () => void }
}

let apiPromise: Promise<any> | null = null;
function loadApi(): Promise<any> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.async = true;
      s.onerror = () => { apiPromise = null; reject(new Error('load')); };
      document.head.appendChild(s);
      setTimeout(() => { apiPromise = null; reject(new Error('timeout')); }, 9000);
    });
  }
  return apiPromise;
}

const ERR: Record<number, string> = {
  2: '영상 주소를 읽지 못했어요.',
  5: '이 브라우저에서 재생하지 못했어요.',
  100: '영상을 찾을 수 없어요. 삭제되었거나 비공개로 바뀌었을 수 있어요.',
  101: '이 영상은 다른 사이트에서 재생할 수 없도록 설정되어 있어요.',
  150: '이 영상은 다른 사이트에서 재생할 수 없도록 설정되어 있어요.',
  153: '이 화면에서는 YouTube 플레이어를 불러올 수 없어요.',
};

/** 홈에서 ‘음악 켜기’를 누르면 흐르는 잔잔한 목록 (모두 검증된 공식 영상) */
export const RADIO = ['yiruma-river-flows-in-you', 'iu-through-the-night', 'max-richter-daylight', 'bts-life-goes-on', 'einaudi-experience', 'beatles-let-it-be', 'keane-somewhere-only-we-know', 'leehi-breathe'];

export type MusicStatus = 'off' | 'loading' | 'playing' | 'paused' | 'error';

interface MusicApi {
  on: boolean;
  status: MusicStatus;
  current: Song | null;
  error: string;
  /** 플레이어가 준비됐는지 (광고가 나오는 동안에도 true) */
  ready: boolean;
  /** 이 곡을 지금 재생 (사용자 클릭에서 호출) */
  play: (song: Song) => void;
  /** 음악 켜기/끄기 */
  setOn: (v: boolean) => void;
  toggleOn: () => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
  isPlaying: (songId: string) => boolean;
}

const Ctx = createContext<MusicApi | null>(null);
export const useMusic = () => useContext(Ctx)!;

const fileMode = () => typeof location !== 'undefined' && location.protocol === 'file:';

export function MusicProvider({ children }: { children: ReactNode }) {
  const [on, setOnState] = useState(false);
  const [status, setStatus] = useState<MusicStatus>('off');
  const [current, setCurrent] = useState<Song | null>(null);
  const [error, setError] = useState('');
  /** 플레이어가 준비됐는지 (광고 중에도 true) */
  const [isReady, setIsReady] = useState(false);
  const queue = useRef<string[]>([...RADIO]);
  const player = useRef<any>(null);
  const ready = useRef(false);
  const host = useRef<HTMLDivElement>(null);
  const curRef = useRef<Song | null>(null);
  curRef.current = current;

  const nextFromQueue = useCallback((afterId?: string) => {
    const q = queue.current;
    const i = afterId ? q.indexOf(afterId) : -1;
    const id = q[(i + 1) % q.length];
    return SONGS.find((s) => s.id === id) || SONGS[0];
  }, []);

  const startVideo = useCallback(async (song: Song) => {
    setError('');
    setCurrent(song);
    setOnState(true);
    if (fileMode()) {
      setStatus('error');
      setError('파일을 직접 연 상태에서는 YouTube가 삽입 재생을 막아요. 폴더의 ‘고민저장소 시작.bat’으로 열면 여기서 바로 들을 수 있어요.');
      return;
    }
    setStatus('loading');
    try {
      if (player.current && ready.current) {
        player.current.loadVideoById(song.videoId);
        return;
      }
      const YT = await loadApi();
      if (!host.current) return;
      host.current.innerHTML = '';
      const el = document.createElement('div');
      host.current.appendChild(el);
      const origin = location.protocol.startsWith('http') ? location.origin : undefined;
      ready.current = false;
      player.current = new YT.Player(el, {
        videoId: song.videoId,
        host: 'https://www.youtube-nocookie.com',
        playerVars: { autoplay: 1, rel: 0, playsinline: 1, modestbranding: 1, ...(origin ? { origin } : {}) },
        events: {
          onReady: (e: any) => { ready.current = true; setIsReady(true); try { e.target.playVideo(); } catch { /* noop */ } },
          onStateChange: (e: any) => {
            const S = YT.PlayerState;
            if (e.data === S.PLAYING) { setStatus('playing'); setError(''); }
            else if (e.data === S.PAUSED) setStatus('paused');
            else if (e.data === S.BUFFERING) setStatus((s) => (s === 'playing' ? s : 'loading'));
            else if (e.data === S.ENDED) {
              // 끝까지 들으면 다음 곡으로 이어진다
              const nxt = nextFromQueue(curRef.current?.id);
              setCurrent(nxt);
              player.current.loadVideoById(nxt.videoId);
            }
          },
          onError: (e: any) => { setStatus('error'); setError(ERR[e.data] || '재생 중 문제가 생겼어요.'); },
        },
      });
      setTimeout(() => {
        if (!ready.current) { setStatus('error'); setError('플레이어를 불러오지 못했어요. 네트워크를 확인하거나 YouTube에서 열어주세요.'); }
      }, 10000);
    } catch {
      setStatus('error');
      setError('YouTube 플레이어를 불러오지 못했어요. 이 화면에서는 YouTube에서 열어 들어주세요.');
    }
  }, [nextFromQueue]);

  const play = useCallback((song: Song) => {
    // 고른 곡을 재생하고, 끝나면 잔잔한 목록으로 이어간다
    queue.current = [song.id, ...RADIO.filter((id) => id !== song.id)];
    startVideo(song);
  }, [startVideo]);

  const pause = useCallback(() => { try { player.current?.pauseVideo?.(); } catch { /* noop */ } }, []);
  const resume = useCallback(() => {
    if (!player.current || !ready.current) { if (curRef.current) startVideo(curRef.current); return; }
    try { player.current.playVideo(); } catch { /* noop */ }
  }, [startVideo]);
  const next = useCallback(() => startVideo(nextFromQueue(curRef.current?.id)), [nextFromQueue, startVideo]);
  /** 지금 곡을 YouTube에서 이어 보기 (사이트 안 재생은 멈춘다) */
  const openOnYouTube = useCallback(() => {
    const s = curRef.current;
    if (!s) return;
    let t = 0;
    try { t = Math.floor(player.current?.getCurrentTime?.() || 0); } catch { /* noop */ }
    try { player.current?.pauseVideo?.(); } catch { /* noop */ }
    window.open(watchUrl(s) + (t > 3 ? `&t=${t}s` : ''), '_blank', 'noopener');
  }, []);

  const setOn = useCallback((v: boolean) => {
    if (v) {
      if (curRef.current && player.current && ready.current) { setOnState(true); resume(); }
      else startVideo(curRef.current || nextFromQueue());
    } else {
      pause();
      setOnState(false);
      setStatus('off');
    }
  }, [pause, resume, startVideo, nextFromQueue]);

  const api = useMemo<MusicApi>(() => ({
    on, status, current, error, ready: isReady, play, setOn, toggleOn: () => setOn(!on), pause, resume, next,
    isPlaying: (id) => on && status === 'playing' && current?.id === id,
  }), [on, status, current, error, isReady, play, setOn, pause, resume, next]);

  useEffect(() => { document.documentElement.dataset.music = on ? 'on' : 'off'; }, [on]);

  // 준비된 뒤에도 4초 넘게 '재생 중'이 안 되면 광고가 나오는 중일 가능성이 커서 안내를 띄운다
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    setStuck(false);
    if (!(on && isReady && status === 'loading')) return;
    const t = window.setTimeout(() => setStuck(true), 4000);
    return () => window.clearTimeout(t);
  }, [on, isReady, status, current]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <aside className={`dock ${on ? 'is-on' : ''}`} aria-label="음악 플레이어" aria-hidden={!on}>
        <div className="dock__video">
          <div ref={host} className="dock__host" />
          {status === 'loading' && !isReady && <div className="dock__cover"><span className="spinner" /> 불러오는 중…</div>}
          {status === 'error' && current && (
            <div className="dock__cover dock__cover--err">
              <p>{error}</p>
              <a href={watchUrl(current)} target="_blank" rel="noopener noreferrer">YouTube에서 듣기 ↗</a>
              <a href={searchUrl(current)} target="_blank" rel="noopener noreferrer">YouTube에서 검색</a>
            </div>
          )}
        </div>
        {current && on && stuck && status === 'loading' && (
          <p className="dock__hint">광고 건너뛰기가 눌리지 않으면 <button type="button" onClick={openOnYouTube}>YouTube에서 열기 ↗</button> 또는 다음 곡을 눌러주세요.</p>
        )}
        {current && (
          <div className="dock__bar">
            <div className="dock__meta">
              <p className="dock__title">{current.title}</p>
              <p className="dock__artist">{current.artist}</p>
            </div>
            <div className="dock__ctrl">
              {status === 'playing' ? (
                <button type="button" className="dock__btn" onClick={pause} aria-label="일시정지" tabIndex={on ? 0 : -1}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
                </button>
              ) : (
                <button type="button" className="dock__btn" onClick={resume} aria-label="재생" tabIndex={on ? 0 : -1}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>
                </button>
              )}
              <button type="button" className="dock__btn" onClick={next} aria-label="다음 곡" title="다음 곡" tabIndex={on ? 0 : -1}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l9 6-9 6zM16 6h2v12h-2z" /></svg>
              </button>
              <button type="button" className="dock__btn dock__btn--yt" onClick={openOnYouTube} aria-label="YouTube에서 열기" title="YouTube에서 열기 (광고 건너뛰기가 안 될 때)" tabIndex={on ? 0 : -1}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5H5v14h14v-5M13 4h7v7M20 4l-9 9" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
              </button>
              <button type="button" className="dock__btn dock__btn--off" onClick={() => setOn(false)} aria-label="음악 끄기" title="음악 끄기" tabIndex={on ? 0 : -1}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
              </button>
            </div>
          </div>
        )}
      </aside>
    </Ctx.Provider>
  );
}

/** 헤더·리포트에 두는 음악 ON/OFF 스위치 */
export function MusicToggle({ className = '' }: { className?: string }) {
  const m = useMusic();
  const playing = m.on && m.status === 'playing';
  return (
    <button type="button" className={`music-toggle ${m.on ? 'is-on' : ''} ${className}`} onClick={m.toggleOn} aria-pressed={m.on}
      title={m.on ? '음악 끄기' : '음악 켜기'}>
      <span className={`music-toggle__eq ${playing ? 'is-playing' : ''}`} aria-hidden="true"><i /><i /><i /></span>
      <span className="music-toggle__label">음악 {m.on ? 'ON' : 'OFF'}</span>
    </button>
  );
}

/** 결과·리포트에서 쓰는 ‘여기서 듣기’ 버튼 묶음 */
export function SongButtons({ song, linkOnly = false, size = 'lg' }: { song: Song; linkOnly?: boolean; size?: 'lg' | 'md' }) {
  const m = useMusic();
  const isCur = m.on && m.current?.id === song.id;
  const playing = isCur && m.status === 'playing';
  const loading = isCur && m.status === 'loading' && !m.ready;
  const busy = isCur && m.status === 'loading' && m.ready; // 광고 또는 버퍼링 중
  const cls = size === 'lg' ? 'btn--lg' : '';
  return (
    <div className="song-btns">
      {!linkOnly && (
        <button type="button" className={`btn btn--brass ${cls}`} disabled={loading}
          onClick={() => (playing || busy ? m.pause() : isCur && m.status === 'paused' ? m.resume() : m.play(song))}>
          {loading ? <><span className="spinner" /> 불러오는 중</> : playing || busy ? (
            <><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" /></svg> 일시정지</>
          ) : (
            <><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg> {isCur ? '이어 듣기' : '여기서 듣기'}</>
          )}
        </button>
      )}
      <a className={`btn btn--line-dark ${cls}`} href={watchUrl(song)} target="_blank" rel="noopener noreferrer">
        YouTube에서 듣기
        <svg className="btn__ext" viewBox="0 0 20 20" aria-hidden="true"><path d="M8 4H4v12h12v-4M11 3h6v6M17 3l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
      </a>
    </div>
  );
}
