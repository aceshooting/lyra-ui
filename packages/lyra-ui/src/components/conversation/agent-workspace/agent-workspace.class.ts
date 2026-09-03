import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteCount } from '../../../internal/numbers.js';
import { normalizeChatComposerStatus } from '../chat-composer/chat-composer.class.js';
import type { ChatComposerStatus } from '../chat-composer/chat-composer.class.js';
import type { AgentRunMetric } from '../../agent-tools/agent-run/agent-run.class.js';
export type { AgentRunMetric } from '../../agent-tools/agent-run/agent-run.class.js';
import type { ContextInspectorSegment } from '../../agent-tools/context-inspector/context-inspector.class.js';
export type { ContextInspectorSegment } from '../../agent-tools/context-inspector/context-inspector.class.js';
import type {
  AgentRun,
  CancelEventDetail,
  ChatMessage,
  Citation,
  CitationSelectEventDetail,
  GroundingAssessment,
  RetrievalChunk,
  RetryEventDetail,
} from '../../../ai/types.js';
import type { RetrievalResultsSelectDetail } from '../../retrieval/retrieval-results/retrieval-results.class.js';
import type { ToolTimelineEntry, ToolTimelineApprovalDetail } from '../../agent-tools/tool-timeline/tool-timeline.class.js';
export type { ToolTimelineEntry } from '../../agent-tools/tool-timeline/tool-timeline.class.js';
import { styles } from './agent-workspace.styles.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_agentWorkspaceContext, LYRA_DEFAULT_agentWorkspaceConversation, LYRA_DEFAULT_agentWorkspaceDetails, LYRA_DEFAULT_agentWorkspaceEmpty, LYRA_DEFAULT_agentWorkspaceGrounding, LYRA_DEFAULT_agentWorkspaceLabel, LYRA_DEFAULT_agentWorkspaceRetrieval, LYRA_DEFAULT_agentWorkspaceRun, LYRA_DEFAULT_agentWorkspaceTools, LYRA_DEFAULT_composerPlaceholder, LYRA_DEFAULT_fieldRequired } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


const MAX_RENDERED_MESSAGES = 500;

function firstByWorkspaceIdentity<T>(
  items: readonly T[],
  identity: (item: T) => unknown
): T[] {
  const result: T[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    let id: unknown;
    try {
      id = identity(item);
    } catch {
      continue;
    }
    if (typeof id !== 'string' || id.trim() === '' || seen.has(id)) continue;
    seen.add(id);
    result.push(item);
  }
  return result;
}

interface EffectiveWorkspaceMessage {
  message: ChatMessage;
  sourceIndex: number;
}

export interface LyraAgentWorkspaceEventMap {
  'lr-input': CustomEvent<{ value: string }>;
  'lr-submit': CustomEvent<{ value: string }>;
  'lr-stop': CustomEvent<null>;
  'lr-message-retry': CustomEvent<{ messageId: string }>;
  'lr-follow-change': CustomEvent<{ following: boolean }>;
  'lr-retrieval-select': CustomEvent<LyraEventDetailSnapshot<RetrievalResultsSelectDetail>>;
  'lr-citation-select': CustomEvent<LyraEventDetailSnapshot<CitationSelectEventDetail>>;
  'lr-tool-approval-decide': CustomEvent<ToolTimelineApprovalDetail>;
  // Both of these bubble up unchanged from the composed `<lr-agent-run>`, so each has to carry
  // that element's own detail type -- `lr-cancel` is emitted there as `emit('lr-cancel', {})`,
  // i.e. always a real `CancelEventDetail` object, never `undefined`.
  'lr-cancel': CustomEvent<CancelEventDetail>;
  'lr-run-retry': CustomEvent<RetryEventDetail>;
}

/**
 * `<lr-agent-workspace>` — a responsive, controlled shell for an AI conversation and its
 * supporting agent state. It renders the transcript and composer in the main pane, and composes
 * existing run, tool, retrieval, grounding, and context primitives in an optional details pane.
 *
 * The component performs no network requests, model calls, retrieval, or persistence. Assign new
 * data to the public properties as the host application receives updates. The `messages` fallback
 * renders ordered `message.parts` through `<lr-message-parts>` when supplied, otherwise sanitized
 * Markdown from the legacy `message.text`; applications can replace the entire region with the
 * `messages` slot. The `details` slot similarly replaces the built-in details pane while keeping
 * the responsive shell. Empty and duplicate message ids normalize first-wins before the bounded
 * window is chosen; at most the latest 500 valid messages are materialized. Applications needing
 * a larger retained transcript can supply a virtualized `messages` slot.
 * Composer value, follow state, and retrieval selection are request-only:
 * child events are forwarded, but the workspace never writes those public
 * properties. The host applies accepted state back to the component.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * **The transcript is the only region that scrolls.** `[part='base']` is a three-row grid —
 * header, conversation, composer — where only the middle row can shrink, so the composed
 * `<lr-chat-viewport>` owns the scrolling and the chrome rows stay put. Header and composer
 * content are therefore sized by their own content: give the workspace less block-size than they
 * need and the conversation row collapses to zero first, after which the chrome is clipped with no
 * scrollbar. That only happens with unusually large slotted chrome — a very tall `header-actions`
 * toolbar, or a `composer` replacement much taller than the built-in one — and the fix belongs to
 * whoever supplied it, through the public parts:
 * `lr-agent-workspace::part(header) { max-block-size: 4rem; overflow: auto; }` (the same applies
 * to `::part(composer)`). No component-owned custom property duplicates that, because a
 * `::part()` rule from the consumer's tree already wins over the shadow stylesheet regardless of
 * specificity and can set the cap and the overflow together.
 *
 * @customElement lr-agent-workspace
 * @slot messages - Replaces the data-driven transcript message list.
 * @slot details - Replaces the built-in run/tool/retrieval/grounding/context details pane.
 * @slot composer - Replaces the built-in plain-frame `<lr-chat-composer>`; a supplied composer keeps its own frame.
 * @slot header-actions - Header actions such as model selection, settings, or export controls.
 * @event lr-input - Forwarded from the built-in composer. `detail: { value }`.
 * @event lr-submit - Forwarded from the built-in composer. `detail: { value }`.
 * @event lr-stop - Forwarded from the built-in composer.
 * @event lr-message-retry - A data-driven message's retry action was activated. `detail: { messageId }`.
 * @event lr-follow-change - Forwarded from the transcript viewport. `detail: { following }`.
 * @event lr-retrieval-select - Forwarded from the built-in retrieval results. `detail: { chunkIds, chunks }`.
 * @event lr-citation-select - Forwarded from the built-in grounding summary. `detail: { citation }`.
 * @event lr-tool-approval-decide - Forwarded from the built-in tool timeline.
 * @event lr-cancel - Forwarded from the built-in agent run.
 * @event lr-run-retry - Forwarded from the built-in agent run.
 * @csspart base - The root workspace wrapper.
 * @csspart header - The workspace heading and header-actions slot.
 * @csspart heading - The visible workspace heading.
 * @csspart header-actions - The header-actions slot wrapper.
 * @csspart body - The main conversation/details layout.
 * @csspart conversation - The main transcript pane.
 * @csspart viewport - The composed `<lr-chat-viewport>`.
 * @csspart messages - Each data-driven transcript message (also exposed as `message`).
 * @csspart message - Each data-driven transcript message.
 * @csspart messages-empty - The empty transcript state.
 * @csspart details - The responsive details pane.
 * @csspart details-content - The built-in details content wrapper.
 * @csspart section - A built-in run, tools, retrieval, grounding, or context section.
 * @csspart section-heading - A built-in details section heading.
 * @csspart composer - The composer region.
 * @csspart composer-input - The built-in `<lr-chat-composer>`.
 * @status stable
 * @since 4.2.0
 */
export class LyraAgentWorkspace extends LyraElement<LyraAgentWorkspaceEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    agentWorkspaceContext: LYRA_DEFAULT_agentWorkspaceContext,
    agentWorkspaceConversation: LYRA_DEFAULT_agentWorkspaceConversation,
    agentWorkspaceDetails: LYRA_DEFAULT_agentWorkspaceDetails,
    agentWorkspaceEmpty: LYRA_DEFAULT_agentWorkspaceEmpty,
    agentWorkspaceGrounding: LYRA_DEFAULT_agentWorkspaceGrounding,
    agentWorkspaceLabel: LYRA_DEFAULT_agentWorkspaceLabel,
    agentWorkspaceRetrieval: LYRA_DEFAULT_agentWorkspaceRetrieval,
    agentWorkspaceRun: LYRA_DEFAULT_agentWorkspaceRun,
    agentWorkspaceTools: LYRA_DEFAULT_agentWorkspaceTools,
    composerPlaceholder: LYRA_DEFAULT_composerPlaceholder,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-retrieval-select',
  ]);

  protected static override readonly ownedCollectionProperties = Object.freeze([
    'messages',
    'run',
    'metrics',
    'tools',
    'retrievalChunks',
    'selectedRetrievalChunkIds',
    'groundingAssessment',
    'citations',
    'contextSegments',
  ]);

  static override styles = [LyraElement.styles, styles];

  /** Accessible name and visible heading for the workspace. */
  @property() label = '';

  /** Host-level accessible-name override for the internal `role="region"` root. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  /** Conversation messages. The host owns ordering, updates, and persistence. Ids are unique,
   *  nonempty occurrence identities; malformed rows and later duplicates are ignored before the
   *  bounded render window is chosen, with the first occurrence winning. */
  @property({ attribute: false }) messages: readonly ChatMessage[] = [];

  /** Current agent run, rendered in the details pane when set. */
  @property({ attribute: false }) run: Readonly<AgentRun> | null = null;

  /** Additional metrics forwarded to `<lr-agent-run>`, such as token counts or latency. */
  @property({ attribute: false }) metrics: readonly AgentRunMetric[] = [];

  /** Tool calls for the current run. Malformed/blank/later duplicate composite identities are
   * ignored before section gating and forwarding to `<lr-tool-timeline>`. */
  @property({ attribute: false }) tools: readonly ToolTimelineEntry[] = [];

  /** Retrieval chunks for the current answer or query, first-valid/first-wins by nonblank id. */
  @property({ attribute: false }) retrievalChunks: readonly RetrievalChunk[] = [];

  /** Controlled retrieval selection, forwarded to `<lr-retrieval-results>`. */
  @property({ attribute: false }) selectedRetrievalChunkIds: readonly string[] = [];

  /** Loading state for the built-in retrieval result list. */
  @property({ type: Boolean, attribute: 'retrieval-loading' }) retrievalLoading = false;

  /** Whether more retrieval results can be requested. */
  @property({ type: Boolean, attribute: 'retrieval-has-more' }) retrievalHasMore = false;

  /** Caller-supplied retrieval error text. */
  @property({ attribute: 'retrieval-error-text' }) retrievalErrorText = '';

  /** Grounding assessment for the current assistant answer. */
  @property({ attribute: false }) groundingAssessment: Readonly<GroundingAssessment> | null = null;

  /** Citations displayed with the grounding summary, first-valid/first-wins by nonblank id. */
  @property({ attribute: false }) citations: readonly Citation[] = [];

  /** Final model-call context segments, first-valid/first-wins by nonblank id. */
  @property({ attribute: false }) contextSegments: readonly ContextInspectorSegment[] = [];

  /** Overall context-window token total. */
  @property({ type: Number, attribute: 'context-total' }) contextTotal = 0;

  /** Whether the transcript follows the latest message. */
  @property({ type: Boolean, reflect: true, converter: trueDefaultBooleanConverter }) follow = true;

  /** First unread message index, forwarded to the transcript viewport. */
  @property({ type: Number, attribute: 'unread-start-index' }) unreadStartIndex: number | null = null;

  /** Whether the built-in details pane is available when data is present. */
  @property({ type: Boolean, attribute: 'show-details', reflect: true, converter: trueDefaultBooleanConverter })
  showDetails = true;

  /** Whether the built-in plain-frame composer is available when no `composer` slot is supplied. */
  @property({ type: Boolean, attribute: 'show-composer', reflect: true, converter: trueDefaultBooleanConverter })
  showComposer = true;

  /** Controlled value of the built-in composer. */
  @property({ attribute: 'composer-value' }) composerValue = '';

  /** Status of the built-in composer. */
  private composerStatusValue: ChatComposerStatus = 'idle';
  @property({ attribute: 'composer-status' })
  get composerStatus(): ChatComposerStatus {
    return this.composerStatusValue;
  }
  set composerStatus(value: ChatComposerStatus) {
    const previous = this.composerStatusValue;
    this.composerStatusValue = normalizeChatComposerStatus(value);
    this.requestUpdate('composerStatus', previous);
  }

  /** Placeholder for the built-in composer. */
  @property({ attribute: 'composer-placeholder' }) composerPlaceholder = '';

  /** Minimum and maximum rows for the built-in composer. */
  @property({ type: Number, attribute: 'composer-min-rows' }) composerMinRows = 1;
  @property({ type: Number, attribute: 'composer-max-rows' }) composerMaxRows = 8;

  private hasSlotted(name: string): boolean {
    return Array.from(this.children).some((element) => element.getAttribute('slot') === name);
  }

  private get safeContextTotal(): number {
    return finiteCount(this.contextTotal);
  }

  private get effectiveTools(): readonly ToolTimelineEntry[] {
    return firstByWorkspaceIdentity(this.tools, (entry) => {
      const id = entry.id;
      if (typeof id !== 'string' || id.trim() === '') return undefined;
      const sourceKey = entry.sourceKey;
      return `${typeof sourceKey === 'string' ? sourceKey : ''}\u0000${id}`;
    });
  }

  private get effectiveRetrievalChunks(): readonly RetrievalChunk[] {
    return firstByWorkspaceIdentity(this.retrievalChunks, (chunk) => chunk.id);
  }

  private get effectiveCitations(): readonly Citation[] {
    return firstByWorkspaceIdentity(this.citations, (citation) => citation.id);
  }

  private get effectiveContextSegments(): readonly ContextInspectorSegment[] {
    return firstByWorkspaceIdentity(this.contextSegments, (segment) => segment.id);
  }

  private get effectiveMessages(): readonly EffectiveWorkspaceMessage[] {
    const source = this.messages;
    const seen = new Set<string>();
    const messages: EffectiveWorkspaceMessage[] = [];
    for (let sourceIndex = 0; sourceIndex < source.length; sourceIndex++) {
      const message = source[sourceIndex];
      if (!message) continue;
      const id = message?.id;
      if (typeof id !== 'string' || id.trim() === '' || seen.has(id)) continue;
      seen.add(id);
      messages.push({ message, sourceIndex });
    }
    return messages;
  }

  private get safeUnreadStartIndex(): number | null {
    if (this.unreadStartIndex == null) return null;
    const normalized = finiteCount(this.unreadStartIndex);
    if (this.hasSlotted('messages')) return normalized;
    const messages = this.effectiveMessages;
    const effectiveIndex = messages.filter(({ sourceIndex }) => sourceIndex < normalized).length;
    return Math.max(0, effectiveIndex - this.messageWindowOffsetFor(messages));
  }

  private get safeComposerMinRows(): number {
    return Math.max(1, finiteCount(this.composerMinRows, 1));
  }

  private get safeComposerMaxRows(): number {
    return Math.max(this.safeComposerMinRows, finiteCount(this.composerMaxRows, 8));
  }

  private onRetrievalSelect = (event: CustomEvent<RetrievalResultsSelectDetail>): void => {
    // `<lr-retrieval-results>`'s own `lr-select` bubbles/composes (LyraElement.emit()'s defaults),
    // so without stopping it here it would keep bubbling straight through this component under the
    // wrong, undocumented name -- this component's own contract is `lr-retrieval-select` below.
    event.stopPropagation();
    this.emit('lr-retrieval-select', event.detail);
  };

  private onMessageRetry = (event: CustomEvent<{ messageId?: string }>): void => {
    event.stopPropagation();
    if (event.detail.messageId) this.emit('lr-message-retry', { messageId: event.detail.messageId });
  };

  private stopOwnedEvent(event: Event): void {
    event.stopPropagation();
  }

  private renderMessage(message: ChatMessage): TemplateResult {
    return html`
      <lr-chat-message
        part="messages message"
        .messageRole=${message.role}
        .messageId=${message.id}
        .status=${message.status ?? 'sent'}
        .timestamp=${message.timestamp}
        @lr-message-retry=${this.onMessageRetry}
      >
        ${message.parts?.length
          ? html`<lr-message-parts .parts=${message.parts}></lr-message-parts>`
          : html`<lr-markdown
              .content=${message.text ?? ''}
              @lr-render-error=${this.stopOwnedEvent}
              @lr-link-click=${this.stopOwnedEvent}
              @lr-highlight-activate=${this.stopOwnedEvent}
              @lr-text-select=${this.stopOwnedEvent}
              @lr-anchor-result=${this.stopOwnedEvent}
            ></lr-markdown>`}
      </lr-chat-message>
    `;
  }

  private renderMessages(): TemplateResult {
    const effectiveMessages = this.effectiveMessages;
    if (effectiveMessages.length === 0) {
      return html`<lr-empty part="messages-empty" heading=${this.localize('agentWorkspaceEmpty')}></lr-empty>`;
    }
    const messages = effectiveMessages
      .slice(this.messageWindowOffsetFor(effectiveMessages))
      .map(({ message }) => message);
    return html`${repeat(messages, (message) => message.id, (message) => this.renderMessage(message))}`;
  }

  private messageWindowOffsetFor(messages: readonly EffectiveWorkspaceMessage[]): number {
    return Math.max(0, messages.length - MAX_RENDERED_MESSAGES);
  }

  /** Bound to every named slot whose assignment `render()` reads back through `hasSlotted()` --
   *  `messages` (which decides how `safeUnreadStartIndex` is projected), `details`, and `composer`.
   *  A slot assignment change alone schedules no Lit update, so without this the branch is only
   *  ever evaluated at mount. */
  private onNamedSlotChange = (): void => {
    this.requestUpdate();
  };

  private renderDetails(): TemplateResult {
    const tools = this.effectiveTools;
    const retrievalChunks = this.effectiveRetrievalChunks;
    const citations = this.effectiveCitations;
    const contextSegments = this.effectiveContextSegments;
    return html`
      <div part="details-content">
        ${this.run
          ? html`<section part="section">
              <h3 part="section-heading">${this.localize('agentWorkspaceRun')}</h3>
              <lr-agent-run .run=${this.run} .metrics=${this.metrics}></lr-agent-run>
            </section>`
          : nothing}
        ${tools.length > 0
          ? html`<section part="section">
              <h3 part="section-heading">${this.localize('agentWorkspaceTools')}</h3>
              <lr-tool-timeline .entries=${tools}></lr-tool-timeline>
            </section>`
          : nothing}
        ${retrievalChunks.length > 0 || this.retrievalLoading || this.retrievalErrorText
          ? html`<section part="section">
              <h3 part="section-heading">${this.localize('agentWorkspaceRetrieval')}</h3>
              <lr-retrieval-results
                .chunks=${retrievalChunks}
                .selectedChunkIds=${this.selectedRetrievalChunkIds}
                .loading=${this.retrievalLoading}
                .hasMore=${this.retrievalHasMore}
                .errorText=${this.retrievalErrorText}
                @lr-select=${this.onRetrievalSelect}
              ></lr-retrieval-results>
            </section>`
          : nothing}
        ${this.groundingAssessment || citations.length > 0
          ? html`<section part="section">
              <h3 part="section-heading">${this.localize('agentWorkspaceGrounding')}</h3>
              <lr-grounding-summary
                .assessment=${this.groundingAssessment}
                .citations=${citations}
              ></lr-grounding-summary>
            </section>`
          : nothing}
        ${contextSegments.length > 0
          ? html`<section part="section">
              <h3 part="section-heading">${this.localize('agentWorkspaceContext')}</h3>
              <lr-context-inspector
                .segments=${contextSegments}
                .total=${this.safeContextTotal}
              ></lr-context-inspector>
            </section>`
          : nothing}
      </div>
    `;
  }

  private get hasBuiltInDetails(): boolean {
    return Boolean(
      this.run ||
        this.effectiveTools.length > 0 ||
        this.effectiveRetrievalChunks.length > 0 ||
        this.retrievalLoading ||
        this.retrievalErrorText ||
        this.groundingAssessment ||
        this.effectiveCitations.length > 0 ||
        this.effectiveContextSegments.length > 0,
    );
  }

  override render(): TemplateResult {
    const label = this.accessibleLabel ?? (this.label || this.localize('agentWorkspaceLabel'));
    const heading = this.label || this.localize('agentWorkspaceLabel');
    const hasSlottedDetails = this.hasSlotted('details');
    const hasDetails = hasSlottedDetails || (this.showDetails && this.hasBuiltInDetails);
    const hasSlottedComposer = this.hasSlotted('composer');
    return html`
      <div part="base" role="region" aria-label=${label}>
        <div part="header">
          <h2 part="heading">${heading}</h2>
          <span part="header-actions"><slot name="header-actions"></slot></span>
        </div>
        <div part="body" data-details=${hasDetails ? 'true' : 'false'}>
          <section part="conversation" aria-label=${this.localize('agentWorkspaceConversation')}>
            <lr-chat-viewport
              part="viewport"
              .follow=${this.follow}
              .unreadStartIndex=${this.safeUnreadStartIndex}
              aria-label=${this.localize('agentWorkspaceConversation')}
            >
              <slot name="messages" @slotchange=${this.onNamedSlotChange}
                >${this.renderMessages()}</slot
              >
            </lr-chat-viewport>
          </section>
          <aside
            part="details"
            aria-label=${this.localize('agentWorkspaceDetails')}
            ?hidden=${!hasDetails}
          >
            <slot name="details" @slotchange=${this.onNamedSlotChange}
              >${this.showDetails ? this.renderDetails() : nothing}</slot
            >
          </aside>
        </div>
        <div part="composer" ?hidden=${!this.showComposer && !hasSlottedComposer}>
          <slot name="composer" @slotchange=${this.onNamedSlotChange}>
            ${this.showComposer
              ? html`<lr-chat-composer
                  part="composer-input"
                  frame="plain"
                  .value=${this.composerValue}
                  .status=${this.composerStatus}
                  .minRows=${this.safeComposerMinRows}
                  .maxRows=${this.safeComposerMaxRows}
                  placeholder=${this.composerPlaceholder || this.localize('composerPlaceholder')}
                ></lr-chat-composer>`
              : nothing}
          </slot>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-agent-workspace': LyraAgentWorkspace;
  }
}
