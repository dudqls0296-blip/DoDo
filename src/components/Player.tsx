// 음악 플레이어: 재생·일시정지, 진행 시간, 탐색, 볼륨, Canvas 파형(AnalyserNode)
import { useEffect, useRef, useState } from 'react';
import { engine, fmt, useEngine } from '../audio/engine';
import { TRACKS, type TrackId } from '../data/content';

export function Waveform({ active }: { active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const g = cv.getContext('2d')!;
    let raf = 0;
    let data: Uint8Array<ArrayBuffer> | null = null;
    const color = getComputedStyle(cv).getPropertyValue('--wave').trim() || '#A8BAAD';
    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = Math.round(cv.clientWidth * dpr), H = Math.round(cv.clientHeight * dpr);
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      g.clearRect(0, 0, W, H);
      const an = engine.analyser;
      const bars = Math.max(24, Math.floor(W / (7 * dpr)));
      const gap = W / bars;
      g.fillStyle = color;
      if (an && active) {
        if (!data || data.length !== an.frequencyBinCount) data = new Uint8Array(an.frequencyBinCount);
        an.getByteFrequencyData(data);
        const used = Math.floor(data.length * 0.28);
        for (let i = 0; i < bars; i++) {
          // 로그 스케일로 저음~고음 분포
          const idx = Math.floor(Math.pow(i / bars, 1.6) * used);
          const v = data[idx] / 255;
          const h = Math.max(2 * dpr, v * H * 0.92);
          g.globalAlpha = 0.45 + v * 0.55;
          g.fillRect(i * gap + gap * 0.2, (H - h) / 2, gap * 0.55, h);
        }
        // 시간 영역 파형을 얇은 선으로 겹침
        const td = new Uint8Array(an.fftSize);
        an.getByteTimeDomainData(td);
        g.globalAlpha = 0.9;
        g.strokeStyle = getComputedStyle(cv).getPropertyValue('--wave-line').trim() || '#B89A63';
        g.lineWidth = 1.2 * dpr;
        g.beginPath();
        for (let i = 0; i < td.length; i += 8) {
          const x = (i / td.length) * W;
          const y = (td[i] / 255) * H;
          i ? g.lineTo(x, y) : g.moveTo(x, y);
        }
        g.stroke();
        g.globalAlpha = 1;
        raf = requestAnimationFrame(draw);
      } else {
        g.globalAlpha = 0.5;
        for (let i = 0; i < bars; i++) g.fillRect(i * gap + gap * 0.2, H / 2 - dpr, gap * 0.55, 2 * dpr);
        g.globalAlpha = 1;
      }
    };
    draw();
    const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); draw(); });
    ro.observe(cv);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [active]);
  return <canvas ref={ref} className="waveform" role="img" aria-label={active ? '재생 중인 소리의 실시간 파형' : '정지된 파형'} />;
}

export function useClock(active: boolean) {
  const [t, setT] = useState(engine.currentTime());
  useEffect(() => {
    setT(engine.currentTime());
    if (!active) return;
    let raf = 0;
    const tick = () => { setT(engine.currentTime()); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return t;
}

export default function Player({ trackId, recommended, onTrack }: { trackId: TrackId; recommended: TrackId; onTrack?: (id: TrackId) => void }) {
  const s = useEngine();
  const track = TRACKS[trackId];
  const mine = s.track === trackId;
  const playing = mine && s.status === 'playing';
  const loading = mine && s.status === 'loading';
  const t = useClock(playing);
  const cur = mine ? t : 0;
  const dur = mine ? s.duration : 0;
  const [seeking, setSeeking] = useState<number | null>(null);

  useEffect(() => { if (!engine.state.track || engine.state.status !== 'playing') engine.select(trackId); }, [trackId]);

  return (
    <div className="player">
      <div className="player__row">
        <button
          type="button"
          className={`play-btn ${playing ? 'is-playing' : ''}`}
          onClick={() => engine.toggle(trackId)}
          aria-label={playing ? '일시정지' : loading ? '준비 중' : '재생'}
          aria-pressed={playing}
          disabled={loading}
        >
          {loading ? <span className="spinner" /> : playing ? (
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>
          )}
        </button>
        <div className="player__meta">
          <p className="player__status" aria-live="polite">
            {loading ? '음반을 준비하는 중…' : playing ? '재생 중' : mine && s.status === 'paused' ? '일시정지' : mine && s.status === 'ended' ? '끝까지 들었어요' : '재생 버튼을 누르면 시작해요'}
          </p>
          <p className="player__sample">
            <span className="tag">샘플</span> 정식 곡 {track.fullLength} 중 {dur ? fmt(dur) : '약 1분'} 분량 · {track.bpm} BPM · {track.key}
          </p>
        </div>
      </div>

      <Waveform active={playing} />

      <div className="player__seek">
        <span className="time">{fmt(seeking ?? cur)}</span>
        <input
          type="range"
          min={0}
          max={dur || 1}
          step={0.1}
          value={seeking ?? cur}
          disabled={!dur}
          aria-label="재생 위치"
          aria-valuetext={`${fmt(seeking ?? cur)} / ${fmt(dur)}`}
          onChange={(e) => setSeeking(Number(e.target.value))}
          onPointerUp={() => { if (seeking !== null) { engine.seek(seeking); setSeeking(null); } }}
          onKeyUp={() => { if (seeking !== null) { engine.seek(seeking); setSeeking(null); } }}
          onBlur={() => { if (seeking !== null) { engine.seek(seeking); setSeeking(null); } }}
          style={{ ['--fill' as any]: `${dur ? (((seeking ?? cur) / dur) * 100).toFixed(2) : 0}%` }}
        />
        <span className="time">{dur ? fmt(dur) : '--:--'}</span>
      </div>

      <div className="player__volume">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M16 8.5a5 5 0 0 1 0 7" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
        <input
          type="range" min={0} max={1} step={0.01} value={s.volume}
          aria-label="볼륨" aria-valuetext={`${Math.round(s.volume * 100)}%`}
          onChange={(e) => engine.setVolume(Number(e.target.value))}
          style={{ ['--fill' as any]: `${s.volume * 100}%` }}
        />
        <span className="time">{Math.round(s.volume * 100)}</span>
      </div>

      {mine && s.status === 'error' && (
        <div className="player__error" role="alert">
          <p>소리를 시작하지 못했어요. {s.error}</p>
          <button type="button" className="btn btn--ghost-dark" onClick={() => engine.play(trackId)}>다시 시도</button>
        </div>
      )}

      {onTrack && (
        <div className="tracklist" role="group" aria-label="다른 곡 들어보기">
          {(Object.keys(TRACKS) as TrackId[]).map((id) => (
            <button
              key={id}
              type="button"
              className={`tracklist__item ${id === trackId ? 'is-current' : ''}`}
              aria-pressed={id === trackId}
              onClick={() => { if (id !== trackId) { engine.stop(); onTrack(id); } }}
            >
              <span className="tracklist__no">{id}</span>
              <span className="tracklist__title">{TRACKS[id].title}</span>
              {id === recommended && <span className="tracklist__rec">추천</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
