import type { ComplexAttributeConverter } from 'lit';
import { finiteRange } from '../../../internal/numbers.js';
import { literalSetConverter } from '../../../internal/converters.js';
import { isHandledOrComposingKey, shouldIgnoreNavigationKey } from '../../../internal/list-navigation.js';
import { formatRgb } from './heatmap-colors.js';
import { DEFAULT_BUCKET_COUNT, normalizeBucketCount } from './heatmap-limits.js';
import type { HeatmapMatrixData, LyraHeatmapStickyLabels } from './heatmap-model.js';

/** Floor for the matrix row-label gutter, and the width it had when it was a fixed constant.
 *  Auto-sizing only ever grows past this, so a chart with short labels keeps its old layout. */
export const PAD_LEFT = 60;
export const PAD_TOP = 20;
/** Breathing room either side of a row label inside the gutter. */
export const ROW_LABEL_INSET = 4;
/** Ceiling on the auto-sized gutter, as a fraction of the host's own width. A single pathological
 *  label must not be allowed to squeeze the cells it exists to describe down to nothing. */
export const MAX_ROW_LABEL_FRACTION = 0.4;
/** Absolute ceiling, in CSS px, on the auto-sized column band. Deliberately NOT the row gutter's
 *  fraction-of-the-host rule: the row gutter steals width from the cells, so it has to be bounded
 *  relative to them, whereas the canvas simply grows taller to fit this band (`h = padTop + rows *
 *  cellSize`) and the cells keep their size. A fraction of the host's height would also be circular
 *  here, since that height is itself driven by the canvas. This is purely a sanity stop against a
 *  pathological label. */
export const MAX_COL_LABEL_HEIGHT = 240;
/** Breathing room between a column label and the grid it sits above. */
export const COL_LABEL_INSET = 6;
/** `row-label-width`/`col-label-height` accept a CSS-px number or the literal `auto`; anything else
 *  is ignored so a typo leaves the built-in gutter rather than collapsing it to zero. */
export const labelExtentConverter: ComplexAttributeConverter<number | 'auto' | undefined> = {
  fromAttribute: (value) => {
    if (value === null) return undefined;
    const trimmed = value.trim();
    if (trimmed.toLowerCase() === 'auto') return 'auto';
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  },
  toAttribute: (value) => (value === undefined ? null : String(value)),
};

export const STICKY_LABELS = literalSetConverter<LyraHeatmapStickyLabels>(
  ['none', 'rows', 'cols', 'both'],
  'none',
);

export const FALLBACK_NO_DATA_FILL = 'rgba(128,128,128,0.25)';
/** Last-resort frozen-band backdrop for the case where the token resolves to an empty string (no
 *  stylesheet applied at all). It has to be opaque: the band covers label pixels the cell canvas
 *  painted underneath it, and a translucent backdrop would show both while scrolling. */
export const FALLBACK_STICKY_LABEL_BG = '#ffffff';
export const RAMP_STEPS = 7;
export const FALLBACK_SCALE_LO = '#cde2fb';
export const FALLBACK_SCALE_HI = '#0969da';
export const FALLBACK_LABEL_FONT = '10px system-ui, sans-serif';
/** Calendar weekday-label gutter width before it became configurable. */
export const CAL_PAD_LEFT = 28;
/** Breathing room on both sides of a weekday label inside its gutter. */
export const CAL_WEEKDAY_LABEL_INSET = 2;
export const CAL_LABEL_H = 16;
/** Calendar mode's original fixed cell size — now also the effective fallback
 *  the `cellSize` accessor uses in calendar mode when left unset (see its
 *  doc comment), so a consumer who never touches `cellSize` sees no change. */
export const CAL_CELL = 11;
export const CAL_GAP = 2;
/** Matrix mode's original fixed cell size — the effective fallback the
 *  `cellSize` accessor uses in matrix mode when left unset. */
export const DEFAULT_MATRIX_CELL_SIZE = 22;
/** Largest explicit row pitch; bounds accidental numeric outliers independently of data size. */
export const MAX_MATRIX_ROW_HEIGHT = 4096;
export const DEFAULT_ACCESSIBLE_TARGET_SIZE_PX = 40;
/**
 * Hard lower bound on a `fitToWidth`-derived cell size, in both modes. A grid squeezed below this
 * stops being a readable heatmap and starts producing degenerate geometry (sub-pixel fill rects,
 * a hit-test rounding to the wrong cell), so `minCellSize` can raise this floor but never lower it.
 */
export const FIT_MIN_CELL = 4;
/**
 * A linear RGB ramp cannot contain more than 256 visually distinct integer
 * steps on any channel. Keeping the bucket count within that bound avoids an
 * untrusted attribute/property value turning the ramp into an unbounded
 * allocation without discarding any useful color resolution.
 */
// Public limits are defined in heatmap-limits.ts so helper imports avoid the component class.
/** Total canonical matrix cells and maximum caller-supplied legend/annotation entries. */
/** Ring stroke width for both the annotation overlay and the keyboard focus ring. */
export const RING_LINE_WIDTH = 2;
export const FALLBACK_FOCUS_RING_COLOR = '#0969da';
export const FALLBACK_ANNOTATION_COLOR = '#cf222e';
export const FALLBACK_SELECTED_COLOR = '#1a7f37';
/** Colours a detached canvas would resolve against the wrong scope, so a probe element must. */
export const SCOPED_COLOR = /var\(|currentcolor|light-dark\(/i;
/** Backing-store ceilings: iOS Safari caps a canvas at 16,777,216 px, Chromium and Firefox a side near 32,767. */
export const MAX_CANVAS_DIMENSION = 16_384;
export const MAX_CANVAS_PIXELS = 16_777_216;
// policy-allow(rtl-arrow-keys): the canvas grids are deliberately non-mirrored -- drawMatrix()/
// columnXFor() always place column/week 0 at the physical left and [part='cells'] is pinned
// `direction: ltr` in heatmap.styles.ts -- so arrow keys stay physical too; see
// onMatrixKeyDown()/onCalendarKeyDown().
export const ARROW_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export function ignoresGridKey(event: KeyboardEvent): boolean {
  if (event.key === 'Home' || event.key === 'End') {
    return isHandledOrComposingKey(event) || event.altKey;
  }
  return shouldIgnoreNavigationKey(event);
}
export const GRID_KEYS = new Set([...ARROW_KEYS, 'Home', 'End']);
export const MS_PER_DAY = 86_400_000;
export const CAL_MONTH_LABEL_GAP = 2;

/**
 * Normalizes a bucket count to the safe, renderable range. Non-finite values
 * restore the public default; finite values are floored and clamped to
 * `[2, MAX_BUCKET_COUNT]`. Flooring keeps the ramp array's length in exact
 * agreement with the count used by `quartileBucket()`.
 */

/**
 * Attribute converter for the optional `max-cell-size`/`min-cell-size` clamps. Unlike Lit's default
 * `Number` converter — which turns a missing-but-present `foo=""` into `0` — anything that isn't a
 * finite number (absent, empty, whitespace, `"auto"`, garbage) maps to `undefined`, i.e. genuinely
 * unset. `max-cell-size=""` silently pinning every cell to the 4px floor would be a trap, and these
 * optional sizes preserve their automatic geometry when unset.
 */
export const optionalCellSizeConverter = {
  fromAttribute(value: string | null): number | undefined {
    if (value === null || value.trim() === '') return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  },
};

export const DEFAULT_MATRIX_DATA: HeatmapMatrixData = Object.freeze({
  kind: 'matrix',
  rowLabels: Object.freeze([]),
  colLabels: Object.freeze([]),
  values: Object.freeze([]),
});

/**
 * Normalizes a `maxCellSize`/`minCellSize` assignment: a non-finite (or absent) value means
 * genuinely unset, and anything else is clamped to the `FIT_MIN_CELL` floor via the same
 * `finiteRange()` helper `cellSize`'s own setter uses, so the two clamps and the size they clamp
 * agree on what a legal cell size is.
 */
export function normalizeCellSizeClamp(
  value: number | undefined | null
): number | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  return finiteRange(value, FIT_MIN_CELL, FIT_MIN_CELL);
}

export const bucketCountConverter = {
  fromAttribute(value: string | null): number {
    return !value?.trim()
      ? DEFAULT_BUCKET_COUNT
      : normalizeBucketCount(Number(value));
  },
};

/** Linearly interpolates between two already-resolved `[r, g, b, a]` quadruples at `t` in `[0, 1]`,
 *  formatting the result as `rgb(...)` when fully opaque or `rgba(...)` when either endpoint is translucent. */
export function mixRgb(
  from: [number, number, number, number],
  to: [number, number, number, number],
  t: number
): string {
  const clamped = Math.min(1, Math.max(0, t));
  const r = Math.round(from[0] + (to[0] - from[0]) * clamped);
  const g = Math.round(from[1] + (to[1] - from[1]) * clamped);
  const b = Math.round(from[2] + (to[2] - from[2]) * clamped);
  const a = from[3] + (to[3] - from[3]) * clamped;
  return formatRgb([r, g, b, a]);
}

/** Spacing properties whose calendar-mode effect is opt-in (see `cellGapX`). */
export type CalendarSpacingProperty = 'cellGapX' | 'cellGapY' | 'cellRadius';
export const CALENDAR_SPACING_PROPERTIES: ReadonlySet<PropertyKey> = new Set<CalendarSpacingProperty>([
  'cellGapX',
  'cellGapY',
  'cellRadius',
]);
