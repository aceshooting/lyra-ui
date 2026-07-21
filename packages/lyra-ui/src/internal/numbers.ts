/** The largest delay browsers can represent reliably with setTimeout. */
export const MAX_TIMEOUT_MS = 2_147_483_647;

/** Returns a finite number or the supplied finite fallback. */
export function finiteNumber(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : Number.isFinite(fallback) ? fallback : 0;
}

/** Returns a finite value clamped to the requested range. */
export function finiteRange(
  value: number,
  fallback: number,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
): number {
  const safeFallback = finiteNumber(fallback, 0);
  const safeMin = Number.isFinite(min) ? min : Number.NEGATIVE_INFINITY;
  const safeMax = Number.isFinite(max) ? max : Number.POSITIVE_INFINITY;
  const safeValue = finiteNumber(value, safeFallback);
  return Math.min(safeMax, Math.max(safeMin, safeValue));
}

/** Returns a finite integer, truncating fractional input and clamping it. */
export function finiteInteger(
  value: number,
  fallback: number,
  min = Number.MIN_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER,
): number {
  return Math.trunc(finiteRange(value, fallback, min, max));
}

/** Returns a finite, non-negative integer suitable for a count or index. */
export function finiteCount(value: number, fallback = 0, max = Number.MAX_SAFE_INTEGER): number {
  return finiteInteger(value, Math.max(0, fallback), 0, max);
}

/** Returns a finite timer duration, capped at the browser timer ceiling. */
export function finiteDuration(
  value: number,
  fallback: number,
  min = 0,
  max = MAX_TIMEOUT_MS,
): number {
  return finiteRange(value, fallback, min, Math.min(max, MAX_TIMEOUT_MS));
}

/** Whether `key` is one of the four arrow keys. */
export function isArrowKey(key: string): boolean {
  return key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowLeft' || key === 'ArrowDown';
}

/** Keys a slider-style control's onKeyDown acts on and onKeyUp commits after
 *  — arrow keys plus the WAI-ARIA APG slider pattern's Home/End/PageUp/
 *  PageDown shortcuts. */
export function isSliderKey(key: string): boolean {
  return isArrowKey(key) || key === 'Home' || key === 'End' || key === 'PageUp' || key === 'PageDown';
}

/** Number of decimal places implied by `n`, including exponent notation.
 *  `0.1` -> 1, `5` -> 0, and `1e-7` -> 7. Used to round a stepped value back
 *  to the precision `n` itself implies, instead of leaving binary
 *  floating-point noise in place. */
export function decimalPlaces(n: number): number {
  if (!Number.isFinite(n) || n === 0) return 0;
  // safe: toExponential() always yields `<mantissa>e<exp>`, so split()'s index 0
  // (mantissa) is always present; the `= ''` default never actually fires.
  const [mantissa = '', exponentText] = n.toExponential().split('e');
  const mantissaPlaces = mantissa.includes('.') ? mantissa.length - mantissa.indexOf('.') - 1 : 0;
  return Math.max(0, mantissaPlaces - Number(exponentText));
}
