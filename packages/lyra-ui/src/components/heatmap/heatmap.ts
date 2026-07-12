import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { srOnly } from '../../internal/a11y.js';
import { linearAlpha, minMax, sqrtStep } from './heatmap-scale.js';
import { styles } from './heatmap.styles.js';
import { buildCalendarGrid, parseIsoDate, quartileBucket, type CalendarDay } from './calendar-grid.js';

const PAD_LEFT = 60;
const PAD_TOP = 20;
const FALLBACK_NO_DATA_FILL = 'rgba(128,128,128,0.25)';
const RAMP_STEPS = 7;
const FALLBACK_SCALE_LO = '#cde2fb';
const FALLBACK_SCALE_HI = '#0969da';
const FALLBACK_LABEL_FONT = '10px sans-serif';
const CAL_PAD_LEFT = 28;
const CAL_LABEL_H = 16;
const CAL_CELL = 11;
const CAL_GAP = 2;
const DEFAULT_BUCKET_COUNT = 5;
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

const warnedInvalidBucketCounts = new Set<number>();

function warnInvalidBucketCount(value: number): void {
  if (warnedInvalidBucketCounts.has(value)) return;
  warnedInvalidBucketCounts.add(value);
  console.warn(
    `<lyra-heatmap> received a non-finite bucket-count (${value}); falling back to ${DEFAULT_BUCKET_COUNT}.`,
  );
}

/**
 * Normalizes `bucketCount` to a finite integer >= 2. `Math.max(2, bucketCount)`
 * alone stays `NaN` for a non-numeric `bucket-count` attribute (`Math.max`
 * propagates `NaN`), which silently zeroes out the ramp array and makes every
 * cell keep whatever `fillStyle` the previous draw left. A fractional count
 * is floored rather than passed through as-is, so the ramp array's length
 * (built via `Array.from({ length: buckets }, ...)`, which truncates a
 * fractional `length`) always agrees with the index `quartileBucket` computes
 * from the same `buckets` value.
 */
function resolveBucketCount(bucketCount: number): number {
  if (!Number.isFinite(bucketCount)) {
    warnInvalidBucketCount(bucketCount);
    return DEFAULT_BUCKET_COUNT;
  }
  return Math.max(2, Math.floor(bucketCount));
}

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

/**
 * `<lyra-heatmap>` — a Canvas heatmap with a DPR-aware, resize-aware redraw
 * loop, in one of two `mode`s:
 *
 * - `"matrix"` (default): a `rowLabels` x `colLabels` grid of `values`. `-1`
 *   (or any non-finite value) is treated as "no data". `scale="sqrt"`
 *   compresses the ramp via `sqrtStep()` so one heavy cell doesn't wash out
 *   the rest; the default `"linear"` scale maps linearly instead. `scale`
 *   only affects matrix mode — calendar mode always buckets by quartile.
 * - `"calendar"`: a GitHub-style Sunday-Saturday x week grid built from
 *   `days`, colored by `quartileBucket()` into `bucketCount` buckets. As in
 *   matrix mode, a cell whose `value` is negative or non-finite is treated
 *   as "no data" rather than being bucketed.
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
 * @customElement lyra-heatmap
 * @event lyra-cell-click - Fired on click, or Enter/Space on the
 * focused/hovered cell. `detail: { row, col, value }` in matrix mode,
 * `detail: { date, value }` in calendar mode. `cellText` overrides the
 * built-in English "Row X, Col Y: value" / "Mon DD: value" template used for
 * both the hover tooltip and the keyboard live-region announcement.
 * @csspart base, canvas, tooltip, live-region, legend, legend-lo, legend-hi, legend-annotation
 */
export class LyraHeatmap extends LyraElement {
  static styles = [LyraElement.styles, styles, srOnly];

  @property({ attribute: false }) rowLabels: string[] = [];
  @property({ attribute: false }) colLabels: string[] = [];
  @property({ attribute: false }) values: number[][] = [];
  @property({ type: Number, attribute: 'cell-size' }) cellSize = 22;
  @property({ attribute: 'value-label' }) valueLabel = 'value';
  @property() scale: 'linear' | 'sqrt' = 'linear';
  /**
   * When set, `cellSize` is derived from the host's measured `clientWidth`
   * on every draw (including ResizeObserver-triggered redraws) instead of
   * the fixed `cell-size` attribute, so the grid actually fills the
   * available width. Without this, canvas dimensions are computed purely
   * from `PAD_LEFT + cols * cellSize`, so a resize-triggered redraw is a
   * geometric no-op.
   */
  @property({ type: Boolean, attribute: 'fit-to-width' }) fitToWidth = false;
  @property() mode: 'matrix' | 'calendar' = 'matrix';
  @property({ attribute: false }) days: CalendarDay[] = [];
  @property({ attribute: 'bucket-count', type: Number }) bucketCount = DEFAULT_BUCKET_COUNT;
  /** Cells to ring-highlight — `row`/`col` in matrix mode, `date` in calendar mode. See `HeatmapAnnotation`. */
  @property({ attribute: false }) annotations: HeatmapAnnotation[] = [];
  /** Formats the per-cell tooltip and keyboard live-region text — receives the cell position
   *  (`MatrixCellPos` in matrix mode, `CalendarCellPos` in calendar mode) and its value. Falls back to
   *  the built-in English "Row X, Col Y: value" / "Mon DD: value" template when unset. */
  @property({ attribute: false }) cellText?: (pos: MatrixCellPos | CalendarCellPos, value: number) => string;

  @query('canvas') private canvas?: HTMLCanvasElement;
  private resizeObserver?: ResizeObserver;
  private dprQuery?: MediaQueryList;
  /** The current value range, refreshed once per update cycle by `willUpdate()`. See `computeValueRange()`. */
  private cachedValueRange: [number, number] | null = null;

  /** The cell currently under the pointer (`null` when not hovering one) — drives `[part="tooltip"]`. */
  @state() private hoverCell: CellPos | null = null;
  /** The roving keyboard-focus cell cursor, moved by arrow keys — drives the
   *  canvas-drawn focus ring and the `[part="live-region"]` announcement. */
  @state() private focusedCell: CellPos | null = null;
  /** Text of the visually-hidden `aria-live="polite"` status announcement, refreshed on every focus move. */
  @state() private liveText = '';

  connectedCallback(): void {
    super.connectedCallback();
    this.resizeObserver = new ResizeObserver(() => this.draw());
    this.resizeObserver.observe(this);
    this.watchDpr();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
    this.dprQuery?.removeEventListener('change', this.onDprChange);
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

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('mode') || changed.has('rowLabels') || changed.has('colLabels') || changed.has('days')) {
      // The previous focus/hover cursor may no longer address a real cell
      // once the grid's shape (or mode) changes out from under it —
      // stroking a focus ring at a stale (row, col)/(week, weekday), or
      // leaving the live region announcing a stale value, would be actively
      // misleading, so drop both instead. Reactive-property writes belong in
      // willUpdate() (not updated()), which folds them into this same
      // render rather than scheduling a whole extra update pass.
      this.focusedCell = null;
      this.hoverCell = null;
      this.liveText = '';
    }
    this.cachedValueRange = this.computeValueRange();
    const bounds = this.cachedValueRange;
    const range = bounds ? `${bounds[0]}–${bounds[1]}` : 'no data';
    this.setAttribute('role', 'group');
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

  protected updated(): void {
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

  private drawCalendar(): void {
    if (!this.canvas) return;
    const { cells, weekCount, monthLabels } = buildCalendarGrid(this.days);
    const w = CAL_PAD_LEFT + Math.max(1, weekCount) * (CAL_CELL + CAL_GAP);
    const h = CAL_LABEL_H + 7 * (CAL_CELL + CAL_GAP);
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const sortedValues = cells
      .map((c) => c.value)
      .filter((v) => Number.isFinite(v) && v >= 0)
      .sort((a, b) => a - b);
    const [scaleLo, scaleHi] = this.scaleEndpoints();
    const loRgb = resolveRgb(scaleLo, FALLBACK_SCALE_LO);
    const hiRgb = resolveRgb(scaleHi, FALLBACK_SCALE_HI);
    const buckets = resolveBucketCount(this.bucketCount);
    const ramp = Array.from({ length: buckets }, (_, i) => mixRgb(loRgb, hiRgb, i / (buckets - 1)));
    const noDataFill = this.noDataFill();

    for (const cell of cells) {
      const x = CAL_PAD_LEFT + cell.week * (CAL_CELL + CAL_GAP);
      const y = CAL_LABEL_H + cell.weekday * (CAL_CELL + CAL_GAP);
      ctx.fillStyle =
        cell.value < 0 || !Number.isFinite(cell.value)
          ? noDataFill
          : ramp[quartileBucket(cell.value, sortedValues, buckets)]!;
      ctx.fillRect(x, y, CAL_CELL, CAL_CELL);
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
        const x = CAL_PAD_LEFT + match.week * (CAL_CELL + CAL_GAP);
        const y = CAL_LABEL_H + match.weekday * (CAL_CELL + CAL_GAP);
        ctx.strokeRect(x + 0.5, y + 0.5, CAL_CELL - 1, CAL_CELL - 1);
      }
    }

    // Keyboard focus ring, redrawn on top of the fill pass (and any
    // annotation rings) on every draw.
    if (this.focusedCell && 'week' in this.focusedCell) {
      const { week, weekday } = this.focusedCell;
      if (week < weekCount && weekday < 7) {
        ctx.lineWidth = RING_LINE_WIDTH;
        ctx.strokeStyle = this.focusRingColor();
        const x = CAL_PAD_LEFT + week * (CAL_CELL + CAL_GAP);
        const y = CAL_LABEL_H + weekday * (CAL_CELL + CAL_GAP);
        ctx.strokeRect(x + 0.5, y + 0.5, CAL_CELL - 1, CAL_CELL - 1);
      }
    }

    ctx.fillStyle = this.labelColor();
    ctx.font = this.labelFont();
    for (const m of monthLabels) {
      ctx.fillText(m.label, CAL_PAD_LEFT + m.week * (CAL_CELL + CAL_GAP), CAL_LABEL_H - 4);
    }
    const WEEKDAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
    WEEKDAY_LABELS.forEach((label, weekday) => {
      if (label) ctx.fillText(label, 2, CAL_LABEL_H + weekday * (CAL_CELL + CAL_GAP) + CAL_CELL - 1);
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
    const [scaleLo, scaleHi] = this.scaleEndpoints();
    const loRgb = resolveRgb(scaleLo, FALLBACK_SCALE_LO);
    const hiRgb = resolveRgb(scaleHi, FALLBACK_SCALE_HI);
    const ramp = Array.from({ length: RAMP_STEPS }, (_, i) => mixRgb(loRgb, hiRgb, i / (RAMP_STEPS - 1)));
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
          const step = sqrtStep(v, hi, RAMP_STEPS);
          ctx.fillStyle = step < 0 ? noDataFill : ramp[step]!;
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
    return { row, col };
  }

  private hitTestCalendar(x: number, y: number): CalendarCellPos | null {
    const { weekCount } = buildCalendarGrid(this.days);
    if (weekCount === 0) return null;
    const week = Math.floor((x - CAL_PAD_LEFT) / (CAL_CELL + CAL_GAP));
    const weekday = Math.floor((y - CAL_LABEL_H) / (CAL_CELL + CAL_GAP));
    if (week < 0 || week >= weekCount || weekday < 0 || weekday > 6) return null;
    return { week, weekday };
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
    const { cells, firstWeekStart } = buildCalendarGrid(this.days);
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
      return {
        x: CAL_PAD_LEFT + pos.week * (CAL_CELL + CAL_GAP),
        y: CAL_LABEL_H + pos.weekday * (CAL_CELL + CAL_GAP),
        w: CAL_CELL,
        h: CAL_CELL,
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

  private onPointerMove = (e: PointerEvent): void => {
    this.hoverCell = this.hitTest(e.offsetX, e.offsetY);
  };

  private onPointerLeave = (): void => {
    this.hoverCell = null;
  };

  private onCanvasClick = (e: MouseEvent): void => {
    // Prefer the click's own position; fall back to whatever's already
    // keyboard-focused (e.g. a synthetic click dispatched via
    // HTMLElement.click(), which carries no real coordinates).
    const pos = this.hitTest(e.offsetX, e.offsetY) ?? this.focusedCell;
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
    // The first arrow keypress just moves focus onto the grid (at the
    // top-left cell) rather than also applying that keypress's delta —
    // otherwise ArrowRight from "unfocused" would land on column 1,
    // silently skipping column 0.
    if (!this.focusedCell || !('row' in this.focusedCell)) {
      const next: MatrixCellPos = { row: 0, col: 0 };
      this.focusedCell = next;
      this.announce(next);
      return;
    }
    const { row, col } = this.focusedCell;
    let next: MatrixCellPos = { row, col };
    if (e.key === 'ArrowUp') next = { row: Math.max(0, row - 1), col };
    else if (e.key === 'ArrowDown') next = { row: Math.min(rows - 1, row + 1), col };
    else if (e.key === 'ArrowLeft') next = { row, col: Math.max(0, col - 1) };
    else if (e.key === 'ArrowRight') next = { row, col: Math.min(cols - 1, col + 1) };
    this.focusedCell = next;
    this.announce(next);
  }

  private onCalendarKeyDown(e: KeyboardEvent): void {
    const { weekCount } = buildCalendarGrid(this.days);
    if (weekCount === 0) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (this.focusedCell) this.emitCellClick(this.focusedCell);
      return;
    }
    if (!ARROW_KEYS.has(e.key)) return;
    e.preventDefault();
    if (!this.focusedCell || !('week' in this.focusedCell)) {
      const next: CalendarCellPos = { week: 0, weekday: 0 };
      this.focusedCell = next;
      this.announce(next);
      return;
    }
    const { week, weekday } = this.focusedCell;
    let next: CalendarCellPos = { week, weekday };
    if (e.key === 'ArrowUp') next = { week, weekday: Math.max(0, weekday - 1) };
    else if (e.key === 'ArrowDown') next = { week, weekday: Math.min(6, weekday + 1) };
    else if (e.key === 'ArrowLeft') next = { week: Math.max(0, week - 1), weekday };
    else if (e.key === 'ArrowRight') next = { week: Math.min(weekCount - 1, week + 1), weekday };
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

defineElement('heatmap', LyraHeatmap);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-heatmap': LyraHeatmap;
  }
}
