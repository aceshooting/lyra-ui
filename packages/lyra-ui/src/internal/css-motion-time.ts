/** Convert one computed CSS time to milliseconds. Keep parseFloat's permissive prefix parsing:
 * callers already accept it for strings ending in `ms` or `s`. Invalid and non-finite values
 * contribute zero to timing calculations. Negative delays remain negative for paired animations. */
export function parseCssTime(value: string): number {
  const trimmed = value.trim();
  const parsed = trimmed.endsWith('ms')
    ? Number.parseFloat(trimmed)
    : trimmed.endsWith('s')
      ? Number.parseFloat(trimmed) * 1000
      : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

/** The zero-floored maximum of a computed comma-separated time list. Callers deliberately add
 * duration and delay maxima independently rather than pairing transition list entries. */
export function maxCssTime(value: string): number {
  return Math.max(0, ...value.split(',').map(parseCssTime));
}

const CSS_TIME_TOKEN = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(ms|s)(?:\s+(.*))?$/i;

/** A leading CSS `<time>` token of an authored value: its finite milliseconds (sign, exponent and
 * either unit case allowed) and the trimmed text after it, or undefined when the value is not one.
 * A caller that accepts only a bare time checks `rest === ''`. */
export function parseCssTimeToken(value: string): { ms: number; rest: string } | undefined {
  const match = CSS_TIME_TOKEN.exec(value.trim());
  const ms = match && Number(match[1]) * (match[2]!.toLowerCase() === 's' ? 1000 : 1);
  return match && Number.isFinite(ms) ? { ms: ms!, rest: match[3]?.trim() ?? '' } : undefined;
}
