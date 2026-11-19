import { resolveMaxResourceBytes } from './resource-loader.js';
import { finiteCount } from './numbers.js';

/** Admission limits a tabular viewer derives from its `max-rows`/`max-columns`/`max-bytes`. */
export interface TabularInputLimits {
  readonly rows: number;
  readonly columns: number;
  readonly bytes: number;
  /** Changes whenever any limit does. */
  readonly key: string;
}

/**
 * Effective limits for the tabular viewers: 10,000 rows (up to 100,000), 1,000 columns (up to
 * 10,000) and 25 MiB (up to 250 MiB); invalid values use the default and every limit is at least 1.
 */
export function tabularInputLimits(maxRows: number, maxColumns: number, maxBytes: number): TabularInputLimits {
  const rows = Math.max(1, finiteCount(maxRows, 10000, 100000));
  const columns = Math.max(1, finiteCount(maxColumns, 1000, 10000));
  const bytes = resolveMaxResourceBytes(maxBytes);
  return { rows, columns, bytes, key: `${rows}:${columns}:${bytes}` };
}

/** How {@linkcode TabularInputSnapshot} copies one kind of owned input. */
export interface TabularInputSnapshotOptions<T extends object> {
  /** Clone-owned copy within `limits`; throws for invalid or oversized input. */
  snapshot(value: T, limits: TabularInputLimits): T;
  /** The empty value held after a rejected input. */
  invalid(): T;
}

/**
 * The owned-input half of a tabular viewer (`rows`, `table`, `workbook`): snapshots an authored
 * value under the current limits, treats reassigning that value or its snapshot as a no-op while
 * the limits are unchanged, keeps a rejection for the next load to report, and re-snapshots the
 * held copy once the limits change.
 */
export class TabularInputSnapshot<T extends object> {
  private current: T | undefined;
  private source?: WeakRef<T>;
  private limitsKey = '';
  private rejected = false;
  private failure: unknown;

  constructor(private readonly options: TabularInputSnapshotOptions<T>) {}

  /** The admitted snapshot, the empty value after a rejection, or `undefined` when unset. */
  get value(): T | undefined {
    return this.current;
  }

  /** Records a write; false when it was a no-op, so the host requests no update. */
  assign(value: T | undefined, limits: TabularInputLimits): boolean {
    if (limits.key === this.limitsKey && (value === this.current || (value !== undefined && value === this.source?.deref()))) {
      return false;
    }
    this.limitsKey = limits.key;
    this.source = undefined;
    this.rejected = false;
    this.failure = undefined;
    try {
      this.current = value === undefined ? undefined : this.options.snapshot(value, limits);
      if (value !== undefined) this.source = new WeakRef(value);
    } catch (error) {
      this.current = this.options.invalid();
      this.rejected = true;
      this.failure = error;
    }
    return true;
  }

  /** For the viewer's load: rethrows a rejected write, else returns the held copy re-snapshotted under changed limits. */
  admitted(limits: TabularInputLimits): T | undefined {
    if (this.rejected) throw this.failure;
    if (this.current !== undefined && limits.key !== this.limitsKey) {
      this.current = this.options.snapshot(this.current, limits);
      this.limitsKey = limits.key;
    }
    return this.current;
  }
}
