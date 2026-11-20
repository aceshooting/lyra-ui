import { collectionSupport } from '../../../internal/collection-snapshot.js';
import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement, type LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { formatAdaptiveShare } from '../../../internal/locale-number.js';
import { formatShortDuration } from '../../../internal/duration.js';
import { AGENT_STATUS_VARIANTS } from '../../../internal/agent-status-variants.js';
import { styles } from './agent-eval-dashboard.styles.js';
import { finiteCount } from '../../../internal/numbers.js';
import {
  agentStatusKind,
  agentStatusLabel,
  agentStatusMessage,
  agentStatusVariant,
  type AgentStatusValue,
} from '../agent-status-presentation.js';
import { agentStatusText } from '../../../internal/agent-status-text.js';
import { overallSemanticLabel } from '../semantic-owner.js';
import { resolveHeadingLevel, type LyraHeadingLevel } from '../../../internal/heading-level.js';
import type { AgentRunActivateDetail } from '../run-events.js';
import { firstByIdentity } from '../../../internal/collection-identity.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { InputLimitAnnouncement } from '../../../internal/input-limit-announcement.js';
import { RovingListController } from '../../../internal/roving-list-controller.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_agentRunStatusCancelled, LYRA_DEFAULT_agentRunStatusCollecting, LYRA_DEFAULT_agentRunStatusDone, LYRA_DEFAULT_agentRunStatusIdle, LYRA_DEFAULT_agentRunStatusQueued, LYRA_DEFAULT_agentRunStatusWaitingApproval, LYRA_DEFAULT_agentRunStatusWaitingInput, LYRA_DEFAULT_evaluationDashboardLabel, LYRA_DEFAULT_evaluationDashboardMetricUnavailable, LYRA_DEFAULT_evaluationDashboardNoRuns, LYRA_DEFAULT_evaluationDashboardRunsLabel } from '../../../internal/default-strings/agent-tools.generated.js';
import { LYRA_DEFAULT_chartValueLabel, LYRA_DEFAULT_durationMilliseconds, LYRA_DEFAULT_durationSeconds, LYRA_DEFAULT_ragEvalDashboardRunsLimit, LYRA_DEFAULT_statusError, LYRA_DEFAULT_statusRunning } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type EvaluationMetricFormat = 'number' | 'percent' | 'milliseconds' | 'currency';
export interface AgentEvaluationMetric { readonly id: string; readonly label: string; readonly value: number; readonly format?: EvaluationMetricFormat; }
export interface AgentEvaluationDashboardRun { readonly id: string; readonly label: string; readonly status: AgentStatusValue; readonly metrics?: Readonly<Record<string, number>>; }
export interface LyraAgentEvalDashboardEventMap { 'lr-metric-change-request': CustomEvent<{ metricId: string }>; 'lr-run-activate': CustomEvent<LyraEventDetailSnapshot<AgentRunActivateDetail<AgentEvaluationDashboardRun>>>; }

/** A run's own finite value for `metricId`; inherited names such as `constructor` never match. */
function ownMetricValue(run: AgentEvaluationDashboardRun, metricId: string): number | undefined {
  const metrics = run.metrics;
  if (metrics === null || typeof metrics !== 'object' || !Object.hasOwn(metrics, metricId)) return undefined;
  const value = metrics[metricId];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
/**
 * `<lr-agent-eval-dashboard>` — a controlled evaluation overview with metric cards, a trend chart,
 * and run-status history. It never launches or scores evaluations. Duplicate metric or run ids
 * normalize before selection, charting, rendering, and activation; the first occurrence wins.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * @customElement lr-agent-eval-dashboard
 * @event lr-metric-change-request - A metric card was activated; the host decides whether to change `metricId`.
 *   `detail: { metricId }`.
 * @event lr-run-activate - A run row was activated. `detail: { runId, run }`.
 * @csspart base - The root dashboard wrapper.
 * @csspart heading - The visible heading.
 * @csspart metrics - The metric-card grid.
 * @csspart metric - One metric card.
 * @csspart chart - The trend chart.
 * @csspart metric-unavailable - The notice when a non-empty `metricId` matches no metric.
 * @csspart runs - The run history.
 * @csspart runs-heading - The run history heading.
 * @csspart run - One run row.
 * @csspart run-label - A run label.
 * @csspart run-meta - Status and metric value.
 * @csspart run-status - A run status badge.
 * @csspart limit - Visible notice when the run history exceeds `maxRenderedRuns`.
 * @csspart run-status-message - Optional caller-supplied detail for a run status.
 * @csspart empty - The empty history message.
 * @cssprop [--lr-agent-eval-dashboard-active-border=var(--lr-color-brand)] - Active metric border.
 * @cssprop [--lr-agent-eval-dashboard-active-bg=var(--lr-color-brand-quiet)] - Active metric background,
 *   and the base its hover/press mixes from.
 * @status stable
 * @since 6.2.0
 */
export class LyraAgentEvalDashboard extends LyraElement<LyraAgentEvalDashboardEventMap> {
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
    durationMilliseconds: LYRA_DEFAULT_durationMilliseconds,
    durationSeconds: LYRA_DEFAULT_durationSeconds,
    evaluationDashboardLabel: LYRA_DEFAULT_evaluationDashboardLabel,
    evaluationDashboardMetricUnavailable: LYRA_DEFAULT_evaluationDashboardMetricUnavailable,
    evaluationDashboardNoRuns: LYRA_DEFAULT_evaluationDashboardNoRuns,
    evaluationDashboardRunsLabel: LYRA_DEFAULT_evaluationDashboardRunsLabel,
    ragEvalDashboardRunsLimit: LYRA_DEFAULT_ragEvalDashboardRunsLimit,
    statusError: LYRA_DEFAULT_statusError,
    statusRunning: LYRA_DEFAULT_statusRunning,
  };
  // GENERATED DEFAULT-STRING SLICE: END
  protected static override collectionSupport = collectionSupport;

  protected static override readonly ownedCollectionProperties = Object.freeze(['metrics', 'runs']);
  protected static override readonly immutableEventDetails = Object.freeze(['lr-run-activate']);

  static override styles = [LyraElement.styles, styles];

  private readonly runFocus = new RovingListController(this, {
    items: () => [...this.renderRoot.querySelectorAll<HTMLButtonElement>('[part="run"]')],
  });

  private projectedRunsTruncated = false;
  private readonly limitAnnouncements = new AnnouncementSinkController(this, { eager: ['polite'] });

  constructor() {
    super();
    new InputLimitAnnouncement(this, {
      limited: () => this.projectedRunsTruncated,
      announce: () => this.limitAnnouncements.announcePolite(this.localize('ragEvalDashboardRunsLimit', undefined, {
        count: this.formatLocaleNumber(Math.max(1, finiteCount(this.maxRenderedRuns, 100, 500))),
      })),
    });
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.limitAnnouncements.adopted();
  }

  /** Metric cards and selector choices. Empty ids are omitted; duplicates normalize first-wins. */
  @property({ attribute: false }) metrics: readonly AgentEvaluationMetric[] = [];
  /** Run history used by both the chart and list. Empty ids are omitted; duplicates normalize
   *  first-wins. */
  @property({ attribute: false }) runs: readonly AgentEvaluationDashboardRun[] = [];
  /** Controlled metric selection. `null`, `''` or an unmatched identity selects the first valid
   *  metric; a non-empty unmatched id also shows the `metric-unavailable` note. */
  @property({ attribute: 'metric-id' }) metricId: string | null = null;
  /** ISO 4217 currency code used by metrics whose format is `currency`. Invalid codes use USD. */
  @property() currency = 'USD';
  /** Accessible/visible heading override. Optional. Omitting it localizes the default
   *  `evaluationDashboardLabel` message; an explicit empty string renders no visible/accessible
   *  label. */
  @property() label?: string;
  /** Level of the visible heading, with the run history heading one level below it: `'1'`-`'6'`, or
   *  `'none'` for no heading semantics. */
  @property({ attribute: 'heading-level' }) headingLevel: LyraHeadingLevel = '2';
  /** Suppresses the metric trend chart. */
  @property({ type: Boolean, attribute: 'without-chart', reflect: true }) withoutChart = false;
  /** Height of the metric trend chart, as a CSS length. Defaults to `220px`. */
  @property({ attribute: 'chart-height' }) chartHeight = '220px';
  /** Maximum history entries rendered into both the run list and trend chart. Clamped to 1–500. The
   *  first N runs in input order are kept, so pass newest-first history to chart the most recent runs. */
  @property({ type: Number, attribute: 'max-rendered-runs' }) maxRenderedRuns = 100;
  private metricsFor?: unknown;
  private metricsCache: AgentEvaluationMetric[] = [];
  private runsFor?: unknown;
  private runsCache: AgentEvaluationDashboardRun[] = [];
  private get normalizedMetrics(): AgentEvaluationMetric[] {
    if (this.metricsFor !== this.metrics) {
      this.metricsFor = this.metrics;
      this.metricsCache = firstByIdentity(Array.isArray(this.metrics) ? this.metrics : [], (metric) => metric.id);
    }
    return this.metricsCache;
  }
  private get normalizedRuns(): AgentEvaluationDashboardRun[] {
    if (this.runsFor !== this.runs) {
      this.runsFor = this.runs;
      this.runsCache = firstByIdentity(Array.isArray(this.runs) ? this.runs : [], (run) => run.id);
    }
    return this.runsCache;
  }
  private slicedFor?: { source: AgentEvaluationDashboardRun[]; limit: number; runs: AgentEvaluationDashboardRun[] };
  /** Chart labels/datasets, rebuilt only when the rendered runs or the active metric change. */
  private chartFor?: { runs: AgentEvaluationDashboardRun[]; active: AgentEvaluationMetric };
  private chartCache: { labels: string[]; datasets: { label: string; data: (number | null)[] }[] } = { labels: [], datasets: [] };
  private chartInputs(runs: AgentEvaluationDashboardRun[], active: AgentEvaluationMetric): typeof this.chartCache {
    if (this.chartFor?.runs !== runs || this.chartFor.active !== active) {
      this.chartFor = { runs, active };
      this.chartCache = {
        labels: runs.map((run) => run.label),
        datasets: [{ label: active.label, data: runs.map((run) => ownMetricValue(run, active.id) ?? null) }],
      };
    }
    return this.chartCache;
  }

  private get activeMetric(): AgentEvaluationMetric | undefined {
    const metrics = this.normalizedMetrics;
    return (this.metricId ? metrics.find((metric) => metric.id === this.metricId) : undefined) ?? metrics[0];
  }
  private statusLabel(status: AgentStatusValue): string {
    return agentStatusLabel(status) ?? agentStatusText(this.localize.bind(this), agentStatusKind(status));
  }
  private formatMetric(metric: AgentEvaluationMetric, value = metric.value): string {
    const safe = Number.isFinite(value) ? value : 0;
    const tiny = safe !== 0 && Math.abs(safe) < 0.01;
    const digits = (fractionDigits: number): Intl.NumberFormatOptions =>
      tiny ? { maximumSignificantDigits: 2 } : { maximumFractionDigits: fractionDigits };
    switch (metric.format) {
      case 'percent':
        if (safe !== 0 && Math.abs(safe) < 0.001) return formatAdaptiveShare(this.effectiveLocale, safe);
        return getNumberFormat(this.effectiveLocale, {
          style: 'percent',
          maximumFractionDigits: 1,
        }).format(safe);
      case 'milliseconds':
        return formatShortDuration(this.localize.bind(this), this.effectiveLocale, safe);
      case 'currency': {
        try {
          return getNumberFormat(this.effectiveLocale, {
            style: 'currency',
            currency: this.currency,
            ...digits(2),
          }).format(safe);
        } catch {
          return getNumberFormat(this.effectiveLocale, {
            style: 'currency',
            currency: 'USD',
            ...digits(2),
          }).format(safe);
        }
      }
      default:
        return getNumberFormat(this.effectiveLocale, digits(2)).format(safe);
    }
  }
  private renderRuns(runs: AgentEvaluationDashboardRun[]): TemplateResult {
    if (!runs.length) return html`<p part="empty">${this.localize('evaluationDashboardNoRuns')}</p>`;
    const active = this.activeMetric;
    const level = resolveHeadingLevel(this.headingLevel, '2');
    const runsLevel = level && String(Math.min(6, Number(level) + 1));
    return html`<section part="runs" aria-label=${this.localize('evaluationDashboardRunsLabel')} @keydown=${this.runFocus.onKeyDown}><div part="runs-heading" role=${runsLevel ? 'heading' : nothing} aria-level=${runsLevel || nothing}>${this.localize('evaluationDashboardRunsLabel')}</div>${repeat(runs, (run) => run.id, (run) => {
      const kind = agentStatusKind(run.status);
      const message = agentStatusMessage(run.status);
      return html`<button part="run" type="button" @click=${() => this.emit('lr-run-activate', { runId: run.id, run })}><span part="run-label">${run.label}</span><span part="run-meta"><lr-badge part="run-status" variant=${agentStatusVariant(run.status, ((Object.prototype.hasOwnProperty.call(AGENT_STATUS_VARIANTS, kind) ? AGENT_STATUS_VARIANTS[kind] : undefined) ?? 'neutral'))}>${this.statusLabel(run.status)}</lr-badge>${message !== undefined ? html`<span part="run-status-message">${message}</span>` : nothing}${active && ownMetricValue(run, active.id) !== undefined ? html`<span>${this.formatMetric(active, ownMetricValue(run, active.id))}</span>` : nothing}</span></button>`;
    })}</section>`;
  }
  override render(): TemplateResult {
    const label = this.label == null ? this.localize('evaluationDashboardLabel') : this.label;
    const semanticLabel = overallSemanticLabel(this, label);
    const active = this.activeMetric;
    const allRuns = this.normalizedRuns;
    const limit = Math.max(1, finiteCount(this.maxRenderedRuns, 100, 500));
    if (this.slicedFor?.source !== allRuns || this.slicedFor.limit !== limit) {
      this.slicedFor = { source: allRuns, limit, runs: allRuns.slice(0, limit) };
    }
    const runs = this.slicedFor.runs;
    this.projectedRunsTruncated = allRuns.length > runs.length;
    const metrics = this.normalizedMetrics;
    const level = resolveHeadingLevel(this.headingLevel, '2');
    return html`<section part="base" aria-label=${semanticLabel ?? nothing}>
      ${label === '' ? nothing : html`<div part="heading" role=${level ? 'heading' : nothing} aria-level=${level ?? nothing}>${label}</div>`}
      ${metrics.length
        ? html`<div part="metrics">${repeat(metrics, (metric) => metric.id, (metric) => {
            const value = this.formatMetric(metric);
            return html`<button
              part="metric"
              type="button"
              data-metric-id=${metric.id}
              aria-pressed=${active?.id === metric.id ? 'true' : 'false'}
              aria-label=${this.localize('chartValueLabel', undefined, { label: metric.label, value })}
              @click=${() => this.emit('lr-metric-change-request', { metricId: metric.id })}
            ><lr-stat frame="plain" .label=${metric.label} .value=${value}></lr-stat></button>`;
          })}</div>`
        : nothing}
      ${this.metricId && active?.id !== this.metricId ? html`<p part="metric-unavailable" role="note">${this.localize('evaluationDashboardMetricUnavailable', undefined, { metric: this.metricId })}</p>` : nothing}
      ${!this.withoutChart && active && runs.length
        ? html`<div part="chart"><lr-lite-chart type="line" .height=${this.chartHeight} .labels=${this.chartInputs(runs, active).labels} .datasets=${this.chartInputs(runs, active).datasets} with-legend aria-label=${active.label}></lr-lite-chart></div>`
        : nothing}
      ${this.renderRuns(runs)}
      ${this.projectedRunsTruncated
        ? html`<p part="limit" role="note">${this.localize('ragEvalDashboardRunsLimit', undefined, {
            count: this.formatLocaleNumber(runs.length),
          })}</p>`
        : nothing}
    </section>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-agent-eval-dashboard': LyraAgentEvalDashboard; } }
