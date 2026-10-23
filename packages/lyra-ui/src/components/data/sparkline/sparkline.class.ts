import { html, nothing, svg, type TemplateResult, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { prepareChartModel, type PreparedChartSeries } from '../../charts/chart/chart-prepared-data.js';
import type { LyraPreparedSeriesData } from '../../../utilities/data-preparation.js';
export type { LyraPreparedSeriesData } from '../../../utilities/data-preparation.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { nextId } from '../../../internal/a11y.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { finiteNumber, finiteRatio } from '../../../internal/numbers.js';
import { styles } from './sparkline.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_trendOf } from '../../../internal/default-strings/data.generated.js';
import { LYRA_DEFAULT_chartPreparedSummary, LYRA_DEFAULT_chartPreparedUnavailable, LYRA_DEFAULT_chartSummary, LYRA_DEFAULT_chartSummarySeparator, LYRA_DEFAULT_chartTrendDecreasing, LYRA_DEFAULT_chartTrendFlat, LYRA_DEFAULT_chartTrendIncreasing, LYRA_DEFAULT_noData } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

const VIEW = 100;
const MAX_POINTS = 500;

export type LyraSparklineAppearance = 'gradient' | 'line' | 'solid';
export type LyraSparklineCurve = 'linear' | 'natural' | 'step';
export type LyraSparklineTrend = 'positive' | 'negative' | 'neutral';
/** Geometry used to plot each sample. */
export type LyraSparklineMark = 'line' | 'bar';

interface SparklineSample {
  readonly values: number[];
  readonly positions: number[];
  readonly count: number;
}

/** Keeps endpoints and each source bucket's extrema, with no full filtered input copy. */
function sampleValues(data: string, values: readonly number[]): SparklineSample {
  const text = data.trim();
  const length = text ? text.length : Array.isArray(values) ? values.length : 0;
  const bucketCount = (MAX_POINTS - 2) / 2;
  type Sample = { value: number; index: number };
  const buckets: { min: Sample; max: Sample }[] = [];
  const small: Sample[] = [];
  let count = 0;
  let first: Sample | undefined;
  let last: Sample | undefined;
  const accept = (value: number, offset: number): void => {
    if (!Number.isFinite(value)) return;
    const index = count++;
    const sample = { value, index };
    first ??= sample;
    last = sample;
    if (small.length < MAX_POINTS) small.push(sample);
    const bucketIndex = Math.min(bucketCount - 1, Math.floor(offset / Math.max(1, length) * bucketCount));
    const bucket = buckets[bucketIndex];
    if (!bucket) buckets[bucketIndex] = { min: sample, max: sample };
    else {
      if (value < bucket.min.value) bucket.min = sample;
      if (value > bucket.max.value) bucket.max = sample;
    }
  };
  if (text) {
    // Iterate tokens without split/map/filter intermediates proportional to the input text.
    const tokens = /\S+/gu;
    for (let token = tokens.exec(text); token; token = tokens.exec(text))
      accept(Number(token[0]), token.index);
    if (count < 2) return { values: [], positions: [], count: 0 };
  } else {
    for (let index = 0; index < length; index++) accept(values[index]!, index);
  }
  const retained = count <= MAX_POINTS ? small : [first!, last!, ...buckets.flatMap(bucket => bucket ? [bucket.min, bucket.max] : [])];
  retained.sort((a, b) => a.index - b.index);
  const unique = retained.filter((sample, index) => index === 0 || sample.index !== retained[index - 1]!.index);
  return { values: unique.map(sample => sample.value), positions: unique.map(sample => sample.index), count };
}

function normalizeAppearance(value: unknown): LyraSparklineAppearance {
  return value === 'gradient' || value === 'line' || value === 'solid'
    ? value
    : 'solid';
}

function normalizeCurve(value: unknown): LyraSparklineCurve {
  return value === 'natural' || value === 'step' || value === 'linear'
    ? value
    : 'linear';
}

/**
 * `<lr-sparkline>` — a zero-dependency inline SVG trend chart.
 * Mirrors the Web Awesome `<wa-sparkline>` API under the `lr-` prefix and retains the earlier
 * `values`/`mark`/`min`/`max` Lyra surface as an additive programmatic extension. Large inputs retain
 * at most 500 plotted samples: endpoints and source-bucket extrema, positioned in finite-sample
 * order. The accessible summary counts all finite input samples. A preparedData summary
 * instead preserves original x coordinates and declared full domains/counts, with gaps in both
 * stroke and fill. It never reads the original source, values or data while supplied.
 *
 * @customElement lr-sparkline
 * @csspart sparkline - The outer SVG wrapper.
 * @csspart fill - The filled area rendered by `appearance="solid"` and `appearance="gradient"`.
 * @csspart line - The stroked trend path.
 * @csspart status - The visible localized invalid-prepared-input message.
 * @csspart bar - Each rectangle rendered by the additive `mark="bar"` mode.
 * @cssprop [--fill-color=var(--lr-color-brand-quiet)] - Area fill color. A `trend` supplies a
 *   semantic token default, while an authored value always wins.
 * @cssprop [--line-color=var(--lr-color-brand)] - Trend line color. A `trend` supplies a semantic
 *   token default, while an authored value always wins.
 * @cssprop [--line-width=var(--lr-border-width-medium)] - Trend line width.
 * @status stable
 * @since 4.0.0
 */
export class LyraSparkline extends LyraElement {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    chartPreparedSummary: LYRA_DEFAULT_chartPreparedSummary,
    chartPreparedUnavailable: LYRA_DEFAULT_chartPreparedUnavailable,
    chartSummary: LYRA_DEFAULT_chartSummary,
    chartSummarySeparator: LYRA_DEFAULT_chartSummarySeparator,
    chartTrendDecreasing: LYRA_DEFAULT_chartTrendDecreasing,
    chartTrendFlat: LYRA_DEFAULT_chartTrendFlat,
    chartTrendIncreasing: LYRA_DEFAULT_chartTrendIncreasing,
    noData: LYRA_DEFAULT_noData,
    trendOf: LYRA_DEFAULT_trendOf,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** Fill treatment under the trend line. */
  @property({ reflect: true }) appearance: LyraSparklineAppearance = 'solid';

  /** Interpolation used to connect adjacent samples. */
  @property({ reflect: true }) curve: LyraSparklineCurve = 'linear';

  /** Space-separated finite numeric samples. At least two are required. An empty or removed
   * data attribute uses values instead; removal retains null property readback. */
  @property() data = '';

  /** Accessible label applied verbatim to the SVG. */
  @property() label = '';

  /** Semantic default color; public color custom properties take precedence. */
  @property({ reflect: true }) trend?: LyraSparklineTrend;

  /** Compatibility accessible-name property. An authored host `aria-label` wins; otherwise a
   * nonempty `label` precedes a nonempty programmatic value here. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  /** Additive programmatic data source used when `data` is empty. Property-only.
   * Reassign after changes, or call `requestUpdate()` after mutating the existing array. */
  @property({ attribute: false }) values: readonly number[] = [];

  private _mark: LyraSparklineMark = 'line';

  /** Geometry used to plot samples. Foreign tokens normalize to `line`. */
  @property({ reflect: true })
  get mark(): LyraSparklineMark { return this._mark; }
  set mark(value: LyraSparklineMark) {
    const normalized: LyraSparklineMark = value === 'bar' ? 'bar' : 'line';
    const previous = this._mark;
    if (previous === normalized) {
      if (value !== normalized) this.requestUpdate('mark', previous);
      return;
    }
    this._mark = normalized;
    this.requestUpdate('mark', previous);
  }

  /** Lower bound of the value scale (defaults to the data minimum). */
  @property({ type: Number }) min?: number;

  /** Upper bound of the value scale (defaults to the data maximum). */
  @property({ type: Number }) max?: number;

  private _preparedData: LyraPreparedSeriesData | null = null;
  /** Property-only immutable whole-source summary with exactly one series and at most 500 samples.
   * Takes precedence over values/data. Original x, full domains/counts and gap breaks are retained;
   * min/max still explicitly override the y scale. Invalid/oversized inputs fail visibly rather
   * than being sampled again. Reassign or requestUpdate after mutable descriptor changes.
   * Source readers remain host-owned and are never invoked by this component.
   */
  @property({ attribute: false })
  get preparedData(): LyraPreparedSeriesData | null { return this._preparedData; }
  set preparedData(value: LyraPreparedSeriesData | null) {
    const previous = this._preparedData;
    this._preparedData = value;
    this.requestUpdate('preparedData', previous);
    if (previous === value) this.requestUpdate();
  }
  private preparedDirty = true;
  private preparedActive = false;
  private preparedInvalid = false;
  private preparedSeries?: PreparedChartSeries;
  private preparedValues: number[] = [];
  private announcedPreparedInvalid = false;
  private mounted = false;
  private readonly announcements = new AnnouncementSinkController(this);

  private refreshPrepared(): void {
    if (!this.preparedDirty) return;
    this.preparedDirty = false;
    this.preparedActive = this._preparedData !== null;
    this.preparedInvalid = false;
    this.preparedSeries = undefined;
    this.preparedValues = [];
    this.pointsMemo = undefined;
    if (!this.preparedActive) return;
    try {
      // Validate samples without chart-only separator nodes. The shared model reserves two
      // overlay entries; adding those to this allowance keeps exactly 500 sparkline samples.
      const model = prepareChartModel(this._preparedData, 'bar', MAX_POINTS + 2);
      if (model.kind !== 'series' || model.series.length !== 1 || model.displayedCount > MAX_POINTS) throw new TypeError('Invalid sparkline summary');
      this.preparedSeries = model.series[0]!;
      this.preparedValues = this.preparedSeries.samples.map(point => point!.y!);
    } catch { this.preparedInvalid = true; }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (this.mounted && this.preparedInvalid && !this.announcedPreparedInvalid) this.announcements.announceAssertive(this.localize('chartPreparedUnavailable'));
    this.announcedPreparedInvalid = this.preparedInvalid;
    this.mounted = true;
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.preparedSeries = undefined;
    this.preparedValues = [];
    this.pointsMemo = undefined;
    this.preparedDirty = true;
    this.mounted = false;
    this.announcedPreparedInvalid = false;
  }
  override connectedCallback(): void { super.connectedCallback(); this.requestUpdate(); }
  override adoptedCallback(): void { super.adoptedCallback(); this.announcements.adopted(); this.requestUpdate(); }

  private readonly gradientId = nextId('sparkline-gradient');

  private valuesMemo?: { data: string; values: readonly number[]; result: number[]; positions: number[]; count: number };
  private pointsMemo?: { values: readonly number[]; min: number | undefined; max: number | undefined; direction: string; result: ReadonlyArray<readonly [number, number]> };

  override requestUpdate(name?: PropertyKey, oldValue?: unknown, options?: Parameters<LyraElement['requestUpdate']>[2]): void {
    if (name === undefined || name === 'preparedData') this.preparedDirty = true;
    if (name === undefined || name === 'preparedData' || name === 'values' || name === 'data') {
      this.valuesMemo = undefined;
      this.pointsMemo = undefined;
    }
    super.requestUpdate(name, oldValue, options);
  }

  private plotValues(): number[] {
    if (this.preparedActive) return this.preparedValues;
    const data = this.data ?? '';
    if (this.valuesMemo?.data === data && this.valuesMemo.values === this.values) return this.valuesMemo.result;
    const sample = sampleValues(data, this.values);
    this.valuesMemo = { data, values: this.values, result: sample.values, positions: sample.positions, count: sample.count };
    return sample.values;
  }

  private points(
    values: readonly number[] = this.plotValues()
  ): ReadonlyArray<readonly [number, number]> {
    const direction = this.effectiveDirection;
    const memo = this.pointsMemo;
    if (memo && memo.values === values && memo.min === this.min && memo.max === this.max && memo.direction === direction) return memo.result;
    let autoLo = this.preparedSeries?.yDomain?.min ?? values[0] ?? 0;
    let autoHi = this.preparedSeries?.yDomain?.max ?? values[0] ?? 0;
    if (!this.preparedActive && (!Number.isFinite(this.min) || !Number.isFinite(this.max))) {
      for (const value of values) {
        if (value < autoLo) autoLo = value;
        if (value > autoHi) autoHi = value;
      }
    }
    let lo = finiteNumber(this.min ?? autoLo, autoLo);
    let hi = finiteNumber(this.max ?? autoHi, autoHi);
    if (lo > hi) [lo, hi] = [hi, lo];
    const sample = this.valuesMemo?.result === values ? this.valuesMemo : undefined;
    const count = sample?.count ?? values.length;
    const result = values.map((value, index) => {
      const position = sample?.positions[index] ?? index;
      const source = this.preparedSeries;
      const domain = source?.xDomain;
      const forwardX = domain && source
        ? domain.min === domain.max ? VIEW / 2 : finiteRatio(source.samples[index]!.x, domain.min, domain.max) * VIEW
        : count > 1 ? (position / (count - 1)) * VIEW : VIEW / 2;
      const x = direction === 'rtl' ? VIEW - forwardX : forwardX;
      const y = lo === hi ? VIEW / 2 : VIEW - finiteRatio(value, lo, hi) * VIEW;
      return [x, y] as const;
    });
    this.pointsMemo = { values, min: this.min, max: this.max, direction, result };
    return result;
  }

  private linePath(points: ReadonlyArray<readonly [number, number]>): string {
    const first = points[0];
    if (!first) return '';
    if (points.length === 1)
      return `M${first[0]},${first[1]} L${first[0]},${first[1]}`;

    const curve = normalizeCurve(this.curve);
    if (curve === 'step') {
      return points
        .slice(1)
        .reduce(
          (path, point) => `${path} H${point[0]} V${point[1]}`,
          `M${first[0]},${first[1]}`
        );
    }
    if (curve === 'natural') {
      let path = `M${first[0]},${first[1]}`;
      for (let index = 0; index < points.length - 1; index++) {
        const before = points[Math.max(0, index - 1)]!;
        const start = points[index]!;
        const end = points[index + 1]!;
        const after = points[Math.min(points.length - 1, index + 2)]!;
        const c1x = start[0] + (end[0] - before[0]) / 6;
        const c1y = start[1] + (end[1] - before[1]) / 6;
        const c2x = end[0] - (after[0] - start[0]) / 6;
        const c2y = end[1] - (after[1] - start[1]) / 6;
        path += ` C${c1x},${c1y} ${c2x},${c2y} ${end[0]},${end[1]}`;
      }
      return path;
    }
    return points
      .map(([x, y], index) => `${index ? 'L' : 'M'}${x},${y}`)
      .join(' ');
  }

  private accessibleName(values: readonly number[]): string {
    // An authored host attribute (including an intentional empty value) wins. The visible-series
    // label then outranks the property-only compatibility alias, followed by the generated summary.
    const hostLabel = this.getAttribute('aria-label');
    if (hostLabel !== null) return hostLabel;
    if (this.label) return this.label;
    if (typeof this.accessibleLabel === 'string' && this.accessibleLabel.length > 0) {
      return this.accessibleLabel;
    }

    if (this.preparedSeries) {
      const series = this.preparedSeries;
      const number = getNumberFormat(this.effectiveLocale);
      const summary = this.localize('chartPreparedSummary', undefined, {
        validCount: number.format(series.counts.validCount), invalidCount: number.format(series.counts.invalidCount), displayedCount: number.format(series.samples.length),
      });
      if (!series.yDomain) return summary;
      const first = values[0] ?? 0, last = values.at(-1) ?? 0;
      const domain = this.localize('chartSummary', undefined, { label: series.label,
        count: number.format(series.counts.validCount), min: number.format(series.yDomain.min), max: number.format(series.yDomain.max),
        trend: this.localize(last > first ? 'chartTrendIncreasing' : last < first ? 'chartTrendDecreasing' : 'chartTrendFlat'),
      });
      return [domain, summary].join(this.localize('chartSummarySeparator'));
    }
    const last = values.at(-1);
    if (last === undefined) return this.localize('noData');
    // Two fraction digits, widened below one so a small value keeps two significant digits
    // instead of reading "0".
    const magnitude = Math.abs(last);
    const digits = magnitude > 0 && magnitude < 1
      ? Math.min(20, Math.max(2, 1 - Math.floor(Math.log10(magnitude))))
      : 2;
    return this.localize('trendOf', undefined, {
      count: getNumberFormat(this.effectiveLocale).format(this.valuesMemo?.result === values ? this.valuesMemo.count : values.length),
      value: getNumberFormat(this.effectiveLocale, {
        maximumFractionDigits: digits,
      }).format(last),
    });
  }

  private renderBars(
    points: ReadonlyArray<readonly [number, number]>
  ): TemplateResult {
    const slot = VIEW / Math.max(1, points.length);
    const barWidth = Math.min(4, Math.max(1, slot * 0.7));
    return html`${points.map(([x, y]) => {
      const barY = Math.min(VIEW, Math.max(0, y));
      return svg`<rect
        part="bar"
        x="${x - barWidth / 2}"
        y="${barY}"
        width="${barWidth}"
        height="${VIEW - barY}"
      ></rect>`;
    })}`;
  }

  override render(): TemplateResult {
    this.refreshPrepared();
    if (this.preparedInvalid) return html`<span part="status">${this.localize('chartPreparedUnavailable')}</span>`;
    const values = this.plotValues();
    const points = this.points(values);
    const name = this.accessibleName(values);
    const segments: (readonly [number, number])[][] = [];
    for (let index = 0; index < points.length; index++) {
      if (!segments.length || this.preparedSeries?.samples[index]?.breakBefore) segments.push([]);
      segments[segments.length - 1]!.push(points[index]!);
    }
    const paths = segments.map(segment => this.linePath(segment));
    const path = paths.join(' ');
    const appearance = normalizeAppearance(this.appearance);
    const showFill =
      this.mark !== 'bar' && appearance !== 'line' && points.length > 0;
    const fillPath = segments.map((segment, index) => {
      const first = segment[0]!, last = segment[segment.length - 1]!;
      return `${paths[index]} L${last[0]},${VIEW} L${first[0]},${VIEW} Z`;
    }).join(' ');

    return html`<svg
      part="sparkline"
      viewBox="0 0 ${VIEW} ${VIEW}"
      preserveAspectRatio="none"
      role=${name ? 'img' : nothing}
      aria-label=${name || nothing}
    >
      ${showFill && appearance === 'gradient'
        ? svg`<defs>
            <linearGradient id=${this.gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop class="gradient-start" offset="0%"></stop>
              <stop class="gradient-end" offset="100%"></stop>
            </linearGradient>
          </defs>`
        : nothing}
      ${this.mark === 'bar'
        ? this.renderBars(points)
        : html`
            ${showFill
              ? svg`<path
                  part="fill"
                  d=${fillPath}
                  style=${
                    appearance === 'gradient'
                      ? `fill: url(#${this.gradientId})`
                      : nothing
                  }
                ></path>`
              : nothing}
            ${path ? svg`<path part="line" d=${path}></path>` : nothing}
          `}
    </svg>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-sparkline': LyraSparkline;
  }
}
