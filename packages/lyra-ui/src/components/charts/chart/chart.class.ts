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
import { onAnnotationPluginRegistered } from '../../../internal/chart-annotation-registration.js';
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
import '../../overlays/skeleton/skeleton.class.js';
import { getListFormat, getNumberFormat } from '../../../internal/intl-cache.js';
import { escapeCsvField } from '../../utility/export-button/csv.js';
import { trueDefaultBooleanFromAttributeConverter as trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { finiteAdd, finiteNumber } from '../../../internal/numbers.js';
import {
  getOwnDataDescriptor,
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
} from '../../../internal/data-descriptors.js';
import { sanitizeCssLength } from '../../../internal/safe-css.js';
import {
  acquireAnnouncementSink,
  type AnnouncementSink,
} from '../../../internal/announcer.js';
import {
  resolveCanvasColor,
  resolveCanvasColors,
  seriesPalette,
  translucentAreaColor,
} from './chart-colors.js';
import type { LyraVariant } from '../../../internal/variants.js';
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
} from './chart-legend-visibility.js';
export type { LyraChartLegendVisibilityChangeDetail } from './chart-legend-visibility.js';
import { sampleChartTableIndexes } from './chart-table-sampling.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_chart, LYRA_DEFAULT_chartAnnotationsUnavailable, LYRA_DEFAULT_chartAxisTotal, LYRA_DEFAULT_chartBubblePointCoordinates, LYRA_DEFAULT_chartCategory, LYRA_DEFAULT_chartData, LYRA_DEFAULT_chartDataLabelsUnavailable, LYRA_DEFAULT_chartDataSampled, LYRA_DEFAULT_chartLabeledPoint, LYRA_DEFAULT_chartMissingLibrary, LYRA_DEFAULT_chartPointCoordinates, LYRA_DEFAULT_chartPointLabel, LYRA_DEFAULT_chartPrimaryAxis, LYRA_DEFAULT_chartSecondaryAxis, LYRA_DEFAULT_chartSeriesLabel, LYRA_DEFAULT_chartSeriesNoData, LYRA_DEFAULT_chartStackTotalsUnavailable, LYRA_DEFAULT_chartSummary, LYRA_DEFAULT_chartSummaryEmpty, LYRA_DEFAULT_chartSummarySeparator, LYRA_DEFAULT_chartSummaryWithData, LYRA_DEFAULT_chartTotal, LYRA_DEFAULT_chartTrendDecreasing, LYRA_DEFAULT_chartTrendFlat, LYRA_DEFAULT_chartTrendIncreasing, LYRA_DEFAULT_chartTypeBar, LYRA_DEFAULT_chartTypeBubble, LYRA_DEFAULT_chartTypeDoughnut, LYRA_DEFAULT_chartTypeLine, LYRA_DEFAULT_chartTypePie, LYRA_DEFAULT_chartTypePolarArea, LYRA_DEFAULT_chartTypeRadar, LYRA_DEFAULT_chartTypeScatter, LYRA_DEFAULT_chartValueLabel, LYRA_DEFAULT_chartZoomUnavailable, LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_liteChartMarkSummary, LYRA_DEFAULT_loading, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_noData, LYRA_DEFAULT_open, LYRA_DEFAULT_popover, LYRA_DEFAULT_resetZoom, LYRA_DEFAULT_search, LYRA_DEFAULT_select } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export { seriesPalette } from './chart-colors.js';

export interface LyraChartPoint {
  readonly x: number;
  readonly y: number;
  /** Bubble radius. Ignored by chart types that do not consume a radius. */
  readonly r?: number;
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
   * when shorter than the segment count. Only meaningful for line-type series.
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

export interface LyraChartFormatterContext {
  readonly value: number;
  readonly surface: LyraChartFormatSurface;
  readonly datasetIndex?: number;
  readonly index?: number;
  readonly label?: string;
  readonly seriesLabel?: string;
  readonly statistic?: LyraChartStatistic;
}

export type LyraChartFormatter = (context: LyraChartFormatterContext) => string;
type LyraChartFormatterMetadata = Omit<
  LyraChartFormatterContext,
  'surface' | 'value'
>;

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
const MAX_CHART_CONFIGURATION_DEPTH = 32;
const OMIT_CHART_CONFIGURATION_VALUE = Symbol('omit-chart-configuration-value');

/**
 * A successful admission is the sole array classification for a projection pass. A revocable
 * proxy may revoke while its `length` descriptor is inspected, so calling `Array.isArray()` a
 * second time would turn an otherwise fail-closed input into a throw.
 */
interface ChartArrayAdmission {
  readonly source: object;
  readonly length: number;
}

function admitChartArray(value: unknown): ChartArrayAdmission | undefined {
  try {
    if (!Array.isArray(value)) return undefined;
    const descriptor = getOwnDataDescriptor(value, 'length');
    if (
      descriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      descriptor === UNSAFE_OWN_DATA_DESCRIPTOR ||
      typeof descriptor.value !== 'number' ||
      !Number.isSafeInteger(descriptor.value) ||
      descriptor.value < 0
    )
      return undefined;
    return { source: value, length: Math.min(descriptor.value, MAX_CHART_INPUT_ENTRIES) };
  } catch {
    return undefined;
  }
}

/** A proxy can revoke after first admission; recheck only its descriptor, never Array.isArray(). */
function chartArrayIsStillAdmitted(admission: ChartArrayAdmission): boolean {
  const descriptor = chartRecordValue(admission.source, 'length');
  return (
    descriptor !== MISSING_OWN_DATA_DESCRIPTOR &&
    descriptor !== UNSAFE_OWN_DATA_DESCRIPTOR &&
    typeof descriptor.value === 'number' &&
    Number.isSafeInteger(descriptor.value) &&
    descriptor.value >= admission.length
  );
}

/** Copies bounded entries through descriptors so later consumers never iterate a source array. */
function copyChartArrayEntries(admission: ChartArrayAdmission): readonly unknown[] {
  if (!chartArrayIsStillAdmitted(admission)) return Object.freeze([]);
  const output: unknown[] = Array.from({ length: admission.length }, () => undefined);
  for (let index = 0; index < admission.length; index += 1) {
    const descriptor = chartRecordValue(admission.source, String(index));
    if (
      descriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      descriptor === UNSAFE_OWN_DATA_DESCRIPTOR
    )
      continue;
    output[index] = descriptor.value;
  }
  return Object.freeze(output);
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
  if (!admission || !chartArrayIsStillAdmitted(admission)) return undefined;
  const output: Array<number | null> = Array.from({ length: admission.length }, () => null);
  for (let index = 0; index < admission.length; index += 1) {
    const descriptor = chartRecordValue(admission.source, String(index));
    if (
      descriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      descriptor === UNSAFE_OWN_DATA_DESCRIPTOR
    )
      continue;
    const candidate = descriptor.value;
    output[index] =
      typeof candidate === 'number' && Number.isFinite(candidate)
        ? candidate
        : null;
  }
  return Object.freeze(output);
}

function projectChartPoint(value: unknown): LyraChartPoint | null {
  if (!isChartRecord(value)) return null;
  const x = chartRecordValue(value, 'x');
  const y = chartRecordValue(value, 'y');
  const r = chartRecordValue(value, 'r');
  const label = chartRecordValue(value, 'label');
  if (
    x === MISSING_OWN_DATA_DESCRIPTOR ||
    x === UNSAFE_OWN_DATA_DESCRIPTOR ||
    y === MISSING_OWN_DATA_DESCRIPTOR ||
    y === UNSAFE_OWN_DATA_DESCRIPTOR ||
    r === UNSAFE_OWN_DATA_DESCRIPTOR ||
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
  return hasValue ? Object.freeze(output) : null;
}

function projectChartDatasetValues(admission: ChartArrayAdmission): readonly unknown[] {
  if (!chartArrayIsStillAdmitted(admission)) return Object.freeze([]);
  const output: unknown[] = Array.from({ length: admission.length }, () => null);
  for (let index = 0; index < admission.length; index += 1) {
    const descriptor = chartRecordValue(admission.source, String(index));
    if (
      descriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      descriptor === UNSAFE_OWN_DATA_DESCRIPTOR
    )
      continue;
    output[index] = projectChartDatum(descriptor.value);
  }
  return Object.freeze(output);
}

function projectChartPoints(
  value: unknown,
  admission = admitChartArray(value),
): readonly (LyraChartPoint | null)[] | undefined {
  if (!admission || !chartArrayIsStillAdmitted(admission)) return undefined;
  const output: Array<LyraChartPoint | null> = Array.from(
    { length: admission.length },
    () => null,
  );
  for (let index = 0; index < admission.length; index += 1) {
    const descriptor = chartRecordValue(admission.source, String(index));
    if (
      descriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      descriptor === UNSAFE_OWN_DATA_DESCRIPTOR
    )
      continue;
    output[index] = projectChartPoint(descriptor.value);
  }
  return Object.freeze(output);
}

function projectChartStrings(
  value: unknown,
  admission = admitChartArray(value),
): readonly string[] | undefined {
  if (!admission || !chartArrayIsStillAdmitted(admission)) return undefined;
  const output: string[] = Array.from({ length: admission.length }, () => '');
  for (let index = 0; index < admission.length; index += 1) {
    const descriptor = chartRecordValue(admission.source, String(index));
    if (
      descriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      descriptor === UNSAFE_OWN_DATA_DESCRIPTOR ||
      typeof descriptor.value !== 'string'
    )
      continue;
    output[index] = descriptor.value;
  }
  return Object.freeze(output);
}

function projectChartPointRadii(
  value: unknown,
  admission = admitChartArray(value),
): readonly number[] | undefined {
  if (!admission || !chartArrayIsStillAdmitted(admission)) return undefined;
  const output: number[] = Array.from({ length: admission.length }, () => Number.NaN);
  for (let index = 0; index < admission.length; index += 1) {
    const descriptor = chartRecordValue(admission.source, String(index));
    if (
      descriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      descriptor === UNSAFE_OWN_DATA_DESCRIPTOR ||
      typeof descriptor.value !== 'number' ||
      !Number.isFinite(descriptor.value)
    )
      continue;
    output[index] = descriptor.value;
  }
  return Object.freeze(output);
}

const CHART_ANNOTATION_TONES = new Set<LyraVariant>([
  'neutral',
  'brand',
  'success',
  'warning',
  'danger',
]);

function projectHiddenDatasetIndexes(value: unknown): readonly number[] | undefined {
  if (value === undefined) return undefined;
  const admission = admitChartArray(value);
  if (!admission || !chartArrayIsStillAdmitted(admission)) return Object.freeze([]);
  const output: number[] = [];
  for (let index = 0; index < admission.length; index += 1) {
    const descriptor = chartRecordValue(admission.source, String(index));
    const candidate =
      descriptor === MISSING_OWN_DATA_DESCRIPTOR || descriptor === UNSAFE_OWN_DATA_DESCRIPTOR
        ? undefined
        : descriptor.value;
    if (
      descriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      descriptor === UNSAFE_OWN_DATA_DESCRIPTOR ||
      typeof candidate !== 'number' ||
      !Number.isInteger(candidate)
    )
      continue;
    output.push(candidate);
  }
  return Object.freeze(output);
}

function projectChartAnnotations(value: unknown): readonly LyraChartAnnotation[] {
  const admission = admitChartArray(value);
  if (!admission || !chartArrayIsStillAdmitted(admission)) return Object.freeze([]);
  const output: LyraChartAnnotation[] = [];
  for (let index = 0; index < admission.length; index += 1) {
    const entry = chartRecordValue(admission.source, String(index));
    if (
      entry === MISSING_OWN_DATA_DESCRIPTOR ||
      entry === UNSAFE_OWN_DATA_DESCRIPTOR ||
      !isChartRecord(entry.value)
    )
      continue;
    const axis = chartRecordValue(entry.value, 'axis');
    const lineValue = chartRecordValue(entry.value, 'value');
    const from = chartRecordValue(entry.value, 'from');
    const to = chartRecordValue(entry.value, 'to');
    const label = chartRecordValue(entry.value, 'label');
    const tone = chartRecordValue(entry.value, 'tone');
    if (
      axis === UNSAFE_OWN_DATA_DESCRIPTOR ||
      lineValue === UNSAFE_OWN_DATA_DESCRIPTOR ||
      from === UNSAFE_OWN_DATA_DESCRIPTOR ||
      to === UNSAFE_OWN_DATA_DESCRIPTOR ||
      label === UNSAFE_OWN_DATA_DESCRIPTOR ||
      tone === UNSAFE_OWN_DATA_DESCRIPTOR
    )
      continue;
    const axisValue = axis === MISSING_OWN_DATA_DESCRIPTOR ? undefined : axis.value;
    const line = lineValue === MISSING_OWN_DATA_DESCRIPTOR ? undefined : lineValue.value;
    const fromValue = from === MISSING_OWN_DATA_DESCRIPTOR ? undefined : from.value;
    const toValue = to === MISSING_OWN_DATA_DESCRIPTOR ? undefined : to.value;
    const labelValue = label === MISSING_OWN_DATA_DESCRIPTOR ? undefined : label.value;
    const toneValue = tone === MISSING_OWN_DATA_DESCRIPTOR ? undefined : tone.value;
    if (
      (axisValue !== undefined && axisValue !== 'x' && axisValue !== 'y') ||
      (labelValue !== undefined && typeof labelValue !== 'string') ||
      (toneValue !== undefined &&
        (typeof toneValue !== 'string' || !CHART_ANNOTATION_TONES.has(toneValue as LyraVariant)))
    )
      continue;
    const normalizedAxis: LyraChartIndexAxis | undefined =
      axisValue === 'x' || axisValue === 'y' ? axisValue : undefined;
    const common: Pick<LyraChartAnnotation, 'axis' | 'label' | 'tone'> = {
      ...(normalizedAxis !== undefined ? { axis: normalizedAxis } : {}),
      ...(typeof labelValue === 'string' ? { label: labelValue } : {}),
      ...(typeof toneValue === 'string' ? { tone: toneValue as LyraVariant } : {}),
    };
    if (typeof line === 'number' && Number.isFinite(line)) {
      output.push(Object.freeze({ ...common, value: line }));
      continue;
    }
    if (
      typeof fromValue === 'number' &&
      Number.isFinite(fromValue) &&
      typeof toValue === 'number' &&
      Number.isFinite(toValue)
    ) {
      output.push(
        Object.freeze({
          ...common,
          from: Math.min(fromValue, toValue),
          to: Math.max(fromValue, toValue),
        }),
      );
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
  'pointColors',
  'pointRadius',
  'segmentColors',
  'type',
] as const;

/** The simplified surface tolerates an omitted label/data payload, but every admitted field is
 * copied through an own data descriptor before later rendering code sees it. */
function projectChartSeries(value: unknown): LyraChartSeries | undefined {
  try {
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
    ): unknown | undefined => {
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
    canonicalChartSeriesSnapshots.set(series, {
      data: data ?? Object.freeze([]),
      ...(points ? { points } : {}),
    });
    return series;
  } catch {
    return undefined;
  }
}

function normalizeChartSeries(value: unknown): readonly LyraChartSeries[] {
  const admission = admitChartArray(value);
  if (!admission || !chartArrayIsStillAdmitted(admission)) return Object.freeze([]);
  const output: LyraChartSeries[] = [];
  for (let index = 0; index < admission.length; index += 1) {
    const descriptor = chartRecordValue(admission.source, String(index));
    if (
      descriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      descriptor === UNSAFE_OWN_DATA_DESCRIPTOR
    )
      continue;
    // `appendData()` can retain an already-admitted point series while replacing a numeric
    // sibling. Reuse its non-enumerable canonical snapshot instead of revisiting the public
    // caller-owned `data`/`points` array after it may have changed or become hostile.
    const series = canonicalChartSeries(descriptor.value);
    if (series) output.push(series);
  }
  return Object.freeze(output);
}

interface ChartConfigurationBudget {
  remaining: number;
  readonly active: Set<object>;
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

function copyChartConfigurationValue(
  value: unknown,
  budget: ChartConfigurationBudget,
  depth = 0,
): unknown | typeof OMIT_CHART_CONFIGURATION_VALUE {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return value;
  if (typeof value === 'function') return value;
  if (depth > MAX_CHART_CONFIGURATION_DEPTH || budget.remaining <= 0) {
    return OMIT_CHART_CONFIGURATION_VALUE;
  }
  if (budget.active.has(value)) return OMIT_CHART_CONFIGURATION_VALUE;
  const array = admitChartArray(value);
  if (array && !chartArrayIsStillAdmitted(array)) return OMIT_CHART_CONFIGURATION_VALUE;
  if (array) {
    budget.remaining -= 1;
    budget.active.add(value);
    try {
      const output: unknown[] = Array.from({ length: array.length }, () => undefined);
      for (let index = 0; index < array.length && budget.remaining > 0; index += 1) {
        budget.remaining -= 1;
        const descriptor = chartRecordValue(array.source, String(index));
        if (
          descriptor === MISSING_OWN_DATA_DESCRIPTOR ||
          descriptor === UNSAFE_OWN_DATA_DESCRIPTOR
        )
          continue;
        const entry = copyChartConfigurationValue(descriptor.value, budget, depth + 1);
        if (entry !== OMIT_CHART_CONFIGURATION_VALUE) output[index] = entry;
      }
      const copied = Object.freeze(output);
      const canonical = canonicalChartDatasetDataValues.get(array.source);
      if (canonical) canonicalChartDatasetDataValues.set(copied, canonical);
      return copied;
    } finally {
      budget.active.delete(value);
    }
  }
  if (!isSafeChartConfigurationRecord(value)) {
    // Canvas gradients/patterns and Chart.js instances are opaque leaves. Their identity is the
    // contract; Lyra neither reads nor restructures them before handing them to Chart.js.
    return value;
  }
  budget.remaining -= 1;
  budget.active.add(value);
  try {
    const keys = chartEnumerableKeys(value);
    if (!keys) return OMIT_CHART_CONFIGURATION_VALUE;
    const output = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (budget.remaining <= 0) break;
      budget.remaining -= 1;
      if (UNSAFE_KEYS.has(key)) continue;
      const descriptor = chartRecordValue(value, key);
      if (
        descriptor === MISSING_OWN_DATA_DESCRIPTOR ||
        descriptor === UNSAFE_OWN_DATA_DESCRIPTOR ||
        !descriptor.enumerable
      )
        continue;
      const entry = copyChartConfigurationValue(descriptor.value, budget, depth + 1);
      if (entry !== OMIT_CHART_CONFIGURATION_VALUE) output[key] = entry;
    }
    return Object.freeze(output);
  } finally {
    budget.active.delete(value);
  }
}

function projectChartPlugins(
  value: unknown,
  admission = admitChartArray(value),
): readonly LyraChartPlugin[] {
  if (!admission || !chartArrayIsStillAdmitted(admission)) return Object.freeze([]);
  const output: LyraChartPlugin[] = [];
  for (let index = 0; index < admission.length; index += 1) {
    const descriptor = chartRecordValue(admission.source, String(index));
    if (
      descriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      descriptor === UNSAFE_OWN_DATA_DESCRIPTOR ||
      descriptor.value === null ||
      (typeof descriptor.value !== 'object' &&
        typeof descriptor.value !== 'function')
    )
      continue;
    const plugin = descriptor.value as object;
    if (admittedChartPlugins.has(plugin)) {
      output.push(plugin as LyraChartPlugin);
      continue;
    }
    const id = chartRecordValue(plugin, 'id');
    if (
      id === MISSING_OWN_DATA_DESCRIPTOR ||
      id === UNSAFE_OWN_DATA_DESCRIPTOR ||
      typeof id.value !== 'string' ||
      id.value.trim() === ''
    )
      continue;
    // Plugins are an intentional opaque-identity exception: Chart.js invokes their callbacks
    // itself, so only the checked `id` is read by Lyra before retaining the original object.
    admittedChartPlugins.add(plugin);
    output.push(plugin as LyraChartPlugin);
  }
  return Object.freeze(output);
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
        if (!chartArrayIsStillAdmitted(array)) {
          output[key] = Object.freeze([]);
          canonicalValues = Object.freeze([]);
          continue;
        }
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
    if (key === 'axis' || key === 'yAxisID' || key === 'type') {
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
  if (!admission || !chartArrayIsStillAdmitted(admission)) return Object.freeze([]);
  const output: LyraChartDatasetConfiguration[] = [];
  for (let index = 0; index < admission.length; index += 1) {
    const descriptor = chartRecordValue(admission.source, String(index));
    if (
      descriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      descriptor === UNSAFE_OWN_DATA_DESCRIPTOR
    )
      continue;
    const dataset = projectChartDatasetConfiguration(descriptor.value);
    if (dataset) output.push(dataset);
  }
  return Object.freeze(output);
}

/**
 * Applies the data-schema boundary after generic descriptor copying. Unknown data-level fields
 * stay available to Chart.js, while labels and dataset rows get the stronger projections required
 * by Lyra's own later render, table, tooltip, append, and accessibility reads.
 */
function projectChartDataConfiguration(value: unknown): LyraChartDataConfiguration | undefined {
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
  return Object.freeze(output) as LyraChartDataConfiguration;
}

function projectChartConfiguration(value: unknown): LyraChartConfiguration | undefined {
  if (!isSafeChartConfigurationRecord(value)) return undefined;
  const budget: ChartConfigurationBudget = {
    remaining: MAX_CHART_INPUT_ENTRIES,
    active: new Set(),
  };
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
    const copied = copyChartConfigurationValue(descriptor.value, budget);
    if (copied === OMIT_CHART_CONFIGURATION_VALUE) continue;
    if (property === 'data') {
      const projected = projectChartDataConfiguration(copied);
      // Preserve an opaque/non-record root value for the raw passthrough contract. Every Lyra
      // data-model consumer reprojects it and therefore treats it as empty, but append callers
      // still observe the original explicit config member they supplied.
      output[property] = projected ?? copied;
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
      const copied = copyChartConfigurationValue(plugins.value, budget);
      if (copied !== OMIT_CHART_CONFIGURATION_VALUE) output['plugins'] = copied;
    }
  }
  return Object.freeze(output) as LyraChartConfiguration;
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
  'lr-point-click': CustomEvent<{
    datasetIndex: number;
    index: number;
    label: string | undefined;
    value: unknown;
  }>;
  'lr-zoom': CustomEvent<{ zoomed: boolean }>;
  'lr-before-legend-visibility-change': CustomEvent<LyraChartLegendVisibilityChangeDetail>;
  'lr-legend-visibility-change': CustomEvent<LyraChartLegendVisibilityChangeDetail>;
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
      const descriptor = chartRecordValue(admission.source, String(index));
      values.push(
        descriptor === MISSING_OWN_DATA_DESCRIPTOR || descriptor === UNSAFE_OWN_DATA_DESCRIPTOR
          ? ''
          : labelText(descriptor.value, depth + 1),
      );
    }
    return values.join(' ');
  }
  return '';
}

/** Reads a Chart.js dataset field without invoking a caller or plugin accessor. */
function chartDatasetValue(dataset: unknown, property: PropertyKey): unknown | undefined {
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
  const admission = admitChartArray(chartDatasetValue(dataset, 'data'));
  return admission ? copyChartArrayEntries(admission) : Object.freeze([]);
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
/**
 * `<lr-chart>` — the core Chart.js wrapper used directly and by the typed
 * Chart.js tags plus `<lr-histogram>`. `<lr-lite-chart>` and `<lr-box-plot>`
 * are independent implementations. Requires the optional peer dep `chart.js`; `chartjs-plugin-zoom`
 * (for `zoom`) and `chartjs-plugin-datalabels` (for `data-labels`/`stack-totals`)
 * are further optional peers loaded only on demand.
 *
 * **API mirror note:** the real `wa-chart` docs page
 * (https://webawesome.com/docs/components/chart/) documents a `config:
 * ChartJS['config']` property alongside its simplified attributes — "a
 * flexible wrapper around Chart.js" supporting *both* simplified attributes
 * and full Chart.js configuration passthrough, not a `data`/`options` prop
 * pair. `lr-chart` mirrors that dual surface: the `LyraChartSeries`-based
 * `datasets`/`labels`/`type`/`withoutLegend`/`xLabel`/`yLabel`/`zoom` attributes
 * below are the simplified surface (compatible with WA's `type`, `xLabel`,
 * `yLabel`, `withoutLegend`, etc.), and the additional
 * `config` property is the raw-passthrough escape hatch — a
 * `LyraChartConfiguration` deep-merged over the generated config in
 * `buildConfig()`, mirroring WA's `config` property without discarding the
 * `LyraChartSeries` shape the rest of this component family (subclasses, box-plot,
 * histogram) is built on.
 *
 * @customElement lr-chart
 * @event lr-zoom - `detail: { zoomed }`.
 * @event lr-point-click - Fired when pointer input lands on a data point/segment, when a generated
 *   data-table value is activated, or when Enter/Space activates the keyboard-current canvas datum.
 *   `detail: { datasetIndex: number, index: number, label: string |
 *   undefined, value: unknown }`. For scatter/bubble data, `label` prefers the per-point label and
 *   `value` is the complete typed `LyraChartPoint` (`x`, `y`, optional `r`, optional `label`).
 * @event lr-datum-activate - Family-normalized activation event. Its detail adds `kind`
 *   (`bar`, `point`, `segment`, or `slice`) to the `lr-point-click` detail.
 * @event lr-before-legend-visibility-change - Cancelable proposal emitted before a DOM legend
 *   toggle changes state. `detail` contains the target `datasetIndex`, its proposed `visible`
 *   value, and the complete canonical proposed `hiddenDatasets` snapshot.
 * @event lr-legend-visibility-change - Emitted after an accepted DOM legend toggle commits the
 *   same detail. Programmatic `hiddenDatasets` changes reconcile without either event.
 * @csspart base - The chart wrapper.
 * @csspart plot - The fixed-height canvas/overlay region.
 * @csspart canvas - The Chart.js canvas.
 * @csspart legend - The wrapping DOM legend, rendered unless `withoutLegend` is set.
 * @csspart legend-item - A keyboard-operable series visibility toggle.
 * @csspart legend-item-hidden - Added to a `legend-item` while its dataset is hidden.
 * @csspart legend-swatch - The resolved series-color swatch in a legend item.
 * @csspart reset-zoom-button - The reset-zoom control when zoom is active.
 * @csspart description - The accessible chart summary.
 * @csspart data-table - The optional generated or slotted data table.
 * @csspart data-table-toggle - The disclosure button rendered by `dataTableToggle`.
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
 * @cssprop [--lr-chart-tooltip-text=var(--lr-color-text)] - Tooltip text color. Resolved via
 *   `getComputedStyle` on every draw.
 * @cssprop [--lr-chart-canvas-hover-outline-width=var(--lr-border-width-thin)] - Width of the
 *   `[part='canvas']` hover-state outline.
 * @cssprop [--lr-chart-canvas-hover-outline-color=var(--lr-chart-grid-color)] - Color of the
 *   `[part='canvas']` hover-state outline.
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
    chartAnnotationsUnavailable: LYRA_DEFAULT_chartAnnotationsUnavailable,
    chartAxisTotal: LYRA_DEFAULT_chartAxisTotal,
    chartBubblePointCoordinates: LYRA_DEFAULT_chartBubblePointCoordinates,
    chartCategory: LYRA_DEFAULT_chartCategory,
    chartData: LYRA_DEFAULT_chartData,
    chartDataLabelsUnavailable: LYRA_DEFAULT_chartDataLabelsUnavailable,
    chartDataSampled: LYRA_DEFAULT_chartDataSampled,
    chartLabeledPoint: LYRA_DEFAULT_chartLabeledPoint,
    chartMissingLibrary: LYRA_DEFAULT_chartMissingLibrary,
    chartPointCoordinates: LYRA_DEFAULT_chartPointCoordinates,
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
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    noData: LYRA_DEFAULT_noData,
    open: LYRA_DEFAULT_open,
    popover: LYRA_DEFAULT_popover,
    resetZoom: LYRA_DEFAULT_resetZoom,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-before-legend-visibility-change',
    'lr-legend-visibility-change',
  ]);

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
  private labelsSnapshot?: { source: unknown; value: readonly string[] };
  private annotationsSnapshot?: {
    source: unknown;
    value: readonly LyraChartAnnotation[];
  };
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
    const value = projectHiddenDatasetIndexes(source);
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
   * `beginAtZero` is not forwarded in that mode -- Chart.js would otherwise be handed a bound it
   * cannot place. Non-positive data points are dropped by Chart.js's own log scale.
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
  @property({ type: Array }) annotations: readonly LyraChartAnnotation[] = [];
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
   * Never runs against the categorical x-axis's own labels (line/bar's `labels` strings) —
   * Chart.js's category scale passes the tick index to `ticks.callback`, not the label text,
   * so formatting it would corrupt the axis.
   */
  @property({ attribute: false }) valueFormatter?: LyraChartValueFormatter;
  /** Unified context-object formatter for visual, tooltip, table/export, and spoken values. */
  @property({ attribute: false }) formatter?: LyraChartFormatter;
  /** Chart-wide default fill-under-line setting for line-type series; a series's own `LyraChartSeries.fill` overrides it. */
  @property({ type: Boolean }) area = false;
  @property({ type: Boolean }) zoom = false;
  @property() height = '280px';
  @property({ attribute: 'x-label' }) xLabel: string | null = null;
  @property({ attribute: 'y-label' }) yLabel: string | null = null;
  @property({ attribute: 'y2-label' }) y2Label = '';
  @property({
    type: Boolean,
    attribute: 'begin-at-zero',
    converter: trueDefaultBooleanConverter,
  })
  beginAtZero = true;
  /** Makes the generated data table visible; it remains screen-reader available when false. */
  @property({ type: Boolean, attribute: 'show-data-table' }) showDataTable = false;

  /**
   * Render a disclosure button above the accessible data table so a sighted reader can reveal the
   * numbers behind the chart on demand. `showDataTable` alone is all-or-nothing -- the table is
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

  private readonly dataTableId = nextId('chart-data-table');

  /** Whether the data table is currently visible. Identical to `showDataTable` whenever
   *  `dataTableToggle` is off, which is what keeps the unset path byte-identical to before. */
  private get dataTableVisible(): boolean {
    if (!this.dataTableToggle) return this.showDataTable;
    return this.dataTableExpandedOverride ?? this.showDataTable;
  }

  private toggleDataTable(): void {
    this.dataTableExpandedOverride = !this.dataTableVisible;
  }
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
   * property. Recursively deep-merged over the `LyraChartSeries`-derived
   * config in `buildConfig()` (any key at any nesting depth — e.g.
   * `config.options.scales.y.min` — wins over the generated equivalent
   * without discarding sibling keys the generated config set), for consumers
   * who need full Chart.js control beyond the simplified `LyraChartSeries` shape.
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
    if (Object.is(value, this.configSource)) return;
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
    return this.normalizeEffectiveConfig(this.config ?? this.slottedConfig);
  }

  private onConfigSlotChange(event: Event): void {
    const slot = event.currentTarget as HTMLSlotElement;
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
    this.slottedConfig = next;
  }

  /**
   * The single data model used by every chart surface. `config.data` follows the same merge rule
   * as the Chart.js render config: an explicit labels/datasets array replaces the generated array,
   * while an omitted member falls back to the simplified property surface.
   */
  private effectiveData(): EffectiveChartData {
    const generated: EffectiveChartData = {
      labels: [...this.canonicalLabels()],
      datasets: this.datasets.map((series) => {
        const { points: _points, ...safeSeries } = series;
        return {
          ...safeSeries,
          data: [...(canonicalSeriesPoints(series) ?? canonicalSeriesData(series))],
          yAxisID: series.axis === 'y2' ? 'y2' : 'y',
        };
      }),
    };
    const override = projectChartDataConfiguration(this.effectiveConfig()?.data);
    const merged = override ? deepMerge(generated, override) : generated;
    const projected = projectChartDataConfiguration(merged);
    return {
      labels: (projected?.labels ?? []) as unknown[],
      datasets: (projected?.datasets ?? []) as LyraChartDatasetConfiguration[],
    };
  }

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
   * richer host-defined append contract.
   */
  appendData(label: string, values: (number | null)[], maxPoints: number = 0): void {
    const limit = Number.isFinite(maxPoints) ? Math.max(0, Math.floor(maxPoints)) : 0;
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
      const nextLabels = limit > 0 ? labels.slice(-limit) : labels;

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
            const nextData = limit > 0 ? data.slice(-limit) : data;
            const nextCanonical = limit > 0 ? canonical.slice(-limit) : canonical;
            canonicalChartDatasetDataValues.set(nextData, Object.freeze(nextCanonical));
            return { ...dataset, data: nextData };
          });
        }
        this.config = { ...effectiveConfig, data: nextData as LyraChartDataConfiguration };
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
      return { ...series, data: limit > 0 ? data.slice(-limit) : data };
    });
    this.labels = limit > 0 ? labels.slice(-limit) : labels;
    this.datasets = datasets;
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
          const metadata = {
            datasetIndex,
            index,
            label: label || undefined,
            seriesLabel: column.label,
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
  private reducedMotionQuery?: MediaQueryList;
  private reducedMotionWindow?: BrowserWindow;

  @query('canvas') private canvasEl?: HTMLCanvasElement;
  /** The current Chart.js instance. Read it only while the element is connected and loaded. */
  chart?: LyraChartInstance;
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
    this.stopAnnotationRegistrationWatch?.();
    this.stopAnnotationRegistrationWatch = onAnnotationPluginRegistered(() =>
      this.rebuildAfterAnnotationRegistration()
    );
    this.syncAnnouncementSinks();
    this.visible = true;
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
    super.disconnectedCallback();
    this.stopAnnotationRegistrationWatch?.();
    this.stopAnnotationRegistrationWatch = undefined;
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
    super.adoptedCallback();
    this.releaseAnnouncementSinks();
    this.syncAnnouncementSinks();
    this.armReducedMotionWatcher();
  }

  private readonly onReducedMotionChange = (): void => {
    if (!this.isConnected || this.ownerWindow !== this.reducedMotionWindow) return;
    // Rebuild the effective options immediately. `draw()` updates an existing instance with
    // mode `none`, which also stops an in-flight construction animation; a later type/plugin
    // reconstruction reads the current preference again from `buildConfig()`.
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
    if (this.needsAnnotations && this.annotationFeatureState === 'unavailable') {
      messages.push(this.localize('chartAnnotationsUnavailable'));
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
      this.requestUpdate();
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
      this.emit('lr-zoom', { zoomed: false });
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
    if (changed.has('annotations')) {
      this.requestAnnotationFeature();
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
      'description',
      'grid',
      'indexAxis',
      'label',
      'legendPosition',
      'min',
      'max',
      'scaleType',
      'annotations',
      'plugins',
      'autoLegendPosition',
      'valueFormatter',
      'formatter',
      'area',
      'height',
      'xLabel',
      'yLabel',
      'y2Label',
      'beginAtZero',
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
    const fullNormalizedData = points
      ? points.map(normalizedChartPoint)
      : canonicalSeriesData(series).map((value) =>
          typeof value === 'number' && Number.isFinite(value) ? value : null
        );
    const normalizedData = rowIndexes
      ? rowIndexes.map((rowIndex) => fullNormalizedData[rowIndex] ?? null)
      : fullNormalizedData;
    const borderFallback =
      chartStyle.borderColors[index % chartStyle.borderColors.length] ??
      palette[index % palette.length];
    const fillFallback =
      chartStyle.fillColors[index % chartStyle.fillColors.length] ??
      palette[index % palette.length];
    const sourceColors = projectChartStrings(series.color);
    const authoredColors = sourceColors && rowIndexes
      ? rowIndexes.map((rowIndex) => sourceColors[rowIndex] ?? '')
      : typeof series.color === 'string'
        ? series.color
        : sourceColors;
    const colors = typeof authoredColors === 'string'
      ? [resolveCanvasColor(this, authoredColors, borderFallback ?? 'transparent'),]
      : authoredColors
        ? resolveCanvasColors(this, authoredColors, borderFallback ?? 'transparent')
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
    const authoredSegmentColors =
      series.segmentColors && rowIndexes
      ? rowIndexes.map((rowIndex) => series.segmentColors![rowIndex] ?? '')
      : series.segmentColors;
    const segmentColors = authoredSegmentColors
      ? resolveCanvasColors(
          this,
          authoredSegmentColors,
          colors?.[0] ?? borderFallback ?? 'transparent'
        )
      : undefined;
    const authoredPointColors =
      series.pointColors && rowIndexes
      ? rowIndexes.map((rowIndex) => series.pointColors![rowIndex] ?? '')
      : series.pointColors;
    const backgroundColors = projectChartStrings(backgroundColor);
    const backgroundColorValue = typeof backgroundColor === 'string' ? backgroundColor : undefined;
    const resolvedBackgroundColor =
      datasetType === 'line' &&
      fill &&
      (colors || !chartStyle.authoredFillColors[index % chartStyle.authoredFillColors.length])
        ? backgroundColors
          ? backgroundColors.map((color) => translucentAreaColor(this, color))
          : backgroundColorValue
            ? translucentAreaColor(this, backgroundColorValue)
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
      borderRadius: chartStyle.borderRadius,
      borderWidth: nonNegativeFinite(
        series.width,
        datasetType === 'line' ? chartStyle.lineBorderWidth : chartStyle.borderWidth
      ),
      borderDash: series.dash ? [4, 4] : chartStyle.forcedColors ? [...encoding.dash] : undefined,
      pointStyle: chartStyle.forcedColors ? encoding.pointStyle : undefined,
      backgroundColor: encodedBackgroundColor,
      borderColor: colors?.[0] ?? sliceBorderColors ?? borderFallback,
      pointBackgroundColor: authoredPointColors
        ? resolveCanvasColors(
            this,
            authoredPointColors,
            colors?.[0] ?? borderFallback ?? 'transparent'
          )
        : undefined,
      pointRadius: pointRadii
        ? (rowIndexes
            ? rowIndexes.map((rowIndex) => pointRadii[rowIndex])
            : pointRadii
          ).map((radius) => nonNegativeFinite(radius, chartStyle.pointRadius))
        : nonNegativeFinite(series.pointRadius, chartStyle.pointRadius),
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
      cs.getPropertyValue('--lr-chart-tooltip-text').trim() ||
      cs.getPropertyValue('--_lr-chart-tooltip-text').trim();
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
   * Builds a small deterministic CanvasPattern for the category index, using the family-wide
   * encoding table in `chart-forced-colors.ts` so `<lr-box-plot>` and `<lr-lite-chart>` texture
   * their own series identically.
   */
  private forcedColorPattern(index: number, background: string): CanvasPattern | string {
    if (!this.ownerWindow) return background;
    return createForcedColorPattern(
      this.ownerDocument,
      index,
      background,
      this.styleColor('--lr-color-surface', FALLBACK_TOOLTIP_BG)
    );
  }

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
    return resolveCanvasColor(this, raw, FALLBACK_TICK_COLOR);
  }

  /**
   * The `chartjs-plugin-annotation` options for this chart, keyed by a stable synthetic id.
   * A single `value` becomes a `line` on that axis's scale; a `from`/`to` pair becomes a `box`
   * bounded on that axis and unbounded on the other.
   */
  private annotationOptions(): Record<string, unknown> {
    const entries: Record<string, unknown> = {};
    this.normalizedAnnotations().forEach((entry, index) => {
      const axis = entry.axis === 'x' ? 'x' : 'y';
      const color = this.annotationColor(entry.tone);
      const label = entry.label
        ? { content: entry.label, display: true, color: this.themeColors().tick, }
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
        backgroundColor: translucentAreaColor(this, color),
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
   * `stackTotals` draws once per category: the plugin fires per (dataset, point),
   * so a total is shown only on the topmost stacked dataset of each axis and its
   * formatter returns the null-aware `computeStackTotals()` value (blank when the
   * whole category is null). When only `dataLabels` is set, each point shows its
   * own value; a null/non-finite point renders blank.
   */
  private datalabelsOptions(
    theme: ThemeColors,
    effectiveType: EffectiveChartType
  ): Record<string, unknown> {
    if (!this.needsDataLabels) return { display: false };
    const effective = this.effectiveData();
    const datasets = effective.datasets;
    const stackTotalsActive =
      this.stackTotals && this.stacked && (effectiveType === 'bar' || effectiveType === 'line');
    const sourceDatasetIndex = (visualIndex: number): number =>
      this.visualDatasetSourceIndexes?.[visualIndex] ?? visualIndex;
    const sourceRowIndex = (visualIndex: number): number =>
      this.visualRowSourceIndexes?.[visualIndex] ?? visualIndex;
    // The topmost dataset per axis carries the stack total (drawn above the stack).
    const topDatasetIndexByAxis = new Map<'y' | 'y2', number>();
    if (stackTotalsActive) {
      const visualDatasetCount = this.visualDatasetSourceIndexes?.length ?? datasets.length;
      for (
        let visualIndex = 0;
        visualIndex < visualDatasetCount;
        visualIndex += 1
      ) {
        const dataset = datasets[sourceDatasetIndex(visualIndex)];
        const axis = chartDatasetAxis(dataset);
        // `visualIndex` is deliberate: Chart.js invokes this callback against the sampled visual
        // stack, while the mapped source dataset above supplies the axis and source values.
        topDatasetIndexByAxis.set(axis, visualIndex);
      }
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
        const indexes = this.callbackIndexes(context, effective);
        if (!indexes) return false;
        const { datasetIndex, index } = indexes;
        const dataset = datasets[sourceDatasetIndex(datasetIndex)];
        const axis = chartDatasetAxis(dataset);
        if (stackTotalsActive) {
          // Only the topmost dataset of each axis draws, and only where the
          // category total is non-null.
          if (topDatasetIndexByAxis.get(axis) !== datasetIndex) return this.dataLabels;
          const total = totalsByAxis?.[axis][sourceRowIndex(index)];
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
        if (stackTotalsActive && topDatasetIndexByAxis.get(axis) === datasetIndex) {
          const total = totalsByAxis?.[axis][sourceRowIndex(index)];
          if (total != null) return this.formatDataLabel(total);
        }
        const numeric = chartDatumNumericValue(value);
        if (numeric === undefined) return '';
        return this.formatDataLabel(numeric);
      },
    };
  }

  /** Locale/format a data-label number through the same `valueFormatter` the axis/tooltip use, so a
   *  drawn label matches the rest of the chart; falls back to a plain locale string. The formatter
   *  runs in the `'tooltip'` context — the closest semantic match to an on-point value label, so a
   *  consumer formatter that branches on context behaves predictably rather than seeing `undefined`. */
  private formatDataLabel(value: number): string {
    if (this.formatter || this.valueFormatter) {
      const formatted = this.formatter?.({ value, surface: 'visual' }) ??
        this.valueFormatter?.(value, 'tooltip');
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
    const members = effective.datasets.filter((dataset) => chartDatasetAxis(dataset) === axisId);
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
    return seriesPalette(this);
  }

  private tickOptions(
    theme: ThemeColors,
    kind: 'category' | 'value' = 'value'
  ): Record<string, unknown> {
    return {
      color: theme.tick,
      ...((this.formatter || this.valueFormatter) && kind === 'value'
        ? { callback: (value: unknown) => this.formatValue(value, 'tick') }
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

  /** `beginAtZero` for a value axis, suppressed on a logarithmic scale which cannot place zero. */
  private valueBeginAtZero(): boolean | undefined {
    return this.valueScaleType() === 'logarithmic' ? undefined : this.beginAtZero;
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

    if (effectiveType === 'radar' || effectiveType === 'polarArea') {
      return {
        r: {
          beginAtZero: this.beginAtZero,
          ...this.scaleBounds(),
          // `z: 1` (any value > 0) moves the ring tick labels into Chart.js's post-dataset
          // `_layers` pass (core.controller.js `draw()` runs every z<=0 layer, then
          // `_drawDatasets()`, then every z>0 layer) -- without it `ticks.z` defaults to 0, so a
          // polarArea wedge or radar fill paints over the ring labels sitting inside the plot
          // area (unlike a cartesian axis, whose tick labels sit outside the chart area and are
          // never at risk of being covered by data regardless of draw order).
          ticks: { ...this.tickOptions(theme), showLabelBackdrop: false, z: 1 },
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
      (dataset) => chartDatasetAxis(dataset) === 'y2'
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
        type: xKind === 'value' ? this.valueScaleType() : 'category',
        beginAtZero: xKind === 'value' ? this.valueBeginAtZero() : undefined,
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
        type: yKind === 'value' ? this.valueScaleType() : 'category',
        position: rtl ? 'right' : 'left',
        beginAtZero: yKind === 'value' ? this.valueBeginAtZero() : undefined,
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
              title: { display: !!this.y2Label, text: this.y2Label, color: theme.tick, },
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
    const datasetIndexes = this.visualDatasetSourceIndexes ??
      effective.datasets.map((_dataset, index) => index);
    const datasets = datasetIndexes.map((index) => effective.datasets[index]);
    let rowIndexes = this.visualRowSourceIndexes;
    if (!rowIndexes) {
      let sourceRowCount = effective.labels.length;
      for (const dataset of datasets) {
        sourceRowCount = Math.max(sourceRowCount, chartDatasetValues(dataset).length);
      }
      rowIndexes = Array.from({ length: sourceRowCount }, (_value, index) => index);
    }
    const labels = rowIndexes.map((index) => effective.labels[index]);
    // `rowIndexes` is already the visual sample when the chart was bounded for rendering. Sample
    // only its local positions here, then translate through that map exactly once below.
    const rowCount = rowIndexes.length;
    const sample = sampleChartTableIndexes(rowCount, datasets.length);
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
          datasetIndex: this.visualDatasetSourceIndexes?.[datasetIndex] ?? datasetIndex,
          index: sourceIndex,
          label: normalizedChartPoint(value)?.label ?? (labelText(labels[localIndex]) || undefined),
          value,
        });
      });
    });
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
      }),
      index: getNumberFormat(this.effectiveLocale).format(position + 1),
      total: getNumberFormat(this.effectiveLocale).format(total),
    });
  }

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
    this.emit('lr-datum-activate', { ...datum, kind });
    this.emit('lr-point-click', datum);
  }

  private onCanvasFocus(): void {
    const datums = this.chartDatums();
    if (!datums.length) return;
    this.keyboardDatumIndex = Math.min(this.keyboardDatumIndex, datums.length - 1);
    this.keyboardDatumAnnouncement = this.datumAnnouncement(
      datums[this.keyboardDatumIndex]!,
      this.keyboardDatumIndex,
      datums.length
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
    const numeric = chartDatumNumericValue(value);
    if (numeric === undefined) return value;
    return (
      this.formatter?.({ value: numeric, surface: context }) ??
      this.valueFormatter?.(numeric, context) ??
      value
    );
  }

  private legendValue(item: ChartLegendItem, _chart: RuntimeChart): number | undefined {
    const effective = this.effectiveData();
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
    const sourceIndexes = this.visualDatasetSourceIndexes ??
      effective.datasets.map((_dataset, index) => index);
    const fallbackDatasets = sourceIndexes.map((sourceIndex) => effective.datasets[sourceIndex]);
    const labels = generated ?? fallbackDatasets.map((dataset, index) => ({
      text: chartDatasetLabel(dataset) || String(index + 1),
      datasetIndex: index,
    }));
    return labels.map((item) => {
      const value = this.legendValue(item, chart);
      const formatted = this.formatValue(value, 'legend');
      return formatted === value || formatted === undefined
        ? item
        : {
            ...item,
            text: this.localize('chartValueLabel', undefined, {
              label: labelText(chartDatasetValue(item, 'text')),
              value: String(formatted),
            }),
          };
    });
  }

  private tooltipLabel(context: ChartTooltipContext): string | undefined {
    const parsed = projectChartDatum(chartDatasetValue(context, 'parsed'));
    const raw = projectChartDatum(chartDatasetValue(context, 'raw'));
    const parsedPoint = normalizedChartPoint(parsed);
    const rawValue = parsedPoint?.y ?? parsed ?? raw;
    const formatted = this.formatValue(rawValue, 'tooltip');
    if (formatted === rawValue || formatted === undefined) return undefined;
    const label = chartDatasetLabel(chartDatasetValue(context, 'dataset'));
    return label
      ? this.localize('chartValueLabel', undefined, {
          label,
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
    const rawDataEscapeHatch = this.hasExplicitConfigData();
    const labels = this.canonicalLabels();
    let visualRows: readonly number[] | undefined;
    let visualSeries: readonly number[] | undefined;
    if (rawDataEscapeHatch) {
      this.visualRowSourceIndexes = undefined;
      this.visualDatasetSourceIndexes = undefined;
    } else {
      let rowCount = labels.length;
      for (const series of this.datasets) {
        rowCount = Math.max(
          rowCount,
          (canonicalSeriesPoints(series) ?? canonicalSeriesData(series)).length,
        );
      }
      const sample = sampleChartTableIndexes(rowCount, this.datasets.length);
      // Keep the ordinary in-budget path byte-for-byte faithful to the authored arrays. Besides
      // avoiding needless copies, this preserves Chart.js's native short-array semantics for
      // point radii/colors and segment-color cycling. Source maps are only needed when an axis was
      // genuinely sampled.
      visualRows = sample.rowIndexes.length < rowCount ? sample.rowIndexes : undefined;
      visualSeries = sample.seriesIndexes.length < this.datasets.length
        ? sample.seriesIndexes
        : undefined;
      this.visualRowSourceIndexes = visualRows;
      this.visualDatasetSourceIndexes = visualSeries;
    }
    const generated: RuntimeChartConfiguration = {
      type: effectiveType,
      data: {
        labels: visualRows ? visualRows.map((index) => labels[index] ?? '') : [...labels],
        datasets: visualSeries
          ? visualSeries.map((sourceIndex) =>
              this.seriesToDataset(
                this.datasets[sourceIndex]!,
                sourceIndex,
                palette,
                effectiveType,
                chartStyle,
                visualRows
              )
            )
          : this.datasets.map((s, i) =>
              this.seriesToDataset(s, i, palette, effectiveType, chartStyle, visualRows)
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
        interaction: { intersect: false, mode: effectiveType === 'scatter' ? 'nearest' : 'index', },
        onClick: (event: unknown, _elements: unknown, chart: RuntimeChart) =>
          this.handlePointClick(event, chart),
        plugins: {
          // Only emitted when there is something to draw AND the peer actually loaded, so a chart
          // without annotations carries no annotation options at all.
          ...(this.needsAnnotations && this.annotationPlugin
            ? { annotation: { annotations: this.annotationOptions() } }
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
            ...(this.formatter || this.valueFormatter
              ? {
                  callbacks: {
                    label: (context: ChartTooltipContext) => this.tooltipLabel(context),
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
    // deep-merge `config` over the `LyraChartSeries`-derived config at every nesting
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

  private draw(): void {
    if (!this.chartJsModule || !this.canvasEl) return;
    const config = this.buildConfig();
    const effectiveType = config.type;
    const nextPlugins = projectChartPlugins(config.plugins);
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
    this.discardChart(true);
    this.chart = new this.chartJsModule.Chart(
      this.canvasEl,
      config as never
    ) as unknown as RuntimeChart;
    this.builtType = effectiveType;
    this.builtPlugins = [...nextPlugins];
    // A new Chart already reads configured `dataset.hidden` values. Apply and redraw only when a
    // public controlled snapshot is present; this also avoids a redundant first update for the
    // ordinary uncontrolled construction path.
    if (this.canonicalHiddenDatasets() !== undefined) {
      this.applyDatasetVisibility();
      this.chart.update('none');
    }
    this.updateChartArea(this.chart);
  }

  private drawIfVisible(): void {
    if (!this.isConnected || !this.visible) return;
    this.draw();
  }

  /** Destroys the peer instance and reconciles the Lyra-owned zoom state in one place. */
  private discardChart(announceZoomReset: boolean): void {
    this.chart?.destroy();
    this.chart = undefined;
    this.resolvedChartArea = undefined;
    if (!this.zoomed) return;
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
  private summarizeSeries(
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
    return getNumberFormat(this.effectiveLocale).format(value);
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
   *  locale number format, which is what it always used. */
  private formatSpokenValue(
    value: number,
    metadata: LyraChartFormatterMetadata = {},
  ): string {
    return (
      this.formatter?.({ value, surface: 'spoken', ...metadata }) ??
      this.formatSummaryValue(value)
    );
  }

  private tableStackAxes(): ('y' | 'y2')[] {
    const type = this.effectiveType();
    if (!this.stackTotals || !this.stacked || (type !== 'bar' && type !== 'line')) return [];
    const present = new Set<'y' | 'y2'>();
    for (const dataset of this.effectiveData().datasets) {
      present.add(chartDatasetAxis(dataset));
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

  private chartDescription(): string {
    if (this.description) return this.description;
    const effective = this.effectiveData();
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
    return ( sample.rowIndexes.length < sample.rowCount || sample.seriesIndexes.length < sample.seriesCount
    );
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
      <table class=${this.dataTableVisible ? nothing : 'sr-only'}>
        <caption>${this.accessibleName(this.localize('chartData'))}</caption>
        <thead>
          <tr>
            <th scope="col">${this.localize('chartCategory')}</th>
            ${sample.seriesIndexes.map((index) => {
              const dataset = effective.datasets[index]!;
              return html`<th scope="col">${this.datasetLabel(dataset, index)}</th>`;
            })}
            ${stackAxes.map(
              (axis) =>
                html`<th scope="col">${this.tableStackTotalLabel(axis, stackAxes.length)}</th>`
            )}
          </tr>
        </thead>
        <tbody>
          ${sample.rowIndexes.map(
            (index) => html`
            <tr>
              <th scope="row">${labelText(effective.labels[index]) ||
                sample.seriesIndexes
                  .map((datasetIndex) =>
                    normalizedChartPoint(this.datasetValues(effective.datasets[datasetIndex]!)[index]),
                  )
                  .find((point): point is LyraChartPoint => point !== null)?.label ||
                this.localize('chartPointLabel', undefined, {
                  n: this.formatSummaryValue(index + 1),
                })}</th>
              ${sample.seriesIndexes.map((datasetIndex) => {
                const dataset = effective.datasets[datasetIndex]!;
                const datum = this.datasetValues(dataset)[index];
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
                const metadata: LyraChartFormatterMetadata = {
                  datasetIndex,
                  index,
                  label: detail.label,
                  seriesLabel: this.datasetLabel(dataset, datasetIndex),
                };
                return html`<td><button
                  type="button"
                  tabindex=${this.dataTableVisible ? '0' : '-1'}
                  @click=${() => this.activateDatum(detail)}
                >${point
                  ? this.datumDisplayValue(datum, {
                      surface: 'table',
                      ...metadata,
                    })
                  : this.formatTableValue(value, metadata)}</button></td>`;
              })}
              ${stackAxes.map((axis) => {
                const total = stackTotals.get(axis)?.[index];
                return html`<td>${total == null
                  ? this.localize('noData')
                  : this.formatTableValue(total, {
                      index,
                      label: labelText(effective.labels[index]) || undefined,
                      statistic: 'total',
                    })}</td>`;
              })}
            </tr>
            `
          )}
        </tbody>
      </table>
    `;
  }

  private hasCustomDataTable(): boolean {
    return Array.from(this.children).some((child) => child.getAttribute('slot') === 'data-table');
  }

  private legendTextFor(
    dataset: LyraChartDatasetConfiguration,
    datasetIndex: number,
    rowIndexes?: readonly number[]
  ): string {
    const label = this.datasetLabel(dataset, datasetIndex);
    if (!this.formatter && !this.valueFormatter) return label;
    const source = this.datasetValues(dataset);
    const selected = rowIndexes ?? source.map((_, index) => index);
    const values: number[] = [];
    for (const index of selected) {
      const datum = source[index];
      const value = chartDatumNumericValue(datum);
      if (value !== undefined) values.push(value);
    }
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

  private legendColor(
    dataset: LyraChartDatasetConfiguration,
    datasetIndex: number,
    palette: string[] = this.seriesPalette()
  ): string {
    const fallback = palette[datasetIndex % palette.length] ?? 'transparent';
    const rawCandidate =
      chartDatasetValue(dataset, 'backgroundColor') ??
      chartDatasetValue(dataset, 'borderColor') ??
      chartDatasetValue(dataset, 'color');
    const array = admitChartArray(rawCandidate);
    const first = array ? chartRecordValue(array.source, '0') : undefined;
    const candidate =
      first === MISSING_OWN_DATA_DESCRIPTOR || first === UNSAFE_OWN_DATA_DESCRIPTOR
        ? undefined
        : first?.value ?? rawCandidate;
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
      { cancelable: true }
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
      legendVisibilityDetail(datasetIndex, visible, nextHidden)
    );
  }

  private renderLegend(): TemplateResult | typeof nothing {
    if (!this.showsLegend) return nothing;
    const effective = this.effectiveData();
    if (!effective.datasets.length) return nothing;
    const sample = this.dataTableSample(effective);
    const palette = this.seriesPalette();
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
        ${sample.seriesIndexes.map((index) => {
          const dataset = effective.datasets[index]!;
          // In uncontrolled mode the effective data configuration is the visibility source. DOM
          // legend interaction writes `hiddenDatasets`, so Chart.js metadata never becomes a
          // separate, unobservable state source.
          const visible =
            controlledHiddenSet === undefined
              ? chartDatasetBoolean(dataset, 'hidden') !== true
              : !controlledHiddenSet.has(index);
          const encoding: ForcedColorEncodingName | undefined =
            forcedColorsActive(this.ownerWindow)
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
                aria-hidden="true"
                data-encoding=${encoding ?? nothing}
                style="background-color:${this.legendColor(
                  dataset,
                  index,
                  palette
                )}"
              ></span>
              <span>${this.legendTextFor(dataset, index, sample.rowIndexes)}</span>
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
        ${this.renderLegend()}
        <p part="description" id=${this.descriptionId} class="sr-only">${description}</p>
        <p class="sr-only" aria-hidden="true">${this.keyboardDatumAnnouncement}</p>
        <div part="notices">
          ${this.featureWarningMessages().map(
            (warning) => html`<p part="feature-warning">${warning}</p>`
          )}
          ${this.dataTruncationMessage()
            ? html`<p part="data-truncation">${this.dataTruncationMessage()}</p>`
            : nothing}
        </div>
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
          <slot
            name="data-table"
            @slotchange=${() => this.requestUpdate()}
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
