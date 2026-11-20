import type { PreparedChartModel } from './chart-prepared-data.js';

/** The complete proposed or committed legend visibility snapshot for a chart dataset. */
export interface LyraChartLegendVisibilityChangeDetail {
  /** Zero-based dataset index operated by the legend button. */
  readonly datasetIndex: number;
  /** Proposed or committed visibility of `datasetIndex`. */
  readonly visible: boolean;
  /** Canonical complete list of hidden zero-based dataset indexes. */
  readonly hiddenDatasets: readonly number[];
}

/** Complete category visibility proposal or committed snapshot for radial charts. */
export interface LyraChartDatumVisibilityChangeDetail {
  /** Zero-based source category index, shared by every dataset/ring. */
  readonly index: number;
  /** Proposed or committed visibility of this category. */
  readonly visible: boolean;
  /** Complete canonical list of hidden source category indexes. */
  readonly hiddenDatums: readonly number[];
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

/**
 * Computes the visibility a legend toggle would produce and asks the host to accept it. Returns
 * `undefined` when a listener vetoed it or `stale()` reports that the plot or its data changed
 * while the request was dispatched.
 */
export function proposeLegendToggle(
  index: number,
  hidden: readonly number[],
  request: (detail: LyraChartLegendVisibilityChangeDetail) => { readonly defaultPrevented: boolean },
  stale: () => boolean,
): { visible: boolean; nextHidden: number[] } | undefined {
  const wasHidden = hidden.includes(index);
  const nextHidden = wasHidden
    ? hidden.filter((candidate) => candidate !== index)
    : [...hidden, index].sort((left, right) => left - right);
  // A currently hidden series becomes visible; a currently visible one becomes hidden.
  const visible = wasHidden;
  const proposed = request(legendVisibilityDetail(index, visible, nextHidden));
  return proposed.defaultPrevented || stale() ? undefined : { visible, nextHidden };
}

/**
 * Emits the prepared-source selection event for one activated mark. Returns whether the mark
 * resolved to a prepared observation and an event was emitted.
 */
export function emitPreparedSourceSelection(
  emit: (name: 'lr-source-point-select' | 'lr-source-category-select', detail: never) => unknown,
  model: PreparedChartModel | undefined,
  datasetIndex: number,
  index: number,
): boolean {
  const series = model?.series[datasetIndex];
  if (!model || !series) return false;
  if (model.kind === 'series') {
    const point = series.samples[index];
    if (!point) return false;
    emit('lr-source-point-select', { revision: model.revision, seriesId: series.id, sourceIndex: point.sourceIndex, point: Object.freeze({ x: point.x, y: point.y }) } as never);
    return true;
  }
  const categoryId = model.categoryIds[index], value = series.values[index];
  if (categoryId === undefined || value === undefined) return false;
  emit('lr-source-category-select', { revision: model.revision, seriesId: series.id, categoryId, value, observationCount: model.categoryCounts[index]! } as never);
  return true;
}
