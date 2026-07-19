import { html, nothing, type TemplateResult, type PropertyValues, type ComplexAttributeConverter } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { Announcer } from '../../../internal/announcer.js';
import { finiteDuration } from '../../../internal/numbers.js';
import '../markdown/markdown.class.js';
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
const MARKDOWN_PATTERNS: readonly RegExp[] = [
  /^ {0,3}#{1,6}\s+\S/m, // ATX heading: "# Heading"
  /```/, // fenced code block
  /\*\*[^*\n]+\*\*/, // **bold**
  /(?:^|[^\w])_[^_\n]+_(?:[^\w]|$)/, // _italic_
  /`[^`\n]+`/, // inline code
  /^ {0,3}[-*+]\s+\S/m, // bullet list item
  /^ {0,3}\d+\.\s+\S/m, // numbered list item
  /\[[^\]]+\]\([^)\s]+\)/, // [text](url)
  /^ {0,3}>\s?\S/m, // blockquote
];

/** Runs {@link MARKDOWN_PATTERNS} against `text`, used whenever `markdown`
 *  is left unset (auto-detect). Exported so the heuristic is directly
 *  testable without going through the component's render cycle. */
export function looksLikeMarkdown(text: string): boolean {
  if (!text) return false;
  return MARKDOWN_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Tri-state boolean attribute converter for `markdown`. Lit's built-in
 * `type: Boolean` converter is presence-based and can only ever represent
 * two states (attribute present -> `true`, absent -> `false`) -- there's no
 * way for it to also represent "not specified, auto-detect instead", which
 * is the actual default this property needs. `markdown` (no value, or
 * `="true"`) -> `true`; `markdown="false"` -> `false`; attribute entirely
 * absent -> `undefined`.
 *
 * Only `fromAttribute` is defined: `markdown` is not declared `reflect: true`
 * below, and Lit only ever calls a converter's `toAttribute()` when the
 * property it's attached to reflects, so a `toAttribute()` here would be
 * unreachable dead code.
 */
const optionalBooleanConverter: ComplexAttributeConverter<boolean | undefined> = {
  fromAttribute(value): boolean | undefined {
    if (value === null) return undefined;
    return value !== 'false';
  },
};

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
 * `markdown` is a tri-state property, not a plain boolean: left unset (the
 * default), it auto-detects via a lightweight regex heuristic (see
 * `looksLikeMarkdown`) run against whatever text is currently displayed --
 * good enough to route obviously-Markdown output through `<lr-markdown>`
 * without the host needing to know or declare it up front, at the cost of
 * an occasional one-time mode flip if Markdown syntax only appears partway
 * through a stream. Explicitly setting `markdown` to `true`/`false` always
 * wins over the heuristic. Rendering itself is never reimplemented here:
 * Markdown mode composes `<lr-markdown>` (`../markdown/markdown.js`)
 * directly, forwarding this component's own `streaming` through as that
 * component's own forward-compatible `streaming` hint prop; plain-text mode
 * renders into a `white-space: pre-wrap` span instead.
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
 * @cssprop [--lr-streaming-text-cursor-width=var(--lr-size-0-125rem)] - Width of the `cursor` bar (also its border radius).
 * @cssprop [--lr-streaming-text-cursor-height=var(--lr-size-1em)] - Height of the `cursor` bar.
 */
export class LyraStreamingText extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** The full current text so far -- always the complete string, never a
   *  delta to append. */
  @property() content = '';

  /** Shows the blinking cursor after the rendered text. Reflects, so a host
   *  can also target `lr-streaming-text[streaming]` in CSS. */
  @property({ type: Boolean, reflect: true }) streaming = false;

  /** Trailing-edge coalesce window, in ms, for `content` updates -- see the
   *  class doc. */
  @property({ type: Number, attribute: 'coalesce-ms' }) coalesceMs = DEFAULT_COALESCE_MS;

  /** `undefined` (default) auto-detects via `looksLikeMarkdown`; `true`/
   *  `false` force that rendering mode regardless of content. */
  @property({ attribute: 'markdown', converter: optionalBooleanConverter }) markdown?: boolean;

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

  protected willUpdate(changed: PropertyValues): void {
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
      // Every MARKDOWN_PATTERNS entry is append-monotonic: a match found in some prefix of the
      // string still exists (at the same offset) after more text is appended, so once a scan has
      // returned `true` for a prefix of the current content, re-running the whole battery over
      // the ever-growing accumulated string on every coalesced flush would be quadratic work for
      // a result that cannot change. The `startsWith` check is what verifies "content only
      // appended" -- a non-append change (e.g. a reused element starting a brand-new stream)
      // fails it and falls through to a full rescan, which is also what resets the memo.
      if (!(this.lastScannedResult && previous !== undefined && this.displayedContent.startsWith(previous))) {
        this.lastScannedResult = looksLikeMarkdown(this.displayedContent);
      }
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.coalescer.cancel();
  }

  /** Whether Markdown mode is actually in effect right now, resolving the
   *  tri-state `markdown` property against the memoized `looksLikeMarkdown`
   *  result for the currently-displayed content (see `lastScannedContent`/
   *  `lastScannedResult` above). */
  private get effectiveMarkdown(): boolean {
    return this.markdown ?? this.lastScannedResult;
  }

  render(): TemplateResult {
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

