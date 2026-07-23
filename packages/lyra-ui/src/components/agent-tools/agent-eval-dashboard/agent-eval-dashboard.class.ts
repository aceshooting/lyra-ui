import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import type { AgentStatusKind } from '../../../ai/types.js';
import type { BadgeVariant } from '../../overlays/badge/badge.class.js';
import '../../charts/chart/lite-chart.js';
import '../../data/stat/stat.js';
import '../../overlays/badge/badge.js';
import { styles } from './agent-eval-dashboard.styles.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';

export type EvaluationMetricFormat = 'number' | 'percent' | 'milliseconds' | 'currency';
export interface AgentEvaluationMetric { id: string; label: string; value: number; format?: EvaluationMetricFormat; }
export interface AgentEvaluationDashboardRun { id: string; label: string; status: AgentStatusKind; metrics?: Record<string, number>; }
export interface LyraAgentEvalDashboardEventMap { 'lr-metric-change': CustomEvent<{ metricId: string }>; 'lr-run-select': CustomEvent<{ runId: string }>; }
const STATUS_VARIANT: Record<string, BadgeVariant> = { idle: 'neutral', queued: 'neutral', running: 'brand', collecting: 'brand', 'waiting-input': 'warning', 'waiting-approval': 'warning', done: 'success', error: 'danger', cancelled: 'neutral' };
/**
 * `<lr-agent-eval-dashboard>` — a controlled evaluation overview with metric cards, a trend chart,
 * and run-status history. It never launches or scores evaluations.
 *
 * @customElement lr-agent-eval-dashboard
 * @event lr-metric-change - A host-controlled metric selection changed. `detail: { metricId }`.
 * @event lr-run-select - A run row was activated. `detail: { runId }`.
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
 * @csspart empty - The empty history message.
 */
export class LyraAgentEvalDashboard extends LyraElement<LyraAgentEvalDashboardEventMap> {
  static override styles = [LyraElement.styles, styles];
  @property({ attribute: false }) metrics: AgentEvaluationMetric[] = [];
  @property({ attribute: false }) runs: AgentEvaluationDashboardRun[] = [];
  @property({ attribute: 'metric-id' }) metricId = '';
  @property() label = '';
  @property({ type: Boolean, attribute: 'show-chart', reflect: true, converter: trueDefaultBooleanConverter }) showChart = true;
  @property({ attribute: 'chart-height' }) chartHeight = '220px';
  private get activeMetric(): AgentEvaluationMetric | undefined { return this.metrics.find((metric) => metric.id === this.metricId) ?? this.metrics[0]; }
  private statusLabel(status: string): string { const keys: Record<string, string> = { idle: 'agentRunStatusIdle', queued: 'agentRunStatusQueued', running: 'statusRunning', collecting: 'agentRunStatusCollecting', 'waiting-input': 'agentRunStatusWaitingInput', 'waiting-approval': 'agentRunStatusWaitingApproval', done: 'agentRunStatusDone', error: 'statusError', cancelled: 'agentRunStatusCancelled' }; return keys[status] ? this.localize(keys[status]) : status.replace(/[-_]+/g, ' '); }
  private formatMetric(metric: AgentEvaluationMetric, value = metric.value): string { const safe = Number.isFinite(value) ? value : 0; switch (metric.format) { case 'percent': return `${getNumberFormat(this.effectiveLocale, { maximumFractionDigits: 1 }).format(safe * 100)}%`; case 'milliseconds': return `${getNumberFormat(this.effectiveLocale, { maximumFractionDigits: 0 }).format(safe)} ms`; case 'currency': return getNumberFormat(this.effectiveLocale, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(safe); default: return getNumberFormat(this.effectiveLocale, { maximumFractionDigits: 2 }).format(safe); } }
  private renderRuns(): TemplateResult { if (!this.runs.length) return html`<p part="empty">${this.localize('evaluationDashboardNoRuns')}</p>`; const active = this.activeMetric; return html`<section part="runs" aria-label=${this.localize('evaluationDashboardRunsLabel')}><h3 part="runs-heading">${this.localize('evaluationDashboardRunsLabel')}</h3>${this.runs.map((run) => html`<button part="run" type="button" @click=${() => this.emit('lr-run-select', { runId: run.id })}><span part="run-label">${run.label}</span><span part="run-meta"><lr-badge part="run-status" variant=${STATUS_VARIANT[run.status] ?? 'neutral'}>${this.statusLabel(run.status)}</lr-badge>${active && run.metrics?.[active.id] != null ? html`<span>${this.formatMetric(active, run.metrics[active.id])}</span>` : nothing}</span></button>`)}</section>`; }
  override render(): TemplateResult { const label = this.label || this.localize('evaluationDashboardLabel'); const active = this.activeMetric; const values = this.runs.map((run) => { const value = active ? run.metrics?.[active.id] : undefined; return value != null && Number.isFinite(value) ? value : null; }); return html`<section part="base" aria-label=${label}><h2 part="heading">${label}</h2>${this.metrics.length ? html`<div part="metrics">${this.metrics.map((metric) => html`<lr-stat part="metric" appearance="plain" .label=${metric.label} .value=${this.formatMetric(metric)}></lr-stat>`)}</div>` : nothing}${this.showChart && active && this.runs.length ? html`<div part="chart"><lr-lite-chart type="line" .height=${this.chartHeight} .labels=${this.runs.map((run) => run.label)} .datasets=${[{ label: active.label, data: values }]} legend accessible-label=${active.label}></lr-lite-chart></div>` : nothing}${this.renderRuns()}</section>`; }
}
declare global { interface HTMLElementTagNameMap { 'lr-agent-eval-dashboard': LyraAgentEvalDashboard; } }
