import type { LyraSpatialBin, LyraSpatialChartPoint } from '../../../utilities/data-spatial.js';

/**
 * The index a chart's canvas keyboard moves to from `index` among `length` items: the inline arrow
 * after it (mirrored under RTL) or ArrowDown steps forward, the other inline arrow or ArrowUp steps
 * back, Home and End jump to the ends. Clamped at the ends; `undefined` for any other key.
 */
export function chartKeyboardStep(key: string, rtl: boolean, index: number, length: number): number | undefined {
  if (key === (rtl ? 'ArrowLeft' : 'ArrowRight') || key === 'ArrowDown') return Math.min(length - 1, index + 1);
  if (key === (rtl ? 'ArrowRight' : 'ArrowLeft') || key === 'ArrowUp') return Math.max(0, index - 1);
  if (key === 'Home') return 0;
  if (key === 'End') return length - 1;
  return undefined;
}

/** The spatial keyboard order: the visible points of every shown series, then every density bin. */
export function spatialKeyboardItems(groups: readonly (readonly LyraSpatialChartPoint[])[], hidden: readonly number[],
  bins: readonly LyraSpatialBin[]): readonly (LyraSpatialChartPoint | LyraSpatialBin)[] {
  return [...groups.flatMap((points, index) => hidden.includes(index) ? [] : points), ...bins];
}

/** The density bin whose painted rectangle contains `(x, y)`; a zero-size edge gets 2px of slop. */
export function spatialBinAt(bins: readonly LyraSpatialBin[], x: number, y: number,
  toPixel: (x: number, y: number) => { x: number; y: number }): LyraSpatialBin | undefined {
  return bins.find(bin => {
    const a = toPixel(bin.bounds.minX, bin.bounds.maxY), b = toPixel(bin.bounds.maxX, bin.bounds.minY);
    return x >= Math.min(a.x, b.x) - (a.x === b.x ? 2 : 0) && x <= Math.max(a.x, b.x) + (a.x === b.x ? 2 : 0) &&
      y >= a.y - (a.y === b.y ? 2 : 0) && y <= b.y + (a.y === b.y ? 2 : 0);
  });
}
