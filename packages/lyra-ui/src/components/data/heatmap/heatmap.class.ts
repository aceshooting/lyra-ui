import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { srOnly } from '../../../internal/a11y.js';
import { finiteInteger, finiteRange } from '../../../internal/numbers.js';
import { getScratchCtx } from '../../../internal/canvas.js';
import { linearAlpha, linearBucket, minMax, sqrtStep } from './heatmap-scale.js';
import { styles } from './heatmap.styles.js';
import { buildCalendarGrid, parseIsoDate, quartileBucket, type CalendarCell, type CalendarDay } from './calendar-grid.js';
import { getDateTimeFormat, getNumberFormat } from '../../../internal/intl-cache.js';

const PAD_LEFT = 60;
const PAD_TOP = 20;
const FALLBACK_NO_DATA_FILL = 'rgba(128,128,128,0.25)';
const RAMP_STEPS = 7;
const FALLBACK_SCALE_LO = '#cde2fb';
const FALLBACK_SCALE_HI = '#0969da';
const FALLBACK_LABEL_FONT = '10px system-ui, sans-serif';
const CAL_PAD_LEFT = 28;
const CAL_LABEL_H = 16;
/** Calendar mode's original fixed cell size — now also the effective fallback
 *  the `cellSize` accessor uses in calendar mode when left unset (see its
 *  doc comment), so a consumer who never touches `cellSize` sees no change. */
const CAL_CELL = 11;
const CAL_GAP = 2;
/** Matrix mode's original fixed cell size — the effective fallback the
 *  `cellSize` accessor uses in matrix mode when left unset. */
const DEFAULT_MATRIX_CELL_SIZE = 22;
const DEFAULT_BUCKET_COUNT = 5;
/**
 * Hard lower bound on a `fitToWidth`-derived cell size, in both modes. A grid squeezed below this
 * stops being a readable heatmap and starts producing degenerate geometry (sub-pixel fill rects,
 * a hit-test rounding to the wrong cell), so `minCellSize` can raise this floor but never lower it.
 */
const FIT_MIN_CELL = 4;
/**
 * A linear RGB ramp cannot contain more than 256 visually distinct integer
 * steps on any channel. Keeping the bucket count within that bound avoids an
 * untrusted attribute/property value turning the ramp into an unbounded
 * allocation without discarding any useful color resolution.
 */
export const MAX_BUCKET_COUNT = 256;
/** Ring stroke width for both the annotation overlay and the keyboard focus ring. */
const RING_LINE_WIDTH = 2;
const FALLBACK_FOCUS_RING_COLOR = '#0969da';
const FALLBACK_ANNOTATION_COLOR = '#cf222e';
const FALLBACK_SELECTED_COLOR = '#1a7f37';
// policy-allow(rtl-arrow-keys): the canvas grids are deliberately non-mirrored -- drawMatrix()/
// columnXFor() always place column/week 0 at the physical left and [part='cells'] is pinned
// `direction: ltr` in heatmap.styles.ts -- so arrow keys stay physical too; see
// onMatrixKeyDown()/onCalendarKeyDown().
const ARROW_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const MS_PER_DAY = 86_400_000;

/** The heatmap's two layout modes — a plain row/col grid or a GitHub-style calendar grid. */
export type HeatmapMode = 'matrix' | 'calendar';
/** The value-to-color mapping applied within each mode — linear or square-root compressed. */
export type HeatmapScale = 'linear' | 'sqrt';

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
   * (that case simply reports the `-1` "no data" value alongside it).
   */
  date: string;
}
type CellPos = MatrixCellPos | CalendarCellPos;

/** The ISO `yyyy-mm-dd` date `dayOffset` days after a calendar grid's anchor week start. */
function isoDateAtOffset(firstWeekStart: Date, dayOffset: number): string {
  return new Date(firstWeekStart.getTime() + dayOffset * MS_PER_DAY).toISOString().slice(0, 10);
}

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
   * Omit it (or pass an empty string) for a **caption-only** stop: the entry then renders its
   * `[part="legend-stop-label"]` alone, with no `[part="legend-swatch"]` element in the DOM at
   * all, so a leading "0" / trailing "more" caption around a run of colored stops doesn't leave
   * an empty swatch box in the row.
   */
  color?: string;
  /** Optional label override; defaults to the component's own numeric formatting of `value`. */
  label?: string;
}

/** A single cell to mark as persistently selected -- `row`/`col` in matrix mode, `date` in
 *  calendar mode (whichever pair matches the active `mode`; the other field is ignored),
 *  mirroring `HeatmapAnnotation`'s own row/col/date shape. */
export interface HeatmapSelectedCell {
  row?: number;
  col?: number;
  date?: string;
}

const HEX_RE = /^([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB_RE = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i;

/**
 * Parses a strict `#rgb`/`#rgba`/`#rrggbb`/`#rrggbbaa` hex string into an
 * `[r, g, b, a]` quadruple (`a` in `[0, 1]`, defaulting to `1` for the
 * 3/6-digit alpha-less forms), or `null` if `hex` isn't one (rather than
 * silently coercing an unparsable string to `0` via
 * `Number.parseInt(..., 16)` returning `NaN`).
 */
export function hexToRgb(hex: string): [number, number, number, number] | null {
  const clean = hex.trim().replace('#', '');
  if (!HEX_RE.test(clean)) return null;
  const hasAlpha = clean.length === 4 || clean.length === 8;
  const full = clean.length <= 4 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = Number.parseInt(full, 16);
  if (hasAlpha) {
    return [(num >>> 24) & 255, (num >>> 16) & 255, (num >>> 8) & 255, (num & 255) / 255];
  }
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255, 1];
}

function parseRgbString(value: string): [number, number, number, number] | null {
  const match = RGB_RE.exec(value);
  if (!match) return null;
  const a = match[4] === undefined ? 1 : Number(match[4]);
  return [Number(match[1]), Number(match[2]), Number(match[3]), a];
}

/** Formats an `[r, g, b, a]` quadruple as the shortest equivalent CSS color —
 *  `rgb(r, g, b)` when fully opaque (matching every pre-alpha-support call
 *  site's output exactly), `rgba(r, g, b, a)` otherwise. */
function formatRgb([r, g, b, a]: [number, number, number, number]): string {
  const alpha = Math.min(1, Math.max(0, a));
  return alpha >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${Math.round(alpha * 1000) / 1000})`;
}


const warnedInvalidColors = new Set<string>();

function warnInvalidColor(color: string): void {
  if (warnedInvalidColors.has(color)) return;
  warnedInvalidColors.add(color);
  console.warn(
    `<lr-heatmap> could not parse "${color}" (set via --lr-heatmap-scale-lo/-hi) as a CSS ` +
      'color; falling back to the default ramp endpoint.',
  );
}

/**
 * Normalizes a bucket count to the safe, renderable range. Non-finite values
 * restore the public default; finite values are floored and clamped to
 * `[2, MAX_BUCKET_COUNT]`. Flooring keeps the ramp array's length in exact
 * agreement with the count used by `quartileBucket()`.
 */
export function normalizeBucketCount(bucketCount: number): number {
  return finiteInteger(bucketCount, DEFAULT_BUCKET_COUNT, 2, MAX_BUCKET_COUNT);
}

/**
 * Attribute converter for the optional `max-cell-size`/`min-cell-size` clamps. Unlike Lit's default
 * `Number` converter — which turns a missing-but-present `foo=""` into `0` — anything that isn't a
 * finite number (absent, empty, whitespace, `"auto"`, garbage) maps to `undefined`, i.e. genuinely
 * unset. `max-cell-size=""` silently pinning every cell to the 4px floor would be a trap, and these
 * two are the only properties on this component where "no value" is a meaningful state.
 */
const optionalCellSizeConverter = {
  fromAttribute(value: string | null): number | undefined {
    if (value === null || value.trim() === '') return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  },
  toAttribute(value: number | undefined): string | null {
    return value == null ? null : String(value);
  },
};

/**
 * Normalizes a `maxCellSize`/`minCellSize` assignment: a non-finite (or absent) value means
 * genuinely unset, and anything else is clamped to the `FIT_MIN_CELL` floor via the same
 * `finiteRange()` helper `cellSize`'s own setter uses, so the two clamps and the size they clamp
 * agree on what a legal cell size is.
 */
function normalizeCellSizeClamp(value: number | undefined | null): number | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  return finiteRange(value, FIT_MIN_CELL, FIT_MIN_CELL);
}

const bucketCountConverter = {
  fromAttribute(value: string | null): number {
    return value === null ? DEFAULT_BUCKET_COUNT : normalizeBucketCount(Number(value));
  },
  toAttribute(value: number): string {
    return String(normalizeBucketCount(value));
  },
};

/**
 * Resolves any syntactically valid CSS `<color>` — hex, `rgb()`, `hsl()`,
 * `oklch()`, a named color, etc. — to an `[r, g, b, a]` quadruple (`a` in
 * `[0, 1]`, `1` for an opaque input). A translucent input (e.g.
 * `rgba(255,255,255,.028)`, a common way to key a color ramp off a themed
 * "quiet surface" token) round-trips its alpha rather than silently
 * resolving to the fully opaque equivalent.
 *
 * Hand-rolling a parser for every CSS color syntax is unnecessary and
 * error-prone (a naive hex-only parser silently turns an unrecognized format
 * into `NaN` -> `0`, i.e. solid black). The canvas 2D context already
 * implements the full CSS color grammar via its `fillStyle` setter, so this
 * normalizes through that instead. Assigning an unparsable string to
 * `fillStyle` is a spec'd no-op (the previous value is kept, it never
 * throws), so a sentinel round-trip is used to detect that case and fall
 * back to `fallbackHex` (with a one-time `console.warn`) instead of
 * silently drawing the wrong color.
 */
export function resolveRgb(color: string, fallbackHex: string): [number, number, number, number] {
  const fallback = hexToRgb(fallbackHex) ?? [0, 0, 0, 1];
  const direct = hexToRgb(color);
  if (direct) return direct;

  const ctx = getScratchCtx();
  if (!ctx) return fallback;

  const sentinel = 'rgb(1, 2, 3)';
  ctx.fillStyle = sentinel;
  const sentinelNormalized = ctx.fillStyle;
  ctx.fillStyle = color;
  if (ctx.fillStyle === sentinelNormalized && color.trim() !== sentinel) {
    warnInvalidColor(color);
    return fallback;
  }
  const normalized = ctx.fillStyle;
  return hexToRgb(normalized) ?? parseRgbString(normalized) ?? fallback;
}

/** Linearly interpolates between two already-resolved `[r, g, b, a]` quadruples at `t` in `[0, 1]`,
 *  formatting the result as `rgb(...)` when fully opaque or `rgba(...)` when either endpoint is translucent. */
function mixRgb(from: [number, number, number, number], to: [number, number, number, number], t: number): string {
  const clamped = Math.min(1, Math.max(0, t));
  const r = Math.round(from[0] + (to[0] - from[0]) * clamped);
  const g = Math.round(from[1] + (to[1] - from[1]) * clamped);
  const b = Math.round(from[2] + (to[2] - from[2]) * clamped);
  const a = from[3] + (to[3] - from[3]) * clamped;
  return formatRgb([r, g, b, a]);
}

export type LyraHeatmapCellClickDetail =
  | { date: string; value: number }
  | { row: number; col: number; value: number };

export interface LyraHeatmapEventMap {
  'lr-cell-click': CustomEvent<LyraHeatmapCellClickDetail>;
}
/**
 * `<lr-heatmap>` — a Canvas heatmap with a DPR-aware, resize-aware redraw
 * loop, in one of two `mode`s:
 *
 * - `"matrix"` (default): a `rowLabels` x `colLabels` grid of `values`. `-1`
 *   (or any non-finite value) is treated as "no data". `scale="sqrt"`
 *   compresses the ramp via `sqrtStep()` so one heavy cell doesn't wash out
 *   the rest; the default `"linear"` scale maps linearly instead.
 * - `"calendar"`: a GitHub-style Sunday-Saturday (or `firstDayOfWeek`-anchored
 *   — see below) x week grid built from `days`. `scale` governs its
 *   bucketing too: the default `"linear"` buckets by `quartileBucket()`
 *   (today's original behavior, unchanged); `"sqrt"` instead compresses via
 *   the same `sqrtStep()` magnitude compression matrix mode uses, so one
 *   heavy day doesn't wash out the rest. As in matrix mode, a cell whose
 *   `value` is negative or non-finite is treated as "no data" rather than
 *   being bucketed — as is a grid position with no matching entry in `days`
 *   at all (a gap in a sparse calendar).
 *
 * `fitToWidth` divides the host's measured width across the grid in either
 * mode; `maxCellSize`/`minCellSize` bound the result, so a sparse grid in a
 * wide pane cannot inflate into a few giant blocks and a year calendar in a
 * narrow one cannot collapse into hairlines. Both are ignored while
 * `fitToWidth` is unset (an explicit `cellSize` is an exact request), and the
 * canvas is sized from the *clamped* size — a capped grid leaves the host's
 * remaining width unfilled rather than stretching to it.
 *
 * The sequential color ramp's endpoints are read from the
 * `--lr-heatmap-scale-lo`/`-hi` custom properties (declared in
 * `heatmap.styles.ts`) so hosts can retheme it — canvas can't consume
 * `var()` directly, so they're resolved once per draw via
 * `getComputedStyle`, then normalized to RGB by `resolveRgb()` (any valid
 * CSS color syntax, not just hex — see its doc comment).
 *
 * Every cell is independently addressable: a `pointermove` hit test over the
 * canvas shows `[part="tooltip"]` with that cell's label + value (hidden on
 * `pointerleave`); the canvas is `tabindex="0"` with arrow-key roving focus
 * (a stroked ring redrawn over the focused cell on every draw, plus a
 * visually-hidden `aria-live="polite"` status announcement — avoids a
 * DOM-node-per-cell overlay, which would be hundreds of nodes for a year
 * calendar); and a click, or Enter/Space on the focused cell, fires
 * `lr-cell-click`. `annotations` additionally strokes a ring around
 * specific cells (e.g. to call out an anomaly), each one optionally
 * surfaced in the legend too via `[part="legend-annotation"]`.
 *
 * In calendar mode every cell position handed to `cellText`, `cellColor` and
 * `cellInteractive` is a `CalendarCellPos` carrying the resolved ISO
 * `yyyy-mm-dd` `date` alongside `week`/`weekday` — including for a grid
 * position with no entry in `days` at all — so a callback can key off the
 * date without re-deriving the grid's own anchor arithmetic.
 *
 * `legendStops` swaps the legend's two-endpoint gradient bar for a discrete
 * key of swatches, so a consumer whose `cellColor` callback paints an
 * entirely different domain than the `--lr-heatmap-scale-lo`/`-hi` ramp can
 * keep the built-in legend (labels, number formatting, annotation entries)
 * instead of hiding `[part="legend"]` and hand-rolling swatches. It is
 * presentation only — it never feeds back into the cell colors.
 *
 * Set `accessibleCells` when each cell needs a persistent DOM control for
 * assistive technology. The opt-in overlay uses native buttons with a
 * roving tabindex, localized `aria-label`, and explicit `aria-pressed` state
 * derived from the controlled `selectedCell` property; the canvas remains the
 * visual rendering surface underneath.
 *
 * `columnX` (calendar mode only) overrides the x-origin computed for each
 * week column — drawing, hit-testing, the focus ring, and month-label
 * positioning all consult it consistently, so a consumer can pixel-align a
 * calendar's week columns with a sibling chart's coordinate system. Unset
 * (the default) keeps the original evenly-spaced formula. `rowY` is its
 * calendar-mode vertical analogue — overrides the y-origin computed for each
 * weekday row, consulted consistently by drawing, hit-testing, and the focus
 * ring via the private `rowYFor()` helper (mirroring `columnXFor()` exactly).
 *
 * `firstDayOfWeek` (calendar mode only, default `0`/Sunday, no-op in matrix
 * mode) anchors the calendar grid at a different weekday — `0`-`6`, same
 * numbering as `CalendarCellPos.weekday` (`0` Sunday .. `6` Saturday) —
 * threaded into `buildCalendarGrid()`.
 *
 * `cellSize`/`fitToWidth` (previously matrix-mode only) also drive calendar
 * mode's per-cell size: unset, calendar mode keeps today's original 11px
 * cell size unchanged; explicitly set, the same fixed size (or, with
 * `fitToWidth`, the same host-width-derived size matrix mode already
 * supports) governs calendar mode's grid too.
 *
 * @customElement lr-heatmap
 * @event lr-cell-click - Fired on click, or Enter/Space on the
 * focused/hovered cell. `detail: { row, col, value }` in matrix mode,
 * `detail: { date, value }` in calendar mode. `cellText` overrides the
 * built-in English "Row X, Col Y: value" / "Mon DD: value" template used for
 * both the hover tooltip and the keyboard live-region announcement.
 * `cellColor` overrides a cell's ramp-computed color entirely for an exact value.
 * @csspart base - The heatmap wrapper.
 * @csspart canvas - The heatmap canvas.
 * @csspart cells - The opt-in per-cell accessibility overlay.
 * @csspart cell - An opt-in native button for one matrix or calendar cell.
 * @csspart tooltip - The hover tooltip.
 * @csspart live-region - The visually hidden keyboard announcement region.
 * @csspart legend - The color legend.
 * @csspart legend-lo - The low legend endpoint (omitted when `legendStops` is supplied).
 * @csspart legend-hi - The high legend endpoint (omitted when `legendStops` is supplied).
 * @csspart legend-stop - One discrete `legendStops` entry — swatch plus label.
 * @csspart legend-swatch - The color swatch of one `legendStops` entry. Not rendered at all for a caption-only stop (one with no `color`).
 * @csspart legend-stop-label - The text of one `legendStops` entry.
 * @csspart legend-value-label - The trailing `valueLabel` caption that closes the legend row, in both the gradient and the `legendStops` branch.
 * @csspart legend-annotation - An annotation label.
 * @cssprop [--lr-heatmap-scale-lo=var(--lr-color-brand-quiet)] - Low endpoint of the sequential color ramp.
 * @cssprop [--lr-heatmap-scale-hi=var(--lr-color-brand)] - High endpoint of the sequential color ramp.
 * @cssprop [--lr-heatmap-no-data-fill=var(--lr-color-no-data)] - Fill for cells with no value.
 * @cssprop [--lr-heatmap-label-font] - Font for axis/legend labels drawn on the canvas.
 * @cssprop [--lr-heatmap-tooltip-bg=var(--lr-color-surface)] - Hover tooltip background.
 * @cssprop [--lr-heatmap-tooltip-text=var(--lr-color-text)] - Hover tooltip text color.
 * @cssprop [--lr-heatmap-focus-ring-color=var(--lr-focus-ring-color)] - Focus ring around a focused cell.
 * @cssprop [--lr-heatmap-annotation-color=var(--lr-color-danger)] - Border color for an annotated cell.
 * @cssprop [--lr-heatmap-selected-color=var(--lr-color-success)] - Border color for the selected cell.
 * @cssprop [--lr-heatmap-color-steps-gradient=linear-gradient(to right, var(--lr-heatmap-scale-lo), var(--lr-heatmap-scale-hi))] - Gradient painted on the continuous legend bar. Set on the host by the component itself while `colorSteps` is supplied, and removed again when it is not; the fallback is the two-endpoint scale ramp.
 */
export class LyraHeatmap extends LyraElement<LyraHeatmapEventMap> {
  static override styles = [LyraElement.styles, styles, srOnly];

  @property({ attribute: false }) rowLabels: string[] = [];
  @property({ attribute: false }) colLabels: string[] = [];
  @property({ attribute: false }) values: number[][] = [];
  private _cellSize?: number;

  /**
   * Effective per-cell size (CSS px). Originally matrix-mode only; now also
   * governs calendar mode's cell size (replacing the previously hardcoded
   * 11px constant there) once explicitly set. Left unset, each mode keeps
   * its own original default — `DEFAULT_MATRIX_CELL_SIZE` (22) in matrix
   * mode, `CAL_CELL` (11) in calendar mode — so an existing consumer who
   * never touches `cellSize` sees no change in either mode. Set explicitly
   * (attribute or property), the same value governs both modes alike.
   */
  @property({ type: Number, attribute: 'cell-size' })
  get cellSize(): number {
    return this._cellSize ?? (this.mode === 'calendar' ? CAL_CELL : DEFAULT_MATRIX_CELL_SIZE);
  }

  set cellSize(value: number) {
    const oldValue = this._cellSize;
    // A non-finite, zero, or negative explicit size would divide-by-zero (or draw inverted
    // geometry) in every cell-position calculation derived from it -- calendar mode's
    // columnXFor()/weekAtX()/weekdayAtY()/calendarCellSize() and matrix mode's matrixCellSize()
    // all divide by cellSize (directly or via + CAL_GAP). Clamp to a sane positive floor, falling
    // back to the current mode-appropriate default (mirroring the getter's own fallback) for a
    // non-finite input.
    this._cellSize = finiteRange(value, this.mode === 'calendar' ? CAL_CELL : DEFAULT_MATRIX_CELL_SIZE, 1);
    this.requestUpdate('cellSize', oldValue);
  }
  @property({ attribute: 'value-label' }) valueLabel = 'value';
  /**
   * `"linear"` (default) maps values linearly to the color ramp in matrix
   * mode, and buckets calendar-mode values via `quartileBucket()` — both
   * unchanged from before this property governed calendar mode too.
   * `"sqrt"` compresses via `sqrtStep()`'s square-root magnitude compression
   * instead, in *both* modes, so one heavy cell/day doesn't wash out the
   * rest of a skewed dataset.
   */
  @property() scale: HeatmapScale = 'linear';
  /**
   * When set, `cellSize` is derived from the host's measured `clientWidth`
   * on every draw (including ResizeObserver-triggered redraws) instead of
   * the fixed `cell-size` attribute, so the grid actually fills the
   * available width. Without this, canvas dimensions are computed purely
   * from `PAD_LEFT + cols * cellSize` (matrix mode) or
   * `CAL_PAD_LEFT + weekCount * cellSize` (calendar mode), so a
   * resize-triggered redraw is a geometric no-op. Originally matrix-mode
   * only; now applies to calendar mode too.
   */
  @property({ type: Boolean, attribute: 'fit-to-width' }) fitToWidth = false;
  private _maxCellSize?: number;

  /**
   * Ceiling (CSS px) on the cell size `fitToWidth` derives from the host width, in **both** modes.
   * Ignored entirely while `fitToWidth` is unset — an explicit `cellSize` is never clamped, since
   * it is already an exact request.
   *
   * Exists because `fitToWidth` divides the whole host width across the grid: a 5-week calendar or
   * a 3-column matrix in a wide pane produces enormous cells. Capping them keeps the cell a cell.
   * The canvas is sized *from the clamped cell size*, so a capped grid deliberately leaves the
   * remaining host width unfilled (the canvas simply ends early) rather than stretching to fill it
   * — position it with normal CSS on the host if you want it centered or end-aligned.
   *
   * Unset (the default) reproduces today's exact fit-to-width behavior. Clamped to at least the
   * built-in `4`px floor; a non-finite value (or an empty attribute) means unset rather than `0`.
   * When both clamps are set and `maxCellSize < minCellSize`, the ceiling wins — the same
   * precedence `finiteRange()` itself applies.
   */
  @property({ type: Number, attribute: 'max-cell-size', converter: optionalCellSizeConverter })
  get maxCellSize(): number | undefined {
    return this._maxCellSize;
  }

  set maxCellSize(value: number | undefined) {
    const oldValue = this._maxCellSize;
    this._maxCellSize = normalizeCellSizeClamp(value);
    this.requestUpdate('maxCellSize', oldValue);
  }
  private _minCellSize?: number;

  /**
   * Floor (CSS px) under the cell size `fitToWidth` derives from the host width, in **both** modes
   * — the mirror of `maxCellSize`, and likewise ignored while `fitToWidth` is unset. Raises the
   * built-in `FIT_MIN_CELL` (4px) floor so a year-long calendar in a narrow pane keeps legible,
   * hit-testable cells and overflows its host instead of collapsing to hairlines.
   *
   * Can only raise that floor, never lower it: a value below `4` normalizes to `4`. Unset (the
   * default) reproduces today's exact fit-to-width behavior, and a non-finite value (or an empty
   * attribute) means unset.
   */
  @property({ type: Number, attribute: 'min-cell-size', converter: optionalCellSizeConverter })
  get minCellSize(): number | undefined {
    return this._minCellSize;
  }

  set minCellSize(value: number | undefined) {
    const oldValue = this._minCellSize;
    this._minCellSize = normalizeCellSizeClamp(value);
    this.requestUpdate('minCellSize', oldValue);
  }
  @property() mode: HeatmapMode = 'matrix';
  @property({ attribute: false }) days: CalendarDay[] = [];
  private _firstDayOfWeek = 0;

  /**
   * Calendar mode only (no-op in matrix mode): anchors the calendar grid at
   * a different weekday instead of always Sunday — `0`-`6`, same numbering
   * as `CalendarCellPos.weekday` (`0` Sunday .. `6` Saturday, matching
   * `CalendarCell.weekday`'s existing convention). Threaded into
   * `buildCalendarGrid()`. Defaults to `0` (Sunday), unchanged from before
   * this property existed. Normalized into `[0, 6]` via modulo wrap (not
   * clamp) -- mirrors `buildCalendarGrid()`'s own `(x + 7) % 7` weekday-wrapping
   * convention (already used elsewhere in this file), so e.g. `7` wraps to `0`
   * (Sunday) and `-1` wraps to `6` (Saturday) rather than being clamped to the
   * nearest in-range end. A non-finite input falls back to `0`.
   */
  @property({ type: Number, attribute: 'first-day-of-week' })
  get firstDayOfWeek(): number {
    return this._firstDayOfWeek;
  }

  set firstDayOfWeek(value: number) {
    const oldValue = this._firstDayOfWeek;
    this._firstDayOfWeek = ((finiteInteger(value, 0) % 7) + 7) % 7;
    this.requestUpdate('firstDayOfWeek', oldValue);
  }
  private _bucketCount = DEFAULT_BUCKET_COUNT;

  @property({ attribute: 'bucket-count', converter: bucketCountConverter })
  get bucketCount(): number {
    return this._bucketCount;
  }

  set bucketCount(value: number) {
    const oldValue = this._bucketCount;
    this._bucketCount = normalizeBucketCount(value);
    this.requestUpdate('bucketCount', oldValue);
  }
  /** Cells to ring-highlight — `row`/`col` in matrix mode, `date` in calendar mode. See `HeatmapAnnotation`. */
  @property({ attribute: false }) annotations: HeatmapAnnotation[] = [];
  /**
   * A discrete legend key rendered *instead of* the `--lr-heatmap-scale-lo`/`-hi` gradient bar
   * and its `[part="legend-lo"]`/`[part="legend-hi"]` endpoint labels — one
   * `[part="legend-stop"]` per entry, in array order, each a `[part="legend-swatch"]` in that
   * entry's `color` plus a `[part="legend-stop-label"]`. Labels default to this component's own
   * locale-aware numeric formatting of `value`, so a stop only needs an explicit `label` when
   * the number isn't the right caption ("none", "≥ 90%").
   *
   * A stop's `color` is optional: omit it (or pass `''`) for a **caption-only** entry, which
   * renders its label with no `[part="legend-swatch"]` element in the DOM at all — the shape a
   * "less ▢▢▢▢ more" style key needs for its two end captions, without an empty swatch box
   * sitting at either end of the row.
   *
   * Exists for the consumer who supplies `cellColor`: because that callback overrides a cell's
   * color entirely, the built-in two-endpoint bar can describe a ramp the grid no longer uses.
   * Supplying the same colors here keeps the legend honest without hiding `[part="legend"]` and
   * re-implementing swatches, labels and the annotation entries by hand.
   *
   * Strictly presentation: the stops are never consulted by the color ramp, the bucket math, the
   * tooltip, or the accessible name — supplying them changes nothing a cell renders. Any
   * `annotations` with a `label` still render their `[part="legend-annotation"]` entries after
   * the stops. Unset (the default) or an empty array reproduces today's exact gradient legend.
   */
  @property({ attribute: false }) legendStops?: HeatmapLegendStop[];
  /**
   * The single cell to mark as persistently selected -- `row`/`col` in matrix mode, `date` in
   * calendar mode. Purely a controlled, consumer-owned visual/accessibility marker, mirroring
   * `<lr-lite-chart>`'s `selectedIndex` -- this component never mutates it itself; a consumer
   * wires it up from `lr-cell-click` (or any other source) to build a toggle-select
   * interaction. Unset (the default, `null`) draws no selection ring, adds no selected-cell text
   * to the host's `aria-label`, and adds no "(selected)" suffix to the live-region announcement,
   * reproducing today's exact output.
   */
  @property({ attribute: false }) selectedCell: HeatmapSelectedCell | null = null;
  /**
   * Renders an opt-in DOM overlay of native buttons over the canvas. Each
   * button has a localized accessible name, explicit `aria-pressed="true"` or
   * `"false"` from `selectedCell`, and participates in a roving tabindex so a
   * dense calendar does not create hundreds of tab stops. The selection is
   * controlled: clicking a cell still emits `lr-cell-click`, and the
   * consumer updates `selectedCell` when it wants `aria-pressed` to change.
   */
  @property({ type: Boolean, attribute: 'accessible-cells' }) accessibleCells = false;
  /** Formats the per-cell tooltip and keyboard live-region text — receives the cell position
   *  (`MatrixCellPos` in matrix mode, `CalendarCellPos` — which carries the resolved ISO
   *  `yyyy-mm-dd` `date`, gap positions included — in calendar mode) and its value. Falls back to
   *  the built-in English "Row X, Col Y: value" / "Mon DD: value" template when unset. */
  @property({ attribute: false }) cellText?: (pos: MatrixCellPos | CalendarCellPos, value: number) => string;
  /** Opts individual cells out of the interaction model — receives the cell position and its
   *  value, return `false` to make that cell present-but-non-interactive (no hover tooltip,
   *  click, or keyboard roving-focus stop), without losing the layout/color-ramp machinery. Lets
   *  a consumer omit a future/out-of-range date from interaction, or mark a zero-value cell as
   *  non-interactive, without ~300+ meaningless keyboard tab stops on a dense grid. In calendar
   *  mode the position carries its resolved ISO `date`, so "everything after today" is a direct
   *  string comparison. Unset (the default) keeps every cell interactive, unchanged from before
   *  this property existed. */
  @property({ attribute: false }) cellInteractive?: (pos: MatrixCellPos | CalendarCellPos, value: number) => boolean;
  /** Overrides a cell's computed ramp/no-data color entirely for an exact value -- receives the
   *  cell position (`MatrixCellPos` in matrix mode, `CalendarCellPos` — carrying the resolved ISO
   *  `date` — in calendar mode) and its
   *  value, return a CSS color string to force that cell to it, or `undefined` to fall back to the
   *  normal `colorSteps`/ramp math unchanged. Lets a consumer designate a value as categorically
   *  outside the ramp (e.g. a real zero-count day rendered as a neutral hairline, distinct from
   *  both "no data" and the ramp's own lightest step) without a prepended synthetic ramp color,
   *  which can't safely reserve an exact value on a skewed dataset (the bucket selectors round by
   *  continuous ratio, with no equality-based reservation). Unset (the default) reproduces today's
   *  exact ramp/no-data behavior for every cell. A returned value containing a CSS custom property
   *  (e.g. `var(--x)`) or other browser-resolvable color syntax (e.g. `color-mix(...)`) is
   *  automatically resolved before being used as a canvas fill color. */
  @property({ attribute: false }) cellColor?: (pos: MatrixCellPos | CalendarCellPos, value: number) => string | undefined;
  /** Overrides the weekday-axis label text in calendar mode -- receives the real JS weekday index
   *  (`0` Sunday .. `6` Saturday) for a row that would otherwise render a label (today, only rows
   *  1/3/5 relative to `firstDayOfWeek` ever do) and, when it returns a string, uses it instead of
   *  the built-in `Intl.DateTimeFormat`-derived short weekday name. Unset (the default) reproduces
   *  today's exact locale-derived output. */
  @property({ attribute: false }) weekdayLabelText?: (jsWeekday: number) => string | undefined;
  /** Overrides the month-axis label text in calendar mode -- receives the real JS month index
   *  (`0` January .. `11` December) and full year for a month boundary that would otherwise
   *  render a label and, when it returns a string, uses it instead of the built-in
   *  `Intl.DateTimeFormat`-derived short month name. Mirrors `weekdayLabelText`'s exact
   *  override-with-fallback shape -- unset (the default) reproduces today's exact
   *  `toLocaleString(undefined, ...)`-derived output. */
  @property({ attribute: false }) monthLabelText?: (jsMonth: number, year: number) => string | undefined;
  /** A discrete array (≥2) of CSS colors used as exact ramp steps instead of linearly
   *  interpolating between the two `--lr-heatmap-scale-lo`/`-hi` endpoints — lets a consumer
   *  bring a validated, non-linear (or simply non-2-endpoint) sequential palette. Governs both
   *  `mode`s and both `scale` values, discretizing whichever scale would otherwise interpolate
   *  continuously into `colorSteps.length` buckets instead. Unset (the default, or fewer than 2
   *  entries) keeps today's 2-endpoint interpolation exactly. */
  @property({ attribute: false }) colorSteps?: string[];
  /**
   * Calendar mode only: overrides the x-origin (canvas-local CSS px) of week
   * column `index` (0-based, same indexing as `CalendarCellPos.week`).
   * Consulted consistently by every calendar-mode geometry call site —
   * drawing, hit-testing, the keyboard focus ring, and month-label
   * positioning — via the private `columnXFor()` helper, so painted
   * geometry and pointer hit-testing never disagree. Lets a consumer
   * pixel-align a calendar's week columns with a sibling chart's bars by
   * supplying that chart the same coordinate function. Unset (the default)
   * keeps today's evenly-spaced `CAL_PAD_LEFT + week * (CAL_CELL + CAL_GAP)`
   * formula unchanged. Ignored in matrix mode.
   */
  @property({ attribute: false }) columnX?: (index: number) => number;
  /**
   * Calendar mode only: overrides the y-origin (canvas-local CSS px) of
   * weekday row `weekday` (0-based, same indexing as
   * `CalendarCellPos.weekday`). The vertical analogue of `columnX` — consulted
   * consistently by every calendar-mode geometry call site that computes a
   * cell's y-coordinate from its weekday — drawing, hit-testing, and the
   * keyboard focus ring — via the private `rowYFor()` helper (mirroring
   * `columnXFor()`'s exact dispatch-with-computed-fallback shape). Also
   * consulted at `weekday = 7` (one past the last row) to size the canvas's
   * height, mirroring how `columnX` is consulted at `week = weekCount` to
   * size its width — so a function that spaces rows out further than the
   * default formula still gets a canvas tall enough to paint every row.
   * Unset (the default) keeps today's evenly-spaced `CAL_LABEL_H + weekday *
   * (cellSize + CAL_GAP)` formula unchanged. Ignored in matrix mode.
   */
  @property({ attribute: false }) rowY?: (weekday: number) => number;

  @query('canvas') private canvas?: HTMLCanvasElement;
  private resizeObserver?: ResizeObserver;
  private drawRafId?: number;
  private dprQuery?: MediaQueryList;
  private colorSchemeQuery?: MediaQueryList;
  private themeObserver?: MutationObserver;
  private themeRefreshQueued = false;
  /** The current value range, refreshed once per update cycle by `willUpdate()`. See `computeValueRange()`. */
  private cachedValueRange: [number, number] | null = null;
  /**
   * The calendar-mode grid layout, refreshed by `willUpdate()` only when
   * `days` actually changes (see `computeValueRange()`'s twin comment above)
   * — `buildCalendarGrid()` parses every date, filters invalid ones, and does
   * a full `.slice().sort()` for month labels, so recomputing it from
   * `drawCalendar()`, `hitTestCalendar()`, `calendarCellAt()`, and
   * `onCalendarKeyDown()` independently would redo that work 2-4x for a
   * single hover/click/keydown.
   */
  private cachedCalendarGrid = buildCalendarGrid(this.days);
  private cachedCalendarSortedValues: number[] = [];
  private cachedCalendarCellsByPos = new Map<string, CalendarCell>();
  /**
   * Every grid position's ISO date, indexed by `week * 7 + weekday`, rebuilt alongside
   * `cachedCalendarCellsByPos` whenever the grid itself is. Populating `CalendarCellPos.date` from
   * a flat array keeps that field an O(1) string read at every call site — crucially inside
   * `drawCalendar()`'s inner loop, where computing it per cell would be a `new Date()` plus a
   * `toISOString()` for all ~365 positions of a year grid on *every* repaint (hover, resize, theme
   * change). Built once per grid change instead, which is the same order of work
   * `buildCalendarGrid()` already does on that same path. Covers gap positions too, so a day
   * missing from `days` still resolves to its real date.
   */
  private cachedCalendarDateByPos: string[] = [];
  private cachedRamp: {
    key: string;
    colors: string[];
    loRgb: [number, number, number, number];
    hiRgb: [number, number, number, number];
  } | null = null;
  /** Set after a complete canvas pass. Focus movement can then repaint only the old/new cell
   * rectangles instead of clearing and repainting an entire dense heatmap. */
  private canvasHasContent = false;

  /** The cell currently under the pointer (`null` when not hovering one) — drives `[part="tooltip"]`. */
  @state() private hoverCell: CellPos | null = null;
  /** The roving keyboard-focus cell cursor, moved by arrow keys — drives the
   *  canvas-drawn focus ring and the `[part="live-region"]` announcement. */
  @state() private focusedCell: CellPos | null = null;
  /** Text of the visually-hidden `aria-live="polite"` status announcement, refreshed on every focus move. */
  @state() private liveText = '';
  /**
   * Whether `role`/`aria-label` were present on the host *before* this
   * element's own code ever wrote to them — snapshotted once, in the very
   * first `willUpdate()` (guarded by `hasUpdated`, which Lit only flips to
   * `true` after that first update commits). Re-checking `hasAttribute()` on
   * every update instead would self-poison: once this element writes its own
   * default `aria-label` on the first render, `hasAttribute('aria-label')`
   * is permanently `true` afterwards, which would wrongly look like an
   * author-supplied value and freeze the label instead of refreshing it as
   * `values`/`days` change on later updates.
   */
  private authorSuppliedRole = false;
  private authorSuppliedAriaLabel = false;

  override connectedCallback(): void {
    super.connectedCallback();
    this.resizeObserver = new ResizeObserver(this.scheduleDraw);
    this.resizeObserver.observe(this);
    this.watchDpr();
    this.watchTheme();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
    this.dprQuery?.removeEventListener('change', this.onDprChange);
    this.colorSchemeQuery?.removeEventListener('change', this.onColorSchemeChange);
    this.themeObserver?.disconnect();
    this.themeObserver = undefined;
    if (this.drawRafId !== undefined) {
      cancelAnimationFrame(this.drawRafId);
      this.drawRafId = undefined;
    }
  }

  private watchDpr(): void {
    // A MediaQueryList's `matches` is fixed at creation time, so crossing the
    // DPR threshold it was built for means building a fresh one for the new
    // ratio — remove the previous instance's listener first, or it leaks
    // (disconnectedCallback only ever cleans up whichever is current).
    this.dprQuery?.removeEventListener('change', this.onDprChange);
    this.dprQuery = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    this.dprQuery.addEventListener('change', this.onDprChange);
  }

  private onDprChange = (): void => {
    this.watchDpr();
    this.draw();
  };

  private onColorSchemeChange = (): void => {
    this.refreshTheme();
  };

  private queueThemeRefresh = (): void => {
    if (this.themeRefreshQueued) return;
    this.themeRefreshQueued = true;
    queueMicrotask(() => {
      this.themeRefreshQueued = false;
      if (this.isConnected) this.refreshTheme();
    });
  };

  private watchTheme(): void {
    const view = this.ownerDocument.defaultView;
    if (!view) return;
    this.colorSchemeQuery = view.matchMedia?.('(prefers-color-scheme: dark)');
    this.colorSchemeQuery?.addEventListener('change', this.onColorSchemeChange);

    if (typeof MutationObserver === 'undefined') return;
    const targets: Element[] = [this];
    let parent = this.parentElement;
    while (parent) {
      targets.push(parent);
      parent = parent.parentElement;
    }
    this.themeObserver = new MutationObserver(this.queueThemeRefresh);
    for (const target of targets) {
      this.themeObserver.observe(target, {
        attributes: true,
        attributeFilter: ['class', 'style', 'data-theme', 'data-color-scheme'],
      });
    }
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (
      changed.has('mode') ||
      changed.has('rowLabels') ||
      changed.has('colLabels') ||
      changed.has('days') ||
      changed.has('firstDayOfWeek') ||
      changed.has('cellInteractive')
    ) {
      // The previous focus/hover cursor may no longer address a real cell
      // once the grid's shape (or mode) changes out from under it —
      // stroking a focus ring at a stale (row, col)/(week, weekday), or
      // leaving the live region announcing a stale value, would be actively
      // misleading, so drop both instead. Reactive-property writes belong in
      // willUpdate() (not updated()), which folds them into this same
      // render rather than scheduling a whole extra update pass. A
      // `firstDayOfWeek` change reshuffles every cell's week/weekday the same
      // way a `days` change does, so it resets the cursor too.
      this.focusedCell = null;
      this.hoverCell = null;
      this.liveText = '';
    }
    // Calendar-mode grid layout depends only on `days`/`firstDayOfWeek`/`monthLabelText`/`locale`
    // (not `mode`) — rebuilt here, once per cycle, instead of independently by
    // every call site (see `cachedCalendarGrid`'s doc comment). `locale` is included so the
    // default month label (like every other locale-derived string on this canvas) re-resolves
    // when the component's locale changes, rather than staying pinned to whatever locale was
    // in effect the first time a calendar grid was built.
    if (
      changed.has('days') ||
      changed.has('firstDayOfWeek') ||
      changed.has('monthLabelText') ||
      changed.has('locale') ||
      !this.hasUpdated
    ) {
      this.cachedCalendarGrid = buildCalendarGrid(this.days, this.firstDayOfWeek, this.monthLabelText, this.effectiveLocale);
      this.cachedCalendarSortedValues = this.cachedCalendarGrid.cells
        .map((cell) => cell.value)
        .filter((value) => Number.isFinite(value) && value >= 0)
        .sort((a, b) => a - b);
      this.cachedCalendarCellsByPos = new Map(
        this.cachedCalendarGrid.cells.map((cell) => [`${cell.week}:${cell.weekday}`, cell]),
      );
      const { firstWeekStart, weekCount } = this.cachedCalendarGrid;
      this.cachedCalendarDateByPos = Array.from({ length: weekCount * 7 }, (_, index) =>
        isoDateAtOffset(firstWeekStart, index),
      );
    }
    if (!this.hasUpdated) {
      this.authorSuppliedRole = this.hasAttribute('role');
      this.authorSuppliedAriaLabel = this.hasAttribute('aria-label');
    }
    if (changed.has('colorSteps') || !this.hasUpdated) {
      if (this.colorSteps && this.colorSteps.length >= 2) {
        this.style.setProperty('--lr-heatmap-color-steps-gradient', `linear-gradient(to right, ${this.colorSteps.join(', ')})`);
      } else {
        this.style.removeProperty('--lr-heatmap-color-steps-gradient');
      }
    }
    // A hover/keyboard-focus @state() change (hoverCell/focusedCell/liveText)
    // triggers this same willUpdate() but never touches values/days/mode, so
    // gating the O(rows*cols) rescan the same way the focus/hover reset above
    // is gated avoids redoing it on every pointer move.
    if (changed.has('values') || changed.has('days') || changed.has('mode') || !this.hasUpdated) {
      this.cachedValueRange = this.computeValueRange();
    }
    const bounds = this.cachedValueRange;
    const range = bounds
      ? `${this.formatNumericValue(bounds[0])}–${this.formatNumericValue(bounds[1])}`
      : this.localize('heatmapNoDataValue');
    const valueLabel = this.localizedValueLabel();
    // Only default role/aria-label when the author hasn't already supplied
    // one — the canvas is a genuinely focusable/interactive control
    // (tabindex="0", click/keydown handlers) plus a live role="status"
    // region, so unconditionally forcing a role here would tell assistive
    // tech to flatten the whole subtree, hiding both from the accessibility
    // tree; it would also silently overwrite any author-supplied
    // role/aria-label on every update.
    if (!this.authorSuppliedRole) this.setAttribute('role', 'group');
    if (!this.authorSuppliedAriaLabel) {
      let label: string;
      if (this.mode === 'calendar') {
        label = this.localize('heatmapCalendarLabel', undefined, {
          days: this.days.length,
          label: valueLabel,
          range,
        });
      } else {
        const rows = this.rowLabels.length;
        const cols = this.colLabels.length;
        label = this.localize('heatmapMatrixLabel', undefined, {
          rows,
          cols,
          label: valueLabel,
          range,
        });
      }
      // A persistent selection description, appended to the host's own accessible name -- *not*
      // an `aria-describedby` idref pointing into this element's shadow root, since an idref like
      // that can't resolve across the shadow boundary. Reusing the plain aria-label string here
      // keeps it discoverable any time a screen reader user queries this element's accessible
      // name, regardless of which cell (if any) currently has keyboard focus.
      const selectedText = this.selectedCellDescription();
      this.setAttribute('aria-label', selectedText ? `${label} ${selectedText}` : label);
    }
  }

  /** The localized "Selected: <cell>." description appended to the host `aria-label`, or `''` when
   *  `selectedCell` is unset or doesn't resolve to a real cell in the current grid. */
  private selectedCellDescription(): string {
    if (!this.selectedCell) return '';
    if (this.mode === 'calendar') {
      if (this.selectedCell.date == null) return '';
      const match = this.cachedCalendarGrid.cells.find((c) => c.date === this.selectedCell!.date);
      if (!match) return '';
      return this.localize('heatmapSelectedCellLabel', undefined, {
        cell: this.calendarCellText({ week: match.week, weekday: match.weekday, date: match.date }),
      });
    }
    const { row, col } = this.selectedCell;
    if (row == null || col == null) return '';
    if (row < 0 || row >= this.rowLabels.length || col < 0 || col >= this.colLabels.length) return '';
    return this.localize('heatmapSelectedCellLabel', undefined, { cell: this.matrixCellText({ row, col }) });
  }

  /**
   * The real (non-no-data) value range across `values` (or `days` in
   * calendar mode), or `null` if there is none. Only called from
   * `willUpdate()`, which caches the result in `cachedValueRange` for
   * `render()` and `drawMatrix()` to reuse — `willUpdate()`, `render()`, and
   * `updated()` (which triggers `draw()`) all run within the same Lit update
   * cycle against the same `values`/`days`, so a single scan per cycle
   * suffices instead of one per consumer.
   */
  private computeValueRange(): [number, number] | null {
    const source = this.mode === 'calendar' ? this.days.map((d) => d.value) : this.values.flat();
    return minMax(source.filter((v) => Number.isFinite(v) && v >= 0));
  }

  private localizedValueLabel(): string {
    return this.localize('heatmapValueLabel', this.valueLabel === 'value' ? undefined : this.valueLabel);
  }

  private formatNumericValue(value: number): string {
    return getNumberFormat(this.effectiveLocale || undefined).format(value);
  }

  protected override updated(changed: PropertyValues): void {
    if (
      [
        'values',
        'rowLabels',
        'colLabels',
        'cellSize',
        'maxCellSize',
        'minCellSize',
        'valueLabel',
        'scale',
        'fitToWidth',
        'mode',
        'days',
        'bucketCount',
        'annotations',
        'columnX',
        'rowY',
        'firstDayOfWeek',
        'monthLabelText',
        'weekdayLabelText',
        'focusedCell',
        'colorSteps',
        'cellColor',
        'selectedCell',
        'legendStops',
      ].some((name) => changed.has(name))
    ) {
      const focusOnly = changed.has('focusedCell') && [...changed.keys()].every((key) => key === 'focusedCell' || key === 'liveText');
      if (focusOnly && this.repaintFocusRing(changed.get('focusedCell') as CellPos | null | undefined)) return;
      this.draw();
    }
  }

  /** Redraws canvas content after an upstream token or theme change. */
  refreshTheme(): void {
    this.draw();
  }

  /* Every token reader below takes the host's already-resolved computed-style
   * declaration rather than calling getComputedStyle(this) itself:
   * drawMatrix()/drawCalendar() resolve it once per draw pass and thread it
   * through, since each getComputedStyle() call can force a style
   * recalculation and one canvas pass consults up to seven tokens. */

  /** Reads the customizable ramp endpoints off the host's computed style. */
  private scaleEndpoints(cs: CSSStyleDeclaration): [string, string] {
    const lo = cs.getPropertyValue('--lr-heatmap-scale-lo').trim() || FALLBACK_SCALE_LO;
    const hi = cs.getPropertyValue('--lr-heatmap-scale-hi').trim() || FALLBACK_SCALE_HI;
    return [lo, hi];
  }

  /** Resolves the `--lr-color-text-quiet` chrome token for axis labels. */
  private labelColor(cs: CSSStyleDeclaration): string {
    return cs.getPropertyValue('--lr-color-text-quiet').trim() || '#6b7280';
  }

  /** Reads the customizable canvas axis/label font off the host's computed style. */
  private labelFont(cs: CSSStyleDeclaration): string {
    return cs.getPropertyValue('--lr-heatmap-label-font').trim() || FALLBACK_LABEL_FONT;
  }

  /** Reads the customizable no-data cell fill off the host's computed style. */
  private noDataFill(cs: CSSStyleDeclaration): string {
    return cs.getPropertyValue('--lr-heatmap-no-data-fill').trim() || FALLBACK_NO_DATA_FILL;
  }

  /** Reads the customizable canvas-drawn keyboard-focus-ring stroke color off the host's computed style. */
  private focusRingColor(cs: CSSStyleDeclaration): string {
    return cs.getPropertyValue('--lr-heatmap-focus-ring-color').trim() || FALLBACK_FOCUS_RING_COLOR;
  }

  /** Reads the customizable canvas-drawn annotation-ring stroke color off the host's computed style. */
  private annotationColor(cs: CSSStyleDeclaration): string {
    return cs.getPropertyValue('--lr-heatmap-annotation-color').trim() || FALLBACK_ANNOTATION_COLOR;
  }

  /** Reads the customizable canvas-drawn selected-cell-ring stroke color off the host's computed style. */
  private selectedColor(cs: CSSStyleDeclaration): string {
    return cs.getPropertyValue('--lr-heatmap-selected-color').trim() || FALLBACK_SELECTED_COLOR;
  }

  /** Whether `selectedCell` refers to the given grid position, in whichever mode is active --
   *  `row`/`col` equality in matrix mode, resolved-date equality in calendar mode (looking the
   *  position's actual date up via `calendarCellAt()`, the same way the annotation ring resolves
   *  `ann.date` against `cells`). Shared by the live-region announcement, which needs to know
   *  whether the just-announced cell *is* the selection. */
  private isSelectedPos(pos: CellPos): boolean {
    if (!this.selectedCell) return false;
    if ('week' in pos) {
      if (this.selectedCell.date == null) return false;
      return this.calendarCellAt(pos).date === this.selectedCell.date;
    }
    return this.selectedCell.row === pos.row && this.selectedCell.col === pos.col;
  }

  private draw(): void {
    this.canvasHasContent = false;
    if (this.mode === 'calendar') this.drawCalendar();
    else this.drawMatrix();
  }

  /** Repaints the old and new focus-ring cells after keyboard/click navigation. The underlying
   * cell fill plus annotation/selection rings are restored before the new focus ring is stroked,
   * so clearing a dirty rectangle never erases persistent data. Returns false when a complete draw
   * is still required (for example before the first canvas pass or after a mode change). */
  private repaintFocusRing(previous: CellPos | null | undefined): boolean {
    if (!this.canvasHasContent || !this.canvas) return false;
    const current = this.focusedCell;
    if (this.mode === 'calendar') {
      if ((previous && !('week' in previous)) || (current && !('week' in current))) return false;
      this.repaintCalendarFocusCell(previous && 'week' in previous ? previous : null);
      if (current && (!previous || !this.samePos(previous, current))) this.repaintCalendarFocusCell(current);
    } else {
      if ((previous && !('row' in previous)) || (current && !('row' in current))) return false;
      this.repaintMatrixFocusCell(previous && 'row' in previous ? previous : null);
      if (current && (!previous || !this.samePos(previous, current))) this.repaintMatrixFocusCell(current);
    }
    return true;
  }

  private scheduleDraw = (): void => {
    if (this.drawRafId !== undefined) return;
    this.drawRafId = requestAnimationFrame(() => {
      this.drawRafId = undefined;
      if (this.isConnected) this.draw();
    });
  };

  private colorRamp(
    bucketCount: number,
    cs: CSSStyleDeclaration,
  ): {
    colors: string[];
    loRgb: [number, number, number, number];
    hiRgb: [number, number, number, number];
  } {
    const steps = this.colorSteps;
    if (steps && steps.length >= 2) {
      const key = `steps ${steps.join(' ')}`;
      if (this.cachedRamp?.key === key) return this.cachedRamp;
      const colors = steps.map((c) => formatRgb(resolveRgb(c, FALLBACK_SCALE_LO)));
      const loRgb = resolveRgb(steps[0]!, FALLBACK_SCALE_LO);
      const hiRgb = resolveRgb(steps[steps.length - 1]!, FALLBACK_SCALE_HI);
      this.cachedRamp = { key, colors, loRgb, hiRgb };
      return this.cachedRamp;
    }
    const [scaleLo, scaleHi] = this.scaleEndpoints(cs);
    const normalizedBucketCount = normalizeBucketCount(bucketCount);
    const key = `${scaleLo}\u0000${scaleHi}\u0000${normalizedBucketCount}`;
    if (this.cachedRamp?.key === key) return this.cachedRamp;
    const loRgb = resolveRgb(scaleLo, FALLBACK_SCALE_LO);
    const hiRgb = resolveRgb(scaleHi, FALLBACK_SCALE_HI);
    const colors = Array.from({ length: normalizedBucketCount }, (_, i) =>
      mixRgb(loRgb, hiRgb, i / (normalizedBucketCount - 1)),
    );
    this.cachedRamp = { key, colors, loRgb, hiRgb };
    return this.cachedRamp;
  }

  /**
   * Effective per-cell size in calendar mode — mirrors `matrixCellSize()`
   * exactly: `fitToWidth` derives it from the host's measured width,
   * otherwise it's the (possibly explicitly-set) `cellSize` property, which
   * itself falls back to today's original 11px calendar default when left
   * unset (see `cellSize`'s accessor doc comment). Shared by `columnXFor()`,
   * `rowYFor()`, `drawCalendar()`, and the hit-testing below (`weekAtX()`,
   * `weekdayAtY()`, `cellRect()`) so they always agree on exactly the same
   * geometry as what's actually painted.
   */
  private calendarCellSize(): number {
    const { weekCount } = this.cachedCalendarGrid;
    if (this.fitToWidth && weekCount > 0) {
      // Unlike matrix mode's contiguous cells, calendar columns are spaced
      // `cellSize + CAL_GAP` apart (see `columnXFor()`), so the gap has to be
      // subtracted back out here — otherwise the painted width would overshoot
      // `hostWidth` by `weekCount * CAL_GAP` (every column's gap, once each).
      const hostWidth = this.clientWidth || CAL_PAD_LEFT + weekCount * (this.cellSize + CAL_GAP);
      return this.clampFitCellSize((hostWidth - CAL_PAD_LEFT) / weekCount - CAL_GAP);
    }
    return this.cellSize;
  }

  /**
   * Applies the optional `minCellSize`/`maxCellSize` clamps to a width-derived cell size. Only
   * ever reached from the `fitToWidth` branch of `calendarCellSize()`/`matrixCellSize()` — an
   * explicitly-set `cellSize` is an exact request and is never clamped. With both clamps unset
   * this is exactly the `Math.max(FIT_MIN_CELL, …)` floor both call sites applied before they
   * existed, so an untouched consumer's geometry is unchanged.
   */
  private clampFitCellSize(size: number): number {
    return finiteRange(
      size,
      FIT_MIN_CELL,
      Math.max(FIT_MIN_CELL, this.minCellSize ?? FIT_MIN_CELL),
      this.maxCellSize ?? Number.POSITIVE_INFINITY,
    );
  }

  /**
   * Calendar-mode week-column x-origin (canvas-local CSS px) — `columnX(week)`
   * when set, otherwise the original evenly-spaced formula (now derived from
   * `calendarCellSize()` rather than the fixed `CAL_CELL` constant). Shared
   * by every calendar-mode drawing and hit-testing call site (`drawCalendar()`,
   * `hitTestCalendar()`/`weekAtX()`, `cellRect()`) so painted geometry and
   * interactive hit-testing never disagree — mirrors the existing
   * `matrixCellSize()` invariant for matrix mode's
   * `drawMatrix()`/`hitTestMatrix()`/`cellRect()`.
   */
  private columnXFor(week: number): number {
    return this.columnX ? this.columnX(week) : CAL_PAD_LEFT + week * (this.calendarCellSize() + CAL_GAP);
  }

  /**
   * Calendar-mode weekday-row y-origin (canvas-local CSS px) — `rowY(weekday)`
   * when set, otherwise the original evenly-spaced formula (now derived from
   * `calendarCellSize()` rather than the fixed `CAL_CELL` constant). The
   * vertical analogue of `columnXFor()`, mirroring its exact
   * dispatch-with-computed-fallback shape and shared by the same
   * drawing/hit-testing/focus-ring call sites.
   */
  private rowYFor(weekday: number): number {
    return this.rowY ? this.rowY(weekday) : CAL_LABEL_H + weekday * (this.calendarCellSize() + CAL_GAP);
  }

  /**
   * Inverse of `columnXFor()`: resolves an x position (canvas-local CSS px)
   * to the week column it falls in, or `null` if it's outside every column
   * (`weekCount` is 0, or `x` doesn't land inside `[0, weekCount)`'s span).
   * The default spacing has a closed-form inverse (division); an arbitrary
   * `columnX` override doesn't, so that case instead scans each column's
   * `[columnXFor(week), columnXFor(week + 1))` span — algebraically the same
   * span the default formula's division derives — so hit-testing always
   * agrees with wherever `columnXFor()` actually painted that column.
   */
  private weekAtX(x: number, weekCount: number): number | null {
    if (!this.columnX) {
      const cellSize = this.calendarCellSize();
      const week = Math.floor((x - CAL_PAD_LEFT) / (cellSize + CAL_GAP));
      return week >= 0 && week < weekCount ? week : null;
    }
    for (let week = 0; week < weekCount; week++) {
      const start = this.columnXFor(week);
      const end = week + 1 < weekCount ? this.columnXFor(week + 1) : start + (this.calendarCellSize() + CAL_GAP);
      if (x >= start && x < end) return week;
    }
    return null;
  }

  /**
   * Inverse of `rowYFor()`: resolves a y position (canvas-local CSS px) to
   * the weekday row it falls in (0-6), or `null` if it's outside every row.
   * Mirrors `weekAtX()`'s closed-form-vs-scan split for the same reason: the
   * default spacing has a closed-form inverse; an arbitrary `rowY` override
   * doesn't.
   */
  private weekdayAtY(y: number): number | null {
    if (!this.rowY) {
      const cellSize = this.calendarCellSize();
      const weekday = Math.floor((y - CAL_LABEL_H) / (cellSize + CAL_GAP));
      return weekday >= 0 && weekday < 7 ? weekday : null;
    }
    for (let weekday = 0; weekday < 7; weekday++) {
      const start = this.rowYFor(weekday);
      const end = weekday + 1 < 7 ? this.rowYFor(weekday + 1) : start + (this.calendarCellSize() + CAL_GAP);
      if (y >= start && y < end) return weekday;
    }
    return null;
  }

  /**
   * Locale-derived weekday-axis labels for the 7 rows drawn down the left of
   * the calendar grid. The labeled weekdays are always Monday, Wednesday, and
   * Friday — matching today's sparse every-other-day label density — the
   * rest stay blank. Which *row* each one lands on depends on
   * `firstDayOfWeek`, since `buildCalendarGrid()` anchors `firstWeekStart`
   * (and therefore row 0) at that weekday. For each target weekday (using
   * the standard JS convention, Sunday=0..Saturday=6, so Monday=1,
   * Wednesday=3, Friday=5), the row is `(weekday - firstDayOfWeek + 7) % 7`;
   * with the default `firstDayOfWeek` of 0 this reduces to rows 1/3/5,
   * unchanged. The label *text* for each computed row is derived via
   * `Intl.DateTimeFormat` on a real UTC date that actually falls on that row,
   * so it follows the runtime locale instead of a hardcoded English array
   * (see `calendarCellText()`'s tooltip text for the same pattern).
   */
  private weekdayLabels(firstWeekStart: Date): string[] {
    const formatter = getDateTimeFormat(this.effectiveLocale || undefined, { weekday: 'short', timeZone: 'UTC' });
    const labels = ['', '', '', '', '', '', ''];
    for (const weekday of [1, 3, 5]) {
      const row = (weekday - this.firstDayOfWeek + 7) % 7;
      labels[row] =
        this.weekdayLabelText?.(weekday) ??
        formatter.format(new Date(firstWeekStart.getTime() + row * MS_PER_DAY));
    }
    return labels;
  }

  private drawCalendar(): void {
    if (!this.canvas) return;
    const { cells, weekCount, firstWeekStart, monthLabels } = this.cachedCalendarGrid;
    const cellSize = this.calendarCellSize();
    const w = this.columnXFor(Math.max(1, weekCount));
    // Derived from `rowYFor(7)` (one past the last of the 7 weekday rows), the
    // vertical mirror of `w`'s `columnXFor(weekCount)` — so a custom `rowY`
    // that spaces rows out further than the default formula still gets a
    // canvas tall enough to paint every row, instead of clipping them.
    const h = this.rowYFor(7);
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // One computed-style resolution per draw pass, threaded through every
    // token reader below -- see the token-reader block's rationale comment.
    const cs = getComputedStyle(this);
    // Normalize at the allocation boundary as a final guard even though the
    // public accessor and attribute converter already normalize their inputs.
    const buckets = normalizeBucketCount(this.bucketCount);
    const ramp = this.colorRamp(buckets, cs).colors;
    const noDataFill = this.noDataFill(cs);
    this.canvasColorCache.clear();
    // Only consulted when `scale === 'sqrt'` — mirrors `drawMatrix()`'s own
    // `hi` bound, reusing the already-cached value range instead of
    // rescanning `sortedValues` for its max.
    const bounds = this.cachedValueRange;
    const lo = bounds ? bounds[0] : 0;
    const hi = bounds ? bounds[1] : 1;

    // Indexed once per draw so every (week, weekday) grid position can be
    // painted below, not just positions with a matching entry in `cells` — a
    // day missing from `days` entirely (a gap in a sparse calendar) still
    // gets a real grid cell (see `calendarCellAt()`'s doc comment for the
    // same `-1` no-data sentinel used here) instead of being left
    // transparent.
    for (let week = 0; week < weekCount; week++) {
      for (let weekday = 0; weekday < 7; weekday++) {
        const value = this.cachedCalendarCellsByPos.get(`${week}:${weekday}`)?.value ?? -1;
        const x = this.columnXFor(week);
        const y = this.rowYFor(weekday);
        // `calendarPos()` is an array read plus one object literal, and the optional-call syntax
        // short-circuits it entirely when `cellColor` is unset — deliberately *not*
        // `calendarCellAt()`, whose miss path would allocate a Date and an ISO string for every
        // gap position on every repaint.
        const override = this.cellColor?.(this.calendarPos(week, weekday), value);
        if (override != null) {
          ctx.fillStyle = this.resolveCanvasColor(override, cs);
        } else if (value < 0 || !Number.isFinite(value)) {
          ctx.fillStyle = noDataFill;
        } else if (this.scale === 'sqrt') {
          const step = sqrtStep(value, hi, ramp.length);
          ctx.fillStyle = step < 0 ? noDataFill : ramp[step]!;
        } else if (this.colorSteps && this.colorSteps.length >= 2) {
          const step = linearBucket(value, lo, hi, ramp.length);
          ctx.fillStyle = ramp[step]!;
        } else {
          ctx.fillStyle = ramp[quartileBucket(value, this.cachedCalendarSortedValues, buckets)]!;
        }
        ctx.fillRect(x, y, cellSize, cellSize);
      }
    }

    // Annotation ring overlay, stroked after the fill pass so it reads
    // clearly over the data-driven cell color — see drawMatrix()'s twin of
    // this block for the matrix-mode equivalent.
    if (this.annotations.length) {
      ctx.lineWidth = RING_LINE_WIDTH;
      ctx.strokeStyle = this.annotationColor(cs);
      for (const ann of this.annotations) {
        if (ann.date == null) continue;
        const match = cells.find((c) => c.date === ann.date);
        if (!match) continue;
        const x = this.columnXFor(match.week);
        const y = this.rowYFor(match.weekday);
        ctx.strokeRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1);
      }
    }

    // Persistent "selected" ring, drawn after the annotation ring and before the keyboard focus
    // ring so focus visually layers on top of a selection when both target the same cell.
    // Independent of focusedCell -- unlike the transient focus cursor, this persists across focus
    // moves and hover, driven entirely by the controlled `selectedCell` property.
    if (this.selectedCell?.date != null) {
      const match = cells.find((c) => c.date === this.selectedCell!.date);
      if (match) {
        ctx.lineWidth = RING_LINE_WIDTH;
        ctx.strokeStyle = this.selectedColor(cs);
        const x = this.columnXFor(match.week);
        const y = this.rowYFor(match.weekday);
        ctx.strokeRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1);
      }
    }

    // Keyboard focus ring, redrawn on top of the fill pass (and any
    // annotation rings) on every draw.
    if (this.focusedCell && 'week' in this.focusedCell) {
      const { week, weekday } = this.focusedCell;
      if (week < weekCount && weekday < 7) {
        ctx.lineWidth = RING_LINE_WIDTH;
        ctx.strokeStyle = this.focusRingColor(cs);
        const x = this.columnXFor(week);
        const y = this.rowYFor(weekday);
        ctx.strokeRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1);
      }
    }

    ctx.fillStyle = this.labelColor(cs);
    ctx.font = this.labelFont(cs);
    for (const m of monthLabels) {
      ctx.fillText(m.label, this.columnXFor(m.week), CAL_LABEL_H - 4);
    }
    const WEEKDAY_LABELS = this.weekdayLabels(firstWeekStart);
    WEEKDAY_LABELS.forEach((label, weekday) => {
      if (label) ctx.fillText(label, 2, this.rowYFor(weekday) + cellSize - 1);
    });
    this.canvasHasContent = true;
  }

  /**
   * Effective per-cell size in matrix mode — `fitToWidth` derives it from
   * the host's measured width, otherwise it's the fixed `cellSize`
   * property. Shared by `drawMatrix()` and the pointer/keyboard hit-testing
   * below (`hitTestMatrix()`, `cellRect()`) so they always agree on exactly
   * the same geometry as what's actually painted.
   */
  private matrixCellSize(cols: number): number {
    if (this.fitToWidth && cols > 0) {
      const hostWidth = this.clientWidth || PAD_LEFT + cols * this.cellSize;
      return this.clampFitCellSize((hostWidth - PAD_LEFT) / cols);
    }
    return this.cellSize;
  }

  private paintMatrixCell(
    ctx: CanvasRenderingContext2D,
    row: number,
    col: number,
    cellSize: number,
    cs: CSSStyleDeclaration,
    rampData: ReturnType<LyraHeatmap['colorRamp']>,
    noDataFill: string,
  ): void {
    const value = this.values[row]?.[col] ?? -1;
    const bounds = this.cachedValueRange;
    const lo = bounds ? bounds[0] : 0;
    const hi = bounds ? bounds[1] : 1;
    const override = this.cellColor?.({ row, col }, value);
    if (override != null) ctx.fillStyle = this.resolveCanvasColor(override, cs);
    else if (value < 0 || !Number.isFinite(value)) ctx.fillStyle = noDataFill;
    else if (this.scale === 'sqrt') {
      const step = sqrtStep(value, hi, rampData.colors.length);
      ctx.fillStyle = step < 0 ? noDataFill : rampData.colors[step]!;
    } else if (this.colorSteps && this.colorSteps.length >= 2) {
      ctx.fillStyle = rampData.colors[linearBucket(value, lo, hi, rampData.colors.length)]!;
    } else {
      ctx.fillStyle = mixRgb(rampData.loRgb, rampData.hiRgb, linearAlpha(value, lo, hi));
    }
    ctx.fillRect(PAD_LEFT + col * cellSize, PAD_TOP + row * cellSize, cellSize - 1, cellSize - 1);
  }

  private paintMatrixFocusOverlays(
    ctx: CanvasRenderingContext2D,
    row: number,
    col: number,
    cellSize: number,
    cs: CSSStyleDeclaration,
  ): void {
    const x = PAD_LEFT + col * cellSize;
    const y = PAD_TOP + row * cellSize;
    if (this.annotations.some((ann) => ann.row === row && ann.col === col)) {
      ctx.lineWidth = RING_LINE_WIDTH;
      ctx.strokeStyle = this.annotationColor(cs);
      ctx.strokeRect(x + 1, y + 1, cellSize - 3, cellSize - 3);
    }
    if (this.selectedCell?.row === row && this.selectedCell.col === col) {
      ctx.lineWidth = RING_LINE_WIDTH;
      ctx.strokeStyle = this.selectedColor(cs);
      ctx.strokeRect(x + 1, y + 1, cellSize - 3, cellSize - 3);
    }
    if (this.focusedCell && 'row' in this.focusedCell && this.focusedCell.row === row && this.focusedCell.col === col) {
      ctx.lineWidth = RING_LINE_WIDTH;
      ctx.strokeStyle = this.focusRingColor(cs);
      ctx.strokeRect(x + 1, y + 1, cellSize - 3, cellSize - 3);
    }
  }

  private repaintMatrixFocusCell(pos: MatrixCellPos | null): void {
    if (!pos || !this.canvas) return;
    const rows = this.rowLabels.length;
    const cols = this.colLabels.length;
    if (pos.row < 0 || pos.row >= rows || pos.col < 0 || pos.col >= cols) return;
    const cellSize = this.matrixCellSize(cols);
    const x = PAD_LEFT + pos.col * cellSize;
    const y = PAD_TOP + pos.row * cellSize;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(x - RING_LINE_WIDTH - 1, y - RING_LINE_WIDTH - 1, cellSize + 2 * (RING_LINE_WIDTH + 1), cellSize + 2 * (RING_LINE_WIDTH + 1));
    const cs = getComputedStyle(this);
    this.paintMatrixCell(ctx, pos.row, pos.col, cellSize, cs, this.colorRamp(RAMP_STEPS, cs), this.noDataFill(cs));
    this.paintMatrixFocusOverlays(ctx, pos.row, pos.col, cellSize, cs);
  }

  private paintCalendarCell(
    ctx: CanvasRenderingContext2D,
    week: number,
    weekday: number,
    cellSize: number,
    cs: CSSStyleDeclaration,
    ramp: string[],
    noDataFill: string,
  ): void {
    const value = this.cachedCalendarCellsByPos.get(`${week}:${weekday}`)?.value ?? -1;
    const bounds = this.cachedValueRange;
    const lo = bounds ? bounds[0] : 0;
    const hi = bounds ? bounds[1] : 1;
    const override = this.cellColor?.(this.calendarPos(week, weekday), value);
    if (override != null) ctx.fillStyle = this.resolveCanvasColor(override, cs);
    else if (value < 0 || !Number.isFinite(value)) ctx.fillStyle = noDataFill;
    else if (this.scale === 'sqrt') {
      const step = sqrtStep(value, hi, ramp.length);
      ctx.fillStyle = step < 0 ? noDataFill : ramp[step]!;
    } else if (this.colorSteps && this.colorSteps.length >= 2) {
      ctx.fillStyle = ramp[linearBucket(value, lo, hi, ramp.length)]!;
    } else {
      ctx.fillStyle = ramp[quartileBucket(value, this.cachedCalendarSortedValues, ramp.length)]!;
    }
    ctx.fillRect(this.columnXFor(week), this.rowYFor(weekday), cellSize, cellSize);
  }

  private paintCalendarFocusOverlays(
    ctx: CanvasRenderingContext2D,
    week: number,
    weekday: number,
    cellSize: number,
    cs: CSSStyleDeclaration,
  ): void {
    const date = this.calendarDateAt(week, weekday);
    const x = this.columnXFor(week);
    const y = this.rowYFor(weekday);
    const matches = (candidate: { date?: string } | undefined): boolean => candidate?.date === date;
    if (this.annotations.some(matches)) {
      ctx.lineWidth = RING_LINE_WIDTH;
      ctx.strokeStyle = this.annotationColor(cs);
      ctx.strokeRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1);
    }
    if (matches(this.selectedCell ?? undefined)) {
      ctx.lineWidth = RING_LINE_WIDTH;
      ctx.strokeStyle = this.selectedColor(cs);
      ctx.strokeRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1);
    }
    if (this.focusedCell && 'week' in this.focusedCell && this.focusedCell.week === week && this.focusedCell.weekday === weekday) {
      ctx.lineWidth = RING_LINE_WIDTH;
      ctx.strokeStyle = this.focusRingColor(cs);
      ctx.strokeRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1);
    }
  }

  private repaintCalendarFocusCell(pos: CalendarCellPos | null): void {
    if (!pos || !this.canvas) return;
    const { weekCount, firstWeekStart } = this.cachedCalendarGrid;
    if (pos.week < 0 || pos.week >= weekCount || pos.weekday < 0 || pos.weekday >= 7) return;
    const cellSize = this.calendarCellSize();
    const x = this.columnXFor(pos.week);
    const y = this.rowYFor(pos.weekday);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(x - RING_LINE_WIDTH - 1, y - RING_LINE_WIDTH - 1, cellSize + 2 * (RING_LINE_WIDTH + 1), cellSize + 2 * (RING_LINE_WIDTH + 1));
    const cs = getComputedStyle(this);
    const ramp = this.colorRamp(normalizeBucketCount(this.bucketCount), cs).colors;
    this.paintCalendarCell(ctx, pos.week, pos.weekday, cellSize, cs, ramp, this.noDataFill(cs));
    this.paintCalendarFocusOverlays(ctx, pos.week, pos.weekday, cellSize, cs);
    // The first calendar row sits close to the month-axis baseline; redraw the small axis labels
    // after clearing a focus rectangle so a ring move cannot erase adjacent label pixels.
    ctx.fillStyle = this.labelColor(cs);
    ctx.font = this.labelFont(cs);
    for (const month of this.cachedCalendarGrid.monthLabels) {
      ctx.fillText(month.label, this.columnXFor(month.week), CAL_LABEL_H - 4);
    }
    const labels = this.weekdayLabels(firstWeekStart);
    labels.forEach((label, weekday) => {
      if (label) ctx.fillText(label, 2, this.rowYFor(weekday) + cellSize - 1);
    });
  }

  private drawMatrix(): void {
    if (!this.canvas) return;
    const rows = this.rowLabels.length;
    const cols = this.colLabels.length;
    const cellSize = this.matrixCellSize(cols);
    const w = PAD_LEFT + cols * cellSize;
    const h = PAD_TOP + rows * cellSize;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // One computed-style resolution per draw pass, threaded through every
    // token reader below -- see the token-reader block's rationale comment.
    const cs = getComputedStyle(this);
    const bounds = this.cachedValueRange;
    const lo = bounds ? bounds[0] : 0;
    const hi = bounds ? bounds[1] : 1;
    const rampData = this.colorRamp(RAMP_STEPS, cs);
    const ramp = rampData.colors;
    const { loRgb, hiRgb } = rampData;
    const noDataFill = this.noDataFill(cs);
    this.canvasColorCache.clear();

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = this.values[r]?.[c] ?? -1;
        const x = PAD_LEFT + c * cellSize;
        const y = PAD_TOP + r * cellSize;
        const override = this.cellColor?.({ row: r, col: c }, v);
        if (override != null) {
          ctx.fillStyle = this.resolveCanvasColor(override, cs);
        } else if (v < 0 || !Number.isFinite(v)) {
          // `v < 0` alone is false for NaN, which would otherwise fall through to
          // the ramp branches below, compute an unparsable rgb(NaN, NaN, NaN)
          // fillStyle, and silently paint with whatever color the previous cell
          // left in `ctx.fillStyle` (canvas ignores unparsable assignments).
          ctx.fillStyle = noDataFill;
        } else if (this.scale === 'sqrt') {
          // ramp.length (not the RAMP_STEPS constant) so a colorSteps-driven ramp's
          // actual length governs bucketing -- equal to RAMP_STEPS when colorSteps is unset.
          const step = sqrtStep(v, hi, ramp.length);
          ctx.fillStyle = step < 0 ? noDataFill : ramp[step]!;
        } else if (this.colorSteps && this.colorSteps.length >= 2) {
          const step = linearBucket(v, lo, hi, ramp.length);
          ctx.fillStyle = ramp[step]!;
        } else {
          // linearAlpha() returns a 0.1-1.0 ramp position; reused here as a
          // mix ratio between the two ramp-endpoint colors (rather than as a
          // literal canvas alpha channel) so the 'linear' scale also respects
          // --lr-heatmap-scale-lo/-hi.
          const t = linearAlpha(v, lo, hi);
          ctx.fillStyle = mixRgb(loRgb, hiRgb, t);
        }
        ctx.fillRect(x, y, cellSize - 1, cellSize - 1);
      }
    }

    // Annotation ring overlay, stroked after the fill pass so it reads
    // clearly over the data-driven cell color. Uses a dedicated
    // --lr-heatmap-annotation-color token (defaults to --lr-color-danger)
    // rather than any of the sequential ramp colors, since it needs to stay
    // visible regardless of which point on that ramp it's drawn over.
    if (this.annotations.length) {
      ctx.lineWidth = RING_LINE_WIDTH;
      ctx.strokeStyle = this.annotationColor(cs);
      for (const ann of this.annotations) {
        if (ann.row == null || ann.col == null) continue;
        if (ann.row < 0 || ann.row >= rows || ann.col < 0 || ann.col >= cols) continue;
        const x = PAD_LEFT + ann.col * cellSize;
        const y = PAD_TOP + ann.row * cellSize;
        ctx.strokeRect(x + 1, y + 1, cellSize - 3, cellSize - 3);
      }
    }

    // Persistent "selected" ring, drawn after the annotation ring and before the keyboard focus
    // ring so focus visually layers on top of a selection when both target the same cell.
    // Independent of focusedCell -- see drawCalendar()'s twin of this block.
    if (this.selectedCell?.row != null && this.selectedCell.col != null) {
      const { row, col } = this.selectedCell;
      if (row >= 0 && row < rows && col >= 0 && col < cols) {
        ctx.lineWidth = RING_LINE_WIDTH;
        ctx.strokeStyle = this.selectedColor(cs);
        const x = PAD_LEFT + col * cellSize;
        const y = PAD_TOP + row * cellSize;
        ctx.strokeRect(x + 1, y + 1, cellSize - 3, cellSize - 3);
      }
    }

    // Keyboard focus ring, redrawn on top of the fill pass (and any
    // annotation rings) on every draw — canvas has no persistent DOM focus
    // affordance of its own for an individual cell, only a `:focus-visible`
    // outline around the whole element (see heatmap.styles.ts).
    if (this.focusedCell && 'row' in this.focusedCell) {
      const { row, col } = this.focusedCell;
      if (row < rows && col < cols) {
        ctx.lineWidth = RING_LINE_WIDTH;
        ctx.strokeStyle = this.focusRingColor(cs);
        const x = PAD_LEFT + col * cellSize;
        const y = PAD_TOP + row * cellSize;
        ctx.strokeRect(x + 1, y + 1, cellSize - 3, cellSize - 3);
      }
    }

    ctx.fillStyle = this.labelColor(cs);
    ctx.font = this.labelFont(cs);
    this.rowLabels.forEach((label, r) => {
      ctx.fillText(label, 4, PAD_TOP + r * cellSize + cellSize / 2 + 3);
    });
    this.colLabels.forEach((label, c) => {
      ctx.fillText(label, PAD_LEFT + c * cellSize + 2, PAD_TOP - 6);
    });
    this.canvasHasContent = true;
  }

  /**
   * Maps a pointer position, in canvas-local CSS px (e.g.
   * `PointerEvent.offsetX/offsetY`), to the cell underneath it — or `null`
   * if the pointer is outside the grid. Dispatches on `mode` so callers
   * don't have to.
   */
  private hitTest(x: number, y: number): CellPos | null {
    return this.mode === 'calendar' ? this.hitTestCalendar(x, y) : this.hitTestMatrix(x, y);
  }

  private hitTestMatrix(x: number, y: number): MatrixCellPos | null {
    const rows = this.rowLabels.length;
    const cols = this.colLabels.length;
    if (rows === 0 || cols === 0) return null;
    const cellSize = this.matrixCellSize(cols);
    const col = Math.floor((x - PAD_LEFT) / cellSize);
    const row = Math.floor((y - PAD_TOP) / cellSize);
    if (row < 0 || row >= rows || col < 0 || col >= cols) return null;
    const pos = { row, col };
    return this.isCellInteractive(pos) ? pos : null;
  }

  /** The first interactive matrix cell in row-major order, or `null` if every cell is excluded —
   *  used by `onMatrixKeyDown()`'s first-arrow-press case. */
  private firstInteractiveMatrixCell(rows: number, cols: number): MatrixCellPos | null {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (this.isCellInteractive({ row: r, col: c })) return { row: r, col: c };
      }
    }
    return null;
  }

  /** Steps from `(row, col)` by `(dRow, dCol)` repeatedly, skipping non-interactive cells, until
   *  an interactive cell is found or the grid edge is reached (in which case the original
   *  position is returned unchanged, matching today's clamp-at-edge behavior). Bounded: each
   *  iteration strictly approaches the edge, so this always terminates. */
  private nextInteractiveMatrixCell(
    row: number,
    col: number,
    dRow: number,
    dCol: number,
    rows: number,
    cols: number,
  ): MatrixCellPos {
    let r = row;
    let c = col;
    for (;;) {
      const nr = Math.min(rows - 1, Math.max(0, r + dRow));
      const nc = Math.min(cols - 1, Math.max(0, c + dCol));
      if (nr === r && nc === c) return { row, col };
      r = nr;
      c = nc;
      if (this.isCellInteractive({ row: r, col: c })) return { row: r, col: c };
    }
  }

  /** Calendar-mode analogue of `firstInteractiveMatrixCell()`. */
  private firstInteractiveCalendarCell(weekCount: number): CalendarCellPos | null {
    for (let week = 0; week < weekCount; week++) {
      for (let weekday = 0; weekday < 7; weekday++) {
        const pos = this.calendarPos(week, weekday);
        if (this.isCellInteractive(pos)) return pos;
      }
    }
    return null;
  }

  /** Calendar-mode analogue of `nextInteractiveMatrixCell()`. */
  private nextInteractiveCalendarCell(
    week: number,
    weekday: number,
    dWeek: number,
    dWeekday: number,
    weekCount: number,
  ): CalendarCellPos {
    let w = week;
    let d = weekday;
    for (;;) {
      const nw = Math.min(weekCount - 1, Math.max(0, w + dWeek));
      const nd = Math.min(6, Math.max(0, d + dWeekday));
      if (nw === w && nd === d) return this.calendarPos(week, weekday);
      w = nw;
      d = nd;
      const pos = this.calendarPos(w, d);
      if (this.isCellInteractive(pos)) return pos;
    }
  }

  private hitTestCalendar(x: number, y: number): CalendarCellPos | null {
    const { weekCount } = this.cachedCalendarGrid;
    if (weekCount === 0) return null;
    const week = this.weekAtX(x, weekCount);
    const weekday = this.weekdayAtY(y);
    if (week === null || weekday === null) return null;
    const pos = this.calendarPos(week, weekday);
    return this.isCellInteractive(pos) ? pos : null;
  }

  /**
   * Resolves a (week, weekday) grid position to its real calendar date and
   * value. Computed from grid geometry (`firstWeekStart` + offset), not
   * just looked up in `cells` — so a position with no matching entry in
   * `days` (a gap in a sparse calendar) still resolves to a real ISO date,
   * with a `-1` "no data" sentinel value (the same convention `values`' `-1`
   * sentinel uses in matrix mode), instead of being unresolvable.
   */
  private calendarCellAt(pos: { week: number; weekday: number }): { date: string; value: number } {
    const match = this.cachedCalendarCellsByPos.get(`${pos.week}:${pos.weekday}`);
    if (match) return { date: match.date, value: match.value };
    return { date: this.calendarDateAt(pos.week, pos.weekday), value: -1 };
  }

  /**
   * The ISO `yyyy-mm-dd` date of a (week, weekday) grid position — an O(1) read out of
   * `cachedCalendarDateByPos`, falling back to the grid-geometry arithmetic for a position outside
   * the cached grid (a cursor left over from a shrinking `days`, say). Grid geometry guarantees
   * this agrees with the `date` of a matching `days` entry: `week * 7 + weekday` *is* the day
   * offset from `firstWeekStart` (see `buildCalendarGrid()`).
   */
  private calendarDateAt(week: number, weekday: number): string {
    const index = week * 7 + weekday;
    return (
      this.cachedCalendarDateByPos[index] ??
      isoDateAtOffset(this.cachedCalendarGrid.firstWeekStart, index)
    );
  }

  /** Builds the full calendar-mode cursor for a grid position, `date` included. Every calendar-mode
   *  `CalendarCellPos` in this component goes through here, so no call site can forget the date. */
  private calendarPos(week: number, weekday: number): CalendarCellPos {
    return { week, weekday, date: this.calendarDateAt(week, weekday) };
  }

  /**
   * Pixel rect (canvas-local CSS px) of a cell — shared by `tooltipStyle()`
   * so the tooltip's position always agrees with the same geometry
   * `drawMatrix()`/`drawCalendar()`/`hitTest*()` use.
   */
  private cellRect(pos: CellPos): { x: number; y: number; w: number; h: number } {
    if ('week' in pos) {
      const cellSize = this.calendarCellSize();
      return {
        x: this.columnXFor(pos.week),
        y: this.rowYFor(pos.weekday),
        w: cellSize,
        h: cellSize,
      };
    }
    const cellSize = this.matrixCellSize(this.colLabels.length);
    return { x: PAD_LEFT + pos.col * cellSize, y: PAD_TOP + pos.row * cellSize, w: cellSize - 1, h: cellSize - 1 };
  }

  /**
   * Human-readable "<label>: <value>" text for a cell — shared by the hover
   * tooltip and the keyboard-focus live-region announcement, so both always
   * describe a cell the same way. This is the built-in English fallback used
   * when `cellText` isn't set — see `resolveCellText()`.
   */
  private defaultCellText(pos: CellPos): string {
    return 'week' in pos ? this.calendarCellText(pos) : this.matrixCellText(pos);
  }

  private matrixCellText(pos: MatrixCellPos): string {
    const rowLabel =
      this.rowLabels[pos.row] ?? this.localize('heatmapDefaultRowLabel', undefined, { n: pos.row + 1 });
    const colLabel =
      this.colLabels[pos.col] ?? this.localize('heatmapDefaultColLabel', undefined, { n: pos.col + 1 });
    const v = this.values[pos.row]?.[pos.col];
    const valueText =
      v == null || v < 0 || !Number.isFinite(v)
        ? this.localize('heatmapNoDataValue')
        : this.formatNumericValue(v);
    return this.localize('heatmapMatrixCellLabel', undefined, {
      row: rowLabel,
      col: colLabel,
      value: valueText,
    });
  }

  private calendarCellText(pos: CalendarCellPos): string {
    const { date, value } = this.calendarCellAt(pos);
    const label = parseIsoDate(date).toLocaleString(this.effectiveLocale || undefined, {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
    const valueText =
      value < 0 || !Number.isFinite(value)
        ? this.localize('heatmapNoDataValue')
        : this.formatNumericValue(value);
    return this.localize('heatmapCalendarCellLabel', undefined, { date: label, value: valueText });
  }

  /** The raw numeric value at a cell position, in either mode — shared by `resolveCellText()`
   *  so a custom `cellText` formatter receives the same value the built-in template would use. */
  private valueAt(pos: CellPos): number {
    if ('week' in pos) return this.calendarCellAt(pos).value;
    return this.values[pos.row]?.[pos.col] ?? -1;
  }

  /** Dispatches to the host-provided `cellText` formatter when set, otherwise the built-in template. */
  private resolveCellText(pos: CellPos): string {
    return this.cellText ? this.cellText(pos, this.valueAt(pos)) : this.defaultCellText(pos);
  }

  /** Dispatches to the host-provided `cellInteractive` predicate when set, otherwise `true`
   *  (every cell interactive, today's unchanged default). */
  private isCellInteractive(pos: CellPos): boolean {
    return this.cellInteractive?.(pos, this.valueAt(pos)) ?? true;
  }

  /** Refreshes the visually-hidden live-region text for a newly-focused cell.
   *  The selected state goes through the same `heatmapSelectedCellLabel`
   *  template as the host aria-label, so a locale can place the "selected"
   *  wording anywhere around the cell text instead of it being appended. */
  private announce(pos: CellPos): void {
    const text = this.resolveCellText(pos);
    this.liveText = this.isSelectedPos(pos)
      ? this.localize('heatmapSelectedCellLabel', undefined, { cell: text })
      : text;
  }

  private emitCellClick(pos: CellPos): void {
    if ('week' in pos) {
      const { date, value } = this.calendarCellAt(pos);
      this.emit('lr-cell-click', { date, value });
    } else {
      const value = this.values[pos.row]?.[pos.col] ?? -1;
      this.emit('lr-cell-click', { row: pos.row, col: pos.col, value });
    }
  }

  /** Inline `style` for `[part="tooltip"]`, centered above the given cell. */
  private tooltipStyle(pos: CellPos): Record<string, string> {
    const rect = this.cellRect(pos);
    return { left: `${rect.x + rect.w / 2}px`, top: `${rect.y}px` };
  }

  /**
   * Value-equality check for a `CellPos`, since `hoverCell` is assigned a
   * fresh object literal on every `pointermove` — Lit's `@state()`
   * change-detection only no-ops an identical *reference*, so without this,
   * `{row,col} !== {row,col}` by reference triggers a full canvas clear +
   * redraw on every pixel of pointer movement, even within the same cell.
   */
  private samePos(a: CellPos | null, b: CellPos | null): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    if ('week' in a && 'week' in b) return a.week === b.week && a.weekday === b.weekday;
    if ('row' in a && 'row' in b) return a.row === b.row && a.col === b.col;
    return false;
  }

  private onPointerMove = (e: PointerEvent): void => {
    const next = this.hitTest(e.offsetX, e.offsetY);
    if (!this.samePos(this.hoverCell, next)) this.hoverCell = next;
  };

  private onPointerLeave = (): void => {
    this.hoverCell = null;
  };

  private onCanvasClick = (e: MouseEvent): void => {
    // Only the click's own hit-tested position counts — a click that lands
    // outside the grid (e.g. on the canvas's own padding) is a genuine
    // out-of-grid click and should do nothing, not fall back to whatever
    // cell happens to still be keyboard-focused from an earlier interaction.
    const pos = this.hitTest(e.offsetX, e.offsetY);
    if (!pos) return;
    this.focusedCell = pos;
    this.announce(pos);
    this.emitCellClick(pos);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.mode === 'calendar') this.onCalendarKeyDown(e);
    else this.onMatrixKeyDown(e);
  };

  private onMatrixKeyDown(e: KeyboardEvent): void {
    const rows = this.rowLabels.length;
    const cols = this.colLabels.length;
    if (rows === 0 || cols === 0) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (this.focusedCell) this.emitCellClick(this.focusedCell);
      return;
    }
    if (!ARROW_KEYS.has(e.key)) return;
    e.preventDefault();
    if (!this.focusedCell || !('row' in this.focusedCell)) {
      const next = this.firstInteractiveMatrixCell(rows, cols);
      if (!next) return;
      this.focusedCell = next;
      this.announce(next);
      return;
    }
    const { row, col } = this.focusedCell;
    // The canvas grid is deliberately non-mirrored (drawMatrix()/cellRect() always place column 0
    // at the physical left, and [part='cells'] is pinned `direction: ltr` to match) -- so arrow keys
    // stay physical too, rather than swapping under RTL for a layout that never actually flips.
    let dRow = 0;
    let dCol = 0;
    if (e.key === 'ArrowUp') dRow = -1;
    else if (e.key === 'ArrowDown') dRow = 1;
    else if (e.key === 'ArrowLeft') dCol = -1;
    else if (e.key === 'ArrowRight') dCol = 1;
    const next = this.nextInteractiveMatrixCell(row, col, dRow, dCol, rows, cols);
    this.focusedCell = next;
    this.announce(next);
  }

  private onCalendarKeyDown(e: KeyboardEvent): void {
    const { weekCount } = this.cachedCalendarGrid;
    if (weekCount === 0) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (this.focusedCell) this.emitCellClick(this.focusedCell);
      return;
    }
    if (!ARROW_KEYS.has(e.key)) return;
    e.preventDefault();
    if (!this.focusedCell || !('week' in this.focusedCell)) {
      const next = this.firstInteractiveCalendarCell(weekCount);
      if (!next) return;
      this.focusedCell = next;
      this.announce(next);
      return;
    }
    const { week, weekday } = this.focusedCell;
    // Same reasoning as onMatrixKeyDown: columnXFor() always places week 0 at the physical left, so
    // arrow keys stay physical rather than swapping under RTL for a calendar grid that never mirrors.
    let dWeek = 0;
    let dWeekday = 0;
    if (e.key === 'ArrowUp') dWeekday = -1;
    else if (e.key === 'ArrowDown') dWeekday = 1;
    else if (e.key === 'ArrowLeft') dWeek = -1;
    else if (e.key === 'ArrowRight') dWeek = 1;
    const next = this.nextInteractiveCalendarCell(week, weekday, dWeek, dWeekday, weekCount);
    this.focusedCell = next;
    this.announce(next);
  }

  /** Cache of resolved colors for the current draw pass, cleared at the top
   *  of drawCalendar()/drawMatrix() so a theme change is always picked up on
   *  the very next full redraw, while repeated identical cellColor() outputs
   *  within the same pass resolve only once. */
  private canvasColorCache = new Map<string, string>();
  private colorProbe?: HTMLSpanElement;

  /** Resolves a cellColor() return value that may contain a CSS custom
   *  property (or any other CSS color syntax the browser understands, e.g.
   *  color-mix()) into a literal color canvas's fillStyle can actually use --
   *  fillStyle silently no-ops on an unparseable string, per the Canvas 2D
   *  spec, leaving whatever the previous cell painted. Falls back to
   *  noDataFill() for a genuinely invalid color. */
  private resolveCanvasColor(value: string, cs: CSSStyleDeclaration): string {
    if (!value.includes('var(')) return value;
    const cached = this.canvasColorCache.get(value);
    if (cached !== undefined) return cached;
    if (!this.colorProbe) {
      this.colorProbe = document.createElement('span');
      this.colorProbe.style.cssText =
        'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none;';
      this.shadowRoot!.appendChild(this.colorProbe);
    }
    this.colorProbe.style.color = value;
    const resolved = this.colorProbe.style.color ? getComputedStyle(this.colorProbe).color : this.noDataFill(cs);
    this.canvasColorCache.set(value, resolved);
    return resolved;
  }

  /** Positions represented by the optional DOM accessibility overlay. The
   * canvas paints empty calendar grid positions too, so those positions get a
   * real date and a no-data announcement just like pointer/keyboard hit tests. */
  private accessibleCellPositions(): CellPos[] {
    if (this.mode === 'calendar') {
      const { weekCount } = this.cachedCalendarGrid;
      const positions: CalendarCellPos[] = [];
      for (let week = 0; week < weekCount; week++) {
        for (let weekday = 0; weekday < 7; weekday++) {
          const pos = this.calendarPos(week, weekday);
          if (this.isCellInteractive(pos)) positions.push(pos);
        }
      }
      return positions;
    }

    const positions: MatrixCellPos[] = [];
    for (let row = 0; row < this.rowLabels.length; row++) {
      for (let col = 0; col < this.colLabels.length; col++) {
        const pos = { row, col };
        if (this.isCellInteractive(pos)) positions.push(pos);
      }
    }
    return positions;
  }

  private accessibleCellKey(pos: CellPos): string {
    return 'week' in pos ? `calendar-${pos.week}-${pos.weekday}` : `matrix-${pos.row}-${pos.col}`;
  }

  private accessibleCellAtKey(key: string): CellPos | null {
    return (
      this.accessibleCellPositions().find((pos) => this.accessibleCellKey(pos) === key) ?? null
    );
  }

  private focusAccessibleCell(pos: CellPos | null): void {
    if (!pos) return;
    void this.updateComplete.then(() => {
      const button = [...(this.shadowRoot?.querySelectorAll<HTMLButtonElement>('[part="cell"]') ?? [])].find(
        (candidate) => candidate.dataset['cellKey'] === this.accessibleCellKey(pos),
      );
      button?.focus();
    });
  }

  private onAccessibleCellFocus = (e: FocusEvent): void => {
    const key = (e.currentTarget as HTMLElement).dataset['cellKey'];
    const pos = key ? this.accessibleCellAtKey(key) : null;
    if (!pos) return;
    this.focusedCell = pos;
    this.announce(pos);
  };

  private onAccessibleCellClick = (e: MouseEvent): void => {
    const key = (e.currentTarget as HTMLElement).dataset['cellKey'];
    const pos = key ? this.accessibleCellAtKey(key) : null;
    if (!pos) return;
    this.focusedCell = pos;
    this.announce(pos);
    this.emitCellClick(pos);
  };

  private onAccessibleCellKeyDown = (e: KeyboardEvent): void => {
    if (!ARROW_KEYS.has(e.key)) return;
    const key = (e.currentTarget as HTMLElement).dataset['cellKey'];
    const pos = key ? this.accessibleCellAtKey(key) : null;
    if (!pos) return;
    e.preventDefault();
    this.focusedCell = pos;
    this.onKeyDown(e);
    this.focusAccessibleCell(this.focusedCell);
  };

  private renderAccessibleCells(): TemplateResult {
    if (!this.accessibleCells) return html``;
    const positions = this.accessibleCellPositions();
    const tabStop = this.focusedCell ?? positions[0] ?? null;
    return html`
      <div part="cells">
        ${positions.map((pos) => {
          const rect = this.cellRect(pos);
          const key = this.accessibleCellKey(pos);
          return html`
            <button
              part="cell"
              class="cell"
              type="button"
              data-cell-key=${key}
              aria-label=${this.resolveCellText(pos)}
              aria-pressed=${this.isSelectedPos(pos) ? 'true' : 'false'}
              tabindex=${this.samePos(tabStop, pos) ? '0' : '-1'}
              style=${styleMap({
                insetInlineStart: `${rect.x}px`,
                insetBlockStart: `${rect.y}px`,
                inlineSize: `${rect.w}px`,
                blockSize: `${rect.h}px`,
              })}
              @focus=${this.onAccessibleCellFocus}
              @click=${this.onAccessibleCellClick}
              @keydown=${this.onAccessibleCellKeyDown}
            ></button>
          `;
        })}
      </div>
    `;
  }

  /**
   * The legend's color description: the discrete `legendStops` key when one is supplied, the
   * original `--lr-heatmap-scale-lo`/`-hi` gradient bar and its endpoint labels otherwise. An
   * unset (or empty) `legendStops` therefore reproduces the pre-`legendStops` markup exactly.
   */
  private renderLegendScale(range: [number, number] | null): TemplateResult {
    const stops = this.legendStops;
    if (stops && stops.length > 0) {
      return html`${stops.map(
        (stop) => html`
          <span part="legend-stop">
            ${
              // A template guard, deliberately not just `styleMap({ background: stop.color })` with
              // an optional `color`: styleMap skips a nullish value silently, which is a legal
              // no-op that would still leave the swatch's own 0.6rem box sitting in the row. A
              // caption-only stop has to omit the element itself.
              stop.color
                ? html`<span part="legend-swatch" style=${styleMap({ background: stop.color })}></span>`
                : nothing
            }
            <span part="legend-stop-label">${stop.label ?? this.formatNumericValue(stop.value)}</span>
          </span>
        `,
      )}`;
    }
    // The indentation here, and the `<div part="legend">`-hugging interpolation in render(),
    // are deliberate: together they reproduce this branch's markup — whitespace included —
    // exactly as it was emitted inline before `legendStops` introduced the branch.
    return html`
          <span part="legend-lo">${range ? this.formatNumericValue(range[0]) : ''}</span>
          <span class="bar"></span>
          <span part="legend-hi">${range ? this.formatNumericValue(range[1]) : ''}</span>`;
  }

  override render(): TemplateResult {
    const range = this.cachedValueRange;
    const labeledAnnotations = this.annotations.filter((a) => a.label);
    return html`
      <div part="base">
        <canvas
          part="canvas"
          tabindex=${this.accessibleCells ? '-1' : '0'}
          aria-hidden=${this.accessibleCells ? 'true' : nothing}
          @pointermove=${this.onPointerMove}
          @pointerleave=${this.onPointerLeave}
          @click=${this.onCanvasClick}
          @keydown=${this.onKeyDown}
        ></canvas>
        ${this.renderAccessibleCells()}
        <div
          part="tooltip"
          ?hidden=${!this.hoverCell}
          style=${styleMap(this.hoverCell ? this.tooltipStyle(this.hoverCell) : {})}
        >
          ${this.hoverCell ? this.resolveCellText(this.hoverCell) : ''}
        </div>
        <div part="live-region" class="sr-only" role="status" aria-live="polite">${this.liveText}</div>
        <div part="legend">${this.renderLegendScale(range)}
          <span part="legend-value-label">${this.localizedValueLabel()}</span>
          ${labeledAnnotations.map(
            (a) => html`<span part="legend-annotation"><span class="ring-swatch"></span>${a.label}</span>`,
          )}
        </div>
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-heatmap': LyraHeatmap;
  }
}
