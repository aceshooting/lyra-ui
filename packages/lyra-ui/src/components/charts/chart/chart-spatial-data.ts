import type { LyraChartInstance } from './chart-types.js';
import type { SpatialSourceController } from '../../../internal/spatial-source-controller.js';
export { SpatialSourceController, spatialContains } from '../../../internal/spatial-source-controller.js';
import type { LyraSpatialBounds, LyraSpatialBin, LyraSpatialChartPoint, LyraSpatialChartSeries } from '../../../utilities/data-spatial.js';
import { csvRow } from '../../../internal/csv.js';

/** Resolve an exact visible point against the same source that accepted the lookup. */
export async function revealSpatialViewport(
  spatial: SpatialSourceController,
  id: string,
  current: () => boolean,
  hidden: () => readonly number[] | undefined,
): Promise<LyraSpatialBounds | null | undefined> {
  if (!current() || spatial.error) return undefined;
  const point = await spatial.reveal(id);
  if (!point || !current()) return undefined;
  const series = spatial.binding!.chart!.series.findIndex(series => series.id === point.seriesId);
  return hidden()?.includes(series) ? undefined : spatial.panTo(point);
}

function domain(min: number, max: number): void {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
    throw new RangeError('Invalid spatial coordinate domain.');
  }
}

/** Maps an admitted original coordinate onto the private unit axis without overflowing its span. */
export function spatialCoordinate(value: number, min: number, max: number): number {
  domain(min, max);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError('Spatial coordinate is outside its domain.');
  }
  if (min === max) return 0.5;
  if (value === min) return 0;
  if (value === max) return 1;
  const span = max - min;
  return Number.isFinite(span)
    ? (value - min) / span
    : (value / 2 - min / 2) / (max / 2 - min / 2);
}

/** Restores original coordinate units for ticks and viewport requests. */
export function spatialOriginal(normalized: number, min: number, max: number): number {
  domain(min, max);
  if (!Number.isFinite(normalized) || normalized < 0 || normalized > 1) {
    throw new RangeError('Invalid normalized spatial coordinate.');
  }
  if (min === max || normalized === 0) return min;
  if (normalized === 1) return max;
  const span = max - min;
  const midpoint = min / 2 + max / 2;
  const original = Number.isFinite(span)
    ? min + normalized * span
    : normalized <= 0.5
      ? min * (1 - normalized * 2) + midpoint * (normalized * 2)
      : midpoint * (2 - normalized * 2) + max * (normalized * 2 - 1);
  if (!Number.isFinite(original)) throw new RangeError('Unrepresentable spatial coordinate.');
  return Math.max(min, Math.min(max, original));
}

/** Limits renderer work to the plot diagonal while preserving the caller's semantic radius. */
export function spatialPaintRadius(radius: number, width: number, height: number): number {
  if (![radius, width, height].every(value => Number.isFinite(value) && value >= 0)) {
    throw new RangeError('Invalid spatial paint dimensions.');
  }
  return Math.min(radius, Math.min(Number.MAX_VALUE, Math.hypot(width, height)));
}

type SpatialCsvNumericColumn = 'sourceIndex' | 'x' | 'y' | 'radius' | 'minX' | 'maxX' | 'minY' | 'maxY' | 'count';
export type SpatialCsvNumericFormatter = (
  value: number,
  record: LyraSpatialChartPoint | LyraSpatialBin,
  column: SpatialCsvNumericColumn,
) => string | undefined;

/** Exports only accepted bounded snapshots, with density counts separate from point overlays. */
export function spatialCsv(
  series: readonly LyraSpatialChartSeries[],
  points: readonly LyraSpatialChartPoint[],
  bins: readonly LyraSpatialBin[],
  format?: SpatialCsvNumericFormatter,
): string {
  if (series.length > 1000 || points.length + bins.length > 1000) {
    throw new RangeError('Spatial export exceeds its record budget.');
  }
  const labels = new Map(series.map(entry => [entry.id, entry.label]));
  const rows = ['kind,seriesId,seriesLabel,id,sourceIndex,label,x,y,radius,minX,maxX,minY,maxY,count'];
  const numeric = (value: number, record: LyraSpatialChartPoint | LyraSpatialBin, column: SpatialCsvNumericColumn) =>
    format?.(value, record, column) ?? value;
  for (const point of points) {
    rows.push(csvRow([
      'point', point.seriesId, labels.get(point.seriesId), point.id,
      numeric(point.sourceIndex, point, 'sourceIndex'), point.label,
      numeric(point.x, point, 'x'), numeric(point.y, point, 'y'),
      point.radius === undefined ? '' : numeric(point.radius, point, 'radius'), '', '', '', '', '',
    ]));
  }
  for (const bin of bins) {
    rows.push(csvRow([
      'bin', '', '', '', '', '', '', '', '',
      numeric(bin.bounds.minX, bin, 'minX'), numeric(bin.bounds.maxX, bin, 'maxX'),
      numeric(bin.bounds.minY, bin, 'minY'), numeric(bin.bounds.maxY, bin, 'maxY'),
      numeric(bin.count, bin, 'count'),
    ]));
  }
  return rows.join('\r\n');
}

interface SpatialDensityOptions {
  current(): boolean;
  bubble: boolean;
  color: string;
  matchedCount: number;
  groups: readonly (readonly LyraSpatialChartPoint[])[];
  bins: readonly LyraSpatialBin[];
  toPixel(chart: LyraChartInstance, x: number, y: number): { x: number; y: number };
  focused(): boolean;
  items(): readonly (LyraSpatialChartPoint | LyraSpatialBin)[];
  index(): number;
  focusColor(): string;
  focusWidth(): number;
}

export function spatialDensityPlugin(options: SpatialDensityOptions) {
  const { current, groups, bins, toPixel } = options;
  return {
    id: 'lyra-spatial-density',
    beforeDatasetsUpdate: (chart: LyraChartInstance) => {
      if (!current() || !options.bubble || !chart.chartArea) return;
      chart.data.datasets.forEach((dataset, index) => dataset.data?.forEach((raw, pointIndex) => {
        const point = groups[index]?.[pointIndex];
        if (point && raw && typeof raw === 'object') Reflect.set(raw, 'r', spatialPaintRadius(point.radius!, chart.chartArea!.width, chart.chartArea!.height));
      }));
    },
    afterDatasetsDraw: (chart: LyraChartInstance & { ctx: CanvasRenderingContext2D }) => {
      if (!options.focused() || !current() || !chart.chartArea) return;
      const items = options.items();
      const item = items[Math.min(options.index(), items.length - 1)];
      if (!item) return;
      const ctx = chart.ctx;
      ctx.save();
      ctx.strokeStyle = options.focusColor();
      ctx.lineWidth = options.focusWidth();
      if ('id' in item) {
        const point = toPixel(chart, item.x, item.y);
        ctx.beginPath();
        ctx.arc(point.x, point.y, 6 + ctx.lineWidth, 0, 2 * Math.PI);
        ctx.stroke();
      } else {
        const a = toPixel(chart, item.bounds.minX, item.bounds.maxY);
        const b = toPixel(chart, item.bounds.maxX, item.bounds.minY);
        ctx.strokeRect(Math.min(a.x, b.x), a.y, Math.max(2, Math.abs(b.x - a.x)), Math.max(2, b.y - a.y));
      }
      ctx.restore();
    },
    beforeDatasetsDraw: (chart: LyraChartInstance & { ctx: CanvasRenderingContext2D }) => {
      if (!current() || !chart.chartArea) return;
      const context = chart.ctx, area = chart.chartArea;
      context.save(); context.beginPath(); context.rect(area.left, area.top, area.width, area.height); context.clip();
      context.fillStyle = options.color; context.strokeStyle = options.color;
      for (const bin of bins) {
        const a = toPixel(chart, bin.bounds.minX, bin.bounds.maxY), b = toPixel(chart, bin.bounds.maxX, bin.bounds.minY);
        context.globalAlpha = 0.15 + 0.65 * bin.count / Math.max(1, options.matchedCount);
        if (a.x === b.x && a.y === b.y) context.fillRect(a.x - 0.5, a.y - 0.5, 1, 1);
        else if (a.x === b.x || a.y === b.y) { context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.stroke(); }
        else context.fillRect(Math.min(a.x, b.x), a.y, Math.abs(b.x - a.x), b.y - a.y);
      }
      context.restore();
    },
  };
}
