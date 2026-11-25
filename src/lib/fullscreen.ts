// F 키(한/영 상관없이 물리 키 기준)로 전체화면 전환
import { useEffect, useState } from 'react';

export function isFullscreen() {
  return !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
}

export async function toggleFullscreen(): Promise<'on' | 'off' | 'blocked'> {
  try {
    if (isFullscreen()) {
      await (document.exitFullscreen?.() ?? (document as any).webkitExitFullscreen?.());
      return 'off';
    }
    const el: any = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) return 'blocked';
    await req.call(el, { navigationUI: 'hide' });
    return 'on';
  } catch {
    return 'blocked';
  }
}

function typing(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export function useFullscreenHotkey(onResult: (r: 'on' | 'off' | 'blocked') => void) {
  const [fs, setFs] = useState(isFullscreen());
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyF' || e.ctrlKey || e.metaKey || e.altKey || e.repeat || typing(e.target)) return;
      e.preventDefault();
      toggleFullscreen().then(onResult);
    };
    const onChange = () => setFs(isFullscreen());
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, [onResult]);
  return fs;
}
