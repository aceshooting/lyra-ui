import { collectionSupport } from '../../../internal/collection-snapshot.js';
import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { guard } from 'lit/directives/guard.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { isRovingTargetAvailable, resolveListMove } from '../../../internal/list-navigation.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import {
  firstByRetrievalIdentity,
  isNonBlankIdentity,
  isRecord,
} from '../retrieval-identity.js';
import { finiteRange } from '../../../internal/numbers.js';
import { resolveHeadingLevel, type LyraHeadingLevel } from '../../../internal/heading-level.js';
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
import { LYRA_DEFAULT_ragEvalDashboardAllSlices, LYRA_DEFAULT_ragEvalDashboardEmpty, LYRA_DEFAULT_ragEvalDashboardLabel, LYRA_DEFAULT_ragEvalDashboardRuns, LYRA_DEFAULT_ragEvalDashboardRunsLimit, LYRA_DEFAULT_ragEvalDashboardSliceUnavailable, LYRA_DEFAULT_ragEvalDashboardSlices } from '../../../internal/default-strings.generated.js';
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
  'lr-metric-change-request': CustomEvent<{ metricId: string }>;
  /** @deprecated Use `lr-metric-change-request`. */
  'lr-metric-change': CustomEvent<{ metricId: string }>;
  'lr-slice-change-request': CustomEvent<{ slice: string }>;
  /** @deprecated Use `lr-slice-change-request`. */
  'lr-slice-change': CustomEvent<{ slice: string }>;
  'lr-run-activate': CustomEvent<{ runId: string; run: LyraRagEvaluationRun }>;
  /** @deprecated Use `lr-run-activate`. */
  'lr-run-change': CustomEvent<{ run: LyraRagEvaluationRun }>;
}

/** Caps how many of the most recent evaluation runs mount as `[part="run"]` buttons (and feed the
 *  trend chart), so a
 *  host-supplied `runs` array from a large benchmark sweep can never mount an unbounded number of
 *  interactive rows. Matches the 500-row ceiling used by every other bounded list in this library
 *  (e.g. `lr-task-list`'s `MAX_RENDERED_TASKS`). */
const MAX_RENDERED_RUNS = 500;

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
 * At most the 500 most recent of the currently filtered runs (the array end is newest) render as
 * `[part="run"]` buttons and feed the trend chart; a filtered set past that length renders a
 * localized `[part="limit"]` notice after the run history rather than mounting an unbounded number
 * of rows.
 *
 * Nothing here changes on a click: the host owns `metricId`, `slice` and the selected run, and the
 * events only report what the user asked for.
 *
 * @customElement lr-rag-eval-dashboard
 * @event lr-metric-change-request - A metric was activated; the host decides whether to change
 *   `metricId`. `detail: { metricId }`.
 * @event lr-metric-change - Deprecated alias of `lr-metric-change-request`, dispatched right after it.
 * @event lr-slice-change-request - An evaluation slice was activated; the host decides whether to
 *   change `slice`. `detail: { slice }`.
 * @event lr-slice-change - Deprecated alias of `lr-slice-change-request`, dispatched right after it.
 * @event lr-run-activate - An evaluation run was activated. `detail: { runId, run }`.
 * @event lr-run-change - Deprecated alias of `lr-run-activate` (`detail: { run }`), dispatched right
 *   after it.
 * @csspart base - The named dashboard region.
 * @csspart heading - The visible dashboard heading.
 * @csspart slices - Slice filter controls.
 * @csspart slice - One slice filter.
 * @csspart slice-selected - The controlled active slice.
 * @csspart metrics - Metric-card controls.
 * @csspart metric - One metric control.
 * @csspart metric-selected - The controlled active metric.
 * @csspart metric-category - The metric's caller-supplied category label.
 * @csspart chart - The active metric trend.
 * @csspart runs - Evaluation run history.
 * @csspart runs-heading - Run-history heading.
 * @csspart run - One evaluation run.
 * @csspart limit - Localized notice shown when the filtered runs exceed the 500-run render ceiling.
 * @csspart empty - The no-runs or unavailable-controlled-slice state.
 * @cssprop [--lr-rag-eval-dashboard-selected-border-color=var(--lr-color-brand)] - Border color
 *   shared by the controlled active slice and metric.
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
    ragEvalDashboardRunsLimit: LYRA_DEFAULT_ragEvalDashboardRunsLimit,
    ragEvalDashboardSliceUnavailable: LYRA_DEFAULT_ragEvalDashboardSliceUnavailable,
    ragEvalDashboardSlices: LYRA_DEFAULT_ragEvalDashboardSlices,
  };
  // GENERATED DEFAULT-STRING SLICE: END
  protected static override collectionSupport = collectionSupport;

  protected static override readonly ownedCollectionProperties = Object.freeze([
    'metrics',
    'runs',
  ]);

  static override styles = [LyraElement.styles, styles];

  /** Metric definitions shown as controls and used to format run values. */
  @property({ attribute: false }) metrics: readonly LyraRagEvaluationMetric[] =
    [];
  /** Evaluation runs displayed in the trend chart and run history. */
  @property({ attribute: false }) runs: readonly LyraRagEvaluationRun[] = [];
  /** Controlled id of the active metric; empty selects the first available metric. A non-empty
   *  value that matches no declared `metrics` entry selects no metric at all (no button renders
   *  `aria-pressed="true"`, and no chart renders) rather than silently substituting the first
   *  metric -- the host's own readback always agrees with what is rendered. */
  @property({ attribute: 'metric-id' }) metricId = '';
  /** Controlled evaluation slice. An unavailable value is preserved and renders an explicit
   * localized state until the host changes it or supplies a matching run. */
  @property() slice = '';
  /** Visible dashboard heading and fallback overall-region name. Omitting it falls back to a
   *  localized default; an explicit empty string clears both. A non-empty host `aria-label`
   *  makes the host the sole overall owner; an explicitly empty host label stays empty. */
  @property() label?: string;
  /** Omits the trend chart that otherwise renders when an active metric and matching runs exist. */
  @property({ type: Boolean, attribute: 'without-chart', reflect: true })
  withoutChart = false;
  /** Semantic level of the dashboard heading, with the run-history heading one level below it;
   *  `none` keeps the visible text without heading semantics. */
  @property({ attribute: 'heading-level' }) headingLevel: LyraHeadingLevel = '2';
  /** CSS block size forwarded to the composed trend chart. */
  @property({ attribute: 'chart-height' }) chartHeight = '220px';


  private metricsCache?: { source: unknown; value: LyraRagEvaluationMetric[] };
  private runsCache?: { source: unknown; value: LyraRagEvaluationRun[] };
  private rovingRunId = '';

  private get normalizedMetrics(): LyraRagEvaluationMetric[] {
    if (this.metricsCache?.source !== this.metrics)
      this.metricsCache = {
        source: this.metrics,
        value: firstByRetrievalIdentity(
          Array.isArray(this.metrics) ? this.metrics : [],
          (metric) => metric.id
        ),
      };
    return this.metricsCache.value;
  }

  private get normalizedRuns(): LyraRagEvaluationRun[] {
    if (this.runsCache?.source !== this.runs)
      this.runsCache = {
        source: this.runs,
        value: firstByRetrievalIdentity(
          Array.isArray(this.runs)
            ? this.runs.filter(
                (run): run is LyraRagEvaluationRun =>
                  isRecord(run) &&
                  isNonBlankIdentity(run['id']) &&
                  typeof run['label'] === 'string' &&
                  isRecord(run['metrics'])
              )
            : [],
          (run) => run.id
        ),
      };
    return this.runsCache.value;
  }

  private activeMetric(
    metrics: readonly LyraRagEvaluationMetric[]
  ): LyraRagEvaluationMetric | undefined {
    // An explicitly controlled but unmatched metricId must never silently substitute metrics[0] --
    // that would render a metric as selected/aria-pressed="true" while the host's own readback
    // still reports the (rejected) requested id, with no signal anything was substituted. Only an
    // EMPTY metricId (the documented "select first available metric" default) falls through to
    // metrics[0].
    return this.metricId
      ? metrics.find((metric) => metric.id === this.metricId)
      : metrics[0];
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
    return this.slice ? runs.filter((run) => run.slice === this.slice) : runs;
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
    for (let index = runs.length - 1; index >= 0; index -= 1) {
      const value = runs[index]!.metrics[metric.id];
      if (Number.isFinite(value)) return value;
    }
    return undefined;
  }

  private requestMetric(metricId: string): void {
    this.emit('lr-metric-change-request', { metricId });
    this.emit('lr-metric-change', { metricId });
  }

  private requestSlice(slice: string): void {
    this.emit('lr-slice-change-request', { slice });
    this.emit('lr-slice-change', { slice });
  }

  private activateRun(run: LyraRagEvaluationRun): void {
    this.emit('lr-run-activate', { runId: run.id, run });
    this.emit('lr-run-change', { run });
  }

  private onRunKeyDown(event: KeyboardEvent, index: number, count: number): void {
    const buttons = this.shadowRoot?.querySelectorAll<HTMLButtonElement>('[part="run"]');
    const next = resolveListMove(event, {
      count, current: index, orientation: 'vertical',
      isAvailable: (candidate) => Boolean(buttons?.[candidate] && isRovingTargetAvailable(buttons[candidate]!)),
    });
    if (next === null) return;
    event.preventDefault();
    buttons?.[next]?.focus();
  }

  private renderSlices(
    slices: readonly string[]
  ): TemplateResult | typeof nothing {
    if (!slices.length) return nothing;
    const allSlicesPart = this.slice ? 'slice' : 'slice slice-selected';
    return html`
      <nav part="slices" aria-label=${this.localize('ragEvalDashboardSlices')}>
        <button
          part=${allSlicesPart}
          type="button"
          data-slice=""
          aria-pressed=${this.slice ? 'false' : 'true'}
          @click=${() => this.requestSlice('')}
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
              @click=${() => this.requestSlice(slice)}
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
    const level = resolveHeadingLevel(this.headingLevel);
    const runsLevel = level && String(Math.min(6, +level + 1));
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
          <div part="heading" role=${level ? 'heading' : nothing} aria-level=${level ?? nothing}>${visibleLabel}</div>
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
    // Business values (the metric cards' `latestValue`) are always computed from the full
    // `filtered` set below; only the chart/run-history DOM node count is bounded here.
    const runsTruncated = filtered.length > MAX_RENDERED_RUNS;
    const renderedRuns = filtered.slice(-MAX_RENDERED_RUNS);
    const rovingRunId = renderedRuns.some((run) => run.id === this.rovingRunId)
      ? this.rovingRunId : renderedRuns[0]?.id;
    return html`
      <section
        part="base"
        role=${role ?? nothing}
        aria-label=${label ?? nothing}
      >
        <div part="heading" role=${level ? 'heading' : nothing} aria-level=${level ?? nothing}>${visibleLabel}</div>
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
                @click=${() => this.requestMetric(metric.id)}
              >
                <lr-stat
                  frame="plain"
                  .label=${metric.label}
                  .value=${this.formatMetric(
                    metric,
                    this.latestValue(metric, filtered)
                  )}
                ></lr-stat>
                <span part="metric-category">${metric.category}</span>
              </button>
            `;
          })}
        </div>
        ${!this.withoutChart && active && renderedRuns.length
          ? html`
              <div part="chart">
                <lr-lite-chart
                  type="line"
                  .height=${this.chartHeight}
                  .labels=${guard([this.runs, this.slice], () =>
                    renderedRuns.map((run) => run.label)
                  )}
                  .datasets=${guard([this.runs, this.slice, active], () => [
                    {
                      label: active.label,
                      data: renderedRuns.map((run) => {
                        const value = run.metrics[active.id];
                        return Number.isFinite(value) ? value : null;
                      }),
                    },
                  ])}
                  aria-label=${active.label}
                ></lr-lite-chart>
              </div>
            `
          : nothing}
        <section
          part="runs"
          aria-label=${this.localize('ragEvalDashboardRuns')}
        >
          <div part="runs-heading" role=${runsLevel ? 'heading' : nothing} aria-level=${runsLevel || nothing}>${this.localize('ragEvalDashboardRuns')}</div>
          ${renderedRuns.map(
            (run, index) => html`
              <button
                part="run"
                type="button"
                tabindex=${run.id === rovingRunId ? '0' : '-1'}
                @focus=${() => { this.rovingRunId = run.id; this.requestUpdate(); }}
                @keydown=${(event: KeyboardEvent) => this.onRunKeyDown(event, index, renderedRuns.length)}
                @click=${() => this.activateRun(run)}
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
          ${runsTruncated
            ? html`<p part="limit" role="note">${this.localize(
                'ragEvalDashboardRunsLimit',
                undefined,
                { count: getNumberFormat(this.effectiveLocale).format(MAX_RENDERED_RUNS) }
              )}</p>`
            : nothing}
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
