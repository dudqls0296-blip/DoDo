// 고민저장소 · 내 보관함 (LocalStorage)
// ‘내 보관함에 저장’을 눌렀을 때만 기록된다.
import type { CategoryId } from '../data/songs';
import type { Turn } from './conversation';
import type { ResultData } from './result';

export interface Record_ {
  id: string;
  docNo: string;
  createdAt: number;
  category: CategoryId;
  worry: string;
  turns: Turn[];
  result: ResultData;
  /** 이번 기록에서 보여준 곡 (순서대로) */
  songHistory: string[];
  songId: string;
  type?: { code: string; answers: ('a' | 'b')[]; songId?: string };
  /** AI가 고른 ‘당신을 위한 음악’ 3곡 (첫 곡이 대표곡) */
  songs?: string[];
  /** 곡별 추천 이유 (AI가 쓴 이유가 있으면 여기에) */
  reasons?: Record<string, string>;
  /** 답장 쓰기 대화 */
  chat?: { role: 'user' | 'assistant'; text: string }[];
  sample?: boolean;
}

const KEY = 'gominjeojangso.archive.v2';

function safeGet(): Record_[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function safeSet(list: Record_[]): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function storageAvailable(): boolean {
  try {
    const k = KEY + '.probe';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export function listRecords(): Record_[] {
  return safeGet().sort((a, b) => b.createdAt - a.createdAt);
}

export function getRecord(id: string): Record_ | undefined {
  return safeGet().find((r) => r.id === id);
}

export function saveRecord(r: Record_): boolean {
  const list = safeGet().filter((x) => x.id !== r.id);
  list.push(r);
  return safeSet(list);
}

export function deleteRecord(id: string): boolean {
  return safeSet(safeGet().filter((x) => x.id !== id));
}

export function newIds(seed: string): { id: string; docNo: string } {
  let h = 2166136261;
  const s = seed + Date.now() + Math.random();
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const n = (h >>> 0).toString(36);
  const year = new Date().getFullYear();
  const num = String((h >>> 0) % 10000).padStart(4, '0');
  return { id: 'r' + n + Date.now().toString(36), docNo: `${year}-${num}` };
}

export function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
