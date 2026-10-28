import { PUBLIC_COLLECTION_ENTRY_LIMIT } from './internal/collection-policy.js';

export type TimeIndexErrorCode = 'invalid-timestamps' | 'invalid-instant' | 'invalid-index';
export class TimeIndexError extends Error {
  constructor(readonly code: TimeIndexErrorCode, message: string = code) { super(message); this.name = 'TimeIndexError'; }
}
export interface TimeLocation {
  readonly lowerIndex: number;
  readonly upperIndex: number;
  readonly nearestIndex: number;
  readonly fraction: number;
}
export interface TimeIndex {
  readonly timestamps: readonly number[];
  readonly length: number;
  locate(instant: number): TimeLocation | undefined;
  instantAt(index: number): number;
}
const indexes = new WeakSet<object>();
/** @internal */
export const isTimeIndex = (value: unknown): value is TimeIndex => typeof value === 'object' && value !== null && indexes.has(value);
const instantValid = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 8.64e15;

/** Snapshot up to 10,000 strictly increasing epoch-millisecond timestamps without reindexing. */
export function createTimeIndex(timestamps: readonly number[]): TimeIndex {
  const copy: number[] = [];
  try {
    if (!Array.isArray(timestamps)) throw new Error();
    const length = Object.getOwnPropertyDescriptor(timestamps, 'length')?.value as unknown;
    if (typeof length !== 'number' || !Number.isInteger(length) || length < 0 || length > PUBLIC_COLLECTION_ENTRY_LIMIT) throw new Error();
    for (let position = 0; position < length; position++) {
      const descriptor = Object.getOwnPropertyDescriptor(timestamps, String(position));
      const value: unknown = descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
      if (!instantValid(value) || (position > 0 && value <= copy[position - 1]!)) throw new Error();
      copy.push(value);
    }
  } catch { throw new TimeIndexError('invalid-timestamps'); }
  Object.freeze(copy);
  const location = (lowerIndex: number, upperIndex = lowerIndex, fraction = 0): TimeLocation => Object.freeze({
    lowerIndex, upperIndex, fraction, nearestIndex: fraction <= 0.5 ? lowerIndex : upperIndex,
  });
  const result: TimeIndex = Object.freeze({
    timestamps: copy, length: copy.length,
    instantAt(index: number): number {
      if (!Number.isInteger(index) || index < 0 || index >= copy.length) throw new TimeIndexError('invalid-index');
      return copy[index]!;
    },
    locate(instant: number): TimeLocation | undefined {
      if (!instantValid(instant)) throw new TimeIndexError('invalid-instant');
      if (!copy.length) return undefined;
      if (instant <= copy[0]!) return location(0);
      if (instant >= copy[copy.length - 1]!) return location(copy.length - 1);
      let low = 0, high = copy.length - 1;
      while (low <= high) {
        const middle = (low + high) >>> 1;
        if (copy[middle] === instant) return location(middle);
        if (copy[middle]! < instant) low = middle + 1; else high = middle - 1;
      }
      return location(high, low, (instant - copy[high]!) / (copy[low]! - copy[high]!));
    },
  });
  indexes.add(result);
  return result;
}
