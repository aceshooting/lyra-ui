import { finiteCount, positiveInteger } from './numbers.js';

/**
 * The choices a page-size selector renders: the configured sizes that are finite positive
 * integers, de-duplicated and sorted ascending, with the applied `current` size merged in when it
 * is itself a positive integer, so the selector can always display the size actually in effect.
 * A non-array input yields only the applied size.
 */
export function pageSizeChoices(options: unknown, current: number): number[] {
  const sizes = new Set<number>();
  if (Array.isArray(options)) {
    for (const value of options as readonly unknown[]) {
      const size = positiveInteger(value, 0);
      if (size > 0) sizes.add(size);
    }
  }
  const applied = positiveInteger(current, 0);
  if (applied > 0) sizes.add(applied);
  return [...sizes].sort((a, b) => a - b);
}

/**
 * The page that keeps the first item of `page` (1-based) in view after the page size changes
 * from `fromSize` to `toSize`: `floor(((page - 1) * fromSize) / toSize) + 1`. A known
 * `totalItems` (a positive count) clamps the result to the new page count; otherwise only the
 * floor of page 1 applies.
 */
export function remapPageForSize(
  page: number,
  fromSize: number,
  toSize: number,
  totalItems?: number,
): number {
  const size = finiteCount(toSize);
  if (size === 0) return 1;
  const firstItem = (finiteCount(page, 1) - 1) * finiteCount(fromSize);
  const remapped = Math.max(1, Math.floor(Math.max(0, firstItem) / size) + 1);
  const total = finiteCount(totalItems ?? 0);
  if (total === 0) return remapped;
  return Math.min(remapped, Math.max(1, Math.ceil(total / size)));
}

/** Zero-based index of the first item on 1-based `page`: `(page - 1) * pageSize`, never negative. */
export function pageOffset(page: number, pageSize: number): number {
  return Math.max(0, finiteCount(page, 1) - 1) * finiteCount(pageSize);
}

/** The 1-based page containing zero-based item `offset`: `floor(offset / pageSize) + 1`. A
 *  non-multiple floors to the page that holds it; an unusable size yields page 1. */
export function pageForOffset(offset: number, pageSize: number): number {
  const size = finiteCount(pageSize);
  return size === 0 ? 1 : Math.floor(finiteCount(offset) / size) + 1;
}
