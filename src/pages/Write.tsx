// 고민 기록지: 한 화면에 질문 하나, 1 / 4 진행 상태
import { useEffect, useRef, useState } from 'react';
import { QUESTIONS } from '../data/content';
import type { Answers, Notes, StepKey } from '../lib/analysis';
import { Header } from '../components/Header';

interface Props {
  answers: Answers;
  notes: Notes;
  step: number;
  setStep: (n: number) => void;
  onAnswer: (k: StepKey, id: string) => void;
  onNote: (k: StepKey, text: string) => void;
  onFinish: () => void;
}

export default function Write({ answers, notes, step, setStep, onAnswer, onNote, onFinish }: Props) {
  const q = QUESTIONS[step];
  const chosen = answers[q.key];
  const titleRef = useRef<HTMLHeadingElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const [dir, setDir] = useState<'next' | 'prev'>('next');
  const last = step === QUESTIONS.length - 1;

  useEffect(() => { titleRef.current?.focus({ preventScroll: false }); }, [step]);

  const next = () => {
    if (!chosen) return;
    if (last) onFinish();
    else { setDir('next'); setStep(step + 1); window.scrollTo({ top: 0 }); }
  };
  const prev = () => { if (step > 0) { setDir('prev'); setStep(step - 1); window.scrollTo({ top: 0 }); } };
  const noteLen = (notes[q.key] || '').length;

  return (
    <div className="page page--paper write">
      <Header tone="light" current="write" />
      <main id="main" className="desk">
        <form
          className="sheet"
          onSubmit={(e) => { e.preventDefault(); next(); }}
          aria-labelledby={`q-${q.key}`}
        >
          <div className="sheet__top">
            <p className="progress-label" aria-live="polite"><strong>{step + 1}</strong> / {QUESTIONS.length}</p>
            <div className="progress" role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step + 1} aria-label="진행 상태">
              {QUESTIONS.map((_, i) => <span key={i} className={i <= step ? 'on' : ''} />)}
            </div>
            <p className="sheet__stamp">고민저장소 기록지</p>
          </div>

          <div key={step} className={`sheet__body enter-${dir}`}>
            <div className="sheet__main">
            <h1 id={`q-${q.key}`} ref={titleRef} tabIndex={-1} className="sheet__q">{q.title}</h1>
            <p className="sheet__hint">{q.hint}</p>

            <fieldset className="choices">
              <legend className="sr-only">{q.title} 선택지</legend>
              {q.options.map((o, i) => (
                <label key={o.id} className={`choice ${chosen === o.id ? 'is-on' : ''}`}>
                  <input
                    type="radio"
                    name={q.key}
                    value={o.id}
                    checked={chosen === o.id}
                    onChange={() => { onAnswer(q.key, o.id); if (matchMedia('(max-width: 860px)').matches) setTimeout(() => noteRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120); }}
                  />
                  <span className="choice__mark" aria-hidden="true">{String.fromCharCode(65 + i)}</span>
                  <span className="choice__text">
                    <span className="choice__label">{o.label}</span>
                    <span className="choice__detail">{o.detail}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            </div>

            <div className={`why ${chosen ? 'is-open' : ''}`}>
              <div className="why__inner">
                <label htmlFor={`why-${q.key}`} className="why__label">왜 이 답을 골랐나요?</label>
                <p className="why__help" id={`why-help-${q.key}`}>{chosen ? '한 줄도 괜찮아요. 적은 문장은 결과에 그대로 인용될 수 있어요.' : '먼저 선택지 하나를 골라주세요.'}</p>
                <textarea
                  ref={noteRef}
                  id={`why-${q.key}`}
                  aria-describedby={`why-help-${q.key}`}
                  value={notes[q.key] || ''}
                  maxLength={400}
                  rows={4}
                  disabled={!chosen}
                  placeholder={q.placeholder}
                  onChange={(e) => onNote(q.key, e.target.value)}
                />
                <p className="why__count"><span>이 브라우저 안에서만 읽혀요</span>{noteLen} / 400</p>
              </div>
            </div>
          </div>

          <div className="sheet__nav">
            <button type="button" className="btn btn--text" onClick={prev} disabled={step === 0}>이전</button>
            <p className="sheet__need" aria-live="polite">{chosen ? '' : '선택지 하나를 골라주세요'}</p>
            <button type="submit" className="btn btn--sage" disabled={!chosen}>{last ? '내 결과 보기' : '다음'}</button>
          </div>
        </form>
      </main>
    </div>
  );
}
