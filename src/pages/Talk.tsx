// 고민 기록: 카테고리 → 직접 쓰기 → 내 답에서 이어지는 질문 (한 화면에 질문 하나)
import { useEffect, useRef, useState } from 'react';
import { CATEGORIES, type Slot } from '../data/flow';
import type { CategoryId } from '../data/songs';
import { MAX_Q, fetchNextQuestion, localQuestion, nextQuestion, type Answer, type Question, type Turn } from '../lib/conversation';
import { Header } from '../components/Header';

export interface Draft {
  category?: CategoryId;
  worry: string;
  /** 지금까지의 질문·답이 바탕으로 삼은 원문 */
  basis: string;
  turns: Turn[];
  useAi: boolean;
}

interface Props {
  draft: Draft;
  setDraft: (d: Draft) => void;
  onFinish: (d: Draft) => Promise<void> | void;
}

type Stage =
  | { kind: 'category' }
  | { kind: 'write' }
  | { kind: 'q'; index: number; q: Question }
  | { kind: 'thinking'; msg?: string }
  | { kind: 'error'; slot: Slot; draft: Draft };

/** 답을 바꾼 지점 이후의 질문을 다시 만들되, 같은 질문이 다시 나오면 기존 답을 유지한다 */
async function reconcile(category: CategoryId, worry: string, turns: Turn[], keepUpTo: number, useAi: boolean) {
  const kept = turns.slice(0, keepUpTo);
  for (let j = keepUpTo; j < turns.length; j++) {
    const q = await nextQuestion(category, worry, kept, useAi);
    if (q && q.id === turns[j].q.id) kept.push(turns[j]);
    else break;
  }
  return kept;
}

export default function Talk({ draft, setDraft, onFinish }: Props) {
  const [stage, setStage] = useState<Stage>(() => (draft.category ? { kind: 'write' } : { kind: 'category' }));
  const [custom, setCustom] = useState<string | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const cat = CATEGORIES.find((c) => c.id === draft.category);

  useEffect(() => { titleRef.current?.focus(); setCustom(null); }, [stage.kind, stage.kind === 'q' ? stage.index : -1]);

  const advance = async (d: Draft) => {
    setStage({ kind: 'thinking', msg: d.turns.length ? '답을 읽고 다음 질문을 고르고 있어요…' : '적어준 문장을 읽고 있어요…' });
    const res = await fetchNextQuestion(d.category!, d.worry, d.turns, d.useAi);
    if (res.kind === 'done') {
      setStage({ kind: 'thinking', msg: '답변을 분석하고 결과를 정리하고 있어요…' });
      await onFinish(d);
      return;
    }
    if (res.kind === 'error') {
      setStage({ kind: 'error', slot: res.slot, draft: d });
      return;
    }
    setStage({ kind: 'q', index: d.turns.length, q: res.question });
  };

  const submitWorry = async () => {
    if (draft.worry.trim().length < 4 || !draft.category) return;
    setStage({ kind: 'thinking' });
    // 고민 원문이 바뀌었으면 그 문장에 기대는 질문만 다시 만든다
    const turns = draft.worry === draft.basis ? draft.turns : await reconcile(draft.category, draft.worry, draft.turns, 0, draft.useAi);
    const d = { ...draft, basis: draft.worry, turns };
    setDraft(d);
    await advance(d);
  };

  const answer = async (index: number, q: Question, a: Answer) => {
    const turns = [...draft.turns.slice(0, index), { q, a }, ...draft.turns.slice(index + 1)];
    let d = { ...draft, turns };
    if (index < draft.turns.length - 1) {
      // 이전 답을 고쳤다면 뒤 질문은 다시 확인
      setStage({ kind: 'thinking' });
      d = { ...d, turns: await reconcile(draft.category!, draft.worry, turns, index + 1, draft.useAi) };
    }
    setDraft(d);
    // 이미 답한 뒤 질문이 남아 있으면 그 질문으로, 아니면 새 질문
    if (index + 1 < d.turns.length) setStage({ kind: 'q', index: index + 1, q: d.turns[index + 1].q });
    else await advance(d);
  };

  const back = () => {
    if (stage.kind === 'q') {
      if (stage.index === 0) setStage({ kind: 'write' });
      else setStage({ kind: 'q', index: stage.index - 1, q: draft.turns[stage.index - 1].q });
    } else if (stage.kind === 'write') setStage({ kind: 'category' });
  };

  const prevAnswer = stage.kind === 'q' ? draft.turns[stage.index]?.a : undefined;
  const qCount = stage.kind === 'q' ? stage.index + 1 : 0;

  return (
    <div className="page page--paper talk">
      <Header tone="light" current="write" />
      <main id="main" className="desk">
        <div className="sheet sheet--talk">
          <div className="sheet__top">
            <ol className="steps" aria-label="진행 단계">
              <li className={stage.kind === 'category' ? 'on' : 'done'}>고민 고르기</li>
              <li className={stage.kind === 'write' ? 'on' : stage.kind === 'category' ? '' : 'done'}>직접 쓰기</li>
              <li className={stage.kind === 'q' || stage.kind === 'thinking' ? 'on' : ''}>이어지는 질문{qCount ? ` ${qCount}` : ''}</li>
            </ol>
            {cat && stage.kind !== 'category' && (
              <button type="button" className="chip" onClick={() => setStage({ kind: 'category' })} aria-label={`고민 주제 ${cat.label}, 바꾸기`}>{cat.label} <span aria-hidden="true">· 바꾸기</span></button>
            )}
          </div>

          {stage.kind === 'category' && (
            <section className="talk__body enter-next" aria-labelledby="t-cat">
              <h1 id="t-cat" ref={titleRef} tabIndex={-1} className="talk__q">어떤 고민을 꺼내볼까요?</h1>
              <p className="talk__hint">가장 가까운 것 하나를 골라주세요. 나중에 바꿀 수 있어요.</p>
              <div className="cats">
                {CATEGORIES.map((c) => (
                  <button key={c.id} type="button" className={`cat ${draft.category === c.id ? 'is-on' : ''}`} aria-pressed={draft.category === c.id}
                    onClick={() => { setDraft({ ...draft, category: c.id, ...(draft.category !== c.id ? { basis: '', turns: [] } : {}) }); setStage({ kind: 'write' }); }}>
                    <span className="cat__label">{c.label}</span>
                    <span className="cat__hint">{c.hint}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {stage.kind === 'write' && cat && (
            <section className="talk__body enter-next" aria-labelledby="t-write">
              <h1 id="t-write" ref={titleRef} tabIndex={-1} className="talk__q">어떤 일이 마음에 남았나요?</h1>
              <p className="talk__hint">짧게, 내 말로 적어도 괜찮아요. 적은 문장을 읽고 다음 질문을 건넬게요.</p>
              {ai && (
                <div className="notice" role="note">
                  <label className="notice__toggle">
                    <input type="checkbox" checked={draft.useAi} onChange={(e) => setDraft({ ...draft, useAi: e.target.checked })} />
                    <span><b>AI와 함께 이야기하기</b> · 켜두면 {providerNote(provider)} 끄면 이 기기 안에서만 질문과 결과를 만들어요.</span>
                  </label>
                </div>
              )}
              <label htmlFor="worry" className="sr-only">고민 적기</label>
              <textarea
                id="worry"
                ref={areaRef}
                className="paper-input"
                value={draft.worry}
                maxLength={600}
                placeholder={cat.placeholder}
                onChange={(e) => setDraft({ ...draft, worry: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitWorry(); }}
              />
              <div className="talk__meta">
                <span>{draft.useAi ? '질문과 답장을 만드는 데만 쓰고, YouTube에는 보내지 않아요' : '이 브라우저 안에서만 읽혀요'}</span>
                <span>{draft.worry.length} / 600</span>
              </div>
            </section>
          )}

          {stage.kind === 'thinking' && (
            <section className="talk__body talk__thinking" aria-live="polite">
              <span className="spinner spinner--ink" />
              <p>{stage.msg || '적어준 문장을 읽고 있어요…'}</p>
            </section>
          )}

          {stage.kind === 'error' && (
            <section className="talk__body talk__error" aria-live="assertive" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <div style={{ maxWidth: '440px', margin: '0 auto' }}>
                <p style={{ color: 'var(--brass)', fontWeight: 600, fontSize: '1.125rem', marginBottom: '0.5rem' }}>
                  [제미나이 호출] 실패
                </p>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>질문을 불러오지 못했습니다</h2>
                <p style={{ color: 'var(--sage-mute)', fontSize: '0.9375rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                  Gemini API 연결에 실패했습니다. 다시 시도하거나 기본 질문으로 계속 진행할 수 있어요.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  <button type="button" className="btn btn--sage btn--lg" onClick={() => advance(stage.draft)}>
                    다시 시도
                  </button>
                  <button
                    type="button"
                    className="btn btn--line-dark btn--lg"
                    onClick={() => {
                      const q = localQuestion(stage.draft.category!, stage.draft.worry, stage.slot);
                      setStage({ kind: 'q', index: stage.draft.turns.length, q });
                    }}
                  >
                    기본 질문으로 진행
                  </button>
                  <button
                    type="button"
                    className="btn btn--text"
                    onClick={() => answer(stage.draft.turns.length, localQuestion(stage.draft.category!, stage.draft.worry, stage.slot), { kind: 'skip' })}
                  >
                    건너뛰기
                  </button>
                </div>
              </div>
            </section>
          )}

          {stage.kind === 'q' && (
            <section className="talk__body enter-next" key={stage.q.id + stage.index} aria-labelledby="t-q">
              {stage.q.context && (
                <p className="echo">“{stage.q.context}”<span className="echo__label">내가 쓴 말에서</span></p>
              )}
              <h1 id="t-q" ref={titleRef} tabIndex={-1} className="talk__q talk__q--follow">{stage.q.text}</h1>
              <div className="answers" role="group" aria-label="빠르게 답하기">
                {stage.q.options.map((op) => {
                  const on = prevAnswer?.kind === 'option' && prevAnswer.value === op.value;
                  return (
                    <button key={op.value} type="button" className={`answer ${on ? 'is-on' : ''}`} aria-pressed={on}
                      onClick={() => answer(stage.index, stage.q, { kind: 'option', value: op.value, label: op.label, summary: op.summary })}>
                      {op.label}
                    </button>
                  );
                })}
                <button type="button" className={`answer answer--ghost ${custom !== null || prevAnswer?.kind === 'text' ? 'is-on' : ''}`}
                  onClick={() => setCustom(prevAnswer?.kind === 'text' ? prevAnswer.text : '')}>직접 입력</button>
              </div>
              {custom !== null && (
                <form className="custom" onSubmit={(e) => { e.preventDefault(); if (custom.trim()) answer(stage.index, stage.q, { kind: 'text', text: custom.trim() }); }}>
                  <label htmlFor="custom" className="sr-only">직접 답하기</label>
                  <input id="custom" className="paper-line" autoFocus value={custom} maxLength={200} placeholder="내 말로 짧게 적어주세요" onChange={(e) => setCustom(e.target.value)} />
                  <button type="submit" className="btn btn--sage" disabled={!custom.trim()}>확인</button>
                </form>
              )}
            </section>
          )}

          <div className="sheet__nav">
            <button type="button" className="btn btn--text" onClick={back} disabled={stage.kind === 'category' || stage.kind === 'thinking'}>이전</button>
            {stage.kind === 'q' && (
              <p className="talk__count" aria-live="polite">질문 {stage.index + 1} · 최대 {MAX_Q}개</p>
            )}
            {stage.kind === 'write' && (
              <button type="button" className="btn btn--sage" onClick={submitWorry} disabled={draft.worry.trim().length < 4}>다음</button>
            )}
            {stage.kind === 'q' && (
              <button type="button" className="btn btn--text" onClick={() => answer(stage.index, stage.q, { kind: 'skip' })}>건너뛰기</button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
