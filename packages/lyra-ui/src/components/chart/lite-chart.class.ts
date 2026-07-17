import { html, svg, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { srOnly } from '../../internal/a11y.js';
import type { LyraLiveRegion } from '../live-region/live-region.class.js';
import '../live-region/live-region.class.js';
import { styles } from './lite-chart.styles.js';

export interface LiteSeries {
  label: string;
  data: (number | null)[];
  /** Defaults to a semantic categorical color, keyed by dataset index. */
  color?: string;
}

export type LyraLiteChartType = 'bar' | 'line';

/**
 * `'fit'` (default) squeezes the whole plot into the measured host width,
 * exactly as this component always behaved. `'scroll'` gives every bar a
 * fixed `barWidth` instead and lets the plot's content width exceed the
 * host's, making the host horizontally scrollable.
 */
export type LyraLiteChartLayout = 'fit' | 'scroll';

// The semantic variables are resolved by SVG/CSS at paint time, so changing a
// theme or color-scheme does not require a second JS-side draw pass.
const DEFAULT_PALETTE = [
  'var(--lyra-chart-color-1)',
  'var(--lyra-chart-color-2)',
  'var(--lyra-chart-color-3)',
  'var(--lyra-chart-color-4)',
  'var(--lyra-chart-color-5)',
  'var(--lyra-chart-color-6)',
  'var(--lyra-chart-color-7)',
  'var(--lyra-chart-color-8)',
];

const PAD_LEFT = 36;
const PAD_RIGHT = 8;
const PAD_TOP = 8;
const PAD_BOTTOM = 20;
const AXIS_TITLE_SPACE = 14;
const TICK_COUNT = 4;
const BAR_GROUP_GAP = 0.2; // fraction of a category slot left as gap between categories
const BAR_GAP = 0.08; // fraction of a category slot left as gap between grouped bars
const BAR_CORNER_RADIUS = 4; // px, used only when roundedBars is true

/**
 * Picks a "nice" (1/2/5 × 10^n) step size for an axis spanning `span` over
 * roughly `count` ticks — the standard Heckbert nice-numbers approach, so
 * axis labels read as 0/25/50/75/100 rather than 0/23.4/46.8/70.2/93.6.
 */
function niceStep(span: number, count: number): number {
  if (span <= 0) return 1;
  const rough = span / Math.max(1, count);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const residual = rough / magnitude;
  const niceResidual = residual < 1.5 ? 1 : residual < 3 ? 2 : residual < 7 ? 5 : 10;
  return niceResidual * magnitude;
}

/** Nice-rounded [lo, hi, ticks[]] for an axis covering `dataLo..dataHi`. */
function niceDomain(dataLo: number, dataHi: number, beginAtZero: boolean, count: number) {
  let lo = beginAtZero ? Math.min(0, dataLo) : dataLo;
  let hi = beginAtZero ? Math.max(0, dataHi) : dataHi;
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const step = niceStep(hi - lo, count);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v / step) * step);
  return { lo, hi, ticks };
}

interface PointDetail {
  datasetIndex: number;
  index: number;
  label: string | undefined;
  value: number | null;
}

interface InteractiveMark {
  datasetIndex: number;
  index: number;
  label: string;
  value: number;
}

export interface LyraLiteChartEventMap {
  'lyra-point-click': CustomEvent<{
    datasetIndex: number;
    index: number;
    label: string | undefined;
    value: number | null;
  }>;
}
/**
 * `<lyra-lite-chart>` — a dependency-free bar/line chart, plain SVG/DOM
 * rendering with zero peer dependencies (unlike `lyra-chart`, which wraps
 * `chart.js`). For a project whose architecture forbids a charting
 * dependency outright, this covers the common bar/line case: grouped or
 * stacked bars, multi-series lines, per-point click, and hover tooltips
 * (native SVG `<title>`, no positioning JS needed) — not a full `lyra-chart`
 * replacement (no zoom/pan, no pie/doughnut/radar/scatter/bubble types, no
 * horizontal/dual-y-axis, no raw-config passthrough).
 *
 * Because this renders real DOM (not canvas), it reuses `lyra-chart`'s
 * `--lyra-chart-*` theme tokens directly via CSS `var()` — no
 * `getComputedStyle()`-based re-theming step is needed the way `chart.ts`
 * needs one for its canvas.
 *
 * By default (`layout="fit"`) the plot always squeezes to the measured host
 * width. Three independent, opt-in escape hatches for dense/aligned data:
 * `layout="scroll"` (+ `barWidth`) gives every bar a fixed pixel width and
 * lets the plot overflow the host horizontally (scrollable) instead of
 * squeezing; `maxLabels` decimates which x-axis text labels render (bars
 * always still render) once there are more categories than that; and
 * `barX` lets a consumer hand in its own per-category x-coordinate function
 * — e.g. to pixel-align this chart's bars with a sibling `lyra-heatmap`'s
 * calendar columns — overriding the internal slot math for both bars and
 * their labels. All three are additive and no-ops when left unset.
 *
 * Seven further additive, opt-in properties: `pointText` overrides the
 * per-bar/per-point `<title>`/`aria-label` tooltip text (mirrors
 * `lyra-heatmap`'s `cellText` hook), falling back to the built-in raw-value
 * template when unset; `roundedBars` draws bars as a rounded-top path
 * instead of a square-cornered rect; `skipZero` omits a bar entirely (not
 * just zero-height) for an exactly-`0` value; `padLeft`/`barGapRatio`
 * override the internal `PAD_LEFT`/`BAR_GROUP_GAP` layout constants; `scale`
 * (`type="bar"` only) switches the bar-height mapping from the default
 * linear `niceDomain` fraction to a `Math.sqrt(value / domainMax)`
 * compression (mirroring `lyra-heatmap`'s matrix-mode `sqrt` scale) so a
 * skewed dataset's smaller bars don't get washed out by one dominant value
 * — gridlines/tick labels stay on the linear domain regardless, only the bar
 * marks' own height changes, and `type="line"` ignores `scale` entirely; and
 * `hideAxis` suppresses `renderGrid()`'s gridlines/tick labels altogether
 * (x-axis category labels, rendered separately, are unaffected). An eighth,
 * `legendText`, appends a formatter-supplied string after each series' label in the
 * built-in legend row (e.g. a value or share) — no-op while `legend` is unset, matching the same
 * fallback-to-unchanged convention as every other hook here;
 *
 * @customElement lyra-lite-chart
 * @event lyra-point-click - Fired when a bar/point is activated (click, or
 *   Enter/Space while focused). `detail: { datasetIndex: number, index:
 *   number, label: string | undefined, value: number | null }` — same shape
 *   as `lyra-chart`'s `lyra-point-click`.
 * @csspart base - The host's flex layout wrapper.
 * @csspart grid-line - Each horizontal gridline.
 * @csspart axis-label - Each axis tick label.
 * @csspart axis-title - The x/y axis title text, when set.
 * @csspart bar - Each bar rect (type="bar"). Carries `data-selected` when its category index is in `selectedIndex`.
 * @csspart line - Each series' stroked line path (type="line").
 * @csspart point - Each series' per-point hit target (type="line").
 * @csspart legend - The legend row, when `legend` is set.
 * @csspart legend-item - Each legend entry.
 * @csspart legend-swatch - Each legend entry's color swatch.
 * @csspart legend-text - Extra per-item text after the series label, rendered only when `legendText` is set.
 * @csspart live-region - The current mark announcement for keyboard users.
 * @csspart data-list - A visually hidden list of all plotted data points.
 * @cssprop [--lyra-lite-chart-selected-outline-color=var(--lyra-color-brand)] - Stroke for a bar/point whose category index is in `selectedIndex`.
 */
export class LyraLiteChart extends LyraElement<LyraLiteChartEventMap> {
  static styles = [LyraElement.styles, styles, srOnly];

  @property() type: LyraLiteChartType = 'bar';
  @property({ attribute: false }) labels: string[] = [];
  @property({ attribute: false }) datasets: LiteSeries[] = [];
  @property({ type: Boolean }) legend = false;
  @property() height = '280px';
  @property({ attribute: 'x-label' }) xLabel = '';
  @property({ attribute: 'y-label' }) yLabel = '';
  @property({ type: Boolean, attribute: 'begin-at-zero' }) beginAtZero = true;
  /** Stacks each category's bars into one segmented bar. Ignored for `type="line"`. */
  @property({ type: Boolean }) stacked = false;
  /** Formats a y-axis tick value for display (e.g. `(v) => \`$${v.toFixed(2)}\``). Falls back to the
   *  built-in nice-number formatter when unset. */
  @property({ attribute: false }) tickFormat?: (value: number) => string;
  /** `'fit'` (default) squeezes the plot into the measured host width, unchanged from before this
   *  property existed. `'scroll'` gives every bar a fixed `barWidth` instead, letting the plot's
   *  content width exceed the host's — the host becomes horizontally scrollable
   *  (`overflow-x: auto`) so every bar stays exactly `barWidth` wide regardless of category count.
   *  Reflects to the `layout` attribute (e.g. for `:host([layout='scroll'])` host styling). */
  @property({ reflect: true }) layout: LyraLiteChartLayout = 'fit';
  /** Fixed per-category bar width in px, used only when `layout="scroll"`. Ignored (as before this
   *  property existed) in `layout="fit"`, the default. */
  @property({ type: Number, attribute: 'bar-width' }) barWidth = 32;
  /** Caps how many x-axis category labels render text once `this.labels.length` exceeds it,
   *  decimating roughly evenly while always keeping the first and last label. Bars themselves
   *  always render regardless — only the axis text is decimated. Unset (the default) renders every
   *  label, unchanged from before this property existed. Works in either `layout` mode. */
  @property({ type: Number, attribute: 'max-labels' }) maxLabels?: number;
  /** Overrides the x-origin `renderBars()`/the category labels would otherwise compute internally
   *  for a given category index, for `type="bar"` only (bars and their axis labels stay
   *  consistent with each other either way). Lets a consumer pixel-align this chart's bars with,
   *  e.g., a sibling `lyra-heatmap`'s calendar columns by handing both components the same
   *  coordinate function. Unset (the default) uses the existing internal per-category slot math,
   *  unchanged from before this property existed. */
  @property({ attribute: false }) barX?: (index: number) => number;
  /** Formats the per-bar/per-point `<title>`/`aria-label` tooltip text — receives the category
   *  label, the raw value, and the dataset index. Falls back to the built-in raw-value template
   *  when unset (mirrors `lyra-heatmap`'s `cellText` hook). */
  @property({ attribute: false }) pointText?: (label: string, value: number, datasetIndex: number) => string;
  /** Formats extra per-item text appended after a series' label in the built-in legend row (e.g. a
   *  value or percentage share) — receives the series label and its dataset index. Falls back to
   *  rendering the label alone when unset (today's exact legend output), mirroring `pointText`'s and
   *  `tickFormat`'s existing opt-in-hook convention. Has no effect while `legend` is `false`. */
  @property({ attribute: false }) legendText?: (label: string, datasetIndex: number) => string;
  /** `type="bar"` only: draws each bar as a rounded-top-corner shape instead of the default
   *  square-cornered rect. Default `false` renders exactly today's plain `<rect>`. */
  @property({ type: Boolean, attribute: 'rounded-bars' }) roundedBars = false;
  /** `type="bar"` only: omits a bar entirely (no mark, no `tabindex`, no tooltip) for a value that
   *  is exactly `0` — `null`/non-finite values are always skipped regardless of this flag. Default
   *  `false` preserves today's behavior of a zero-height but focusable/titled bar. */
  @property({ type: Boolean, attribute: 'skip-zero' }) skipZero = false;
  /** Overrides the internal `PAD_LEFT` (36px) axis-gutter constant. The gutter is on the left in
   *  LTR and the right in RTL, keeping the y axis at logical start. Unset keeps the 36px default. */
  @property({ type: Number, attribute: 'pad-left' }) padLeft?: number;
  /** Overrides the internal `BAR_GROUP_GAP` (0.2) fraction of a category slot left as a gap between
   *  categories. Unset (the default) keeps today's fixed 0.2. */
  @property({ type: Number, attribute: 'bar-gap-ratio' }) barGapRatio?: number;
  /** `type="bar"` only (no effect on `type="line"`): `'linear'` (default) maps a bar's value to
   *  height via the standard `niceDomain`-based fraction, unchanged from before this property
   *  existed. `'sqrt'` instead maps via `Math.sqrt(value / domainMax)` (mirroring `lyra-heatmap`'s
   *  matrix-mode `sqrt` scale), boosting smaller values relative to one dominant value so a skewed
   *  dataset's smaller bars don't get washed out. Gridlines/tick labels stay on the linear domain
   *  either way — only the bar marks' own height mapping changes. */
  @property() scale: 'linear' | 'sqrt' = 'linear';
  /** Suppresses `renderGrid()` entirely — no gridlines, no y-axis tick labels. x-axis category
   *  labels (rendered separately) are unaffected. Default `false` preserves today's behavior. */
  @property({ type: Boolean, attribute: 'hide-axis' }) hideAxis = false;
  /** A pixel floor for a bar/stacked-segment's rendered height, for a nonzero value that would
   *  otherwise round to sub-pixel and become visually indistinguishable from absent (while still
   *  being focusable/tab-stoppable/announced) — a real accessibility/visibility gap for
   *  heterogeneous-magnitude stacked data. `type="bar"` only; a value of exactly `0` is unaffected
   *  (that's `skipZero`'s job, not this one's). Unset (the default) reproduces today's
   *  `Math.max(0, y2 - y1)` exactly, with no floor. */
  @property({ type: Number, attribute: 'min-bar-height' }) minBarHeight?: number;
  /** Category indexes to mark `data-selected` on every bar/segment at that index, across every
   *  dataset -- e.g. to highlight a whole selected week's column in a stacked chart. Empty (the
   *  default) reproduces today's exact output: no bar carries `data-selected`. A consumer's own
   *  `::part(bar)[data-selected]` (or `[data-selected]` inside the shadow root via a documented
   *  CSS custom property) rule can then style the highlight -- this component takes no opinion on
   *  what the highlight looks like, only which bars it applies to. */
  @property({ attribute: false }) selectedIndex: number[] = [];
  /** Overrides the `<svg>`'s auto-derived `aria-label` (`datasets.map(d => d.label).join(', ') ||
   *  'Chart'`) — for a consumer with a real, localized chart description. A host `aria-label`
   *  takes precedence. Unset (the default) keeps today's auto-derived (English-fallback) label
   *  exactly. Named `accessible-label` to match the same override on `lyra-chart`/`lyra-box-plot`. */
  @property({ attribute: 'accessible-label' }) accessibleLabel?: string;

  @state() private plotWidth = 0;
  @state() private plotHeight = 0;
  /** One roving tab stop across all bar/point marks. */
  @state() private activeMarkIndex = 0;

  @query('svg') private svgEl?: SVGSVGElement;
  @query('lyra-live-region') private liveRegion?: LyraLiveRegion;
  private resizeObserver?: ResizeObserver;

  connectedCallback(): void {
    super.connectedCallback();
    this.resizeObserver = new ResizeObserver((entries) => {
      const box = entries[0]?.contentBoxSize?.[0];
      if (box) {
        this.plotWidth = box.inlineSize;
        this.plotHeight = box.blockSize;
      } else {
        const rect = this.svgEl?.getBoundingClientRect();
        if (rect) {
          this.plotWidth = rect.width;
          this.plotHeight = rect.height;
        }
      }
    });
    // A reconnect re-creates the observer above but the `<svg>` render root
    // content survives across disconnect/reconnect (Lit doesn't tear down the
    // shadow root) — re-observe it here (firstUpdated() only ever runs once,
    // on the very first render, so it can't be relied on for a reconnect).
    if (this.svgEl) this.resizeObserver.observe(this.svgEl);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
  }

  // The first draw is queued because connectedCallback() fires *before* Lit's
  // first render, so on
  // the very first mount `this.svgEl` (a `@query('svg')`) is still
  // undefined there and its guarded `observe()` call is a no-op — verified
  // empirically: deleting firstUpdated() here hung every existing test that
  // waits for the ResizeObserver's initial measurement. firstUpdated() runs
  // once, after that first render, and is what actually arms the observer
  // for the initial mount; connectedCallback()'s own observe() call (added
  // above) only ever succeeds on a *reconnect*, when the shadow DOM (and
  // svgEl) already exists from before the disconnect. Together the two
  // cover first-mount and reconnect without ever double-observing the same
  // element from the same callback path.
  protected firstUpdated(): void {
    if (this.svgEl) this.resizeObserver?.observe(this.svgEl);
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('height')) {
      this.style.setProperty('--lyra-chart-height', this.height);
    }
  }

  private colorFor(index: number, series: LiteSeries): string {
    return series.color ?? DEFAULT_PALETTE[index % DEFAULT_PALETTE.length];
  }

  /** Dispatches to the host-provided `pointText` formatter when set, otherwise `undefined` (the
   *  caller falls back to its own built-in template) — mirrors `lyra-heatmap`'s `resolveCellText()`. */
  private resolvePointText(label: string, value: number, datasetIndex: number): string | undefined {
    return this.pointText?.(label, value, datasetIndex);
  }

  /** The ordered set of visible marks used by both keyboard navigation and
   * the screen-reader data alternative. */
  private interactiveMarks(): InteractiveMark[] {
    const marks: InteractiveMark[] = [];
    if (this.type === 'bar') {
      for (let index = 0; index < this.labels.length; index++) {
        for (let datasetIndex = 0; datasetIndex < this.datasets.length; datasetIndex++) {
          const value = this.datasets[datasetIndex]?.data[index];
          if (value == null || !Number.isFinite(value) || (this.skipZero && value === 0)) continue;
          marks.push({ datasetIndex, index, label: this.labels[index] ?? '', value });
        }
      }
    } else {
      this.datasets.forEach((series, datasetIndex) => {
        series.data.forEach((value, index) => {
          if (value == null || !Number.isFinite(value)) return;
          marks.push({ datasetIndex, index, label: this.labels[index] ?? '', value });
        });
      });
    }
    return marks;
  }

  private markIndexMap(): Map<string, number> {
    return new Map(
      this.interactiveMarks().map((mark, index) => [`${mark.datasetIndex}:${mark.index}`, index]),
    );
  }

  private normalizedMarkIndex(marks = this.interactiveMarks()): number {
    return marks.length ? Math.min(Math.max(this.activeMarkIndex, 0), marks.length - 1) : -1;
  }

  private markAnnouncement(index: number, marks = this.interactiveMarks()): string {
    const mark = marks[index];
    if (!mark) return '';
    const series = this.datasets[mark.datasetIndex]?.label ?? this.localize('chartSeriesLabel');
    const custom = this.resolvePointText(mark.label, mark.value, mark.datasetIndex);
    if (custom) {
      const position = this.localize('liteChartMarkPosition', undefined, { index: index + 1, total: marks.length });
      return `${custom} ${position}`;
    }
    return this.localize('liteChartMarkSummary', undefined, {
      series,
      label: mark.label,
      value: new Intl.NumberFormat(this.effectiveLocale).format(mark.value),
      index: index + 1,
      total: marks.length,
    });
  }

  private onMarkFocus(index: number): void {
    const marks = this.interactiveMarks();
    if (!marks[index]) return;
    this.activeMarkIndex = index;
    // `force: true` bypasses `<lyra-live-region>`'s default throttle window --
    // each roving-tabindex move is its own discrete, user-driven navigation
    // event (not a streaming firehose), so it must land immediately rather
    // than waiting out (or getting coalesced by) the throttle.
    this.liveRegion?.announce(this.markAnnouncement(index, marks), { force: true });
  }

  private focusMark(index: number): void {
    const marks = this.interactiveMarks();
    if (!marks[index]) return;
    this.activeMarkIndex = index;
    this.liveRegion?.announce(this.markAnnouncement(index, marks), { force: true });
    void this.updateComplete.then(() => {
      const markEls = Array.from(this.renderRoot.querySelectorAll('[part="bar"], [part="point"]')) as HTMLElement[];
      markEls[index]?.focus();
    });
  }

  /**
   * A value-to-y-pixel mapping for a bar's top/bottom edge. `'linear'` (the
   * default) is the standard `niceDomain`-fraction formula. `'sqrt'`
   * compresses via `Math.sqrt(value / domainMax)`, clamping `value` to
   * `[0, hi]` first since a negative input has no real square root.
   *
   * NOT used for the `stacked && scale === 'sqrt'` case — that combination's
   * proportionality (compress the bar's *total* height once, then split it
   * linearly by each segment's share) is computed directly in `renderBars()`,
   * since a per-segment call here (compressing each segment's absolute
   * cumulative stack position independently) is exactly the non-proportional
   * bug this method's stacked callers used to have.
   */
  private barValueToY(value: number, plotY: number, plotH: number, lo: number, hi: number): number {
    if (this.scale === 'sqrt') {
      const domainMax = hi > 0 ? hi : 1;
      const frac = Math.sqrt(Math.min(domainMax, Math.max(0, value)) / domainMax);
      return plotY + plotH - frac * plotH;
    }
    const span = hi - lo || 1;
    return plotY + plotH - ((value - lo) / span) * plotH;
  }

  /**
   * A rounded-top-corners `<path>` `d` string for a bar occupying
   * `[x, y, x+w, y+h]` — an SVG `<rect>` can only express a uniform radius
   * on all four corners, so `roundedBars` switches the mark to a path
   * instead of adding `rx`/`ry` to keep the bottom edge square against the
   * baseline. `r` is clamped so it never exceeds half the bar's width or its
   * full height (a thin/short bar degrades to a plain rectangle path rather
   * than self-intersecting).
   */
  private roundedBarPath(x: number, y: number, w: number, h: number): string {
    const r = Math.max(0, Math.min(BAR_CORNER_RADIUS, w / 2, h));
    if (r <= 0) return `M${x},${y} h${w} v${h} h${-w} Z`;
    return `M${x},${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} H${x} Z`;
  }

  private domain() {
    let lo = Infinity;
    let hi = -Infinity;
    if (this.type === 'bar' && this.stacked) {
      // Stacked bars: each category's extent is the sum of its (signed)
      // positive/negative segments, not the max single value.
      for (let i = 0; i < this.labels.length; i++) {
        let pos = 0;
        let neg = 0;
        for (const s of this.datasets) {
          const v = s.data[i];
          if (v == null || !Number.isFinite(v)) continue;
          if (v >= 0) pos += v;
          else neg += v;
        }
        lo = Math.min(lo, neg);
        hi = Math.max(hi, pos);
      }
    } else {
      for (const s of this.datasets) {
        for (const v of s.data) {
          if (v == null || !Number.isFinite(v)) continue;
          lo = Math.min(lo, v);
          hi = Math.max(hi, v);
        }
      }
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
      lo = 0;
      hi = 1;
    }
    return niceDomain(lo, hi, this.beginAtZero, TICK_COUNT);
  }

  private emitPoint(datasetIndex: number, index: number): void {
    const label = this.labels[index];
    const value = this.datasets[datasetIndex]?.data[index] ?? null;
    this.emit<PointDetail>('lyra-point-click', { datasetIndex, index, label, value });
  }

  private onPointKeyDown(e: KeyboardEvent, datasetIndex: number, index: number, markIndex: number): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.onMarkFocus(markIndex);
      this.emitPoint(datasetIndex, index);
      return;
    }
    const marks = this.interactiveMarks();
    if (!marks.length) return;
    // Marks are laid out left-to-right along the x-axis regardless of
    // direction (the plot itself doesn't mirror under RTL), so the physical
    // ArrowLeft/ArrowRight keys must swap which one advances vs. retreats
    // through `marks` to keep "forward" pointing at the next mark visually.
    const rtl = this.effectiveDirection === 'rtl';
    const forwardKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = rtl ? 'ArrowRight' : 'ArrowLeft';
    let next = markIndex;
    if (e.key === forwardKey || e.key === 'ArrowDown') next = Math.min(marks.length - 1, markIndex + 1);
    else if (e.key === backwardKey || e.key === 'ArrowUp') next = Math.max(0, markIndex - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = marks.length - 1;
    else return;
    e.preventDefault();
    this.focusMark(next);
  }

  private renderGrid(plotX: number, plotY: number, plotW: number, plotH: number, ticks: number[], lo: number, hi: number) {
    const span = hi - lo || 1;
    const rtl = this.effectiveDirection === 'rtl';
    return ticks.map((t) => {
      const y = plotY + plotH - ((t - lo) / span) * plotH;
      return svg`
        <line part="grid-line" x1=${plotX} y1=${y} x2=${plotX + plotW} y2=${y}></line>
        <text
          part="axis-label"
          x=${rtl ? plotX + plotW + 6 : plotX - 6}
          y=${y}
          text-anchor="end"
          dominant-baseline="middle"
        >${this.tickFormat ? this.tickFormat(t) : formatTick(t)}</text>
      `;
    });
  }

  /**
   * `slot` is the per-category width to lay bars out against — either the
   * measured-width-derived `plotW / n` (`layout="fit"`) or the fixed
   * `barWidth` (`layout="scroll"`), computed once by the caller
   * (`renderChart()`) and handed to both this method and the category-label
   * x-position calc so the two can never drift apart from each other.
   */
  private renderBars(plotX: number, plotY: number, plotH: number, slot: number, lo: number, hi: number) {
    const n = this.labels.length;
    const groupCount = this.stacked ? 1 : Math.max(1, this.datasets.length);
    const groupGap = this.barGapRatio ?? BAR_GROUP_GAP;
    const groupW = slot * (1 - groupGap);
    const barW = (groupW - BAR_GAP * slot * (groupCount - 1)) / groupCount;
    const markIndexes = this.markIndexMap();
    const activeMarkIndex = this.normalizedMarkIndex();
    // Only meaningful for stacked + scale="sqrt": each category's *positive*
    // and *negative* stack totals, sqrt-compressed once per category (not
    // per segment) -- see barValueToY()'s doc for why this has to be a
    // per-category pre-pass rather than a per-segment computation.
    const stackedSqrt = this.stacked && this.scale === 'sqrt';
    const domainMax = hi > 0 ? hi : 1;
    const posTotals: number[] = [];
    const negTotals: number[] = [];
    if (stackedSqrt) {
      for (let i = 0; i < n; i++) {
        let pos = 0;
        let neg = 0;
        for (const s of this.datasets) {
          const v = s.data[i];
          if (v == null || !Number.isFinite(v)) continue;
          if (this.skipZero && v === 0) continue;
          if (v >= 0) pos += v;
          else neg += v;
        }
        posTotals.push(pos);
        negTotals.push(neg);
      }
    }

    const bars: TemplateResult[] = [];
    for (let i = 0; i < n; i++) {
      // `this.barX`, when set, overrides just the category's own x-origin
      // (what an unset `barX` would compute as `plotX + i * slot`) -- the
      // group-centering/per-dataset-offset math below still layers on top of
      // it, same as it does on top of the internal formula.
      const origin = this.barX ? this.barX(i) : plotX + i * slot;
      const slotStart = origin + (slot - groupW) / 2;
      let stackPos = 0; // running positive-side offset (value units) -- kept only for the stackedSqrt branch below
      let stackNeg = 0; // running negative-side offset (value units) -- kept only for the stackedSqrt branch below
      // Running PIXEL cursors for the plain (non-sqrt) stacked case: each segment's own edge derives
      // from wherever the previous (possibly minBarHeight-floored) segment actually ended on screen,
      // not from re-deriving position from cumulative value -- this is what makes a floored segment's
      // inflation "push" the next segment instead of being silently overdrawn by it.
      const zeroY = this.barValueToY(0, plotY, plotH, lo, hi);
      let posPixelTop = zeroY;
      let negPixelBottom = zeroY;
      // sqrt-compressed pixel height of this category's positive/negative
      // stack total, computed once per category (not per segment) -- see
      // barValueToY()'s doc comment for why this differs from the old,
      // buggy per-segment-cumulative-position sqrt.
      const posCompressedH = stackedSqrt ? Math.sqrt(Math.min(domainMax, posTotals[i]!) / domainMax) * plotH : 0;
      const negCompressedH = stackedSqrt ? Math.sqrt(Math.min(domainMax, -negTotals[i]!) / domainMax) * plotH : 0;
      this.datasets.forEach((s, di) => {
        const v = s.data[i];
        if (v == null || !Number.isFinite(v)) return;
        if (this.skipZero && v === 0) return;
        const color = this.colorFor(di, s);
        let rectX: number;
        let y1: number;
        let y2: number;
        if (this.stacked && stackedSqrt) {
          rectX = slotStart;
          if (v >= 0) {
            // Split the category's already-compressed total height linearly
            // by this segment's share of the category's own positive total
            // -- proportional by construction, unlike compressing each
            // segment's absolute cumulative position independently.
            const total = posTotals[i]!;
            const shareLo = total > 0 ? stackPos / total : 0;
            const shareHi = total > 0 ? (stackPos + v) / total : 0;
            y1 = plotY + plotH - shareHi * posCompressedH;
            y2 = plotY + plotH - shareLo * posCompressedH;
            stackPos += v;
          } else {
            const total = -negTotals[i]!;
            const shareLo = total > 0 ? -stackNeg / total : 0;
            const shareHi = total > 0 ? (-stackNeg - v) / total : 0;
            y1 = plotY + plotH + shareLo * negCompressedH;
            y2 = plotY + plotH + shareHi * negCompressedH;
            stackNeg += v;
          }
        } else if (this.stacked) {
          rectX = slotStart;
          if (v >= 0) {
            // A segment's own proportional height (linear scale) depends only on its own value,
            // not on where it sits in the stack -- compute it in isolation, floor it, then stack
            // from the running pixel cursor rather than from cumulative value.
            const naturalH = Math.max(0, zeroY - this.barValueToY(v, plotY, plotH, lo, hi));
            const segH = this.minBarHeight != null && v !== 0 && naturalH < this.minBarHeight ? this.minBarHeight : naturalH;
            y2 = posPixelTop;
            y1 = posPixelTop - segH;
            posPixelTop = y1;
          } else {
            const naturalH = Math.max(0, this.barValueToY(v, plotY, plotH, lo, hi) - zeroY);
            const segH = this.minBarHeight != null && v !== 0 && naturalH < this.minBarHeight ? this.minBarHeight : naturalH;
            y1 = negPixelBottom;
            y2 = negPixelBottom + segH;
            negPixelBottom = y2;
          }
        } else {
          rectX = slotStart + di * (barW + BAR_GAP * slot);
          const zeroClamped = Math.min(hi, Math.max(lo, 0));
          const barValLo = Math.min(zeroClamped, v);
          const barValHi = Math.max(zeroClamped, v);
          y1 = this.barValueToY(barValHi, plotY, plotH, lo, hi);
          y2 = this.barValueToY(barValLo, plotY, plotH, lo, hi);
        }
        const label = this.labels[i];
        const custom = this.resolvePointText(label, v, di);
        const barText =
          custom ??
          this.localize('liteChartBarLabel', undefined, {
            series: s.label,
            label,
            value: new Intl.NumberFormat(this.effectiveLocale).format(v),
          });
        const ariaLabel = barText;
        const titleText = barText;
        const w = Math.max(0, barW);
        let h = Math.max(0, y2 - y1);
        // A nonzero value's segment can round to sub-pixel and become
        // visually/indistinguishable from absent -- minBarHeight floors it,
        // pulling y1 upward by the same amount so the segment still
        // terminates at its correct baseline (a floored segment "pushes" any
        // segments stacked after it, the same tradeoff a hand-rolled
        // Math.max(2, scaleToLength(...)) floor accepts).
        // The plain-stacked branch above already applies minBarHeight per-segment against a running
        // pixel cursor (so a floored segment "pushes" the next one) -- applying the floor again here
        // would double-apply it. Only the non-stacked and stackedSqrt paths still need it here.
        if (!(this.stacked && !stackedSqrt) && this.minBarHeight != null && v !== 0 && h < this.minBarHeight) {
          const extra = this.minBarHeight - h;
          y1 -= extra;
          h = this.minBarHeight;
        }
        const markIndex = markIndexes.get(`${di}:${i}`)!;
        const selected = this.selectedIndex.includes(i);
        bars.push(
          this.roundedBars
            ? svg`
          <path
            part="bar"
            d=${this.roundedBarPath(rectX, y1, w, h)}
            fill=${color}
            tabindex=${activeMarkIndex === markIndex ? '0' : '-1'}
            role="button"
            aria-label=${ariaLabel}
            ?data-selected=${selected}
            @click=${() => this.emitPoint(di, i)}
            @focus=${() => this.onMarkFocus(markIndex)}
            @keydown=${(e: KeyboardEvent) => this.onPointKeyDown(e, di, i, markIndex)}
          ><title>${titleText}</title></path>
        `
            : svg`
          <rect
            part="bar"
            x=${rectX}
            y=${y1}
            width=${w}
            height=${h}
            fill=${color}
            tabindex=${activeMarkIndex === markIndex ? '0' : '-1'}
            role="button"
            aria-label=${ariaLabel}
            ?data-selected=${selected}
            @click=${() => this.emitPoint(di, i)}
            @focus=${() => this.onMarkFocus(markIndex)}
            @keydown=${(e: KeyboardEvent) => this.onPointKeyDown(e, di, i, markIndex)}
          ><title>${titleText}</title></rect>
        `,
        );
      });
    }
    return bars;
  }

  private renderLines(plotX: number, plotY: number, plotW: number, plotH: number, lo: number, hi: number) {
    const span = hi - lo || 1;
    const n = this.labels.length;
    const xFor = (i: number) => plotX + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2);
    const yFor = (v: number) => plotY + plotH - ((v - lo) / span) * plotH;
    const markIndexes = this.markIndexMap();
    const activeMarkIndex = this.normalizedMarkIndex();

    return this.datasets.map((s, di) => {
      const color = this.colorFor(di, s);
      let d = '';
      let penDown = false;
      s.data.forEach((v, i) => {
        if (v == null || !Number.isFinite(v)) {
          penDown = false;
          return;
        }
        const cmd = penDown ? 'L' : 'M';
        d += `${cmd}${xFor(i)},${yFor(v)} `;
        penDown = true;
      });
      const dots = s.data.map((v, i) => {
        if (v == null || !Number.isFinite(v)) return nothing;
        const label = this.labels[i];
        const custom = this.resolvePointText(label, v, di);
        const barText =
          custom ??
          this.localize('liteChartBarLabel', undefined, {
            series: s.label,
            label,
            value: new Intl.NumberFormat(this.effectiveLocale).format(v),
          });
        const ariaLabel = barText;
        const titleText = barText;
        const markIndex = markIndexes.get(`${di}:${i}`)!;
        return svg`
          <circle
            part="point"
            cx=${xFor(i)}
            cy=${yFor(v)}
            r="4"
            fill=${color}
            tabindex=${activeMarkIndex === markIndex ? '0' : '-1'}
            role="button"
            aria-label=${ariaLabel}
            @click=${() => this.emitPoint(di, i)}
            @focus=${() => this.onMarkFocus(markIndex)}
            @keydown=${(e: KeyboardEvent) => this.onPointKeyDown(e, di, i, markIndex)}
          ><title>${titleText}</title></circle>
        `;
      });
      return svg`<path part="line" d=${d.trim()} stroke=${color}></path>${dots}`;
    });
  }

  render(): TemplateResult {
    // Lit already tracks every reactive input, including function-valued
    // properties such as `tickFormat` and `barX`. Returning a cached
    // TemplateResult here would make callback replacement invisible and
    // serializing arbitrary data would throw for circular objects/BigInt.
    // Rendering this small SVG template is cheaper and more correct than a
    // lossy content fingerprint.
    return this.renderChart();
  }

  /**
   * Step size for `maxLabels` decimation: 1 (show every label, today's
   * unchanged default) when `maxLabels` is unset or already >= the label
   * count, otherwise the ceil-divide spacing that lands close to
   * `maxLabels` shown labels while always keeping index 0 and the last
   * index (enforced by the caller, not here).
   */
  private labelStep(n: number): number {
    const max = this.maxLabels;
    if (max == null || n <= max) return 1;
    return Math.max(1, Math.ceil((n - 1) / Math.max(1, max - 1)));
  }

  private renderChart(): TemplateResult {
    const n = this.labels.length;
    const h = this.plotHeight || 200;
    const axisGutter = (this.padLeft ?? PAD_LEFT) + (this.yLabel ? AXIS_TITLE_SPACE : 0);
    const rtl = this.effectiveDirection === 'rtl';
    const padBottom = PAD_BOTTOM + (this.xLabel ? AXIS_TITLE_SPACE : 0);
    const plotX = rtl ? PAD_RIGHT : axisGutter;
    const plotY = PAD_TOP;
    const plotH = Math.max(0, h - plotY - padBottom);

    let w: number;
    let plotW: number;
    let slot: number;
    if (this.layout === 'scroll') {
      // Fixed-width bars: content width is driven by category count ×
      // barWidth instead of the measured host width, and CAN exceed it --
      // the svg gets an explicit inline-size below (not 100%) and
      // `:host([layout='scroll']) [part='base']` (lite-chart.styles.ts)
      // turns on `overflow-x: auto` so the host scrolls to reveal the rest.
      slot = this.barWidth;
      plotW = Math.max(0, n * slot);
      w = axisGutter + plotW + PAD_RIGHT;
    } else {
      // 'fit' (default): squeeze to the measured host width, byte-for-byte
      // the same computation as before `layout` existed.
      w = this.plotWidth || 400;
      plotW = Math.max(0, w - axisGutter - PAD_RIGHT);
      slot = n > 0 ? plotW / n : 0;
    }
    const { lo, hi, ticks } = this.domain();

    const grid = this.hideAxis ? [] : this.renderGrid(plotX, plotY, plotW, plotH, ticks, lo, hi);
    const marks =
      this.type === 'bar'
        ? this.renderBars(plotX, plotY, plotH, slot, lo, hi)
        : this.renderLines(plotX, plotY, plotW, plotH, lo, hi);

    const step = this.labelStep(n);
    const categoryLabels = this.labels.map((label, i) => {
      if (i !== 0 && i !== n - 1 && i % step !== 0) return nothing; // maxLabels decimation
      const x =
        this.type === 'bar' && n > 0
          ? (this.barX ? this.barX(i) : plotX + i * slot) + slot / 2 // matches renderBars()'s own per-category slot center (or the barX override, when set)
          : plotX + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2);
      return svg`<text part="axis-label" x=${x} y=${plotY + plotH + 14} text-anchor="middle">${label}</text>`;
    });

    const chartLabel =
      this.getAttribute('aria-label') ||
      this.accessibleLabel ||
      this.datasets.map((d) => d.label).join(', ') ||
      this.localize('chart');
    const marksForA11y = this.interactiveMarks();

    return html`
      <div part="base">
        <svg
          viewBox="0 0 ${w} ${h}"
          style=${this.layout === 'scroll' ? `inline-size: ${w}px` : nothing}
          role="group"
          aria-label=${chartLabel}
          tabindex=${marksForA11y.length ? '-1' : '0'}
        >
          ${grid}
          ${categoryLabels}
          ${marks}
          ${this.yLabel
            ? svg`<text
                part="axis-title"
                x=${rtl ? w - 12 : 12}
                y=${plotY + plotH / 2}
                text-anchor="middle"
                transform="rotate(${rtl ? 90 : -90}, ${rtl ? w - 12 : 12}, ${plotY + plotH / 2})"
              >${this.yLabel}</text>`
            : nothing}
          ${this.xLabel
            ? svg`<text part="axis-title" x=${plotX + plotW / 2} y=${plotY + plotH + padBottom - 2} text-anchor="middle">${this.xLabel}</text>`
            : nothing}
        </svg>
        <lyra-live-region part="live-region"></lyra-live-region>
        <ul part="data-list" class="sr-only" aria-label=${this.localize('chartData')}>
          ${marksForA11y.map((mark, index) => html`<li>${this.markAnnouncement(index, marksForA11y)}</li>`)}
        </ul>
        ${this.legend
          ? html`<div part="legend">
              ${this.datasets.map(
                (s, i) => html`
                  <span part="legend-item">
                    <span part="legend-swatch" style="background:${this.colorFor(i, s)}"></span>
                    ${s.label}${this.legendText
                      ? html`<span part="legend-text">${this.legendText(s.label, i)}</span>`
                      : nothing}
                  </span>
                `,
              )}
            </div>`
          : nothing}
      </div>
    `;
  }
}

function formatTick(v: number): string {
  // Avoid float noise (e.g. 0.30000000000000004) from the niceStep() math
  // above without hardcoding a fixed decimal count that'd butcher large ints.
  return Number(v.toFixed(6)).toString();
}


declare global {
  interface HTMLElementTagNameMap {
    'lyra-lite-chart': LyraLiteChart;
  }
}
