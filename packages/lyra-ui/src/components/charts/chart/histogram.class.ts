import { collectionSupport, publicCollectionTruncation } from '../../../internal/collection-snapshot.js';
import type { PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import {
  LyraChart,
  projectChartSeries,
  type LyraChartConfiguration,
  type LyraChartSeries,
} from './chart.class.js';
import { lockChartType } from './chart-type-lock.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { srOnly } from '../../../internal/a11y.js';
import { specialistTokens } from '../../../internal/specialist-host-tokens.styles.js';
import {
  normalizeHistogramBinCount,
  type HistogramBucket,
} from './histogram-bin.js';
import { styles } from './histogram.styles.js';
import { chartSurfaceStyles } from './chart-surface.styles.js';
import type { LyraHistogramDistribution, LyraPreparedCategoryData } from '../../../utilities/data-preparation.js';
export type { LyraHistogramDistribution } from '../../../utilities/data-preparation.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import type { LyraChartPreparedData } from './chart-prepared-data.js';
import { binnedBuckets, distributionBuckets, invalidateHistogramBuckets, snapshotHistogramDistribution } from './histogram-buckets.js';
export { binnedBuckets } from './histogram-buckets.js';
import { bidiStyles } from './chart-bidi.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_histogramDistributionRange, LYRA_DEFAULT_histogramDistributionSummary, LYRA_DEFAULT_histogramFrequency, LYRA_DEFAULT_histogramInputLimit } from '../../../internal/default-strings/charts.generated.js';
import { LYRA_DEFAULT_chartSummarySeparator } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** The `values` snapshot keeps at most this many samples. */
const MAX_HISTOGRAM_SAMPLES = 10_000;
const incompatibleDistribution = Object.freeze({}) as LyraChartPreparedData;

interface HistogramAppendBatch {
  readonly source: readonly (number | null)[];
  readonly limit: number;
  readonly newest: number[];
  cursor: number;
}

/**
 * `<lr-histogram>` — bins `values` into `bins` equal-width buckets and
 * renders them as a bar chart. Chart.js has no built-in histogram
 * controller; this composes `binValues()` with the plain `bar` type.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * `distribution` supplies exact pre-binned whole-source counts without retaining raw samples.
 * It takes precedence over values, bins and inherited preparedData. The plot/table/CSV contain
 * only bins; the visible and accessible summary also reports invalid and out-of-range counts.
 * Bin intervals are half-open except the final inclusive upper edge. Bins must fit maxRecords
 * and the inherited table budget; incompatible distributions are visibly rejected, never sampled.
 * Inherited preparedData without distribution is incompatible with histogram bin semantics.
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
    chartSummarySeparator: LYRA_DEFAULT_chartSummarySeparator,
    histogramDistributionRange: LYRA_DEFAULT_histogramDistributionRange,
    histogramDistributionSummary: LYRA_DEFAULT_histogramDistributionSummary,
    histogramFrequency: LYRA_DEFAULT_histogramFrequency,
    histogramInputLimit: LYRA_DEFAULT_histogramInputLimit,
  };
  // GENERATED DEFAULT-STRING SLICE: END
  protected static override collectionSupport = collectionSupport;

  protected static override readonly ownedCollectionProperties = Object.freeze(['values']);
  /** Samples arrive by appending, so an over-long assignment keeps its newest samples. */
  protected static readonly appendOrderedCollectionProperties = Object.freeze(['values']);

  // Explicit rather than relying on `LyraChart`'s inherited `static styles` —
  // `histogram.styles.ts` re-exports the same `chart.styles.ts` sheet. The shared
  // surface sheet supplies host/plot sizing and the accessible legend, so both
  // must be adopted to preserve the base chart's layout. `srOnly` must still be included
  // here (mirrors `LyraChart.styles`) since the inherited `renderDataTable()`
  // relies on it to visually hide the fallback `<table>`/description when
  // `withDataTable` is false.
  static override styles = [LyraElement.styles, specialistTokens, chartSurfaceStyles, styles, srOnly, bidiStyles];

  override type = 'bar' as const;

  @property({ converter: { fromAttribute: (value) => normalizeHistogramBinCount(value) } })
  bins = 10;
  /** Raw samples to bin: a bounded, clone-owned readonly snapshot. An array longer than 10,000
   *  keeps its newest 10,000 samples. */
  @property({ attribute: false }) values: readonly number[] = [];
  /** Dataset label used for the legend, tooltip, table, and summary. */
  @property({ attribute: 'series-label' }) seriesLabel = '';

  /** Exact bounded distribution, normally from prepareLyraHistogram. Property-only; null keeps
   * the raw rolling-window route. At most 1,000 bins; maxRecords must admit every bin. A bounded
   * own-data snapshot is taken on assignment or explicit requestUpdate(); accessors are rejected.
   * Reassign or explicitly refresh after mutating a descriptor. Raw append calls are inactive
   * while supplied, and assignment cancels any unfinished raw append. */
  @property({ attribute: false })
  get distribution(): LyraHistogramDistribution | null { return this._distribution; }
  set distribution(value: LyraHistogramDistribution | null) {
    const old = this._distribution;
    this._distribution = value;
    this.requestUpdate('distribution', old);
  }
  private _distribution: LyraHistogramDistribution | null = null;
  private distributionDirty = true;
  private distributionSnapshot?: LyraHistogramDistribution;
  private distributionProjection?: LyraPreparedCategoryData;
  private distributionLocale?: string;
  private distributionLabel?: string;

  private refreshDistribution(): void {
    if (!this.distributionDirty) return;
    this.distributionDirty = false;
    this.distributionSnapshot = undefined;
    this.distributionProjection = undefined;
    if (this._distribution == null) return;
    try {
      const snapshot = snapshotHistogramDistribution(this._distribution);
      const buckets = distributionBuckets(snapshot, this.effectiveLocale);
      const count = snapshot.counts.validCount - snapshot.belowCount - snapshot.aboveCount;
      this.distributionProjection = Object.freeze({
        kind: 'categories', revision: snapshot.revision, aggregation: 'count',
        counts: Object.freeze({ sourceCount: count, validCount: count, invalidCount: 0 }),
        categories: Object.freeze(buckets.map((bucket, index) => Object.freeze({ id: `bin${index}`, label: bucket.label.replace(/^\u2066|\u2069$/gu, '') }))),
        categoryCounts: snapshot.binCounts,
        series: Object.freeze([Object.freeze({ id: 'histogram', label: this.seriesLabel || this.localize('histogramFrequency'), values: snapshot.binCounts })]),
      });
      this.distributionSnapshot = snapshot;
    } catch { /* The base prepared-input validator renders the localized unavailable state. */ }
  }

  protected override preparedDataInput(): LyraChartPreparedData | null {
    this.refreshDistribution();
    if (this._distribution != null) return this.distributionProjection ?? incompatibleDistribution;
    return this.preparedData == null ? null : incompatibleDistribution;
  }

  protected override willUpdate(changed: PropertyValues): void {
    const locale = this.effectiveLocale;
    const label = this.seriesLabel || this.localize('histogramFrequency');
    if (locale !== this.distributionLocale || label !== this.distributionLabel) {
      this.distributionLocale = locale; this.distributionLabel = label;
      this.distributionDirty = true;
      if (this._distribution != null) super.requestUpdate('preparedData', undefined);
    }
    super.willUpdate(changed);
  }

  /** @internal Histogram bins preserve bin activation without fabricated category identities. */
  protected override emitPreparedSourceSelection(_datasetIndex: number, _index: number): void {}

  /** @internal Report the full distribution, including observations outside the plotted bins. */
  protected override preparedSummary(): string | undefined {
    const snapshot = this.distributionSnapshot;
    if (!snapshot) return undefined;
    const format = getNumberFormat(this.effectiveLocale);
    const summary = this.localize('histogramDistributionSummary', undefined, {
      validCount: format.format(snapshot.counts.validCount), invalidCount: format.format(snapshot.counts.invalidCount),
      belowCount: format.format(snapshot.belowCount), aboveCount: format.format(snapshot.aboveCount),
    });
    return snapshot.domain ? [summary, this.localize('histogramDistributionRange', undefined, {
      min: format.format(snapshot.domain.min), max: format.format(snapshot.domain.max),
    })].join(this.localize('chartSummarySeparator')) : summary;
  }

  private readonly sampleBatches: HistogramAppendBatch[] = [];
  private sampleTimer?: ReturnType<typeof setTimeout>;
  private committingSamples = false;

  /**
   * Appends raw finite samples to `values`, keeping a rolling window of the newest `maxSamples`
   * samples (at most 10,000, the `values` snapshot bound, which is also the default). The inherited
   * signature is retained so histogram remains substitutable for `LyraChart`; its category label
   * has no meaning for rebinned samples. Invalid-heavy batches finish in bounded asynchronous
   * chunks, in call order; assigning values or disconnecting cancels unfinished appends.
   * Queued arrays remain caller-owned and must stay unchanged until their batch is applied.
   */
  appendSamples(values: readonly (number | null)[], maxSamples: number = 0): void {
    if (this._distribution != null || !Array.isArray(values)) return;
    const requested = Number.isFinite(maxSamples) ? Math.max(0, Math.floor(maxSamples)) : 0;
    const limit = requested > 0 ? Math.min(requested, MAX_HISTOGRAM_SAMPLES) : MAX_HISTOGRAM_SAMPLES;
    this.sampleBatches.push({ source: values, limit, newest: [], cursor: values.length - 1 });
    if (this.sampleBatches.length === 1) this.continueSampleBatch();
  }

  private cancelSampleBatches(): void {
    clearTimeout(this.sampleTimer);
    this.sampleTimer = undefined;
    if (this.sampleBatches) this.sampleBatches.length = 0;
  }

  override requestUpdate(name?: PropertyKey, oldValue?: unknown, options?: Parameters<LyraElement['requestUpdate']>[2]): void {
    if ((name === 'values' && !this.committingSamples) || name === 'distribution' ||
      (name === undefined && this._distribution != null)) this.cancelSampleBatches();
    if (name === undefined || ['distribution', 'seriesLabel', 'locale', 'strings'].includes(String(name))) {
      this.distributionDirty = true;
      invalidateHistogramBuckets(this);
      if (name !== undefined && this._distribution != null) super.requestUpdate('preparedData', undefined);
      if (name === 'distribution' && this._distribution == null) super.requestUpdate('preparedData', undefined);
    }
    super.requestUpdate(name, oldValue, options);
  }

  override disconnectedCallback(): void {
    this.cancelSampleBatches();
    super.disconnectedCallback();
  }

  private continueSampleBatch(): void {
    const batch = this.sampleBatches[0];
    if (!batch) return;
    const end = Math.max(-1, batch.cursor - 10_000);
    // Read newest-first, retaining only the rolling window and yielding on invalid-heavy input.
    for (; batch.cursor > end && batch.newest.length < batch.limit; batch.cursor--) {
      let value: unknown;
      try { value = batch.source[batch.cursor]; }
      catch {
        if (this.sampleBatches[0] !== batch) return;
        continue;
      }
      if (this.sampleBatches[0] !== batch) return;
      if (typeof value === 'number' && Number.isFinite(value)) batch.newest.push(value);
    }
    if (batch.cursor < 0 || batch.newest.length === batch.limit) {
      for (let index = this.values.length - 1; index >= 0 && batch.newest.length < batch.limit; index--)
        batch.newest.push(this.values[index]!);
      batch.newest.reverse();
      this.sampleBatches.shift();
      this.committingSamples = true;
      try { this.withStreamedTableUpdate(() => { this.values = batch.newest; }); }
      finally { this.committingSamples = false; }
    }
    if (this.sampleBatches.length) {
      this.sampleTimer = setTimeout(() => {
        this.sampleTimer = undefined;
        this.continueSampleBatch();
      }, 0);
    }
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

  protected override inputLimitMessage(): string {
    if (this._distribution != null) return this.preparedSummary() ?? '';
    return publicCollectionTruncation(this, 'values') ? this.localize('histogramInputLimit') : super.inputLimitMessage();
  }

  protected override chartContentChanged(changed: PropertyValues): boolean {
    return (
      super.chartContentChanged(changed) ||
      ['values', 'bins', 'seriesLabel', 'distribution'].some((name) => changed.has(name))
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
        projectChartSeries({ label, data: Object.freeze(buckets.map((b) => b.count)) })!,
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
