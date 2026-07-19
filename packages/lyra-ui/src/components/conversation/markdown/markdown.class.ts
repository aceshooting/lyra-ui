import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { OptionalPeerApi } from '../../../internal/optional-peer-types.js';
import { srOnly } from '../../../internal/a11y.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { Slugger } from '../../../internal/slugger.js';
import { DocumentAnchorTarget, type LyraAnchorTargetEventMap } from '../../../internal/anchor-target.js';
import { scopeFromElement, resolveTextQuote, buildQuoteAnchor } from '../../../internal/text-quote.js';
import { acquireHighlightHandle, supportsCustomHighlights, type HighlightHandle } from '../../../internal/text-highlights.js';
import { finiteInteger } from '../../../internal/numbers.js';
import type { LyraAnchor, LyraAnchorKind, LyraHighlightTone, HighlightActivateDetail } from '../../viewers/document-viewer/anchors.js';
import { loadMarkdownDeps, getMarkdownDepsIfLoaded, type MarkdownDeps } from './markdown-loader.js';
import {
  loadShikiHighlighter,
  loadShikiLanguage,
  loadShikiHighlighterCore,
  normalizeShikiLanguage,
  SHIKI_THEMES,
  type ShikiHighlighter,
  type ShikiHighlighterCore,
  type ShikiLanguageInput,
} from '../code-block/code-loader.js';
import { getKatex, type KatexApi } from './katex-loader.js';
import { styles } from './markdown.styles.js';

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}

/**
 * Mirrors marked's own default `link()` renderer's `cleanUrl()`: a malformed
 * percent-escape or lone UTF-16 surrogate in the raw href throws inside
 * `encodeURI`, and marked's default renderer responds by dropping the anchor
 * (rendering the link text alone) rather than emitting a broken `href` —
 * returning `null` here lets the caller do the same. The
 * `.replace(/%25/g, '%')` compensates for `encodeURI` re-escaping the `%` of
 * an href that was already percent-encoded (the common case for a real
 * markdown link) — without it, every existing `%XX` escape would become
 * `%25XX`, double-encoding it.
 */
function cleanHref(href: string): string | null {
  try {
    return encodeURI(href).replace(/%25/g, '%');
  } catch {
    return null;
  }
}

/** One pending fenced-code block discovered during a `parseMarkdown()` pass whose `(lang, code)`
 *  pair wasn't already in `highlightCache` -- collected as a side effect of the `code()` renderer so
 *  the caller (`renderMarkdown()`) knows what to highlight next, without a second pass over the
 *  source. `key` is `highlightCache`'s own lookup key for this pair. */
interface PendingHighlight {
  key: string;
  lang: string;
  code: string;
}

/** One entry of `getHeadingTree()`'s document-ordered outline. `level` already reflects
 *  `heading-offset` -- it always matches the rendered `<h${level}>` tag, not the source `#` count. */
export interface MarkdownHeadingItem {
  id: string;
  label: string;
  level: number;
}

/** Every `LyraHighlightTone`, used to always call `HighlightHandle.setRanges()` once per tone on
 *  every repaint (with an empty array for an unused tone) -- `setRanges()` replaces a tone's ranges
 *  wholesale per call, so a tone this pass has nothing for still needs an explicit empty call to
 *  clear whatever it painted last pass. */
const HIGHLIGHT_TONES: LyraHighlightTone[] = ['accent', 'success', 'warning', 'danger', 'neutral'];

/** Upper bound on `highlightCache` entries per instance. Each entry holds a fully-highlighted
 *  HTML string (potentially large for a long code block), and the cache is content-addressed --
 *  on a long-lived instance whose `content` keeps changing (a chat transcript, live docs), an
 *  unbounded map would retain the highlighted HTML of every code block ever rendered. 100 far
 *  exceeds the fenced-block count of any one document, so eviction only trims blocks that
 *  scrolled out of the content long ago. */
const HIGHLIGHT_CACHE_MAX = 100;

// -- math (KaTeX) -----------------------------------------------------------------------------

/** Resolved once per page and reused by every `<lr-markdown>` instance, mirroring
 *  `markdown-loader.ts`'s own "warm cache" shape: `undefined` means no load has been kicked off
 *  yet, `null` a load finished but the peer isn't installed, and it's set to `null` synchronously
 *  the instant a load starts as an in-flight marker so a second concurrent instance never kicks off
 *  a duplicate `getKatex()` call. */
let resolvedKatex: KatexApi | null | undefined;

/** Whether `getKatex()` has already been kicked off, module-wide -- kept separate from
 *  `resolvedKatex` so "a load is in flight" and "a load finished and the peer is confirmed
 *  missing" stay distinguishable (both would otherwise collapse to the same falsy `null`). */
let katexLoadStarted = false;

/** Test-only override bypassing the real dynamic `import('katex')` and the module cache above
 *  entirely -- `undefined` (the default) defers to `resolvedKatex`. */
let katexOverride: KatexApi | null | undefined;

/** @internal Test-only seam: forces `math` rendering to behave as if `katex` resolved to `katex`
 *  (or, with `null`, as if the optional peer failed to load). Pass `undefined` to restore the real
 *  `getKatex()`-driven behavior. */
export function __setKatexForTesting(katex: KatexApi | null | undefined): void {
  katexOverride = katex;
}

function getKatexIfLoaded(): KatexApi | null {
  return katexOverride !== undefined ? katexOverride : (resolvedKatex ?? null);
}

/** Whether the `katex` load has definitively finished with no peer available -- distinct from
 *  `getKatexIfLoaded()` returning falsy, which also covers a load that's merely still in flight
 *  (the state a math token's render-time literal fallback uses regardless of which case it is).
 *  Used only to decide whether a literal fallback should also report `lr-render-error`. */
function isKatexConfirmedMissing(): boolean {
  return (katexOverride !== undefined ? katexOverride : resolvedKatex) === null;
}

const MATH_BLOCK_RE = /^\$\$([^\n]+?)\$\$/;
const MATH_INLINE_RE = /^\$((?:\\\$|[^$\s])(?:\\\$|[^$])*?)\$(?!\$)/;

interface MathToken {
  type: 'math';
  raw: string;
  tex: string;
  display: boolean;
}

/** A marked inline-level extension recognizing `$...$` and `$$...$$` TeX. Tokenizing is
 *  synchronous (matching marked's own parse pass); actual KaTeX rendering happens in `renderMath`
 *  against whatever `getKatexIfLoaded()` already has resolved -- mirroring this component's
 *  existing two-phase pattern for fenced-code highlighting (`code()` returns a plain placeholder
 *  first; the real highlighted markup arrives one render later once shiki resolves). `renderer` is
 *  bundled directly into this same extension object (not marked's separate top-level `.use({
 *  renderer })` override hook -- that hook only recognizes the *built-in* renderer method names;
 *  a custom token type introduced via `.use({ extensions })` supplies its own renderer the same way). */
function mathExtension(renderMath: (token: MathToken) => string) {
  return {
    name: 'math',
    level: 'inline' as const,
    start(src: string): number | undefined {
      const index = src.indexOf('$');
      return index === -1 ? undefined : index;
    },
    tokenizer(src: string): MathToken | undefined {
      const block = MATH_BLOCK_RE.exec(src);
      if (block) return { type: 'math', raw: block[0], tex: block[1].trim(), display: true };
      const inline = MATH_INLINE_RE.exec(src);
      if (inline) return { type: 'math', raw: inline[0], tex: inline[1].replace(/\\\$/g, '$').trim(), display: false };
      return undefined;
    },
    renderer(token: OptionalPeerApi): string {
      return renderMath(token as MathToken);
    },
  };
}

/**
 * Rewrites shiki's generated `<pre>`/`<code>` hast nodes so the highlighted output keeps
 * `<lr-markdown>`'s own `part="code-block"` hook and a `language-${lang}` class on `<code>` --
 * matching today's plain-render output shape exactly, so existing consumer CSS targeting either
 * keeps working whether or not a given block ended up highlighted. A separate, purpose-built
 * function from `code-block.class.ts`'s own (private, non-exported) `partTransformer` -- that one
 * targets `<lr-code-block>`'s own `part="pre"`/`part="code"`/line-numbers contract, which doesn't
 * apply here.
 */
function markdownCodeTransformer(lang: string) {
  return {
    name: 'lr-markdown-code-block',
    pre(node: OptionalPeerApi) {
      node.properties.part = ['code-block'];
      delete node.properties.tabindex;
    },
    code(node: OptionalPeerApi) {
      const classes = Array.isArray(node.properties.class)
        ? node.properties.class
        : node.properties.class
          ? [node.properties.class]
          : [];
      node.properties.class = [...classes, `language-${lang}`];
    },
  };
}

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
 */
export class LyraMarkdown extends DocumentAnchorTarget(LyraMarkdownBase) {
  static styles = [LyraElement.styles, styles, srOnly];

  /** The Markdown source to render. */
  @property() content = '';

  /** Sanitize marked's HTML output with DOMPurify before rendering. See the
   *  class doc for what happens when this is `true` (the default) but the
   *  `dompurify` peer isn't installed. */
  @property({ type: Boolean }) sanitize = true;

  /** When `true`, overrides marked's `html` renderer hook to emit the HTML-escaped source text
   *  instead of passing raw/sanitized markup through -- for a consumer rendering arbitrary
   *  already-written content (e.g. a historical chat/agent transcript full of code/XML/HTML
   *  snippets) where a stray angle bracket should render as visible text, not a real DOM element.
   *  Still lets GFM tables/lists/etc. render normally -- only raw embedded HTML is affected.
   *  `false` (the default) reproduces today's exact `marked`-default (sanitized-when-`sanitize`)
   *  passthrough behavior. */
  @property({ type: Boolean, attribute: 'escape-html' }) escapeHtml = false;

  /** Enable GitHub-flavored Markdown (tables, strikethrough, autolinks, task lists). */
  @property({ type: Boolean }) gfm = true;

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
  @property({ type: Boolean, attribute: 'highlight-code' }) highlightCode = true;

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
  readonly anchorKinds: readonly LyraAnchorKind[] = ['fragment', 'text-quote'];

  // `null` covers both "the optional peers are still loading" and "a render
  // attempt just fell back after a failure" — the two states intentionally
  // look identical (plain text, see render()) since a consumer distinguishes
  // them via `lr-render-error`, not a visual difference.
  @state() private renderedHtml: string | null = null;

  private deps?: MarkdownDeps;

  /** Document-ordered heading outline computed on every parse (see `getHeadingTree()`), regardless
   *  of `headingAnchors`. */
  private headingTree: MarkdownHeadingItem[] = [];

  /** Lazily acquired the first time a highlight needs painting; released on disconnect. */
  private highlightHandle?: HighlightHandle;

  /** The most recently resolved `text-quote` highlight ranges, kept for `onContentClick()`'s
   *  coordinate hit-test -- the CSS Custom Highlight API paints ranges without creating any DOM
   *  element to attach a click listener to, so activation is resolved by comparing the click point
   *  against each range's own `getClientRects()` instead, uniformly across both paint paths. */
  private resolvedHighlightRanges: { id: string; range: Range }[] = [];

  /** Guards `lr-render-error` so a permanently-missing `katex` peer reports once per instance,
   *  not on every subsequent re-render while `math` stays on. Reset whenever `math` toggles. */
  private mathFailureReported = false;

  /** `(lang, code)` -> already-highlighted HTML, content-addressed (see `PendingHighlight`'s doc).
   *  Persists across renders of this instance; populated asynchronously by `highlightPending()`.
   *  Never consulted while `streaming` is `true` or `highlightCode` is `false` -- both gates live
   *  in the `code()` renderer inside `parseMarkdown()`. Bounded to {@link HIGHLIGHT_CACHE_MAX}
   *  entries, least-recently-used first out, via `getCachedHighlight()`/`setCachedHighlight()` --
   *  always go through those instead of the map directly so hits refresh recency. */
  private highlightCache = new Map<string, string>();

  /** LRU read: a hit is re-inserted so Map iteration order (insertion order) keeps the first key
   *  the least recently used one -- the entry `setCachedHighlight()` evicts when full. */
  private getCachedHighlight(key: string): string | undefined {
    const cached = this.highlightCache.get(key);
    if (cached !== undefined) {
      this.highlightCache.delete(key);
      this.highlightCache.set(key, cached);
    }
    return cached;
  }

  private setCachedHighlight(key: string, html: string): void {
    if (this.highlightCache.has(key)) {
      this.highlightCache.delete(key);
    } else if (this.highlightCache.size >= HIGHLIGHT_CACHE_MAX) {
      const oldest = this.highlightCache.keys().next().value;
      if (oldest !== undefined) this.highlightCache.delete(oldest);
    }
    this.highlightCache.set(key, html);
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

  /** Keys from `PendingHighlight` that failed to highlight -- peer missing, language unrecognized,
   *  or tokenization threw. Once a key lands here, `code()` stops re-discovering it as pending on
   *  every future render. Without this, a permanently-unhighlightable block (e.g. an unrecognized
   *  language) would never get cached, so every `renderMarkdown()` pass -- including the one
   *  `highlightPending()` itself triggers on completion -- would rediscover it as pending and retry
   *  it again, forever. Mirrors `code-loader.ts`'s own `unsupportedLanguages` Set, which exists for
   *  the identical reason one level down (a single unrecognized `language` value on
   *  `<lr-code-block>`). */
  private failedHighlightKeys = new Set<string>();

  connectedCallback(): void {
    super.connectedCallback();
    if (this.eagerLoad) {
      // Only takes this synchronous path when the shared module cache has
      // *already* settled (see getMarkdownDepsIfLoaded()'s doc) -- otherwise
      // falls through to the same async path as the default below, since a
      // dynamic import() can't be made synchronous from scratch.
      const alreadyLoaded = getMarkdownDepsIfLoaded();
      if (alreadyLoaded) {
        this.deps = alreadyLoaded;
        this.renderMarkdown();
        return;
      }
    }
    void loadMarkdownDeps().then((resolved) => {
      // The (module-cached, page-lifetime) loadMarkdownDeps() promise can
      // resolve after this instance was removed from the DOM -- e.g. an
      // <lr-markdown> inside a conditionally-rendered chat message or a
      // virtualized list. Without this guard, a detached instance would
      // still have its `deps` set and renderMarkdown() called, mutating the
      // @state() renderedHtml property and scheduling a Lit update no one
      // will ever see. Mirrors chart.ts's own connectedCallback() guard for
      // the identical race.
      if (!this.isConnected) return;
      this.deps = resolved;
      this.renderMarkdown();
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback(); // reaches DocumentAnchorTarget's own cleanup (anchor retry, selection binding)
    if (this.streamingRenderRaf !== undefined) {
      cancelAnimationFrame(this.streamingRenderRaf);
      this.streamingRenderRaf = undefined;
    }
    this.highlightHandle?.release();
    this.highlightHandle = undefined;
  }

  /** Binds selection -> `lr-text-select` once, on the stable `[part="content"]` wrapper --
   *  re-renders only replace that wrapper's children via `unsafeHTML`, never the wrapper itself.
   *  `bindTextSelection` is `protected` on the mixin's own narrowed return type (deliberately not
   *  part of `LyraAnchorTarget`'s public surface -- see `anchor-target.ts`'s class doc), so it's
   *  reached the same way that module's own tests do: through a cast, without declaring a no-op
   *  passthrough override just to satisfy the type checker. */
  protected firstUpdated(): void {
    const contentRoot = this.renderRoot.querySelector('[part="content"]');
    if (!contentRoot) return;
    (this as unknown as { bindTextSelection(root: Element): void }).bindTextSelection(contentRoot);
  }

  // Runs before render (not updated()) so mutating the `renderedHtml` state
  // property below is absorbed into the *same* update cycle instead of
  // scheduling a second one -- Lit's documented pattern for deriving one
  // reactive property from a change to others.
  protected willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed); // reaches DocumentAnchorTarget's own willUpdate (declarative `anchor`)
    if (changed.has('math')) this.mathFailureReported = false;
    if (!this.deps) {
      // Still loading the optional peers — the connectedCallback promise
      // above calls renderMarkdown() itself once they resolve, using
      // whatever property values are current at that time.
      return;
    }
    if (
      changed.has('content') ||
      changed.has('sanitize') ||
      changed.has('gfm') ||
      changed.has('linkTarget') ||
      changed.has('headingOffset') ||
      changed.has('escapeHtml') ||
      changed.has('streaming') ||
      changed.has('headingAnchors') ||
      changed.has('math')
    ) {
      if (this.streaming && changed.has('content')) this.scheduleStreamingRender();
      else {
        if (this.streamingRenderRaf !== undefined) {
          cancelAnimationFrame(this.streamingRenderRaf);
          this.streamingRenderRaf = undefined;
        }
        this.renderMarkdown();
      }
    }
  }

  private scheduleStreamingRender(): void {
    if (this.streamingRenderRaf !== undefined) return;
    this.streamingRenderRaf = requestAnimationFrame(() => {
      this.streamingRenderRaf = undefined;
      if (this.isConnected) this.renderMarkdown();
    });
  }

  protected async getUpdateComplete(): Promise<boolean> {
    const complete = await super.getUpdateComplete();
    if (this.streamingRenderRaf === undefined) return complete;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    return super.getUpdateComplete();
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    if (this.deps && !this.streaming) {
      this.removeAttribute('aria-busy');
    } else {
      this.setAttribute('aria-busy', 'true');
    }
    if (changed.has('renderedHtml') || changed.has('highlights') || changed.has('activeHighlightId')) {
      this.repaintHighlights();
    }
  }

  private renderMarkdown(): void {
    const deps = this.deps;
    if (!deps) return;

    if (!deps.marked) {
      // markdown-loader.ts already logged the specific import failure.
      this.applyFallback(
        new Error('<lr-markdown> could not render: the "marked" peer dependency failed to load.'),
      );
      return;
    }

    const pendingKeys: PendingHighlight[] = [];
    const headingTree: MarkdownHeadingItem[] = [];
    let rawHtml: string;
    let hadMathFallback: boolean;
    try {
      const parsed = this.parseMarkdown(deps.marked, pendingKeys, headingTree);
      rawHtml = parsed.html;
      hadMathFallback = parsed.hadMathFallback;
    } catch (error) {
      this.applyFallback(error);
      return;
    }
    this.headingTree = headingTree;
    this.maybeLoadKatex();
    // A math token rendering its literal fallback only means the `katex` peer is *confirmed*
    // missing once loading has actually settled -- otherwise this is just the same one-microtask
    // "still loading" window every other optional peer here has, and reporting it as an error
    // would be a false positive.
    const mathFailed = hadMathFallback && isKatexConfirmedMissing();

    if (!this.sanitize) {
      // Consumer explicitly opted out of sanitization — dompurify's
      // presence or absence is irrelevant to this path.
      this.renderedHtml = rawHtml;
      if (mathFailed) this.reportMathFailure();
      this.maybeHighlightPending(pendingKeys);
      return;
    }

    if (!deps.DOMPurify) {
      const error = new Error(
        '<lr-markdown> could not render: sanitize is enabled (the default) but the "dompurify" peer ' +
          'dependency failed to load — refusing to render unsanitized HTML. Install it with `pnpm add ' +
          'dompurify`, or set sanitize="false" to explicitly opt out of sanitization.',
      );
      console.warn(error.message);
      this.applyFallback(error);
      return;
    }

    // `target` is not in DOMPurify's default attribute allowlist (unlike
    // `part`/`rel`/`class`, which already are) — without ADD_ATTR here,
    // every rendered link's target="..." would be silently stripped even
    // though the anchor itself survives sanitization.
    // 'style' joins 'target' in the added-attribute allowlist -- shiki's per-token output carries
    // inline style="color:..." (theme colors), which isn't in DOMPurify's default attribute
    // allowlist any more than 'target' was.
    // `semantics`/`annotation` join the allowlist only when `math` is on -- the only KaTeX MathML
    // output elements outside DOMPurify's default allowlist. `annotation-xml` is deliberately never
    // added -- KaTeX's own MathML output never emits it, and DOMPurify's default allowlist already
    // treats it as a namespace-switching element worth keeping stripped.
    this.renderedHtml = deps.DOMPurify.sanitize(rawHtml, {
      ADD_ATTR: ['target', 'style'],
      ...(this.math ? { ADD_TAGS: ['semantics', 'annotation'] } : {}),
    });
    if (mathFailed) this.reportMathFailure();
    this.maybeHighlightPending(pendingKeys);
  }

  private applyFallback(error: unknown): void {
    this.renderedHtml = null;
    this.emit('lr-render-error', { error });
  }

  /** Kicks off the shared `katex` load the first time `math` needs it and no attempt is already
   *  in flight (module-scoped, so every `<lr-markdown>` instance on the page shares one load --
   *  mirrors `markdown-loader.ts`'s own warm-cache shape). Skipped entirely under
   *  `__setKatexForTesting()` -- that seam controls math-rendering behavior directly and must never
   *  race a real, unmocked `import('katex')` settling underneath it. */
  private maybeLoadKatex(): void {
    if (!this.math || katexLoadStarted || katexOverride !== undefined) return;
    katexLoadStarted = true;
    void getKatex().then((katex) => {
      resolvedKatex = katex;
      if (!this.isConnected) return;
      this.renderMarkdown();
    });
  }

  /** Fires `lr-render-error` once per instance for a permanently-missing `katex` peer. Called
   *  only once `renderMarkdown()` has confirmed the peer is actually missing (`katexOverride` or
   *  the resolved module is `null`) -- a math token rendering its literal fallback while the load
   *  is merely still in flight (the same one-microtask transient window every other optional peer
   *  in this component has) never reports an error on its own. */
  private reportMathFailure(): void {
    if (this.mathFailureReported) return;
    this.mathFailureReported = true;
    this.emit('lr-render-error', {
      error: new Error(
        '<lr-markdown> needs the optional peer dependency `katex` to render math (the `math` property is set) — install it with `pnpm add katex`.',
      ),
    });
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
        if (!base) {
          // The shiki peer itself isn't installed -- permanent for every key using this default
          // (non-languages) path until the page reloads.
          this.failedHighlightKeys.add(pending.key);
          return;
        }
        const ok = await loadShikiLanguage(base, pending.lang);
        hl = ok ? base : null;
      }
      if (!hl) {
        this.failedHighlightKeys.add(pending.key);
        return;
      }
      try {
        const html = hl.codeToHtml(pending.code, {
          lang: normalizedLang,
          themes: SHIKI_THEMES,
          transformers: [markdownCodeTransformer(pending.lang)],
        });
        this.setCachedHighlight(pending.key, `${html}\n`);
      } catch {
        this.failedHighlightKeys.add(pending.key);
        // Tokenization failed for a reason other than an unrecognized grammar (already handled by
        // loadShikiLanguage()'s own return value above) -- leave this key uncached, same effect as
        // an unrecognized language: permanent plain fallback for this specific block.
      }
    };

    await Promise.all(pendingKeys.map(tokenizeOne));

    if (token !== this.highlightToken || !this.isConnected) return;
    this.renderMarkdown();
  }

  private parseMarkdown(
    marked: OptionalPeerApi,
    pendingKeys: PendingHighlight[],
    headingTreeOut: MarkdownHeadingItem[],
  ): { html: string; hadMathFallback: boolean } {
    // Falsy (`null` or `''`) means the consumer explicitly opted out of
    // target="..."/rel="..." on rendered links -- see the linkTarget doc.
    // The default '_blank' is already truthy, so this preserves today's
    // exact output when the property is left unset.
    const linkTarget = this.linkTarget;
    // A raw NaN (e.g. an invalid `heading-offset` attribute) would otherwise flow straight into
    // `token.depth + headingOffset` below, producing a NaN heading depth and an invalid `<hNaN>`
    // tag -- finiteInteger() normalizes it back to the documented `0` (additive-only) default.
    const headingOffset = finiteInteger(this.headingOffset, 0);
    // Captured as a local distinct from the free function `escapeHtml` above
    // (imported/defined at the top of this file) to avoid shadowing/
    // ambiguity inside the renderer closure below, matching how
    // `linkTarget`/`headingOffset` are already captured as locals for the
    // same reason.
    const escapeHtmlOption = this.escapeHtml;
    const highlightCodeOption = this.highlightCode && !this.streaming;
    // Bound method reference (not the raw map): reads must go through the LRU accessor so a hit
    // refreshes its recency. The renderer methods below run with marked's own `this`.
    const getCachedHighlight = (key: string) => this.getCachedHighlight(key);
    const failedHighlightKeys = this.failedHighlightKeys;
    const headingAnchorsOption = this.headingAnchors;
    const slugger = new Slugger();
    const mathOption = this.math;
    const cachedKatex = mathOption ? getKatexIfLoaded() : null;
    let hadMathFallback = false;
    const instance = new marked.Marked();
    if (mathOption) {
      instance.use({
        extensions: [
          mathExtension((token) => {
            if (!cachedKatex) {
              hadMathFallback = true;
              return escapeHtml(token.display ? `$$${token.tex}$$` : `$${token.tex}$`);
            }
            try {
              const mathml = cachedKatex.renderToString(token.tex, { output: 'mathml', throwOnError: false });
              return `<span part="math" data-display="${token.display ? 'block' : 'inline'}">${mathml}</span>`;
            } catch {
              // throwOnError: false already handles a malformed-TeX render internally (KaTeX's own
              // inline error form); this catch only guards against an unexpected non-KaTeX failure,
              // e.g. a broken/incompatible peer version -- same literal fallback, no event fired.
              return escapeHtml(token.display ? `$$${token.tex}$$` : `$${token.tex}$`);
            }
          }),
        ],
      });
    }
    // A fresh renderer per parse (rather than a shared/cached one) so it
    // always closes over the *current* `linkTarget`/`headingOffset` — these
    // properties can change between renders, and marked's `.use()` otherwise
    // persists whatever renderer it was given for the lifetime of the
    // instance.
    instance.use({
      renderer: {
        heading(this: OptionalPeerApi, token: OptionalPeerApi) {
          // Clamped to [1, 6]: a positive offset can never push a heading
          // past <h6> (there is no <h7>), and the floor at 1 is defensive
          // since headingOffset is meant to be additive-only (0 is the only
          // documented non-positive value).
          const depth = Math.min(6, Math.max(1, token.depth + headingOffset));
          // Rendered through the plain textRenderer so markup never leaks into the slug -- an
          // inline <code>/<em> inside a heading collapses to plain text for slugging purposes.
          const label = this.parser.parseInline(token.tokens, this.parser.textRenderer) as string;
          const slug = slugger.slug(label);
          headingTreeOut.push({ id: slug, label, level: depth });
          const idAttr = headingAnchorsOption && slug ? ` id="${escapeHtml(slug)}"` : '';
          return `<h${depth} part="heading"${idAttr}>${this.parser.parseInline(token.tokens)}</h${depth}>\n`;
        },
        paragraph(this: OptionalPeerApi, token: OptionalPeerApi) {
          return `<p part="paragraph">${this.parser.parseInline(token.tokens)}</p>\n`;
        },
        list(this: OptionalPeerApi, token: OptionalPeerApi) {
          const ordered = token.ordered;
          const start = token.start;
          let body = '';
          for (const item of token.items) body += this.listitem(item);
          const tag = ordered ? 'ol' : 'ul';
          const startAttr = ordered && start !== 1 ? ` start="${start}"` : '';
          return `<${tag} part="list"${startAttr}>\n${body}</${tag}>\n`;
        },
        code(this: OptionalPeerApi, token: OptionalPeerApi) {
          const lang = (token.lang ?? '').trim().split(/\s+/)[0] ?? '';
          const body = `${token.text.replace(/\n$/, '')}\n`;
          const text = token.escaped ? body : escapeHtml(body);
          if (highlightCodeOption && lang) {
            const key = `${lang}\n${body}`;
            const cached = getCachedHighlight(key);
            if (cached !== undefined) return cached;
            if (!failedHighlightKeys.has(key)) pendingKeys.push({ key, lang, code: body });
          }
          const cls = lang ? ` class="language-${escapeHtml(lang)}"` : '';
          return `<pre part="code-block"><code${cls}>${text}</code></pre>\n`;
        },
        codespan(this: OptionalPeerApi, token: OptionalPeerApi) {
          // Mirrors marked's own default codespan() renderer's escaping exactly (it does not
          // pre-escape token.text itself) -- only the added part="inline-code" differs.
          return `<code part="inline-code">${escapeHtml(token.text)}</code>`;
        },
        blockquote(this: OptionalPeerApi, token: OptionalPeerApi) {
          return `<blockquote part="blockquote">\n${this.parser.parse(token.tokens)}</blockquote>\n`;
        },
        table(this: OptionalPeerApi, token: OptionalPeerApi) {
          // Built directly here (rather than delegating to the inherited
          // tablecell()) so a scope="col" can be added -- marked's own
          // default tablecell() never emits it, and without it a screen
          // reader can't reliably associate a data cell with its column
          // header beyond the simplest table.
          let headerRow = '';
          for (const cell of token.header) {
            const text = this.parser.parseInline(cell.tokens);
            const alignAttr = cell.align ? ` align="${cell.align}"` : '';
            headerRow += `<th scope="col"${alignAttr}>${text}</th>`;
          }
          let bodyRows = '';
          for (const row of token.rows) {
            let rowHtml = '';
            for (const cell of row) rowHtml += this.tablecell(cell);
            bodyRows += this.tablerow({ text: rowHtml });
          }
          const thead = `<thead>\n${this.tablerow({ text: headerRow })}</thead>\n`;
          const tbody = bodyRows ? `<tbody>${bodyRows}</tbody>\n` : '';
          return `<table part="table">\n${thead}${tbody}</table>\n`;
        },
        link(this: OptionalPeerApi, token: OptionalPeerApi) {
          const text = this.parser.parseInline(token.tokens);
          const href = cleanHref(token.href);
          if (href === null) return text;
          const titleAttr = token.title ? ` title="${escapeHtml(token.title)}"` : '';
          const targetAttr = linkTarget
            ? ` target="${escapeHtml(linkTarget)}" rel="noopener noreferrer"`
            : '';
          return `<a part="link" href="${escapeHtml(href)}"${titleAttr}${targetAttr}>${text}</a>`;
        },
        image(this: OptionalPeerApi, token: OptionalPeerApi) {
          // Mirrors marked's own default image() renderer (alt text
          // re-rendered through the plain textRenderer so nested emphasis/
          // strong/etc. inside the alt collapses to plain text, href run
          // through the same cleanHref() the link() override above uses)
          // with a part="img" added.
          const altText = this.parser.parseInline(token.tokens, this.parser.textRenderer);
          const href = cleanHref(token.href);
          if (href === null) return escapeHtml(altText);
          const titleAttr = token.title ? ` title="${escapeHtml(token.title)}"` : '';
          return `<img part="img" src="${escapeHtml(href)}" alt="${escapeHtml(altText)}"${titleAttr}>`;
        },
        html(this: OptionalPeerApi, token: OptionalPeerApi) {
          return escapeHtmlOption ? escapeHtml(token.text) : token.text;
        },
      },
    });
    return { html: instance.parse(this.content, { gfm: this.gfm, async: false }), hadMathFallback };
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
        return this.applyFragmentAnchor(root, anchor);
      case 'text-quote':
        return this.applyTextQuoteAnchor(root, anchor);
      default:
        return false;
    }
  }

  private applyFragmentAnchor(root: Element, anchor: Extract<LyraAnchor, { kind: 'fragment' }>): boolean {
    if (!anchor.id) return false;
    const known = this.headingTree.some((h) => h.id === anchor.id);
    if (!known) return false;
    const el = root.querySelector(`#${CSS.escape(anchor.id)}`) ?? this.findHeadingByComputedId(root, anchor.id);
    if (!el) return false;
    el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    return true;
  }

  /** `headingAnchors` may be off, so a target heading might carry no `id` attribute in the DOM --
   *  re-derives the same slug order `getHeadingTree()` was built in and matches by position
   *  instead of by attribute. */
  private findHeadingByComputedId(root: Element, id: string): Element | null {
    const index = this.headingTree.findIndex((h) => h.id === id);
    if (index < 0) return null;
    const headings = root.querySelectorAll('h1, h2, h3, h4, h5, h6');
    return headings[index] ?? null;
  }

  private applyTextQuoteAnchor(root: Element, anchor: Extract<LyraAnchor, { kind: 'text-quote' }>): boolean {
    const range = resolveTextQuote(scopeFromElement(root), anchor);
    if (!range) return false;
    const target = range.startContainer.nodeType === Node.ELEMENT_NODE ? (range.startContainer as Element) : range.startContainer.parentElement;
    (target ?? root).scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
    return true;
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

  /** Re-resolves every `text-quote` highlight against the current rendered content and repaints
   *  via `acquireHighlightHandle()` -- resolution is always by quote text, never by node identity,
   *  so a highlight set before its quote exists in `content` yet (e.g. mid-`streaming`) simply
   *  paints nothing until a later render's text actually contains it. `fragment` highlights aren't
   *  painted (there is no literal span of text to wrap/underline for a whole section). */
  private repaintHighlights(): void {
    this.resolvedHighlightRanges = [];
    const root = this.contentRoot();
    if (!root) return;
    const handle = this.ensureHighlightHandle();
    const scope = scopeFromElement(root);
    const rangesByTone = new Map<LyraHighlightTone, Range[]>(HIGHLIGHT_TONES.map((tone) => [tone, []]));
    let activeRange: Range | null = null;
    for (const highlight of this.highlights) {
      if (highlight.anchor.kind !== 'text-quote') continue;
      const range = resolveTextQuote(scope, highlight.anchor);
      if (!range) continue;
      rangesByTone.get(highlight.tone ?? 'accent')!.push(range);
      this.resolvedHighlightRanges.push({ id: highlight.id, range });
      if (highlight.id === this.activeHighlightId) activeRange = range;
    }
    for (const [tone, ranges] of rangesByTone) handle.setRanges(tone, ranges);
    handle.setActive(activeRange);
    if (!supportsCustomHighlights()) {
      // The `<mark>`-wrap fallback creates real elements but carries no `part` of its own (the
      // module is shared by every adopting viewer, so it can't know this component's part naming)
      // -- stamped here so a consumer can still target `::part(highlight)` in browsers lacking the
      // CSS Custom Highlight API. Nothing to stamp on the API path: no DOM element is created there.
      for (const mark of root.querySelectorAll('mark[data-lr-highlight-tone]')) {
        if (!mark.hasAttribute('part')) mark.setAttribute('part', 'highlight');
      }
    }
  }

  /** Hit-tests a click point against every currently-resolved highlight's `getClientRects()`,
   *  topmost (last-resolved) first. The CSS Custom Highlight API paints ranges without creating any
   *  DOM element to attach a click listener to, so this is the only activation path that works
   *  identically on both paint paths -- mirrors `<lr-pdf-viewer>`'s own coordinate-based
   *  `onPageClick()` hit-test for the same reason (its own painted highlights sit under a text
   *  layer that intercepts most pointer events). */
  private hitTestHighlightAt(x: number, y: number): string | null {
    for (let i = this.resolvedHighlightRanges.length - 1; i >= 0; i--) {
      const { id, range } = this.resolvedHighlightRanges[i];
      for (const rect of range.getClientRects()) {
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return id;
      }
    }
    return null;
  }

  // A single delegated listener on the content wrapper (not one per <a>) —
  // the rendered markup is fully replaced on every content change, so a
  // per-anchor listener would need re-attaching on every render anyway.
  private onContentClick = (e: MouseEvent): void => {
    const highlightId = this.hitTestHighlightAt(e.clientX, e.clientY);
    if (highlightId) {
      this.emit<HighlightActivateDetail>('lr-highlight-activate', { id: highlightId });
      return;
    }
    const prefix = this.internalLinkPrefix;
    if (!prefix) return;
    const anchor = e.composedPath().find((el): el is HTMLAnchorElement => el instanceof HTMLAnchorElement);
    if (!anchor) return;
    // Compared against the raw `href` *attribute*, not the `.href` IDL
    // property — the property is always browser-resolved to an absolute URL
    // (e.g. "https://example.com/docs") even for a relative/prefixed path,
    // which would never match a relative `internal-link-prefix`.
    const href = anchor.getAttribute('href') ?? '';
    if (!href.startsWith(prefix)) return;
    e.preventDefault();
    this.emit('lr-link-click', { href, internal: true });
  };

  render(): TemplateResult {
    const isFallback = this.renderedHtml === null;
    return html`
      <div part="content" ?data-fallback=${isFallback} @click=${this.onContentClick}>
        ${isFallback ? this.content : unsafeHTML(this.renderedHtml)}
      </div>
      ${this.renderAnchorLiveRegion()}
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-markdown': LyraMarkdown;
  }
}
