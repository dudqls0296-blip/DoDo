// 내 고민저장소 유형 알아보기 (한 화면에 한 문항)
import { useEffect, useRef, useState } from 'react';
import { TYPE_QUESTIONS } from '../data/typeQuiz';

export default function TypeQuiz({ onDone, onCancel }: { onDone: (answers: ('a' | 'b')[]) => void; onCancel: () => void }) {
  const [i, setI] = useState(0);
  const [ans, setAns] = useState<('a' | 'b')[]>([]);
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => { ref.current?.focus(); }, [i]);
  const q = TYPE_QUESTIONS[i];
  const pick = (v: 'a' | 'b') => {
    const next = [...ans.slice(0, i), v];
    setAns(next);
    if (i + 1 >= TYPE_QUESTIONS.length) onDone(next);
    else setI(i + 1);
  };
  return (
    <div className="quiz">
      <div className="quiz__top">
        <span className="quiz__count"><b>{i + 1}</b> / {TYPE_QUESTIONS.length}</span>
        <span className="quiz__bar" aria-hidden="true"><span style={{ width: `${((i + 1) / TYPE_QUESTIONS.length) * 100}%` }} /></span>
      </div>
      <p className="quiz__q" ref={ref} tabIndex={-1} key={i}>{q.text}</p>
      <div className="quiz__opts">
        {(['a', 'b'] as const).map((k) => (
          <button key={k} type="button" className={`answer ${ans[i] === k ? 'is-on' : ''}`} onClick={() => pick(k)}>{q[k].label}</button>
        ))}
      </div>
      <div className="quiz__nav">
        <button type="button" className="btn btn--text" onClick={() => (i === 0 ? onCancel() : setI(i - 1))}>{i === 0 ? '닫기' : '이전'}</button>
      </div>
    </div>
  );
}
