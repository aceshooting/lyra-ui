import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { OptionalPeerApi } from '../../../internal/optional-peer-types.js';
import { nextId, srOnly } from '../../../internal/a11y.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { ThemeWatcher } from '../../../internal/theme-watcher.js';
import type { LyraMessageKey } from '../../../internal/localization.js';
import { loadChartJs, loadChartJsWithZoom, loadChartJsWithDataLabels } from './chart-loader.js';
import { styles } from './chart.styles.js';
import '../../overlays/skeleton/skeleton.class.js';
import { getListFormat, getNumberFormat } from '../../../internal/intl-cache.js';
import { escapeCsvField } from '../../utility/export-button/csv.js';
import { trueDefaultBooleanFromAttributeConverter as trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { resolveCanvasColor, seriesPalette, translucentAreaColor } from './chart-colors.js';

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

export type LyraChartLegendPosition = 'top' | 'right' | 'bottom' | 'left' | 'auto';
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
    : 'line';
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
}

interface ChartDatum {
  datasetIndex: number;
  index: number;
  label: string | undefined;
  value: unknown;
}

interface EffectiveChartData {
  labels: unknown[];
  datasets: OptionalPeerApi[];
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
 * `Partial<ChartConfiguration>` deep-merged over the generated config in
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
 * @csspart base - The chart wrapper.
 * @csspart plot - The fixed-height canvas/overlay region.
 * @csspart canvas - The Chart.js canvas.
 * @csspart legend - The wrapping DOM legend rendered when `legend` is set.
 * @csspart legend-item - A keyboard-operable series visibility toggle.
 * @csspart legend-swatch - The resolved series-color swatch in a legend item.
 * @csspart reset-zoom-button - The reset-zoom control when zoom is active.
 * @csspart description - The accessible chart summary.
 * @csspart data-table - The optional generated or slotted data table.
 * @csspart center - The chart-area-centered overlay wrapper for the `center` slot.
 * @csspart error - `role="alert"` message shown instead of `canvas` when the optional `chart.js`
 *   peer dependency is not installed.
 * @cssprop [--lr-chart-height=var(--lr-size-280px)] - The plot region's `block-size` and the
 *   host's minimum block size. A visible data table or wrapping DOM legend grows the host in
 *   normal flow instead of overlapping following content. Set on the host from `height`.
 * @cssprop [--lr-chart-grid-color=var(--lr-color-border)] - Grid-line color. Resolved via
 *   `getComputedStyle` on every draw (Chart.js paints to canvas and cannot consume `var()`).
 * @cssprop [--lr-chart-tick-color=var(--lr-color-text-quiet)] - Axis tick-label color; also used
 *   for the `xLabel`/`yLabel`/`y2Label` axis-title text (there is no separate title-color token).
 *   Resolved via `getComputedStyle` on every draw.
 * @cssprop [--lr-chart-legend-color=var(--lr-color-text)] - Legend label color. Resolved via
 *   `getComputedStyle` on every draw.
 * @cssprop [--lr-chart-tooltip-bg=var(--lr-color-surface)] - Tooltip background color. Resolved
 *   via `getComputedStyle` on every draw.
 * @cssprop [--lr-chart-tooltip-text=var(--lr-color-text)] - Tooltip text color. Resolved via
 *   `getComputedStyle` on every draw.
 * @cssprop [--lr-chart-canvas-hover-outline-width=var(--lr-border-width-thin)] - Width of the
 *   `[part='canvas']` hover-state outline (its color is `--lr-chart-grid-color`, above).
 * @slot data-table - An optional consumer-provided accessible table alternative.
 * @slot center - Optional overlay content positioned at the chart area's center. Useful for
 *   doughnut and pie totals.
 */
export class LyraChart extends LyraElement<LyraChartEventMap> {
  static override styles = [LyraElement.styles, styles, srOnly];

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
  type: LyraChartType = 'line';
  @property({ attribute: false }) labels: string[] = [];
  @property({ attribute: false }) datasets: Series[] = [];
  @property({ type: Boolean }) legend = false;
  /** Legend placement. `auto` uses a right legend above 480px and a bottom legend below it. */
  @property({ attribute: 'legend-position' }) legendPosition: LyraChartLegendPosition = 'top';
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
  @property({ attribute: 'x-label' }) xLabel = '';
  @property({ attribute: 'y-label' }) yLabel = '';
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
   * To add an inline Chart.js plugin without dropping the generated ones,
   * register it globally instead of passing it through `config.plugins`.
   *
   * When `config.data` supplies `labels` and/or `datasets`, those arrays are the effective data
   * model for canvas rendering, append mutation, CSV export, the accessible name/summary, keyboard
   * navigation/events, the DOM legend, and the fallback data table.
   */
  @property({ attribute: false }) config?: OptionalPeerApi;

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
    const override = this.config?.data;
    const merged = isPlainObject(override)
      ? deepMerge(generated, override)
      : generated;
    return {
      labels: Array.isArray(merged.labels) ? merged.labels : [],
      datasets: Array.isArray(merged.datasets)
        ? merged.datasets.filter(isPlainObject) as OptionalPeerApi[]
        : [],
    };
  }

  private hasExplicitConfigData(): boolean {
    return isPlainObject(this.config) && Object.prototype.hasOwnProperty.call(this.config, 'data');
  }

  private datasetLabel(dataset: OptionalPeerApi, index: number): string {
    return labelText(dataset.label) || this.localize('chartPointLabel', undefined, {
      n: getNumberFormat(this.effectiveLocale).format(index + 1),
    });
  }

  private datasetValues(dataset: OptionalPeerApi): unknown[] {
    return Array.isArray(dataset.data) ? dataset.data : [];
  }

  private isPointDataset(dataset: OptionalPeerApi): boolean {
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
      const currentData = isPlainObject(this.config?.data) ? this.config.data : {};
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
        this.config = { ...this.config, data: nextData };
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
   * closed into `part="error" role="alert"` rather than leaving a permanently blank canvas.
   */
  @state() private loadFailed = false;

  // Overridable instance field (not a direct `loadChartJs()` call site) purely so tests can
  // inject a stubbed loader before the element ever connects -- matches map/docx-viewer's own
  // `loadLibrary` field/rationale exactly.
  private loadLibrary: (withZoom: boolean) => ReturnType<typeof loadChartJs> = (withZoom) =>
    withZoom ? loadChartJsWithZoom() : loadChartJs();
  // Invalidates a lazy-load callback when this element disconnects/reconnects. Without a
  // generation token, two connectedCallback() calls around one in-flight import can both settle
  // against the reconnected element and construct/reconfigure the chart from stale lifecycle
  // state.
  private loadGeneration = 0;
  private zoomLoadGeneration = 0;
  private dataLabelsLoadGeneration = 0;
  // The resolved `chartjs-plugin-datalabels` plugin object, registered
  // PER-INSTANCE via this chart's own `config.plugins` (not globally — a global
  // registration would draw labels on, and break, every other chart on the
  // page). `undefined` until the peer loads (or if it's not installed).
  private dataLabelsPlugin?: OptionalPeerApi;

  @state() private zoomed = false;

  @state() private visible = true;
  private intersectionObserver?: IntersectionObserver;

  @query('canvas') private canvasEl?: HTMLCanvasElement;
  private chart?: OptionalPeerApi;
  private chartJsModule?: OptionalPeerApi;
  private resizeObserver?: ResizeObserver;
  private resizeDrawFrame?: number;
  private lastObservedInlineSize?: number;
  @state() private autoLegendPosition: Exclude<LyraChartLegendPosition, 'auto'> = 'right';
  // Chart.js computes this geometry while drawing, after Lit has rendered the
  // canvas. Keep the cache non-reactive so that draw() does not trigger a
  // second update merely by recording the overlay position.
  private resolvedChartArea?: LyraChartArea;
  private chartAreaUpdateQueued = false;
  // Tracks the *effective* Chart.js type actually passed to `new Chart()` —
  // i.e. `config.type` post-merge, not `this.type` — since `config.type` (the
  // raw passthrough) can override the generated type in `buildConfig()`. See
  // the deep-merge note on `buildConfig()` below.
  private builtType?: OptionalPeerApi;
  // `chartjs-plugin-zoom`'s own `resetZoom()` synchronously re-invokes the
  // `onZoomComplete` callback below as part of its reset, which would emit a
  // stale `{zoomed: true}` right before `resetZoom()` emits the real
  // `{zoomed: false}`. Set while this component's own `resetZoom()` is
  // driving the plugin so that re-entrant callback is ignored.
  private suppressZoomComplete = false;
  private descriptionId = nextId('chart-description');
  private datumStatusId = nextId('chart-datum-status');
  private keyboardDatumIndex = 0;
  @state() private keyboardDatumAnnouncement = '';
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
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver((entries) => {
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
        this.resizeDrawFrame = requestAnimationFrame(() => {
          this.resizeDrawFrame = undefined;
          // A changed auto position schedules the same visibility-gated draw through `updated()`.
          // Avoid drawing once here and again in that reactive pass.
          if (!this.updateAutoLegendPosition()) this.drawIfVisible();
        });
      });
      this.resizeObserver.observe(this);
    }
    this.updateAutoLegendPosition();
    const generation = ++this.loadGeneration;
    const load = this.loadLibrary(this.zoom);
    void load.then((mod) => {
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
      const dlGeneration = ++this.dataLabelsLoadGeneration;
      void loadChartJsWithDataLabels().then((result) => {
        if (dlGeneration !== this.dataLabelsLoadGeneration || !this.isConnected || !this.needsDataLabels) {
          return;
        }
        this.applyDataLabelsPlugin(result?.plugin);
      });
    }
    if (typeof IntersectionObserver !== 'undefined') {
      this.intersectionObserver = new IntersectionObserver((entries) => {
        const wasVisible = this.visible;
        this.visible = entries[0]?.isIntersecting ?? true;
        if (this.visible && !wasVisible) this.drawIfVisible();
      });
      this.intersectionObserver.observe(this);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    if (this.resizeDrawFrame !== undefined) cancelAnimationFrame(this.resizeDrawFrame);
    this.resizeDrawFrame = undefined;
    this.lastObservedInlineSize = undefined;
    this.loadGeneration += 1;
    this.zoomLoadGeneration += 1;
    this.dataLabelsLoadGeneration += 1;
    this.chart?.destroy();
    this.chart = undefined;
    this.intersectionObserver?.disconnect();
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
  private applyDataLabelsPlugin(plugin: OptionalPeerApi | undefined): void {
    this.dataLabelsPlugin = plugin;
    let rebuilt = false;
    if (plugin && this.needsDataLabels && this.chart) {
      // Force reconstruction: a live chart built without the plugin can't gain
      // it through chart.update(). destroy() + clearing builtType makes the next
      // draw() take the `new Chart()` branch, which reads config.plugins.
      this.chart.destroy();
      this.chart = undefined;
      this.builtType = undefined;
      rebuilt = true;
    }
    this.drawIfVisible();
    // A rebuild resets Chart.js's per-instance visibility metadata to the configured `hidden`
    // flags. Nothing reactive changes after the async plugin resolves, so refresh the DOM legend
    // explicitly instead of leaving its pre-rebuild aria-pressed state stale.
    if (rebuilt && this.legend) this.requestUpdate();
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

    this.setAttribute('aria-busy', String(this.loading));

    // `--lr-chart-height` is read by the plot region and host minimum size in
    // `chart.styles.ts`. Custom properties only cascade downward (host ->
    // shadow tree), never upward from a shadow-tree descendant back to the
    // host, so this must be set on the host element itself, not on the
    // `[part="base"]` div inside the shadow root.
    if (changed.has('height')) {
      this.style.setProperty('--lr-chart-height', this.height);
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
      const zoomGeneration = ++this.zoomLoadGeneration;
      if (this.zoom) {
        void loadChartJsWithZoom().then(() => {
          if (zoomGeneration !== this.zoomLoadGeneration || !this.isConnected || !this.zoom) return;
          this.drawIfVisible();
        });
      }
    }
    // `data-labels`/`stack-totals` can turn on after connect (like `zoom`) — load
    // the plugin on demand and redraw once it's registered, with the same
    // generation + `isConnected` guard against a disconnect mid-import.
    if ((changed.has('dataLabels') || changed.has('stackTotals')) && this.needsDataLabels) {
      const dlGeneration = ++this.dataLabelsLoadGeneration;
      void loadChartJsWithDataLabels().then((result) => {
        if (dlGeneration !== this.dataLabelsLoadGeneration || !this.isConnected || !this.needsDataLabels) {
          return;
        }
        this.applyDataLabelsPlugin(result?.plugin);
      });
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
      'legend',
      'legendPosition',
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
      'dataLabels',
      'stackTotals',
      'config',
      'zoom',
      'locale',
      'strings',
      'loading',
    ].some((name) => changed.has(name));
  }

  private seriesToDataset(s: Series, index: number, palette: string[], effectiveType: EffectiveChartType) {
    const colors = Array.isArray(s.color)
      ? s.color.map((color) => resolveCanvasColor(this, color, palette[index % palette.length] ?? 'transparent'))
      : s.color
        ? [resolveCanvasColor(this, s.color, palette[index % palette.length] ?? 'transparent')]
        : undefined;
    // Default a color-less series to the categorical palette, keyed by dataset index (matching
    // <lr-lite-chart>). pie/doughnut/polarArea carry one series whose *slices* each need a distinct
    // color, so those default to an array cycled across the palette; every other family is one
    // color per series. Only applied when the caller gave no `color` — an explicit `color` still wins.
    const fallback = palette.length ? palette[index % palette.length] : undefined;
    const sliceColors =
      (effectiveType === 'pie' || effectiveType === 'doughnut' || effectiveType === 'polarArea') && palette.length
        ? (s.points ?? s.data ?? []).map((_, i) => palette[i % palette.length]!)
        : undefined;
    const fill = s.fill ?? this.area;
    const backgroundColor = colors ?? sliceColors ?? fallback;
    const datasetType = s.type ?? effectiveType;
    const segmentColors = s.segmentColors?.map((color) =>
      resolveCanvasColor(this, color, colors?.[0] ?? fallback ?? 'transparent'),
    );
    const resolvedBackgroundColor =
      datasetType === 'line' && fill
        ? Array.isArray(backgroundColor)
          ? backgroundColor.map((color) => translucentAreaColor(this, color))
          : backgroundColor
            ? translucentAreaColor(this, backgroundColor)
            : backgroundColor
        : backgroundColor;
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
      borderWidth: s.width ?? 2,
      borderDash: s.dash ? [4, 4] : undefined,
      backgroundColor: resolvedBackgroundColor,
      borderColor: colors?.[0] ?? fallback,
      pointBackgroundColor: s.pointColors?.map((color) =>
        resolveCanvasColor(this, color, colors?.[0] ?? fallback ?? 'transparent'),
      ),
      pointRadius: s.pointRadius,
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
    const cs = getComputedStyle(this);
    return {
      grid: cs.getPropertyValue('--lr-chart-grid-color').trim() || FALLBACK_GRID_COLOR,
      tick: cs.getPropertyValue('--lr-chart-tick-color').trim() || FALLBACK_TICK_COLOR,
      legend: cs.getPropertyValue('--lr-chart-legend-color').trim() || FALLBACK_LEGEND_COLOR,
      tooltipBg: cs.getPropertyValue('--lr-chart-tooltip-bg').trim() || FALLBACK_TOOLTIP_BG,
      tooltipText: cs.getPropertyValue('--lr-chart-tooltip-text').trim() || FALLBACK_TOOLTIP_TEXT,
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
  private datalabelsOptions(theme: ThemeColors, effectiveType: EffectiveChartType): OptionalPeerApi {
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
      display: (context: OptionalPeerApi): boolean => {
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
      formatter: (value: unknown, context: OptionalPeerApi): string => {
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
        sum += numeric as number;
        any = true;
      }
      totals.push(any ? sum : null);
    }
    return totals;
  }

  /**
   * Resolves the categorical series palette (`--lr-color-chart-1..8`, declared in
   * `internal/tokens.styles.ts` as indirections through `--lr-theme-color-chart-1..8`, with their
   * own dark-theme ramp) via `getComputedStyle` —
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

  private tickOptions(theme: ThemeColors, kind: 'category' | 'value' = 'value'): OptionalPeerApi {
    return {
      color: theme.tick,
      ...(this.valueFormatter && kind === 'value'
        ? { callback: (value: unknown) => this.formatValue(value, 'tick') }
        : {}),
    };
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
  ): OptionalPeerApi {
    if (effectiveType === 'pie' || effectiveType === 'doughnut') return {};

    if (effectiveType === 'radar' || effectiveType === 'polarArea') {
      return {
        r: {
          beginAtZero: this.beginAtZero,
          ticks: { ...this.tickOptions(theme), showLabelBackdrop: false },
          grid: { color: theme.grid },
          angleLines: { color: theme.grid },
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
    return {
      x: {
        type: effectiveType === 'scatter' || effectiveType === 'bubble' ? 'linear' : 'category',
        title: { display: !!this.xLabel, text: this.xLabel, color: theme.tick },
        ticks: this.tickOptions(
          theme,
          effectiveType === 'scatter' || effectiveType === 'bubble' ? 'value' : 'category',
        ),
        grid: { color: theme.grid },
        stacked,
      },
      y: {
        position: rtl ? 'right' : 'left',
        beginAtZero: this.beginAtZero,
        title: { display: !!this.yLabel, text: this.yLabel, color: theme.tick },
        ticks: this.tickOptions(theme),
        grid: { color: theme.grid },
        stacked,
      },
      ...(hasY2
        ? {
            y2: {
              position: rtl ? 'left' : 'right',
              grid: { drawOnChartArea: false, color: theme.grid },
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
  private handlePointClick(event: OptionalPeerApi, chart: OptionalPeerApi): void {
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
    ) as OptionalPeerApi[];
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
    const labels = (chartData?.labels as string[] | undefined) ?? this.labels;
    const datasets =
      (chartData?.datasets as OptionalPeerApi[] | undefined) ??
      this.datasets.map((series) => ({ data: series.points ?? series.data ?? [] }));
    const datums: ChartDatum[] = [];
    datasets.forEach((dataset, datasetIndex) => {
      const values = (dataset.data as unknown[] | undefined) ?? [];
      values.forEach((value, index) => {
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
    return (
      (this.config?.type as EffectiveChartType | undefined) ?? normalizeChartType(this.type)
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

  private legendValue(item: OptionalPeerApi, chart: OptionalPeerApi): number | undefined {
    const data = chart.data.datasets?.[item.datasetIndex]?.data as unknown[] | undefined;
    if (!data) return undefined;
    const indexed = Number.isInteger(item.index) ? Number(data[item.index]) : NaN;
    if (Number.isFinite(indexed)) return indexed;
    const values = data.map(Number).filter(Number.isFinite);
    return values.length ? values.reduce((sum, value) => sum + value, 0) : undefined;
  }

  private legendLabels(chart: OptionalPeerApi): OptionalPeerApi[] {
    const generateLabels = this.chartJsModule?.defaults?.plugins?.legend?.labels?.generateLabels;
    const labels =
      (generateLabels && chart.legend && chart.options ? generateLabels(chart) : undefined) ??
      (chart.data.datasets ?? []).map(
      (dataset: OptionalPeerApi, index: number) => ({
        text: dataset.label ?? String(index + 1),
        datasetIndex: index,
      }),
      );
    return labels.map((item: OptionalPeerApi) => {
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

  private tooltipLabel(context: OptionalPeerApi): string | undefined {
    const parsed = context.parsed;
    const rawValue =
      typeof parsed === 'object' && parsed !== null ? parsed.y ?? parsed.r ?? parsed.x : parsed ?? context.raw;
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
    const next: Exclude<LyraChartLegendPosition, 'auto'> = width > 0 && width < 480 ? 'bottom' : 'right';
    if (next === this.autoLegendPosition) return false;
    this.autoLegendPosition = next;
    return true;
  }

  private legendPositionForConfig(): Exclude<LyraChartLegendPosition, 'auto'> {
    return this.legendPosition === 'auto' ? this.autoLegendPosition : this.legendPosition;
  }

  private updateChartArea(chart: OptionalPeerApi = this.chart): void {
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

  private buildConfig(): OptionalPeerApi {
    const theme = this.themeColors();
    // Resolve the effective type up front: `config.type` (if set) overrides
    // the attribute `type` post-merge, so scales/interaction must be built
    // for *that* type, not `this.type` — otherwise a config.type override
    // (e.g. line -> radar) ships with the wrong axis shape (categorical x/y
    // instead of a radial r scale).
    const effectiveType = this.effectiveType();
    const palette = this.seriesPalette();
    const generated: OptionalPeerApi = {
      type: effectiveType,
      data: {
        labels: this.labels,
        datasets: this.datasets.map((s, i) =>
          this.seriesToDataset(s, i, palette, effectiveType),
        ) as never,
      },
      // `chartjs-plugin-datalabels` is registered PER-INSTANCE (only on charts
      // that need it) rather than globally, because a global registration draws
      // on — and breaks the next update of — every other chart on the page.
      // Only added when the peer has actually loaded and the feature is on.
      ...(this.needsDataLabels && this.dataLabelsPlugin
        ? { plugins: [this.dataLabelsPlugin] }
        : {}),
      options: {
        locale: this.effectiveLocale,
        responsive: true,
        maintainAspectRatio: false,
        // Chart.js's own mechanism for horizontal bars (also flips line/area
        // types onto a horizontal category axis).
        indexAxis: this.horizontal ? 'y' : undefined,
        // Chart.js's own default ~1000ms draw-in animation only ever fires
        // from `new Chart()` (chart/type-change construction) — every
        // in-place update in `draw()` already passes `'none'` to
        // `Chart#update()`. A CSS media query can't reach that
        // canvas-internal animation loop, so `prefersReducedMotion()` is
        // checked here instead and fed into `options.animation`.
        animation: prefersReducedMotion() ? false : undefined,
        interaction: { intersect: false, mode: effectiveType === 'scatter' ? 'nearest' : 'index' },
        onClick: (event: OptionalPeerApi, _elements: OptionalPeerApi, chart: OptionalPeerApi) =>
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
                ? { generateLabels: (chart: OptionalPeerApi) => this.legendLabels(chart) }
                : {}),
            },
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            ...(this.valueFormatter ? { label: (context: OptionalPeerApi) => this.tooltipLabel(context) } : {}),
            // Chart.js's tooltip plugin has no per-dataset `tooltip.enabled`
            // — `Series.noTooltip` is implemented here instead, via the one
            // mechanism the core tooltip plugin actually reads.
            filter: (item: OptionalPeerApi) =>
              !this.effectiveData().datasets[item.datasetIndex]?.noTooltip,
          },
          zoom: this.zoom
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
        onResize: (chart: OptionalPeerApi) => this.updateChartArea(chart),
        scales: this.buildScales(effectiveType, theme),
      },
    };

    if (!this.config) return generated;

    // Raw Chart.js passthrough (mirrors `wa-chart`'s `config` property) —
    // deep-merge `config` over the `Series`-derived config at every nesting
    // level (see `deepMerge` above), letting consumers override or extend a
    // single nested key (e.g. `config.options.scales.y.min`) without
    // clobbering the rest of the generated sibling object.
    const merged = deepMerge(generated, this.config);
    // `deepMerge` replaces arrays wholesale, so a consumer `config.plugins`
    // would drop the per-instance data-labels plugin the generated config added
    // (silently disabling `data-labels`/`stack-totals`). Concatenate it back —
    // the consumer's inline plugins AND the built-in data-labels plugin both run.
    if (this.needsDataLabels && this.dataLabelsPlugin) {
      const mergedPlugins = Array.isArray(merged.plugins) ? merged.plugins : [];
      if (!mergedPlugins.includes(this.dataLabelsPlugin)) {
        merged.plugins = [...mergedPlugins, this.dataLabelsPlugin];
      }
    }
    return merged;
  }

  private draw(): void {
    if (!this.chartJsModule || !this.canvasEl) return;
    const config = this.buildConfig();
    const effectiveType = config.type;
    if (this.chart && this.builtType === effectiveType) {
      // Chart.js tracks per-dataset legend-toggled visibility by dataset INDEX as a nullable
      // metadata override, separate from each dataset's configured `hidden` value -- a full
      // reassignment of `chart.data` on every reactive update (as every live-polling consumer's
      // parent naturally produces) would otherwise silently reset an explicit legend choice.
      // Only snapshot indices the chart already has metadata for -- `this.datasets` reflects the
      // *new* series count, so mapping over it (instead of the chart's own prior dataset count)
      // would query metadata for a not-yet-existing index and fabricate state for a series that
      // has not been added yet.
      const priorDatasetCount = this.chart.data.datasets?.length ?? 0;
      const priorVisibilityOverrides = Array.from(
        { length: priorDatasetCount },
        (_, i) => this.chart!.getDatasetMeta(i).hidden,
      );
      this.chart.data = config.data;
      this.chart.options = config.options ?? {};
      this.chart.update('none');
      this.updateChartArea(this.chart);
      // The mirror-image guard of the one above: a shrinking update can leave the prior override
      // list longer than the new dataset list, and Chart.js fabricates metadata for an out-of-range
      // index instead of throwing -- skip any index the shrunk list no longer has instead of
      // polluting internal per-dataset state for a series that's gone.
      const currentDatasetCount = this.chart.data.datasets?.length ?? 0;
      let restoredVisibilityOverride = false;
      priorVisibilityOverrides.forEach((hidden, i) => {
        if (i >= currentDatasetCount) return;
        // `null` means there was no user override: the replacement dataset's own `hidden`
        // configuration must win. Boolean metadata represents an explicit legend show/hide.
        if (typeof hidden === 'boolean') {
          this.chart!.setDatasetVisibility(i, !hidden);
          restoredVisibilityOverride = true;
        }
      });
      // setDatasetVisibility() only flips internal metadata -- it does not repaint on its own (unlike
      // hide()/show()) -- so without a follow-up update() the canvas would keep showing the series as
      // visible until some unrelated future draw() call happens to run.
      if (restoredVisibilityOverride) this.chart.update('none');
      return;
    }
    this.chart?.destroy();
    this.chart = new this.chartJsModule.Chart(this.canvasEl, config);
    this.builtType = effectiveType;
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
    if (this.legend) this.requestUpdate();
  }

  private seriesValues(dataset: OptionalPeerApi): number[] {
    return this.datasetValues(dataset)
      .map((value) => isChartPoint(value) ? value.y : value)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
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
    const present = new Set(
      this.effectiveData().datasets.map((dataset) =>
        dataset.yAxisID === 'y2' || dataset.axis === 'y2' ? 'y2' : 'y',
      ),
    );
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
    return this.getAttribute('aria-label') || this.accessibleLabel || fallback;
  }

  private chartDescription(): string {
    if (this.accessibleDescription) return this.accessibleDescription;
    const datasets = this.effectiveData().datasets;
    const summaries = datasets.map((dataset, index) => {
      const seriesLabel = this.datasetLabel(dataset, index);
      const values = this.seriesValues(dataset);
      if (!values.length) return this.localize('chartSeriesNoData', undefined, { label: seriesLabel });
      const first = values[0]!;
      const last = values[values.length - 1]!;
      const trend =
        last > first
          ? this.localize('chartTrendIncreasing')
          : last < first
            ? this.localize('chartTrendDecreasing')
            : this.localize('chartTrendFlat');
      let min = values[0]!;
      let max = values[0]!;
      for (const value of values) {
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
      const summary = this.localize('chartSummary', undefined, {
        label: seriesLabel,
        count: this.formatSummaryValue(values.length),
        min: this.formatSummaryValue(min),
        max: this.formatSummaryValue(max),
        trend,
      });
      const pointDetails = this.datasetValues(dataset)
        .filter(isChartPoint)
        .map((point) => this.datumDisplayValue(point));
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

  private renderDataTable(): TemplateResult {
    const effective = this.effectiveData();
    const rowCount = Math.max(
      effective.labels.length,
      ...effective.datasets.map((dataset) => this.datasetValues(dataset).length),
      0,
    );
    const stackAxes = this.tableStackAxes();
    const stackTotals = new Map(stackAxes.map((axis) => [axis, this.computeStackTotals(axis)]));
    return html`
      <table class=${this.showDataTable ? nothing : 'sr-only'}>
        <caption>${this.accessibleName(this.localize('chartData'))}</caption>
        <thead>
          <tr>
            <th scope="col">${this.localize('chartCategory')}</th>
            ${effective.datasets.map((dataset, index) =>
              html`<th scope="col">${this.datasetLabel(dataset, index)}</th>`,
            )}
            ${stackAxes.map(
              (axis) => html`<th scope="col">${this.tableStackTotalLabel(axis, stackAxes.length)}</th>`,
            )}
          </tr>
        </thead>
        <tbody>
          ${Array.from({ length: rowCount }, (_, index) => html`
            <tr>
              <th scope="row">${labelText(effective.labels[index]) ||
                effective.datasets
                  .map((dataset) => this.datasetValues(dataset)[index])
                  .find(isChartPoint)?.label ||
                this.localize('chartPointLabel', undefined, {
                  n: this.formatSummaryValue(index + 1),
                })}</th>
              ${effective.datasets.map((dataset, datasetIndex) => {
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

  private legendTextFor(dataset: OptionalPeerApi, datasetIndex: number): string {
    const label = this.datasetLabel(dataset, datasetIndex);
    if (!this.valueFormatter) return label;
    const values = this.datasetValues(dataset)
      .map((value) => isChartPoint(value) ? value.y : Number(value))
      .filter(Number.isFinite);
    if (!values.length) return label;
    const value = values.reduce((sum, item) => sum + item, 0);
    const formatted = this.formatValue(value, 'legend');
    return formatted === value || formatted === undefined
      ? label
      : this.localize('chartValueLabel', undefined, {
          label,
          value: String(formatted),
        });
  }

  private legendColor(dataset: OptionalPeerApi, datasetIndex: number): string {
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
    const visible = this.chart.isDatasetVisible(datasetIndex);
    this.chart.setDatasetVisibility(datasetIndex, !visible);
    this.chart.update('none');
    this.requestUpdate();
  }

  private legendDatasetVisible(dataset: OptionalPeerApi, datasetIndex: number): boolean {
    const configuredVisible = dataset.hidden !== true;
    // With no instance, or when the upcoming draw must replace it for a new effective type, the
    // new Chart.js metadata will derive visibility directly from the effective dataset.
    if (!this.chart || this.builtType !== this.effectiveType()) return configuredVisible;
    const renderedDatasetCount = this.chart.data.datasets?.length ?? 0;
    if (datasetIndex >= renderedDatasetCount) return configuredVisible;

    // An explicit legend toggle lives on Chart.js metadata and survives the in-place draw path.
    // Without one, the upcoming dataset's own `hidden` flag is the post-draw source of truth.
    const metadata = this.chart.getDatasetMeta?.(datasetIndex);
    return typeof metadata?.hidden === 'boolean'
      ? this.chart.isDatasetVisible(datasetIndex)
      : configuredVisible;
  }

  private renderLegend(): TemplateResult | typeof nothing {
    if (!this.legend) return nothing;
    const effective = this.effectiveData();
    return html`
      <div
        part="legend"
        role="group"
        data-position=${this.legendPositionForConfig()}
        aria-label=${this.accessibleName(this.localize('chart'))}
      >
        ${effective.datasets.map((dataset, index) => {
          const visible = this.legendDatasetVisible(dataset, index);
          return html`
            <button
              part="legend-item"
              type="button"
              aria-pressed=${visible ? 'true' : 'false'}
              @click=${() => this.toggleDataset(index)}
            >
              <span
                part="legend-swatch"
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
          <lr-skeleton variant="rect"></lr-skeleton>
        </div>
      `;
    }
    if (this.loadFailed) {
      return html`
        <div part="base">
          <div part="error" role="alert">${this.localize('chartMissingLibrary')}</div>
        </div>
      `;
    }
    const effective = this.effectiveData();
    const seriesLabels = effective.datasets.map((dataset, index) =>
      this.datasetLabel(dataset, index),
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
        data-legend-position=${this.legend ? this.legendPositionForConfig() : nothing}
      >
        <div part="plot">
          <canvas
            part="canvas"
            role="application"
            aria-roledescription=${this.localize('chart')}
            tabindex="0"
            aria-label=${label}
            aria-describedby="${this.descriptionId} ${this.datumStatusId}"
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
          ${this.zoom && this.zoomed
            ? html`<button part="reset-zoom-button" type="button" @click=${() => this.resetZoom()}>
                ${this.localize('resetZoom')}
              </button>`
            : nothing}
        </div>
        ${this.renderLegend()}
        <p part="description" id=${this.descriptionId} class="sr-only">${description}</p>
        <p id=${this.datumStatusId} class="sr-only" aria-live="polite">
          ${this.keyboardDatumAnnouncement}
        </p>
        <div part="data-table">
          <slot name="data-table" @slotchange=${() => this.requestUpdate()}></slot>
          ${this.hasCustomDataTable() ? nothing : this.renderDataTable()}
        </div>
      </div>
    `;
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
