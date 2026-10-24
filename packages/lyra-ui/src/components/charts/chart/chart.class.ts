import { SpatialSourceController, spatialContains } from '../../../internal/spatial-source-controller.js';
import type { LyraSpatialBounds, LyraSpatialBin, LyraSpatialChartPoint, LyraSpatialChartSource, LyraChartSpatialPointSelectDetail, LyraSpatialBinSelectDetail } from '../../../utilities/data-spatial.js';
export type { LyraSpatialBounds, LyraSpatialBin, LyraSpatialChartPoint, LyraSpatialChartSeries, LyraSpatialChartSource, LyraChartSpatialPointSelectDetail, LyraSpatialBinSelectDetail } from '../../../utilities/data-spatial.js';
import { spatialCoordinate, spatialOriginal, spatialPaintRadius, spatialCsv } from './chart-spatial-data.js';
import { SourceRequestController } from '../../../internal/source-request-controller.js';
import { prepareChartModel, withPreparedPoint, withPreparedRange, preparedResponse, type PreparedChartModel, type LyraChartPreparedData, type LyraChartSourcePointSelectDetail, type LyraChartSourceCategorySelectDetail } from './chart-prepared-data.js';
import type { LyraSeriesPointRef } from '../../../utilities/data-preparation.js';
export type { LyraChartPreparedData, LyraChartSourcePointSelectDetail, LyraChartSourceCategorySelectDetail } from './chart-prepared-data.js';
export type { LyraPreparedSeriesData, LyraPreparedCategoryData, LyraPreparedSeries, LyraSeriesSample, LyraSeriesPointRef, LyraSeriesObservation, LyraSeriesRangeRequest } from '../../../utilities/data-preparation.js';
import { snapshotStructuredData, admitSnapshotArray, snapshotArrayStillAdmitted as chartArrayIsStillAdmitted, projectSnapshotArray, type SnapshotArrayAdmission as ChartArrayAdmission } from '../../../internal/structured-snapshot.js';
import type { ChartSyncPresentation } from './chart-sync.js';
import { LazyChartSyncController } from './chart-sync-lazy.js';
import { collectionSupport } from '../../../internal/collection-snapshot.js';
import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { specialistTokens } from '../../../internal/specialist-host-tokens.styles.js';
import { nextId, srOnly } from '../../../internal/a11y.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { createReducedMotionWatch } from './chart-surface-shared.js';
import { ThemeWatcher } from '../../../internal/theme-watcher.js';
import { loadChartJs, type ChartJsModule } from './chart-core-loader.js';
import { onAnnotationPluginRegistered } from '../../../internal/chart-annotation-registration.js';
import { collectInitialSlotAssignment } from '../../../internal/initial-slot-collection.js';
import {
  loadChartJsWithZoom,
  loadChartJsWithZoomResult,
  loadChartJsWithDataLabelsResult,
  loadChartJsWithAnnotationResult,
  type ChartFeatureLoadResult,
  type DataLabelsPlugin,
  type AnnotationPlugin,
  type ZoomPlugin,
} from './chart-feature-loader.js';
import { styles } from './chart.styles.js';
import { chartSurfaceStyles } from './chart-surface.styles.js';
import '../../overlays/skeleton/skeleton.class.js';
import { getListFormat, getNumberFormat } from '../../../internal/intl-cache.js';
import { formatChartValue } from './chart-number-format.js';
import { escapeCsvField } from '../../utility/export-button/csv.js';
import { finiteAdd, finiteNumber } from '../../../internal/numbers.js';
import { isKeyboardFocusEvent } from '../../../internal/focus-modality.js';
import { showChartActiveDatum } from './chart-active-datum.js';
import { devWarnOnce } from '../../../internal/dev-warning.js';
import {
  getOwnDataDescriptor,
  readOwnDataValue,
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
} from '../../../internal/data-descriptors.js';
import { sanitizeCssLength } from '../../../internal/safe-css.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import {
  FALLBACK_GRID_COLOR,
  FALLBACK_LEGEND_COLOR,
  FALLBACK_TICK_COLOR,
  FALLBACK_TICK_FONT_SIZE,
  FALLBACK_TOOLTIP_BG,
  FALLBACK_TOOLTIP_TEXT,
  type ChartThemeColors as ThemeColors,
} from './chart-colors.js';
import { ChartTokenCache } from './chart-token-cache.js';
import { chartDataTableVisible, hasSlottedChartDataTable } from './chart-data-table.js';
import { normalizeSize, type LyraSize, type LyraVariant } from '../../../internal/variants.js';
import {
  createForcedColorPattern,
  forcedColorEncoding,
  forcedColorsActive,
  type ForcedColorEncodingName,
} from './chart-forced-colors.js';
import {
  legendVisibilityDetail,
  normalizeHiddenDatasets,
  type LyraChartLegendVisibilityChangeDetail,
  type LyraChartDatumVisibilityChangeDetail,
} from './chart-legend-visibility.js';
export type { LyraChartLegendVisibilityChangeDetail, LyraChartDatumVisibilityChangeDetail } from './chart-legend-visibility.js';
import { sampleChartTableIndexes, normalizeChartRecordLimit } from './chart-table-sampling.js';
import {
  canvasSentence,
  canvasTextDirection,
  type IsolatableMessage,
  isolateCanvasLabel,
  isolateCanvasText,
  isolatedMessage,
  isolateScaleTickLabels,
  tooltipIsolationHook,
  type ChartTextDirection,
  bidiStyles,
  isolateHtml,
} from './chart-bidi.js';import { CSS_NUMBER_SOURCE } from '../../../internal/css-number.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_chartAnnotationsUnavailable, LYRA_DEFAULT_chartAxisTotal, LYRA_DEFAULT_chartBubblePointCoordinates, LYRA_DEFAULT_chartCategory, LYRA_DEFAULT_chartData, LYRA_DEFAULT_chartDataLabelsUnavailable, LYRA_DEFAULT_chartDataSampled, LYRA_DEFAULT_chartInputLimit, LYRA_DEFAULT_chartLabeledPoint, LYRA_DEFAULT_chartMissingLibrary, LYRA_DEFAULT_chartPlotSampled, LYRA_DEFAULT_chartPointCoordinates, LYRA_DEFAULT_chartPointLabel, LYRA_DEFAULT_chartPreparedSummaryZoom, LYRA_DEFAULT_chartPrimaryAxis, LYRA_DEFAULT_chartRenderUnavailable, LYRA_DEFAULT_chartSecondaryAxis, LYRA_DEFAULT_chartSeriesLabel, LYRA_DEFAULT_chartSeriesNoData, LYRA_DEFAULT_chartSpatialBin, LYRA_DEFAULT_chartSpatialDensityLegend, LYRA_DEFAULT_chartSpatialHidden, LYRA_DEFAULT_chartSpatialPoint, LYRA_DEFAULT_chartSpatialRadiusDomain, LYRA_DEFAULT_chartSpatialSummary, LYRA_DEFAULT_chartStackTotalsUnavailable, LYRA_DEFAULT_chartSummaryEmpty, LYRA_DEFAULT_chartSummaryWithData, LYRA_DEFAULT_chartTotal, LYRA_DEFAULT_chartTypeBar, LYRA_DEFAULT_chartTypeBubble, LYRA_DEFAULT_chartTypeDoughnut, LYRA_DEFAULT_chartTypeLine, LYRA_DEFAULT_chartTypePie, LYRA_DEFAULT_chartTypePolarArea, LYRA_DEFAULT_chartTypeRadar, LYRA_DEFAULT_chartTypeScatter, LYRA_DEFAULT_chartValuePercentageLabel, LYRA_DEFAULT_chartZoomUnavailable, LYRA_DEFAULT_liteChartMarkSummary } from '../../../internal/default-strings/charts.generated.js';
import { LYRA_DEFAULT_chart, LYRA_DEFAULT_chartPreparedSummary, LYRA_DEFAULT_chartPreparedUnavailable, LYRA_DEFAULT_chartSummary, LYRA_DEFAULT_chartSummarySeparator, LYRA_DEFAULT_chartTrendDecreasing, LYRA_DEFAULT_chartTrendFlat, LYRA_DEFAULT_chartTrendIncreasing, LYRA_DEFAULT_chartValueLabel, LYRA_DEFAULT_loading, LYRA_DEFAULT_noData, LYRA_DEFAULT_resetZoom } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


const DIRECT_PIXEL_NUMBER = new RegExp(`^(${CSS_NUMBER_SOURCE})(?:px)?$`, 'i');

export { seriesPalette } from './chart-colors.js';

export interface LyraChartPoint {
  readonly x: number;
  readonly y: number;
  /** Bubble radius. Ignored by chart types that do not consume a radius. */
  readonly r?: number;
  /**
   * Optional caller-owned primitive identity retained by activation events. Objects, symbols,
   * and non-finite numbers are ignored so event payloads remain bounded and descriptor-safe.
   */
  readonly id?: string | number;
  /**
   * Caller-owned per-point label retained verbatim by events/export and interpolated into the
   * localized whole-point message used by descriptions, tables, and keyboard announcements.
   */
  readonly label?: string;
}

export interface LyraChartSeries {
  readonly label: string;
  readonly data?: readonly (number | null)[];
  readonly points?: readonly LyraChartPoint[];
  readonly color?: string | readonly string[];
  readonly fill?: boolean;
  readonly width?: number;
  readonly dash?: boolean;
  readonly noTooltip?: boolean;
  readonly axis?: 'y' | 'y2';
  /**
   * Chart.js dataset `stack` group id. Series sharing the same `stack` value on the same axis
   * accumulate into one stack; a different id starts an independent stack that Chart.js draws
   * side by side with the first on that same (stacked) axis. Omitted series default to Chart.js's
   * own ungrouped stack, matching every series's behavior before this existed. Only meaningful on
   * an axis that is actually stacked -- see `LyraChart.stacked`/`LyraChart.stackedAxes`.
   */
  readonly stack?: string;
  readonly pointColors?: readonly string[];
  /**
   * Per-point radius. A single number applies to every point; an array (matching `data`'s
   * length) sets each point independently — passed straight through to Chart.js, which
   * supports both natively.
   */
  readonly pointRadius?: number | readonly number[];
  /**
   * Per-segment (the line between two consecutive points) border color, indexed by the
   * *starting* point of each segment — e.g. `['red', 'green']` on 3 points colors the first
   * segment red and the second green. Wired to Chart.js's `segment.borderColor`, and cycled
   * when shorter than the segment count. Sampled segments retain the original source starting
   * point's palette index. Only meaningful for line-type series.
   */
  readonly segmentColors?: readonly string[];
  readonly type?: 'line' | 'bar';
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
/** Complete cartesian axes, including their ticks, labels, borders and grid lines. */
export type LyraChartAxes = LyraChartGrid;
export type LyraChartIndexAxis = 'x' | 'y';
/** Scale type for a chart's value axis. The categorical axis is never affected. */
export type LyraChartScaleType = 'linear' | 'logarithmic';

/**
 * One declarative chart annotation: a reference line (`value`) or a shaded band (`from`/`to`) on
 * the named axis.
 *
 * `value` and `from`/`to` are mutually exclusive; an entry supplying neither, or non-finite
 * numbers, is dropped rather than handed to Chart.js, where it would silently render nothing or
 * throw. `axis` defaults to `'y'`, the value axis for the common threshold case.
 */
export interface LyraChartAnnotation {
  readonly axis?: LyraChartIndexAxis;
  readonly value?: number;
  readonly from?: number;
  readonly to?: number;
  readonly label?: string;
  readonly tone?: LyraVariant;
}
export type LyraChartLayoutPosition =
  | 'left'
  | 'top'
  | 'right'
  | 'bottom'
  | 'center'
  | 'chartArea'
  | { [scaleId: string]: number };
export type LyraChartLegendPosition = LyraChartLayoutPosition | 'start' | 'end' | 'auto';
/** Dataset toggles, or shared category toggles for pie/doughnut/polar-area charts. */
export type LyraChartLegendMode = 'auto' | 'dataset' | 'datum';
/** Text shown in the DOM legend, independently of tooltip and axis formatting. */
export type LyraChartLegendDisplay = 'auto' | 'label' | 'value' | 'percentage' | 'value-percentage';
export type LyraChartValueFormatterContext = 'tick' | 'tooltip' | 'legend' | 'table';
export type LyraChartValueFormatter = (
  value: number,
  context: LyraChartValueFormatterContext,
) => string;

export type LyraChartFormatSurface =
  | LyraChartValueFormatterContext
  | 'visual'
  | 'spoken'
  | 'export';

/** Identifies which numeric component of a structured datum the formatter receives. */
export type LyraChartStatistic =
  | 'x'
  | 'y'
  | 'r'
  | 'min'
  | 'q1'
  | 'median'
  | 'q3'
  | 'max'
  | 'total';

/**
 * The scale a formatted number belongs to: the two cartesian value axes (`y`, and `y2` for a
 * `LyraChartSeries.axis: 'y2'` series), the `x` scale wherever it carries numbers rather than
 * categories (scatter/bubble, and a horizontal bar/line), and the single radial `r` scale of a
 * radar/polar-area chart. `undefined` where there is no axis at all -- a pie/doughnut slice, or a
 * surface whose value is not bound to one scale.
 */
export type LyraChartFormatterAxis = 'x' | 'y' | 'y2' | 'r';

export interface LyraChartFormatterContext {
  readonly value: number;
  readonly surface: LyraChartFormatSurface;
  readonly datasetIndex?: number;
  readonly index?: number;
  readonly label?: string;
  readonly seriesLabel?: string;
  readonly statistic?: LyraChartStatistic;
  /**
   * Which scale this number is plotted against. Two axes usually exist precisely because they
   * carry different units, so without it one formatter cannot render a secondary axis correctly --
   * the gap that forced dual-axis and scatter charts onto the raw `config` tick callback, which
   * bypasses this formatter and so drops the same unit text from the data table, the CSV export and
   * the spoken announcement.
   */
  readonly axis?: LyraChartFormatterAxis;
  /**
   * This entry's share of the represented `surface: 'legend'` total, as a fraction in `[0, 1]`
   * (`0.5` is 50%) -- present only on that surface, so a `legendDisplay: 'value'` or
   * `'value-percentage'` formatter can render a share without recomputing it from raw data. There
   * is no accompanying `total`: internally the sum is computed in a per-entry rescaled coordinate
   * system for numeric stability with datasets whose finite values sum beyond
   * `Number.MAX_VALUE`, so it has no fixed public unit -- `percentage` alone is stable regardless.
   */
  readonly percentage?: number;
}

export type LyraChartFormatter = (context: LyraChartFormatterContext) => string;
type LyraChartFormatterMetadata = Omit<
  LyraChartFormatterContext,
  'surface' | 'value'
>;

/**
 * Tooltip title/footer formatter. Chart.js calls its own `title`/`footer` tooltip callbacks once
 * per tooltip render against every hovered item, not once per item like the label path -- so
 * unlike `LyraChartFormatter`, this receives every hovered item's context at once, each in the
 * same `LyraChartFormatterContext` shape `formatter`'s `'tooltip'` surface already produces (one
 * entry per dataset the tooltip covers, e.g. every stacked series sharing the hovered category).
 * The property itself being unset -- not the formatter's return value -- is what leaves Chart.js's
 * own default title (the shared category label) or default footer (none) in place.
 */
export type LyraChartTooltipGroupFormatter = (
  items: readonly LyraChartFormatterContext[],
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
  stack?: string;
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

/** A single Chart.js hit-test result, as returned by `LyraChartInstance.getElementsAtEventForMode()`.
 *  Exported so the documented `LyraChartInstance` reference (`llms/charts.md`) names a real,
 *  importable symbol instead of an inaccessible internal interface. */
interface ChartHit {
  datasetIndex: number;
  index: number;
}

interface ChartLegendItem {
  [key: string]: unknown;
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

/** Structural shape of a live Chart.js instance, without imposing `chart.js` as a type dependency
 *  on consumers. Exported so `LyraChartInstance`'s documented `extends RuntimeChart` reference
 *  names a real, importable symbol. */
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
    useFinalPosition: boolean
  ): ChartHit[];
  getDatasetMeta?(index: number): { hidden: boolean | null };
  isDatasetVisible(index: number): boolean;
  setDatasetVisibility(index: number, visible: boolean): void;
  getDataVisibility?(index: number): boolean;
  toggleDataVisibility?(index: number): void;
  getZoomedScaleBounds?(): Record<string, { min: number; max: number } | undefined>;
  zoomScale?(id: string, range: { min: number; max: number }, mode?: string): void;
}

/** Public structural view of the current Chart.js instance, without imposing `chart.js` as a
 * type dependency on consumers. The value is `undefined` before the peer loads and after the
 * component disconnects. */
export interface LyraChartInstance extends RuntimeChart {}

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

function normalizeChartType(value: unknown): LyraChartType {
  return typeof value === 'string' && CHART_TYPES.has(value as LyraChartType)
    ? (value as LyraChartType)
    : 'bar';
}

function normalizeChartGrid(value: unknown): LyraChartGrid {
  return value === 'x' || value === 'y' || value === 'none' || value === 'both'
    ? value
    : 'both';
}

function normalizeLegendPosition(value: unknown): LyraChartLegendPosition {
  if (
    value === 'left' ||
    value === 'top' ||
    value === 'right' ||
    value === 'bottom' ||
    value === 'center' ||
    value === 'chartArea' ||
    value === 'start' ||
    value === 'end' ||
    value === 'auto'
  ) {
    return value;
  }
  return projectLegendPosition(value) ?? 'top';
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

/** Dataset types Chart.js renders through its `ArcElement` (`elements.arc.*`). */
function isArcDatasetType(datasetType: string): boolean {
  return datasetType === 'pie' || datasetType === 'doughnut' || datasetType === 'polarArea';
}

/** Dataset types Chart.js renders through its `PointElement` (`elements.point.*`), i.e. every
 *  controller that plots discrete markers. */
function isPointDatasetType(datasetType: string): boolean {
  return (
    datasetType === 'line' ||
    datasetType === 'radar' ||
    datasetType === 'scatter' ||
    datasetType === 'bubble'
  );
}

/**
 * Establishes only that a value can be passed to descriptor-safe record readers. It deliberately
 * does not admit a value as a Chart.js configuration record: callers which retain a record for
 * later use must additionally require `isSafeChartConfigurationRecord()` or project it first.
 */
function isChartRecord(value: unknown): value is Record<string, unknown> {
  try {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  } catch {
    return false;
  }
}

const MAX_CHART_INPUT_ENTRIES = 10_000;
const CHART_INPUT_CAP_WARNING_KEY = 'lr-chart-input-cap';
const MAX_CHART_CONFIGURATION_DEPTH = 32;
const OMIT_CHART_CONFIGURATION_VALUE = Symbol('omit-chart-configuration-value');

function warnChartInputCap(): void {
  devWarnOnce(CHART_INPUT_CAP_WARNING_KEY,
    'lr-chart: an input array exceeded 10,000 entries; only the first 10,000 are used.');
}

const truncatedChartInputs = new WeakSet<object>();

function retainChartInputLimit(source: unknown, value: unknown): void {
  if (typeof source === 'object' && source !== null && truncatedChartInputs.has(source) &&
    typeof value === 'object' && value !== null) truncatedChartInputs.add(value);
}

function admitChartArray(value: unknown): ChartArrayAdmission | undefined {
  let truncated = false;
  const admitted = admitSnapshotArray(value, () => { truncated = true; warnChartInputCap(); });
  if (admitted && truncated) truncatedChartInputs.add(admitted.source);
  return admitted;
}

function copyChartArrayEntries(admission: ChartArrayAdmission): readonly unknown[] {
  const value = projectSnapshotArray(admission, value => value, { missing: undefined }) ?? Object.freeze([]);
  retainChartInputLimit(admission.source, value);
  return value;
}

/** Enumerates only after the caller established an ordinary record, and contains hostile traps. */
function chartEnumerableKeys(value: object): readonly string[] | undefined {
  try {
    return Object.keys(value);
  } catch {
    return undefined;
  }
}

interface CanonicalChartSeriesSnapshot {
  readonly data: readonly (number | null)[];
  readonly points?: readonly (LyraChartPoint | null)[];
}

// A source object can forge any exported/non-private property marker. Provenance belongs outside
// the caller-owned series record, so only a series projected by this module can reuse a snapshot.
const canonicalChartSeriesSnapshots = new WeakMap<object, CanonicalChartSeriesSnapshot>();
// Plugins are opaque callback owners after their one checked `id` admission. Re-reading their
// public shape during every build would let a later getter/proxy revoke break an already-valid chart.
const admittedChartPlugins = new WeakSet<object>();
// Raw config datasets still hand Chart.js its opaque payload, while Lyra owns this parallel,
// descriptor-projected snapshot for summaries, tables, callbacks, and append calculations.
const canonicalChartDatasetValues = new WeakMap<object, readonly unknown[]>();
// A config dataset is sometimes cloned by `appendData()` before the next config setter runs. Keep
// the same private provenance on its caller-visible data array so that clone does not force a
// second read of an opaque datum merely to rebuild the owning dataset snapshot.
const canonicalChartDatasetDataValues = new WeakMap<object, readonly unknown[]>();
const canonicalChartDataSnapshots = new WeakSet<object>();

/** Reuse a prior one-read projection, or safely admit a derived subclass series on demand. */
function canonicalChartSeries(value: unknown): LyraChartSeries | undefined {
  if (!isChartRecord(value)) return undefined;
  if (canonicalChartSeriesSnapshots.has(value)) return value as unknown as LyraChartSeries;
  return projectChartSeries(value);
}

function canonicalSeriesData(
  series: LyraChartSeries
): readonly (number | null)[] {
  const canonical = canonicalChartSeries(series);
  return canonical ? canonicalChartSeriesSnapshots.get(canonical)?.data ?? [] : [];
}

function canonicalSeriesPoints(
  series: LyraChartSeries
): readonly (LyraChartPoint | null)[] | undefined {
  const canonical = canonicalChartSeries(series);
  return canonical ? canonicalChartSeriesSnapshots.get(canonical)?.points : undefined;
}

function chartRecordValue(
  value: object,
  property: PropertyKey
): ReturnType<typeof getOwnDataDescriptor> {
  return getOwnDataDescriptor(value, property);
}

function projectChartNumberData(
  value: unknown,
  admission = admitChartArray(value),
): readonly (number | null)[] | undefined {
  return projectSnapshotArray(admission,
    entry => typeof entry === 'number' && Number.isFinite(entry) ? entry : null,
    { missing: null });
}

function projectChartPoint(value: unknown): LyraChartPoint | null {
  if (!isChartRecord(value)) return null;
  const x = chartRecordValue(value, 'x');
  const y = chartRecordValue(value, 'y');
  const r = chartRecordValue(value, 'r');
  const id = chartRecordValue(value, 'id');
  const label = chartRecordValue(value, 'label');
  if (
    x === MISSING_OWN_DATA_DESCRIPTOR ||
    x === UNSAFE_OWN_DATA_DESCRIPTOR ||
    y === MISSING_OWN_DATA_DESCRIPTOR ||
    y === UNSAFE_OWN_DATA_DESCRIPTOR ||
    r === UNSAFE_OWN_DATA_DESCRIPTOR ||
    id === UNSAFE_OWN_DATA_DESCRIPTOR ||
    label === UNSAFE_OWN_DATA_DESCRIPTOR ||
    typeof x.value !== 'number' ||
    !Number.isFinite(x.value) ||
    typeof y.value !== 'number' ||
    !Number.isFinite(y.value)
  )
    return null;
  return Object.freeze({
    x: x.value,
    y: y.value,
    ...(r !== MISSING_OWN_DATA_DESCRIPTOR &&
    typeof r.value === 'number' &&
    Number.isFinite(r.value) &&
    r.value >= 0
      ? { r: r.value }
      : {}),
    ...(id !== MISSING_OWN_DATA_DESCRIPTOR &&
    (typeof id.value === 'string' ||
      (typeof id.value === 'number' && Number.isFinite(id.value)))
      ? { id: id.value }
      : {}),
    ...(label !== MISSING_OWN_DATA_DESCRIPTOR && typeof label.value === 'string'
      ? { label: label.value }
      : {}),
  });
}

/** Projects a config datum for Lyra-owned reads without changing the peer's opaque payload. */
function projectChartDatum(value: unknown): unknown {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' || typeof value === 'bigint') return value;
  if (!isChartRecord(value)) return null;
  const x = chartRecordValue(value, 'x');
  const y = chartRecordValue(value, 'y');
  const r = chartRecordValue(value, 'r');
  const id = chartRecordValue(value, 'id');
  const label = chartRecordValue(value, 'label');
  const output: Record<string, number | string> = {};
  let hasValue = false;
  for (const [property, descriptor] of [
    ['x', x],
    ['y', y],
    ['r', r],
  ] as const) {
    if (
      descriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      descriptor === UNSAFE_OWN_DATA_DESCRIPTOR ||
      typeof descriptor.value !== 'number' ||
      !Number.isFinite(descriptor.value)
    )
      continue;
    output[property] = descriptor.value;
    hasValue = true;
  }
  if (
    label !== MISSING_OWN_DATA_DESCRIPTOR &&
    label !== UNSAFE_OWN_DATA_DESCRIPTOR &&
    typeof label.value === 'string'
  ) {
    output['label'] = label.value;
    hasValue = true;
  }
  if (
    id !== MISSING_OWN_DATA_DESCRIPTOR &&
    id !== UNSAFE_OWN_DATA_DESCRIPTOR &&
    (typeof id.value === 'string' ||
      (typeof id.value === 'number' && Number.isFinite(id.value)))
  ) {
    output['id'] = id.value;
    hasValue = true;
  }
  return hasValue ? Object.freeze(output) : null;
}

function projectChartDatasetValues(admission: ChartArrayAdmission): readonly unknown[] {
  return projectSnapshotArray(admission, projectChartDatum, { missing: null }) ?? Object.freeze([]);
}

function projectChartPoints(
  value: unknown,
  admission = admitChartArray(value),
): readonly (LyraChartPoint | null)[] | undefined {
  return projectSnapshotArray(admission, projectChartPoint, { missing: null });
}

function projectChartStrings(
  value: unknown,
  admission = admitChartArray(value),
): readonly string[] | undefined {
  return projectSnapshotArray(admission, entry => typeof entry === 'string' ? entry : '', { missing: '' });
}

function projectChartPointRadii(
  value: unknown,
  admission = admitChartArray(value),
): readonly number[] | undefined {
  return projectSnapshotArray(admission,
    entry => typeof entry === 'number' && Number.isFinite(entry) ? entry : Number.NaN,
    { missing: Number.NaN });
}

function projectHiddenDatasetIndexes(value: unknown): readonly number[] | undefined {
  if (value === undefined) return undefined;
  return projectSnapshotArray(admitChartArray(value),
    entry => typeof entry === 'number' && Number.isInteger(entry) ? entry : undefined,
    { compact: true }) ?? Object.freeze([]);
}

const CHART_ANNOTATION_TONES = new Set<LyraVariant>([
  'neutral',
  'brand',
  'success',
  'warning',
  'danger',
]);

function projectChartAnnotations(value: unknown): readonly LyraChartAnnotation[] {
  // The owned boundary has already detached these records and omitted accessor fields.
  if (!Array.isArray(value)) return Object.freeze([]);
  const output: LyraChartAnnotation[] = [];
  for (const annotation of value) {
    if (!isChartRecord(annotation)) continue;
    const own = (key: string): unknown => Object.hasOwn(annotation, key) ? annotation[key] : undefined;
    const axis = own('axis');
    const line = own('value');
    const from = own('from');
    const to = own('to');
    const label = own('label');
    const tone = own('tone');
    if ((axis !== undefined && axis !== 'x' && axis !== 'y') ||
      (label !== undefined && typeof label !== 'string') ||
      (tone !== undefined && (typeof tone !== 'string' || !CHART_ANNOTATION_TONES.has(tone as LyraVariant)))) continue;
    const common: Pick<LyraChartAnnotation, 'axis' | 'label' | 'tone'> = {
      ...(axis === 'x' || axis === 'y' ? { axis } : {}),
      ...(typeof label === 'string' ? { label } : {}),
      ...(typeof tone === 'string' ? { tone: tone as LyraVariant } : {}),
    };
    if (typeof line === 'number' && Number.isFinite(line)) {
      output.push(Object.freeze({ ...common, value: line }));
    } else if (typeof from === 'number' && Number.isFinite(from) && typeof to === 'number' && Number.isFinite(to)) {
      output.push(Object.freeze({ ...common, from: Math.min(from, to), to: Math.max(from, to) }));
    }
  }
  return Object.freeze(output);
}

const CHART_SERIES_PROPERTIES = [
  'label',
  'data',
  'points',
  'color',
  'fill',
  'width',
  'dash',
  'noTooltip',
  'axis',
  'stack',
  'pointColors',
  'pointRadius',
  'segmentColors',
  'type',
] as const;

/** The simplified surface tolerates an omitted label/data payload, but every admitted field is
 * copied through an own data descriptor before later rendering code sees it.
 * @internal */
export function projectChartSeries(value: unknown): LyraChartSeries | undefined {
  if (typeof value === 'object' && value !== null && canonicalChartSeriesSnapshots.has(value)) return value as LyraChartSeries;
  if (!isChartRecord(value)) return undefined;
  const descriptors = new Map<
    (typeof CHART_SERIES_PROPERTIES)[number],
    ReturnType<typeof getOwnDataDescriptor>
  >();
  for (const property of CHART_SERIES_PROPERTIES) {
    const descriptor = chartRecordValue(value, property);
    if (descriptor === UNSAFE_OWN_DATA_DESCRIPTOR) return undefined;
    descriptors.set(property, descriptor);
  }
  const valueAt = (
    property: (typeof CHART_SERIES_PROPERTIES)[number]
  ): unknown => {
    const descriptor = descriptors.get(property);
    return descriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      descriptor === UNSAFE_OWN_DATA_DESCRIPTOR ||
      descriptor === undefined
      ? undefined
      : descriptor.value;
  };
  const label = valueAt('label');
  if (label !== undefined && typeof label !== 'string') return undefined;
  const output: {
    label: string;
    data?: readonly (number | null)[];
    points?: readonly LyraChartPoint[];
    color?: string | readonly string[];
    fill?: boolean;
    width?: number;
    dash?: boolean;
    noTooltip?: boolean;
    axis?: 'y' | 'y2';
    stack?: string;
    pointColors?: readonly string[];
    pointRadius?: number | readonly number[];
    segmentColors?: readonly string[];
    type?: 'line' | 'bar';
  } = { label: label ?? '' };
  const rawData = valueAt('data');
  const rawDataAdmission = admitChartArray(rawData);
  const data = projectChartNumberData(rawData, rawDataAdmission);
  const rawPoints = valueAt('points');
  const rawPointsAdmission = admitChartArray(rawPoints);
  const points = projectChartPoints(rawPoints, rawPointsAdmission);
  const color = valueAt('color');
  const fill = valueAt('fill');
  const width = valueAt('width');
  const dash = valueAt('dash');
  const noTooltip = valueAt('noTooltip');
  const axis = valueAt('axis');
  const stack = valueAt('stack');
  const pointColors = projectChartStrings(valueAt('pointColors'));
  const pointRadius = valueAt('pointRadius');
  const segmentColors = projectChartStrings(valueAt('segmentColors'));
  const type = valueAt('type');
  // `data` and `points` are public caller-owned snapshots. Their canonical copies below are
  // the only values the component reads after admission; the public fields retain identity for
  // append and inspection workflows.
  if (data && rawDataAdmission)
    output.data = rawDataAdmission.source as unknown as readonly (number | null)[];
  // `points` is a documented caller-owned identity used by append workflows. Keep it visible
  // unchanged, while the non-enumerable canonical copy below is the only shape rendering reads.
  if (points && rawPointsAdmission)
    output.points = rawPointsAdmission.source as unknown as readonly LyraChartPoint[];
  if (typeof color === 'string') output.color = color;
  else {
    const colors = projectChartStrings(color);
    if (colors) output.color = colors;
  }
  if (typeof fill === 'boolean') output.fill = fill;
  if (typeof width === 'number' && Number.isFinite(width))
    output.width = width;
  if (typeof dash === 'boolean') output.dash = dash;
  if (typeof noTooltip === 'boolean') output.noTooltip = noTooltip;
  if (axis === 'y' || axis === 'y2') output.axis = axis;
  if (typeof stack === 'string') output.stack = stack;
  if (pointColors) output.pointColors = pointColors;
  if (typeof pointRadius === 'number' && Number.isFinite(pointRadius)) {
    output.pointRadius = pointRadius;
  } else {
    const radii = projectChartPointRadii(pointRadius);
    if (radii) output.pointRadius = radii;
  }
  if (segmentColors) output.segmentColors = segmentColors;
  if (type === 'line' || type === 'bar') output.type = type;
  const series = Object.freeze(output) as LyraChartSeries;
  retainChartInputLimit(rawData, series);
  retainChartInputLimit(rawPoints, series);
  canonicalChartSeriesSnapshots.set(series, {
    data: data ?? Object.freeze([]),
    ...(points ? { points } : {}),
  });
  return series;
}

/** Replaces numeric data on an already admitted series without rereading retained values. */
function appendChartSeries(series: LyraChartSeries, data: readonly (number | null)[]): LyraChartSeries {
  const values = Object.freeze(data);
  const result = Object.freeze({ ...series, data: values });
  canonicalChartSeriesSnapshots.set(result, { data: values });
  return result;
}

function normalizeChartSeries(value: unknown): readonly LyraChartSeries[] {
  // Retained series reuse their private canonical snapshots, never their live data/points.
  const result = projectSnapshotArray(admitChartArray(value), canonicalChartSeries, { compact: true }) ?? Object.freeze([]);
  retainChartInputLimit(value, result);
  if (result.some(series => truncatedChartInputs.has(series))) truncatedChartInputs.add(result);
  return result;
}

function isSafeChartConfigurationRecord(value: unknown): value is Record<string, unknown> {
  if (!isChartRecord(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype === null) return true;
    const constructor = getOwnDataDescriptor(prototype, 'constructor');
    if (
      constructor === MISSING_OWN_DATA_DESCRIPTOR ||
      constructor === UNSAFE_OWN_DATA_DESCRIPTOR ||
      typeof constructor.value !== 'function'
    )
      return false;
    const name = getOwnDataDescriptor(constructor.value, 'name');
    const constructorPrototype = getOwnDataDescriptor(constructor.value, 'prototype');
    return (
      name !== MISSING_OWN_DATA_DESCRIPTOR &&
      name !== UNSAFE_OWN_DATA_DESCRIPTOR &&
      name.value === 'Object' &&
      constructorPrototype !== MISSING_OWN_DATA_DESCRIPTOR &&
      constructorPrototype !== UNSAFE_OWN_DATA_DESCRIPTOR &&
      constructorPrototype.value === prototype
    );
  } catch {
    return false;
  }
}

/**
 * Projects the only structured object accepted for a legend placement. Unlike a generic config
 * object, this value is read by Lyra itself, so every value must be a finite own data property.
 */
function projectLegendPosition(value: unknown): { [scaleId: string]: number } | undefined {
  if (!isSafeChartConfigurationRecord(value)) return undefined;
  const keys = chartEnumerableKeys(value);
  if (!keys || keys.length > MAX_CHART_INPUT_ENTRIES) return undefined;
  const output: { [scaleId: string]: number } = {};
  for (const key of keys) {
    if (UNSAFE_KEYS.has(key)) return undefined;
    const descriptor = chartRecordValue(value, key);
    if (
      descriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      descriptor === UNSAFE_OWN_DATA_DESCRIPTOR ||
      !descriptor.enumerable ||
      typeof descriptor.value !== 'number' ||
      !Number.isFinite(descriptor.value)
    )
      return undefined;
    output[key] = descriptor.value;
  }
  return Object.freeze(output);
}

/** The detached value, or the `OMIT_CHART_CONFIGURATION_VALUE` sentinel when it must be dropped. */
function copyChartConfigurationValue(
  value: unknown,
  profile: 'chart' | 'chartData' = 'chart',
): unknown {
  const snapshot = snapshotStructuredData(value, {
    profile,
    omitKeys: UNSAFE_KEYS,
    onArrayTruncate: warnChartInputCap,
    onClone: (source, copied) => {
      retainChartInputLimit(source, copied);
      const canonical = canonicalChartDatasetDataValues.get(source);
      if (canonical) canonicalChartDatasetDataValues.set(copied, canonical);
    },
  });
  if (snapshot.truncated && typeof snapshot.value === 'object' && snapshot.value !== null) truncatedChartInputs.add(snapshot.value);
  return snapshot.value === undefined && value !== undefined
    ? OMIT_CHART_CONFIGURATION_VALUE : snapshot.value;
}

function projectChartPlugins(
  value: unknown,
  admission = admitChartArray(value),
): readonly LyraChartPlugin[] {
  return projectSnapshotArray(admission, candidate => {
    if (candidate === null || (typeof candidate !== 'object' && typeof candidate !== 'function')) return undefined;
    const plugin = candidate as object;
    if (admittedChartPlugins.has(plugin)) return plugin as LyraChartPlugin;
    const id = chartRecordValue(plugin, 'id');
    if (id === MISSING_OWN_DATA_DESCRIPTOR || id === UNSAFE_OWN_DATA_DESCRIPTOR ||
      typeof id.value !== 'string' || id.value.trim() === '') return undefined;
    // Chart.js invokes opaque plugin callbacks; Lyra reads only the admitted id.
    admittedChartPlugins.add(plugin);
    return plugin as LyraChartPlugin;
  }, { compact: true }) ?? Object.freeze([]);
}

/**
 * The raw config escape hatch may retain opaque Chart.js leaves, but a dataset row is later read
 * for labels, values, axes, visibility, totals, and tooltip filtering. Admit only copied ordinary
 * records here, then retain opaque identities solely in fields Lyra does not introspect.
 */
function projectChartDatasetConfiguration(
  value: unknown,
): LyraChartDatasetConfiguration | undefined {
  if (!isSafeChartConfigurationRecord(value)) return undefined;
  const keys = chartEnumerableKeys(value);
  if (!keys) return undefined;
  const output = Object.create(null) as Record<string, unknown>;
  const priorCanonicalValues = canonicalChartDatasetValues.get(value);
  let canonicalValues: readonly unknown[] | undefined;
  for (const key of keys) {
    if (UNSAFE_KEYS.has(key)) continue;
    const descriptor = chartRecordValue(value, key);
    if (
      descriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      descriptor === UNSAFE_OWN_DATA_DESCRIPTOR ||
      !descriptor.enumerable
    )
      continue;
    const candidate = descriptor.value;
    const array = admitChartArray(candidate);
    if (key === 'data') {
      if (array) {
        const copied = copyChartArrayEntries(array);
        output[key] = copied;
        const canonical =
          priorCanonicalValues ??
          canonicalChartDatasetDataValues.get(array.source) ??
          projectChartDatasetValues(array);
        canonicalValues = canonical;
        canonicalChartDatasetDataValues.set(copied, canonical);
      }
      continue;
    }
    if (key === 'label') {
      if (
        typeof candidate === 'string' ||
        typeof candidate === 'number' ||
        typeof candidate === 'boolean' ||
        typeof candidate === 'bigint'
      ) {
        output[key] = candidate;
      } else if (array) {
        output[key] = copyChartArrayEntries(array);
      }
      continue;
    }
    if (key === 'hidden' || key === 'noTooltip') {
      if (typeof candidate === 'boolean') output[key] = candidate;
      continue;
    }
    if (key === 'axis' || key === 'yAxisID' || key === 'type' || key === 'stack') {
      if (typeof candidate === 'string') output[key] = candidate;
      continue;
    }
    // These opaque Chart.js presentation/scriptable leaves are intentionally not read by Lyra.
    // An admitted array is still copied so later colour/radius classification cannot re-enter it.
    output[key] = array ? copyChartArrayEntries(array) : candidate;
  }
  const dataset = Object.freeze(output) as LyraChartDatasetConfiguration;
  if (canonicalValues) canonicalChartDatasetValues.set(dataset, canonicalValues);
  return dataset;
}

function projectChartDatasetConfigurations(
  value: unknown,
  admission = admitChartArray(value),
): readonly LyraChartDatasetConfiguration[] {
  return projectSnapshotArray(admission, projectChartDatasetConfiguration, { compact: true }) ?? Object.freeze([]);
}

/**
 * Applies the data-schema boundary after generic descriptor copying. Unknown data-level fields
 * stay available to Chart.js, while labels and dataset rows get the stronger projections required
 * by Lyra's own later render, table, tooltip, append, and accessibility reads.
 */
function projectChartDataConfiguration(value: unknown): LyraChartDataConfiguration | undefined {
  if (typeof value === 'object' && value !== null && canonicalChartDataSnapshots.has(value)) return value as LyraChartDataConfiguration;
  if (!isSafeChartConfigurationRecord(value)) return undefined;
  const keys = chartEnumerableKeys(value);
  if (!keys) return undefined;
  const output = Object.create(null) as Record<string, unknown>;
  for (const key of keys) {
    if (UNSAFE_KEYS.has(key)) continue;
    const descriptor = chartRecordValue(value, key);
    if (
      descriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      descriptor === UNSAFE_OWN_DATA_DESCRIPTOR ||
      !descriptor.enumerable
    )
      continue;
    if (key === 'labels') {
      const labels = admitChartArray(descriptor.value);
      output[key] = labels ? copyChartArrayEntries(labels) : Object.freeze([]);
      continue;
    }
    if (key === 'datasets') {
      output[key] = projectChartDatasetConfigurations(descriptor.value);
      continue;
    }
    output[key] = descriptor.value;
  }
  retainChartInputLimit(value, output);
  canonicalChartDataSnapshots.add(output);
  return Object.freeze(output) as LyraChartDataConfiguration;
}

function projectChartConfiguration(value: unknown): LyraChartConfiguration | undefined {
  if (!isSafeChartConfigurationRecord(value)) return undefined;
  // Each member is bounded on its own, so a large data member never displaces options.
  const output = Object.create(null) as Record<string, unknown>;
  const type = chartRecordValue(value, 'type');
  const data = chartRecordValue(value, 'data');
  const options = chartRecordValue(value, 'options');
  const plugins = chartRecordValue(value, 'plugins');
  if (
    type !== MISSING_OWN_DATA_DESCRIPTOR &&
    type !== UNSAFE_OWN_DATA_DESCRIPTOR
  ) {
    if (typeof type.value === 'string') output['type'] = type.value;
  }
  for (const [property, descriptor] of [
    ['data', data],
    ['options', options],
  ] as const) {
    if (
      descriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      descriptor === UNSAFE_OWN_DATA_DESCRIPTOR
    )
      continue;
    const copied = copyChartConfigurationValue(
      descriptor.value,
      property === 'data' ? 'chartData' : 'chart',
    );
    if (copied === OMIT_CHART_CONFIGURATION_VALUE) continue;
    if (property === 'data') {
      const projected = projectChartDataConfiguration(copied);
      // Preserve an opaque/non-record root value for the raw passthrough contract. Every Lyra
      // data-model consumer reprojects it and therefore treats it as empty, but append callers
      // still observe the original explicit config member they supplied.
      output[property] = projected ?? copied;
      retainChartInputLimit(copied, output);
      continue;
    }
    output[property] = copied;
  }
  if (
    plugins !== MISSING_OWN_DATA_DESCRIPTOR &&
    plugins !== UNSAFE_OWN_DATA_DESCRIPTOR
  ) {
    const pluginArray = admitChartArray(plugins.value);
    if (pluginArray)
      output['plugins'] = projectChartPlugins(plugins.value, pluginArray);
    else {
      const copied = copyChartConfigurationValue(plugins.value);
      if (copied !== OMIT_CHART_CONFIGURATION_VALUE) output['plugins'] = copied;
    }
  }
  return Object.freeze(output) as LyraChartConfiguration;
}

// Keys that would let a JSON-sourced `config` (e.g. parsed from an API
// response) reach up through the merge and mutate `Object.prototype` —
// skipped unconditionally regardless of `base`'s own shape.
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// FALLBACK_GRID_COLOR/FALLBACK_TICK_COLOR/FALLBACK_LEGEND_COLOR/FALLBACK_TOOLTIP_BG/
// FALLBACK_TOOLTIP_TEXT/ThemeColors (imported above as ChartThemeColors) now live in
// chart-colors.ts, shared verbatim with box-plot.class.ts's identical fallback chain.

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

/**
 * Recursively merges `override` onto `base`, matching JSON-merge semantics:
 * plain objects are merged key-by-key at every depth; arrays, functions, and
 * any other value type are replaced wholesale by `override`'s value. Used to
 * deep-merge the raw `config` passthrough over the `LyraChartSeries`-generated
 * config in `buildConfig()` so a nested key (e.g. `config.options.scales.y`) only
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
  // Every plain record that reaches here from `projectChartConfiguration()` was copied through
  // own data descriptors. Anything else is an intentional opaque Chart.js leaf (such as a
  // gradient, plugin instance, or consumer object) and must replace the generated value without
  // enumerating keys or reading a property: a class instance can look plain to the broad rendering
  // predicate while still own an accessor that throws on a later merge.
  if (!isSafeChartConfigurationRecord(base) || !isSafeChartConfigurationRecord(override)) {
    return (override === undefined ? base : (override as T)) as T;
  }
  const baseRecord = base as unknown as Record<string, unknown>;
  const overrideRecord = override;
  const baseKeys = chartEnumerableKeys(baseRecord);
  const overrideKeys = chartEnumerableKeys(overrideRecord);
  // A record that turns hostile between the prototype check and enumeration is an opaque leaf.
  // Replacing it preserves the raw-config contract without reflecting a getter or proxy trap.
  if (!baseKeys || !overrideKeys) return override as T;
  const previous = seen.get(overrideRecord);
  if (previous !== undefined) return previous as T;
  const result: Record<string, unknown> = {};
  for (const key of baseKeys) {
    if (UNSAFE_KEYS.has(key)) continue;
    const descriptor = chartRecordValue(baseRecord, key);
    if (
      descriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      descriptor === UNSAFE_OWN_DATA_DESCRIPTOR ||
      !descriptor.enumerable
    )
      continue;
    result[key] = descriptor.value;
  }
  seen.set(overrideRecord, result);
  try {
    for (const key of overrideKeys) {
      if (UNSAFE_KEYS.has(key)) continue;
      const descriptor = chartRecordValue(overrideRecord, key);
      if (
        descriptor === MISSING_OWN_DATA_DESCRIPTOR ||
        descriptor === UNSAFE_OWN_DATA_DESCRIPTOR ||
        !descriptor.enumerable
      )
        continue;
      const baseDescriptor = chartRecordValue(baseRecord, key);
      const baseValue =
        baseDescriptor === MISSING_OWN_DATA_DESCRIPTOR ||
        baseDescriptor === UNSAFE_OWN_DATA_DESCRIPTOR
          ? undefined
          : baseDescriptor.value;
      result[key] = deepMerge(baseValue, descriptor.value, seen);
    }
  } finally {
    seen.delete(overrideRecord);
  }
  return result as T;
}

export type LyraChartDatumKind = 'bar' | 'point' | 'segment' | 'slice' | 'box';
type LyraCoreChartDatumKind = Exclude<LyraChartDatumKind, 'box'>;

/** Input-neutral detail shared by every chart-family `lr-datum-activate` event. */
export interface LyraChartDatumActivateDetail<
  TKind extends LyraChartDatumKind = LyraChartDatumKind,
  TValue = unknown
> {
  readonly kind: TKind;
  readonly datasetIndex: number;
  readonly index: number;
  readonly label: string | undefined;
  readonly value: TValue;
}

export interface LyraChartEventMap {
  'lr-spatial-point-select': CustomEvent<LyraChartSpatialPointSelectDetail>;
  'lr-spatial-bin-select': CustomEvent<LyraSpatialBinSelectDetail>;
  'lr-source-point-select': CustomEvent<LyraChartSourcePointSelectDetail>;
  'lr-source-category-select': CustomEvent<LyraChartSourceCategorySelectDetail>;
  /** A data point, segment or generated-table value was activated by pointer or keyboard. */
  'lr-point-activate': CustomEvent<{
    datasetIndex: number;
    index: number;
    label: string | undefined;
    value: unknown;
  }>;
  'lr-zoom': CustomEvent<{ zoomed: boolean }>;
  /** Canonical name for the legend-visibility veto point. */
  'lr-legend-visibility-change-request': CustomEvent<LyraChartLegendVisibilityChangeDetail>;
  'lr-legend-visibility-change': CustomEvent<LyraChartLegendVisibilityChangeDetail>;
  /** Canonical name for the datum-visibility veto point. */
  'lr-datum-visibility-change-request': CustomEvent<LyraChartDatumVisibilityChangeDetail>;
  'lr-datum-visibility-change': CustomEvent<LyraChartDatumVisibilityChangeDetail>;
  'lr-datum-activate': CustomEvent<
    LyraChartDatumActivateDetail<LyraCoreChartDatumKind>
  >;
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

function normalizedChartPoint(value: unknown): LyraChartPoint | null {
  return projectChartPoint(projectChartDatum(value));
}

/** Converts only primitive chart values, so description/export paths never invoke an opaque datum. */
function chartNumericValue(value: unknown): number | undefined {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string' || typeof value === 'bigint'
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(numeric) ? numeric : undefined;
}

/**
 * Chart.js passes partial parsed values such as `{ y }` and radial `{ r }` into callbacks. Read
 * those compatibility shapes through own descriptors so a hostile datum cannot re-enter later
 * formatting, table, tooltip, or total paths through a getter.
 */
function chartDatumNumericValue(value: unknown): number | undefined {
  const projected = projectChartDatum(value);
  if (isChartRecord(projected)) {
    for (const property of ['y', 'r', 'x'] as const) {
      const descriptor = chartRecordValue(projected, property);
      if (
        descriptor !== MISSING_OWN_DATA_DESCRIPTOR &&
        descriptor !== UNSAFE_OWN_DATA_DESCRIPTOR &&
        typeof descriptor.value === 'number' &&
        Number.isFinite(descriptor.value)
      ) {
        return descriptor.value;
      }
    }
  }
  return chartNumericValue(projected);
}

function nonNegativeFinite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function labelText(value: unknown, depth = 0): string {
  if (value == null) return '';
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  )
    return String(value);
  const admission = admitChartArray(value);
  if (depth < MAX_CHART_CONFIGURATION_DEPTH && admission) {
    const values: string[] = [];
    for (let index = 0; index < admission.length; index += 1) {
      values.push(labelText(readOwnDataValue(admission.source, String(index)), depth + 1));
    }
    return values.join(' ');
  }
  return '';
}

/** Reads a Chart.js dataset field without invoking a caller or plugin accessor. */
function chartDatasetValue(dataset: unknown, property: PropertyKey): unknown {
  if (!isChartRecord(dataset)) return undefined;
  const descriptor = chartRecordValue(dataset, property);
  return descriptor === MISSING_OWN_DATA_DESCRIPTOR || descriptor === UNSAFE_OWN_DATA_DESCRIPTOR
    ? undefined
    : descriptor.value;
}

/** Callback/runtime labels are untrusted too; turn them into display text through descriptors. */
function chartDatasetLabel(dataset: unknown): string {
  return labelText(chartDatasetValue(dataset, 'label'));
}

/** Every chart-owned later read uses this bounded descriptor copy rather than a data source array. */
function chartDatasetValues(dataset: unknown): readonly unknown[] {
  if (isChartRecord(dataset)) {
    const snapshot = canonicalChartDatasetValues.get(dataset);
    if (snapshot) return snapshot;
  }
  const data = chartDatasetValue(dataset, 'data');
  const admission = admitChartArray(data);
  if (!admission) return Object.freeze([]);
  return canonicalChartDatasetDataValues.get(admission.source) ?? copyChartArrayEntries(admission);
}

/** The peer payload stays opaque, but append cloning needs its admitted source identity. */
function chartDatasetPeerValues(dataset: unknown): readonly unknown[] {
  const data = chartDatasetValue(dataset, 'data');
  // Every explicit configuration dataset was projected by `projectChartDatasetConfiguration()`,
  // which records this provenance for each admitted data array and drops any other `data` value.
  return typeof data === 'object' && data !== null && canonicalChartDatasetDataValues.has(data)
    ? data as readonly unknown[]
    : Object.freeze([]);
}

function chartIndex(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined;
}

function chartCallbackDatasetIndex(value: unknown): number | undefined {
  return chartIndex(chartDatasetValue(value, 'datasetIndex'));
}

function chartCallbackIndexes(value: unknown): ChartHit | undefined {
  const datasetIndex = chartCallbackDatasetIndex(value);
  const index = chartIndex(chartDatasetValue(value, 'index')) ??
    chartIndex(chartDatasetValue(value, 'dataIndex'));
  return datasetIndex === undefined || index === undefined ? undefined : { datasetIndex, index };
}

/** Copies peer-produced legend metadata before Lyra reads or returns it to Chart.js. */
function projectChartLegendItem(value: unknown): ChartLegendItem | undefined {
  if (!isChartRecord(value)) return undefined;
  const keys = chartEnumerableKeys(value);
  if (!keys || keys.length > MAX_CHART_INPUT_ENTRIES) return undefined;
  const output: ChartLegendItem = Object.create(null);
  for (const key of keys) {
    if (UNSAFE_KEYS.has(key)) continue;
    const descriptor = chartRecordValue(value, key);
    if (
      descriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      descriptor === UNSAFE_OWN_DATA_DESCRIPTOR ||
      !descriptor.enumerable
    )
      continue;
    output[key] = descriptor.value;
  }
  return output;
}

function projectChartLegendItems(value: unknown): readonly ChartLegendItem[] | undefined {
  const admission = admitChartArray(value);
  if (!admission || !chartArrayIsStillAdmitted(admission)) return undefined;
  const output: ChartLegendItem[] = [];
  for (let index = 0; index < admission.length; index += 1) {
    const descriptor = chartRecordValue(admission.source, String(index));
    if (
      descriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      descriptor === UNSAFE_OWN_DATA_DESCRIPTOR
    )
      continue;
    const item = projectChartLegendItem(descriptor.value);
    if (item) output.push(item);
  }
  return Object.freeze(output);
}

function chartDatasetBoolean(dataset: unknown, property: PropertyKey): boolean | undefined {
  const value = chartDatasetValue(dataset, property);
  return typeof value === 'boolean' ? value : undefined;
}

function chartDatasetAxis(dataset: unknown): 'y' | 'y2' {
  return chartDatasetValue(dataset, 'yAxisID') === 'y2' ||
      chartDatasetValue(dataset, 'axis') === 'y2'
    ? 'y2'
    : 'y';
}

/** The Chart.js dataset `stack` group id, or `undefined` for a series that never set
 *  `LyraChartSeries.stack` -- every such series shares that one implicit group, keeping every
 *  chart written before `stack` existed summing exactly as it always did. */
function chartDatasetStack(dataset: unknown): string | undefined {
  const value = chartDatasetValue(dataset, 'stack');
  return typeof value === 'string' ? value : undefined;
}
/** Whether a `size` selects the compact plot tier the deprecated `compact` boolean spelled. */
function isDenseChartSize(size: LyraSize): boolean {
  const step = normalizeSize(size);
  return step === 's' || step === 'xs' || step === '2xs';
}

/**
 * `<lr-chart>` — the core Chart.js wrapper used directly and by the typed
 * Chart.js tags plus `<lr-histogram>`. `<lr-lite-chart>` and `<lr-box-plot>`
 * are independent implementations. Requires the optional peer dep `chart.js`; `chartjs-plugin-zoom`
 * (for `zoomable`) and `chartjs-plugin-datalabels` (for `data-labels`/`stack-totals`)
 * are further optional peers loaded only on demand.
 * With IntersectionObserver available, canvas construction waits for the first delivered
 * visibility decision; without it, drawing starts as soon as the peer and canvas are ready.
 * Simplified pie/doughnut datasets with magnitudes above Number.MAX_SAFE_INTEGER are uniformly
 * scaled for finite peer arc geometry. Legends, tooltips, data labels and semantic exports retain
 * original values; direct peer callbacks see scaled values. Explicit config.data is passed through.
 *
 * **API mirror note:** the real `wa-chart` docs page
 * (https://webawesome.com/docs/components/chart/) documents a `config:
 * ChartJS['config']` property alongside its simplified attributes — "a
 * flexible wrapper around Chart.js" supporting *both* simplified attributes
 * and full Chart.js configuration passthrough, not a `data`/`options` prop
 * pair. `lr-chart` mirrors that dual surface: the `LyraChartSeries`-based
 * `datasets`/`labels`/`type`/`withoutLegend`/`xLabel`/`yLabel`/`zoomable` attributes
 * below are the simplified surface (compatible with WA's `type`, `xLabel`,
 * `yLabel`, `withoutLegend`, etc.), and the additional
 * `config` property is the raw-passthrough escape hatch — a
 * `LyraChartConfiguration` deep-merged over the generated config in
 * `buildConfig()`, mirroring WA's `config` property without discarding the
 * `LyraChartSeries` shape the rest of this component family (subclasses, box-plot,
 * histogram) is built on.
 *
 * `datasets`, `annotations`, and `hiddenDatasets` take bounded, clone-owned readonly snapshots.
 * Create a new collection and reassign it after changes; mutating the assigned array does not
 * update the view. `labels` does not yet share this contract.
 *
 * Prepared inputs are immutable summaries of a complete source. Series preserve original x/y,
 * indices and gaps; category values represent named aggregates. Generated tables and synchronous
 * Spatial scatter/bubble sources preserve complete density counts with bounded point overlays.
 * Spatial mode requires maxRecords >= 3 and linear axes; viewport and selectedPointId are
 * property-only controls. Density always includes all series, independently of point visibility.
 * exportData contain the displayed summary, not every original observation. Exact point reveal
 * reads one original position and optionally requests an indexed neighborhood. Zoom itself remains
 * on the overview; it never guesses source indices from a numeric x coordinate.
 *
 * @customElement lr-chart
 * @event lr-zoom - `detail: { zoomed }`.
 * @event lr-spatial-point-select - A spatial point was activated; detail preserves revision and original point identity, coordinates, series and radius.
 * @event lr-spatial-bin-select - A density region was activated; detail contains revision, bounds and count.
 * @event lr-source-point-select - A prepared observation was activated. Detail contains revision,
 *   seriesId, original sourceIndex and point { x, y }; legacy activation indices remain plotted indices.
 * @event lr-source-category-select - A prepared aggregate was activated. Detail contains revision,
 *   seriesId, categoryId, value and observationCount.
 * @event lr-point-activate - Fired when pointer input lands on a data point/segment, when a
 *   generated data-table value is activated, or when Enter/Space activates the keyboard-current
 *   canvas datum. `detail: { datasetIndex: number, index: number, label: string |
 *   undefined, value: unknown }`. For scatter/bubble data, `label` prefers the per-point label and
 *   `value` contains the complete `LyraChartPoint` (`x`, `y`, optional `r`, optional `id`, optional
 *   `label`). A primitive `id` is retained for application navigation and selection; unsafe or
 *   non-finite values are omitted. The heterogeneous event value is typed `unknown`; consumers
 *   must narrow the value itself before reading point fields.
 * @event lr-datum-activate - Family-normalized activation event. Its detail adds `kind`
 *   (`bar`, `point`, `segment`, or `slice`) to the `lr-point-activate` detail. For scatter/bubble
 *   points its `value` is the same `LyraChartPoint`, including a safe primitive `id` when present.
 * @event lr-legend-visibility-change-request - Cancelable proposal emitted before a DOM legend
 *   toggle changes state. `detail` contains the target `datasetIndex`, its proposed `visible`
 *   value, and the complete canonical proposed `hiddenDatasets` snapshot. This request is the
 *   sole veto point for the gesture.
 * @event lr-legend-visibility-change - Emitted after an accepted DOM legend toggle commits the
 *   same detail. Programmatic `hiddenDatasets` changes reconcile without either event.
 * @event lr-datum-visibility-change-request - Cancelable category visibility proposal in datum
 *   legend mode. `detail: { index: number, visible: boolean, hiddenDatums: readonly number[] }`.
 *   Source category indexes apply to every dataset/ring. The complete detail is frozen. This
 *   request is the sole veto point for the gesture.
 * @event lr-datum-visibility-change - Emitted after an accepted category toggle commits the same
 *   frozen detail. Programmatic `hiddenDatums` assignments are silent.
 * @csspart base - The chart wrapper.
 * @csspart plot - The fixed-height canvas/overlay region.
 * @csspart canvas - The Chart.js canvas.
 * @csspart legend - The wrapping DOM legend, rendered unless `withoutLegend` is set.
 * @csspart legend-item - A keyboard-operable dataset or category visibility toggle.
 * @csspart legend-item-hidden - Added while the legend item's dataset or category is hidden.
 * @csspart legend-swatch - The resolved dataset/category color swatch in a legend item.
 * @csspart reset-zoom-button - The reset-zoom control when zoom is active.
 * @csspart description - The accessible chart summary.
 * @csspart data-table - The optional generated or slotted data table.
 * @csspart data-table-toggle - The disclosure button rendered by `dataTableToggle`.
 * @csspart center - The chart-area-centered overlay wrapper for the `center` slot.
 * @csspart error - Static visible error shown instead of `canvas` when the optional `chart.js`
 *   peer dependency is not installed or the canvas context is unavailable. Canvas failure keeps
 *   the data table visible and retries on data updates or `refreshTheme()`; its transition is
 *   announced through a shared light-DOM alert.
 * @csspart notices - Wrapper for nonfatal feature warnings and generated-data truncation notices.
 * @csspart limit - Admission-limit disclosure when an input exceeds 10,000 entries.
 * @csspart data-truncation - Explanation shown when the generated accessible alternative samples
 *   a data set larger than its 1,000-record ceiling.
 * @csspart feature-warning - Static nonfatal warning when a requested optional feature peer is
 *   unavailable while the core chart remains usable.
 * @cssprop [--lr-chart-height=var(--lr-size-280px)] - The plot region's `block-size` and the
 *   host's minimum block size. A visible data table or wrapping DOM legend grows the host in
 *   normal flow instead of overlapping following content. `height` supplies a private fallback;
 *   this public token always wins when a consumer sets it.
 * @cssprop [--lr-chart-grid-color=var(--lr-color-border-subtle)] - Grid-line color. Resolved via
 *   `getComputedStyle` on every draw (Chart.js paints to canvas and cannot consume `var()`).
 * @cssprop [--lr-chart-tick-color=var(--lr-color-text-quiet)] - Axis tick-label color; also used
 *   for the `xLabel`/`yLabel`/`y2Label` axis-title text (there is no separate title-color token).
 *   Resolved via `getComputedStyle` on every draw.
 * @cssprop [--lr-chart-tick-font-size=var(--lr-font-size-xs)] - Axis tick-label font size, in any
 *   CSS length unit. Defaults to `--lr-font-size-xs` (12px at the standard root) because that
 *   matches Chart.js's OWN built-in tick font size, which is what every canvas chart rendered
 *   before this token existed -- leaving it unset must stay byte-identical to that, not shrink to
 *   `<lr-lite-chart>`'s SVG default. Also sizes the radar/polarArea `r`-scale `pointLabels` (the
 *   spoke labels), but ONLY once set: those default separately to Chart.js's OWN distinct
 *   `RadialLinearScale` `pointLabels` default (10px, not this token's 12px), and only adopt this
 *   token's size once the consumer explicitly sets it, at which point ticks and point labels match.
 *   Resolved via `getComputedStyle` on every draw, same constraint as every other `--lr-chart-*`
 *   token here (Chart.js paints to canvas and cannot consume `var()`).
 * @cssprop [--lr-chart-legend-color=var(--lr-color-text)] - Legend label color. Resolved via
 *   `getComputedStyle` on every draw.
 * @cssprop [--lr-chart-legend-side-max=var(--lr-size-15rem)] - Maximum inline size reserved for a
 *   side-positioned DOM legend; the track is also capped at one third of the chart allocation.
 * @cssprop [--lr-chart-legend-item-hover-bg=var(--lr-color-brand-quiet)] - Hover background of a
 *   legend visibility button.
 * @cssprop --lr-chart-legend-item-active-bg - Pressed background of a legend visibility button;
 *   defaults to the standard active mix of `--lr-color-brand-quiet`.
 * @cssprop [--lr-chart-data-table-button-hover-bg=var(--lr-color-brand-quiet)] - Hover background
 *   of an actionable generated-table value.
 * @cssprop --lr-chart-data-table-button-active-bg - Pressed background of an actionable generated-
 *   table value; defaults to the standard active mix of `--lr-color-brand-quiet`.
 * @cssprop [--lr-chart-data-table-toggle-hover-bg=var(--lr-color-brand-quiet)] - Hover background
 *   of the `dataTableToggle` disclosure button.
 * @cssprop --lr-chart-data-table-toggle-active-bg - Pressed background of the `dataTableToggle`
 *   disclosure button; defaults to a mix of the hover background with the shared active mix
 *   partner.
 * @cssprop [--lr-chart-reset-zoom-button-hover-bg=var(--lr-color-brand-quiet)] - Hover background
 *   of the reset-zoom button.
 * @cssprop --lr-chart-reset-zoom-button-active-bg - Pressed background of the reset-zoom button;
 *   defaults to the standard active mix of `--lr-color-brand-quiet`.
 * @cssprop [--lr-chart-tooltip-bg=var(--lr-color-surface)] - Tooltip background color. Resolved
 *   via `getComputedStyle` on every draw.
 * @cssprop [--lr-chart-tooltip-color=var(--lr-color-text)] - Tooltip text color. Resolved via
 *   `getComputedStyle` on every draw.
 * @cssprop [--lr-chart-canvas-hover-outline-width=var(--lr-border-width-thin)] - Width of the
 *   `[part='canvas']` hover-state outline.
 * @cssprop [--lr-chart-canvas-hover-outline-color=var(--lr-chart-grid-color, var(--lr-color-border))] - Color of the
 *   `[part='canvas']` hover-state outline. Follows a set `--lr-chart-grid-color`; left unset, it
 *   stays on the control-grade `--lr-color-border` instead of the grid lines' decorative default.
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
 * @csspart sync-crosshair - Decorative category crosshair shown while a sync group is active.
 * @cssprop [--lr-chart-sync-crosshair-color=var(--lr-color-text)] - Shared category crosshair color.
 * @cssprop [--lr-chart-sync-crosshair-width=var(--lr-border-width-thin)] - Shared category crosshair width.
 * @status stable
 * @since 4.0.0
 */
export class LyraChart extends LyraElement<LyraChartEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    chart: LYRA_DEFAULT_chart,
    chartAnnotationsUnavailable: LYRA_DEFAULT_chartAnnotationsUnavailable,
    chartAxisTotal: LYRA_DEFAULT_chartAxisTotal,
    chartBubblePointCoordinates: LYRA_DEFAULT_chartBubblePointCoordinates,
    chartCategory: LYRA_DEFAULT_chartCategory,
    chartData: LYRA_DEFAULT_chartData,
    chartDataLabelsUnavailable: LYRA_DEFAULT_chartDataLabelsUnavailable,
    chartDataSampled: LYRA_DEFAULT_chartDataSampled,
    chartInputLimit: LYRA_DEFAULT_chartInputLimit,
    chartLabeledPoint: LYRA_DEFAULT_chartLabeledPoint,
    chartMissingLibrary: LYRA_DEFAULT_chartMissingLibrary,
    chartPlotSampled: LYRA_DEFAULT_chartPlotSampled,
    chartPointCoordinates: LYRA_DEFAULT_chartPointCoordinates,
    chartPointLabel: LYRA_DEFAULT_chartPointLabel,
    chartPreparedSummary: LYRA_DEFAULT_chartPreparedSummary,
    chartPreparedSummaryZoom: LYRA_DEFAULT_chartPreparedSummaryZoom,
    chartPreparedUnavailable: LYRA_DEFAULT_chartPreparedUnavailable,
    chartPrimaryAxis: LYRA_DEFAULT_chartPrimaryAxis,
    chartRenderUnavailable: LYRA_DEFAULT_chartRenderUnavailable,
    chartSecondaryAxis: LYRA_DEFAULT_chartSecondaryAxis,
    chartSeriesLabel: LYRA_DEFAULT_chartSeriesLabel,
    chartSeriesNoData: LYRA_DEFAULT_chartSeriesNoData,
    chartSpatialBin: LYRA_DEFAULT_chartSpatialBin,
    chartSpatialDensityLegend: LYRA_DEFAULT_chartSpatialDensityLegend,
    chartSpatialHidden: LYRA_DEFAULT_chartSpatialHidden,
    chartSpatialPoint: LYRA_DEFAULT_chartSpatialPoint,
    chartSpatialRadiusDomain: LYRA_DEFAULT_chartSpatialRadiusDomain,
    chartSpatialSummary: LYRA_DEFAULT_chartSpatialSummary,
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
    chartValuePercentageLabel: LYRA_DEFAULT_chartValuePercentageLabel,
    chartZoomUnavailable: LYRA_DEFAULT_chartZoomUnavailable,
    liteChartMarkSummary: LYRA_DEFAULT_liteChartMarkSummary,
    loading: LYRA_DEFAULT_loading,
    noData: LYRA_DEFAULT_noData,
    resetZoom: LYRA_DEFAULT_resetZoom,
  };
  // GENERATED DEFAULT-STRING SLICE: END
  protected static override collectionSupport = collectionSupport;

  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-legend-visibility-change-request',
    'lr-legend-visibility-change',
    'lr-datum-visibility-change-request',
    'lr-datum-visibility-change',
  ]);

  // Series keep caller-owned data/points identities and private canonical projections. Labels
  // are projected lazily so a proxy revoked during admission fails closed before chart reads.
  // The remaining collections use the ordinary eager ownership boundary.
  protected static override readonly ownedCollectionProperties = Object.freeze([
    'annotations',
    'hiddenDatasets',
  ]);

  static override styles = [LyraElement.styles, specialistTokens, chartSurfaceStyles, styles, srOnly, bidiStyles];

  constructor() {
    super();
    // Redraws (re-resolving `--lr-chart-*` via getComputedStyle, since canvas can't read var())
    // when prefers-color-scheme flips or an ancestor's theme attribute mutates. The controller
    // registers itself with the host via addController(); redraw only once a chart exists.
    new ThemeWatcher(this, () => {
      if (this.chart && this.canvasTokens.hasThemeChanged()) this.refreshTheme();
    });
  }

  /** Canvas colors and lengths resolved since the last theme notification. */
  private readonly canvasTokens = new ChartTokenCache(this);

  @property({ converter: { fromAttribute: (value) => normalizeChartType(value) } })
  type: LyraChartType = 'bar';
  private _preparedData: LyraChartPreparedData | null = null;
  /**
   * Property-only immutable whole-source summary. Takes precedence over labels, datasets and
   * config.data. Series require line/bar; categories require bar or a radial category chart.
   * Spatial sources require scatter/bubble, linear axes and maxRecords >= 3. Bubble sources
   * declare an exact full-source radiusDomain and a finite nonnegative radius on every point.
   * Spatial CSV exports bounded point/bin rows with original coordinates and identity.
   * All peer entries (including gap separators) must fit aggregate maxRecords, with two slots
   * reserved for an isolated exact-point overlay. Rectangular table cells stay at most 1,000;
   * semantic samples plus the overlay stay at most 9,000. Four samples without gaps need at
   * least six maxRecords slots; each line gap needs another slot. Oversized summaries fail visibly.
   * Reassign or explicitly requestUpdate after changing a host-authored descriptor/revision.
   */
  @property({ attribute: false })
  get preparedData(): LyraChartPreparedData | null { return this._preparedData; }
  set preparedData(value: LyraChartPreparedData | null) {
    const previous = this._preparedData;
    this._preparedData = value;
    this.requestUpdate('preparedData', previous);
    if (value === previous) this.requestUpdate();
  }

  /** Specialized derived distributions may supply their own bounded semantic input. */
  protected preparedDataInput(): LyraChartPreparedData | null { return this._preparedData; }

  /** Full spatial viewport; null retains the exact global source bounds. */
  @property({ attribute: false }) viewport: LyraSpatialBounds | null = null;
  /** Controlled exact spatial selection, independent of reveal focus. */
  @property({ attribute: false }) selectedPointId = '';
  private spatialActive = false;
  private spatial = new SpatialSourceController(this, () => this.spatialChanged(), () => this.effectiveLocale);
  private spatialWaiters = new Set<() => void>();
  private spatialRevealToken: object = {};
  private preparedGeneration: object = {};
  private spatialKeyboardIndex = 0;
  private spatialChanged(): void {
    this.preparedChanged = true;
    this.preparedPending = this.spatial?.loading ?? false;
    this.preparedRequestFailed = this.spatial?.error ?? false;
    this.descriptionMemo = undefined;
    this.dataTableRows = undefined;
    super.requestUpdate('spatialView', null);
    if (!this.spatial?.loading || this.spatial.error) this.wakeSpatialWaiters();
  }
  private wakeSpatialWaiters(): void {
    for (const resolve of this.spatialWaiters ?? []) resolve();
    this.spatialWaiters?.clear();
  }
  private spatialPoints(): readonly LyraSpatialChartPoint[] {
    return this.spatial.points() as readonly LyraSpatialChartPoint[];
  }
  private spatialSeriesPoints(visible = false): readonly LyraSpatialChartPoint[][] {
    const points = this.spatialPoints(), view = this.spatial.view, series = this.spatial.binding?.chart?.series ?? [];
    const groups = series.map(() => [] as LyraSpatialChartPoint[]);
    const indices = new Map(series.map((entry, index) => [entry.id, index]));
    for (const point of points) {
      const index = indices.get(point.seriesId);
      if (index !== undefined && (!visible || !!view && spatialContains(view, point))) groups[index]!.push(point);
    }
    return groups;
  }
  private spatialGuard(member: () => boolean = () => true): (event?: Event) => boolean {
    const binding = this.spatial.binding, result = this.spatial.result, owner = this.ownerDocument;
    const epoch = this.spatial.authority.epoch, generation = this.preparedGeneration;
    return event => {
      const target = event?.currentTarget as Element | null | undefined;
      return this.isConnected && this.ownerDocument === owner && this.spatialActive && generation === this.preparedGeneration &&
        binding === this.spatial.binding && result === this.spatial.result && epoch === this.spatial.authority.epoch &&
        !this.spatial.loading && !this.spatial.error && member() &&
        (!event || !!target?.isConnected && target.getRootNode() === this.renderRoot && target.ownerDocument === owner);
    };
  }
  private spatialPointText(point: LyraSpatialChartPoint): string {
    const series = this.spatial.binding!.chart!.series;
    const datasetIndex = series.findIndex(series => series.id === point.seriesId);
    const coordinates = this.datumDisplayValue({ x: point.x, y: point.y, ...(point.radius === undefined ? {} : { r: point.radius }) },
      { surface: 'table', datasetIndex, index: point.sourceIndex, label: point.label, seriesLabel: series[datasetIndex]!.label });
    return this.localize('chartSpatialPoint', undefined, { series: series[datasetIndex]!.label, id: point.id,
      sourceIndex: this.formatSummaryValue(point.sourceIndex), coordinates,
      hidden: this.canonicalHiddenDatasets()?.includes(datasetIndex) ? this.localize('chartSpatialHidden') : '' });
  }
  private spatialBinText(bin: LyraSpatialBin): string {
    const format = (value: number) => this.formatSummaryValue(value);
    return this.localize('chartSpatialBin', undefined, { count: format(bin.count), minX: format(bin.bounds.minX), maxX: format(bin.bounds.maxX), minY: format(bin.bounds.minY), maxY: format(bin.bounds.maxY) });
  }
  private activateSpatialPoint(point: LyraSpatialChartPoint): void {
    const current = this.spatialGuard(() => this.spatialPoints().includes(point));
    if (!current()) return;
    const binding = this.spatial.binding!, result = this.spatial.result!;
    this.emit('lr-spatial-point-select', Object.freeze({ revision: binding.revision, point }));
    if (!current() || !result.points.includes(point)) return;
    const datasetIndex = this.spatial.binding!.chart!.series.findIndex(series => series.id === point.seriesId);
    const index = this.spatialSeriesPoints(true)[datasetIndex]!.indexOf(point);
    if (index < 0) return;
    const datum = { datasetIndex, index, label: point.label, value: Object.freeze({ x: point.x, y: point.y, ...(point.radius === undefined ? {} : { r: point.radius }), ...(point.label === undefined ? {} : { label: point.label }) }) };
    this.emit('lr-point-activate', datum);
    if (!current()) return;
    this.emit('lr-datum-activate', { ...datum, kind: 'point' });
  }
  private activateSpatialBin(bin: LyraSpatialBin): void {
    if (this.spatialGuard(() => this.spatial.result?.bins.includes(bin) === true)())
      this.emit('lr-spatial-bin-select', Object.freeze({ revision: this.spatial.binding!.revision, bounds: bin.bounds, count: bin.count }));
  }
  private async revealSpatialPoint(id: string): Promise<boolean> {
    const token = this.spatialRevealToken = {}; this.wakeSpatialWaiters();
    if (this.preparedDirty) await this.updateComplete;
    const epoch = this.spatial.authority.epoch, binding = this.spatial.binding, owner = this.ownerDocument;
    const current = () => token === this.spatialRevealToken && this.spatialActive && this.isConnected &&
      owner === this.ownerDocument && binding === this.spatial.binding && epoch === this.spatial.authority.epoch;
    if (!current() || this.spatial.error) return false;
    const point = await this.spatial.reveal(id);
    if (!point || !current()) return false;
    const series = this.spatial.binding!.chart!.series.findIndex(series => series.id === point.seriesId);
    if (this.canonicalHiddenDatasets()?.includes(series)) return false;
    const viewport = this.spatial.panTo(point);
    if (viewport === undefined) return false;
    if (viewport !== this.viewport) this.viewport = viewport;
    await this.updateComplete;
    if (!current()) return false;
    if (this.spatial.loading) await new Promise<void>(resolve => this.spatialWaiters.add(resolve));
    if (!current() || this.spatial.error) return false;
    await this.updateComplete;
    if (!current()) return false;
    const index = this.spatialKeyboardItems().findIndex(item => 'id' in item && item.id === id);
    const canvas = this.canvasEl;
    if (index < 0 || !canvas) return false;
    this.spatialKeyboardIndex = index; canvas.focus();
    return current() && !this.spatial.error && !this.spatial.loading && this.canvasEl === canvas &&
      this.spatialKeyboardItems().includes(point as LyraSpatialChartPoint) && this.renderRoot.querySelector(':focus') === canvas;
  }
  private spatialKeyboardItems(): readonly (LyraSpatialChartPoint | LyraSpatialBin)[] {
    const hidden = this.canonicalHiddenDatasets() ?? [];
    return [...this.spatialSeriesPoints(true).flatMap((points, index) => hidden.includes(index) ? [] : points), ...(this.spatial.result?.bins ?? [])];
  }
  private spatialKeyDown(event: KeyboardEvent): void {
    if (!this.spatialGuard()()) return;
    const items = this.spatialKeyboardItems(); if (!items.length) return;
    let next = Math.min(this.spatialKeyboardIndex, items.length - 1);
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); if (event.repeat) return;
      const item = items[next]!; if ('id' in item) this.activateSpatialPoint(item); else this.activateSpatialBin(item);
      return;
    }
    const rtl = this.effectiveDirection === 'rtl';
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else if (event.key === (rtl ? 'ArrowLeft' : 'ArrowRight') || event.key === 'ArrowDown') next = Math.min(items.length - 1, next + 1);
    else if (event.key === (rtl ? 'ArrowRight' : 'ArrowLeft') || event.key === 'ArrowUp') next = Math.max(0, next - 1);
    else return;
    event.preventDefault(); this.spatialKeyboardIndex = next;
    const item = items[next]!; this.keyboardDatumAnnouncement = 'id' in item ? this.spatialPointText(item) : this.spatialBinText(item);
  }
  private renderSpatialTable(): TemplateResult {
    return html`<table class=${this.dataTableVisible ? nothing : 'sr-only'}><caption>${this.accessibleName(this.localize('chartData'))}</caption>
      <thead><tr><th scope="col">${this.localize('chartCategory')}</th><th scope="col">${this.localize('chartData')}</th></tr></thead><tbody>
      ${this.spatialPoints().map(point => { const current = this.spatialGuard(() => this.spatialPoints().includes(point));
        return html`<tr><th scope="row">${point.label ?? point.id}</th><td><button type="button" tabindex=${this.dataTableVisible ? '0' : '-1'} data-spatial-id=${point.id}
          @click=${(event: Event) => { if (current(event)) this.activateSpatialPoint(point); }}>${this.spatialPointText(point)}</button></td></tr>`; })}
      ${(this.spatial.result?.bins ?? []).map((bin, index) => { const current = this.spatialGuard(() => this.spatial.result?.bins.includes(bin) === true);
        return html`<tr><th scope="row">${this.spatialBinText(bin)}</th><td><button type="button" tabindex=${this.dataTableVisible ? '0' : '-1'} aria-label=${this.spatialBinText(bin)} data-spatial-bin=${index}
          @click=${(event: Event) => { if (current(event)) this.activateSpatialBin(bin); }}>${this.formatSummaryValue(bin.count)}</button></td></tr>`; })}
      </tbody></table>`;
  }

  private preparedDirty = true;
  private preparedActive = false;
  private preparedChanged = false;
  private preparedInvalid = false;
  private preparedPending = false;
  private preparedRequestFailed = false;
  private announcedPreparedInvalid = false;
  private preparedBaseModel?: PreparedChartModel;
  private preparedModel?: PreparedChartModel;
  private preparedEffective?: { model: PreparedChartModel; data: EffectiveChartData };
  private readonly preparedRequests = new SourceRequestController(this, {
    channels: ['point'] as const, onReset: () => { this.preparedPending = false; },
  });

  private refreshPreparedModel(): void {
    if (!this.preparedDirty) return;
    this.preparedDirty = false;
    this.preparedInvalid = false;
    this.preparedRequestFailed = false;
    this.preparedBaseModel = this.preparedModel = undefined;
    this.preparedEffective = undefined;
    const generation = this.preparedGeneration;
    const input = this.preparedDataInput();
    // A keyless refresh revalidates mutable sources, but an ordinary chart has no prepared
    // canvas data to invalidate. Leaving prepared mode still requires the legacy-data redraw.
    this.preparedChanged ||= this.preparedActive || input !== null;
    this.spatialActive = false;
    this.preparedActive = input !== null;
    try {
      if (input !== null) {
        const kind = Object.getOwnPropertyDescriptor(input, 'kind');
        if (generation !== this.preparedGeneration) return;
        if (kind && 'value' in kind && kind.value === 'spatial') {
          const type = this.effectiveType();
          if ((type !== 'scatter' && type !== 'bubble') || this.scaleType !== 'linear') throw new TypeError('Incompatible spatial chart');
          this.spatialActive = true;
          this.preparedRequests.setSource(undefined, undefined);
          this.spatial.bind(input as LyraSpatialChartSource, this.viewport, normalizeChartRecordLimit(this.maxRecords), this.selectedPointId, { type: type as 'scatter' | 'bubble' });
          if (generation !== this.preparedGeneration) return;
          this.preparedInvalid = this.spatial.error;
          return;
        }
        const model = prepareChartModel(input, this.effectiveType(), normalizeChartRecordLimit(this.maxRecords));
        this.preparedBaseModel = this.preparedModel = model;
        this.preparedRequests.setSource(input, model.revision);
      } else this.preparedRequests.setSource(undefined, undefined);
    } catch {
      this.preparedInvalid = true;
      this.preparedRequests.setSource(undefined, undefined);
    }
  }

  /**
   * Resolves one original source position and adds a bounded isolated overlay. Returns false for
   * missing, invalid, canceled or obsolete points. It never interprets sourceIndex as a peer index
   * or scans the original source. An optional queryRange refines a bounded index neighborhood
   * around the revealed point. Zoom itself remains summary-only and never guesses an x/index map.
   */
  revealSourcePoint(id: string): Promise<boolean>;
  revealSourcePoint(ref: LyraSeriesPointRef): Promise<boolean>;
  async revealSourcePoint(ref: LyraSeriesPointRef | string): Promise<boolean> {
    if (typeof ref === 'string') return this.revealSpatialPoint(ref);
    if (!this.isConnected || !ref || typeof ref.seriesId !== 'string') return false;
    ref = Object.freeze({ seriesId: ref.seriesId, sourceIndex: ref.sourceIndex });
    if (this.preparedDirty) await this.updateComplete;
    const model = this.preparedBaseModel;
    if (!model || model.kind !== 'series') return false;
    const series = model.series.find(series => series.id === ref.seriesId);
    if (!series || !Number.isSafeInteger(ref.sourceIndex) || ref.sourceIndex < 0 || ref.sourceIndex >= series.counts.sourceCount) return false;
    const lease = this.preparedRequests.begin('point', this.effectiveLocale);
    if (!lease) return false;
    this.preparedPending = true;
    this.preparedRequestFailed = false;
    this.requestUpdate('preparedView', null);
    const signal = lease.context.signal;
    try {
      const source = model.source;
      if (source.kind !== 'series' || source.revision !== model.revision) throw new Error('Prepared source revision changed');
      const response = source.getPoint(ref, { signal });
      const point = await preparedResponse(response, signal);
      if (!lease.isCurrent() || this.preparedBaseModel !== model || source.revision !== model.revision) return false;
      if (point === null) return false;
      let next = model;
      const refinement = Object.getOwnPropertyDescriptor(source, 'queryRange');
      if (refinement) {
        if (!('value' in refinement) || typeof refinement.value !== 'function') throw new TypeError('Invalid indexed refinement');
        const otherEntries = model.peerCount - series.samples.length;
        // A line refinement can need one separator between every pair of samples, plus
        // two entries for the isolated overlay. Every series also shares the table rows.
        const entryBudget = Math.min(model.limit - otherEntries, Math.floor(1000 / model.series.length));
        const maxPoints = Math.max(1, Math.floor((entryBudget - 1) / 2));
        const startIndex = Math.max(0, ref.sourceIndex - maxPoints);
        const endIndex = Math.min(series.counts.sourceCount, ref.sourceIndex + Math.min(maxPoints + 1, series.counts.sourceCount - ref.sourceIndex));
        const request = { seriesId: ref.seriesId, startIndex, endIndex, maxPoints, signal };
        const points = await preparedResponse(source.queryRange!(request), signal);
        if (!lease.isCurrent() || this.preparedBaseModel !== model || source.revision !== model.revision) return false;
        next = withPreparedRange(model, request, points);
      }
      const overlay = withPreparedPoint(next, ref, point);
      if (!lease.isCurrent() || this.preparedBaseModel !== model || source.revision !== model.revision) return false;
      this.preparedModel = overlay;
      this.preparedChanged = true;
      this.preparedEffective = undefined;
      this.descriptionMemo = undefined;
      this.dataTableRows = undefined;
      return true;
    } catch {
      if (lease.isCurrent()) {
        this.preparedRequestFailed = true;
        this.announcements.announceAssertive(this.localize('chartPreparedUnavailable'));
      }
      return false;
    } finally {
      if (lease.isCurrent()) {
        this.preparedPending = false;
        this.requestUpdate('preparedView', null);
      }
    }
  }

  @property({ attribute: false }) labels: string[] = [];
  /** Maximum rendered records across all series, clamped to 2–1,000. The plot width may lower
   * this bound. Numeric bucket extremes and both endpoints are retained when the budget permits.
   * Summaries and CSV exports retain the complete admitted input (at most 10,000 entries per array).
   * @default 1000
   */
  // numeric-guard-exempt: normalizeChartRecordLimit() in chart-table-sampling.ts normalizes render budgets through finiteCount().
  @property({ type: Number, attribute: 'max-records' }) maxRecords = 1_000;
  @state() private samplingWidth = 0;
  private labelsSnapshot?: { source: unknown; value: readonly string[] };
  private annotationsSnapshot?: {
    source: unknown;
    value: readonly LyraChartAnnotation[];
  };
  private appliedLegendVisibility?: { chart: RuntimeChart; hidden: readonly number[] | undefined };
  private hiddenDatasetsSnapshot?: {
    source: unknown;
    value: readonly number[] | undefined;
  };

  /** Public collection identities remain observable; internal computation uses these one-read copies. */
  private canonicalLabels(): readonly string[] {
    const source = this.labels;
    if (this.labelsSnapshot && Object.is(this.labelsSnapshot.source, source))
      return this.labelsSnapshot.value;
    const value = projectChartStrings(source) ?? Object.freeze([]);
    this.labelsSnapshot = { source, value };
    return value;
  }

  private canonicalAnnotations(): readonly LyraChartAnnotation[] {
    const source = this.annotations;
    if (this.annotationsSnapshot && Object.is(this.annotationsSnapshot.source, source))
      return this.annotationsSnapshot.value;
    const value = projectChartAnnotations(source);
    this.annotationsSnapshot = { source, value };
    return value;
  }

  private canonicalHiddenDatasets(): readonly number[] | undefined {
    const source = this.hiddenDatasets;
    if (this.hiddenDatasetsSnapshot && Object.is(this.hiddenDatasetsSnapshot.source, source))
      return this.hiddenDatasetsSnapshot.value;
    // The owned-collection boundary already detached this public array through descriptors.
    const value = source === undefined ? undefined : Object.freeze(
      Array.isArray(source)
        ? source.filter((index): index is number => typeof index === 'number' && Number.isInteger(index))
        : [],
    );
    this.hiddenDatasetsSnapshot = { source, value };
    return value;
  }

  private _datasets: readonly LyraChartSeries[] = Object.freeze([]);
  private datasetsSource: unknown = this._datasets;
  /** Simplified chart series. Non-record entries are dropped while valid sibling series remain. */
  @property({ attribute: false })
  get datasets(): readonly LyraChartSeries[] {
    return this._datasets;
  }
  set datasets(value: readonly LyraChartSeries[]) {
    if (Object.is(value, this.datasetsSource) || Object.is(value, this._datasets)) return;
    const previous = this._datasets;
    this._datasets = normalizeChartSeries(value);
    this.datasetsSource = value;
    this.requestUpdate('datasets', previous);
  }
  /**
   * Complete controlled visibility state for DOM legend toggles. `undefined` (the default) honors
   * each effective dataset's `hidden` configuration; a defined array wins over those defaults, and
   * an empty array deliberately makes every dataset visible. Invalid, duplicate, and out-of-range
   * indexes are ignored when state is applied or emitted.
   */
  @property({ attribute: false }) hiddenDatasets?: readonly number[];
  private _hiddenDatums: readonly number[] = Object.freeze([]);
  /**
   * Controlled hidden source category indexes for pie/doughnut/polar-area charts, shared by all
   * datasets/rings. Clone-owned; invalid, duplicate and out-of-range indexes are ignored when
   * applied or emitted. Empty restores all categories. Does not alter dataset visibility or exports.
   * @default []
   */
  @property({ attribute: false })
  get hiddenDatums(): readonly number[] { return this._hiddenDatums; }
  set hiddenDatums(value: readonly number[]) {
    // A declarative parent re-commits the same array on every render; only a new one is a change.
    if (Object.is(value, this.hiddenDatumsSource) || Object.is(value, this._hiddenDatums)) return;
    const previous = this._hiddenDatums;
    this._hiddenDatums = projectHiddenDatasetIndexes(value) ?? Object.freeze([]);
    this.hiddenDatumsSource = value;
    this.requestUpdate('hiddenDatums', previous);
  }
  private hiddenDatumsSource: unknown = this._hiddenDatums;
  /**
   * `datum` renders category toggles for pie/doughnut/polar-area charts. Categories use the first
   * dataset's colors and values; a toggle affects that category in every ring. Other chart types
   * retain dataset legends. `auto` (the default) resolves to `datum` on pie/doughnut/polar-area
   * charts -- where a single-dataset legend would otherwise enumerate one entry for the whole
   * dataset instead of one per visible slice -- and to `dataset` everywhere else. `dataset` always
   * forces the dataset legend, even on a slice chart. Both non-`auto` modes use the generated
   * accessible-data sampling budget.
   * @default 'auto'
   */
  @property({ attribute: 'legend-mode', converter: {
    fromAttribute: (value) => value === 'datum' ? 'datum' : value === 'dataset' ? 'dataset' : 'auto',
  } }) legendMode: LyraChartLegendMode = 'auto';
  /**
   * `auto` retains optional legend formatting; `label` omits values even with a formatter; `value`
   * appends a formatted value. `percentage` uses locale percentages of the absolute represented
   * legend values, including hidden items (zero totals yield 0%). `value-percentage` appends both,
   * as `label: value (percentage)`. Dataset values are sampled sums; category values come from the
   * first dataset. The `formatter`/`valueFormatter` callback backing `value` and `value-percentage`
   * additionally receives that same `percentage` in its `surface: 'legend'` context, so a custom
   * formatter can build its own combined text without recomputing the share. Tooltip and axis
   * formatting are unchanged.
   */
  @property({ attribute: 'legend-display', converter: {
    fromAttribute: (value) =>
      ['label', 'value', 'percentage', 'value-percentage'].includes(value ?? '') ? value : 'auto',
  } }) legendDisplay: LyraChartLegendDisplay = 'auto';
  /**
   * Accessible chart description, which REPLACES the generated summary rather than adding to it.
   *
   * Left unset, the component builds an sr-only per-series summary from the actual data. Setting
   * this discards that summary entirely and substitutes your text -- a full override, which is the
   * right tool when you can describe the chart better than a generic walk of the series can.
   *
   * It is the wrong tool for adding a caveat ("excludes returns", "sampled hourly") on top of the
   * data summary: you would trade the whole summary for the caveat, and a consumer reasonably read
   * the old one-line doc as additive and did exactly that. For a caveat, prefer visible text beside
   * the chart -- a note only screen-reader users hear is worse for everyone than one everybody
   * sees -- or fold the data into your own `description` text if you are overriding anyway.
   */
  @property() description: string | null = null;
  /** Controls which cartesian grid axes are drawn. */
  @property({ converter: { fromAttribute: (value) => normalizeChartGrid(value) } })
  grid: LyraChartGrid = 'both';
  /** Complete cartesian axis visibility, independent of grid. `y` also controls the y2 axis.
   * Radial charts ignore this setting. Explicit config scale options retain precedence. */
  @property({ converter: { fromAttribute: (value) => normalizeChartGrid(value) } })
  axes: LyraChartAxes = 'both';
  /**
   * Plot density on the shared size scale. `s` (and the smaller `xs`/`2xs`) renders a compact
   * cartesian plot: axes are hidden and automatic layout padding is removed. Set `height` and
   * `withoutLegend` too for a small histogram/sparkline. Data tables, tooltips and keyboard actions
   * are preserved; radial charts ignore the compact tier. `m` (the default) and larger keep the
   * full plot. Explicit config options retain precedence.
   */
  @property() size: LyraSize = 'm';

  /** Whether `size` selects the compact plot tier. */
  private get compactPlot(): boolean {
    return isDenseChartSize(this.size);
  }
  /** Chart.js index axis. `'y'` is Chart.js's own mechanism for horizontal bars (it also flips
   *  line/area types onto a horizontal category axis). */
  @property({ attribute: 'index-axis' }) indexAxis: LyraChartIndexAxis = 'x';
  /** Accessible chart label. A host `aria-label` still has highest precedence. */
  @property() label: string | null = null;
  /** Legend placement. `auto` uses a right legend above 480px and a bottom legend below it. */
  @property({
    attribute: 'legend-position',
    converter: { fromAttribute: (value) => normalizeLegendPosition(value) },
  })
  legendPosition: LyraChartLegendPosition = 'top';
  /**
   * Scale type for the **value** axis (the categorical axis is unaffected). `'logarithmic'` plots
   * a dataset spanning several orders of magnitude honestly, where a linear axis collapses
   * everything below the maximum into the baseline. Inherited by `lr-line-chart`,
   * `lr-scatter-chart` and `lr-bar-chart`.
   *
   * A logarithmic axis cannot represent zero or negative values (`log(0)` is `-Infinity`), so
   * the zero baseline (`withoutZeroBaseline` unset) is not forwarded in that mode -- Chart.js
   * would otherwise be handed a bound it cannot place. Non-positive data points are dropped by
   * Chart.js's own log scale.
   */
  @property({ attribute: 'scale-type' }) scaleType: LyraChartScaleType = 'linear';
  /**
   * Declarative reference lines and shaded bands — a threshold, an event year, a regime change, a
   * highlighted period. Each entry marks either a single `value` or a `from`/`to` range on `axis`
   * (default `'y'`), with an optional `label` and semantic `tone`.
   *
   * Needs the optional `chartjs-plugin-annotation` peer, loaded on first actual demand so a page
   * with no annotated charts never downloads it. The plugin is registered globally, like
   * `chartjs-plugin-zoom` and unlike `chartjs-plugin-datalabels`: it draws nothing unless a chart
   * supplies annotation options, so the registration is unobservable to charts that set none, and
   * registration is also what installs the plugin's own element defaults. Without the peer
   * installed the chart still renders; a console warning plus a localized visible warning and
   * light-DOM announcement explain the no-op — the same fail-closed contract `data-labels` uses.
   *
   * Entries are included in the generated accessible description, mirroring `lr-heatmap`.
   */
  @property({ attribute: false }) annotations: readonly LyraChartAnnotation[] = [];
  /** Maximum value-axis bound. Non-finite values are ignored. */
  @property({ type: Number }) max: number | null = null;
  /** Minimum value-axis bound. Non-finite values are ignored. */
  @property({ type: Number }) min: number | null = null;
  private _plugins: readonly LyraChartPlugin[] = Object.freeze([]);
  private pluginsSource: unknown = this._plugins;
  /** Chart.js plugins attached to this chart instance. Valid plugins retain their opaque identity.
   * @default [] */
  @property({ type: Array })
  get plugins(): readonly LyraChartPlugin[] {
    return this._plugins;
  }
  set plugins(value: readonly LyraChartPlugin[]) {
    if (Object.is(value, this.pluginsSource) || Object.is(value, this._plugins))
      return;
    const previous = this._plugins;
    this._plugins = projectChartPlugins(value);
    this.pluginsSource = value;
    this.requestUpdate('plugins', previous);
  }
  /**
   * Formats numeric (value-axis) ticks, tooltip values, legend values, and generated accessible
   * table cells from one callback.
   * Horizontal scalar tooltips use parsed x, including a raw config indexAxis override;
   * structured points retain their y-value contract. The context-object formatter shares this rule.
   * Never runs against the categorical x-axis's own labels (line/bar's `labels` strings) —
   * Chart.js's category scale passes the tick index to `ticks.callback`, not the label text,
   * so formatting it would corrupt the axis.
   */
  @property({ attribute: false }) valueFormatter?: LyraChartValueFormatter;
  /** Unified context-object formatter for visual, tooltip, table/export, and spoken values. */
  @property({ attribute: false }) formatter?: LyraChartFormatter;
  /**
   * Tooltip title formatter -- e.g. a scatter point's own name. Receives every item the hovered
   * tooltip covers, each in `formatter`'s `'tooltip'`-surface context shape. Unset (the default)
   * leaves Chart.js's own default title (the shared category label) in place.
   */
  @property({ attribute: false }) tooltipTitleFormatter?: LyraChartTooltipGroupFormatter;
  /**
   * Tooltip footer formatter -- e.g. a category's stack total under the items. Receives every
   * item the hovered tooltip covers, in the same shape as `tooltipTitleFormatter`. Unset (the
   * default) leaves Chart.js's own default (no footer).
   */
  @property({ attribute: false }) tooltipFooterFormatter?: LyraChartTooltipGroupFormatter;
  /** Chart-wide default fill-under-line setting for line-type series; a series's own `LyraChartSeries.fill` overrides it. */
  @property({ type: Boolean }) area = false;
  /** Enables wheel, drag and pinch zoom on the `x` axis through the optional `chartjs-plugin-zoom`
   *  peer (loaded on first demand), and shows the `reset-zoom-button` while zoomed. */
  @property({ type: Boolean }) zoomable = false;

  @property() height = '280px';
  @property({ attribute: 'x-label' }) xLabel: string | null = null;
  @property({ attribute: 'y-label' }) yLabel: string | null = null;
  @property({ attribute: 'y2-label' }) y2Label = '';
  /** Lets a linear value axis start at the data minimum instead of always including zero. */
  @property({ type: Boolean, attribute: 'without-zero-baseline' }) withoutZeroBaseline = false;

  /** Makes the generated data table visible; it remains screen-reader available when false. */
  @property({ type: Boolean, attribute: 'with-data-table' }) withDataTable = false;

  /**
   * Render a disclosure button above the accessible data table so a sighted reader can reveal the
   * numbers behind the chart on demand. `withDataTable` alone is all-or-nothing -- the table is
   * either permanently screen-reader-only or permanently visible -- which left a consumer wrapping
   * a duplicated table in their own `<details>`.
   *
   * With this set, `withDataTable` becomes the disclosure's *initial* state rather than its whole
   * behavior. The table stays in the DOM in both states, so assistive technology never loses it.
   * @default false
   */
  @property({ type: Boolean, attribute: 'data-table-toggle' }) dataTableToggle = false;

  /**
   * Live disclosure state. Null until the reader actually toggles, so an untouched control keeps
   * following `withDataTable` (including a later change to it) instead of freezing a seeded copy.
   */
  @state() private dataTableExpandedOverride: boolean | null = null;

  private readonly dataTableId = nextId('chart-data-table');

  /** Whether the data table is currently visible. Identical to `withDataTable` whenever
   *  `dataTableToggle` is off, which is what keeps the unset path byte-identical to before. */
  private get dataTableVisible(): boolean {
    return chartDataTableVisible(this.withDataTable, this.dataTableToggle, this.dataTableExpandedOverride);
  }

  private toggleDataTable(): void {
    this.dataTableExpandedOverride = !this.dataTableVisible;
  }
  /** Stacks the `x`/`y`(/`y2`) scale entries `buildScales()` returns; only meaningful for `bar` and `line` types. */
  @property({ type: Boolean }) stacked = false;
  /**
   * Per-value-axis override of `stacked`, keyed by `'y'`/`'y2'`. An axis absent from this record
   * -- including every axis when the whole property is unset -- falls back to the chart-wide
   * `stacked` value, which is what keeps a chart that never sets this byte-identical to before.
   * Lets a `stacked` bar series on the primary axis sit next to an unstacked overlay series on
   * `y2` (via `LyraChartSeries.axis: 'y2'`): set `stackedAxes` to `{ y2: false }` alongside
   * `stacked`, or spell out both axes explicitly. The shared categorical axis (`x` for a vertical
   * bar/line, or `y` when `indexAxis` is `'y'`) has no independent entry of its own -- it always
   * mirrors the resolved `'y'` value, matching Chart.js's own paired index/value-scale stacking
   * contract. Only meaningful for `bar`/`line` types, matching `stacked` itself.
   */
  @property({ attribute: false }) stackedAxes?: Partial<Record<'y' | 'y2', boolean>>;
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
   * `with-data-table`); labels are a purely visual, canvas-only addition.
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
   * property. Recursively deep-merged over the `LyraChartSeries`-derived
   * config in `buildConfig()` (any key at any nesting depth — e.g.
   * `config.options.scales.y.min` — wins over the generated equivalent
   * without discarding sibling keys the generated config set), for consumers
   * who need full Chart.js control beyond the simplified `LyraChartSeries` shape. Generated bar
   * borderWidth/borderRadius defer to authored bar option scopes; explicit series.width still wins.
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
  private _config?: LyraChartConfiguration;
  private configSource: unknown = undefined;
  @property({ attribute: false })
  get config(): LyraChartConfiguration | undefined {
    return this._config;
  }
  set config(value: LyraChartConfiguration | undefined) {
    if (Object.is(value, this.configSource) || (value !== undefined && Object.is(value, this._config)))
      return;
    const previous = this._config;
    this._config = projectChartConfiguration(value);
    this.configSource = value;
    this.requestUpdate('config', previous);
  }

  @state() private slottedConfig?: LyraChartConfiguration;

  /** Subclass hook for removing raw peer keys that contradict a derived public contract. */
  protected normalizeEffectiveConfig(
    config: LyraChartConfiguration | undefined
  ): LyraChartConfiguration | undefined {
    return config;
  }

  private effectiveConfig(): LyraChartConfiguration | undefined {
    const config = this.normalizeEffectiveConfig(this.config ?? this.slottedConfig);
    if (this.preparedDataInput() === null || !config) return config;
    return { type: config.type, options: config.options, plugins: config.plugins };
  }

  private onConfigSlotChange(event: Event): void {
    const slot = event.currentTarget as HTMLSlotElement;
    // `render()` swaps in a structurally distinct `slot.config-slot` element when `loading`/
    // `loadFailed` changes, discarding the previous one. A browser fires a *second*, spurious
    // "slotchange" directly at that now-detached old slot once its assignment collapses to empty
    // -- an "at target" firing that reaches this bound listener regardless of the node's removal,
    // since it needs no live ancestor path. Left unguarded, that phantom empty event would
    // overwrite an already-correct `slottedConfig` right back to `undefined`. Comparing against
    // the CURRENT slot (`configSlotEl` is a live `@query`, re-read on every access) discards any
    // event whose target is no longer the slot actually in the render root.
    if (slot !== this.configSlotEl) return;
    this.collectConfigFromSlot(slot);
  }

  /**
   * Reads the `config-slot`'s currently assigned `<script type="application/json">` and applies
   * it -- wired as the `slotchange` handler (via `onConfigSlotChange`) for every later mutation,
   * and called once more from `firstUpdated()` (see `collectInitialSlotAssignment`) to cover an
   * environment, or a real-browser timing race, where the slot's initial assignment never fires
   * `slotchange`.
   */
  private collectConfigFromSlot(slot: HTMLSlotElement): void {
    const script = slot
      .assignedElements({ flatten: true })
      .find(
        (element): element is HTMLScriptElement =>
          element.localName === 'script' &&
          (element as HTMLScriptElement).type.trim().toLowerCase() === 'application/json'
      );
    let next: LyraChartConfiguration | undefined;
    if (script) {
      try {
        const parsed: unknown = JSON.parse(script.textContent ?? '');
        next = projectChartConfiguration(parsed);
      } catch {
        next = undefined;
      }
    }
    if (!Object.is(this.slottedConfig, next)) this.slottedConfig = next;
  }

  /**
   * The single data model used by every chart surface. `config.data` follows the same merge rule
   * as the Chart.js render config: an explicit labels/datasets array replaces the generated array,
   * while an omitted member falls back to the simplified property surface.
   */
  private effectiveData(): EffectiveChartData {
    if (this.spatialActive) {
      const groups = this.spatialSeriesPoints();
      return { labels: [], datasets: (this.spatial.binding?.chart?.series ?? []).map((series, index) => {
        const data = groups[index]!.map(point => Object.freeze({ x: point.x, y: point.y, ...(point.radius === undefined ? {} : { r: point.radius }), ...(point.label === undefined ? {} : { label: point.label }) }));
        const dataset = Object.freeze({ label: series.label, data }); canonicalChartDatasetValues.set(dataset, data); return dataset;
      }) };
    }
    if (this.preparedActive) {
      const model = this.preparedModel;
      if (!model) return { labels: [], datasets: [] };
      if (this.preparedEffective?.model === model) return this.preparedEffective.data;
      const datasets = model.series.map(series => {
        const data = model.kind === 'series'
          ? series.samples.map(point => point ? Object.freeze({ x: point.x, y: point.y, label: String(point.sourceIndex) }) : null)
          : [...series.values];
        Object.freeze(data);
        const dataset = Object.freeze({ label: series.label, data });
        canonicalChartDatasetValues.set(dataset, data);
        return dataset;
      });
      const data = { labels: [...model.labels], datasets };
      this.preparedEffective = { model, data };
      return data;
    }
    // Hover, keyboard and render paths read this many times per update; its inputs are immutable
    // snapshots, so their identities decide whether the projection is still current.
    const labels = this.canonicalLabels();
    const datasets = this.datasets;
    const config = this.config ?? this.slottedConfig;
    const memo = this.effectiveDataMemo;
    if (memo?.labels === labels && memo.datasets === datasets && memo.config === config)
      return memo.value;
    const generated: EffectiveChartData = {
      labels: [...labels],
      datasets: datasets.map((series) => {
        const { points: _points, ...safeSeries } = series;
        const values = canonicalSeriesPoints(series) ?? canonicalSeriesData(series);
        const data = [...values];
        Object.freeze(data);
        const dataset = {
          ...safeSeries,
          data,
          yAxisID: series.axis === 'y2' ? 'y2' : 'y',
        };
        canonicalChartDatasetValues.set(dataset, values);
        return Object.freeze(dataset);
      }),
    };
    Object.freeze(generated.labels);
    Object.freeze(generated.datasets);
    const override = projectChartDataConfiguration(this.effectiveConfig()?.data);
    // Simplified series and labels already crossed their descriptor boundary. Keep their full
    // semantic model without projecting every value again; raw data overrides still need merging.
    let value = generated;
    if (override) {
      const projected = projectChartDataConfiguration(deepMerge(generated, override));
      value = {
        labels: (projected?.labels ?? []) as unknown[],
        datasets: (projected?.datasets ?? []) as LyraChartDatasetConfiguration[],
      };
    }
    this.effectiveDataMemo = { labels, datasets, config, value };
    return value;
  }

  private effectiveDataMemo?: {
    labels: readonly string[];
    datasets: readonly LyraChartSeries[];
    config: unknown;
    value: EffectiveChartData;
  };

  /** Validates peer callback indexes against the visual data sent to Chart.js. */
  private callbackDatasetIndex(
    value: unknown,
    effective = this.effectiveData(),
  ): number | undefined {
    const datasetIndex = chartCallbackDatasetIndex(value);
    if (datasetIndex === undefined) return undefined;
    const visualDatasetCount = this.visualDatasetSourceIndexes?.length ?? effective.datasets.length;
    if (datasetIndex >= visualDatasetCount) return undefined;
    const sourceDatasetIndex = this.visualDatasetSourceIndexes?.[datasetIndex] ?? datasetIndex;
    return effective.datasets[sourceDatasetIndex] ? datasetIndex : undefined;
  }

  /** Validates a peer callback's visual row as well as its visual dataset. */
  private callbackIndexes(
    value: unknown,
    effective = this.effectiveData(),
  ): ChartHit | undefined {
    const hit = chartCallbackIndexes(value);
    if (!hit) return undefined;
    const visualDatasetCount = this.visualDatasetSourceIndexes?.length ?? effective.datasets.length;
    if (hit.datasetIndex >= visualDatasetCount) return undefined;
    const sourceDatasetIndex = this.visualDatasetSourceIndexes?.[hit.datasetIndex] ?? hit.datasetIndex;
    const dataset = effective.datasets[sourceDatasetIndex];
    if (!dataset) return undefined;
    const visualRowCount = this.visualRowSourceIndexes?.length ?? this.datasetValues(dataset).length;
    return hit.index < visualRowCount ? hit : undefined;
  }

  /** The public controlled snapshot when supplied, otherwise the effective configuration default. */
  private effectiveHiddenDatasetIndexes(): number[] {
    const effective = this.effectiveData();
    const controlled = normalizeHiddenDatasets(
      this.canonicalHiddenDatasets(),
      effective.datasets.length,
    );
    if (controlled !== undefined) return controlled;
    return effective.datasets.flatMap((dataset, index) =>
      chartDatasetBoolean(dataset, 'hidden') === true ? [index] : []
    );
  }

  /** Applies the public controlled state to the live Chart.js metadata after any data replacement. */
  private applyDatasetVisibility(): boolean {
    if (!this.chart) return false;
    const chart = this.chart;
    const sourceDatasetCount = this.effectiveData().datasets.length;
    const datasetCount = this.visualDatasetSourceIndexes?.length ?? sourceDatasetCount;
    const controlled = normalizeHiddenDatasets(
      this.canonicalHiddenDatasets(),
      sourceDatasetCount,
    );
    if (controlled === undefined) {
      for (let index = 0; index < datasetCount; index++) {
        // Clear Chart.js's metadata override so the replacement configuration's `hidden` property
        // becomes the source of truth again. This is specifically what a programmatic reset to
        // `hiddenDatasets = undefined` promises.
        try {
          const metadata = chart.getDatasetMeta?.(index);
          if (metadata) metadata.hidden = null;
        } catch {
          // Chart.js metadata is a mutable public peer boundary; leave an untrusted capability
          // untouched rather than letting a plugin-owned getter/setter interrupt a redraw.
        }
      }
      return datasetCount > 0;
    }
    const hidden = new Set(controlled);
    for (let index = 0; index < datasetCount; index++) {
      const sourceIndex = this.visualDatasetSourceIndexes?.[index] ?? index;
      try {
        chart.setDatasetVisibility(index, !hidden.has(sourceIndex));
      } catch {
        // See the metadata branch above: external Chart.js capabilities fail closed per dataset.
      }
    }
    return datasetCount > 0;
  }

  private isSliceChart(): boolean {
    return ['pie', 'doughnut', 'polarArea'].includes(this.effectiveType());
  }

  /** Reconcile through Chart.js's public category visibility API after data/index remapping. */
  private applyDatumVisibility(): boolean {
    if (!this.chart || !this.isSliceChart()) return false;
    const sample = this.dataTableSample();
    const rows = this.visualRowSourceIndexes;
    const hidden = new Set(normalizeHiddenDatasets(this.hiddenDatums, sample.rowCount));
    let changed = false;
    for (let index = 0; index < (rows?.length ?? sample.rowCount); index++) {
      const visible = !hidden.has(rows?.[index] ?? index);
      try {
        if (this.chart.getDataVisibility?.(index) === !visible) {
          this.chart.toggleDataVisibility?.(index);
          changed = true;
        }
      } catch {
        // An external peer/plugin capability must not interrupt reconciliation of other entries.
      }
    }
    return changed;
  }

  private hasExplicitConfigData(): boolean {
    const config = this.effectiveConfig();
    if (!isSafeChartConfigurationRecord(config)) return false;
    const data = chartRecordValue(config, 'data');
    return data !== MISSING_OWN_DATA_DESCRIPTOR && data !== UNSAFE_OWN_DATA_DESCRIPTOR;
  }

  private datasetLabel(dataset: LyraChartDatasetConfiguration, index: number): string {
    return chartDatasetLabel(dataset) || this.localize('chartPointLabel', undefined, {
      n: getNumberFormat(this.effectiveLocale).format(index + 1),
    });
  }

  private datasetValues(dataset: LyraChartDatasetConfiguration): readonly unknown[] {
    return chartDatasetValues(dataset);
  }

  private isPointDataset(dataset: LyraChartDatasetConfiguration): boolean {
    const values = this.datasetValues(dataset);
    return (
      this.effectiveType() === 'scatter' ||
      this.effectiveType() === 'bubble' ||
      values.some((value) => normalizedChartPoint(value) !== null)
    );
  }

  /**
   * Appends one streamed category to numeric `data` series and optionally keeps only the newest
   * `maxPoints` categories. An explicitly supplied `config.data` member is updated at that same
   * source; generated members continue to update `labels`/`datasets`, preserving generated styling.
   * Point-based scatter/bubble series are left unchanged because their x/y/r coordinates need a
   * richer host-defined append contract. Inactive while preparedData is supplied.
   */
  appendData(label: string, values: (number | null)[], maxPoints: number = 0): void {
    if (this.preparedDataInput() !== null) return;
    this.withStreamedTableUpdate(() => {
    const requested = Number.isFinite(maxPoints) ? Math.max(0, Math.floor(maxPoints)) : 0;
    // Input admission keeps the FIRST 10,000 entries of each array, so an unbounded stream would
    // freeze on its oldest data. Appending therefore always keeps a rolling window of the newest.
    const limit = requested > 0
      ? Math.min(requested, MAX_CHART_INPUT_ENTRIES)
      : MAX_CHART_INPUT_ENTRIES;
    const appendedValues = projectChartNumberData(values) ?? Object.freeze([]);
    if (this.hasExplicitConfigData()) {
      const effective = this.effectiveData();
      let domainLength = effective.labels.length;
      for (const dataset of effective.datasets) {
        if (!this.isPointDataset(dataset)) {
          domainLength = Math.max(domainLength, this.datasetValues(dataset).length);
        }
      }
      const labels = [
        ...effective.labels,
        ...Array.from({ length: Math.max(0, domainLength - effective.labels.length) }, () => ''),
        label,
      ];
      const effectiveConfig = this.effectiveConfig();
      const currentData = projectChartDataConfiguration(effectiveConfig?.data) ?? {};
      const explicitLabels = admitChartArray(currentData['labels']) !== undefined;
      const explicitDatasets = admitChartArray(currentData['datasets']) !== undefined;
      const nextLabels = labels.slice(-limit);

      if (!explicitLabels) this.labels = nextLabels.map(labelText);
      if (!explicitDatasets) {
        const datasets = this.datasets.map((series, index) => {
          if (canonicalSeriesPoints(series) !== undefined) return series;
          const current = canonicalSeriesData(series);
          const data = [
            ...current,
            ...Array.from({ length: Math.max(0, domainLength - current.length) }, () => null),
            appendedValues[index] ?? null,
          ];
          return appendChartSeries(series, data.slice(-limit));
        });
        this.datasets = datasets;
      }

      if (explicitLabels || explicitDatasets) {
        const nextData: Record<string, unknown> = { ...currentData };
        if (explicitLabels) nextData['labels'] = Object.freeze(nextLabels);
        if (explicitDatasets) {
          nextData['datasets'] = effective.datasets.map((dataset, index) => {
            if (this.isPointDataset(dataset)) return dataset;
            const current = this.datasetValues(dataset);
            const peer = chartDatasetPeerValues(dataset);
            const padding = Array.from(
              { length: Math.max(0, domainLength - current.length) },
              () => null,
            );
            const data = [
              ...peer,
              ...padding,
              appendedValues[index] ?? null,
            ];
            const canonical = [...current, ...padding, appendedValues[index] ?? null];
            const nextData = Object.freeze(data.slice(-limit));
            const nextCanonical = canonical.slice(-limit);
            canonicalChartDatasetDataValues.set(nextData, Object.freeze(nextCanonical));
            const nextDataset = Object.freeze({ ...dataset, data: nextData });
            canonicalChartDatasetValues.set(nextDataset, Object.freeze(nextCanonical));
            return nextDataset;
          });
        }
        if (Array.isArray(nextData['datasets'])) Object.freeze(nextData['datasets']);
        canonicalChartDataSnapshots.add(nextData);
        const previous = this._config;
        this._config = Object.freeze({ ...effectiveConfig, data: Object.freeze(nextData) as LyraChartDataConfiguration });
        this.configSource = this._config;
        this.requestUpdate('config', previous);
      }
      return;
    }
    const currentLabels = this.canonicalLabels();
    let domainLength = currentLabels.length;
    for (const series of this.datasets) {
      if (canonicalSeriesPoints(series) === undefined) {
        domainLength = Math.max(domainLength, canonicalSeriesData(series).length);
      }
    }
    const labels = [
      ...currentLabels,
      ...Array.from({ length: Math.max(0, domainLength - currentLabels.length) }, () => ''),
      label,
    ];
    const datasets = this.datasets.map((series, index) => {
      if (canonicalSeriesPoints(series) !== undefined) return series;
      const current = canonicalSeriesData(series);
      const data = [
        ...current,
        ...Array.from({ length: Math.max(0, domainLength - current.length) }, () => null),
        appendedValues[index] ?? null,
      ];
      return appendChartSeries(series, data.slice(-limit));
    });
    this.labels = labels.slice(-limit);
    this.datasets = datasets;
    });
  }

  /**
   * Returns a spreadsheet-safe CSV snapshot of the effective chart data. Point datasets expand to
   * x/y and, when present, radius/per-point-label columns so export never flattens point meaning.
   */
  exportData(format: LyraChartExportFormat): string {
    if (format === 'png') return this.chart?.toBase64Image?.() ?? '';
    if (this.spatialActive) return spatialCsv(this.spatial.binding?.chart?.series ?? [], this.spatialPoints(), this.spatial.result?.bins ?? [], (value, record, column) => {
      const datasetIndex = 'seriesId' in record ? this.spatial.binding!.chart!.series.findIndex(series => series.id === record.seriesId) : undefined;
      return this.formatExportValue(value, { datasetIndex, ...('sourceIndex' in record ? { index: record.sourceIndex, label: record.label } : {}), ...(column === 'x' || column === 'y' || column === 'radius' ? { statistic: column === 'radius' ? 'r' : column } : {}) });
    });
    const effective = this.effectiveData();
    const columns = effective.datasets.map((dataset, datasetIndex) => {
      const values = this.datasetValues(dataset);
      const label = this.datasetLabel(dataset, datasetIndex);
      const points = values
        .map(normalizedChartPoint)
        .filter((point): point is LyraChartPoint => point !== null);
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
          : [column.label]
      ),
    ].map(escapeCsvField).join(',');
    let rowCount = effective.labels.length;
    for (const dataset of effective.datasets) {
      rowCount = Math.max(rowCount, this.datasetValues(dataset).length);
    }
    const exportCell = (value: unknown,
      metadata: LyraChartFormatterMetadata): unknown => {
      if (typeof value !== 'number' || !Number.isFinite(value)) return value ?? '';
      return this.formatExportValue(value, metadata) ?? value;
    };
    const rows = Array.from({ length: rowCount }, (_, index) => {
      const firstPoint = effective.datasets
        .map((dataset) => normalizedChartPoint(this.datasetValues(dataset)[index]))
        .find((point): point is LyraChartPoint => point !== null);
      const label = labelText(effective.labels[index]) || firstPoint?.label || '';
      return [
        label,
        ...columns.flatMap((column, datasetIndex) => {
          const value = this.datasetValues(column.dataset)[index];
          // Every numeric cell goes through the 'export' surface, so a consumer's unit formatting
          // reaches the CSV -- the place it matters most, and what <lr-lite-chart> has always done.
          // exportCell() leaves a cell untouched when no formatter is installed, keeping the
          // default output the raw machine-readable number.
          const axis = this.datasetValueAxis(column.dataset);
          const metadata = {
            datasetIndex,
            index,
            label: label || undefined,
            seriesLabel: column.label,
            ...(axis === undefined ? {} : { axis }),
          } satisfies LyraChartFormatterMetadata;
          if (!column.point) return [exportCell(value, metadata)];
          const point = normalizedChartPoint(value);
          if (!point) {
            return ['', '', ...(column.radius ? [''] : []), ...(column.pointLabel ? [''] : []),];
          }
          return [
            exportCell(point.x, { ...metadata, statistic: 'x' }),
            exportCell(point.y, { ...metadata, statistic: 'y' }),
            ...(column.radius
              ? [point.r == null ? '' : exportCell(point.r, { ...metadata, statistic: 'r' })]
              : []),
            ...(column.pointLabel ? [point.label ?? ''] : []),
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
  private canvasUnavailable = false;

  // Overridable instance field (not a direct `loadChartJs()` call site) purely so tests can
  // inject a stubbed loader before the element ever connects -- matches map/docx-viewer's own
  // `loadLibrary` field/rationale exactly.
  private loadLibrary: (withZoom: boolean) => ReturnType<typeof loadChartJs> = (withZoom) => (
    withZoom ? loadChartJsWithZoom() : loadChartJs());
  // Separate feature-result seams let tests model an optional peer failure without pretending the
  // mandatory Chart.js core failed too. They intentionally retain the existing `loadLibrary`
  // seam for core-load tests and consumers of the established lifecycle behavior.
  private loadZoomFeature: () => Promise<ChartFeatureLoadResult<ZoomPlugin>> = () =>
    loadChartJsWithZoomResult();
  private loadDataLabelsFeature: () => Promise<ChartFeatureLoadResult<DataLabelsPlugin>
  > = () =>
    loadChartJsWithDataLabelsResult();
  private loadAnnotationFeature: () => Promise<ChartFeatureLoadResult<AnnotationPlugin>
  > = () =>
    loadChartJsWithAnnotationResult();
  // Invalidates a lazy-load callback when this element disconnects/reconnects. Without a
  // generation token, two connectedCallback() calls around one in-flight import can both settle
  // against the reconnected element and construct/reconfigure the chart from stale lifecycle
  // state.
  private loadGeneration = 0;
  private zoomLoadGeneration = 0;
  private dataLabelsLoadGeneration = 0;
  private annotationLoadGeneration = 0;
  // These loader states are intentionally non-reactive. A feature request may start from
  // `updated()` after a property flip; making the intermediate `loading` write reactive produces
  // Lit's update-in-update warning. Completion explicitly requests the one render needed for a
  // warning/reset-control change instead.
  private zoomFeatureState: ChartFeatureState = 'idle';
  private dataLabelsFeatureState: ChartFeatureState = 'idle';
  private annotationFeatureState: ChartFeatureState = 'idle';
  // The resolved `chartjs-plugin-datalabels` plugin object, registered
  // PER-INSTANCE via this chart's own `config.plugins` (not globally — a global
  // registration would draw labels on, and break, every other chart on the
  // page). `undefined` until the peer loads (or if it's not installed).
  private dataLabelsPlugin?: DataLabelsPlugin;
  // The resolved `chartjs-plugin-annotation` plugin object. Its loader registers the plugin
  // globally because annotation draws nothing without per-chart options and needs registry-owned
  // element defaults; this reference tracks feature availability for this instance.
  private annotationPlugin?: AnnotationPlugin;
  private stopAnnotationRegistrationWatch?: () => void;

  @state() private zoomed = false;

  @state() private visible = true;
  private intersectionObserver?: IntersectionObserver;
  private intersectionGeneration = 0;
  private readonly reducedMotionWatch = createReducedMotionWatch(this, () => this.drawIfVisible());

  @query('canvas') private canvasEl?: HTMLCanvasElement;
  // The unnamed `config-slot` carrying an optional `<script type="application/json">` raw
  // configuration -- read once from `firstUpdated()` in addition to its own `@slotchange`
  // listener; see `collectInitialSlotAssignment`'s own doc. `render()` swaps in one of three
  // structurally distinct `slot.config-slot` elements depending on `loading`/`loadFailed`, so
  // (unlike that helper's other callers) this field is deliberately read fresh at microtask time
  // in `firstUpdated()` below, rather than captured into a local before scheduling, in case the
  // peer loader has already flipped `loading` and swapped the slot element by then.
  @query('slot.config-slot') private configSlotEl?: HTMLSlotElement;
  /** The current Chart.js instance. Read it only while the element is connected and loaded. */
  chart?: LyraChartInstance;
  private scaledSliceDatasets = new Set<number>();
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
  private readonly chartAreaPlugin = {
    id: 'lyra-chart-area',
    // The peer's onResize callback precedes its layout pass. Observe the completed layout too,
    // including responsive updates while this element's own drawing is visibility-gated.
    afterLayout: (chart: RuntimeChart): void => this.updateChartArea(chart),
    // Each tooltip line is drawn as its own canvas string; isolate it in its own first-strong
    // direction so a number-first formatted value keeps its order inside an RTL chart.
    beforeTooltipDraw: tooltipIsolationHook(() => this.effectiveDirection),
  };
  // Tracks the *effective* Chart.js type actually passed to `new Chart()` —
  // i.e. `config.type` post-merge, not `this.type` — since `config.type` (the
  // raw passthrough) can override the generated type in `buildConfig()`. See
  // the deep-merge note on `buildConfig()` below.
  private builtType?: string;
  private builtPlugins: LyraChartPlugin[] = [];
  private visualDatasetSourceIndexes?: readonly number[];
  private visualRowSourceIndexes?: readonly number[];
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
  private readonly announcements = new AnnouncementSinkController(this);
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

  /**
   * Synchronizes the visible active category with categorical vertical bar/line charts in the
   * same owner document. Trimmed, case-sensitive groups match exact nonempty category labels.
   * Duplicate labels choose the first eligible recipient category; unique labels are recommended.
   * Peer updates are visual only and never move focus, announce, activate or select data.
   */
  @property({ attribute: 'sync-group' }) syncGroup = '';

  // @renderController LazyChartSyncController
  private readonly chartSync = new LazyChartSyncController(this, (label, index) => this.syncPresentation(label, index), () => this.resetSyncTooltip(), (target) => target === this.canvasEl);

  override connectedCallback(): void {
    super.connectedCallback();
    this.preparedDirty = true;
    this.stopAnnotationRegistrationWatch?.();
    this.stopAnnotationRegistrationWatch = onAnnotationPluginRegistered(() =>
      this.rebuildAfterAnnotationRegistration()
    );
    // Loading and accessible DOM can settle while the first visibility decision is pending.
    this.visible = !this.ownerWindow?.IntersectionObserver;
    this.armReducedMotionWatcher();
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
          const samplingWidth = Number.isFinite(this.lastObservedInlineSize)
            ? Math.max(0, Math.floor(this.lastObservedInlineSize!)) : 0;
          if (samplingWidth !== this.samplingWidth) {
            this.samplingWidth = samplingWidth;
            this.updateAutoLegendPosition();
            return;
          }
          // A changed auto position schedules the same visibility-gated draw through `updated()`.
          // Avoid drawing once here and again in that reactive pass.
          if (!this.updateAutoLegendPosition()) this.drawIfVisible();
        });
      });
      this.resizeObserver.observe(this);
    }
    this.updateAutoLegendPosition();
    const generation = ++this.loadGeneration;
    if (this.zoomable) this.requestZoomFeature();
    const load = this.loadLibrary(this.zoomable);
    void load.then(async (mod) => {
      // The server always renders the stable loading branch. A cached/fast optional-peer import can
      // otherwise settle while the browser is still upgrading the declarative-shadow-DOM host,
      // switching render() to the canvas branch before Lit's first hydration pass and forcing a
      // full shadow-tree replacement. Await the initial update, then route the branch change through
      // LyraElement's hydration release seam: observers can capture the claimed server nodes before
      // the correction, while an ordinary client-only mount continues immediately.
      try {
        await this.updateComplete;
      } catch {
        return;
      }
      await new Promise<void>((resolve) => this.updateBrowserDerivedState(resolve));
      if (generation !== this.loadGeneration || !this.isConnected) return;
      this.loading = false;
      if (!mod) {
        this.loadFailed = true;
        return;
      }
      this.loadFailed = false;
      this.chartJsModule = mod;
      this.requestFeaturesAssignedWhileLoading();
      this.drawIfVisible();
    });
    // `data-labels`/`stack-totals` need the optional `chartjs-plugin-datalabels`
    // peer registered before the plugin's `datalabels` options in `buildConfig()`
    // take effect. Load it in parallel with the core (both memoized), then
    // redraw once it's registered — mirrors the `zoomable` on-demand load and its
    // generation + `isConnected` guard against a disconnect mid-import.
    if (this.needsDataLabels) {
      this.requestDataLabelsFeature();
    }
    if (this.needsAnnotations) {
      this.requestAnnotationFeature();
    }
    const IntersectionObserverCtor = ownerWindow?.IntersectionObserver;
    if (IntersectionObserverCtor) {
      const observerGeneration = ++this.intersectionGeneration;
      const observer = new IntersectionObserverCtor((entries) => {
        if (
          observerGeneration !== this.intersectionGeneration ||
          this.intersectionObserver !== observer ||
          !this.isConnected ||
          this.ownerWindow !== ownerWindow
        ) {
          return;
        }
        const wasVisible = this.visible;
        this.visible = entries[0]?.isIntersecting ?? true;
        if (this.visible && !wasVisible) this.drawIfVisible();
      });
      this.intersectionObserver = observer;
      observer.observe(this);
    }
  }

  override disconnectedCallback(): void {
    this.spatialRevealToken = {}; this.spatial.reset(); this.wakeSpatialWaiters();
    this.preparedRequests.refresh();
    this.preparedModel = this.preparedBaseModel = undefined;
    this.preparedEffective = undefined;
    this.preparedDirty = true;
    this.chartSync.disconnect();
    this.cancelDeferredTable?.();
    this.cancelDeferredTable = undefined;
    this.deferredTableRows = undefined;
    super.disconnectedCallback();
    this.stopAnnotationRegistrationWatch?.();
    this.stopAnnotationRegistrationWatch = undefined;
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
    this.annotationLoadGeneration += 1;
    this.discardChart(false);
    this.builtPlugins = [];
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = undefined;
    this.intersectionGeneration += 1;
    this.visible = true;
    this.disarmReducedMotionWatcher();
  }

  override adoptedCallback(): void {
    this.spatial.authority.adopted(); this.spatialRevealToken = {}; this.wakeSpatialWaiters();
    this.preparedRequests.adopted();
    this.chartSync.disconnect();
    this.canvasTokens.clear();
    super.adoptedCallback();
    this.announcements.adopted();
    this.requestUpdate();
    this.disarmReducedMotionWatcher();
    this.armReducedMotionWatcher();
  }

  private armReducedMotionWatcher(): void {
    this.reducedMotionWatch.arm();
  }

  private disarmReducedMotionWatcher(): void {
    this.reducedMotionWatch.disarm();
  }

  private get ownerWindow(): BrowserWindow | undefined {
    // Optional-chained for the server-render path: @lit-labs/ssr's element shim has no
    // `ownerDocument`, and every caller already handles `undefined`.
    return (
      (this.ownerDocument?.defaultView as BrowserWindow | null | undefined) ?? undefined
    );
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
      this.discardChart(true);
      this.builtType = undefined;
      this.builtPlugins = [];
      rebuilt = true;
    }
    this.drawIfVisible();
    // A rebuild resets Chart.js's per-instance visibility metadata to the configured `hidden`
    // flags. Nothing reactive changes after the async plugin resolves, so refresh the DOM legend
    // explicitly instead of leaving its pre-rebuild aria-pressed state stale.
    if (rebuilt && this.showsLegend) this.requestUpdate('canvasPresentation', null);
  }

  private get zoomFeatureAvailable(): boolean {
    return this.zoomable && this.zoomFeatureState === 'available';
  }

  private featureWarningMessages(): string[] {
    if (this.loading || this.loadFailed) return [];
    const messages: string[] = [];
    if (this.zoomable && this.zoomFeatureState === 'unavailable') {
      messages.push(this.localize('chartZoomUnavailable'));
    }
    if (this.dataLabelsFeatureState === 'unavailable') {
      if (this.dataLabels) messages.push(this.localize('chartDataLabelsUnavailable'));
      if (this.stackTotals) messages.push(this.localize('chartStackTotalsUnavailable'));
    }
    if (this.needsAnnotations && this.annotationFeatureState === 'unavailable') {
      messages.push(this.localize('chartAnnotationsUnavailable'));
    }
    return messages;
  }

  /**
   * `updated()` returns before it requests an opt-in feature while the core module is loading, and
   * `connectedCallback()` requests only what was already set when the chart connected. A feature
   * property assigned in between was therefore never requested: the plugin stayed unloaded and no
   * warning explained why. A feature that is needed yet still `idle` once loading ends is requested
   * here; one requested earlier is `loading`, `available` or `unavailable` and is left alone.
   */
  private requestFeaturesAssignedWhileLoading(): void {
    if (this.zoomable && this.zoomFeatureState === 'idle') this.requestZoomFeature();
    if (this.needsDataLabels && this.dataLabelsFeatureState === 'idle') this.requestDataLabelsFeature();
    if (this.needsAnnotations && this.annotationFeatureState === 'idle') this.requestAnnotationFeature();
  }

  private requestZoomFeature(): void {
    const generation = ++this.zoomLoadGeneration;
    if (!this.zoomable) {
      this.zoomFeatureState = 'idle';
      return;
    }
    this.zoomFeatureState = 'loading';
    void this.loadZoomFeature().then((result) => {
      if (generation !== this.zoomLoadGeneration || !this.isConnected || !this.zoomable) return;
      this.zoomFeatureState = result.kind === 'available' ? 'available' : 'unavailable';
      // A dynamic request may be the first feature path to return a retained core module. The
      // normal core load remains authoritative for fatal state, but retaining this module keeps a
      // usable chart intact if the opt-in peer alone failed.
      if (result.kind !== 'core-unavailable' && !this.loading && !this.chartJsModule) {
        this.chartJsModule = result.mod;
      }
      this.drawIfVisible();
      this.requestUpdate('canvasPresentation', null);
    });
  }

  private requestAnnotationFeature(): void {
    const generation = ++this.annotationLoadGeneration;
    if (!this.needsAnnotations) {
      this.annotationFeatureState = 'idle';
      return;
    }
    this.annotationFeatureState = 'loading';
    void this.loadAnnotationFeature().then((result) => {
      if (generation !== this.annotationLoadGeneration || !this.isConnected || !this.needsAnnotations) {
        return;
      }
      if (result.kind !== 'core-unavailable' && !this.loading && !this.chartJsModule) {
        this.chartJsModule = result.mod;
      }
      this.annotationFeatureState = result.kind === 'available' ? 'available' : 'unavailable';
      this.applyAnnotationPlugin(result.kind === 'available' ? result.plugin : undefined);
      this.requestUpdate('canvasPresentation', null);
    });
  }

  /**
   * Same constraint as `applyDataLabelsPlugin()`: Chart.js reads a config's inline `plugins: [...]`
   * array ONLY at construction, so a live chart built before the peer resolved cannot gain it
   * through `chart.update()`. Force reconstruction so the next `draw()` takes the `new Chart()`
   * branch that reads `config.plugins`.
   */
  private applyAnnotationPlugin(plugin: AnnotationPlugin | undefined): void {
    this.annotationPlugin = plugin;
    // A chart constructed BEFORE the global registration landed has already resolved its options
    // without the plugin's own defaults, so `options.plugins.annotation` does not exist on it and
    // the plugin throws writing into it on the next update. Chart.js resolves plugin defaults at
    // construction only, so the fix is the same teardown applyDataLabelsPlugin() performs, for a
    // different underlying reason: force the next draw() down the `new Chart()` branch.
    if (plugin && this.needsAnnotations && this.chart) {
      this.discardChart(true);
      this.builtType = undefined;
      this.builtPlugins = [];
    }
    this.drawIfVisible();
  }

  /**
   * `chartjs-plugin-annotation` creates its per-chart state only in `beforeInit`, so once it is
   * registered globally every chart constructed earlier throws inside the plugin on its next
   * update. A chart that requested the feature rebuilds through `applyAnnotationPlugin()`; every
   * other live chart rebuilds here so a sibling's annotations cannot break it.
   */
  private rebuildAfterAnnotationRegistration(): void {
    if (!this.chart || this.needsAnnotations) return;
    this.discardChart(true);
    this.builtType = undefined;
    this.builtPlugins = [];
    this.drawIfVisible();
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
      this.requestUpdate('canvasPresentation', null);
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
    this.refreshPreparedModel();
    if (this.spatialActive) { this.zoomed = this.viewport !== null; return; }
    if (!this.zoomed) return;
    if (this.effectiveType() !== this.builtType) {
      this.zoomed = false;
      this.emit('lr-zoom', { zoomed: false });
    }
  }

  /**
   * happy-dom (through at least 20.14.5) never fires the default slot's INITIAL `slotchange` --
   * see `collectInitialSlotAssignment`'s own doc -- so an `<lr-chart>` whose
   * `<script type="application/json">` raw config already exists at connect (the ordinary
   * "render once data is ready" Lit pattern) would otherwise never pick it up. Collect once here
   * too, from the slot's current assignment; `collectConfigFromSlot()` simply recomputes and
   * overwrites `slottedConfig` from scratch each call, so a real browser firing the initial event
   * as well is naturally idempotent -- the second call reads back the same assigned elements and
   * writes the same value.
   * Deferred a microtask: `slottedConfig` is a reactive `@state`, so writing it synchronously
   * inside `firstUpdated()` -- after this same update has already been marked complete -- trips
   * Lit's "scheduled an update after an update completed" dev warning. A real `slotchange` event
   * runs this same collection from a task/microtask entirely outside the update cycle, which never
   * trips it; queuing a microtask here reproduces that same "outside the cycle" timing instead of
   * writing `slottedConfig` from inside it. Still guaranteed to land before any caller's own
   * `await el.updateComplete` continuation: that continuation is queued only once this update's
   * promise resolves, later in this same synchronous turn, so it always joins the microtask queue
   * behind the one queued here.
   */
  protected override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    queueMicrotask(() => {
      collectInitialSlotAssignment(this.configSlotEl, (s) => this.collectConfigFromSlot(s));
    });
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
    const appliedVisibility = this.appliedLegendVisibility;
    this.appliedLegendVisibility = undefined;
    if (!this.isConnected) return;
    let canvasChanges = changed;
    if (
      changed.has('hiddenDatasets') && appliedVisibility !== undefined &&
      appliedVisibility.chart === this.chart &&
      appliedVisibility.hidden === this.canonicalHiddenDatasets()
    ) {
      // The accepted legend action already updated this peer synchronously. Preserve every
      // other pending input, including subclass inputs, for the normal content gate.
      canvasChanges = new Map(changed);
      canvasChanges.delete('hiddenDatasets');
    }
    const contentChanged = this.preparedChanged || this.chartContentChanged(canvasChanges);
    this.preparedChanged = false;
    const syncDataChanged = contentChanged || changed.has('hiddenDatasets') || changed.has('hiddenDatums');
    this.chartSync.update(this.syncGroup, typeof this.syncGroup === 'string' && this.syncGroup.trim() !== '' && this.syncCompatible(), syncDataChanged);
    const wasMounting = this.isMounting;
    this.isMounting = false;
    if (!wasMounting && this.preparedInvalid && !this.announcedPreparedInvalid) this.announcements.announceAssertive(this.localize('chartPreparedUnavailable'));
    this.announcedPreparedInvalid = this.preparedInvalid;

    // The default empty datum state is part of the first update and must stay silent. Later
    // keyboard changes are appended once to the light-DOM sink; the shadow copy is aria-hidden.
    if (
      changed.has('keyboardDatumAnnouncement') &&
      changed.get('keyboardDatumAnnouncement') !== undefined &&
      this.keyboardDatumAnnouncement !== ''
    ) {
      this.announcements.announcePolite(this.keyboardDatumAnnouncement);
    }
    if (
      changed.has('loadFailed') &&
      changed.get('loadFailed') !== undefined &&
      this.loadFailed
    ) {
      this.announcements.announceAssertive(this.localize('chartMissingLibrary'));
    }
    const dataTruncation = [this.inputLimitMessage(), this.dataTruncationMessage()].filter(Boolean).join(this.localize('chartSummarySeparator'));
    if (wasMounting) {
      // The peer loader completes on a later update, so establish the initial value now rather
      // than treating its successful completion as a user-visible data change.
      this.lastDataTruncationAnnouncement = dataTruncation;
    }
    if (!this.loading && !this.loadFailed) {
      const featureWarnings = this.featureWarningMessages();
      for (const warning of featureWarnings) {
        if (!this.announcedFeatureWarnings.has(warning)) {
          this.announcements.announceAssertive(warning);
        }
      }
      this.announcedFeatureWarnings = new Set(featureWarnings);
      if (!wasMounting && dataTruncation !== this.lastDataTruncationAnnouncement) {
        this.lastDataTruncationAnnouncement = dataTruncation;
        if (dataTruncation) this.announcements.announcePolite(dataTruncation);
      }
    }

    this.setAttribute('aria-busy', String(this.loading || this.preparedPending));

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

    // `zoomable` can also turn on after connect (it was false at
    // `connectedCallback()` time, so only the core `loadChartJs()` load was
    // kicked off) — load the zoom plugin on demand now and redraw once it's
    // registered. Mirrors the same `isConnected` guard `connectedCallback()`
    // uses: this method already bailed out above if *already* disconnected,
    // but the element can *also* disconnect during the gap while this
    // dynamic import is in flight — without this guard, `draw()` would
    // construct a new, leaked `Chart` bound to the now-detached canvas once
    // the import resolves.
    if (changed.has('zoomable')) {
      this.requestZoomFeature();
    }
    // `data-labels`/`stack-totals` can turn on after connect (like `zoomable`) — load
    // the plugin on demand and redraw once it's registered, with the same
    // generation + `isConnected` guard against a disconnect mid-import.
    if (changed.has('dataLabels') || changed.has('stackTotals')) {
      this.requestDataLabelsFeature();
    }
    if (changed.has('annotations')) {
      this.requestAnnotationFeature();
    }
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
    if (!contentChanged && !contextChanged) {
      // Legend presentation does not replace canvas data. Reconcile a controlled category change
      // once; an accepted native legend click has already applied the same visibility snapshot.
      if (changed.has('hiddenDatums') && this.visible && this.applyDatumVisibility()) this.chart?.update('none');
      return;
    }
    this.drawIfVisible();
  }

  /**
   * Subclass extension point for derived reactive inputs. Keeping this gate in the normal
   * visibility-checked update path prevents subclasses such as histogram from issuing a second,
   * unconditional post-update redraw.
   */
  protected chartContentChanged(changed: PropertyValues): boolean {
    return [
      'preparedData', 'preparedView', 'spatialView', 'viewport', 'selectedPointId',
      'type',
      'maxRecords',
      'samplingWidth',
      'labels',
      'datasets',
      'hiddenDatasets',
      'grid',
      'axes',
      'size',
      'indexAxis',
      'legendPosition',
      'min',
      'max',
      'scaleType',
      'annotations',
      'plugins',
      'autoLegendPosition',
      'valueFormatter',
      'formatter',
      'tooltipTitleFormatter',
      'tooltipFooterFormatter',
      'area',
      'height',
      'xLabel',
      'yLabel',
      'y2Label',
      'withoutZeroBaseline',
      'stacked',
      'stackedAxes',
      'withoutAnimation',
      'withoutLegend',
      'withoutTooltip',
      'syncGroup',
      'dataLabels',
      'stackTotals',
      'config',
      'slottedConfig',
      'zoomable',
      'locale',
      'strings',
      'loading',
    ].some((name) => changed.has(name));
  }

  private seriesToDataset(
    s: LyraChartSeries,
    index: number,
    palette: string[],
    effectiveType: EffectiveChartType,
    chartStyle: ChartStyleOptions = this.chartStyleOptions(palette),
    rowIndexes?: readonly number[]
  ): LyraChartDatasetConfiguration {
    const series = canonicalChartSeries(s);
    if (!series) return { label: '', data: [] };
    const points = canonicalSeriesPoints(series);
    const values = points ?? canonicalSeriesData(series);
    const normalize: (value: unknown) => number | LyraChartPoint | null = points
      ? normalizedChartPoint
      : (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
    // Sampling bounds visual work as well as the peer payload. Full canonical values remain
    // available to summaries and exports through the independent semantic model.
    const normalizedData = rowIndexes
      ? rowIndexes.map((rowIndex) => normalize(values[rowIndex]))
      : values.map(normalize);
    const borderFallback =
      chartStyle.borderColors[index % chartStyle.borderColors.length] ??
      palette[index % palette.length];
    const fillFallback =
      chartStyle.fillColors[index % chartStyle.fillColors.length] ??
      palette[index % palette.length];
    const sourceColors = projectChartStrings(series.color);
    const authoredColors = sourceColors?.length && rowIndexes
      ? rowIndexes.map((rowIndex) => sourceColors[rowIndex % sourceColors.length] ?? '')
      : typeof series.color === 'string'
        ? series.color
        : sourceColors;
    const colors = typeof authoredColors === 'string'
      ? [this.canvasTokens.resolve(authoredColors, borderFallback ?? 'transparent'),]
      : authoredColors
        ? this.canvasTokens.resolveMany(authoredColors, borderFallback ?? 'transparent')
        : undefined;
    // Default a color-less series to the categorical palette, keyed by dataset index (matching
    // <lr-lite-chart>). pie/doughnut/polarArea carry one series whose *slices* each need a distinct
    // color, so those default to an array cycled across the palette; every other family is one
    // color per series. Only applied when the caller gave no `color` — an explicit `color` still wins.
    const sliceChart =
      effectiveType === 'pie' || effectiveType === 'doughnut' || effectiveType === 'polarArea';
    const sliceFillColors =
      sliceChart && chartStyle.fillColors.length
        ? normalizedData.map(
            (_, itemIndex) => {
              const sourceIndex = rowIndexes?.[itemIndex] ?? itemIndex;
              return chartStyle.fillColors[sourceIndex % chartStyle.fillColors.length]!;
            }
          )
        : undefined;
    const sliceBorderColors =
      sliceChart && chartStyle.borderColors.length
        ? normalizedData.map(
            (_, itemIndex) => {
              const sourceIndex = rowIndexes?.[itemIndex] ?? itemIndex;
              return chartStyle.borderColors[sourceIndex % chartStyle.borderColors.length]!;
            }
          )
        : undefined;
    const fill = series.fill ?? this.area;
    const backgroundColor = colors ?? sliceFillColors ?? fillFallback;
    const datasetType = series.type ?? effectiveType;
    const connectedStroke = datasetType === 'line' || datasetType === 'radar';
    const authoredSegmentColors =
      series.segmentColors?.length && rowIndexes
      ? rowIndexes.map((rowIndex) => series.segmentColors![rowIndex % series.segmentColors!.length]!)
      : series.segmentColors;
    const segmentColors = authoredSegmentColors
      ? this.canvasTokens.resolveMany(
          authoredSegmentColors,
          colors?.[0] ?? borderFallback ?? 'transparent'
        )
      : undefined;
    const authoredPointColors =
      series.pointColors?.length && rowIndexes
      ? rowIndexes.map((rowIndex) => series.pointColors![rowIndex % series.pointColors!.length] ?? '')
      : series.pointColors;
    const backgroundColors = projectChartStrings(backgroundColor);
    const backgroundColorValue = typeof backgroundColor === 'string' ? backgroundColor : undefined;
    const resolvedBackgroundColor =
      datasetType === 'line' &&
      fill &&
      (colors || !chartStyle.authoredFillColors[index % chartStyle.authoredFillColors.length])
        ? backgroundColors
          ? backgroundColors.map((color) => this.canvasTokens.translucent(color))
          : backgroundColorValue
            ? this.canvasTokens.translucent(backgroundColorValue)
            : backgroundColorValue
        : backgroundColor;
    const encoding = forcedColorEncoding(index);
    const resolvedBackgroundColors = projectChartStrings(resolvedBackgroundColor);
    const resolvedBackgroundColorValue =
      typeof resolvedBackgroundColor === 'string' ? resolvedBackgroundColor : undefined;
    const encodedBackgroundColor = chartStyle.forcedColors
      ? resolvedBackgroundColors
          ? resolvedBackgroundColors.map((color, itemIndex) =>
            this.forcedColorPattern(sliceChart ? itemIndex : index, color)
          )
        : resolvedBackgroundColorValue
          ? this.forcedColorPattern(index, resolvedBackgroundColorValue)
          : resolvedBackgroundColorValue
      : resolvedBackgroundColor;
    const pointRadii = projectChartPointRadii(series.pointRadius);
    return {
      label: series.label,
      data: normalizedData,
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
      // `series.type` (an explicit per-series mixed-type override, e.g. a line
      // series over a bar chart of the *same* effective family) is passed
      // through.
      type: series.type,
      fill,
      ...(datasetType === 'bar' && this.hasConfiguredBarOption('borderRadius')
        ? {} : { borderRadius: chartStyle.borderRadius }),
      ...(
        (datasetType === 'bar' && !Number.isFinite(series.width) && this.hasConfiguredBarOption('borderWidth')) ||
        (isArcDatasetType(datasetType) && this.hasConfiguredElementOption(datasetType, 'arc', 'borderWidth'))
          ? {} : { borderWidth: nonNegativeFinite(
            series.width,
            // radar draws the same kind of connected-polygon stroke a line chart draws, so it
            // uses the line-weight default too, not the thinner generic border default.
            connectedStroke ? chartStyle.lineBorderWidth : chartStyle.borderWidth
          ) }),
      borderDash: series.dash ? [4, 4] : chartStyle.forcedColors ? [...encoding.dash] : undefined,
      pointStyle: chartStyle.forcedColors ? encoding.pointStyle : undefined,
      backgroundColor: encodedBackgroundColor,
      borderColor: (sourceColors?.length && !connectedStroke ? colors : colors?.[0]) ?? sliceBorderColors ?? borderFallback,
      // Connected strokes keep the series' first color; their point borders remain indexable.
      ...(connectedStroke && sourceColors?.length
        ? { pointBorderColor: colors }
        : {}),
      pointBackgroundColor: authoredPointColors
        ? this.canvasTokens.resolveMany(
            authoredPointColors,
            colors?.[0] ?? borderFallback ?? 'transparent'
          )
        : undefined,
      ...(isPointDatasetType(datasetType) && this.hasConfiguredElementOption(datasetType, 'point', 'radius')
        ? {}
        : { pointRadius: pointRadii
            ? (rowIndexes
                ? rowIndexes.map((rowIndex) => pointRadii[rowIndex])
                : pointRadii
              ).map((radius) => nonNegativeFinite(radius, chartStyle.pointRadius))
            : nonNegativeFinite(series.pointRadius, chartStyle.pointRadius) }),
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
      yAxisID: series.axis === 'y2' ? 'y2' : 'y',
      // Only spread in when the series sets a `stack` id, so a series without one produces the
      // exact dataset object it always did (Chart.js's own ungrouped default).
      ...(series.stack !== undefined ? { stack: series.stack } : {}),
    };
  }

  /** Let Chart.js resolve an authored default -- including scriptable/indexable values -- at its
   * native `datasets.<datasetTypeKey>` / `elements.<elementKey>` / top-level `options` scope,
   * instead of shadowing every one of those scopes with a generated per-dataset fallback.
   * Generalizes the bar-only precedence check to every element type Chart.js resolves the same
   * way (arc for pie/doughnut/polar-area, point for radius on any point-bearing dataset type). */
  private hasConfiguredElementOption(datasetTypeKey: string, elementKey: string, option: string): boolean {
    const read = (value: unknown, key: string): unknown => {
      if (!isChartRecord(value)) return undefined;
      const descriptor = chartRecordValue(value, key);
      return descriptor === MISSING_OWN_DATA_DESCRIPTOR || descriptor === UNSAFE_OWN_DATA_DESCRIPTOR
        ? undefined : descriptor.value;
    };
    const options = this.effectiveConfig()?.options;
    const dataset = read(read(options, 'datasets'), datasetTypeKey);
    const scopes = [
      dataset,
      read(read(dataset, 'elements'), elementKey),
      read(read(options, 'elements'), elementKey),
      options,
    ];
    const prefixed = `${elementKey}${option[0]!.toUpperCase()}${option.slice(1)}`;
    return scopes.some(scope => read(scope, prefixed) !== undefined || read(scope, option) !== undefined);
  }

  private hasConfiguredBarOption(option: 'borderWidth' | 'borderRadius'): boolean {
    return this.hasConfiguredElementOption('bar', 'bar', option);
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
    const cs = this.canvasTokens.sync() ?? this.computedStyle();
    const grid =
      cs.getPropertyValue('--grid-color').trim() ||
      cs.getPropertyValue('--lr-chart-grid-color').trim() ||
      cs.getPropertyValue('--_lr-chart-grid-color').trim();
    const tick =
      cs.getPropertyValue('--lr-chart-tick-color').trim() ||
      cs.getPropertyValue('--_lr-chart-tick-color').trim();
    const legend =
      cs.getPropertyValue('--lr-chart-legend-color').trim() ||
      cs.getPropertyValue('--_lr-chart-legend-color').trim();
    const tooltipBg =
      cs.getPropertyValue('--lr-chart-tooltip-bg').trim() ||
      cs.getPropertyValue('--_lr-chart-tooltip-bg').trim();
    const tooltipText =
      cs.getPropertyValue('--lr-chart-tooltip-color').trim() ||
      cs.getPropertyValue('--_lr-chart-tooltip-color').trim();
    return {
      grid: this.canvasTokens.resolve(grid, FALLBACK_GRID_COLOR),
      tick: this.canvasTokens.resolve(tick, FALLBACK_TICK_COLOR),
      tickFontSize: this.styleNumber('--lr-chart-tick-font-size', '--_lr-chart-tick-font-size', FALLBACK_TICK_FONT_SIZE),
      legend: this.canvasTokens.resolve(legend, FALLBACK_LEGEND_COLOR),
      tooltipBg: this.canvasTokens.resolve(tooltipBg, FALLBACK_TOOLTIP_BG),
      tooltipText: this.canvasTokens.resolve(tooltipText, FALLBACK_TOOLTIP_TEXT),
    };
  }

  private styleColor(name: string, fallback: string): string {
    const value = this.computedStyle().getPropertyValue(name).trim();
    return value ? this.canvasTokens.resolve(value, fallback) : fallback;
  }

  private styleNumber(name: string, fallbackToken: string, fallback: number): number {
    const computed = this.computedStyle();
    const value =
      computed.getPropertyValue(name).trim() || computed.getPropertyValue(fallbackToken).trim();
    const direct = DIRECT_PIXEL_NUMBER.exec(value);
    if (direct) {
      const resolved = Number.parseFloat(direct[1]!);
      if (Number.isFinite(resolved) && resolved >= 0) return resolved;
    }
    if (!value || !this.ownerWindow) return fallback;

    const resolved = this.canvasTokens.length(value, () => {
      const probe = this.ownerDocument.createElement('span');
      probe.hidden = true;
      probe.setAttribute('aria-hidden', 'true');
      probe.style.inlineSize = value;
      (this.shadowRoot ?? this).append(probe);
      try {
        return Number.parseFloat(this.computedStyle(probe).inlineSize);
      } finally {
        probe.remove();
      }
    });
    return Number.isFinite(resolved) && resolved >= 0 ? resolved : fallback;
  }

  /**
   * The radar/polarArea `r`-scale `pointLabels` font size ONLY when the consumer has explicitly
   * set the PUBLIC `--lr-chart-tick-font-size` token -- `undefined` otherwise. Deliberately
   * ignores the PRIVATE `--_lr-chart-tick-font-size` fallback that `chart.styles.ts` always sets
   * (to size the adjacent tick labels at 12px): `RadialLinearScale`'s own built-in `pointLabels`
   * default is 10px, not the global 12px tick default, so an unset public token must leave
   * `pointLabels.font` unset entirely and let Chart.js apply that scale-specific default, exactly
   * as it did before `--lr-chart-tick-font-size` existed. When the consumer DOES set the public
   * token, this returns the same resolved size `theme.tickFontSize` uses for the ticks, so the
   * two stay in sync as documented.
   */
  private explicitTickFontSize(): number | undefined {
    const resolved = this.styleNumber('--lr-chart-tick-font-size', '--lr-chart-tick-font-size', NaN);
    return Number.isNaN(resolved) ? undefined : resolved;
  }

  /**
   * Builds a small deterministic CanvasPattern for the category index, using the family-wide
   * encoding table in `chart-forced-colors.ts` so `<lr-box-plot>` and `<lr-lite-chart>` texture
   * their own series identically.
   */
  private forcedColorPattern(index: number, background: string): CanvasPattern | string {
    if (!this.ownerWindow) return background;
    const surface = this.styleColor('--lr-color-surface', FALLBACK_TOOLTIP_BG);
    // Per-point colors repeat a handful of values; one tile per encoding and color per draw.
    const key = `${forcedColorEncoding(index).name}\n${background}\n${surface}`;
    let pattern = this.forcedColorPatterns.get(key);
    if (!pattern) {
      pattern = createForcedColorPattern(this.ownerDocument, index, background, surface);
      this.forcedColorPatterns.set(key, pattern);
    }
    return pattern;
  }

  private forcedColorPatterns = new Map<string, CanvasPattern | string>();

  private chartStyleOptions(palette: string[]): ChartStyleOptions {
    const computed = this.computedStyle();
    const authoredFillColors = palette.map(
      (_, index) => index < 6 && !!computed.getPropertyValue(`--fill-color-${index + 1}`).trim()
    );
    const borderColors = palette.map((fallback, index) =>
      index < 6 ? this.styleColor(`--border-color-${index + 1}`, fallback) : fallback
    );
    const fillColors = palette.map((fallback, index) =>
      index < 6 ? this.styleColor(`--fill-color-${index + 1}`, fallback) : fallback
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

  private get needsAnnotations(): boolean {
    return this.normalizedAnnotations().length > 0;
  }

  /**
   * The usable annotations: a finite single `value`, or a finite `from`/`to` pair. An entry
   * supplying neither (or non-finite numbers) is dropped rather than handed to Chart.js, where it
   * renders nothing at best. A reversed range is normalized rather than rejected — the author's
   * intent is unambiguous.
   */
  private normalizedAnnotations(): readonly LyraChartAnnotation[] {
    return this.canonicalAnnotations();
  }

  /** Resolves an annotation tone to a canvas-ready color, through the same
   *  `getComputedStyle`-then-`resolveCanvasColor` path every other chart color takes — canvas
   *  silently ignores an unparseable `strokeStyle`/`fillStyle`. */
  private annotationColor(tone: LyraVariant | undefined): string {
    const token = `--lr-color-${tone ?? 'neutral'}`;
    const raw = this.computedStyle().getPropertyValue(token).trim();
    return this.canvasTokens.resolve(raw, FALLBACK_TICK_COLOR);
  }

  /**
   * The `chartjs-plugin-annotation` options for this chart, keyed by a stable synthetic id.
   * A single `value` becomes a `line` on that axis's scale; a `from`/`to` pair becomes a `box`
   * bounded on that axis and unbounded on the other.
   */
  private annotationOptions(tick: string): Record<string, unknown> {
    const entries: Record<string, unknown> = {};
    const direction: ChartTextDirection = this.effectiveDirection === 'rtl' ? 'rtl' : 'ltr';
    this.normalizedAnnotations().forEach((entry, index) => {
      const axis = entry.axis === 'x' ? 'x' : 'y';
      const color = this.annotationColor(entry.tone);
      // Drawn on the canvas like a tick, so isolated the same way (see chart-bidi.ts).
      const label = entry.label
        ? { content: isolateCanvasText(entry.label, direction), display: true, color: tick, }
        : undefined;
      if (typeof entry.value === 'number') {
        entries[`lr-annotation-${index}`] = {
          type: 'line',
          scaleID: axis,
          value: entry.value,
          borderColor: color,
          borderWidth: 2,
          ...(label ? { label } : {}),
        };
        return;
      }
      // A band is bounded on its own axis only, so it spans the full extent of the other one.
      const bounds =
        axis === 'y'
          ? { yMin: entry.from, yMax: entry.to }
          : { xMin: entry.from, xMax: entry.to };
      entries[`lr-annotation-${index}`] = {
        type: 'box',
        ...bounds,
        backgroundColor: this.canvasTokens.translucent(color),
        borderColor: color,
        borderWidth: 0,
        ...(label ? { label } : {}),
      };
    });
    return entries;
  }

  /**
   * `options.plugins.datalabels`. Always emitted so the chart also stays inert if
   * a consumer independently registers the peer globally — returns `{ display: false }`
   * unless `data-labels`/`stack-totals` is set. The label
   * color is resolved via `getComputedStyle` (the same `themeColors()` tick
   * color) because Chart.js paints to canvas and cannot read `var()`.
   *
   * `stackTotals` draws once per category per (axis, `LyraChartSeries.stack` group): the plugin
   * fires per (dataset, point), so a total is shown only on the topmost dataset of each group
   * whose OWN axis is actually stacked (`axisStacked()`) and its formatter returns the null-aware
   * `computeStackTotals()` value for that group (blank when the whole category is null). Two
   * stack groups sharing one axis each get their own total, drawn above their own topmost
   * dataset. When only `dataLabels` is set, or a dataset's axis isn't stacked, each point shows
   * its own value; a null/non-finite point renders blank.
   */
  private datalabelsOptions(
    theme: ThemeColors,
    effectiveType: EffectiveChartType
  ): Record<string, unknown> {
    if (!this.needsDataLabels) return { display: false };
    const effective = this.effectiveData();
    const datasets = effective.datasets;
    const stackTotalsPossible =
      this.stackTotals && (effectiveType === 'bar' || effectiveType === 'line');
    const sourceDatasetIndex = (visualIndex: number): number =>
      this.visualDatasetSourceIndexes?.[visualIndex] ?? visualIndex;
    const sourceRowIndex = (visualIndex: number): number =>
      this.visualRowSourceIndexes?.[visualIndex] ?? visualIndex;
    // The topmost dataset per (axis, stack group) carries that group's total (drawn above it).
    // A dataset whose own axis isn't stacked (`axisStacked()` false -- e.g. an unstacked overlay
    // series on a second axis) never enters this map, so it never gets a spurious total. Keyed by
    // axis then by group (rather than a joined string) so a `LyraChartSeries.stack` id can never
    // collide with the axis id it's paired with.
    const topDatasetIndexByGroup = new Map<'y' | 'y2', Map<string | undefined, number>>();
    if (stackTotalsPossible) {
      const visualDatasetCount = this.visualDatasetSourceIndexes?.length ?? datasets.length;
      for (
        let visualIndex = 0;
        visualIndex < visualDatasetCount;
        visualIndex += 1
      ) {
        const dataset = datasets[sourceDatasetIndex(visualIndex)];
        const axis = chartDatasetAxis(dataset);
        if (!this.axisStacked(axis)) continue;
        let byGroup = topDatasetIndexByGroup.get(axis);
        if (!byGroup) {
          byGroup = new Map();
          topDatasetIndexByGroup.set(axis, byGroup);
        }
        // `visualIndex` is deliberate: Chart.js invokes this callback against the sampled visual
        // stack, while the mapped source dataset above supplies the axis, group and source values.
        byGroup.set(chartDatasetStack(dataset), visualIndex);
      }
    }
    const totalsByGroup = new Map<'y' | 'y2', Map<string | undefined, (number | null)[]>>();
    const totalsFor = (axis: 'y' | 'y2', stack: string | undefined): (number | null)[] => {
      let byGroup = totalsByGroup.get(axis);
      if (!byGroup) {
        byGroup = new Map();
        totalsByGroup.set(axis, byGroup);
      }
      let totals = byGroup.get(stack);
      if (!totals) {
        totals = this.computeStackTotals(axis, stack);
        byGroup.set(stack, totals);
      }
      return totals;
    };
    const stackTotalsActive = [...topDatasetIndexByGroup.values()].some((byGroup) => byGroup.size > 0);
    const direction: ChartTextDirection = this.effectiveDirection === 'rtl' ? 'rtl' : 'ltr';
    // The plugin draws each `\n`-separated line as its own canvas string.
    const isolate = (text: string): string =>
      text.split('\n').map((line) => isolateCanvasText(line, direction)).join('\n');
    return {
      color: theme.tick,
      // Totals sit above the stack; plain point labels center on the point.
      align: stackTotalsActive ? 'end' : 'center',
      anchor: stackTotalsActive ? 'end' : 'center',
      display: (context: DataLabelsContext): boolean => {
        const indexes = this.callbackIndexes(context, effective);
        if (!indexes) return false;
        const { datasetIndex, index } = indexes;
        const dataset = datasets[sourceDatasetIndex(datasetIndex)];
        const axis = chartDatasetAxis(dataset);
        const stack = chartDatasetStack(dataset);
        if (stackTotalsPossible && this.axisStacked(axis)) {
          // Only the topmost dataset of each (axis, group) draws, and only where the
          // category total is non-null.
          if (topDatasetIndexByGroup.get(axis)?.get(stack) !== datasetIndex) return this.dataLabels;
          const total = totalsFor(axis, stack)[sourceRowIndex(index)];
          if (total == null) return this.dataLabels;
          return true;
        }
        return this.dataLabels;
      },
      formatter: (value: unknown, context: DataLabelsContext): string => {
        const indexes = this.callbackIndexes(context, effective);
        if (!indexes) return '';
        const { datasetIndex, index } = indexes;
        const dataset = datasets[sourceDatasetIndex(datasetIndex)];
        const axis = chartDatasetAxis(dataset);
        const stack = chartDatasetStack(dataset);
        const metadata = this.datumFormatterMetadata(datasetIndex, index, effective);
        if (
          stackTotalsPossible &&
          this.axisStacked(axis) &&
          topDatasetIndexByGroup.get(axis)?.get(stack) === datasetIndex
        ) {
          const total = totalsFor(axis, stack)[sourceRowIndex(index)];
          if (total != null) return isolate(this.formatDataLabel(total, this.stackTotalMetadata(metadata)));
        }
        const numeric = chartDatumNumericValue(this.scaledSliceDatasets.has(datasetIndex)
          ? this.datasetValues(dataset!)[sourceRowIndex(index)] : value);
        if (numeric === undefined) return '';
        return isolate(this.formatDataLabel(numeric, metadata));
      },
    };
  }

  /** Locale/format a data-label number through the same `valueFormatter` the axis/tooltip use, so a
   *  drawn label matches the rest of the chart; falls back to a plain locale string. The formatter
   *  runs in the `'tooltip'` context — the closest semantic match to an on-point value label, so a
   *  consumer formatter that branches on context behaves predictably rather than seeing `undefined`. */
  private formatDataLabel(
    value: number,
    metadata: LyraChartFormatterMetadata = {},
  ): string {
    if (this.formatter || this.valueFormatter) {
      const formatted = this.formatter?.({ value, surface: 'visual', ...metadata }) ??
        this.valueFormatter?.(value, 'tooltip');
      if (formatted != null) return String(formatted);
    }
    return formatChartValue(value, this.effectiveLocale);
  }

  /**
   * Per-category stack totals for the datasets on axis `axisId` (`'y'`/`'y2'`) belonging to
   * `stackGroup` (a `LyraChartSeries.stack` id), or `null` for a category whose every value is
   * null/undefined (so no total is drawn there rather than a misleading `0`). `stackGroup`
   * defaults to `undefined` -- the implicit group every series without its own `stack` id
   * shares -- so an existing call site untouched by the per-series `stack` feature keeps summing
   * exactly the datasets it always did. Reads the same per-point values as the sr-only data
   * table, null-aware — canvas draws these via the datalabels plugin, but the numbers themselves
   * stay screen-reader available through `renderDataTable()`.
   */
  private computeStackTotals(
    axisId: 'y' | 'y2' = 'y',
    stackGroup?: string,
  ): (number | null)[] {
    const effective = this.effectiveData();
    const members = effective.datasets.filter(
      (dataset) => chartDatasetAxis(dataset) === axisId && chartDatasetStack(dataset) === stackGroup,
    );
    const categoryCount = members.reduce(
      (max, dataset) => Math.max(max, this.datasetValues(dataset).length),
      effective.labels.length
    );
    const totals: (number | null)[] = [];
    for (let i = 0; i < categoryCount; i++) {
      let sum = 0;
      let any = false;
      for (const dataset of members) {
        const value = this.datasetValues(dataset)[i];
        const numeric = chartDatumNumericValue(value);
        if (numeric === undefined) continue;
        sum = finiteAdd(sum, numeric);
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
    return this.canvasTokens.palette();
  }

  /**
   * The per-scale hook that isolates every tick label before Chart.js measures and draws it, so a
   * number-first formatted tick (`2.4 MiB/s`, `9:00 AM`, `-3`) keeps its order on an RTL canvas
   * and an Arabic-script tick keeps its own direction on an LTR one. Axis placement is untouched:
   * only the drawn strings change, and only where their first-strong direction differs from the
   * canvas's.
   */
  private tickLabelIsolation(direction: ChartTextDirection): Record<string, unknown> {
    return {
      afterTickToLabelConversion: (scale: { ticks?: unknown }) =>
        isolateScaleTickLabels(scale, direction),
    };
  }

  private tickOptions(
    theme: ThemeColors,
    kind: 'category' | 'value' = 'value',
    axis: LyraChartFormatterAxis = 'y',
  ): Record<string, unknown> {
    return {
      color: theme.tick,
      font: { size: theme.tickFontSize },
      ...((this.formatter || this.valueFormatter) && kind === 'value'
        ? { callback: (value: unknown) => this.formatValue(value, 'tick', { axis }) }
        : {}),
    };
  }

  private effectiveIndexAxis(): LyraChartIndexAxis {
    return this.indexAxis === 'y' ? 'y' : 'x';
  }

  /** The resolved Chart.js scale type for a value axis, honoring `scaleType`. */
  private valueScaleType(): 'linear' | 'logarithmic' {
    return this.scaleType === 'logarithmic' ? 'logarithmic' : 'linear';
  }

  /** Chart.js `beginAtZero` for a value axis, suppressed on a logarithmic scale which cannot place
   *  zero. */
  private valueBeginAtZero(): boolean | undefined {
    return this.valueScaleType() === 'logarithmic' ? undefined : !this.withoutZeroBaseline;
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
    const grid = normalizeChartGrid(this.grid);
    return grid === 'both' || grid === axis;
  }

  private axisVisible(axis: LyraChartIndexAxis): boolean {
    const axes = normalizeChartGrid(this.axes);
    return !this.compactPlot && (axes === 'both' || axes === axis);
  }

  /**
   * Resolves whether `axisId`'s scale should stack, folding `stackedAxes`'s per-axis override
   * over the chart-wide `stacked` default. `'x'` has no override of its own -- it mirrors the
   * resolved `'y'` value, since Chart.js's stacking contract needs the paired index and value
   * scales to agree (an unstacked value scale ignores an index scale marked `stacked`, and vice
   * versa). Every axis falls back to `stacked` when `stackedAxes` (or its own entry) is unset,
   * which is what keeps a chart that never sets `stackedAxes` byte-identical to before.
   */
  private axisStacked(axisId: 'x' | 'y' | 'y2'): boolean {
    if (axisId === 'y2') return this.stackedAxes?.y2 ?? this.stacked;
    return this.stackedAxes?.y ?? this.stacked;
  }

  /**
   * Builds `options.scales` for the effective chart type: no scale at all for
   * pie/doughnut (a proportional-area chart has no axis), the single radial
   * `r` scale Chart.js v4 uses for radar/polarArea, and the cartesian
   * `x`/`y`(/`y2`) block for every other (line/bar/scatter/bubble) type — with
   * `x` itself further split within that block: scatter and bubble datasets
   * carry raw numeric `{x, y(, r)}` points (via `LyraChartSeries.points`) and need a
   * linear `x` scale, while line/bar plot against `labels` and need the
   * default categorical one. `theme` (from `themeColors()`) drives every
   * scale's `ticks.color`/`grid.color`/axis `title.color` so grid lines and
   * labels retheme instead of sitting at Chart.js's own hardcoded defaults.
   */
  private buildScales(
    effectiveType: EffectiveChartType,
    theme: ThemeColors,
    chartStyle: ChartStyleOptions
  ): Record<string, unknown> {
    if (effectiveType === 'pie' || effectiveType === 'doughnut') return {};

    const direction: ChartTextDirection = this.effectiveDirection === 'rtl' ? 'rtl' : 'ltr';
    if (effectiveType === 'radar' || effectiveType === 'polarArea') {
      const explicitPointLabelFontSize = this.explicitTickFontSize();
      return {
        r: {
          ...this.tickLabelIsolation(direction),
          beginAtZero: !this.withoutZeroBaseline,
          ...this.scaleBounds(),
          // `z: 1` (any value > 0) moves the ring tick labels into Chart.js's post-dataset
          // `_layers` pass (core.controller.js `draw()` runs every z<=0 layer, then
          // `_drawDatasets()`, then every z>0 layer) -- without it `ticks.z` defaults to 0, so a
          // polarArea wedge or radar fill paints over the ring labels sitting inside the plot
          // area (unlike a cartesian axis, whose tick labels sit outside the chart area and are
          // never at risk of being covered by data regardless of draw order).
          ticks: { ...this.tickOptions(theme, 'value', 'r'), showLabelBackdrop: false, z: 1 },
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
          // Only carries a `font` key when the consumer explicitly set the public
          // --lr-chart-tick-font-size token: leaving it out otherwise lets Chart.js's OWN
          // RadialLinearScale pointLabels default (10px) apply, which is what this rendered
          // before the token existed -- unlike the adjacent ticks.font.size above, whose 12px
          // default already matches Chart.js's separate global tick default.
          pointLabels: {
            color: theme.tick,
            callback: (label: unknown) => isolateCanvasLabel(label, direction),
            ...(explicitPointLabelFontSize !== undefined
              ? { font: { size: explicitPointLabelFontSize } }
              : {}),
          },
        },
      };
    }

    const hasY2 = this.effectiveData().datasets.some(
      (dataset) => chartDatasetAxis(dataset) === 'y2'
    );
    const rtl = this.effectiveDirection === 'rtl';
    // `stacked`/`stackedAxes` only apply to bar/line-family charts sharing a categorical axis,
    // per the design spec — scatter/bubble's linear x scale and the radial r scale above are out
    // of scope. Resolved per axis via `axisStacked()` so a chart-wide `stacked` alone (no
    // `stackedAxes`) still yields the same single boolean on every axis as before.
    const stackableType = effectiveType === 'bar' || effectiveType === 'line';
    const stackedX = stackableType && this.axisStacked('x');
    const stackedY = stackableType && this.axisStacked('y');
    const stackedY2 = stackableType && this.axisStacked('y2');
    const horizontalCategorical =
      (effectiveType === 'bar' || effectiveType === 'line') && this.effectiveIndexAxis() === 'y';
    const pointChart = this.preparedModel?.kind === 'series' || effectiveType === 'scatter' || effectiveType === 'bubble';
    const xKind: 'category' | 'value' = pointChart || horizontalCategorical ? 'value' : 'category';
    const yKind: 'category' | 'value' = this.preparedModel?.kind === 'series' ? 'value' : horizontalCategorical ? 'category' : 'value';
    const valueAxis =
      horizontalCategorical ? 'x' : 'y';
    const bounds = this.scaleBounds();
    const prepared = this.preparedModel;
    const fullBounds = (axis: 'xDomain' | 'yDomain') => {
      const domains = prepared?.kind === 'series' ? prepared.series.flatMap(series => series[axis] ? [series[axis]!] : []) : [];
      return domains.length ? { min: Math.min(...domains.map(domain => domain.min)), max: Math.max(...domains.map(domain => domain.max)) } : {};
    };
    return {
      x: {
        ...this.tickLabelIsolation(direction),
        display: this.axisVisible('x'),
        type: xKind === 'value' ? this.valueScaleType() : 'category',
        beginAtZero: xKind === 'value' ? this.valueBeginAtZero() : undefined,
        ...fullBounds('xDomain'),
        ...(valueAxis === 'x' ? bounds : {}),
        title: { display: !!this.xLabel, text: isolateCanvasLabel(this.xLabel, direction), color: theme.tick },
        ticks: this.tickOptions(theme, xKind, 'x'),
        grid: {
          color: theme.grid,
          display: this.gridAxisVisible('x'),
          lineWidth: chartStyle.gridBorderWidth,
        },
        border: { width: chartStyle.gridBorderWidth },
        stacked: stackedX,
      },
      y: {
        ...this.tickLabelIsolation(direction),
        display: this.axisVisible('y'),
        type: yKind === 'value' ? this.valueScaleType() : 'category',
        position: rtl ? 'right' : 'left',
        beginAtZero: yKind === 'value' ? this.valueBeginAtZero() : undefined,
        ...fullBounds('yDomain'),
        ...(valueAxis === 'y' ? bounds : {}),
        title: { display: !!this.yLabel, text: isolateCanvasLabel(this.yLabel, direction), color: theme.tick },
        ticks: this.tickOptions(theme, yKind, 'y'),
        grid: {
          color: theme.grid,
          display: this.gridAxisVisible('y'),
          lineWidth: chartStyle.gridBorderWidth,
        },
        border: { width: chartStyle.gridBorderWidth },
        stacked: stackedY,
      },
      ...(hasY2
        ? {
            y2: {
              ...this.tickLabelIsolation(direction),
              display: this.axisVisible('y'),
              type: this.valueScaleType(),
              position: rtl ? 'left' : 'right',
              ...(valueAxis === 'y' ? bounds : {}),
              grid: {
                drawOnChartArea: false,
                color: theme.grid,
                display: this.gridAxisVisible('y'),
                lineWidth: chartStyle.gridBorderWidth,
              },
              border: { width: chartStyle.gridBorderWidth },
              title: { display: !!this.y2Label, text: isolateCanvasLabel(this.y2Label, direction), color: theme.tick, },
              ticks: this.tickOptions(theme, 'value', 'y2'),
              stacked: stackedY2,
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
    if (!this.isConnected || chart !== this.chart) return;
    // Chart.js's own `onClick` handler hands us its `ChartEvent` wrapper, but
    // `getElementsAtEventForMode()`'s .d.ts (inaccurately) types its first
    // param as a DOM `Event` — at runtime Chart.js only reads `.x`/`.y` off
    // whatever is passed (see chart.js/src/helpers/helpers.dom.ts
    // `getRelativePosition()`), which `ChartEvent` already has, so the cast
    // here is a type-only correction, not a behavior change.
    let elements: unknown;
    try {
      elements = chart.getElementsAtEventForMode(
        event as unknown as Event,
        'nearest',
        { intersect: true },
        true
      );
    } catch {
      return;
    }
    const admission = admitChartArray(elements);
    if (!admission || !chartArrayIsStillAdmitted(admission)) return;
    const first = chartRecordValue(admission.source, '0');
    if (first === MISSING_OWN_DATA_DESCRIPTOR || first === UNSAFE_OWN_DATA_DESCRIPTOR) return;
    const effective = this.effectiveData();
    const hit = this.callbackIndexes(first.value, effective);
    if (!hit) return;
    const datasetIndex = this.visualDatasetSourceIndexes?.[hit.datasetIndex] ?? hit.datasetIndex;
    const index = this.visualRowSourceIndexes?.[hit.index] ?? hit.index;
    const value = this.datasetValues(effective.datasets[datasetIndex]!)[index] ?? null;
    const label = normalizedChartPoint(value)?.label ??
      (labelText(effective.labels[index]) || undefined);
    this.activateDatum({ datasetIndex, index, label, value });
  }

  private chartDatums(): ChartDatum[] {
    const effective = this.effectiveData();
    const plan = this.dataTableSample(effective);
    const memo = this.chartDatumsMemo;
    if (
      memo?.effective === effective && memo.plan === plan &&
      memo.datasets === this.visualDatasetSourceIndexes &&
      memo.rows === this.visualRowSourceIndexes
    )
      return memo.value;
    const datasetIndexes = this.visualDatasetSourceIndexes ?? this.dataTableSample(effective).seriesIndexes;
    const datasets = datasetIndexes.map((index) => effective.datasets[index]);
    let rowIndexes = this.visualRowSourceIndexes;
    if (!rowIndexes) {
      rowIndexes = this.dataTableSample(effective).rowIndexes;
    }
    const labels = rowIndexes.map((index) => effective.labels[index]);
    // `rowIndexes` is already the visual sample when the chart was bounded for rendering. Sample
    // only its local positions here, then translate through that map exactly once below.
    const rowCount = rowIndexes.length;
    const sample = this.preparedModel ? { rowIndexes: Array.from({ length: rowCount }, (_, index) => index), seriesIndexes: Array.from({ length: datasets.length }, (_, index) => index) } : sampleChartTableIndexes(rowCount, datasets.length);
    const datums: ChartDatum[] = [];
    sample.seriesIndexes.forEach((datasetIndex) => {
      const dataset = datasets[datasetIndex];
      if (!dataset) return;
      const values = chartDatasetValues(dataset);
      sample.rowIndexes.forEach((localIndex) => {
        const sourceIndex = rowIndexes[localIndex] ?? localIndex;
        const value = values[sourceIndex];
        if (value == null) return;
        if (typeof value === 'number' && !Number.isFinite(value)) return;
        datums.push({
          datasetIndex: datasetIndexes[datasetIndex] ?? datasetIndex,
          index: sourceIndex,
          label: normalizedChartPoint(value)?.label ?? (labelText(labels[localIndex]) || undefined),
          value,
        });
      });
    });
    this.chartDatumsMemo = {
      plan,
      effective,
      datasets: this.visualDatasetSourceIndexes,
      rows: this.visualRowSourceIndexes,
      value: datums,
    };
    return datums;
  }

  private datumDisplayValue(
    value: unknown,
    context: LyraChartFormatterMetadata & {
      readonly surface: 'table' | 'spoken';
    } = {
      surface: 'spoken',
    },
  ): string {
    const { surface, ...metadata } = context;
    const format = (numeric: number, statistic?: LyraChartStatistic): string =>
      surface === 'table'
        ? this.formatTableValue(numeric, { ...metadata, statistic })
        : this.formatSpokenValue(numeric, { ...metadata, statistic });
    const point = normalizedChartPoint(value);
    if (point) {
      const x = format(point.x, 'x');
      const y = format(point.y, 'y');
      const coordinates = point.r == null
        ? this.localize('chartPointCoordinates', undefined, { x, y })
        : this.localize('chartBubblePointCoordinates', undefined, {
            x,
            y,
            radius: format(point.r, 'r'),
          });
      return point.label !== undefined
        ? this.localize('chartLabeledPoint', undefined, { label: point.label, coordinates })
        : coordinates;
    }
    const numeric = chartDatumNumericValue(value);
    return numeric === undefined ? labelText(value) : format(numeric);
  }

  private datumAnnouncement(datum: ChartDatum, position: number, total: number): string {
    const dataset = this.effectiveData().datasets[datum.datasetIndex];
    const series = chartDatasetLabel(dataset) || this.localize('chartSeriesLabel');
    return this.localize('liteChartMarkSummary', undefined, {
      series,
      label:
        datum.label ??
        this.localize('chartPointLabel', undefined, {
          n: getNumberFormat(this.effectiveLocale).format(datum.index + 1),
        }),
      value: this.datumDisplayValue(datum.value, {
        surface: 'spoken',
        datasetIndex: datum.datasetIndex,
        index: datum.index,
        label: datum.label,
        seriesLabel: series,
        ...(this.datasetValueAxis(dataset) === undefined
          ? {}
          : { axis: this.datasetValueAxis(dataset) }),
      }),
      index: getNumberFormat(this.effectiveLocale).format(position + 1),
      total: getNumberFormat(this.effectiveLocale).format(total),
    });
  }

  /** @internal Specialized distributions may retain only their existing aggregate activation. */
  protected emitPreparedSourceSelection(datasetIndex: number, index: number): void {
    const model = this.preparedModel;
    const series = model?.series[datasetIndex];
    if (model && series) {
      if (model.kind === 'series') {
        const point = series.samples[index];
        if (point) this.emit('lr-source-point-select', { revision: model.revision, seriesId: series.id, sourceIndex: point.sourceIndex, point: Object.freeze({ x: point.x, y: point.y }) });
      } else {
        const categoryId = model.categoryIds[index], value = series.values[index];
        if (categoryId !== undefined && value !== undefined) this.emit('lr-source-category-select', { revision: model.revision, seriesId: series.id, categoryId, value, observationCount: model.categoryCounts[index]! });
      }
    }
  }

  /** @internal Specialized distributions may describe observations outside their plotted bins. */
  protected preparedSummary(): string | undefined { return undefined; }

  private activateDatum(datum: ChartDatum): void {
    const datums = this.chartDatums();
    const position = datums.findIndex(
      (candidate) =>
        candidate.datasetIndex === datum.datasetIndex && candidate.index === datum.index
    );
    if (position >= 0) {
      this.keyboardDatumIndex = position;
      this.keyboardDatumAnnouncement = this.datumAnnouncement(datum, position, datums.length);
    }
    const type = this.effectiveType();
    const kind: LyraCoreChartDatumKind =
      type === 'bar'
        ? 'bar'
        : type === 'pie' || type === 'doughnut' || type === 'polarArea'
          ? 'slice'
          : type === 'line'
            ? 'segment'
            : 'point';
    this.emitPreparedSourceSelection(datum.datasetIndex, datum.index);
    this.emit('lr-datum-activate', { ...datum, kind });
    this.emit('lr-point-activate', { ...datum });
  }

  private resetSyncTooltip(): void {
    const chart = this.chart as (RuntimeChart & {
      tooltip?: { setActiveElements: (hits: ChartHit[], position: { x: number; y: number }) => void };
      render?: () => void;
    }) | undefined;
    chart?.tooltip?.setActiveElements([], { x: 0, y: 0 });
    chart?.render?.();
  }

  private syncCompatible(): boolean {
    const chart = this.chart;
    if (!chart) return false;
    const type = this.effectiveType();
    if (type !== 'bar' && type !== 'line') return false;
    if (chart.options['indexAxis'] === 'y') return false;
    const runtime = chart as RuntimeChart & { scales?: Record<string, { type?: string }> };
    return runtime.scales?.['x']?.type === 'category' && Array.isArray(chart.data?.datasets) &&
      chart.data.datasets.every((dataset) => dataset.type === undefined || dataset.type === 'bar' || dataset.type === 'line');
  }

  private chartDatumsMemo?: {
    plan: ReturnType<LyraChart['dataTableSample']>;
    effective: EffectiveChartData;
    datasets: readonly number[] | undefined;
    rows: readonly number[] | undefined;
    value: ChartDatum[];
  };

  /** Source -> visual position, built once per visual sample instead of an `indexOf` per datum. */
  private visualPosition(sources: readonly number[] | undefined, source: number): number {
    if (!sources) return source;
    let positions = this.visualPositions.get(sources);
    if (!positions) {
      positions = new Map(sources.map((value, index) => [value, index]));
      this.visualPositions.set(sources, positions);
    }
    return positions.get(source) ?? -1;
  }

  private readonly visualPositions = new WeakMap<readonly number[], Map<number, number>>();

  private syncDatumIndex?: {
    datums: ChartDatum[];
    byAddress: Map<string, ChartDatum>;
    byCategory: Map<number, ChartDatum[]>;
    labelCategories: Map<string, number[]>;
  };

  /** Indexes the immutable datum model once; visibility and geometry remain live checks. */
  private indexedSyncDatums() {
    const datums = this.chartDatums();
    if (this.syncDatumIndex?.datums === datums) return this.syncDatumIndex;
    const byAddress = new Map<string, ChartDatum>();
    const byCategory = new Map<number, ChartDatum[]>();
    for (const datum of datums) {
      byAddress.set(`${datum.datasetIndex}:${datum.index}`, datum);
      let category = byCategory.get(datum.index);
      if (!category) {
        category = [];
        byCategory.set(datum.index, category);
      }
      category.push(datum);
    }
    const labels = this.effectiveData().labels;
    const labelCategories = new Map<string, number[]>();
    for (const index of [...byCategory.keys()].sort((a, b) => a - b)) {
      const label = labels[index];
      if (typeof label !== 'string') continue;
      let categories = labelCategories.get(label);
      if (!categories) {
        categories = [];
        labelCategories.set(label, categories);
      }
      categories.push(index);
    }
    return this.syncDatumIndex = { datums, byAddress, byCategory, labelCategories };
  }

  private syncDatumIsEligible(datum: ChartDatum): boolean {
    const chart = this.chart;
    if (!chart) return false;
    const visualDataset = this.visualPosition(this.visualDatasetSourceIndexes, datum.datasetIndex);
    const visualIndex = this.visualPosition(this.visualRowSourceIndexes, datum.index);
    const meta = chart.getDatasetMeta?.(visualDataset) as { data?: { skip?: boolean; x?: number; y?: number }[] } | undefined;
    const element = meta?.data?.[visualIndex];
    return chart.isDatasetVisible(visualDataset) && !!element && !element.skip &&
      Number.isFinite(element.x) && Number.isFinite(element.y) &&
      chartDatumNumericValue(datum.value) !== undefined;
  }

  private publishSyncDatum(datum: ChartDatum): void {
    const label = this.effectiveData().labels[datum.index];
    if (typeof label === 'string') this.chartSync.publish(label, datum.index);
    else this.chartSync.clear();
  }

  private onSyncPointerMove(event: PointerEvent): void {
    if (!this.chartSync.enabled || !this.chart) return;
    const hits = this.chart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, true);
    const hit = hits[0];
    if (!hit) { this.chartSync.clear(); return; }
    const datasetIndex = this.visualDatasetSourceIndexes?.[hit.datasetIndex] ?? hit.datasetIndex;
    const index = this.visualRowSourceIndexes?.[hit.index] ?? hit.index;
    const datum = this.indexedSyncDatums().byAddress.get(`${datasetIndex}:${index}`);
    if (datum && this.syncDatumIsEligible(datum)) this.publishSyncDatum(datum);
  }

  private syncPresentation(label: string, sourceIndex?: number): ChartSyncPresentation | undefined {
    if (!this.syncCompatible() || !this.canvasEl || !this.chart) return undefined;
    const effective = this.effectiveData();
    if (sourceIndex !== undefined && effective.labels[sourceIndex] !== label) return undefined;
    const indexed = this.indexedSyncDatums();
    const categories = sourceIndex === undefined ? indexed.labelCategories.get(label) ?? [] : [sourceIndex];
    let matches: ChartDatum[] = [];
    for (const index of categories) {
      matches = (indexed.byCategory.get(index) ?? []).filter((datum) => this.syncDatumIsEligible(datum));
      if (matches.length) break;
    }
    if (!matches.length) return undefined;
    const hits = matches.map((datum) => ({
      datasetIndex: this.visualPosition(this.visualDatasetSourceIndexes, datum.datasetIndex),
      index: this.visualPosition(this.visualRowSourceIndexes, datum.index),
    }));
    const runtime = this.chart as RuntimeChart & {
      tooltip?: {
        setActiveElements: (hits: ChartHit[], position: { x: number; y: number }) => void;
      };
      render?: () => void;
      scales?: Record<string, { getPixelForValue?: (index: number) => number }>;
    };
    const element = this.chart.getDatasetMeta?.(hits[0]!.datasetIndex) as { data?: { x: number; y: number }[] } | undefined;
    const point = element?.data?.[hits[0]!.index];
    const area = this.chart.chartArea;
    const container = this.renderRoot.querySelector<HTMLElement>('[part="plot"]');
    if (!point || !area || !container) return undefined;
    const plugins = this.chart.options['plugins'] as { tooltip?: false | { enabled?: boolean } } | undefined;
    const suppressed = this.withoutTooltip || plugins?.tooltip === false || plugins?.tooltip?.enabled === false;
    const tooltip = runtime.tooltip;
    tooltip?.setActiveElements(suppressed ? [] : hits, { x: point.x, y: point.y });
    runtime.render?.();
    const bounds = container.getBoundingClientRect();
    const canvasBounds = this.canvasEl.getBoundingClientRect();
    const categoryX = runtime.scales?.['x']?.getPixelForValue?.(hits[0]!.index);
    return {
      container,
      x: canvasBounds.left - bounds.left + (typeof categoryX === 'number' && Number.isFinite(categoryX) ? categoryX : point.x),
      top: canvasBounds.top - bounds.top + area.top,
      height: area.height,
    };
  }

  /** Shows the keyboard-current datum the way a hover would; a synchronized chart already shows
   *  it through the shared presentation. `undefined` clears a cue this chart showed. */
  private showKeyboardDatum(datum: ChartDatum | undefined): void {
    if (!this.chart || this.chartSync.enabled || (!datum && !this.keyboardDatumShown)) return;
    this.keyboardDatumShown = showChartActiveDatum(this.chart, datum && {
      datasetIndex: this.visualPosition(this.visualDatasetSourceIndexes, datum.datasetIndex),
      index: this.visualPosition(this.visualRowSourceIndexes, datum.index),
    });
  }

  private keyboardDatumShown = false;

  private readonly onCanvasBlur = (): void => {
    this.showKeyboardDatum(undefined);
  };

  private onCanvasFocus(event: FocusEvent): void {
    if (this.spatialActive) return;
    const datums = this.chartDatums();
    if (!datums.length) return;
    this.keyboardDatumIndex = Math.min(this.keyboardDatumIndex, datums.length - 1);
    this.publishSyncDatum(datums[this.keyboardDatumIndex]!);
    if (isKeyboardFocusEvent(event)) this.showKeyboardDatum(datums[this.keyboardDatumIndex]);
    this.keyboardDatumAnnouncement = this.datumAnnouncement(
      datums[this.keyboardDatumIndex]!,
      this.keyboardDatumIndex,
      datums.length
    );
  }

  private onCanvasKeyDown(event: KeyboardEvent): void {
    if (this.spatialActive) { this.spatialKeyDown(event); return; }
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
    this.publishSyncDatum(datums[next]!);
    this.showKeyboardDatum(datums[next]);
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
    // Literal keys rather than a lookup table: the default-string slice generator reads literal
    // `localize()` calls, and one computed key makes it copy unrelated literals into every slice.
    const type = this.effectiveType();
    switch (type) {
      case 'line': return this.localize('chartTypeLine');
      case 'bar': return this.localize('chartTypeBar');
      case 'scatter': return this.localize('chartTypeScatter');
      case 'pie': return this.localize('chartTypePie');
      case 'doughnut': return this.localize('chartTypeDoughnut');
      case 'radar': return this.localize('chartTypeRadar');
      case 'polarArea': return this.localize('chartTypePolarArea');
      case 'bubble': return this.localize('chartTypeBubble');
      default: return String(type);
    }
  }

  /**
   * The tick/tooltip/legend/table value path. `metadata` is spread onto the unified formatter's
   * context exactly as the table/export/spoken helpers already do theirs; the legacy positional
   * `valueFormatter` has no place to carry it and is called unchanged.
   */
  private formatValue(
    value: unknown,
    context: LyraChartValueFormatterContext,
    metadata: LyraChartFormatterMetadata = {},
  ): unknown {
    const numeric = chartDatumNumericValue(value);
    if (numeric === undefined) return value;
    return (
      this.formatter?.({ value: numeric, surface: context, ...metadata }) ??
      this.valueFormatter?.(numeric, context) ??
      value
    );
  }

  /**
   * The scale `dataset`'s values are plotted against, for the formatter context's `axis` field.
   * A point dataset's `x`/`r` components are told apart by `statistic`, not by this -- `axis`
   * names the scale the dataset's primary value sits on.
   */
  private datasetValueAxis(
    dataset: LyraChartDatasetConfiguration | undefined,
  ): LyraChartFormatterAxis | undefined {
    const type = this.effectiveType();
    if (type === 'pie' || type === 'doughnut') return undefined;
    if (type === 'radar' || type === 'polarArea') return 'r';
    if ((type === 'bar' || type === 'line') && this.effectiveIndexAxis() === 'y') return 'x';
    return dataset === undefined ? undefined : chartDatasetAxis(dataset);
  }

  /**
   * Formatter metadata for one datum, in SOURCE index space -- the same space the data table,
   * CSV export and `lr-point-activate` already report, so a formatter's `datasetIndex`/`index` mean
   * one thing across every surface even while sampling has renumbered what Chart.js sees.
   */
  private datumFormatterMetadata(
    visualDatasetIndex: number,
    visualRowIndex?: number,
    effective = this.effectiveData(),
  ): LyraChartFormatterMetadata {
    return this.sourceDatumFormatterMetadata(
      this.visualDatasetSourceIndexes?.[visualDatasetIndex] ?? visualDatasetIndex,
      visualRowIndex === undefined
        ? undefined
        : this.visualRowSourceIndexes?.[visualRowIndex] ?? visualRowIndex,
      effective,
    );
  }

  /**
   * The same metadata for a call site that ALREADY holds source indexes -- the rendered DOM legend,
   * whose entries come from `dataTableSample()`'s source-space `seriesIndexes`/`rowIndexes`.
   * Mapping those through the visual tables a second time renumbers them onto a different series
   * whenever sampling is active, so the legend entry would report the label and index of a series
   * other than the one its own swatch paints.
   */
  private sourceDatumFormatterMetadata(
    datasetIndex: number,
    index?: number,
    effective = this.effectiveData(),
  ): LyraChartFormatterMetadata {
    // Every caller resolved `datasetIndex` through `callbackDatasetIndex()`/`callbackIndexes()` or
    // from this same `effective` snapshot's own dataset list, so the dataset always exists.
    const dataset = effective.datasets[datasetIndex]!;
    const point =
      index === undefined
        ? null
        : normalizedChartPoint(this.datasetValues(dataset)[index]);
    const label =
      index === undefined
        ? undefined
        : point?.label ?? (labelText(effective.labels[index]) || undefined);
    const axis = this.datasetValueAxis(dataset);
    return {
      datasetIndex,
      ...(index === undefined ? {} : { index }),
      ...(label === undefined ? {} : { label }),
      seriesLabel: this.datasetLabel(dataset, datasetIndex),
      ...(axis === undefined ? {} : { axis }),
    };
  }

  /**
   * A stack total is the sum ACROSS the stack's datasets, so it names none of them. Carrying the
   * topmost dataset's `datasetIndex`/`seriesLabel` would make a formatter that branches on the
   * series render one series' unit for a cross-series number; `lr-lite-chart`'s total cells drop
   * both for exactly that reason. The axis survives, because every dataset in one stack shares it
   * and it is what a dual-axis formatter needs to pick the total's unit.
   */
  private stackTotalMetadata(metadata: LyraChartFormatterMetadata): LyraChartFormatterMetadata {
    return {
      ...(metadata.index === undefined ? {} : { index: metadata.index }),
      ...(metadata.label === undefined ? {} : { label: metadata.label }),
      ...(metadata.axis === undefined ? {} : { axis: metadata.axis }),
      statistic: 'total',
    };
  }

  /** `effective` is threaded in: `effectiveData()` rebuilds every label and dataset array, and this
   *  runs once per legend entry, so resolving it here would rebuild it N times per legend pass. */
  private legendValue(
    item: ChartLegendItem,
    _chart: RuntimeChart,
    effective = this.effectiveData(),
  ): number | undefined {
    const datasetIndex = this.callbackDatasetIndex(item, effective);
    if (datasetIndex === undefined) return undefined;
    const sourceDatasetIndex = this.visualDatasetSourceIndexes?.[datasetIndex] ?? datasetIndex;
    const data = this.datasetValues(effective.datasets[sourceDatasetIndex]!);
    if (!data.length) return undefined;
    const visualRows = this.visualRowSourceIndexes ?? data.map((_value, index) => index);
    const indexDescriptor = chartRecordValue(item, 'index');
    if (indexDescriptor === UNSAFE_OWN_DATA_DESCRIPTOR) return undefined;
    if (indexDescriptor !== MISSING_OWN_DATA_DESCRIPTOR) {
      const itemIndex = chartIndex(indexDescriptor.value);
      if (itemIndex === undefined || itemIndex >= visualRows.length) return undefined;
      return chartDatumNumericValue(data[visualRows[itemIndex]!] ?? null);
    }
    let sum = 0;
    let hasValue = false;
    for (const sourceRowIndex of visualRows) {
      const datum = data[sourceRowIndex];
      const value = chartDatumNumericValue(datum);
      if (value === undefined) continue;
      sum = finiteAdd(sum, value);
      hasValue = true;
    }
    return hasValue ? sum : undefined;
  }

  private legendLabels(chart: RuntimeChart): ChartLegendItem[] {
    const generateLabels = this.chartJsModule?.defaults?.plugins?.legend?.labels?.generateLabels;
    let generated: readonly ChartLegendItem[] | undefined;
    if (generateLabels) {
      try {
        generated = projectChartLegendItems(generateLabels(chart as never));
      } catch {
        generated = undefined;
      }
    }
    const effective = this.effectiveData();
    const direction = canvasTextDirection(chart.legend, this.effectiveDirection);
    const sourceIndexes = this.visualDatasetSourceIndexes ??
      effective.datasets.map((_dataset, index) => index);
    const fallbackDatasets = sourceIndexes.map((sourceIndex) => effective.datasets[sourceIndex]);
    const labels = generated ?? fallbackDatasets.map((dataset, index) => ({
      text: chartDatasetLabel(dataset) || String(index + 1),
      datasetIndex: index,
    }));
    return labels.map((item) => {
      const value = this.legendValue(item, chart, effective);
      // A value exists only for an item whose dataset resolves, and `formatValue()` leaves an
      // absent value untouched, so such an item is returned as generated.
      if (value === undefined) return item;
      const visualDatasetIndex = this.callbackDatasetIndex(item, effective)!;
      const visualRowIndex = chartIndex(chartDatasetValue(item, 'index'));
      const formatted = this.formatValue(
        value,
        'legend',
        this.datumFormatterMetadata(visualDatasetIndex, visualRowIndex, effective),
      );
      return formatted === value || formatted === undefined
        ? item
        : {
            ...item,
            text: this.localize('chartValueLabel', undefined, {
              label: labelText(chartDatasetValue(item, 'text')),
              // Canvas-drawn: the value keeps its own direction beside an RTL-script label.
              value: isolateCanvasText(String(formatted), direction),
            }),
          };
    });
  }

  private tooltipLabel(context: ChartTooltipContext, horizontal = false): string | undefined {
    const parsed = projectChartDatum(chartDatasetValue(context, 'parsed'));
    const raw = projectChartDatum(chartDatasetValue(context, 'raw'));
    const parsedPoint = normalizedChartPoint(parsed);
    // Scalar cartesian data uses the effective value axis. Structured points keep their y-value
    // contract, and partial/radial parsed shapes retain the existing numeric fallback.
    let rawValue = (horizontal && !normalizedChartPoint(raw) ? parsedPoint?.x : parsedPoint?.y) ??
      parsed ?? raw;
    // A tooltip callback runs once per item per pointer move and `effectiveData()` is not
    // memoized -- it copies every label and every dataset's values and re-runs the config merge --
    // so resolve it at most once here, and only when something actually consumes the datum's
    // identity: a rescaled slice, or an installed `formatter` (the positional `valueFormatter`
    // never receives metadata).
    const scaledSlices = this.scaledSliceDatasets.size > 0;
    const effective =
      scaledSlices || this.formatter !== undefined ? this.effectiveData() : undefined;
    const hit = effective === undefined ? undefined : this.callbackIndexes(context, effective);
    const indexes = scaledSlices ? hit : undefined;
    const scaled =
      indexes !== undefined &&
      effective !== undefined &&
      this.scaledSliceDatasets.has(indexes.datasetIndex);
    if (scaled) {
      const dataset = effective.datasets[this.visualDatasetSourceIndexes?.[indexes.datasetIndex] ?? indexes.datasetIndex];
      rawValue = this.datasetValues(dataset!)[this.visualRowSourceIndexes?.[indexes.index] ?? indexes.index];
    }
    // The hovered datum is already resolved here; it used to be resolved and then dropped, leaving
    // a tooltip formatter unable to tell which series it was formatting.
    let formatted = this.formatValue(
      rawValue,
      'tooltip',
      hit === undefined || effective === undefined
        ? {}
        : this.datumFormatterMetadata(hit.datasetIndex, hit.index, effective),
    );
    if ((!scaled && formatted === rawValue) || formatted === undefined) return undefined;
    if (scaled && typeof formatted === 'number') formatted = this.formatSummaryValue(formatted);
    const label = chartDatasetLabel(chartDatasetValue(context, 'dataset'));
    // The value is its own unit of text inside the drawn sentence. The whole-line isolation in
    // `beforeTooltipDraw` paints a line in its series label's direction, so an RTL-script label
    // would otherwise leave a number-first `1.5 MiB/s` painting unit-first. Canvas-only text.
    return label
      ? canvasSentence(
          (value) => this.localize('chartValueLabel', undefined, { label, value }),
          String(formatted),
        )
      : String(formatted);
  }

  /**
   * Resolves one hovered tooltip item into the unified formatter context, for
   * `tooltipTitleFormatter`/`tooltipFooterFormatter`. Mirrors `tooltipLabel()`'s raw-value and
   * rescaled-slice resolution so a hovered item's `value` means the same number on every tooltip
   * surface, but returns the context object itself rather than one rendered string -- title/footer
   * need every hovered item's context at once, not one item's formatted text. `undefined` for an
   * item with no numeric value, so it's dropped from the group rather than passed through as
   * `NaN`.
   */
  private tooltipItemContext(
    context: ChartTooltipContext,
    horizontal: boolean,
    effective: EffectiveChartData,
  ): LyraChartFormatterContext | undefined {
    const parsed = projectChartDatum(chartDatasetValue(context, 'parsed'));
    const raw = projectChartDatum(chartDatasetValue(context, 'raw'));
    const parsedPoint = normalizedChartPoint(parsed);
    let rawValue = (horizontal && !normalizedChartPoint(raw) ? parsedPoint?.x : parsedPoint?.y) ??
      parsed ?? raw;
    const hit = this.callbackIndexes(context, effective);
    if (hit !== undefined && this.scaledSliceDatasets.has(hit.datasetIndex)) {
      const dataset =
        effective.datasets[this.visualDatasetSourceIndexes?.[hit.datasetIndex] ?? hit.datasetIndex];
      rawValue = this.datasetValues(dataset!)[this.visualRowSourceIndexes?.[hit.index] ?? hit.index];
    }
    const numeric = chartDatumNumericValue(rawValue);
    if (numeric === undefined) return undefined;
    const metadata =
      hit === undefined ? {} : this.datumFormatterMetadata(hit.datasetIndex, hit.index, effective);
    return { value: numeric, surface: 'tooltip', ...metadata };
  }

  /**
   * Runs `formatter` (`tooltipTitleFormatter`/`tooltipFooterFormatter`) against every hovered
   * item's context at once. `undefined` when the formatter itself is unset -- the caller uses that
   * to omit the Chart.js `title`/`footer` callback entirely, which leaves Chart.js's own default
   * in place -- or when no hovered item resolved a numeric value.
   */
  private tooltipGroupText(
    items: readonly ChartTooltipContext[],
    horizontal: boolean,
    formatter: LyraChartTooltipGroupFormatter | undefined,
  ): string | undefined {
    if (!formatter) return undefined;
    const effective = this.effectiveData();
    const contexts = items
      .map((item) => this.tooltipItemContext(item, horizontal, effective))
      .filter((context): context is LyraChartFormatterContext => context !== undefined);
    if (!contexts.length) return undefined;
    return formatter(contexts);
  }

  private updateAutoLegendPosition(): boolean {
    const width = this.getBoundingClientRect().width || this.clientWidth;
    const next: 'right' | 'bottom' = width > 0 && width < 480 ? 'bottom' : 'right';
    if (next === this.autoLegendPosition) return false;
    this.autoLegendPosition = next;
    return true;
  }

  private legendPositionForConfig(): LyraChartLayoutPosition {
    const position = normalizeLegendPosition(this.legendPosition);
    if (position === 'auto') return this.autoLegendPosition;
    if (position === 'start') {
      return this.effectiveDirection === 'rtl' ? 'right' : 'left';
    }
    if (position === 'end') {
      return this.effectiveDirection === 'rtl' ? 'left' : 'right';
    }
    return position;
  }

  private legendPositionForLayout(): 'top' | 'right' | 'bottom' | 'left' {
    const position = this.legendPositionForConfig();
    return position === 'top' || position === 'right' || position === 'left' ? position : 'bottom';
  }

  /**
   * The `data-legend-position` token that selects `[part='base']`'s grid template. Deliberately
   * *not* the physical side `legendPositionForLayout()` reports: CSS Grid numbers a two-column
   * template along the inline axis, so the template already mirrors itself under `dir="rtl"`.
   * Feeding the direction-compensated physical value in here mirrored a side legend a second time
   * and landed it on the opposite edge from the one `start`/`end` names. The logical aliases
   * therefore pick a column outright and let the grid perform the single mirror, while a literal
   * `left`/`right` (the Chart.js-vocabulary passthrough) is pre-compensated so it stays on the
   * physical edge its name promises. `auto` keeps its existing reading-end placement.
   */
  private legendGridPlacement():
    | 'top' | 'bottom' | 'inline-start' | 'inline-end' {
    const position = normalizeLegendPosition(this.legendPosition);
    if (position === 'auto') {
      return this.autoLegendPosition === 'right' ? 'inline-end' : 'bottom';
    }
    if (position === 'start') return 'inline-start';
    if (position === 'end') return 'inline-end';
    if (position === 'top') return 'top';
    const rtl = this.effectiveDirection === 'rtl';
    if (position === 'left') return rtl ? 'inline-end' : 'inline-start';
    if (position === 'right') return rtl ? 'inline-start' : 'inline-end';
    return 'bottom';
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
    if (![next.top, next.left, next.right, next.bottom, next.width, next.height].every(Number.isFinite))
      return;
    const previous = this.resolvedChartArea;
    if (
      previous &&
      previous.top === next.top &&
      previous.left === next.left &&
      previous.right === next.right &&
      previous.bottom === next.bottom &&
      previous.width === next.width &&
      previous.height === next.height
    ) {
      return;
    }
    this.resolvedChartArea = next;
    if (!this.chartAreaUpdateQueued) {
      this.chartAreaUpdateQueued = true;
      queueMicrotask(() => {
        this.chartAreaUpdateQueued = false;
        if (this.isConnected) this.requestUpdate('canvasPresentation', null);
      });
    }
  }

  /** The current Chart.js chart-area geometry in canvas-local coordinates. Read-only -- derived
   *  from the live Chart.js instance's own layout pass, never assignable. The setter is a
   *  documented no-op (matching `lr-histogram`'s `labels`/`datasets` pattern) so an accidental
   *  `.chartArea=${x}` Lit template binding degrades silently instead of throwing from inside
   *  lit-html's property-commit. */
  get chartArea(): LyraChartArea | undefined {
    return this.resolvedChartArea;
  }
  set chartArea(_value: LyraChartArea | undefined) {
    /* read-only, derived from the live Chart.js instance; direct writes are silently ignored */
  }

  private spatialDescription(): string {
    const binding = this.spatial.binding, global = binding?.bounds, view = this.spatial.view;
    if (!global || !view) return this.localize('noData');
    const f = (value: number) => this.formatSummaryValue(value);
    const summary = this.localize('chartSpatialSummary', undefined, { count: f(binding.count), matchedCount: f(this.spatial.result?.matchedCount ?? 0),
      minX: f(global.minX), maxX: f(global.maxX), minY: f(global.minY), maxY: f(global.maxY),
      viewMinX: f(view.minX), viewMaxX: f(view.maxX), viewMinY: f(view.minY), viewMaxY: f(view.maxY) });
    const radius = binding.chart?.type === 'bubble' && binding.chart.radiusDomain;
    return [summary, ...(radius ? [this.localize('chartSpatialRadiusDomain', undefined, { min: f(radius.min), max: f(radius.max) })] : []), this.localize('chartSpatialDensityLegend')].join(this.localize('chartSummarySeparator'));
  }
  private buildSpatialConfig(): RuntimeChartConfiguration {
    const binding = this.spatial.binding, view = this.spatial.view;
    const series = binding?.chart?.series ?? [], groups = this.spatialSeriesPoints(true), bins = this.spatial.result?.bins ?? [];
    const current = this.spatialGuard(), theme = this.themeColors(), palette = this.seriesPalette();
    const type = binding?.chart?.type ?? 'scatter';
    const color = (index: number) => this.canvasTokens.resolve(series[index]?.color ?? palette[index % palette.length] ?? theme.tick, theme.tick);
    const datasets = series.map((entry, index) => ({ label: entry.label, borderColor: color(index), backgroundColor: color(index),
      borderWidth: groups[index]!.map(point => point.id === this.selectedPointId ? 3 : 1),
      data: groups[index]!.map(point => ({ x: spatialCoordinate(point.x, view!.minX, view!.maxX), y: spatialCoordinate(point.y, view!.minY, view!.maxY),
        ...(type === 'bubble' ? { r: spatialPaintRadius(point.radius!, this.canvasEl?.clientWidth ?? 0, this.canvasEl?.clientHeight ?? 0) } : {}) })),
    }));
    const toPixel = (chart: RuntimeChart, x: number, y: number) => {
      const area = chart.chartArea!;
      const normalizedX = spatialCoordinate(x, view!.minX, view!.maxX);
      return { x: area.left + (this.effectiveDirection === 'rtl' ? 1 - normalizedX : normalizedX) * area.width,
        y: area.bottom - spatialCoordinate(y, view!.minY, view!.maxY) * area.height };
    };
    const density = {
      id: 'lyra-spatial-density',
      beforeDatasetsUpdate: (chart: RuntimeChart) => {
        if (!current() || type !== 'bubble' || !chart.chartArea) return;
        chart.data.datasets.forEach((dataset, index) => dataset.data?.forEach((raw, pointIndex) => {
          const point = groups[index]?.[pointIndex];
          if (point && raw && typeof raw === 'object') Reflect.set(raw, 'r', spatialPaintRadius(point.radius!, chart.chartArea!.width, chart.chartArea!.height));
        }));
      },
      beforeDatasetsDraw: (chart: RuntimeChart & { ctx: CanvasRenderingContext2D }) => {
        if (!current() || !view || !chart.chartArea) return;
        const context = chart.ctx, area = chart.chartArea;
        context.save(); context.beginPath(); context.rect(area.left, area.top, area.width, area.height); context.clip();
        context.fillStyle = color(0); context.strokeStyle = color(0);
        for (const bin of bins) {
          const a = toPixel(chart, bin.bounds.minX, bin.bounds.maxY), b = toPixel(chart, bin.bounds.maxX, bin.bounds.minY);
          context.globalAlpha = 0.15 + 0.65 * bin.count / Math.max(1, this.spatial.result!.matchedCount);
          if (a.x === b.x && a.y === b.y) context.fillRect(a.x - 0.5, a.y - 0.5, 1, 1);
          else if (a.x === b.x || a.y === b.y) { context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.stroke(); }
          else context.fillRect(Math.min(a.x, b.x), a.y, Math.abs(b.x - a.x), b.y - a.y);
        }
        context.restore();
      },
    };
    const pointFor = (context: { datasetIndex?: number; dataIndex?: number }) => {
      if (!current() || !Number.isSafeInteger(context.datasetIndex) || !Number.isSafeInteger(context.dataIndex)) return undefined;
      const point = groups[context.datasetIndex!]?.[context.dataIndex!];
      return current() && point && this.spatialPoints().includes(point) ? point : undefined;
    };
    const axis = (name: 'x' | 'y') => {
      const min = name === 'x' ? view?.minX : view?.minY, max = name === 'x' ? view?.maxX : view?.maxY;
      return { type: 'linear', min: 0, max: 1, reverse: name === 'x' && this.effectiveDirection === 'rtl',
        title: { display: !!(name === 'x' ? this.xLabel : this.yLabel), text: name === 'x' ? this.xLabel : this.yLabel, color: theme.tick },
        ...(min === max ? { afterBuildTicks: (scale: { ticks: { value: number }[] }) => { scale.ticks = [{ value: 0.5 }]; } } : {}),
        ticks: { color: theme.tick, callback: (value: number) => {
          if (!current() || min === undefined || max === undefined || value < 0 || value > 1) return '';
          const original = spatialOriginal(value, min, max), formatted = this.formatValue(original, 'tick', { axis: name });
          return typeof formatted === 'string' ? formatted : this.formatSummaryValue(original);
        } },
      };
    };
    const generated: RuntimeChartConfiguration = { type, data: { labels: [], datasets }, plugins: [density, ...this.plugins], options: {
      responsive: true, maintainAspectRatio: false, animation: this.withoutAnimation || prefersReducedMotion(this) ? false : undefined,
      locale: this.effectiveLocale, indexAxis: 'x', parsing: false, scales: { x: axis('x'), y: axis('y') },
      onResize: (chart: RuntimeChart) => { if (current()) this.updateChartArea(chart); },
      onClick: (event: { native?: Event; x?: number; y?: number }, _hits: unknown, chart: RuntimeChart) => {
        if (!current() || !view) return;
        const hits = chart.getElementsAtEventForMode(event.native ?? event as unknown as Event, 'nearest', { intersect: true }, true);
        const hit = hits[0], point = hit && groups[hit.datasetIndex]?.[hit.index];
        if (point && !this.canonicalHiddenDatasets()?.includes(hit!.datasetIndex)) { this.activateSpatialPoint(point); return; }
        if (!chart.chartArea || typeof event.x !== 'number' || typeof event.y !== 'number') return;
        const bin = bins.find(bin => { const a = toPixel(chart, bin.bounds.minX, bin.bounds.maxY), b = toPixel(chart, bin.bounds.maxX, bin.bounds.minY);
          return event.x! >= Math.min(a.x, b.x) - (a.x === b.x ? 2 : 0) && event.x! <= Math.max(a.x, b.x) + (a.x === b.x ? 2 : 0) && event.y! >= a.y - (a.y === b.y ? 2 : 0) && event.y! <= b.y + (a.y === b.y ? 2 : 0); });
        if (bin) this.activateSpatialBin(bin);
      },
      plugins: { legend: { display: false }, tooltip: { enabled: !this.withoutTooltip, backgroundColor: theme.tooltipBg, titleColor: theme.tooltipText, bodyColor: theme.tooltipText,
        callbacks: { title: (contexts: { datasetIndex?: number; dataIndex?: number }[]) => {
          const point = contexts[0] && pointFor(contexts[0]);
          if (!point) return '';
          const metadata: LyraChartFormatterContext = { value: point.y, surface: 'tooltip', datasetIndex: contexts[0]!.datasetIndex, index: point.sourceIndex, label: point.label, seriesLabel: series[contexts[0]!.datasetIndex!]!.label, axis: 'y' };
          return this.tooltipTitleFormatter?.([metadata]) ?? point.label ?? point.id;
        },
          footer: (contexts: { datasetIndex?: number; dataIndex?: number }[]) => {
            const point = contexts[0] && pointFor(contexts[0]);
            return point ? this.tooltipFooterFormatter?.([{ value: point.y, surface: 'tooltip', datasetIndex: contexts[0]!.datasetIndex, index: point.sourceIndex, label: point.label, seriesLabel: series[contexts[0]!.datasetIndex!]!.label, axis: 'y' }]) ?? '' : '';
          },
          label: (context: { datasetIndex?: number; dataIndex?: number }) => {
            const point = pointFor(context); if (!point) return '';
            const datasetIndex = context.datasetIndex!;
            const metadata = { datasetIndex, index: point.sourceIndex, label: point.label, seriesLabel: series[datasetIndex]!.label, axis: 'y' as const };
            return this.formatter?.({ value: point.y, surface: 'tooltip', ...metadata }) ?? this.valueFormatter?.(point.y, 'tooltip') ?? this.spatialPointText(point);
          } } },
        zoom: this.zoomable && this.zoomFeatureState !== 'unavailable' ? { pan: { enabled: false }, zoom: { wheel: { enabled: true }, drag: { enabled: true }, pinch: { enabled: true }, mode: 'x',
          onZoomComplete: ({ chart }: { chart: RuntimeChart & { scales: { x: { min: number; max: number } } } }) => {
            if (!current() || !view || this.suppressZoomComplete || view.minX === view.maxX) return;
            const lo = Math.max(0, chart.scales.x.min), hi = Math.min(1, chart.scales.x.max); if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo >= hi) return;
            this.viewport = Object.freeze({ ...view, minX: spatialOriginal(lo, view.minX, view.maxX), maxX: spatialOriginal(hi, view.minX, view.maxX) });
            this.zoomed = true; this.emit('lr-zoom', { zoomed: true });
          } }, limits: { x: { min: 0, max: 1 } } } : undefined,
        datalabels: { display: false },
      },
    } };
    const config = this.effectiveConfig();
    if (!config) return generated;
    const merged = deepMerge(generated, config);
    merged.type = generated.type; merged.data = generated.data; merged.plugins = [...(merged.plugins ?? []).filter(plugin => plugin.id !== density.id), density];
    merged.options = { ...merged.options, scales: generated.options['scales'], indexAxis: 'x', parsing: false, onClick: generated.options['onClick'], onResize: generated.options['onResize'],
      plugins: generated.options['plugins'] };
    return merged;
  }

  private buildConfig(): RuntimeChartConfiguration {
    if (this.spatialActive) return this.buildSpatialConfig();
    this.forcedColorPatterns = new Map();
    const theme = this.themeColors();
    // Resolve the effective type up front: `config.type` (if set) overrides
    // the attribute `type` post-merge, so scales/interaction must be built
    // for *that* type, not `this.type` — otherwise a config.type override
    // (e.g. line -> radar) ships with the wrong axis shape (categorical x/y
    // instead of a radial r scale).
    const effectiveType = this.effectiveType();
    let tooltipIndexAxis = this.effectiveIndexAxis();
    const palette = this.seriesPalette();
    const chartStyle = this.chartStyleOptions(palette);
    const rawDataEscapeHatch = this.hasExplicitConfigData();
    // Matches the condition the tooltip `label` callback has always been gated on -- the
    // pie/doughnut default only kicks in without an explicit raw `config.data` escape hatch.
    const wantsTooltipLabelCallback =
      !!(this.formatter || this.valueFormatter) ||
      ((effectiveType === 'pie' || effectiveType === 'doughnut') && !rawDataEscapeHatch);
    const prepared = this.preparedModel;
    const labels = prepared ? this.effectiveData().labels : this.canonicalLabels();
    const inputSeries: readonly LyraChartSeries[] = prepared ? prepared.series.map(series => ({ label: series.label, data: series.values })) : this.datasets;
    let visualRows: readonly number[] | undefined;
    let visualSeries: readonly number[] | undefined;
    const sample = this.dataTableSample();
    visualRows = !prepared && sample.rowIndexes.length < sample.rowCount ? sample.rowIndexes : undefined;
    visualSeries = !prepared && sample.seriesIndexes.length < sample.seriesCount ? sample.seriesIndexes : undefined;
    this.visualRowSourceIndexes = visualRows;
    this.visualDatasetSourceIndexes = visualSeries;
    const generated: RuntimeChartConfiguration = {
      type: effectiveType,
      data: {
        labels: !rawDataEscapeHatch && visualRows ? visualRows.map((index) => labels[index] ?? '') : [...labels],
        datasets: !rawDataEscapeHatch && visualSeries
          ? visualSeries.map((sourceIndex) =>
              this.seriesToDataset(
                inputSeries[sourceIndex]!,
                sourceIndex,
                palette,
                effectiveType,
                chartStyle,
                visualRows
              )
            )
          : inputSeries.map((s, i) =>
              this.seriesToDataset(s, i, palette, effectiveType, chartStyle, rawDataEscapeHatch ? undefined : visualRows)
            ),
      },
      // `chartjs-plugin-datalabels` is registered PER-INSTANCE (only on charts
      // that need it) rather than globally, because a global registration draws
      // on — and breaks the next update of — every other chart on the page.
      // Only added when the peer has actually loaded and the feature is on.
      ...(this.plugins.length || (this.needsDataLabels && this.dataLabelsPlugin)
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
        ...(this.compactPlot && !['pie', 'doughnut', 'radar', 'polarArea'].includes(effectiveType)
          ? { layout: { padding: 0, autoPadding: false } } : {}),
        // Chart.js's own mechanism for horizontal bars (also flips line/area
        // types onto a horizontal category axis).
        indexAxis: this.effectiveIndexAxis(),
        // Chart.js's own default ~1000ms draw-in animation only ever fires
        // from `new Chart()` (chart/type-change construction) — every
        // in-place update in `draw()` already passes `'none'` to
        // `Chart#update()`. A CSS media query can't reach that
        // canvas-internal animation loop, so `prefersReducedMotion()` is
        // checked here instead and fed into `options.animation`.
        animation: this.withoutAnimation || prefersReducedMotion(this) ? false : undefined,
        interaction: { intersect: false, mode: effectiveType === 'scatter' ? 'nearest' : 'index', },
        onClick: (event: unknown, _elements: unknown, chart: RuntimeChart) => {
          if (prepared !== this.preparedModel) return;
          this.handlePointClick(event, chart);
        },
        plugins: {
          // Only emitted when there is something to draw AND the peer actually loaded, so a chart
          // without annotations carries no annotation options at all.
          ...(this.needsAnnotations && this.annotationPlugin
            ? { annotation: { annotations: this.annotationOptions(theme.tick) } }
            : {}),
          legend: {
            // A canvas legend cannot wrap one long public label; the DOM legend rendered below
            // preserves the full text, normal-flow containment, keyboard access, and toggling.
            display: false,
            position: this.legendPositionForConfig(),
            labels: {
              color: theme.legend,
              ...(this.formatter || this.valueFormatter
                ? { generateLabels: (chart: RuntimeChart) => this.legendLabels(chart), }
                : {}),
            },
          },
          tooltip: {
            enabled: !this.withoutTooltip,
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            ...(wantsTooltipLabelCallback || this.tooltipTitleFormatter || this.tooltipFooterFormatter
              ? {
                  callbacks: {
                    ...(wantsTooltipLabelCallback
                      ? {
                          label: (context: ChartTooltipContext) =>
                            this.tooltipLabel(context, tooltipIndexAxis === 'y'),
                        }
                      : {}),
                    ...(this.tooltipTitleFormatter
                      ? {
                          title: (items: ChartTooltipContext[]) =>
                            this.tooltipGroupText(items, tooltipIndexAxis === 'y', this.tooltipTitleFormatter),
                        }
                      : {}),
                    ...(this.tooltipFooterFormatter
                      ? {
                          footer: (items: ChartTooltipContext[]) =>
                            this.tooltipGroupText(items, tooltipIndexAxis === 'y', this.tooltipFooterFormatter),
                        }
                      : {}),
                  },
                }
              : {}),
            // Chart.js's tooltip plugin has no per-dataset `tooltip.enabled`
            // — `LyraChartSeries.noTooltip` is implemented here instead, via the one
            // mechanism the core tooltip plugin actually reads.
            filter: (item: ChartTooltipContext) => {
              const effective = this.effectiveData();
              const datasetIndex = this.callbackDatasetIndex(item, effective);
              if (datasetIndex === undefined) return false;
              const sourceDatasetIndex =
                this.visualDatasetSourceIndexes?.[datasetIndex] ??
                datasetIndex;
              return chartDatasetBoolean(
                effective.datasets[sourceDatasetIndex],
                'noTooltip',
              ) !== true;
            },
          },
          zoom: this.zoomable && this.zoomFeatureState !== 'unavailable'
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

    if (prepared) {
      const effective = this.effectiveData();
      generated.data.labels = [...effective.labels];
      generated.data.datasets.forEach((dataset, index) => {
        const values = this.datasetValues(effective.datasets[index]!);
        dataset.data = values.map((value, row) => value ?? { x: prepared.series[index]!.samples[row + 1]?.x ?? 0, y: null });
        if (prepared.kind === 'series') Reflect.set(dataset, 'spanGaps', false);
      });
    }
    const effectiveConfig = this.effectiveConfig();
    if (!effectiveConfig) return generated;

    // Raw Chart.js passthrough (mirrors `wa-chart`'s `config` property) —
    // deep-merge `config` over the `LyraChartSeries`-derived config at every nesting
    // level (see `deepMerge` above), letting consumers override or extend a
    // single nested key (e.g. `config.options.scales.y.min`) without
    // clobbering the rest of the generated sibling object.
    const merged = deepMerge(generated, effectiveConfig);
    if (rawDataEscapeHatch && (visualRows || visualSeries)) {
      const sourceDatasets = merged.data.datasets;
      const sourceLabels = merged.data.labels;
      merged.data = {
        ...merged.data,
        labels: visualRows ? visualRows.map(index => sourceLabels[index] ?? '') : sourceLabels,
        datasets: (visualSeries ?? sourceDatasets.map((_dataset, index) => index)).map(index => {
          const dataset = sourceDatasets[index]!;
          const values = chartDatasetPeerValues(dataset);
          const sampled = { ...dataset, data: visualRows ? visualRows.map(row => values[row] ?? null) : [...values] };
          if (visualRows) {
            const controller = chartDatasetValue(dataset, 'type') ?? merged.type;
            const doughnut = controller === 'doughnut' || controller === 'pie';
            for (const key of [
              'backgroundColor', 'borderColor', 'borderWidth', 'hoverBackgroundColor', 'hoverBorderColor', 'hoverBorderWidth',
              'pointBackgroundColor', 'pointBorderColor', 'pointBorderWidth', 'pointHitRadius', 'pointRadius', 'pointRotation', 'pointStyle',
              'pointHoverBackgroundColor', 'pointHoverBorderColor', 'pointHoverBorderWidth', 'pointHoverRadius',
              'radius', 'hitRadius', 'rotation', 'hoverRadius', 'drawActiveElementsOnTop',
              'base', 'borderSkipped', 'borderRadius', 'hoverBorderRadius', 'inflateAmount',
              'selfJoin', 'borderAlign', 'borderDashOffset', 'borderJoinStyle', 'offset', 'circular', 'spacing',
              'hoverBorderDashOffset', 'hoverOffset', 'borderCapStyle', 'hoverBorderCapStyle', 'hoverBorderJoinStyle',
            ]) {
              if (doughnut && (key === 'spacing' || key.startsWith('borderDash') || key.startsWith('hoverBorderDash'))) continue;
              const source = chartDatasetValue(dataset, key);
              if (Array.isArray(source) && source.length) Reflect.set(sampled, key, visualRows.map(row => source[row % source.length]));
            }
          }
          return sampled;
        }),
      };
    }
    tooltipIndexAxis = merged.options['indexAxis'] === 'y' ? 'y' : 'x';
    // `deepMerge` replaces arrays wholesale, so a consumer `config.plugins`
    // would drop the per-instance data-labels plugin the generated config added
    // (silently disabling `data-labels`/`stack-totals`). Concatenate it back —
    // the consumer's inline plugins AND the built-in data-labels plugin both run.
    const requiredPlugins = [
      ...this.plugins,
      ...(this.needsDataLabels && this.dataLabelsPlugin ? [this.dataLabelsPlugin] : []),
    ];
    const mergedPluginAdmission = admitChartArray(merged.plugins);
    const mergedPlugins = projectChartPlugins(merged.plugins, mergedPluginAdmission);
    if (mergedPluginAdmission || requiredPlugins.length) {
      merged.plugins = [
        ...mergedPlugins,
        ...requiredPlugins.filter((plugin) => !mergedPlugins.includes(plugin)),
      ];
    } else if (merged.plugins !== undefined) {
      // A non-array raw plugins value cannot be safely iterated or handed to the peer.
      merged.plugins = [];
    }
    return merged;
  }

  /** Keep proportional slice geometry finite while every Lyra readout retains source values. */
  private scaleExtremeSlices(config: RuntimeChartConfiguration): void {
    this.scaledSliceDatasets.clear();
    if ((config.type !== 'pie' && config.type !== 'doughnut') || this.hasExplicitConfigData()) return;
    for (const [index, dataset] of config.data.datasets.entries()) {
      const source = this.datasetValues(dataset);
      const maximum = source.reduce<number>((largest, value) => {
        const number = chartDatumNumericValue(value);
        return number === undefined ? largest : Math.max(largest, Math.abs(number));
      }, 0);
      // Chart.js multiplies a slice value by the sweep before dividing by its total. Uniform
      // scaling avoids intermediate overflow and unbounded native arc loops at extreme magnitudes.
      if (maximum <= Number.MAX_SAFE_INTEGER) continue;
      dataset.data = source.map((value) => {
        const number = chartDatumNumericValue(value);
        return number === undefined ? value : number / maximum;
      });
      this.scaledSliceDatasets.add(index);
    }
  }

  private draw(): void {
    if (this.preparedInvalid || this.spatialActive && this.spatial.error) { this.discardChart(false); return; }
    if (this.spatialActive && this.spatial.loading && this.chart) return;
    if (!this.chartJsModule || !this.canvasEl) return;
    if (!this.chart && !this.canvasEl.getContext('2d')) {
      this.setCanvasUnavailable(true);
      return;
    }
    this.canvasTokens.beginThemeDraw();
    const config = this.buildConfig();
    this.scaleExtremeSlices(config);
    const effectiveType = config.type;
    const nextPlugins = projectChartPlugins(config.plugins);
    const samePlugins =
      nextPlugins.length === this.builtPlugins.length &&
      nextPlugins.every((plugin, index) => plugin === this.builtPlugins[index]);
    if (this.chart && this.builtType === effectiveType && samePlugins) {
      const zoomedBounds = this.zoomed ? this.chart.getZoomedScaleBounds?.() : undefined;
      this.chart.data = config.data;
      this.chart.options = config.options ?? {};
      // Visibility is public controlled state rather than a private Chart.js metadata snapshot.
      // Applying it after the full data replacement preserves an accepted legend choice across
      // rebuilds, while `undefined` deliberately clears metadata and resumes each dataset's own
      // configured `hidden` default.
      this.applyDatasetVisibility();
      this.chart.update('none');
      this.restoreZoomedBounds(this.chart, zoomedBounds);
      if (this.applyDatumVisibility()) this.chart.update('none');
      this.updateChartArea(this.chart);
      this.chartSync.update(this.syncGroup, typeof this.syncGroup === 'string' && this.syncGroup.trim() !== '' && this.syncCompatible());
      this.canvasTokens.rememberTheme();
      return;
    }
    this.discardChart(!this.spatialActive, this.spatialActive && this.viewport !== null);
    const candidate = new this.chartJsModule.Chart(
      this.canvasEl,
      { ...config, plugins: [...nextPlugins, this.chartAreaPlugin] } as never
    ) as unknown as RuntimeChart;
    const context = candidate as unknown as {
      canvas?: HTMLCanvasElement | null;
      ctx?: CanvasRenderingContext2D | null;
    };
    if (context.canvas === null || context.ctx === null) {
      candidate.destroy();
      this.setCanvasUnavailable(true);
      return;
    }
    this.chart = candidate;
    this.setCanvasUnavailable(false);
    this.builtType = effectiveType;
    this.builtPlugins = [...nextPlugins];
    // A new Chart already reads configured `dataset.hidden` values. Apply and redraw only when a
    // public controlled snapshot is present; this also avoids a redundant first update for the
    // ordinary uncontrolled construction path.
    const datasetsControlled = this.canonicalHiddenDatasets() !== undefined;
    if (datasetsControlled) this.applyDatasetVisibility();
    if (this.applyDatumVisibility() || datasetsControlled) {
      this.chart.update('none');
    }
    this.updateChartArea(this.chart);
    this.chartSync.update(this.syncGroup, typeof this.syncGroup === 'string' && this.syncGroup.trim() !== '' && this.syncCompatible());
    this.canvasTokens.rememberTheme();
  }

  private setCanvasUnavailable(unavailable: boolean): void {
    if (this.canvasUnavailable === unavailable) return;
    this.canvasUnavailable = unavailable;
    // Drawing can run from updated(); render the fallback after that update has settled.
    queueMicrotask(() => {
      if (this.isConnected) this.requestUpdate('canvasPresentation', null);
    });
    if (unavailable) this.announcements.announceAssertive(this.localize('chartRenderUnavailable'));
  }

  private drawIfVisible(): void {
    if (!this.isConnected || !this.visible) return;
    this.draw();
  }

  /** Re-applies the range the user zoomed or panned to, which a swap of the options object drops. */
  private restoreZoomedBounds(
    chart: RuntimeChart,
    bounds: Record<string, { min: number; max: number } | undefined> | undefined
  ): void {
    if (this.spatialActive || !bounds || typeof chart.zoomScale !== 'function') return;
    for (const [id, range] of Object.entries(bounds)) {
      if (range && Number.isFinite(range.min) && Number.isFinite(range.max)) {
        chart.zoomScale(id, { min: range.min, max: range.max }, 'none');
      }
    }
  }

  /** Destroys the peer instance and reconciles the Lyra-owned zoom state in one place. */
  private discardChart(announceZoomReset: boolean, preserveZoom = false): void {
    this.appliedLegendVisibility = undefined;
    this.chartSync.disconnect();
    this.chart?.destroy();
    this.chart = undefined;
    this.resolvedChartArea = undefined;
    if (preserveZoom || !this.zoomed) return;
    this.zoomed = false;
    if (announceZoomReset) this.emit('lr-zoom', { zoomed: false });
  }

  /**
   * Renders or incrementally updates the current Chart.js instance from the effective public
   * properties/config. Offscreen/disconnected charts remain gated until visible/reconnected.
   */
  renderChart(): void {
    this.drawIfVisible();
  }

  /** Reset any active zoom/pan back to the original view. */
  resetZoom(): void {
    if (this.spatialActive) this.viewport = null;
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
    this.canvasTokens.clear();
    this.drawIfVisible();
    // The wrapping DOM legend carries a concrete, computed swatch color too; refresh its
    // template without turning the resulting empty-property update into another canvas draw.
    if (this.showsLegend) this.requestUpdate('canvasPresentation', null);
  }

  private readonly seriesSummaryMemo = new WeakMap<LyraChartDatasetConfiguration, ReturnType<LyraChart['summarizeSeriesValues']>>();

  private summarizeSeries(dataset: LyraChartDatasetConfiguration) {
    if (this.seriesSummaryMemo.has(dataset)) return this.seriesSummaryMemo.get(dataset);
    const value = this.summarizeSeriesValues(dataset);
    this.seriesSummaryMemo.set(dataset, value);
    return value;
  }

  /** Aggregates a numeric series without materializing a second unbounded values array. */
  private summarizeSeriesValues(
    dataset: LyraChartDatasetConfiguration,
  ):
    | {
        count: number;
        first: number;
        last: number;
        min: number;
        minIndex: number;
        max: number;
        maxIndex: number;
      }
    | undefined {
    let count = 0;
    let first = 0;
    let last = 0;
    let min = 0;
    let minIndex = 0;
    let max = 0;
    let maxIndex = 0;
    for (const [index, datum] of this.datasetValues(dataset).entries()) {
      const value = chartDatumNumericValue(datum);
      if (value === undefined) continue;
      if (count === 0) {
        first = value;
        min = value;
        minIndex = index;
        max = value;
        maxIndex = index;
      }
      last = value;
      if (value < min) {
        min = value;
        minIndex = index;
      }
      if (value > max) {
        max = value;
        maxIndex = index;
      }
      count++;
    }
    return count ? { count, first, last, min, minIndex, max, maxIndex } : undefined;
  }

  private formatSummaryValue(value: number): string {
    return formatChartValue(value, this.effectiveLocale);
  }

  private formatTableValue(
    value: number,
    metadata: LyraChartFormatterMetadata = {},
  ): string {
    return (
      this.formatter?.({ value, surface: 'table', ...metadata }) ??
      this.valueFormatter?.(value, 'table') ??
      this.formatSummaryValue(value)
    );
  }

  /**
   * The `'export'` surface, for CSV cells. `LyraChartFormatSurface` has always declared it and
   * `<lr-lite-chart>` has always emitted it, but this component never did -- so one formatter
   * written against the documented contract behaved differently depending on which chart rendered
   * it, silently, in exactly the place unit formatting matters most.
   *
   * Deliberately NOT falling back to `formatSummaryValue()`: with no formatter installed a CSV cell
   * must stay the raw machine-readable number, not a locale-grouped string a spreadsheet would
   * misparse. `undefined` means "leave the cell as it was".
   */
  private formatExportValue(
    value: number,
    metadata: LyraChartFormatterMetadata = {},
  ): string | undefined {
    return this.formatter?.({ value, surface: 'export', ...metadata }) ??
      this.valueFormatter?.(value, 'table');
  }

  /** The `'spoken'` surface, for the live announcement a keyboard user hears. Falls back to the
   *  legacy `valueFormatter` (mapped to its `'table'` context, matching `formatTableValue()`/
   *  `formatExportValue()`), then the locale number format. */
  private formatSpokenValue(
    value: number,
    metadata: LyraChartFormatterMetadata = {},
  ): string {
    return (
      this.formatter?.({ value, surface: 'spoken', ...metadata }) ??
      this.valueFormatter?.(value, 'table') ??
      this.formatSummaryValue(value)
    );
  }

  private tableStackAxes(): ('y' | 'y2')[] {
    const type = this.effectiveType();
    if (!this.stackTotals || (type !== 'bar' && type !== 'line')) return [];
    const present = new Set<'y' | 'y2'>();
    for (const dataset of this.effectiveData().datasets) {
      const axis = chartDatasetAxis(dataset);
      if (this.axisStacked(axis)) present.add(axis);
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
    return this.getAttribute('aria-label') ?? this.label ?? fallback;
  }

  private descriptionMemo?: { keys: readonly unknown[]; value: string };

  private chartDescription(): string {
    if (this.description) return this.description;
    const effective = this.effectiveData();
    const keys = [effective, this.dataTableSample(effective), this.effectiveLocale, this.strings,
      this.effectiveType(), this.effectiveIndexAxis(), this.effectiveDirection, this.formatter, this.valueFormatter,
      this.annotations, this.hasCustomDataTable()];
    if (this.descriptionMemo?.keys.every((key, index) => key === keys[index])) return this.descriptionMemo.value;
    const value = this.buildChartDescription(effective);
    this.descriptionMemo = { keys, value };
    return value;
  }

  private buildChartDescription(effective: EffectiveChartData): string {
    if (this.spatialActive) return this.spatialDescription();
    if (this.preparedModel) {
      const specialized = this.preparedSummary();
      if (specialized !== undefined) return specialized;
      const model = this.preparedModel;
      const summary = this.localize('chartPreparedSummary', undefined, {
        validCount: this.formatSummaryValue(model.validCount), invalidCount: this.formatSummaryValue(model.invalidCount), displayedCount: this.formatSummaryValue(model.displayedCount),
      });
      const domains = model.series.flatMap((series, index) => {
        const original = this.preparedBaseModel?.series[index] ?? series;
        if (!original.yDomain) return [];
        const first = original.samples[0]?.y ?? 0;
        const last = original.samples.at(-1)?.y ?? 0;
        return [this.localize('chartSummary', undefined, {
          label: original.label, count: this.formatSummaryValue(original.counts.validCount),
          min: this.formatSummaryValue(original.yDomain.min), max: this.formatSummaryValue(original.yDomain.max),
          trend: this.localize(last > first ? 'chartTrendIncreasing' : last < first ? 'chartTrendDecreasing' : 'chartTrendFlat'),
        })];
      });
      return [...domains, summary].join(this.localize('chartSummarySeparator'));
    }
    const sample = this.dataTableSample(effective);
    const includePointDetails = !this.hasCustomDataTable();
    const summaries = sample.seriesIndexes.map((index) => {
      const dataset = effective.datasets[index]!;
      const seriesLabel = this.datasetLabel(dataset, index);
      const values = this.summarizeSeries(dataset);
      if (!values) return this.localize('chartSeriesNoData', undefined, { label: seriesLabel, });
      const trend =
        values.last > values.first
          ? this.localize('chartTrendIncreasing')
          : values.last < values.first
            ? this.localize('chartTrendDecreasing')
            : this.localize('chartTrendFlat');
      const rawValues = this.datasetValues(dataset);
      const datumLabelAt = (rowIndex: number): string | undefined => {
        const datum = rawValues[rowIndex];
        return normalizedChartPoint(datum)?.label ??
          (labelText(effective.labels[rowIndex]) || undefined);
      };
      const summary = this.localize('chartSummary', undefined, {
        label: seriesLabel,
        count: this.formatSummaryValue(values.count),
        min: this.formatSpokenValue(values.min, {
          datasetIndex: index,
          index: values.minIndex,
          label: datumLabelAt(values.minIndex),
          seriesLabel,
          statistic: 'min',
        }),
        max: this.formatSpokenValue(values.max, {
          datasetIndex: index,
          index: values.maxIndex,
          label: datumLabelAt(values.maxIndex),
          seriesLabel,
          statistic: 'max',
        }),
        trend,
      });
      const pointDetails = includePointDetails
        ? sample.rowIndexes.flatMap((rowIndex) => {
            const point = rawValues[rowIndex];
            return normalizedChartPoint(point)
              ? [
                  this.datumDisplayValue(point, {
                    surface: 'spoken',
                    datasetIndex: index,
                    index: rowIndex,
                    label: datumLabelAt(rowIndex),
                    seriesLabel,
                  }),
                ]
              : [];
          })
        : [];
      return pointDetails.length
        ? [summary, ...pointDetails].join(this.localize('chartSummarySeparator'))
        : summary;
    });
    const base = summaries.length
      ? this.localize('chartSummaryWithData', undefined, {
          type: this.localizedChartType(),
          // the sentence separator is a message of its own since not every
          // language delimits sentences with a period-space pair
          summaries: summaries.join(this.localize('chartSummarySeparator')),
        })
      : this.localize('chartSummaryEmpty', undefined, { type: this.localizedChartType(), });
    // Annotations carry meaning a sighted reader gets from the line or band, so they belong in the
    // description too -- the same reasoning behind lr-heatmap's [part="legend-annotation"] entries.
    // Only LABELLED entries are announced: the label is consumer-supplied text (deliberately not
    // routed through localize(), like every other caller-supplied string), while an unlabelled
    // reference line has no nameable meaning to announce beyond a coordinate.
    const annotationLabels = this.normalizedAnnotations()
      .map((entry) => entry.label?.trim())
      .filter((label): label is string => Boolean(label));
    return annotationLabels.length
      ? [base, ...annotationLabels].join(this.localize('chartSummarySeparator'))
      : base;
  }

  private dataTableSample(effective = this.effectiveData()) {
    const maxRecords = normalizeChartRecordLimit(this.maxRecords);
    const width = this.samplingWidth;
    if (this.dataTableSampleMemo?.effective === effective && this.dataTableSampleMemo.maxRecords === maxRecords &&
      this.dataTableSampleMemo.width === width) return this.dataTableSampleMemo.value;
    // Do not spread an unbounded consumer-provided dataset list into Math.max():
    // the accessible alternative itself must remain usable for very wide input.
    let rowCount = effective.labels.length;
    for (const dataset of effective.datasets) {
      rowCount = Math.max(rowCount, this.datasetValues(dataset).length);
    }
    const values = effective.datasets.map(dataset => this.datasetValues(dataset));
    const indexes = this.preparedModel || this.spatialActive ? { rowIndexes: Array.from({ length: rowCount }, (_, index) => index).filter(index => values.some(series => series[index] != null)), seriesIndexes: Array.from({ length: effective.datasets.length }, (_, index) => index) } : sampleChartTableIndexes(rowCount, effective.datasets.length, {
      maxRecords, width,
      valueAt: (row, series) => chartDatumNumericValue(values[series]?.[row]),
    });
    const value = {
      rowCount,
      seriesCount: effective.datasets.length,
      ...indexes,
    };
    this.dataTableSampleMemo = { effective, maxRecords, width, value };
    return value;
  }

  private dataTableSampleMemo?: {
    maxRecords: number;
    width: number;
    effective: EffectiveChartData;
    value: { rowCount: number; seriesCount: number } & ReturnType<typeof sampleChartTableIndexes>;
  };

  private generatedDataIsSampled(): boolean {
    if (this.spatialActive) return false;
    const sample = this.dataTableSample();
    if (sample.rowCount === 0 || sample.seriesCount === 0) return false;
    return ( sample.rowIndexes.length < sample.rowCount || sample.seriesIndexes.length < sample.seriesCount
    );
  }

  protected inputLimitMessage(): string {
    if (this.preparedActive) return '';
    this.canonicalLabels();
    const values = [this.labels, this.datasets, this.config ?? this.slottedConfig];
    return values.some(value => typeof value === 'object' && value !== null && truncatedChartInputs.has(value))
      ? this.localize('chartInputLimit') : '';
  }

  private dataTruncationMessage(): string {
    if (this.preparedModel) return this.zoomable && this.preparedModel.kind === 'series' && !Object.getOwnPropertyDescriptor(this.preparedModel.source, 'queryRange') ? this.localize('chartPreparedSummaryZoom') : '';
    if (!this.generatedDataIsSampled()) return '';
    return this.hasCustomDataTable() ? this.localize('chartPlotSampled') : this.localize('chartDataSampled');
  }

  private renderDataTable(): TemplateResult {
    if (this.spatialActive) return this.renderSpatialTable();
    const effective = this.effectiveData();
    const direction: ChartTextDirection = this.effectiveDirection === 'rtl' ? 'rtl' : 'ltr';
    const sample = this.dataTableSample(effective);
    const stackAxes = this.tableStackAxes();
    return html`
      <table class=${this.dataTableVisible ? nothing : 'sr-only'}>
        <caption>${this.accessibleName(this.localize('chartData'))}</caption>
        <thead>
          <tr>
            <th scope="col">${this.localize('chartCategory')}</th>
            ${sample.seriesIndexes.map((index) => {
              const dataset = effective.datasets[index]!;
              return html`<th scope="col">${isolateHtml(this.datasetLabel(dataset, index), direction)}</th>`;
            })}
            ${stackAxes.map(
              (axis) =>
                html`<th scope="col">${this.tableStackTotalLabel(axis, stackAxes.length)}</th>`
            )}
          </tr>
        </thead>
        <tbody>
          ${this.renderDataTableRows()}
        </tbody>
      </table>
    `;
  }

  private dataTableRows?: TemplateResult[];
  private deferredTableRows?: TemplateResult[];
  private cancelDeferredTable?: () => void;

  private streamingTableUpdate = false;

  /** Keep only stream-originated invalidations inside a coalesced table refresh. */
  protected withStreamedTableUpdate(update: () => void): void {
    this.deferStreamedTable();
    this.streamingTableUpdate = true;
    try { update(); } finally { this.streamingTableUpdate = false; }
  }

  private clearDeferredTable(): void {
    this.cancelDeferredTable?.();
    this.cancelDeferredTable = undefined;
    this.deferredTableRows = undefined;
  }

  /** Coalesce streamed hidden-table formatting until the browser has an idle opportunity. */
  private deferStreamedTable(): void {
    if (this.dataTableVisible || this.canvasUnavailable) { this.clearDeferredTable(); return; }
    const view = this.ownerWindow as (Window & {
      requestIdleCallback?: (callback: () => void, options: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    }) | undefined;
    if (!this.isConnected || !view || this.dataTableVisible || this.cancelDeferredTable || !this.dataTableRows) return;
    this.deferredTableRows = this.dataTableRows;
    const rows = this.deferredTableRows;
    const refresh = () => {
      if (this.deferredTableRows !== rows) return;
      this.cancelDeferredTable = undefined;
      this.deferredTableRows = undefined;
      this.dataTableRows = undefined;
      if (this.isConnected) this.requestUpdate('dataTableIdleRefresh', null);
    };
    if (view.requestIdleCallback && view.cancelIdleCallback) {
      const handle = view.requestIdleCallback(refresh, { timeout: 250 });
      this.cancelDeferredTable = () => view.cancelIdleCallback?.(handle);
    } else {
      const handle = view.setTimeout(refresh, 0);
      this.cancelDeferredTable = () => view.clearTimeout(handle);
    }
  }

  override requestUpdate(...args: Parameters<LyraElement['requestUpdate']>): void {
    const key = args[0];
    if (key === undefined || ['preparedData', 'maxRecords', 'type', 'config', 'slottedConfig', 'scaleType'].includes(String(key))) {
      this.preparedGeneration = {};
      this.spatialRevealToken = {}; this.spatial?.reset(); this.wakeSpatialWaiters();
      this.preparedDirty = true;
      this.preparedRequests?.refresh();
      this.descriptionMemo = undefined;
    }
    if (this.spatialActive && this.spatial) {
      if (key === 'viewport') this.spatial.configure(this.viewport, normalizeChartRecordLimit(this.maxRecords));
      if (key === 'selectedPointId') this.spatial.setSelected(this.selectedPointId);
    }
    if (key === undefined) this.descriptionMemo = undefined;
    if (key === undefined || ['preparedData', 'preparedView', 'spatialView', 'viewport', 'selectedPointId', 'datasets', 'labels', 'values', 'bins', 'seriesLabel', 'config', 'slottedConfig',
      'type', 'indexAxis', 'formatter', 'valueFormatter', 'locale', 'strings', 'stacked', 'stackedAxes', 'stackTotals',
      'xLabel', 'yLabel', 'y2Label', 'withDataTable', 'dataTableToggle', 'dataTableExpandedOverride',
      'maxRecords', 'samplingWidth', 'canvasUnavailable'].includes(String(key))) {
      this.dataTableRows = undefined;
      if (!this.streamingTableUpdate || this.dataTableVisible || this.canvasUnavailable) this.clearDeferredTable();
    }
    super.requestUpdate(...args);
  }

  private renderDataTableRows(): TemplateResult[] {
    if (!this.dataTableVisible && !this.canvasUnavailable && this.deferredTableRows) return this.deferredTableRows;
    if (this.dataTableRows) return this.dataTableRows;
    const effective = this.effectiveData();
    const direction: ChartTextDirection = this.effectiveDirection === 'rtl' ? 'rtl' : 'ltr';
    const sample = this.dataTableSample(effective);
    const valuesBySeries = new Map(sample.seriesIndexes.map((index) =>
      [index, this.datasetValues(effective.datasets[index]!)] as const,
    ));
    const stackAxes = this.tableStackAxes();
    const stackTotals = new Map(stackAxes.map((axis) => [axis, this.computeStackTotals(axis)]));
    // A stack total sits on the same scale as the datasets it sums, so a dual-axis formatter picks
    // the right unit for the total column as well as for the cells. Resolved from a dataset on that
    // stack rather than from the axis id, because a horizontal bar/line plots its values on `x`.
    const stackValueAxes = new Map(stackAxes.map((axis) => [
      axis,
      this.datasetValueAxis(
        effective.datasets.find((dataset) => chartDatasetAxis(dataset) === axis),
      ),
    ]));
    return this.dataTableRows = sample.rowIndexes.map(
      (index) => html`
      <tr>
        <th scope="row">${isolateHtml(labelText(effective.labels[index]) ||
          sample.seriesIndexes
            .map((datasetIndex) =>
              normalizedChartPoint(valuesBySeries.get(datasetIndex)![index]),
            )
            .find((point): point is LyraChartPoint => point !== null)?.label ||
          this.localize('chartPointLabel', undefined, {
            n: this.formatSummaryValue(index + 1),
          }), direction)}</th>
        ${sample.seriesIndexes.map((datasetIndex) => {
          const dataset = effective.datasets[datasetIndex]!;
          const datum = valuesBySeries.get(datasetIndex)![index];
          const point = normalizedChartPoint(datum);
          const value = point?.y ?? chartDatumNumericValue(datum);
          if (value === undefined) {
            return html`<td>${this.localize('noData')}</td>`;
          }
          const detail: ChartDatum = {
            datasetIndex,
            index,
            label: point?.label ?? (labelText(effective.labels[index]) || undefined),
            value: datum,
          };
          const axis = this.datasetValueAxis(dataset);
          const metadata: LyraChartFormatterMetadata = {
            datasetIndex,
            index,
            label: detail.label,
            seriesLabel: this.datasetLabel(dataset, datasetIndex),
            ...(axis === undefined ? {} : { axis }),
          };
          return html`<td><button
            type="button"
            tabindex=${this.dataTableVisible ? '0' : '-1'}
            @click=${() => this.activateDatum(detail)}
          >${isolateHtml(point
            ? this.datumDisplayValue(datum, {
                surface: 'table',
                ...metadata,
              })
            : this.formatTableValue(value, metadata), direction)}</button></td>`;
        })}
        ${stackAxes.map((axis) => {
          const total = stackTotals.get(axis)?.[index];
          return html`<td>${isolateHtml(total == null
            ? this.localize('noData')
            : this.formatTableValue(total, this.stackTotalMetadata({
                index,
                label: labelText(effective.labels[index]) || undefined,
                axis: stackValueAxes.get(axis),
              })), direction)}</td>`;
        })}
      </tr>
      `
    );
  }

  private hasCustomDataTable(): boolean {
    return hasSlottedChartDataTable(this);
  }

  /** One DOM legend entry's text: the bare label, or a localized sentence with its values. */
  private legendMessage(
    label: string,
    value: number | undefined,
    percentage: number,
    metadata: LyraChartFormatterMetadata = {},
  ): string | IsolatableMessage {
    if (this.legendDisplay === 'label' || value === undefined) return label;
    // percentage rides along on every formatted branch (value, percentage, value-percentage) so a
    // formatter/valueFormatter watching surface: 'legend' can read the share this method already
    // computed instead of recomputing it from raw data.
    const enriched: LyraChartFormatterMetadata = { ...metadata, percentage };
    if (this.legendDisplay === 'value-percentage') {
      const formatted = this.formatValue(value, 'legend', enriched);
      const percentageText =
        getNumberFormat(this.effectiveLocale, { style: 'percent', maximumFractionDigits: 1 }).format(percentage);
      // `value` is defined here and `formatValue()` falls back to it, so `formatted` is never undefined.
      return {
        format: (values) => this.localize('chartValuePercentageLabel', undefined, values),
        values: {
          label,
          value: typeof formatted === 'number' ? this.formatSummaryValue(formatted) : String(formatted),
          percentage: percentageText,
        },
        isolated: ['label', 'value', 'percentage'],
      };
    }
    const explicit = this.legendDisplay === 'value' || this.legendDisplay === 'percentage';
    const formatted = this.legendDisplay === 'percentage'
      ? getNumberFormat(this.effectiveLocale, { style: 'percent', maximumFractionDigits: 1 }).format(percentage)
      : this.formatValue(value, 'legend', enriched);
    return (!explicit && formatted === value) || formatted === undefined
      ? label
      : {
          format: (values) => this.localize('chartValueLabel', undefined, values),
          values: {
            label,
            value: typeof formatted === 'number' ? this.formatSummaryValue(formatted) : String(formatted),
          },
          isolated: ['label', 'value'],
        };
  }

  /** The rendered legend text: the localized sentence with the label and each formatted value
   *  isolated in its own `<span class="bidi">`, so a number-first value keeps its order under RTL while the
   *  sentence keeps the translation's direction. The accessible text carries no control
   *  characters. */
  private legendTextContent(
    label: string,
    value: number | undefined,
    percentage: number,
    metadata: LyraChartFormatterMetadata = {},
  ): string | TemplateResult {
    const message = this.legendMessage(label, value, percentage, metadata);
    return typeof message === 'string'
      ? message
      : isolatedMessage(message.format, message.values, message.isolated);
  }

  private legendColor(
    dataset: LyraChartDatasetConfiguration,
    datasetIndex: number,
    palette: string[] = this.seriesPalette(),
    datumIndex?: number,
    colorCache: Map<string, Map<string, string>> = new Map(),
  ): string {
    const fallback = palette[(datumIndex ?? datasetIndex) % palette.length] ?? 'transparent';
    const rawCandidate =
      chartDatasetValue(dataset, 'backgroundColor') ??
      chartDatasetValue(dataset, 'borderColor') ??
      chartDatasetValue(dataset, 'color');
    const array = admitChartArray(rawCandidate);
    const first = array?.length
      ? chartRecordValue(array.source, String((datumIndex ?? 0) % array.length)) : undefined;
    // A missing/unsafe entry leaves `rawCandidate`, which is the array itself and so never a string.
    const candidate =
      typeof first === 'object' ? first.value ?? rawCandidate : rawCandidate;
    if (typeof candidate !== 'string') return fallback;
    let cached = colorCache.get(candidate);
    if (!cached) {
      cached = new Map();
      colorCache.set(candidate, cached);
    }
    const resolved = cached.get(fallback) ?? this.canvasTokens.resolve(candidate, fallback);
    cached.set(fallback, resolved);
    return resolved;
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
      'lr-legend-visibility-change-request',
      legendVisibilityDetail(datasetIndex, visible, nextHidden),
      { cancelable: true }
    );
    if (proposed.defaultPrevented) return;
    // Materialize the full effective snapshot, including any configured-hidden peers, so an
    // accepted user choice survives Chart.js reconstruction and can be persisted by a host.
    this.hiddenDatasets = nextHidden;
    const appliedVisibility = { chart: this.chart, hidden: this.canonicalHiddenDatasets() };
    this.applyDatasetVisibility();
    this.chart.update('none');
    this.appliedLegendVisibility = appliedVisibility;
    this.requestUpdate('canvasPresentation', null);
    this.emit(
      'lr-legend-visibility-change',
      legendVisibilityDetail(datasetIndex, visible, nextHidden)
    );
  }

  private toggleDatum(index: number): void {
    if (!this.chart || !this.isSliceChart()) return;
    const count = this.dataTableSample().rowCount;
    if (index < 0 || index >= count) return;
    const hidden = normalizeHiddenDatasets(this.hiddenDatums, count) ?? [];
    const visible = hidden.includes(index);
    const next = visible ? hidden.filter((item) => item !== index) : [...hidden, index].sort((a, b) => a - b);
    const detail: LyraChartDatumVisibilityChangeDetail = { index, visible, hiddenDatums: next };
    const proposed = this.emit('lr-datum-visibility-change-request', detail, { cancelable: true });
    if (proposed.defaultPrevented) return;
    this.hiddenDatums = next;
    this.applyDatumVisibility();
    this.chart.update('none');
    this.emit('lr-datum-visibility-change', detail);
  }

  private renderLegend(): TemplateResult | typeof nothing {
    if (!this.showsLegend) return nothing;
    const effective = this.effectiveData();
    if (!effective.datasets.length) return nothing;
    const sample = this.dataTableSample(effective);
    let palette = this.seriesPalette();
    // 'dataset' always forces dataset legends; 'datum' and the 'auto' default both resolve to
    // per-slice datum legends, but only on chart types that actually have slices.
    const datumMode = this.legendMode !== 'dataset' && this.isSliceChart();
    if (datumMode) palette = palette.map((fallback, index) =>
      index < 6 ? this.styleColor(`--fill-color-${index + 1}`, fallback) : fallback,
    );
    const forcedColors = forcedColorsActive(this.ownerWindow);
    const hiddenDatums = new Set(normalizeHiddenDatasets(this.hiddenDatums, sample.rowCount));
    const needValues = !this.spatialActive && this.legendDisplay !== 'label' &&
      (this.legendDisplay === 'value' || this.legendDisplay === 'percentage' ||
        this.legendDisplay === 'value-percentage' || this.formatter || this.valueFormatter);
    // Each render owns its projections and color probes, so repeated category entries share work
    // while subsequent data or theme updates always start with fresh values.
    const sources = new Map<number, readonly unknown[]>();
    const colorCache = new Map<string, Map<string, string>>();
    const entries = (datumMode ? sample.rowIndexes : sample.seriesIndexes).map((index) => {
      const datasetIndex = datumMode ? 0 : index;
      const dataset = effective.datasets[datasetIndex]!;
      let value: number | undefined;
      let valueScale = 0;
      let scaledValue = 0;
      if (needValues) {
        let source = sources.get(datasetIndex);
        if (!source) {
          source = this.datasetValues(dataset);
          sources.set(datasetIndex, source);
        }
        for (const row of datumMode ? [index] : sample.rowIndexes) {
          const number = chartDatumNumericValue(source[row]);
          if (number !== undefined) {
            value = finiteAdd(value ?? 0, number);
            const nextScale = Math.max(valueScale, Math.abs(number));
            if (nextScale) scaledValue = scaledValue * (valueScale / nextScale) + number / nextScale;
            valueScale = nextScale;
          }
        }
      }
      const label = datumMode
        ? labelText(effective.labels[index]) || this.localize('chartPointLabel', undefined, { n: this.formatSummaryValue(index + 1) })
        : this.datasetLabel(dataset, datasetIndex);
      return { index, datasetIndex, dataset, label, value, valueScale, scaledValue };
    });
    // Preserve each sum's scale before computing shares: saturating finite totals would make
    // differently sized datasets above Number.MAX_VALUE appear equal.
    const maximum = entries.reduce((largest, entry) => Math.max(largest, entry.valueScale), 0);
    const total = maximum ? entries.reduce((sum, entry) => sum + Math.abs(entry.scaledValue) * (entry.valueScale / maximum), 0) : 0;
    const controlledHidden = normalizeHiddenDatasets(
      this.canonicalHiddenDatasets(),
      effective.datasets.length
    );
    const controlledHiddenSet = controlledHidden === undefined
      ? undefined
      : new Set(controlledHidden);
    return html`
      <div
        part="legend"
        role="group"
        data-position=${this.legendPositionForLayout()}
        aria-label=${this.accessibleName(this.localize('chart'))}
      >
        ${entries.map(({ index, datasetIndex, dataset, label, value, valueScale, scaledValue }) => {
          // In uncontrolled mode the effective data configuration is the visibility source. DOM
          // legend interaction writes `hiddenDatasets`, so Chart.js metadata never becomes a
          // separate, unobservable state source.
          const visible =
            datumMode ? !hiddenDatums.has(index) : controlledHiddenSet === undefined
              ? chartDatasetBoolean(dataset, 'hidden') !== true
              : !controlledHiddenSet.has(index);
          const encoding: ForcedColorEncodingName | undefined =
            forcedColors
              ? forcedColorEncoding(index).name
              : undefined;
          return html`
            <button
              part=${visible ? 'legend-item' : 'legend-item legend-item-hidden'}
              type="button"
              aria-pressed=${visible ? 'true' : 'false'}
              @click=${() => datumMode ? this.toggleDatum(index) : this.toggleDataset(index)}
            >
              <span
                part="legend-swatch"
                aria-hidden="true"
                data-encoding=${encoding ?? nothing}
                style="background-color:${this.legendColor(
                  dataset,
                  datasetIndex,
                  palette,
                  datumMode ? index : undefined,
                  colorCache,
                )}"
              ></span>
              <span>${this.legendTextContent(
                label,
                value,
                total ? Math.abs(scaledValue) * (valueScale / maximum) / total : 0,
                // A dataset entry aggregates every row, so it carries no row index; a per-slice
                // entry names the category it stands for. Both indexes are already SOURCE indexes
                // here -- `entries` is built from `dataTableSample()`'s `seriesIndexes`/`rowIndexes`
                // -- so they must NOT be mapped through the visual tables a second time.
                datumMode
                  ? this.sourceDatumFormatterMetadata(datasetIndex, index, effective)
                  : this.sourceDatumFormatterMetadata(index, undefined, effective),
              )}</span>
            </button>
          `;
        })}
      </div>
    `;
  }

  override render(): TemplateResult {
    this.refreshPreparedModel();
    if (this.preparedInvalid) return html`<div part="base"><div part="error">${this.localize('chartPreparedUnavailable')}</div></div>`;
    if (this.loading) {
      return html`
        <div part="base">
          <slot
            class="config-slot"
            @slotchange=${this.onConfigSlotChange}
          ></slot>
          <span class="sr-only">${this.localize('loading')}</span>
          <lr-skeleton shape="rect" .announce=${false}></lr-skeleton>
        </div>
      `;
    }
    if (this.loadFailed) {
      return html`
        <div part="base">
          <slot
            class="config-slot"
            @slotchange=${this.onConfigSlotChange}
          ></slot>
          <div part="error">${this.localize('chartMissingLibrary')}</div>
        </div>
      `;
    }
    const effective = this.effectiveData();
    const seriesLabels = this.dataTableSample(effective).seriesIndexes.map((index) =>
      this.datasetLabel(effective.datasets[index]!, index)
    );
    const label = this.accessibleName(
      (seriesLabels.length
        ? getListFormat(this.effectiveLocale, { type: 'conjunction' }).format(seriesLabels)
        : '') || this.localize('chart')
    );
    const description = this.chartDescription();
    const hasCustomDataTable = this.hasCustomDataTable();
    return html`
      <div
        part="base"
        data-legend-position=${this.showsLegend
          ? this.legendGridPlacement()
          : nothing}
      >
        <slot class="config-slot" @slotchange=${this.onConfigSlotChange}></slot>
        ${this.canvasUnavailable
          ? html`<div part="error">${this.localize('chartRenderUnavailable')}</div>`
          : nothing}
        <div part="plot" ?hidden=${this.canvasUnavailable}>
          <canvas
            part="canvas"
            role="application"
            aria-roledescription=${this.localize('chart')}
            tabindex="0"
            aria-label=${label}
            aria-describedby=${this.descriptionId}
            @pointermove=${this.onSyncPointerMove}
            @focus=${this.onCanvasFocus}
            @blur=${this.onCanvasBlur}
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
                : { left: '50%', top: '50%' }
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
        ${this.canvasUnavailable ? nothing : this.renderLegend()}
        <p part="description" id=${this.descriptionId} class="sr-only">${description}</p>
        <p class="sr-only" aria-hidden="true">${this.keyboardDatumAnnouncement}</p>
        <div part="notices">
          ${this.spatialActive ? html`<p part="feature-warning">${this.localize('chartSpatialDensityLegend')}</p>` : nothing}
          ${this.preparedPending ? html`<p part="feature-warning">${this.localize('loading')}</p>` : nothing}
          ${this.preparedRequestFailed ? html`<p part="error">${this.localize('chartPreparedUnavailable')}</p>` : nothing}
          ${this.inputLimitMessage() ? html`<p part="limit">${this.inputLimitMessage()}</p>` : nothing}
          ${this.featureWarningMessages().map(
            (warning) => html`<p part="feature-warning">${warning}</p>`
          )}
          ${this.dataTruncationMessage()
            ? html`<p part="data-truncation">${this.dataTruncationMessage()}</p>`
            : nothing}
        </div>
        ${this.dataTableToggle && !this.canvasUnavailable
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
          ?data-visually-hidden=${!this.dataTableVisible && !this.canvasUnavailable}
        >
          <slot
            name="data-table"
            @slotchange=${() => this.requestUpdate('dataTableSlot', null)}
          ></slot>
          ${hasCustomDataTable ? nothing : this.renderDataTable()}
        </div>
      </div>
    `;
  }

  private get showsLegend(): boolean {
    return !this.withoutLegend;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-chart': LyraChart;
  }
}
