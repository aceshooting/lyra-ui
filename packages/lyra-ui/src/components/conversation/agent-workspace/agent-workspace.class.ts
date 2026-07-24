import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteCount } from '../../../internal/numbers.js';
import type { ChatComposerStatus } from '../chat-composer/chat-composer.class.js';
import type { AgentRunMetric } from '../../agent-tools/agent-run/agent-run.class.js';
import type { ContextInspectorSegment } from '../../agent-tools/context-inspector/context-inspector.class.js';
import type {
  AgentRun,
  ChatMessage,
  Citation,
  CitationSelectEventDetail,
  GroundingAssessment,
  RetrievalChunk,
  RetryEventDetail,
} from '../../../ai/types.js';
import type { RetrievalResultsSelectDetail } from '../../retrieval/retrieval-results/retrieval-results.class.js';
import type { ToolTimelineEntry, ToolTimelineApprovalDetail } from '../../agent-tools/tool-timeline/tool-timeline.class.js';
import { styles } from './agent-workspace.styles.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';

const MAX_RENDERED_MESSAGES = 500;

export interface LyraAgentWorkspaceEventMap {
  'lr-input': CustomEvent<{ value: string }>;
  'lr-submit': CustomEvent<{ value: string }>;
  'lr-stop': CustomEvent<undefined>;
  'lr-message-retry': CustomEvent<{ messageId: string }>;
  'lr-follow-change': CustomEvent<{ following: boolean }>;
  'lr-retrieval-select': CustomEvent<RetrievalResultsSelectDetail>;
  'lr-citation-select': CustomEvent<CitationSelectEventDetail>;
  'lr-tool-approval-decide': CustomEvent<ToolTimelineApprovalDetail>;
  'lr-cancel': CustomEvent<undefined>;
  'lr-retry': CustomEvent<RetryEventDetail>;
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
 * the responsive shell. To keep the data-driven fallback bounded, at most the latest 500 messages
 * are materialized; applications needing a larger retained transcript can supply a virtualized
 * `messages` slot.
 *
 * @customElement lr-agent-workspace
 * @slot messages - Replaces the data-driven transcript message list.
 * @slot details - Replaces the built-in run/tool/retrieval/grounding/context details pane.
 * @slot composer - Replaces the built-in `<lr-chat-composer>`.
 * @slot header-actions - Header actions such as model selection, settings, or export controls.
 * @event lr-input - Forwarded from the built-in composer. `detail: { value }`.
 * @event lr-submit - Forwarded from the built-in composer. `detail: { value }`.
 * @event lr-stop - Forwarded from the built-in composer.
 * @event lr-message-retry - A data-driven message's retry action was activated. `detail: { messageId }`.
 * @event lr-follow-change - Forwarded from the transcript viewport. `detail: { following }`.
 * @event lr-retrieval-select - Forwarded from the built-in retrieval results. `detail: { ids, chunks }`.
 * @event lr-citation-select - Forwarded from the built-in grounding summary. `detail: { citation }`.
 * @event lr-tool-approval-decide - Forwarded from the built-in tool timeline.
 * @event lr-cancel - Forwarded from the built-in agent run.
 * @event lr-retry - Forwarded from the built-in agent run.
 * @csspart base - The root workspace wrapper.
 * @csspart header - The workspace heading and header-actions slot.
 * @csspart heading - The visible workspace heading.
 * @csspart header-actions - The header-actions slot wrapper.
 * @csspart body - The main conversation/details layout.
 * @csspart conversation - The main transcript pane.
 * @csspart viewport - The composed `<lr-chat-viewport>`.
 * @csspart messages - The transcript message wrapper.
 * @csspart messages-empty - The empty transcript state.
 * @csspart details - The responsive details pane.
 * @csspart details-content - The built-in details content wrapper.
 * @csspart section - A built-in run, tools, retrieval, grounding, or context section.
 * @csspart section-heading - A built-in details section heading.
 * @csspart composer - The composer region.
 * @csspart composer-input - The built-in `<lr-chat-composer>`.
 */
export class LyraAgentWorkspace extends LyraElement<LyraAgentWorkspaceEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** Accessible name and visible heading for the workspace. */
  @property() label = '';

  /** Host-level accessible-name override for the internal `role="region"` root. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  /** Conversation messages. The host owns ordering, updates, and persistence. */
  @property({ attribute: false }) messages: ChatMessage[] = [];

  /** Current agent run, rendered in the details pane when set. */
  @property({ attribute: false }) run: AgentRun | null = null;

  /** Additional metrics forwarded to `<lr-agent-run>`, such as token counts or latency. */
  @property({ attribute: false }) metrics: AgentRunMetric[] = [];

  /** Tool calls for the current run, rendered through `<lr-tool-timeline>`. */
  @property({ attribute: false }) tools: ToolTimelineEntry[] = [];

  /** Retrieval chunks for the current answer or query. */
  @property({ attribute: false }) retrievalChunks: RetrievalChunk[] = [];

  /** Controlled retrieval selection, forwarded to `<lr-retrieval-results>`. */
  @property({ attribute: false }) selectedRetrievalIds: string[] = [];

  /** Loading state for the built-in retrieval result list. */
  @property({ type: Boolean, attribute: 'retrieval-loading' }) retrievalLoading = false;

  /** Whether more retrieval results can be requested. */
  @property({ type: Boolean, attribute: 'retrieval-has-more' }) retrievalHasMore = false;

  /** Caller-supplied retrieval error text. */
  @property({ attribute: 'retrieval-error' }) retrievalError = '';

  /** Grounding assessment for the current assistant answer. */
  @property({ attribute: false }) groundingAssessment: GroundingAssessment | null = null;

  /** Citations displayed with the grounding summary. */
  @property({ attribute: false }) citations: Citation[] = [];

  /** Final model-call context segments. */
  @property({ attribute: false }) contextSegments: ContextInspectorSegment[] = [];

  /** Overall context-window token total. */
  @property({ type: Number, attribute: 'context-total' }) contextTotal = 0;

  /** Whether the transcript follows the latest message. */
  @property({ type: Boolean, reflect: true, converter: trueDefaultBooleanConverter }) follow = true;

  /** First unread message index, forwarded to the transcript viewport. */
  @property({ type: Number, attribute: 'unread-start-index' }) unreadStartIndex: number | null = null;

  /** Whether the built-in details pane is available when data is present. */
  @property({ type: Boolean, attribute: 'show-details', reflect: true, converter: trueDefaultBooleanConverter })
  showDetails = true;

  /** Whether the built-in composer is available when no `composer` slot is supplied. */
  @property({ type: Boolean, attribute: 'show-composer', reflect: true, converter: trueDefaultBooleanConverter })
  showComposer = true;

  /** Controlled value of the built-in composer. */
  @property({ attribute: 'composer-value' }) composerValue = '';

  /** Status of the built-in composer. */
  @property({ attribute: 'composer-status' }) composerStatus: ChatComposerStatus = 'idle';

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

  private get safeUnreadStartIndex(): number | null {
    if (this.unreadStartIndex == null) return null;
    const normalized = finiteCount(this.unreadStartIndex);
    if (this.hasSlotted('messages')) return normalized;
    return Math.max(0, normalized - this.messageWindowOffset);
  }

  private get safeComposerMinRows(): number {
    return Math.max(1, finiteCount(this.composerMinRows, 1));
  }

  private get safeComposerMaxRows(): number {
    return Math.max(this.safeComposerMinRows, finiteCount(this.composerMaxRows, 8));
  }

  private onComposerInput = (event: CustomEvent<{ value: string }>): void => {
    this.composerValue = event.detail.value;
  };

  private onFollowChange = (event: CustomEvent<{ following: boolean }>): void => {
    this.follow = event.detail.following;
  };

  private onRetrievalSelect = (event: CustomEvent<RetrievalResultsSelectDetail>): void => {
    // `<lr-retrieval-results>`'s own `lr-select` bubbles/composes (LyraElement.emit()'s defaults),
    // so without stopping it here it would keep bubbling straight through this component under the
    // wrong, undocumented name -- this component's own contract is `lr-retrieval-select` below.
    event.stopPropagation();
    this.selectedRetrievalIds = event.detail.ids;
    this.emit<RetrievalResultsSelectDetail>('lr-retrieval-select', event.detail);
  };

  private onMessageRetry = (event: CustomEvent<{ messageId?: string }>): void => {
    event.stopPropagation();
    if (event.detail.messageId) this.emit('lr-message-retry', { messageId: event.detail.messageId });
  };

  private renderMessage(message: ChatMessage): TemplateResult {
    return html`
      <lr-chat-message
        .role=${message.role}
        .messageId=${message.id}
        .status=${message.status ?? 'sent'}
        .timestamp=${message.timestamp}
        @lr-retry=${this.onMessageRetry}
      >
        ${message.parts?.length
          ? html`<lr-message-parts .parts=${message.parts}></lr-message-parts>`
          : html`<lr-markdown .content=${message.text ?? ''}></lr-markdown>`}
      </lr-chat-message>
    `;
  }

  private renderMessages(): TemplateResult {
    if (this.messages.length === 0) {
      return html`<lr-empty part="messages-empty" heading=${this.localize('agentWorkspaceEmpty')}></lr-empty>`;
    }
    const messages = this.messages.slice(this.messageWindowOffset);
    return html`${repeat(messages, (message) => message.id, (message) => this.renderMessage(message))}`;
  }

  private get messageWindowOffset(): number {
    return Math.max(0, this.messages.length - MAX_RENDERED_MESSAGES);
  }

  private onNamedSlotChange = (): void => {
    this.requestUpdate();
  };

  private renderDetails(): TemplateResult {
    return html`
      <div part="details-content">
        ${this.run
          ? html`<section part="section">
              <h3 part="section-heading">${this.localize('agentWorkspaceRun')}</h3>
              <lr-agent-run .run=${this.run} .metrics=${this.metrics}></lr-agent-run>
            </section>`
          : nothing}
        ${this.tools.length > 0
          ? html`<section part="section">
              <h3 part="section-heading">${this.localize('agentWorkspaceTools')}</h3>
              <lr-tool-timeline .entries=${this.tools}></lr-tool-timeline>
            </section>`
          : nothing}
        ${this.retrievalChunks.length > 0 || this.retrievalLoading || this.retrievalError
          ? html`<section part="section">
              <h3 part="section-heading">${this.localize('agentWorkspaceRetrieval')}</h3>
              <lr-retrieval-results
                .chunks=${this.retrievalChunks}
                .selectedIds=${this.selectedRetrievalIds}
                .loading=${this.retrievalLoading}
                .hasMore=${this.retrievalHasMore}
                .error=${this.retrievalError}
                @lr-select=${this.onRetrievalSelect}
              ></lr-retrieval-results>
            </section>`
          : nothing}
        ${this.groundingAssessment || this.citations.length > 0
          ? html`<section part="section">
              <h3 part="section-heading">${this.localize('agentWorkspaceGrounding')}</h3>
              <lr-grounding-summary
                .assessment=${this.groundingAssessment}
                .citations=${this.citations}
              ></lr-grounding-summary>
            </section>`
          : nothing}
        ${this.contextSegments.length > 0
          ? html`<section part="section">
              <h3 part="section-heading">${this.localize('agentWorkspaceContext')}</h3>
              <lr-context-inspector
                .segments=${this.contextSegments}
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
        this.tools.length > 0 ||
        this.retrievalChunks.length > 0 ||
        this.retrievalLoading ||
        this.retrievalError ||
        this.groundingAssessment ||
        this.citations.length > 0 ||
        this.contextSegments.length > 0,
    );
  }

  override render(): TemplateResult {
    const label = this.accessibleLabel || this.label || this.localize('agentWorkspaceLabel');
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
              @lr-follow-change=${this.onFollowChange}
            >
              <div part="messages">
                <slot name="messages">${this.renderMessages()}</slot>
              </div>
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
                  .value=${this.composerValue}
                  .status=${this.composerStatus}
                  .minRows=${this.safeComposerMinRows}
                  .maxRows=${this.safeComposerMaxRows}
                  placeholder=${this.composerPlaceholder || this.localize('composerPlaceholder')}
                  @lr-input=${this.onComposerInput}
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
