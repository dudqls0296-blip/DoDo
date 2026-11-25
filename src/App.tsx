import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { BRAND } from './data/brand';
import type { CategoryId } from './data/songs';
import { useFullscreenHotkey } from './lib/fullscreen';
import { buildResult } from './lib/result';
import { candidates, recommend, seedOf } from './lib/recommend';
import { aiResult, AiFailure, type AiError } from './lib/ai';
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

const EMPTY: Draft = { worry: '', basis: '', turns: [], useAi: true };

export function makeRecord(category: CategoryId, worry: string, turns: Turn[], sample = false): Record_ {
  const { id, docNo } = newIds(worry);
  const result = buildResult(category, worry, turns);
  const song = recommend({ category, need: result.need, prefs: result.prefs, sticking: result.sticking, seed: seedOf(worry), exclude: sessionShown() });
  markShown(song.id);
  return { id, docNo, createdAt: Date.now(), category, worry, turns, result, songHistory: [song.id], songId: song.id, sample };
}

/** AI(Gemini)가 고민을 분석해 결과를 쓴다. 검증을 통과하지 못하면 AiFailure를 던진다(가짜 문장으로 대신하지 않음). */
async function withAi(rec: Record_): Promise<Record_> {
  const R = rec.result;
  const cands = candidates({ category: rec.category, need: R.need, prefs: R.prefs, sticking: R.sticking, seed: seedOf(rec.worry), exclude: sessionShown().filter((x) => x !== rec.songId) }, 12);
  const j = await aiResult({
    category: CATEGORIES.find((c) => c.id === rec.category)!.label,
    worry: rec.worry,
    turns: rec.turns.map((t) => ({ question: t.q.text, answer: t.a.kind === 'option' ? t.a.label : t.a.kind === 'text' ? t.a.text : '(건너뜀)' })),
    need: NEED_LABEL[R.need],
    prefs: R.prefs,
    candidates: cands.map((s) => ({ id: s.id, title: s.title, artist: s.artist, lang: s.lang, needs: s.needs, sound: s.sound, story: s.story })),
  });
  const ok = (v: unknown, min: number, max: number): v is string => typeof v === 'string' && v.trim().length >= min && v.trim().length <= max;
  if (!j || typeof j !== 'object' || !ok(j.summary, 15, 500) || !ok(j.reply, 15, 700)) throw new AiFailure('failed');

  // 음악: 후보 목록(검증된 실제 공식 영상)에 있는 곡만, 서로 다르게 최대 3곡
  const picked: { id: string; reason: string }[] = [];
  for (const it of Array.isArray(j.songs) ? j.songs : []) {
    const id = typeof it?.id === 'string' ? it.id.trim() : '';
    if (!cands.some((c) => c.id === id) || !SONGS.some((s) => s.id === id) || picked.some((p) => p.id === id)) continue;
    picked.push({ id, reason: ok(it.reason, 10, 300) ? it.reason.trim() : '' });
    if (picked.length === 3) break;
  }
  if (!picked.length) throw new AiFailure('failed');
  // AI가 3곡을 다 채우지 못했으면 같은 기준의 다음 후보로 채운다 (곡은 모두 실제 곡)
  for (const c of cands) { if (picked.length >= 3) break; if (!picked.some((p) => p.id === c.id)) picked.push({ id: c.id, reason: '' }); }
  picked.forEach((p) => markShown(p.id));

  const quote = ok(j.quote, 4, 80) && rec.worry.includes(j.quote.trim()) ? j.quote.trim() : R.quote;
  const emotion = j.emotion && ok(j.emotion.label, 1, 30) && ok(j.emotion.text, 8, 300) ? { label: j.emotion.label.trim(), text: j.emotion.text.trim() } : undefined;
  const advice = (Array.isArray(j.advice) ? j.advice : []).filter((x: unknown) => ok(x, 6, 160)).map((x: string) => x.trim()).slice(0, 3);
  const crisis = R.crisis || j.crisis === true;
  const result = {
    ...R,
    quote,
    lead: j.summary.trim(),
    reply: j.reply.trim(),
    emotion,
    advice: advice.length ? advice : undefined,
    cheer: ok(j.cheer, 8, 300) ? j.cheer.trim() : R.cheer,
    action: ok(j.action, 8, 160) ? j.action.trim() : R.action,
    crisis,
    ai: true,
  };
  const reasons = Object.fromEntries(picked.filter((p) => p.reason).map((p) => [p.id, p.reason]));
  const songs = picked.map((p) => p.id);
  return { ...rec, result, songId: songs[0], songHistory: [songs[0]], songs, reasons };
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

  // 같은 고민으로 결과 요청이 두 번 나가지 않게 막는다
  const finishing = useRef(false);
  const finish = async (d: Draft): Promise<AiError | null> => {
    if (finishing.current) return null;
    finishing.current = true;
    try {
      let rec = makeRecord(d.category!, d.worry, d.turns);
      if (d.useAi) {
        try { rec = await withAi(rec); }
        catch (e) { return e instanceof AiFailure ? e.reason : 'failed'; }
      }
      setCurrent(rec);
      setSaveError(false);
      go({ name: 'result' });
      return null;
    } finally {
      finishing.current = false;
    }
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
