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
