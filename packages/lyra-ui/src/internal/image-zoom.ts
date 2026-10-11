import { finiteRange } from './numbers.js';

/** Resolves the image scale against the same finite limits used by the pan/zoom frame. */
export function normalizeImageZoom(zoom: number, minZoom: number, maxZoom: number): number {
  const min = finiteRange(minZoom, 0.5, 0.01, 1000);
  const max = finiteRange(maxZoom, 4, min, 1000);
  return finiteRange(zoom, 1, min, max);
}
