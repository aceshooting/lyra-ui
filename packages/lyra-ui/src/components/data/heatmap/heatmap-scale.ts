import { finiteRatio } from '../../../internal/numbers.js';

/** Maps `value` in `[lo, hi]` to a 0.1-1.0 alpha so the lowest real value still reads as faintly present rather than invisible. */
export function linearAlpha(value: number, lo: number, hi: number): number {
  return 0.1 + 0.9 * finiteRatio(value, lo, hi);
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

/**
 * Linear (non-quantile) bucket index in `[0, steps-1]` for `value` in `[lo, hi]` — mirrors
 * `linearAlpha()`'s own min-max normalization (matrix mode's default continuous color mapping),
 * discretized into `steps` buckets instead of a continuous alpha. Used when a discrete
 * `colorSteps` ramp replaces the default continuous 2-endpoint interpolation for the `'linear'`
 * scale case (the `'sqrt'` scale already has its own discrete `sqrtStep()`).
 */
export function linearBucket(value: number, lo: number, hi: number, steps: number): number {
  const t = finiteRatio(value, lo, hi);
  return Math.min(steps - 1, Math.floor(t * steps));
}

/**
 * Normalizes `value` to `[0, 1]` around an anchored `midpoint` rather than the plain `lo`-`hi`
 * span, so a diverging ramp's neutral color lands exactly on `midpoint` instead of wherever the
 * data's own midpoint happens to fall.
 *
 * The two halves are scaled independently: `lo`->0, `midpoint`->0.5, `hi`->1. That deliberately
 * does NOT preserve a single units-per-pixel ratio across the whole range — with data running
 * -4.93 to +28.8 around a zero midpoint, an equal color distance means "equally far from
 * neutral in its own direction", which is the entire point of a diverging ramp. A caller wanting
 * a symmetric ramp passes a symmetric `domain` (e.g. `[-28.8, 28.8]`).
 *
 * Falls back to `finiteRatio`'s plain normalization when `midpoint` sits outside `[lo, hi]` or
 * any input is non-finite, so a mis-set midpoint degrades to today's behavior rather than
 * producing a a division by zero.
 */
export function midpointRatio(
  value: number,
  lo: number,
  hi: number,
  midpoint: number
): number {
  if (!Number.isFinite(value) || !Number.isFinite(midpoint)) return finiteRatio(value, lo, hi);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return finiteRatio(value, lo, hi);
  if (!(midpoint > lo) || !(midpoint < hi)) return finiteRatio(value, lo, hi);
  if (value <= lo) return 0;
  if (value >= hi) return 1;
  return value <= midpoint
    ? 0.5 * ((value - lo) / (midpoint - lo))
    : 0.5 + 0.5 * ((value - midpoint) / (hi - midpoint));
}

/** `linearAlpha`'s midpoint-anchored twin, keeping the same 0.1-1.0 floor. */
export function midpointAlpha(
  value: number,
  lo: number,
  hi: number,
  midpoint: number
): number {
  return 0.1 + 0.9 * midpointRatio(value, lo, hi, midpoint);
}

/** `linearBucket`'s midpoint-anchored twin. */
export function midpointBucket(
  value: number,
  lo: number,
  hi: number,
  midpoint: number,
  steps: number
): number {
  const t = midpointRatio(value, lo, hi, midpoint);
  return Math.min(steps - 1, Math.floor(t * steps));
}
