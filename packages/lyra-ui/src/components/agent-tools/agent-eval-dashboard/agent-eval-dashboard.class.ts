import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import type { BadgeVariant } from '../../overlays/badge/badge.class.js';
import { styles } from './agent-eval-dashboard.styles.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { finiteCount } from '../../../internal/numbers.js';
import {
  agentStatusKind,
  agentStatusLabel,
  agentStatusMessage,
  agentStatusVariant,
  type AgentStatusValue,
} from '../agent-status-presentation.js';
import { overallSemanticLabel } from '../semantic-owner.js';
import type { AgentRunActivateDetail } from '../run-events.js';
import { firstByIdentity } from '../collection-identity.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_agentRunStatusCancelled, LYRA_DEFAULT_agentRunStatusCollecting, LYRA_DEFAULT_agentRunStatusDone, LYRA_DEFAULT_agentRunStatusIdle, LYRA_DEFAULT_agentRunStatusQueued, LYRA_DEFAULT_agentRunStatusWaitingApproval, LYRA_DEFAULT_agentRunStatusWaitingInput, LYRA_DEFAULT_chartValueLabel, LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_evaluationDashboardLabel, LYRA_DEFAULT_evaluationDashboardNoRuns, LYRA_DEFAULT_evaluationDashboardRunsLabel, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_progress, LYRA_DEFAULT_search, LYRA_DEFAULT_select, LYRA_DEFAULT_statusError, LYRA_DEFAULT_statusRunning } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type EvaluationMetricFormat = 'number' | 'percent' | 'milliseconds' | 'currency';
export interface AgentEvaluationMetric { id: string; label: string; value: number; format?: EvaluationMetricFormat; }
export interface AgentEvaluationDashboardRun { id: string; label: string; status: AgentStatusValue; metrics?: Record<string, number>; }
export interface LyraAgentEvalDashboardEventMap { 'lr-metric-change': CustomEvent<{ metricId: string }>; 'lr-run-activate': CustomEvent<AgentRunActivateDetail<AgentEvaluationDashboardRun>>; }
const STATUS_VARIANT: Record<string, BadgeVariant> = { idle: 'neutral', queued: 'neutral', running: 'brand', collecting: 'brand', 'waiting-input': 'warning', 'waiting-approval': 'warning', done: 'success', error: 'danger', cancelled: 'neutral' };
/**
 * `<lr-agent-eval-dashboard>` — a controlled evaluation overview with metric cards, a trend chart,
 * and run-status history. It never launches or scores evaluations. Duplicate metric or run ids
 * normalize before selection, charting, rendering, and activation; the first occurrence wins.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * @customElement lr-agent-eval-dashboard
 * @event lr-metric-change - A host-controlled metric selection changed. `detail: { metricId }`.
 * @event lr-run-activate - A run row was activated. `detail: { runId, run }`.
 * @csspart base - The root dashboard wrapper.
 * @csspart heading - The visible heading.
 * @csspart metrics - The metric-card grid.
 * @csspart metric - One metric card.
 * @csspart chart - The trend chart.
 * @csspart runs - The run history.
 * @csspart runs-heading - The run history heading.
 * @csspart run - One run row.
 * @csspart run-label - A run label.
 * @csspart run-meta - Status and metric value.
 * @csspart run-status - A run status badge.
 * @csspart run-status-message - Optional caller-supplied detail for a run status.
 * @csspart empty - The empty history message.
 * @cssprop [--lr-agent-eval-dashboard-active-border=var(--lr-color-brand)] - Active metric border.
 * @cssprop [--lr-agent-eval-dashboard-active-background=var(--lr-color-brand-quiet)] - Active metric background.
 * @status stable
 * @since 6.2.0
 */
export class LyraAgentEvalDashboard extends LyraElement<LyraAgentEvalDashboardEventMap> {
  protected static override readonly ownedCollectionProperties = Object.freeze(["metrics", "runs"]);

  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    agentRunStatusCancelled: LYRA_DEFAULT_agentRunStatusCancelled,
    agentRunStatusCollecting: LYRA_DEFAULT_agentRunStatusCollecting,
    agentRunStatusDone: LYRA_DEFAULT_agentRunStatusDone,
    agentRunStatusIdle: LYRA_DEFAULT_agentRunStatusIdle,
    agentRunStatusQueued: LYRA_DEFAULT_agentRunStatusQueued,
    agentRunStatusWaitingApproval: LYRA_DEFAULT_agentRunStatusWaitingApproval,
    agentRunStatusWaitingInput: LYRA_DEFAULT_agentRunStatusWaitingInput,
    chartValueLabel: LYRA_DEFAULT_chartValueLabel,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    evaluationDashboardLabel: LYRA_DEFAULT_evaluationDashboardLabel,
    evaluationDashboardNoRuns: LYRA_DEFAULT_evaluationDashboardNoRuns,
    evaluationDashboardRunsLabel: LYRA_DEFAULT_evaluationDashboardRunsLabel,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    open: LYRA_DEFAULT_open,
    progress: LYRA_DEFAULT_progress,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
    statusError: LYRA_DEFAULT_statusError,
    statusRunning: LYRA_DEFAULT_statusRunning,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];
  /** Metric cards and selector choices. Empty ids are omitted; duplicates normalize first-wins. */
  @property({ attribute: false }) metrics: readonly AgentEvaluationMetric[] = [];
  /** Run history used by both the chart and list. Empty ids are omitted; duplicates normalize
   *  first-wins. */
  @property({ attribute: false }) runs: readonly AgentEvaluationDashboardRun[] = [];
  /** Controlled metric selection. `null` or an unmatched identity selects the first valid metric. */
  @property({ attribute: 'metric-id' }) metricId: string | null = null;
  /** ISO 4217 currency code used by metrics whose format is `currency`. Invalid codes use USD. */
  @property() currency = 'USD';
  @property() label = '';
  @property({ type: Boolean, attribute: 'show-chart', reflect: true, converter: trueDefaultBooleanConverter }) showChart = true;
  @property({ attribute: 'chart-height' }) chartHeight = '220px';
  /** Maximum history entries rendered into both the run list and trend chart. Clamped to 1–500. */
  @property({ type: Number, attribute: 'max-rendered-runs' }) maxRenderedRuns = 100;
  private get normalizedMetrics(): AgentEvaluationMetric[] {
    return firstByIdentity(Array.isArray(this.metrics) ? this.metrics : [], (metric) => metric.id);
  }
  private get normalizedRuns(): AgentEvaluationDashboardRun[] {
    return firstByIdentity(Array.isArray(this.runs) ? this.runs : [], (run) => run.id);
  }
  private get activeMetric(): AgentEvaluationMetric | undefined {
    const metrics = this.normalizedMetrics;
    return this.metricId === null
      ? metrics[0]
      : metrics.find((metric) => metric.id === this.metricId) ?? metrics[0];
  }
  private statusLabel(status: AgentStatusValue): string {
    const override = agentStatusLabel(status);
    if (override !== undefined) return override;
    const kind = agentStatusKind(status);
    const keys: Record<string, string> = { idle: 'agentRunStatusIdle', queued: 'agentRunStatusQueued', running: 'statusRunning', collecting: 'agentRunStatusCollecting', 'waiting-input': 'agentRunStatusWaitingInput', 'waiting-approval': 'agentRunStatusWaitingApproval', done: 'agentRunStatusDone', error: 'statusError', cancelled: 'agentRunStatusCancelled' };
    return keys[kind] ? this.localize(keys[kind]) : kind.replace(/[-_]+/g, ' ');
  }
  private get projectedRuns(): AgentEvaluationDashboardRun[] {
    const limit = Math.max(1, finiteCount(this.maxRenderedRuns, 100, 500));
    return this.normalizedRuns.slice(0, limit);
  }
  private formatMetric(metric: AgentEvaluationMetric, value = metric.value): string {
    const safe = Number.isFinite(value) ? value : 0;
    switch (metric.format) {
      case 'percent':
        return getNumberFormat(this.effectiveLocale, {
          style: 'percent',
          maximumFractionDigits: 1,
        }).format(safe);
      case 'milliseconds':
        return getNumberFormat(this.effectiveLocale, {
          style: 'unit',
          unit: 'millisecond',
          unitDisplay: 'short',
          maximumFractionDigits: 0,
        }).format(safe);
      case 'currency': {
        try {
          return getNumberFormat(this.effectiveLocale, {
            style: 'currency',
            currency: this.currency,
            maximumFractionDigits: 2,
          }).format(safe);
        } catch {
          return getNumberFormat(this.effectiveLocale, {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 2,
          }).format(safe);
        }
      }
      default:
        return getNumberFormat(this.effectiveLocale, { maximumFractionDigits: 2 }).format(safe);
    }
  }
  private renderRuns(runs: AgentEvaluationDashboardRun[]): TemplateResult {
    if (!runs.length) return html`<p part="empty">${this.localize('evaluationDashboardNoRuns')}</p>`;
    const active = this.activeMetric;
    return html`<section part="runs" aria-label=${this.localize('evaluationDashboardRunsLabel')}><h3 part="runs-heading">${this.localize('evaluationDashboardRunsLabel')}</h3>${runs.map((run) => {
      const kind = agentStatusKind(run.status);
      const message = agentStatusMessage(run.status);
      return html`<button part="run" type="button" @click=${() => this.emit('lr-run-activate', { runId: run.id, run })}><span part="run-label">${run.label}</span><span part="run-meta"><lr-badge part="run-status" variant=${agentStatusVariant(run.status, STATUS_VARIANT[kind] ?? 'neutral')}>${this.statusLabel(run.status)}</lr-badge>${message !== undefined ? html`<span part="run-status-message">${message}</span>` : nothing}${active && run.metrics?.[active.id] != null ? html`<span>${this.formatMetric(active, run.metrics[active.id])}</span>` : nothing}</span></button>`;
    })}</section>`;
  }
  override render(): TemplateResult {
    const label = this.label || this.localize('evaluationDashboardLabel');
    const semanticLabel = overallSemanticLabel(this, label);
    const active = this.activeMetric;
    const runs = this.projectedRuns;
    const metrics = this.normalizedMetrics;
    const values = runs.map((run) => {
      const value = active ? run.metrics?.[active.id] : undefined;
      return value != null && Number.isFinite(value) ? value : null;
    });
    return html`<section part="base" aria-label=${semanticLabel ?? nothing}>
      <h2 part="heading">${label}</h2>
      ${metrics.length
        ? html`<div part="metrics">${metrics.map((metric) => {
            const value = this.formatMetric(metric);
            return html`<button
              part="metric"
              type="button"
              data-metric-id=${metric.id}
              aria-pressed=${active?.id === metric.id ? 'true' : 'false'}
              aria-label=${this.localize('chartValueLabel', undefined, { label: metric.label, value })}
              @click=${() => this.emit('lr-metric-change', { metricId: metric.id })}
            ><lr-stat frame="plain" .label=${metric.label} .value=${value}></lr-stat></button>`;
          })}</div>`
        : nothing}
      ${this.showChart && active && runs.length
        ? html`<div part="chart"><lr-lite-chart type="line" .height=${this.chartHeight} .labels=${runs.map((run) => run.label)} .datasets=${[{ label: active.label, data: values }]} legend accessible-label=${active.label}></lr-lite-chart></div>`
        : nothing}
      ${this.renderRuns(runs)}
    </section>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-agent-eval-dashboard': LyraAgentEvalDashboard; } }
