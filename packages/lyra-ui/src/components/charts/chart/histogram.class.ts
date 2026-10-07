import { collectionSupport } from '../../../internal/collection-snapshot.js';
import type { PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import {
  LyraChart,
  type LyraChartConfiguration,
  type LyraChartSeries,
} from './chart.class.js';
import { lockChartType } from './chart-type-lock.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { srOnly } from '../../../internal/a11y.js';
import { specialistTokens } from '../../../internal/specialist-tokens.styles.js';
import {
  normalizeHistogramBinCount,
  type HistogramBucket,
} from './histogram-bin.js';
import { styles } from './histogram.styles.js';
import { binnedBuckets } from './histogram-buckets.js';
export { binnedBuckets } from './histogram-buckets.js';
import { bidiStyles } from './chart-bidi.js';
import { chartSyncStyles } from './chart-sync.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_histogramFrequency } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** The `values` snapshot keeps at most this many samples. */
const MAX_HISTOGRAM_SAMPLES = 10_000;

/**
 * `<lr-histogram>` — bins `values` into `bins` equal-width buckets and
 * renders them as a bar chart. Chart.js has no built-in histogram
 * controller; this composes `binValues()` with the plain `bar` type.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * @customElement lr-histogram
 * @status stable
 * @since 4.0.0
 */
export class LyraHistogram extends LyraChart {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    histogramFrequency: LYRA_DEFAULT_histogramFrequency,
  };
  // GENERATED DEFAULT-STRING SLICE: END
  protected static override collectionSupport = collectionSupport;

  protected static override readonly ownedCollectionProperties = Object.freeze(['values']);
  /** Samples arrive by appending, so an over-long assignment keeps its newest samples. */
  protected static readonly appendOrderedCollectionProperties = Object.freeze(['values']);

  // Explicit rather than relying on `LyraChart`'s inherited `static styles` —
  // `histogram.styles.ts` re-exports the same `chart.styles.ts` sheet, so
  // this is behaviorally identical, but it keeps the per-component styles
  // file meaningful instead of dead weight. `srOnly` must still be included
  // here (mirrors `LyraChart.styles`) since the inherited `renderDataTable()`
  // relies on it to visually hide the fallback `<table>`/description when
  // `withDataTable` is false.
  static override styles = [LyraElement.styles, specialistTokens, styles, srOnly, bidiStyles, chartSyncStyles];

  override type = 'bar' as const;

  @property({ converter: { fromAttribute: (value) => normalizeHistogramBinCount(value) } })
  bins = 10;
  /** Raw samples to bin: a bounded, clone-owned readonly snapshot. An array longer than 10,000
   *  keeps its newest 10,000 samples. */
  @property({ attribute: false }) values: readonly number[] = [];
  /** Dataset label used for the legend, tooltip, table, and summary. */
  @property({ attribute: 'series-label' }) seriesLabel = '';

  /**
   * Appends raw finite samples to `values`, keeping a rolling window of the newest `maxSamples`
   * samples (at most 10,000, the `values` snapshot bound, which is also the default). The inherited
   * signature is retained so histogram remains substitutable for `LyraChart`; its category label
   * has no meaning for rebinned samples.
   */
  appendSamples(values: readonly (number | null)[], maxSamples: number = 0): void {
    const appended = values.filter((value): value is number =>
      typeof value === 'number' && Number.isFinite(value),
    );
    const requested = Number.isFinite(maxSamples) ? Math.max(0, Math.floor(maxSamples)) : 0;
    // `values` keeps the FIRST 10,000 entries of an assigned array, so appending past it would
    // silently discard every new sample; drop the oldest ones instead.
    const limit = requested > 0 ? Math.min(requested, MAX_HISTOGRAM_SAMPLES) : MAX_HISTOGRAM_SAMPLES;
    this.values = [...this.values, ...appended].slice(-limit);
  }

  private normalizedConfig?: {
    source: LyraChartConfiguration;
    value: LyraChartConfiguration;
  };

  protected override normalizeEffectiveConfig(
    config: LyraChartConfiguration | undefined,
  ): LyraChartConfiguration | undefined {
    if (!config) return undefined;
    if (this.normalizedConfig?.source === config) return this.normalizedConfig.value;
    // Histogram owns its bar controller and derives every category/datum from `values`/`bins`.
    // Preserve advanced options/plugins while preventing raw fixed keys from turning it into a
    // different chart or silently replacing the derived distribution.
    const normalized = { ...config };
    delete normalized.type;
    delete normalized.data;
    this.normalizedConfig = { source: config, value: normalized };
    return normalized;
  }

  /**
   * Inherited `LyraChart` signature, retained so histogram stays substitutable for its base class;
   * `_label` has no meaning for rebinned samples and is ignored. Prefer the histogram-specific
   * `appendSamples(values, maxSamples?)` alongside it — same behavior, without the unused label
   * parameter.
   */
  override appendData(_label: string, values: (number | null)[], maxPoints: number = 0): void {
    this.appendSamples(values, maxPoints);
  }

  protected override chartContentChanged(changed: PropertyValues): boolean {
    return (
      super.chartContentChanged(changed) ||
      ['values', 'bins', 'seriesLabel'].some((name) => changed.has(name))
    );
  }
}

// The derived arrays keep one identity per bucketing (and series label), so `LyraChart`'s
// identity-keyed memos hold across the many reads of one update.
const derivedCache = new WeakMap<
  LyraHistogram,
  { buckets: HistogramBucket[]; label: string; labels: string[]; datasets: LyraChartSeries[] }
>();

function derivedSeries(el: LyraHistogram, label: string) {
  const buckets = binnedBuckets(el);
  let cached = derivedCache.get(el);
  if (cached?.buckets !== buckets || cached.label !== label) {
    cached = {
      buckets,
      label,
      // `binValues()` keeps its public isolate controls; the chart isolates each surface itself
      // (chart-bidi.ts), so they never reach exports, events or accessible text.
      labels: Object.freeze(buckets.map((b) => b.label.replace(/^\u2066|\u2069$/gu, ''))) as string[],
      datasets: Object.freeze([
        Object.freeze({ label, data: Object.freeze(buckets.map((b) => b.count)) }),
      ]) as LyraChartSeries[],
    };
    derivedCache.set(el, cached);
  }
  return cached;
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
    return derivedSeries(this, this.seriesLabel || this.localize('histogramFrequency')).labels;
  },
  set(_v: string[]) {
    /* derived from `values`/`bins`; direct writes are ignored */
  },
});

Object.defineProperty(LyraHistogram.prototype, 'datasets', {
  configurable: true,
  enumerable: true,
  get(this: LyraHistogram): LyraChartSeries[] {
    return derivedSeries(this, this.seriesLabel || this.localize('histogramFrequency')).datasets;
  },
  set(_v: LyraChartSeries[]) {
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
