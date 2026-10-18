import { finiteCount } from '../../../internal/numbers.js';

/** Hard cap shared by generated chart records, SVG marks, and accessible alternatives. */
export const MAX_RENDERED_CHART_RECORDS = 1_000;

type ChartTableSampleCounts = {
  rows: number;
  series: number;
};

function endpointSampleMinimum(sourceCount: number): number {
  return sourceCount > 1 ? 2 : sourceCount;
}

function evenlySpacedIndexes(sourceCount: number, sampleCount: number): number[] {
  if (sourceCount === 0 || sampleCount === 0) return [];
  if (sampleCount === 1) return [0];

  const lastSourceIndex = sourceCount - 1;
  const lastSampleIndex = sampleCount - 1;
  return Array.from({ length: sampleCount }, (_, sampleIndex) => {
    if (sampleIndex === lastSampleIndex) return lastSourceIndex;
    return Math.min(
      lastSourceIndex,
      Math.max(0, Math.round((sampleIndex / lastSampleIndex) * lastSourceIndex)),
    );
  });
}

function sampleCounts(rowCount: number, seriesCount: number, budget: number): ChartTableSampleCounts {
  // Series are never thinned below the budget that still leaves both row endpoints; rows absorb the cap.
  const series = Math.min(seriesCount, Math.floor(budget / endpointSampleMinimum(rowCount)));
  const rows = Math.min(rowCount, Math.floor(budget / series));
  return { rows, series };
}

/**
 * Selects chart row and series indexes within the shared record and optional width budgets.
 *
 * Every series is kept unless there are too many to leave two rows each; rows are thinned to first,
 * last and evenly spaced entries, or bucket extrema when a numeric accessor is supplied. It never evaluates `rowCount * seriesCount` for source dimensions.
 */
export function sampleChartTableIndexes(
  rowCount: number,
  seriesCount: number,
  options: ChartSampleOptions = {},
): { readonly rowIndexes: readonly number[]; readonly seriesIndexes: readonly number[] } {
  const budget = normalizeChartRecordLimit(options.maxRecords);
  const rows = finiteCount(rowCount, 0);
  const series = finiteCount(seriesCount, 0);

  if (rows === 0 || series === 0) {
    return {
      rowIndexes: evenlySpacedIndexes(rows, Math.min(rows, budget)),
      seriesIndexes: evenlySpacedIndexes(series, Math.min(series, budget)),
    };
  }

  const selected = sampleCounts(rows, series, budget);
  const width = typeof options.width === 'number' && Number.isFinite(options.width) && options.width > 0
    ? Math.max(endpointSampleMinimum(rows), Math.floor(options.width)) : selected.rows;
  const rowBudget = Math.min(selected.rows, width);
  const seriesIndexes = evenlySpacedIndexes(series, selected.series);
  const rowIndexes = options.valueAt && rows > rowBudget
    ? extremaIndexes(rows, rowBudget, seriesIndexes, options.valueAt)
    : evenlySpacedIndexes(rows, rowBudget);
  return { rowIndexes, seriesIndexes };
}


export interface ChartSampleOptions {
  readonly maxRecords?: number;
  readonly width?: number;
  readonly valueAt?: (rowIndex: number, seriesIndex: number) => number | null | undefined;
}

/** Endpoint pairs require at least two records; invalid values restore the default ceiling. */
export function normalizeChartRecordLimit(value: unknown): number {
  return Math.max(2, Math.min(MAX_RENDERED_CHART_RECORDS, finiteCount(typeof value === 'number' ? value : Number.NaN, MAX_RENDERED_CHART_RECORDS)));
}

function extremaIndexes(rows: number, budget: number, series: readonly number[], valueAt: NonNullable<ChartSampleOptions['valueAt']>): number[] {
  if (budget - 2 < 2 * series.length) return evenlySpacedIndexes(rows, budget);
  const hasGaps = series.some(dataset => {
    for (let row = 1; row < rows - 1; row++) {
      const value = valueAt(row, dataset);
      if (typeof value !== 'number' || !Number.isFinite(value)) return true;
    }
    return false;
  });
  const bucketCount = Math.floor((budget - 2) / ((hasGaps ? 3 : 2) * series.length));
  if (bucketCount < 1) return evenlySpacedIndexes(rows, budget);
  const indexes = new Set([0, rows - 1]);
  for (let bucket = 0; bucket < bucketCount; bucket++) {
    const start = 1 + Math.floor(bucket * (rows - 2) / bucketCount);
    const end = 1 + Math.floor((bucket + 1) * (rows - 2) / bucketCount);
    for (const dataset of series) {
      let gap: number | undefined;
      let min = Infinity;
      let max = -Infinity;
      let minIndex = start;
      let maxIndex = start;
      for (let row = start; row < end; row++) {
        const value = valueAt(row, dataset);
        if (typeof value !== 'number' || !Number.isFinite(value)) { gap ??= row; continue; }
        if (value < min) { min = value; minIndex = row; }
        if (value >= max) { max = value; maxIndex = row; }
      }
      if (gap !== undefined) indexes.add(gap);
      indexes.add(minIndex);
      indexes.add(maxIndex);
    }
  }
  // Shared extrema can occupy the same row in several series. Fill spare positions uniformly
  // without discarding any extremum or gap selected above.
  for (const index of evenlySpacedIndexes(rows, budget)) {
    if (indexes.size >= budget) break;
    indexes.add(index);
  }
  return [...indexes].sort((a, b) => a - b);
}
