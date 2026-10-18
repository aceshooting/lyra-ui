import type { LyraSpatialChartSource } from '../../../utilities/data-spatial.js';
import type {
  LyraPreparedSeriesData, LyraPreparedCategoryData, LyraObservationCounts, LyraNumericDomain,
  LyraSeriesSample, LyraSeriesObservation, LyraSeriesPointRef, LyraSourceValue, LyraSeriesRangeRequest,
} from '../../../utilities/data-preparation.js';
import type { LyraSourceRevision } from '../../../data-sources.js';
import { sourceCount, sourceRevision } from '../../../internal/source-request-controller.js';

type NonspatialChartData = LyraPreparedSeriesData | LyraPreparedCategoryData;
export type LyraChartPreparedData = NonspatialChartData | LyraSpatialChartSource;
export interface LyraChartSourcePointSelectDetail {
  readonly revision: LyraSourceRevision;
  readonly seriesId: string;
  readonly sourceIndex: number;
  readonly point: LyraSeriesObservation;
}
export interface LyraChartSourceCategorySelectDetail {
  readonly revision: LyraSourceRevision;
  readonly seriesId: string;
  readonly categoryId: string;
  readonly value: number;
  readonly observationCount: number;
}
export interface PreparedChartSeries {
  readonly id: string;
  readonly label: string;
  readonly counts: LyraObservationCounts;
  readonly xDomain: LyraNumericDomain | null;
  readonly yDomain: LyraNumericDomain | null;
  readonly samples: readonly (LyraSeriesSample | null)[];
  readonly values: readonly number[];
}
export interface PreparedChartModel {
  readonly source: NonspatialChartData;
  readonly type: string;
  readonly revision: LyraSourceRevision;
  readonly kind: 'series' | 'categories';
  readonly labels: readonly string[];
  readonly categoryIds: readonly string[];
  readonly categoryCounts: readonly number[];
  readonly series: readonly PreparedChartSeries[];
  readonly validCount: number;
  readonly invalidCount: number;
  readonly displayedCount: number;
  readonly peerCount: number;
  readonly rowCount: number;
  readonly limit: number;
}
function field(value: unknown, key: PropertyKey): unknown {
  if (!value || typeof value !== 'object') throw new TypeError('Invalid prepared record');
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !('value' in descriptor)) throw new TypeError('Prepared fields must be own data properties');
  return descriptor.value;
}
function array(value: unknown, maximum: number): readonly unknown[] {
  if (!Array.isArray(value)) throw new RangeError('Invalid prepared array');
  const length = sourceCount(field(value, 'length'));
  if (length > maximum) throw new RangeError('Prepared array budget exceeded');
  const result: unknown[] = [];
  for (let index = 0; index < length; index++) result.push(field(value, String(index)));
  return result;
}
function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Invalid prepared number');
  return value;
}
function text(value: unknown, maximum: number, nonblank = false): string {
  if (typeof value !== 'string' || value.length > maximum || (nonblank && !value.trim())) throw new TypeError('Invalid prepared metadata');
  return value;
}
function counts(value: unknown): LyraObservationCounts {
  const source = sourceCount(field(value, 'sourceCount')), valid = sourceCount(field(value, 'validCount')), invalid = sourceCount(field(value, 'invalidCount'));
  if (valid > source || invalid !== source - valid) throw new RangeError('Invalid prepared counts');
  return Object.freeze({ sourceCount: source, validCount: valid, invalidCount: invalid });
}
function domain(value: unknown, valid: number): LyraNumericDomain | null {
  if (valid === 0 && value === null) return null;
  const min = number(field(value, 'min')), max = number(field(value, 'max'));
  if (!valid || max < min) throw new RangeError('Invalid prepared domain');
  return Object.freeze({ min, max });
}
function addCount(a: number, b: number): number { return sourceCount(a + b); }
function sample(value: unknown, count: LyraObservationCounts, x: LyraNumericDomain | null, y: LyraNumericDomain | null): LyraSeriesSample {
  const sourceIndex = sourceCount(field(value, 'sourceIndex'));
  const pointX = number(field(value, 'x')), pointY = number(field(value, 'y'));
  const breakBefore = field(value, 'breakBefore');
  if (sourceIndex >= count.sourceCount || !x || !y || pointX < x.min || pointX > x.max || pointY < y.min || pointY > y.max || typeof breakBefore !== 'boolean') throw new RangeError('Invalid prepared sample');
  return Object.freeze({ x: pointX, y: pointY, sourceIndex, breakBefore });
}
function finish(model: Omit<PreparedChartModel, 'displayedCount' | 'peerCount' | 'rowCount'>): PreparedChartModel {
  let displayedCount = 0, peerCount = 0, rowCount = 0;
  for (const series of model.series) {
    const size = model.kind === 'series' ? series.samples.length : series.values.length;
    displayedCount += model.kind === 'series' ? series.samples.reduce((sum, point) => sum + Number(point !== null), 0) : size;
    peerCount += size;
    rowCount = Math.max(rowCount, size);
  }
  if (peerCount > model.limit || rowCount * model.series.length > 1000 || displayedCount > 9000) throw new RangeError('Prepared rendering budget exceeded');
  return Object.freeze({ ...model, series: Object.freeze(model.series), displayedCount, peerCount, rowCount });
}

/** Copies only the admitted summary. Legacy arrays and source readers are never enumerated. */
export function prepareChartModel(source: unknown, type: string, limit: number): PreparedChartModel {
  const kind = field(source, 'kind'), revision = sourceRevision(field(source, 'revision'));
  if (kind !== 'series' && kind !== 'categories') throw new TypeError('Incompatible prepared kind');
  if (kind === 'series' ? !['line', 'bar'].includes(type) : !['bar', 'pie', 'doughnut', 'radar', 'polarArea'].includes(type)) throw new TypeError('Incompatible prepared chart type');
  const entries = array(field(source, 'series'), 1000);
  if (!entries.length) throw new RangeError('Prepared series are required');
  const identifiers = new Set<string>();
  let metadataUnits = 0, validCount = 0, invalidCount = 0;
  const metadata = (value: unknown) => {
    const id = text(field(value, 'id'), 256, true), label = text(field(value, 'label'), 1024);
    metadataUnits += id.length + label.length;
    if (metadataUnits > 65536) throw new RangeError('Prepared metadata budget exceeded');
    return { id, label };
  };
  const categories: { id: string; label: string }[] = [];
  const categoryCounts: number[] = [];
  let categoryTotals: LyraObservationCounts | undefined;
  if (kind === 'categories') {
    categoryTotals = counts(field(source, 'counts'));
    validCount = categoryTotals.validCount; invalidCount = categoryTotals.invalidCount;
    const ids = new Set<string>();
    for (const value of array(field(source, 'categories'), 1000)) {
      const category = metadata(value);
      if (ids.has(category.id)) throw new TypeError('Duplicate prepared category ID');
      ids.add(category.id); categories.push(category);
    }
    const rawCounts = array(field(source, 'categoryCounts'), 1000);
    if (rawCounts.length !== categories.length) throw new RangeError('Prepared category count mismatch');
    let total = 0;
    for (const value of rawCounts) { const count = sourceCount(value); total = addCount(total, count); categoryCounts.push(count); }
    if (total !== validCount) throw new RangeError('Prepared category counts do not conserve observations');
    if (!['count', 'sum', 'mean', 'host-defined'].includes(String(field(source, 'aggregation')))) throw new TypeError('Invalid prepared aggregation');
  } else {
    if (limit < 5 || typeof field(source, 'getPoint') !== 'function') throw new RangeError('Prepared series require an exact reader and overlay capacity');
  }
  const result: PreparedChartSeries[] = [];
  let admittedEntries = 0;
  for (const value of entries) {
    const meta = metadata(value);
    if (identifiers.has(meta.id)) throw new TypeError('Duplicate prepared series ID');
    identifiers.add(meta.id);
    if (kind === 'categories') {
      const values = array(field(value, 'values'), Math.min(limit - admittedEntries, 1000)).map(number);
      admittedEntries += values.length;
      if (values.length !== categories.length) throw new RangeError('Prepared category values mismatch');
      result.push(Object.freeze({ ...meta, counts: categoryTotals!, xDomain: null, yDomain: null, samples: Object.freeze([]), values: Object.freeze(values) }));
    } else {
      const totals = counts(field(value, 'counts'));
      validCount = addCount(validCount, totals.validCount); invalidCount = addCount(invalidCount, totals.invalidCount);
      const x = domain(field(value, 'xDomain'), totals.validCount), y = domain(field(value, 'yDomain'), totals.validCount);
      const raw = array(field(value, 'samples'), Math.min(limit - admittedEntries - 2, 1000));
      if (raw.length > totals.validCount || (totals.validCount > 0 && !raw.length)) throw new RangeError('Invalid prepared sample count');
      const samples: (LyraSeriesSample | null)[] = [];
      let previous = -1;
      for (const value of raw) {
        const point = sample(value, totals, x, y);
        if (point.sourceIndex <= previous || (previous < 0 && !point.breakBefore)) throw new RangeError('Prepared samples must preserve ordered source indices');
        if (type === 'line' && previous >= 0 && point.breakBefore) samples.push(null);
        samples.push(point); previous = point.sourceIndex;
        if (admittedEntries + samples.length + 2 > limit) throw new RangeError('Prepared rendering budget exceeded');
      }
      admittedEntries += samples.length;
      result.push(Object.freeze({ ...meta, counts: totals, xDomain: x, yDomain: y, samples: Object.freeze(samples), values: Object.freeze([]) }));
    }
  }
  const model = finish({ source: source as NonspatialChartData, type, revision, kind, labels: Object.freeze(categories.map(value => value.label)), categoryIds: Object.freeze(categories.map(value => value.id)), categoryCounts: Object.freeze(categoryCounts), series: result, validCount, invalidCount, limit });
  const reserve = kind === 'series' ? 2 : 0;
  if (model.peerCount + reserve > limit || model.displayedCount + Number(kind === 'series') > 9000 || (model.rowCount + reserve) * entries.length > 1000) throw new RangeError('Prepared overlay capacity exceeded');
  return model;
}

/** Overlays one exact observation without reconnecting an omitted path segment. */
export function withPreparedPoint(model: PreparedChartModel, ref: LyraSeriesPointRef, point: LyraSeriesObservation): PreparedChartModel {
  if (model.kind !== 'series') throw new TypeError('Exact points require prepared series');
  const index = model.series.findIndex(entry => entry.id === ref.seriesId);
  const entry = model.series[index];
  if (!entry) throw new RangeError('Unknown prepared series');
  const value = sample({ x: field(point, 'x'), y: field(point, 'y'), sourceIndex: ref.sourceIndex, breakBefore: true }, entry.counts, entry.xDomain, entry.yDomain);
  if (entry.samples.some(sample => sample?.sourceIndex === ref.sourceIndex)) return model;
  const series = [...model.series];
  series[index] = Object.freeze({ ...entry, samples: Object.freeze([...entry.samples, ...(entry.samples.length ? [null] : []), value]) });
  return finish({ ...model, series });
}

/** Resolves promptly on cancellation even when a host reader ignores its signal. */
export async function preparedResponse<T>(response: LyraSourceValue<T>, signal: AbortSignal): Promise<T> {
  let abort: (() => void) | undefined;
  try {
    return await new Promise<T>((resolve, reject) => {
      abort = () => reject(signal.reason);
      signal.addEventListener('abort', abort, { once: true });
      Promise.resolve(response).then(resolve, reject);
      if (signal.aborted) abort();
    });
  } finally {
    if (abort) signal.removeEventListener('abort', abort);
  }
}

/** Validates a bounded indexed refinement while preserving the snapshot's full domains/counts. */
export function withPreparedRange(model: PreparedChartModel, request: LyraSeriesRangeRequest, values: readonly LyraSeriesSample[]): PreparedChartModel {
  if (model.kind !== 'series' || model.source.kind !== 'series') throw new TypeError('Refinement requires prepared series');
  const index = model.series.findIndex(series => series.id === request.seriesId);
  const entry = model.series[index];
  if (!entry) throw new RangeError('Unknown prepared series');
  const points = array(values, request.maxPoints).map(value => sample(value, entry.counts, entry.xDomain, entry.yDomain));
  for (const point of points) if (point.sourceIndex < request.startIndex || point.sourceIndex >= request.endIndex) throw new RangeError('Refinement outside requested range');
  const source: LyraPreparedSeriesData = {
    kind: 'series', revision: model.revision, getPoint: model.source.getPoint,
    series: model.series.map((series, position) => ({ id: series.id, label: series.label, counts: series.counts, xDomain: series.xDomain, yDomain: series.yDomain, samples: position === index ? points : series.samples.filter((point): point is LyraSeriesSample => point !== null) })),
  };
  const refined = prepareChartModel(source, model.type, model.limit);
  return Object.freeze({ ...refined, source: model.source });
}
