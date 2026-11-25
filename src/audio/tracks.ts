// 고민저장소 · Web Audio 신디사이저 트랙 (샘플 버전)
// OfflineAudioContext로 미리 합성해 AudioBuffer로 만든다. 외부 음원 파일은 쓰지 않는다.
import type { TrackId } from '../data/content';

const SR = 24000;
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

interface Kit {
  ctx: OfflineAudioContext;
  out: GainNode; // 드라이 버스
  verb: GainNode; // 리버브 센드
  dly: GainNode; // 딜레이 센드
  noise: AudioBuffer;
  events: { t: number; run: () => void }[];
}

function makeKit(seconds: number, opts: { verb?: number; delayTime?: number; feedback?: number; delayMix?: number }): Kit {
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * seconds), SR);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 3;
  comp.attack.value = 0.01;
  comp.release.value = 0.25;
  const master = ctx.createGain();
  master.gain.value = 0.9;
  comp.connect(master).connect(ctx.destination);

  const out = ctx.createGain();
  out.connect(comp);

  // 리버브: 생성한 감쇠 노이즈 임펄스
  const len = Math.floor(SR * 1.9);
  const ir = ctx.createBuffer(1, len, SR);
  {
    const d = ir.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
  }
  const conv = ctx.createConvolver();
  conv.buffer = ir;
  const verb = ctx.createGain();
  const verbRet = ctx.createGain();
  verbRet.gain.value = opts.verb ?? 0.35;
  verb.connect(conv).connect(verbRet).connect(comp);

  // 딜레이
  const dly = ctx.createGain();
  const d = ctx.createDelay(2);
  d.delayTime.value = opts.delayTime ?? 0.3;
  const fb = ctx.createGain();
  fb.gain.value = opts.feedback ?? 0.35;
  const dlyRet = ctx.createGain();
  dlyRet.gain.value = opts.delayMix ?? 0.3;
  const dlyLp = ctx.createBiquadFilter();
  dlyLp.type = 'lowpass';
  dlyLp.frequency.value = 3200;
  dly.connect(d);
  d.connect(dlyLp).connect(fb).connect(d);
  dlyLp.connect(dlyRet).connect(comp);
  dlyRet.connect(verb);

  const noise = ctx.createBuffer(1, SR * 2, SR);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  return { ctx, out, verb, dly, noise, events: [] };
}

function send(k: Kit, node: AudioNode, dry = 1, verb = 0, dly = 0, pan = 0) {
  const p = k.ctx.createStereoPanner();
  p.pan.value = pan;
  node.connect(p);
  const g = k.ctx.createGain();
  g.gain.value = dry;
  p.connect(g).connect(k.out);
  if (verb) {
    const v = k.ctx.createGain();
    v.gain.value = verb;
    p.connect(v).connect(k.verb);
  }
  if (dly) {
    const v = k.ctx.createGain();
    v.gain.value = dly;
    p.connect(v).connect(k.dly);
  }
}

// ── 악기 ────────────────────────────────────────
function feltPiano(k: Kit, t: number, m: number, vel: number, len = 2.6, pan = 0, verb = 0.5) {
  const { ctx } = k;
  const f = mtof(m);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.22 * vel, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.07 * vel, t + 0.35);
  g.gain.exponentialRampToValueAtTime(0.0008, t + len);
  // 필터 자동화 대신 배음 게인을 빨리 줄여 펠트 해머 느낌을 만든다 (렌더링 비용 절약)
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1100 + 1800 * vel;
  lp.Q.value = 0.4;
  const o1 = ctx.createOscillator();
  o1.type = 'triangle';
  o1.frequency.value = f;
  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = f * 2.0;
  o2.detune.value = 4;
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.45, t);
  g2.gain.exponentialRampToValueAtTime(0.04, t + 0.6);
  o1.connect(lp);
  o2.connect(g2).connect(lp);
  lp.connect(g);
  send(k, g, 1, verb, 0, pan);
  o1.start(t); o2.start(t);
  o1.stop(t + len + 0.05); o2.stop(t + len + 0.05);
}

function pad(k: Kit, t: number, notes: number[], dur: number, opt: { gain?: number; cutoff?: number; attack?: number; verb?: number; type?: OscillatorType } = {}) {
  const { ctx } = k;
  const att = opt.attack ?? 1.2;
  notes.forEach((m, i) => {
    const g = ctx.createGain();
    const peak = (opt.gain ?? 0.05) / Math.sqrt(notes.length);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + att);
    g.gain.setValueAtTime(peak, t + Math.max(att, dur - 0.2));
    g.gain.linearRampToValueAtTime(0, t + dur + 1.4);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = opt.cutoff ?? 1100;
    for (const det of [-9, 8]) {
      const o = ctx.createOscillator();
      o.type = opt.type ?? 'sawtooth';
      o.frequency.value = mtof(m);
      o.detune.value = det;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 1.5);
    }
    lp.connect(g);
    send(k, g, 0.8, opt.verb ?? 0.6, 0, (i % 2 ? 0.35 : -0.35));
  });
}

function rhodes(k: Kit, t: number, m: number, vel: number, len = 1.8, pan = 0) {
  const { ctx } = k;
  const f = mtof(m);
  const car = ctx.createOscillator();
  car.frequency.value = f;
  const mod = ctx.createOscillator();
  mod.frequency.value = f;
  const mg = ctx.createGain();
  mg.gain.setValueAtTime(f * 1.4 * vel, t);
  mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.6);
  mod.connect(mg).connect(car.frequency);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.16 * vel, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.001, t + len);
  // 트레몰로
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 4.2;
  const lg = ctx.createGain();
  lg.gain.value = 0.25;
  const trem = ctx.createGain();
  trem.gain.value = 0.85;
  lfo.connect(lg).connect(trem.gain);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2000;
  car.connect(g).connect(trem).connect(lp);
  send(k, lp, 1, 0.35, 0, pan);
  for (const o of [car, mod, lfo]) { o.start(t); o.stop(t + len + 0.05); }
}

function kick(k: Kit, t: number, vel = 1, punch = 1) {
  const { ctx } = k;
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(150 * punch, t);
  o.frequency.exponentialRampToValueAtTime(44, t + 0.12);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.9 * vel, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
  o.connect(g);
  send(k, g, 1);
  o.start(t); o.stop(t + 0.45);
  // 클릭
  const n = ctx.createBufferSource();
  n.buffer = k.noise;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 3000;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.12 * vel * punch, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.015);
  n.connect(hp).connect(ng);
  send(k, ng, 1);
  n.start(t, Math.random()); n.stop(t + 0.03);
}

function noiseHit(k: Kit, t: number, o: { type: BiquadFilterType; freq: number; q?: number; gain: number; decay: number; verb?: number; pan?: number }) {
  const { ctx } = k;
  const n = ctx.createBufferSource();
  n.buffer = k.noise;
  const f = ctx.createBiquadFilter();
  f.type = o.type; f.frequency.value = o.freq; f.Q.value = o.q ?? 0.7;
  const g = ctx.createGain();
  g.gain.setValueAtTime(o.gain, t);
  g.gain.exponentialRampToValueAtTime(0.0008, t + o.decay);
  n.connect(f).connect(g);
  send(k, g, 1, o.verb ?? 0, 0, o.pan ?? 0);
  n.start(t, Math.random() * 1.5); n.stop(t + o.decay + 0.02);
}

const snare = (k: Kit, t: number, vel = 1, lofi = false) => {
  noiseHit(k, t, { type: lofi ? 'bandpass' : 'highpass', freq: lofi ? 1800 : 1400, q: lofi ? 0.8 : 0.7, gain: 0.32 * vel, decay: lofi ? 0.16 : 0.2, verb: 0.25 });
  const o = k.ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(200, t);
  o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
  const g = k.ctx.createGain();
  g.gain.setValueAtTime(0.25 * vel, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  o.connect(g); send(k, g, 1); o.start(t); o.stop(t + 0.12);
};
const hat = (k: Kit, t: number, vel = 1, open = false, pan = 0.2) =>
  noiseHit(k, t, { type: 'highpass', freq: 7500, gain: 0.11 * vel, decay: open ? 0.22 : 0.045, pan });
const clap = (k: Kit, t: number, vel = 1) => {
  for (let i = 0; i < 3; i++) noiseHit(k, t + i * 0.011, { type: 'bandpass', freq: 1500, q: 1.2, gain: 0.32 * vel, decay: i === 2 ? 0.18 : 0.03, verb: 0.3 });
};

function bass(k: Kit, t: number, m: number, len: number, vel = 1, saw = 0.2) {
  const { ctx } = k;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.36 * vel, t + 0.01);
  g.gain.setValueAtTime(0.3 * vel, t + len * 0.7);
  g.gain.exponentialRampToValueAtTime(0.001, t + len);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 260;
  const o = ctx.createOscillator();
  o.frequency.value = mtof(m);
  const s = ctx.createOscillator();
  s.type = 'sawtooth'; s.frequency.value = mtof(m);
  const sg = ctx.createGain(); sg.gain.value = saw;
  o.connect(lp); s.connect(sg).connect(lp);
  lp.connect(g);
  send(k, g, 1);
  o.start(t); s.start(t); o.stop(t + len + 0.02); s.stop(t + len + 0.02);
}

function pluck(k: Kit, t: number, m: number, vel: number, opt: { type?: OscillatorType; decay?: number; dly?: number; verb?: number; pan?: number; cutoff?: number } = {}) {
  const { ctx } = k;
  const o = ctx.createOscillator();
  o.type = opt.type ?? 'triangle';
  o.frequency.value = mtof(m);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = (opt.cutoff ?? 4000) * 0.6;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.14 * vel, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.001, t + (opt.decay ?? 0.5));
  o.connect(lp).connect(g);
  send(k, g, 1, opt.verb ?? 0.4, opt.dly ?? 0, opt.pan ?? 0);
  o.start(t); o.stop(t + (opt.decay ?? 0.5) + 0.05);
}

function stab(k: Kit, t: number, notes: number[], len: number, vel = 1) {
  const { ctx } = k;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(2600, t);
  lp.frequency.exponentialRampToValueAtTime(500, t + len);
  lp.Q.value = 3;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.09 * vel, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.001, t + len);
  lp.connect(g);
  notes.forEach((m) => {
    for (const det of [-12, 12]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = mtof(m);
      o.detune.value = det;
      o.connect(lp);
      o.start(t); o.stop(t + len + 0.05);
    }
  });
  send(k, g, 1, 0.3, 0.15);
}

function bed(k: Kit, from: number, to: number, o: { freq: number; q: number; gain: number; type?: BiquadFilterType }) {
  const { ctx } = k;
  const n = ctx.createBufferSource();
  n.buffer = k.noise; n.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = o.type ?? 'bandpass'; f.frequency.value = o.freq; f.Q.value = o.q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, from);
  g.gain.linearRampToValueAtTime(o.gain, from + 2);
  g.gain.setValueAtTime(o.gain, to - 3);
  g.gain.linearRampToValueAtTime(0, to);
  n.connect(f).connect(g);
  send(k, g, 1, 0.2);
  n.start(from); n.stop(to);
}

// ── 지연 생성 스케줄러 ──────────────────────────
// 모든 노드를 0초에 만들면 오프라인 렌더링 내내 처리 비용이 든다.
// suspend()로 렌더링을 잠깐 멈추고, 곧 울릴 음표의 노드만 그때 만든다.
function at(k: Kit, t: number, run: () => void) { k.events.push({ t, run }); }
function wrap<A extends unknown[]>(fn: (k: Kit, t: number, ...a: A) => void) {
  return (k: Kit, t: number, ...a: A) => at(k, t, () => fn(k, t, ...a));
}
const E = {
  feltPiano: wrap(feltPiano), pad: wrap(pad), rhodes: wrap(rhodes), kick: wrap(kick), snare: wrap(snare),
  hat: wrap(hat), clap: wrap(clap), bass: wrap(bass), pluck: wrap(pluck), stab: wrap(stab), noiseHit: wrap(noiseHit),
  bed: (k: Kit, from: number, to: number, o: Parameters<typeof bed>[3]) => at(k, from, () => bed(k, from, to, o)),
};

function startScheduled(k: Kit): Promise<AudioBuffer> {
  const { ctx } = k;
  const ev = k.events.sort((a, b) => a.t - b.t);
  const CHUNK = 0.5;
  const LEAD = 0.1;
  const runRange = (from: number, to: number) => {
    for (const e of ev) if (e.t >= from && e.t < to) e.run();
  };
  runRange(-1, CHUNK);
  const end = ctx.length / ctx.sampleRate;
  for (let T = CHUNK; T < end; T += CHUNK) {
    const from = T;
    ctx.suspend(Math.max(0, T - LEAD)).then(() => {
      runRange(from, from + CHUNK);
      return ctx.resume();
    });
  }
  return ctx.startRendering();
}

// ── 곡 ─────────────────────────────────────────
// 01 · 새벽 2시, 고민을 접는 피아노 · 76 BPM · F Maj
function track01() {
  const bpm = 76, beat = 60 / bpm, bar = beat * 4, bars = 16;
  const k = makeKit(bars * bar + 4, { verb: 0.45 });
  const prog = [
    [41, [57, 60, 65]], [40, [55, 60, 64]], [38, [57, 62, 65]], [34, [58, 62, 65]],
    [41, [57, 60, 65]], [45, [57, 60, 64]], [34, [58, 62, 65]], [36, [55, 60, 64]],
    [38, [57, 62, 65]], [40, [55, 60, 64]], [41, [57, 60, 65]], [34, [58, 62, 65]],
    [38, [57, 62, 65]], [36, [55, 60, 64]], [34, [58, 62, 65]], [41, [57, 60, 65]],
  ] as [number, number[]][];
  const melody: [number, number, number][] = [
    // [마디, 박, 음]
    [4, 0, 72], [4, 2, 74], [4, 3, 72], [5, 0, 69], [5, 2, 67], [6, 0, 70], [6, 2, 69], [7, 0, 67],
    [8, 0, 69], [8, 1.5, 72], [8, 3, 74], [9, 0, 76], [9, 2, 74], [10, 0, 72], [10, 2, 69], [11, 0, 70],
    [11, 2, 72], [12, 0, 74], [12, 2, 72], [13, 0, 67], [13, 3, 69], [14, 0, 70], [14, 2, 69], [15, 0, 65],
  ];
  prog.forEach(([root, ch], b) => {
    const t = 0.1 + b * bar;
    E.feltPiano(k, t, root, 0.55, bar * 1.2, -0.2);
    E.feltPiano(k, t, root + 12, 0.3, bar, -0.2);
    const arp = [ch[0], ch[1], ch[2], ch[1] + 12 - 12, ch[2], ch[1], ch[0] + 12, ch[1]];
    arp.forEach((m, i) => {
      if (b === bars - 1 && i > 3) return;
      E.feltPiano(k, t + i * (beat / 2) + (i % 2 ? 0.015 : 0), m, 0.32 + (i === 0 ? 0.1 : 0) + Math.random() * 0.05, 2.0, 0.15);
    });
    if (b >= 2 && b < bars - 1) E.pad(k, t, [ch[0] - 12, ch[1], ch[2]], bar, { gain: 0.035, cutoff: 900, attack: 1.4, verb: 0.7, type: 'sawtooth' });
  });
  melody.forEach(([b, bt, m]) => E.feltPiano(k, 0.1 + b * bar + bt * beat, m, 0.62, 3, 0.05, 0.7));
  E.feltPiano(k, 0.1 + (bars - 1) * bar + beat * 2, 77, 0.5, 4, 0.1, 0.8);
  return k;
}

// 02 · 창밖 빗소리와 내일의 스케치 · 84 BPM · A Min
function track02() {
  const bpm = 84, beat = 60 / bpm, bar = beat * 4, bars = 20;
  const k = makeKit(bars * bar + 3, { verb: 0.3 });
  const total = bars * bar + 3;
  E.bed(k, 0, total, { freq: 2600, q: 0.6, gain: 0.05 }); // 빗소리
  E.bed(k, 0, total, { freq: 600, q: 0.4, gain: 0.025, type: 'lowpass' });
  for (let t = 0.2; t < total - 1; t += 0.05 + Math.random() * 0.4) // 레코드 잡음
    E.noiseHit(k, t, { type: 'highpass', freq: 2500, gain: 0.02 + Math.random() * 0.05, decay: 0.006, pan: Math.random() - 0.5 });
  const prog = [
    [45, [67, 72, 76, 79]], [41, [64, 69, 72, 76]], [48, [64, 67, 71, 74]], [43, [62, 66, 69, 71]],
  ] as [number, number[]][];
  const swing = beat * 0.08;
  for (let b = 0; b < bars; b++) {
    const t = 0.15 + b * bar;
    const [root, ch] = prog[b % 4];
    const lead = b < bars - 1;
    ch.forEach((m, i) => E.rhodes(k, t + i * 0.012, m - 12, 0.55, bar * 0.6, (i - 1.5) * 0.15));
    if (lead) ch.slice(1).forEach((m, i) => E.rhodes(k, t + beat * 2.5 + swing + i * 0.01, m - 12, 0.32, beat * 1.5));
    const drums = b >= 2 && b < bars - 2;
    if (b >= 1) {
      E.bass(k, t, root - 12, beat * 1.8, 0.8, 0.05);
      E.bass(k, t + beat * 2.5 + swing, root - 12 + (b % 2 ? 7 : 0), beat * 1.2, 0.6, 0.05);
    }
    if (drums) {
      E.kick(k, t, 0.75, 0.8);
      E.kick(k, t + beat * 1.75 + swing, 0.45, 0.8);
      E.kick(k, t + beat * 2.5 + swing, 0.65, 0.8);
      E.snare(k, t + beat, 0.7, true);
      E.snare(k, t + beat * 3, 0.75, true);
      for (let i = 0; i < 8; i++) E.hat(k, t + i * (beat / 2) + (i % 2 ? swing : 0), i % 2 ? 0.45 : 0.8, i === 7 && b % 4 === 3);
    }
    // 멜로디 (8마디부터)
    if (b >= 6 && b < bars - 2 && b % 2 === 0) {
      const mel = [76, 74, 72, 69, 72];
      mel.forEach((m, i) => E.rhodes(k, t + beat * (i * 0.75 + 0.5) + (i % 2 ? swing : 0), m, 0.45, 1.2, 0.3));
    }
  }
  return k;
}

// 03 · 흔들리는 마음을 붙잡는 별빛 · 92 BPM · D Maj
function track03() {
  const bpm = 92, beat = 60 / bpm, bar = beat * 4, bars = 20;
  const k = makeKit(bars * bar + 5, { verb: 0.6, delayTime: beat * 0.75, feedback: 0.45, delayMix: 0.4 });
  const prog = [
    [38, [62, 66, 69, 74]], [35, [59, 62, 66, 71]], [43, [59, 62, 67, 71]], [45, [61, 64, 69, 73]],
  ] as [number, number[]][];
  for (let b = 0; b < bars; b++) {
    const t = 0.1 + b * bar;
    const [root, ch] = prog[b % 4];
    E.pad(k, t, ch, bar, { gain: 0.07, cutoff: 1400 + 500 * Math.sin(b / 3), attack: 1.8, verb: 0.9, type: 'sawtooth' });
    if (b >= 1) E.bass(k, t, root - 12, bar * 0.95, 0.45, 0);
    if (b >= 2 && b < bars - 1) {
      const up = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[3] + 12, ch[2] + 12, ch[1] + 12, ch[3] + 12, ch[2] + 12];
      up.forEach((m, i) => E.pluck(k, t + i * (beat / 2), m, b >= 6 ? 0.7 : 0.5, { type: 'triangle', decay: 0.7, dly: 0.55, verb: 0.5, pan: i % 2 ? 0.4 : -0.4, cutoff: 5000 }));
    }
    if (b >= 8 && b < bars - 2) {
      const bell = [[0, ch[3] + 12], [1.5, ch[2] + 12], [3, ch[1] + 24 - 12]];
      bell.forEach(([bt, m]) => E.pluck(k, t + bt * beat, m, 0.9, { type: 'sine', decay: 2.2, dly: 0.4, verb: 0.8, cutoff: 6000 }));
    }
    if (b >= 10 && b < bars - 2) for (let i = 0; i < 8; i++) E.hat(k, t + i * (beat / 2), i % 2 ? 0.25 : 0.12, false, -0.3);
  }
  return k;
}

// 04 · 한계를 돌파하는 132BPM 헬창 비트 · 132 BPM · E Min
function track04() {
  const bpm = 132, beat = 60 / bpm, bar = beat * 4, bars = 32;
  const k = makeKit(bars * bar + 2, { verb: 0.25, delayTime: beat * 0.75, feedback: 0.3, delayMix: 0.2 });
  const prog = [
    [28, [64, 67, 71]], [24, [64, 67, 72]], [31, [62, 67, 71]], [26, [62, 66, 69]],
  ] as [number, number[]][];
  for (let b = 0; b < bars; b++) {
    const t = 0.05 + b * bar;
    const [root, ch] = prog[Math.floor(b / 2) % 4];
    const breakdown = b >= 12 && b < 16;
    const full = b >= 16 && b < 30;
    const outro = b >= 30;
    for (let i = 0; i < 4; i++) {
      if (!breakdown) E.kick(k, t + i * beat, outro ? 0.7 : 1, 1.1);
    }
    for (let i = 0; i < 4; i++) E.hat(k, t + i * beat + beat / 2, 0.8, b >= 4 && i === 3);
    if (b >= 8 && !breakdown && !outro) for (let i = 0; i < 16; i++) if (i % 4 !== 2) E.hat(k, t + i * (beat / 4), 0.3 + (i % 2 ? 0 : 0.15), false, -0.25);
    if (b >= 4 && !breakdown && !outro) { E.clap(k, t + beat, 0.9); E.clap(k, t + beat * 3, 0.9); }
    if (b >= 4 && !breakdown) for (let i = 0; i < 4; i++) E.bass(k, t + i * beat + beat / 2, root, beat * 0.45, 1, 0.35);
    if (breakdown || full) {
      const ss = breakdown ? [0, 1.5, 3] : [0, 0.75, 1.5, 2.5, 3.25];
      ss.forEach((bt) => E.stab(k, t + bt * beat, ch, breakdown ? 0.5 : 0.22, breakdown ? 0.9 : 1));
    }
    if (b === 15) { // 라이저
      at(k, t, () => {
      const n = k.ctx.createBufferSource(); n.buffer = k.noise; n.loop = true;
      const f = k.ctx.createBiquadFilter(); f.type = 'highpass';
      f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(9000, t + bar);
      const g = k.ctx.createGain(); g.gain.setValueAtTime(0.01, t); g.gain.linearRampToValueAtTime(0.18, t + bar);
      n.connect(f).connect(g); send(k, g, 1, 0.3); n.start(t); n.stop(t + bar);
      });
      for (let i = 0; i < 8; i++) E.snare(k, t + bar / 2 + i * (beat / 4), 0.4 + i * 0.07);
    }
    if (full && b % 2 === 0) {
      const lead = [76, 79, 83, 81, 79, 76];
      lead.forEach((m, i) => E.pluck(k, t + i * (beat / 2) + beat * 2, m, 0.8, { type: 'square', decay: 0.18, dly: 0.25, verb: 0.2, cutoff: 3200 }));
    }
  }
  return k;
}

const BUILDERS: Record<TrackId, () => Kit> = { '01': track01, '02': track02, '03': track03, '04': track04 };
const cache = new Map<TrackId, Promise<AudioBuffer>>();

// 곡마다 체감 음량을 맞춘다: 목표 RMS 0.1, 피크 0.9 이하
function normalize(buf: AudioBuffer): AudioBuffer {
  let peak = 0, ss = 0, n = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) { const v = d[i]; const a = v < 0 ? -v : v; if (a > peak) peak = a; ss += v * v; n++; }
  }
  const rms = Math.sqrt(ss / n) || 1;
  const gain = Math.min(0.1 / rms, 0.9 / (peak || 1));
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] *= gain;
  }
  return buf;
}

export function renderTrack(id: TrackId): Promise<AudioBuffer> {
  let p = cache.get(id);
  if (!p) {
    p = startScheduled(BUILDERS[id]()).then(normalize);
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}
