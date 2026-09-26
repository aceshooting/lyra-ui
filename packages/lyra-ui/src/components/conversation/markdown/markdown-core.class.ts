import type { LyraClipboardWriteSuccess, LyraClipboardWriteFailure } from '../../../internal/clipboard.js';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { srOnly } from '../../../internal/a11y.js';
import type { LyraAnchorTargetEventMap } from '../../../internal/anchor-target.js';
import {
  getMarkdownDepsIfLoaded,
  type LyraMarkedParser,
} from './markdown-loader.js';
import {
  ensureShikiLanguageLoaded,
  loadShikiHighlighterCore,
  normalizeShikiLanguage,
  resolvedShikiLanguages,
  type ShikiLanguageSource,
} from '../code-block/shiki-types.js';
import {
  createMarkdownKatexState,
  tokenizeMarkdownHighlight,
  type PendingHighlight,
  type MarkdownHeadingItem as SharedMarkdownHeadingItem,
  type MarkdownHtmlMode,
  type MarkdownStreamingRender,
} from './markdown-shared.js';
import {
  createMarkdownVariantContext,
  MarkdownRuntimeBase,
  type MarkdownStreamingRenderMode,
  type MarkdownHighlightAttempt,
  type MarkdownVariantContext,
} from './markdown-base.class.js';
import { styles } from './markdown.styles.js';
// The parse-only variant, matching `<lr-markdown>`. Inert either way today (neither `gfm` nor
// `highlightCode` reflects, so no `toAttribute` is ever called), but the pair had drifted onto
// two different converters, and the reflecting one would start behaving differently the moment any
// either property gained `reflect: true`.
import { trueDefaultBooleanFromAttributeConverter as trueDefaultBooleanConverter } from '../../../internal/converters.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_anchorJumped, LYRA_DEFAULT_anchorJumpedToPage, LYRA_DEFAULT_anchorNotFound, LYRA_DEFAULT_codeRegion, LYRA_DEFAULT_codeRegionWithLanguage, LYRA_DEFAULT_copiedToClipboard, LYRA_DEFAULT_copyCode, LYRA_DEFAULT_copyFailed, LYRA_DEFAULT_markdownTableRegion } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** Re-exported so `markdown-core.ts`'s `export *` keeps exposing this from the same public path as
 *  before this type moved into the pair's shared module -- see `markdown-shared.ts`'s class doc. */
export type MarkdownHeadingItem = SharedMarkdownHeadingItem;
/** Peer-neutral public alias matching the full variant's `getMarked()` signature. */
export type Marked = LyraMarkedParser;
export type { MarkdownStreamingRenderMode };
export type { MarkdownStreamingRender } from './markdown-shared.js';

/** This variant's own `katex` resolution state, deliberately separate from `<lr-markdown>`'s --
 *  see `createMarkdownKatexState()` for why sharing one instance across the pair would change
 *  re-render-on-resolve behavior on a page using both. */
const katexState = createMarkdownKatexState();

/** `true`-defaulting boolean attribute converter -- Lit's default presence-based `type: Boolean`
 *  can never be set back to `false` from a plain-HTML attribute once the property's own default is
 *  `true` (removing an attribute that was never present fires no `attributeChangedCallback`), so
 *  `fromAttribute` checks the literal string instead. Shared by `gfm` and `highlightCode`. */

export interface LyraMarkdownCoreEventMap extends LyraAnchorTargetEventMap {
  'lr-render-error': CustomEvent<{ error: unknown }>;
  'lr-link-click': CustomEvent<{ href: string }>;
  'lr-content-settled': CustomEvent<null>;
  'lr-copy': CustomEvent<LyraClipboardWriteSuccess>;
  'lr-copy-error': CustomEvent<LyraClipboardWriteFailure>;
}

/**
 * `<lr-markdown-core>` — a build-lean variant of `<lr-markdown>` for a consumer whose
 * `languages` map already covers every language it will ever render. Every other capability (GFM
 * tables, fenced code blocks, links, blockquotes, heading anchors, text-quote highlights, math) is
 * identical to `<lr-markdown>` -- only fenced-code-block highlighting differs: this component's
 * own module never textually contains a call to (or import of) `loadShikiHighlighter` (the
 * ~200-language default dynamic-import table `<lr-markdown>` can call). A consumer
 * importing this entry point instead of `markdown.js` gets a genuinely shiki-full-table-free
 * build. A fenced block whose language isn't a key in `languages` always renders the plain-text
 * fallback -- there is no default/full-table highlighter here to fall back to, mirroring
 * `<lr-code-block-core>`'s identical contract for the sibling component.
 *
 * Built on the optional peer dependencies `marked` (parsing) and `dompurify` (sanitizing), both
 * lazy-loaded via `markdown-loader.ts` on first connect.
 *
 * Rendering never ships unsanitized or broken markup silently:
 * - If `marked` fails to load, or throws while parsing malformed input, the
 *   component falls back to plain text (`white-space: pre-wrap`, no HTML
 *   parsing at all) and fires `lr-render-error`.
 * - If `htmlMode` is `sanitize` (the default) and `dompurify` fails to load, the
 *   component *also* falls back to plain text + `lr-render-error` — it
 *   never renders marked's raw HTML output when sanitization was requested
 *   (or defaulted to) but is unavailable, even though `marked` itself loaded
 *   fine.
 * - If `htmlMode` is explicitly `trusted`, marked's raw output renders as-is
 *   regardless of whether `dompurify` is installed — the consumer opted out
 *   of sanitization, so `dompurify`'s absence is irrelevant to that path.
 *
 * That same plain-text fallback rendering (`data-fallback` on the `content`
 * part) is also, unconditionally and by default, a brief *transient* state on
 * every connect, not just a failure path: `connectedCallback()`'s dynamic
 * `import()` of `marked`/`dompurify` (see `markdown-loader.ts`) is
 * asynchronous, so the very first paint of any `<lr-markdown>` on a page
 * shows plain text for at least one microtask — even when both peers are
 * already installed and load without error — until that import resolves and
 * a second render replaces it with the real Markdown output. Call `preloadMarkdown()` before
 * mounting the first instance to avoid that window; later instances always adopt its settled
 * shared dependency cache synchronously.
 * Disconnecting and reconnecting while the shared load is pending invalidates the earlier
 * connection's settlement callback, so the current connection parses only once.
 *
 * `heading`/`code`/`blockquote`/`table`/`link`/`image` tokens are rendered
 * through a `marked` renderer override that injects `part="..."` attributes
 * directly into the produced HTML — a single pass, not a second DOM walk
 * after insertion.
 *
 * Fenced code blocks are syntax-highlighted via the same fine-grained `shiki/core` recipe
 * `<lr-code-block-core>` uses (`highlightCode`, default `true` — gated by whether a fenced
 * block's language is a key in `languages`, since there is no default highlighter here to gate on
 * "is shiki installed at all"). The very first render of any content is always plain (identical to
 * `<lr-markdown>`'s own output); highlighting arrives as an asynchronous upgrade one render
 * later, once the fine-grained highlighter resolves. Plain streaming defers highlighting until completion; progressive streaming highlights settled blocks.
 *
 * Highlighted blocks follow the page's resolved theme. Shiki emits both palettes at once, so
 * `[part="content"]` carries `data-dark-theme="true"` whenever the component's own resolved
 * `--lr-color-text` is lighter than its `--lr-color-surface`, and the stylesheet then paints each
 * token from `--shiki-dark`/`--shiki-dark-bg` instead of the light inline color. It keys off the
 * resolved tokens rather than `prefers-color-scheme`, so a consumer theming with
 * `--lr-theme-color-*` independently of the OS setting gets the dark palette too -- the same
 * mechanism `<lr-code-block>` uses for its own `[part="body"]`.
 *
 * When `heading-anchors` is set, every rendered heading's slug (computed via the shared
 * GitHub-slugger-style `Slugger`) is stamped as its `id`; `getHeadingTree()` computes that same
 * outline on every parse regardless of `heading-anchors`, so a host can build a table of contents
 * even while ids aren't in the DOM yet. `scrollToAnchor()` (from the adopted `DocumentAnchorTarget`
 * mixin) resolves `fragment` anchors against that outline and `text-quote` anchors via
 * `internal/text-quote.ts`'s shared scope/resolve helpers; `highlights` re-resolve by quote after
 * every render (never by node identity), so a highlight painted before a `streaming` update
 * finishes still finds its quote once the matching text arrives. Highlight painting uses
 * `internal/text-highlights.ts`'s `acquireHighlightHandle()` -- the CSS Custom Highlight API where
 * the browser supports it (no DOM mutation at all), a `<mark>`-wrap fallback otherwise. Quote
 * resolution indexes at most 1,000,000 code units/20,000 text nodes per content generation, bounds
 * each quote/context field to 4,096 code units and each pass to 4,000,000 scanned code units, and
 * paints at most 100 host highlights from a 1,000-entry candidate window while preserving the
 * active entry from the bounded host snapshot.
 *
 * `math` renders `$...$`/`$$...$$` TeX as MathML via the optional `katex` peer's
 * `renderToString(tex, { output: 'mathml' })` -- MathML Core renders natively and accessibly in
 * evergreen browsers with no extra stylesheet or webfont needing to cross the shadow boundary. A
 * missing `katex` peer renders the literal, unparsed TeX source (delimiters included) and fires one
 * `lr-render-error`.
 *
 * @customElement lr-markdown-core
 * @event lr-link-click - Fired (and the click prevented) when a rendered
 *   link's `href` starts with `internal-link-prefix`. `detail: { href: string }`.
 *   Ordinary external links navigate normally
 *   (in `link-target`) and never fire this event.
 * @event lr-render-error - Fired whenever rendering falls back to plain
 *   text, or `math` is set but the `katex` peer isn't installed. `detail: { error: unknown }`.
 * @event lr-highlight-activate - A painted `text-quote` highlight was clicked.
 *   `detail: { highlightId }`.
 * @event lr-text-select - Fired on selection end inside the rendered content. `detail: { text,
 *   anchor, rects }`; `anchor` is a `text-quote` `LyraAnchor` scoped to the rendered content, or
 *   `null` if the selection couldn't be anchored.
 * @event lr-anchor-result - Fired after an `anchor` property assignment or a `scrollToAnchor()`
 *   call is applied. `detail: { found }`.
 * @event lr-content-settled - Fired whenever newly-rendered content actually reaches
 *   `[part="content"]` -- including a transient plain-text fallback frame and a later async
 *   syntax-highlight upgrade, not only a final parsed render. `detail: null`. Composed and
 *   bubbling, so a host composing this element inside a free-form container (e.g.
 *   `<lr-thinking-panel>`'s default slot) can listen for it to drive auto-scroll; see that
 *   component's own docs.
 * @csspart content - The wrapper around the rendered (or plain-text
 *   fallback) output; respects `max-height`.
 * @csspart heading - Every rendered `<h1>`–`<h6>` (shifted by
 *   `heading-offset`).
 * @csspart paragraph - Every rendered `<p>`.
 * @csspart list - Every rendered `<ul>`/`<ol>`.
 * @csspart code-block - Every rendered fenced/indented `<pre>`.
 * @csspart code-block-header - Opt-in language and copy row above a built-in code block.
 * @csspart code-block-language - The source language label in the optional code-block header.
 * @csspart code-block-copy - The native source-copy button in the optional code-block header.
 * @csspart inline-code - Every rendered inline `<code>` span (backtick spans, not fenced blocks).
 * @csspart link - Every rendered `<a>`.
 * @csspart table - Every rendered `<table>`.
 * @csspart blockquote - Every rendered `<blockquote>`.
 * @csspart img - Every rendered `<img>`.
 * @csspart math - A rendered inline or block math span (`data-display="inline"|"block"`).
 * @cssprop [--lr-markdown-max-height=none] - Cap on `[part="content"]`'s block size, past which
 *   the document scrolls internally. The `maxHeight` property sets this token inline on
 *   `[part="content"]`.
 * @cssprop [--lr-markdown-font-mono=var(--lr-font-mono)] - Monospace family for rendered `<code>`
 *   inside `content`.
 * @cssprop [--lr-markdown-code-bg=var(--lr-color-brand-quiet)] - Background shared by every
 *   inline `code` span and the fenced `code-block` surface.
 * @cssprop [--lr-markdown-code-padding=var(--lr-size-0-125rem) var(--lr-size-0-3125rem)] - Padding
 *   of an inline `code` span.
 * @cssprop [--lr-markdown-code-radius=calc(var(--lr-radius) * 0.5)] - Border radius of an inline
 *   `code` span.
 * @cssprop [--lr-markdown-code-block-padding=var(--lr-space-s) var(--lr-space-m)] - Padding of the
 *   fenced `code-block` surface.
 * @cssprop [--lr-markdown-code-block-radius=var(--lr-radius)] - Border radius of the fenced
 *   `code-block` surface.
 * @cssprop [--lr-markdown-table-header-bg=var(--lr-color-brand-quiet)] - Background of every
 *   rendered `[part="table"]` header cell (`<th>`).
 * @cssprop [--lr-markdown-highlight-accent-bg=var(--lr-color-brand-quiet)] - Accent highlight fill.
 * @cssprop [--lr-markdown-highlight-success-bg=var(--lr-color-success-quiet)] - Success highlight fill.
 * @cssprop [--lr-markdown-highlight-warning-bg=var(--lr-color-warning-quiet)] - Warning highlight fill.
 * @cssprop [--lr-markdown-highlight-danger-bg=var(--lr-color-danger-quiet)] - Danger highlight fill.
 * @cssprop [--lr-markdown-highlight-neutral-bg=var(--lr-color-surface)] - Neutral highlight fill.
 * @cssprop [--lr-markdown-highlight-active-bg=var(--lr-color-brand-quiet)] - Active highlight fill.
 * @cssprop [--lr-markdown-highlight-active-outline-color=var(--lr-color-brand)] - Active
 *   highlight outline.
 * @cssprop [--lr-code-block-tab-size=2] - Tab width for a rendered fenced/indented `code-block`.
 *   Deliberately the same token (and default) `lr-code-block` and `lr-code-editor` use, so a
 *   consumer sets one tab width for every code surface — it is declared here rather than
 *   inherited because `lr-code-block` is a sibling element, not an ancestor. All code blocks preserve lines (`white-space: pre`) and scroll horizontally when needed.
 * @csspart task-list - A list consisting entirely of read-only task items.
 * @csspart task-item - A read-only task list item.
 * @csspart task-item-checked - Additional state token on a completed task item.
 * @csspart task-checkbox - The disabled checkbox of a task list item.
 * @csspart table-wrapper - The named, keyboard-focusable horizontal table scroller.
 * @cssprop [--lr-markdown-task-checkbox-size=var(--lr-size-0-875em)] - Checkbox size, including its aligned list gutter.
 * @csspart code-block-frame - The named group around a code header and its code block.
 * @csspart code-block-copy-success - Additional copy-button token during successful confirmation.
 * @csspart code-block-copy-error - Additional copy-button token during failed confirmation.
 * @cssprop [--lr-markdown-code-header-bg=var(--lr-color-surface)] - Code header background.
 * @cssprop [--lr-markdown-code-header-color=var(--lr-color-text-quiet)] - Code header foreground.
 * @event lr-copy - Fired after a code-header clipboard write succeeds, with its immutable outcome.
 * @event lr-copy-error - Fired after a code-header clipboard write fails, with its immutable outcome.
 * @csspart streaming-tail - The current uncommitted text during progressive streaming.
 * @status stable
 * @since 4.0.0
 */
export class LyraMarkdownCore extends MarkdownRuntimeBase {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    anchorJumped: LYRA_DEFAULT_anchorJumped,
    anchorJumpedToPage: LYRA_DEFAULT_anchorJumpedToPage,
    anchorNotFound: LYRA_DEFAULT_anchorNotFound,
    codeRegion: LYRA_DEFAULT_codeRegion,
    codeRegionWithLanguage: LYRA_DEFAULT_codeRegionWithLanguage,
    copiedToClipboard: LYRA_DEFAULT_copiedToClipboard,
    copyCode: LYRA_DEFAULT_copyCode,
    copyFailed: LYRA_DEFAULT_copyFailed,
    markdownTableRegion: LYRA_DEFAULT_markdownTableRegion,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles, srOnly];

  private static readonly variant = createMarkdownVariantContext(
    'lr-markdown-core',
    katexState
  );

  /** Returns the shared compatibility parser used as defaults by every core instance. Call
   * `preloadMarkdown()` before first use when the optional parser peer is not warm yet. */
  static getMarked(): Marked {
    const parser = this.variant.sharedParser.get(
      getMarkdownDepsIfLoaded()?.marked
    );
    if (!parser) {
      throw new Error(
        'LyraMarkdownCore.getMarked() requires the optional `marked` peer; await preloadMarkdown() first.'
      );
    }
    return parser;
  }

  /** Re-renders every connected `<lr-markdown-core>` instance after shared parser changes. */
  static updateAll(): void {
    for (const instance of this.variant.connectedInstances)
      instance.renderMarkdown();
  }

  /** The Markdown source to render. Removing the attribute clears the document and its tab stop. */
  @property() override content = '';

  /** Tab-stop width used to expand tabs in leading indentation before parsing. Finite values are
   * truncated and clamped to `[1, 32]`; non-finite values fall back to `4`. This is separate from
   * `--lr-code-block-tab-size`, which controls the visual width of tabs in rendered code. */
  @property({ type: Number, attribute: 'tab-size' }) override tabSize = 4;

  /** How authored raw HTML is handled: sanitized through DOMPurify (default), escaped as visible
   * text, or deliberately trusted. In escape mode, a consumer `renderer.text` or `renderer.html`
   * override replaces the escaping and is the consumer's responsibility. Independently of this,
   * every markdown-native link/image `href`/`src` is always scheme-validated
   * (`http:`/`https:`/`blob:`/`mailto:`, plus `data:` for images) unless `htmlMode` is `trusted`
   * -- a rejected scheme drops the anchor/image, rendering only its text/alt content. */
  @property({ attribute: 'html-mode' }) override htmlMode: MarkdownHtmlMode =
    'sanitize';

  /** Enable GitHub-flavored Markdown (tables, strikethrough, autolinks, task lists). */
  @property({ converter: trueDefaultBooleanConverter }) override gfm = true;

  /** `target` applied to every rendered `<a>`, with `rel="noopener
   *  noreferrer"` always added alongside it whenever a `target` is emitted.
   *  `'_blank'` (the default) preserves today's exact output. Set to `null`
   *  (or the empty string, e.g. via the `link-target=""` attribute) to omit
   *  `target`/`rel` entirely, so rendered links open in the same tab. */
  @property({ attribute: 'link-target' }) override linkTarget: string | null =
    '_blank';

  /** When set, a rendered link whose `href` starts with this prefix is
   *  treated as internal — its click is intercepted and reported via
   *  `lr-link-click` instead of navigating. Empty (the default) means
   *  every link is treated as external. */
  @property({ attribute: 'internal-link-prefix' }) override internalLinkPrefix =
    '';

  /** Added to every rendered heading's source `token.depth` before emitting
   *  `<h${depth}>` — e.g. `heading-offset="2"` renders a source `#` as
   *  `<h3>` and a source `##` as `<h4>`. The result is clamped to `[1, 6]`
   *  (a source `######` with a positive offset stays at `<h6>` rather than
   *  overflowing past the HTML heading levels; the floor at `1` is
   *  defensive, since this property is meant to be additive-only). `0`
   *  (the default) preserves today's exact `<h${token.depth}>` output. */
  @property({ type: Number, attribute: 'heading-offset' })
  override headingOffset = 0;

  /** Signals that `content` is still arriving incrementally. The default plain mode keeps
   *  accumulated source as text; progressive mode renders settled Markdown groups;
   *  the host remains `aria-busy="true"` so assistive technology knows the rendered document is
   *  not final.
   *  Reflects so a consumer can also target `lr-markdown-core[streaming]`. */
  @property({ type: Boolean, reflect: true }) override streaming = false;

  /** How content is displayed while `streaming` is true. `plain` (the default) keeps the current
   * accumulated source as plain text. `progressive` parses complete top-level Markdown blocks as
   * they settle, keeps only the mutable trailing block as text, and renders an open fenced block
   * as unhighlighted code. Once `streaming` becomes false the component performs its regular full
   * document parse, including cross-block reference links. */
  @property({ attribute: 'streaming-render' })
  override streamingRender: MarkdownStreamingRender = 'plain';

  /** Adds a language label and source-copy button to the first 200 non-empty built-in code blocks.
   * Custom code renderers and pre-escaped code bypass the header. In sanitize mode this also strips
   * authored style elements; trusted mode has no guarantee against authored visual copy deception. */
  @property({ type: Boolean, attribute: 'code-block-header' })
  override codeBlockHeader = false;

  /** Compatibility spelling for enabling the code-block header. Either property enables it. */
  @property({ type: Boolean, attribute: 'code-block-chrome' })
  override codeBlockChrome = false;

  /** Syntax-highlights fenced code blocks through the fine-grained Shiki core loader when
   *  `languages` supplies the matching grammar. The empty default language map means no fenced
   *  block is highlighted; set `false` to keep plain output even when grammars are supplied. Plain streaming defers highlighting until completion; progressive mode highlights settled blocks. */
  @property({
    attribute: 'highlight-code',
    converter: trueDefaultBooleanConverter,
  })
  override highlightCode = true;

  /** Grammar definitions this instance can highlight, e.g. `{ json: jsonGrammar }` (import from
   *  `shiki/langs/<name>.mjs`), or a lazy loader per key, e.g.
   *  `{ bash: () => import('@shikijs/langs/bash') }` -- called (at most once per key, memoized)
   *  the first time a fenced block actually requests that language -- same shape as
   *  `<lr-code-block-core>`'s own `languages`. This component has no default/full-table
   *  highlighter to fall back to -- a fenced block whose language isn't a key here always renders
   *  the plain-text fallback, and so does a key whose lazy loader rejects. Empty (the default)
   *  never highlights anything. */
  @property({ attribute: false }) override languages: Readonly<Record<
    string,
    ShikiLanguageSource
  >> = {};

  /** Stamps a computed slug as `id` on every rendered heading. `getHeadingTree()` computes the
   *  same slugs regardless of this property -- it only controls whether the `id` attribute is
   *  emitted into the rendered DOM. `false` (the default) preserves today's exact output.
   *
   *  When `htmlMode` is `sanitize` (the default), a slug whose *value* collides with a real
   *  `document` property name (e.g. a heading literally titled "Title", "Location", or "Forms"
   *  slugs to `title`/`location`/`forms`) has its `id` silently stripped by DOMPurify's DOM-
   *  clobbering protection (`SANITIZE_DOM`) -- `getHeadingTree()` still reports that heading's slug
   *  either way, but `scrollToAnchor({ kind: 'fragment', id })` still resolves it correctly even
   *  without a DOM `id` present, via its own position-based fallback lookup. */
  @property({ type: Boolean, attribute: 'heading-anchors' })
  override headingAnchors = false;

  /** Renders `$...$`/`$$...$$` TeX via the optional `katex` peer, as MathML. `false` (the
   *  default) renders `$...$` literally, unparsed -- today's exact output. */
  @property({ type: Boolean }) override math = false;

  /** A CSS length (e.g. `"20rem"`); once set, the rendered document scrolls internally past this
   * height instead of growing the page. Invalid values are ignored. */
  @property({ attribute: 'max-height' }) override maxHeight = '';

  // Deliberately not tagged internal -- these implement MarkdownRuntimeBase's own abstract
  // markdownVariant/tokenizePendingHighlight members; stripping either leaves this concrete class's
  // shipped .d.ts looking like it never implemented them, breaking the package's own build (a
  // consumer's declaration check sees `error TS2654: Non-abstract class 'LyraMarkdownCore' is
  // missing implementations for ... 'markdownVariant', 'tokenizePendingHighlight'`).
  protected override get markdownVariant(): MarkdownVariantContext {
    return LyraMarkdownCore.variant;
  }

  protected override async tokenizePendingHighlight(
    pending: PendingHighlight,
    languages: Readonly<Record<string, ShikiLanguageSource>> | undefined,
    isCurrent: () => boolean
  ): Promise<MarkdownHighlightAttempt> {
    if (!languages) return null;
    const normalizedLang = normalizeShikiLanguage(pending.lang);
    const source = languages[normalizedLang] ?? languages[pending.lang];
    if (source === undefined) return null;
    const highlighter = await loadShikiHighlighterCore(resolvedShikiLanguages(languages));
    if (!isCurrent()) return undefined;
    if (!highlighter) return null;
    const loaded = await ensureShikiLanguageLoaded(highlighter, normalizedLang, source);
    if (!isCurrent()) return undefined;
    return loaded
      ? tokenizeMarkdownHighlight(highlighter, pending, (this.codeBlockHeader || this.codeBlockChrome))
      : null;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-markdown-core': LyraMarkdownCore;
  }
}
