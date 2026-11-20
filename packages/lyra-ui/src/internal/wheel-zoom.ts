import { finiteRange } from './numbers.js';

/** Pixels per `DOM_DELTA_LINE` step, the distance browsers scroll per reported line. */
const WHEEL_LINE_PX = 16;
/** Largest vertical delta one event contributes, so a coarse event never leaps several notches. */
const WHEEL_DELTA_LIMIT = 300;
/** The pixel delta of one mouse-wheel notch, which zooms by one keyboard zoom step. */
export const WHEEL_NOTCH_PX = 100;
const WHEEL_ZOOM_RATE = Math.log(1.2) / WHEEL_NOTCH_PX;

/**
 * The vertical delta of a wheel event in pixels, normalized across `deltaMode` (lines, pages) and
 * clamped. `0` means the event carries no vertical motion (a horizontal swipe), which a zoom
 * surface leaves to the page instead of treating as a zoom-out.
 */
export function wheelZoomDelta(event: WheelEvent, pageSize: number): number {
  const scale = event.deltaMode === 1 ? WHEEL_LINE_PX : event.deltaMode === 2 ? finiteRange(pageSize, 0, 0) : 1;
  return finiteRange(event.deltaY * scale, 0, -WHEEL_DELTA_LIMIT, WHEEL_DELTA_LIMIT);
}

/** The multiplicative zoom for a normalized wheel delta: proportional to its magnitude, so dense
 *  trackpad or pinch events zoom smoothly and one mouse notch matches one keyboard zoom step. */
export function wheelZoomFactor(delta: number): number {
  return Math.exp(-delta * WHEEL_ZOOM_RATE);
}
