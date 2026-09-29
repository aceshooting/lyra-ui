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
