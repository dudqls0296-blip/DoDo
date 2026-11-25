// 해시 라우터: #home · #write · #result(-id) · #report(-id) · #archive
import { useEffect, useState } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'write' }
  | { name: 'result'; id?: string }
  | { name: 'report'; id?: string }
  | { name: 'archive' }
  | { name: 'present'; id?: string };

export function parse(hash: string): Route {
  const h = hash.replace(/^#/, '');
  if (h === 'write') return { name: 'write' };
  if (h === 'archive') return { name: 'archive' };
  if (h === 'present') return { name: 'present' };
  if (h.startsWith('present-')) return { name: 'present', id: h.slice(8) };
  if (h === 'result') return { name: 'result' };
  if (h.startsWith('result-')) return { name: 'result', id: h.slice(7) };
  if (h === 'report') return { name: 'report' };
  if (h.startsWith('report-')) return { name: 'report', id: h.slice(7) };
  return { name: 'home' };
}

export function href(r: Route): string {
  if (r.name === 'home') return '#home';
  if ((r.name === 'result' || r.name === 'report' || r.name === 'present') && r.id) return `#${r.name}-${r.id}`;
  return `#${r.name}`;
}

export function go(r: Route) {
  const next = href(r);
  if (location.hash === next) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = next;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(location.hash));
  useEffect(() => {
    const on = () => setRoute(parse(location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export const prefersReducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
