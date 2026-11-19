/**
 * Nice-numbers step (1/2/5 x 10^n, Heckbert) giving roughly `targetTicks` ticks across `range`.
 * A non-positive or non-finite range yields `1`.
 */
export function niceStep(range: number, targetTicks: number): number {
  if (!Number.isFinite(range) || range <= 0) return 1;
  const rough = range / Math.max(1, Number.isFinite(targetTicks) ? targetTicks : 1);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const residual = rough / magnitude;
  const nice = residual < 1.5 ? 1 : residual < 3 ? 2 : residual < 7 ? 5 : 10;
  return nice * magnitude;
}

/** Hard ceiling on the tick count, so a pathological range can never run the loop away. */
const DEFAULT_TICK_CAP = 64;

/**
 * Ascending multiples of `step` covering `[min, max]` (endpoints given in either order). The loop
 * is index based and capped at `cap` ticks: additive stepping stops making progress near
 * `Number.MAX_VALUE` and would hang a render. A degenerate step or range returns `[min, max]`
 * (deduplicated) so the axis still has its ends.
 */
export function boundedTicks(min: number, max: number, step: number, cap = DEFAULT_TICK_CAP): number[] {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [];
  const ends = lo === hi ? [lo] : [lo, hi];
  if (!Number.isFinite(step) || step <= 0) return ends;
  const first = Math.ceil(lo / step) * step;
  if (!Number.isFinite(first)) return ends;
  const limit = Math.max(1, Math.floor(Number.isFinite(cap) ? cap : DEFAULT_TICK_CAP));
  const ticks: number[] = [];
  for (let index = 0; index < limit; index++) {
    const value = first + index * step;
    if (!Number.isFinite(value) || value > hi + step / 2) break;
    const rounded = Math.round(value / step) * step;
    if (Number.isFinite(rounded) && (ticks.length === 0 || rounded > ticks[ticks.length - 1]!)) {
      ticks.push(rounded);
    }
  }
  return ticks.length === 0 ? ends : ticks;
}
