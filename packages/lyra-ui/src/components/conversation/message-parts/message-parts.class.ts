import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import type {
  CitationMessagePart,
  CitationSelectEventDetail,
  MessagePart,
} from '../../../ai/types.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { safeMediaSrc } from '../../../internal/safe-url.js';
import '../../agent-tools/thinking-panel/thinking-panel.js';
import '../../agent-tools/tool-call-chip/tool-call-chip.js';
import '../../agent-tools/tool-result-view/tool-result-view.js';
import '../../forms/button/button.js';
import '../../media/attachment-chip/attachment-chip.js';
import '../../retrieval/citation-badge/citation-badge.js';
import '../../utility/json-viewer/json-viewer.js';
import '../markdown/markdown.js';
import '../widget-renderer/widget-renderer.js';
import { styles } from './message-parts.styles.js';

export type MessagePartRenderer = (part: MessagePart, index: number) => unknown;

export interface LyraMessagePartsEventMap {
  'lr-citation-select': CustomEvent<CitationSelectEventDetail>;
  'lr-part-retry': CustomEvent<{ part: MessagePart }>;
}

/**
 * `<lr-message-parts>` — renders ordered, interleavable provider-neutral AI message parts. It
 * composes Lyra's existing Markdown, reasoning, tool, citation, attachment, widget, JSON, and
 * media primitives while keeping streaming order stable by part id.
 *
 * @customElement lr-message-parts
 * @event lr-citation-select - A citation part was activated. `detail: { citation }`.
 * @event lr-part-retry - Retry was requested for a retryable error part. `detail: { part }`.
 * @csspart base - The ordered message-part list.
 * @csspart part - Every rendered part wrapper.
 * @csspart part-streaming - Additional part name on a streaming part.
 * @csspart text - A text part.
 * @csspart reasoning - A reasoning part.
 * @csspart tool-call - A tool-call part.
 * @csspart tool-result - A tool-result part.
 * @csspart citation - A citation part.
 * @csspart attachment - An attachment part.
 * @csspart data - A data or widget part.
 * @csspart audio - An audio part.
 * @csspart audio-transcript - An audio part's transcript.
 * @csspart error - An error part.
 * @csspart retry - A retryable error part's action.
 */
export class LyraMessageParts extends LyraElement<LyraMessagePartsEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** Ordered message content. */
  @property({ attribute: false }) parts: MessagePart[] = [];

  /** Render text parts as sanitized Markdown; `false` renders plain text. */
  @property({
    type: Boolean,
    attribute: 'render-markdown',
    reflect: true,
    converter: trueDefaultBooleanConverter,
  })
  renderMarkdown = true;

  /** Include reasoning parts. */
  @property({
    type: Boolean,
    attribute: 'show-reasoning',
    reflect: true,
    converter: trueDefaultBooleanConverter,
  })
  showReasoning = true;

  /** Optional host renderer. Returning `undefined` delegates to the built-in renderer. */
  @property({ attribute: false }) renderPart?: MessagePartRenderer;

  @property() label = '';
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  private citationIndex(index: number): number {
    return this.parts.slice(0, index + 1).filter((part) => part.type === 'citation').length;
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

  private renderBuiltin(part: MessagePart, index: number): unknown {
    switch (part.type) {
      case 'text':
        return this.renderMarkdown
          ? html`<lr-markdown .content=${part.text}></lr-markdown>`
          : part.text;
      case 'reasoning':
        return html`<lr-thinking-panel
          .label=${this.localize('thinkingPanelLabel')}
          .mode=${part.state === 'streaming' ? 'live' : 'post-hoc'}
          ?expanded=${part.collapsed === false}
        >${this.renderMarkdown ? html`<lr-markdown .content=${part.text}></lr-markdown>` : part.text}</lr-thinking-panel>`;
      case 'tool-call':
        return html`<lr-tool-call-chip
          .callId=${part.invocation.id}
          .name=${part.invocation.name}
          .status=${part.invocation.status}
          .summary=${part.invocation.error ?? ''}
        ></lr-tool-call-chip>`;
      case 'tool-result':
        return html`<lr-tool-result-view
          .toolName=${part.name ?? ''}
          .result=${part.result ?? part.error ?? null}
          .status=${part.error ? 'error' : 'success'}
        ></lr-tool-result-view>`;
      case 'citation':
        return html`<lr-citation-badge
          .index=${this.citationIndex(index)}
          .sourceId=${part.citation.sourceId ?? ''}
          .label=${part.citation.label ?? ''}
          @lr-citation-activate=${(event: Event) => this.selectCitation(event, part)}
        >${part.citation.quote ?? nothing}</lr-citation-badge>`;
      case 'attachment':
        return html`<lr-attachment-chip
          .id=${part.document.id}
          .name=${part.document.name}
          .mimeType=${part.document.mimeType ?? ''}
          .previewSrc=${part.document.uri ?? ''}
          .previewable=${Boolean(part.document.uri)}
          .removable=${false}
          status="done"
          compact
        ></lr-attachment-chip>`;
      case 'data':
        return part.widget && typeof part.widget === 'object'
          ? html`<lr-widget-renderer .tree=${part.widget}></lr-widget-renderer>`
          : html`<lr-json-viewer .data=${part.data}></lr-json-viewer>`;
      case 'audio': {
        const src = safeMediaSrc(part.src);
        return html`${src ? html`<audio part="audio" controls src=${src}></audio>` : nothing}
          ${part.transcript ? html`<p part="audio-transcript">${part.transcript}</p>` : nothing}`;
      }
      case 'error':
        return html`<span>${part.message || this.localize('messagePartError')}</span>
          ${part.retryable
            ? html`<lr-button
                part="retry"
                size="s"
                variant="neutral"
                aria-label=${this.localize('messagePartRetry')}
                @click=${() => this.emit('lr-part-retry', { part })}
              >${this.localize('retry')}</lr-button>`
            : nothing}`;
    }
  }

  private renderOne(part: MessagePart, index: number): TemplateResult | typeof nothing {
    if (part.type === 'reasoning' && !this.showReasoning) return nothing;
    const custom = this.renderPart?.(part, index);
    return html`<div
      part=${this.partNames(part)}
      data-type=${part.type}
      data-state=${part.state ?? 'complete'}
      role=${part.type === 'error' ? 'alert' : nothing}
    >${custom === undefined ? this.renderBuiltin(part, index) : custom}</div>`;
  }

  override render(): TemplateResult {
    const label = this.accessibleLabel || this.label || this.localize('messagePartsLabel');
    return html`<div part="base" role="group" aria-label=${label}>
      ${repeat(this.parts, (part) => part.id, (part, index) => this.renderOne(part, index))}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-message-parts': LyraMessageParts;
  }
}
