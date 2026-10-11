import { decimalPlaces, finiteNumber, finiteRange } from './numbers.js';

/**
 * Snaps a finite value to a low-end-anchored step grid, then applies the
 * finite inclusive range clamp. The final clamp deliberately follows the
 * snap so a non-grid endpoint remains reachable.
 */
export function clampSteppedValue(raw: number, min: number, max: number, step: number): number {
  const safeMin = finiteNumber(min, 0);
  const safeMax = finiteNumber(max, safeMin);
  const lo = Math.min(safeMin, safeMax);
  const hi = Math.max(safeMin, safeMax);
  const safeRaw = finiteNumber(raw, lo);
  const safeStep = finiteRange(step, 0, 0);

  // A range endpoint remains a valid terminal value even when it is not an
  // exact member of the step grid. This also keeps normalization idempotent
  // when a final clamp has already reached that endpoint.
  if (safeRaw === lo || safeRaw === hi) return safeRaw;

  // A step below the local floating-point resolution cannot stay on a stable
  // grid through another normalization, so retain the finite clamped value.
  const resolutionFloor =
    Number.EPSILON * Math.max(Math.abs(lo), Math.abs(safeRaw), safeStep) * 4;
  if (safeStep <= resolutionFloor) return finiteRange(safeRaw, lo, lo, hi);

  let stepped = safeRaw;

  if (safeStep > 0) {
    const offset = safeRaw - lo;
    // Opposite-signed finite values can overflow their difference. Divide each endpoint first
    // in that case; the resolution guard above keeps these quotients representable.
    const stepsFromLo = Math.round(Number.isFinite(offset)
      ? offset / safeStep
      : safeRaw / safeStep - lo / safeStep);
    if (Number.isFinite(stepsFromLo)) {
      let candidate = lo + stepsFromLo * safeStep;
      // The step product can overflow before an opposite-signed anchor brings it back into
      // range. Combine in step units first, and clamp a result beyond finite bounds afterward.
      if (!Number.isFinite(candidate)) candidate = (lo / safeStep + stepsFromLo) * safeStep;
      if (!Number.isNaN(candidate)) {
        stepped = Math.min(hi, Math.max(lo, candidate));
        // The grid starts at `lo`, not at absolute zero. Preserve every
        // decimal place needed by either term so a fractional anchor such as
        // 0.5 with a whole-number step remains 0.5 rather than rounding to 1.
        const precision = Math.max(decimalPlaces(lo), decimalPlaces(safeStep));
        // A clamped terminal endpoint need not belong to the grid's decimal precision.
        if (candidate === stepped && precision <= 15) {
          const factor = 10 ** precision;
          const rounded = Math.round(stepped * factor);
          if (Number.isSafeInteger(rounded)) stepped = rounded / factor;
        }
      }
    }
  }

  return finiteRange(stepped, lo, lo, hi);
}
