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

function sampleCounts(rowCount: number, seriesCount: number): ChartTableSampleCounts {
  // Series are never thinned below the budget that still leaves both row endpoints; rows absorb the cap.
  const series = Math.min(seriesCount, Math.floor(MAX_RENDERED_CHART_RECORDS / endpointSampleMinimum(rowCount)));
  const rows = Math.min(rowCount, Math.floor(MAX_RENDERED_CHART_RECORDS / series));
  return { rows, series };
}

/**
 * Selects evenly distributed chart-table row and series indexes within the fixed rendering budget.
 *
 * Every series is kept unless there are too many to leave two rows each; rows are thinned to first,
 * last and evenly spaced entries. It never evaluates `rowCount * seriesCount` for source dimensions.
 */
export function sampleChartTableIndexes(
  rowCount: number,
  seriesCount: number,
): { readonly rowIndexes: readonly number[]; readonly seriesIndexes: readonly number[] } {
  const rows = finiteCount(rowCount, 0);
  const series = finiteCount(seriesCount, 0);

  if (rows === 0 || series === 0) {
    return {
      rowIndexes: evenlySpacedIndexes(rows, Math.min(rows, MAX_RENDERED_CHART_RECORDS)),
      seriesIndexes: evenlySpacedIndexes(series, Math.min(series, MAX_RENDERED_CHART_RECORDS)),
    };
  }

  const selected = sampleCounts(rows, series);
  return {
    rowIndexes: evenlySpacedIndexes(rows, selected.rows),
    seriesIndexes: evenlySpacedIndexes(series, selected.series),
  };
}
