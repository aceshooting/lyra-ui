import { type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteInteger } from '../../../internal/numbers.js';
import { srOnly } from '../../../internal/a11y.js';
import { DocumentAnchorTarget, type LyraAnchorTargetEventMap } from '../../../internal/anchor-target.js';
import { scopeFromElement, buildQuoteAnchor } from '../../../internal/text-quote.js';
import { acquireHighlightHandle, type HighlightHandle } from '../../../internal/text-highlights.js';
import type { LyraAnchor, LyraAnchorKind } from '../../viewers/document-viewer/anchors.js';
import type { LyraMarkedParser, MarkdownDeps, MarkedModule } from './markdown-loader.js';
import {
  loadShikiHighlighter,
  loadShikiLanguage,
  loadShikiHighlighterCore,
  normalizeShikiLanguage,
  type ShikiHighlighter,
  type ShikiHighlighterCore,
  type ShikiLanguageInput,
} from '../code-block/code-loader.js';
import type { KatexApi } from './katex-loader.js';
import {
  applyMarkdownAriaBusy,
  applyMarkdownFragmentAnchor,
  applyMarkdownTextQuoteAnchor,
  beginMarkdownDepsLoad,
  createMarkdownKatexState,
  getCachedHighlight as getCachedHighlightShared,
  hitTestHighlightRanges,
  internalLinkHrefFrom,
  markdownHighlightConfigChanged,
  markdownLanguageSetChanged,
  markdownMathPeerError,
  markdownNeedsReparse,
  MarkdownOwnedAnimationFrameController,
  normalizeMarkdownLeadingTabs,
  parseMarkdownDocument,
  renderMarkdownContent,
  renderMarkdownDocument,
  repaintMarkdownHighlights,
  setCachedHighlight as setCachedHighlightShared,
  sharedMarkdownParser,
  tokenizeMarkdownHighlight,
  HIGHLIGHT_CACHE_MAX,
  type PendingHighlight,
  type ResolvedHighlightRange,
  type MarkdownHeadingItem as SharedMarkdownHeadingItem,
} from './markdown-shared.js';
import { styles } from './markdown.styles.js';
import { trueDefaultBooleanFromAttributeConverter as trueDefaultBooleanConverter } from '../../../internal/converters.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_anchorJumped, LYRA_DEFAULT_anchorJumpedToPage, LYRA_DEFAULT_anchorNotFound, LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_open } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** Re-exported so `markdown.ts`'s `export *` keeps exposing this from the same public path as
 *  before this type moved into the pair's shared module -- see `markdown-shared.ts`'s class doc. */
export type MarkdownHeadingItem = SharedMarkdownHeadingItem;

/** This variant's own `katex` resolution state -- see `createMarkdownKatexState()` for why
 *  `<lr-markdown-core>` deliberately owns a separate one rather than sharing this instance. */
const katexState = createMarkdownKatexState();

/** @internal Test-only seam: forces `math` rendering to behave as if `katex` resolved to `katex`
 *  (or, with `null`, as if the optional peer failed to load). Pass `undefined` to restore the real
 *  `getKatex()`-driven behavior. Declared here rather than re-exported from `markdown-shared.ts` so
 *  `stripInternal` keeps it out of the shipped `.d.ts` exactly as before. */
export function __setKatexForTesting(katex: KatexApi | null | undefined): void {
  katexState.setForTesting(katex);
}

/** `true`-defaulting boolean attribute converter -- Lit's default presence-based `type: Boolean`
 *  can never be set back to `false` from a plain-HTML attribute once the property's own default is
 *  `true` (removing an attribute that was never present fires no `attributeChangedCallback`), so
 *  `fromAttribute` checks the literal string instead. Shared by `sanitize`, `gfm`, and
 *  `highlightCode`, which have the identical `true`-default parsing need. */

export interface LyraMarkdownEventMap extends LyraAnchorTargetEventMap {
  'lr-render-error': CustomEvent<{ error: unknown }>;
  'lr-link-click': CustomEvent<{ href: string; internal: boolean }>;
}

class LyraMarkdownBase extends LyraElement<LyraMarkdownEventMap> {}

/**
 * `<lr-markdown>` — sanitized Markdown-to-HTML rendering (GFM tables,
 * fenced code blocks, links, blockquotes) built on the optional peer
 * dependencies `marked` (parsing) and `dompurify` (sanitizing), both
 * lazy-loaded via `markdown-loader.ts` on first connect.
 *
 * Rendering never ships unsanitized or broken markup silently:
 * - If `marked` fails to load, or throws while parsing malformed input, the
 *   component falls back to plain text (`white-space: pre-wrap`, no HTML
 *   parsing at all) and fires `lr-render-error`.
 * - If `sanitize` is `true` (the default) and `dompurify` fails to load, the
 *   component *also* falls back to plain text + `lr-render-error` — it
 *   never renders marked's raw HTML output when sanitization was requested
 *   (or defaulted to) but is unavailable, even though `marked` itself loaded
 *   fine.
 * - If `sanitize` is explicitly `false`, marked's raw output renders as-is
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
 * a second render replaces it with the real Markdown output. Set
 * `eager-load` to skip that window once the shared dependency cache is
 * already warm; see that property's doc for exactly what "warm" requires.
 * Disconnecting and reconnecting while the shared load is pending invalidates the earlier
 * connection's settlement callback, so the current connection parses only once.
 *
 * `heading`/`code`/`blockquote`/`table`/`link`/`image` tokens are rendered
 * through a `marked` renderer override that injects `part="..."` attributes
 * directly into the produced HTML — a single pass, not a second DOM walk
 * after insertion.
 *
 * Fenced code blocks are syntax-highlighted via the same optional `shiki` peer `<lr-code-block>`
 * uses (`highlightCode`, default `true` — a pure upgrade gated by whether `shiki` is installed at
 * all, not a separate opt-in). `languages`/`languagesOnly` mirror `<lr-code-block>`'s own
 * fine-grained bundle-size controls. The very first render of any content is always plain
 * (identical to today's output); highlighting arrives as an asynchronous upgrade one render later,
 * once shiki resolves. No highlighting is attempted while `streaming` is `true` — it applies once a
 * stream settles, so there is no added per-chunk cost while content is still arriving.
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
 * the browser supports it (no DOM mutation at all), a `<mark>`-wrap fallback otherwise.
 *
 * `math` renders `$...$`/`$$...$$` TeX as MathML via the optional `katex` peer's
 * `renderToString(tex, { output: 'mathml' })` -- MathML Core renders natively and accessibly in
 * evergreen browsers with no extra stylesheet or webfont needing to cross the shadow boundary. A
 * missing `katex` peer renders the literal, unparsed TeX source (delimiters included) and fires one
 * `lr-render-error`.
 *
 * @customElement lr-markdown
 * @event lr-link-click - Fired (and the click prevented) when a rendered
 *   link's `href` starts with `internal-link-prefix`. `detail: { href:
 *   string, internal: true }`. Ordinary external links navigate normally
 *   (in `link-target`) and never fire this event.
 * @event lr-render-error - Fired whenever rendering falls back to plain
 *   text, or `math` is set but the `katex` peer isn't installed. `detail: { error: unknown }`.
 * @event lr-highlight-activate - A painted `text-quote` highlight was clicked. `detail: { id }`.
 * @event lr-text-select - Fired on selection end inside the rendered content. `detail: { text,
 *   anchor, rects }`; `anchor` is a `text-quote` `LyraAnchor` scoped to the rendered content, or
 *   `null` if the selection couldn't be anchored.
 * @event lr-anchor-result - Fired after an `anchor` property assignment or a `scrollToAnchor()`
 *   call is applied. `detail: { found }`.
 * @csspart content - The wrapper around the rendered (or plain-text
 *   fallback) output.
 * @csspart heading - Every rendered `<h1>`–`<h6>` (shifted by
 *   `heading-offset`).
 * @csspart paragraph - Every rendered `<p>`.
 * @csspart list - Every rendered `<ul>`/`<ol>`.
 * @csspart code-block - Every rendered fenced/indented `<pre>`.
 * @csspart inline-code - Every rendered inline `<code>` span (backtick spans, not fenced blocks).
 * @csspart link - Every rendered `<a>`.
 * @csspart table - Every rendered `<table>`.
 * @csspart blockquote - Every rendered `<blockquote>`.
 * @csspart img - Every rendered `<img>`.
 * @csspart math - A rendered inline or block math span (`data-display="inline"|"block"`).
 * @cssprop [--lr-markdown-font-mono=var(--lr-font-mono)] - Monospace family for rendered `<code>`
 *   inside `content`.
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
 *   inherited because `lr-code-block` is a sibling element, not an ancestor. A markdown code
 *   block wraps (`white-space: pre-wrap`) while `lr-code-block` does not, so the same value can
 *   render differently on a wrapped line, where tab stops restart.
 * @status stable
 * @since 4.0.0
 */
export class LyraMarkdown extends DocumentAnchorTarget(LyraMarkdownBase) {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    anchorJumped: LYRA_DEFAULT_anchorJumped,
    anchorJumpedToPage: LYRA_DEFAULT_anchorJumpedToPage,
    anchorNotFound: LYRA_DEFAULT_anchorNotFound,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    open: LYRA_DEFAULT_open,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles, srOnly];

  /** The Markdown source to render. */
  @property() content = '';

  /** Tab-stop width used when converting tabs in leading indentation to spaces before parsing.
   *  Defaults to `4`; non-finite values fall back to that default and finite values are truncated
   *  and clamped to `[1, 32]` before use. This does not change tabs inside ordinary text or the
   *  separate `--lr-code-block-tab-size` used to display rendered code. */
  @property({ type: Number, attribute: 'tab-size' }) tabSize = 4;

  /** Sanitize marked's HTML output with DOMPurify before rendering. See the
   *  class doc for what happens when this is `true` (the default) but the
   *  `dompurify` peer isn't installed. */
  @property({ converter: trueDefaultBooleanConverter }) sanitize = true;

  /** When `true`, overrides marked's `html` renderer hook to emit the HTML-escaped source text
   *  instead of passing raw/sanitized markup through -- for a consumer rendering arbitrary
   *  already-written content (e.g. a historical chat/agent transcript full of code/XML/HTML
   *  snippets) where a stray angle bracket should render as visible text, not a real DOM element.
   *  Still lets GFM tables/lists/etc. render normally -- only raw embedded HTML is affected.
   *  `false` (the default) reproduces today's exact `marked`-default (sanitized-when-`sanitize`)
   *  passthrough behavior. */
  @property({ type: Boolean, attribute: 'escape-html' }) escapeHtml = false;

  /** Enable GitHub-flavored Markdown (tables, strikethrough, autolinks, task lists). */
  @property({ converter: trueDefaultBooleanConverter }) gfm = true;

  /** `target` applied to every rendered `<a>`, with `rel="noopener
   *  noreferrer"` always added alongside it whenever a `target` is emitted.
   *  `'_blank'` (the default) preserves today's exact output. Set to `null`
   *  (or the empty string, e.g. via the `link-target=""` attribute) to omit
   *  `target`/`rel` entirely, so rendered links open in the same tab. */
  @property({ attribute: 'link-target' }) linkTarget: string | null = '_blank';

  /** When set, a rendered link whose `href` starts with this prefix is
   *  treated as internal — its click is intercepted and reported via
   *  `lr-link-click` instead of navigating. Empty (the default) means
   *  every link is treated as external. */
  @property({ attribute: 'internal-link-prefix' }) internalLinkPrefix = '';

  /** Added to every rendered heading's source `token.depth` before emitting
   *  `<h${depth}>` — e.g. `heading-offset="2"` renders a source `#` as
   *  `<h3>` and a source `##` as `<h4>`. The result is clamped to `[1, 6]`
   *  (a source `######` with a positive offset stays at `<h6>` rather than
   *  overflowing past the HTML heading levels; the floor at `1` is
   *  defensive, since this property is meant to be additive-only). `0`
   *  (the default) preserves today's exact `<h${token.depth}>` output. */
  @property({ type: Number, attribute: 'heading-offset' }) headingOffset = 0;

  /** When `true`, `connectedCallback()` skips awaiting `loadMarkdownDeps()`'s
   *  dynamic `import()` if the shared `marked`/`dompurify` module cache (see
   *  `markdown-loader.ts`'s `getMarkdownDepsIfLoaded()`) has *already*
   *  resolved — e.g. because an earlier `<lr-markdown>` instance on the
   *  page already finished loading, or the consumer primed the cache
   *  directly by calling `loadMarkdownDeps()` themselves at startup — and
   *  renders synchronously instead. When the cache isn't warm yet (most
   *  notably: the very first `<lr-markdown>` ever connected on a page,
   *  since nothing has called `loadMarkdownDeps()` before it), this still
   *  falls back to the normal async path — a dynamic `import()` can't be
   *  made synchronous, so this is a fast path for the common "already warm"
   *  case, not a hard guarantee. `false` (the default) is byte-identical to
   *  today: always the async `import()`, fallback-text window included. */
  @property({ type: Boolean, attribute: 'eager-load' }) eagerLoad = false;

  /** Signals that `content` is still arriving incrementally. Content changes
   *  are coalesced to at most one parse per animation frame while this is
   *  `true`; the host remains `aria-busy="true"` so assistive technology knows
   *  the rendered document is not final. Set it back to `false` with the final
   *  content update to flush the latest content immediately.
   *  Reflects so a consumer can also target `lr-markdown[streaming]`. */
  @property({ type: Boolean, reflect: true }) streaming = false;

  /** Syntax-highlights fenced code blocks via the same optional `shiki` peer `<lr-code-block>`
   *  uses. `true` (the default) upgrades every fenced block from plain `<pre><code>` once the peer
   *  is available -- a pure upgrade, not a behavior change gated on opt-in, since it's itself gated
   *  transparently by whether `shiki` is installed at all (an app that never installs it sees
   *  byte-identical output to today). Set `false` to keep plain output even when `shiki` is
   *  installed. No effect while `streaming` is `true` -- see that property's own doc. */
  @property({ attribute: 'highlight-code', converter: trueDefaultBooleanConverter }) highlightCode = true;

  /** Same shape and purpose as `<lr-code-block>`'s own `languages` -- a fine-grained, explicit
   *  language-grammar bundle scoping shiki's build output to just those grammars instead of its
   *  full ~200-language bundle. Forwarded verbatim to `loadShikiHighlighterCore()`. Unset uses the
   *  default full-bundle loader, unchanged from how `<lr-code-block>` itself defaults. */
  @property({ attribute: false }) languages?: Record<string, ShikiLanguageInput>;

  /** Same purpose as `<lr-code-block>`'s own `languagesOnly` -- skips the default full-bundle
   *  loader entirely, so a fenced block whose language isn't in `languages` falls back to plain
   *  unhighlighted text rather than reaching for the full bundle. No effect unless `languages` is
   *  also set. */
  @property({ type: Boolean, attribute: 'languages-only' }) languagesOnly = false;

  /** Stamps a computed slug as `id` on every rendered heading. `getHeadingTree()` computes the
   *  same slugs regardless of this property -- it only controls whether the `id` attribute is
   *  emitted into the rendered DOM. `false` (the default) preserves today's exact output.
   *
   *  When `sanitize` is also on (the default), a slug whose *value* collides with a real
   *  `document` property name (e.g. a heading literally titled "Title", "Location", or "Forms"
   *  slugs to `title`/`location`/`forms`) has its `id` silently stripped by DOMPurify's DOM-
   *  clobbering protection (`SANITIZE_DOM`) -- `getHeadingTree()` still reports that heading's slug
   *  either way, but `scrollToAnchor({ kind: 'fragment', id })` still resolves it correctly even
   *  without a DOM `id` present, via its own position-based fallback lookup. */
  @property({ type: Boolean, attribute: 'heading-anchors' }) headingAnchors = false;

  /** Renders `$...$`/`$$...$$` TeX via the optional `katex` peer, as MathML. `false` (the
   *  default) renders `$...$` literally, unparsed -- today's exact output. */
  @property({ type: Boolean }) math = false;

  /** Anchor kinds this component resolves via `scrollToAnchor()`. Readonly. */
  override readonly anchorKinds: readonly LyraAnchorKind[] = ['fragment', 'text-quote'];

  // `null` covers both "the optional peers are still loading" and "a render
  // attempt just fell back after a failure" — the two states intentionally
  // look identical (plain text, see render()) since a consumer distinguishes
  // them via `lr-render-error`, not a visual difference.
  @state() private renderedHtml: string | null = null;

  private deps?: MarkdownDeps;

  /** The configurable `marked.Marked` parser shared by both Markdown variants on this page. It is
   *  `undefined` only while the optional `marked` peer is unresolved or unavailable.
   *  Configuration installed with `marked.use()` is copied into each fresh internal parse; call
   *  `renderMarkdown()` to refresh existing content after changing that configuration. */
  get marked(): LyraMarkedParser | undefined {
    return sharedMarkdownParser(this.deps?.marked);
  }

  /** Document-ordered heading outline computed on every parse (see `getHeadingTree()`), regardless
   *  of `headingAnchors`. */
  private headingTree: MarkdownHeadingItem[] = [];

  /** Lazily acquired the first time a highlight needs painting; released on disconnect. */
  private highlightHandle?: HighlightHandle;

  /** The most recently resolved `text-quote` highlight ranges, kept for `onContentClick()`'s
   *  coordinate hit-test -- the CSS Custom Highlight API paints ranges without creating any DOM
   *  element to attach a click listener to, so activation is resolved by comparing the click point
   *  against each range's own `getClientRects()` instead, uniformly across both paint paths. */
  private resolvedHighlightRanges: ResolvedHighlightRange[] = [];

  /** Guards `lr-render-error` so a permanently-missing `katex` peer reports once per instance,
   *  not on every subsequent re-render while `math` stays on. Reset whenever `math` toggles. */
  private mathFailureReported = false;

  /** `(lang, code)` -> already-highlighted HTML, content-addressed (see `PendingHighlight`'s doc).
   *  Persists across renders of this instance; populated asynchronously by `highlightPending()`.
   *  Never consulted while `streaming` is `true` or `highlightCode` is `false` -- both gates live
   *  in the `code()` renderer inside `parseMarkdownDocument()`. Bounded to `HIGHLIGHT_CACHE_MAX`
   *  entries (see `markdown-shared.ts`), least-recently-used first out, via
   *  `getCachedHighlight()`/`setCachedHighlight()` -- always go through those instead of the map
   *  directly so hits refresh recency. */
  private highlightCache = new Map<string, string>();

  /** LRU read: a hit is re-inserted so Map iteration order (insertion order) keeps the first key
   *  the least recently used one -- the entry `setCachedHighlight()` evicts when full. Thin
   *  instance-bound wrapper around the shared, `<lr-markdown-core>`-sharing implementation in
   *  `markdown-shared.ts`. */
  private getCachedHighlight(key: string): string | undefined {
    return getCachedHighlightShared(this.highlightCache, key);
  }

  private setCachedHighlight(key: string, html: string): void {
    setCachedHighlightShared(this.highlightCache, key, html, HIGHLIGHT_CACHE_MAX);
  }

  /** Bumped on every `highlightPending()` call, including ones that end up not actually loading
   *  anything -- guards against a newer `content`/`streaming` change superseding an older in-flight
   *  highlight, exactly mirroring `<lr-code-block>`'s own `highlightToken` field for the identical
   *  race (an async grammar load resolving after a newer call already produced correct output). */
  private highlightToken = 0;

  /** Coalesces rapid streaming content assignments so a token burst cannot start one full
   *  Markdown parse per assignment. The final `streaming = false` update cancels this frame and
   *  renders synchronously, so consumers never lose the last chunk. */
  private streamingRenderRaf?: number;
  /** The browsing context and settlement hook for `streamingRenderRaf`; RAF handles are
   *  realm-local, and disconnect/adoption must settle a pending `updateComplete` wait. */
  private readonly streamingRenderFrames = new MarkdownOwnedAnimationFrameController();
  /** Stable identity lets the shared KaTeX state de-duplicate this instance across any repeated
   *  renders while the peer load is still in flight. */
  private readonly handleKatexResolved = (): void => {
    if (!this.isConnected) return;
    this.renderMarkdown();
  };

  /** Keys from `PendingHighlight` that failed to highlight -- peer missing, language unrecognized,
   *  or tokenization threw. Once a key lands here, `code()` stops re-discovering it as pending on
   *  every future render. Without this, a permanently-unhighlightable block (e.g. an unrecognized
   *  language) would never get cached, so every `renderMarkdown()` pass -- including the one
   *  `highlightPending()` itself triggers on completion -- would rediscover it as pending and retry
   *  it again, forever. Mirrors `code-loader.ts`'s own `unsupportedLanguages` Set, which exists for
   *  the identical reason one level down (a single unrecognized `language` value on
   *  `<lr-code-block>`). */
  private failedHighlightKeys = new Set<string>();

  override connectedCallback(): void {
    super.connectedCallback();
    beginMarkdownDepsLoad(this, (resolved) => {
      this.deps = resolved;
      this.renderMarkdown();
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback(); // reaches DocumentAnchorTarget's own cleanup (anchor retry, selection binding)
    this.cancelStreamingRender();
    this.highlightHandle?.release();
    this.highlightHandle = undefined;
  }

  adoptedCallback(): void {
    this.cancelStreamingRender();
  }

  /** Binds selection -> `lr-text-select` once, on the stable `[part="content"]` wrapper --
   *  re-renders only replace that wrapper's children via `unsafeHTML`, never the wrapper itself.
   *  `bindTextSelection` is `protected` on the mixin's own narrowed return type (deliberately not
   *  part of `LyraAnchorTarget`'s public surface -- see `anchor-target.ts`'s class doc), so it's
   *  reached the same way that module's own tests do: through a cast, without declaring a no-op
   *  passthrough override just to satisfy the type checker. */
  protected override firstUpdated(): void {
    const contentRoot = this.renderRoot.querySelector('[part="content"]');
    if (!contentRoot) return;
    (this as unknown as { bindTextSelection(root: Element): void }).bindTextSelection(contentRoot);
  }

  // Runs before render (not updated()) so mutating the `renderedHtml` state
  // property below is absorbed into the *same* update cycle instead of
  // scheduling a second one -- Lit's documented pattern for deriving one
  // reactive property from a change to others.
  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed); // reaches DocumentAnchorTarget's own willUpdate (declarative `anchor`)
    if (changed.has('math')) this.mathFailureReported = false;
    if (!this.deps) {
      // Still loading the optional peers — the connectedCallback promise
      // above calls renderMarkdown() itself once they resolve, using
      // whatever property values are current at that time.
      return;
    }
    if (!markdownNeedsReparse(changed)) return;
    if (markdownHighlightConfigChanged(changed)) {
      this.highlightToken++;
      this.failedHighlightKeys.clear();
      if (markdownLanguageSetChanged(changed)) this.highlightCache.clear();
    }
    if (this.streaming && changed.has('content')) this.scheduleStreamingRender();
    else {
      this.cancelStreamingRender();
      this.renderMarkdown();
    }
  }

  private cancelStreamingRender(): void {
    const handle = this.streamingRenderRaf;
    this.streamingRenderRaf = undefined;
    if (!this.streamingRenderFrames.cancel() && handle !== undefined) {
      this.ownerDocument.defaultView?.cancelAnimationFrame(handle);
    }
  }

  private scheduleStreamingRender(): void {
    if (this.streamingRenderRaf !== undefined) return;
    const view = this.ownerDocument.defaultView;
    if (!view) {
      if (this.isConnected) this.renderMarkdown();
      return;
    }
    const handle = this.streamingRenderFrames.request(view, () => {
      this.streamingRenderRaf = undefined;
      if (this.isConnected && this.ownerDocument.defaultView === view) this.renderMarkdown();
    });
    if (handle === undefined) {
      if (this.isConnected) this.renderMarkdown();
    } else if (this.streamingRenderFrames.handle === handle) {
      this.streamingRenderRaf = handle;
    }
  }

  protected override async getUpdateComplete(): Promise<boolean> {
    const complete = await super.getUpdateComplete();
    const settled = this.streamingRenderFrames.settled;
    if (!settled) return complete;
    await settled;
    return super.getUpdateComplete();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    applyMarkdownAriaBusy(this, !this.deps || this.streaming);
    if (changed.has('renderedHtml') || changed.has('highlights') || changed.has('activeHighlightId')) {
      this.repaintHighlights();
    }
  }

  /** Renders the current `content` through the shared parse/sanitize/fallback pipeline and applies
   *  the result immediately. This is the public refresh point after configuring `marked` with
   *  `marked.use()`. It returns `void` and safely no-ops while the optional parser is unresolved. */
  renderMarkdown(): void {
    const deps = this.deps;
    if (!deps) return;
    const outcome = renderMarkdownDocument({
      tag: 'lr-markdown',
      deps,
      sanitize: this.sanitize,
      math: this.math,
      parse: (marked, pendingKeys, headingTreeOut) => this.parseMarkdown(marked, pendingKeys, headingTreeOut),
      onParsed: () => this.maybeLoadKatex(),
      isKatexConfirmedMissing: () => katexState.isConfirmedMissing(),
    });
    // Non-null whenever the parse itself succeeded -- including the dompurify-missing fallback,
    // which still computed a real outline before refusing to render.
    if (outcome.headingTree) this.headingTree = outcome.headingTree;
    if (outcome.status === 'fallback') {
      this.applyFallback(outcome.error);
      return;
    }
    this.renderedHtml = outcome.html;
    if (outcome.mathFailed) this.reportMathFailure();
    this.maybeHighlightPending(outcome.pendingKeys);
  }

  private applyFallback(error: unknown): void {
    this.renderedHtml = null;
    this.emit('lr-render-error', { error });
  }

  /** Kicks off this variant's `katex` load the first time `math` needs it and no attempt is
   *  already in flight (module-scoped, so every `<lr-markdown>` instance on the page shares one
   *  load -- mirrors `markdown-loader.ts`'s own warm-cache shape). Skipped entirely under
   *  `__setKatexForTesting()` -- that seam controls math-rendering behavior directly and must never
   *  race a real, unmocked `import('katex')` settling underneath it. */
  private maybeLoadKatex(): void {
    if (!this.math) return;
    katexState.startLoad(this.handleKatexResolved);
  }

  /** Fires `lr-render-error` once per instance for a permanently-missing `katex` peer. Called
   *  only once `renderMarkdown()` has confirmed the peer is actually missing (the test override or
   *  the resolved module is `null`) -- a math token rendering its literal fallback while the load
   *  is merely still in flight (the same one-microtask transient window every other optional peer
   *  in this component has) never reports an error on its own. */
  private reportMathFailure(): void {
    if (this.mathFailureReported) return;
    this.mathFailureReported = true;
    this.emit('lr-render-error', { error: markdownMathPeerError('lr-markdown') });
  }

  /** Kicks off async highlighting for `pendingKeys` (see `highlightPending()`) unless there's
   *  nothing to do, `highlightCode` is off, or `streaming` is on -- called from both of
   *  `renderMarkdown()`'s exit points (the `sanitize=false` early return and the normal sanitized
   *  path), since highlighting is independent of that decision. */
  private maybeHighlightPending(pendingKeys: PendingHighlight[]): void {
    if (pendingKeys.length === 0 || !this.highlightCode || this.streaming) return;
    void this.highlightPending(pendingKeys);
  }

  /** Loads whatever shiki grammars `pendingKeys` need, tokenizes each pending block concurrently,
   *  populates `highlightCache` with the results, then triggers one more `renderMarkdown()` pass so
   *  the newly-cached entries actually reach the screen. A pending key whose language fails to load
   *  is recorded in `failedHighlightKeys` (per `loadShikiLanguage()`'s existing "unrecognized
   *  grammar" contract -- resolves `false`, never throws) -- it stays uncached, so `code()` keeps
   *  emitting its plain fallback for it on every future render, and `code()` also stops
   *  re-discovering it as pending (see `failedHighlightKeys`'s own doc for why that matters: without
   *  it, the `renderMarkdown()` call at the end of this method would rediscover the same
   *  permanently-uncacheable key as pending on every pass, forever). Does not block or delay any
   *  other pending key -- each is tried independently via `Promise.all`. */
  private async highlightPending(pendingKeys: PendingHighlight[]): Promise<void> {
    const token = ++this.highlightToken;
    const languages = this.languages;

    const tokenizeOne = async (pending: PendingHighlight): Promise<void> => {
      const normalizedLang = normalizeShikiLanguage(pending.lang);
      let hl: ShikiHighlighter | ShikiHighlighterCore | null;
      if (languages && (languages[normalizedLang] ?? languages[pending.lang])) {
        hl = await loadShikiHighlighterCore(languages);
      } else if (this.languagesOnly) {
        // languagesOnly skips the default full-bundle loader entirely (mirrors <lr-code-block>) --
        // permanent for this key: failedHighlightKeys is never cleared, and languages/languagesOnly
        // aren't in willUpdate()'s trigger list, so changing either doesn't retry it on its own.
        this.failedHighlightKeys.add(pending.key);
        return;
      } else {
        const base = await loadShikiHighlighter();
        if (token !== this.highlightToken || !this.isConnected) return;
        if (!base) {
          // The shiki peer itself isn't installed -- permanent for every key using this default
          // (non-languages) path until the page reloads.
          this.failedHighlightKeys.add(pending.key);
          return;
        }
        const ok = await loadShikiLanguage(base, pending.lang);
        if (token !== this.highlightToken || !this.isConnected) return;
        hl = ok ? base : null;
      }
      if (token !== this.highlightToken || !this.isConnected) return;
      if (!hl) {
        this.failedHighlightKeys.add(pending.key);
        return;
      }
      const html = tokenizeMarkdownHighlight(hl, pending);
      if (html === null) this.failedHighlightKeys.add(pending.key);
      else this.setCachedHighlight(pending.key, html);
    };

    await Promise.all(pendingKeys.map(tokenizeOne));

    if (token !== this.highlightToken || !this.isConnected) return;
    this.renderMarkdown();
  }

  /** Thin instance-bound wrapper around the shared, `<lr-markdown-core>`-sharing implementation in
   *  `markdown-shared.ts` -- resolves every input `parseMarkdownDocument()` needs from this
   *  instance's own properties/state, byte-identical to this method's pre-extraction behavior. */
  private parseMarkdown(
    marked: MarkedModule,
    pendingKeys: PendingHighlight[],
    headingTreeOut: MarkdownHeadingItem[]
  ): { html: string; hadMathFallback: boolean } {
    return parseMarkdownDocument({
      marked,
      content: normalizeMarkdownLeadingTabs(this.content, finiteInteger(this.tabSize, 4, 1, 32)),
      markedConfiguration: sharedMarkdownParser(marked)?.defaults,
      gfm: this.gfm,
      // Falsy (`null` or `''`) means the consumer explicitly opted out of
      // target="..."/rel="..." on rendered links -- see the linkTarget doc.
      // The default '_blank' is already truthy, so this preserves today's
      // exact output when the property is left unset.
      linkTarget: this.linkTarget,
      headingOffset: finiteInteger(this.headingOffset, 0, 0, 6),
      escapeHtmlOption: this.escapeHtml,
      highlightCodeOption: this.highlightCode && !this.streaming,
      // Bound method reference (not the raw map): reads must go through the LRU accessor so a hit
      // refreshes its recency.
      getCachedHighlight: (key: string) => this.getCachedHighlight(key),
      failedHighlightKeys: this.failedHighlightKeys,
      headingAnchorsOption: this.headingAnchors,
      mathOption: this.math,
      cachedKatex: this.math ? katexState.getIfLoaded() : null,
      pendingKeys,
      headingTreeOut,
    });
  }

  /** A document-ordered, flattened heading outline -- computed on every parse regardless of
   *  `headingAnchors` (see that property's own doc). A caller building a table of contents can rely
   *  on this even while `heading-anchors` is off. */
  getHeadingTree(): MarkdownHeadingItem[] {
    return [...this.headingTree];
  }

  private contentRoot(): Element | null {
    return this.renderRoot.querySelector('[part="content"]');
  }

  // -- anchor-target: applyAnchor per kind -----------------------------------------------------

  protected async applyAnchor(anchor: LyraAnchor): Promise<boolean> {
    const root = this.contentRoot();
    if (!root) return false;
    switch (anchor.kind) {
      case 'fragment':
        return applyMarkdownFragmentAnchor(root, anchor, this.headingTree);
      case 'text-quote':
        return applyMarkdownTextQuoteAnchor(root, anchor, this.effectiveLocale);
      default:
        return false;
    }
  }

  /** Overrides `DocumentAnchorTarget`'s default (whole render-root) selection scope, matching
   *  `heading`'s slug computation and `applyTextQuoteAnchor()` above: only `[part="content"]` is a
   *  meaningful text-quote scope, so a selection that somehow reaches outside it (there is no other
   *  text in this component's shadow tree today, but the live region could grow one) never leaks
   *  into a captured anchor. */
  protected computeSelectionAnchor(range: Range): LyraAnchor | null {
    const root = this.contentRoot();
    if (!root) return null;
    return buildQuoteAnchor(range, scopeFromElement(root));
  }

  // -- highlight painting ------------------------------------------------------------------------

  private ensureHighlightHandle(): HighlightHandle {
    if (!this.highlightHandle) this.highlightHandle = acquireHighlightHandle(this, this.ownerDocument);
    return this.highlightHandle;
  }

  /** Re-resolves and repaints every `text-quote` highlight -- see
   *  `repaintMarkdownHighlights()` for the resolution contract. */
  private repaintHighlights(): void {
    this.resolvedHighlightRanges = [];
    const root = this.contentRoot();
    if (!root) return;
    this.resolvedHighlightRanges = repaintMarkdownHighlights({
      locale: this.effectiveLocale,
      root,
      handle: this.ensureHighlightHandle(),
      highlights: this.highlights,
      activeHighlightId: this.activeHighlightId,
    });
  }

  // A single delegated listener on the content wrapper (not one per <a>) —
  // the rendered markup is fully replaced on every content change, so a
  // per-anchor listener would need re-attaching on every render anyway.
  private onContentClick = (e: MouseEvent): void => {
    const highlightId = hitTestHighlightRanges(this.resolvedHighlightRanges, e.clientX, e.clientY);
    if (highlightId) {
      this.emit('lr-highlight-activate', { id: highlightId });
      return;
    }
    const href = internalLinkHrefFrom(e, this.internalLinkPrefix);
    if (href === null) return;
    e.preventDefault();
    this.emit('lr-link-click', { href, internal: true });
  };

  override render(): TemplateResult {
    return renderMarkdownContent({
      content: this.content,
      renderedHtml: this.renderedHtml,
      hostAriaLabel: this.getAttribute('aria-label'),
      onClick: this.onContentClick,
      liveRegion: this.renderAnchorLiveRegion(),
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-markdown': LyraMarkdown;
  }
}
