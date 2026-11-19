/**
 * The one ordering contract shared by table, data grid and document library: missing values
 * (null, undefined, NaN) sort last in BOTH directions, numbers compare numerically, everything
 * else compares by locale-aware numeric collation (`item2` before `item10`).
 */
import { getCollator } from './intl-cache.js';

/** Folds null, undefined and non-finite numbers into `null` ("missing"). NaN would otherwise make a comparator self-inconsistent. */
export function normalizeSortValue(v: unknown): unknown {
  if (v === undefined || v === null) return null;
  if (typeof v === 'number' && !Number.isFinite(v)) return null;
  return v;
}

/**
 * Compares two values ascending (`dir` 1) or descending (`dir` -1). Missing values always come
 * last, regardless of `dir`; two missing values compare equal.
 */
export function compareNullable(a: unknown, b: unknown, dir: 1 | -1, locale: string): number {
  const left = normalizeSortValue(a);
  const right = normalizeSortValue(b);
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  if (typeof left === 'number' && typeof right === 'number') {
    return left === right ? 0 : (left < right ? -1 : 1) * dir;
  }
  if (typeof left === 'bigint' && typeof right === 'bigint') {
    return left === right ? 0 : (left < right ? -1 : 1) * dir;
  }
  if (left instanceof Date && right instanceof Date) {
    const l = left.getTime();
    const r = right.getTime();
    if (Number.isNaN(l) || Number.isNaN(r)) return Number.isNaN(l) ? (Number.isNaN(r) ? 0 : 1) : -1;
    return l === r ? 0 : (l < r ? -1 : 1) * dir;
  }
  return getCollator(locale, { numeric: true }).compare(String(left), String(right)) * dir;
}

/**
 * Decorate/sort/undecorate: `key` runs once per row instead of once per comparison, and equal
 * rows keep input order (stable). Returns a new array; the input is not mutated.
 */
export function decorateSort<T>(
  rows: readonly T[],
  key: (row: T) => unknown,
  dir: 1 | -1 = 1,
  locale = 'en',
): T[] {
  return rows
    .map((row, index) => ({ row, index, value: normalizeSortValue(key(row)) }))
    .sort((a, b) => compareNullable(a.value, b.value, dir, locale) || a.index - b.index)
    .map((entry) => entry.row);
}
