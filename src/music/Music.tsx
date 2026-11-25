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
  /** 화면 구석 PIP 창으로 띄우기. 지원하지 않으면 안내 문구를 돌려준다 */
  openPip: () => Promise<string | null>;
  closePip: () => void;
  pip: boolean;
  /** 페이지 안 영상 자리(임베드 슬롯) 등록 */
  registerSlot: (el: HTMLElement | null, songId: string) => void;
}

export const pipSupported = () => typeof window !== 'undefined' && 'documentPictureInPicture' in window && window.top === window;
const PIP_UNSUPPORTED = '이 브라우저에서는 PIP 창을 열 수 없어요. Chrome이나 Edge에서 열어주세요. (영상 위에서 마우스 오른쪽 버튼을 두 번 누르면 나오는 ‘PIP 모드’로도 띄울 수 있어요.)';

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
  const dockRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  const slot = useRef<{ el: HTMLElement; songId: string } | null>(null);
  const [slotTick, setSlotTick] = useState(0);
  const [pip, setPip] = useState(false);
  const pipWin = useRef<Window | null>(null);
  const pipTime = useRef(0);
  const pipResume = useRef(true);
  const [notice, setNotice] = useState('');

  const nextFromQueue = useCallback((afterId?: string) => {
    const q = queue.current;
    const i = afterId ? q.indexOf(afterId) : -1;
    const id = q[(i + 1) % q.length];
    return SONGS.find((s) => s.id === id) || SONGS[0];
  }, []);

  const startVideo = useCallback(async (song: Song) => {
    if (pipWin.current) { pipResume.current = false; pipWin.current.close(); pipWin.current = null; setPip(false); }
    setError('');
    setNotice('');
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

  const closePip = useCallback(() => { pipWin.current?.close(); }, []);

  /** 지금 곡을 항상 위에 떠 있는 작은 창(Document Picture-in-Picture)으로 이어서 재생 */
  const openPip = useCallback(async (): Promise<string | null> => {
    const song = curRef.current;
    if (!song) return '먼저 곡을 재생해주세요.';
    if (pipWin.current) { pipWin.current.focus(); return null; }
    if (!pipSupported()) { setNotice(PIP_UNSUPPORTED); return PIP_UNSUPPORTED; }
    let t = 0;
    try { t = Math.floor(player.current?.getCurrentTime?.() || 0); } catch { /* noop */ }
    let win: Window;
    try {
      win = await (window as any).documentPictureInPicture.requestWindow({ width: 480, height: 270 });
    } catch {
      setNotice(PIP_UNSUPPORTED);
      return PIP_UNSUPPORTED;
    }
    try { player.current?.pauseVideo?.(); } catch { /* noop */ }
    pipWin.current = win;
    pipTime.current = t;
    pipResume.current = true;
    setPip(true);
    setNotice('');
    win.document.title = `${song.title} · 고민저장소`;
    const body = win.document.body;
    body.style.cssText = 'margin:0;background:#000;overflow:hidden;';
    const frame = win.document.createElement('iframe');
    const origin = encodeURIComponent(location.origin);
    frame.src = `https://www.youtube-nocookie.com/embed/${song.videoId}?autoplay=1&start=${t}&rel=0&playsinline=1&enablejsapi=1&origin=${origin}`;
    frame.title = `${song.title} - ${song.artist}`;
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.allowFullscreen = true;
    frame.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;';
    body.appendChild(frame);
    // PIP 창 영상이 몇 초까지 재생됐는지 받아두었다가, 창을 닫으면 그 자리부터 이어서 재생한다
    frame.addEventListener('load', () => {
      try { frame.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 'pip', channel: 'widget' }), '*'); } catch { /* noop */ }
    });
    win.addEventListener('message', (e: MessageEvent) => {
      if (typeof e.data !== 'string' || !/youtube/.test(e.origin)) return;
      try {
        const d = JSON.parse(e.data);
        const ct = d?.info?.currentTime;
        if (typeof ct === 'number') pipTime.current = ct;
      } catch { /* noop */ }
    });
    win.addEventListener('pagehide', () => {
      pipWin.current = null;
      setPip(false);
      if (!pipResume.current) return;
      try {
        player.current?.seekTo?.(pipTime.current, true);
        player.current?.playVideo?.();
      } catch { /* noop */ }
    });
    return null;
  }, []);

  const registerSlot = useCallback((el: HTMLElement | null, songId: string) => {
    if (el) slot.current = { el, songId };
    else if (slot.current?.songId === songId || !el) slot.current = null;
    setSlotTick((n) => n + 1);
  }, []);

  const setOn = useCallback((v: boolean) => {
    if (v) {
      if (curRef.current && player.current && ready.current) { setOnState(true); resume(); }
      else startVideo(curRef.current || nextFromQueue());
    } else {
      if (pipWin.current) { pipResume.current = false; pipWin.current.close(); }
      pause();
      setOnState(false);
      setStatus('off');
    }
  }, [pause, resume, startVideo, nextFromQueue]);

  const api = useMemo<MusicApi>(() => ({
    on, status, current, error, ready: isReady, play, setOn, toggleOn: () => setOn(!on), pause, resume, next,
    isPlaying: (id) => on && (status === 'playing' || pip) && current?.id === id,
    openPip, closePip, pip, registerSlot,
  }), [on, status, current, error, isReady, play, setOn, pause, resume, next, openPip, closePip, pip, registerSlot]);

  // 페이지에 영상 자리가 있고 그 곡을 재생 중이면, 같은 플레이어를 그 자리에 겹쳐 보여준다 (임베드처럼 보임).
  // 자리가 화면 밖으로 나가면 다시 화면 구석으로 돌아간다. 플레이어를 옮기지 않으므로 재생이 끊기지 않는다.
  useEffect(() => {
    const dock = dockRef.current;
    const video = videoRef.current;
    if (!dock || !video) return;
    let raf = 0;
    const reset = () => {
      if (!dock.classList.contains('is-inline')) return;
      dock.classList.remove('is-inline');
      dock.style.left = dock.style.top = dock.style.width = dock.style.clipPath = '';
      video.style.height = '';
    };
    const tick = () => {
      const s = slot.current;
      const want = !!s && s.el.isConnected && on && !!current && current.id === s.songId && status !== 'error';
      if (want) {
        const r = s!.el.getBoundingClientRect();
        // 위쪽에 붙어 있는 막대(리포트 상단 바)는 가리지 않는다
        const bar = document.querySelector('.deck-bar');
        const topBound = bar ? Math.max(0, bar.getBoundingClientRect().bottom) : 0;
        const top = Math.max(r.top, topBound);
        const bottom = Math.min(r.bottom, innerHeight);
        const visible = r.height > 0 ? Math.max(0, bottom - top) / r.height : 0;
        if (visible >= 0.5) {
          dock.classList.add('is-inline');
          dock.style.left = `${r.left}px`;
          dock.style.top = `${r.top}px`;
          dock.style.width = `${r.width}px`;
          video.style.height = `${r.height}px`;
          const clipTop = Math.max(0, topBound - r.top);
          const clipBottom = Math.max(0, r.bottom - innerHeight);
          dock.style.clipPath = clipTop || clipBottom ? `inset(${clipTop}px 0 ${clipBottom}px 0)` : '';
        } else reset();
      } else reset();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); reset(); };
  }, [on, current, status, slotTick]);

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
      <aside ref={dockRef} className={`dock ${on ? 'is-on' : ''} ${pip ? 'is-pip' : ''}`} aria-label="음악 플레이어" aria-hidden={!on}>
        <div className="dock__video" ref={videoRef}>
          <div ref={host} className="dock__host" />
          {status === 'loading' && !isReady && <div className="dock__cover"><span className="spinner" /> 불러오는 중…</div>}
          {pip && (
            <div className="dock__cover dock__cover--pip">
              <p>화면 구석 PIP 창에서 재생 중이에요.</p>
              <button type="button" className="btn btn--brass" onClick={closePip}>여기로 돌아오기</button>
            </div>
          )}
          {status === 'error' && current && (
            <div className="dock__cover dock__cover--err">
              <p>{error}</p>
              <a href={watchUrl(current)} target="_blank" rel="noopener noreferrer">YouTube에서 듣기 ↗</a>
              <a href={searchUrl(current)} target="_blank" rel="noopener noreferrer">YouTube에서 검색</a>
            </div>
          )}
        </div>
        {notice && on && <p className="dock__hint">{notice} <button type="button" onClick={() => setNotice('')}>닫기</button></p>}
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
 <button type="button" className="dock__btn dock__btn--pip" onClick={() => (pip ? closePip() : openPip())} aria-label={pip ? 'PIP 닫기' : 'PIP로 띄우기'} title={pip ? 'PIP 닫기' : '화면 구석 PIP 창으로 띄우기'} tabIndex={on ? 0 : -1}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="2" /><rect x="12" y="11" width="7" height="6" rx="1" /></svg>
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
  const [msg, setMsg] = useState('');
  const isCur = m.on && m.current?.id === song.id;
  const playing = isCur && m.status === 'playing';
  const loading = isCur && m.status === 'loading' && !m.ready;
  const busy = isCur && m.status === 'loading' && m.ready; // 광고 또는 버퍼링 중
  const cls = size === 'lg' ? 'btn--lg' : '';
  return (
    <div className="song-btns">
      {!linkOnly && (
        <button type="button" className={`btn btn--brass ${cls}`} disabled={loading}
          onClick={() => (isCur && m.pip ? m.closePip() : playing || busy ? m.pause() : isCur && m.status === 'paused' ? m.resume() : m.play(song))}>
          {isCur && m.pip ? <>PIP 창 닫고 여기서 듣기</> : loading ? <><span className="spinner" /> 불러오는 중</> : playing || busy ? (
            <><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" /></svg> 일시정지</>
          ) : (
            <><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg> {isCur ? '이어 듣기' : '여기서 듣기'}</>
          )}
        </button>
      )}
      {!linkOnly && isCur && !loading && !m.pip && (
        <button type="button" className={`btn btn--line-dark ${cls}`} onClick={async () => setMsg((await m.openPip()) || '')}>
          <svg viewBox="0 0 24 24" aria-hidden="true" className="btn__ext"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="2" /><rect x="12" y="11" width="7" height="6" rx="1" fill="currentColor" /></svg>
          PIP로 띄우기
        </button>
      )}
      <a className={`btn btn--line-dark ${cls}`} href={watchUrl(song)} target="_blank" rel="noopener noreferrer">
        YouTube에서 듣기
        <svg className="btn__ext" viewBox="0 0 20 20" aria-hidden="true"><path d="M8 4H4v12h12v-4M11 3h6v6M17 3l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
      </a>
      {msg && <p className="song-btns__msg">{msg}</p>}
    </div>
  );
}

/** 결과·리포트 안의 영상 자리. 재생하면 사이트 플레이어가 이 자리에 그대로 겹쳐져 임베드처럼 보인다 */
export function VideoSlot({ song }: { song: Song }) {
  const m = useMusic();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    m.registerSlot(ref.current, song.id);
    return () => m.registerSlot(null, song.id);
  }, [song.id]);
  const isCur = m.on && m.current?.id === song.id;
  return (
    <div ref={ref} className={`vslot ${isCur ? 'is-cur' : ''}`}>
      <img src={`https://i.ytimg.com/vi/${song.videoId}/hqdefault.jpg`} alt="" loading="lazy" referrerPolicy="no-referrer" />
      {isCur && m.pip ? (
        <div className="vslot__cover"><p>화면 구석 PIP 창에서 재생 중이에요.</p><button type="button" className="btn btn--brass" onClick={m.closePip}>여기로 돌아오기</button></div>
      ) : (
        <button type="button" className="vslot__play" onClick={() => m.play(song)} aria-label={`${song.title} 영상 재생`}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>
        </button>
      )}
    </div>
  );
}
