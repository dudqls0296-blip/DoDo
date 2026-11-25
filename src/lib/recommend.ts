// 고민저장소 · 실제 곡 추천
// 우선순위: 지금 음악에서 원하는 것(need) → 고민의 맥락(category·sticking) → 사용자가 알려준 취향(lang·vocal)
// 큐레이션 목록(SONGS) 안에서만 고른다. 곡이나 URL을 만들어내지 않는다.
import { SONGS, type CategoryId, type Need, type Song } from '../data/songs';
import { CATEGORIES } from '../data/flow';
import type { Prefs } from './conversation';
import { hasBatchim } from './josa';

export interface RecInput {
  category: CategoryId;
  need: Need;
  prefs: Prefs;
  sticking?: string;
  /** 같은 유형이라도 고민마다 다른 곡이 나오도록 섞는 값 (고민 원문 해시) */
  seed: string;
  /** 유형 검사의 음악 축 (S: 잔잔, M: 움직임) */
  soundAxis?: 'S' | 'M';
  exclude: string[];
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
}

const FOCUS_STICKING = new Set(['lost', 'noenergy', 'lost_noenergy', 'focus', 'start', 'order', 'volume']);

export function score(s: Song, r: RecInput): number {
  let v = 0;
  // 1) 지금 원하는 노래 (가장 큰 비중)
  if (s.needs[0] === r.need) v += 12;
  else if (s.needs.includes(r.need)) v += 9;
  else if (r.need === 'same' && s.needs.includes('calm')) v += 2;
  else if (r.need === 'calm' && s.needs.includes('same')) v += 2;
  else v -= 10;
  // 2) 고민의 맥락
  if (s.strict && !s.themes.includes(r.category)) v -= 20;
  if (s.themes.includes(r.category)) v += 4;
  if (r.category === 'study' && s.focus && (r.need !== 'same' || FOCUS_STICKING.has(r.sticking || ''))) v += 3;
  // 3) 사용자가 알려준 취향
  if (r.prefs.vocal === 'inst') v += s.vocal ? -9 : 9;
  if (r.prefs.vocal === 'vocal' && !s.vocal) v -= 5;
  if (r.prefs.lang !== 'any') {
    if (s.lang === r.prefs.lang) v += 6;
    else if (s.lang === 'inst') v += r.prefs.vocal === 'vocal' ? -4 : 0;
    else v -= 6;
  }
  // 유형의 음악 축은 아주 약하게만
  if (r.soundAxis === 'S' && (s.needs.includes('calm') || s.needs.includes('same'))) v += 1.5;
  if (r.soundAxis === 'M' && s.needs.includes('energy')) v += 1.5;
  // 같은 조건에서도 고민마다 다른 곡이 나오도록
  v += hash(r.seed + s.id) * 3;
  return v;
}

/** AI에게 넘길 후보: 조건에 맞는 상위 n곡 (이미 보여준 곡 제외) */
export function candidates(r: RecInput, n = 8): Song[] {
  const ranked = SONGS.map((s) => ({ s, v: score(s, r) })).sort((a, b) => b.v - a.v);
  const fit = ranked.filter((x) => x.v > 0);
  const fresh = fit.filter((x) => !r.exclude.includes(x.s.id));
  return (fresh.length >= 3 ? fresh : fit.length >= 3 ? fit : ranked).slice(0, n).map((x) => x.s);
}

export function recommend(r: RecInput): Song {
  const ranked = SONGS.map((s) => ({ s, v: score(s, r) })).sort((a, b) => b.v - a.v);
  const fresh = ranked.find((x) => !r.exclude.includes(x.s.id));
  if (fresh) return fresh.s;
  // 모두 보여줬다면 가장 오래전에 보여준 곡부터 다시
  const oldest = r.exclude.find((id) => SONGS.some((s) => s.id === id));
  return SONGS.find((s) => s.id === oldest) || ranked[0].s;
}

export function reason(s: Song, r: RecInput, phrase: string | undefined): string {
  const cat = CATEGORIES.find((c) => c.id === r.category)!.label;
  const p = phrase && phrase.length <= 24 ? `‘${phrase}’` : `${cat} 고민`;
  const pj = phrase && phrase.length <= 24 ? (hasBatchim(phrase) ? '이라고' : '라고') : '';
  let lead: string;
  if (r.need === 'same') {
    lead = phrase && pj
      ? `${p}${pj} 적어주신 마음을 억지로 밝게 바꾸려 하기보다, 지금 이 순간 그 감정의 곁에 가만히 머물러 줄 수 있는 곡이에요.`
      : `${cat}의 무거운 감정을 억지로 밀어내지 않고, 지금 당신의 마음 곁을 따뜻하게 지켜줄 곡이에요.`;
  } else if (r.need === 'calm') {
    lead = phrase && pj
      ? `${p}${pj} 적어주신 지금, 팽팽하게 당겨진 생각의 끈을 풀고 가쁜 숨을 차분히 고르게 해줄 곡이에요.`
      : `${cat} 앞에서 복잡해진 머릿속의 속도를 한 템포 늦추고 평온함을 되찾아줄 곡이에요.`;
  } else {
    lead = phrase && pj
      ? `${p}${pj} 적어주신 무거운 마음을 털어내고, 다시 앞으로 한 걸음 내딛을 수 있도록 등을 다정하게 밀어주는 곡이에요.`
      : `${cat} 앞에서 멈추어 있던 마음에 다시 온기와 활력을 불어넣어 줄 곡이에요.`;
  }
  const extras: string[] = [];
  if (!s.vocal && r.category === 'study') extras.push('가사가 없어 생각에 방해받지 않고 오롯이 나에게 집중할 수 있어요.');
  else if (!s.vocal && r.prefs.vocal === 'inst') extras.push('가사 없는 곡을 선호하셔서 마음을 정돈하기 좋은 연주곡으로 선정했어요.');
  if (r.prefs.lang === 'ko' && s.lang === 'ko') extras.push('와닿는 한국어 노랫말로 깊은 공감을 전해줘요.');
  if (r.prefs.lang === 'en' && s.lang === 'en') extras.push('감각적인 멜로디와 영어 노랫말이 마음에 기분 좋은 환기를 더해줘요.');
  return [lead, `${s.sound}.`, `${s.story}.`, ...extras].join(' ');
}

export function seedOf(text: string) { return String(Math.round(hash(text) * 1e9)); }
