// 내 보관함: 날짜별 리포트 · 다시 열기 · 삭제
import { useEffect, useRef, useState } from 'react';
import { CATEGORIES } from '../data/flow';
import { SONGS } from '../data/songs';
import { TYPE_NAMES } from '../data/typeQuiz';
import { deleteRecord, formatDate, formatTime, listRecords, storageAvailable, type Record_ } from '../lib/storage';
import { Footer, Header } from '../components/Header';

export default function Archive({ onSample }: { onSample: () => void }) {
  const [list, setList] = useState<Record_[]>(() => listRecords());
  const [confirm, setConfirm] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const titleRef = useRef<HTMLHeadingElement>(null);
  const ok = storageAvailable();
  useEffect(() => { titleRef.current?.focus(); }, []);

  const groups = list.reduce<Record<string, Record_[]>>((acc, r) => {
    const d = formatDate(r.createdAt);
    (acc[d] ||= []).push(r);
    return acc;
  }, {});

  const remove = (r: Record_) => {
    deleteRecord(r.id);
    setList(listRecords());
    setConfirm(null);
    setMsg(`No. ${r.docNo} 기록을 삭제했어요.`);
  };

  return (
    <div className="page page--paper archive">
      <Header tone="light" current="archive" />
      <main id="main" className="shelf">
        <div className="shelf__head">
          <h1 ref={titleRef} tabIndex={-1}>내 보관함</h1>
          <p>‘내 보관함에 저장’을 누른 리포트만 이 브라우저에 보관돼요. 다른 기기나 브라우저에서는 보이지 않아요.</p>
          <p className="sr-only" aria-live="polite">{msg}</p>
        </div>

        {!ok && <p className="shelf__warn" role="alert">이 브라우저에서는 저장 공간을 쓸 수 없어요. 개인정보 보호 모드라면 일반 창에서 열어주세요.</p>}

        {list.length === 0 ? (
          <div className="shelf__empty">
            <div className="empty-sleeve" aria-hidden="true"><span /></div>
            <h2>아직 보관한 기록이 없어요</h2>
            <p>고민을 기록하고 결과 화면에서 ‘내 보관함에 저장’을 누르면 여기에 날짜별로 꽂혀요.</p>
            <div className="shelf__emptyActions">
              <a className="btn btn--sage btn--lg" href="#write">고민 기록하기</a>
              <button type="button" className="btn btn--line btn--lg" onClick={onSample}>예시 리포트 보기</button>
            </div>
          </div>
        ) : (
          Object.entries(groups).map(([date, items]) => (
            <section key={date} className="shelf__day" aria-label={date}>
              <h2 className="shelf__date">{date} <span>{items.length}개</span></h2>
              <ul className="shelf__list">
                {items.map((r) => {
                  const cat = CATEGORIES.find((c) => c.id === r.category);
                  const song = SONGS.find((s) => s.id === r.songId);
                  const code = r.type?.code;
                  return (
                    <li key={r.id} className="entry">
                      <div className={`entry__spine spine--${r.category}`} aria-hidden="true"><span>{code || cat?.label}</span></div>
                      <div className="entry__body">
                        <p className="entry__meta">No. {r.docNo} · {formatTime(r.createdAt)}</p>
                        <h3 className="entry__title">“{r.result.quote}”</h3>
                        <p className="entry__line">{cat?.label} · ♪ {song?.title} — {song?.artist}{code ? ` · ${code} ${TYPE_NAMES[code]?.name ?? ''}` : ''}</p>
                      </div>
                      <div className="entry__actions">
                        <a className="btn btn--sage" href={`#report-${r.id}`}>리포트 열기</a>
                        <a className="btn btn--line" href={`#result-${r.id}`}>결과 보기</a>
                        {confirm === r.id ? (
                          <span className="entry__confirm" role="group" aria-label="삭제 확인">
                            <button type="button" className="btn btn--danger" onClick={() => remove(r)}>삭제할게요</button>
                            <button type="button" className="btn btn--text" onClick={() => setConfirm(null)}>취소</button>
                          </span>
                        ) : (
                          <button type="button" className="btn btn--text" onClick={() => setConfirm(r.id)}>삭제</button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </main>
      <Footer tone="light" />
    </div>
  );
}
