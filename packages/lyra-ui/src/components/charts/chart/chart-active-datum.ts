/** One datum of a Chart.js-shaped renderer, by its visual dataset and row position. */
export interface ChartActiveHit {
  datasetIndex: number;
  index: number;
}

interface ActiveDatumRuntime {
  getDatasetMeta?(index: number): unknown;
  isDatasetVisible(index: number): boolean;
  setActiveElements?(elements: ChartActiveHit[]): void;
  tooltip?: { setActiveElements(elements: ChartActiveHit[], position: { x: number; y: number }): void };
  render?(): void;
}

/**
 * Shows `hit` -- or, without one, nothing -- with the renderer's own hover state and tooltip, the
 * cue a pointer hover gives, so a keyboard-current datum is visible (WCAG 2.4.7). A position
 * outside the plotted sample or on a hidden dataset shows nothing. Returns whether one is shown.
 */
export function showChartActiveDatum(chart: unknown, hit?: ChartActiveHit): boolean {
  const runtime = chart as ActiveDatumRuntime;
  let hits: ChartActiveHit[] = [];
  let position = { x: 0, y: 0 };
  if (hit && hit.datasetIndex >= 0 && hit.index >= 0) {
    const meta = runtime.getDatasetMeta?.(hit.datasetIndex) as { data?: { x: number; y: number }[] } | undefined;
    const element = meta?.data?.[hit.index];
    if (element && runtime.isDatasetVisible(hit.datasetIndex) && Number.isFinite(element.x + element.y)) {
      hits = [hit];
      position = { x: element.x, y: element.y };
    }
  }
  try {
    runtime.setActiveElements?.(hits);
    runtime.tooltip?.setActiveElements(hits, position);
    runtime.render?.();
  } catch {
    // A peer/plugin-owned capability must not interrupt keyboard navigation.
  }
  return hits.length > 0;
}
