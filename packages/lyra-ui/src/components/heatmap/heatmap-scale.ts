/** Maps `value` in `[lo, hi]` to a 0.1-1.0 alpha so the lowest real value still reads as faintly present rather than invisible. */
export function linearAlpha(value: number, lo: number, hi: number): number {
  const span = hi - lo || 1;
  const t = (value - lo) / span;
  return 0.1 + 0.9 * Math.min(1, Math.max(0, t));
}

/**
 * Computes `[min, max]` of `values` via a linear scan, or `null` for an
 * empty array. Deliberately not `Math.min(...values)`/`Math.max(...values)`
 * — spreading a large array as call arguments throws `RangeError: Maximum
 * call stack size exceeded` once the engine's argument-list limit is
 * exceeded (verified at ~150k+ elements).
 */
export function minMax(values: number[]): [number, number] | null {
  if (values.length === 0) return null;
  let lo = values[0]!;
  let hi = values[0]!;
  for (let i = 1; i < values.length; i++) {
    const v = values[i]!;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return [lo, hi];
}

/**
 * Square-root-scaled bucket index in `[0, steps-1]`, or `-1` for no-data.
 * Compresses large counts so a single heavy cell doesn't wash out the rest
 * of a sequential color ramp.
 *
 * Only a negative `count` means "no data" here — the true no-data sentinel
 * (`v < 0 || !Number.isFinite(v)`) is already filtered out by the caller
 * (`drawMatrix()`) before `sqrtStep` is ever invoked, so a real `count === 0`
 * (e.g. "zero events that day") reaches this function and must bucket to the
 * lowest ramp step like any other legitimate value, not render as no-data.
 * Likewise, `max <= 0` means every real value in the dataset is zero (a
 * legitimate "zero events everywhere" dataset, not an absence of data) — the
 * whole range collapses to a single point, so `count` (itself necessarily 0)
 * buckets to the lowest step rather than being misread as no-data.
 */
export function sqrtStep(count: number, max: number, steps: number): number {
  if (count < 0) return -1;
  if (max <= 0) return 0;
  const ratio = Math.sqrt(count) / Math.sqrt(max);
  return Math.min(steps - 1, Math.floor(ratio * steps));
}
