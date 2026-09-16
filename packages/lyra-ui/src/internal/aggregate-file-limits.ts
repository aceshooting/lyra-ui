import { finiteCount } from './numbers.js';

/** Normalized `maxFiles`/`maxTotalSize` pair -- the shape each caller's own
 *  `effectiveMaxFiles`/`effectiveMaxTotalSize` getter already produces: `null` means "no limit",
 *  anything else is a positive finite bound. */
export interface AggregateFileLimits {
  readonly maxFiles: number | null;
  readonly maxTotalSize: number | null;
}

/** Remaining allowance under each limit at a tracker's current running totals -- `null` while
 *  that limit is unset (unbounded), otherwise never negative. */
export interface AggregateFileAllowance {
  readonly remainingFiles: number | null;
  readonly remainingTotalSize: number | null;
}

/**
 * Shared `maxFiles`/`maxTotalSize` running-total arithmetic for `lr-file-input` and
 * `lr-drop-zone`, so the two controls cannot independently drift on it. Each accepted file
 * increments the running count/byte-total the tracker starts from; a file that would push either
 * running total past its limit is rejected without being counted.
 *
 * Construct one tracker per classification pass, seeded from the caller's own combined baseline
 * -- the running total a retaining component already holds (its own internal file list) plus any
 * externally held baseline the host reports (e.g. `heldFileCount`/`heldTotalSize`), added
 * together by the caller *before* normalizing the externally supplied half through
 * {@linkcode finiteCount}. Passing `0`/`0` (or omitting both arguments) reproduces the exact
 * arithmetic both components shipped before an externally held baseline existed.
 */
export class AggregateFileLimitTracker {
  private count: number;
  private size: number;

  constructor(baselineFileCount = 0, baselineTotalSize = 0) {
    // Defense in depth: a caller-computed baseline is expected to already be a finite,
    // non-negative number by the time it reaches here, but a negative/NaN/Infinity value must
    // never corrupt every later comparison in this tracker's lifetime.
    this.count = finiteCount(baselineFileCount, 0);
    this.size = finiteCount(baselineTotalSize, 0);
  }

  /**
   * Evaluates one candidate file against `limits` and this tracker's running totals. Returns the
   * rejection reason and leaves the running totals unchanged, or returns `null` and records the
   * acceptance -- incrementing both running totals. A non-finite `file.size` (e.g. a synthetic
   * dragenter-preview item, which has none) contributes `0` to the running byte total, and can
   * never itself trigger a `'maxTotalSize'` rejection: `this.size + undefined` is `NaN`, and every
   * comparison against `NaN` is `false`.
   */
  evaluate(file: File, limits: AggregateFileLimits): 'maxFiles' | 'maxTotalSize' | null {
    const { maxFiles, maxTotalSize } = limits;
    if (maxFiles !== null && this.count + 1 > maxFiles) return 'maxFiles';
    if (maxTotalSize !== null && this.size + file.size > maxTotalSize) return 'maxTotalSize';
    this.count += 1;
    this.size += Number.isFinite(file.size) ? file.size : 0;
    return null;
  }

  /** Remaining allowance under `limits` at this tracker's current running totals -- attach to a
   *  classification result's emitted detail so a consumer can render "you can add N more files". */
  allowance(limits: AggregateFileLimits): AggregateFileAllowance {
    const { maxFiles, maxTotalSize } = limits;
    return {
      remainingFiles: maxFiles === null ? null : Math.max(0, maxFiles - this.count),
      remainingTotalSize: maxTotalSize === null ? null : Math.max(0, maxTotalSize - this.size),
    };
  }
}
