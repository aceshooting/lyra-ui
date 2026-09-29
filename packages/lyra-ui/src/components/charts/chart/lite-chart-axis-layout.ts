import { finiteCount, finiteRange } from '../../../internal/numbers.js';

export type CategoryLabelGrowth = 'middle' | 'left' | 'right';
export type CategoryLabelMax = number | 'auto' | undefined | null;

export interface CategoryLabelSelectionBounds {
  readonly characterWidth: number;
  readonly laneInset: number;
  readonly maxContentWidth: number;
  readonly maxRenderedRecords: number;
}

/** Whether a category tick's resolved text paints anything. */
export function hasCategoryLabelText(label: string | null | undefined): boolean {
  return (label ?? '').trim() !== '';
}

/** Visual side a category label grows toward from its tick. */
export function categoryLabelGrowth(index: number, count: number): CategoryLabelGrowth {
  if (count <= 1) return 'middle';
  if (index === 0) return 'right';
  return index === count - 1 ? 'left' : 'middle';
}

/**
 * Selects category-label positions using the labels' anchored extents. Positions are finite and
 * non-decreasing; `undefined` keeps every position and `null` asks the caller to use width-only
 * selection because the supplied order cannot describe adjacent labels.
 */
function anchorAwareCategoryLabelPicks(
  positions: readonly number[],
  width: number,
  gap: number,
  firstGrowth: CategoryLabelGrowth,
  lastGrowth: CategoryLabelGrowth,
): number[] | undefined {
  const count = positions.length;
  if (count <= 2) return undefined;
  const last = count - 1;
  const leftEdge = (candidate: number): number => {
    const growth = candidate === 0 ? firstGrowth : candidate === last ? lastGrowth : 'middle';
    const x = positions[candidate]!;
    return growth === 'right' ? x : growth === 'left' ? x - width : x - width / 2;
  };
  const clears = (before: number, after: number): boolean =>
    leftEdge(after) - (leftEdge(before) + width) >= gap - 1e-6;
  let everyCandidateFits = true;
  for (let candidate = 1; candidate < count && everyCandidateFits; candidate++) {
    everyCandidateFits = clears(candidate - 1, candidate);
  }
  if (everyCandidateFits) return undefined;

  const firstCenter = leftEdge(0) + width / 2;
  const span = leftEdge(last) + width / 2 - firstCenter;
  const densest = Math.min(last, Math.floor(span / (width + gap) + 1e-9) + 1);
  for (let labels = densest; labels > 2; labels--) {
    const picks = [0];
    let candidate = 1;
    let fits = true;
    for (let slot = 1; slot < labels - 1 && fits; slot++) {
      const center = firstCenter + (slot * span) / (labels - 1);
      const latest = last - (labels - 1 - slot);
      while (
        candidate < latest &&
        Math.abs(positions[candidate + 1]! - center) <= Math.abs(positions[candidate]! - center)
      ) candidate++;
      fits = clears(picks[picks.length - 1]!, candidate);
      picks.push(candidate++);
    }
    if (fits && clears(picks[picks.length - 1]!, last)) return [...picks, last];
  }
  return [0, last];
}

/** Computes the largest deterministic per-character estimate among sampled labels. */
export function widestEstimatedCategoryLabel(
  labels: readonly string[],
  renderedIndexes: readonly number[],
  characterWidth: number,
): number {
  let widest = 0;
  for (const index of renderedIndexes) {
    widest = Math.max(widest, (labels[index] ?? '').length * characterWidth);
  }
  return widest;
}

/** Width-only automatic cap for non-monotonic tick positions. */
function automaticMaxCategoryLabels(
  count: number,
  plotWidth: number,
  renderedIndexes: readonly number[],
  labels: readonly string[],
  bounds: Pick<CategoryLabelSelectionBounds, 'characterWidth' | 'laneInset' | 'maxContentWidth'>,
  estimatedWidth?: number,
): number {
  if (count <= 1) return count;
  const widest = estimatedWidth ?? widestEstimatedCategoryLabel(labels, renderedIndexes, bounds.characterWidth);
  if (widest === 0) return count;
  const lane = widest + bounds.laneInset;
  const fits = Math.floor(finiteRange(plotWidth, 0, 0, bounds.maxContentWidth) / lane);
  return Math.min(count, Math.max(2, fits));
}

/** Automatic selection against sampled tick coordinates; returns null for unsorted positions. */
export function automaticCategoryLabelIndexes(
  count: number,
  renderedIndexes: readonly number[],
  positions: readonly number[],
  labels: readonly string[],
  bounds: Pick<CategoryLabelSelectionBounds, 'characterWidth' | 'laneInset'>,
  estimatedWidth?: number,
): Set<number> | undefined | null {
  if (count <= 1) return undefined;
  const widest = estimatedWidth ?? widestEstimatedCategoryLabel(labels, renderedIndexes, bounds.characterWidth);
  if (widest === 0) return undefined;
  for (let candidate = 1; candidate < positions.length; candidate++) {
    if (!(positions[candidate]! >= positions[candidate - 1]!)) return null;
  }
  const picks = anchorAwareCategoryLabelPicks(
    positions,
    widest,
    bounds.laneInset,
    categoryLabelGrowth(renderedIndexes[0]!, count),
    categoryLabelGrowth(renderedIndexes[renderedIndexes.length - 1]!, count),
  );
  return picks && new Set(picks.map((candidate) => renderedIndexes[candidate]!));
}

/** Pure selection contract used by LiteChart's class wrapper and direct boundary tests. */
export function visibleCategoryLabelIndexes(
  count: number,
  plotWidth: number,
  renderedIndexes: readonly number[],
  labels: readonly string[],
  maxLabels: CategoryLabelMax,
  positions: readonly number[] | undefined,
  bounds: CategoryLabelSelectionBounds,
  estimatedWidth?: number,
): Set<number> | undefined {
  if (maxLabels == null) return undefined;
  let requested: CategoryLabelMax = maxLabels;
  if (maxLabels === 'auto') {
    const widest = count > 1
      ? estimatedWidth ?? widestEstimatedCategoryLabel(labels, renderedIndexes, bounds.characterWidth)
      : 0;
    if (widest === 0) return undefined;
    if (positions) {
      const automatic = automaticCategoryLabelIndexes(count, renderedIndexes, positions, labels, bounds, widest);
      if (automatic !== null) return automatic;
    }
    requested = automaticMaxCategoryLabels(count, plotWidth, renderedIndexes, labels, bounds, widest);
  }
  if (typeof requested !== 'number') return undefined;
  const max = finiteCount(requested, count);
  if (count <= max) return undefined;
  const renderedCount = renderedIndexes.length;
  const selectedCount = Math.min(
    renderedCount,
    bounds.maxRenderedRecords,
    Math.max(2, max),
  );
  if (selectedCount <= 1) return new Set(selectedCount === 1 ? [renderedIndexes[0]!] : []);
  return new Set(
    Array.from({ length: selectedCount }, (_, index) =>
      renderedIndexes[Math.round((index * (renderedCount - 1)) / (selectedCount - 1))]!,
    ),
  );
}

/** Pre-layout extent estimate for a sparse label with one or more blank neighboring slots. */
export function sparseCategoryLabelExtent(
  labels: readonly string[],
  xs: readonly number[],
  position: number,
  grow: CategoryLabelGrowth,
  pitch: number,
  width: number,
  margin: number,
  maxContentWidth: number,
): number {
  if (!hasCategoryLabelText(labels[position])) return width;
  const emptyBefore = position > 0 && !hasCategoryLabelText(labels[position - 1]);
  const emptyAfter = position < labels.length - 1 && !hasCategoryLabelText(labels[position + 1]);
  if (!emptyBefore && !emptyAfter) return width;
  const x = xs[position]!;
  const halfToward = (step: -1 | 1): number => {
    let outermost = -1;
    for (let index = position + step; index >= 0 && index < labels.length; index += step) {
      if (hasCategoryLabelText(labels[index])) return Math.abs(x - xs[index]!) / 2;
      outermost = index;
    }
    return outermost < 0 ? Number.POSITIVE_INFINITY : Math.abs(x - xs[outermost]!) + pitch / 2;
  };
  const extent = grow === 'middle'
    ? 2 * Math.min(halfToward(-1), halfToward(1)) - margin
    : halfToward(grow === 'right' ? 1 : -1) - margin;
  return finiteRange(Math.max(width, extent), width, width, maxContentWidth);
}
