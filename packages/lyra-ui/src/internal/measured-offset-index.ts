import { finiteInteger, finiteRange } from './numbers.js';

/**
 * Prefix-sum index (Fenwick tree) over variable item heights: logarithmic height updates,
 * offset-of-index and index-at-offset queries. Heights are clamped finite and at least 1, and
 * sums saturate at `Number.MAX_SAFE_INTEGER`, so hostile or measured-NaN values cannot poison it.
 */
export class MeasuredOffsetIndex {
  private heights: number[] = [];
  private tree: number[] = [0];
  private fallback: number;

  constructor(estimate = 1, count = 0) {
    this.fallback = MeasuredOffsetIndex.clamp(estimate, 1);
    this.resize(count);
  }

  private static clamp(height: number, fallback: number): number {
    return finiteRange(height, fallback, 1, Number.MAX_SAFE_INTEGER);
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
    const heights = this.heights.slice(0, n);
    while (heights.length < n) heights.push(this.fallback);
    this.rebuild(heights);
  }

  /** Replaces every height (and the estimate used for later growth). */
  reset(heights: readonly number[], estimate = this.fallback): void {
    this.fallback = MeasuredOffsetIndex.clamp(estimate, 1);
    this.rebuild(Array.from(heights, (height) => MeasuredOffsetIndex.clamp(height, this.fallback)));
  }

  /** Height of one item (0 outside the range). */
  heightAt(index: number): number {
    return index >= 0 && index < this.heights.length ? this.heights[Math.trunc(index)]! : 0;
  }

  /** Sets one item's height in O(log n); out-of-range indexes are ignored. */
  set(index: number, height: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.heights.length) return;
    const next = MeasuredOffsetIndex.clamp(height, this.heights[index]!);
    const delta = next - this.heights[index]!;
    if (delta === 0) return;
    this.heights[index] = next;
    for (let position = index + 1; position < this.tree.length; position += position & -position) {
      this.tree[position] = Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, this.tree[position]! + delta));
    }
  }

  /** Pixel offset of item `index`'s top (`index === length` yields the total). */
  offsetOf(index: number): number {
    let sum = 0;
    for (let position = finiteInteger(index, 0, 0, this.heights.length); position > 0; position -= position & -position) {
      sum += this.tree[position] ?? 0;
    }
    return Math.min(sum, Number.MAX_SAFE_INTEGER);
  }

  /** Index of the item containing offset `px` (clamped to the last item; -1 when empty). */
  indexAt(px: number): number {
    const n = this.heights.length;
    if (n === 0) return -1;
    const target = finiteRange(px, 0, 0, Number.MAX_SAFE_INTEGER);
    let index = 0;
    let sum = 0;
    let step = 1;
    while (step * 2 <= n) step *= 2;
    for (; step > 0; step >>>= 1) {
      const next = index + step;
      if (next <= n && sum + this.tree[next]! <= target) {
        sum += this.tree[next]!;
        index = next;
      }
    }
    return Math.min(index, n - 1);
  }

  private rebuild(heights: number[]): void {
    this.heights = heights;
    const tree = [0, ...heights];
    for (let index = 1; index < tree.length; index += 1) {
      const parent = index + (index & -index);
      if (parent < tree.length) tree[parent] = Math.min(Number.MAX_SAFE_INTEGER, tree[parent]! + tree[index]!);
    }
    this.tree = tree;
  }
}
