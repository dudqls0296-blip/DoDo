import { createRoot } from 'react-dom/client';
import App from './App';
import { MusicProvider } from './music/Music';
import './styles.css';
// 처음 들어올 때는 항상 홈(음반 화면)에서 시작한다.
// 새로고침·뒤로가기는 보던 화면을 유지하고, 발표 자료 링크(#present)는 그대로 연다.
(() => {
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const kind = nav?.type || 'navigate';
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    if (kind === 'navigate' && !/^#present/.test(location.hash)) {
      history.replaceState(null, '', location.pathname + location.search + '#home');
    }
    window.scrollTo(0, 0);
  } catch { /* noop */ }
})();


createRoot(document.getElementById('root')!).render(<MusicProvider><App /></MusicProvider>);
