import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { specialistTokens } from '../../../internal/specialist-tokens.styles.js';
import { nextId, srOnly } from '../../../internal/a11y.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { ThemeWatcher } from '../../../internal/theme-watcher.js';
import type { LyraMessageKey } from '../../../internal/localization.js';
import { loadChartJs, type ChartJsModule } from './chart-core-loader.js';
import {
  loadChartJsWithZoom,
  loadChartJsWithZoomResult,
  loadChartJsWithDataLabelsResult,
  type ChartFeatureLoadResult,
  type DataLabelsPlugin,
  type ZoomPlugin,
} from './chart-feature-loader.js';
import { styles } from './chart.styles.js';
import '../../overlays/skeleton/skeleton.class.js';
import { getListFormat, getNumberFormat } from '../../../internal/intl-cache.js';
import { escapeCsvField } from '../../utility/export-button/csv.js';
import { trueDefaultBooleanFromAttributeConverter as trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { finiteAdd, finiteNumber } from '../../../internal/numbers.js';
import { sanitizeCssLength } from '../../../internal/safe-css.js';
import {
  acquireAnnouncementSink,
  type AnnouncementSink,
} from '../../../internal/announcer.js';
import { resolveCanvasColor, seriesPalette, translucentAreaColor } from './chart-colors.js';
import {
  legendVisibilityDetail,
  normalizeHiddenDatasets,
  type LyraChartLegendVisibilityChangeDetail,
} from './chart-legend-visibility.js';
export type { LyraChartLegendVisibilityChangeDetail } from './chart-legend-visibility.js';
import { sampleChartTableIndexes } from './chart-table-sampling.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_chart, LYRA_DEFAULT_chartAxisTotal, LYRA_DEFAULT_chartCategory, LYRA_DEFAULT_chartData, LYRA_DEFAULT_chartDataLabelsUnavailable, LYRA_DEFAULT_chartDataSampled, LYRA_DEFAULT_chartMissingLibrary, LYRA_DEFAULT_chartPointLabel, LYRA_DEFAULT_chartPrimaryAxis, LYRA_DEFAULT_chartSecondaryAxis, LYRA_DEFAULT_chartSeriesLabel, LYRA_DEFAULT_chartSeriesNoData, LYRA_DEFAULT_chartStackTotalsUnavailable, LYRA_DEFAULT_chartSummary, LYRA_DEFAULT_chartSummaryEmpty, LYRA_DEFAULT_chartSummarySeparator, LYRA_DEFAULT_chartSummaryWithData, LYRA_DEFAULT_chartTotal, LYRA_DEFAULT_chartTrendDecreasing, LYRA_DEFAULT_chartTrendFlat, LYRA_DEFAULT_chartTrendIncreasing, LYRA_DEFAULT_chartTypeBar, LYRA_DEFAULT_chartTypeBubble, LYRA_DEFAULT_chartTypeDoughnut, LYRA_DEFAULT_chartTypeLine, LYRA_DEFAULT_chartTypePie, LYRA_DEFAULT_chartTypePolarArea, LYRA_DEFAULT_chartTypeRadar, LYRA_DEFAULT_chartTypeScatter, LYRA_DEFAULT_chartValueLabel, LYRA_DEFAULT_chartZoomUnavailable, LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_liteChartMarkSummary, LYRA_DEFAULT_loading, LYRA_DEFAULT_noData, LYRA_DEFAULT_open, LYRA_DEFAULT_resetZoom } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export { seriesPalette } from './chart-colors.js';

export interface ChartPoint {
  x: number;
  y: number;
  /** Bubble radius. Ignored by chart types that do not consume a radius. */
  r?: number;
  /** Per-point label used by events, export, keyboard announcements, and the data table. */
  label?: string;
}

export interface Series {
  label: string;
  data?: (number | null)[];
  points?: ChartPoint[];
  color?: string | string[];
  fill?: boolean;
  width?: number;
  dash?: boolean;
  noTooltip?: boolean;
  axis?: 'y' | 'y2';
  pointColors?: string[];
  /**
   * Per-point radius. A single number applies to every point; an array (matching `data`'s
   * length) sets each point independently — passed straight through to Chart.js, which
   * supports both natively.
   */
  pointRadius?: number | number[];
  /**
   * Per-segment (the line between two consecutive points) border color, indexed by the
   * *starting* point of each segment — e.g. `['red', 'green']` on 3 points colors the first
   * segment red and the second green. Wired to Chart.js's `segment.borderColor`, and cycled
   * when shorter than the segment count. Only meaningful for line-type series.
   */
  segmentColors?: string[];
  type?: 'line' | 'bar';
}

export type LyraChartType =
  | 'line'
  | 'bar'
  | 'scatter'
  | 'pie'
  | 'doughnut'
  | 'radar'
  | 'polarArea'
  | 'bubble';

export type LyraChartGrid = 'x' | 'y' | 'both' | 'none';
export type LyraChartIndexAxis = 'x' | 'y';
export type LyraChartLayoutPosition =
  | 'left'
  | 'top'
  | 'right'
  | 'bottom'
  | 'center'
  | 'chartArea'
  | { [scaleId: string]: number };
export type LyraChartLegendPosition = LyraChartLayoutPosition | 'start' | 'end' | 'auto';
export type LyraChartValueFormatterContext = 'tick' | 'tooltip' | 'legend' | 'table';
export type LyraChartValueFormatter = (
  value: number,
  context: LyraChartValueFormatterContext,
) => string;

export type LyraChartExportFormat = 'csv' | 'png';

export interface LyraChartArea {
  readonly top: number;
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

/** A Chart.js-compatible plugin shape without making `chart.js` a type dependency for consumers. */
export interface LyraChartPlugin {
  readonly id: string;
}

/** Dataset configuration accepted by the raw `config` passthrough. */
export interface LyraChartDatasetConfiguration {
  type?: string;
  label?: unknown;
  data?: unknown[];
  hidden?: boolean;
  axis?: string;
  yAxisID?: string;
  noTooltip?: boolean;
  fill?: unknown;
  backgroundColor?: unknown;
  borderColor?: unknown;
  borderRadius?: unknown;
  borderWidth?: unknown;
  borderDash?: unknown;
  color?: unknown;
  pointStyle?: unknown;
  pointBackgroundColor?: unknown;
  pointRadius?: unknown;
  segment?: unknown;
}

/** Data block accepted by the raw `config` passthrough. */
export interface LyraChartDataConfiguration {
  labels?: unknown[];
  datasets?: LyraChartDatasetConfiguration[];
}

/**
 * Peer-neutral structural configuration accepted by `LyraChart.config`.
 * Install `chart.js` and use its own `ChartConfiguration` type when stricter
 * controller-specific checking is useful; that type remains structurally
 * assignable to this passthrough surface.
 */
export interface LyraChartConfiguration {
  type?: string;
  data?: LyraChartDataConfiguration;
  options?: object;
  plugins?: LyraChartPlugin[];
}

interface ChartHit {
  datasetIndex: number;
  index: number;
}

interface ChartLegendItem {
  datasetIndex?: number;
  index?: number;
  text?: string;
}

interface ChartTooltipContext {
  datasetIndex: number;
  parsed?: unknown;
  raw?: unknown;
  dataset?: LyraChartDatasetConfiguration;
}

interface DataLabelsContext {
  datasetIndex: number;
  dataIndex: number;
}

interface RuntimeChart {
  data: {
    labels?: unknown[];
    datasets: LyraChartDatasetConfiguration[];
  };
  options: Record<string, unknown>;
  config: { type?: unknown };
  legend?: unknown;
  chartArea?: LyraChartArea;
  destroy(): void;
  update(mode?: string): void;
  toBase64Image?(): string;
  getElementsAtEventForMode(
    event: Event,
    mode: string,
    options: Record<string, unknown>,
    useFinalPosition: boolean,
  ): ChartHit[];
  getDatasetMeta?(index: number): { hidden: boolean | null };
  isDatasetVisible(index: number): boolean;
  setDatasetVisibility(index: number, visible: boolean): void;
}

interface RuntimeChartConfiguration extends LyraChartConfiguration {
  type: string;
  data: {
    labels: unknown[];
    datasets: LyraChartDatasetConfiguration[];
  };
  options: Record<string, unknown>;
}

const CHART_TYPES = new Set<LyraChartType>([
  'line',
  'bar',
  'scatter',
  'pie',
  'doughnut',
  'radar',
  'polarArea',
  'bubble',
]);

const CHART_TYPE_MESSAGE_KEYS: Record<LyraChartType, LyraMessageKey> = {
  line: 'chartTypeLine',
  bar: 'chartTypeBar',
  scatter: 'chartTypeScatter',
  pie: 'chartTypePie',
  doughnut: 'chartTypeDoughnut',
  radar: 'chartTypeRadar',
  polarArea: 'chartTypePolarArea',
  bubble: 'chartTypeBubble',
};

function normalizeChartType(value: unknown): LyraChartType {
  return typeof value === 'string' && CHART_TYPES.has(value as LyraChartType)
    ? (value as LyraChartType)
    : 'bar';
}

/**
 * The type `effectiveType()` actually returns: `LyraChartType`'s closed set, widened with
 * `(string & {})` rather than plain `string` so every known member still autocompletes/narrows in
 * an `===` comparison. The widening itself is required, not cosmetic — `effectiveType()` prefers
 * `config.type` (the raw Chart.js passthrough documented on `LyraChart.config` above) over the
 * `type` attribute's own `normalizeChartType()`-guaranteed value, and a consumer can set
 * `config.type` to any Chart.js-recognized string, including a custom registered controller name
 * beyond this library's own union (see `localizedChartType()`'s doc below, which already
 * documents this same passthrough). A hard `LyraChartType` here would be a false guarantee.
 */
type EffectiveChartType = LyraChartType | (string & {});
type ChartFeatureState = 'idle' | 'loading' | 'available' | 'unavailable';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Keys that would let a JSON-sourced `config` (e.g. parsed from an API
// response) reach up through the merge and mutate `Object.prototype` —
// skipped unconditionally regardless of `base`'s own shape.
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// Defensive JS-side fallbacks for themeColors() below, mirroring the
// light-mode default of each `--lr-chart-*` token's own fallback chain
// (see chart.styles.ts) — only reached if getComputedStyle somehow can't
// resolve the custom property at all (e.g. host detached from the document).
const FALLBACK_GRID_COLOR = '#8a8a90';
const FALLBACK_TICK_COLOR = '#6b7280';
const FALLBACK_LEGEND_COLOR = '#1a1a1a';
const FALLBACK_TOOLTIP_BG = '#fff';
const FALLBACK_TOOLTIP_TEXT = '#1a1a1a';

interface ThemeColors {
  grid: string;
  tick: string;
  legend: string;
  tooltipBg: string;
  tooltipText: string;
}

interface ChartStyleOptions {
  borderColors: string[];
  fillColors: string[];
  authoredFillColors: boolean[];
  borderRadius: number;
  borderWidth: number;
  gridBorderWidth: number;
  lineBorderWidth: number;
  pointRadius: number;
  forcedColors: boolean;
}

type BrowserWindow = Window & typeof globalThis;

const FORCED_COLOR_ENCODINGS = [
  { name: 'solid', dash: [] as number[], pointStyle: 'circle' },
  { name: 'horizontal', dash: [2, 2], pointStyle: 'rect' },
  { name: 'vertical', dash: [8, 3], pointStyle: 'triangle' },
  { name: 'diagonal', dash: [8, 3, 2, 3], pointStyle: 'rectRot' },
  { name: 'reverse-diagonal', dash: [1, 3], pointStyle: 'cross' },
  { name: 'crosshatch', dash: [10, 2], pointStyle: 'crossRot' },
  { name: 'dots', dash: [6, 2, 1, 2], pointStyle: 'star' },
  { name: 'checker', dash: [12, 3, 3, 3], pointStyle: 'line' },
] as const;

type ForcedColorEncodingName = (typeof FORCED_COLOR_ENCODINGS)[number]['name'];

function forcedColorsActive(view?: Window | null): boolean {
  try {
    return !!view?.matchMedia?.('(forced-colors: active)').matches;
  } catch {
    return false;
  }
}

/**
 * Recursively merges `override` onto `base`, matching JSON-merge semantics:
 * plain objects are merged key-by-key at every depth; arrays, functions, and
 * any other value type are replaced wholesale by `override`'s value. Used to
 * deep-merge the raw `config` passthrough over the `Series`-generated config
 * in `buildConfig()` so a nested key (e.g. `config.options.scales.y`) only
 * overrides the keys it sets, rather than clobbering the whole generated
 * sibling object (e.g. the rest of the generated `y` axis config).
 */
// `seen` guards against a circular `override` (e.g. `override.self = override`) recursing forever --
// it must only cover the *active* recursion stack, not every override object ever merged. Entries
// are removed once a call's own subtree finishes (see the `finally` below), so the guard only fires
// while `override` is genuinely an ancestor of itself in the current call. Without that removal, the
// same override object legitimately reused at two unrelated, already-finished config positions (e.g.
// a shared axis-options object applied to both the x and y scale) would incorrectly reuse the first
// position's merged result for the second, even though each was merged against a different base.
function deepMerge<T>(base: T, override: unknown, seen = new WeakMap<object, unknown>()): T {
  if (typeof override === 'object' && override !== null) {
    const previous = seen.get(override);
    if (previous !== undefined) return previous as T;
  }
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return (override === undefined ? base : (override as T)) as T;
  }
  const result: Record<string, unknown> = { ...base };
  seen.set(override, result);
  try {
    for (const key of Object.keys(override)) {
      if (UNSAFE_KEYS.has(key)) continue;
      result[key] = deepMerge((base as Record<string, unknown>)[key], override[key], seen);
    }
  } finally {
    seen.delete(override);
  }
  return result as T;
}

export interface LyraChartEventMap {
  'lr-point-click': CustomEvent<{
    datasetIndex: number;
    index: number;
    label: string | undefined;
    value: unknown;
  }>;
  'lr-zoom': CustomEvent<{ zoomed: boolean }>;
  'lr-before-legend-visibility-change': CustomEvent<LyraChartLegendVisibilityChangeDetail>;
  'lr-legend-visibility-change': CustomEvent<LyraChartLegendVisibilityChangeDetail>;
}

interface ChartDatum {
  datasetIndex: number;
  index: number;
  label: string | undefined;
  value: unknown;
}

interface EffectiveChartData {
  labels: unknown[];
  datasets: LyraChartDatasetConfiguration[];
}

function isChartPoint(value: unknown): value is ChartPoint {
  if (!isPlainObject(value)) return false;
  return Number.isFinite(value['x']) && Number.isFinite(value['y']);
}

function labelText(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(labelText).join(' ');
  return String(value);
}
/**
 * `<lr-chart>` — the core Chart.js wrapper every other `lr-*-chart` tag
 * subclasses. Requires the optional peer dep `chart.js`; `chartjs-plugin-zoom`
 * (for `zoom`) and `chartjs-plugin-datalabels` (for `data-labels`/`stack-totals`)
 * are further optional peers loaded only on demand.
 *
 * **API mirror note:** the real `wa-chart` docs page
 * (https://webawesome.com/docs/components/chart/) documents a `config:
 * ChartJS['config']` property alongside its simplified attributes — "a
 * flexible wrapper around Chart.js" supporting *both* simplified attributes
 * and full Chart.js configuration passthrough, not a `data`/`options` prop
 * pair. `lr-chart` mirrors that dual surface: the `Series`-based
 * `datasets`/`labels`/`type`/`legend`/`xLabel`/`yLabel`/`zoom` attributes
 * below are the simplified surface (compatible with WA's `type`, `xLabel`,
 * `yLabel`, `withoutLegend`-equivalent `legend`, etc.), and the additional
 * `config` property is the raw-passthrough escape hatch — a
 * `LyraChartConfiguration` deep-merged over the generated config in
 * `buildConfig()`, mirroring WA's `config` property without discarding the
 * `Series` shape the rest of this component family (subclasses, box-plot,
 * histogram) is built on.
 *
 * @customElement lr-chart
 * @event lr-zoom - `detail: { zoomed }`.
 * @event lr-point-click - Fired when pointer input lands on a data point/segment, when a generated
 *   data-table value is activated, or when Enter/Space activates the keyboard-current canvas datum.
 *   `detail: { datasetIndex: number, index: number, label: string |
 *   undefined, value: unknown }`. For scatter/bubble data, `label` prefers the per-point label and
 *   `value` is the complete typed `ChartPoint` (`x`, `y`, optional `r`, optional `label`).
 * @event lr-before-legend-visibility-change - Cancelable proposal emitted before a DOM legend
 *   toggle changes state. `detail` contains the target `datasetIndex`, its proposed `visible`
 *   value, and the complete canonical proposed `hiddenDatasets` snapshot.
 * @event lr-legend-visibility-change - Emitted after an accepted DOM legend toggle commits the
 *   same detail. Programmatic `hiddenDatasets` changes reconcile without either event.
 * @csspart base - The chart wrapper.
 * @csspart plot - The fixed-height canvas/overlay region.
 * @csspart canvas - The Chart.js canvas.
 * @csspart legend - The wrapping DOM legend rendered when `legend` is set.
 * @csspart legend-item - A keyboard-operable series visibility toggle.
 * @csspart legend-item-hidden - Added to a `legend-item` while its dataset is hidden.
 * @csspart legend-swatch - The resolved series-color swatch in a legend item.
 * @csspart reset-zoom-button - The reset-zoom control when zoom is active.
 * @csspart description - The accessible chart summary.
 * @csspart data-table - The optional generated or slotted data table.
 * @csspart center - The chart-area-centered overlay wrapper for the `center` slot.
 * @csspart error - Static visible error shown instead of `canvas` when the optional `chart.js`
 *   peer dependency is not installed; its transition is announced through a shared light-DOM alert.
 * @csspart notices - Wrapper for nonfatal feature warnings and generated-data truncation notices.
 * @csspart data-truncation - Explanation shown when the generated accessible alternative samples
 *   a data set larger than its 1,000-record ceiling.
 * @csspart feature-warning - Static nonfatal warning when a requested optional feature peer is
 *   unavailable while the core chart remains usable.
 * @cssprop [--lr-chart-height=var(--lr-size-280px)] - The plot region's `block-size` and the
 *   host's minimum block size. A visible data table or wrapping DOM legend grows the host in
 *   normal flow instead of overlapping following content. `height` supplies a private fallback;
 *   this public token always wins when a consumer sets it.
 * @cssprop [--lr-chart-grid-color=var(--lr-color-border)] - Grid-line color. Resolved via
 *   `getComputedStyle` on every draw (Chart.js paints to canvas and cannot consume `var()`).
 * @cssprop [--lr-chart-tick-color=var(--lr-color-text-quiet)] - Axis tick-label color; also used
 *   for the `xLabel`/`yLabel`/`y2Label` axis-title text (there is no separate title-color token).
 *   Resolved via `getComputedStyle` on every draw.
 * @cssprop [--lr-chart-legend-color=var(--lr-color-text)] - Legend label color. Resolved via
 *   `getComputedStyle` on every draw.
 * @cssprop [--lr-chart-legend-item-hover-bg=var(--lr-color-brand-quiet)] - Hover background of a
 *   legend visibility button.
 * @cssprop --lr-chart-legend-item-active-bg - Pressed background of a legend visibility button;
 *   defaults to the standard active mix of `--lr-color-brand-quiet`.
 * @cssprop [--lr-chart-data-table-button-hover-bg=var(--lr-color-brand-quiet)] - Hover background
 *   of an actionable generated-table value.
 * @cssprop --lr-chart-data-table-button-active-bg - Pressed background of an actionable generated-
 *   table value; defaults to the standard active mix of `--lr-color-brand-quiet`.
 * @cssprop [--lr-chart-reset-zoom-button-hover-bg=var(--lr-color-brand-quiet)] - Hover background
 *   of the reset-zoom button.
 * @cssprop --lr-chart-reset-zoom-button-active-bg - Pressed background of the reset-zoom button;
 *   defaults to the standard active mix of `--lr-color-brand-quiet`.
 * @cssprop [--lr-chart-tooltip-bg=var(--lr-color-surface)] - Tooltip background color. Resolved
 *   via `getComputedStyle` on every draw.
 * @cssprop [--lr-chart-tooltip-text=var(--lr-color-text)] - Tooltip text color. Resolved via
 *   `getComputedStyle` on every draw.
 * @cssprop [--lr-chart-canvas-hover-outline-width=var(--lr-border-width-thin)] - Width of the
 *   `[part='canvas']` hover-state outline (its color is `--lr-chart-grid-color`, above).
 * @cssprop [--lr-chart-pattern-step=var(--lr-space-2xs)] - Tile size of the texture painted on
 *   `[part='legend-swatch']` while `forced-colors: active` matches, where every series collapses to
 *   one system color and the stripe/crosshatch pattern becomes the only channel keeping series
 *   apart. Declared on the swatch part rather than the host; the stripe width within a tile stays
 *   `--lr-border-width-thin`, so a larger step spaces the stripes further apart.
 * @cssprop [--border-color-1=var(--lr-color-chart-1)] - First dataset border color.
 * @cssprop [--border-color-2=var(--lr-color-chart-2)] - Second dataset border color.
 * @cssprop [--border-color-3=var(--lr-color-chart-3)] - Third dataset border color.
 * @cssprop [--border-color-4=var(--lr-color-chart-4)] - Fourth dataset border color.
 * @cssprop [--border-color-5=var(--lr-color-chart-5)] - Fifth dataset border color.
 * @cssprop [--border-color-6=var(--lr-color-chart-6)] - Sixth dataset border color.
 * @cssprop [--fill-color-1=var(--lr-color-chart-1)] - First dataset fill color.
 * @cssprop [--fill-color-2=var(--lr-color-chart-2)] - Second dataset fill color.
 * @cssprop [--fill-color-3=var(--lr-color-chart-3)] - Third dataset fill color.
 * @cssprop [--fill-color-4=var(--lr-color-chart-4)] - Fourth dataset fill color.
 * @cssprop [--fill-color-5=var(--lr-color-chart-5)] - Fifth dataset fill color.
 * @cssprop [--fill-color-6=var(--lr-color-chart-6)] - Sixth dataset fill color.
 * @cssprop [--border-radius=var(--lr-radius)] - Dataset element corner radius.
 * @cssprop [--border-width=var(--lr-border-width-thin)] - Dataset element border width.
 * @cssprop [--grid-border-width=var(--lr-border-width-thin)] - Axis and grid line width.
 * @cssprop [--grid-color=var(--lr-chart-grid-color)] - Grid line color.
 * @cssprop [--line-border-width=var(--lr-border-width-medium)] - Line dataset stroke width.
 * @cssprop [--point-radius=var(--lr-space-2xs)] - Line/scatter point radius.
 * @slot - An optional `<script type="application/json">` containing a Chart.js configuration.
 * @slot data-table - An optional consumer-provided accessible table alternative. Use this escape
 *   hatch for a complete paginated or virtualized alternative when the generated 1,000-record
 *   sample is insufficient.
 * @slot center - Optional overlay content positioned at the chart area's center. Useful for
 *   doughnut and pie totals.
 * @status stable
 * @since 4.0.0
 */
export class LyraChart extends LyraElement<LyraChartEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    chart: LYRA_DEFAULT_chart,
    chartAxisTotal: LYRA_DEFAULT_chartAxisTotal,
    chartCategory: LYRA_DEFAULT_chartCategory,
    chartData: LYRA_DEFAULT_chartData,
    chartDataLabelsUnavailable: LYRA_DEFAULT_chartDataLabelsUnavailable,
    chartDataSampled: LYRA_DEFAULT_chartDataSampled,
    chartMissingLibrary: LYRA_DEFAULT_chartMissingLibrary,
    chartPointLabel: LYRA_DEFAULT_chartPointLabel,
    chartPrimaryAxis: LYRA_DEFAULT_chartPrimaryAxis,
    chartSecondaryAxis: LYRA_DEFAULT_chartSecondaryAxis,
    chartSeriesLabel: LYRA_DEFAULT_chartSeriesLabel,
    chartSeriesNoData: LYRA_DEFAULT_chartSeriesNoData,
    chartStackTotalsUnavailable: LYRA_DEFAULT_chartStackTotalsUnavailable,
    chartSummary: LYRA_DEFAULT_chartSummary,
    chartSummaryEmpty: LYRA_DEFAULT_chartSummaryEmpty,
    chartSummarySeparator: LYRA_DEFAULT_chartSummarySeparator,
    chartSummaryWithData: LYRA_DEFAULT_chartSummaryWithData,
    chartTotal: LYRA_DEFAULT_chartTotal,
    chartTrendDecreasing: LYRA_DEFAULT_chartTrendDecreasing,
    chartTrendFlat: LYRA_DEFAULT_chartTrendFlat,
    chartTrendIncreasing: LYRA_DEFAULT_chartTrendIncreasing,
    chartTypeBar: LYRA_DEFAULT_chartTypeBar,
    chartTypeBubble: LYRA_DEFAULT_chartTypeBubble,
    chartTypeDoughnut: LYRA_DEFAULT_chartTypeDoughnut,
    chartTypeLine: LYRA_DEFAULT_chartTypeLine,
    chartTypePie: LYRA_DEFAULT_chartTypePie,
    chartTypePolarArea: LYRA_DEFAULT_chartTypePolarArea,
    chartTypeRadar: LYRA_DEFAULT_chartTypeRadar,
    chartTypeScatter: LYRA_DEFAULT_chartTypeScatter,
    chartValueLabel: LYRA_DEFAULT_chartValueLabel,
    chartZoomUnavailable: LYRA_DEFAULT_chartZoomUnavailable,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    liteChartMarkSummary: LYRA_DEFAULT_liteChartMarkSummary,
    loading: LYRA_DEFAULT_loading,
    noData: LYRA_DEFAULT_noData,
    open: LYRA_DEFAULT_open,
    resetZoom: LYRA_DEFAULT_resetZoom,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, specialistTokens, styles, srOnly];

  constructor() {
    super();
    // Redraws (re-resolving `--lr-chart-*` via getComputedStyle, since canvas can't read var())
    // when prefers-color-scheme flips or an ancestor's theme attribute mutates. The controller
    // registers itself with the host via addController(); redraw only once a chart exists.
    new ThemeWatcher(this, () => {
      if (this.chart) this.refreshTheme();
    });
  }

  @property({ converter: { fromAttribute: (value) => normalizeChartType(value) } })
  type: LyraChartType = 'bar';
  @property({ attribute: false }) labels: string[] = [];
  @property({ attribute: false }) datasets: Series[] = [];
  /**
   * Complete controlled visibility state for DOM legend toggles. `undefined` (the default) honors
   * each effective dataset's `hidden` configuration; a defined array wins over those defaults, and
   * an empty array deliberately makes every dataset visible. Invalid, duplicate, and out-of-range
   * indexes are ignored when state is applied or emitted.
   */
  @property({ attribute: false }) hiddenDatasets?: readonly number[];
  /** Positive compatibility alias for the visible legend. */
  @property({ type: Boolean, converter: trueDefaultBooleanConverter }) legend = true;
  /** Accessible chart description. */
  @property() description: string | null = null;
  /** Controls which cartesian grid axes are drawn. */
  @property() grid: LyraChartGrid = 'both';
  /** Chart.js index axis. The additive `horizontal` property remains a positive `y` alias. */
  @property({ attribute: 'index-axis' }) indexAxis: LyraChartIndexAxis = 'x';
  /** Accessible chart label. A host `aria-label` still has highest precedence. */
  @property() label: string | null = null;
  /** Legend placement. `auto` uses a right legend above 480px and a bottom legend below it. */
  @property({ attribute: 'legend-position' }) legendPosition: LyraChartLegendPosition = 'top';
  /** Maximum value-axis bound. Non-finite values are ignored. */
  @property({ type: Number }) max: number | null = null;
  /** Minimum value-axis bound. Non-finite values are ignored. */
  @property({ type: Number }) min: number | null = null;
  /** Chart.js plugins attached to this chart instance. */
  @property({ type: Array }) plugins: LyraChartPlugin[] = [];
  /**
   * Formats numeric (value-axis) ticks, tooltip values, legend values, and generated accessible
   * table cells from one callback.
   * Never runs against the categorical x-axis's own labels (line/bar's `labels` strings) —
   * Chart.js's category scale passes the tick index to `ticks.callback`, not the label text,
   * so formatting it would corrupt the axis.
   */
  @property({ attribute: false }) valueFormatter?: LyraChartValueFormatter;
  @property({ type: Boolean }) area = false;
  @property({ type: Boolean }) zoom = false;
  @property() height = '280px';
  @property({ attribute: 'x-label' }) xLabel: string | null = null;
  @property({ attribute: 'y-label' }) yLabel: string | null = null;
  @property({ attribute: 'y2-label' }) y2Label = '';
  @property({ type: Boolean, attribute: 'begin-at-zero', converter: trueDefaultBooleanConverter })
  beginAtZero = true;
  /** Accessible name applied to the canvas. A host `aria-label` wins, then this falls back to the dataset labels. */
  @property({ attribute: 'accessible-label' }) accessibleLabel = '';
  /** Accessible description for the canvas. When unset, a concise data/trend summary is generated. */
  @property({ attribute: 'accessible-description' }) accessibleDescription = '';
  /** Makes the generated data table visible; it remains screen-reader available when false. */
  @property({ type: Boolean, attribute: 'show-data-table' }) showDataTable = false;
  /** Sets `options.indexAxis = 'y'`, Chart.js's own mechanism for horizontal bars (also applies to line/area types). */
  @property({ type: Boolean }) horizontal = false;
  /** Stacks the `x`/`y`(/`y2`) scale entries `buildScales()` returns; only meaningful for `bar` and `line` types. */
  @property({ type: Boolean }) stacked = false;
  /** Disables Chart.js animation. */
  @property({ type: Boolean, attribute: 'without-animation', reflect: true })
  withoutAnimation = false;
  /** Hides the legend. */
  @property({ type: Boolean, attribute: 'without-legend', reflect: true }) withoutLegend = false;
  /** Hides Chart.js tooltips. */
  @property({ type: Boolean, attribute: 'without-tooltip', reflect: true }) withoutTooltip = false;
  /**
   * Draws each data point's value on the chart via the optional
   * `chartjs-plugin-datalabels` peer. Unset (the default) leaves labels off for
   * this chart; the peer is attached only to instances that opt in, and
   * `buildConfig()` keeps its per-chart options disabled until this is set. The
   * screen-reader equivalent is the always-present data table (see
   * `show-data-table`); labels are a purely visual, canvas-only addition.
   */
  @property({ type: Boolean, attribute: 'data-labels' }) dataLabels = false;
  /**
   * When the chart is `stacked` (bar/line only), draws the per-category stack
   * total above each stack, via the same optional `chartjs-plugin-datalabels`
   * peer as `data-labels`. Null/undefined points are skipped; a category whose
   * every value is null shows no total. The generated accessible data table
   * receives the same formatted total column (one per value axis). Unset (the
   * default) draws and adds nothing.
   */
  @property({ type: Boolean, attribute: 'stack-totals' }) stackTotals = false;

  /**
   * Raw Chart.js configuration passthrough — mirrors `wa-chart`'s `config`
   * property. Recursively deep-merged over the `Series`-derived config in
   * `buildConfig()` (any key at any nesting depth — e.g.
   * `config.options.scales.y.min` — wins over the generated equivalent
   * without discarding sibling keys the generated config set), for consumers
   * who need full Chart.js control beyond the simplified `Series` shape.
   *
   * Caveat: the merge only recurses into plain objects — an *array* value
   * (e.g. `config.plugins` as an inline-plugin array, or `config.data.datasets`)
   * REPLACES the generated array wholesale rather than concatenating with it.
   * The public `plugins` array and Lyra's on-demand data-label plugin are then
   * appended without duplicate object identities, so required per-instance
   * plugins remain attached without global registration.
   *
   * When `config.data` supplies `labels` and/or `datasets`, those arrays are the effective data
   * model for canvas rendering, append mutation, CSV export, the accessible name/summary, keyboard
   * navigation/events, the DOM legend, and the fallback data table.
   */
  @property({ attribute: false }) config?: LyraChartConfiguration;

  @state() private slottedConfig?: LyraChartConfiguration;

  private effectiveConfig(): LyraChartConfiguration | undefined {
    return this.config ?? this.slottedConfig;
  }

  private onConfigSlotChange(event: Event): void {
    const slot = event.currentTarget as HTMLSlotElement;
    const script = slot
      .assignedElements({ flatten: true })
      .find(
        (element): element is HTMLScriptElement =>
          element.localName === 'script' &&
          (element as HTMLScriptElement).type.trim().toLowerCase() === 'application/json',
      );
    let next: LyraChartConfiguration | undefined;
    if (script) {
      try {
        const parsed: unknown = JSON.parse(script.textContent ?? '');
        if (isPlainObject(parsed)) next = parsed as LyraChartConfiguration;
      } catch {
        next = undefined;
      }
    }
    this.slottedConfig = next;
  }

  /**
   * The single data model used by every chart surface. `config.data` follows the same merge rule
   * as the Chart.js render config: an explicit labels/datasets array replaces the generated array,
   * while an omitted member falls back to the simplified property surface.
   */
  private effectiveData(): EffectiveChartData {
    const generated: EffectiveChartData = {
      labels: this.labels,
      datasets: this.datasets.map((series) => ({
        ...series,
        data: series.points ?? series.data ?? [],
        yAxisID: series.axis === 'y2' ? 'y2' : 'y',
      })),
    };
    const override = this.effectiveConfig()?.data;
    const merged = isPlainObject(override)
      ? deepMerge(generated, override)
      : generated;
    return {
      labels: Array.isArray(merged.labels) ? merged.labels : [],
      datasets: Array.isArray(merged.datasets)
        ? merged.datasets.filter(isPlainObject) as LyraChartDatasetConfiguration[]
        : [],
    };
  }

  /** The public controlled snapshot when supplied, otherwise the effective configuration default. */
  private effectiveHiddenDatasetIndexes(): number[] {
    const effective = this.effectiveData();
    const controlled = normalizeHiddenDatasets(this.hiddenDatasets, effective.datasets.length);
    if (controlled !== undefined) return controlled;
    return effective.datasets.flatMap((dataset, index) => dataset.hidden === true ? [index] : []);
  }

  /** Applies the public controlled state to the live Chart.js metadata after any data replacement. */
  private applyDatasetVisibility(): boolean {
    if (!this.chart) return false;
    const datasetCount = this.chart.data.datasets?.length ?? 0;
    const controlled = normalizeHiddenDatasets(this.hiddenDatasets, datasetCount);
    if (controlled === undefined) {
      for (let index = 0; index < datasetCount; index++) {
        // Clear Chart.js's metadata override so the replacement configuration's `hidden` property
        // becomes the source of truth again. This is specifically what a programmatic reset to
        // `hiddenDatasets = undefined` promises.
        const metadata = this.chart.getDatasetMeta?.(index);
        if (metadata) metadata.hidden = null;
      }
      return datasetCount > 0;
    }
    const hidden = new Set(controlled);
    for (let index = 0; index < datasetCount; index++) {
      this.chart.setDatasetVisibility(index, !hidden.has(index));
    }
    return datasetCount > 0;
  }

  private hasExplicitConfigData(): boolean {
    const config = this.effectiveConfig();
    return isPlainObject(config) && Object.prototype.hasOwnProperty.call(config, 'data');
  }

  private datasetLabel(dataset: LyraChartDatasetConfiguration, index: number): string {
    return labelText(dataset.label) || this.localize('chartPointLabel', undefined, {
      n: getNumberFormat(this.effectiveLocale).format(index + 1),
    });
  }

  private datasetValues(dataset: LyraChartDatasetConfiguration): unknown[] {
    return Array.isArray(dataset.data) ? dataset.data : [];
  }

  private isPointDataset(dataset: LyraChartDatasetConfiguration): boolean {
    const values = this.datasetValues(dataset);
    return (
      this.effectiveType() === 'scatter' ||
      this.effectiveType() === 'bubble' ||
      values.some(isChartPoint)
    );
  }

  /**
   * Appends one streamed category to numeric `data` series and optionally keeps only the newest
   * `maxPoints` categories. An explicitly supplied `config.data` member is updated at that same
   * source; generated members continue to update `labels`/`datasets`, preserving generated styling.
   * Point-based scatter/bubble series are left unchanged because their x/y/r coordinates need a
   * richer host-defined append contract.
   */
  appendData(label: string, values: (number | null)[], maxPoints = 0): void {
    const limit = Number.isFinite(maxPoints) ? Math.max(0, Math.floor(maxPoints)) : 0;
    if (this.hasExplicitConfigData()) {
      const effective = this.effectiveData();
      const labels = [...effective.labels, label];
      const effectiveConfig = this.effectiveConfig();
      const currentData = isPlainObject(effectiveConfig?.data) ? effectiveConfig.data : {};
      const explicitLabels = Array.isArray(currentData['labels']);
      const explicitDatasets = Array.isArray(currentData['datasets']);
      const nextLabels = limit > 0 ? labels.slice(-limit) : labels;

      if (!explicitLabels) this.labels = nextLabels.map(labelText);
      if (!explicitDatasets) {
        const datasets = this.datasets.map((series, index) => {
          if (series.points) return series;
          const data = [...(series.data ?? []), values[index] ?? null];
          return { ...series, data: limit > 0 ? data.slice(-limit) : data };
        });
        this.datasets = datasets;
      }

      if (explicitLabels || explicitDatasets) {
        const nextData: Record<string, unknown> = { ...currentData };
        if (explicitLabels) nextData['labels'] = nextLabels;
        if (explicitDatasets) {
          nextData['datasets'] = effective.datasets.map((dataset, index) => {
            if (this.isPointDataset(dataset)) return dataset;
            const data = [...this.datasetValues(dataset), values[index] ?? null];
            return { ...dataset, data: limit > 0 ? data.slice(-limit) : data };
          });
        }
        this.config = { ...effectiveConfig, data: nextData as LyraChartDataConfiguration };
      }
      return;
    }
    const labels = [...this.labels, label];
    const datasets = this.datasets.map((series, index) =>
      series.points
        ? series
        : { ...series, data: [...(series.data ?? []), values[index] ?? null] },
    );
    this.labels = limit > 0 ? labels.slice(-limit) : labels;
    this.datasets = limit > 0
      ? datasets.map((series) => (series.points ? series : { ...series, data: series.data?.slice(-limit) }))
      : datasets;
  }

  /**
   * Returns a spreadsheet-safe CSV snapshot of the effective chart data. Point datasets expand to
   * x/y and, when present, radius/per-point-label columns so export never flattens point meaning.
   */
  exportData(format: LyraChartExportFormat): string {
    if (format === 'png') return this.chart?.toBase64Image?.() ?? '';
    const effective = this.effectiveData();
    const columns = effective.datasets.map((dataset, datasetIndex) => {
      const values = this.datasetValues(dataset);
      const label = this.datasetLabel(dataset, datasetIndex);
      const points = values.filter(isChartPoint);
      return {
        dataset,
        label,
        point: this.isPointDataset(dataset),
        radius: points.some((point) => point.r != null),
        pointLabel: points.some((point) => point.label != null),
      };
    });
    const header = [
      'label',
      ...columns.flatMap((column) =>
        column.point
          ? [
              `${column.label} x`,
              `${column.label} y`,
              ...(column.radius ? [`${column.label} r`] : []),
              ...(column.pointLabel ? [`${column.label} label`] : []),
            ]
          : [column.label],
      ),
    ].map(escapeCsvField).join(',');
    const rowCount = Math.max(
      effective.labels.length,
      ...effective.datasets.map((dataset) => this.datasetValues(dataset).length),
      0,
    );
    const rows = Array.from({ length: rowCount }, (_, index) => {
      const firstPoint = effective.datasets
        .map((dataset) => this.datasetValues(dataset)[index])
        .find(isChartPoint);
      const label = labelText(effective.labels[index]) || firstPoint?.label || '';
      return [
        label,
        ...columns.flatMap((column) => {
          const value = this.datasetValues(column.dataset)[index];
          if (!column.point) return [value ?? ''];
          if (!isChartPoint(value)) {
            return ['', '', ...(column.radius ? [''] : []), ...(column.pointLabel ? [''] : [])];
          }
          return [
            value.x,
            value.y,
            ...(column.radius ? [value.r ?? ''] : []),
            ...(column.pointLabel ? [value.label ?? ''] : []),
          ];
        }),
      ].map(escapeCsvField).join(',');
    });
    return [header, ...rows].join('\r\n');
  }

  /** True until the lazy-loaded `chart.js` peer dependency has settled (success or failure). */
  @state() private loading = true;

  /**
   * True once the optional `chart.js` peer failed to load (not installed) -- `render()` fails
   * closed into a visible `part="error"` and announces through the document-level sink.
   */
  @state() private loadFailed = false;

  // Overridable instance field (not a direct `loadChartJs()` call site) purely so tests can
  // inject a stubbed loader before the element ever connects -- matches map/docx-viewer's own
  // `loadLibrary` field/rationale exactly.
  private loadLibrary: (withZoom: boolean) => ReturnType<typeof loadChartJs> = (withZoom) =>
    withZoom ? loadChartJsWithZoom() : loadChartJs();
  // Separate feature-result seams let tests model an optional peer failure without pretending the
  // mandatory Chart.js core failed too. They intentionally retain the existing `loadLibrary`
  // seam for core-load tests and consumers of the established lifecycle behavior.
  private loadZoomFeature: () => Promise<ChartFeatureLoadResult<ZoomPlugin>> = () =>
    loadChartJsWithZoomResult();
  private loadDataLabelsFeature: () => Promise<ChartFeatureLoadResult<DataLabelsPlugin>> = () =>
    loadChartJsWithDataLabelsResult();
  // Invalidates a lazy-load callback when this element disconnects/reconnects. Without a
  // generation token, two connectedCallback() calls around one in-flight import can both settle
  // against the reconnected element and construct/reconfigure the chart from stale lifecycle
  // state.
  private loadGeneration = 0;
  private zoomLoadGeneration = 0;
  private dataLabelsLoadGeneration = 0;
  // These loader states are intentionally non-reactive. A feature request may start from
  // `updated()` after a property flip; making the intermediate `loading` write reactive produces
  // Lit's update-in-update warning. Completion explicitly requests the one render needed for a
  // warning/reset-control change instead.
  private zoomFeatureState: ChartFeatureState = 'idle';
  private dataLabelsFeatureState: ChartFeatureState = 'idle';
  // The resolved `chartjs-plugin-datalabels` plugin object, registered
  // PER-INSTANCE via this chart's own `config.plugins` (not globally — a global
  // registration would draw labels on, and break, every other chart on the
  // page). `undefined` until the peer loads (or if it's not installed).
  private dataLabelsPlugin?: DataLabelsPlugin;

  @state() private zoomed = false;

  @state() private visible = true;
  private intersectionObserver?: IntersectionObserver;

  @query('canvas') private canvasEl?: HTMLCanvasElement;
  private chart?: RuntimeChart;
  private chartJsModule?: ChartJsModule;
  private resizeObserver?: ResizeObserver;
  private resizeDrawFrame?: number;
  private resizeDrawFrameOwner?: BrowserWindow;
  private lastObservedInlineSize?: number;
  @state() private autoLegendPosition: 'right' | 'bottom' = 'right';
  // Chart.js computes this geometry while drawing, after Lit has rendered the
  // canvas. Keep the cache non-reactive so that draw() does not trigger a
  // second update merely by recording the overlay position.
  private resolvedChartArea?: LyraChartArea;
  private chartAreaUpdateQueued = false;
  // Tracks the *effective* Chart.js type actually passed to `new Chart()` —
  // i.e. `config.type` post-merge, not `this.type` — since `config.type` (the
  // raw passthrough) can override the generated type in `buildConfig()`. See
  // the deep-merge note on `buildConfig()` below.
  private builtType?: string;
  private builtPlugins: LyraChartPlugin[] = [];
  // `chartjs-plugin-zoom`'s own `resetZoom()` synchronously re-invokes the
  // `onZoomComplete` callback below as part of its reset, which would emit a
  // stale `{zoomed: true}` right before `resetZoom()` emits the real
  // `{zoomed: false}`. Set while this component's own `resetZoom()` is
  // driving the plugin so that re-entrant callback is ignored.
  private suppressZoomComplete = false;
  private descriptionId = nextId('chart-description');
  private keyboardDatumIndex = 0;
  @state() private keyboardDatumAnnouncement = '';
  /** Shared document-level regions that carry announcements. The visually hidden datum copy is an
   *  inspection mirror only because shadow-root live regions are not consistently spoken. */
  private politeAnnouncementSink?: AnnouncementSink;
  private assertiveAnnouncementSink?: AnnouncementSink;
  private lastDataTruncationAnnouncement = '';
  /** Gates the sampling notice so an initially supplied large dataset is described, not announced. */
  private isMounting = true;
  private announcedFeatureWarnings = new Set<string>();
  // `effectiveDirection`/`effectiveLocale` can change without any tracked reactive property
  // changing: `dir`/`lang` are plain host/ancestor attributes (not Lit `@property`s), so a
  // `LyraElement`'s inherited-context `MutationObserver` turns an ancestor's `dir`/`lang` flip
  // into a bare `requestUpdate()` -- `updated()`'s `changed` map carries no entry for either,
  // so `contentChanged` below must independently compare against the *last drawn* direction/
  // locale, or a live axis-position/locale-formatted redraw is missed entirely. `undefined`
  // until the first post-load `updated()` pass; `buildConfig()`'s already-correct RTL axis
  // placement means an initial mismatch is harmless -- `loading` flips in that same pass and
  // already forces the first `draw()` regardless.
  private lastDrawnDirection?: 'ltr' | 'rtl';
  private lastDrawnLocale?: string;

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncAnnouncementSinks();
    const ownerWindow = this.ownerWindow;
    const ResizeObserverCtor = ownerWindow?.ResizeObserver;
    if (ResizeObserverCtor) {
      this.resizeObserver = new ResizeObserverCtor((entries) => {
        const width = entries[0]?.contentRect.width ?? this.getBoundingClientRect().width;
        if (
          Number.isFinite(width) &&
          this.lastObservedInlineSize !== undefined &&
          Math.abs(width - this.lastObservedInlineSize) < 0.5
        ) {
          return;
        }
        this.lastObservedInlineSize = width;
        if (this.resizeDrawFrame !== undefined) return;
        const frameOwner = this.ownerWindow;
        if (!frameOwner) return;
        this.resizeDrawFrameOwner = frameOwner;
        this.resizeDrawFrame = frameOwner.requestAnimationFrame(() => {
          this.resizeDrawFrame = undefined;
          this.resizeDrawFrameOwner = undefined;
          if (!this.isConnected || this.ownerWindow !== frameOwner) return;
          // A changed auto position schedules the same visibility-gated draw through `updated()`.
          // Avoid drawing once here and again in that reactive pass.
          if (!this.updateAutoLegendPosition()) this.drawIfVisible();
        });
      });
      this.resizeObserver.observe(this);
    }
    this.updateAutoLegendPosition();
    const generation = ++this.loadGeneration;
    if (this.zoom) this.requestZoomFeature();
    const load = this.loadLibrary(this.zoom);
    void load.then(async (mod) => {
      // The server always renders the stable loading branch. A cached/fast optional-peer import can
      // otherwise settle while the browser is still upgrading the declarative-shadow-DOM host,
      // switching render() to the canvas branch before Lit's first hydration pass and forcing a
      // full shadow-tree replacement. Let that first update claim the server markers before any
      // peer result is allowed to change the template. On an ordinary client-only mount this keeps
      // the existing loading skeleton for exactly the initial update as well.
      try {
        await this.updateComplete;
      } catch {
        return;
      }
      if (generation !== this.loadGeneration || !this.isConnected) return;
      this.loading = false;
      if (!mod) {
        this.loadFailed = true;
        return;
      }
      this.loadFailed = false;
      this.chartJsModule = mod;
      this.drawIfVisible();
    });
    // `data-labels`/`stack-totals` need the optional `chartjs-plugin-datalabels`
    // peer registered before the plugin's `datalabels` options in `buildConfig()`
    // take effect. Load it in parallel with the core (both memoized), then
    // redraw once it's registered — mirrors the `zoom` on-demand load and its
    // generation + `isConnected` guard against a disconnect mid-import.
    if (this.needsDataLabels) {
      this.requestDataLabelsFeature();
    }
    const IntersectionObserverCtor = ownerWindow?.IntersectionObserver;
    if (IntersectionObserverCtor) {
      this.intersectionObserver = new IntersectionObserverCtor((entries) => {
        const wasVisible = this.visible;
        this.visible = entries[0]?.isIntersecting ?? true;
        if (this.visible && !wasVisible) this.drawIfVisible();
      });
      this.intersectionObserver.observe(this);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.releaseAnnouncementSinks();
    this.lastDataTruncationAnnouncement = '';
    this.isMounting = true;
    this.announcedFeatureWarnings.clear();
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    if (this.resizeDrawFrame !== undefined) {
      this.resizeDrawFrameOwner?.cancelAnimationFrame(this.resizeDrawFrame);
    }
    this.resizeDrawFrame = undefined;
    this.resizeDrawFrameOwner = undefined;
    this.lastObservedInlineSize = undefined;
    this.loadGeneration += 1;
    this.zoomLoadGeneration += 1;
    this.dataLabelsLoadGeneration += 1;
    this.chart?.destroy();
    this.chart = undefined;
    this.builtPlugins = [];
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = undefined;
  }

  adoptedCallback(): void {
    this.releaseAnnouncementSinks();
    this.syncAnnouncementSinks();
  }

  /** Re-target the ref-counted regions after reconnect/adoption without replaying existing text. */
  private syncAnnouncementSinks(): void {
    if (!this.isConnected) return;
    const heldInOwnerDocument =
      this.politeAnnouncementSink?.element.ownerDocument === this.ownerDocument &&
      this.assertiveAnnouncementSink?.element.ownerDocument === this.ownerDocument;
    if (heldInOwnerDocument) return;
    this.releaseAnnouncementSinks();
    this.politeAnnouncementSink = acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
    this.assertiveAnnouncementSink = acquireAnnouncementSink('assertive', {
      document: this.ownerDocument,
      source: this,
    });
  }

  private releaseAnnouncementSinks(): void {
    this.politeAnnouncementSink?.release();
    this.politeAnnouncementSink = undefined;
    this.assertiveAnnouncementSink?.release();
    this.assertiveAnnouncementSink = undefined;
  }

  private get ownerWindow(): BrowserWindow | undefined {
    return (this.ownerDocument.defaultView as BrowserWindow | null) ?? undefined;
  }

  private computedStyle(element: Element = this): CSSStyleDeclaration {
    const view = this.ownerWindow;
    return view
      ? view.getComputedStyle(element)
      : 'style' in element
        ? (element as HTMLElement).style
        : this.style;
  }

  /**
   * Called once the `chartjs-plugin-datalabels` peer resolves. Chart.js reads a
   * config's inline `plugins: [...]` array ONLY at construction — the in-place
   * `chart.data`/`chart.options` update path in `draw()` never picks up a plugin
   * added later. So on a cold load (plugin resolves after the chart was already
   * built) or a `data-labels`/`stack-totals` turn-on, the live chart must be
   * torn down and rebuilt for the per-instance plugin to actually attach. Guards
   * on the plugin being newly present so a redraw that already includes it (or a
   * feature that's since been turned back off) doesn't needlessly rebuild.
   */
  private applyDataLabelsPlugin(plugin: DataLabelsPlugin | undefined): void {
    this.dataLabelsPlugin = plugin;
    let rebuilt = false;
    if (plugin && this.needsDataLabels && this.chart) {
      // Force reconstruction: a live chart built without the plugin can't gain
      // it through chart.update(). destroy() + clearing builtType makes the next
      // draw() take the `new Chart()` branch, which reads config.plugins.
      this.chart.destroy();
      this.chart = undefined;
      this.builtType = undefined;
      this.builtPlugins = [];
      rebuilt = true;
    }
    this.drawIfVisible();
    // A rebuild resets Chart.js's per-instance visibility metadata to the configured `hidden`
    // flags. Nothing reactive changes after the async plugin resolves, so refresh the DOM legend
    // explicitly instead of leaving its pre-rebuild aria-pressed state stale.
    if (rebuilt && this.showsLegend) this.requestUpdate();
  }

  private get zoomFeatureAvailable(): boolean {
    return this.zoom && this.zoomFeatureState === 'available';
  }

  private featureWarningMessages(): string[] {
    if (this.loading || this.loadFailed) return [];
    const messages: string[] = [];
    if (this.zoom && this.zoomFeatureState === 'unavailable') {
      messages.push(this.localize('chartZoomUnavailable'));
    }
    if (this.dataLabelsFeatureState === 'unavailable') {
      if (this.dataLabels) messages.push(this.localize('chartDataLabelsUnavailable'));
      if (this.stackTotals) messages.push(this.localize('chartStackTotalsUnavailable'));
    }
    return messages;
  }

  private requestZoomFeature(): void {
    const generation = ++this.zoomLoadGeneration;
    if (!this.zoom) {
      this.zoomFeatureState = 'idle';
      return;
    }
    this.zoomFeatureState = 'loading';
    void this.loadZoomFeature().then((result) => {
      if (generation !== this.zoomLoadGeneration || !this.isConnected || !this.zoom) return;
      this.zoomFeatureState = result.kind === 'available' ? 'available' : 'unavailable';
      // A dynamic request may be the first feature path to return a retained core module. The
      // normal core load remains authoritative for fatal state, but retaining this module keeps a
      // usable chart intact if the opt-in peer alone failed.
      if (result.kind !== 'core-unavailable' && !this.loading && !this.chartJsModule) {
        this.chartJsModule = result.mod;
      }
      this.drawIfVisible();
      this.requestUpdate();
    });
  }

  private requestDataLabelsFeature(): void {
    const generation = ++this.dataLabelsLoadGeneration;
    if (!this.needsDataLabels) {
      this.dataLabelsFeatureState = 'idle';
      return;
    }
    this.dataLabelsFeatureState = 'loading';
    void this.loadDataLabelsFeature().then((result) => {
      if (generation !== this.dataLabelsLoadGeneration || !this.isConnected || !this.needsDataLabels) {
        return;
      }
      this.dataLabelsFeatureState = result.kind === 'available' ? 'available' : 'unavailable';
      if (result.kind !== 'core-unavailable' && !this.loading && !this.chartJsModule) {
        this.chartJsModule = result.mod;
      }
      this.applyDataLabelsPlugin(result.kind === 'available' ? result.plugin : undefined);
      this.requestUpdate();
    });
  }

  /**
   * Resets a stale `zoomed` flag before the render pass that's about to call
   * `draw()`: a `type` (or `config.type` override) change that lands on a
   * *different* effective Chart.js type makes `draw()` destroy the old
   * `Chart` instance and construct a brand-new one, which was never zoomed —
   * without this, `render()`'s reset-zoom-button stays visible for an
   * instance that has no zoom/pan state left to reset. Computed here (before
   * render), not in `updated()`/`draw()`, because setting `zoomed` — a
   * reactive `@state` property — from `updated()` would schedule a second,
   * redundant update pass; `willUpdate()` runs before this cycle's render is
   * considered complete, so the same set just folds into the render already
   * in progress. Same rationale as `toast-item.ts`'s `willUpdate()`-vs-
   * `updated()` split.
   */
  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!this.zoomed) return;
    if (this.effectiveType() !== this.builtType) {
      this.zoomed = false;
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    // Disconnected between the property change that scheduled this update
    // and Lit's (microtask-deferred) processing of it — e.g. a property
    // changes and the element is removed in the same synchronous tick, so
    // `disconnectedCallback()` (which already destroyed `this.chart`) runs
    // *before* this method does. Nothing below should run in that case:
    // this method's own unconditional `draw()` call further down would
    // otherwise construct a brand-new `Chart` bound to the now-detached
    // canvas — `draw()`'s own guard (`!chartJsModule || !canvasEl`) doesn't
    // catch this, since both persist on a disconnected-but-intact element.
    // If the component is reconnected later, `connectedCallback()` re-kicks
    // its own load/draw sequence, so nothing is lost by bailing out here.
    if (!this.isConnected) return;
    const wasMounting = this.isMounting;
    this.isMounting = false;

    // The default empty datum state is part of the first update and must stay silent. Later
    // keyboard changes are appended once to the light-DOM sink; the shadow copy is aria-hidden.
    if (
      changed.has('keyboardDatumAnnouncement') &&
      changed.get('keyboardDatumAnnouncement') !== undefined &&
      this.keyboardDatumAnnouncement !== ''
    ) {
      this.politeAnnouncementSink?.announce(this.keyboardDatumAnnouncement);
    }
    if (
      changed.has('loadFailed') &&
      changed.get('loadFailed') !== undefined &&
      this.loadFailed
    ) {
      this.assertiveAnnouncementSink?.announce(this.localize('chartMissingLibrary'));
    }
    const dataTruncation = this.dataTruncationMessage();
    if (wasMounting) {
      // The peer loader completes on a later update, so establish the initial value now rather
      // than treating its successful completion as a user-visible data change.
      this.lastDataTruncationAnnouncement = dataTruncation;
    }
    if (!this.loading && !this.loadFailed) {
      const featureWarnings = this.featureWarningMessages();
      for (const warning of featureWarnings) {
        if (!this.announcedFeatureWarnings.has(warning)) {
          this.assertiveAnnouncementSink?.announce(warning);
        }
      }
      this.announcedFeatureWarnings = new Set(featureWarnings);
      if (!wasMounting && dataTruncation !== this.lastDataTruncationAnnouncement) {
        this.lastDataTruncationAnnouncement = dataTruncation;
        if (dataTruncation) this.politeAnnouncementSink?.announce(dataTruncation);
      }
    }

    this.setAttribute('aria-busy', String(this.loading));

    // Keep the author-facing `--lr-chart-height` hook entirely consumer-owned. The component's
    // property supplies only the private fallback, so consumer CSS continues to win across valid,
    // invalid, and unset `height` updates.
    if (changed.has('height')) {
      const height = sanitizeCssLength(this.height, 'height');
      if (height) this.style.setProperty('--_lr-chart-height', height);
      else this.style.removeProperty('--_lr-chart-height');
    }
    // While `chart.js` is still loading, `draw()` would no-op anyway (no
    // `chartJsModule`/`canvasEl` yet) — bail before touching `lastSignature`
    // so that phantom "no-op" update doesn't get cached as the baseline and
    // silently swallow the real first draw once loading finishes with no
    // other property having changed in the meantime.
    if (this.loading) return;

    // `zoom` can also turn on after connect (it was false at
    // `connectedCallback()` time, so only the core `loadChartJs()` load was
    // kicked off) — load the zoom plugin on demand now and redraw once it's
    // registered. Mirrors the same `isConnected` guard `connectedCallback()`
    // uses: this method already bailed out above if *already* disconnected,
    // but the element can *also* disconnect during the gap while this
    // dynamic import is in flight — without this guard, `draw()` would
    // construct a new, leaked `Chart` bound to the now-detached canvas once
    // the import resolves.
    if (changed.has('zoom')) {
      this.requestZoomFeature();
    }
    // `data-labels`/`stack-totals` can turn on after connect (like `zoom`) — load
    // the plugin on demand and redraw once it's registered, with the same
    // generation + `isConnected` guard against a disconnect mid-import.
    if (changed.has('dataLabels') || changed.has('stackTotals')) {
      this.requestDataLabelsFeature();
    }
    const contentChanged = this.chartContentChanged(changed);
    // `this.locale`/`this.strings` above only catch an explicit property write on this element
    // itself -- an inherited `dir`/`lang` flip on an ancestor changes `effectiveDirection()`/
    // `effectiveLocale()` (which `buildScales()`/`buildConfig()` read directly) without touching
    // any tracked property here, so it has to be detected by comparing against what was actually
    // last drawn instead.
    const effectiveDirection = this.effectiveDirection;
    const effectiveLocale = this.effectiveLocale;
    const contextChanged =
      (this.lastDrawnDirection !== undefined && this.lastDrawnDirection !== effectiveDirection) ||
      (this.lastDrawnLocale !== undefined && this.lastDrawnLocale !== effectiveLocale);
    this.lastDrawnDirection = effectiveDirection;
    this.lastDrawnLocale = effectiveLocale;
    if (!contentChanged && !contextChanged) return;
    this.drawIfVisible();
  }

  /**
   * Subclass extension point for derived reactive inputs. Keeping this gate in the normal
   * visibility-checked update path prevents subclasses such as histogram from issuing a second,
   * unconditional post-update redraw.
   */
  protected chartContentChanged(changed: PropertyValues): boolean {
    return [
      'type',
      'labels',
      'datasets',
      'hiddenDatasets',
      'legend',
      'description',
      'grid',
      'indexAxis',
      'label',
      'legendPosition',
      'min',
      'max',
      'plugins',
      'autoLegendPosition',
      'valueFormatter',
      'area',
      'height',
      'xLabel',
      'yLabel',
      'y2Label',
      'beginAtZero',
      'horizontal',
      'stacked',
      'withoutAnimation',
      'withoutLegend',
      'withoutTooltip',
      'dataLabels',
      'stackTotals',
      'config',
      'slottedConfig',
      'zoom',
      'locale',
      'strings',
      'loading',
    ].some((name) => changed.has(name));
  }

  private seriesToDataset(
    s: Series,
    index: number,
    palette: string[],
    effectiveType: EffectiveChartType,
    chartStyle: ChartStyleOptions = this.chartStyleOptions(palette),
  ): LyraChartDatasetConfiguration {
    const borderFallback =
      chartStyle.borderColors[index % chartStyle.borderColors.length] ??
      palette[index % palette.length];
    const fillFallback =
      chartStyle.fillColors[index % chartStyle.fillColors.length] ??
      palette[index % palette.length];
    const colors = Array.isArray(s.color)
      ? s.color.map((color) => resolveCanvasColor(this, color, borderFallback ?? 'transparent'))
      : s.color
        ? [resolveCanvasColor(this, s.color, borderFallback ?? 'transparent')]
        : undefined;
    // Default a color-less series to the categorical palette, keyed by dataset index (matching
    // <lr-lite-chart>). pie/doughnut/polarArea carry one series whose *slices* each need a distinct
    // color, so those default to an array cycled across the palette; every other family is one
    // color per series. Only applied when the caller gave no `color` — an explicit `color` still wins.
    const sliceChart =
      effectiveType === 'pie' || effectiveType === 'doughnut' || effectiveType === 'polarArea';
    const sliceFillColors =
      sliceChart && chartStyle.fillColors.length
        ? (s.points ?? s.data ?? []).map(
            (_, itemIndex) => chartStyle.fillColors[itemIndex % chartStyle.fillColors.length]!,
          )
        : undefined;
    const sliceBorderColors =
      sliceChart && chartStyle.borderColors.length
        ? (s.points ?? s.data ?? []).map(
            (_, itemIndex) => chartStyle.borderColors[itemIndex % chartStyle.borderColors.length]!,
          )
        : undefined;
    const fill = s.fill ?? this.area;
    const backgroundColor = colors ?? sliceFillColors ?? fillFallback;
    const datasetType = s.type ?? effectiveType;
    const segmentColors = s.segmentColors?.map((color) =>
      resolveCanvasColor(this, color, colors?.[0] ?? borderFallback ?? 'transparent'),
    );
    const resolvedBackgroundColor =
      datasetType === 'line' &&
      fill &&
      (colors || !chartStyle.authoredFillColors[index % chartStyle.authoredFillColors.length])
        ? Array.isArray(backgroundColor)
          ? backgroundColor.map((color) => translucentAreaColor(this, color))
          : backgroundColor
            ? translucentAreaColor(this, backgroundColor)
            : backgroundColor
        : backgroundColor;
    const encoding = FORCED_COLOR_ENCODINGS[index % FORCED_COLOR_ENCODINGS.length]!;
    const encodedBackgroundColor = chartStyle.forcedColors
      ? Array.isArray(resolvedBackgroundColor)
        ? resolvedBackgroundColor.map((color, itemIndex) =>
            this.forcedColorPattern(sliceChart ? itemIndex : index, color),
          )
        : resolvedBackgroundColor
          ? this.forcedColorPattern(index, resolvedBackgroundColor)
          : resolvedBackgroundColor
      : resolvedBackgroundColor;
    return {
      label: s.label,
      data: s.points ?? s.data ?? [],
      // Leave unset rather than defaulting to `this.type`: Chart.js already
      // falls back to the chart-level (effective) type for any dataset that
      // doesn't set its own `type`, and forcing `this.type` here unconditionally
      // used to be harmless (it normally matched the effective type anyway) —
      // but it actively breaks a `config.type` override to a different chart
      // family (e.g. attribute `type="line"` + `config.type: 'radar'`): every
      // dataset would carry an explicit `type: 'line'` under a chart whose
      // scales are built for `radar` (a single radial `r` scale, no `x`/`y`),
      // which Chart.js can't reconcile — it hangs the page trying to lay out
      // a cartesian-scale controller against a radial-only scale set. Only
      // `s.type` (an explicit per-series mixed-type override, e.g. a line
      // series over a bar chart of the *same* effective family) is passed
      // through.
      type: s.type,
      fill,
      borderRadius: chartStyle.borderRadius,
      borderWidth:
        s.width ?? (datasetType === 'line' ? chartStyle.lineBorderWidth : chartStyle.borderWidth),
      borderDash: s.dash ? [4, 4] : chartStyle.forcedColors ? [...encoding.dash] : undefined,
      pointStyle: chartStyle.forcedColors ? encoding.pointStyle : undefined,
      backgroundColor: encodedBackgroundColor,
      borderColor: colors?.[0] ?? sliceBorderColors ?? borderFallback,
      pointBackgroundColor: s.pointColors?.map((color) =>
        resolveCanvasColor(this, color, colors?.[0] ?? borderFallback ?? 'transparent'),
      ),
      pointRadius: s.pointRadius ?? chartStyle.pointRadius,
      // `segment` is Chart.js's per-line-segment scriptable-options hook (line controller only),
      // keyed by the segment's *starting* point index. Only spread in when the series actually
      // sets `segmentColors`, so a series without it produces the exact dataset object it always
      // did — Chart.js treats a present-but-inert `segment` key differently from an absent one.
      ...(segmentColors?.length
        ? {
            segment: {
              borderColor: (ctx: { p0DataIndex: number }) =>
                segmentColors[ctx.p0DataIndex % segmentColors.length],
            },
          }
        : {}),
      yAxisID: s.axis === 'y2' ? 'y2' : 'y',
    };
  }

  /**
   * Resolves the `--lr-chart-*` theme tokens (declared in
   * `chart.styles.ts`, each layered over an existing semantic token) via
   * `getComputedStyle`. Chart.js renders to canvas, not the DOM, so it can't
   * consume CSS `var()` directly — same constraint documented on
   * `heatmap.ts`'s `labelColor()`/`noDataFill()`/`scaleEndpoints()` — so this
   * is called fresh from `buildConfig()` on every draw rather than cached.
   */
  private themeColors(): ThemeColors {
    const cs = this.computedStyle();
    const grid =
      cs.getPropertyValue('--grid-color').trim() ||
      cs.getPropertyValue('--lr-chart-grid-color').trim();
    const tick = cs.getPropertyValue('--lr-chart-tick-color').trim();
    const legend = cs.getPropertyValue('--lr-chart-legend-color').trim();
    const tooltipBg = cs.getPropertyValue('--lr-chart-tooltip-bg').trim();
    const tooltipText = cs.getPropertyValue('--lr-chart-tooltip-text').trim();
    return {
      grid: resolveCanvasColor(this, grid, FALLBACK_GRID_COLOR),
      tick: resolveCanvasColor(this, tick, FALLBACK_TICK_COLOR),
      legend: resolveCanvasColor(this, legend, FALLBACK_LEGEND_COLOR),
      tooltipBg: resolveCanvasColor(this, tooltipBg, FALLBACK_TOOLTIP_BG),
      tooltipText: resolveCanvasColor(this, tooltipText, FALLBACK_TOOLTIP_TEXT),
    };
  }

  private styleColor(name: string, fallback: string): string {
    const value = this.computedStyle().getPropertyValue(name).trim();
    return value ? resolveCanvasColor(this, value, fallback) : fallback;
  }

  private styleNumber(name: string, fallbackToken: string, fallback: number): number {
    const computed = this.computedStyle();
    const value =
      computed.getPropertyValue(name).trim() || computed.getPropertyValue(fallbackToken).trim();
    const direct = /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))(?:px)?$/i.exec(value);
    if (direct) {
      const resolved = Number.parseFloat(direct[1]!);
      if (Number.isFinite(resolved) && resolved >= 0) return resolved;
    }
    if (!value || !this.ownerWindow) return fallback;

    const probe = this.ownerDocument.createElement('span');
    probe.hidden = true;
    probe.setAttribute('aria-hidden', 'true');
    probe.style.inlineSize = value;
    (this.shadowRoot ?? this).append(probe);
    try {
      const resolved = Number.parseFloat(this.computedStyle(probe).inlineSize);
      return Number.isFinite(resolved) && resolved >= 0 ? resolved : fallback;
    } finally {
      probe.remove();
    }
  }

  /**
   * Builds a small deterministic CanvasPattern for the category index. Forced-colors exposes only
   * a few system colors, so the chart ramp necessarily repeats; texture, line dash, and point shape
   * keep those repeated colors distinguishable without substituting arbitrary author colors.
   */
  private forcedColorPattern(index: number, background: string): CanvasPattern | string {
    if (!this.ownerWindow) return background;
    const tile = this.ownerDocument.createElement('canvas');
    // Fixed bitmap geometry is part of the encoding algorithm, not a component design dimension.
    const size = 8;
    const half = size / 2;
    tile.width = size;
    tile.height = size;
    const context = tile.getContext('2d');
    if (!context) return background;

    context.fillStyle = background;
    context.fillRect(0, 0, size, size);
    context.fillStyle = this.styleColor('--lr-color-surface', FALLBACK_TOOLTIP_BG);
    context.strokeStyle = context.fillStyle;
    context.lineWidth = 1;

    switch (index % FORCED_COLOR_ENCODINGS.length) {
      case 1:
        context.fillRect(0, half, size, 1);
        break;
      case 2:
        context.fillRect(half, 0, 1, size);
        break;
      case 3:
        context.beginPath();
        context.moveTo(-half, size);
        context.lineTo(half, 0);
        context.moveTo(half, size);
        context.lineTo(size + half, 0);
        context.stroke();
        break;
      case 4:
        context.beginPath();
        context.moveTo(-half, 0);
        context.lineTo(half, size);
        context.moveTo(half, 0);
        context.lineTo(size + half, size);
        context.stroke();
        break;
      case 5:
        context.fillRect(0, half, size, 1);
        context.fillRect(half, 0, 1, size);
        break;
      case 6:
        context.beginPath();
        context.arc(half, half, 1.5, 0, Math.PI * 2);
        context.fill();
        break;
      case 7:
        context.fillRect(0, 0, half, half);
        context.fillRect(half, half, half, half);
        break;
      default:
        break;
    }
    return context.createPattern(tile, 'repeat') ?? background;
  }

  private chartStyleOptions(palette: string[]): ChartStyleOptions {
    const computed = this.computedStyle();
    const authoredFillColors = palette.map(
      (_, index) => index < 6 && !!computed.getPropertyValue(`--fill-color-${index + 1}`).trim(),
    );
    const borderColors = palette.map((fallback, index) =>
      index < 6 ? this.styleColor(`--border-color-${index + 1}`, fallback) : fallback,
    );
    const fillColors = palette.map((fallback, index) =>
      index < 6 ? this.styleColor(`--fill-color-${index + 1}`, fallback) : fallback,
    );
    return {
      borderColors,
      fillColors,
      authoredFillColors,
      borderRadius: this.styleNumber('--border-radius', '--lr-radius', 6),
      borderWidth: this.styleNumber('--border-width', '--lr-border-width-thin', 1),
      gridBorderWidth: this.styleNumber('--grid-border-width', '--lr-border-width-thin', 1),
      lineBorderWidth: this.styleNumber('--line-border-width', '--lr-border-width-medium', 2),
      pointRadius: this.styleNumber('--point-radius', '--lr-space-2xs', 4),
      forcedColors: forcedColorsActive(this.ownerWindow),
    };
  }

  /** Whether this chart wants the optional `chartjs-plugin-datalabels` peer loaded — either to draw
   *  per-point data labels or per-stack totals. */
  private get needsDataLabels(): boolean {
    return this.dataLabels || this.stackTotals;
  }

  /**
   * `options.plugins.datalabels`. Always emitted so the chart also stays inert if
   * a consumer independently registers the peer globally — returns `{ display: false }`
   * unless `data-labels`/`stack-totals` is set. The label
   * color is resolved via `getComputedStyle` (the same `themeColors()` tick
   * color) because Chart.js paints to canvas and cannot read `var()`.
   *
   * `stackTotals` draws once per category: the plugin fires per (dataset, point),
   * so a total is shown only on the topmost stacked dataset of each axis and its
   * formatter returns the null-aware `computeStackTotals()` value (blank when the
   * whole category is null). When only `dataLabels` is set, each point shows its
   * own value; a null/non-finite point renders blank.
   */
  private datalabelsOptions(
    theme: ThemeColors,
    effectiveType: EffectiveChartType,
  ): Record<string, unknown> {
    if (!this.needsDataLabels) return { display: false };
    const datasets = this.effectiveData().datasets;
    const stackTotalsActive =
      this.stackTotals && this.stacked && (effectiveType === 'bar' || effectiveType === 'line');
    // The topmost dataset per axis carries the stack total (drawn above the stack).
    const topDatasetIndexByAxis = new Map<'y' | 'y2', number>();
    if (stackTotalsActive) {
      datasets.forEach((dataset, index) =>
        topDatasetIndexByAxis.set(dataset.yAxisID === 'y2' || dataset.axis === 'y2' ? 'y2' : 'y', index),
      );
    }
    const totalsByAxis = stackTotalsActive
      ? { y: this.computeStackTotals('y'), y2: this.computeStackTotals('y2') }
      : undefined;
    return {
      color: theme.tick,
      // Totals sit above the stack; plain point labels center on the point.
      align: stackTotalsActive ? 'end' : 'center',
      anchor: stackTotalsActive ? 'end' : 'center',
      display: (context: DataLabelsContext): boolean => {
        const datasetIndex: number = context.datasetIndex;
        const dataset = datasets[datasetIndex];
        const axis: 'y' | 'y2' =
          dataset?.yAxisID === 'y2' || dataset?.axis === 'y2' ? 'y2' : 'y';
        if (stackTotalsActive) {
          // Only the topmost dataset of each axis draws, and only where the
          // category total is non-null.
          if (topDatasetIndexByAxis.get(axis) !== datasetIndex) return this.dataLabels;
          const total = totalsByAxis?.[axis][context.dataIndex];
          if (total == null) return this.dataLabels;
          return true;
        }
        return this.dataLabels;
      },
      formatter: (value: unknown, context: DataLabelsContext): string => {
        const datasetIndex: number = context.datasetIndex;
        const dataset = datasets[datasetIndex];
        const axis: 'y' | 'y2' =
          dataset?.yAxisID === 'y2' || dataset?.axis === 'y2' ? 'y2' : 'y';
        if (stackTotalsActive && topDatasetIndexByAxis.get(axis) === datasetIndex) {
          const total = totalsByAxis?.[axis][context.dataIndex];
          if (total != null) return this.formatDataLabel(total);
        }
        const numeric = typeof value === 'number' ? value : Number((value as { y?: number })?.y ?? value);
        if (numeric == null || !Number.isFinite(numeric)) return '';
        return this.formatDataLabel(numeric);
      },
    };
  }

  /** Locale/format a data-label number through the same `valueFormatter` the axis/tooltip use, so a
   *  drawn label matches the rest of the chart; falls back to a plain locale string. The formatter
   *  runs in the `'tooltip'` context — the closest semantic match to an on-point value label, so a
   *  consumer formatter that branches on context behaves predictably rather than seeing `undefined`. */
  private formatDataLabel(value: number): string {
    if (this.valueFormatter) {
      const formatted = this.valueFormatter(value, 'tooltip');
      if (formatted != null) return String(formatted);
    }
    return value.toLocaleString(this.effectiveLocale);
  }

  /**
   * Per-category stack totals for the datasets on axis `axisId` (`'y'`/`'y2'`),
   * or `null` for a category whose every value is null/undefined (so no total
   * is drawn there rather than a misleading `0`). Reads the same per-point
   * values as the sr-only data table, null-aware — canvas draws these via the
   * datalabels plugin, but the numbers themselves stay screen-reader available
   * through `renderDataTable()`.
   */
  private computeStackTotals(axisId: 'y' | 'y2' = 'y'): (number | null)[] {
    const effective = this.effectiveData();
    const members = effective.datasets.filter(
      (dataset) =>
        (dataset.yAxisID === 'y2' || dataset.axis === 'y2' ? 'y2' : 'y') === axisId,
    );
    const categoryCount = members.reduce(
      (max, dataset) => Math.max(max, this.datasetValues(dataset).length),
      effective.labels.length,
    );
    const totals: (number | null)[] = [];
    for (let i = 0; i < categoryCount; i++) {
      let sum = 0;
      let any = false;
      for (const dataset of members) {
        const value = this.datasetValues(dataset)[i];
        const numeric = isChartPoint(value) ? value.y : value;
        if (numeric == null || !Number.isFinite(numeric)) continue;
        sum = finiteAdd(sum, numeric as number);
        any = true;
      }
      totals.push(any ? sum : null);
    }
    return totals;
  }

  /**
   * Resolves the categorical series palette (`--lr-color-chart-1..8`, declared in
   * `internal/specialist-tokens.styles.ts` as indirections through
   * `--lr-theme-color-chart-1..8`, with their own dark-theme ramp) via `getComputedStyle` —
   * same canvas-can't-read-`var()` constraint as `themeColors()`, and the same source
   * `<lr-lite-chart>` draws its default palette from. Feeds `seriesToDataset()` a concrete,
   * theme-aware default color for any series that sets no `color` of its own. Falls back to
   * the light-mode literals only if the custom properties can't be resolved (host detached).
   *
   * Public so app code can color its own chart-adjacent UI (legends, KPI tiles, annotations
   * fed through the raw `config` passthrough) from the same resolved ramp the chart itself
   * uses, instead of hand-resolving `--lr-color-chart-N` and drifting out of sync with the
   * active theme. Returns a fresh array on every call — mutating it does not affect the chart.
   */
  seriesPalette(): string[] {
    return seriesPalette(this);
  }

  private tickOptions(
    theme: ThemeColors,
    kind: 'category' | 'value' = 'value',
  ): Record<string, unknown> {
    return {
      color: theme.tick,
      ...(this.valueFormatter && kind === 'value'
        ? { callback: (value: unknown) => this.formatValue(value, 'tick') }
        : {}),
    };
  }

  private effectiveIndexAxis(): LyraChartIndexAxis {
    return this.horizontal || this.indexAxis === 'y' ? 'y' : 'x';
  }

  private scaleBounds(): { min?: number; max?: number } {
    const min = this.min !== null && Number.isFinite(this.min) ? finiteNumber(this.min, 0) : undefined;
    const max = this.max !== null && Number.isFinite(this.max) ? finiteNumber(this.max, 0) : undefined;
    return {
      ...(min !== undefined ? { min } : {}),
      ...(max !== undefined ? { max } : {}),
    };
  }

  private gridAxisVisible(axis: LyraChartIndexAxis): boolean {
    return this.grid === 'both' || this.grid === axis;
  }

  /**
   * Builds `options.scales` for the effective chart type: no scale at all for
   * pie/doughnut (a proportional-area chart has no axis), the single radial
   * `r` scale Chart.js v4 uses for radar/polarArea, and the cartesian
   * `x`/`y`(/`y2`) block for every other (line/bar/scatter/bubble) type — with
   * `x` itself further split within that block: scatter and bubble datasets
   * carry raw numeric `{x, y(, r)}` points (via `Series.points`) and need a
   * linear `x` scale, while line/bar plot against `labels` and need the
   * default categorical one. `theme` (from `themeColors()`) drives every
   * scale's `ticks.color`/`grid.color`/axis `title.color` so grid lines and
   * labels retheme instead of sitting at Chart.js's own hardcoded defaults.
   */
  private buildScales(
    effectiveType: EffectiveChartType,
    theme: ThemeColors,
    chartStyle: ChartStyleOptions,
  ): Record<string, unknown> {
    if (effectiveType === 'pie' || effectiveType === 'doughnut') return {};

    if (effectiveType === 'radar' || effectiveType === 'polarArea') {
      return {
        r: {
          beginAtZero: this.beginAtZero,
          ...this.scaleBounds(),
          ticks: { ...this.tickOptions(theme), showLabelBackdrop: false },
          grid: {
            color: theme.grid,
            display: this.gridAxisVisible('y'),
            lineWidth: chartStyle.gridBorderWidth,
          },
          border: { width: chartStyle.gridBorderWidth },
          angleLines: {
            color: theme.grid,
            display: this.gridAxisVisible('x'),
            lineWidth: chartStyle.gridBorderWidth,
          },
          pointLabels: { color: theme.tick },
        },
      };
    }

    const hasY2 = this.effectiveData().datasets.some(
      (dataset) => dataset.yAxisID === 'y2' || dataset.axis === 'y2',
    );
    const rtl = this.effectiveDirection === 'rtl';
    // `stacked` only applies to bar/line-family charts sharing a categorical
    // axis, per the design spec — scatter/bubble's linear x scale and the
    // radial r scale above are out of scope.
    const stacked = this.stacked && (effectiveType === 'bar' || effectiveType === 'line');
    const horizontalCategorical =
      (effectiveType === 'bar' || effectiveType === 'line') && this.effectiveIndexAxis() === 'y';
    const pointChart = effectiveType === 'scatter' || effectiveType === 'bubble';
    const xKind: 'category' | 'value' = pointChart || horizontalCategorical ? 'value' : 'category';
    const yKind: 'category' | 'value' = horizontalCategorical ? 'category' : 'value';
    const valueAxis =
      horizontalCategorical ? 'x' : 'y';
    const bounds = this.scaleBounds();
    return {
      x: {
        type: xKind === 'value' ? 'linear' : 'category',
        beginAtZero: xKind === 'value' ? this.beginAtZero : undefined,
        ...(valueAxis === 'x' ? bounds : {}),
        title: { display: !!this.xLabel, text: this.xLabel, color: theme.tick },
        ticks: this.tickOptions(theme, xKind),
        grid: {
          color: theme.grid,
          display: this.gridAxisVisible('x'),
          lineWidth: chartStyle.gridBorderWidth,
        },
        border: { width: chartStyle.gridBorderWidth },
        stacked,
      },
      y: {
        type: yKind === 'value' ? 'linear' : 'category',
        position: rtl ? 'right' : 'left',
        beginAtZero: yKind === 'value' ? this.beginAtZero : undefined,
        ...(valueAxis === 'y' ? bounds : {}),
        title: { display: !!this.yLabel, text: this.yLabel, color: theme.tick },
        ticks: this.tickOptions(theme, yKind),
        grid: {
          color: theme.grid,
          display: this.gridAxisVisible('y'),
          lineWidth: chartStyle.gridBorderWidth,
        },
        border: { width: chartStyle.gridBorderWidth },
        stacked,
      },
      ...(hasY2
        ? {
            y2: {
              position: rtl ? 'left' : 'right',
              ...(valueAxis === 'y' ? bounds : {}),
              grid: {
                drawOnChartArea: false,
                color: theme.grid,
                display: this.gridAxisVisible('y'),
                lineWidth: chartStyle.gridBorderWidth,
              },
              border: { width: chartStyle.gridBorderWidth },
              title: { display: !!this.y2Label, text: this.y2Label, color: theme.tick },
              ticks: this.tickOptions(theme),
              stacked,
            },
          }
        : {}),
    };
  }

  /**
   * `options.onClick` handler wired in `buildConfig()`. The chart-wide
   * `interaction` mode above (`'index'`/`'nearest'`, `intersect: false`) is
   * tuned for hover tooltips — resolving which single point/segment was
   * actually clicked needs its own `getElementsAtEventForMode('nearest', {
   * intersect: true }, true)` lookup instead, so a click landing off any
   * point/segment reports nothing (`elements` empty) rather than firing for
   * whatever's nearest. Covers the per-bar/per-segment click ask for any
   * chart type (bar/line/pie/doughnut/etc.), not just bars.
   */
  private handlePointClick(event: unknown, chart: RuntimeChart): void {
    // Chart.js's own `onClick` handler hands us its `ChartEvent` wrapper, but
    // `getElementsAtEventForMode()`'s .d.ts (inaccurately) types its first
    // param as a DOM `Event` — at runtime Chart.js only reads `.x`/`.y` off
    // whatever is passed (see chart.js/src/helpers/helpers.dom.ts
    // `getRelativePosition()`), which `ChartEvent` already has, so the cast
    // here is a type-only correction, not a behavior change.
    const elements = chart.getElementsAtEventForMode(
      event as unknown as Event,
      'nearest',
      { intersect: true },
      true,
    );
    const hit = elements[0];
    if (!hit) return;
    const { datasetIndex, index } = hit;
    const value = chart.data.datasets[datasetIndex]?.data?.[index] ?? null;
    const label = isChartPoint(value) && value.label !== undefined
      ? value.label
      : labelText(chart.data.labels?.[index]) || undefined;
    this.activateDatum({ datasetIndex, index, label, value });
  }

  private chartDatums(): ChartDatum[] {
    const chartData = this.chart?.data;
    const labels = (chartData?.labels as unknown[] | undefined) ?? this.labels;
    const datasets =
      chartData?.datasets ??
      this.datasets.map((series) => ({ data: series.points ?? series.data ?? [] }));
    // The keyboard alternative shares the table's bounded planner. Do not spread or scan a
    // consumer-provided dataset list before sampling: either can turn an otherwise bounded
    // accessible path into an argument-limit failure or O(all input) pass.
    let rowCount = labels.length;
    for (const dataset of datasets) {
      rowCount = Math.max(rowCount, (dataset.data as unknown[] | undefined)?.length ?? 0);
    }
    const sample = sampleChartTableIndexes(rowCount, datasets.length);
    const datums: ChartDatum[] = [];
    sample.seriesIndexes.forEach((datasetIndex) => {
      const dataset = datasets[datasetIndex];
      if (!dataset) return;
      const values = (dataset.data as unknown[] | undefined) ?? [];
      sample.rowIndexes.forEach((index) => {
        const value = values[index];
        if (value == null) return;
        if (typeof value === 'number' && !Number.isFinite(value)) return;
        datums.push({
          datasetIndex,
          index,
          label: isChartPoint(value) && value.label !== undefined
            ? value.label
            : labelText(labels[index]) || undefined,
          value,
        });
      });
    });
    return datums;
  }

  private datumDisplayValue(value: unknown): string {
    if (isChartPoint(value)) {
      const numberFormat = getNumberFormat(this.effectiveLocale);
      const coordinates = [
        `x=${numberFormat.format(value.x)}`,
        `y=${numberFormat.format(value.y)}`,
        ...(value.r == null ? [] : [`r=${numberFormat.format(value.r)}`]),
      ].join(', ');
      return value.label ? `${value.label} (${coordinates})` : coordinates;
    }
    const numeric =
      typeof value === 'number'
        ? value
        : typeof value === 'object' && value !== null
          ? Number((value as { y?: unknown; r?: unknown; x?: unknown }).y ??
              (value as { r?: unknown }).r ??
              (value as { x?: unknown }).x)
          : Number(value);
    return Number.isFinite(numeric) ? getNumberFormat(this.effectiveLocale).format(numeric) : String(value);
  }

  private datumAnnouncement(datum: ChartDatum, position: number, total: number): string {
    const series =
      String(this.chart?.data?.datasets?.[datum.datasetIndex]?.label ?? this.datasets[datum.datasetIndex]?.label) ||
      this.localize('chartSeriesLabel');
    return this.localize('liteChartMarkSummary', undefined, {
      series,
      label:
        datum.label ??
        this.localize('chartPointLabel', undefined, {
          n: getNumberFormat(this.effectiveLocale).format(datum.index + 1),
        }),
      value: this.datumDisplayValue(datum.value),
      index: getNumberFormat(this.effectiveLocale).format(position + 1),
      total: getNumberFormat(this.effectiveLocale).format(total),
    });
  }

  private activateDatum(datum: ChartDatum): void {
    const datums = this.chartDatums();
    const position = datums.findIndex(
      (candidate) =>
        candidate.datasetIndex === datum.datasetIndex && candidate.index === datum.index,
    );
    if (position >= 0) {
      this.keyboardDatumIndex = position;
      this.keyboardDatumAnnouncement = this.datumAnnouncement(datum, position, datums.length);
    }
    this.emit('lr-point-click', datum);
  }

  private onCanvasFocus(): void {
    const datums = this.chartDatums();
    if (!datums.length) return;
    this.keyboardDatumIndex = Math.min(this.keyboardDatumIndex, datums.length - 1);
    this.keyboardDatumAnnouncement = this.datumAnnouncement(
      datums[this.keyboardDatumIndex]!,
      this.keyboardDatumIndex,
      datums.length,
    );
  }

  private onCanvasKeyDown(event: KeyboardEvent): void {
    const datums = this.chartDatums();
    if (!datums.length) return;
    this.keyboardDatumIndex = Math.min(this.keyboardDatumIndex, datums.length - 1);
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.activateDatum(datums[this.keyboardDatumIndex]!);
      return;
    }
    const rtl = this.effectiveDirection === 'rtl';
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backward = rtl ? 'ArrowRight' : 'ArrowLeft';
    let next = this.keyboardDatumIndex;
    if (event.key === forward || event.key === 'ArrowDown') next = Math.min(datums.length - 1, next + 1);
    else if (event.key === backward || event.key === 'ArrowUp') next = Math.max(0, next - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = datums.length - 1;
    else return;
    event.preventDefault();
    this.keyboardDatumIndex = next;
    this.keyboardDatumAnnouncement = this.datumAnnouncement(datums[next]!, next, datums.length);
  }

  /**
   * `config.type` (if set) overrides the attribute `type` post-merge — this
   * is the one place that resolution logic lives, shared by `buildConfig()`
   * (which needs it to build scales/interaction for the right type) and
   * `willUpdate()` (which needs it to detect a type change against the last
   * *actually built* type, `this.builtType`, before the render pass that
   * would rebuild the `Chart` instance).
   */
  private effectiveType(): EffectiveChartType {
    const config = this.effectiveConfig();
    return (
      (config?.type as EffectiveChartType | undefined) ?? normalizeChartType(this.type)
    );
  }

  /** Localized chart-type name for `chartDescription()`'s sr-only summary. `effectiveType()` can
   *  return a raw Chart.js type string a consumer set through the `config` passthrough (including a
   *  custom registered controller name beyond this library's own `LyraChartType` union) -- that's
   *  caller-supplied data, not library copy, so it passes through untranslated rather than through
   *  `localize()`, matching every other known type's localized label. */
  private localizedChartType(): string {
    const type = this.effectiveType();
    const key = CHART_TYPE_MESSAGE_KEYS[type as LyraChartType];
    return key ? this.localize(key) : String(type);
  }

  private formatValue(value: unknown, context: LyraChartValueFormatterContext): string | unknown {
    const numeric = typeof value === 'number' ? value : Number(value);
    return this.valueFormatter && Number.isFinite(numeric) ? this.valueFormatter(numeric, context) : value;
  }

  private legendValue(item: ChartLegendItem, chart: RuntimeChart): number | undefined {
    const datasetIndex = item.datasetIndex;
    if (datasetIndex === undefined) return undefined;
    const data = chart.data.datasets?.[datasetIndex]?.data;
    if (!data) return undefined;
    const indexed =
      typeof item.index === 'number' && Number.isInteger(item.index)
        ? Number(data[item.index])
        : NaN;
    if (Number.isFinite(indexed)) return indexed;
    let sum = 0;
    let hasValue = false;
    for (const datum of data) {
      const value = Number(datum);
      if (!Number.isFinite(value)) continue;
      sum = finiteAdd(sum, value);
      hasValue = true;
    }
    return hasValue ? sum : undefined;
  }

  private legendLabels(chart: RuntimeChart): ChartLegendItem[] {
    const generateLabels = this.chartJsModule?.defaults?.plugins?.legend?.labels?.generateLabels;
    const labels =
      (generateLabels && chart.legend && chart.options
        ? (generateLabels(chart as never) as ChartLegendItem[])
        : undefined) ??
      (chart.data.datasets ?? []).map(
      (dataset, index) => ({
        text: labelText(dataset.label) || String(index + 1),
        datasetIndex: index,
      }),
      );
    return labels.map((item) => {
      const value = this.legendValue(item, chart);
      const formatted = this.formatValue(value, 'legend');
      return formatted === value || formatted === undefined
        ? item
        : {
            ...item,
            text: this.localize('chartValueLabel', undefined, {
              label: String(item.text),
              value: String(formatted),
            }),
          };
    });
  }

  private tooltipLabel(context: ChartTooltipContext): string | undefined {
    const parsed = context.parsed;
    const rawValue = isPlainObject(parsed)
      ? parsed['y'] ?? parsed['r'] ?? parsed['x']
      : parsed ?? context.raw;
    const formatted = this.formatValue(rawValue, 'tooltip');
    if (formatted === rawValue || formatted === undefined) return undefined;
    return context.dataset?.label
      ? this.localize('chartValueLabel', undefined, {
          label: String(context.dataset.label),
          value: String(formatted),
        })
      : String(formatted);
  }

  private updateAutoLegendPosition(): boolean {
    const width = this.getBoundingClientRect().width || this.clientWidth;
    const next: 'right' | 'bottom' = width > 0 && width < 480 ? 'bottom' : 'right';
    if (next === this.autoLegendPosition) return false;
    this.autoLegendPosition = next;
    return true;
  }

  private legendPositionForConfig(): LyraChartLayoutPosition {
    if (this.legendPosition === 'auto') return this.autoLegendPosition;
    if (this.legendPosition === 'start') {
      return this.effectiveDirection === 'rtl' ? 'right' : 'left';
    }
    if (this.legendPosition === 'end') {
      return this.effectiveDirection === 'rtl' ? 'left' : 'right';
    }
    return this.legendPosition;
  }

  private legendPositionForLayout(): 'top' | 'right' | 'bottom' | 'left' {
    const position = this.legendPositionForConfig();
    return position === 'top' || position === 'right' || position === 'left' ? position : 'bottom';
  }

  private updateChartArea(chart: RuntimeChart | undefined = this.chart): void {
    const area = chart?.chartArea;
    if (!area) return;
    const next: LyraChartArea = {
      top: Number(area.top),
      left: Number(area.left),
      right: Number(area.right),
      bottom: Number(area.bottom),
      width: Number(area.width),
      height: Number(area.height),
    };
    if (Object.values(next).some((value) => !Number.isFinite(value))) return;
    const previous = this.resolvedChartArea;
    if (
      previous &&
      Object.keys(next).every(
        (key) => previous[key as keyof LyraChartArea] === next[key as keyof LyraChartArea],
      )
    ) {
      return;
    }
    this.resolvedChartArea = next;
    if (!this.chartAreaUpdateQueued) {
      this.chartAreaUpdateQueued = true;
      queueMicrotask(() => {
        this.chartAreaUpdateQueued = false;
        if (this.isConnected) this.requestUpdate();
      });
    }
  }

  /** The current Chart.js chart-area geometry in canvas-local coordinates. */
  get chartArea(): LyraChartArea | undefined {
    return this.resolvedChartArea;
  }

  private buildConfig(): RuntimeChartConfiguration {
    const theme = this.themeColors();
    // Resolve the effective type up front: `config.type` (if set) overrides
    // the attribute `type` post-merge, so scales/interaction must be built
    // for *that* type, not `this.type` — otherwise a config.type override
    // (e.g. line -> radar) ships with the wrong axis shape (categorical x/y
    // instead of a radial r scale).
    const effectiveType = this.effectiveType();
    const palette = this.seriesPalette();
    const chartStyle = this.chartStyleOptions(palette);
    const generated: RuntimeChartConfiguration = {
      type: effectiveType,
      data: {
        labels: this.labels,
        datasets: this.datasets.map((s, i) =>
          this.seriesToDataset(s, i, palette, effectiveType, chartStyle),
        ),
      },
      // `chartjs-plugin-datalabels` is registered PER-INSTANCE (only on charts
      // that need it) rather than globally, because a global registration draws
      // on — and breaks the next update of — every other chart on the page.
      // Only added when the peer has actually loaded and the feature is on.
      ...((this.plugins.length || (this.needsDataLabels && this.dataLabelsPlugin))
        ? {
            plugins: [
              ...this.plugins,
              ...(this.needsDataLabels && this.dataLabelsPlugin ? [this.dataLabelsPlugin] : []),
            ],
          }
        : {}),
      options: {
        locale: this.effectiveLocale,
        responsive: true,
        maintainAspectRatio: false,
        // Chart.js's own mechanism for horizontal bars (also flips line/area
        // types onto a horizontal category axis).
        indexAxis: this.effectiveIndexAxis(),
        // Chart.js's own default ~1000ms draw-in animation only ever fires
        // from `new Chart()` (chart/type-change construction) — every
        // in-place update in `draw()` already passes `'none'` to
        // `Chart#update()`. A CSS media query can't reach that
        // canvas-internal animation loop, so `prefersReducedMotion()` is
        // checked here instead and fed into `options.animation`.
        animation: this.withoutAnimation || prefersReducedMotion(this.ownerWindow) ? false : undefined,
        interaction: { intersect: false, mode: effectiveType === 'scatter' ? 'nearest' : 'index' },
        onClick: (event: unknown, _elements: unknown, chart: RuntimeChart) =>
          this.handlePointClick(event, chart),
        plugins: {
          legend: {
            // A canvas legend cannot wrap one long public label; the DOM legend rendered below
            // preserves the full text, normal-flow containment, keyboard access, and toggling.
            display: false,
            position: this.legendPositionForConfig(),
            labels: {
              color: theme.legend,
              ...(this.valueFormatter
                ? { generateLabels: (chart: RuntimeChart) => this.legendLabels(chart) }
                : {}),
            },
          },
          tooltip: {
            enabled: !this.withoutTooltip,
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            ...(this.valueFormatter ? { label: (context: ChartTooltipContext) => this.tooltipLabel(context) } : {}),
            // Chart.js's tooltip plugin has no per-dataset `tooltip.enabled`
            // — `Series.noTooltip` is implemented here instead, via the one
            // mechanism the core tooltip plugin actually reads.
            filter: (item: ChartTooltipContext) =>
              !this.effectiveData().datasets[item.datasetIndex]?.noTooltip,
          },
          zoom: this.zoom && this.zoomFeatureState !== 'unavailable'
            ? {
                pan: { enabled: false },
                zoom: {
                  wheel: { enabled: true },
                  drag: { enabled: true },
                  pinch: { enabled: true },
                  mode: 'x',
                  onZoomComplete: () => {
                    if (this.suppressZoomComplete) return;
                    this.zoomed = true;
                    this.emit('lr-zoom', { zoomed: true });
                  },
                },
                limits: { x: { min: 'original', max: 'original' } },
              }
            : undefined,
          // `chartjs-plugin-datalabels`, once attached to a chart, draws on EVERY
          // dataset by default. This options block is ALWAYS present and defaults
          // `display: false` so that even a chart the plugin somehow reaches
          // (e.g. a consumer registering it globally themselves) stays inert
          // unless `data-labels`/`stack-totals` is set. This library attaches the
          // plugin per-instance (the `plugins` array above), never globally.
          datalabels: this.datalabelsOptions(theme, effectiveType),
        },
        onResize: (chart: RuntimeChart) => this.updateChartArea(chart),
        scales: this.buildScales(effectiveType, theme, chartStyle),
      },
    };

    const effectiveConfig = this.effectiveConfig();
    if (!effectiveConfig) return generated;

    // Raw Chart.js passthrough (mirrors `wa-chart`'s `config` property) —
    // deep-merge `config` over the `Series`-derived config at every nesting
    // level (see `deepMerge` above), letting consumers override or extend a
    // single nested key (e.g. `config.options.scales.y.min`) without
    // clobbering the rest of the generated sibling object.
    const merged = deepMerge(generated, effectiveConfig);
    // `deepMerge` replaces arrays wholesale, so a consumer `config.plugins`
    // would drop the per-instance data-labels plugin the generated config added
    // (silently disabling `data-labels`/`stack-totals`). Concatenate it back —
    // the consumer's inline plugins AND the built-in data-labels plugin both run.
    const requiredPlugins = [
      ...this.plugins,
      ...(this.needsDataLabels && this.dataLabelsPlugin ? [this.dataLabelsPlugin] : []),
    ];
    if (requiredPlugins.length) {
      const mergedPlugins = Array.isArray(merged.plugins) ? merged.plugins : [];
      merged.plugins = [
        ...mergedPlugins,
        ...requiredPlugins.filter((plugin) => !mergedPlugins.includes(plugin)),
      ];
    }
    return merged;
  }

  private draw(): void {
    if (!this.chartJsModule || !this.canvasEl) return;
    const config = this.buildConfig();
    const effectiveType = config.type;
    const nextPlugins = Array.isArray(config.plugins) ? config.plugins : [];
    const samePlugins =
      nextPlugins.length === this.builtPlugins.length &&
      nextPlugins.every((plugin, index) => plugin === this.builtPlugins[index]);
    if (this.chart && this.builtType === effectiveType && samePlugins) {
      this.chart.data = config.data;
      this.chart.options = config.options ?? {};
      // Visibility is public controlled state rather than a private Chart.js metadata snapshot.
      // Applying it after the full data replacement preserves an accepted legend choice across
      // rebuilds, while `undefined` deliberately clears metadata and resumes each dataset's own
      // configured `hidden` default.
      this.applyDatasetVisibility();
      this.chart.update('none');
      this.updateChartArea(this.chart);
      return;
    }
    this.chart?.destroy();
    this.chart = new this.chartJsModule.Chart(
      this.canvasEl,
      config as never,
    ) as unknown as RuntimeChart;
    this.builtType = effectiveType;
    this.builtPlugins = [...nextPlugins];
    // A new Chart already reads configured `dataset.hidden` values. Apply and redraw only when a
    // public controlled snapshot is present; this also avoids a redundant first update for the
    // ordinary uncontrolled construction path.
    if (this.hiddenDatasets !== undefined) {
      this.applyDatasetVisibility();
      this.chart.update('none');
    }
    this.updateChartArea(this.chart);
  }

  private drawIfVisible(): void {
    if (!this.isConnected || !this.visible) return;
    this.draw();
  }

  /** Reset any active zoom/pan back to the original view. */
  resetZoom(): void {
    this.suppressZoomComplete = true;
    try {
      (this.chart as unknown as { resetZoom?: () => void })?.resetZoom?.();
    } finally {
      this.suppressZoomComplete = false;
    }
    this.zoomed = false;
    this.emit('lr-zoom', { zoomed: false });
  }

  /**
   * Forces a redraw so `themeColors()` re-reads the `--lr-chart-*` custom
   * properties from the current computed style. A {@link ThemeWatcher} now
   * calls this automatically when `prefers-color-scheme` flips or an ancestor's
   * `class`/`style`/`data-theme`/`data-color-scheme` attribute mutates, so a
   * consumer flipping an upstream theme attribute no longer has to. It remains
   * public as the manual escape hatch for theme changes those signals can't
   * observe (e.g. a same-attribute value swap the observer already covers is
   * handled, but a fully out-of-band restyle is not).
   */
  refreshTheme(): void {
    this.drawIfVisible();
    // The wrapping DOM legend carries a concrete, computed swatch color too; refresh its
    // template without turning the resulting empty-property update into another canvas draw.
    if (this.showsLegend) this.requestUpdate();
  }

  /** Aggregates a numeric series without materializing a second unbounded values array. */
  private summarizeSeries(dataset: LyraChartDatasetConfiguration): {
    count: number;
    first: number;
    last: number;
    min: number;
    max: number;
  } | undefined {
    let count = 0;
    let first = 0;
    let last = 0;
    let min = 0;
    let max = 0;
    for (const datum of this.datasetValues(dataset)) {
      const value = isChartPoint(datum) ? datum.y : datum;
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      if (count === 0) {
        first = value;
        min = value;
        max = value;
      }
      last = value;
      min = Math.min(min, value);
      max = Math.max(max, value);
      count++;
    }
    return count ? { count, first, last, min, max } : undefined;
  }

  private formatSummaryValue(value: number): string {
    return getNumberFormat(this.effectiveLocale).format(value);
  }

  private formatTableValue(value: number): string {
    return this.valueFormatter?.(value, 'table') ?? this.formatSummaryValue(value);
  }

  private tableStackAxes(): ('y' | 'y2')[] {
    const type = this.effectiveType();
    if (!this.stackTotals || !this.stacked || (type !== 'bar' && type !== 'line')) return [];
    const present = new Set<'y' | 'y2'>();
    for (const dataset of this.effectiveData().datasets) {
      present.add(dataset.yAxisID === 'y2' || dataset.axis === 'y2' ? 'y2' : 'y');
    }
    return (['y', 'y2'] as const).filter((axis) => present.has(axis));
  }

  private tableStackTotalLabel(axis: 'y' | 'y2', axisCount: number): string {
    if (axisCount === 1) return this.localize('chartTotal');
    const axisLabel =
      axis === 'y2'
        ? this.y2Label || this.localize('chartSecondaryAxis')
        : this.yLabel || this.localize('chartPrimaryAxis');
    return this.localize('chartAxisTotal', undefined, { axis: axisLabel });
  }

  private accessibleName(fallback: string): string {
    return this.getAttribute('aria-label') || this.label || this.accessibleLabel || fallback;
  }

  private chartDescription(): string {
    if (this.description) return this.description;
    if (this.accessibleDescription) return this.accessibleDescription;
    const effective = this.effectiveData();
    const sample = this.dataTableSample(effective);
    const includePointDetails = !this.hasCustomDataTable();
    const summaries = sample.seriesIndexes.map((index) => {
      const dataset = effective.datasets[index]!;
      const seriesLabel = this.datasetLabel(dataset, index);
      const values = this.summarizeSeries(dataset);
      if (!values) return this.localize('chartSeriesNoData', undefined, { label: seriesLabel });
      const trend =
        values.last > values.first
          ? this.localize('chartTrendIncreasing')
          : values.last < values.first
            ? this.localize('chartTrendDecreasing')
            : this.localize('chartTrendFlat');
      const summary = this.localize('chartSummary', undefined, {
        label: seriesLabel,
        count: this.formatSummaryValue(values.count),
        min: this.formatSummaryValue(values.min),
        max: this.formatSummaryValue(values.max),
        trend,
      });
      const rawValues = this.datasetValues(dataset);
      const pointDetails = includePointDetails
        ? sample.rowIndexes.flatMap((rowIndex) => {
            const point = rawValues[rowIndex];
            return isChartPoint(point) ? [this.datumDisplayValue(point)] : [];
          })
        : [];
      return pointDetails.length
        ? [summary, ...pointDetails].join(this.localize('chartSummarySeparator'))
        : summary;
    });
    return summaries.length
      ? this.localize('chartSummaryWithData', undefined, {
          type: this.localizedChartType(),
          // the sentence separator is a message of its own since not every
          // language delimits sentences with a period-space pair
          summaries: summaries.join(this.localize('chartSummarySeparator')),
        })
      : this.localize('chartSummaryEmpty', undefined, { type: this.localizedChartType() });
  }

  private dataTableSample(effective = this.effectiveData()) {
    // Do not spread an unbounded consumer-provided dataset list into Math.max():
    // the accessible alternative itself must remain usable for very wide input.
    let rowCount = effective.labels.length;
    for (const dataset of effective.datasets) {
      rowCount = Math.max(rowCount, this.datasetValues(dataset).length);
    }
    const indexes = sampleChartTableIndexes(rowCount, effective.datasets.length);
    return {
      rowCount,
      seriesCount: effective.datasets.length,
      ...indexes,
    };
  }

  private generatedDataIsSampled(): boolean {
    if (this.hasCustomDataTable()) return false;
    const sample = this.dataTableSample();
    if (sample.rowCount === 0 || sample.seriesCount === 0) return false;
    return sample.rowIndexes.length < sample.rowCount || sample.seriesIndexes.length < sample.seriesCount;
  }

  private dataTruncationMessage(): string {
    return this.generatedDataIsSampled() ? this.localize('chartDataSampled') : '';
  }

  private renderDataTable(): TemplateResult {
    const effective = this.effectiveData();
    const sample = this.dataTableSample(effective);
    const stackAxes = this.tableStackAxes();
    const stackTotals = new Map(stackAxes.map((axis) => [axis, this.computeStackTotals(axis)]));
    return html`
      <table class=${this.showDataTable ? nothing : 'sr-only'}>
        <caption>${this.accessibleName(this.localize('chartData'))}</caption>
        <thead>
          <tr>
            <th scope="col">${this.localize('chartCategory')}</th>
            ${sample.seriesIndexes.map((index) => {
              const dataset = effective.datasets[index]!;
              return html`<th scope="col">${this.datasetLabel(dataset, index)}</th>`;
            })}
            ${stackAxes.map(
              (axis) => html`<th scope="col">${this.tableStackTotalLabel(axis, stackAxes.length)}</th>`,
            )}
          </tr>
        </thead>
        <tbody>
          ${sample.rowIndexes.map((index) => html`
            <tr>
              <th scope="row">${labelText(effective.labels[index]) ||
                sample.seriesIndexes
                  .map((datasetIndex) => this.datasetValues(effective.datasets[datasetIndex]!)[index])
                  .find(isChartPoint)?.label ||
                this.localize('chartPointLabel', undefined, {
                  n: this.formatSummaryValue(index + 1),
                })}</th>
              ${sample.seriesIndexes.map((datasetIndex) => {
                const dataset = effective.datasets[datasetIndex]!;
                const datum = this.datasetValues(dataset)[index];
                const value = isChartPoint(datum) ? datum.y : datum;
                if (typeof value !== 'number' || !Number.isFinite(value)) {
                  return html`<td>${this.localize('noData')}</td>`;
                }
                const detail: ChartDatum = {
                  datasetIndex,
                  index,
                  label: isChartPoint(datum) && datum.label !== undefined
                    ? datum.label
                    : labelText(effective.labels[index]) || undefined,
                  value: datum,
                };
                return html`<td><button
                  type="button"
                  tabindex=${this.showDataTable ? '0' : '-1'}
                  @click=${() => this.activateDatum(detail)}
                >${isChartPoint(datum)
                  ? this.datumDisplayValue(datum)
                  : this.formatTableValue(value)}</button></td>`;
              })}
              ${stackAxes.map((axis) => {
                const total = stackTotals.get(axis)?.[index];
                return html`<td>${total == null
                  ? this.localize('noData')
                  : this.formatTableValue(total)}</td>`;
              })}
            </tr>
          `)}
        </tbody>
      </table>
    `;
  }

  private hasCustomDataTable(): boolean {
    return Array.from(this.children).some((child) => child.getAttribute('slot') === 'data-table');
  }

  private legendTextFor(dataset: LyraChartDatasetConfiguration, datasetIndex: number): string {
    const label = this.datasetLabel(dataset, datasetIndex);
    if (!this.valueFormatter) return label;
    const values = this.datasetValues(dataset)
      .map((value) => isChartPoint(value) ? value.y : Number(value))
      .filter(Number.isFinite);
    if (!values.length) return label;
    const value = values.reduce((sum, item) => finiteAdd(sum, item), 0);
    const formatted = this.formatValue(value, 'legend');
    return formatted === value || formatted === undefined
      ? label
      : this.localize('chartValueLabel', undefined, {
          label,
          value: String(formatted),
        });
  }

  private legendColor(dataset: LyraChartDatasetConfiguration, datasetIndex: number): string {
    const palette = this.seriesPalette();
    const fallback = palette[datasetIndex % palette.length] ?? 'transparent';
    const rawCandidate =
      dataset.backgroundColor ?? dataset.borderColor ?? dataset.color;
    const candidate = Array.isArray(rawCandidate) ? rawCandidate[0] : rawCandidate;
    return typeof candidate === 'string'
      ? resolveCanvasColor(this, candidate, fallback)
      : fallback;
  }

  private toggleDataset(datasetIndex: number): void {
    if (!this.chart) return;
    const datasetCount = this.effectiveData().datasets.length;
    if (datasetIndex < 0 || datasetIndex >= datasetCount) return;
    const hidden = this.effectiveHiddenDatasetIndexes();
    const wasHidden = hidden.includes(datasetIndex);
    const nextHidden = wasHidden
      ? hidden.filter((index) => index !== datasetIndex)
      : [...hidden, datasetIndex].sort((left, right) => left - right);
    // A currently hidden dataset becomes visible; a currently visible one becomes hidden.
    const visible = wasHidden;
    const proposed = this.emit(
      'lr-before-legend-visibility-change',
      legendVisibilityDetail(datasetIndex, visible, nextHidden),
      { cancelable: true },
    );
    if (proposed.defaultPrevented) return;
    // Materialize the full effective snapshot, including any configured-hidden peers, so an
    // accepted user choice survives Chart.js reconstruction and can be persisted by a host.
    this.hiddenDatasets = nextHidden;
    this.applyDatasetVisibility();
    this.chart.update('none');
    this.requestUpdate();
    this.emit(
      'lr-legend-visibility-change',
      legendVisibilityDetail(datasetIndex, visible, nextHidden),
    );
  }

  private legendDatasetVisible(dataset: LyraChartDatasetConfiguration, datasetIndex: number): boolean {
    const controlled = normalizeHiddenDatasets(
      this.hiddenDatasets,
      this.effectiveData().datasets.length,
    );
    if (controlled !== undefined) return !controlled.includes(datasetIndex);
    // In the uncontrolled mode, the effective data configuration is the only visibility source.
    // A Chart.js metadata mutation is deliberately not observed here: DOM legend interaction writes
    // `hiddenDatasets`, so there is no private, unobservable state to leak across render/reconnect.
    return dataset.hidden !== true;
  }

  private renderLegend(): TemplateResult | typeof nothing {
    if (!this.showsLegend) return nothing;
    const effective = this.effectiveData();
    if (!effective.datasets.length) return nothing;
    return html`
      <div
        part="legend"
        role="group"
        data-position=${this.legendPositionForLayout()}
        aria-label=${this.accessibleName(this.localize('chart'))}
      >
        ${effective.datasets.map((dataset, index) => {
          const visible = this.legendDatasetVisible(dataset, index);
          const encoding: ForcedColorEncodingName | undefined = forcedColorsActive(this.ownerWindow)
            ? FORCED_COLOR_ENCODINGS[index % FORCED_COLOR_ENCODINGS.length]!.name
            : undefined;
          return html`
            <button
              part=${visible ? 'legend-item' : 'legend-item legend-item-hidden'}
              type="button"
              aria-pressed=${visible ? 'true' : 'false'}
              @click=${() => this.toggleDataset(index)}
            >
              <span
                part="legend-swatch"
                aria-hidden="true"
                data-encoding=${encoding ?? nothing}
                style="background-color:${this.legendColor(dataset, index)}"
              ></span>
              <span>${this.legendTextFor(dataset, index)}</span>
            </button>
          `;
        })}
      </div>
    `;
  }

  override render(): TemplateResult {
    if (this.loading) {
      return html`
        <div part="base">
          <slot class="config-slot" @slotchange=${this.onConfigSlotChange}></slot>
          <span class="sr-only">${this.localize('loading')}</span>
          <lr-skeleton variant="rect" .announce=${false}></lr-skeleton>
        </div>
      `;
    }
    if (this.loadFailed) {
      return html`
        <div part="base">
          <slot class="config-slot" @slotchange=${this.onConfigSlotChange}></slot>
          <div part="error">${this.localize('chartMissingLibrary')}</div>
        </div>
      `;
    }
    const effective = this.effectiveData();
    const seriesLabels = this.dataTableSample(effective).seriesIndexes.map((index) =>
      this.datasetLabel(effective.datasets[index]!, index),
    );
    const label = this.accessibleName(
      (seriesLabels.length
        ? getListFormat(this.effectiveLocale, { type: 'conjunction' }).format(seriesLabels)
        : '') || this.localize('chart'),
    );
    const description = this.chartDescription();
    return html`
      <div
        part="base"
        data-legend-position=${this.showsLegend ? this.legendPositionForLayout() : nothing}
      >
        <slot class="config-slot" @slotchange=${this.onConfigSlotChange}></slot>
        <div part="plot">
          <canvas
            part="canvas"
            role="application"
            aria-roledescription=${this.localize('chart')}
            tabindex="0"
            aria-label=${label}
            aria-describedby=${this.descriptionId}
            @focus=${this.onCanvasFocus}
            @keydown=${this.onCanvasKeyDown}
          ></canvas>
          <div
            part="center"
            style=${styleMap(
              this.resolvedChartArea
                ? {
                    left: `${this.resolvedChartArea.left + this.resolvedChartArea.width / 2}px`,
                    top: `${this.resolvedChartArea.top + this.resolvedChartArea.height / 2}px`,
                  }
                : { left: '50%', top: '50%' },
            )}
          >
            <slot name="center"></slot>
          </div>
          ${this.zoomFeatureAvailable && this.zoomed
            ? html`<button part="reset-zoom-button" type="button" @click=${() => this.resetZoom()}>
                ${this.localize('resetZoom')}
              </button>`
            : nothing}
        </div>
        ${this.renderLegend()}
        <p part="description" id=${this.descriptionId} class="sr-only">${description}</p>
        <p class="sr-only" aria-hidden="true">${this.keyboardDatumAnnouncement}</p>
        <div part="notices">
          ${this.featureWarningMessages().map(
            (warning) => html`<p part="feature-warning">${warning}</p>`,
          )}
          ${this.dataTruncationMessage()
            ? html`<p part="data-truncation">${this.dataTruncationMessage()}</p>`
            : nothing}
        </div>
        <div part="data-table">
          <slot name="data-table" @slotchange=${() => this.requestUpdate()}></slot>
          ${this.hasCustomDataTable() ? nothing : this.renderDataTable()}
        </div>
      </div>
    `;
  }

  private get showsLegend(): boolean {
    return this.legend && !this.withoutLegend;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-chart': LyraChart;
  }
}

/**
 * Installs a read-only `type` accessor pair on a `LyraChart` subclass's
 * prototype, locking it to `value` — assigning `.type` afterwards (attribute
 * or property) is silently ignored. `LyraChart` declares `type` as a plain
 * (decorator-managed) class field, and TypeScript forbids a subclass from
 * re-declaring a base field as a getter/setter pair via ordinary class
 * syntax (TS2611), so the accessor pair is installed directly on the
 * prototype instead, which is runtime-equivalent (same shadowing semantics
 * as a class-syntax override) without tripping that check. Shared by every
 * `lr-*-chart` subclass (bar/line/pie/doughnut/scatter/bubble/radar/
 * polarArea) plus `lr-histogram`, replacing what used to be an identical
 * ~16-line `Object.defineProperty` block copy-pasted into each file.
 */
export function lockChartType(ctor: Function, value: string): void {
  Object.defineProperty(ctor.prototype, 'type', {
    configurable: true,
    enumerable: true,
    get(): string {
      return value;
    },
    set(_v: string) {
      /* locked to `value`; direct writes are ignored */
    },
  });
}
