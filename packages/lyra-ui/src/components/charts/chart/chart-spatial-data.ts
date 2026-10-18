import type { LyraSpatialBin, LyraSpatialChartPoint, LyraSpatialChartSeries } from '../../../utilities/data-spatial.js';
import { escapeCsvField } from '../../utility/export-button/csv.js';

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
    rows.push([
      'point', point.seriesId, labels.get(point.seriesId), point.id,
      numeric(point.sourceIndex, point, 'sourceIndex'), point.label,
      numeric(point.x, point, 'x'), numeric(point.y, point, 'y'),
      point.radius === undefined ? '' : numeric(point.radius, point, 'radius'), '', '', '', '', '',
    ].map(escapeCsvField).join(','));
  }
  for (const bin of bins) {
    rows.push([
      'bin', '', '', '', '', '', '', '', '',
      numeric(bin.bounds.minX, bin, 'minX'), numeric(bin.bounds.maxX, bin, 'maxX'),
      numeric(bin.bounds.minY, bin, 'minY'), numeric(bin.bounds.maxY, bin, 'maxY'),
      numeric(bin.count, bin, 'count'),
    ].map(escapeCsvField).join(','));
  }
  return rows.join('\r\n');
}
