import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import type { CitationMessagePart, CitationSelectEventDetail, MessagePart } from '../../../ai/types.js';
import type { LyraThinkingPanelEventMap } from '../../agent-tools/thinking-panel/thinking-panel.class.js';
import type { LyraToolCallChipEventMap } from '../../agent-tools/tool-call-chip/tool-call-chip.class.js';
import type { LyraToolResultViewEventMap } from '../../agent-tools/tool-result-view/tool-result-view.class.js';
import type { LyraAttachmentChipEventMap } from '../../media/attachment-chip/attachment-chip.class.js';
import type { LyraCitationBadgeEventMap } from '../../retrieval/citation-badge/citation-badge.class.js';
import type { LyraJsonViewerEventMap } from '../../utility/json-viewer/json-viewer.class.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { finiteCount } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { safeMediaSrc } from '../../../internal/safe-url.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
import type { LyraMarkdownEventMap, MarkdownStreamingRenderMode } from '../markdown/markdown.class.js';
import type { LyraWidgetRendererEventMap } from '../widget-renderer/widget-renderer.class.js';
import { isNonBlankIdentity, isRecord } from '../../retrieval/retrieval-identity.js';
import { styles } from './message-parts.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_durationMilliseconds, LYRA_DEFAULT_durationSeconds, LYRA_DEFAULT_envListValueHidden, LYRA_DEFAULT_messagePartError, LYRA_DEFAULT_messagePartRetry, LYRA_DEFAULT_messagePartsLabel, LYRA_DEFAULT_retry, LYRA_DEFAULT_statusDenied, LYRA_DEFAULT_statusError, LYRA_DEFAULT_statusPending, LYRA_DEFAULT_statusRunning, LYRA_DEFAULT_statusSuccess, LYRA_DEFAULT_thinkingPanelLabel, LYRA_DEFAULT_toolTimelineDetailsFor } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/**
 * Host override for how one message part renders. Returning `undefined` delegates that part
 * entirely to the built-in renderer, keeping every built-in affordance intact. Returning any other
 * value fully REPLACES the built-in rendering for that part -- not just its visual content but
 * every interactive affordance and event the built-in renderer would otherwise wire up for that
 * part type: the `error` part's retry button (`lr-part-retry`), a `citation` part's activation
 * (`lr-citation-select`), and the composed children's own events for `tool-call`
 * (`<lr-tool-call-chip>`'s `lr-tool-call-chip-select`), `tool-result`/`attachment`
 * (`<lr-tool-result-view>`/`<lr-attachment-chip>`'s preview surface) and `data`
 * (`<lr-widget-renderer>`'s `lr-widget-action`/`lr-widget-state-change`). A host overriding an
 * interactive part type must reimplement whatever of that interaction it still wants.
 */
export type MessagePartRenderer = (part: MessagePart, index: number) => unknown;

/** Rendering mode for text and reasoning message parts. */
export type MessagePartsContentMode = 'plain' | 'markdown';

/** Presentation for tool calls inside a message. */
export type MessagePartsToolDisplay = 'chip' | 'disclosure';

const MESSAGE_PARTS_CONTENT_MODES = Object.freeze(['plain', 'markdown'] as const);

function normalizeMessagePartsContentMode(value: unknown): MessagePartsContentMode {
  return typeof value === 'string' &&
    MESSAGE_PARTS_CONTENT_MODES.includes(value as MessagePartsContentMode)
    ? value as MessagePartsContentMode
    : 'markdown';
}

const MESSAGE_PARTS_TOOL_DISPLAYS = Object.freeze(['chip', 'disclosure'] as const);

function normalizeMessagePartsToolDisplay(value: unknown): MessagePartsToolDisplay {
  return typeof value === 'string' &&
    MESSAGE_PARTS_TOOL_DISPLAYS.includes(value as MessagePartsToolDisplay)
    ? value as MessagePartsToolDisplay
    : 'chip';
}

const MAX_TOOL_REDACTION_PATHS = 100;
const MAX_TOOL_REDACTION_DEPTH = 64;
const MAX_TOOL_REDACTION_NODES = 10_000;

function redactToolBranch(
  value: unknown,
  path: string,
  paths: readonly string[],
  placeholder: string,
  budget: { nodes: number },
  depth: number,
): unknown {
  if (paths.includes(path)) return placeholder;
  if (depth >= MAX_TOOL_REDACTION_DEPTH || budget.nodes >= MAX_TOOL_REDACTION_NODES) return placeholder;
  budget.nodes += 1;
  if (!paths.some((candidate) => candidate.startsWith(`${path}.`))) return value;
  if (Array.isArray(value)) {
    const clone: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      if (budget.nodes >= MAX_TOOL_REDACTION_NODES) return placeholder;
      clone.push(redactToolBranch(value[index], `${path}.${index}`, paths, placeholder, budget, depth + 1));
    }
    return clone;
  }
  if (value !== null && typeof value === 'object') {
    const clone = Object.create(null) as Record<string, unknown>;
    try {
      for (const key in value as Record<string, unknown>) {
        if (!Object.prototype.propertyIsEnumerable.call(value, key)) continue;
        if (budget.nodes >= MAX_TOOL_REDACTION_NODES) return placeholder;
        clone[key] = redactToolBranch(
          (value as Record<string, unknown>)[key],
          `${path}.${key}`,
          paths,
          placeholder,
          budget,
          depth + 1,
        );
      }
    } catch {
      return placeholder;
    }
    return clone;
  }
  return value;
}

function redactToolField(value: unknown, root: string, sourcePaths: unknown, placeholder: string): unknown {
  if (!Array.isArray(sourcePaths)) return value;
  if (sourcePaths.length > MAX_TOOL_REDACTION_PATHS) return placeholder;
  const paths: string[] = [];
  for (const path of sourcePaths) {
    if (typeof path !== 'string' || path.length > 4_096) return placeholder;
    if (path !== root && !path.startsWith(`${root}.`)) continue;
    if (path.split('.').length - 1 > MAX_TOOL_REDACTION_DEPTH) return placeholder;
    paths.push(path);
  }
  return paths.length === 0
    ? value
    : redactToolBranch(value, root, paths, placeholder, { nodes: 0 }, 0);
}

export interface LyraMessagePartsEventMap
  extends Omit<LyraMarkdownEventMap, 'lr-render-error'>,
    LyraThinkingPanelEventMap,
    LyraToolCallChipEventMap,
    Omit<LyraToolResultViewEventMap, 'lr-render-error'>,
    LyraAttachmentChipEventMap,
    Omit<LyraCitationBadgeEventMap, 'lr-citation-activate'>,
    LyraJsonViewerEventMap,
    Omit<LyraWidgetRendererEventMap, 'lr-render-error'> {
  'lr-citation-select': CustomEvent<LyraEventDetailSnapshot<CitationSelectEventDetail>>;
  'lr-part-retry': CustomEvent<LyraEventDetailSnapshot<{ part: MessagePart }>>;
  'lr-render-error': CustomEvent<{ error: unknown } | { toolName: string; error: unknown }>;
}

/**
 * `<lr-message-parts>` — renders ordered, interleavable provider-neutral AI message parts. It
 * composes Lyra's existing Markdown, reasoning, tool, citation, attachment, widget, JSON, and
 * media primitives while keeping streaming order stable by part id.
 * Part ids are unique, nonempty occurrence identities. Empty ids are omitted; when malformed
 * input repeats an id, the first occurrence wins and later duplicates are ignored. Rendering,
 * citation ranks, retry payloads, and error announcements all consume that same projection.
 * Streaming text and reasoning parts forward that state into their nested Markdown renderer, so
 * parsing/highlighting coalesces until the same-id part becomes complete.
 * Streaming text and reasoning show accumulated plain text; Markdown parsing and syntax
 * highlighting wait until that part completes.
 * In disclosure mode, `tool-call.metadata.redactedFields` may name dotted `args.*`, `result.*`,
 * or `error.*` paths; those fields are masked only after the disclosure opens. A finite
 * `tool-call.metadata.durationMs` adds a localized duration to the header.
 *
 * Citation ranks are derived in one linear render prepass, including for mixed streaming arrays.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * @customElement lr-message-parts
 * @event lr-citation-select - A citation part was activated. `detail: { citation }`.
 * @event lr-part-retry - Retry was requested for a retryable error part. `detail: { part }`.
 * @event lr-toggle - Passthrough from a rendered reasoning panel or tool disclosure.
 * @event lr-tool-call-chip-select - Passthrough from a rendered tool-call chip. The
 * `lr-tool-chip-select` alias it replaced was removed in 9.0.0.
 * @event lr-render-error - Passthrough from rendered Markdown, tool-result, or widget content.
 * @event lr-link-click - Passthrough from rendered Markdown.
 * @event lr-highlight-activate - Passthrough from rendered Markdown.
 * @event lr-text-select - Passthrough from rendered Markdown.
 * @event lr-anchor-result - Passthrough from rendered Markdown.
 * @event lr-preview-request - Passthrough from a rendered attachment. Not cancelable since 10.0.0.
 * @event lr-retry - Passthrough from a rendered attachment.
 * @event lr-remove - Passthrough from a rendered attachment.
 * @event lr-citation-open - Passthrough from a rendered citation's full-preview action.
 * @event lr-copy - Passthrough from rendered JSON content.
 * @event lr-search-change - Passthrough from rendered JSON content.
 * @event lr-widget-action - Passthrough from a rendered declarative widget.
 * @event lr-widget-state-change - Passthrough from a rendered controlled widget.
 * @csspart base - The ordered message-part list.
 * @csspart part - Every rendered part wrapper.
 * @csspart part-streaming - Additional part name on a streaming part.
 * @csspart code-block - Forwarded Markdown code block.
 * @csspart code-block-header - Forwarded code-block language and copy header.
 * @csspart code-block-language - Forwarded localized code language label.
 * @csspart code-block-copy - Forwarded copy-button host.
 * @csspart text - A text part.
 * @csspart reasoning - A reasoning part.
 * @csspart tool-call - A tool-call part.
 * @csspart tool-disclosure - The inline `<lr-details>` disclosure for a paired tool call.
 * @csspart tool-header - The disclosure summary with the tool name and localized status.
 * @csspart tool-status - The localized tool lifecycle status.
 * @csspart tool-duration - A localized duration when call metadata supplies `durationMs`.
 * @csspart tool-args - The arguments shown in an expanded tool disclosure.
 * @csspart tool-result - A standalone result part or the paired result shown in an expanded disclosure.
 * @csspart tool-error - Error copy for a failed paired tool result.
 * @csspart tool-result-error - Error copy for a failed tool-result part.
 * @csspart citation - A citation part.
 * @csspart attachment - An attachment part.
 * @csspart data - A data or widget part.
 * @csspart audio - An audio part.
 * @csspart audio-control - The native audio playback control.
 * @csspart audio-transcript - An audio part's transcript.
 * @csspart error - An error part.
 * @csspart retry - A retryable error part's action.
 * @cssprop [--lr-message-parts-streaming-color=var(--lr-color-text-quiet)] - Text color of a streaming part wrapper.
 * @cssprop [--lr-message-parts-audio-transcript-color=var(--lr-color-text-quiet)] - Text color of an audio transcript.
 * @cssprop [--lr-message-parts-error-border-color=var(--lr-color-danger)] - Border color of an error part.
 * @cssprop [--lr-message-parts-error-background=var(--lr-color-danger-quiet)] - Background color of an error part.
 * @cssprop [--lr-message-parts-error-color=var(--lr-color-danger)] - Text color of an error part.
 * @status stable
 * @since 7.0.0
 */
export class LyraMessageParts extends LyraElement<LyraMessagePartsEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    durationMilliseconds: LYRA_DEFAULT_durationMilliseconds,
    durationSeconds: LYRA_DEFAULT_durationSeconds,
    envListValueHidden: LYRA_DEFAULT_envListValueHidden,
    messagePartError: LYRA_DEFAULT_messagePartError,
    messagePartRetry: LYRA_DEFAULT_messagePartRetry,
    messagePartsLabel: LYRA_DEFAULT_messagePartsLabel,
    retry: LYRA_DEFAULT_retry,
    statusDenied: LYRA_DEFAULT_statusDenied,
    statusError: LYRA_DEFAULT_statusError,
    statusPending: LYRA_DEFAULT_statusPending,
    statusRunning: LYRA_DEFAULT_statusRunning,
    statusSuccess: LYRA_DEFAULT_statusSuccess,
    thinkingPanelLabel: LYRA_DEFAULT_thinkingPanelLabel,
    toolTimelineDetailsFor: LYRA_DEFAULT_toolTimelineDetailsFor,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly ownedCollectionProperties = Object.freeze(['parts']);

  static override styles = [LyraElement.styles, styles];
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-citation-select',
    'lr-part-retry',
  ]);

  /** Ordered message content. */
  @property({ attribute: false }) parts: readonly MessagePart[] = [];

  private contentModeValue: MessagePartsContentMode = 'markdown';

  /** Text/reasoning rendering mode. Unsupported direct or attribute values normalize and reflect
   * as `markdown`, including when the current value is already `markdown`. */
  @property({ reflect: true, attribute: 'content-mode' })
  get contentMode(): MessagePartsContentMode {
    return this.contentModeValue;
  }
  set contentMode(value: MessagePartsContentMode) {
    const previous = this.contentModeValue;
    const normalized = normalizeMessagePartsContentMode(value);
    this.contentModeValue = normalized;
    // Lit suppresses reflection while it handles an attribute callback. Canonicalize unsupported
    // attribute text synchronously so an equal default value cannot leave a hostile token behind.
    if (
      typeof value === 'string' &&
      value !== normalized &&
      this.getAttribute('content-mode') !== normalized
    ) {
      this.setAttribute('content-mode', normalized);
    }
    this.requestUpdate('contentMode', previous, {
      reflect: true,
      hasChanged: () => true,
    });
  }

  /** Streaming Markdown render strategy. `plain` preserves the default raw-text streaming path. */
  @property({ reflect: true, attribute: 'streaming-render' })
  streamingRender: MarkdownStreamingRenderMode = 'plain';

  /** Shows localized language labels and copy controls for closed fenced code blocks. */
  @property({ type: Boolean, attribute: 'code-block-chrome' })
  codeBlockChrome = false;

  private toolDisplayValue: MessagePartsToolDisplay = 'chip';

  /** Tool calls render as the original chip/result pair by default; `disclosure` pairs results
   * by invocation id and puts them inside a collapsed inline disclosure. */
  @property({ reflect: true, attribute: 'tool-display' })
  get toolDisplay(): MessagePartsToolDisplay {
    return this.toolDisplayValue;
  }
  set toolDisplay(value: MessagePartsToolDisplay) {
    const previous = this.toolDisplayValue;
    const normalized = normalizeMessagePartsToolDisplay(value);
    this.toolDisplayValue = normalized;
    if (
      typeof value === 'string' &&
      value !== normalized &&
      this.getAttribute('tool-display') !== normalized
    ) {
      this.setAttribute('tool-display', normalized);
    }
    this.requestUpdate('toolDisplay', previous, {
      reflect: true,
      hasChanged: () => true,
    });
  }

  /** Include reasoning parts. */
  @property({
    type: Boolean,
    attribute: 'show-reasoning',
    reflect: true,
    converter: trueDefaultBooleanConverter,
  })
  showReasoning = true;

  /** Optional host renderer; see `MessagePartRenderer` for the full contract. Returning `undefined`
   *  delegates to the built-in renderer -- any other return fully replaces it, including that
   *  part's own interactive wiring (retry/citation/tool-call/widget events). */
  @property({ attribute: false }) renderPart?: MessagePartRenderer;

  /** `0` (the default) renders every part -- unbounded, matching every prior release. A positive
   *  value windows rendering to the newest N parts (host `parts` data is untouched); citation
   *  ranks are still computed against the full sequence first, so a badge's number stays stable
   *  even once an earlier citation rolls out of the rendered window. Opt in for a message that can
   *  grow an unusually large number of parts (e.g. a long agentic run with many interleaved
   *  tool-call/tool-result parts), where unbounded live DOM can visibly stall the main thread. */
  @property({ type: Number, attribute: 'max-rendered-parts' }) maxRenderedParts = 0;

  /** Accessible name override for the internal message-part group. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;
  private knownErrorIds = new Set<string>();
  @state() private openedToolCallIds = new Set<string>();
  private errorAnnouncementSink?: AnnouncementSink;
  private suppressNextErrorAnnouncement = true;

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.errorAnnouncementSink?.element.ownerDocument === this.ownerDocument) return;
    this.errorAnnouncementSink?.release();
    this.errorAnnouncementSink = acquireAnnouncementSink('assertive', {
      document: this.ownerDocument,
      source: this,
    });
    if (this.hasUpdated) {
      // A reconnect snapshots the current parts as history. This covers a parts write queued while
      // detached and prevents DOM reparenting from turning old errors into fresh alerts.
      this.suppressNextErrorAnnouncement = true;
      this.requestUpdate();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.errorAnnouncementSink?.release();
    this.errorAnnouncementSink = undefined;
    this.suppressNextErrorAnnouncement = true;
    this.openedToolCallIds = new Set();
  }

  private get effectiveParts(): readonly MessagePart[] {
    const seen = new Set<string>();
    return this.parts.filter((part) => {
      const id = part?.id;
      if (!isNonBlankIdentity(id) || seen.has(id)) return false;
      if (part.type === 'tool-call' && !isRecord(part.invocation)) return false;
      if (part.type === 'citation' && !isRecord(part.citation)) return false;
      if (part.type === 'attachment' && !isRecord(part.document)) return false;
      seen.add(id);
      return true;
    });
  }

  /** `maxRenderedParts`, normalized to a finite non-negative integer (falling back to the
   *  property's own default of `0`) -- a raw `NaN` (e.g. an invalid `max-rendered-parts`
   *  attribute) would otherwise make `maxRenderedParts > 0` always false, which happens to already
   *  match the "render all" fallback, but only by the same accidental-`NaN`-comparison quirk this
   *  guard exists to remove. */
  private get effectiveMaxRenderedParts(): number {
    return finiteCount(this.maxRenderedParts, 0);
  }

  /** `effectiveParts`, windowed to the newest `effectiveMaxRenderedParts` entries when that cap is
   *  positive. Never affects citation numbering -- ranks are always derived from the full
   *  `effectiveParts` sequence before this window is applied. */
  private get renderedParts(): readonly MessagePart[] {
    const parts = this.effectiveParts;
    const max = this.effectiveMaxRenderedParts;
    return max > 0 && parts.length > max ? parts.slice(-max) : parts;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (changed.has('parts')) {
      const callIds = new Set(
        this.effectiveParts
          .filter((part) => part.type === 'tool-call')
          .map((part) => part.invocation.id),
      );
      if ([...this.openedToolCallIds].some((id) => !callIds.has(id))) {
        this.openedToolCallIds = new Set([...this.openedToolCallIds].filter((id) => callIds.has(id)));
      }
    }
    if (!changed.has('parts')) return;
    const current = this.effectiveParts.filter((part) => part.type === 'error');
    // The `hasUpdated` half of this guard is a deliberate mount exclusion, not an oversight, and
    // deliberately carries no `announce` opt-in the way `<lr-callout>`/`<lr-empty>`/`<lr-table>` do:
    // the parts present at mount are one turn of an already-written transcript, replayed in
    // document order alongside every sibling turn, so speaking their errors would assertively
    // interrupt a user who is reading backwards through history. `<lr-transcript-feed>` and
    // `<lr-chat-viewport>` baseline their mount content for the same reason.
    if (this.hasUpdated && !this.suppressNextErrorAnnouncement) {
      for (const part of current) {
        if (!this.knownErrorIds.has(part.id)) {
          this.errorAnnouncementSink?.announce(part.message || this.localize('messagePartError'));
        }
      }
    }
    this.knownErrorIds = new Set(current.map((part) => part.id));
  }

  protected override updated(_changed: PropertyValues<this>): void {
    super.updated(_changed);
    this.suppressNextErrorAnnouncement = false;
  }

  private selectCitation(event: Event, part: CitationMessagePart): void {
    event.stopPropagation();
    this.emit('lr-citation-select', { citation: part.citation });
  }

  private onToolDetailsToggle(
    call: Extract<MessagePart, { type: 'tool-call' }>,
    event: CustomEvent<{ open: boolean }>,
  ): void {
    if (event.target !== event.currentTarget) return;
    const opened = new Set(this.openedToolCallIds);
    if (event.detail.open) opened.add(call.invocation.id);
    else opened.delete(call.invocation.id);
    this.openedToolCallIds = opened;
  }

  private toolStatusLabel(status: string): string {
    return this.localize(
      status === 'running' ? 'statusRunning'
        : status === 'success' ? 'statusSuccess'
        : status === 'error' ? 'statusError'
        : status === 'denied' ? 'statusDenied'
        : 'statusPending',
    );
  }

  private renderToolDisclosure(
    call: Extract<MessagePart, { type: 'tool-call' }>,
    result: Extract<MessagePart, { type: 'tool-result' }> | undefined,
  ): TemplateResult {
    const invocation = call.invocation;
    const opened = this.openedToolCallIds.has(invocation.id);
    const status = result
      ? ('error' in result ? 'error' : 'success')
      : invocation.status;
    const redactedFields = opened ? call.metadata?.['redactedFields'] : undefined;
    const hiddenValue = opened ? this.localize('envListValueHidden') : '';
    const args = opened
      ? redactToolField(invocation.args, 'args', redactedFields, hiddenValue)
      : undefined;
    const durationMs = call.metadata?.['durationMs'];
    const durationLabel = typeof durationMs === 'number' &&
      Number.isFinite(durationMs) && durationMs >= 0
      ? (() => {
          const unit = durationMs >= 1_000
            ? { value: durationMs / 1_000, digits: 1 }
            : { value: durationMs, digits: 0 };
          return html`<span part="tool-duration">${this.localize(durationMs >= 1_000 ? 'durationSeconds' : 'durationMilliseconds', undefined, {
            value: getNumberFormat(this.effectiveLocale, { maximumFractionDigits: unit.digits }).format(unit.value),
          })}</span>`;
        })()
      : nothing;
    const hasResultPayload = opened && result !== undefined && 'result' in result;
    const sourceResult = hasResultPayload && result ? result.result : undefined;
    const resultValue = sourceResult === undefined
      ? undefined
      : redactToolField(sourceResult, 'result', redactedFields, hiddenValue);
    const errorValue = opened && result && 'error' in result
      ? redactToolField(result.error, 'error', redactedFields, hiddenValue)
      : undefined;

    return html`<lr-details
      part="tool-disclosure"
      data-call-id=${invocation.id}
      .open=${opened}
      @lr-toggle=${(event: CustomEvent<{ open: boolean }>) => this.onToolDetailsToggle(call, event)}
    >
      <span slot="summary" part="tool-header">
        <span>${this.localize('toolTimelineDetailsFor', undefined, { name: invocation.name })}</span>
        <span part="tool-status" data-status=${status}>${this.toolStatusLabel(status)}</span>
        ${durationLabel}
      </span>
      ${opened
        ? html`<div part="tool-args">
            <lr-json-viewer .data=${args}></lr-json-viewer>
          </div>
          ${result
            ? html`<div part="tool-result">
                ${hasResultPayload
                  ? html`<lr-tool-result-view
                      .toolName=${result.name ?? invocation.name}
                      .args=${args}
                      .result=${resultValue}
                    ></lr-tool-result-view>`
                  : nothing}
                ${errorValue !== undefined ? html`<p part="tool-error">${errorValue}</p>` : nothing}
              </div>`
            : nothing}`
        : nothing}
    </lr-details>`;
  }

  private partNames(part: MessagePart): string {
    const parts = ['part'];
    switch (part.type) {
      case 'text':
        parts.push('text');
        break;
      case 'reasoning':
        parts.push('reasoning');
        break;
      case 'tool-call':
        parts.push('tool-call');
        break;
      case 'tool-result':
        parts.push('tool-result');
        break;
      case 'citation':
        parts.push('citation');
        break;
      case 'attachment':
        parts.push('attachment');
        break;
      case 'data':
        parts.push('data');
        break;
      case 'audio':
        parts.push('audio');
        break;
      case 'error':
        parts.push('error');
        break;
    }
    if (part.state === 'streaming') parts.push('part-streaming');
    return parts.join(' ');
  }

  private renderBuiltin(
    part: MessagePart,
    citationRank: number,
    pairedResult?: Extract<MessagePart, { type: 'tool-result' }>,
  ): unknown {
    switch (part.type) {
      case 'text':
        return this.contentMode === 'markdown'
          ? html`<lr-markdown
              exportparts="code-block,code-block-header,code-block-language,code-block-copy"
              .content=${part.text}
              .streaming=${part.state === 'streaming'}
              .streamingRender=${this.streamingRender}
              .codeBlockChrome=${this.codeBlockChrome}
            ></lr-markdown>`
          : part.text;
      case 'reasoning':
        return html`<lr-thinking-panel
          .label=${this.localize('thinkingPanelLabel')}
          .mode=${part.state === 'streaming' ? 'live' : 'post-hoc'}
          ?expanded=${part.collapsed === false}
          >${this.contentMode === 'markdown'
            ? html`<lr-markdown
                exportparts="code-block,code-block-header,code-block-language,code-block-copy"
                .content=${part.text}
                .streaming=${part.state === 'streaming'}
                .streamingRender=${this.streamingRender}
                .codeBlockChrome=${this.codeBlockChrome}
              ></lr-markdown>`
            : part.text}</lr-thinking-panel
        >`;
      case 'tool-call':
        if (this.toolDisplay === 'disclosure') return this.renderToolDisclosure(part, pairedResult);
        return html`<lr-tool-call-chip
          .callId=${part.invocation.id}
          .name=${part.invocation.name}
          .status=${part.invocation.status}
          .summary=${part.invocation.error ?? ''}
        ></lr-tool-call-chip>`;
      case 'tool-result':
        if ('error' in part) {
          return html`<div part="tool-result-error">
            <span>${part.error}</span>
            ${part.result !== undefined
              ? html`<lr-tool-result-view
                  .toolName=${part.name ?? ''}
                  .result=${part.result}
                ></lr-tool-result-view>`
              : nothing}
          </div>`;
        }
        return html`<lr-tool-result-view
          .toolName=${part.name ?? ''}
          .result=${part.result}
        ></lr-tool-result-view>`;
      case 'citation':
        return html`<lr-citation-badge
          .index=${citationRank}
          .sourceId=${part.citation.sourceId ?? ''}
          .label=${part.citation.label ?? ''}
          @lr-citation-activate=${(event: Event) => this.selectCitation(event, part)}
          >${part.citation.quote ?? nothing}</lr-citation-badge
        >`;
      case 'attachment':
        return html`<lr-attachment-chip
          .attachmentId=${part.document.id}
          .name=${part.document.name}
          .mimeType=${part.document.mimeType ?? ''}
          .previewSrc=${part.document.uri ?? ''}
          .previewable=${Boolean(part.document.uri)}
          .removable=${false}
          status="success"
          compact
        ></lr-attachment-chip>`;
      case 'data':
        return part.widget && typeof part.widget === 'object'
          ? html`<lr-widget-renderer .document=${{ version: '2', root: part.widget }}></lr-widget-renderer>`
          : html`<lr-json-viewer .data=${part.data}></lr-json-viewer>`;
      case 'audio': {
        const src = safeMediaSrc(part.src);
        return html`${src
          ? html`<audio part="audio-control" controls>
              <source src=${src} type=${part.mimeType || nothing} />
            </audio>`
          : nothing}
        ${part.transcript ? html`<p part="audio-transcript">${part.transcript}</p>` : nothing}`;
      }
      case 'error':
        return html`<span>${part.message || this.localize('messagePartError')}</span> ${part.retryable
            ? html`<lr-button
                part="retry"
                size="s"
                variant="neutral"
                aria-label=${this.localize('messagePartRetry')}
                @click=${() => this.emit('lr-part-retry', { part })}
                >${this.localize('retry')}</lr-button
              >`
            : nothing}`;
    }
  }

  private renderOne(
    part: MessagePart,
    citationRank: number,
    pairedResult?: Extract<MessagePart, { type: 'tool-result' }>,
    isPairedResult = false,
    customOutput?: unknown,
  ): TemplateResult | typeof nothing {
    if (part.type === 'reasoning' && !this.showReasoning) return nothing;
    if (isPairedResult) return nothing;
    return html`<div part=${this.partNames(part)} data-type=${part.type} data-state=${part.state ?? 'complete'}>
      ${customOutput === undefined ? this.renderBuiltin(part, citationRank, pairedResult) : customOutput}
    </div>`;
  }

  override render(): TemplateResult {
    const label = this.accessibleLabel ?? this.localize('messagePartsLabel');
    // Ranks are derived from the FULL sequence, before any rendering window is applied, so a
    // citation's number stays stable even once an earlier citation rolls out of view.
    const allParts = this.effectiveParts;
    const citationRanks = new Map<string, number>();
    let citationRank = 0;
    for (const part of allParts) {
      if (part.type === 'citation') citationRanks.set(part.id, ++citationRank);
    }
    const parts = this.renderedParts;
    const renderedPartIds = new Set(parts.map((part) => part.id));
    const customOutputs = new Map<string, unknown>();
    if (this.renderPart) {
      for (const [index, part] of parts.entries()) {
        if (part.type === 'reasoning' && !this.showReasoning) continue;
        customOutputs.set(part.id, this.renderPart(part, index));
      }
    }
    const pairedResults = new Map<string, Extract<MessagePart, { type: 'tool-result' }>>();
    const pairedResultPartIds = new Set<string>();
    if (this.toolDisplay === 'disclosure') {
      const effectiveCallParts = allParts.filter((part) => part.type === 'tool-call');
      const firstCallPartByInvocationId = new Map<string, string>();
      for (const call of effectiveCallParts) {
        if (
          renderedPartIds.has(call.id) &&
          customOutputs.get(call.id) === undefined &&
          !firstCallPartByInvocationId.has(call.invocation.id)
        ) {
          firstCallPartByInvocationId.set(call.invocation.id, call.id);
        }
      }
      const resultCandidates = this.renderPart ? parts : allParts;
      for (const part of resultCandidates) {
        if (
          part.type === 'tool-result' &&
          firstCallPartByInvocationId.has(part.invocationId) &&
          customOutputs.get(part.id) === undefined
        ) {
          const callPartId = firstCallPartByInvocationId.get(part.invocationId)!;
          if (pairedResults.has(callPartId)) continue;
          pairedResults.set(callPartId, part);
          pairedResultPartIds.add(part.id);
        }
      }
    }
    return html`<div part="base" role="group" aria-label=${label}>
      ${repeat(
        parts,
        (part) => part.id,
        (part) => this.renderOne(
          part,
          citationRanks.get(part.id) ?? 0,
          pairedResults.get(part.id),
          pairedResultPartIds.has(part.id),
          customOutputs.get(part.id),
        )
      )}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-message-parts': LyraMessageParts;
  }
}
