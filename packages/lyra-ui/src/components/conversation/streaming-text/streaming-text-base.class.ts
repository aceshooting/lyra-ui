import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { Announcer } from '../../../internal/announcer.js';
import { finiteDuration } from '../../../internal/numbers.js';
import type { ShikiLanguageInput } from '../code-block/shiki-types.js';
import type { MarkdownHtmlMode } from '../markdown/markdown-shared.js';
import type { MarkdownStreamingRenderMode } from '../markdown/markdown-base.class.js';
import { trueDefaultBooleanFromAttributeConverter as trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { styles } from './streaming-text.styles.js';

const DEFAULT_COALESCE_MS = 50;

/**
 * Lightweight, deliberately-imperfect signals that the currently-displayed
 * text contains Markdown syntax worth routing through the composed Markdown
 * renderer rather than a plain `white-space: pre-wrap` node. Checked in order against
 * the whole string; the first match short-circuits. None of these need to be
 * airtight -- a false positive just renders ordinary prose through
 * Markdown mode (which renders plain prose fine); a false negative just
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

/** Runs {@link APPEND_MONOTONIC_MARKDOWN_PATTERNS}/{@link BOUNDARY_SENSITIVE_MARKDOWN_PATTERNS}
 *  against `text`, used whenever `contentMode` is left unset (auto-detect). Exported so the
 *  heuristic is directly testable without going through either variant's render cycle. */
export function looksLikeMarkdown(text: string): boolean {
  if (!text) return false;
  return [...APPEND_MONOTONIC_MARKDOWN_PATTERNS, ...BOUNDARY_SENSITIVE_MARKDOWN_PATTERNS].some((pattern) =>
    pattern.test(text),
  );
}

export type StreamingTextContentMode = 'auto' | 'plain' | 'markdown';

export interface LyraStreamingTextEventMap {
  'lr-content-settled': CustomEvent<null>;
}

/**
 * Shared runtime for `<lr-streaming-text>`/`<lr-streaming-text-core>` -- token coalescing,
 * `contentMode` auto-detection, and the blinking cursor -- factored out so neither variant
 * duplicates it. The two leaf classes differ only in which Markdown element `renderMarkdown()`
 * composes: `<lr-markdown>` for the default variant, `<lr-markdown-core>` for the build-lean one.
 *
 * Deliberately not tagged internal: both concrete streaming-text tags publicly extend this class,
 * so stripping it would leave both concrete classes' `extends` clauses naming a type absent from
 * the shipped `.d.ts`, breaking the package's own build.
 */
export abstract class StreamingTextRuntimeBase extends LyraElement<LyraStreamingTextEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** The full current text so far -- always the complete string, never a
   *  delta to append. */
  @property() content = '';

  /** Shows the blinking cursor after the rendered text. Reflects, so a host
   *  can also target `[streaming]` in CSS. */
  @property({ type: Boolean, reflect: true }) streaming = false;

  /** Forwarded to the composed Markdown element. `plain` preserves the existing streaming
   * fallback; `progressive` renders completed Markdown blocks while the final block is arriving. */
  @property({ attribute: 'streaming-render', reflect: true })
  streamingRender: MarkdownStreamingRenderMode = 'plain';

  /** Forwarded to the composed Markdown element; opts into a localized language label and copy
   * button on fenced code blocks. */
  @property({ type: Boolean, attribute: 'code-block-chrome' })
  codeBlockChrome = false;

  /** Trailing-edge coalesce window, in ms, for `content` updates -- see the
   *  class doc. */
  @property({ type: Number, attribute: 'coalesce-ms' }) coalesceMs = DEFAULT_COALESCE_MS;

  /** Rendering mode. `auto` uses `looksLikeMarkdown`; the other values force
   *  their named mode regardless of content. */
  @property({ reflect: true, attribute: 'content-mode' }) contentMode: StreamingTextContentMode = 'auto';

  /** Forwarded verbatim to the composed Markdown element's own `languages` -- a fine-grained,
   *  explicit language-grammar bundle scoping shiki's build output to just those grammars. Unset
   *  leaves the composed element's own default untouched: the full variant falls back to its
   *  ~200-language dynamic-import table, the core variant renders unmatched fences as plain text. */
  @property({ attribute: false }) languages?: Readonly<Record<string, ShikiLanguageInput>>;

  /** Forwarded verbatim to the composed Markdown element's own `tabSize` -- the tab-stop width
   *  used to expand tabs in leading indentation before parsing. `4` (the default) matches the
   *  composed element's own default. */
  // numeric-guard-exempt: forwarded verbatim, never used for math here -- the composed Markdown
  // element clamps it at its point of use (`finiteInteger(this.tabSize, 4, 1, 32)` in
  // markdown-base.class.ts). A second guard here would duplicate that range and could diverge.
  @property({ type: Number, attribute: 'tab-size' }) tabSize = 4;

  /** Forwarded verbatim to the composed Markdown element's own `htmlMode` -- how authored raw
   *  HTML is handled (`'sanitize'`, `'escape'`, or `'trusted'`). `'sanitize'` (the default)
   *  matches the composed element's own default. */
  @property({ attribute: 'html-mode' }) htmlMode: MarkdownHtmlMode = 'sanitize';

  /** Forwarded verbatim to the composed Markdown element's own `gfm` -- GitHub-flavored Markdown
   *  (tables, strikethrough, autolinks, task lists). `true` (the default) matches the composed
   *  element's own default. */
  @property({ converter: trueDefaultBooleanConverter }) gfm = true;

  /** Forwarded verbatim to the composed Markdown element's own `linkTarget` -- the `target`
   *  applied to every rendered `<a>`, with `rel="noopener noreferrer"` always added by the
   *  composed element alongside it whenever a `target` is emitted. `'_blank'` (the default)
   *  matches the composed element's own default; set to `null` (or the empty string, e.g. via the
   *  `link-target=""` attribute) to omit `target`/`rel` entirely so rendered links open in the
   *  same tab. */
  @property({ attribute: 'link-target' }) linkTarget: string | null = '_blank';

  /** Forwarded verbatim to the composed Markdown element's own `internalLinkPrefix`. Empty (the
   *  default) matches the composed element's own default -- every link is treated as external. */
  @property({ attribute: 'internal-link-prefix' }) internalLinkPrefix = '';

  /** Forwarded verbatim to the composed Markdown element's own `headingOffset`. `0` (the
   *  default) matches the composed element's own default. */
  // numeric-guard-exempt: forwarded verbatim, never used for math here -- the composed Markdown
  // element clamps it at its point of use (`finiteInteger(this.headingOffset, 0, 0, 6)` in
  // markdown-base.class.ts). A second guard here would duplicate that range and could diverge.
  @property({ type: Number, attribute: 'heading-offset' }) headingOffset = 0;

  /** Forwarded verbatim to the composed Markdown element's own `highlightCode`. `true` (the
   *  default) matches the composed element's own default. */
  @property({ attribute: 'highlight-code', converter: trueDefaultBooleanConverter })
  highlightCode = true;

  /** Forwarded verbatim to the composed Markdown element's own `headingAnchors`. `false` (the
   *  default) matches the composed element's own default. */
  @property({ type: Boolean, attribute: 'heading-anchors' }) headingAnchors = false;

  /** Forwarded verbatim to the composed Markdown element's own `math`. `false` (the default)
   *  matches the composed element's own default. */
  @property({ type: Boolean }) math = false;

  /** Forwarded verbatim to the composed Markdown element's own `maxHeight`. Empty (the default)
   *  matches the composed element's own default -- the rendered document never scrolls
   *  internally. */
  @property({ attribute: 'max-height' }) maxHeight = '';

  // The coalesced value actually rendered -- lags `content` by up to
  // `coalesceMs` (or zero, for the immediate-flush cases documented above).
  @state() protected displayedContent = '';

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

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    // Only the plain-text path emits its own settle signal. In markdown mode the composed
    // Markdown element this template renders emits its own `lr-content-settled` at its own settle
    // point, and -- being composed -- that event already bubbles out through this element's
    // shadow boundary unmodified (see stopOwnedEvent(), which deliberately does NOT intercept
    // this one the way it intercepts the composed element's other events). Emitting here too would
    // double-fire every listener for the same coalesced content.
    if (changed.has('displayedContent') && !this.effectiveMarkdown) {
      this.emit('lr-content-settled', null);
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
  protected get effectiveMarkdown(): boolean {
    if (this.contentMode === 'markdown') return true;
    if (this.contentMode === 'plain') return false;
    return this.lastScannedResult;
  }

  protected stopOwnedEvent(event: Event): void {
    event.stopPropagation();
  }

  /** Renders the Markdown-mode composed element for `displayedContent` -- `<lr-markdown>` for
   *  `LyraStreamingText`, `<lr-markdown-core>` for `LyraStreamingTextCore`. The only difference
   *  between the two leaf classes. */
  protected abstract renderMarkdown(): TemplateResult;

  override render(): TemplateResult {
    const cursor = this.streaming ? html`<span part="cursor" aria-hidden="true"></span>` : nothing;
    // Flush on purpose, and kept away from formatters: a host placed under an inherited
    // preserving white-space value (a pre-wrap chat bubble) would otherwise render this
    // template's indentation. The single space before the plain-mode cursor is deliberate; it is
    // the one space the collapsed indentation always produced there.
    // prettier-ignore
    return html`<div part="base"
      >${this.effectiveMarkdown
        ? html`${this.renderMarkdown()}${cursor}`
        : html`<span class="plain">${this.displayedContent}</span> ${cursor}`}</div
    >`;
  }
}
