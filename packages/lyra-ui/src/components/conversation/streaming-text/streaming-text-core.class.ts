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
 * coalescing, `contentMode` auto-detection, the blinking cursor, the `lr-content-settled` event --
 * only which Markdown element Markdown mode composes differs: this variant renders
 * `<lr-markdown-core>` (`../markdown/markdown-core.js`) instead of `<lr-markdown>`, so this
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
 * @cssprop [--lr-inline-cursor-width=var(--lr-size-0-125rem)] - Shared width of the inline cursor
 * bar (also its border radius).
 * @cssprop [--lr-inline-cursor-height=var(--lr-size-1em)] - Shared height of the inline cursor bar.
 * @status experimental
 * @since 16.0.0
 */
export class LyraStreamingTextCore extends StreamingTextRuntimeBase {
  protected override renderMarkdown(): TemplateResult {
    // lr-markdown-core's own lr-content-settled is deliberately left unstopped here -- see the
    // shared base's updated() comment -- so it bubbles straight out through this element.
    return html`<lr-markdown-core
      .content=${this.displayedContent}
      .streaming=${this.streaming}
      .languages=${this.languages ?? {}}
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
