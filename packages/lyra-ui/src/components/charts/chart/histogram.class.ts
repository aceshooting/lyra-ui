import type { PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraChart, lockChartType, type Series } from './chart.class.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { srOnly } from '../../../internal/a11y.js';
import {
  binValues,
  normalizeHistogramBinCount,
  type HistogramBucket,
} from './histogram-bin.js';
import { styles } from './histogram.styles.js';

/**
 * `<lr-histogram>` — bins `values` into `bins` equal-width buckets and
 * renders them as a bar chart. Chart.js has no built-in histogram
 * controller; this composes `binValues()` with the plain `bar` type.
 *
 * @customElement lr-histogram
 */
export class LyraHistogram extends LyraChart {
  // Explicit rather than relying on `LyraChart`'s inherited `static styles` —
  // `histogram.styles.ts` re-exports the same `chart.styles.ts` sheet, so
  // this is behaviorally identical, but it keeps the per-component styles
  // file meaningful instead of dead weight. `srOnly` must still be included
  // here (mirrors `LyraChart.styles`) since the inherited `renderDataTable()`
  // relies on it to visually hide the fallback `<table>`/description when
  // `showDataTable` is false.
  static override styles = [LyraElement.styles, styles, srOnly];

  override type = 'bar' as const;

  @property({ converter: { fromAttribute: (value) => normalizeHistogramBinCount(value) } })
  bins = 10;
  @property({ attribute: false }) values: number[] = [];
  /** Dataset label used for the legend/tooltip/accessible summary. Falls back to a localized "Frequency" when unset. */
  @property() label = '';

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (['values', 'bins', 'label', 'locale', 'strings'].some((name) => changed.has(name))) {
      this.refreshTheme();
    }
  }
}

// Both the `labels` and `datasets` accessors below derive from the same
// `binValues(values, bins)` pass, and `LyraChart` reads `datasets` more than
// once per `draw()`/`render()` — memoize the last bucketing result per
// instance (keyed by reference equality on `values`/`bins`, matching Lit's
// own change detection for the `values` array) so an unrelated property
// change doesn't re-run the O(n) bucketing loop from scratch on every access.
const bucketCache = new WeakMap<
  LyraHistogram,
  { values: number[]; bins: number; locale: string; buckets: HistogramBucket[] }
>();

export function binnedBuckets(el: LyraHistogram): HistogramBucket[] {
  const bins = normalizeHistogramBinCount(el.bins);
  const locale = (el as unknown as { effectiveLocale: string }).effectiveLocale;
  const cached = bucketCache.get(el);
  if (
    cached &&
    cached.values === el.values &&
    cached.bins === bins &&
    cached.locale === locale
  ) {
    return cached.buckets;
  }
  const buckets = binValues(el.values, bins, locale);
  bucketCache.set(el, { values: el.values, bins, locale, buckets });
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
    return [
      {
        label: this.label || this.localize('histogramFrequency'),
        data: binnedBuckets(this).map((b) => b.count),
      },
    ];
  },
  set(_v: Series[]) {
    /* derived from `values`/`bins`; direct writes are ignored */
  },
});

// `type` is locked to `'bar'` the same way — the field initializer above is
// just a default value, not an enforced lock, so without this a `type="line"`
// attribute (or `el.type = 'line'`) would silently turn a histogram into a
// line chart of its own bucket counts.
lockChartType(LyraHistogram, 'bar');


declare global {
  interface HTMLElementTagNameMap {
    'lr-histogram': LyraHistogram;
  }
}
