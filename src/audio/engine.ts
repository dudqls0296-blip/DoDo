// 고민저장소 · 재생 엔진
// AudioBufferSourceNode → GainNode(볼륨) → AnalyserNode → 출력
import { useEffect, useState } from 'react';
import type { TrackId } from '../data/content';
import { renderTrack } from './tracks';

export type Status = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';

export interface EngineState {
  track: TrackId | null;
  status: Status;
  duration: number;
  volume: number;
  error?: string;
}

type Listener = (s: EngineState) => void;

class Engine {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  analyser: AnalyserNode | null = null;
  private src: AudioBufferSourceNode | null = null;
  private buffer: AudioBuffer | null = null;
  private startedAt = 0;
  private offset = 0;
  private listeners = new Set<Listener>();
  private token = 0;
  state: EngineState = { track: null, status: 'idle', duration: 0, volume: 0.8 };

  subscribe(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private set(patch: Partial<EngineState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l(this.state));
  }

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      const AC: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) throw new Error('이 브라우저는 Web Audio를 지원하지 않아요.');
      this.ctx = new AC();
      this.gain = this.ctx.createGain();
      this.gain.gain.value = this.state.volume;
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.82;
      this.gain.connect(this.analyser).connect(this.ctx.destination);
    }
    return this.ctx;
  }

  /** 곡을 선택만 한다 (재생하지 않음) */
  select(id: TrackId) {
    if (this.state.track === id) return;
    this.stopSource();
    this.buffer = null;
    this.offset = 0;
    this.set({ track: id, status: 'idle', duration: 0, error: undefined });
  }

  /** 클릭 핸들러에서 호출해야 한다 */
  async play(id?: TrackId) {
    const track = id ?? this.state.track;
    if (!track) return;
    if (track !== this.state.track) this.select(track);
    const my = ++this.token;
    try {
      const ctx = this.ensureCtx();
      const resume = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
      if (!this.buffer) {
        this.set({ status: 'loading', error: undefined });
        const [buf] = await Promise.all([renderTrack(track), resume]);
        if (my !== this.token) return;
        this.buffer = buf;
        this.set({ duration: buf.duration });
      } else {
        await resume;
      }
      if (ctx.state !== 'running') throw new Error('오디오가 시작되지 않았어요.');
      if (this.offset >= this.buffer.duration - 0.05) this.offset = 0;
      this.startSource(this.offset);
      this.set({ status: 'playing', error: undefined });
    } catch (e: any) {
      if (my !== this.token) return;
      this.set({ status: 'error', error: e?.message || '오디오를 재생하지 못했어요.' });
    }
  }

  pause() {
    if (this.state.status !== 'playing') return;
    this.offset = this.currentTime();
    this.stopSource();
    this.set({ status: 'paused' });
  }

  toggle(id?: TrackId) {
    if (this.state.status === 'playing' && (!id || id === this.state.track)) this.pause();
    else void this.play(id);
  }

  seek(t: number) {
    if (!this.buffer) return;
    const clamped = Math.max(0, Math.min(t, this.buffer.duration - 0.01));
    this.offset = clamped;
    if (this.state.status === 'playing') {
      this.stopSource();
      this.startSource(clamped);
    } else {
      this.set({ status: this.state.status === 'ended' ? 'paused' : this.state.status });
      this.listeners.forEach((l) => l(this.state));
    }
  }

  setVolume(v: number) {
    if (this.gain && this.ctx) this.gain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
    this.set({ volume: v });
  }

  currentTime(): number {
    if (!this.buffer) return 0;
    if (this.state.status === 'playing' && this.ctx) return Math.min(this.buffer.duration, this.offset + (this.ctx.currentTime - this.startedAt));
    return this.offset;
  }

  stop() {
    this.token++;
    this.stopSource();
    this.offset = 0;
    if (this.state.status === 'playing' || this.state.status === 'loading') this.set({ status: 'paused' });
  }

  private startSource(at: number) {
    if (!this.ctx || !this.buffer || !this.gain) return;
    const s = this.ctx.createBufferSource();
    s.buffer = this.buffer;
    s.connect(this.gain);
    s.onended = () => {
      if (this.src !== s) return;
      this.src = null;
      this.offset = this.buffer ? this.buffer.duration : 0;
      this.set({ status: 'ended' });
    };
    this.startedAt = this.ctx.currentTime;
    this.offset = at;
    s.start(0, at);
    this.src = s;
  }

  private stopSource() {
    const s = this.src;
    this.src = null;
    if (s) {
      s.onended = null;
      try { s.stop(); } catch { /* 이미 정지 */ }
      s.disconnect();
    }
  }
}

export const engine = new Engine();

export function useEngine(): EngineState {
  const [s, setS] = useState(engine.state);
  useEffect(() => {
    const off = engine.subscribe(setS);
    return () => { off(); };
  }, []);
  return s;
}

export function fmt(t: number): string {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
