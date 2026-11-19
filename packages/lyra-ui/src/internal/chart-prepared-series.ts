import type { LyraNumericDomain, LyraObservationCounts, LyraSeriesSample } from '../utilities/data-preparation.js';
import { sourceCount, sourceRevision } from './source-request-controller.js';

export interface PreparedChartSeries {
  readonly id: string;
  readonly label: string;
  readonly counts: LyraObservationCounts;
  readonly xDomain: LyraNumericDomain | null;
  readonly yDomain: LyraNumericDomain | null;
  readonly samples: readonly (LyraSeriesSample | null)[];
  readonly values: readonly number[];
}
export function field(value: unknown, key: PropertyKey): unknown {
  if (!value || typeof value !== 'object') throw new TypeError('Invalid prepared record');
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !('value' in descriptor)) throw new TypeError('Prepared fields must be own data properties');
  return descriptor.value;
}
export function array(value: unknown, maximum: number): readonly unknown[] {
  if (!Array.isArray(value)) throw new RangeError('Invalid prepared array');
  const length = sourceCount(field(value, 'length'));
  if (length > maximum) throw new RangeError('Prepared array budget exceeded');
  const result: unknown[] = [];
  for (let index = 0; index < length; index++) result.push(field(value, String(index)));
  return result;
}
export function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Invalid prepared number');
  return value;
}
function text(value: unknown, maximum: number, nonblank = false): string {
  if (typeof value !== 'string' || value.length > maximum || (nonblank && !value.trim())) throw new TypeError('Invalid prepared metadata');
  return value;
}
export function counts(value: unknown): LyraObservationCounts {
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
export function addCount(a: number, b: number): number { return sourceCount(a + b); }
export function sample(value: unknown, count: LyraObservationCounts, x: LyraNumericDomain | null, y: LyraNumericDomain | null): LyraSeriesSample {
  const sourceIndex = sourceCount(field(value, 'sourceIndex'));
  const pointX = number(field(value, 'x')), pointY = number(field(value, 'y'));
  const breakBefore = field(value, 'breakBefore');
  if (sourceIndex >= count.sourceCount || !x || !y || pointX < x.min || pointX > x.max || pointY < y.min || pointY > y.max || typeof breakBefore !== 'boolean') throw new RangeError('Invalid prepared sample');
  return Object.freeze({ x: pointX, y: pointY, sourceIndex, breakBefore });
}

export function preparedMetadata(value: unknown): { id: string; label: string } {
  return { id: text(field(value, 'id'), 256, true), label: text(field(value, 'label'), 1024) };
}

export function readPreparedSeries(
  value: unknown, meta: { id: string; label: string }, budget: number, separateGaps: boolean,
): PreparedChartSeries {
  const totals = counts(field(value, 'counts'));
  const x = domain(field(value, 'xDomain'), totals.validCount), y = domain(field(value, 'yDomain'), totals.validCount);
  const raw = array(field(value, 'samples'), Math.min(budget, 1000));
  if (raw.length > totals.validCount || (totals.validCount > 0 && !raw.length)) throw new RangeError('Invalid prepared sample count');
  const samples: (LyraSeriesSample | null)[] = [];
  let previous = -1;
  for (const value of raw) {
    const point = sample(value, totals, x, y);
    if (point.sourceIndex <= previous || (previous < 0 && !point.breakBefore)) throw new RangeError('Prepared samples must preserve ordered source indices');
    if (separateGaps && previous >= 0 && point.breakBefore) samples.push(null);
    samples.push(point); previous = point.sourceIndex;
    if (samples.length > budget) throw new RangeError('Prepared rendering budget exceeded');
  }
  return Object.freeze({ ...meta, counts: totals, xDomain: x, yDomain: y, samples: Object.freeze(samples), values: Object.freeze([]) });
}

/** Reads one series without category tables, exact-reader overlays or chart gap separators. */
export function prepareSparklineSeries(source: unknown, budget: number): PreparedChartSeries {
  if (field(source, 'kind') !== 'series') throw new TypeError('Invalid sparkline summary');
  sourceRevision(field(source, 'revision'));
  if (typeof field(source, 'getPoint') !== 'function') throw new TypeError('Missing exact reader');
  const entries = array(field(source, 'series'), 1);
  if (entries.length !== 1) throw new RangeError('Expected one sparkline series');
  return readPreparedSeries(entries[0], preparedMetadata(entries[0]), budget, false);
}
