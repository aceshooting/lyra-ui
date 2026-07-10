/** Maps `value` in `[lo, hi]` to a 0.1–1.0 alpha, matching the cd-heatmap ramp. */
export function linearAlpha(value: number, lo: number, hi: number): number {
  const span = hi - lo || 1;
  const t = (value - lo) / span;
  return 0.1 + 0.9 * Math.min(1, Math.max(0, t));
}

/**
 * Square-root-scaled bucket index in `[0, steps-1]`, or `-1` for no-data.
 * Compresses large counts so a single heavy cell doesn't wash out the rest
 * of a sequential color ramp.
 */
export function sqrtStep(count: number, max: number, steps: number): number {
  if (count <= 0 || max <= 0) return -1;
  const ratio = Math.sqrt(count) / Math.sqrt(max);
  return Math.min(steps - 1, Math.floor(ratio * steps));
}
