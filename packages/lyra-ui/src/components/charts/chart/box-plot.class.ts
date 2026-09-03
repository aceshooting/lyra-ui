import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { nextId, srOnly } from '../../../internal/a11y.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { loadChartJs, type ChartJsModule } from './chart-core-loader.js';
import { styles } from './box-plot.styles.js';
import '../../overlays/skeleton/skeleton.class.js';
import { getListFormat, getNumberFormat } from '../../../internal/intl-cache.js';
import { trueDefaultBooleanFromAttributeConverter as trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { sanitizeCssLength } from '../../../internal/safe-css.js';
import { resolveCanvasColor, seriesPalette } from './chart-colors.js';
import {
  createForcedColorPattern,
  forcedColorEncoding,
  forcedColorsActive,
  type ForcedColorEncodingName,
} from './chart-forced-colors.js';
import { specialistTokens } from '../../../internal/specialist-tokens.styles.js';
import { ThemeWatcher } from '../../../internal/theme-watcher.js';
import {
  resolveOptionalPeerCapability,
  unwrapOptionalPeerDefault,
} from '../../../internal/optional-peer-capabilities.js';
import {
  acquireAnnouncementSink,
  type AnnouncementSink,
} from '../../../internal/announcer.js';
import {
  legendVisibilityDetail,
  normalizeHiddenDatasets,
  type LyraChartLegendVisibilityChangeDetail,
} from './chart-legend-visibility.js';
import { sampleChartTableIndexes } from './chart-table-sampling.js';
import { escapeCsvField } from '../../utility/export-button/csv.js';
import type {
  LyraChartValueFormatter,
  LyraChartValueFormatterContext,
  LyraChartDatumActivateDetail,
  LyraChartFormatSurface,
  LyraChartFormatter,
  LyraChartFormatterContext,
  LyraChartStatistic,
} from './chart.class.js';
import {
  chartChromeLegendPlacement,
  normalizeChartChromeLegendPosition,
  type LyraChartChromeLegendPosition,
} from './chart-chrome.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_boxPlot, LYRA_DEFAULT_boxPlotData, LYRA_DEFAULT_boxPlotMax, LYRA_DEFAULT_boxPlotMedian, LYRA_DEFAULT_boxPlotMin, LYRA_DEFAULT_boxPlotMissingLibrary, LYRA_DEFAULT_boxPlotQ1, LYRA_DEFAULT_boxPlotQ3, LYRA_DEFAULT_boxPlotSeriesSummary, LYRA_DEFAULT_boxPlotSummaryEmpty, LYRA_DEFAULT_boxPlotSummaryWithData, LYRA_DEFAULT_chartCategory, LYRA_DEFAULT_chartDataSampled, LYRA_DEFAULT_chartPointLabel, LYRA_DEFAULT_chartSeriesLabel, LYRA_DEFAULT_chartSeriesNoData, LYRA_DEFAULT_chartSummarySeparator, LYRA_DEFAULT_chartTrendDecreasing, LYRA_DEFAULT_chartTrendFlat, LYRA_DEFAULT_chartTrendIncreasing, LYRA_DEFAULT_chartValueLabel, LYRA_DEFAULT_liteChartMarkSummary, LYRA_DEFAULT_loading } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export interface LyraBoxPlotSummary {
  readonly min: number;
  readonly q1: number;
  readonly median: number;
  readonly q3: number;
  readonly max: number;
}
export interface LyraBoxPlotSeries {
  readonly label: string;
  readonly data: readonly LyraBoxPlotSummary[];
  readonly color?: string;
}

type LyraChartFormatterMetadata = Omit<LyraChartFormatterContext, 'surface' | 'value'>;

function isBoxPlotSeries(value: unknown): value is LyraBoxPlotSeries {
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

function normalizeBoxPlotSeries(value: unknown): readonly LyraBoxPlotSeries[] {
  try {
    return Object.freeze(Array.isArray(value) ? value.filter(isBoxPlotSeries) : []);
  } catch {
    return Object.freeze([]);
  }
}

// Defensive JS-side fallbacks for themeColors() below, mirroring the
// light-mode default of each `--lr-chart-*` token's own fallback chain
// (see box-plot.styles.ts) — only reached if getComputedStyle somehow can't
// resolve the custom property at all (e.g. host detached from the document).
// Same values as chart.ts's own fallbacks, since both default to the same
// semantic tokens.
const FALLBACK_GRID_COLOR = '#8a8a90';
const FALLBACK_TICK_COLOR = '#6b7280';
const FALLBACK_LEGEND_COLOR = '#1a1a1a';
const FALLBACK_TOOLTIP_BG = '#fff';
const FALLBACK_TOOLTIP_TEXT = '#1a1a1a';

// Mirrors chart.ts's own `ThemeColors` shape (all 5 `--lr-chart-*` tokens)
// so scales, legends, and tooltips share the same canvas theme contract.
interface ThemeColors {
  grid: string;
  tick: string;
  legend: string;
  tooltipBg: string;
  tooltipText: string;
}

type BrowserWindow = Window & typeof globalThis;

interface BoxPlotRegistrationConstructor {
  new (...args: never[]): object;
}

interface BoxPlotModule {
  BoxPlotController: BoxPlotRegistrationConstructor;
  BoxAndWiskers: BoxPlotRegistrationConstructor;
}

interface BoxPlotChartConfiguration {
  type: string;
  data: {
    labels: string[];
    datasets: Array<Record<string, unknown>>;
  };
  options: Record<string, unknown>;
}

interface BoxPlotChartRuntime {
  data: BoxPlotChartConfiguration['data'];
  options: Record<string, unknown>;
  destroy(): void;
  update(mode?: string): void;
  getDatasetMeta?(index: number): { hidden: boolean | null };
  getElementsAtEventForMode?(
    event: Event,
    mode: string,
    options: { intersect: boolean },
    useFinalPosition: boolean,
  ): Array<{ datasetIndex: number; index: number }>;
  isDatasetVisible(index: number): boolean;
  setDatasetVisibility(index: number, visible: boolean): void;
}

/** One addressable box: a series/category pair plus the five-number summary it renders. */
export interface LyraBoxPlotPointDetail {
  datasetIndex: number;
  index: number;
  label: string | undefined;
  value: LyraBoxPlotSummary | null;
}

export interface LyraBoxPlotEventMap {
  'lr-point-click': CustomEvent<LyraBoxPlotPointDetail>;
  'lr-before-legend-visibility-change': CustomEvent<LyraEventDetailSnapshot<LyraChartLegendVisibilityChangeDetail>>;
  'lr-legend-visibility-change': CustomEvent<LyraEventDetailSnapshot<LyraChartLegendVisibilityChangeDetail>>;
  'lr-datum-activate': CustomEvent<
    LyraChartDatumActivateDetail<'box', LyraBoxPlotSummary | null>
  >;
}

/**
 * A fresh five-number summary for an event detail. Never the caller's own object: the box-plot peer
 * annotates the point objects it is handed in place (it writes `whiskerMin`/`whiskerMax` onto
 * them), so emitting the original would leak the peer's internal bookkeeping into a public event
 * and hand consumers a reference the chart is still writing to.
 */
function summaryOf(point: LyraBoxPlotSummary): LyraBoxPlotSummary {
  return {
    min: point.min,
    q1: point.q1,
    median: point.median,
    q3: point.q3,
    max: point.max,
  };
}

let boxPlotPlugin: Promise<BoxPlotModule | null> | undefined;

function isConstructor(value: unknown): value is BoxPlotRegistrationConstructor {
  if (typeof value !== 'function') return false;
  try {
    Reflect.construct(Object, [], value);
    return true;
  } catch {
    return false;
  }
}

function missingBoxPlotCapability(candidate: unknown): string | undefined {
  if ((typeof candidate !== 'object' && typeof candidate !== 'function') || candidate === null) {
    return 'module namespace';
  }
  const module = candidate as { BoxPlotController?: unknown; BoxAndWiskers?: unknown };
  if (!isConstructor(module.BoxPlotController)) return 'BoxPlotController';
  if (!isConstructor(module.BoxAndWiskers)) return 'BoxAndWiskers';
  return undefined;
}

function isBoxPlotModule(candidate: unknown): candidate is BoxPlotModule {
  return missingBoxPlotCapability(candidate) === undefined;
}

function resolveBoxPlotModule(value: unknown): BoxPlotModule {
  const module = resolveOptionalPeerCapability(value, isBoxPlotModule);
  if (module) return module;
  const candidate = unwrapOptionalPeerDefault(value);
  const missing = missingBoxPlotCapability(candidate) ?? 'module namespace';
  throw new Error(
    'Invalid optional peer `@sgratzl/chartjs-chart-boxplot`: ' +
      `missing or invalid \`${missing}\` constructor.`,
  );
}

/**
 * Loads and validates the box-plot peer before registering its two constructors.
 * @internal
 */
export async function loadBoxPlotAndRegister(
  loadChart: () => Promise<ChartJsModule | null> = loadChartJs,
  importBoxPlot: () => Promise<unknown> = () => import('@sgratzl/chartjs-chart-boxplot'),
): Promise<BoxPlotModule | null> {
  try {
    const [chartMod, imported] = await Promise.all([loadChart(), importBoxPlot()]);
    if (!chartMod) return null;
    const boxMod = resolveBoxPlotModule(imported);
    chartMod.Chart.register(boxMod.BoxPlotController, boxMod.BoxAndWiskers);
    return boxMod;
  } catch (error) {
    console.warn(
      '<lr-box-plot> needs the optional peer dependency `@sgratzl/chartjs-chart-boxplot` ' +
        '— install it with `pnpm add @sgratzl/chartjs-chart-boxplot`.',
      error,
    );
    return null;
  }
}

/**
 * Lazily loads `@sgratzl/chartjs-chart-boxplot` and registers its controller
 * only when a `<lr-box-plot>` connects — kept separate from the base
 * `chart-core-loader.ts` so importing `lr-chart.js` alone never pulls this in.
 */
function loadBoxPlotPlugin(): Promise<BoxPlotModule | null> {
  if (!boxPlotPlugin) {
    boxPlotPlugin = loadBoxPlotAndRegister();
  }
  return boxPlotPlugin;
}

/**
 * `<lr-box-plot>` — a box-and-whisker chart from precomputed five-number
 * summaries (no raw sample data is shipped to the browser). Beyond Web
 * Awesome's chart set — useful for summarizing distributions.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * @customElement lr-box-plot
 * @csspart base - The chart wrapper.
 * @csspart plot - The fixed-height canvas region.
 * @csspart canvas - The box-plot canvas. A keyboard-navigable surface: Arrow keys/Home/End walk
 *   the individual boxes and Enter/Space activates the current one, mirroring `<lr-chart>`.
 * @csspart legend - The wrapping DOM legend rendered when `legend` is set.
 * @csspart legend-item - A keyboard-operable series visibility toggle.
 * @csspart legend-item-hidden - Added to a `legend-item` while its box series is hidden.
 * @csspart legend-swatch - The resolved series-color swatch in a legend item.
 * @csspart description - The accessible box-plot summary.
 * @csspart data-table - The optional generated or slotted data table.
 * @csspart data-table-toggle - The disclosure button rendered by `dataTableToggle`.
 * @cssprop [--lr-box-plot-data-table-toggle-hover-bg=var(--lr-color-brand-quiet)] - Hover
 *   background of the `dataTableToggle` disclosure button.
 * @cssprop --lr-box-plot-data-table-toggle-active-bg - Pressed background of the `dataTableToggle`
 *   disclosure button; defaults to a mix of the hover background with the shared active mix
 *   partner.
 * @csspart error - Static visible error shown instead of the canvas when the optional box-plot
 *   peer fails to load; its transition is announced through a shared light-DOM alert.
 * @csspart data-truncation - Explanation shown when the generated accessible alternative samples
 *   more than 1,000 records.
 * @event lr-before-legend-visibility-change - Cancelable proposed DOM legend visibility change.
 * @event lr-legend-visibility-change - Committed DOM legend visibility change.
 * @event lr-point-click - Fired when pointer input lands on a box, or when Enter/Space activates
 *   the keyboard-current box. `detail: { datasetIndex: number, index: number, label: string |
 *   undefined, value: LyraBoxPlotSummary | null }`, where `value` is that box's complete five-number
 *   summary. Mirrors `<lr-chart>`/`<lr-lite-chart>`'s event of the same name.
 * @event lr-datum-activate - Family-normalized box activation; the legacy detail plus `kind: 'box'`.
 * @slot data-table - An optional consumer-provided complete/paginated accessible table alternative.
 * @cssprop [--lr-chart-height=var(--lr-size-280px)] - Consumer-owned chart height. The `height`
 *   property supplies only a private fallback, so this public token always wins when set.
 * @cssprop [--lr-chart-grid-color=var(--lr-color-border)] - Canvas grid-line color.
 * @cssprop [--lr-chart-tick-color=var(--lr-color-text-quiet)] - Canvas tick and axis-title color.
 * @cssprop [--lr-chart-legend-color=var(--lr-color-text)] - DOM legend label color.
 * @cssprop [--lr-chart-tooltip-bg=var(--lr-color-surface)] - Canvas tooltip background.
 * @cssprop [--lr-chart-tooltip-text=var(--lr-color-text)] - Canvas tooltip text color.
 * @cssprop [--lr-chart-legend-side-max=var(--lr-size-15rem)] - Maximum side-legend track size.
 * @cssprop [--lr-chart-legend-item-hover-bg=var(--lr-color-brand-quiet)] - Legend-item hover background.
 * @cssprop --lr-chart-legend-item-active-bg - Legend-item pressed background.
 * @cssprop [--lr-chart-canvas-hover-outline-width=var(--lr-border-width-thin)] - Width of the
 *   `[part='canvas']` hover-state outline.
 * @cssprop [--lr-chart-canvas-hover-outline-color=var(--lr-chart-grid-color)] - Color of the
 *   `[part='canvas']` hover-state outline. Same token and default as `<lr-chart>`.
 * @cssprop [--lr-chart-pattern-step=var(--lr-space-2xs)] - Tile size of the texture painted on
 *   `[part='legend-swatch']` while `forced-colors: active` matches, where the eight-color series
 *   ramp collapses onto a repeating system-color cycle and the stripe/crosshatch pattern becomes
 *   the only channel keeping series apart. Declared on the swatch part rather than the host; the
 *   stripe width within a tile stays `--lr-border-width-thin`, so a larger step spaces the stripes
 *   further apart. Shared verbatim with `<lr-chart>` and `<lr-lite-chart>`.
 * @status stable
 * @since 4.0.0
 */
export class LyraBoxPlot extends LyraElement<LyraBoxPlotEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    boxPlot: LYRA_DEFAULT_boxPlot,
    boxPlotData: LYRA_DEFAULT_boxPlotData,
    boxPlotMax: LYRA_DEFAULT_boxPlotMax,
    boxPlotMedian: LYRA_DEFAULT_boxPlotMedian,
    boxPlotMin: LYRA_DEFAULT_boxPlotMin,
    boxPlotMissingLibrary: LYRA_DEFAULT_boxPlotMissingLibrary,
    boxPlotQ1: LYRA_DEFAULT_boxPlotQ1,
    boxPlotQ3: LYRA_DEFAULT_boxPlotQ3,
    boxPlotSeriesSummary: LYRA_DEFAULT_boxPlotSeriesSummary,
    boxPlotSummaryEmpty: LYRA_DEFAULT_boxPlotSummaryEmpty,
    boxPlotSummaryWithData: LYRA_DEFAULT_boxPlotSummaryWithData,
    chartCategory: LYRA_DEFAULT_chartCategory,
    chartDataSampled: LYRA_DEFAULT_chartDataSampled,
    chartPointLabel: LYRA_DEFAULT_chartPointLabel,
    chartSeriesLabel: LYRA_DEFAULT_chartSeriesLabel,
    chartSeriesNoData: LYRA_DEFAULT_chartSeriesNoData,
    chartSummarySeparator: LYRA_DEFAULT_chartSummarySeparator,
    chartTrendDecreasing: LYRA_DEFAULT_chartTrendDecreasing,
    chartTrendFlat: LYRA_DEFAULT_chartTrendFlat,
    chartTrendIncreasing: LYRA_DEFAULT_chartTrendIncreasing,
    chartValueLabel: LYRA_DEFAULT_chartValueLabel,
    liteChartMarkSummary: LYRA_DEFAULT_liteChartMarkSummary,
    loading: LYRA_DEFAULT_loading,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly ownedCollectionProperties = Object.freeze([
    'labels',
    'datasets',
    'hiddenDatasets',
  ]);

  static override styles = [LyraElement.styles, specialistTokens, styles, srOnly];
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-before-legend-visibility-change',
    'lr-legend-visibility-change',
  ]);

  constructor() {
    super();
    new ThemeWatcher(this, () => {
      if (this.chart) this.refreshTheme();
    });
  }

  @property({ attribute: false }) labels: readonly string[] = [];
  private _datasets: readonly LyraBoxPlotSeries[] = Object.freeze([]);
  /** Series with an array `data` payload. Malformed entries are dropped without hiding siblings. */
  @property({ attribute: false })
  get datasets(): readonly LyraBoxPlotSeries[] {
    return this._datasets;
  }
  set datasets(value: readonly LyraBoxPlotSeries[]) {
    const previous = this._datasets;
    this._datasets = normalizeBoxPlotSeries(value);
    this.requestUpdate('datasets', previous);
  }
  /** Complete controlled legend visibility state. `undefined` keeps the default all-visible state. */
  @property({ attribute: false }) hiddenDatasets?: readonly number[];
  @property({ type: Boolean }) legend = false;
  /** Logical placement for the optional DOM legend. */
  @property({
    attribute: 'legend-position',
    converter: { fromAttribute: normalizeChartChromeLegendPosition },
  })
  legendPosition: LyraChartChromeLegendPosition = 'bottom';
  @property() height = '280px';
  @property({ attribute: 'y-label' }) yLabel = '';
  @property({ type: Boolean, attribute: 'begin-at-zero', converter: trueDefaultBooleanConverter }) beginAtZero = true;
  /** Accessible chart name. A host `aria-label` wins. */
  @property() label: string | null = null;
  /** Accessible chart description. A generated five-number summary is used when unset. */
  @property() description: string | null = null;
  /** Makes the generated data table visible; it remains screen-reader available when false. */
  @property({ type: Boolean, attribute: 'show-data-table' }) showDataTable = false;

  /**
   * Render a disclosure button above the accessible data table so a sighted reader can reveal the
   * numbers behind the plot on demand. `showDataTable` alone is all-or-nothing -- the table is
   * either permanently screen-reader-only or permanently visible -- which left a consumer wrapping
   * a duplicated table in their own `<details>`.
   *
   * With this set, `showDataTable` becomes the disclosure's *initial* state rather than its whole
   * behavior. The table stays in the DOM in both states, so assistive technology never loses it.
   * @default false
   */
  @property({ type: Boolean, attribute: 'data-table-toggle' }) dataTableToggle = false;

  /**
   * Live disclosure state. Null until the reader actually toggles, so an untouched control keeps
   * following `showDataTable` (including a later change to it) instead of freezing a seeded copy.
   */
  @state() private dataTableExpandedOverride: boolean | null = null;

  private readonly dataTableId = nextId('box-plot-data-table');

  /** Whether the data table is currently visible. Identical to `showDataTable` whenever
   *  `dataTableToggle` is off, which is what keeps the unset path byte-identical to before. */
  private get dataTableVisible(): boolean {
    if (!this.dataTableToggle) return this.showDataTable;
    return this.dataTableExpandedOverride ?? this.showDataTable;
  }

  private toggleDataTable(): void {
    this.dataTableExpandedOverride = !this.dataTableVisible;
  }
  /** Formats numeric axes, tooltips, generated table cells, summaries, and CSV export. */
  @property({ attribute: false }) valueFormatter?: LyraChartValueFormatter;
  /** Unified context-object formatter shared with the other chart surfaces. */
  @property({ attribute: false }) formatter?: LyraChartFormatter;

  /**
   * True until the lazy-loaded `chart.js` + `@sgratzl/chartjs-chart-boxplot`
   * peer dependencies have settled (success or failure) — mirrors
   * `LyraChart`'s `loading` state.
   */
  @state() private loading = true;
  @state() private loadFailed = false;

  @state() private visible = true;
  /** Position of the keyboard cursor within `boxDatums()`; clamped on every read, never persisted. */
  private keyboardDatumIndex = 0;
  @state() private keyboardDatumAnnouncement = '';
  private intersectionObserver?: IntersectionObserver;
  private intersectionGeneration = 0;
  private reducedMotionQuery?: MediaQueryList;
  private reducedMotionWindow?: BrowserWindow;

  @query('canvas') private canvasEl?: HTMLCanvasElement;
  private chart?: BoxPlotChartRuntime;
  private chartJsModule?: ChartJsModule;
  private loadGeneration = 0;
  private descriptionId = nextId('box-plot-description');
  private lastDrawnDirection?: 'ltr' | 'rtl';
  private lastDrawnLocale?: string;
  private politeAnnouncementSink?: AnnouncementSink;
  private assertiveAnnouncementSink?: AnnouncementSink;
  private lastDataTruncationAnnouncement = '';
  /** Gates the sampling notice so an initially supplied large dataset is described, not announced. */
  private isMounting = true;

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncAnnouncementSinks();
    this.visible = true;
    this.armReducedMotionWatcher();
    const generation = ++this.loadGeneration;
    void loadBoxPlotPlugin().then((boxMod) => this.onBoxPlotPluginLoaded(boxMod, generation));
    const IntersectionObserverCtor = this.ownerWindow?.IntersectionObserver;
    if (IntersectionObserverCtor) {
      const ownerWindow = this.ownerWindow;
      const observerGeneration = ++this.intersectionGeneration;
      const observer = new IntersectionObserverCtor((entries) => {
        if (
          observerGeneration !== this.intersectionGeneration ||
          this.intersectionObserver !== observer ||
          !this.isConnected ||
          this.ownerWindow !== ownerWindow
        ) return;
        const wasVisible = this.visible;
        this.visible = entries[0]?.isIntersecting ?? true;
        if (this.visible && !wasVisible) this.drawIfVisible();
      });
      this.intersectionObserver = observer;
      observer.observe(this);
    }
  }

  // Split out from `connectedCallback()` so the partial-peer-dependency-
  // failure path (chart.js loads fine, `@sgratzl/chartjs-chart-boxplot`
  // doesn't) is directly testable: `loadBoxPlotPlugin()` resolves to `null`
  // without ever registering `BoxPlotController`/`BoxAndWiskers` in that
  // case, so this must gate on its resolved value — mirroring the correct,
  // established pattern in `LyraChart.connectedCallback()` — instead of
  // unconditionally re-awaiting the already-cached `loadChartJs()` promise.
  //
  // Also guards against a disconnect while either lazy peer import is still
  // in flight: `this.isConnected` is re-checked after each `await` gap, so a
  // `<lr-box-plot>` removed before the load settles never constructs a
  // `Chart` bound to a (possibly detached) canvas.
  private async onBoxPlotPluginLoaded(
    boxMod: BoxPlotModule | null,
    generation = this.loadGeneration,
  ): Promise<void> {
    if (generation !== this.loadGeneration || !this.isConnected) return;
    // Preserve the server/client loading branch through the first update. A cached optional peer
    // can otherwise settle during upgrade and skip both the observable loading state and Lit's
    // declarative-shadow-DOM hydration boundary. The shared browser-state seam holds the ensuing
    // branch change until first-hydration observers have seen the claimed server nodes.
    try {
      await this.updateComplete;
    } catch {
      return;
    }
    await new Promise<void>((resolve) => this.updateBrowserDerivedState(resolve));
    if (generation !== this.loadGeneration || !this.isConnected) return;
    this.loading = false;
    if (!boxMod) {
      this.loadFailed = true;
      this.chart?.destroy();
      this.chart = undefined;
      this.chartJsModule = undefined;
      return;
    }
    this.loadFailed = false;
    const chartMod = await loadChartJs();
    if (generation !== this.loadGeneration || !this.isConnected) return;
    this.chartJsModule = chartMod ?? undefined;
    this.drawIfVisible();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.releaseAnnouncementSinks();
    this.lastDataTruncationAnnouncement = '';
    this.isMounting = true;
    this.loadGeneration += 1;
    this.chart?.destroy();
    this.chart = undefined;
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = undefined;
    this.intersectionGeneration += 1;
    this.visible = true;
    this.disarmReducedMotionWatcher();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.releaseAnnouncementSinks();
    this.syncAnnouncementSinks();
    this.armReducedMotionWatcher();
  }

  private readonly onReducedMotionChange = (): void => {
    if (!this.isConnected || this.ownerWindow !== this.reducedMotionWindow) return;
    this.drawIfVisible();
  };

  private armReducedMotionWatcher(): void {
    const ownerWindow = this.ownerWindow;
    if (!ownerWindow?.matchMedia) return;
    if (this.reducedMotionWindow === ownerWindow && this.reducedMotionQuery) return;
    this.disarmReducedMotionWatcher();
    this.reducedMotionWindow = ownerWindow;
    this.reducedMotionQuery = ownerWindow.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotionQuery.addEventListener('change', this.onReducedMotionChange);
  }

  private disarmReducedMotionWatcher(): void {
    this.reducedMotionQuery?.removeEventListener('change', this.onReducedMotionChange);
    this.reducedMotionQuery = undefined;
    this.reducedMotionWindow = undefined;
  }

  private syncAnnouncementSinks(): void {
    if (!this.isConnected) return;
    if (
      this.politeAnnouncementSink?.element.ownerDocument === this.ownerDocument &&
      this.assertiveAnnouncementSink?.element.ownerDocument === this.ownerDocument
    ) return;
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
    // Optional-chained for the server-render path: @lit-labs/ssr's element shim has no
    // `ownerDocument`, and every caller already handles `undefined`.
    return (this.ownerDocument?.defaultView as BrowserWindow | null | undefined) ?? undefined;
  }

  private effectiveHiddenDatasetIndexes(): number[] {
    return normalizeHiddenDatasets(this.hiddenDatasets, this.datasets.length) ?? [];
  }

  /** Synchronizes the public controlled visibility snapshot with Chart.js after data replacement. */
  private applyDatasetVisibility(): boolean {
    if (!this.chart) return false;
    const datasetCount = this.chart.data.datasets?.length ?? 0;
    const sourceSeriesIndexes = this.dataTableSample().seriesIndexes;
    const controlled = normalizeHiddenDatasets(this.hiddenDatasets, this.datasets.length);
    if (controlled === undefined) {
      for (let index = 0; index < datasetCount; index++) {
        const metadata = this.chart.getDatasetMeta?.(index);
        if (metadata) metadata.hidden = null;
      }
      return datasetCount > 0;
    }
    const hidden = new Set(controlled);
    for (let index = 0; index < datasetCount; index++) {
      this.chart.setDatasetVisibility(index, !hidden.has(sourceSeriesIndexes[index] ?? index));
    }
    return datasetCount > 0;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
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
      this.assertiveAnnouncementSink?.announce(this.localize('boxPlotMissingLibrary'));
    }
    const dataTruncation = this.dataTruncationMessage();
    if (wasMounting) this.lastDataTruncationAnnouncement = dataTruncation;
    if (!this.loading && !this.loadFailed) {
      if (!wasMounting && dataTruncation !== this.lastDataTruncationAnnouncement) {
        this.lastDataTruncationAnnouncement = dataTruncation;
        if (dataTruncation) this.politeAnnouncementSink?.announce(dataTruncation);
      }
    }
    this.setAttribute('aria-busy', String(this.loading));

    // Keep the public CSS hook consumer-owned; the property is only a private fallback.
    if (changed.has('height')) {
      const height = sanitizeCssLength(this.height, 'height');
      if (height) this.style.setProperty('--_lr-chart-height', height);
      else this.style.removeProperty('--_lr-chart-height');
    }
    if (this.loading) return;
    const contentChanged = ['labels', 'datasets', 'hiddenDatasets', 'legend', 'legendPosition', 'height', 'yLabel', 'beginAtZero', 'label', 'description', 'valueFormatter', 'formatter', 'locale', 'strings', 'loading'].some((name) =>
      changed.has(name),
    );
    const direction = this.effectiveDirection;
    const locale = this.effectiveLocale;
    const contextChanged =
      (this.lastDrawnDirection !== undefined && this.lastDrawnDirection !== direction) ||
      (this.lastDrawnLocale !== undefined && this.lastDrawnLocale !== locale);
    this.lastDrawnDirection = direction;
    this.lastDrawnLocale = locale;
    if (!contentChanged && !contextChanged) return;
    this.drawIfVisible();
  }

  /**
   * Resolves the `--lr-chart-*` theme tokens (declared in
   * `box-plot.styles.ts`, each layered over an existing semantic token) via
   * `getComputedStyle`. Chart.js renders to canvas, not the DOM, so it can't
   * consume CSS `var()` directly — same constraint `chart.ts`'s
   * `themeColors()` documents — so this is called fresh from `buildConfig()`
   * on every draw rather than cached. Each computed value is also round-tripped
   * through a CSS color probe; invalid expressions fail to a concrete semantic
   * fallback instead of silently preserving an earlier canvas paint.
   */
  private themeColors(): ThemeColors {
    const view = this.ownerWindow;
    const cs = view ? view.getComputedStyle(this) : this.style;
    return {
      grid: resolveCanvasColor(
        this,
        cs.getPropertyValue('--lr-chart-grid-color').trim() ||
          cs.getPropertyValue('--_lr-chart-grid-color').trim(),
        FALLBACK_GRID_COLOR,
      ),
      tick: resolveCanvasColor(
        this,
        cs.getPropertyValue('--lr-chart-tick-color').trim() ||
          cs.getPropertyValue('--_lr-chart-tick-color').trim(),
        FALLBACK_TICK_COLOR,
      ),
      legend: resolveCanvasColor(
        this,
        cs.getPropertyValue('--lr-chart-legend-color').trim() ||
          cs.getPropertyValue('--_lr-chart-legend-color').trim(),
        FALLBACK_LEGEND_COLOR,
      ),
      tooltipBg: resolveCanvasColor(
        this,
        cs.getPropertyValue('--lr-chart-tooltip-bg').trim() ||
          cs.getPropertyValue('--_lr-chart-tooltip-bg').trim(),
        FALLBACK_TOOLTIP_BG,
      ),
      tooltipText: resolveCanvasColor(
        this,
        cs.getPropertyValue('--lr-chart-tooltip-text').trim() ||
          cs.getPropertyValue('--_lr-chart-tooltip-text').trim(),
        FALLBACK_TOOLTIP_TEXT,
      ),
    };
  }

  /** The series color for a box index, honoring an explicit per-series `color` override. */
  private seriesColor(index: number, palette: string[] = seriesPalette(this)): string {
    const fallback = palette[index % palette.length] ?? 'transparent';
    const series = this.datasets[index];
    return series?.color ? resolveCanvasColor(this, series.color, fallback) : fallback;
  }

  /**
   * The forced-colors texture painted over a box's fill, or `undefined` while the user is on a
   * normal palette. Mirrors `<lr-chart>`'s accommodation for its proportional types: forced-colors
   * mode collapses the eight-color `--lr-color-chart-*` ramp onto a repeating three-value system
   * cycle, so series 1/4/7 paint in the same color and only texture keeps them apart. Box-and-
   * whisker elements read `backgroundColor` straight into `ctx.fillStyle`, so a `CanvasPattern` is
   * the channel available here — the peer's element has no border-dash or point-style option to
   * cycle the way a Chart.js line dataset does.
   */
  private forcedColorFill(index: number, background: string): CanvasPattern | string {
    if (!this.ownerWindow || !forcedColorsActive(this.ownerWindow)) return background;
    return createForcedColorPattern(
      this.ownerDocument,
      index,
      background,
      this.styleColor('--lr-color-surface', FALLBACK_TOOLTIP_BG),
    );
  }

  private styleColor(name: string, fallback: string): string {
    const view = this.ownerWindow;
    const cs = view ? view.getComputedStyle(this) : this.style;
    const value = cs.getPropertyValue(name).trim();
    return value ? resolveCanvasColor(this, value, fallback) : fallback;
  }

  private buildConfig(): BoxPlotChartConfiguration {
    const theme = this.themeColors();
    const palette = seriesPalette(this);
    const sample = this.dataTableSample();
    return {
      // boxplot isn't in chart.js's static ChartType union — same cast the seed uses.
      type: 'boxplot' as never,
      data: {
        labels: sample.rowIndexes.map((index) => this.labels[index] ?? ''),
        datasets: sample.seriesIndexes.map((sourceIndex) => {
          const s = this.datasets[sourceIndex]!;
          const color = this.seriesColor(sourceIndex, palette);
          return {
            label: s.label,
            // The peer annotates each summary object in place. Never pass a caller-owned object
            // across that boundary, even when it is already valid.
            data: sample.rowIndexes.map((index) => {
              const point = s.data[index];
              return this.validPoint(point) ? summaryOf(point) : null;
            }),
            backgroundColor: this.forcedColorFill(sourceIndex, color),
            borderColor: color,
          };
        }),
      },
      options: {
        locale: this.effectiveLocale,
        responsive: true,
        maintainAspectRatio: false,
        animation: prefersReducedMotion(this.ownerWindow) ? false : undefined,
        onClick: (event: unknown, _elements: unknown, chart: BoxPlotChartRuntime) =>
          this.handlePointClick(event, chart),
        plugins: {
          // The normal-flow DOM legend below can wrap long public labels; a canvas legend cannot.
          legend: { display: false, labels: { color: theme.legend } },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            ...((this.formatter || this.valueFormatter)
              ? {
                  callbacks: {
                    label: (context: { dataset?: { label?: unknown }; raw?: unknown }) => {
                      const raw = context.raw;
                      const point = this.validPoint(raw as LyraBoxPlotSummary)
                        ? (raw as LyraBoxPlotSummary)
                        : undefined;
                      if (!point) return undefined;
                      const value = this.formatValue(point.median, 'tooltip');
                      const label = String(context.dataset?.label ?? '');
                      return label
                        ? this.localize('chartValueLabel', undefined, { label, value })
                        : value;
                    },
                  },
                }
              : {}),
          },
        },
        scales: {
          x: {
            ticks: { color: theme.tick },
            grid: { color: theme.grid },
          },
          y: {
            position: this.effectiveDirection === 'rtl' ? 'right' : 'left',
            beginAtZero: this.beginAtZero,
            title: { display: !!this.yLabel, text: this.yLabel, color: theme.tick },
            ticks: {
              color: theme.tick,
              ...((this.formatter || this.valueFormatter)
                ? { callback: (value: unknown) => this.formatValue(Number(value), 'tick') }
                : {}),
            },
            grid: { color: theme.grid },
          },
        },
      } as never,
    };
  }

  // Mirrors `LyraChart.draw()`'s reuse-existing-instance-when-possible
  // pattern: an update that doesn't need a new Chart.js instance (e.g. a
  // bare `height` change, or new `datasets`/`labels` data) mutates the existing
  // chart and does an incremental `.update('none')` instead of tearing down
  // and rebuilding the whole canvas/instance on every reactive update. Unlike
  // `LyraChart`, `LyraBoxPlot` has no raw `config` passthrough that could
  // change the effective Chart.js type out from under `this.type`, so
  // reusing whenever a chart already exists is always safe here.
  private draw(): void {
    if (!this.chartJsModule || !this.canvasEl) return;
    const config = this.buildConfig();
    if (this.chart) {
      this.chart.data = config.data;
      this.chart.options = config.options ?? {};
      this.applyDatasetVisibility();
      this.chart.update('none');
      return;
    }
    this.chart = new this.chartJsModule.Chart(
      this.canvasEl,
      config as never,
    ) as unknown as BoxPlotChartRuntime;
    if (this.hiddenDatasets !== undefined) {
      this.applyDatasetVisibility();
      this.chart.update('none');
    }
  }

  private drawIfVisible(): void {
    if (!this.isConnected || !this.visible) return;
    this.draw();
  }

  /** Re-reads canvas theme custom properties after an out-of-band ancestor theme change. */
  refreshTheme(): void {
    this.drawIfVisible();
    if (this.legend) this.requestUpdate();
  }

  private formatValue(
    value: number,
    surface: LyraChartFormatSurface,
    metadata: LyraChartFormatterMetadata = {},
  ): string {
    const legacyContext: LyraChartValueFormatterContext | undefined =
      surface === 'export' || surface === 'spoken'
        ? 'table'
        : surface === 'visual'
          ? undefined
          : surface;
    return this.formatter?.({ value, surface, ...metadata }) ??
      (legacyContext ? this.valueFormatter?.(value, legacyContext) : undefined) ??
      getNumberFormat(this.effectiveLocale).format(value);
  }

  /** Returns a spreadsheet-safe CSV snapshot or the current canvas PNG data URL. */
  exportData(format: 'csv' | 'png'): string {
    if (format === 'png') {
      return (this.chart as BoxPlotChartRuntime & { toBase64Image?(): string } | undefined)
        ?.toBase64Image?.() ?? '';
    }
    const header = [
      'category',
      'series',
      'min',
      'q1',
      'median',
      'q3',
      'max',
    ].map(escapeCsvField).join(',');
    const rows: string[] = [];
    this.datasets.forEach((series, datasetIndex) => {
      series.data.forEach((point, index) => {
        if (!this.validPoint(point)) return;
        const metadata: LyraChartFormatterMetadata = {
          datasetIndex,
          index,
          label: this.labels[index] || undefined,
          seriesLabel: series.label,
        };
        rows.push([
          this.labels[index] ?? '',
          series.label,
          this.formatValue(point.min, 'export', { ...metadata, statistic: 'min' }),
          this.formatValue(point.q1, 'export', { ...metadata, statistic: 'q1' }),
          this.formatValue(point.median, 'export', { ...metadata, statistic: 'median' }),
          this.formatValue(point.q3, 'export', { ...metadata, statistic: 'q3' }),
          this.formatValue(point.max, 'export', { ...metadata, statistic: 'max' }),
        ].map(escapeCsvField).join(','));
      });
    });
    return [header, ...rows].join('\r\n');
  }

  private boxPlotDescription(): string {
    if (this.description) return this.description;
    const sample = this.dataTableSample();
    const summaries = sample.seriesIndexes.map((index) => {
      const series = this.datasets[index]!;
      let count = 0;
      let first = 0;
      let last = 0;
      let min = 0;
      let minIndex = 0;
      let max = 0;
      let maxIndex = 0;
      for (const [pointIndex, point] of series.data.entries()) {
        if (!this.validPoint(point)) continue;
        if (count === 0) {
          first = point.median;
          min = point.median;
          minIndex = pointIndex;
          max = point.median;
          maxIndex = pointIndex;
        }
        last = point.median;
        if (point.median < min) {
          min = point.median;
          minIndex = pointIndex;
        }
        if (point.median > max) {
          max = point.median;
          maxIndex = pointIndex;
        }
        count++;
      }
      if (count === 0) return this.localize('chartSeriesNoData', undefined, { label: series.label });
      const trend =
        last > first
          ? this.localize('chartTrendIncreasing')
          : last < first
            ? this.localize('chartTrendDecreasing')
            : this.localize('chartTrendFlat');
      return this.localize('boxPlotSeriesSummary', undefined, {
        label: series.label,
        count: getNumberFormat(this.effectiveLocale).format(count),
        min: this.formatValue(min, 'spoken', {
          datasetIndex: index,
          index: minIndex,
          label: this.labels[minIndex] || undefined,
          seriesLabel: series.label,
          statistic: 'median',
        }),
        max: this.formatValue(max, 'spoken', {
          datasetIndex: index,
          index: maxIndex,
          label: this.labels[maxIndex] || undefined,
          seriesLabel: series.label,
          statistic: 'median',
        }),
        trend,
      });
    });
    return summaries.length
      ? this.localize('boxPlotSummaryWithData', undefined, {
          summaries: summaries.join(this.localize('chartSummarySeparator')),
        })
      : this.localize('boxPlotSummaryEmpty');
  }

  /**
   * The addressable boxes, in the same series-major order the generated data table lists them.
   * Built from the table's bounded planner rather than a raw scan so the keyboard alternative can
   * never turn a very wide consumer data set into an unbounded pass.
   */
  private boxDatums(): LyraBoxPlotPointDetail[] {
    const sample = this.dataTableSample();
    const datums: LyraBoxPlotPointDetail[] = [];
    for (const datasetIndex of sample.seriesIndexes) {
      const series = this.datasets[datasetIndex];
      if (!series) continue;
      for (const index of sample.rowIndexes) {
        const point = series.data[index];
        if (!this.validPoint(point)) continue;
        datums.push({
          datasetIndex,
          index,
          label: this.labels[index] || undefined,
          value: summaryOf(point),
        });
      }
    }
    return datums;
  }

  /**
   * A box's spoken summary. The five numbers are the whole content of a box, so each is labeled
   * with its own existing localized term and joined through the shared separator — the same
   * composition `boxPlotDescription()` already uses — then interpolated into the family's mark
   * summary as that mark's value.
   */
  private boxAnnouncement(
    datum: LyraBoxPlotPointDetail,
    position: number,
    total: number,
  ): string {
    const numberFormat = getNumberFormat(this.effectiveLocale);
    const point = datum.value;
    const parts: Array<[LyraChartStatistic, string, number]> = point
      ? [
          ['min', this.localize('boxPlotMin'), point.min],
          ['q1', this.localize('boxPlotQ1'), point.q1],
          ['median', this.localize('boxPlotMedian'), point.median],
          ['q3', this.localize('boxPlotQ3'), point.q3],
          ['max', this.localize('boxPlotMax'), point.max],
        ]
      : [];
    const summary = parts
      .filter(([, , value]) => Number.isFinite(value))
      .map(([statistic, label, value]) =>
        this.localize('chartValueLabel', undefined, {
          label,
          value: this.formatValue(value, 'spoken', {
            datasetIndex: datum.datasetIndex,
            index: datum.index,
            label: datum.label,
            seriesLabel: this.datasets[datum.datasetIndex]?.label,
            statistic,
          }),
        }),
      )
      .join(this.localize('chartSummarySeparator'));
    return this.localize('liteChartMarkSummary', undefined, {
      series: this.datasets[datum.datasetIndex]?.label || this.localize('chartSeriesLabel'),
      label:
        datum.label ??
        this.localize('chartPointLabel', undefined, {
          n: numberFormat.format(datum.index + 1),
        }),
      value: summary,
      index: numberFormat.format(position + 1),
      total: numberFormat.format(total),
    });
  }

  private activateBox(datum: LyraBoxPlotPointDetail): void {
    const datums = this.boxDatums();
    const position = datums.findIndex(
      (candidate) =>
        candidate.datasetIndex === datum.datasetIndex && candidate.index === datum.index,
    );
    if (position >= 0) {
      this.keyboardDatumIndex = position;
      this.keyboardDatumAnnouncement = this.boxAnnouncement(datum, position, datums.length);
    }
    this.emit('lr-datum-activate', { ...datum, kind: 'box' });
    this.emit('lr-point-click', datum);
  }

  /**
   * `options.onClick`, wired in `buildConfig()`. Resolving which single box was clicked needs its
   * own `getElementsAtEventForMode('nearest', { intersect: true }, true)` lookup, so a click that
   * lands off every box reports nothing rather than firing for whatever happens to be nearest.
   */
  private handlePointClick(event: unknown, chart: BoxPlotChartRuntime): void {
    // Chart.js hands its own `ChartEvent` wrapper to `onClick`, but `getElementsAtEventForMode()`
    // types its first parameter as a DOM `Event`; at runtime only `.x`/`.y` are read, which the
    // wrapper already has, so the cast is a type-only correction.
    const hit = chart.getElementsAtEventForMode?.(
      event as Event,
      'nearest',
      { intersect: true },
      true,
    )?.[0];
    if (!hit) return;
    const sample = this.dataTableSample();
    const datasetIndex = sample.seriesIndexes[hit.datasetIndex];
    const index = sample.rowIndexes[hit.index];
    if (datasetIndex === undefined || index === undefined) return;
    const point = this.datasets[datasetIndex]?.data[index];
    this.activateBox({
      datasetIndex,
      index,
      label: this.labels[index] || undefined,
      value: this.validPoint(point) ? summaryOf(point) : null,
    });
  }

  private onCanvasFocus(): void {
    const datums = this.boxDatums();
    if (!datums.length) return;
    this.keyboardDatumIndex = Math.min(this.keyboardDatumIndex, datums.length - 1);
    this.keyboardDatumAnnouncement = this.boxAnnouncement(
      datums[this.keyboardDatumIndex]!,
      this.keyboardDatumIndex,
      datums.length,
    );
  }

  private onCanvasKeyDown(event: KeyboardEvent): void {
    const datums = this.boxDatums();
    if (!datums.length) return;
    this.keyboardDatumIndex = Math.min(this.keyboardDatumIndex, datums.length - 1);
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.activateBox(datums[this.keyboardDatumIndex]!);
      return;
    }
    // "Previous"/"next" follow the reading order, so the two arrows swap under RTL.
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
    this.keyboardDatumAnnouncement = this.boxAnnouncement(datums[next]!, next, datums.length);
  }

  private validPoint(point: LyraBoxPlotSummary | null | undefined): point is LyraBoxPlotSummary {
    return !!point &&
      [point.min, point.q1, point.median, point.q3, point.max].every(Number.isFinite) &&
      point.min <= point.q1 &&
      point.q1 <= point.median &&
      point.median <= point.q3 &&
      point.q3 <= point.max;
  }

  private accessibleName(fallback: string): string {
    return this.getAttribute('aria-label') ?? this.label ?? fallback;
  }

  private dataTableSample() {
    // Avoid spreading an unbounded consumer-provided list into Math.max(); this
    // table remains the bounded accessible fallback even for very wide data.
    let rowCount = this.labels.length;
    for (const series of this.datasets) rowCount = Math.max(rowCount, series.data.length);
    const indexes = sampleChartTableIndexes(rowCount, this.datasets.length);
    return { rowCount, seriesCount: this.datasets.length, ...indexes };
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
    const numberFormat = getNumberFormat(this.effectiveLocale);
    const sample = this.dataTableSample();
    return html`
      <table class=${this.dataTableVisible ? '' : 'sr-only'}>
        <caption>${this.accessibleName(this.localize('boxPlotData'))}</caption>
        <thead>
          <tr>
            <th scope="col">${this.localize('chartCategory')}</th>
            <th scope="col">${this.localize('chartSeriesLabel')}</th>
            <th scope="col">${this.localize('boxPlotMin')}</th>
            <th scope="col">${this.localize('boxPlotQ1')}</th>
            <th scope="col">${this.localize('boxPlotMedian')}</th>
            <th scope="col">${this.localize('boxPlotQ3')}</th>
            <th scope="col">${this.localize('boxPlotMax')}</th>
          </tr>
        </thead>
        <tbody>
          ${sample.seriesIndexes.flatMap((seriesIndex) => {
            const series = this.datasets[seriesIndex]!;
            return sample.rowIndexes.map(
              (index) => {
                const point = series.data[index];
                const metadata: LyraChartFormatterMetadata = {
                  datasetIndex: seriesIndex,
                  index,
                  label: this.labels[index] || undefined,
                  seriesLabel: series.label,
                };
                return this.validPoint(point) ? html`
                <tr>
                  <th scope="row">${this.labels[index] ?? this.localize('chartPointLabel', undefined, {
                    n: numberFormat.format(index + 1),
                  })}</th>
                  <td>${series.label}</td>
                  <td>${this.formatValue(point.min, 'table', { ...metadata, statistic: 'min' })}</td>
                  <td>${this.formatValue(point.q1, 'table', { ...metadata, statistic: 'q1' })}</td>
                  <td>${this.formatValue(point.median, 'table', { ...metadata, statistic: 'median' })}</td>
                  <td>${this.formatValue(point.q3, 'table', { ...metadata, statistic: 'q3' })}</td>
                  <td>${this.formatValue(point.max, 'table', { ...metadata, statistic: 'max' })}</td>
                </tr>
              ` : nothing;
              },
            );
          })}
        </tbody>
      </table>
    `;
  }

  private hasCustomDataTable(): boolean {
    return Array.from(this.children).some((child) => child.getAttribute('slot') === 'data-table');
  }

  private toggleDataset(index: number): void {
    if (!this.chart) return;
    if (index < 0 || index >= this.datasets.length) return;
    const hidden = this.effectiveHiddenDatasetIndexes();
    const wasHidden = hidden.includes(index);
    const nextHidden = wasHidden
      ? hidden.filter((candidate) => candidate !== index)
      : [...hidden, index].sort((left, right) => left - right);
    // A currently hidden series becomes visible; a currently visible one becomes hidden.
    const visible = wasHidden;
    const proposed = this.emit(
      'lr-before-legend-visibility-change',
      legendVisibilityDetail(index, visible, nextHidden),
      { cancelable: true },
    );
    if (proposed.defaultPrevented) return;
    this.hiddenDatasets = nextHidden;
    this.applyDatasetVisibility();
    this.chart.update('none');
    this.requestUpdate();
    this.emit('lr-legend-visibility-change', legendVisibilityDetail(index, visible, nextHidden));
  }

  private renderLegend(): TemplateResult | typeof nothing {
    if (!this.legend) return nothing;
    const palette = seriesPalette(this);
    const forced = forcedColorsActive(this.ownerWindow);
    const controlledHidden = normalizeHiddenDatasets(this.hiddenDatasets, this.datasets.length);
    const controlledHiddenSet = controlledHidden === undefined
      ? undefined
      : new Set(controlledHidden);
    const sample = this.dataTableSample();
    return html`
      <div part="legend" role="group" aria-label=${this.accessibleName(this.localize('boxPlot'))}>
        ${sample.seriesIndexes.map((index) => {
          const series = this.datasets[index]!;
          const color = this.seriesColor(index, palette);
          // As in `LyraChart`, public controlled state replaces unobservable Chart.js metadata.
          const visible = controlledHiddenSet === undefined || !controlledHiddenSet.has(index);
          const encoding: ForcedColorEncodingName | undefined = forced
            ? forcedColorEncoding(index).name
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
                data-encoding=${encoding ?? nothing}
                style="background-color:${color}"
              ></span>
              <span>${series.label}</span>
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
          <span class="sr-only">${this.localize('loading')}</span>
          <lr-skeleton shape="rect" .announce=${false}></lr-skeleton>
        </div>
      `;
    }
    if (this.loadFailed) {
      return html`
        <div part="base">
          <div part="error">${this.localize('boxPlotMissingLibrary')}</div>
        </div>
      `;
    }
    const boxLabels = this.dataTableSample().seriesIndexes.map((index) => this.datasets[index]!.label);
    const label = this.accessibleName(
      (boxLabels.length
        ? getListFormat(this.effectiveLocale, { type: 'conjunction' }).format(boxLabels)
        : '') || this.localize('boxPlot'),
    );
    const description = this.boxPlotDescription();
    const hasCustomDataTable = this.hasCustomDataTable();
    return html`
      <div
        part="base"
        data-legend-position=${this.legend
          ? chartChromeLegendPlacement(this.legendPosition)
          : nothing}
      >
        <div part="plot">
          <canvas
            part="canvas"
            role="application"
            aria-roledescription=${this.localize('boxPlot')}
            tabindex="0"
            aria-label=${label}
            aria-describedby=${this.descriptionId}
            @focus=${this.onCanvasFocus}
            @keydown=${this.onCanvasKeyDown}
          ></canvas>
        </div>
        ${this.renderLegend()}
        <p part="description" id=${this.descriptionId} class="sr-only">${description}</p>
        <p class="sr-only" aria-hidden="true">${this.keyboardDatumAnnouncement}</p>
        ${this.dataTruncationMessage()
          ? html`<p part="data-truncation">${this.dataTruncationMessage()}</p>`
          : nothing}
        ${this.dataTableToggle
          ? html`<button
              part="data-table-toggle"
              type="button"
              aria-expanded=${this.dataTableVisible ? 'true' : 'false'}
              aria-controls=${this.dataTableId}
              @click=${() => this.toggleDataTable()}
            >
              ${this.localize('boxPlotData')}
            </button>`
          : nothing}
        <div
          id=${this.dataTableId}
          part="data-table"
          ?data-visually-hidden=${!this.dataTableVisible}
        >
          <slot name="data-table" @slotchange=${() => this.requestUpdate()}></slot>
          ${hasCustomDataTable ? nothing : this.renderDataTable()}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-box-plot': LyraBoxPlot;
  }
}
