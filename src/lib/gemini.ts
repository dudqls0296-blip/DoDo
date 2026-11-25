// 고민저장소 · Gemini API 연동 모듈
// Console 규격:
// - 요청 시: [제미나이 호출] 후속 질문 요청 / [제미나이 호출] 답변 분석 및 음악 추천 요청
// - 성공 시: [제미나이 호출] 성공
// - 실패 시: [제미나이 호출] 실패
// 보안 규칙: 고민 원문이나 API 키는 절대 Console에 출력하지 않는다.

export function getApiBase(): string {
  if (typeof window !== 'undefined') {
    if ((window as any).__API_BASE__) {
      return String((window as any).__API_BASE__).replace(/\/+$/, '');
    }
    try {
      const saved = localStorage.getItem('GEMINI_API_BASE');
      if (saved) return saved.replace(/\/+$/, '');
    } catch { /* noop */ }
  }
  return '';
}

export interface GeminiQuestionResponse {
  provider: 'gemini';
  model: string;
  stage: 'question';
  result: {
    skip: boolean;
    crisis?: boolean;
    context?: string;
    question?: string;
    options?: { label: string; summary: string; help?: string }[];
  };
}

export interface GeminiAnalysisResponse {
  provider: 'gemini';
  model: string;
  stage: 'analysis';
  result: {
    quote: string;
    summary: string;
    songId: string;
    songTitle?: string;
    songArtist?: string;
    reason: string;
    cheer: string;
    action: string;
  };
}

export async function requestGeminiQuestion(payload: {
  category: string;
  worry: string;
  turns: { question: string; answer: string }[];
  slot: string;
}): Promise<GeminiQuestionResponse['result'] | null> {
  console.log('[제미나이 호출] 후속 질문 요청');
  const base = getApiBase();
  const url = `${base}/api/gemini/question`;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      console.warn('[제미나이 호출] 실패');
      return null;
    }

    const data: GeminiQuestionResponse = await res.json();
    if (data?.provider === 'gemini' && data?.stage === 'question' && data?.result) {
      console.log('[제미나이 호출] 성공');
      return data.result;
    }

    console.warn('[제미나이 호출] 실패');
    return null;
  } catch {
    console.warn('[제미나이 호출] 실패');
    return null;
  }
}

export async function requestGeminiAnalysis(payload: {
  category: string;
  worry: string;
  turns: { question: string; answer: string }[];
  need: string;
  prefs?: { lang?: string; vocal?: string };
  candidates: { id: string; title: string; artist: string; lang: string; needs: string[]; sound: string; story: string }[];
}): Promise<GeminiAnalysisResponse['result'] | null> {
  console.log('[제미나이 호출] 답변 분석 및 음악 추천 요청');
  const base = getApiBase();
  const url = `${base}/api/gemini/analysis`;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      console.warn('[제미나이 호출] 실패');
      return null;
    }

    const data: GeminiAnalysisResponse = await res.json();
    if (data?.provider === 'gemini' && data?.stage === 'analysis' && data?.result?.summary) {
      console.log('[제미나이 호출] 성공');
      return data.result;
    }

    console.warn('[제미나이 호출] 실패');
    return null;
  } catch {
    console.warn('[제미나이 호출] 실패');
    return null;
  }
}
