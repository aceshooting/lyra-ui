import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { srOnly } from '../../internal/a11y.js';
import { linearAlpha, linearBucket, minMax, sqrtStep } from './heatmap-scale.js';
import { styles } from './heatmap.styles.js';
import { buildCalendarGrid, parseIsoDate, quartileBucket, type CalendarCell, type CalendarDay } from './calendar-grid.js';

const PAD_LEFT = 60;
const PAD_TOP = 20;
const FALLBACK_NO_DATA_FILL = 'rgba(128,128,128,0.25)';
const RAMP_STEPS = 7;
const FALLBACK_SCALE_LO = '#cde2fb';
const FALLBACK_SCALE_HI = '#0969da';
const FALLBACK_LABEL_FONT = '10px sans-serif';
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
const ARROW_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const MS_PER_DAY = 86_400_000;

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
}
type CellPos = MatrixCellPos | CalendarCellPos;

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

const HEX_RE = /^([0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB_RE = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i;

/**
 * Parses a strict `#rgb` or `#rrggbb` hex string into an `[r, g, b]` triple,
 * or `null` if `hex` isn't one (rather than silently coercing an unparsable
 * string to `0` via `Number.parseInt(..., 16)` returning `NaN`).
 */
export function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.trim().replace('#', '');
  if (!HEX_RE.test(clean)) return null;
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = Number.parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function parseRgbString(value: string): [number, number, number] | null {
  const match = RGB_RE.exec(value);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

let scratchCtx: CanvasRenderingContext2D | null | undefined;

/** A detached 1x1 canvas used solely to normalize CSS color strings. */
function getScratchCtx(): CanvasRenderingContext2D | null {
  if (scratchCtx === undefined) {
    scratchCtx = document.createElement('canvas').getContext('2d');
  }
  return scratchCtx;
}

const warnedInvalidColors = new Set<string>();

function warnInvalidColor(color: string): void {
  if (warnedInvalidColors.has(color)) return;
  warnedInvalidColors.add(color);
  console.warn(
    `<lyra-heatmap> could not parse "${color}" (set via --lyra-heatmap-scale-lo/-hi) as a CSS ` +
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
  if (!Number.isFinite(bucketCount)) {
    return DEFAULT_BUCKET_COUNT;
  }
  return Math.min(MAX_BUCKET_COUNT, Math.max(2, Math.floor(bucketCount)));
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
 * `oklch()`, a named color, etc. — to an `[r, g, b]` triple.
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
export function resolveRgb(color: string, fallbackHex: string): [number, number, number] {
  const fallback = hexToRgb(fallbackHex) ?? [0, 0, 0];
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

/** Linearly interpolates between two already-resolved `[r, g, b]` triples at `t` in `[0, 1]`. */
function mixRgb(from: [number, number, number], to: [number, number, number], t: number): string {
  const clamped = Math.min(1, Math.max(0, t));
  const r = Math.round(from[0] + (to[0] - from[0]) * clamped);
  const g = Math.round(from[1] + (to[1] - from[1]) * clamped);
  const b = Math.round(from[2] + (to[2] - from[2]) * clamped);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Linearly interpolates between two CSS colors (any valid syntax) at `t` in `[0, 1]`. */
export function mixColor(fromColor: string, toColor: string, t: number): string {
  return mixRgb(resolveRgb(fromColor, FALLBACK_SCALE_LO), resolveRgb(toColor, FALLBACK_SCALE_HI), t);
}

export type LyraHeatmapCellClickDetail =
  | { date: string; value: number }
  | { row: number; col: number; value: number };

export interface LyraHeatmapEventMap {
  'lyra-cell-click': CustomEvent<LyraHeatmapCellClickDetail>;
}
/**
 * `<lyra-heatmap>` — a Canvas heatmap with a DPR-aware, resize-aware redraw
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
 * The sequential color ramp's endpoints are read from the
 * `--lyra-heatmap-scale-lo`/`-hi` custom properties (declared in
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
 * `lyra-cell-click`. `annotations` additionally strokes a ring around
 * specific cells (e.g. to call out an anomaly), each one optionally
 * surfaced in the legend too via `[part="legend-annotation"]`.
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
 * @customElement lyra-heatmap
 * @event lyra-cell-click - Fired on click, or Enter/Space on the
 * focused/hovered cell. `detail: { row, col, value }` in matrix mode,
 * `detail: { date, value }` in calendar mode. `cellText` overrides the
 * built-in English "Row X, Col Y: value" / "Mon DD: value" template used for
 * both the hover tooltip and the keyboard live-region announcement.
 * @csspart base - The heatmap wrapper.
 * @csspart canvas - The heatmap canvas.
 * @csspart tooltip - The hover tooltip.
 * @csspart live-region - The visually hidden keyboard announcement region.
 * @csspart legend - The color legend.
 * @csspart legend-lo - The low legend endpoint.
 * @csspart legend-hi - The high legend endpoint.
 * @csspart legend-annotation - An annotation label.
 */
export class LyraHeatmap extends LyraElement<LyraHeatmapEventMap> {
  static styles = [LyraElement.styles, styles, srOnly];

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
    this._cellSize = value;
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
  @property() scale: 'linear' | 'sqrt' = 'linear';
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
  @property() mode: 'matrix' | 'calendar' = 'matrix';
  @property({ attribute: false }) days: CalendarDay[] = [];
  /**
   * Calendar mode only (no-op in matrix mode): anchors the calendar grid at
   * a different weekday instead of always Sunday — `0`-`6`, same numbering
   * as `CalendarCellPos.weekday` (`0` Sunday .. `6` Saturday, matching
   * `CalendarCell.weekday`'s existing convention). Threaded into
   * `buildCalendarGrid()`. Defaults to `0` (Sunday), unchanged from before
   * this property existed.
   */
  @property({ type: Number, attribute: 'first-day-of-week' }) firstDayOfWeek = 0;
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
  /** Formats the per-cell tooltip and keyboard live-region text — receives the cell position
   *  (`MatrixCellPos` in matrix mode, `CalendarCellPos` in calendar mode) and its value. Falls back to
   *  the built-in English "Row X, Col Y: value" / "Mon DD: value" template when unset. */
  @property({ attribute: false }) cellText?: (pos: MatrixCellPos | CalendarCellPos, value: number) => string;
  /** Opts individual cells out of the interaction model — receives the cell position and its
   *  value, return `false` to make that cell present-but-non-interactive (no hover tooltip,
   *  click, or keyboard roving-focus stop), without losing the layout/color-ramp machinery. Lets
   *  a consumer omit a future/out-of-range date from interaction, or mark a zero-value cell as
   *  non-interactive, without ~300+ meaningless keyboard tab stops on a dense grid. Unset (the
   *  default) keeps every cell interactive, unchanged from before this property existed. */
  @property({ attribute: false }) cellInteractive?: (pos: MatrixCellPos | CalendarCellPos, value: number) => boolean;
  /** A discrete array (≥2) of CSS colors used as exact ramp steps instead of linearly
   *  interpolating between the two `--lyra-heatmap-scale-lo`/`-hi` endpoints — lets a consumer
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
  private cachedRamp: {
    key: string;
    colors: string[];
    loRgb: [number, number, number];
    hiRgb: [number, number, number];
  } | null = null;

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

  connectedCallback(): void {
    super.connectedCallback();
    this.resizeObserver = new ResizeObserver(this.scheduleDraw);
    this.resizeObserver.observe(this);
    this.watchDpr();
    this.watchTheme();
  }

  disconnectedCallback(): void {
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

  protected willUpdate(changed: PropertyValues): void {
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
    // Calendar-mode grid layout depends only on `days`/`firstDayOfWeek` (not
    // `mode`) — rebuilt here, once per cycle, instead of independently by
    // every call site (see `cachedCalendarGrid`'s doc comment).
    if (changed.has('days') || changed.has('firstDayOfWeek') || !this.hasUpdated) {
      this.cachedCalendarGrid = buildCalendarGrid(this.days, this.firstDayOfWeek);
      this.cachedCalendarSortedValues = this.cachedCalendarGrid.cells
        .map((cell) => cell.value)
        .filter((value) => Number.isFinite(value) && value >= 0)
        .sort((a, b) => a - b);
      this.cachedCalendarCellsByPos = new Map(
        this.cachedCalendarGrid.cells.map((cell) => [`${cell.week}:${cell.weekday}`, cell]),
      );
    }
    if (!this.hasUpdated) {
      this.authorSuppliedRole = this.hasAttribute('role');
      this.authorSuppliedAriaLabel = this.hasAttribute('aria-label');
    }
    if (changed.has('colorSteps') || !this.hasUpdated) {
      if (this.colorSteps && this.colorSteps.length >= 2) {
        this.style.setProperty('--lyra-heatmap-color-steps-gradient', `linear-gradient(to right, ${this.colorSteps.join(', ')})`);
      } else {
        this.style.removeProperty('--lyra-heatmap-color-steps-gradient');
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
    const range = bounds ? `${bounds[0]}–${bounds[1]}` : 'no data';
    // Only default role/aria-label when the author hasn't already supplied
    // one — the canvas is a genuinely focusable/interactive control
    // (tabindex="0", click/keydown handlers) plus a live role="status"
    // region, so unconditionally forcing a role here would tell assistive
    // tech to flatten the whole subtree, hiding both from the accessibility
    // tree; it would also silently overwrite any author-supplied
    // role/aria-label on every update.
    if (!this.authorSuppliedRole) this.setAttribute('role', 'group');
    if (!this.authorSuppliedAriaLabel) {
      if (this.mode === 'calendar') {
        this.setAttribute(
          'aria-label',
          `Calendar heatmap of ${this.days.length} days, ${this.valueLabel} range ${range}`,
        );
      } else {
        const rows = this.rowLabels.length;
        const cols = this.colLabels.length;
        this.setAttribute(
          'aria-label',
          `Heatmap of ${rows} × ${cols} cells, ${this.valueLabel} range ${range}`,
        );
      }
    }
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

  protected updated(changed: PropertyValues): void {
    if (
      [
        'values',
        'rowLabels',
        'colLabels',
        'cellSize',
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
        'focusedCell',
        'colorSteps',
      ].some((name) => changed.has(name))
    ) {
      this.draw();
    }
  }

  /** Redraws canvas content after an upstream token or theme change. */
  refreshTheme(): void {
    this.draw();
  }

  /** Reads the customizable ramp endpoints off the host's computed style. */
  private scaleEndpoints(): [string, string] {
    const cs = getComputedStyle(this);
    const lo = cs.getPropertyValue('--lyra-heatmap-scale-lo').trim() || FALLBACK_SCALE_LO;
    const hi = cs.getPropertyValue('--lyra-heatmap-scale-hi').trim() || FALLBACK_SCALE_HI;
    return [lo, hi];
  }

  /** Resolves the `--lyra-color-text-quiet` chrome token for axis labels. */
  private labelColor(): string {
    return getComputedStyle(this).getPropertyValue('--lyra-color-text-quiet').trim() || '#6b7280';
  }

  /** Reads the customizable canvas axis/label font off the host's computed style. */
  private labelFont(): string {
    return getComputedStyle(this).getPropertyValue('--lyra-heatmap-label-font').trim() || FALLBACK_LABEL_FONT;
  }

  /** Reads the customizable no-data cell fill off the host's computed style. */
  private noDataFill(): string {
    return getComputedStyle(this).getPropertyValue('--lyra-heatmap-no-data-fill').trim() || FALLBACK_NO_DATA_FILL;
  }

  /** Reads the customizable canvas-drawn keyboard-focus-ring stroke color off the host's computed style. */
  private focusRingColor(): string {
    return (
      getComputedStyle(this).getPropertyValue('--lyra-heatmap-focus-ring-color').trim() || FALLBACK_FOCUS_RING_COLOR
    );
  }

  /** Reads the customizable canvas-drawn annotation-ring stroke color off the host's computed style. */
  private annotationColor(): string {
    return (
      getComputedStyle(this).getPropertyValue('--lyra-heatmap-annotation-color').trim() || FALLBACK_ANNOTATION_COLOR
    );
  }

  private draw(): void {
    if (this.mode === 'calendar') this.drawCalendar();
    else this.drawMatrix();
  }

  private scheduleDraw = (): void => {
    if (this.drawRafId !== undefined) return;
    this.drawRafId = requestAnimationFrame(() => {
      this.drawRafId = undefined;
      if (this.isConnected) this.draw();
    });
  };

  private colorRamp(bucketCount: number): {
    colors: string[];
    loRgb: [number, number, number];
    hiRgb: [number, number, number];
  } {
    const steps = this.colorSteps;
    if (steps && steps.length >= 2) {
      const key = `steps ${steps.join(' ')}`;
      if (this.cachedRamp?.key === key) return this.cachedRamp;
      const colors = steps.map((c) => {
        const [r, g, b] = resolveRgb(c, FALLBACK_SCALE_LO);
        return `rgb(${r}, ${g}, ${b})`;
      });
      const loRgb = resolveRgb(steps[0]!, FALLBACK_SCALE_LO);
      const hiRgb = resolveRgb(steps[steps.length - 1]!, FALLBACK_SCALE_HI);
      this.cachedRamp = { key, colors, loRgb, hiRgb };
      return this.cachedRamp;
    }
    const [scaleLo, scaleHi] = this.scaleEndpoints();
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
      return Math.max(4, (hostWidth - CAL_PAD_LEFT) / weekCount - CAL_GAP);
    }
    return this.cellSize;
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
   * the calendar grid. Only indices 1, 3, and 5 (relative to `firstWeekStart`)
   * are filled in — matching today's sparse every-other-day label density —
   * the rest stay blank. `firstWeekStart` is always the UTC
   * `firstDayOfWeek`-weekday by construction (see `buildCalendarGrid()`), so
   * weekday index 0..6 is a fixed positional mapping relative to it (with the
   * default `firstDayOfWeek` of 0, that's the original Sun..Sat mapping,
   * unchanged); only the label *text* for indices 1/3/5 is derived here, via
   * `Intl.DateTimeFormat` on a real UTC date that actually falls on that
   * weekday, so it follows the runtime locale instead of a hardcoded English
   * array (see `calendarCellText()`'s tooltip text for the same pattern).
   */
  private weekdayLabels(firstWeekStart: Date): string[] {
    const formatter = new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' });
    const labels = ['', '', '', '', '', '', ''];
    for (const weekday of [1, 3, 5]) {
      labels[weekday] = formatter.format(new Date(firstWeekStart.getTime() + weekday * MS_PER_DAY));
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

    // Normalize at the allocation boundary as a final guard even though the
    // public accessor and attribute converter already normalize their inputs.
    const buckets = normalizeBucketCount(this.bucketCount);
    const ramp = this.colorRamp(buckets).colors;
    const noDataFill = this.noDataFill();
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
        if (value < 0 || !Number.isFinite(value)) {
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
      ctx.strokeStyle = this.annotationColor();
      for (const ann of this.annotations) {
        if (ann.date == null) continue;
        const match = cells.find((c) => c.date === ann.date);
        if (!match) continue;
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
        ctx.strokeStyle = this.focusRingColor();
        const x = this.columnXFor(week);
        const y = this.rowYFor(weekday);
        ctx.strokeRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1);
      }
    }

    ctx.fillStyle = this.labelColor();
    ctx.font = this.labelFont();
    for (const m of monthLabels) {
      ctx.fillText(m.label, this.columnXFor(m.week), CAL_LABEL_H - 4);
    }
    const WEEKDAY_LABELS = this.weekdayLabels(firstWeekStart);
    WEEKDAY_LABELS.forEach((label, weekday) => {
      if (label) ctx.fillText(label, 2, this.rowYFor(weekday) + cellSize - 1);
    });
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
      return Math.max(4, (hostWidth - PAD_LEFT) / cols);
    }
    return this.cellSize;
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

    const bounds = this.cachedValueRange;
    const lo = bounds ? bounds[0] : 0;
    const hi = bounds ? bounds[1] : 1;
    const rampData = this.colorRamp(RAMP_STEPS);
    const ramp = rampData.colors;
    const { loRgb, hiRgb } = rampData;
    const noDataFill = this.noDataFill();

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = this.values[r]?.[c] ?? -1;
        const x = PAD_LEFT + c * cellSize;
        const y = PAD_TOP + r * cellSize;
        if (v < 0 || !Number.isFinite(v)) {
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
          // --lyra-heatmap-scale-lo/-hi.
          const t = linearAlpha(v, lo, hi);
          ctx.fillStyle = mixRgb(loRgb, hiRgb, t);
        }
        ctx.fillRect(x, y, cellSize - 1, cellSize - 1);
      }
    }

    // Annotation ring overlay, stroked after the fill pass so it reads
    // clearly over the data-driven cell color. Uses a dedicated
    // --lyra-heatmap-annotation-color token (defaults to --lyra-color-danger)
    // rather than any of the sequential ramp colors, since it needs to stay
    // visible regardless of which point on that ramp it's drawn over.
    if (this.annotations.length) {
      ctx.lineWidth = RING_LINE_WIDTH;
      ctx.strokeStyle = this.annotationColor();
      for (const ann of this.annotations) {
        if (ann.row == null || ann.col == null) continue;
        if (ann.row < 0 || ann.row >= rows || ann.col < 0 || ann.col >= cols) continue;
        const x = PAD_LEFT + ann.col * cellSize;
        const y = PAD_TOP + ann.row * cellSize;
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
        ctx.strokeStyle = this.focusRingColor();
        const x = PAD_LEFT + col * cellSize;
        const y = PAD_TOP + row * cellSize;
        ctx.strokeRect(x + 1, y + 1, cellSize - 3, cellSize - 3);
      }
    }

    ctx.fillStyle = this.labelColor();
    ctx.font = this.labelFont();
    this.rowLabels.forEach((label, r) => {
      ctx.fillText(label, 4, PAD_TOP + r * cellSize + cellSize / 2 + 3);
    });
    this.colLabels.forEach((label, c) => {
      ctx.fillText(label, PAD_LEFT + c * cellSize + 2, PAD_TOP - 6);
    });
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
        if (this.isCellInteractive({ week, weekday })) return { week, weekday };
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
      if (nw === w && nd === d) return { week, weekday };
      w = nw;
      d = nd;
      if (this.isCellInteractive({ week: w, weekday: d })) return { week: w, weekday: d };
    }
  }

  private hitTestCalendar(x: number, y: number): CalendarCellPos | null {
    const { weekCount } = this.cachedCalendarGrid;
    if (weekCount === 0) return null;
    const week = this.weekAtX(x, weekCount);
    const weekday = this.weekdayAtY(y);
    if (week === null || weekday === null) return null;
    const pos = { week, weekday };
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
  private calendarCellAt(pos: CalendarCellPos): { date: string; value: number } {
    const { cells, firstWeekStart } = this.cachedCalendarGrid;
    const match = cells.find((c) => c.week === pos.week && c.weekday === pos.weekday);
    if (match) return { date: match.date, value: match.value };
    const date = new Date(firstWeekStart.getTime() + (pos.week * 7 + pos.weekday) * MS_PER_DAY);
    return { date: date.toISOString().slice(0, 10), value: -1 };
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
    const rowLabel = this.rowLabels[pos.row] ?? `row ${pos.row + 1}`;
    const colLabel = this.colLabels[pos.col] ?? `col ${pos.col + 1}`;
    const v = this.values[pos.row]?.[pos.col];
    const valueText = v == null || v < 0 || !Number.isFinite(v) ? 'no data' : String(v);
    return `Row ${rowLabel}, Col ${colLabel}: ${valueText}`;
  }

  private calendarCellText(pos: CalendarCellPos): string {
    const { date, value } = this.calendarCellAt(pos);
    const label = parseIsoDate(date).toLocaleString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
    const valueText = value < 0 || !Number.isFinite(value) ? 'no data' : String(value);
    return `${label}: ${valueText}`;
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

  /** Refreshes the visually-hidden live-region text for a newly-focused cell. */
  private announce(pos: CellPos): void {
    this.liveText = this.resolveCellText(pos);
  }

  private emitCellClick(pos: CellPos): void {
    if ('week' in pos) {
      const { date, value } = this.calendarCellAt(pos);
      this.emit('lyra-cell-click', { date, value });
    } else {
      const value = this.values[pos.row]?.[pos.col] ?? -1;
      this.emit('lyra-cell-click', { row: pos.row, col: pos.col, value });
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

  render(): TemplateResult {
    const range = this.cachedValueRange;
    const labeledAnnotations = this.annotations.filter((a) => a.label);
    return html`
      <div part="base">
        <canvas
          part="canvas"
          tabindex="0"
          @pointermove=${this.onPointerMove}
          @pointerleave=${this.onPointerLeave}
          @click=${this.onCanvasClick}
          @keydown=${this.onKeyDown}
        ></canvas>
        <div
          part="tooltip"
          ?hidden=${!this.hoverCell}
          style=${styleMap(this.hoverCell ? this.tooltipStyle(this.hoverCell) : {})}
        >
          ${this.hoverCell ? this.resolveCellText(this.hoverCell) : ''}
        </div>
        <div part="live-region" class="sr-only" role="status" aria-live="polite">${this.liveText}</div>
        <div part="legend">
          <span part="legend-lo">${range ? range[0] : ''}</span>
          <span class="bar"></span>
          <span part="legend-hi">${range ? range[1] : ''}</span>
          <span>${this.valueLabel}</span>
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
    'lyra-heatmap': LyraHeatmap;
  }
}
