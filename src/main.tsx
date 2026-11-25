import { createRoot } from 'react-dom/client';
import App from './App';
import { MusicProvider } from './music/Music';
import './styles.css';
// 처음 들어올 때는 항상 홈(음반 화면)에서 시작한다.
// 새로고침(F5)해도 홈으로 돌아온다. 발표 자료(#present)만 보던 슬라이드를 유지한다.
(() => {
  try {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    if (!/^#present/.test(location.hash)) {
      history.replaceState(null, '', location.pathname + location.search + '#home');
    }
    window.scrollTo(0, 0);
  } catch { /* noop */ }
})();


createRoot(document.getElementById('root')!).render(<MusicProvider><App /></MusicProvider>);
