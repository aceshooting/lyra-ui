import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraFrame } from '../../../internal/variants.js';
import { spinnerIcon } from '../../../internal/icons.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { durationMessageValue } from '../../../internal/duration.js';
import { finiteRange } from '../../../internal/numbers.js';
import { srOnly } from '../../../internal/a11y.js';
import { AGENT_STATUS_VARIANTS } from '../../../internal/agent-status-variants.js';
import type { AgentRun, AgentStatusKind, AgentStep, CancelEventDetail, RetryEventDetail } from '../../../ai/types.js';
import type { BadgeVariant } from '../../overlays/badge/badge.class.js';
import type { TaskItem, TaskStatus } from '../task-list/task-list.class.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import { styles } from './agent-run.styles.js';
import { firstByIdentity } from '../collection-identity.js';

import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_agentRunCurrentStepLabel, LYRA_DEFAULT_agentRunStatusAnnounce, LYRA_DEFAULT_agentRunStatusCancelled, LYRA_DEFAULT_agentRunStatusCollecting, LYRA_DEFAULT_agentRunStatusDone, LYRA_DEFAULT_agentRunStatusIdle, LYRA_DEFAULT_agentRunStatusQueued, LYRA_DEFAULT_agentRunStatusWaitingApproval, LYRA_DEFAULT_agentRunStatusWaitingInput, LYRA_DEFAULT_cancel, LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_durationMilliseconds, LYRA_DEFAULT_durationSeconds, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_noData, LYRA_DEFAULT_open, LYRA_DEFAULT_popover, LYRA_DEFAULT_retry, LYRA_DEFAULT_search, LYRA_DEFAULT_select, LYRA_DEFAULT_statusError, LYRA_DEFAULT_statusRunning } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** Statuses for which the live elapsed-time ticker (and the built-in Cancel button) apply -- a
 *  run is still genuinely "going" while waiting on the user or an approval gate, not just while
 *  actively `running`. */
const TICKING_KINDS: ReadonlySet<string> = new Set(['running', 'collecting', 'waiting-input', 'waiting-approval']);

/** Terminal statuses for which a static (not live-ticking) duration applies, and for which the
 *  built-in Retry button becomes relevant (a subset -- see `canRetry`). */
const TERMINAL_KINDS: ReadonlySet<string> = new Set(['done', 'error', 'cancelled']);

/** Badge label per status. `running`/`error` reuse this library's existing generic `statusRunning`/
 *  `statusError` keys (identical wording already used by `<lr-task-list>`'s own per-item status
 *  text) rather than duplicating them. The other seven built-in kinds use agent-run-specific keys.
 *  `<lr-task-list>`'s own vocabulary (`pending`/`running`/`success`/`error`) is
 *  deliberately narrower than `AgentStatusKind` (see `AgentStatus`'s own doc comment in
 *  `src/ai/types.ts`) and collapsing e.g. `waiting-input`/`waiting-approval` down to it would
 *  discard exactly the distinction a host most needs to act on. */
const STATUS_LABEL: Record<string, { key: string }> = {
  idle: { key: 'agentRunStatusIdle' },
  running: { key: 'statusRunning' },
  queued: { key: 'agentRunStatusQueued' },
  collecting: { key: 'agentRunStatusCollecting' },
  'waiting-input': { key: 'agentRunStatusWaitingInput' },
  'waiting-approval': { key: 'agentRunStatusWaitingApproval' },
  done: { key: 'agentRunStatusDone' },
  error: { key: 'statusError' },
  cancelled: { key: 'agentRunStatusCancelled' },
};

/** Coarsens the broader `AgentStatusKind` down to `<lr-task-list>`'s own narrower `TaskStatus`
 *  vocabulary, for the default tasks-slot content only (see `defaultTaskItems()`). Both
 *  `waiting-*` kinds map to `'running'` -- still in progress from the plan's point of view, even
 *  though it isn't actively executing -- and `cancelled` maps to `'error'`, the closest of
 *  `TaskStatus`'s four terminal-ish states since `<lr-task-list>` has no cancelled concept of its
 *  own. */
const STEP_TO_TASK_STATUS: Record<string, TaskStatus> = {
  idle: 'pending',
  running: 'running',
  collecting: 'running',
  'waiting-input': 'running',
  'waiting-approval': 'running',
  done: 'success',
  error: 'error',
  cancelled: 'error',
};

function toTaskItem(step: AgentStep): TaskItem {
  return {
    id: step.id,
    label: step.label,
    status: STEP_TO_TASK_STATUS[step.status.kind] ?? 'pending',
    detail: step.status.message,
  };
}

export interface AgentRunMetric {
  id: string;
  label: string;
  value: string | number;
  variant?: BadgeVariant;
}

/** Visual chrome for `<lr-agent-run>`'s root — the library's shared container-frame vocabulary. */
export type AgentRunAppearance = LyraFrame;

export interface LyraAgentRunEventMap {
  'lr-cancel': CustomEvent<CancelEventDetail>;
  'lr-run-retry': CustomEvent<RetryEventDetail>;
}

/**
 * `<lr-agent-run>` — the top-level shell for one `AgentRun`: lifecycle-status badge, elapsed
 * time, current step, model/cost summary, and built-in Cancel/Retry controls in a header, plus
 * four named composition slots (`tasks`/`tools`/`reasoning`/`output`) for the run's actual
 * content. This is deliberately a SHELL, not a new step-rendering surface — every piece of
 * per-step or per-invocation rendering routes through an existing primitive:
 *
 * - **Elapsed time**: composes `<lr-generation-metrics>` (`status`/`started-at`, its own built-in
 *   Stop button hidden via `show-stop="false"` since this component renders its own Cancel/Retry
 *   pair instead) for the *live, ticking* readout while the run is genuinely in progress
 *   (`running`/`collecting`/`waiting-input`/`waiting-approval`). `<lr-stream-status>` doesn't fit:
 *   its `phase` vocabulary
 *   (`idle`/`connecting`/`streaming`/`stalled`) models transport/connection health, not an agent
 *   run's nine built-in lifecycle statuses (plus application-defined extensions), and it exposes no elapsed-time readout at all — exactly the
 *   distinction `<lr-generation-metrics>`'s own class doc already draws between the two. Once the
 *   run reaches a terminal state (`done`/`error`/`cancelled`) with both a `startedAt` and an
 *   `endedAt`, this component instead renders a small locally-formatted static duration
 *   (`endedAt - startedAt`): `<lr-generation-metrics>`'s `status="complete"` semantics only
 *   ever freeze at whatever it last computed *live*, so mounting it directly against a completed
 *   run loaded from history (e.g. `startedAt` yesterday, `endedAt` five minutes later, loaded
 *   today) would either show a stale zero or the wrong multi-hour span — it has no way to render a
 *   fixed historical span on demand. That static fallback reuses the side-effect-free duration
 *   value model shared by the run/tool surfaces while retaining this component's own localized
 *   message interpolation.
 * - **Model + cost summary**: composes `<lr-usage-badge>`, fed `run.costEstimate` (formatted via
 *   `formatCost`, or a plain `Intl.NumberFormat` by default — this library never assumes a
 *   currency, see `<lr-format-number>`'s own explicit `currency` prop) as its `cost-text`.
 *   `run.model` (a plain string with no analogous `<lr-usage-badge>` property) renders alongside
 *   as plain text.
 * - **Current step**: a single-line summary of whichever `run.steps` entry currently has
 *   `status.kind === 'running'` (the last such entry, if more than one) — a plain text line, not a
 *   list, so it doesn't duplicate `<lr-task-list>`'s own per-item rendering.
 * - **Tasks slot default content**: when the host doesn't slot anything into `tasks` and
 *   `run.steps` is non-empty, this component's own `<slot>` fallback renders a `<lr-task-list>`
 *   populated by mapping every `AgentStep` to a `TaskItem` (see `toTaskItem()`) — a plain data
 *   adapter between the two existing shapes, not new rendering.
 * - **Status badge**: composes `<lr-badge>`. **Empty state**: composes `<lr-empty>` when `run` is
 *   `null`.
 *
 * `tools`/`reasoning`/`output` are plain named slots with no default content — entirely the
 * host's own composition (typically `<lr-tool-call-chip>`/`<lr-tool-result-view>` rows,
 * reasoning/streaming text, and final output respectively). An `actions` slot adds extra header
 * controls alongside the built-in Cancel/Retry pair. The `header` and `summary` slots replace the
 * built-in lifecycle header and model/usage/metrics summary respectively. `statusLabels` and
 * `statusVariants` make application-defined lifecycle kinds first-class, while `metrics` renders
 * arbitrary labeled values such as prompt and completion token counts.
 *
 * The built-in Cancel button renders while `showCancel` is true and the run's status is one of
 * `TICKING_KINDS` (still genuinely in progress); Retry renders while `showRetry` is true and the
 * status is `error` or `cancelled`. Clicking either fires `lr-cancel`/`lr-run-retry` with
 * `CancelEventDetail`/`RetryEventDetail` from `src/ai/types.ts` — this component never cancels or
 * retries anything itself, it only requests. `RetryEventDetail.attempt` is a 1-based counter
 * local to this component, incremented on every `lr-run-retry` click and reset to `0` whenever
 * `run.id` changes (a genuinely new run replacing the old one, as opposed to the same run's status
 * merely updating in place).
 *
 * Lifecycle transitions into an attention-needing or terminal state (`waiting-input`,
 * `waiting-approval`, `done`, `error`, `cancelled`) are announced through an internal
 * `<lr-live-region>`, mirroring `<lr-stream-status>`'s own stall/recover announcements —
 * `running`/`idle` transitions are frequent and not independently actionable, so they stay
 * silent, and whatever status a freshly-assigned `run` (a new `run.id`) happens to already carry
 * is never itself treated as an eventful transition, only a later in-place change is.
 *
 * Public collection and status-map properties take bounded, clone-owned readonly snapshots.
 * Create and reassign a new array or record after changes; mutating the assigned value does not
 * update the view.
 *
 * @customElement lr-agent-run
 * @slot tasks - Task/plan content. Falls back to a `<lr-task-list>` built from `run.steps` when
 *   nothing is slotted and `run.steps` is non-empty.
 * @slot header - Replaces the built-in lifecycle header and its built-in actions.
 * @slot summary - Replaces the built-in model, usage, and metrics summary.
 * @slot tools - Tool-call content (e.g. `<lr-tool-call-chip>`/`<lr-tool-result-view>` rows). No
 *   default content.
 * @slot reasoning - Reasoning/thinking content. No default content.
 * @slot output - The run's final output content. No default content.
 * @slot actions - Extra header actions alongside the built-in Cancel/Retry buttons.
 * @event lr-cancel - The built-in Cancel button was activated. `detail: CancelEventDetail`
 *   (`{ reason }`, always `undefined` from the built-in button itself).
 * @event lr-run-retry - The built-in Retry button was activated. `detail: RetryEventDetail`
 *   (`{ attempt }`, a 1-based counter reset per `run.id`).
 * @csspart base - The root container.
 * @csspart empty - The `<lr-empty>` shown when `run` is `null`.
 * @csspart header - The header row wrapping status, elapsed time, current step, summary, and actions.
 * @csspart status - Wrapper around the status badge and optional status message.
 * @csspart status-badge - The resolved `<lr-badge>` lifecycle-status pill.
 * @csspart status-message - `run.status.message`, when set.
 * @csspart elapsed - The composed `<lr-generation-metrics>`, only rendered while the run is
 *   actively ticking (see the class doc).
 * @csspart elapsed-static - The static formatted duration for a terminal run with both
 *   `startedAt` and `endedAt`.
 * @csspart current-step - Wrapper around the current-step icon and label. Only rendered while a
 *   step has `status.kind === 'running'`.
 * @csspart current-step-icon - The spinning current-step icon.
 * @csspart current-step-label - The current step's `label` text.
 * @csspart summary - Wrapper around the model text and the composed `<lr-usage-badge>`. Only
 *   rendered while `run.model` or a valid `run.costEstimate` is present.
 * @csspart model - `run.model`, when set.
 * @csspart usage - The composed `<lr-usage-badge>`.
 * @csspart metric - One arbitrary metric in the built-in summary.
 * @csspart metric-label - The metric's label.
 * @csspart metric-value - The metric's value.
 * @csspart actions - Wrapper around the `actions` slot and the built-in Cancel/Retry buttons.
 * @csspart cancel-button - The built-in Cancel button. Only rendered while cancelable (see the
 *   class doc).
 * @csspart retry-button - The built-in Retry button. Only rendered while retryable.
 * @csspart body - Wrapper around the four composition slots.
 * @csspart tasks - The `tasks` slot.
 * @csspart tools - The `tools` slot.
 * @csspart reasoning - The `reasoning` slot.
 * @csspart output - The `output` slot.
 * @cssprop [--lr-agent-run-spin=var(--lr-transition-ambient)] - Current-step icon spin animation.
 * @cssprop [--lr-agent-run-metric-brand-color=var(--lr-color-brand)] - Brand metric value.
 * @cssprop [--lr-agent-run-metric-danger-color=var(--lr-color-danger)] - Danger metric value.
 * @cssprop [--lr-agent-run-metric-success-color=var(--lr-color-success)] - Success metric value.
 * @cssprop [--lr-agent-run-metric-warning-color=var(--lr-color-warning)] - Warning metric value.
 * @cssprop [--lr-agent-run-compact-padding=var(--lr-space-s)] - `[part="base"]` padding while
 *   `compact`.
 * @cssprop [--lr-agent-run-compact-gap=var(--lr-space-s)] - Gap between `[part="base"]`'s header
 *   and body while `compact`.
 * @status stable
 * @since 4.1.0
 */
export class LyraAgentRun extends LyraElement<LyraAgentRunEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    agentRunCurrentStepLabel: LYRA_DEFAULT_agentRunCurrentStepLabel,
    agentRunStatusAnnounce: LYRA_DEFAULT_agentRunStatusAnnounce,
    agentRunStatusCancelled: LYRA_DEFAULT_agentRunStatusCancelled,
    agentRunStatusCollecting: LYRA_DEFAULT_agentRunStatusCollecting,
    agentRunStatusDone: LYRA_DEFAULT_agentRunStatusDone,
    agentRunStatusIdle: LYRA_DEFAULT_agentRunStatusIdle,
    agentRunStatusQueued: LYRA_DEFAULT_agentRunStatusQueued,
    agentRunStatusWaitingApproval: LYRA_DEFAULT_agentRunStatusWaitingApproval,
    agentRunStatusWaitingInput: LYRA_DEFAULT_agentRunStatusWaitingInput,
    cancel: LYRA_DEFAULT_cancel,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    durationMilliseconds: LYRA_DEFAULT_durationMilliseconds,
    durationSeconds: LYRA_DEFAULT_durationSeconds,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    noData: LYRA_DEFAULT_noData,
    open: LYRA_DEFAULT_open,
    popover: LYRA_DEFAULT_popover,
    retry: LYRA_DEFAULT_retry,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
    statusError: LYRA_DEFAULT_statusError,
    statusRunning: LYRA_DEFAULT_statusRunning,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly ownedCollectionProperties = Object.freeze([
    'run',
    'statusLabels',
    'statusVariants',
    'metrics',
  ]);

  static override styles = [LyraElement.styles, srOnly, styles];

  /** The run to display. Controlled and never mutated by this component -- pass a new object to
   *  update it. `null` renders the shared `<lr-empty>` `noData` state. */
  @property({ attribute: false }) run: AgentRun | null = null;

  /** Overrides the default plain `Intl.NumberFormat` rendering of `run.costEstimate` fed to the
   *  composed `<lr-usage-badge>`'s `cost-text` -- e.g. to add a currency symbol/code, which this
   *  library never assumes on a host's behalf. */
  @property({ attribute: false }) formatCost?: (cost: number) => string;

  /** Clone-owned labels for application-defined lifecycle kinds. Built-in kinds remain localized
   *  by Lyra. Reassign a new record after changes. */
  @property({ attribute: false }) statusLabels: Readonly<Record<string, string>> = {};

  /** Clone-owned badge variants for application-defined lifecycle kinds. Unknown kinds default to
   *  `neutral`. Reassign a new record after changes. */
  @property({ attribute: false }) statusVariants: Readonly<Record<string, BadgeVariant>> = {};

  /** Additional run metrics such as prompt/completion token counts. Empty/blank ids are omitted
   *  and duplicates normalize first-wins before summary visibility and rendering. */
  @property({ attribute: false }) metrics: readonly AgentRunMetric[] = [];

  private get normalizedMetrics(): AgentRunMetric[] {
    return firstByIdentity(Array.isArray(this.metrics) ? this.metrics : [], (metric) => metric.id);
  }

  /** Whether the built-in Cancel button can render at all -- still gated by the run's own status
   *  being cancelable (`running`/`collecting`/`waiting-input`/`waiting-approval`). Set `false` for a read-only
   *  viewer. */
  @property({ type: Boolean, attribute: 'show-cancel', converter: trueDefaultBooleanConverter }) showCancel = true;

  /** Whether the built-in Retry button can render at all -- still gated by the run's own status
   *  being retryable (`error`/`cancelled`). */
  @property({ type: Boolean, attribute: 'show-retry', converter: trueDefaultBooleanConverter }) showRetry = true;

  /** Tighter root padding and header/body gap for dense contexts (a run rendered as a row in a
   *  list, a side panel) -- same convention as `lr-empty`'s `compact`. Defaults to `false`, i.e.
   *  the full card padding. Purely a density knob: the border and background stay, so use
   *  `frame="plain"` instead to drop the chrome entirely. */
  @property({ type: Boolean, reflect: true }) compact = false;

  /** Visual chrome, in the library's shared container-frame vocabulary. `'card'` (the default)
   *  keeps the bordered, filled, padded box. `'plain'` removes the border, background, padding and
   *  corner radius, so a run nested inside a host container that already draws a border doesn't
   *  double it. `plain` wins over `compact` when both are set (nothing left to tighten). The
   *  built-in Cancel/Retry buttons draw their own border/background and stay visibly interactive
   *  either way. */
  @property({ reflect: true }) frame: LyraFrame = 'card';

  @state() private retryAttempt = 0;
  @state() private hasHeaderSlot = false;
  @state() private hasSummarySlot = false;

  @query('lr-live-region') private liveRegion?: LyraLiveRegion;

  // Both read (for this update's decisions) then overwritten (at the end of `updated()`) --
  // `willUpdate()` needs the *previous* run id to decide whether to reset `retryAttempt`, and
  // `updated()` needs both the previous id and the previous status kind to decide whether this
  // update is a genuine in-place transition worth announcing. See `handleRunChange()`.
  private previousRunId?: string;
  private previousStatusKind?: AgentStatusKind;

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!this.hasUpdated) {
      this.hasHeaderSlot = this.hasSlotted('header');
      this.hasSummarySlot = this.hasSlotted('summary');
    }
    if (changed.has('run') && this.run?.id !== this.previousRunId) {
      this.retryAttempt = 0;
    }
  }

  private hasSlotted(name: string): boolean {
    return Array.from(this.children).some((element) => element.getAttribute('slot') === name);
  }

  private onHeaderSlotChange = (e: Event): void => {
    this.hasHeaderSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onSummarySlotChange = (e: Event): void => {
    this.hasSummarySlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('run')) this.handleRunChange();
  }

  private handleRunChange(): void {
    const runId = this.run?.id;
    const kind = this.run?.status.kind;
    const isFreshRun = runId !== this.previousRunId;
    if (!isFreshRun && kind !== undefined && kind !== this.previousStatusKind && this.isAttentionKind(kind)) {
      this.announceStatus(kind);
    }
    this.previousRunId = runId;
    this.previousStatusKind = kind;
  }

  private isAttentionKind(kind: AgentStatusKind): boolean {
    return kind === 'waiting-input' || kind === 'waiting-approval' || TERMINAL_KINDS.has(kind);
  }

  private announceStatus(kind: AgentStatusKind): void {
    const region = this.liveRegion;
    if (!region) return;
    region.mode = kind === 'error' || kind === 'waiting-input' || kind === 'waiting-approval' ? 'assertive' : 'polite';
    region.announce(this.localize('agentRunStatusAnnounce', undefined, { status: this.statusLabel(kind) }), {
      force: true,
    });
  }

  private statusLabel(kind: AgentStatusKind): string {
    const custom = this.statusLabels[kind];
    if (custom) return custom;
    const builtIn = STATUS_LABEL[kind];
    if (builtIn) return this.localize(builtIn.key);
    return kind.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private get currentStep(): AgentStep | undefined {
    const steps = this.run?.steps;
    if (!steps) return undefined;
    for (let i = steps.length - 1; i >= 0; i--) {
      if (steps[i]!.status.kind === 'running') return steps[i];
    }
    return undefined;
  }

  private get isTicking(): boolean {
    const kind = this.run?.status.kind;
    return kind !== undefined && TICKING_KINDS.has(kind) && Number.isFinite(this.run?.startedAt);
  }

  /** The static formatted duration for a terminal run with both `startedAt` and `endedAt` --
   *  `undefined` while ticking, not yet terminal, or missing either timestamp (see the class
   *  doc's "elapsed time" section for why a terminal run doesn't reuse the live ticker). */
  private get staticElapsedText(): string | undefined {
    const run = this.run;
    if (!run || !TERMINAL_KINDS.has(run.status.kind)) return undefined;
    const startedAt = run.startedAt;
    const endedAt = run.endedAt;
    if (startedAt == null || endedAt == null || !Number.isFinite(startedAt) || !Number.isFinite(endedAt)) {
      return undefined;
    }
    const d = durationMessageValue(Math.max(0, endedAt - startedAt));
    return this.localize(d.key, undefined, {
      value: getNumberFormat(this.effectiveLocale, {
        maximumFractionDigits: d.key === 'durationSeconds' ? 1 : 0,
      }).format(d.value),
    });
  }

  private get costText(): string {
    const cost = this.run?.costEstimate;
    if (cost == null || !Number.isFinite(cost)) return '';
    const value = finiteRange(cost, cost, 0);
    const formatter = this.formatCost ?? ((c: number) => getNumberFormat(this.effectiveLocale, { maximumFractionDigits: 4 }).format(c));
    return formatter(value);
  }

  private get canCancel(): boolean {
    const kind = this.run?.status.kind;
    return this.showCancel && kind !== undefined && TICKING_KINDS.has(kind);
  }

  private get canRetry(): boolean {
    const kind = this.run?.status.kind;
    return this.showRetry && (kind === 'error' || kind === 'cancelled');
  }

  private onCancelClick = (): void => {
    this.emit('lr-cancel', {});
  };

  private onRetryClick = (): void => {
    this.retryAttempt += 1;
    this.emit('lr-run-retry', { attempt: this.retryAttempt });
  };

  override render(): TemplateResult {
    const run = this.run;
    if (!run) {
      return html`<div part="base"><lr-empty part="empty" heading=${this.localize('noData')}></lr-empty></div>`;
    }

    const kind = run.status.kind;
    const step = this.currentStep;
    const ticking = this.isTicking;
    const staticElapsed = this.staticElapsedText;
    const cost = this.costText;
    const metrics = this.normalizedMetrics;
    const hasSummary = !!run.model || cost !== '' || metrics.length > 0;

    return html`
      <div part="base">
        <div part="header">
          <slot name="header" @slotchange=${this.onHeaderSlotChange}></slot>
          ${!this.hasHeaderSlot
            ? html`
                <div part="status">
                  <lr-badge
                    part="status-badge"
                    variant=${this.statusVariants[kind] ?? AGENT_STATUS_VARIANTS[kind] ?? 'neutral'}
                    >${this.statusLabel(kind)}</lr-badge
                  >
                  ${run.status.message ? html`<span part="status-message">${run.status.message}</span>` : nothing}
                </div>
                ${ticking
                  ? html`<lr-generation-metrics
                      part="elapsed"
                      exportparts="elapsed:elapsed-time"
                      status="running"
                      .startedAt=${run.startedAt}
                      .showStop=${false}
                    ></lr-generation-metrics>`
                  : staticElapsed
                    ? html`<span part="elapsed-static">${staticElapsed}</span>`
                    : nothing}
                ${step
                  ? html`
                      <div part="current-step">
                        <span part="current-step-icon" aria-hidden="true">${spinnerIcon()}</span>
                        <span class="sr-only">${this.localize('agentRunCurrentStepLabel')}</span>
                        <span part="current-step-label">${step.label}</span>
                      </div>
                    `
                  : nothing}
                <div part="summary" ?hidden=${!hasSummary && !this.hasSummarySlot}>
                      <slot name="summary" @slotchange=${this.onSummarySlotChange}></slot>
                      ${!this.hasSummarySlot
                        ? html`
                            ${run.model ? html`<span part="model">${run.model}</span>` : nothing}
                            ${cost !== ''
                              ? html`<lr-usage-badge part="usage" exportparts="cost:cost" cost-text=${cost}></lr-usage-badge>`
                              : nothing}
                            ${metrics.map(
                              (metric) => html`<span part="metric" data-metric-id=${metric.id}>
                                <span part="metric-label">${metric.label}</span>
                                <span part="metric-value" data-variant=${metric.variant ?? nothing}>${metric.value}</span>
                              </span>`,
                            )}
                          `
                        : nothing}
                    </div>
                <div part="actions">
                  <slot name="actions"></slot>
                  ${this.canCancel
                    ? html`<button part="cancel-button" type="button" @click=${this.onCancelClick}>
                        ${this.localize('cancel')}
                      </button>`
                    : nothing}
                  ${this.canRetry
                    ? html`<button part="retry-button" type="button" @click=${this.onRetryClick}>
                        ${this.localize('retry')}
                      </button>`
                    : nothing}
                </div>
              `
            : nothing}
        </div>
        <div part="body">
          <slot part="tasks" name="tasks"
            >${run.steps.length > 0
              ? html`<lr-task-list .items=${run.steps.map(toTaskItem)}></lr-task-list>`
              : nothing}</slot
          >
          <slot part="tools" name="tools"></slot>
          <slot part="reasoning" name="reasoning"></slot>
          <slot part="output" name="output"></slot>
        </div>
        <lr-live-region></lr-live-region>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-agent-run': LyraAgentRun;
  }
}
