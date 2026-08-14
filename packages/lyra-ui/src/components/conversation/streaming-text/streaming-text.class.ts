import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { Announcer } from '../../../internal/announcer.js';
import { finiteDuration } from '../../../internal/numbers.js';
import { styles } from './streaming-text.styles.js';


const DEFAULT_COALESCE_MS = 50;

/**
 * Lightweight, deliberately-imperfect signals that the currently-displayed
 * text contains Markdown syntax worth routing through `<lr-markdown>`
 * rather than a plain `white-space: pre-wrap` node. Checked in order against
 * the whole string; the first match short-circuits. None of these need to be
 * airtight -- a false positive just renders ordinary prose through
 * `<lr-markdown>` (which renders plain prose fine); a false negative just
 * renders literal `**`/backticks/etc. as plain text until more of the stream
 * arrives.
 */
const APPEND_MONOTONIC_MARKDOWN_PATTERNS: readonly RegExp[] = [
  /^ {0,3}#{1,6}\s+\S/m, // ATX heading: "# Heading"
  /```/, // fenced code block
  /\*\*[^*\n]+\*\*/, // **bold**
  /`[^`\n]+`/, // inline code
  /^ {0,3}[-*+]\s+\S/m, // bullet list item
  /^ {0,3}\d+\.\s+\S/m, // numbered list item
  /\[[^\]]+\]\([^)\s]+\)/, // [text](url)
  /^ {0,3}>\s?\S/m, // blockquote
];

// The trailing boundary may be the current end of a stream. Appending a
// word character can therefore invalidate a prior match (`_x_` -> `_x_a`).
const BOUNDARY_SENSITIVE_MARKDOWN_PATTERNS: readonly RegExp[] = [
  /(?:^|[^\w])_[^_\n]+_(?:[^\w]|$)/, // _italic_
];

/** Runs {@link MARKDOWN_PATTERNS} against `text`, used whenever `markdown`
 *  is left unset (auto-detect). Exported so the heuristic is directly
 *  testable without going through the component's render cycle. */
export function looksLikeMarkdown(text: string): boolean {
  if (!text) return false;
  return [...APPEND_MONOTONIC_MARKDOWN_PATTERNS, ...BOUNDARY_SENSITIVE_MARKDOWN_PATTERNS].some((pattern) =>
    pattern.test(text),
  );
}

export type StreamingTextContentMode = 'auto' | 'plain' | 'markdown';

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
 * component's own forward-compatible `streaming` hint prop; plain-text mode
 * renders into a `white-space: pre-wrap` span instead. The plain-text path
 * does not load optional peers. Markdown mode uses `<lr-markdown>`'s lazy
 * `marked` parser and default `dompurify` sanitizer; fenced-code highlighting
 * can additionally use `shiki`. The transitive Markdown graph also contains
 * the opt-in `katex` loader, but this wrapper does not enable Markdown math,
 * so it never requests that peer itself.
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
 * Purely presentational: no events, driven entirely by its properties. It
 * also doesn't announce anything to assistive tech itself -- a host that
 * needs streamed text announced already has `<lr-live-region>` for that
 * (composed, for example, inside `<lr-chat-message>`).
 *
 * @customElement lr-streaming-text
 * @csspart base - The root container.
 * @csspart cursor - The blinking (or, under reduced motion, static) cursor bar. Only rendered while `streaming` is `true`.
 * @cssprop [--lr-inline-cursor-width=var(--lr-size-0-125rem)] - Shared width of the inline cursor
 * bar (also its border radius).
 * @cssprop [--lr-inline-cursor-height=var(--lr-size-1em)] - Shared height of the inline cursor bar.
 * @status stable
 * @since 4.0.0
 */
export class LyraStreamingText extends LyraElement {
  static override styles = [LyraElement.styles, styles];

  /** The full current text so far -- always the complete string, never a
   *  delta to append. */
  @property() content = '';

  /** Shows the blinking cursor after the rendered text. Reflects, so a host
   *  can also target `lr-streaming-text[streaming]` in CSS. */
  @property({ type: Boolean, reflect: true }) streaming = false;

  /** Trailing-edge coalesce window, in ms, for `content` updates -- see the
   *  class doc. */
  @property({ type: Number, attribute: 'coalesce-ms' }) coalesceMs = DEFAULT_COALESCE_MS;

  /** Rendering mode. `auto` uses `looksLikeMarkdown`; the other values force
   *  their named mode regardless of content. */
  @property({ reflect: true, attribute: 'content-mode' }) contentMode: StreamingTextContentMode = 'auto';

  // The coalesced value actually rendered -- lags `content` by up to
  // `coalesceMs` (or zero, for the immediate-flush cases documented above).
  @state() private displayedContent = '';

  // Cache pair for the Markdown auto-detect heuristic, keyed on the
  // `displayedContent` value it was last run against. `effectiveMarkdown` is
  // read on every render pass, including ones triggered only by `streaming`
  // toggling with no actual `displayedContent` change -- re-scanning the
  // whole string on those passes would rerun the entire regex battery for a
  // result that can't possibly have changed since the last scan.
  private lastScannedContent?: string;
  private lastScannedResult = false;
  private lastMonotonicResult = false;

  private readonly coalescer: Announcer;

  /** `coalesceMs` normalized to a finite, non-negative timer delay before it ever reaches
   *  `Announcer.throttleMs` (and, from there, a raw `setTimeout()` call) -- a `NaN`/negative raw
   *  value would otherwise feed the platform a nonsensical delay (clamped to `0` by the
   *  browser, firing on every burst instead of ever actually coalescing) rather than falling
   *  back to this component's own constructed default. */
  private get safeCoalesceMs(): number {
    return finiteDuration(this.coalesceMs, DEFAULT_COALESCE_MS, 0);
  }

  constructor() {
    super();
    // Built in the constructor (not a class-field initializer) so it reads
    // `this.coalesceMs` only after that property's own field initializer has
    // already run and set the declared default -- same ordering rationale as
    // lr-live-region's identical constructor-built Announcer.
    this.coalescer = new Announcer({
      throttleMs: this.safeCoalesceMs,
      onFlush: (text) => {
        this.displayedContent = text;
      },
    });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    const ownerWindow = this.ownerDocument.defaultView;
    if (ownerWindow) this.coalescer.setTimerHost(ownerWindow);
    if (this.hasUpdated && this.displayedContent !== this.content) {
      this.coalescer.announce(this.content, { force: true });
    }
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('coalesceMs')) {
      this.coalescer.throttleMs = this.safeCoalesceMs;
    }
    if (changed.has('content')) {
      // The very first content assignment after mount always flushes
      // immediately -- an already-complete message (or the first chunk of a
      // new one) shouldn't show an artificial startup delay just because a
      // coalescing window technically applies to it.
      this.coalescer.announce(this.content, { force: !this.hasUpdated });
    }
    // Neither a stream finishing nor a stream (re)starting on a reused
    // element may leave stale content stranded inside an in-progress
    // coalescing window -- force whatever `content` currently holds through
    // immediately in both directions. Without the restart side of this, a
    // reused element would keep showing the *previous* stream's final
    // content for up to a full coalesce-ms window after a new stream had
    // already begun. `changed.get('streaming')` is only defined for a real
    // transition (never the initial mount value, per Lit's documented
    // first-change semantics), so this can't misfire on connect.
    if (
      changed.has('streaming') &&
      changed.get('streaming') !== undefined &&
      changed.get('streaming') !== this.streaming
    ) {
      this.coalescer.announce(this.content, { force: true });
    }
    if (changed.has('displayedContent') && this.displayedContent !== this.lastScannedContent) {
      const previous = this.lastScannedContent;
      this.lastScannedContent = this.displayedContent;
      const appended = previous !== undefined && this.displayedContent.startsWith(previous);
      // Only matches whose truth cannot be invalidated by appended text may
      // short-circuit an append. Boundary-sensitive signals are rescanned;
      // for example `_x_` is Markdown but `_x_a` is ordinary text.
      if (!(appended && this.lastMonotonicResult)) {
        this.lastMonotonicResult = APPEND_MONOTONIC_MARKDOWN_PATTERNS.some((pattern) =>
          pattern.test(this.displayedContent),
        );
        this.lastScannedResult =
          this.lastMonotonicResult ||
          BOUNDARY_SENSITIVE_MARKDOWN_PATTERNS.some((pattern) => pattern.test(this.displayedContent));
      }
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.coalescer.cancel();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    const ownerWindow = this.ownerDocument.defaultView;
    if (ownerWindow) this.coalescer.setTimerHost(ownerWindow);
  }

  /** Whether Markdown mode is actually in effect right now, resolving the
   *  `contentMode` property against the memoized `looksLikeMarkdown`
   *  result for the currently-displayed content (see `lastScannedContent`/
   *  `lastScannedResult` above). */
  private get effectiveMarkdown(): boolean {
    if (this.contentMode === 'markdown') return true;
    if (this.contentMode === 'plain') return false;
    return this.lastScannedResult;
  }

  override render(): TemplateResult {
    return html`
      <div part="base">
        ${this.effectiveMarkdown
          ? html`<lr-markdown .content=${this.displayedContent} .streaming=${this.streaming}></lr-markdown>`
          : html`<span class="plain">${this.displayedContent}</span>`}
        ${this.streaming ? html`<span part="cursor" aria-hidden="true"></span>` : nothing}
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-streaming-text': LyraStreamingText;
  }
}
