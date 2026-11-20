import type { CalendarDay } from './calendar-grid.js';
import type { LyraHeatmapMatrixRangeSelectDetail } from './heatmap-matrix-source.js';

/**
 * Which matrix label band, if any, is frozen while the grid scrolls.
 *
 * One closed set rather than a boolean or a pair of booleans, because freezing one axis is a real
 * request on its own: a wide matrix needs the row gutter to survive horizontal scrolling, a tall one
 * needs the column band to survive vertical scrolling, and the two are independent. A boolean cannot
 * express that at all, and a `sticky-row-labels`/`sticky-col-labels` pair spends two attributes and
 * four states on it while leaving no single reflected value to select on in CSS. The `rows`/`cols`
 * spelling matches the vocabulary the rest of this component already uses (`rowLabels`,
 * `row-label-width`, `colLabels`, `col-label-height`) rather than introducing axis letters.
 */
export type LyraHeatmapStickyLabels = 'none' | 'rows' | 'cols' | 'both';

export interface OwnedAnimationFrame {
  owner: Window;
  handle: number;
}

/** The heatmap's two layout modes — a plain row/col grid or a GitHub-style calendar grid. */
export type HeatmapMode = 'matrix' | 'calendar';
/** The value-to-color mapping applied within each mode — linear or square-root compressed. */
export type HeatmapScale = 'linear' | 'sqrt';

/** Matrix-specific heatmap input. Collections are caller-owned and are projected into a bounded
 * immutable render model on update; reassign `data` after changing them. */
export interface HeatmapMatrixData {
  readonly kind: 'matrix';
  readonly rowLabels: readonly string[];
  readonly colLabels: readonly string[];
  readonly values: readonly (readonly number[])[];
}

/** Calendar-specific heatmap input. Keeping its geometry and label callbacks in this branch makes
 * it impossible for stale calendar configuration to coexist with matrix data. */
export interface HeatmapCalendarData {
  readonly kind: 'calendar';
  /** Calendar records keyed by ISO `date`; invalid and later duplicate dates are omitted
   * first-wins before every count, scale, paint, selection, focus, and event path. */
  readonly days: readonly CalendarDay[];
  readonly firstDayOfWeek?: number;
  readonly columnX?: (index: number) => number;
  readonly rowY?: (weekday: number) => number;
  /** Width, in CSS px, of the weekday-label gutter, or `'auto'` to measure the widest rendered
   * weekday label. Auto never shrinks below the built-in 28px gutter and is capped at 40% of the
   * host width. Unset preserves the original 28px geometry. */
  readonly weekdayLabelWidth?: number | 'auto';
  readonly weekdayLabelText?: (jsWeekday: number) => string | undefined;
  readonly monthLabelText?: (
    jsMonth: number,
    year: number
  ) => string | undefined;
}

/** Discriminated input model for `<lr-heatmap>`. */
export type HeatmapData = HeatmapMatrixData | HeatmapCalendarData;

/** A cell cursor in matrix mode. */
export interface MatrixCellPos {
  row: number;
  col: number;
}
/** A cell cursor in calendar mode — a grid position, not necessarily one with
 *  a matching entry in `days` (see `calendarCellAt()`). */
export interface CalendarCellPos {
  week: number;
  weekday: number;
  /**
   * The real ISO `yyyy-mm-dd` date this grid position falls on, so a `cellText`/`cellColor`/
   * `cellInteractive` callback can key off the date without reconstructing the grid's own
   * `firstWeekStart + week * 7 + weekday` arithmetic. Always populated — including for a **gap**
   * position with no matching entry in `days` at all, which still sits on a real calendar day
   * (that case reports `NaN` in signed mode and the legacy `-1` no-data value otherwise).
   */
  date: string;
}
export type CellPos = MatrixCellPos | CalendarCellPos;

/**
 * A marker drawn as a stroked ring over a matching cell (matrix mode:
 * `row`/`col`; calendar mode: `date` — whichever pair matches the active
 * `mode`; the other fields are simply ignored). An optional `label`
 * additionally surfaces the annotation in the legend.
 */
export interface HeatmapAnnotation {
  row?: number;
  col?: number;
  date?: string;
  label?: string;
}

/**
 * One entry of a discrete legend key, supplied via `legendStops`. Purely a legend description —
 * it never feeds back into the cell color ramp (see `LyraHeatmap.legendStops`).
 */
export interface HeatmapLegendStop {
  /** Domain value this stop represents; used for the rendered label. */
  value: number;
  /**
   * Any CSS color — typically whatever the consumer's own `cellColor` returns for `value`.
   * Omit it, pass an empty string, or pass an invalid/non-color value for a **caption-only** stop:
   * the entry then renders its
   * `[part="legend-stop-label"]` alone, with no `[part="legend-swatch"]` element in the DOM at
   * all, so a leading "0" / trailing "more" caption around a run of colored stops doesn't leave
   * an empty swatch box in the row.
   */
  color?: string;
  /** Optional label override; defaults to the component's own numeric formatting of `value`. */
  label?: string;
  /**
   * Set to `false` to exclude this stop from `warnOnLegendRampMismatch()`'s `colorSteps` agreement
   * check, for a real, distinctly-colored swatch that is intentionally not part of the sequential
   * ramp -- e.g. a calendar heatmap's fixed neutral "no data" color shown alongside an N-step
   * ramp. Defaults to `true`. A caption-only stop (no `color`) is already excluded regardless of
   * this flag, since it describes no color to compare.
   */
  partOfRamp?: boolean;
}

/** The ownership boundary clones every assignment before Lit sees it, so reference equality can
 * never suppress a repeated legend binding. Compare only the four fields the legend consumes;
 * unknown record fields are deliberately irrelevant to heatmap rendering. */
export function legendStopsChanged(
  value: readonly HeatmapLegendStop[] | undefined,
  previous: readonly HeatmapLegendStop[] | undefined
): boolean {
  if (Object.is(value, previous)) return false;
  if (!Array.isArray(value) || !Array.isArray(previous) || value.length !== previous.length)
    return true;
  for (let index = 0; index < value.length; index += 1) {
    if (Object.hasOwn(value, index) !== Object.hasOwn(previous, index)) return true;
    const next = value[index];
    const before = previous[index];
    if (!next || !before) {
      if (!Object.is(next, before)) return true;
      continue;
    }
    if (
      !Object.is(next.value, before.value) ||
      !Object.is(next.color, before.color) ||
      !Object.is(next.label, before.label) ||
      !Object.is(next.partOfRamp, before.partOfRamp)
    )
      return true;
  }
  return false;
}

/** A single cell to mark as persistently selected -- `row`/`col` in matrix mode, `date` in
 *  calendar mode (whichever pair matches the active `mode`; the other field is ignored),
 *  mirroring `HeatmapAnnotation`'s own row/col/date shape. */
export interface HeatmapSelectedCell {
  row?: number;
  col?: number;
  date?: string;
}

/** Origin of a controlled multiple-selection proposal. */
export type HeatmapSelectionSource = 'pointer' | 'keyboard' | 'row' | 'column';

/** Frozen proposed selection. Assign selectedCells to accept it; property writes are silent. */
export interface HeatmapSelectionChangeDetail {
  readonly selectedCells: readonly Readonly<HeatmapSelectedCell>[];
  readonly source: HeatmapSelectionSource;
}


export type LyraHeatmapCellClickDetail =
  | { date: string; value: number }
  | { row: number; col: number; value: number };

export type LyraHeatmapMatrixGeometryChangeDetail = {
  padLeft: number;
  padTop: number;
  cellSize: number;
  /** Vertical row pitch; omitted when it equals the horizontal cellSize. */
  rowHeight?: number;
  /** Custom painted bounds; present for rectangular rows or custom gaps/corners, omitted for default square cells. */
  cellWidth?: number;
  cellHeight?: number;
  cellRadius?: number;
};

/**
 * The painted calendar-mode geometry `LyraHeatmap.calendarGeometry` reports, in CSS pixels.
 * `padLeft` is the weekday-label gutter and `padTop` the month-label band; `cellWidth`/`cellHeight`
 * are the painted cell box (square in calendar mode); `cellGapX`/`cellGapY` are the resolved
 * spacing between week columns and weekday rows; `cellRadius` is the painted corner radius.
 * Caller-supplied `data.columnX`/`data.rowY` origins, when present, take precedence over
 * `padLeft`/`padTop` plus the gaps for positioning individual columns and rows.
 */
export type LyraHeatmapCalendarGeometry = {
  padLeft: number;
  padTop: number;
  cellSize: number;
  cellWidth: number;
  cellHeight: number;
  cellGapX: number;
  cellGapY: number;
  cellRadius: number;
  weekCount: number;
  firstDayOfWeek: number;
};

export interface LyraHeatmapEventMap {
  'lr-matrix-range-select': CustomEvent<LyraHeatmapMatrixRangeSelectDetail>;
  /** A cell was activated by pointer or Enter/Space. */
  'lr-cell-activate': CustomEvent<LyraHeatmapCellClickDetail>;
  'lr-matrix-geometry-change': CustomEvent<LyraHeatmapMatrixGeometryChangeDetail>;
  'lr-calendar-geometry-change': CustomEvent<LyraHeatmapCalendarGeometry>;
  'lr-selection-change': CustomEvent<HeatmapSelectionChangeDetail>;
}

/** The snapshot format returned by `LyraHeatmap.exportData()`: `'png'` for the raster canvas
 *  snapshot, `'csv'` for the underlying matrix/calendar values, matching every other
 *  visualization sibling's `exportData(format)` shape. */
export type LyraHeatmapExportFormat = 'csv' | 'png';
