import { finiteInteger } from '../../../internal/numbers.js';

export const DEFAULT_BUCKET_COUNT = 5;

/** Maximum visually distinct bucket steps on an 8-bit RGB channel. */
export const MAX_BUCKET_COUNT = 256;
/** Maximum canonical matrix cells. */
export const MAX_HEATMAP_CELLS = 10_000;
/** Maximum caller-supplied legend or annotation entries. */
export const MAX_HEATMAP_DECORATIONS = 256;
/** Maximum simultaneously exposed accessible cells. */
export const MAX_ACCESSIBLE_HEATMAP_CELLS = 400;

/** Clamps a bucket count to the renderable range. */
export function normalizeBucketCount(bucketCount: number): number {
  return finiteInteger(bucketCount, DEFAULT_BUCKET_COUNT, 2, MAX_BUCKET_COUNT);
}
