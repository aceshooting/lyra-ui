import { html, nothing, type TemplateResult, type PropertyValues, type ComplexAttributeConverter } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { spinnerIcon } from '../../../internal/icons.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { finiteRange } from '../../../internal/numbers.js';
import { srOnly } from '../../../internal/a11y.js';
import type { AgentRun, AgentStatusKind, AgentStep, CancelEventDetail, RetryEventDetail } from '../../../ai/types.js';
import type { BadgeVariant } from '../../overlays/badge/badge.class.js';
import type { TaskItem, TaskStatus } from '../task-list/task-list.class.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import { styles } from './agent-run.styles.js';

// Registers every custom element this component's own render() emits directly, so importing
// this `.class.ts` module alone (with no separate wrapper import) is already fully functional --
// mirrors `<lr-stream-status>`/`<lr-task-list>`'s own direct-registrar-import pattern (as opposed
// to a bare `*.class.js` import, which registers nothing on its own).
import '../../conversation/generation-status/generation-status.js';
import '../../conversation/usage-badge/usage-badge.js';
import '../task-list/task-list.js';
import '../../overlays/badge/badge.js';
import '../../overlays/empty/empty.js';
import '../../utility/live-region/live-region.js';

/** `true`-defaulting boolean attribute converter -- Lit's default presence-based `type: Boolean`
 *  can never be set back to `false` from a plain-HTML attribute once a property's own default is
 *  `true` (removing an attribute that was never present fires no `attributeChangedCallback`), so
 *  `fromAttribute` checks the literal string instead. Shared by `show-cancel` and `show-retry`,
 *  which have the identical `true`-default parsing need -- duplicated locally rather than
 *  imported, matching this exact converter's repeated per-component convention elsewhere in this
 *  library (see e.g. `<lr-task-list>`'s own `trueDefaultBooleanConverter`). */
const trueDefaultBooleanConverter: ComplexAttributeConverter<boolean> = {
  fromAttribute(value): boolean {
    return value !== 'false';
  },
  toAttribute(value): string | null {
    return value ? null : 'false';
  },
};

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

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  idle: 'neutral',
  running: 'brand',
  queued: 'neutral',
  collecting: 'brand',
  'waiting-input': 'warning',
  'waiting-approval': 'warning',
  done: 'success',
  error: 'danger',
  cancelled: 'neutral',
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

interface FormattedDuration {
  key: 'durationMilliseconds' | 'durationSeconds';
  value: string;
}

/** `820` -> `"820ms"`; `1500` -> `"1.5s"`; `2000` -> `"2s"`. Identical algorithm to
 *  `<lr-usage-badge>`'s own `formatDuration` (itself already a duplicate of `<lr-tool-call-chip>`'s),
 *  duplicated locally again for the same reason: independently consumable components, no shared
 *  runtime dependency between them. Used only for a *terminal* run's static duration -- see the
 *  class doc's "elapsed time" section for why the live ticker below intentionally doesn't reuse
 *  this for an in-progress run. */
function formatDuration(ms: number): FormattedDuration {
  if (!Number.isFinite(ms) || ms < 1000) {
    return { key: 'durationMilliseconds', value: String(Math.round(Math.max(0, ms))) };
  }
  const seconds = ms / 1000;
  const rounded = Math.round(seconds * 10) / 10;
  return { key: 'durationSeconds', value: Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1) };
}

export interface LyraAgentRunEventMap {
  'lr-cancel': CustomEvent<CancelEventDetail>;
  'lr-retry': CustomEvent<RetryEventDetail>;
}

/**
 * `<lr-agent-run>` — the top-level shell for one `AgentRun`: lifecycle-status badge, elapsed
 * time, current step, model/cost summary, and built-in Cancel/Retry controls in a header, plus
 * four named composition slots (`tasks`/`tools`/`reasoning`/`output`) for the run's actual
 * content. This is deliberately a SHELL, not a new step-rendering surface — every piece of
 * per-step or per-invocation rendering routes through an existing primitive:
 *
 * - **Elapsed time**: composes `<lr-generation-status>` (`active`/`started-at`, its own built-in
 *   Stop button hidden via `show-stop="false"` since this component renders its own Cancel/Retry
 *   pair instead) for the *live, ticking* readout while the run is genuinely in progress
 *   (`running`/`collecting`/`waiting-input`/`waiting-approval`). `<lr-stream-status>` doesn't fit:
 *   its `phase` vocabulary
 *   (`idle`/`connecting`/`streaming`/`stalled`) models transport/connection health, not an agent
 *   run's nine built-in lifecycle statuses (plus application-defined extensions), and it exposes no elapsed-time readout at all — exactly the
 *   distinction `<lr-generation-status>`'s own class doc already draws between the two. Once the
 *   run reaches a terminal state (`done`/`error`/`cancelled`) with both a `startedAt` and an
 *   `endedAt`, this component instead renders a small locally-formatted static duration
 *   (`endedAt - startedAt`): `<lr-generation-status>`'s freeze-on-`active=false` semantics only
 *   ever freeze at whatever it last computed *live*, so mounting it directly against a completed
 *   run loaded from history (e.g. `startedAt` yesterday, `endedAt` five minutes later, loaded
 *   today) would either show a stale zero or the wrong multi-hour span — it has no way to render a
 *   fixed historical span on demand. That static fallback reuses the same small `formatDuration()`
 *   algorithm `<lr-usage-badge>` and `<lr-tool-call-chip>` already duplicate locally for the same
 *   reason (see this file's own copy).
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
 * status is `error` or `cancelled`. Clicking either fires `lr-cancel`/`lr-retry` with
 * `CancelEventDetail`/`RetryEventDetail` from `src/ai/types.ts` — this component never cancels or
 * retries anything itself, it only requests. `RetryEventDetail.attempt` is a 1-based counter
 * local to this component, incremented on every `lr-retry` click and reset to `0` whenever
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
 * @event lr-retry - The built-in Retry button was activated. `detail: RetryEventDetail`
 *   (`{ attempt }`, a 1-based counter reset per `run.id`).
 * @csspart base - The root container.
 * @csspart empty - The `<lr-empty>` shown when `run` is `null`.
 * @csspart header - The header row wrapping status, elapsed time, current step, summary, and actions.
 * @csspart status - Wrapper around the status badge and optional status message.
 * @csspart status-badge - The resolved `<lr-badge>` lifecycle-status pill.
 * @csspart status-message - `run.status.message`, when set.
 * @csspart elapsed - The composed `<lr-generation-status>`, only rendered while the run is
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
 */
export class LyraAgentRun extends LyraElement<LyraAgentRunEventMap> {
  static styles = [LyraElement.styles, srOnly, styles];

  /** The run to display. Controlled and never mutated by this component -- pass a new object to
   *  update it. `null` renders the shared `<lr-empty>` `noData` state. */
  @property({ attribute: false }) run: AgentRun | null = null;

  /** Overrides the default plain `Intl.NumberFormat` rendering of `run.costEstimate` fed to the
   *  composed `<lr-usage-badge>`'s `cost-text` -- e.g. to add a currency symbol/code, which this
   *  library never assumes on a host's behalf. */
  @property({ attribute: false }) formatCost?: (cost: number) => string;

  /** Labels for application-defined lifecycle kinds. Built-in kinds remain localized by Lyra. */
  @property({ attribute: false }) statusLabels: Record<string, string> = {};

  /** Badge variants for application-defined lifecycle kinds. Unknown kinds default to `neutral`. */
  @property({ attribute: false }) statusVariants: Record<string, BadgeVariant> = {};

  /** Additional run metrics such as prompt/completion token counts. */
  @property({ attribute: false }) metrics: AgentRunMetric[] = [];

  /** Whether the built-in Cancel button can render at all -- still gated by the run's own status
   *  being cancelable (`running`/`collecting`/`waiting-input`/`waiting-approval`). Set `false` for a read-only
   *  viewer. */
  @property({ type: Boolean, attribute: 'show-cancel', converter: trueDefaultBooleanConverter }) showCancel = true;

  /** Whether the built-in Retry button can render at all -- still gated by the run's own status
   *  being retryable (`error`/`cancelled`). */
  @property({ type: Boolean, attribute: 'show-retry', converter: trueDefaultBooleanConverter }) showRetry = true;

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

  protected willUpdate(changed: PropertyValues): void {
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

  protected updated(changed: PropertyValues): void {
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
    return kind !== undefined && TICKING_KINDS.has(kind) && this.run?.startedAt != null;
  }

  /** The static formatted duration for a terminal run with both `startedAt` and `endedAt` --
   *  `undefined` while ticking, not yet terminal, or missing either timestamp (see the class
   *  doc's "elapsed time" section for why a terminal run doesn't reuse the live ticker). */
  private get staticElapsedText(): string | undefined {
    const run = this.run;
    if (!run || !TERMINAL_KINDS.has(run.status.kind)) return undefined;
    if (run.startedAt == null || run.endedAt == null) return undefined;
    const d = formatDuration(Math.max(0, run.endedAt - run.startedAt));
    return this.localize(d.key, undefined, { value: d.value });
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
    this.emit<CancelEventDetail>('lr-cancel', {});
  };

  private onRetryClick = (): void => {
    this.retryAttempt += 1;
    this.emit<RetryEventDetail>('lr-retry', { attempt: this.retryAttempt });
  };

  render(): TemplateResult {
    const run = this.run;
    if (!run) {
      return html`<div part="base"><lr-empty part="empty" heading=${this.localize('noData')}></lr-empty></div>`;
    }

    const kind = run.status.kind;
    const step = this.currentStep;
    const ticking = this.isTicking;
    const staticElapsed = this.staticElapsedText;
    const cost = this.costText;
    const hasSummary = !!run.model || cost !== '' || this.metrics.length > 0;

    return html`
      <div part="base">
        <div part="header">
          <slot name="header" @slotchange=${this.onHeaderSlotChange}></slot>
          ${!this.hasHeaderSlot
            ? html`
                <div part="status">
                  <lr-badge
                    part="status-badge"
                    variant=${this.statusVariants[kind] ?? STATUS_VARIANT[kind] ?? 'neutral'}
                    >${this.statusLabel(kind)}</lr-badge
                  >
                  ${run.status.message ? html`<span part="status-message">${run.status.message}</span>` : nothing}
                </div>
                ${ticking
                  ? html`<lr-generation-status
                      part="elapsed"
                      exportparts="elapsed:elapsed-time"
                      active
                      .startedAt=${run.startedAt}
                      .showStop=${false}
                    ></lr-generation-status>`
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
                ${hasSummary || this.hasSummarySlot
                  ? html`<div part="summary">
                      <slot name="summary" @slotchange=${this.onSummarySlotChange}></slot>
                      ${!this.hasSummarySlot
                        ? html`
                            ${run.model ? html`<span part="model">${run.model}</span>` : nothing}
                            ${cost !== ''
                              ? html`<lr-usage-badge part="usage" exportparts="cost:cost" cost-text=${cost}></lr-usage-badge>`
                              : nothing}
                            ${this.metrics.map(
                              (metric) => html`<span part="metric" data-metric-id=${metric.id}>
                                <span part="metric-label">${metric.label}</span>
                                <span part="metric-value" data-variant=${metric.variant ?? nothing}>${metric.value}</span>
                              </span>`,
                            )}
                          `
                        : nothing}
                    </div>`
                  : nothing}
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
