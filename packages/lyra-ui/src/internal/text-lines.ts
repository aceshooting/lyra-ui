/**
 * Splits `text` on `\r\n`, `\n` or lone `\r` with a character scan (no regex allocation). Empty
 * text yields `['']`, like `String.prototype.split`. With `limit`, at most `limit` lines are
 * returned and the remainder is dropped (a non-positive or non-finite limit means no limit).
 */
export function splitLines(text: string, limit?: number): string[] {
  const max = limit !== undefined && Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : Infinity;
  const lines: string[] = [];
  let start = 0;
  const length = text.length;
  for (let i = 0; i < length; i++) {
    const code = text.charCodeAt(i);
    if (code !== 10 && code !== 13) continue;
    lines.push(text.slice(start, i));
    if (lines.length >= max) return lines;
    if (code === 13 && text.charCodeAt(i + 1) === 10) i++;
    start = i + 1;
  }
  lines.push(text.slice(start));
  return lines;
}

/** Number of lines `splitLines(text)` would produce, without allocating them. */
export function countLines(text: string): number {
  let count = 1;
  const length = text.length;
  for (let i = 0; i < length; i++) {
    const code = text.charCodeAt(i);
    if (code === 10) count++;
    else if (code === 13) {
      count++;
      if (text.charCodeAt(i + 1) === 10) i++;
    }
  }
  return count;
}
