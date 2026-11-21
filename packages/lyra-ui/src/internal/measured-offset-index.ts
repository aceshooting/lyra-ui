import { finiteInteger, finiteRange } from './numbers.js';

function isExactSum(value: number): boolean {
  return Math.abs(value) <= Number.MAX_SAFE_INTEGER;
}

/** Bounds for {@link MeasuredOffsetIndex} heights and offsets. */
export interface MeasuredOffsetIndexOptions {
  /** Smallest stored height; `0` keeps collapsed rows. Defaults to `1`. */
  readonly minimumHeight?: number;
  /** Ceiling for one height and every reported offset. Defaults to `Number.MAX_SAFE_INTEGER`;
   *  up to `Number.MAX_VALUE`. */
  readonly maximumTotal?: number;
}

/**
 * Prefix-sum index (Fenwick tree) over variable item heights: logarithmic height updates,
 * offset-of-index and index-at-offset queries. Heights are clamped finite into
 * `[minimumHeight, maximumTotal]` (subpixel values kept) and reported offsets saturate at
 * `maximumTotal`, so hostile or measured-NaN values cannot poison it. A node update that leaves
 * the safe-integer range rebuilds from the stored heights, so shrinking a huge height restores the
 * true offsets instead of keeping a rounded or infinite sum.
 */
export class MeasuredOffsetIndex {
  private heights: number[] = [];
  private tree: number[] = [0];
  private fallback: number;
  private readonly minimum: number;
  private readonly maximum: number;

  constructor(estimate = 1, count = 0, options: MeasuredOffsetIndexOptions = {}) {
    this.maximum = finiteRange(options.maximumTotal ?? Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, 1, Number.MAX_VALUE);
    this.minimum = finiteRange(options.minimumHeight ?? 1, 1, 0, this.maximum);
    this.fallback = this.clamp(estimate, Math.max(1, this.minimum));
    this.resize(count);
  }

  private clamp(height: number, fallback: number): number {
    return finiteRange(height, fallback, this.minimum, this.maximum);
  }

  /** Number of indexed items. */
  get length(): number {
    return this.heights.length;
  }

  /** Sum of every height. */
  get total(): number {
    return this.offsetOf(this.heights.length);
  }

  /** Changes the item count; kept items keep their heights, new ones take the estimate. */
  resize(count: number): void {
    const n = finiteInteger(count, 0, 0, 0x7fffffff);
    if (n > this.heights.length) {
      this.append(Array.from({ length: n - this.heights.length }, () => this.fallback));
      return;
    }
    this.rebuild(this.heights.slice(0, n));
  }

  /** Appends items in amortized O(log n) each; invalid heights take the estimate. */
  append(heights: readonly number[]): void {
    let exact = true;
    for (const height of heights) {
      const value = this.clamp(height, this.fallback);
      this.heights.push(value);
      const position = this.heights.length;
      // A new Fenwick node covers (position - lowbit, position]: its own height plus the
      // already-built nodes for the rest of that range.
      const node = value + this.rawOffset(position - 1) - this.rawOffset(position - (position & -position));
      if (!isExactSum(node)) exact = false;
      this.tree.push(node);
    }
    if (!exact) this.rebuild(this.heights);
  }

  /** Replaces every height (and the estimate used for later growth). */
  reset(heights: readonly number[], estimate = this.fallback): void {
    this.fallback = this.clamp(estimate, Math.max(1, this.minimum));
    const clamped: number[] = [];
    for (let index = 0; index < heights.length; index += 1) clamped.push(this.clamp(heights[index]!, this.fallback));
    this.rebuild(clamped);
  }

  /** Height of one item (0 outside the range). */
  heightAt(index: number): number {
    return index >= 0 && index < this.heights.length ? this.heights[Math.trunc(index)]! : 0;
  }

  /** Sets one item's height in O(log n); out-of-range indexes are ignored. */
  set(index: number, height: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.heights.length) return;
    const previous = this.heights[index]!;
    const next = this.clamp(height, previous);
    const delta = next - previous;
    if (delta === 0) return;
    this.heights[index] = next;
    let exact = true;
    for (let position = index + 1; position < this.tree.length; position += position & -position) {
      const sum = this.tree[position]! + delta;
      if (!isExactSum(sum) || !isExactSum(this.tree[position]!)) exact = false;
      this.tree[position] = sum;
    }
    if (!exact) this.rebuild(this.heights);
  }

  /** Pixel offset of item `index`'s top (`index === length` yields the total). */
  offsetOf(index: number): number {
    return Math.min(this.rawOffset(finiteInteger(index, 0, 0, this.heights.length)), this.maximum);
  }

  /** Index of the item containing offset `px` (clamped to the last item; -1 when empty). */
  indexAt(px: number): number {
    return this.findIndex(px, true);
  }

  /** Last item whose top is strictly before offset `px` (clamped to the list; -1 when empty). */
  indexBefore(px: number): number {
    return this.findIndex(px, false);
  }

  private findIndex(px: number, includeBoundary: boolean): number {
    const n = this.heights.length;
    if (n === 0) return -1;
    const target = finiteRange(px, 0, 0, this.maximum);
    let index = 0;
    let sum = 0;
    let step = 1;
    while (step * 2 <= n) step *= 2;
    for (; step > 0; step >>>= 1) {
      const next = index + step;
      if (next > n) continue;
      const candidate = sum + this.tree[next]!;
      if (candidate < target || (includeBoundary && candidate === target)) {
        sum = candidate;
        index = next;
      }
    }
    return Math.min(index, n - 1);
  }

  private rawOffset(count: number): number {
    let sum = 0;
    for (let position = count; position > 0; position -= position & -position) sum += this.tree[position]!;
    return Math.max(0, sum);
  }

  private rebuild(heights: number[]): void {
    this.heights = heights;
    const tree = [0, ...heights];
    for (let index = 1; index < tree.length; index += 1) {
      const parent = index + (index & -index);
      if (parent < tree.length) tree[parent] = tree[parent]! + tree[index]!;
    }
    this.tree = tree;
  }
}
