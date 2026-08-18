import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { firstByRetrievalIdentity } from '../retrieval-identity.js';
import { finiteRange } from '../../../internal/numbers.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import '../../charts/chart/lite-chart.class.js';
import '../../data/stat/stat.class.js';
import '../../overlays/empty/empty.class.js';
import { styles } from './rag-eval-dashboard.styles.js';
import {
  retrievalSemanticLabel,
  retrievalSemanticRole,
} from '../retrieval-semantic-owner.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_ragEvalDashboardAllSlices, LYRA_DEFAULT_ragEvalDashboardEmpty, LYRA_DEFAULT_ragEvalDashboardLabel, LYRA_DEFAULT_ragEvalDashboardRuns, LYRA_DEFAULT_ragEvalDashboardSliceUnavailable, LYRA_DEFAULT_ragEvalDashboardSlices } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type LyraRagEvaluationMetricCategory =
  | 'retrieval'
  | 'generation'
  | 'system'
  | (string & {});
export type LyraRagEvaluationMetricFormat = 'number' | 'percent';
export interface LyraRagEvaluationMetric {
  id: string;
  label: string;
  category: LyraRagEvaluationMetricCategory;
  format?: LyraRagEvaluationMetricFormat;
}
export interface LyraRagEvaluationRun {
  id: string;
  label: string;
  metrics: Record<string, number>;
  slice?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}
export interface LyraRagEvalDashboardEventMap {
  'lr-metric-change': CustomEvent<{ metricId: string }>;
  'lr-slice-change': CustomEvent<{ slice: string }>;
  'lr-run-change': CustomEvent<{ run: LyraRagEvaluationRun }>;
  /** @deprecated Use `lr-run-change` instead; retained as an identical-detail alias until v11. */
  'lr-run-select': CustomEvent<{ run: LyraRagEvaluationRun }>;
}

/**
 * `<lr-rag-eval-dashboard>` — a controlled RAG quality overview with current metric cards,
 * per-metric trends, evaluation slices, and run history. It displays host-computed metrics and
 * never executes datasets, retrieval, judges, or model calls. A controlled `slice` absent from
 * the current runs is preserved and renders an explicit localized unavailable-filter state;
 * the component never silently switches it to All.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 * Blank metric/run ids and later duplicates are ignored before fallback selection, filters,
 * counts, rendering, or actions. The first record for an id wins.
 *
 * @customElement lr-rag-eval-dashboard
 * @event lr-metric-change - A metric was activated. `detail: { metricId }`.
 * @event lr-slice-change - An evaluation slice was activated. `detail: { slice }`.
 * @event lr-run-change - An evaluation run was activated. `detail: { run }`.
 * @event lr-run-select - Deprecated alias for `lr-run-change`, retained with an identical
 *   `detail` and fired alongside it for backward compatibility. Prefer `lr-run-change`; this
 *   alias is slated for removal in v11.
 * @csspart base - The named dashboard region.
 * @csspart heading - The visible dashboard heading.
 * @csspart slices - Slice filter controls.
 * @csspart slice - One slice filter.
 * @csspart slice-selected - The controlled active slice.
 * @csspart metrics - Metric-card controls.
 * @csspart metric - One metric control.
 * @csspart metric-selected - The controlled active metric.
 * @csspart chart - The active metric trend.
 * @csspart runs - Evaluation run history.
 * @csspart runs-heading - Run-history heading.
 * @csspart run - One evaluation run.
 * @csspart empty - The no-runs or unavailable-controlled-slice state.
 * @status stable
 * @since 7.0.0
 */
export class LyraRagEvalDashboard extends LyraElement<LyraRagEvalDashboardEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    ragEvalDashboardAllSlices: LYRA_DEFAULT_ragEvalDashboardAllSlices,
    ragEvalDashboardEmpty: LYRA_DEFAULT_ragEvalDashboardEmpty,
    ragEvalDashboardLabel: LYRA_DEFAULT_ragEvalDashboardLabel,
    ragEvalDashboardRuns: LYRA_DEFAULT_ragEvalDashboardRuns,
    ragEvalDashboardSliceUnavailable: LYRA_DEFAULT_ragEvalDashboardSliceUnavailable,
    ragEvalDashboardSlices: LYRA_DEFAULT_ragEvalDashboardSlices,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly ownedCollectionProperties = Object.freeze(['metrics', 'runs']);

  static override styles = [LyraElement.styles, styles];

  /** Metric definitions shown as controls and used to format run values. */
  @property({ attribute: false }) metrics: readonly LyraRagEvaluationMetric[] = [];
  /** Evaluation runs displayed in the trend chart and run history. */
  @property({ attribute: false }) runs: readonly LyraRagEvaluationRun[] = [];
  /** Controlled id of the active metric; empty selects the first available metric. */
  @property({ attribute: 'metric-id' }) metricId = '';
  /** Controlled evaluation slice. An unavailable value is preserved and renders an explicit
   * localized state until the host changes it or supplies a matching run. */
  @property() slice = '';
  /** Visible dashboard heading and fallback overall-region name. Omitting it falls back to a
   *  localized default; an explicit empty string clears both. A non-empty host `aria-label`
   *  makes the host the sole overall owner; an explicitly empty host label stays empty. */
  @property() label?: string;
  /** Whether a trend chart is rendered when an active metric and matching runs exist. */
  @property({
    type: Boolean,
    attribute: 'show-chart',
    reflect: true,
    converter: trueDefaultBooleanConverter,
  })
  showChart = true;
  /** CSS block size forwarded to the composed trend chart. */
  @property({ attribute: 'chart-height' }) chartHeight = '220px';

  private get normalizedMetrics(): LyraRagEvaluationMetric[] {
    return firstByRetrievalIdentity(
      Array.isArray(this.metrics) ? this.metrics : [],
      (metric) => metric.id
    );
  }

  private get normalizedRuns(): LyraRagEvaluationRun[] {
    return firstByRetrievalIdentity(
      Array.isArray(this.runs) ? this.runs : [],
      (run) => run.id
    );
  }

  private activeMetric(
    metrics: readonly LyraRagEvaluationMetric[]
  ): LyraRagEvaluationMetric | undefined {
    return (
      metrics.find((metric) => metric.id === this.metricId) ?? metrics[0]
    );
  }

  private slices(runs: readonly LyraRagEvaluationRun[]): string[] {
    return [
      ...new Set(
        runs
          .map((run) => run.slice)
          .filter((slice): slice is string => Boolean(slice))
      ),
    ];
  }

  private filteredRuns(
    runs: readonly LyraRagEvaluationRun[]
  ): readonly LyraRagEvaluationRun[] {
    return this.slice
      ? runs.filter((run) => run.slice === this.slice)
      : runs;
  }

  private formatMetric(
    metric: LyraRagEvaluationMetric,
    raw: number | undefined
  ): string {
    const value = Number.isFinite(raw) ? (raw as number) : 0;
    if (metric.format === 'percent') {
      return getNumberFormat(this.effectiveLocale, {
        style: 'percent',
        maximumFractionDigits: 1,
      }).format(finiteRange(value, 0, 0, 1));
    }
    return getNumberFormat(this.effectiveLocale, {
      maximumFractionDigits: 3,
    }).format(value);
  }

  private latestValue(
    metric: LyraRagEvaluationMetric,
    runs: readonly LyraRagEvaluationRun[]
  ): number | undefined {
    return [...runs]
      .reverse()
      .find((run) => Number.isFinite(run.metrics[metric.id]))?.metrics[
      metric.id
    ];
  }

  /** Dispatches the canonical `lr-run-change` and, for backward compatibility, the deprecated
   *  `lr-run-select` alias -- both with the same detail object. */
  private emitRunChange(run: LyraRagEvaluationRun): void {
    const detail = { run };
    this.emit('lr-run-change', detail);
    this.emit('lr-run-select', detail);
  }

  private renderSlices(slices: readonly string[]): TemplateResult | typeof nothing {
    if (!slices.length) return nothing;
    const allSlicesPart = this.slice ? 'slice' : 'slice slice-selected';
    return html`
      <nav part="slices" aria-label=${this.localize('ragEvalDashboardSlices')}>
        <button
          part=${allSlicesPart}
          type="button"
          data-slice=""
          aria-pressed=${this.slice ? 'false' : 'true'}
          @click=${() => this.emit('lr-slice-change', { slice: '' })}
        >
          ${this.localize('ragEvalDashboardAllSlices')}
        </button>
        ${slices.map((slice) => {
          const slicePart =
            this.slice === slice ? 'slice slice-selected' : 'slice';
          return html`
            <button
              part=${slicePart}
              type="button"
              data-slice=${slice}
              aria-pressed=${this.slice === slice ? 'true' : 'false'}
              @click=${() => this.emit('lr-slice-change', { slice })}
            >
              ${slice}
            </button>
          `;
        })}
      </nav>
    `;
  }

  override render(): TemplateResult {
    const metrics = this.normalizedMetrics;
    const runs = this.normalizedRuns;
    const slices = this.slices(runs);
    const visibleLabel =
      this.label == null ? this.localize('ragEvalDashboardLabel') : this.label;
    const label = retrievalSemanticLabel(this, visibleLabel);
    const role = retrievalSemanticRole(this, 'region');
    if (!runs.length) {
      return html`<section
        part="base"
        role=${role ?? nothing}
        aria-label=${label ?? nothing}
      >
        <lr-empty
          part="empty"
          heading=${this.localize('ragEvalDashboardEmpty')}
        ></lr-empty>
      </section>`;
    }
    const active = this.activeMetric(metrics);
    const filtered = this.filteredRuns(runs);
    if (this.slice && !slices.includes(this.slice)) {
      return html`
        <section
          part="base"
          role=${role ?? nothing}
          aria-label=${label ?? nothing}
        >
          <h2 part="heading">${visibleLabel}</h2>
          ${this.renderSlices(slices)}
          <lr-empty
            part="empty"
            heading=${this.localize(
              'ragEvalDashboardSliceUnavailable',
              undefined,
              {
                slice: this.slice,
              }
            )}
          ></lr-empty>
        </section>
      `;
    }
    const values = filtered.map((run) => {
      const value = active ? run.metrics[active.id] : undefined;
      return Number.isFinite(value) ? (value as number) : null;
    });
    return html`
      <section
        part="base"
        role=${role ?? nothing}
        aria-label=${label ?? nothing}
      >
        <h2 part="heading">${visibleLabel}</h2>
        ${this.renderSlices(slices)}
        <div part="metrics">
          ${metrics.map((metric) => {
            const selected = metric.id === active?.id;
            const metricPart = selected ? 'metric metric-selected' : 'metric';
            return html`
              <button
                part=${metricPart}
                type="button"
                data-metric-id=${metric.id}
                aria-pressed=${selected ? 'true' : 'false'}
                @click=${() =>
                  this.emit('lr-metric-change', { metricId: metric.id })}
              >
                <lr-stat
                  frame="plain"
                  .label=${metric.label}
                  .value=${this.formatMetric(
                    metric,
                    this.latestValue(metric, filtered)
                  )}
                ></lr-stat>
              </button>
            `;
          })}
        </div>
        ${this.showChart && active && filtered.length
          ? html`
              <div part="chart">
                <lr-lite-chart
                  type="line"
                  .height=${this.chartHeight}
                  .labels=${filtered.map((run) => run.label)}
                  .datasets=${[{ label: active.label, data: values }]}
                  accessible-label=${active.label}
                ></lr-lite-chart>
              </div>
            `
          : nothing}
        <section
          part="runs"
          aria-label=${this.localize('ragEvalDashboardRuns')}
        >
          <h3 part="runs-heading">${this.localize('ragEvalDashboardRuns')}</h3>
          ${filtered.map(
            (run) => html`
              <button
                part="run"
                type="button"
                @click=${() => this.emitRunChange(run)}
              >
                <span>${run.label}</span>
                ${active && Number.isFinite(run.metrics[active.id])
                  ? html`<span
                      >${this.formatMetric(
                        active,
                        run.metrics[active.id]
                      )}</span
                    >`
                  : nothing}
              </button>
            `
          )}
        </section>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-rag-eval-dashboard': LyraRagEvalDashboard;
  }
}
