import { html, type TemplateResult } from 'lit';
import {
  StreamingTextRuntimeBase,
  type LyraStreamingTextEventMap as StreamingTextRuntimeEventMap,
} from './streaming-text-base.class.js';

export {
  looksLikeMarkdown,
  type LyraStreamingTextEventMap,
  type StreamingTextContentMode,
} from './streaming-text-base.class.js';

/** `<lr-streaming-text-core>`'s event surface. Identical to `<lr-streaming-text>`'s, because the
 *  two differ only in which Markdown element Markdown mode composes; it is named per tag so a
 *  consumer can annotate a handler against this element without reaching for its sibling's map. */
export interface LyraStreamingTextCoreEventMap extends StreamingTextRuntimeEventMap {}

/**
 * `<lr-streaming-text-core>` — a build-lean `<lr-streaming-text>` variant for a consumer whose
 * `languages` map already covers every fenced-code language it will ever stream, or who never
 * renders fenced code at all. Every capability is identical to `<lr-streaming-text>` -- token
 * coalescing, `contentMode` auto-detection, the blinking cursor, the `lr-content-settled` event,
 * and the full forwarded Markdown configuration surface (`tabSize`, `htmlMode`, `gfm`,
 * `linkTarget`, `internalLinkPrefix`, `headingOffset`, `highlightCode`, `headingAnchors`, `math`,
 * `maxHeight`) -- only which Markdown element Markdown mode composes differs: this variant
 * renders `<lr-markdown-core>` (`../markdown/markdown-core.js`) instead of `<lr-markdown>`, so this
 * component's own module never textually contains a reference to `<lr-markdown>`'s ~200-language
 * dynamic-import table. A fenced code block whose language isn't a key in `languages` always
 * renders the plain-text fallback here -- there is no default/full-table highlighter to fall back
 * to, mirroring `<lr-markdown-core>`'s own contract.
 *
 * @customElement lr-streaming-text-core
 * @event lr-content-settled - Fired after newly-coalesced content actually reaches the rendered
 *   DOM (plain-text mode only -- see `<lr-streaming-text>`'s class doc). `detail: null`.
 * @csspart base - The root container.
 * @csspart cursor - The blinking (or, under reduced motion, static) cursor bar. Only rendered while `streaming` is `true`.
 * @csspart content - Forwarded from the composed `<lr-markdown-core>` in Markdown mode -- the
 *   wrapper around its rendered (or plain-text fallback) output; respects `max-height`.
 * @csspart heading - Forwarded from the composed `<lr-markdown-core>` in Markdown mode -- every
 *   rendered `<h1>`–`<h6>` (shifted by `heading-offset`).
 * @csspart paragraph - Forwarded from the composed `<lr-markdown-core>` in Markdown mode -- every
 *   rendered `<p>`.
 * @csspart list - Forwarded from the composed `<lr-markdown-core>` in Markdown mode -- every
 *   rendered `<ul>`/`<ol>`.
 * @csspart code-block - Forwarded from the composed `<lr-markdown-core>` in Markdown mode -- every
 *   rendered fenced/indented `<pre>`.
 * @csspart code-block-header - Forwarded from `<lr-markdown-core>` when code-block-header is enabled.
 * @csspart code-block-language - Forwarded source language label in the code-block header.
 * @csspart code-block-copy - Forwarded native source-copy button in the code-block header.
 * @csspart inline-code - Forwarded from the composed `<lr-markdown-core>` in Markdown mode -- every
 *   rendered inline `<code>` span (backtick spans, not fenced blocks).
 * @csspart link - Forwarded from the composed `<lr-markdown-core>` in Markdown mode -- every
 *   rendered `<a>`.
 * @csspart table - Forwarded from the composed `<lr-markdown-core>` in Markdown mode -- every
 *   rendered `<table>`.
 * @csspart blockquote - Forwarded from the composed `<lr-markdown-core>` in Markdown mode -- every
 *   rendered `<blockquote>`.
 * @csspart img - Forwarded from the composed `<lr-markdown-core>` in Markdown mode -- every
 *   rendered `<img>`.
 * @csspart math - Forwarded from the composed `<lr-markdown-core>` in Markdown mode -- a rendered
 *   inline or block math span (`data-display="inline"|"block"`).
 * @cssprop [--lr-inline-cursor-width=var(--lr-size-0-125rem)] - Shared width of the inline cursor
 * bar (also its border radius).
 * @cssprop [--lr-inline-cursor-height=var(--lr-size-1em)] - Shared height of the inline cursor bar.
 * @csspart task-list - Forwarded from the composed Markdown element.
 * @csspart task-item - Forwarded from the composed Markdown element.
 * @csspart task-item-checked - Forwarded from the composed Markdown element.
 * @csspart task-checkbox - Forwarded from the composed Markdown element.
 * @csspart table-wrapper - Forwarded from the composed Markdown element.
 * @csspart code-block-frame - Forwarded code-header group.
 * @csspart code-block-copy-success - Forwarded successful copy state.
 * @csspart code-block-copy-error - Forwarded failed copy state.
 * @event lr-copy - Passthrough successful Markdown source-copy outcome.
 * @event lr-copy-error - Passthrough failed Markdown source-copy outcome.
 * @csspart streaming-tail - The current uncommitted text during progressive streaming.
 * @status experimental
 * @since 16.0.0
 */
export class LyraStreamingTextCore extends StreamingTextRuntimeBase {
  protected override renderMarkdown(): TemplateResult {
    // lr-markdown-core's own lr-content-settled is deliberately left unstopped here -- see the
    // shared base's updated() comment -- so it bubbles straight out through this element.
    // exportparts forwards lr-markdown-core's own documented part vocabulary (verified against its
    // class JSDoc) up through this element's shadow boundary -- see this class's own @csspart list
    // above. Every listed name is reused verbatim (no aliasing) since none collides with this
    // element's own base/cursor parts.
    return html`<lr-markdown-core
      exportparts="content, heading, paragraph, list, code-block, code-block-header, code-block-language, code-block-copy, inline-code, link, table, blockquote, img, math, task-list, task-item, task-item-checked, task-checkbox, table-wrapper, code-block-frame, code-block-copy-success, code-block-copy-error, streaming-tail"
      .content=${this.displayedContent}
      .streaming=${this.streaming}
      .streamingRender=${this.streamingRender}
      .codeBlockChrome=${this.codeBlockChrome}
      .codeBlockHeader=${this.codeBlockHeader}
      .languages=${this.languages ?? {}}
      .tabSize=${this.tabSize}
      .htmlMode=${this.htmlMode}
      .gfm=${this.gfm}
      .linkTarget=${this.linkTarget}
      .internalLinkPrefix=${this.internalLinkPrefix}
      .headingOffset=${this.headingOffset}
      .highlightCode=${this.highlightCode}
      .headingAnchors=${this.headingAnchors}
      .math=${this.math}
      .maxHeight=${this.maxHeight}
      @lr-render-error=${this.stopOwnedEvent}
      @lr-link-click=${this.stopOwnedEvent}
      @lr-highlight-activate=${this.stopOwnedEvent}
      @lr-text-select=${this.stopOwnedEvent}
      @lr-anchor-result=${this.stopOwnedEvent}
    ></lr-markdown-core>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-streaming-text-core': LyraStreamingTextCore;
  }
}
