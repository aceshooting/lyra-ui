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
  const minimumRows = endpointSampleMinimum(rowCount);
  const minimumSeries = endpointSampleMinimum(seriesCount);
  const sourceAspect = Math.log(rowCount / seriesCount);
  let best: ChartTableSampleCounts = { rows: minimumRows, series: minimumSeries };
  let bestAspectError = Number.POSITIVE_INFINITY;
  let bestCellCount = 0;

  for (
    let series = minimumSeries;
    series <= Math.min(seriesCount, MAX_RENDERED_CHART_RECORDS);
    series++
  ) {
    // Divide the fixed cap by the bounded candidate before choosing rows. This avoids evaluating
    // the untrusted source-dimension product while proving the bounded product below is safe.
    const rows = Math.min(rowCount, Math.floor(MAX_RENDERED_CHART_RECORDS / series));
    if (rows < minimumRows) continue;

    const aspectError = Math.abs(Math.log(rows / series) - sourceAspect);
    const cellCount = rows * series;
    if (
      aspectError < bestAspectError ||
      (aspectError === bestAspectError && cellCount > bestCellCount)
    ) {
      best = { rows, series };
      bestAspectError = aspectError;
      bestCellCount = cellCount;
    }
  }

  return best;
}

/**
 * Selects evenly distributed chart-table row and series indexes within the fixed rendering budget.
 *
 * Both endpoints remain represented for any source axis with two or more entries. The planner
 * selects the attainable pair closest to the source aspect ratio, then favors the pair using more
 * of the bounded cell budget. It never evaluates `rowCount * seriesCount` for source dimensions.
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
