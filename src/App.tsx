import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { BRAND } from './data/brand';
import type { CategoryId } from './data/songs';
import { useFullscreenHotkey } from './lib/fullscreen';
import { buildResult } from './lib/result';
import { candidates, recommend, seedOf } from './lib/recommend';
import { aiResult } from './lib/ai';
import { CATEGORIES, NEED_LABEL } from './data/flow';
import { SONGS } from './data/songs';
import { getRecord, newIds, saveRecord, type Record_ } from './lib/storage';
import { go, prefersReducedMotion, useRoute } from './lib/router';
import type { Turn } from './lib/conversation';
import Home from './pages/Home';
import Talk, { type Draft } from './pages/Talk';
import Result, { markShown, sessionShown } from './pages/Result';
import Report from './pages/Report';
import Archive from './pages/Archive';
import Present from './pages/Present';
import { Header } from './components/Header';

const TITLES: Record<string, string> = {
  home: BRAND,
  write: `고민 기록 · ${BRAND}`,
  result: `나의 결과 · ${BRAND}`,
  report: `리포트 · ${BRAND}`,
  archive: `내 보관함 · ${BRAND}`,
  present: `발표 자료 · ${BRAND}`,
};

import { requestGeminiAnalysis } from './lib/gemini';

const EMPTY: Draft = { worry: '', basis: '', turns: [], useAi: true };

export function makeRecord(category: CategoryId, worry: string, turns: Turn[], sample = false): Record_ {
  const { id, docNo } = newIds(worry);
  const result = buildResult(category, worry, turns);
  const song = recommend({ category, need: result.need, prefs: result.prefs, sticking: result.sticking, seed: seedOf(worry), exclude: sessionShown() });
  markShown(song.id);
  return { id, docNo, createdAt: Date.now(), category, worry, turns, result, songHistory: [song.id], songId: song.id, sample };
}

/** Gemini를 호출하여 답변을 분석하고 최적의 곡을 추천받는다 */
export async function runGeminiAnalysis(rec: Record_): Promise<{ record: Record_; success: boolean }> {
  const R = rec.result;
  const cands = candidates(
    {
      category: rec.category,
      need: R.need,
      prefs: R.prefs,
      sticking: R.sticking,
      seed: seedOf(rec.worry),
      exclude: sessionShown().filter((x) => x !== rec.songId),
    },
    10
  );

  const j = await requestGeminiAnalysis({
    category: CATEGORIES.find((c) => c.id === rec.category)!.label,
    worry: rec.worry,
    turns: rec.turns.map((t) => ({
      question: t.q.text,
      answer: t.a.kind === 'option' ? t.a.label : t.a.kind === 'text' ? t.a.text : '(건너뜀)',
    })),
    need: NEED_LABEL[R.need],
    prefs: R.prefs,
    candidates: cands.map((s) => ({
      id: s.id,
      title: s.title,
      artist: s.artist,
      lang: s.lang,
      needs: s.needs,
      sound: s.sound,
      story: s.story,
    })),
  });

  if (!j || typeof j !== 'object' || !j.summary) {
    return {
      record: {
        ...rec,
        result: {
          ...R,
          ai: false,
          geminiFailed: true,
        },
      },
      success: false,
    };
  }

  const ok = (v: unknown, min: number, max: number) => typeof v === 'string' && v.trim().length >= min && v.trim().length <= max;
  const quote = ok(j.quote, 4, 100) && rec.worry.includes(j.quote.trim()) ? j.quote.trim() : R.quote;
  const songOk = typeof j.songId === 'string' && SONGS.some((s) => s.id === j.songId);
  const songId = songOk ? j.songId : rec.songId;
  if (songOk) markShown(songId);

  const result = {
    ...R,
    quote,
    lead: j.summary.trim(),
    cheer: ok(j.cheer, 6, 400) ? j.cheer.trim() : R.cheer,
    action: ok(j.action, 6, 200) ? j.action.trim() : R.action,
    ai: true,
    geminiFailed: false,
  };
  const reasons = songOk && j.reason ? { [songId]: j.reason.trim() } : rec.reasons;
  return {
    record: { ...rec, result, songId, songHistory: [songId], reasons },
    success: true,
  };
}

const SAMPLE = {
  category: 'study' as CategoryId,
  worry: '시험은 얼마 안 남았는데 책을 펴도 한 시간씩 멍하니 있어요.',
};

export default function App() {
  const route = useRoute();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [current, setCurrent] = useState<Record_ | null>(null);
  const [, setTick] = useState(0);
  const [saveError, setSaveError] = useState(false);
  const [veil, setVeil] = useState<'' | 'in' | 'out'>('');
  const [toast, setToast] = useState('');
  const toastTimer = useRef(0);
  const onFs = useCallback((r: 'on' | 'off' | 'blocked') => {
    const msg = r === 'on' ? '전체화면 · F 또는 Esc를 누르면 돌아가요' : r === 'off' ? '전체화면을 껐어요' : '이 화면에서는 전체화면을 쓸 수 없어요';
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2400);
  }, []);
  const fullscreen = useFullscreenHotkey(onFs);
  useEffect(() => { document.documentElement.dataset.fullscreen = fullscreen ? 'on' : 'off'; }, [fullscreen]);

  useEffect(() => {
    document.title = TITLES[route.name] || BRAND;
    if (route.name !== 'write' && route.name !== 'home') window.scrollTo({ top: 0 });
    document.documentElement.dataset.route = route.name;
  }, [route.name, (route as any).id]);

  const start = () => {
    if (prefersReducedMotion()) { go({ name: 'write' }); return; }
    setVeil('in');
    window.setTimeout(() => {
      go({ name: 'write' });
      window.scrollTo({ top: 0 });
      setVeil('out');
      window.setTimeout(() => setVeil(''), 420);
    }, 460);
  };

  const finish = async (d: Draft) => {
    let rec = makeRecord(d.category!, d.worry, d.turns);
    if (d.useAi) {
      const { record } = await runGeminiAnalysis(rec);
      rec = record;
    }
    setCurrent(rec);
    setSaveError(false);
    go({ name: 'result' });
  };

  const restart = () => {
    setDraft(EMPTY);
    setCurrent(null);
    go({ name: 'write' });
  };

  const resolve = (id?: string): Record_ | null => {
    if (id) {
      if (current && current.id === id) return current;
      return getRecord(id) || null;
    }
    return current;
  };
  const isSaved = (r: Record_) => !r.sample && !!getRecord(r.id);

  const save = (r: Record_, view: 'result' | 'report') => {
    const target = r.sample ? { ...r, ...newIds(r.worry), sample: false } : r;
    if (saveRecord(target)) {
      setSaveError(false);
      setCurrent(target);
      setTick((t) => t + 1);
      history.replaceState(null, '', `#${view}-${target.id}`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } else setSaveError(true);
  };

  // 곡을 바꾸거나 유형을 알아봤을 때: 이미 저장한 기록이면 함께 갱신
  const update = (r: Record_) => {
    setCurrent(r);
    if (!r.sample && getRecord(r.id)) saveRecord(r);
    setTick((t) => t + 1);
  };

  const openSample = () => {
    const rec = makeRecord(SAMPLE.category, SAMPLE.worry, [], true);
    setCurrent(rec);
    go({ name: 'result' });
  };

  let view: ReactNode;
  switch (route.name) {
    case 'write':
      view = <Talk draft={draft} setDraft={setDraft} onFinish={finish} />;
      break;
    case 'result': {
      const rec = resolve(route.id);
      view = rec ? (
        <Result key={rec.id} rec={rec} saved={isSaved(rec)} saveError={saveError} onUpdate={update} onSave={() => save(rec, 'result')}
          onReport={() => go({ name: 'report', id: isSaved(rec) ? rec.id : undefined })} onRestart={restart} />
      ) : <Missing />;
      break;
    }
    case 'report': {
      const rec = resolve(route.id);
      view = rec ? (
        <Report key={rec.id} rec={rec} saved={isSaved(rec)} onSave={() => save(rec, 'report')}
          onBack={() => go({ name: 'result', id: isSaved(rec) ? rec.id : undefined })} />
      ) : <Missing />;
      break;
    }
    case 'archive':
      view = <Archive onSample={openSample} />;
      break;
    case 'present':
      view = <Present startAt={route.id ? Number(route.id) || 1 : 1} />;
      break;
    default:
      view = <Home onStart={start} />;
  }

  return (
    <>
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); const m = document.getElementById('main'); if (m) { m.tabIndex = -1; m.focus(); } }}>본문으로 건너뛰기</a>
      {view}
      <p className={`toast ${toast ? 'is-on' : ''}`} role="status" aria-live="polite">{toast}</p>
      <div className={`veil ${veil ? `veil--${veil}` : ''}`} aria-hidden="true">
        <div className="veil__sheet"><span>고민저장소 기록지</span></div>
      </div>
    </>
  );
}

function Missing() {
  return (
    <div className="page page--paper">
      <Header tone="light" />
      <main id="main" className="missing">
        <h1>열 수 있는 기록이 없어요</h1>
        <p>저장하지 않은 결과는 새로고침하면 사라져요. 보관함에 저장한 기록은 언제든 다시 열 수 있어요.</p>
        <div className="shelf__emptyActions">
          <a className="btn btn--sage btn--lg" href="#write">고민 기록하기</a>
          <a className="btn btn--line btn--lg" href="#archive">내 보관함</a>
        </div>
      </main>
    </div>
  );
}
