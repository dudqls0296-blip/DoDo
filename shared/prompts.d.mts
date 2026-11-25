export interface QA { question: string; answer: string }
export const QUESTION_SYSTEM: string;
export const RESULT_SYSTEM: string;
export const REPLY_SYSTEM: string;
export function questionUser(a: { category: string; worry: string; turns: QA[]; slot: string }): string;
export function resultUser(a: { category: string; worry: string; turns: QA[]; need: string; prefs: { lang?: string; vocal?: string }; candidates: { id: string; title: string; artist: string; lang: string; needs: string[]; sound: string; story: string }[] }): string;
export function replyUser(a: { category: string; worry: string; summary: string; chat: { role: 'user' | 'assistant'; text: string }[] }): string;
export function parseJson(text: string): any;
