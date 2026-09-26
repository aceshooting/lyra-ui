import type { MarkdownStreamingRender } from '../markdown/markdown-shared.js';
import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import type {
  CitationMessagePart,
  CitationSelectEventDetail,
  MessagePart,
  ToolCallMessagePart,
  ToolInvocation,
  ToolResultMessagePart,
} from '../../../ai/types.js';
import type {
  LyraThinkingPanelEventMap,
  ThinkingPanelToggleDetail,
} from '../../agent-tools/thinking-panel/thinking-panel.class.js';
import type {
  LyraToolCallBlockEventMap,
  ToolCallBlockRenderErrorDetail,
  ToolCallBlockToggleDetail,
} from '../../agent-tools/tool-call-block/tool-call-block.class.js';
import type { LyraToolStatus } from '../../../internal/shared-unions.js';
import { isToolCallStatus } from '../../agent-tools/tool-status.js';
import {
  projectedRedactionFields,
  redactToolDetail,
  TOO_MANY_REDACTION_PATHS,
  type RedactedToolDetail,
} from '../../agent-tools/tool-redaction.js';
import type { LyraToolCallChipEventMap } from '../../agent-tools/tool-call-chip/tool-call-chip.class.js';
import type { LyraToolResultViewEventMap } from '../../agent-tools/tool-result-view/tool-result-view.class.js';
import type { LyraAttachmentChipEventMap } from '../../media/attachment-chip/attachment-chip.class.js';
import type { LyraCitationBadgeEventMap } from '../../retrieval/citation-badge/citation-badge.class.js';
import type { LyraJsonViewerEventMap } from '../../utility/json-viewer/json-viewer.class.js';
import { literalSetConverter, trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { finiteCount } from '../../../internal/numbers.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { safeMediaSrc } from '../../../internal/safe-url.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
import type { LyraMarkdownEventMap } from '../markdown/markdown.class.js';
import type { LyraWidgetRendererEventMap } from '../widget-renderer/widget-renderer.class.js';
import { isNonBlankIdentity, isRecord } from '../../retrieval/retrieval-identity.js';
import { styles } from './message-parts.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_envListValueHidden, LYRA_DEFAULT_messagePartError, LYRA_DEFAULT_messagePartRetry, LYRA_DEFAULT_messagePartsLabel, LYRA_DEFAULT_retry, LYRA_DEFAULT_thinkingPanelLabel } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/**
 * Host override for how one message part renders. Returning `undefined` delegates that part
 * entirely to the built-in renderer, keeping every built-in affordance intact. Returning any other
 * value fully REPLACES the built-in rendering for that part -- not just its visual content but
 * every interactive affordance and event the built-in renderer would otherwise wire up for that
 * part type: the `error` part's retry button (`lr-part-retry`), a `citation` part's activation
 * (`lr-citation-select`), and the composed children's own events for `tool-call`
 * (`<lr-tool-call-chip>`'s `lr-tool-call-chip-select`, or `<lr-tool-call-block>`'s `lr-toggle` in
 * `tool-display="block"`), `tool-result`/`attachment`
 * (`<lr-tool-result-view>`/`<lr-attachment-chip>`'s preview surface) and `data`
 * (`<lr-widget-renderer>`'s `lr-widget-action`/`lr-widget-state-change`). A host overriding an
 * interactive part type must reimplement whatever of that interaction it still wants.
 *
 * It is called exactly once per rendered part, in order, in both tool displays. In
 * `tool-display="block"` a custom-rendered `tool-call` is never paired, so its `tool-result` still
 * renders on its own; a custom-rendered `tool-result` is never folded, and the call's block shows
 * the invocation's own `result` instead. Output returned from here is the host's own and is never
 * masked by an invocation's `redactedFields`.
 */
export type MessagePartRenderer = (part: MessagePart, index: number) => unknown;

/** Rendering mode for text and reasoning message parts. */
export type MessagePartsContentMode = 'plain' | 'markdown';

const MESSAGE_PARTS_CONTENT_MODES = Object.freeze(['plain', 'markdown'] as const);

/** How `tool-call`/`tool-result` parts render: `chip` (a tool-call chip plus a separate result
 *  view) or `block` (each call paired with its result in one inline `<lr-tool-call-block>`). */
export type MessagePartsToolDisplay = 'chip' | 'block';

const MESSAGE_PARTS_TOOL_DISPLAY = literalSetConverter<MessagePartsToolDisplay>(['chip', 'block'], 'chip');

/** Identity-stable empty path list, so a block's owned `redactedFields` never re-snapshots. */
const EMPTY_REDACTED_FIELDS: readonly string[] = Object.freeze([]);

const TOOL_BLOCK_EXPORTPARTS =
  'header:tool-block-header, body:tool-block-body, args:tool-block-args, result:tool-block-result, error:tool-block-error';

/** A block's status from its call and (optional) paired result part. */
function resolveBlockStatus(invocation: ToolInvocation, result?: ToolResultMessagePart): LyraToolStatus {
  const status = isToolCallStatus(invocation.status) ? invocation.status : 'pending';
  if (status === 'denied') return 'denied';
  if (status === 'error' || (result && 'error' in result)) return 'error';
  if (result && result.state === 'streaming') return 'running';
  if (result) return 'success';
  return status;
}

/** Mirrors `<lr-tool-timeline>`'s duration derivation. */
function invocationDuration(invocation: ToolInvocation): number | undefined {
  if (invocation.startedAt == null || invocation.endedAt == null) return undefined;
  const diff = invocation.endedAt - invocation.startedAt;
  return Number.isFinite(diff) ? diff : undefined;
}

/** One render pass's tool pairing (block display only). */
interface ToolPairing {
  readonly custom: ReadonlyMap<string, unknown>;
  readonly results: ReadonlyMap<string, ToolResultMessagePart>;
  readonly folded: ReadonlySet<string>;
}

function normalizeMessagePartsContentMode(value: unknown): MessagePartsContentMode {
  return typeof value === 'string' &&
    MESSAGE_PARTS_CONTENT_MODES.includes(value as MessagePartsContentMode)
    ? value as MessagePartsContentMode
    : 'markdown';
}

export interface LyraMessagePartsEventMap
  extends Omit<LyraMarkdownEventMap, 'lr-render-error'>,
    Omit<LyraThinkingPanelEventMap, 'lr-toggle'>,
    Omit<LyraToolCallBlockEventMap, 'lr-toggle' | 'lr-render-error'>,
    LyraToolCallChipEventMap,
    Omit<LyraToolResultViewEventMap, 'lr-render-error'>,
    LyraAttachmentChipEventMap,
    Omit<LyraCitationBadgeEventMap, 'lr-citation-activate'>,
    LyraJsonViewerEventMap,
    Omit<LyraWidgetRendererEventMap, 'lr-render-error'> {
  'lr-citation-select': CustomEvent<LyraEventDetailSnapshot<CitationSelectEventDetail>>;
  'lr-part-retry': CustomEvent<LyraEventDetailSnapshot<{ part: MessagePart }>>;
  'lr-toggle': CustomEvent<ThinkingPanelToggleDetail | ToolCallBlockToggleDetail>;
  'lr-render-error': CustomEvent<
    { error: unknown } | { toolName: string; error: unknown } | ToolCallBlockRenderErrorDetail
  >;
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
 * With the default `streaming-render="plain"`, streaming text and reasoning show accumulated
 * plain text and Markdown parsing and syntax highlighting wait until that part completes;
 * `streaming-render="progressive"` renders each settled top-level block as Markdown while the
 * part is still streaming.
 *
 * Citation ranks are derived in one linear render prepass, including for mixed streaming arrays.
 *
 * `tool-display="block"` pairs each `tool-call` part with the first `tool-result` part carrying its
 * invocation id and renders the pair through one collapsed `<lr-tool-call-block>` at the call's
 * position; the folded result part renders nothing (it still counts toward `max-rendered-parts`).
 * The block shows a running state until the result arrives, and reads its duration from the
 * invocation's `startedAt`/`endedAt`. An invocation's `redactedFields` masks every built-in
 * rendering of its payload in either display: the block's details, the chip's summary, and a
 * standalone result part's result and error.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * Direction: built-in text and reasoning parts inherit `<lr-markdown>`'s code direction, so code
 * reads left-to-right inside a right-to-left document. This element forwards no Markdown part,
 * so that nested code direction cannot be overridden with `::part()` from outside.
 *
 * @customElement lr-message-parts
 * @event lr-citation-select - A citation part was activated. `detail: { citation }`.
 * @event lr-part-retry - Retry was requested for a retryable error part. `detail: { part }`.
 * @event lr-toggle - Passthrough from a rendered reasoning panel or tool-call block.
 * @event lr-tool-call-chip-select - Passthrough from a rendered tool-call chip. The
 * `lr-tool-chip-select` alias it replaced was removed in 9.0.0.
 * @event lr-render-error - Passthrough from rendered Markdown, tool-result, or widget content, or
 * tool-call block (`callId` included).
 * @event lr-link-click - Passthrough from rendered Markdown.
 * @event lr-highlight-activate - Passthrough from rendered Markdown.
 * @event lr-text-select - Passthrough from rendered Markdown.
 * @event lr-anchor-result - Passthrough from rendered Markdown.
 * @event lr-preview-request - Passthrough from a rendered attachment. Not cancelable since 10.0.0.
 * @event lr-retry - Passthrough from a rendered attachment.
 * @event lr-remove - Passthrough from a rendered attachment.
 * @event lr-citation-open - Passthrough from a rendered citation's full-preview action.
 * @event lr-copy - Passthrough from rendered JSON content or a Markdown code-block header.
 * @event lr-copy-error - Passthrough from rendered JSON content or a Markdown code-block header.
 * @event lr-search-change - Passthrough from rendered JSON content.
 * @event lr-widget-action - Passthrough from a rendered declarative widget.
 * @event lr-widget-state-change - Passthrough from a rendered controlled widget.
 * @csspart base - The ordered message-part list.
 * @csspart part - Every rendered part wrapper.
 * @csspart part-streaming - Additional part name on a streaming part.
 * @csspart text - A text part.
 * @csspart reasoning - A reasoning part.
 * @csspart tool-call - A tool-call part.
 * @csspart tool-result - A tool-result part.
 * @csspart tool-result-error - Error copy for a failed tool-result part.
 * @csspart tool-block-header - A tool-call block's disclosure button (`tool-display="block"`).
 * @csspart tool-block-body - A tool-call block's disclosed region (`tool-display="block"`).
 * @csspart tool-block-args - A tool-call block's arguments section (`tool-display="block"`).
 * @csspart tool-block-result - A tool-call block's result section (`tool-display="block"`).
 * @csspart tool-block-error - A tool-call block's error section (`tool-display="block"`).
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
    envListValueHidden: LYRA_DEFAULT_envListValueHidden,
    messagePartError: LYRA_DEFAULT_messagePartError,
    messagePartRetry: LYRA_DEFAULT_messagePartRetry,
    messagePartsLabel: LYRA_DEFAULT_messagePartsLabel,
    retry: LYRA_DEFAULT_retry,
    thinkingPanelLabel: LYRA_DEFAULT_thinkingPanelLabel,
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

  private toolDisplayValue: MessagePartsToolDisplay = 'chip';

  /** How tool parts render. `chip` (the default) keeps a tool-call chip plus a separate result
   *  view; `block` pairs each call with its result in one collapsed `<lr-tool-call-block>`.
   *  Unsupported values normalize and reflect as `chip`, and the default reflects too. */
  @property({ reflect: true, attribute: 'tool-display', converter: MESSAGE_PARTS_TOOL_DISPLAY })
  get toolDisplay(): MessagePartsToolDisplay {
    return this.toolDisplayValue;
  }
  set toolDisplay(value: MessagePartsToolDisplay) {
    const normalized = MESSAGE_PARTS_TOOL_DISPLAY.normalizeReflected(this, 'tool-display', value);
    const previous = this.toolDisplayValue;
    if (previous === normalized) return;
    this.toolDisplayValue = normalized;
    this.requestUpdate('toolDisplay', previous);
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

  /** Rendering mode forwarded to built-in text and reasoning Markdown parts. */
  @property({ attribute: 'streaming-render' }) streamingRender: MarkdownStreamingRender = 'plain';
  /** Adds source-copy headers to built-in text and reasoning Markdown parts. Custom renderers replace this surface. */
  @property({ type: Boolean, attribute: 'code-block-header' }) codeBlockHeader = false;
  /** Compatibility spelling for enabling built-in Markdown code headers. */
  @property({ type: Boolean, attribute: 'code-block-chrome' }) codeBlockChrome = false;


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
  /** First tool-call's projected `redactedFields` per invocation id; only non-empty entries. */
  private redactionByInvocation = new Map<string, readonly unknown[]>();
  private redactionMemo = new WeakMap<MessagePart, RedactedToolDetail>();
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
    if (!changed.has('parts') && this.hasUpdated) return;
    this.redactionByInvocation = this.projectRedactions();
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

  /** Pure data (no DOM), so it is safe on the server. Scans every part, not the rendered window,
   *  so a windowed-out call still masks its standalone result. */
  private projectRedactions(): Map<string, readonly unknown[]> {
    const map = new Map<string, readonly unknown[]>();
    const seen = new Set<string>();
    for (const part of this.effectiveParts) {
      if (part.type !== 'tool-call') continue;
      const id = part.invocation.id;
      if (typeof id !== 'string' || seen.has(id)) continue;
      seen.add(id);
      const paths = projectedRedactionFields(part.invocation.redactedFields) ?? TOO_MANY_REDACTION_PATHS;
      if (paths.length > 0) map.set(id, paths);
    }
    return map;
  }

  /** The masked payloads for `part` under its invocation's paths, or `undefined` when nothing is
   *  masked -- then every binding keeps the original reference. */
  private redacted(
    part: MessagePart,
    invocationId: unknown,
    source: { args: unknown; result: unknown; error: unknown },
  ): RedactedToolDetail | undefined {
    if (typeof invocationId !== 'string') return undefined;
    const paths = this.redactionByInvocation.get(invocationId);
    if (!paths) return undefined;
    const detail = redactToolDetail(source, paths, this.localize('envListValueHidden'), this.redactionMemo.get(part));
    this.redactionMemo.set(part, detail);
    return detail;
  }

  protected override updated(_changed: PropertyValues<this>): void {
    super.updated(_changed);
    this.suppressNextErrorAnnouncement = false;
  }

  private selectCitation(event: Event, part: CitationMessagePart): void {
    event.stopPropagation();
    this.emit('lr-citation-select', { citation: part.citation });
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

  private renderToolBlock(part: ToolCallMessagePart, paired?: ToolResultMessagePart): TemplateResult {
    const invocation = part.invocation;
    const result = paired ? paired.result : invocation.result;
    const error = paired && 'error' in paired ? paired.error : invocation.error;
    // The invocation-level paths (from its first tool-call part), not this part's own list: a later
    // call part for the same invocation must not render a payload the first one promised to mask,
    // exactly as the chip display and standalone results already resolve it.
    const redactedFields =
      (this.redactionByInvocation.get(invocation.id) as readonly string[] | undefined) ?? EMPTY_REDACTED_FIELDS;
    // Property bindings only (plus the `status` attribute): an attribute named `callId` would not
    // reach the `call-id` attribute. `expanded` is never bound, so the block keeps its own state.
    return html`<lr-tool-call-block
      .name=${invocation.name}
      .callId=${invocation.id}
      .args=${invocation.args}
      status=${resolveBlockStatus(invocation, paired)}
      .result=${result}
      .error=${error}
      .durationMs=${invocationDuration(invocation)}
      .redactedFields=${redactedFields}
      exportparts=${TOOL_BLOCK_EXPORTPARTS}
    ></lr-tool-call-block>`;
  }

  /** Block display only: which results fold into which calls. First call per non-blank id, first
   *  result per call, and nothing custom-rendered on either side. */
  private pairTools(parts: readonly MessagePart[], custom: ReadonlyMap<string, unknown>): ToolPairing {
    const calls = new Map<string, string>();
    for (const part of parts) {
      if (part.type !== 'tool-call' || custom.has(part.id)) continue;
      const id = part.invocation.id;
      if (isNonBlankIdentity(id) && !calls.has(id)) calls.set(id, part.id);
    }
    const results = new Map<string, ToolResultMessagePart>();
    const folded = new Set<string>();
    for (const part of parts) {
      if (part.type !== 'tool-result' || custom.has(part.id)) continue;
      const id = part.invocationId;
      if (!isNonBlankIdentity(id)) continue;
      const callPartId = calls.get(id);
      if (callPartId === undefined || results.has(callPartId)) continue;
      results.set(callPartId, part);
      folded.add(part.id);
    }
    return { custom, results, folded };
  }

  private renderPartMarkdown(part: Extract<MessagePart, { type: 'text' | 'reasoning' }>): TemplateResult {
    return html`<lr-markdown .content=${part.text} .streaming=${part.state === 'streaming'}
      .streamingRender=${this.streamingRender} .codeBlockHeader=${this.codeBlockHeader}
      .codeBlockChrome=${this.codeBlockChrome}></lr-markdown>`;
  }

  private renderBuiltin(part: MessagePart, citationRank: number, pairing?: ToolPairing): unknown {
    switch (part.type) {
      case 'text':
        return this.contentMode === 'markdown'
          ? this.renderPartMarkdown(part)
          : part.text;
      case 'reasoning':
        return html`<lr-thinking-panel
          .label=${this.localize('thinkingPanelLabel')}
          .mode=${part.state === 'streaming' ? 'live' : 'post-hoc'}
          ?expanded=${part.collapsed === false}
          >${this.contentMode === 'markdown'
            ? this.renderPartMarkdown(part)
            : part.text}</lr-thinking-panel
        >`;
      case 'tool-call': {
        if (this.toolDisplay === 'block') return this.renderToolBlock(part, pairing?.results.get(part.id));
        const masked = this.redacted(part, part.invocation.id, {
          args: undefined,
          result: undefined,
          error: part.invocation.error,
        });
        const summary = masked ? masked.error : part.invocation.error;
        return html`<lr-tool-call-chip
          .callId=${part.invocation.id}
          .name=${part.invocation.name}
          .status=${part.invocation.status}
          .summary=${summary ?? ''}
        ></lr-tool-call-chip>`;
      }
      case 'tool-result': {
        const hasError = 'error' in part;
        const masked = this.redacted(part, part.invocationId, {
          args: undefined,
          result: part.result,
          error: hasError ? part.error : undefined,
        });
        const result = masked ? masked.result : part.result;
        if (hasError) {
          return html`<div part="tool-result-error">
            <span>${masked ? masked.error : part.error}</span>
            ${part.result !== undefined
              ? html`<lr-tool-result-view
                  .toolName=${part.name ?? ''}
                  .result=${result}
                ></lr-tool-result-view>`
              : nothing}
          </div>`;
        }
        return html`<lr-tool-result-view
          .toolName=${part.name ?? ''}
          .result=${result}
        ></lr-tool-result-view>`;
      }
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
    custom: ReadonlyMap<string, unknown>,
    pairing?: ToolPairing,
  ): TemplateResult | typeof nothing {
    if (part.type === 'reasoning' && !this.showReasoning) return nothing;
    if (pairing?.folded.has(part.id)) return nothing;
    return html`<div part=${this.partNames(part)} data-type=${part.type} data-state=${part.state ?? 'complete'}
      >${custom.has(part.id) ? custom.get(part.id) : this.renderBuiltin(part, citationRank, pairing)}</div>`;
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
    // One `renderPart` call per rendered part, in order, before anything renders: block display
    // needs to know which parts are custom before it can pair calls with results.
    const custom = new Map<string, unknown>();
    if (this.renderPart) {
      parts.forEach((part, index) => {
        if (part.type === 'reasoning' && !this.showReasoning) return;
        const rendered = this.renderPart?.(part, index);
        if (rendered !== undefined) custom.set(part.id, rendered);
      });
    }
    const pairing = this.toolDisplay === 'block' ? this.pairTools(parts, custom) : undefined;
    return html`<div part="base" role="group" aria-label=${label}>
      ${repeat(
        parts,
        (part) => part.id,
        (part) => this.renderOne(part, citationRanks.get(part.id) ?? 0, custom, pairing)
      )}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-message-parts': LyraMessageParts;
  }
}
