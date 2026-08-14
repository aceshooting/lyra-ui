import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteCount } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import type { AgentStatusKind, Citation, GroundedClaim, GroundingAssessment } from '../../../ai/types.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import type { BadgeVariant } from '../../overlays/badge/badge.class.js';
import type { LyraDetailsEventMap } from '../../layout/details/details.class.js';
import type { LyraGroundingSummaryEventMap } from '../../retrieval/grounding-summary/grounding-summary.class.js';
import type {
  ToolTimelineActivateDetail,
  ToolTimelineEntry,
  ToolTimelineApprovalDetail,
  ToolTimelineRenderErrorDetail,
  LyraToolTimelineEventMap,
} from '../tool-timeline/tool-timeline.class.js';
import { firstByIdentity } from '../collection-identity.js';
import { styles } from './evaluation-run.styles.js';
import {
  agentStatusKind,
  agentStatusLabel,
  agentStatusMessage,
  agentStatusVariant,
  isAgentStatusTerminal,
  type AgentStatusPresentation,
} from '../agent-status-presentation.js';
import { overallSemanticLabel, overallSemanticRole } from '../semantic-owner.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_agentRunStatusCollecting, LYRA_DEFAULT_agentRunStatusQueued, LYRA_DEFAULT_evaluationRunExampleCancelledAnnounce, LYRA_DEFAULT_evaluationRunExampleCompletedAnnounce, LYRA_DEFAULT_evaluationRunExampleFailedAnnounce, LYRA_DEFAULT_evaluationRunExampleLabel, LYRA_DEFAULT_evaluationRunExampleStartedAnnounce, LYRA_DEFAULT_evaluationRunExampleWaitingApprovalAnnounce, LYRA_DEFAULT_evaluationRunExampleWaitingInputAnnounce, LYRA_DEFAULT_evaluationRunFailedCount, LYRA_DEFAULT_evaluationRunGroundingHeading, LYRA_DEFAULT_evaluationRunInputHeading, LYRA_DEFAULT_evaluationRunLabel, LYRA_DEFAULT_evaluationRunOutputHeading, LYRA_DEFAULT_evaluationRunProgressLabel, LYRA_DEFAULT_evaluationRunProgressSummary, LYRA_DEFAULT_evaluationRunRunningCount, LYRA_DEFAULT_evaluationRunStatusCancelled, LYRA_DEFAULT_evaluationRunStatusIdle, LYRA_DEFAULT_evaluationRunStatusWaitingApproval, LYRA_DEFAULT_evaluationRunStatusWaitingInput, LYRA_DEFAULT_evaluationRunToolTraceHeading, LYRA_DEFAULT_noData, LYRA_DEFAULT_statusError, LYRA_DEFAULT_statusRunning, LYRA_DEFAULT_statusSuccess } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** How evaluation content is rendered -- `'markdown'` (the default) through `<lr-markdown>`, or
 *  `'code'` through `<lr-code-block>`. */
export type EvaluationContentFormat = 'markdown' | 'code';

/** One self-contained input/output payload in an evaluation example. */
export interface EvaluationContent {
  text: string;
  /** `'markdown'` is used when unset. */
  format?: EvaluationContentFormat;
  /** A shiki-recognized language id, consulted only when `format` is `'code'`. */
  language?: string;
}

/**
 * One example's result within an evaluation batch. `status` reuses the shared `AgentStatus`
 * contract from `src/ai/types.ts` -- the same run-lifecycle vocabulary an agent step already
 * uses -- rather than inventing a parallel pass/fail enum; rubric-driven scoring (did the output
 * actually pass) is a separate concern owned by the sibling result-review component, not this
 * one's batch-progress/trace-display job. `grounding`/`citations` compose directly into
 * `<lr-grounding-summary>` (`assessment`/`citations`) and `toolTrace` directly into
 * `<lr-tool-timeline>` (`entries`) with no adapters -- this component owns no grounding-scoring or
 * tool-call rendering logic of its own.
 */
export interface EvaluationExampleResult {
  id: string;
  /** Falls back to a localized "Example {index}" (1-based, in array order) when unset. */
  label?: string;
  status: AgentStatusPresentation;
  input: EvaluationContent;
  output: EvaluationContent;
  /** This example's grounding/citation-support assessment, when the run computed one. Omitted
   *  entirely means no grounding section renders for this example. */
  grounding?: GroundingAssessment;
  /** Evidence citations backing `grounding`, forwarded verbatim to `<lr-grounding-summary>`'s own
   *  `citations`. Only consulted while `grounding` is also set. */
  citations?: Citation[];
  /** This example's own tool-call trace. Omitted or empty means no tool-trace section renders for
   *  this example. */
  toolTrace?: ToolTimelineEntry[];
}

/** `detail` for `lr-example-toggle`. */
export interface EvaluationExampleToggleDetail {
  exampleId: string;
  expanded: boolean;
}

/** `detail` for `lr-example-citation-select` -- the nested per-example `<lr-grounding-summary>`'s
 *  own `lr-citation-select` detail (`{ citation }`), correlated with the example it came from so a
 *  host doesn't need to walk the DOM to find out which example's evidence was activated. */
export interface EvaluationCitationSelectDetail {
  exampleId: string;
  citation: Citation;
}

/** `detail` for `lr-example-tool-approval-decide` -- the nested per-example `<lr-tool-timeline>`'s
 *  own `lr-tool-approval-decide` detail (`ToolTimelineApprovalDetail`), correlated with the
 *  example it came from. */
export interface EvaluationToolApprovalDetail extends ToolTimelineApprovalDetail {
  exampleId: string;
}

export interface EvaluationToolActivateDetail extends ToolTimelineActivateDetail {
  exampleId: string;
}

export interface EvaluationToolRenderErrorDetail extends ToolTimelineRenderErrorDetail {
  exampleId: string;
}

export interface EvaluationClaimSelectDetail {
  exampleId: string;
  claim: GroundedClaim;
}

export interface LyraEvaluationRunEventMap {
  'lr-example-toggle': CustomEvent<EvaluationExampleToggleDetail>;
  'lr-example-citation-select': CustomEvent<EvaluationCitationSelectDetail>;
  'lr-example-claim-select': CustomEvent<EvaluationClaimSelectDetail>;
  'lr-example-tool-approval-decide': CustomEvent<EvaluationToolApprovalDetail>;
  'lr-example-tool-activate': CustomEvent<EvaluationToolActivateDetail>;
  'lr-example-tool-render-error': CustomEvent<EvaluationToolRenderErrorDetail>;
}

/** Badge tone per `AgentStatusKind` -- mirrors `<lr-span-waterfall>`'s own status-to-tone
 *  mapping's polarity (success/danger/warning/brand/neutral), extended for the three states
 *  `AgentStatus` has that a single span's own narrower status vocabulary doesn't. */
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

const RUNNING_ERROR_KINDS = ['running', 'error'] as const;
type CountKind = (typeof RUNNING_ERROR_KINDS)[number];

/**
 * `<lr-evaluation-run>` — an evaluation batch's live progress: an overall `<lr-progress-bar>`
 * counting terminal (done/error/cancelled) examples against the batch total, plus one
 * `<lr-details>` disclosure per example showing its input/output (`<lr-markdown>` or
 * `<lr-code-block>`, per each payload's `format`), a `<lr-grounding-summary>` when the
 * example carries a `GroundingAssessment`, and a `<lr-tool-timeline>` when it carries
 * `toolTrace` entries. Controlled: `examples` mirrors this package's other data-driven
 * components' own convention (a plain prop the host replaces wholesale to update, never mutated
 * in place).
 *
 * Nested-component events that need per-example correlation are intercepted and re-emitted under
 * this component's own name with the originating example's `id` folded into `detail` (matching
 * `<lr-tool-timeline>`'s own precedent of extending a shared `*EventDetail` type from
 * `src/ai/types.ts` rather than inventing a divergent shape) -- a host listening at this
 * component's boundary never needs to walk the DOM to find out which example a nested selection
 * or approval decision came from.
 *
 * @customElement lr-evaluation-run
 * @event lr-example-toggle - An example's disclosure was expanded or collapsed. `detail: { exampleId,
 *   expanded }`.
 * @event lr-example-citation-select - An evidence citation in a nested `<lr-grounding-summary>`
 *   was activated. `detail: { exampleId, citation }`.
 * @event lr-example-tool-approval-decide - A pending tool call in a nested `<lr-tool-timeline>`
 *   was approved or denied. `detail: { exampleId, invocationId, approved, args? }`. Cancelable:
 *   preventing this correlated event vetoes the nested decision and preserves its pending dialog.
 * @event lr-example-claim-select - A grounded claim was activated. `detail: { exampleId, claim }`.
 * @event lr-example-tool-activate - A nested tool entry was activated. `detail: { exampleId,
 *   invocationId, sourceKey? }`.
 * @event lr-example-tool-render-error - A nested tool renderer failed. `detail: { exampleId,
 *   invocationId, sourceKey?, toolName, error }`.
 * @csspart base - The root wrapper.
 * @csspart header - The batch-progress header row.
 * @csspart header-label - The run's label, defaulting to a localized "Evaluation run".
 * @csspart progress - The batch `<lr-progress-bar>`.
 * @csspart summary - The "N of M examples complete" text.
 * @csspart counts - Wrapper around the running/failed count badges.
 * @csspart count - One count badge; carries `data-kind="running"|"error"`.
 * @csspart examples - Wrapper around the per-example `<lr-details>` rows.
 * @csspart example - One example's `<lr-details>` row; carries `data-status` (the example's
 *   `status.kind`).
 * @csspart example-summary - The wrapper around an example's label and status badge, in the
 *   `<lr-details>` `summary` slot.
 * @csspart example-label - An example's label text.
 * @csspart example-status - An example's status badge.
 * @csspart example-status-message - Optional caller-supplied detail for an example status.
 * @csspart input-section - Wrapper around an example's input heading + rendered content.
 * @csspart output-section - Wrapper around an example's output heading + rendered content.
 * @csspart grounding-section - Wrapper around an example's `<lr-grounding-summary>`, only
 *   rendered when the example carries a `grounding` assessment.
 * @csspart tool-trace-section - Wrapper around an example's `<lr-tool-timeline>`, only rendered
 *   when the example carries non-empty `toolTrace` entries.
 * @csspart section-heading - The heading text inside any of the four sections above.
 * @csspart input - The rendered `<lr-markdown>`/`<lr-code-block>` for an example's input.
 * @csspart output - The rendered `<lr-markdown>`/`<lr-code-block>` for an example's output.
 * @csspart grounding-summary - The nested `<lr-grounding-summary>` for an example's grounding
 *   assessment.
 * @csspart tool-trace - The nested `<lr-tool-timeline>` for an example's tool calls.
 * @csspart empty - The empty-state message shown when `examples` is empty.
 * @csspart live-region - The internal status-announcement live region.
 * @status stable
 * @since 4.1.0
 */
export class LyraEvaluationRun extends LyraElement<LyraEvaluationRunEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    agentRunStatusCollecting: LYRA_DEFAULT_agentRunStatusCollecting,
    agentRunStatusQueued: LYRA_DEFAULT_agentRunStatusQueued,
    evaluationRunExampleCancelledAnnounce: LYRA_DEFAULT_evaluationRunExampleCancelledAnnounce,
    evaluationRunExampleCompletedAnnounce: LYRA_DEFAULT_evaluationRunExampleCompletedAnnounce,
    evaluationRunExampleFailedAnnounce: LYRA_DEFAULT_evaluationRunExampleFailedAnnounce,
    evaluationRunExampleLabel: LYRA_DEFAULT_evaluationRunExampleLabel,
    evaluationRunExampleStartedAnnounce: LYRA_DEFAULT_evaluationRunExampleStartedAnnounce,
    evaluationRunExampleWaitingApprovalAnnounce: LYRA_DEFAULT_evaluationRunExampleWaitingApprovalAnnounce,
    evaluationRunExampleWaitingInputAnnounce: LYRA_DEFAULT_evaluationRunExampleWaitingInputAnnounce,
    evaluationRunFailedCount: LYRA_DEFAULT_evaluationRunFailedCount,
    evaluationRunGroundingHeading: LYRA_DEFAULT_evaluationRunGroundingHeading,
    evaluationRunInputHeading: LYRA_DEFAULT_evaluationRunInputHeading,
    evaluationRunLabel: LYRA_DEFAULT_evaluationRunLabel,
    evaluationRunOutputHeading: LYRA_DEFAULT_evaluationRunOutputHeading,
    evaluationRunProgressLabel: LYRA_DEFAULT_evaluationRunProgressLabel,
    evaluationRunProgressSummary: LYRA_DEFAULT_evaluationRunProgressSummary,
    evaluationRunRunningCount: LYRA_DEFAULT_evaluationRunRunningCount,
    evaluationRunStatusCancelled: LYRA_DEFAULT_evaluationRunStatusCancelled,
    evaluationRunStatusIdle: LYRA_DEFAULT_evaluationRunStatusIdle,
    evaluationRunStatusWaitingApproval: LYRA_DEFAULT_evaluationRunStatusWaitingApproval,
    evaluationRunStatusWaitingInput: LYRA_DEFAULT_evaluationRunStatusWaitingInput,
    evaluationRunToolTraceHeading: LYRA_DEFAULT_evaluationRunToolTraceHeading,
    noData: LYRA_DEFAULT_noData,
    statusError: LYRA_DEFAULT_statusError,
    statusRunning: LYRA_DEFAULT_statusRunning,
    statusSuccess: LYRA_DEFAULT_statusSuccess,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** The batch's examples so far. Controlled -- never mutated by this component; pass a new array
   *  to update it (e.g. as each example finishes, or as the whole batch streams in). Duplicate ids
   *  normalize first-wins before expansion, counts, announcements, rendering, and events. */
  @property({ attribute: false }) examples: EvaluationExampleResult[] = [];

  /** The batch's expected total example count. `null` (the default) derives it from
   *  `examples.length` instead -- the common case once every result has already arrived; set this
   *  explicitly while a batch is still streaming in and the eventual total is already known ahead
   *  of every example actually completing. An explicit value below the current observed count is
   *  raised to `examples.length`, so progress never reports an impossible total. */
  @property({ type: Number }) total: number | null = null;

  /** Header label and accessible-name source. Falls back to a localized "Evaluation run" when
   *  unset. */
  @property() label = '';

  @state() private expandedIds = new Set<string>();

  @query('lr-live-region') private liveRegion?: LyraLiveRegion;

  /** `true` until the first completed update -- gates the status-change announcements below so a
   *  freshly-mounted run never announces whatever statuses its very first `examples` happens to
   *  carry (mirrors `<lr-task-list>`'s identical `isMounting` gate). */
  private isMounting = true;

  /** Last-seen `status.kind` per example id, diffed against the incoming `examples` on every
   *  update to decide what to announce. */
  private previousStatusById = new Map<string, AgentStatusKind>();

  private get normalizedExamples(): EvaluationExampleResult[] {
    return firstByIdentity(Array.isArray(this.examples) ? this.examples : [], (example) => example.id);
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!changed.has('examples')) return;
    const ids = new Set(this.normalizedExamples.map((example) => example.id));
    let pruned: Set<string> | undefined;
    for (const id of this.expandedIds) {
      if (!ids.has(id)) {
        pruned ??= new Set(this.expandedIds);
        pruned.delete(id);
      }
    }
    if (pruned) this.expandedIds = pruned;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const wasMounting = this.isMounting;
    this.isMounting = false;
    if (changed.has('examples')) this.diffAndAnnounce(wasMounting);
  }

  private statusCounts(): Partial<Record<AgentStatusKind, number>> {
    const counts: Partial<Record<AgentStatusKind, number>> = {};
    for (const example of this.normalizedExamples) counts[example.status.kind] = (counts[example.status.kind] ?? 0) + 1;
    return counts;
  }

  private exampleLabel(example: EvaluationExampleResult, index: number): string {
    return example.label || this.localize('evaluationRunExampleLabel', undefined, {
      index: getNumberFormat(this.effectiveLocale).format(index + 1),
    });
  }

  private statusText(status: AgentStatusPresentation): string {
    const override = agentStatusLabel(status);
    if (override !== undefined) return override;
    const kind = agentStatusKind(status);
    switch (kind) {
      case 'idle':
        return this.localize('evaluationRunStatusIdle');
      case 'running':
        return this.localize('statusRunning');
      case 'queued':
        return this.localize('agentRunStatusQueued');
      case 'collecting':
        return this.localize('agentRunStatusCollecting');
      case 'waiting-input':
        return this.localize('evaluationRunStatusWaitingInput');
      case 'waiting-approval':
        return this.localize('evaluationRunStatusWaitingApproval');
      case 'done':
        return this.localize('statusSuccess');
      case 'error':
        return this.localize('statusError');
      case 'cancelled':
        return this.localize('evaluationRunStatusCancelled');
      default:
        return kind.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
    }
  }

  private diffAndAnnounce(firstSight: boolean): void {
    const region = this.liveRegion;
    const nextStatusById = new Map<string, AgentStatusKind>();
    this.normalizedExamples.forEach((example, index) => {
      nextStatusById.set(example.id, example.status.kind);
      if (firstSight || !region) return;
      const previous = this.previousStatusById.get(example.id);
      const kind = example.status.kind;
      if (previous === undefined || previous === kind) return;
      const label = this.exampleLabel(example, index);
      // Every branch forces an immediate flush -- these are discrete lifecycle transitions, not a
      // high-frequency stream where throttling matters (mirrors <lr-task-list>'s identical choice).
      switch (kind) {
        case 'running':
          region.mode = 'polite';
          region.announce(this.localize('evaluationRunExampleStartedAnnounce', undefined, { label }), { force: true });
          break;
        case 'done':
          region.mode = 'polite';
          region.announce(this.localize('evaluationRunExampleCompletedAnnounce', undefined, { label }), { force: true });
          break;
        case 'error':
          region.mode = 'assertive';
          region.announce(this.localize('evaluationRunExampleFailedAnnounce', undefined, { label }), { force: true });
          break;
        case 'cancelled':
          region.mode = 'polite';
          region.announce(this.localize('evaluationRunExampleCancelledAnnounce', undefined, { label }), { force: true });
          break;
        case 'waiting-input':
          region.mode = 'polite';
          region.announce(this.localize('evaluationRunExampleWaitingInputAnnounce', undefined, { label }), { force: true });
          break;
        case 'waiting-approval':
          region.mode = 'polite';
          region.announce(this.localize('evaluationRunExampleWaitingApprovalAnnounce', undefined, { label }), { force: true });
          break;
        case 'idle':
          break; // Not a meaningful transition to announce -- mirrors task-list's own silence here.
      }
    });
    this.previousStatusById = nextStatusById;
  }

  private onExampleToggle(id: string, event: CustomEvent<LyraDetailsEventMap['lr-toggle']['detail']>): void {
    event.stopPropagation();
    const expanded = event.detail.open;
    const next = new Set(this.expandedIds);
    if (expanded) next.add(id);
    else next.delete(id);
    this.expandedIds = next;
    this.emit('lr-example-toggle', { exampleId: id, expanded });
  }

  private onCitationSelect(exampleId: string, event: CustomEvent<LyraGroundingSummaryEventMap['lr-citation-select']['detail']>): void {
    event.stopPropagation();
    this.emit('lr-example-citation-select', { exampleId, citation: event.detail.citation });
  }

  private onClaimSelect(exampleId: string, event: CustomEvent<LyraGroundingSummaryEventMap['lr-claim-select']['detail']>): void {
    event.stopPropagation();
    this.emit('lr-example-claim-select', { exampleId, claim: event.detail.claim });
  }

  private onToolApprovalDecide(exampleId: string, event: CustomEvent<LyraToolTimelineEventMap['lr-tool-approval-decide']['detail']>): void {
    event.stopPropagation();
    const correlatedEvent = this.emit(
      'lr-example-tool-approval-decide',
      { exampleId, ...event.detail },
      { cancelable: true },
    );
    if (correlatedEvent.defaultPrevented) event.preventDefault();
  }

  private onToolActivate(exampleId: string, event: CustomEvent<ToolTimelineActivateDetail>): void {
    event.stopPropagation();
    this.emit('lr-example-tool-activate', { exampleId, ...event.detail });
  }

  private onToolRenderError(exampleId: string, event: CustomEvent<ToolTimelineRenderErrorDetail>): void {
    event.stopPropagation();
    this.emit('lr-example-tool-render-error', { exampleId, ...event.detail });
  }

  private stopOwnedEvent(event: Event): void {
    event.stopPropagation();
  }

  private renderContent(content: EvaluationContent, part: 'input' | 'output'): TemplateResult {
    if (content.format === 'code') {
      return html`<lr-code-block part=${part} code=${content.text} language=${content.language ?? ''}></lr-code-block>`;
    }
    return html`<lr-markdown part=${part} content=${content.text}></lr-markdown>`;
  }

  private renderGrounding(example: EvaluationExampleResult, grounding: GroundingAssessment): TemplateResult {
    return html`
      <section part="grounding-section">
        <h4 part="section-heading">${this.localize('evaluationRunGroundingHeading')}</h4>
        <lr-grounding-summary
          part="grounding-summary"
          .assessment=${grounding}
          .citations=${example.citations ?? []}
          @lr-citation-activate=${this.stopOwnedEvent}
          @lr-citation-select=${(e: CustomEvent<LyraGroundingSummaryEventMap['lr-citation-select']['detail']>) =>
            this.onCitationSelect(example.id, e)}
          @lr-claim-select=${(e: CustomEvent<LyraGroundingSummaryEventMap['lr-claim-select']['detail']>) =>
            this.onClaimSelect(example.id, e)}
        ></lr-grounding-summary>
      </section>
    `;
  }

  private renderToolTrace(example: EvaluationExampleResult, toolTrace: ToolTimelineEntry[]): TemplateResult {
    return html`
      <section part="tool-trace-section">
        <h4 part="section-heading">${this.localize('evaluationRunToolTraceHeading')}</h4>
        <lr-tool-timeline
          part="tool-trace"
          .entries=${toolTrace}
          @lr-tool-approval-decide=${(e: CustomEvent<LyraToolTimelineEventMap['lr-tool-approval-decide']['detail']>) =>
            this.onToolApprovalDecide(example.id, e)}
          @lr-tool-activate=${(e: CustomEvent<ToolTimelineActivateDetail>) => this.onToolActivate(example.id, e)}
          @lr-tool-render-error=${(e: CustomEvent<ToolTimelineRenderErrorDetail>) =>
            this.onToolRenderError(example.id, e)}
        ></lr-tool-timeline>
      </section>
    `;
  }

  private renderExample(example: EvaluationExampleResult, index: number): TemplateResult {
    const kind = agentStatusKind(example.status);
    const message = agentStatusMessage(example.status);
    const expanded = this.expandedIds.has(example.id);
    return html`
      <lr-details
        part="example"
        data-status=${kind}
        .open=${expanded}
        @lr-show=${this.stopOwnedEvent}
        @lr-after-show=${this.stopOwnedEvent}
        @lr-hide=${this.stopOwnedEvent}
        @lr-after-hide=${this.stopOwnedEvent}
        @lr-toggle=${(e: LyraDetailsEventMap['lr-toggle']) => this.onExampleToggle(example.id, e)}
      >
        <span slot="summary" part="example-summary">
          <span part="example-label">${this.exampleLabel(example, index)}</span>
          <lr-badge part="example-status" variant=${agentStatusVariant(example.status, STATUS_VARIANT[kind] ?? 'neutral')}>${this.statusText(example.status)}</lr-badge>
          ${message !== undefined ? html`<span part="example-status-message">${message}</span>` : nothing}
        </span>
        ${expanded
          ? html`
              <section part="input-section">
                <h4 part="section-heading">${this.localize('evaluationRunInputHeading')}</h4>
                ${this.renderContent(example.input, 'input')}
              </section>
              <section part="output-section">
                <h4 part="section-heading">${this.localize('evaluationRunOutputHeading')}</h4>
                ${this.renderContent(example.output, 'output')}
              </section>
              ${example.grounding ? this.renderGrounding(example, example.grounding) : nothing}
              ${example.toolTrace && example.toolTrace.length > 0 ? this.renderToolTrace(example, example.toolTrace) : nothing}
            `
          : nothing}
      </lr-details>
    `;
  }

  override render(): TemplateResult {
    const examples = this.normalizedExamples;
    const configuredTotal = this.total != null
      ? finiteCount(this.total, examples.length)
      : examples.length;
    const resolvedTotal = Math.max(configuredTotal, examples.length);
    const counts = this.statusCounts();
    const completed = examples.filter((example) => isAgentStatusTerminal(example.status)).length;
    const visibleLabel = this.label || this.localize('evaluationRunLabel');
    const headerLabel = overallSemanticLabel(this, visibleLabel);
    const number = getNumberFormat(this.effectiveLocale);

    return html`
      <div
        part="base"
        role=${overallSemanticRole(this, 'region') ?? nothing}
        aria-label=${headerLabel ?? nothing}
      >
        <div part="header">
          <span part="header-label">${visibleLabel}</span>
          <lr-progress-bar
            part="progress"
            value=${completed}
            max=${Math.max(resolvedTotal, 1)}
            show-value
            accessible-label=${this.localize('evaluationRunProgressLabel')}
          ></lr-progress-bar>
          <span part="summary"
            >${this.localize('evaluationRunProgressSummary', undefined, {
              completed: number.format(completed),
              total: number.format(resolvedTotal),
            })}</span
          >
          <span part="counts">
            ${RUNNING_ERROR_KINDS.map((kind: CountKind) => {
              const count = counts[kind] ?? 0;
              if (count === 0) return nothing;
              const formattedCount = number.format(count);
              const badgeVariant: BadgeVariant = kind === 'running' ? 'brand' : 'danger';
              const text =
                kind === 'running'
                  ? this.localize('evaluationRunRunningCount', undefined, { count: formattedCount })
                  : this.localize('evaluationRunFailedCount', undefined, { count: formattedCount });
              return html`<lr-badge part="count" data-kind=${kind} variant=${badgeVariant}>${text}</lr-badge>`;
            })}
          </span>
        </div>
        ${examples.length === 0
          ? html`<lr-empty part="empty" heading=${this.localize('noData')}></lr-empty>`
          : html`<div part="examples">${examples.map((example, index) => this.renderExample(example, index))}</div>`}
      </div>
      <lr-live-region part="live-region" mode="polite"></lr-live-region>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-evaluation-run': LyraEvaluationRun;
  }
}
