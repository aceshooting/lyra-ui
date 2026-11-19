import { snapshotStructuredData, admitSnapshotArray, projectSnapshotArray, type SnapshotArrayAdmission as ChartArrayAdmission } from '../../../internal/structured-snapshot.js';
import { devWarnOnce } from '../../../internal/dev-warning.js';
import { getOwnDataDescriptor, MISSING_OWN_DATA_DESCRIPTOR, UNSAFE_OWN_DATA_DESCRIPTOR } from '../../../internal/data-descriptors.js';
import type { LyraVariant } from '../../../internal/variants.js';
import type { LyraChartAnnotation, LyraChartConfiguration, LyraChartDataConfiguration, LyraChartDatasetConfiguration, LyraChartPlugin, LyraChartPoint, LyraChartSeries } from './chart.class.js';
import { isSafeNonArrayObject as isChartRecord } from '../../../internal/object-guards.js';

export const MAX_CHART_INPUT_ENTRIES = 10_000;
const CHART_INPUT_CAP_WARNING_KEY = 'lr-chart-input-cap';
export const MAX_CHART_CONFIGURATION_DEPTH = 32;
const OMIT_CHART_CONFIGURATION_VALUE = Symbol('omit-chart-configuration-value');

function warnChartInputCap(): void {
  devWarnOnce(CHART_INPUT_CAP_WARNING_KEY,
    'lr-chart: an input array exceeded 10,000 entries; only the first 10,000 are used.');
}

export const truncatedChartInputs = new WeakSet<object>();

function retainChartInputLimit(source: unknown, value: unknown): void {
  if (typeof source === 'object' && source !== null && truncatedChartInputs.has(source) &&
    typeof value === 'object' && value !== null) truncatedChartInputs.add(value);
}

export function admitChartArray(value: unknown): ChartArrayAdmission | undefined {
  let truncated = false;
  const admitted = admitSnapshotArray(value, () => { truncated = true; warnChartInputCap(); });
  if (admitted && truncated) truncatedChartInputs.add(admitted.source);
  return admitted;
}

export function copyChartArrayEntries(admission: ChartArrayAdmission): readonly unknown[] {
  const value = projectSnapshotArray(admission, value => value, { missing: undefined }) ?? Object.freeze([]);
  retainChartInputLimit(admission.source, value);
  return value;
}

/** Enumerates only after the caller established an ordinary record, and contains hostile traps. */
export function chartEnumerableKeys(value: object): readonly string[] | undefined {
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
export const canonicalChartDatasetValues = new WeakMap<object, readonly unknown[]>();
// A config dataset is sometimes cloned by `appendData()` before the next config setter runs. Keep
// the same private provenance on its caller-visible data array so that clone does not force a
// second read of an opaque datum merely to rebuild the owning dataset snapshot.
export const canonicalChartDatasetDataValues = new WeakMap<object, readonly unknown[]>();
export const canonicalChartDataSnapshots = new WeakSet<object>();

/** Reuse a prior one-read projection, or safely admit a derived subclass series on demand. */
export function canonicalChartSeries(value: unknown): LyraChartSeries | undefined {
  if (!isChartRecord(value)) return undefined;
  if (canonicalChartSeriesSnapshots.has(value)) return value as unknown as LyraChartSeries;
  return projectChartSeries(value);
}

export function canonicalSeriesData(
  series: LyraChartSeries
): readonly (number | null)[] {
  const canonical = canonicalChartSeries(series);
  return canonical ? canonicalChartSeriesSnapshots.get(canonical)!.data : [];
}

export function canonicalSeriesPoints(
  series: LyraChartSeries
): readonly (LyraChartPoint | null)[] | undefined {
  const canonical = canonicalChartSeries(series);
  return canonical ? canonicalChartSeriesSnapshots.get(canonical)!.points : undefined;
}

export function chartRecordValue(
  value: object,
  property: PropertyKey
): ReturnType<typeof getOwnDataDescriptor> {
  return getOwnDataDescriptor(value, property);
}

export function projectChartNumberData(
  value: unknown,
  admission = admitChartArray(value),
): readonly (number | null)[] | undefined {
  return projectSnapshotArray(admission,
    entry => typeof entry === 'number' && Number.isFinite(entry) ? entry : null,
    { missing: null });
}

export function projectChartPoint(value: unknown): LyraChartPoint | null {
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
export function projectChartDatum(value: unknown): unknown {
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

export function projectChartStrings(
  value: unknown,
  admission = admitChartArray(value),
): readonly string[] | undefined {
  return projectSnapshotArray(admission, entry => typeof entry === 'string' ? entry : '', { missing: '' });
}

export function projectChartPointRadii(
  value: unknown,
  admission = admitChartArray(value),
): readonly number[] | undefined {
  return projectSnapshotArray(admission,
    entry => typeof entry === 'number' && Number.isFinite(entry) ? entry : Number.NaN,
    { missing: Number.NaN });
}

export function projectHiddenDatasetIndexes(value: unknown): readonly number[] | undefined {
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

export function projectChartAnnotations(value: unknown): readonly LyraChartAnnotation[] {
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
export function appendChartSeries(series: LyraChartSeries, data: readonly (number | null)[]): LyraChartSeries {
  const values = Object.freeze(data);
  const result = Object.freeze({ ...series, data: values });
  canonicalChartSeriesSnapshots.set(result, { data: values });
  return result;
}

export function normalizeChartSeries(value: unknown): readonly LyraChartSeries[] {
  // Retained series reuse their private canonical snapshots, never their live data/points.
  const result = projectSnapshotArray(admitChartArray(value), canonicalChartSeries, { compact: true }) ?? Object.freeze([]);
  retainChartInputLimit(value, result);
  if (result.some(series => truncatedChartInputs.has(series))) truncatedChartInputs.add(result);
  return result;
}

export function isSafeChartConfigurationRecord(value: unknown): value is Record<string, unknown> {
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
export function projectLegendPosition(value: unknown): { [scaleId: string]: number } | undefined {
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

export function projectChartPlugins(
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
export function projectChartDataConfiguration(value: unknown): LyraChartDataConfiguration | undefined {
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

export function projectChartConfiguration(value: unknown): LyraChartConfiguration | undefined {
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
export const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
