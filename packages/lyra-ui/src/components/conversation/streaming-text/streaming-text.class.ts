import { html, type TemplateResult } from 'lit';
import { StreamingTextRuntimeBase } from './streaming-text-base.class.js';

export {
  looksLikeMarkdown,
  type LyraStreamingTextEventMap,
  type StreamingTextContentMode,
} from './streaming-text-base.class.js';

/**
 * `<lr-streaming-text>` — a token-coalescing incremental text renderer for
 * streaming assistant output, with an optional blinking cursor and
 * auto-detected Markdown rendering.
 *
 * The host is expected to assign the *entire* current text on every update
 * to `content`, not a delta -- this component does no accumulation or
 * ordering of its own. That matches how most streaming-UI state (SSE/
 * WebSocket token accumulation into a growing string in application state)
 * is already managed.
 *
 * Token-by-token streaming can update `content` far faster than a human can
 * usefully perceive a re-render -- dozens of times a second for a fast
 * model. Re-rendering on every single assignment thrashes layout for no
 * visible benefit, so updates funnel through `Announcer`
 * (`../../internal/announcer.js`), reused here purely as the generic
 * "coalesce rapid calls, flush the latest" timing primitive its own class
 * doc says other components should reuse -- with none of its usual
 * DOM/ARIA plumbing (that's `<lr-live-region>`'s job, not this
 * component's). Within any `coalesce-ms` window, only the *last* `content`
 * value assigned actually reaches the rendered DOM. Two cases always bypass
 * the throttle and flush immediately instead of waiting out the window: the
 * very first `content` assignment after mount (so an already-complete
 * message never shows an artificial startup delay), and any transition of
 * `streaming` between `true` and `false` in either direction (so the final
 * chunk of a finished stream can never be left stranded mid-window, and a
 * stream restarting on a reused element can never keep showing the
 * previous stream's stale final content for the length of the window).
 *
 * `contentMode="auto"` (the default) auto-detects via a lightweight regex heuristic (see
 * `looksLikeMarkdown`) run against whatever text is currently displayed --
 * good enough to route obviously-Markdown output through `<lr-markdown>`
 * without the host needing to know or declare it up front, at the cost of
 * an occasional one-time mode flip if Markdown syntax only appears partway
 * through a stream. Explicit `"plain"` and `"markdown"` modes always win
 * over the heuristic. Rendering itself is never reimplemented here:
 * Markdown mode composes `<lr-markdown>` (`../markdown/markdown.js`)
 * directly, forwarding this component's own `streaming` through as that
 * component's own forward-compatible `streaming` hint prop, and this
 * component's own `languages` through verbatim; plain-text mode
 * renders into a `white-space: pre-wrap` span instead. The rest of
 * `<lr-markdown>`'s configuration surface is forwarded verbatim too --
 * `tabSize`, `htmlMode`, `gfm`, `linkTarget`, `internalLinkPrefix`,
 * `headingOffset`, `highlightCode`, `headingAnchors`, `math`, and
 * `maxHeight` -- each defaulting to exactly `<lr-markdown>`'s own default, so
 * leaving all of them unset renders identically to before this wrapper
 * forwarded them. The plain-text path
 * does not load optional peers. Markdown mode uses `<lr-markdown>`'s lazy
 * `marked` parser and default `dompurify` sanitizer; fenced-code highlighting
 * can additionally use `shiki`. The transitive Markdown graph also contains
 * the opt-in `katex` loader, requested only if this wrapper's own `math` is
 * set (forwarded to the composed element, unset by default).
 *
 * A consumer with a bounded, known fence-language set who wants to avoid `<lr-markdown>`'s
 * ~200-language dynamic-import table entirely -- either by setting `languages` here, or to skip
 * the full table's build-output cost outright -- can import `streaming-text-core.js` instead,
 * which composes `<lr-markdown-core>` under the tag `lr-streaming-text-core` and never references
 * the full table at all; see that variant's own class doc.
 *
 * The blinking cursor (shown only while `streaming` is `true`) degrades to
 * a static, always-visible bar under `prefers-reduced-motion: reduce`
 * rather than disabling the animation into an invisible frozen frame --
 * the same pattern `<lr-typing-indicator>`'s own `cursor` variant uses. In
 * plain-text mode the cursor sits inline at the tail of the final
 * character, since the text is one continuous inline flow; in Markdown
 * mode it renders as its own trailing block below the rendered content
 * instead of attempting to splice into whatever nested block Markdown
 * happens to end with (a paragraph, a table cell, a list item, a fenced
 * code block, …) -- genuinely interleaving into arbitrary rendered Markdown
 * without reaching across `<lr-markdown>`'s own shadow boundary isn't a
 * tractable general solution, so this component doesn't attempt it.
 *
 * Driven entirely by its properties -- it doesn't announce anything to assistive tech itself (a
 * host that needs streamed text announced already has `<lr-live-region>` for that, composed, for
 * example, inside `<lr-chat-message>`). It does fire one signal-only event: `lr-content-settled`,
 * composed and bubbling, whenever newly-coalesced `displayedContent` actually reaches the
 * rendered DOM. A consumer that composes this element inside a free-form container -- e.g.
 * `<lr-thinking-panel>`'s default slot -- listens for that event to drive its own auto-scroll,
 * since this component renders into its own shadow root and a plain light-DOM
 * `MutationObserver` on the container can never see that update happen. In `markdown` mode
 * (forced or auto-detected) this element does not emit the event itself -- the composed
 * `<lr-markdown>` it delegates rendering to already emits its own `lr-content-settled` at its own
 * settle point, and that event is composed, so it bubbles out through this element unmodified;
 * emitting a second one here would double-fire every listener.
 *
 * @customElement lr-streaming-text
 * @event lr-content-settled - Fired after newly-coalesced content actually reaches the rendered
 *   DOM (plain-text mode only -- see the class doc). `detail: null`.
 * @csspart base - The root container.
 * @csspart cursor - The blinking (or, under reduced motion, static) cursor bar. Only rendered while `streaming` is `true`.
 * @csspart content - Forwarded from the composed `<lr-markdown>` in Markdown mode -- the wrapper
 *   around its rendered (or plain-text fallback) output; respects `max-height`.
 * @csspart heading - Forwarded from the composed `<lr-markdown>` in Markdown mode -- every
 *   rendered `<h1>`–`<h6>` (shifted by `heading-offset`).
 * @csspart paragraph - Forwarded from the composed `<lr-markdown>` in Markdown mode -- every
 *   rendered `<p>`.
 * @csspart list - Forwarded from the composed `<lr-markdown>` in Markdown mode -- every rendered
 *   `<ul>`/`<ol>`.
 * @csspart code-block - Forwarded from the composed `<lr-markdown>` in Markdown mode -- every
 *   rendered fenced/indented `<pre>`.
 * @csspart code-block-header - Forwarded from `<lr-markdown>` when code-block-header is enabled.
 * @csspart code-block-language - Forwarded source language label in the code-block header.
 * @csspart code-block-copy - Forwarded native source-copy button in the code-block header.
 * @csspart inline-code - Forwarded from the composed `<lr-markdown>` in Markdown mode -- every
 *   rendered inline `<code>` span (backtick spans, not fenced blocks).
 * @csspart link - Forwarded from the composed `<lr-markdown>` in Markdown mode -- every rendered
 *   `<a>`.
 * @csspart table - Forwarded from the composed `<lr-markdown>` in Markdown mode -- every rendered
 *   `<table>`.
 * @csspart blockquote - Forwarded from the composed `<lr-markdown>` in Markdown mode -- every
 *   rendered `<blockquote>`.
 * @csspart img - Forwarded from the composed `<lr-markdown>` in Markdown mode -- every rendered
 *   `<img>`.
 * @csspart math - Forwarded from the composed `<lr-markdown>` in Markdown mode -- a rendered
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
 * @status stable
 * @since 4.0.0
 */
export class LyraStreamingText extends StreamingTextRuntimeBase {
  protected override renderMarkdown(): TemplateResult {
    // lr-markdown's own lr-content-settled is deliberately left unstopped here -- see
    // updated()'s comment in the shared base -- so it bubbles straight out through this element.
    // exportparts forwards lr-markdown's own documented part vocabulary (verified against its
    // class JSDoc) up through this element's shadow boundary -- see this class's own @csspart list
    // above. Every listed name is reused verbatim (no aliasing) since none collides with this
    // element's own base/cursor parts.
    return html`<lr-markdown
      exportparts="content, heading, paragraph, list, code-block, code-block-header, code-block-language, code-block-copy, inline-code, link, table, blockquote, img, math, task-list, task-item, task-item-checked, task-checkbox, table-wrapper, code-block-frame, code-block-copy-success, code-block-copy-error, streaming-tail"
      .content=${this.displayedContent}
      .streaming=${this.streaming}
      .streamingRender=${this.streamingRender}
      .codeBlockChrome=${this.codeBlockChrome}
      .codeBlockHeader=${this.codeBlockHeader}
      .languages=${this.languages}
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
    ></lr-markdown>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-streaming-text': LyraStreamingText;
  }
}
