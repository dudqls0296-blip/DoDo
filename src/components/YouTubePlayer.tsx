// YouTube 재생: ‘여기서 듣기’를 눌렀을 때만 플레이어를 만든다 (자동재생 없음).
// 삽입 제한·재생 오류·로드 실패 시 확인된 영상 링크로 열 수 있게 한다.
import { useEffect, useRef, useState } from 'react';
import { watchUrl, searchUrl, type Song } from '../data/songs';

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
      setTimeout(() => reject(new Error('timeout')), 9000);
    });
  }
  return apiPromise;
}

export type PlayState = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';

const ERR: Record<number, string> = {
  2: '영상 주소를 읽지 못했어요.',
  5: '이 브라우저에서 재생하지 못했어요.',
  100: '영상을 찾을 수 없어요. 삭제되었거나 비공개로 바뀌었을 수 있어요.',
  101: '이 영상은 다른 사이트에서 재생할 수 없도록 설정되어 있어요.',
  150: '이 영상은 다른 사이트에서 재생할 수 없도록 설정되어 있어요.',
  153: '이 화면에서는 YouTube 플레이어를 불러올 수 없어요.',
};

export type Availability = 'embed' | 'link' | 'search';

export default function YouTubePlayer({ song, onState, mode = 'embed' }: { song: Song; onState?: (s: PlayState) => void; mode?: Availability }) {
  const [state, setState] = useState<PlayState>('idle');
  const [msg, setMsg] = useState('');
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<any>(null);
  const update = (s: PlayState) => { setState(s); onState?.(s); };

  // 곡이 바뀌면 플레이어를 정리한다
  useEffect(() => {
    update('idle');
    setMsg('');
    return () => { try { player.current?.destroy?.(); } catch { /* noop */ } player.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song.videoId]);

  const start = async () => {
    setMsg('');
    update('loading');
    try {
      const YT = await loadApi();
      if (!host.current) return;
      host.current.innerHTML = '';
      const el = document.createElement('div');
      host.current.appendChild(el);
      const origin = location.protocol.startsWith('http') ? location.origin : undefined;
      let ready = false;
      player.current = new YT.Player(el, {
        videoId: song.videoId,
        host: 'https://www.youtube-nocookie.com',
        playerVars: { autoplay: 1, rel: 0, playsinline: 1, modestbranding: 1, ...(origin ? { origin } : {}) },
        events: {
          onReady: (e: any) => { ready = true; try { e.target.playVideo(); } catch { /* noop */ } },
          onStateChange: (e: any) => {
            const S = YT.PlayerState;
            if (e.data === S.PLAYING) update('playing');
            else if (e.data === S.PAUSED) update('paused');
            else if (e.data === S.ENDED) update('ended');
          },
          onError: (e: any) => { update('error'); setMsg(ERR[e.data] || '재생 중 문제가 생겼어요.'); },
        },
      });
      setTimeout(() => {
        if (!ready) { update('error'); setMsg('플레이어를 불러오지 못했어요. 네트워크를 확인하거나 YouTube에서 열어주세요.'); }
      }, 10000);
    } catch {
      update('error');
      setMsg(location.protocol === 'file:'
        ? '파일을 직접 연 상태에서는 YouTube 플레이어를 불러올 수 없어요. npm start로 실행하거나 YouTube에서 들어주세요.'
        : 'YouTube 플레이어를 불러오지 못했어요. 네트워크를 확인하거나 YouTube에서 열어주세요.');
    }
  };

  const showFrame = state !== 'idle' && state !== 'error';
  if (mode !== 'embed') {
    return (
      <div className="yt">
        <div className="yt__actions">
          {mode === 'link' ? (
            <a className="btn btn--brass btn--lg" href={watchUrl(song)} target="_blank" rel="noopener noreferrer">YouTube에서 듣기</a>
          ) : (
            <a className="btn btn--brass btn--lg" href={searchUrl(song)} target="_blank" rel="noopener noreferrer">YouTube에서 검색</a>
          )}
        </div>
        <p className="yt__error">{mode === 'search' ? '지금은 영상 링크를 확인할 수 없어, 곡명과 아티스트로 검색해요.'
          : location.protocol === 'file:' ? '파일을 직접 연 상태에서는 YouTube가 삽입 재생을 막아요. 폴더의 ‘고민저장소 시작.bat’으로 열면 여기서 바로 들을 수 있어요.'
          : '이 영상은 다른 사이트에서 재생할 수 없도록 설정되어 있어, YouTube에서 열어요.'}</p>
        <p className="yt__src">공식 영상 · {song.channel}</p>
      </div>
    );
  }
  return (
    <div className="yt">
      <div className={`yt__frame ${showFrame ? 'is-on' : ''}`}>
        <div ref={host} className="yt__host" />
        {state === 'loading' && <div className="yt__loading"><span className="spinner" /> 플레이어를 불러오는 중…</div>}
      </div>
      <div className="yt__actions">
        {state === 'idle' || state === 'error' ? (
          <button type="button" className="btn btn--brass btn--lg" onClick={start}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>
            여기서 듣기
          </button>
        ) : state === 'playing' ? (
          <button type="button" className="btn btn--brass btn--lg" onClick={() => player.current?.pauseVideo?.()}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" /></svg>
            일시정지
          </button>
        ) : state === 'paused' || state === 'ended' ? (
          <button type="button" className="btn btn--brass btn--lg" onClick={() => player.current?.playVideo?.()}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>
            {state === 'ended' ? '다시 듣기' : '이어 듣기'}
          </button>
        ) : (
          <button type="button" className="btn btn--brass btn--lg" disabled><span className="spinner" /> 준비 중</button>
        )}
        <a className="btn btn--line-dark btn--lg" href={watchUrl(song)} target="_blank" rel="noopener noreferrer">
          YouTube에서 듣기
          <svg className="btn__ext" viewBox="0 0 20 20" aria-hidden="true"><path d="M8 4H4v12h12v-4M11 3h6v6M17 3l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
        </a>
      </div>
      {state === 'error' && (
        <p className="yt__error" role="alert">
          {msg} <a href={watchUrl(song)} target="_blank" rel="noopener noreferrer">YouTube에서 영상 열기</a>
          {' · '}<a href={searchUrl(song)} target="_blank" rel="noopener noreferrer">YouTube에서 검색</a>
        </p>
      )}
      <p className="yt__src">공식 영상 · {song.channel} · 자동재생 없음</p>
    </div>
  );
}
