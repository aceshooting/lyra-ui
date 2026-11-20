import { noChange, type TemplateResult } from 'lit';
import { unsafeStatic } from 'lit/static-html.js';
import { tag } from '../../../internal/prefix.js';
import { property } from 'lit/decorators.js';
import {
  StreamingTextRuntimeBase,
  type LyraStreamingTextEventMap as StreamingTextRuntimeEventMap,
} from './streaming-text-base.class.js';

const markdownElement = unsafeStatic(tag('markdown-core'));

export {
  looksLikeMarkdown,
  type LyraStreamingTextEventMap,
  type StreamingTextContentMode,
} from './streaming-text-base.class.js';

/** Stable identity for the no-languages case, so the composed Markdown keeps its highlight state across renders. */
const EMPTY_LANGUAGES: Readonly<Record<string, never>> = Object.freeze({});

/** `<lr-streaming-text-core>`'s event surface. Identical to `<lr-streaming-text>`'s, because the
 *  two differ only in which Markdown element Markdown mode composes; it is named per tag so a
 *  consumer can annotate a handler against this element without reaching for its sibling's map. */
export interface LyraStreamingTextCoreEventMap extends StreamingTextRuntimeEventMap {}

/**
 * `<lr-streaming-text-core>` — a build-lean `<lr-streaming-text>` variant for a consumer whose
 * `languages` map already covers every fenced-code language it will ever stream, or who never
 * renders fenced code at all. Every capability is identical to `<lr-streaming-text>` -- token
 * coalescing, `contentMode` auto-detection, the blinking cursor, the `lr-content-settled` event,
 * and the full forwarded Markdown configuration surface (`tabSize`, `htmlMode`, `withoutGfm`, `withoutImages`,
 * `linkTarget`, `linkSchemes`, `internalLinkPrefix`, `headingOffset`, `withoutSyntaxHighlighting`, `headingAnchors`, `math`,
 * `maxHeight`) -- only which Markdown element Markdown mode composes differs: this variant
 * renders `<lr-markdown-core>` (`../../lr-markdown-core.js`) instead of `<lr-markdown>`, so this
 * component's own module never textually contains a reference to `<lr-markdown>`'s ~200-language
 * dynamic-import table. A fenced code block whose language isn't a key in `languages` always
 * renders the plain-text fallback here -- there is no default/full-table highlighter to fall back
 * to, mirroring `<lr-markdown-core>`'s own contract.
 *
 * Direction: Markdown mode inherits the composed Markdown element's code direction (code reads
 * left-to-right inside a right-to-left document; see that element's docs), and the forwarded
 * `code-block`/`inline-code` parts accept an outer `direction` override. Plain mode, including
 * a fenced block shown as plain text, uses the content's first strong character for direction.
 *
 * @customElement lr-streaming-text-core
 * @event lr-content-settled - Fired after newly-coalesced content actually reaches the rendered
 *   DOM (plain-text mode only -- see `<lr-streaming-text>`'s class doc). `detail: null`.
 * @event lr-link-activate - Passthrough from composed Markdown when a rendered link matches
 *   `internal-link-prefix`; navigation is prevented and `detail: { href }` carries the raw URL.
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
 * @event lr-render-error - Markdown rendering failed. Detail contains the original error.
 * @event lr-copy - Passthrough successful Markdown source-copy outcome.
 * @event lr-copy-error - Passthrough failed Markdown source-copy outcome.
 * @csspart streaming-tail - The current uncommitted text during progressive streaming.
 * @status experimental
 * @since 16.0.0
 */
export class LyraStreamingTextCore extends StreamingTextRuntimeBase {
  /** Enables source-copy headers in the composed `<lr-markdown-core>`. */
  @property({ type: Boolean, attribute: 'code-block-header' }) override codeBlockHeader = false;

  protected override renderMarkdown(): TemplateResult {
    return this.renderMarkdownElement(markdownElement, this.markdownLanguages ?? EMPTY_LANGUAGES, noChange);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-streaming-text-core': LyraStreamingTextCore;
  }
}
