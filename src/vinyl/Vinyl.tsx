// 바이닐 컴포넌트: CSS 바이닐을 먼저 보여주고, WebGL 렌더러를 지연 로딩해 덮는다.
import { useEffect, useRef, useState } from 'react';
import type { VinylRenderer } from './webgl';
import { prefersReducedMotion } from '../lib/router';

interface Props {
  spinning?: boolean;
  interactive?: boolean;
  label?: { top: string; center: string; bottom: string };
  className?: string;
  priority?: 'hero' | 'player';
}

const RPM = (33.333 / 60) * Math.PI * 2; // rad/s

export default function Vinyl({ spinning = false, interactive = false, label, className = '', priority = 'hero' }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<VinylRenderer | null>(null);
  const [mode, setMode] = useState<'css' | 'webgl'>('css');
  const state = useRef({ spin: 0, tx: 0, ty: 0, cx: 0, cy: 0, last: 0, raf: 0, spinning, interactive });
  state.current.spinning = spinning && !prefersReducedMotion();
  state.current.interactive = interactive;

  const kick = () => {
    const s = state.current;
    if (s.raf) return;
    s.last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - s.last) / 1000);
      s.last = now;
      if (s.spinning) s.spin += dt * RPM;
      s.cx += (s.tx - s.cx) * Math.min(1, dt * 6);
      s.cy += (s.ty - s.cy) * Math.min(1, dt * 6);
      const r = renderer.current;
      if (r) { r.setSpin(s.spin); r.setPose(s.cx, s.cy); r.render(); }
      else if (wrap.current) {
        wrap.current.style.setProperty('--spin', `${(s.spin * 180) / Math.PI}deg`);
        wrap.current.style.setProperty('--tx', s.cx.toFixed(3));
        wrap.current.style.setProperty('--ty', s.cy.toFixed(3));
      }
      const settling = Math.abs(s.tx - s.cx) > 0.002 || Math.abs(s.ty - s.cy) > 0.002;
      if (s.spinning || settling) s.raf = requestAnimationFrame(loop);
      else s.raf = 0;
    };
    s.raf = requestAnimationFrame(loop);
  };

  // WebGL 지연 로딩: 첫 화면 글자·버튼이 먼저 그려진 뒤에 시작
  useEffect(() => {
    let disposed = false;
    const isMobile = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
    const start = () => {
      import('./webgl')
        .then(({ createVinyl }) => {
          if (disposed || !canvas.current) return;
          const r = createVinyl(canvas.current, { dprCap: isMobile ? 1.25 : 2 });
          if (!r) return;
          renderer.current = r;
          if (label) r.setLabel(label);
          r.render();
          setMode('webgl');
          canvas.current.addEventListener('webglcontextlost', (e) => { e.preventDefault(); renderer.current = null; setMode('css'); });
          kick();
        })
        .catch(() => { /* CSS 바이닐 유지 */ });
    };
    const w = window as any;
    const id = w.requestIdleCallback ? w.requestIdleCallback(start, { timeout: priority === 'hero' ? 600 : 1200 }) : setTimeout(start, 120);
    const ro = new ResizeObserver(() => renderer.current?.render());
    if (canvas.current) ro.observe(canvas.current);
    return () => {
      disposed = true;
      w.cancelIdleCallback ? w.cancelIdleCallback(id) : clearTimeout(id);
      ro.disconnect();
      cancelAnimationFrame(state.current.raf);
      state.current.raf = 0;
      renderer.current?.dispose();
      renderer.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (label && renderer.current) { renderer.current.setLabel(label); renderer.current.render(); }
  }, [label?.top, label?.center, label?.bottom]);

  useEffect(() => { kick(); }, [spinning]);

  // 포인터 반응 (데스크톱 · 모션 감소 아닐 때만)
  useEffect(() => {
    if (!interactive) return;
    const fine = matchMedia('(hover: hover) and (pointer: fine)');
    if (!fine.matches || prefersReducedMotion()) return;
    const onMove = (e: PointerEvent) => {
      const s = state.current;
      s.tx = (e.clientX / window.innerWidth) * 2 - 1;
      s.ty = (e.clientY / window.innerHeight) * 2 - 1;
      kick();
      document.documentElement.style.setProperty('--px', s.tx.toFixed(3));
      document.documentElement.style.setProperty('--py', s.ty.toFixed(3));
    };
    const onLeave = () => { state.current.tx = 0; state.current.ty = 0; kick(); };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    return () => { window.removeEventListener('pointermove', onMove); document.removeEventListener('pointerleave', onLeave); };
  }, [interactive]);

  return (
    <div ref={wrap} className={`vinyl vinyl--${mode} ${state.current.spinning ? 'is-spinning' : ''} ${className}`} aria-hidden="true">
      <div className="vinyl-css">
        <div className="vinyl-css__shadow" />
        <div className="vinyl-css__disc">
          <div className="vinyl-css__grooves" />
          <div className="vinyl-css__sheen" />
          <div className="vinyl-css__label"><span>{label?.center ?? '고민저장소'}</span></div>
        </div>
      </div>
      <canvas ref={canvas} className="vinyl-gl" />
    </div>
  );
}
