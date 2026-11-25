// 한국어 조사 선택 도우미: 받침 유무에 따라 이/가, 을/를 등을 고른다.
function lastCharCode(word: string): number {
  const trimmed = word.replace(/[\s"'”“’‘)\]}.…!?]+$/u, '');
  return trimmed.charCodeAt(trimmed.length - 1);
}

export function hasBatchim(word: string): boolean {
  const code = lastCharCode(word);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  // 영문·숫자: 대략적인 규칙
  const ch = String.fromCharCode(code).toLowerCase();
  return /[013678lmnr]/.test(ch);
}

function rieul(word: string): boolean {
  const code = lastCharCode(word);
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 === 8;
}

type Pair = '이/가' | '은/는' | '을/를' | '과/와' | '이라고/라고' | '으로/로' | '이에요/예요' | '이/' ;

export function j(word: string, pair: Pair): string {
  const b = hasBatchim(word);
  switch (pair) {
    case '이/가': return word + (b ? '이' : '가');
    case '은/는': return word + (b ? '은' : '는');
    case '을/를': return word + (b ? '을' : '를');
    case '과/와': return word + (b ? '과' : '와');
    case '이라고/라고': return word + (b ? '이라고' : '라고');
    case '으로/로': return word + (b && !rieul(word) ? '으로' : '로');
    case '이에요/예요': return word + (b ? '이에요' : '예요');
    case '이/': return word + (b ? '이' : '');
  }
}
