import { html, type TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { linearAlpha, minMax, sqrtStep } from './heatmap-scale.js';
import { styles } from './heatmap.styles.js';
import { buildCalendarGrid, quartileBucket, type CalendarDay } from './calendar-grid.js';

const PAD_LEFT = 60;
const PAD_TOP = 20;
const FALLBACK_NO_DATA_FILL = 'rgba(128,128,128,0.25)';
const RAMP_STEPS = 7;
const FALLBACK_SCALE_LO = '#cde2fb';
const FALLBACK_SCALE_HI = '#0969da';
const CAL_PAD_LEFT = 28;
const CAL_LABEL_H = 16;
const CAL_CELL = 11;
const CAL_GAP = 2;

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
 * `<lyra-heatmap>` — a Canvas matrix heatmap with a DPR-aware, resize-aware
 * redraw loop. `-1` cells are treated as "no data". The sequential color
 * ramp's endpoints are read from the `--lyra-heatmap-scale-lo`/`-hi` custom
 * properties (declared in `heatmap.styles.ts`) so hosts can retheme it —
 * canvas can't consume `var()` directly, so they're resolved once per draw
 * via `getComputedStyle`, then normalized to RGB by `resolveRgb()` (any
 * valid CSS color syntax, not just hex — see its doc comment).
 *
 * @customElement lyra-heatmap
 * @csspart base, canvas, legend
 */
export class LyraHeatmap extends LyraElement {
  static styles = [LyraElement.styles, styles];

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
  @property({ attribute: 'bucket-count', type: Number }) bucketCount = 5;

  @query('canvas') private canvas?: HTMLCanvasElement;
  private resizeObserver?: ResizeObserver;
  private dprQuery?: MediaQueryList;

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

  protected willUpdate(): void {
    const bounds = this.valueRange();
    const range = bounds ? `${bounds[0]}–${bounds[1]}` : 'no data';
    this.setAttribute('role', 'img');
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

  /** The real (non-no-data) value range across `values` (or `days` in calendar mode), or `null` if there is none. Shared by `willUpdate()`, `draw()`, and the legend. */
  private valueRange(): [number, number] | null {
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

  /** Reads the customizable no-data cell fill off the host's computed style. */
  private noDataFill(): string {
    return getComputedStyle(this).getPropertyValue('--lyra-heatmap-no-data-fill').trim() || FALLBACK_NO_DATA_FILL;
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
    const buckets = Math.max(2, this.bucketCount);
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

    ctx.fillStyle = this.labelColor();
    ctx.font = '10px sans-serif';
    for (const m of monthLabels) {
      ctx.fillText(m.label, CAL_PAD_LEFT + m.week * (CAL_CELL + CAL_GAP), CAL_LABEL_H - 4);
    }
    const WEEKDAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
    WEEKDAY_LABELS.forEach((label, weekday) => {
      if (label) ctx.fillText(label, 2, CAL_LABEL_H + weekday * (CAL_CELL + CAL_GAP) + CAL_CELL - 1);
    });
  }

  private drawMatrix(): void {
    if (!this.canvas) return;
    const rows = this.rowLabels.length;
    const cols = this.colLabels.length;
    let cellSize = this.cellSize;
    if (this.fitToWidth && cols > 0) {
      const hostWidth = this.clientWidth || PAD_LEFT + cols * this.cellSize;
      cellSize = Math.max(4, (hostWidth - PAD_LEFT) / cols);
    }
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

    const bounds = this.valueRange();
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

    ctx.fillStyle = this.labelColor();
    ctx.font = '10px sans-serif';
    this.rowLabels.forEach((label, r) => {
      ctx.fillText(label, 4, PAD_TOP + r * cellSize + cellSize / 2 + 3);
    });
    this.colLabels.forEach((label, c) => {
      ctx.fillText(label, PAD_LEFT + c * cellSize + 2, PAD_TOP - 6);
    });
  }

  render(): TemplateResult {
    const range = this.valueRange();
    return html`
      <div part="base">
        <canvas part="canvas"></canvas>
        <div part="legend">
          <span part="legend-lo">${range ? range[0] : ''}</span>
          <span class="bar"></span>
          <span part="legend-hi">${range ? range[1] : ''}</span>
          <span>${this.valueLabel}</span>
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
