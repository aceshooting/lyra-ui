/** The complete proposed or committed legend visibility snapshot for a chart dataset. */
export interface LyraChartLegendVisibilityChangeDetail {
  /** Zero-based dataset index operated by the legend button. */
  readonly datasetIndex: number;
  /** Proposed or committed visibility of `datasetIndex`. */
  readonly visible: boolean;
  /** Canonical complete list of hidden zero-based dataset indexes. */
  readonly hiddenDatasets: readonly number[];
}

/**
 * Returns a stable, bounded visibility snapshot. A defined empty array deliberately means every
 * dataset is visible; `undefined` is left distinct so component configuration can supply its
 * documented `dataset.hidden` default instead.
 */
export function normalizeHiddenDatasets(
  hiddenDatasets: readonly number[] | undefined,
  datasetCount: number,
): number[] | undefined {
  if (hiddenDatasets === undefined) return undefined;
  const count = Number.isFinite(datasetCount) ? Math.max(0, Math.floor(datasetCount)) : 0;
  if (!Array.isArray(hiddenDatasets)) return [];
  return [...new Set(
    hiddenDatasets.filter(
      (index): index is number => Number.isInteger(index) && index >= 0 && index < count,
    ),
  )].sort((left, right) => left - right);
}

/** Clones a canonical event detail so a listener cannot mutate the component's controlled state. */
export function legendVisibilityDetail(
  datasetIndex: number,
  visible: boolean,
  hiddenDatasets: readonly number[],
): LyraChartLegendVisibilityChangeDetail {
  return {
    datasetIndex,
    visible,
    hiddenDatasets: [...hiddenDatasets],
  };
}
