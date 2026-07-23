import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteRange } from '../../../internal/numbers.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import '../../charts/chart/lite-chart.class.js';
import '../../data/stat/stat.class.js';
import '../../overlays/empty/empty.class.js';
import { styles } from './rag-eval-dashboard.styles.js';

export type RagEvaluationMetricCategory = 'retrieval' | 'generation' | 'system' | (string & {});
export type RagEvaluationMetricFormat = 'number' | 'percent';
export interface RagEvaluationMetric {
  id: string;
  label: string;
  category: RagEvaluationMetricCategory;
  format?: RagEvaluationMetricFormat;
}
export interface RagEvaluationRun {
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
  'lr-run-select': CustomEvent<{ run: RagEvaluationRun }>;
}

/**
 * `<lr-rag-eval-dashboard>` — a controlled RAG quality overview with current metric cards,
 * per-metric trends, evaluation slices, and run history. It displays host-computed metrics and
 * never executes datasets, retrieval, judges, or model calls.
 *
 * @customElement lr-rag-eval-dashboard
 * @event lr-metric-change - A metric was activated. `detail: { metricId }`.
 * @event lr-slice-change - An evaluation slice was activated. `detail: { slice }`.
 * @event lr-run-select - An evaluation run was activated. `detail: { run }`.
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
 * @csspart empty - The empty state.
 */
export class LyraRagEvalDashboard extends LyraElement<LyraRagEvalDashboardEventMap> {
  static override styles = [LyraElement.styles, styles];

  @property({ attribute: false }) metrics: RagEvaluationMetric[] = [];
  @property({ attribute: false }) runs: RagEvaluationRun[] = [];
  @property({ attribute: 'metric-id' }) metricId = '';
  @property() slice = '';
  @property() label = '';
  @property({ type: Boolean, attribute: 'show-chart', reflect: true, converter: trueDefaultBooleanConverter })
  showChart = true;
  @property({ attribute: 'chart-height' }) chartHeight = '220px';

  private get activeMetric(): RagEvaluationMetric | undefined {
    return this.metrics.find((metric) => metric.id === this.metricId) ?? this.metrics[0];
  }

  private get slices(): string[] {
    return [...new Set(this.runs.map((run) => run.slice).filter((slice): slice is string => Boolean(slice)))];
  }

  private get filteredRuns(): RagEvaluationRun[] {
    return this.slice ? this.runs.filter((run) => run.slice === this.slice) : this.runs;
  }

  private formatMetric(metric: RagEvaluationMetric, raw: number | undefined): string {
    const value = Number.isFinite(raw) ? (raw as number) : 0;
    if (metric.format === 'percent') {
      return getNumberFormat(this.effectiveLocale, { style: 'percent', maximumFractionDigits: 1 }).format(
        finiteRange(value, 0, 0, 1),
      );
    }
    return getNumberFormat(this.effectiveLocale, { maximumFractionDigits: 3 }).format(value);
  }

  private latestValue(metric: RagEvaluationMetric): number | undefined {
    return [...this.filteredRuns].reverse().find((run) => Number.isFinite(run.metrics[metric.id]))?.metrics[
      metric.id
    ];
  }

  private renderSlices(): TemplateResult | typeof nothing {
    if (!this.slices.length) return nothing;
    return html`
      <nav part="slices" aria-label=${this.localize('ragEvalDashboardSlices')}>
        <button
          part=${this.slice ? 'slice' : 'slice slice-selected'}
          type="button"
          data-slice=""
          aria-pressed=${this.slice ? 'false' : 'true'}
          @click=${() => this.emit('lr-slice-change', { slice: '' })}
        >
          ${this.localize('ragEvalDashboardAllSlices')}
        </button>
        ${this.slices.map(
          (slice) => html`
            <button
              part=${this.slice === slice ? 'slice slice-selected' : 'slice'}
              type="button"
              data-slice=${slice}
              aria-pressed=${this.slice === slice ? 'true' : 'false'}
              @click=${() => this.emit('lr-slice-change', { slice })}
            >
              ${slice}
            </button>
          `,
        )}
      </nav>
    `;
  }

  override render(): TemplateResult {
    const label = this.getAttribute('aria-label') || this.label || this.localize('ragEvalDashboardLabel');
    if (!this.runs.length) {
      return html`<section part="base" aria-label=${label}>
        <lr-empty part="empty" heading=${this.localize('ragEvalDashboardEmpty')}></lr-empty>
      </section>`;
    }
    const active = this.activeMetric;
    const filtered = this.filteredRuns;
    const values = filtered.map((run) => {
      const value = active ? run.metrics[active.id] : undefined;
      return Number.isFinite(value) ? (value as number) : null;
    });
    return html`
      <section part="base" aria-label=${label}>
        <h2 part="heading">${label}</h2>
        ${this.renderSlices()}
        <div part="metrics">
          ${this.metrics.map((metric) => {
            const selected = metric.id === active?.id;
            return html`
              <button
                part=${selected ? 'metric metric-selected' : 'metric'}
                type="button"
                data-metric-id=${metric.id}
                aria-pressed=${selected ? 'true' : 'false'}
                @click=${() => this.emit('lr-metric-change', { metricId: metric.id })}
              >
                <lr-stat appearance="plain" .label=${metric.label} .value=${this.formatMetric(metric, this.latestValue(metric))}></lr-stat>
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
        <section part="runs" aria-label=${this.localize('ragEvalDashboardRuns')}>
          <h3 part="runs-heading">${this.localize('ragEvalDashboardRuns')}</h3>
          ${filtered.map(
            (run) => html`
              <button part="run" type="button" @click=${() => this.emit('lr-run-select', { run })}>
                <span>${run.label}</span>
                ${active && Number.isFinite(run.metrics[active.id])
                  ? html`<span>${this.formatMetric(active, run.metrics[active.id])}</span>`
                  : nothing}
              </button>
            `,
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

