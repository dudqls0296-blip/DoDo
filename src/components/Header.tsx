import { useEffect, useState } from 'react';
import { BRAND } from '../data/brand';
import { isFullscreen, toggleFullscreen } from '../lib/fullscreen';
import { MusicToggle } from '../music/Music';

export function Seal({ size = 34 }: { size?: number }) {
  return (
    <svg className="seal" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="32" cy="32" r="25.5" fill="none" stroke="currentColor" strokeWidth="0.8" />
      <text x="32" y="29" textAnchor="middle" fontSize="12" fontFamily="'Noto Serif KR', serif" fontWeight="700" fill="currentColor">고민</text>
      <text x="32" y="43" textAnchor="middle" fontSize="10" fontFamily="'Noto Serif KR', serif" fontWeight="600" fill="currentColor">저장소</text>
    </svg>
  );
}

export function Header({ tone, current }: { tone: 'dark' | 'light'; current?: string }) {
  return (
    <header className={`site-header site-header--${tone}`}>
      <a className="brand" href="#home" aria-label={`${BRAND} 처음으로`}>
        <Seal />
        <span className="brand__name">{BRAND}</span>
      </a>
      <nav className="site-nav" aria-label="주요 메뉴">
        {current !== 'write' && <a href="#write" className="site-nav__link">새 기록</a>}
        <a href="#archive" className="site-nav__link" aria-current={current === 'archive' ? 'page' : undefined}>내 보관함</a>
        <a href="#present" className="site-nav__link site-nav__link--present">발표 자료</a>
        {current !== 'home' && <MusicToggle />}
        <FullscreenButton />
      </nav>
    </header>
  );
}

export function Footer({ tone }: { tone: 'dark' | 'light' }) {
  return (
    <footer className={`site-footer site-footer--${tone}`}>
      <div className="site-footer__brand"><Seal size={26} /> <span>{BRAND}</span></div>
      <p>적은 문장은 이 브라우저 안에서만 읽혀요. 저장을 누른 기록만 이 기기에 보관됩니다.</p>
      <p className="site-footer__copy">© 2026 {BRAND}</p>
    </footer>
  );
}

export function FullscreenButton({ className = '' }: { className?: string }) {
  const [on, setOn] = useState(isFullscreen());
  useEffect(() => {
    const f = () => setOn(isFullscreen());
    document.addEventListener('fullscreenchange', f);
    return () => document.removeEventListener('fullscreenchange', f);
  }, []);
  return (
    <button type="button" className={`fs-btn ${className}`} onClick={() => toggleFullscreen()} aria-pressed={on} title="전체화면 (F)">
      <svg viewBox="0 0 20 20" aria-hidden="true">
        {on
          ? <path d="M8 3v5H3M12 3v5h5M8 17v-5H3M12 17v-5h5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          : <path d="M3 8V3h5M17 8V3h-5M3 12v5h5M17 12v5h-5" fill="none" stroke="currentColor" strokeWidth="1.6" />}
      </svg>
      <span className="fs-btn__label">{on ? '전체화면 끄기' : '전체화면'}</span>
      <kbd>F</kbd>
    </button>
  );
}
