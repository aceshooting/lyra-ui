import { property } from 'lit/decorators.js';
import { LyraChart, type Series } from './chart.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { binValues, type HistogramBucket } from './histogram-bin.js';
import { styles } from './histogram.styles.js';

/**
 * `<lyra-histogram>` — bins `values` into `bins` equal-width buckets and
 * renders them as a bar chart. Chart.js has no built-in histogram
 * controller; this composes `binValues()` with the plain `bar` type.
 *
 * @customElement lyra-histogram
 */
export class LyraHistogram extends LyraChart {
  // Explicit rather than relying on `LyraChart`'s inherited `static styles` —
  // `histogram.styles.ts` re-exports the same `chart.styles.ts` sheet, so
  // this is behaviorally identical, but it keeps the per-component styles
  // file meaningful instead of dead weight.
  static override styles = [LyraElement.styles, styles];

  override type = 'bar' as const;

  @property({ type: Number }) bins = 10;
  @property({ attribute: false }) values: number[] = [];
  @property() label = 'Frequency';
}

// Both the `labels` and `datasets` accessors below derive from the same
// `binValues(values, bins)` pass, and `LyraChart` reads `datasets` more than
// once per `draw()`/`render()` — memoize the last bucketing result per
// instance (keyed by reference equality on `values`/`bins`, matching Lit's
// own change detection for the `values` array) so an unrelated property
// change doesn't re-run the O(n) bucketing loop from scratch on every access.
const bucketCache = new WeakMap<
  LyraHistogram,
  { values: number[]; bins: number; buckets: HistogramBucket[] }
>();

export function binnedBuckets(el: LyraHistogram): HistogramBucket[] {
  const cached = bucketCache.get(el);
  if (cached && cached.values === el.values && cached.bins === el.bins) {
    return cached.buckets;
  }
  const buckets = binValues(el.values, el.bins);
  bucketCache.set(el, { values: el.values, bins: el.bins, buckets });
  return buckets;
}

// `labels`/`datasets` are computed from `values`/`bins` rather than settable
// props. `LyraChart` declares both as plain (decorator-managed) class
// fields, and TypeScript forbids a subclass from re-declaring a base field
// as a getter/setter pair via ordinary class syntax (TS2611) — so the
// accessor pair is installed directly on the prototype instead, which is
// runtime-equivalent (same shadowing semantics as a class-syntax override)
// without tripping that check.
Object.defineProperty(LyraHistogram.prototype, 'labels', {
  configurable: true,
  enumerable: true,
  get(this: LyraHistogram): string[] {
    return binnedBuckets(this).map((b) => b.label);
  },
  set(_v: string[]) {
    /* derived from `values`/`bins`; direct writes are ignored */
  },
});

Object.defineProperty(LyraHistogram.prototype, 'datasets', {
  configurable: true,
  enumerable: true,
  get(this: LyraHistogram): Series[] {
    return [{ label: this.label, data: binnedBuckets(this).map((b) => b.count) }];
  },
  set(_v: Series[]) {
    /* derived from `values`/`bins`; direct writes are ignored */
  },
});

// `type` is locked to `'bar'` the same way — the field initializer above is
// just a default value, not an enforced lock, so without this a `type="line"`
// attribute (or `el.type = 'line'`) would silently turn a histogram into a
// line chart of its own bucket counts.
Object.defineProperty(LyraHistogram.prototype, 'type', {
  configurable: true,
  enumerable: true,
  get(): 'bar' {
    return 'bar';
  },
  set(_v: 'bar') {
    /* locked to 'bar'; direct writes are ignored */
  },
});

defineElement('histogram', LyraHistogram);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-histogram': LyraHistogram;
  }
}
