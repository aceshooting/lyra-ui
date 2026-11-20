import { finiteInteger } from './numbers.js';

/** Provider rows per page when `sourcePageSize` is unset or unusable. */
const DEFAULT_SOURCE_PAGE_SIZE = 100;
/** Largest provider page a host requests. */
const MAX_SOURCE_PAGE_SIZE = 500;

/** A host's `sourcePageSize`, normalized to 1..500 (100 when not a finite number). */
export function normalizeSourcePageSize(value: number): number {
  return finiteInteger(value, DEFAULT_SOURCE_PAGE_SIZE, 1, MAX_SOURCE_PAGE_SIZE);
}

/** A host's zero-based `sourcePage`, bounded so its first record offset stays a safe integer. */
export function normalizeSourcePage(value: number, pageSize: number): number {
  return finiteInteger(value, 0, 0, Math.floor(Number.MAX_SAFE_INTEGER / normalizeSourcePageSize(pageSize)));
}

/** The one-based page a pagination control shows for a zero-based `sourcePage`. */
export function displayedSourcePage(value: number): number {
  return finiteInteger(value, 0, 0, Number.MAX_SAFE_INTEGER - 1) + 1;
}

/** The zero-based page holding the record at zero-based `index`. */
export function sourcePageOfRecord(index: number, pageSize: number): number {
  return Math.floor(index / normalizeSourcePageSize(pageSize));
}

/**
 * Remembers the query inputs (search, filters, sort, page size, ...) of the last provider request.
 * {@link changed} reports when any input differs by identity from the previous call, which is when
 * a host returns to the first page; the first call after {@link clear} never reports a change.
 */
export class SourceQueryInputs {
  private last?: readonly unknown[];

  /** The inputs of the last request, or `undefined` before the first one and after a clear. */
  get current(): readonly unknown[] | undefined {
    return this.last;
  }

  changed(inputs: readonly unknown[]): boolean {
    const last = this.last;
    this.last = inputs;
    return last !== undefined && (last.length !== inputs.length || inputs.some((value, index) => value !== last[index]));
  }

  clear(): void {
    this.last = undefined;
  }
}
