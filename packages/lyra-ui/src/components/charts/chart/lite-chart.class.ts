import { nativeSvgTitle } from '../../../internal/svg-title.js';
import {
  html,
  svg,
  nothing,
  type ComplexAttributeConverter,
  type TemplateResult,
  type PropertyValues,
} from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { specialistTokens } from '../../../internal/specialist-tokens.styles.js';
import { hostAriaLabel, nextId, srOnly } from '../../../internal/a11y.js';
import { getListFormat, getNumberFormat } from '../../../internal/intl-cache.js';
import { finiteAdd, finiteCount, finiteRange } from '../../../internal/numbers.js';
import { escapeCsvField } from '../../utility/export-button/csv.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import '../../utility/live-region/live-region.class.js';
import { styles } from './lite-chart.styles.js';
import {
  forcedColorEncoding,
  forcedColorsActive,
  type ForcedColorEncodingName,
} from './chart-forced-colors.js';
import {
  literalSetConverter,
  trueDefaultBooleanFromAttributeConverter as trueDefaultBooleanConverter,
} from '../../../internal/converters.js';
import { sanitizeCssColor, sanitizeCssLength } from '../../../internal/safe-css.js';
import { activeElementIn } from '../../../internal/active-element.js';
import {
  acquireAnnouncementSink,
  type AnnouncementSink,
} from '../../../internal/announcer.js';
import {
  MAX_RENDERED_CHART_RECORDS,
  sampleChartTableIndexes,
} from './chart-table-sampling.js';
import {
  chartChromeLegendPlacement,
  normalizeChartChromeLegendPosition,
  type LyraChartChromeLegendPosition,
} from './chart-chrome.js';
import type {
  LyraChartDatumActivateDetail,
  LyraChartFormatter,
} from './chart.class.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_chart, LYRA_DEFAULT_chartCategory, LYRA_DEFAULT_chartData, LYRA_DEFAULT_chartDataSampled, LYRA_DEFAULT_chartSeriesLabel, LYRA_DEFAULT_chartTotal, LYRA_DEFAULT_liteChartBarLabel, LYRA_DEFAULT_liteChartCustomMarkSummary, LYRA_DEFAULT_liteChartMarkSummary } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export interface LyraLiteChartSeries {
  readonly label: string;
  readonly data: readonly (number | null)[];
  /** A CSS color. Invalid values and `url()` paint servers fall back to the semantic categorical
   *  color keyed by dataset index. */
  readonly color?: string;
}

function isLiteChartSeries(value: unknown): value is LyraLiteChartSeries {
  try {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      Array.isArray((value as { data?: unknown }).data)
    );
  } catch {
    return false;
  }
}

function normalizeLiteChartSeries(value: unknown): readonly LyraLiteChartSeries[] {
  try {
    return Object.freeze(Array.isArray(value) ? value.filter(isLiteChartSeries) : []);
  } catch {
    return Object.freeze([]);
  }
}

export type LyraLiteChartType = 'bar' | 'line';

function normalizeLiteChartType(value: unknown): LyraLiteChartType {
  return value === 'line' || value === 'bar' ? value : 'bar';
}

/** `type="bar"` only: `'linear'` (default) maps a bar's value to height via the standard
 *  `niceDomain`-based fraction; `'sqrt'` compresses via `Math.sqrt(value / domainMax)`. See the
 *  `scale` property's own doc comment below for the full rationale. */
export type LyraLiteChartScale = 'linear' | 'sqrt' | 'logarithmic';

/**
 * `'fit'` (default) squeezes the whole plot into the measured host width,
 * exactly as this component always behaved. `'scroll'` gives every bar a
 * fixed `barWidth` instead and lets the plot's content width exceed the
 * host's, making the host horizontally scrollable.
 */
export type LyraLiteChartLayout = 'fit' | 'scroll';

const LITE_CHART_LAYOUT = literalSetConverter<LyraLiteChartLayout>(['fit', 'scroll'], 'fit');

/** Numeric chart extents may opt into the component's deterministic label-width estimator. */
const autoNumberConverter: ComplexAttributeConverter<number | 'auto' | undefined> = {
  fromAttribute: (value) => {
    if (value === null) return undefined;
    const trimmed = value.trim();
    return trimmed.toLowerCase() === 'auto' ? 'auto' : Number(trimmed);
  },
};

export type LyraLiteChartExportFormat = 'csv' | 'svg';

export type LyraLiteChartTableCellKind = 'value' | 'total';

/** Identifies the accessible-table cell being formatted. A total has no owning dataset/series,
 *  so `datasetIndex` and `seriesLabel` are `null` for `kind: 'total'`. */
export interface LyraLiteChartTableCellContext {
  kind: LyraLiteChartTableCellKind;
  datasetIndex: number | null;
  index: number;
  label: string;
  seriesLabel: string | null;
}

/** Formats one finite numeric value in the built-in multi-series accessible table. */
export type LyraLiteChartTableCellFormatter = (
  value: number,
  context: LyraLiteChartTableCellContext,
) => string;

// The semantic variables are resolved by SVG/CSS at paint time, so changing a
// theme or color-scheme does not require a second JS-side draw pass.
const DEFAULT_PALETTE = [
  'var(--lr-chart-color-1, var(--lr-color-chart-1))',
  'var(--lr-chart-color-2, var(--lr-color-chart-2))',
  'var(--lr-chart-color-3, var(--lr-color-chart-3))',
  'var(--lr-chart-color-4, var(--lr-color-chart-4))',
  'var(--lr-chart-color-5, var(--lr-color-chart-5))',
  'var(--lr-chart-color-6, var(--lr-color-chart-6))',
  'var(--lr-chart-color-7, var(--lr-color-chart-7))',
  'var(--lr-chart-color-8, var(--lr-color-chart-8))',
];

const PAD_LEFT = 36;
const PAD_RIGHT = 8;
const PAD_TOP = 8;
/** Reserves the category-label row below the plot, including room for the tallest engine's line box
 *  under `CATEGORY_LABEL_OFFSET`'s baseline. Raised with that offset so descenders never clip. */
const PAD_BOTTOM = 30;
/** Baseline offset of the category-label row below the plot floor.
 *
 *  This must clear the bottom y-axis tick, which is `dominant-baseline="middle"` on the plot floor
 *  and so hangs half its line box *below* that floor, into this row -- and the first category label
 *  of a line chart is centred on `plotX`, so it always reaches left into the tick column (measured
 *  overlap: 5.7px on both Chromium and Firefox). Horizontal overlap alone is therefore not
 *  separable here; the only thing keeping the two boxes apart is this vertical gap.
 *
 *  At the previous 18px the gap was 1.3px on Chromium and *-0.7px* on Firefox, whose line box for
 *  the same 10px `system-ui` font is 16px against Chromium's 14px -- so the labels genuinely
 *  collided there. 24px keeps ~5px clear on both, comfortably past that 2px cross-engine variation,
 *  at the cost of 6px of plot height. */
const CATEGORY_LABEL_OFFSET = 24;
const AXIS_TITLE_SPACE = 14;
const TICK_COUNT = 4;
const BAR_GROUP_GAP = 0.2; // fraction of a category slot left as gap between categories
const BAR_GAP = 0.08; // fraction of a category slot left as gap between grouped bars
const BAR_CORNER_RADIUS = 4; // px, used only when roundedBars is true
const APPROX_LABEL_CHARACTER_WIDTH = 7;
/** Breathing room included when automatic x-axis density estimates a label's required lane. */
const AUTO_CATEGORY_LABEL_INSET = 10;
/** A value tick sits six pixels off the plot; the remaining inset absorbs font-width variance. */
const VALUE_AXIS_TICK_OFFSET = 6;
const AUTO_VALUE_AXIS_SAFETY_INSET = 8;
/** Bounds automatic value-axis growth without weakening an explicit numeric request. */
const MAX_AUTO_VALUE_AXIS_GUTTER = 240;
const MAX_AUTO_VALUE_AXIS_GUTTER_FRACTION = 0.4;
/** A practical ceiling that keeps scroll-mode SVG/CSS geometry finite even for hostile inputs. */
const MAX_SCROLL_CONTENT_WIDTH = 1_000_000;

/**
 * Picks a "nice" (1/2/5 × 10^n) step size for an axis spanning `span` over
 * roughly `count` ticks — the standard Heckbert nice-numbers approach, so
 * axis labels read as 0/25/50/75/100 rather than 0/23.4/46.8/70.2/93.6.
 * Callers supply a positive span from validated bounds, widening equal linear-domain bounds
 * before selecting their step.
 */
function niceStep(span: number, count: number): number {
  const rough = span / Math.max(1, count);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const residual = rough / magnitude;
  const niceResidual = residual < 1.5 ? 1 : residual < 3 ? 2 : residual < 7 ? 5 : 10;
  return niceResidual * magnitude;
}

/**
 * Position of `value` on a base-10 logarithmic value axis spanning `lo`..`hi`, as a `[0, 1]`
 * fraction.
 *
 * A log axis cannot place zero or a negative (`log(0)` is `-Infinity`), so the domain floor is the
 * smallest positive bound available and anything at or below it pins to `0` rather than flying off
 * the plot -- the SVG renderer has no Chart.js-style "drop the point" behavior to fall back on, and
 * an -Infinity coordinate would blank the whole series. Degenerate domains fall back to the linear
 * fraction, so a mis-set axis degrades instead of producing NaN geometry.
 */
function logDomainFraction(value: number, lo: number, hi: number): number {
  const top = Math.max(hi, 0);
  if (!Number.isFinite(top) || top <= 0) return domainFraction(value, lo, hi);
  // A zero/negative lower bound has no logarithm; fall back to a decade below the maximum so the
  // axis still spans a sensible range instead of collapsing.
  const bottom = lo > 0 ? lo : top / 10;
  if (!Number.isFinite(bottom) || bottom <= 0 || bottom >= top) {
    return domainFraction(value, lo, hi);
  }
  if (!Number.isFinite(value) || value <= bottom) return 0;
  if (value >= top) return 1;
  const fraction = (Math.log10(value) - Math.log10(bottom)) / (Math.log10(top) - Math.log10(bottom));
  return Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
}

function domainFraction(value: number, lo: number, hi: number): number {
  const span = hi - lo;
  if (Number.isFinite(span) && span > 0) {
    return Math.min(1, Math.max(0, (value - lo) / span));
  }
  const scale = Math.max(Math.abs(value), Math.abs(lo), Math.abs(hi), 1);
  const scaledSpan = hi / scale - lo / scale;
  if (!Number.isFinite(scaledSpan) || scaledSpan <= 0) return 0;
  const fraction = (value / scale - lo / scale) / scaledSpan;
  return Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
}

function safeDomainTicks(lo: number, hi: number, count: number): number[] {
  return Array.from({ length: Math.max(1, count) + 1 }, (_, index) => {
    if (index === 0) return lo;
    if (index === count) return hi;
    const ratio = index / count;
    return lo * (1 - ratio) + hi * ratio;
  }).filter(Number.isFinite);
}

/** Readable positive ticks inside the unchanged logarithmic domain, including both bounds. */
function logarithmicTicks(lo: number, hi: number, count: number): number[] | undefined {
  if (!(lo > 0 && hi > lo) || !Number.isFinite(lo) || !Number.isFinite(hi)) return undefined;
  const start = Math.log10(lo);
  const end = Math.log10(hi);
  const span = end - start;
  if (!(span > 0)) return undefined;
  const decades = span >= 1;
  const step = decades ? Math.ceil(span / count) : niceStep(hi - lo, count);
  if (!Number.isFinite(step) || step <= 0) return [...new Set(safeDomainTicks(lo, hi, count))];
  const ticks = [lo];
  // Keep the first and last interior tick clear of the exact bounds as well as one another.
  const minimumGap = decades ? step / 2 : span / (count * 2);
  const first = Math.ceil((decades ? start : lo) / step);
  for (let index = 0; index <= count + 1; index++) {
    const value = decades ? 10 ** ((first + index) * step) : (first + index) * step;
    if (!Number.isFinite(value) || value >= hi) break;
    if (value <= ticks.at(-1)!) continue;
    const logarithm = Math.log10(value);
    if (logarithm - Math.log10(ticks.at(-1)!) >= minimumGap && end - logarithm >= minimumGap) {
      ticks.push(value);
    }
  }
  ticks.push(hi);
  return ticks;
}

/** Nice-rounded [lo, hi, ticks[]] for an axis covering `dataLo..dataHi`. */
function niceDomain(dataLo: number, dataHi: number, beginAtZero: boolean, count: number) {
  let lo = beginAtZero ? Math.min(0, dataLo) : dataLo;
  let hi = beginAtZero ? Math.max(0, dataHi) : dataHi;
  if (lo === hi) {
    if (Math.abs(lo) > Number.MAX_VALUE / 2) {
      lo = lo > 0 ? lo / 2 : lo;
      hi = hi < 0 ? hi / 2 : hi;
    } else {
      lo -= 1;
      hi += 1;
    }
  }
  const span = hi - lo;
  if (!Number.isFinite(span)) return { lo, hi, ticks: safeDomainTicks(lo, hi, count) };
  const step = niceStep(span, count);
  if (!Number.isFinite(step) || step <= 0) {
    return { lo, hi, ticks: safeDomainTicks(lo, hi, count) };
  }
  const roundedLo = Math.floor(lo / step) * step;
  const roundedHi = Math.ceil(hi / step) * step;
  if (Number.isFinite(roundedLo)) lo = roundedLo;
  if (Number.isFinite(roundedHi)) hi = roundedHi;
  const slots = Math.floor((hi - lo) / step);
  if (!Number.isFinite(slots) || slots < 0 || slots > 100) {
    return { lo, hi, ticks: safeDomainTicks(lo, hi, count) };
  }
  const ticks: number[] = [];
  for (let index = 0; index <= slots; index++) {
    const value = lo + index * step;
    if (Number.isFinite(value)) ticks.push(value);
  }
  if (ticks.at(-1) !== hi) ticks.push(hi);
  return { lo, hi, ticks };
}

interface InteractiveMark {
  datasetIndex: number;
  index: number;
  label: string;
  value: number;
}

interface FormattedValueAxisTick {
  value: number;
  label: string;
}

interface LineHitPoint {
  datasetIndex: number;
  index: number;
  x: number;
  y: number;
}

export interface LyraLiteChartEventMap {
  'lr-datum-activate': CustomEvent<
    LyraChartDatumActivateDetail<'bar' | 'point', number | null>
  >;
  'lr-point-click': CustomEvent<{
    datasetIndex: number;
    index: number;
    label: string | undefined;
    value: number | null;
  }>;
}
/**
 * `<lr-lite-chart>` — a dependency-free bar/line chart, plain SVG/DOM
 * rendering with zero peer dependencies (unlike `lr-chart`, which wraps
 * `chart.js`). For a project whose architecture forbids a charting
 * dependency outright, this covers the common bar/line case: grouped or
 * stacked bars, multi-series lines, per-point click, and hover tooltips
 * (native SVG `<title>`, no positioning JS needed) — not a full `lr-chart`
 * replacement (no zoom/pan, no pie/doughnut/radar/scatter/bubble types, no
 * horizontal/dual-y-axis, no raw-config passthrough, no interactive legend
 * toggle — unlike `lr-chart`/`lr-box-plot`, clicking a `legend-item` here does
 * not hide its series; the legend is a static color key).
 *
 * Because this renders real DOM (not canvas), it reuses `lr-chart`'s
 * `--lr-chart-*` theme tokens directly via CSS `var()` — no
 * `getComputedStyle()`-based re-theming step is needed the way `chart.ts`
 * needs one for its canvas.
 *
 * By default (`layout="fit"`) the plot always squeezes to the measured host
 * width. Three independent, opt-in escape hatches for dense/aligned data:
 * `layout="scroll"` (+ `barWidth`) gives every bar a fixed pixel width and
 * lets the plot overflow the host horizontally (scrollable) instead of
 * squeezing; `maxLabels` decimates which x-axis text labels render (bars
 * always still render) once there are more categories than that, with
 * `maxLabels="auto"` deriving the cap from the allocated plot width; and
 * `barX` lets a consumer hand in its own per-category x-coordinate function
 * — e.g. to pixel-align this chart's bars with a sibling `lr-heatmap`'s
 * calendar columns — overriding the internal slot math for both bars and
 * their labels. All three are additive and no-ops when left unset.
 *
 * Seven further additive, opt-in properties: `pointText` overrides the
 * per-bar/per-point `<title>` tooltip and accessible-name text (mirrors
 * `lr-heatmap`'s `cellText` hook), falling back to the built-in raw-value
 * template when unset; `roundedBars` draws bars as a rounded-top path
 * instead of a square-cornered rect; `skipZero` omits a bar entirely (not
 * just zero-height) for an exactly-`0` value; `valueAxisGutter`/`barGapRatio`
 * override the internal `PAD_LEFT`/`BAR_GROUP_GAP` layout constants, while
 * `valueAxisGutter="auto"` sizes the gutter from the rendered tick strings; `scale`
 * (`type="bar"` only) switches the bar-height mapping from the default
 * linear `niceDomain` fraction to a `Math.sqrt(value / domainMax)`
 * compression (mirroring `lr-heatmap`'s matrix-mode `sqrt` scale) so a
 * skewed dataset's smaller bars don't get washed out by one dominant value
 * — gridlines/tick labels stay on the linear domain regardless, only the bar
 * marks' own height changes, and `type="line"` ignores `scale` entirely; and
 * `withoutValueAxis` suppresses `renderGrid()`'s gridlines/tick labels altogether
 * (x-axis category labels, rendered separately, are unaffected). An eighth,
 * `legendText`, appends a formatter-supplied string after each series' label in the
 * built-in legend row (e.g. a value or share) — no-op while `legend` is unset, matching the same
 * fallback-to-unchanged convention as every other hook here. The built-in multi-series accessible
 * table can independently format its finite numeric cells through `tableCellFormatter`; for a
 * stacked bar chart, `tableTotals` adds an opt-in localized total column. Both are no-ops when
 * unset.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * @customElement lr-lite-chart
 * @event lr-datum-activate - Fired when a bar/point is activated. The
 *   normalized detail includes `kind`, `datasetIndex`, `index`, `label`, and
 *   `value` across the chart family.
 * @event lr-point-click - Fired when a bar/point is activated (click, or
 *   Enter/Space while focused). `detail: { datasetIndex: number, index:
 *   number, label: string | undefined, value: number | null }` — same shape
 *   as `lr-chart`'s `lr-point-click`.
 * @csspart base - The host's flex layout wrapper.
 * @csspart description - The visually hidden accessible chart description, when set.
 * @csspart grid-line - Each horizontal gridline.
 * @csspart axis-label - Each axis tick label.
 * @csspart axis-title - The x/y axis title text, when set.
 * @csspart bar - Each bar rect (type="bar"). Carries `data-selected` and `aria-pressed="true"`
 *   when its category index is in `selectedIndices`. While `forced-colors: active` matches, its fill
 *   is a per-series SVG texture instead of a flat color, so series that collapse onto the same
 *   system color stay distinguishable.
 * @csspart line - Each series' stroked line path (type="line"). While `forced-colors: active`
 *   matches, it carries a per-series `stroke-dasharray` for the same reason.
 * @csspart point - Each series' per-point keyboard target (type="line"). Carries
 *   `data-selected` and explicit `aria-pressed` state.
 * @csspart legend - The legend row, when `legend` is set.
 * @csspart legend-item - Each legend entry.
 * @csspart legend-swatch - Each legend entry's color swatch. While `forced-colors: active`
 *   matches, it carries a `data-encoding` attribute selecting the CSS texture that matches its
 *   series' plotted encoding.
 * @csspart legend-text - Extra per-item text after the series label, rendered only when `legendText` is set.
 * @csspart live-region - The current mark announcement for keyboard users.
 * @csspart data-list - A visually hidden sampled list of plotted data points (single-series only).
 * @csspart data-table-toggle - The disclosure button rendered by `dataTableToggle`.
 * @cssprop [--lr-lite-chart-data-table-toggle-hover-bg=var(--lr-color-brand-quiet)] - Hover
 *   background of the `dataTableToggle` disclosure button.
 * @cssprop --lr-lite-chart-data-table-toggle-active-bg - Pressed background of the
 *   `dataTableToggle` disclosure button; defaults to a mix of the hover background with the shared
 *   active mix partner.
 * @csspart data-table - A visually hidden sampled category×series data table, rendered instead of
 *   `data-list` when there is more than one dataset so a screen-reader user hears series grouping
 *   rather than one flattened N×M sequence.
 * @csspart table - The generated semantic table inside the `data-table` container.
 * @csspart data-truncation - Explanation shown when built-in marks/data alternatives sample more
 *   than 1,000 records.
 * @slot data-table - An optional consumer-provided complete/paginated accessible data alternative.
 * @cssprop [--lr-chart-height=var(--lr-size-280px)] - Consumer-owned chart height. The `height`
 *   property supplies only a private fallback, so this public token always wins when set.
 * @cssprop [--lr-chart-grid-color=var(--lr-color-border)] - Grid-line color.
 * @cssprop [--lr-chart-tick-color=var(--lr-color-text-quiet)] - Axis and legend-detail color.
 * @cssprop [--lr-chart-legend-color=var(--lr-color-text)] - Legend label color.
 * @cssprop [--lr-chart-legend-side-max=var(--lr-size-15rem)] - Maximum side-legend track size.
 * @cssprop [--lr-chart-color-1=var(--lr-color-chart-1)] - First series color.
 * @cssprop [--lr-chart-color-2=var(--lr-color-chart-2)] - Second series color.
 * @cssprop [--lr-chart-color-3=var(--lr-color-chart-3)] - Third series color.
 * @cssprop [--lr-chart-color-4=var(--lr-color-chart-4)] - Fourth series color.
 * @cssprop [--lr-chart-color-5=var(--lr-color-chart-5)] - Fifth series color.
 * @cssprop [--lr-chart-color-6=var(--lr-color-chart-6)] - Sixth series color.
 * @cssprop [--lr-chart-color-7=var(--lr-color-chart-7)] - Seventh series color.
 * @cssprop [--lr-chart-color-8=var(--lr-color-chart-8)] - Eighth series color.
 * @cssprop [--lr-lite-chart-selected-outline-color=var(--lr-color-brand)] - Stroke for a bar/point whose category index is in `selectedIndices`.
 * @cssprop [--lr-lite-chart-selected-outline-width=var(--lr-size-2px)] - Stroke width for a bar/point whose category index is in `selectedIndices`.
 * @cssprop [--lr-chart-pattern-step=var(--lr-space-2xs)] - Tile size of the texture painted on
 *   `[part='legend-swatch']` while `forced-colors: active` matches, where the eight-color series
 *   ramp collapses onto a repeating system-color cycle and the texture becomes the only channel
 *   keeping series apart. Declared on the swatch part rather than the host; the stripe width within
 *   a tile stays `--lr-border-width-thin`, so a larger step spaces the stripes further apart.
 *   Shared verbatim with `<lr-chart>` and `<lr-box-plot>`.
 * @status stable
 * @since 4.0.0
 */
export class LyraLiteChart extends LyraElement<LyraLiteChartEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    chart: LYRA_DEFAULT_chart,
    chartCategory: LYRA_DEFAULT_chartCategory,
    chartData: LYRA_DEFAULT_chartData,
    chartDataSampled: LYRA_DEFAULT_chartDataSampled,
    chartSeriesLabel: LYRA_DEFAULT_chartSeriesLabel,
    chartTotal: LYRA_DEFAULT_chartTotal,
    liteChartBarLabel: LYRA_DEFAULT_liteChartBarLabel,
    liteChartCustomMarkSummary: LYRA_DEFAULT_liteChartCustomMarkSummary,
    liteChartMarkSummary: LYRA_DEFAULT_liteChartMarkSummary,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly ownedCollectionProperties = Object.freeze([
    'labels',
    'datasets',
    'selectedIndices',
  ]);

  static override styles = [LyraElement.styles, specialistTokens, styles, srOnly];

  @property({ converter: { fromAttribute: (value) => normalizeLiteChartType(value) } })
  type: LyraLiteChartType = 'bar';
  @property({ attribute: false }) labels: readonly string[] = [];
  private _datasets: readonly LyraLiteChartSeries[] = Object.freeze([]);
  /** Series with an array `data` payload. Malformed entries are dropped without hiding siblings. */
  @property({ attribute: false })
  get datasets(): readonly LyraLiteChartSeries[] {
    return this._datasets;
  }
  set datasets(value: readonly LyraLiteChartSeries[]) {
    const previous = this._datasets;
    this._datasets = normalizeLiteChartSeries(value);
    this.requestUpdate('datasets', previous);
  }
  @property({ type: Boolean }) legend = false;
  /** Logical placement for the optional DOM legend. */
  @property({
    attribute: 'legend-position',
    converter: { fromAttribute: normalizeChartChromeLegendPosition },
  })
  legendPosition: LyraChartChromeLegendPosition = 'bottom';
  /** A CSS `height`; invalid values leave the default height token in control. The public
   * `--lr-chart-height` token always takes precedence over this private fallback. */
  @property() height = '280px';
  /** Horizontal axis title. Long titles ellipsize to fit while retaining their full accessible name. */
  @property({ attribute: 'x-label' }) xLabel = '';
  /** Vertical axis title. Long titles ellipsize to fit while retaining their full accessible name. */
  @property({ attribute: 'y-label' }) yLabel = '';
  @property({ type: Boolean, attribute: 'begin-at-zero', converter: trueDefaultBooleanConverter }) beginAtZero = true;
  /** Stacks each category's bars into one segmented bar. Ignored for `type="line"`. */
  @property({ type: Boolean }) stacked = false;
  /** Formats a y-axis tick value for display (e.g. `(v) => \`$${v.toFixed(2)}\``). Falls back to the
   *  built-in nice-number formatter when unset. */
  @property({ attribute: false }) tickFormat?: (value: number) => string;
  /** Formats finite numeric cells in the built-in multi-series accessible table, including its
   *  opt-in total cells. Unset preserves locale-aware number formatting. */
  @property({ attribute: false }) tableCellFormatter?: LyraLiteChartTableCellFormatter;
  /** Unified context-object formatter shared with the Chart.js-backed chart surfaces. */
  @property({ attribute: false }) formatter?: LyraChartFormatter;
  /** Adds a localized total column to the built-in multi-series accessible table for a stacked
   *  bar chart. Ignored for grouped bars and line charts. */
  @property({ type: Boolean, attribute: 'table-totals' }) tableTotals = false;

  /**
   * Makes the generated data table visible; it stays screen-reader available when false. Same
   * meaning as `<lr-chart>`'s property of the same name.
   * @default false
   */
  @property({ type: Boolean, attribute: 'show-data-table' }) showDataTable = false;

  /**
   * Render a disclosure button above the accessible data table so a sighted reader can reveal the
   * numbers on demand, turning `showDataTable` into the disclosure's INITIAL state rather than its
   * whole behavior. The table stays in the DOM in both states, so assistive technology never loses
   * it.
   *
   * Matters more here than on `<lr-chart>`: this component exists to avoid the Chart.js peers, so
   * without it an app that chose it for that reason had to either hand-roll a `<details>` around a
   * duplicated table or adopt `<lr-chart>` and pull in Chart.js for a button — the cheap component
   * stuck with the expensive workaround.
   * @default false
   */
  @property({ type: Boolean, attribute: 'data-table-toggle' }) dataTableToggle = false;

  /** Live disclosure state; null until toggled, so an untouched control follows `showDataTable`. */
  @state() private dataTableExpandedOverride: boolean | null = null;

  private readonly dataTableId = nextId('lite-chart-data-table');

  /** Identical to `showDataTable` whenever `dataTableToggle` is off, keeping the unset path
   *  byte-identical to before. */
  private get dataTableVisible(): boolean {
    if (!this.dataTableToggle) return this.showDataTable;
    return this.dataTableExpandedOverride ?? this.showDataTable;
  }

  private toggleDataTable(): void {
    this.dataTableExpandedOverride = !this.dataTableVisible;
  }
  /** `'fit'` (default) squeezes the plot into the measured host width, unchanged from before this
   *  property existed. `'scroll'` gives every bar a fixed `barWidth` instead, letting the plot's
   *  content width exceed the host's — the host becomes horizontally scrollable
   *  (`overflow-x: auto`) so every bar stays exactly `barWidth` wide regardless of category count.
   *  Reflects to the `layout` attribute (e.g. for `:host([layout='scroll'])` host styling). */
  private _layout: LyraLiteChartLayout = 'fit';

  @property({ reflect: true, converter: LITE_CHART_LAYOUT })
  get layout(): LyraLiteChartLayout {
    return this._layout;
  }
  set layout(next: LyraLiteChartLayout) {
    const normalized = LITE_CHART_LAYOUT.normalizeReflected(this, 'layout', next);
    const old = this._layout;
    if (old === normalized) return;
    this._layout = normalized;
    this.requestUpdate('layout', old);
  }
  /** Fixed per-category bar width in px, used only when `layout="scroll"`. Ignored (as before this
   *  property existed) in `layout="fit"`, the default. Scroll content is capped at 1,000,000px,
   *  so an excessive requested width is reduced as needed to keep SVG and CSS geometry finite. */
  @property({ type: Number, attribute: 'bar-width' }) barWidth = 32;
  /** Caps how many x-axis category labels render text once `this.labels.length` exceeds it,
   *  decimating roughly evenly while always keeping the first and last label. `'auto'` derives a
   *  deterministic cap from the resolved plot width and widest rendered category label using the
   *  same width estimate as label ellipsis. Bars themselves always render regardless — only the
   *  axis text is decimated. An explicit number is authoritative. Unset (the default) renders every
   *  label, unchanged from before this property existed. Works in either `layout` mode. */
  @property({ converter: autoNumberConverter, attribute: 'max-labels' })
  maxLabels?: number | 'auto';
  /** Overrides the x-origin `renderBars()`/the category labels would otherwise compute internally
   *  for a given category index, for `type="bar"` only (bars and their axis labels stay
   *  consistent with each other either way). Lets a consumer pixel-align this chart's bars with,
   *  e.g., a sibling `lr-heatmap`'s calendar columns by handing both components the same
   *  coordinate function. Unset (the default) uses the existing internal per-category slot math,
   *  unchanged from before this property existed. The callback resolves once per rendered category
   *  per render and its finite result is shared by bars and labels; a non-finite result falls back
   *  to normal slot placement. */
  @property({ attribute: false }) barX?: (index: number) => number;
  /** Formats the per-bar/per-point `<title>` tooltip and accessible-name text — receives the category
   *  label, the raw value, and the dataset index. Falls back to the built-in raw-value template
   *  when unset (mirrors `lr-heatmap`'s `cellText` hook). */
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
  /** Overrides the internal `PAD_LEFT` (36px) axis-gutter constant, or accepts `'auto'` to size the
   *  gutter from the exact formatted tick strings rendered in the current pass. Automatic sizing
   *  never shrinks below 36px. Fit layout bounds it to the smaller of 240px or 40% of the measured
   *  SVG width; scroll layout bounds it at 240px without feeding the explicitly-sized SVG's own
   *  width back into its gutter. An explicit numeric value is authoritative and retains the
   *  established 0..1,000,000px finite guard. The gutter is on the left in LTR and the right in
   *  RTL, keeping the y axis at logical start. Unset keeps the 36px default. */
  @property({ converter: autoNumberConverter, attribute: 'value-axis-gutter' })
  valueAxisGutter?: number | 'auto';
  /** Overrides the internal `BAR_GROUP_GAP` (0.2) fraction of a category slot left as a gap between
   *  categories. Grouped bars share the remaining width with bounded internal gaps; ratios below
   *  1 retain positive bar widths. Unset (the default) keeps the 0.2 category gap. */
  @property({ type: Number, attribute: 'bar-gap-ratio' }) barGapRatio?: number;
  /** `'linear'` (default) maps values through the standard domain fraction. `'sqrt'` compresses
   *  bar magnitudes while keeping line points and gridlines linear; stacked bars compress each
   *  signed total once and split it proportionally. `'logarithmic'` maps bars, line points and
   *  gridlines onto the same log axis with positive, bounded logarithmic ticks. Logarithmic stacks
   *  map the finite positive total once and
   *  split its extent by raw positive shares; nonpositive segments have zero natural log height.
   *  With minBarHeight unset, the natural logarithmic stack remains within the plot. */
  @property() scale: LyraLiteChartScale = 'linear';
  /** Suppresses `renderGrid()` entirely — no gridlines, no y-axis tick labels. x-axis category
   *  labels (rendered separately) are unaffected. Default `false` preserves today's behavior. */
  @property({ type: Boolean, attribute: 'without-value-axis' }) withoutValueAxis = false;
  /** A pixel floor for a bar/stacked-segment's rendered height, for a nonzero value that would
   *  otherwise round to sub-pixel and become visually indistinguishable from absent (while still
   *  being focusable/tab-stoppable/announced) — a real accessibility/visibility gap for
   *  heterogeneous-magnitude stacked data. `type="bar"` only; a value of exactly `0` is unaffected
   *  (that's `skipZero`'s job, not this one's). Finite values are capped at 1,000,000px to keep
   *  derived SVG geometry practical. Unset (the default) reproduces today's `Math.max(0, y2 - y1)`
   *  exactly, with no floor. Authored floors can exceed the available plot height. Linear and
   *  logarithmic stacks push subsequent segments along their signed pixel cursor. */
  @property({ type: Number, attribute: 'min-bar-height' }) minBarHeight?: number;
  /** Category indexes to mark `data-selected` and `aria-pressed="true"` on every bar/point at
   *  that index, across every
   *  dataset -- e.g. to highlight a whole selected week's column in a stacked chart. Empty (the
   *  default) reproduces today's exact output: no mark carries `data-selected`. Style the highlight
   *  via the `--lr-lite-chart-selected-outline-color` and
   *  `--lr-lite-chart-selected-outline-width` custom properties -- selectors such as
   *  `::part(bar)[data-selected]` and `::part(point)[data-selected]` are invalid CSS (Shadow Parts
   *  forbids an attribute selector after `::part()`), so the outline is
   *  painted inside the shadow root and exposed through that token. This component takes no opinion
   *  on what the highlight looks like, only which marks it applies to. */
  @property({ attribute: false }) selectedIndices: readonly number[] = [];
  /** Overrides the `<svg>`'s auto-derived `aria-label` (`datasets.map(d => d.label).join(', ') ||
   *  'Chart'`) — for a consumer with a real, localized chart description. A host `aria-label`
   *  takes precedence. Unset (the default) keeps today's auto-derived (English-fallback) label
   *  exactly. `lr-lite-chart` keeps this override under its original `accessible-label` name; it
   *  is unrelated to (and was not renamed alongside) the deprecated `accessible-label` alias that
   *  `lr-chart`/`lr-box-plot` dropped in favor of their mirrored `label` property. */
  @property({ attribute: 'accessible-label' }) accessibleLabel?: string;
  /** Accessible chart name. A host `aria-label` wins. */
  @property() label: string | null = null;
  /** Optional accessible chart description. */
  @property() description: string | null = null;

  /** Instance-unique prefix for the forced-colors `<pattern>` ids this chart's marks reference. */
  private forcedColorPatternId = nextId('lite-chart-pattern');
  private descriptionId = nextId('lite-chart-description');

  @state() private plotWidth = 0;
  @state() private plotHeight = 0;
  /** Browser-only fit measurement begins after the first hydrated render so the server fallback
   * stays structurally identical during hydration. */
  @state() private fitMeasurementAvailable = false;
  /** One roving tab stop across all bar/point marks. */
  @state() private activeMarkIndex = 0;

  @query('svg') private svgEl?: SVGSVGElement;
  @query('lr-live-region') private liveRegion?: LyraLiveRegion;
  private resizeObserver?: ResizeObserver;
  private resizeObserverDocument?: Document;
  private resizeObserverTarget?: SVGSVGElement;
  private resizeObserverGeneration = 0;
  private axisTitleTargets = new Set<SVGTextElement>();
  private axisTitleFrame?: number;
  private axisTitleFits = new WeakMap<SVGTextElement, {
    source: string; extent: number; display: string; width: number;
  }>();
  private forcedColorsQuery?: MediaQueryList;
  private forcedColorsWindow?: Window;
  private refocusMarkAfterUpdate = false;
  private refocusChartAfterUpdate = false;
  private politeAnnouncementSink?: AnnouncementSink;
  private lastDataTruncationAnnouncement = '';
  /** Gates the sampling notice so an initially supplied large dataset is described, not announced. */
  private isMounting = true;

  /**
   * Appends one streamed category to every series and optionally keeps only the newest `maxPoints`
   * categories. This is a controlled convenience method: it replaces `labels`/`datasets` with new
   * arrays, so a host can listen for the property update or continue treating the chart as a normal
   * controlled component. Missing series values become `null` rather than shifting alignment.
   */
  appendData(label: string, values: (number | null)[], maxPoints: number = 0): void {
    const limit = Math.max(0, finiteCount(maxPoints, 0));
    let domainLength = this.labels.length;
    for (const series of this.datasets) domainLength = Math.max(domainLength, series.data.length);
    const labels = [
      ...this.labels,
      ...Array.from({ length: Math.max(0, domainLength - this.labels.length) }, () => ''),
      label,
    ];
    const datasets = this.datasets.map((series, index) => ({
      ...series,
      data: [
        ...series.data,
        ...Array.from({ length: Math.max(0, domainLength - series.data.length) }, () => null),
        values[index] ?? null,
      ],
    }));
    this.labels = limit > 0 ? labels.slice(-limit) : labels;
    this.datasets = limit > 0 ? datasets.map((series) => ({ ...series, data: series.data.slice(-limit) })) : datasets;
  }

  /**
   * Returns a spreadsheet-safe CSV snapshot over the complete canonical record domain: the
   * greatest of the label count and every series' data count. Missing labels and values become
   * empty aligned cells, so a longer or ragged series is never truncated or shifted.
   */
  exportData(format: LyraLiteChartExportFormat): string {
    if (format === 'svg') {
      const XMLSerializerCtor = this.ownerDocument.defaultView?.XMLSerializer;
      if (!this.svgEl || typeof XMLSerializerCtor !== 'function') return '';
      return new XMLSerializerCtor().serializeToString(this.svgEl);
    }
    const header = ['label', ...this.datasets.map((series) => series.label)].map(escapeCsvField).join(',');
    const rows = Array.from({ length: this.recordCount() }, (_, index) => {
      const label = this.labels[index] ?? '';
      return [
        label,
        ...this.datasets.map((series, datasetIndex) => {
          const value = series.data[index];
          return typeof value === 'number' && Number.isFinite(value)
            ? this.formatter?.({
                value,
                surface: 'export',
                datasetIndex,
                index,
                label,
                seriesLabel: series.label,
              }) ?? value
            : '';
        }),
      ].map(escapeCsvField).join(',');
    });
    return [header, ...rows].join('\r\n');
  }

  override attributeChangedCallback(name: string, oldValue: string | null, value: string | null): void {
    super.attributeChangedCallback(name, oldValue, value);
    if (oldValue !== value && (name === 'style' || name === 'class')) this.fitAxisTitles();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncAnnouncementSink();
    this.armResizeObserver();
    this.armForcedColorsWatcher();
  }

  private armResizeObserver(): void {
    const target = this.svgEl;
    const ownerDocument = this.ownerDocument;
    if (!this.isConnected || !target) return;
    if (
      this.resizeObserver &&
      this.resizeObserverDocument === ownerDocument &&
      this.resizeObserverTarget === target
    ) {
      return;
    }
    this.resetResizeObserver();
    const ResizeObserverCtor = ownerDocument.defaultView?.ResizeObserver;
    if (!ResizeObserverCtor) return;
    const generation = this.resizeObserverGeneration;
    const observer = new ResizeObserverCtor((entries) => {
      if (
        this.resizeObserver !== observer ||
        this.resizeObserverGeneration !== generation ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument ||
        this.resizeObserverTarget !== target
      ) {
        return;
      }
      const svgEntry = entries.find((entry) => entry.target === target);
      if (svgEntry) {
        const box = svgEntry.contentBoxSize?.[0];
        if (box) {
          this.plotWidth = box.inlineSize;
          this.plotHeight = box.blockSize;
        } else {
          const rect = target.getBoundingClientRect();
          this.plotWidth = rect.width;
          this.plotHeight = rect.height;
        }
        this.fitAxisTitles();
      }
      if (entries.some((entry) => this.axisTitleTargets.has(entry.target as SVGTextElement))) {
        this.queueAxisTitleFit();
      }
    });
    this.resizeObserver = observer;
    this.resizeObserverDocument = ownerDocument;
    this.resizeObserverTarget = target;
    // A reconnect re-creates the observer above but the `<svg>` render root
    // content survives across disconnect/reconnect (Lit doesn't tear down the
    // shadow root) — re-observe it here (firstUpdated() only ever runs once,
    // on the very first render, so it can't be relied on for a reconnect).
    if (target) observer.observe(target);
    this.syncAxisTitleTargets();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.releaseAnnouncementSink();
    this.lastDataTruncationAnnouncement = '';
    this.isMounting = true;
    this.resetResizeObserver();
    this.disarmForcedColorsWatcher();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.resetResizeObserver();
    this.releaseAnnouncementSink();
    this.syncAnnouncementSink();
    this.refreshFitMeasurementAvailability();
    this.armForcedColorsWatcher();
  }

  private readonly onForcedColorsChange = (): void => {
    if (!this.isConnected || this.ownerDocument.defaultView !== this.forcedColorsWindow) return;
    this.requestUpdate();
  };

  private armForcedColorsWatcher(): void {
    const ownerWindow = this.ownerDocument?.defaultView ?? undefined;
    if (!ownerWindow?.matchMedia) return;
    if (this.forcedColorsWindow === ownerWindow && this.forcedColorsQuery) return;
    this.disarmForcedColorsWatcher();
    this.forcedColorsWindow = ownerWindow;
    this.forcedColorsQuery = ownerWindow.matchMedia('(forced-colors: active)');
    this.forcedColorsQuery.addEventListener('change', this.onForcedColorsChange);
  }

  private disarmForcedColorsWatcher(): void {
    this.forcedColorsQuery?.removeEventListener('change', this.onForcedColorsChange);
    this.forcedColorsQuery = undefined;
    this.forcedColorsWindow = undefined;
  }

  private syncAnnouncementSink(): void {
    if (!this.isConnected) return;
    if (this.politeAnnouncementSink?.element.ownerDocument === this.ownerDocument) return;
    this.releaseAnnouncementSink();
    this.politeAnnouncementSink = acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
  }

  private releaseAnnouncementSink(): void {
    this.politeAnnouncementSink?.release();
    this.politeAnnouncementSink = undefined;
  }

  private resetResizeObserver(): void {
    if (this.axisTitleFrame !== undefined) {
      this.resizeObserverDocument?.defaultView?.cancelAnimationFrame(this.axisTitleFrame);
      this.axisTitleFrame = undefined;
    }
    this.axisTitleTargets.clear();
    this.resizeObserverGeneration += 1;
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.resizeObserverDocument = undefined;
    this.resizeObserverTarget = undefined;
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
  protected override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    this.armResizeObserver();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    // A browser-only mount can wait for ResizeObserver before drawing coordinate-based geometry.
    // A hydrated mount must first reproduce the SSR fallback, then switch to measured geometry on
    // its following update or Lit rejects the server-rendered iterable during hydration.
    this.seedFirstRenderState(() => {
      this.refreshFitMeasurementAvailability();
    });
    const marksChanged = ['type', 'labels', 'datasets', 'skipZero'].some((name) => changed.has(name));
    if (!marksChanged) return;
    const active = activeElementIn(this.shadowRoot) ?? null;
    const hadFocusedMark = active?.matches('[part="bar"], [part="point"]') ?? false;
    const priorPosition = Number(active?.getAttribute('data-mark-index') ?? this.activeMarkIndex);
    const datasetAttribute = active?.getAttribute('data-dataset-index');
    const indexAttribute = active?.getAttribute('data-index');
    const datasetIndex = Number(datasetAttribute);
    const index = Number(indexAttribute);
    const marks = this.interactiveMarks();
    const sameIdentity =
      datasetAttribute !== null && datasetAttribute !== undefined &&
      indexAttribute !== null && indexAttribute !== undefined
        ? marks.findIndex(
            (mark) => mark.datasetIndex === datasetIndex && mark.index === index,
          )
        : -1;
    this.activeMarkIndex = marks.length
      ? sameIdentity >= 0
        ? sameIdentity
        : Math.min(Math.max(priorPosition, 0), marks.length - 1)
      : 0;
    this.refocusMarkAfterUpdate = hadFocusedMark && marks.length > 0;
    this.refocusChartAfterUpdate = hadFocusedMark && marks.length === 0;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const wasMounting = this.isMounting;
    this.isMounting = false;
    if (changed.has('height')) {
      const height = sanitizeCssLength(this.height, 'height');
      if (height) this.style.setProperty('--_lr-chart-height', height);
      else this.style.removeProperty('--_lr-chart-height');
    }
    const dataTruncation = this.dataTruncationMessage();
    if (wasMounting) {
      this.lastDataTruncationAnnouncement = dataTruncation;
    } else if (dataTruncation !== this.lastDataTruncationAnnouncement) {
      this.lastDataTruncationAnnouncement = dataTruncation;
      if (dataTruncation) this.politeAnnouncementSink?.announce(dataTruncation);
    }
    if (this.refocusMarkAfterUpdate) {
      this.refocusMarkAfterUpdate = false;
      const marks = this.renderRoot.querySelectorAll<SVGGraphicsElement>(
        '[part="bar"], [part="point"]',
      );
      marks[this.normalizedMarkIndex()]?.focus();
    }
    if (this.refocusChartAfterUpdate) {
      this.refocusChartAfterUpdate = false;
      this.svgEl?.focus();
    }
    this.fitAxisTitles();
    this.syncAxisTitleTargets();
  }

  /** Fit using the rendered font after hydration, preserving Lit's text part anchors. */
  private fitAxisTitles(): void {
    if (!this.ownerDocument?.defaultView || !this.isConnected || !this.svgEl?.getClientRects().length) return;
    for (const title of this.svgEl.querySelectorAll<SVGTextElement>('[part="axis-title"]')) {
      const text = Array.from(title.childNodes).find((node) => node.nodeType === 3) as Text | undefined;
      if (!text) continue;
      const source = title.getAttribute('aria-label') ?? '';
      const extent = finiteRange(Number(title.getAttribute('data-title-extent')), 0, 0, MAX_SCROLL_CONTENT_WIDTH);
      const previous = this.axisTitleFits.get(title);
      if (
        previous?.source === source && previous.extent === extent &&
        previous.display === text.data && previous.width === title.getComputedTextLength()
      ) continue;
      title.style.removeProperty('opacity');
      text.data = source;
      if (title.getComputedTextLength() > extent) {
        text.data = '…';
        // Keep measurable geometry when no glyph fits so inherited font changes can restore it.
        if (title.getComputedTextLength() > extent) title.style.opacity = '0';
        else {
          // Binary search bounds layout reads logarithmically even for a very long caller title.
          let lower = 0;
          let upper = source.length;
          while (lower < upper) {
            const middle = Math.ceil((lower + upper) / 2);
            text.data = `${source.slice(0, middle)}…`;
            if (title.getComputedTextLength() <= extent) lower = middle;
            else upper = middle - 1;
          }
          // Do not leave the first half of a surrogate pair immediately before the ellipsis.
          const last = source.charCodeAt(lower - 1);
          if (last >= 0xd800 && last <= 0xdbff) lower -= 1;
          text.data = `${source.slice(0, lower)}…`;
        }
      }
      this.axisTitleFits.set(title, { source, extent, display: text.data, width: title.getComputedTextLength() });
    }
  }

  private syncAxisTitleTargets(): void {
    if (!this.resizeObserver || !this.svgEl) return;
    const current = new Set(this.svgEl.querySelectorAll<SVGTextElement>('[part="axis-title"]'));
    for (const title of this.axisTitleTargets) {
      if (!current.has(title)) this.resizeObserver.unobserve(title);
    }
    for (const title of current) {
      if (!this.axisTitleTargets.has(title)) this.resizeObserver.observe(title);
    }
    this.axisTitleTargets = current;
  }

  private queueAxisTitleFit(): void {
    const document = this.resizeObserverDocument;
    const window = document?.defaultView;
    if (!window || this.axisTitleFrame !== undefined) return;
    const generation = this.resizeObserverGeneration;
    // Font changes can alter text geometry without resizing the SVG. Fit on the next frame so
    // shortening an observed title cannot feed back into the current ResizeObserver delivery.
    const frame = window.requestAnimationFrame(() => {
      if (
        this.axisTitleFrame !== frame || this.resizeObserverGeneration !== generation ||
        !this.isConnected || this.ownerDocument !== document
      ) return;
      this.axisTitleFrame = undefined;
      this.fitAxisTitles();
    });
    this.axisTitleFrame = frame;
  }

  private colorFor(index: number, series: LyraLiteChartSeries): string {
    return sanitizeCssColor(series.color) ?? DEFAULT_PALETTE[index % DEFAULT_PALETTE.length]!; // safe: modulo a non-empty constant palette
  }

  /** Effective closed-set type for both attribute and untyped property writes. */
  private get effectiveType(): LyraLiteChartType {
    return normalizeLiteChartType(this.type);
  }

  /**
   * Whether the per-series forced-colors encodings apply. Under `forced-colors: active` the
   * `--lr-color-chart-*` ramp behind `DEFAULT_PALETTE` is remapped onto the small repeating
   * system-color cycle the platform exposes, so series 1/4/7 (and 2/5/8, 3/6) paint identically.
   * Texture and line dash are what keep them apart — the SVG counterpart of the CanvasPattern and
   * `borderDash` cycle `<lr-chart>` applies to its own repeated colors.
   */
  private forcedColors(): boolean {
    // Optional-chained: this is reached from render(), which @lit-labs/ssr runs server-side where
    // the element shim has no `ownerDocument` -- a bare property access throws there.
    // forcedColorsActive() already treats a nullish view as "not forced", which is the correct
    // server-render answer anyway.
    return forcedColorsActive(this.ownerDocument?.defaultView);
  }

  /** The paint a mark of `index` uses: a texture reference under forced colors, else the color. */
  private markPaint(index: number, series: LyraLiteChartSeries): string {
    const color = this.colorFor(index, series);
    return this.effectiveType === 'bar' && this.forcedColors()
      ? `url(#${this.forcedColorPatternId}-${index})`
      : color;
  }

  /** The legend swatch's texture key, or `nothing` on a normal palette. */
  private legendEncoding(index: number): ForcedColorEncodingName | typeof nothing {
    return this.forcedColors() ? forcedColorEncoding(index).name : nothing;
  }

  /** `stroke-dasharray` for a line series, or `nothing` on a normal palette. */
  private markDash(index: number): string | typeof nothing {
    if (!this.forcedColors()) return nothing;
    const dash = forcedColorEncoding(index).dash;
    // The solid encoding has an empty dash list, which is not a valid `stroke-dasharray` value;
    // `none` is its explicit spelling and keeps that series' line unbroken.
    return dash.length ? dash.join(' ') : 'none';
  }

  /**
   * One `<pattern>` per series, painted only while forced colors are active. Each tile lays the
   * series' own (system) color down first, then strokes the encoding's texture in the surface
   * color, mirroring `createForcedColorPattern()`'s canvas tiles shape for shape.
   */
  private renderForcedColorPatterns() {
    // Only bars consume a pattern fill; a line's own dash carries the encoding, and a 4px point
    // is too small to read one, so anything else would emit defs nothing references.
    if (this.effectiveType !== 'bar' || !this.forcedColors()) return nothing;
    const size = 8;
    const half = size / 2;
    const texture = 'var(--lr-color-surface)';
    return svg`<defs>
      ${this.recordSample().seriesIndexes.map((index) => {
        const series = this.datasets[index]!;
        const encoding = forcedColorEncoding(index).name;
        const shapes = (() => {
          switch (encoding) {
            case 'horizontal':
              return svg`<rect y=${half} width=${size} height="1" fill=${texture}></rect>`;
            case 'vertical':
              return svg`<rect x=${half} width="1" height=${size} fill=${texture}></rect>`;
            case 'diagonal':
              return svg`<path
                d=${`M${-half},${size} L${half},0 M${half},${size} L${size + half},0`}
                stroke=${texture}
                stroke-width="1"
              ></path>`;
            case 'reverse-diagonal':
              return svg`<path
                d=${`M${-half},0 L${half},${size} M${half},0 L${size + half},${size}`}
                stroke=${texture}
                stroke-width="1"
              ></path>`;
            case 'crosshatch':
              return svg`<rect y=${half} width=${size} height="1" fill=${texture}></rect>
                <rect x=${half} width="1" height=${size} fill=${texture}></rect>`;
            case 'dots':
              return svg`<circle cx=${half} cy=${half} r="1.5" fill=${texture}></circle>`;
            case 'checker':
              return svg`<rect width=${half} height=${half} fill=${texture}></rect>
                <rect x=${half} y=${half} width=${half} height=${half} fill=${texture}></rect>`;
            default:
              return nothing;
          }
        })();
        return svg`<pattern
          id=${`${this.forcedColorPatternId}-${index}`}
          width=${size}
          height=${size}
          patternUnits="userSpaceOnUse"
        >
          <rect width=${size} height=${size} fill=${this.colorFor(index, series)}></rect>
          ${shapes}
        </pattern>`;
      })}
    </defs>`;
  }

  /** Dispatches to the host-provided `pointText` formatter when set, otherwise `undefined` (the
   *  caller falls back to its own built-in template) — mirrors `lr-heatmap`'s `resolveCellText()`. */
  private resolvePointText(label: string, value: number, datasetIndex: number): string | undefined {
    return this.formatter?.({
      value,
      surface: 'visual',
      datasetIndex,
      label,
      seriesLabel: this.datasets[datasetIndex]?.label,
    }) ?? this.pointText?.(label, value, datasetIndex);
  }

  private formatTableCell(
    value: number,
    context: LyraLiteChartTableCellContext,
    numberFormat: Intl.NumberFormat,
  ): string {
    return this.formatter?.({
      value,
      surface: 'table',
      datasetIndex: context.datasetIndex ?? undefined,
      index: context.index,
      label: context.label,
      seriesLabel: context.seriesLabel ?? undefined,
      ...(context.kind === 'total' ? { statistic: 'total' as const } : {}),
    }) ?? this.tableCellFormatter?.(value, context) ?? numberFormat.format(value);
  }

  private tableTotalAt(index: number, seriesIndexes: readonly number[]): number | null {
    let total = 0;
    let hasValue = false;
    for (const seriesIndex of seriesIndexes) {
      const series = this.datasets[seriesIndex];
      if (!series) continue;
      const value = series.data[index];
      if (value == null || !Number.isFinite(value)) continue;
      total = finiteAdd(total, value);
      hasValue = true;
    }
    return hasValue ? total : null;
  }

  /** The complete category domain, including values supplied without a matching label. */
  private recordCount(): number {
    let count = this.labels.length;
    for (const series of this.datasets) {
      count = Math.max(count, series.data.length);
    }
    return count;
  }

  /** Source indexes shared by SVG marks, keyboard navigation, and the built-in data alternative. */
  private recordSample() {
    const rowCount = this.recordCount();
    const seriesCount = this.datasets.length;
    return { rowCount, seriesCount, ...sampleChartTableIndexes(rowCount, seriesCount) };
  }

  private generatedDataIsSampled(): boolean {
    if (this.hasCustomDataTable()) return false;
    const sample = this.recordSample();
    if (sample.rowCount === 0 || sample.seriesCount === 0) return false;
    return sample.rowIndexes.length < sample.rowCount || sample.seriesIndexes.length < sample.seriesCount;
  }

  private dataTruncationMessage(): string {
    return this.generatedDataIsSampled() ? this.localize('chartDataSampled') : '';
  }

  private hasCustomDataTable(): boolean {
    return Array.from(this.children).some((child) => child.getAttribute('slot') === 'data-table');
  }

  /** The ordered set of eligible marks used by both keyboard navigation and
   * the screen-reader data alternative. */
  private interactiveMarks(): InteractiveMark[] {
    const marks: InteractiveMark[] = [];
    const sample = this.recordSample();
    if (this.effectiveType === 'bar') {
      for (const index of sample.rowIndexes) {
        for (const datasetIndex of sample.seriesIndexes) {
          const value = this.datasets[datasetIndex]?.data[index];
          if (value == null || !Number.isFinite(value) || (this.skipZero && value === 0)) continue;
          marks.push({ datasetIndex, index, label: this.labels[index] ?? '', value });
        }
      }
    } else {
      sample.seriesIndexes.forEach((datasetIndex) => {
        const series = this.datasets[datasetIndex];
        if (!series) return;
        sample.rowIndexes.forEach((index) => {
          const value = series.data[index];
          if (value == null || !Number.isFinite(value)) return;
          marks.push({ datasetIndex, index, label: this.labels[index] ?? '', value });
        });
      });
    }
    return marks;
  }

  /** A fit-layout chart needs the SVG's allocated dimensions before any coordinate-based
   * content can be drawn. Keep the SVG itself mounted so ResizeObserver can provide that first
   * measurement, while a realm without ResizeObserver keeps the established fallback rendering. */
  private awaitingFitMeasurement(): boolean {
    return (
      this.layout === 'fit' &&
      this.fitMeasurementAvailable &&
      (this.plotWidth <= 0 || this.plotHeight <= 0)
    );
  }

  private refreshFitMeasurementAvailability(): void {
    this.fitMeasurementAvailable = typeof this.ownerDocument?.defaultView?.ResizeObserver === 'function';
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
    const custom = this.formatter?.({
      value: mark.value,
      surface: 'spoken',
      datasetIndex: mark.datasetIndex,
      index: mark.index,
      label: mark.label,
      seriesLabel: series,
    }) ?? this.resolvePointText(mark.label, mark.value, mark.datasetIndex);
    if (custom) {
      return this.localize('liteChartCustomMarkSummary', undefined, {
        content: custom,
        index: getNumberFormat(this.effectiveLocale).format(index + 1),
        total: getNumberFormat(this.effectiveLocale).format(marks.length),
      });
    }
    return this.localize('liteChartMarkSummary', undefined, {
      series,
      label: mark.label,
      value: getNumberFormat(this.effectiveLocale).format(mark.value),
      index: getNumberFormat(this.effectiveLocale).format(index + 1),
      total: getNumberFormat(this.effectiveLocale).format(marks.length),
    });
  }

  private onMarkFocus(index: number): void {
    const marks = this.interactiveMarks();
    if (!marks[index]) return;
    this.activeMarkIndex = index;
    // `force: true` bypasses `<lr-live-region>`'s default throttle window --
    // each roving-tabindex move is its own discrete, user-driven navigation
    // event (not a streaming firehose), so it must land immediately rather
    // than waiting out (or getting coalesced by) the throttle.
    this.liveRegion?.announce(this.markAnnouncement(index, marks), { force: true });
  }

  private focusMark(index: number): void {
    const marks = this.interactiveMarks();
    if (!marks[index]) return;
    this.activeMarkIndex = index;
    void this.updateComplete.then(() => {
      const markEls = Array.from(this.renderRoot.querySelectorAll('[part="bar"], [part="point"]')) as HTMLElement[];
      const mark = markEls[index];
      if (!mark) return;
      if (activeElementIn(this.shadowRoot) === mark) this.onMarkFocus(index);
      else mark.focus();
    });
  }

  /**
   * A value-to-y-pixel mapping for a bar's top/bottom edge. `'linear'` (the
   * default) is the standard `niceDomain`-fraction formula. `'sqrt'`
   * compresses each signed magnitude independently around the linear zero
   * baseline, so positive and negative bars stay on their respective sides.
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
      const zeroY = plotY + plotH - domainFraction(0, lo, hi) * plotH;
      if (value >= 0) {
        const domainMax = hi > 0 ? hi : 1;
        const fraction = Math.sqrt(
          Math.min(domainMax, value) / domainMax
        );
        return zeroY - fraction * (zeroY - plotY);
      }
      const domainMax = lo < 0 ? -lo : 1;
      const fraction = Math.sqrt(
        Math.min(domainMax, -value) / domainMax
      );
      return zeroY + fraction * (plotY + plotH - zeroY);
    }
    return plotY + plotH - this.valueFraction(value, lo, hi) * plotH;
  }

  /**
   * The `[0, 1]` axis fraction for `value` under the active `scale`.
   *
   * `'logarithmic'` routes through `logDomainFraction`; everything else keeps the plain linear
   * `domainFraction`. Deliberately does NOT fold in `'sqrt'`: that mode compresses bars only, and
   * has never moved gridlines or line points, so pulling it in here would silently change existing
   * output. Bars reach this through `barValueToY()`, which applies sqrt before calling in.
   */
  private valueFraction(value: number, lo: number, hi: number): number {
    return this.scale === 'logarithmic'
      ? logDomainFraction(value, this.logDomainFloor(lo, hi), hi)
      : domainFraction(value, lo, hi);
  }

  /**
   * The lower bound of a logarithmic axis.
   *
   * Deliberately NOT the linear `lo`: `beginAtZero` defaults to true, so `lo` is normally `0`, and
   * zero has no logarithm. Using the smallest POSITIVE datum instead is what makes the axis span
   * the data's real decades — otherwise a 1..1000 series collapses onto a single decade and every
   * value below the top one pins to the baseline. Falls back to a decade below the maximum when no
   * positive datum exists, which keeps the geometry finite for a degenerate series.
   */
  private logDomainFloor(lo: number, hi: number): number {
    if (lo > 0) return lo;
    let smallest = Number.POSITIVE_INFINITY;
    for (const series of this.datasets) {
      for (const value of series.data) {
        if (value == null || !Number.isFinite(value) || value <= 0) continue;
        if (value < smallest) smallest = value;
      }
    }
    if (Number.isFinite(smallest)) return smallest;
    return hi > 0 ? hi / 10 : 1;
  }

  /** Normalizes `minBarHeight` to a non-negative pixel floor, or `undefined` when left unset -- a
   *  non-finite/negative explicit value falls back to `0` (a no-op floor, since a bar's natural
   *  height is never negative) rather than corrupting every stacked-bar Y position it's compared
   *  against/subtracted from in `renderBars()`. A practical ceiling keeps its derived SVG geometry
   *  bounded even when an otherwise finite public property is enormous. */
  private effectiveMinBarHeight(): number | undefined {
    return this.minBarHeight == null
      ? undefined
      : finiteRange(this.minBarHeight, 0, 0, MAX_SCROLL_CONTENT_WIDTH);
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
    if (this.effectiveType === 'bar' && this.stacked) {
      // Stacked bars: each category's extent is the sum of its (signed)
      // positive/negative segments, not the max single value.
      for (let i = 0; i < this.recordCount(); i++) {
        let pos = 0;
        let neg = 0;
        for (const s of this.datasets) {
          const v = s.data[i];
          if (v == null || !Number.isFinite(v)) continue;
          if (v >= 0) pos = finiteAdd(pos, v);
          else neg = finiteAdd(neg, v);
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
    const domain = niceDomain(lo, hi, this.beginAtZero, TICK_COUNT);
    if (this.scale === 'logarithmic') {
      const ticks = logarithmicTicks(this.logDomainFloor(domain.lo, domain.hi), domain.hi, TICK_COUNT);
      if (ticks) return { ...domain, ticks };
    }
    return domain;
  }

  private emitPoint(datasetIndex: number, index: number): void {
    const label = this.labels[index];
    const value = this.datasets[datasetIndex]?.data[index] ?? null;
    this.emit('lr-datum-activate', {
      kind: this.effectiveType === 'bar' ? 'bar' : 'point',
      datasetIndex,
      index,
      label,
      value,
    });
    this.emit('lr-point-click', { datasetIndex, index, label, value });
  }

  private emitNearestLinePoint(
    event: MouseEvent,
    points: readonly LineHitPoint[],
    fallbackDatasetIndex: number,
    fallbackIndex: number,
  ): void {
    let selected = points.find(
      (point) => point.datasetIndex === fallbackDatasetIndex && point.index === fallbackIndex,
    );
    const currentTarget = event.currentTarget;
    const svgElement =
      currentTarget instanceof SVGElement ? currentTarget.ownerSVGElement : null;
    const screenMatrix = svgElement?.getScreenCTM();

    // A physical pointer click carries screen coordinates and `detail > 0`; choose the closest
    // mark in both axes so overlapping 24px targets cannot hand selection to whichever series was
    // painted last. Programmatic `.click()`/dispatchEvent() activation has `detail === 0`, so it
    // intentionally keeps the addressed mark as its deterministic fallback.
    if (event.detail > 0 && svgElement && screenMatrix && points.length) {
      const renderedPoint = svgElement.createSVGPoint();
      const squaredDistance = (point: LineHitPoint): number => {
        renderedPoint.x = point.x;
        renderedPoint.y = point.y;
        const screenPoint = renderedPoint.matrixTransform(screenMatrix);
        const dx = event.clientX - screenPoint.x;
        const dy = event.clientY - screenPoint.y;
        return dx * dx + dy * dy;
      };
      let bestDistance = selected
        ? squaredDistance(selected)
        : Number.POSITIVE_INFINITY;
      for (const point of points) {
        const distance = squaredDistance(point);
        if (distance < bestDistance) {
          selected = point;
          bestDistance = distance;
        }
      }
    }

    this.emitPoint(
      selected?.datasetIndex ?? fallbackDatasetIndex,
      selected?.index ?? fallbackIndex,
    );
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

  private formatValueAxisTick(value: number): string {
    return this.formatter?.({ value, surface: 'tick' }) ??
      (this.tickFormat ? this.tickFormat(value) : formatTick(value, this.effectiveLocale));
  }

  private renderGrid(
    plotX: number,
    plotY: number,
    plotW: number,
    plotH: number,
    ticks: readonly FormattedValueAxisTick[],
    lo: number,
    hi: number,
  ) {
    const rtl = this.effectiveDirection === 'rtl';
    return ticks.map(({ value, label }) => {
      const y = plotY + plotH - this.valueFraction(value, lo, hi) * plotH;
      return svg`
        <line part="grid-line" x1=${plotX} y1=${y} x2=${plotX + plotW} y2=${y}></line>
        <text
          part="axis-label"
          x=${rtl ? plotX + plotW + VALUE_AXIS_TICK_OFFSET : plotX - VALUE_AXIS_TICK_OFFSET}
          y=${y}
          text-anchor="end"
          dominant-baseline="middle"
        >${label}</text>
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
  private renderBars(
    plotX: number,
    plotY: number,
    plotH: number,
    slot: number,
    lo: number,
    hi: number,
    barOrigins: ReadonlyMap<number, number>,
    recordSample: { readonly rowIndexes: readonly number[]; readonly seriesIndexes: readonly number[] },
    selectedIndices: ReadonlySet<number>,
  ) {
    const groupCount = this.stacked ? 1 : Math.max(1, recordSample.seriesIndexes.length);
    // barGapRatio is a fraction of a category slot (groupW = slot * (1 - groupGap)) -- clamped to
    // [0, 1] so a non-finite or out-of-range value can't invert groupW negative (>1) or leave no
    // gap logic at all (<0), either of which would corrupt every bar's x-position/width below.
    const groupGap = finiteRange(this.barGapRatio ?? BAR_GROUP_GAP, BAR_GROUP_GAP, 0, 1);
    const groupW = slot * (1 - groupGap);
    // Keep ordinary gaps while reserving at least half of a crowded group's allocation for bars.
    const barGap = groupCount > 1 ? Math.min(BAR_GAP * slot, groupW / (2 * (groupCount - 1))) : 0;
    const barW = (groupW - barGap * (groupCount - 1)) / groupCount;
    const markIndexes = this.markIndexMap();
    const activeMarkIndex = this.normalizedMarkIndex();
    // Hoisted out of the per-bar loop: the whole SVG re-renders on every reactive change
    // (including each roving-tabindex arrow-key move), so a formatter lookup per bar would
    // repeat for every mark on every one of those passes.
    const numberFormat = getNumberFormat(this.effectiveLocale);
    // minBarHeight is a non-negative pixel floor, or undefined when unset -- resolved once per
    // render pass (not per bar/segment) since every usage below needs the same normalized value.
    const minBarHeight = this.effectiveMinBarHeight();
    // Nonlinear stacks transform each category's total once before sharing the resulting height
    // among its segments. The square-root branch retains independent positive/negative totals.
    const stackedSqrt = this.stacked && this.scale === 'sqrt';
    const stackedLog = this.stacked && this.scale === 'logarithmic';
    const domainMax = hi > 0 ? hi : 1;
    // Mirrors domainMax's fallback, but for the negative side: the magnitude of the domain's own
    // negative floor, or 1 when there's no negative extent at all (unused in that case).
    const negDomainMax = lo < 0 ? -lo : 1;
    // Square-root and linear bars share the linear zero baseline. A logarithmic stack starts at
    // the plot bottom, where its nonpositive values and logarithmic floor are pinned.
    const zeroY = plotY + plotH - (stackedLog ? 0 : domainFraction(0, lo, hi)) * plotH;
    const clampSvgCoordinate = (value: number, fallback = zeroY) =>
      finiteRange(value, fallback, -MAX_SCROLL_CONTENT_WIDTH, MAX_SCROLL_CONTENT_WIDTH);
    const clampSvgLength = (value: number) =>
      finiteRange(value, 0, 0, MAX_SCROLL_CONTENT_WIDTH);
    // Available pixel room on each side of the zero line -- the positive stack's compressed height is
    // scaled against posAvailH (not the full plotH) so it stops at the zero line instead of bleeding
    // into the negative side's own region, and likewise for the negative stack against negAvailH.
    const posAvailH = zeroY - plotY;
    const negAvailH = plotY + plotH - zeroY;
    const posTotals = new Map<number, number>();
    const negTotals = new Map<number, number>();
    if (stackedSqrt || stackedLog) {
      for (const i of recordSample.rowIndexes) {
        let pos = 0;
        let neg = 0;
        for (const datasetIndex of recordSample.seriesIndexes) {
          const s = this.datasets[datasetIndex];
          if (!s) continue;
          const v = s.data[i];
          if (v == null || !Number.isFinite(v)) continue;
          if (this.skipZero && v === 0) continue;
          if (v >= 0) pos = finiteAdd(pos, v);
          else neg = finiteAdd(neg, v);
        }
        posTotals.set(i, pos);
        negTotals.set(i, neg);
      }
    }

    const bars: TemplateResult[] = [];
    for (const i of recordSample.rowIndexes) {
      // The pre-resolved origin preserves the normal slot fallback while ensuring a public
      // callback runs only once per category and never leaks non-finite coordinates.
      const origin = barOrigins.get(i) ?? plotX + i * slot;
      const slotStart = origin + (slot - groupW) / 2;
      let stackPos = 0; // running positive-side offset (value units) -- kept only for the stackedSqrt branch below
      let stackNeg = 0; // running negative-side offset (value units) -- kept only for the stackedSqrt branch below
      // Running PIXEL cursors for the plain (non-sqrt) stacked case: each segment's own edge derives
      // from wherever the previous (possibly minBarHeight-floored) segment actually ended on screen,
      // not from re-deriving position from cumulative value -- this is what makes a floored segment's
      // inflation "push" the next segment instead of being silently overdrawn by it.
      let posPixelTop = zeroY;
      let negPixelBottom = zeroY;
      // sqrt-compressed pixel height of this category's positive/negative stack total, computed once
      // per category (not per segment) -- see barValueToY()'s doc comment for why this differs from
      // the old, buggy per-segment-cumulative-position sqrt. Scaled against each side's own available
      // room (posAvailH/negAvailH), not the full plotH, so the compressed stack stops at the zero line.
      const posCompressedH = stackedSqrt
        ? Math.sqrt(Math.min(domainMax, posTotals.get(i) ?? 0) / domainMax) * posAvailH
        : 0;
      const negCompressedH = stackedSqrt
        ? Math.sqrt(Math.min(negDomainMax, -(negTotals.get(i) ?? 0)) / negDomainMax) * negAvailH
        : 0;
      const logTotal = posTotals.get(i) ?? 0;
      const logStackH = stackedLog ? this.valueFraction(logTotal, lo, hi) * plotH : 0;
      // Normalize by the finite total before summing shares: the raw positive sum may saturate at
      // Number.MAX_VALUE, but its displayed extent must still be partitioned exactly once.
      let logShareTotal = 0;
      if (stackedLog && logTotal > 0) {
        for (const datasetIndex of recordSample.seriesIndexes) {
          const value = this.datasets[datasetIndex]?.data[i];
          if (value != null && Number.isFinite(value) && value > 0) {
            logShareTotal += value / logTotal;
          }
        }
      }
      recordSample.seriesIndexes.forEach((di, sampledDatasetIndex) => {
        const s = this.datasets[di];
        if (!s) return;
        const v = s.data[i];
        if (v == null || !Number.isFinite(v)) return;
        if (this.skipZero && v === 0) return;
        const color = this.colorFor(di, s);
        const paint = this.markPaint(di, s);
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
            const total = posTotals.get(i) ?? 0;
            const shareLo = total > 0 ? stackPos / total : 0;
            const nextStackPos = finiteAdd(stackPos, v);
            const shareHi = total > 0 ? nextStackPos / total : 0;
            y1 = zeroY - shareHi * posCompressedH;
            y2 = zeroY - shareLo * posCompressedH;
            stackPos = nextStackPos;
          } else {
            // Unlike the positive-side `total > 0` guard above (reachable: an included v === 0
            // segment can leave `pos` at exactly 0), `total` here can never be 0 or negative --
            // this branch only runs for a strictly negative v, and that same v already
            // contributed to negTotals[i] in the pre-pass above, making it strictly negative too.
            const total = -(negTotals.get(i) ?? 0);
            const shareLo = -stackNeg / total;
            const nextStackNeg = finiteAdd(stackNeg, v);
            const shareHi = -nextStackNeg / total;
            y1 = zeroY + shareLo * negCompressedH;
            y2 = zeroY + shareHi * negCompressedH;
            stackNeg = nextStackNeg;
          }
        } else if (stackedLog) {
          rectX = slotStart;
          // Map the positive total once, then partition that extent by raw positive shares.
          // The pixel cursor preserves the opt-in floor's push/overflow behavior.
          const naturalH = v > 0 && logShareTotal > 0 ? (v / logTotal / logShareTotal) * logStackH : 0;
          const segH = clampSvgLength(
            minBarHeight != null && v !== 0 && naturalH < minBarHeight ? minBarHeight : naturalH,
          );
          if (v >= 0) {
            y2 = posPixelTop;
            y1 = clampSvgCoordinate(finiteAdd(posPixelTop, -segH), posPixelTop);
            posPixelTop = y1;
          } else {
            y1 = negPixelBottom;
            y2 = clampSvgCoordinate(finiteAdd(negPixelBottom, segH), negPixelBottom);
            negPixelBottom = y2;
          }
        } else if (this.stacked) {
          rectX = slotStart;
          if (v >= 0) {
            // A segment's own proportional height (linear scale) depends only on its own value,
            // not on where it sits in the stack -- compute it in isolation, floor it, then stack
            // from the running pixel cursor rather than from cumulative value.
            const naturalH = clampSvgLength(
              Math.max(0, zeroY - this.barValueToY(v, plotY, plotH, lo, hi)),
            );
            const segH = clampSvgLength(
              minBarHeight != null && v !== 0 && naturalH < minBarHeight ? minBarHeight : naturalH,
            );
            y2 = posPixelTop;
            y1 = clampSvgCoordinate(finiteAdd(posPixelTop, -segH), posPixelTop);
            posPixelTop = y1;
          } else {
            const naturalH = clampSvgLength(
              Math.max(0, this.barValueToY(v, plotY, plotH, lo, hi) - zeroY),
            );
            const segH = clampSvgLength(
              minBarHeight != null && v !== 0 && naturalH < minBarHeight ? minBarHeight : naturalH,
            );
            y1 = negPixelBottom;
            y2 = clampSvgCoordinate(finiteAdd(negPixelBottom, segH), negPixelBottom);
            negPixelBottom = y2;
          }
        } else {
          rectX = slotStart + sampledDatasetIndex * (barW + barGap);
          const zeroClamped = Math.min(hi, Math.max(lo, 0));
          const barValLo = Math.min(zeroClamped, v);
          const barValHi = Math.max(zeroClamped, v);
          y1 = this.barValueToY(barValHi, plotY, plotH, lo, hi);
          y2 = this.barValueToY(barValLo, plotY, plotH, lo, hi);
        }
        rectX = clampSvgCoordinate(rectX, plotX);
        y1 = clampSvgCoordinate(y1);
        y2 = clampSvgCoordinate(y2);
        const label = this.labels[i] ?? ''; // matches interactiveMarks(): a missing category label renders empty
        const custom = this.resolvePointText(label, v, di);
        const barText =
          custom ??
          this.localize('liteChartBarLabel', undefined, {
            series: s.label,
            label,
            value: numberFormat.format(v),
          });
        const titleText = barText;
        const w = clampSvgLength(Math.max(0, barW));
        let h = clampSvgLength(Math.max(0, y2 - y1));
        // A nonzero value's segment can round to sub-pixel and become
        // visually/indistinguishable from absent -- minBarHeight floors it,
        // pulling y1 upward by the same amount so the segment still
        // terminates at its correct baseline (a floored segment "pushes" any
        // segments stacked after it, the same tradeoff a hand-rolled
        // Math.max(2, scaleToLength(...)) floor accepts).
        // The plain-stacked branch above already applies minBarHeight per-segment against a running
        // pixel cursor (so a floored segment "pushes" the next one) -- applying the floor again here
        // would double-apply it. Only the non-stacked and stackedSqrt paths still need it here.
        if (!(this.stacked && !stackedSqrt) && minBarHeight != null && v !== 0 && h < minBarHeight) {
          const extra = minBarHeight - h;
          y1 = clampSvgCoordinate(finiteAdd(y1, -extra), y1);
          h = clampSvgLength(Math.max(0, y2 - y1));
        }
        const markIndex = markIndexes.get(`${di}:${i}`)!;
        const selected = selectedIndices.has(i);
        const intraGroupSpacing = barW + barGap;
        const crossCategorySpacing =
          slot - Math.max(0, groupCount - 1) * intraGroupSpacing;
        const horizontalSpacing = Math.max(
          0,
          groupCount > 1
            ? Math.min(intraGroupSpacing, crossCategorySpacing)
            : slot,
        );
        const hitWidth = clampSvgLength(Math.max(w, Math.min(24, horizontalSpacing)));
        // Stacked segments share one x lane, so a 24px vertical floor would overlap and make the
        // later-painted segment steal pointer input from its neighbor. The visual segment itself
        // remains the hit target in that constrained case.
        const hitHeight = this.stacked ? h : clampSvgLength(Math.max(24, h));
        const hitX = clampSvgCoordinate(rectX - (hitWidth - w) / 2, rectX);
        const hitY = clampSvgCoordinate(y1 - (hitHeight - h) / 2, y1);
        const hitTarget = svg`
          <rect
            data-mark-hit-target="bar"
            aria-hidden="true"
            x=${hitX}
            y=${hitY}
            width=${hitWidth}
            height=${hitHeight}
            style="fill: transparent; pointer-events: all"
            @click=${() => this.emitPoint(di, i)}
          ></rect>
        `;
        bars.push(
          this.roundedBars
            ? svg`
          <g class="mark-hit-group">
            ${hitTarget}
            <path
              part="bar"
              d=${this.roundedBarPath(rectX, y1, w, h)}
              fill=${paint}
              style=${styleMap({ color })}
              tabindex=${activeMarkIndex === markIndex ? '0' : '-1'}
              role="button"
              aria-label=${titleText}
              aria-pressed=${selected ? 'true' : 'false'}
              ?data-selected=${selected}
              data-mark-index=${markIndex}
              data-dataset-index=${di}
              data-index=${i}
              @click=${() => this.emitPoint(di, i)}
              @focus=${() => this.onMarkFocus(markIndex)}
              @keydown=${(e: KeyboardEvent) => this.onPointKeyDown(e, di, i, markIndex)}
            >${nativeSvgTitle(titleText)}</path>
          </g>
        `
            : svg`
          <g class="mark-hit-group">
            ${hitTarget}
            <rect
              part="bar"
              x=${rectX}
              y=${y1}
              width=${w}
              height=${h}
              fill=${paint}
              style=${styleMap({ color })}
              tabindex=${activeMarkIndex === markIndex ? '0' : '-1'}
              role="button"
              aria-label=${titleText}
              aria-pressed=${selected ? 'true' : 'false'}
              ?data-selected=${selected}
              data-mark-index=${markIndex}
              data-dataset-index=${di}
              data-index=${i}
              @click=${() => this.emitPoint(di, i)}
              @focus=${() => this.onMarkFocus(markIndex)}
              @keydown=${(e: KeyboardEvent) => this.onPointKeyDown(e, di, i, markIndex)}
            >${nativeSvgTitle(titleText)}</rect>
          </g>
        `,
        );
      });
    }
    return bars;
  }

  private renderLines(
    plotX: number,
    plotY: number,
    plotW: number,
    plotH: number,
    lo: number,
    hi: number,
    recordSample: { readonly rowIndexes: readonly number[]; readonly seriesIndexes: readonly number[] },
    selectedIndices: ReadonlySet<number>,
  ) {
    const n = this.recordCount();
    const xFor = (i: number) => plotX + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2);
    const yFor = (v: number) => plotY + plotH - this.valueFraction(v, lo, hi) * plotH;
    const markIndexes = this.markIndexMap();
    const activeMarkIndex = this.normalizedMarkIndex();
    // Hoisted out of the per-point loop for the same reason as renderBars(): the whole SVG
    // re-renders per reactive change, so this would otherwise repeat per point per pass.
    const numberFormat = getNumberFormat(this.effectiveLocale);
    const hitPoints: LineHitPoint[] = [];
    recordSample.seriesIndexes.forEach((datasetIndex) => {
      const series = this.datasets[datasetIndex];
      if (!series) return;
      recordSample.rowIndexes.forEach((index) => {
        const value = series.data[index];
        if (value == null || !Number.isFinite(value)) return;
        hitPoints.push({
          datasetIndex,
          index,
          x: xFor(index),
          y: yFor(value),
        });
      });
    });

    return recordSample.seriesIndexes.map((di) => {
      const s = this.datasets[di];
      if (!s) return nothing;
      const color = this.colorFor(di, s);
      let d = '';
      let penDown = false;
      let previousSourceIndex = -1;
      recordSample.rowIndexes.forEach((i) => {
        const v = s.data[i];
        if (v == null || !Number.isFinite(v)) {
          penDown = false;
          previousSourceIndex = i;
          return;
        }
        // The bounded sampler can omit the source index that carries a real null/non-finite gap.
        // Scan each skipped interval once so a pair of sampled finite neighbors never invents a
        // continuous segment across missing source data. Across the ordered sample this remains a
        // single linear pass over the source series, not one scan per sampled point.
        if (penDown && previousSourceIndex >= 0 && i > previousSourceIndex + 1) {
          for (let skipped = previousSourceIndex + 1; skipped < i; skipped++) {
            const candidate = s.data[skipped];
            if (candidate == null || !Number.isFinite(candidate)) {
              penDown = false;
              break;
            }
          }
        }
        const cmd = penDown ? 'L' : 'M';
        d += `${cmd}${xFor(i)},${yFor(v)} `;
        penDown = true;
        previousSourceIndex = i;
      });
      const dots = recordSample.rowIndexes.map((i) => {
        const v = s.data[i];
        if (v == null || !Number.isFinite(v)) return nothing;
        const label = this.labels[i] ?? ''; // matches interactiveMarks(): a missing category label renders empty
        const custom = this.resolvePointText(label, v, di);
        const barText =
          custom ??
          this.localize('liteChartBarLabel', undefined, {
            series: s.label,
            label,
            value: numberFormat.format(v),
          });
        const titleText = barText;
        const markIndex = markIndexes.get(`${di}:${i}`)!;
        const selected = selectedIndices.has(i);
        return svg`
          <g class="mark-hit-group">
            <circle
              data-mark-hit-target="point"
              aria-hidden="true"
              cx=${xFor(i)}
              cy=${yFor(v)}
              r=${n > 1 ? Math.min(12, plotW / (n - 1) / 2) : 12}
              style="fill: transparent; pointer-events: all"
              @click=${(event: MouseEvent) => this.emitNearestLinePoint(event, hitPoints, di, i)}
            ></circle>
            <circle
              part="point"
              cx=${xFor(i)}
              cy=${yFor(v)}
              r="4"
              fill=${color}
              style=${styleMap({ color })}
              tabindex=${activeMarkIndex === markIndex ? '0' : '-1'}
              role="button"
              aria-label=${titleText}
              aria-pressed=${selected ? 'true' : 'false'}
              ?data-selected=${selected}
              data-mark-index=${markIndex}
              data-dataset-index=${di}
              data-index=${i}
              @click=${(event: MouseEvent) => this.emitNearestLinePoint(event, hitPoints, di, i)}
              @focus=${() => this.onMarkFocus(markIndex)}
              @keydown=${(e: KeyboardEvent) => this.onPointKeyDown(e, di, i, markIndex)}
            >${nativeSvgTitle(titleText)}</circle>
          </g>
        `;
      });
      return svg`<path
        part="line"
        d=${d.trim()}
        stroke=${color}
        stroke-dasharray=${this.markDash(di)}
      ></path>${dots}`;
    });
  }

  override render(): TemplateResult {
    // Lit already tracks every reactive input, including function-valued
    // properties such as `tickFormat` and `barX`. Returning a cached
    // TemplateResult here would make callback replacement invisible and
    // serializing arbitrary data would throw for circular objects/BigInt.
    // Rendering this small SVG template is cheaper and more correct than a
    // lossy content fingerprint.
    return this.renderChart();
  }

  private resolvedValueAxisGutter(
    ticks: readonly FormattedValueAxisTick[],
    measuredWidth: number,
  ): number {
    if (typeof this.valueAxisGutter === 'number') {
      return finiteRange(
        this.valueAxisGutter,
        PAD_LEFT,
        0,
        MAX_SCROLL_CONTENT_WIDTH,
      );
    }
    if (this.valueAxisGutter !== 'auto' || ticks.length === 0) return PAD_LEFT;

    let widest = 0;
    for (const tick of ticks) {
      widest = Math.max(widest, tick.label.length * APPROX_LABEL_CHARACTER_WIDTH);
    }
    const requested = Math.ceil(widest) + VALUE_AXIS_TICK_OFFSET + AUTO_VALUE_AXIS_SAFETY_INSET;
    const maximum = this.layout === 'scroll'
      ? MAX_AUTO_VALUE_AXIS_GUTTER
      : Math.max(
          PAD_LEFT,
          Math.min(
            MAX_AUTO_VALUE_AXIS_GUTTER,
            measuredWidth * MAX_AUTO_VALUE_AXIS_GUTTER_FRACTION,
          ),
        );
    return finiteRange(requested, PAD_LEFT, PAD_LEFT, maximum);
  }

  private automaticMaxLabels(
    n: number,
    plotW: number,
    renderedIndexes: readonly number[],
  ): number {
    if (n <= 1) return n;
    let widest = 0;
    for (const index of renderedIndexes) {
      const label = this.labels[index] ?? '';
      widest = Math.max(widest, label.length * APPROX_LABEL_CHARACTER_WIDTH);
    }
    if (widest === 0) return n;
    const lane = widest + AUTO_CATEGORY_LABEL_INSET;
    const fits = Math.floor(finiteRange(plotW, 0, 0, MAX_SCROLL_CONTENT_WIDTH) / lane);
    return Math.min(n, Math.max(2, fits));
  }

  /** Indexes retained by `maxLabels`, selected from the generated mark sample so an independently
   * sampled domain cannot erase requested labels at a later set intersection. The generated mark
   * sample caps the useful result at 1,000, so this selector must do the same rather than allocate
   * an arbitrary consumer-supplied `maxLabels` count. In auto mode the resolved plot width and
   * rendered source indexes supply a deterministic cap. `undefined` means every *sampled* label
   * renders, preserving the default and non-finite-value behavior. */
  private visibleLabelIndexes(
    n: number,
    plotW: number,
    renderedIndexes: readonly number[],
  ): Set<number> | undefined {
    if (this.maxLabels == null) return undefined;
    const requested = this.maxLabels === 'auto'
      ? this.automaticMaxLabels(n, plotW, renderedIndexes)
      : this.maxLabels;
    if (typeof requested !== 'number') return undefined;
    // finiteCount() falls back to `n` itself for a non-finite maxLabels (NaN/Infinity, e.g. an
    // unparsable attribute) -- making the `n <= max` check below always true, i.e. reproducing "no
    // cap", the same behavior as maxLabels being unset entirely. An explicit *negative* (but
    // finite) value instead clamps to `0` (finiteCount's own floor, same convention as
    // `normalizeBucketCount()`'s handling of a negative bucket count elsewhere in this codebase),
    // while the documented first/last guarantee still keeps both endpoints.
    const max = finiteCount(requested, n);
    if (n <= max) return undefined;
    const renderedCount = renderedIndexes.length;
    const count = Math.min(
      renderedCount,
      MAX_RENDERED_CHART_RECORDS,
      Math.max(2, max),
    );
    if (count <= 1) return new Set(count === 1 ? [renderedIndexes[0]!] : []);
    return new Set(
      Array.from({ length: count }, (_, index) =>
        renderedIndexes[Math.round((index * (renderedCount - 1)) / (count - 1))]!,
      ),
    );
  }

  private displayCategoryLabel(label: string, availableWidth: number): string {
    const maxCharacters = Math.max(
      1,
      Math.floor(availableWidth / APPROX_LABEL_CHARACTER_WIDTH),
    );
    if (label.length <= maxCharacters) return label;
    if (maxCharacters === 1) return '…';
    return `${label.slice(0, maxCharacters - 1)}…`;
  }

  private renderChart(): TemplateResult {
    const n = this.recordCount();
    const awaitingFitMeasurement = this.awaitingFitMeasurement();
    const h = finiteRange(this.plotHeight || 200, 200, 0, MAX_SCROLL_CONTENT_WIDTH);
    const measuredWidth = finiteRange(
      this.plotWidth || 400,
      400,
      0,
      MAX_SCROLL_CONTENT_WIDTH,
    );
    const { lo, hi, ticks } = this.domain();
    // Resolve each formatter exactly once per rendered tick and share that output with automatic
    // gutter sizing and the SVG text. A stateful formatter therefore cannot size one string and
    // then paint a different one in the same render pass.
    const formattedTicks = awaitingFitMeasurement || this.withoutValueAxis
      ? []
      : ticks.map((value) => ({ value, label: this.formatValueAxisTick(value) }));
    // An explicit numeric value remains authoritative. Unset and non-finite numeric values retain
    // the established 36px fallback; the opt-in automatic branch is bounded separately.
    const padLeft = this.resolvedValueAxisGutter(formattedTicks, measuredWidth);
    const axisGutter = padLeft + (this.yLabel ? AXIS_TITLE_SPACE : 0);
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
      // barWidth is a non-negative fixed per-bar pixel width -- a non-finite value (NaN/Infinity)
      // falls back to the 32px default; an explicit negative value clamps to 0. Either way the
      // slot width never goes negative or NaN.
      const maxSlot = n > 0 ? MAX_SCROLL_CONTENT_WIDTH / n : MAX_SCROLL_CONTENT_WIDTH;
      slot = finiteRange(this.barWidth, 32, 0, maxSlot);
      plotW = n * slot;
      w = axisGutter + plotW + PAD_RIGHT;
    } else {
      // 'fit' (default): squeeze to the measured host width, byte-for-byte
      // the same computation as before `layout` existed.
      w = measuredWidth;
      plotW = Math.max(0, w - axisGutter - PAD_RIGHT);
      slot = n > 0 ? plotW / n : 0;
    }
    const recordSample = this.recordSample();
    const selectedIndices = new Set<number>();
    // Only sampled source rows can render a selected mark. Bound work by the same visual ceiling
    // instead of running `includes()` against an unbounded controlled array for every mark.
    const renderedRows = new Set(recordSample.rowIndexes);
    for (let index = 0; index < this.selectedIndices.length; index++) {
      const candidate = this.selectedIndices[index];
      if (
        typeof candidate === 'number' &&
        Number.isInteger(candidate) &&
        renderedRows.has(candidate)
      ) selectedIndices.add(candidate);
    }
    // Resolve a public `barX` callback once in source-index order, after the slot width is known.
    // The same finite origin drives bars and category labels, preventing stateful callbacks from
    // drifting those surfaces apart and keeping hostile values out of SVG geometry.
    const barOrigins = this.effectiveType === 'bar' && !awaitingFitMeasurement
      ? new Map(recordSample.rowIndexes.map((index) => {
          const fallback = plotX + index * slot;
          const candidate = typeof this.barX === 'function' ? this.barX(index) : fallback;
          return [
            index,
            finiteRange(candidate, fallback, -MAX_SCROLL_CONTENT_WIDTH, MAX_SCROLL_CONTENT_WIDTH),
          ] as const;
        }))
      : new Map<number, number>();

    const grid = awaitingFitMeasurement || this.withoutValueAxis
      ? []
      : this.renderGrid(plotX, plotY, plotW, plotH, formattedTicks, lo, hi);
    const marks =
      awaitingFitMeasurement
        ? []
        : this.effectiveType === 'bar'
        ? this.renderBars(plotX, plotY, plotH, slot, lo, hi, barOrigins, recordSample, selectedIndices)
        : this.renderLines(plotX, plotY, plotW, plotH, lo, hi, recordSample, selectedIndices);

    const visibleLabelIndexes = this.visibleLabelIndexes(
      n,
      plotW,
      recordSample.rowIndexes,
    );
    // A `max-labels` decimation keeps roughly n / visibleLabelIndexes.size slots of horizontal
    // space per surviving label, not the one slot every one of the n samples would get if none
    // were dropped -- size the clip to what a survivor actually owns. Labels are
    // text-anchor="middle", so a survivor has half that stride clear on each side; nothing can
    // collide. Stays 1 (byte-identical to the pre-decimation clip) when max-labels is unset.
    const decimationStride = visibleLabelIndexes ? n / visibleLabelIndexes.size : 1;
    const categoryLabelWidth = Math.max(
      0,
      decimationStride *
        (this.effectiveType === 'bar'
          ? slot
          : n > 1
            ? plotW / (n - 1)
            : plotW) - BAR_CORNER_RADIUS,
    );
    const categoryLabels = awaitingFitMeasurement ? [] : recordSample.rowIndexes.map((i) => {
      const label = this.labels[i] ?? '';
      if (visibleLabelIndexes && !visibleLabelIndexes.has(i)) return nothing;
      const fullLabel = label ?? '';
      const x =
        this.effectiveType === 'bar' && n > 0
          ? (barOrigins.get(i) ?? plotX + i * slot) + slot / 2
          : plotX + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2);
      const displayLabel = this.displayCategoryLabel(fullLabel, categoryLabelWidth);
      return svg`<text
        part="axis-label"
        x=${x}
        y=${plotY + plotH + CATEGORY_LABEL_OFFSET}
        text-anchor="middle"
        aria-label=${displayLabel === fullLabel ? nothing : fullLabel}
      >${displayLabel}</text>`;
    });

    const datasetLabels = recordSample.seriesIndexes.map(
      (datasetIndex) => this.datasets[datasetIndex]!.label,
    );
    const chartLabel =
      hostAriaLabel(this) ??
      (this.label ||
        this.accessibleLabel ||
        (datasetLabels.length
          ? getListFormat(this.effectiveLocale, { type: 'conjunction' }).format(datasetLabels)
          : '') ||
        this.localize('chart'));
    const marksForA11y = this.interactiveMarks();
    const tableNumberFormat = getNumberFormat(this.effectiveLocale);
    const showTableTotals = this.effectiveType === 'bar' && this.stacked && this.tableTotals;
    const dataTruncation = this.dataTruncationMessage();
    const hasCustomDataTable = this.hasCustomDataTable();

    return html`
      <div
        part="base"
        data-legend-position=${this.legend
          ? chartChromeLegendPlacement(this.legendPosition)
          : nothing}
      >
        <svg
          viewBox="0 0 ${w} ${h}"
          style=${this.layout === 'scroll' ? `inline-size: ${w}px` : nothing}
          role="group"
          aria-label=${chartLabel}
          aria-describedby=${this.description ? this.descriptionId : nothing}
          tabindex=${!awaitingFitMeasurement && marksForA11y.length ? '-1' : '0'}
        >
          ${this.renderForcedColorPatterns()}
          ${grid}
          ${categoryLabels}
          ${marks}
          ${!awaitingFitMeasurement && this.yLabel
            ? svg`<text
                part="axis-title"
                aria-label=${this.yLabel}
                data-title-extent=${plotH}
                x=${rtl ? w - 12 : 12}
                y=${plotY + plotH / 2}
                text-anchor="middle"
                transform="rotate(${rtl ? 90 : -90}, ${rtl ? w - 12 : 12}, ${plotY + plotH / 2})"
              >${this.yLabel}</text>`
            : nothing}
          ${!awaitingFitMeasurement && this.xLabel
            ? svg`<text part="axis-title" aria-label=${this.xLabel} data-title-extent=${plotW} x=${plotX + plotW / 2} y=${plotY + plotH + padBottom - 2} text-anchor="middle">${this.xLabel}</text>`
            : nothing}
        </svg>
        <lr-live-region part="live-region"></lr-live-region>
        ${this.description
          ? html`<p part="description" id=${this.descriptionId} class="sr-only">${this.description}</p>`
          : nothing}
        ${dataTruncation ? html`<p part="data-truncation">${dataTruncation}</p>` : nothing}
        ${this.dataTableToggle
          ? html`<button
              part="data-table-toggle"
              type="button"
              aria-expanded=${this.dataTableVisible ? 'true' : 'false'}
              aria-controls=${this.dataTableId}
              @click=${() => this.toggleDataTable()}
            >
              ${this.localize('chartData')}
            </button>`
          : nothing}
        <div
          id=${this.dataTableId}
          part="data-table"
          ?data-visually-hidden=${!this.dataTableVisible}
        >
          <slot name="data-table" @slotchange=${() => this.requestUpdate()}></slot>
          ${hasCustomDataTable ? nothing : this.datasets.length > 1
          ? html`<table part="table" class=${this.dataTableVisible ? nothing : 'sr-only'}>
              <caption>${this.localize('chartData')}</caption>
              <thead>
                <tr>
                  <th scope="col">${this.localize('chartCategory')}</th>
                  ${recordSample.seriesIndexes.map((datasetIndex) => {
                    const series = this.datasets[datasetIndex]!;
                    return html`<th scope="col">${series.label}</th>`;
                  })}
                  ${showTableTotals ? html`<th scope="col">${this.localize('chartTotal')}</th>` : nothing}
                </tr>
              </thead>
              <tbody>
                ${recordSample.rowIndexes.map(
                  (index) => {
                    const label = this.labels[index] ?? '';
                    return html`<tr>
                    <th scope="row">${label}</th>
                    ${recordSample.seriesIndexes.map((datasetIndex) => {
                      const series = this.datasets[datasetIndex]!;
                      const value = series.data[index];
                      return html`<td>${value == null || !Number.isFinite(value)
                        ? ''
                        : this.formatTableCell(
                            value,
                            {
                              kind: 'value',
                              datasetIndex,
                              index,
                              label,
                              seriesLabel: series.label,
                            },
                            tableNumberFormat,
                          )}</td>`;
                    })}
                    ${showTableTotals
                      ? (() => {
                          const total = this.tableTotalAt(index, recordSample.seriesIndexes);
                          return html`<td>${total == null
                            ? ''
                            : this.formatTableCell(
                                total,
                                {
                                  kind: 'total',
                                  datasetIndex: null,
                                  index,
                                  label,
                                  seriesLabel: null,
                                },
                                tableNumberFormat,
                              )}</td>`;
                        })()
                      : nothing}
                  </tr>`;
                  },
                )}
              </tbody>
            </table>`
          : html`<ul
              part="data-list"
              class=${this.dataTableVisible ? nothing : 'sr-only'}
              aria-label=${this.localize('chartData')}
            >
              ${marksForA11y.map((_mark, index) => html`<li>${this.markAnnouncement(index, marksForA11y)}</li>`)}
            </ul>`}
        </div>
        ${this.legend
          ? html`<div part="legend">
              ${recordSample.seriesIndexes.map(
                (i) => {
                  const s = this.datasets[i]!;
                  return html`
                  <span part="legend-item">
                    <span
                      part="legend-swatch"
                      data-encoding=${this.legendEncoding(i)}
                      style=${styleMap({ backgroundColor: this.colorFor(i, s) })}
                    ></span>
                    ${s.label}${this.formatter || this.legendText
                      ? html`<span part="legend-text">${this.formatter?.({
                          value: recordSample.rowIndexes.reduce(
                            (sum, index) => {
                              const value = s.data[index];
                              return typeof value === 'number' && Number.isFinite(value)
                                ? finiteAdd(sum, value)
                                : sum;
                            },
                            0,
                          ),
                          surface: 'legend',
                          datasetIndex: i,
                          seriesLabel: s.label,
                        }) ?? this.legendText?.(s.label, i)}</span>`
                      : nothing}
                  </span>
                `;
                },
              )}
            </div>`
          : nothing}
      </div>
    `;
  }
}

function formatTick(v: number, locale: string): string {
  // Avoid float noise (e.g. 0.30000000000000004) from the niceStep() math
  // above without hardcoding a fixed decimal count that'd butcher large ints.
  return getNumberFormat(locale, { maximumFractionDigits: 6 }).format(Number(v.toFixed(6)));
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-lite-chart': LyraLiteChart;
  }
}
