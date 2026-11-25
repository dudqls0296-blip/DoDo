// 답장 쓰기: 결과를 받은 뒤 고민저장소와 짧게 이야기를 이어간다 (AI 연결 시)
import { useEffect, useRef, useState } from 'react';
import { aiReply, getProvider, type Provider } from '../lib/ai';
import { CATEGORIES } from '../data/flow';
import type { Record_ } from '../lib/storage';

const MAX_USER = 6;
const CRISIS = /(죽고\s?싶|죽을까|자살|자해|사라지고\s?싶|살기\s?싫|없어지고\s?싶|끝내고\s?싶)/;
const SAFE_LINE = '지금 많이 힘든 마음이 느껴져요. 혼자 견디지 않아도 돼요. 자살예방 상담전화 109(24시간), 청소년 상담 1388(전화·문자·카카오톡)에서 바로 이야기할 수 있어요. 지금 곁에 있는 믿을 만한 어른에게도 꼭 알려주세요.';

export default function ReplyBox({ rec, onUpdate }: { rec: Record_; onUpdate: (r: Record_) => void }) {
  const [provider, setProvider] = useState<Provider>(null);
  const [checked, setChecked] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const listRef = useRef<HTMLOListElement>(null);
  const chat = rec.chat || [];
  const used = chat.filter((m) => m.role === 'user').length;

  useEffect(() => { getProvider().then((p) => { setProvider(p); setChecked(true); }); }, []);
  useEffect(() => { listRef.current?.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [chat.length, busy]);

  if (!checked || !provider) return null;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy || used >= MAX_USER) return;
    setErr('');
    const next = [...chat, { role: 'user' as const, text: t }];
    onUpdate({ ...rec, chat: next });
    setText('');
    setBusy(true);
    let answer: string | null = null;
    const j = await aiReply({ category: CATEGORIES.find((c) => c.id === rec.category)!.label, worry: rec.worry, summary: rec.result.lead, chat: next });
    if (j && typeof j.text === 'string' && j.text.trim().length > 1) answer = j.text.trim().slice(0, 700);
    // 위기 표현에는 AI 응답과 상관없이 도움 받을 곳을 꼭 함께 안내한다
    if (CRISIS.test(t) && (!answer || !/109|1388/.test(answer))) answer = answer ? `${SAFE_LINE}\n\n${answer}` : SAFE_LINE;
    setBusy(false);
    if (!answer) { setErr('답장을 받지 못했어요. 잠시 뒤 다시 보내주세요.'); onUpdate({ ...rec, chat }); setText(t); return; }
    onUpdate({ ...rec, chat: [...next, { role: 'assistant', text: answer }] });
  };

  return (
    <div className="reply" aria-labelledby="reply-title">
      <h2 id="reply-title" className="reply__title">답장 쓰기</h2>
      <p className="reply__hint">결과를 읽고 더 하고 싶은 말이 있다면 적어주세요. 고민저장소가 짧게 답장해요. 고민저장소는 AI이고 전문 상담사가 아니에요.</p>
      {chat.length > 0 && (
        <ol className="reply__list" ref={listRef} aria-live="polite">
          {chat.map((m, i) => (
            <li key={i} className={`bubble bubble--${m.role}`}>
              <span className="bubble__who">{m.role === 'user' ? '나' : '고민저장소'}</span>
              <p>{m.text}</p>
            </li>
          ))}
          {busy && <li className="bubble bubble--assistant bubble--typing"><span className="bubble__who">고민저장소</span><p><span className="dots"><i /><i /><i /></span> 답장을 쓰고 있어요</p></li>}
        </ol>
      )}
      {used < MAX_USER ? (
        <form className="reply__form" onSubmit={send}>
          <label htmlFor="reply-input" className="sr-only">답장 내용</label>
          <textarea id="reply-input" className="paper-input reply__input" value={text} maxLength={500} rows={3}
            placeholder={chat.length ? '이어서 적어주세요' : '예: 그래도 시작하는 게 너무 무서워요'}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(e as any); }} />
          <div className="reply__row">
            <span>{used} / {MAX_USER} · Ctrl+Enter로 보내기</span>
            <button type="submit" className="btn btn--sage" disabled={!text.trim() || busy}>{busy ? '답장 기다리는 중…' : '보내기'}</button>
          </div>
          {err && <p className="reply__err" role="alert">{err}</p>}
        </form>
      ) : (
        <p className="reply__hint">오늘의 대화는 여기까지예요. 더 이야기하고 싶다면 새로 기록하거나, 믿을 만한 사람과 이어가 보세요.</p>
      )}
    </div>
  );
}
