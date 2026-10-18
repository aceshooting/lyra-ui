import type { LyraSourceRevision } from '../../../data-sources.js';
import type { LyraSourceRequest, LyraSourceValue } from '../../../utilities/data-preparation.js';
import { sourceCount } from '../../../internal/source-request-controller.js';
import type { SequenceStripItem } from './sequence-strip.class.js';

/** Immutable complete sequence with provider-owned indexing and aggregation. */
export interface LyraSequenceSource<T> {
  readonly revision: LyraSourceRevision;
  readonly length: number;
  getItem(index: number, request: LyraSourceRequest): LyraSourceValue<T | null>;
  findIndex(id: string, request: LyraSourceRequest): LyraSourceValue<number | null>;
  summarize(request: LyraSourceRequest & {
    readonly startIndex: number;
    readonly endIndex: number;
    readonly maxRanges: number;
  }): LyraSourceValue<readonly LyraSequenceRangeSummary[]>;
}
/** Ascending, half-open source range. Category counts cover every position. */
export interface LyraSequenceRangeSummary {
  readonly startIndex: number;
  readonly endIndex: number;
  readonly categoryCounts: Readonly<Record<string, number>>;
  readonly markerCount: number;
  readonly enabledCount: number;
}
export interface SequenceSourceSnapshot {
  readonly ranges: readonly LyraSequenceRangeSummary[];
  readonly counts: ReadonlyMap<string, number>;
  readonly markerCount: number;
  readonly enabledCount: number;
}
function field(value: unknown, key: PropertyKey, current: () => boolean): unknown {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) throw new TypeError('Invalid sequence record');
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!current()) throw new Error('Sequence operation revoked');
  if (descriptor && !Object.hasOwn(descriptor, 'value')) throw new TypeError('Invalid sequence field');
  return descriptor?.value;
}
function sum(left: number, right: number): number { return sourceCount(left + right); }
export function sequenceSnapshot(raw: unknown, length: number, current: () => boolean): SequenceSourceSnapshot {
  if (!Array.isArray(raw)) throw new TypeError('Invalid sequence ranges');
  const size = sourceCount(field(raw, 'length', current));
  if (size > 200 || size > length || (length > 0 && size === 0)) throw new RangeError('Invalid sequence range count');
  const ranges: LyraSequenceRangeSummary[] = [];
  const counts = new Map<string, number>();
  let end = 0; let markerCount = 0; let enabledCount = 0;
  for (let index = 0; index < size; index++) {
    const input = field(raw, index, current);
    const startIndex = sourceCount(field(input, 'startIndex', current));
    const endIndex = sourceCount(field(input, 'endIndex', current));
    if (startIndex !== end || endIndex <= startIndex || endIndex > length) throw new RangeError('Invalid sequence partition');
    const markers = sourceCount(field(input, 'markerCount', current));
    const enabled = sourceCount(field(input, 'enabledCount', current));
    const total = endIndex - startIndex;
    if (markers > total || enabled > total) throw new RangeError('Invalid sequence counts');
    const dictionary = field(input, 'categoryCounts', current);
    if (!dictionary || typeof dictionary !== 'object' || Array.isArray(dictionary)) throw new TypeError('Invalid sequence categories');
    const keys = Reflect.ownKeys(dictionary);
    if (!current()) throw new Error('Sequence operation revoked');
    if (keys.length > 200) throw new RangeError('Too many sequence categories');
    const categoryCounts = Object.create(null) as Record<string, number>;
    let categoryTotal = 0;
    for (const key of keys) {
      if (typeof key !== 'string' || key.length > 1024 || !key.trim()) throw new TypeError('Invalid sequence category');
      const count = sourceCount(field(dictionary, key, current));
      if (!count) throw new RangeError('Invalid sequence category count');
      categoryTotal = sum(categoryTotal, count);
      categoryCounts[key] = count;
      counts.set(key, sum(counts.get(key) ?? 0, count));
      if (counts.size > 200) throw new RangeError('Too many sequence categories');
    }
    if (categoryTotal !== total) throw new RangeError('Incomplete sequence category counts');
    ranges.push(Object.freeze({ startIndex, endIndex, categoryCounts: Object.freeze(categoryCounts), markerCount: markers, enabledCount: enabled }));
    markerCount = sum(markerCount, markers); enabledCount = sum(enabledCount, enabled); end = endIndex;
  }
  if (end !== length) throw new RangeError('Incomplete sequence partition');
  return Object.freeze({ ranges: Object.freeze(ranges), counts, markerCount, enabledCount });
}
export function sequenceItem(raw: unknown, current: () => boolean): SequenceStripItem | null {
  if (raw === null) return null;
  const id = field(raw, 'id', current), categoryId = field(raw, 'categoryId', current);
  const label = field(raw, 'label', current), marker = field(raw, 'marker', current), disabled = field(raw, 'disabled', current);
  if (typeof id !== 'string' || typeof categoryId !== 'string' || (label !== undefined && typeof label !== 'string') ||
      (marker !== undefined && typeof marker !== 'boolean') || (disabled !== undefined && typeof disabled !== 'boolean')) throw new TypeError('Invalid sequence item');
  if (id.length + categoryId.length + (label?.length ?? 0) > 65_536 || !id.trim() || !categoryId.trim()) throw new RangeError('Invalid sequence item text');
  return Object.freeze({ id, categoryId, ...(label === undefined ? {} : { label }), ...(marker === undefined ? {} : { marker }), ...(disabled === undefined ? {} : { disabled }) });
}
