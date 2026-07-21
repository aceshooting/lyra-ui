import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteCount } from '../../../internal/numbers.js';
import type { AgentStatus, AgentStatusKind, Citation, GroundingAssessment } from '../../../ai/types.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import type { BadgeVariant } from '../../overlays/badge/badge.class.js';
import type { LyraDetailsEventMap } from '../../layout/details/details.class.js';
import type { LyraGroundingSummaryEventMap } from '../../retrieval/grounding-summary/grounding-summary.class.js';
import type { ToolTimelineEntry, ToolTimelineApprovalDetail, LyraToolTimelineEventMap } from '../tool-timeline/tool-timeline.class.js';
import '../../utility/live-region/live-region.js';
import '../../overlays/progress/progress-bar.js';
import '../../overlays/empty/empty.js';
import '../../layout/details/details.js';
import '../../overlays/badge/badge.js';
import '../../conversation/markdown/markdown.js';
import '../../conversation/code-block/code-block.js';
import '../../retrieval/grounding-summary/grounding-summary.js';
import '../tool-timeline/tool-timeline.js';
import { styles } from './evaluation-run.styles.js';

/** How an example's `input`/`output` text is rendered -- `'markdown'` (the default) through
 *  `<lr-markdown>`, `'code'` through `<lr-code-block>` (consulting the matching `*Language`
 *  property for shiki highlighting). */
export type EvaluationContentFormat = 'markdown' | 'code';

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
  status: AgentStatus;
  input: string;
  /** `'markdown'` (the default, when unset) renders via `<lr-markdown>`. */
  inputFormat?: EvaluationContentFormat;
  /** A shiki-recognized language id, consulted only when `inputFormat` is `'code'`. */
  inputLanguage?: string;
  output: string;
  outputFormat?: EvaluationContentFormat;
  outputLanguage?: string;
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
  id: string;
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

export interface LyraEvaluationRunEventMap {
  'lr-example-toggle': CustomEvent<EvaluationExampleToggleDetail>;
  'lr-example-citation-select': CustomEvent<EvaluationCitationSelectDetail>;
  'lr-example-tool-approval-decide': CustomEvent<EvaluationToolApprovalDetail>;
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

/** The subset of `AgentStatusKind` that marks an example as no longer in flight -- counted
 *  against the batch's own `total` for the progress bar/summary, regardless of whether the
 *  outcome was a success. */
function isTerminal(kind: AgentStatusKind): boolean {
  return kind === 'done' || kind === 'error' || kind === 'cancelled';
}

/**
 * `<lr-evaluation-run>` — an evaluation batch's live progress: an overall `<lr-progress-bar>`
 * counting terminal (done/error/cancelled) examples against the batch total, plus one
 * `<lr-details>` disclosure per example showing its input/output (`<lr-markdown>` or
 * `<lr-code-block>`, per `inputFormat`/`outputFormat`), a `<lr-grounding-summary>` when the
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
 * @event lr-example-toggle - An example's disclosure was expanded or collapsed. `detail: { id,
 *   expanded }`.
 * @event lr-example-citation-select - An evidence citation in a nested `<lr-grounding-summary>`
 *   was activated. `detail: { exampleId, citation }`.
 * @event lr-example-tool-approval-decide - A pending tool call in a nested `<lr-tool-timeline>`
 *   was approved or denied. `detail: { exampleId, invocationId, approved, args? }`.
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
 */
export class LyraEvaluationRun extends LyraElement<LyraEvaluationRunEventMap> {
  static styles = [LyraElement.styles, styles];

  /** The batch's examples so far. Controlled -- never mutated by this component; pass a new array
   *  to update it (e.g. as each example finishes, or as the whole batch streams in). */
  @property({ attribute: false }) examples: EvaluationExampleResult[] = [];

  /** The batch's expected total example count. `null` (the default) derives it from
   *  `examples.length` instead -- the common case once every result has already arrived; set this
   *  explicitly while a batch is still streaming in and the eventual total is already known ahead
   *  of every example actually completing. */
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

  protected updated(changed: PropertyValues): void {
    const wasMounting = this.isMounting;
    this.isMounting = false;
    if (changed.has('examples')) this.diffAndAnnounce(wasMounting);
  }

  private statusCounts(): Partial<Record<AgentStatusKind, number>> {
    const counts: Partial<Record<AgentStatusKind, number>> = {};
    for (const example of this.examples) counts[example.status.kind] = (counts[example.status.kind] ?? 0) + 1;
    return counts;
  }

  private exampleLabel(example: EvaluationExampleResult, index: number): string {
    return example.label || this.localize('evaluationRunExampleLabel', undefined, { index: index + 1 });
  }

  private statusLabel(kind: AgentStatusKind): string {
    switch (kind) {
      case 'idle':
        return this.localize('evaluationRunStatusIdle');
      case 'running':
        return this.localize('statusRunning');
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
    this.examples.forEach((example, index) => {
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
    this.emit<EvaluationExampleToggleDetail>('lr-example-toggle', { id, expanded });
  }

  private onCitationSelect(exampleId: string, event: CustomEvent<LyraGroundingSummaryEventMap['lr-citation-select']['detail']>): void {
    event.stopPropagation();
    this.emit<EvaluationCitationSelectDetail>('lr-example-citation-select', { exampleId, citation: event.detail.citation });
  }

  private onToolApprovalDecide(exampleId: string, event: CustomEvent<LyraToolTimelineEventMap['lr-tool-approval-decide']['detail']>): void {
    event.stopPropagation();
    this.emit<EvaluationToolApprovalDetail>('lr-example-tool-approval-decide', { exampleId, ...event.detail });
  }

  private renderContent(
    text: string,
    format: EvaluationContentFormat | undefined,
    language: string | undefined,
    part: 'input' | 'output',
  ): TemplateResult {
    if (format === 'code') {
      return html`<lr-code-block part=${part} code=${text} language=${language ?? ''}></lr-code-block>`;
    }
    return html`<lr-markdown part=${part} content=${text}></lr-markdown>`;
  }

  private renderGrounding(example: EvaluationExampleResult, grounding: GroundingAssessment): TemplateResult {
    return html`
      <section part="grounding-section">
        <h4 part="section-heading">${this.localize('evaluationRunGroundingHeading')}</h4>
        <lr-grounding-summary
          part="grounding-summary"
          .assessment=${grounding}
          .citations=${example.citations ?? []}
          @lr-citation-select=${(e: CustomEvent<LyraGroundingSummaryEventMap['lr-citation-select']['detail']>) =>
            this.onCitationSelect(example.id, e)}
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
        ></lr-tool-timeline>
      </section>
    `;
  }

  private renderExample(example: EvaluationExampleResult, index: number): TemplateResult {
    const kind = example.status.kind;
    return html`
      <lr-details
        part="example"
        data-status=${kind}
        .open=${this.expandedIds.has(example.id)}
        @lr-toggle=${(e: CustomEvent<{ open: boolean }>) => this.onExampleToggle(example.id, e)}
      >
        <span slot="summary" part="example-summary">
          <span part="example-label">${this.exampleLabel(example, index)}</span>
          <lr-badge part="example-status" variant=${STATUS_VARIANT[kind]}>${this.statusLabel(kind)}</lr-badge>
        </span>
        <section part="input-section">
          <h4 part="section-heading">${this.localize('evaluationRunInputHeading')}</h4>
          ${this.renderContent(example.input, example.inputFormat, example.inputLanguage, 'input')}
        </section>
        <section part="output-section">
          <h4 part="section-heading">${this.localize('evaluationRunOutputHeading')}</h4>
          ${this.renderContent(example.output, example.outputFormat, example.outputLanguage, 'output')}
        </section>
        ${example.grounding ? this.renderGrounding(example, example.grounding) : nothing}
        ${example.toolTrace && example.toolTrace.length > 0 ? this.renderToolTrace(example, example.toolTrace) : nothing}
      </lr-details>
    `;
  }

  render(): TemplateResult {
    const resolvedTotal = this.total != null ? finiteCount(this.total, this.examples.length) : this.examples.length;
    const counts = this.statusCounts();
    const completed = this.examples.filter((example) => isTerminal(example.status.kind)).length;
    const headerLabel = this.label || this.getAttribute('aria-label') || this.localize('evaluationRunLabel');

    return html`
      <div part="base" role="region" aria-label=${headerLabel}>
        <div part="header">
          <span part="header-label">${headerLabel}</span>
          <lr-progress-bar
            part="progress"
            value=${completed}
            max=${Math.max(resolvedTotal, 1)}
            show-value
            accessible-label=${this.localize('evaluationRunProgressLabel')}
          ></lr-progress-bar>
          <span part="summary"
            >${this.localize('evaluationRunProgressSummary', undefined, {
              completed,
              total: resolvedTotal,
            })}</span
          >
          <span part="counts">
            ${RUNNING_ERROR_KINDS.map((kind: CountKind) => {
              const count = counts[kind] ?? 0;
              if (count === 0) return nothing;
              const badgeVariant: BadgeVariant = kind === 'running' ? 'brand' : 'danger';
              const text =
                kind === 'running'
                  ? this.localize('evaluationRunRunningCount', undefined, { count })
                  : this.localize('evaluationRunFailedCount', undefined, { count });
              return html`<lr-badge part="count" data-kind=${kind} variant=${badgeVariant}>${text}</lr-badge>`;
            })}
          </span>
        </div>
        ${this.examples.length === 0
          ? html`<lr-empty part="empty" heading=${this.localize('noData')}></lr-empty>`
          : html`<div part="examples">${this.examples.map((example, index) => this.renderExample(example, index))}</div>`}
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
