import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { srOnly } from '../../../internal/a11y.js';
import type { LyraAnchorTargetEventMap } from '../../../internal/anchor-target.js';
import {
  getMarkdownDepsIfLoaded,
  type LyraMarkedParser,
} from './markdown-loader.js';
import {
  loadShikiHighlighterCore,
  normalizeShikiLanguage,
  type ShikiLanguageInput,
} from '../code-block/shiki-types.js';
import {
  createMarkdownKatexState,
  tokenizeMarkdownHighlight,
  type PendingHighlight,
  type MarkdownHeadingItem as SharedMarkdownHeadingItem,
  type MarkdownHtmlMode,
} from './markdown-shared.js';
import {
  createMarkdownVariantContext,
  MarkdownRuntimeBase,
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
import { LYRA_DEFAULT_anchorJumped, LYRA_DEFAULT_anchorJumpedToPage, LYRA_DEFAULT_anchorNotFound } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** Re-exported so `markdown-core.ts`'s `export *` keeps exposing this from the same public path as
 *  before this type moved into the pair's shared module -- see `markdown-shared.ts`'s class doc. */
export type MarkdownHeadingItem = SharedMarkdownHeadingItem;
/** Peer-neutral public alias matching the full variant's `getMarked()` signature. */
export type Marked = LyraMarkedParser;

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
 * later, once the fine-grained highlighter resolves. No highlighting is attempted while
 * `streaming` is `true` — it applies once a stream settles, so there is no added per-chunk cost
 * while content is still arriving.
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
export class LyraMarkdownCore extends MarkdownRuntimeBase {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    anchorJumped: LYRA_DEFAULT_anchorJumped,
    anchorJumpedToPage: LYRA_DEFAULT_anchorJumpedToPage,
    anchorNotFound: LYRA_DEFAULT_anchorNotFound,
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

  /** The Markdown source to render. */
  @property() override content = '';

  /** Tab-stop width used to expand tabs in leading indentation before parsing. Finite values are
   * truncated and clamped to `[1, 32]`; non-finite values fall back to `4`. This is separate from
   * `--lr-code-block-tab-size`, which controls the visual width of tabs in rendered code. */
  @property({ type: Number, attribute: 'tab-size' }) override tabSize = 4;

  /** How authored raw HTML is handled: sanitized through DOMPurify (default), escaped as visible
   * text, or deliberately trusted. Independently of this, every markdown-native link/image
   * `href`/`src` is always scheme-validated (`http:`/`https:`/`blob:`/`mailto:`, plus `data:` for
   * images) unless `htmlMode` is `trusted` -- a rejected scheme drops the anchor/image, rendering
   * only its text/alt content. */
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

  /** Signals that `content` is still arriving incrementally. While true, content renders as
   *  bounded-cost plain text and Markdown parsing resumes only for the final false transition;
   *  the host remains `aria-busy="true"` so assistive technology knows the rendered document is
   *  not final.
   *  Reflects so a consumer can also target `lr-markdown-core[streaming]`. */
  @property({ type: Boolean, reflect: true }) override streaming = false;

  /** Syntax-highlights fenced code blocks through the fine-grained Shiki core loader when
   *  `languages` supplies the matching grammar. The empty default language map means no fenced
   *  block is highlighted; set `false` to keep plain output even when grammars are supplied. No
   *  effect while `streaming` is `true` -- see that property's own doc. */
  @property({
    attribute: 'highlight-code',
    converter: trueDefaultBooleanConverter,
  })
  override highlightCode = true;

  /** Grammar definitions this instance can highlight, e.g. `{ json: jsonGrammar }` (import from
   *  `shiki/langs/<name>.mjs`), forwarded verbatim to `loadShikiHighlighterCore()` -- same shape as
   *  `<lr-code-block-core>`'s own `languages`. This component has no default/full-table
   *  highlighter to fall back to -- a fenced block whose language isn't a key here always renders
   *  the plain-text fallback. Empty (the default) never highlights anything. */
  @property({ attribute: false }) override languages: Readonly<Record<
    string,
    ShikiLanguageInput
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
    languages: Readonly<Record<string, ShikiLanguageInput>> | undefined,
    isCurrent: () => boolean
  ): Promise<MarkdownHighlightAttempt> {
    const normalizedLang = normalizeShikiLanguage(pending.lang);
    if (
      !languages ||
      (!languages[normalizedLang] && !languages[pending.lang])
    ) {
      return null;
    }
    const highlighter = await loadShikiHighlighterCore(languages);
    if (!isCurrent()) return undefined;
    return highlighter ? tokenizeMarkdownHighlight(highlighter, pending) : null;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-markdown-core': LyraMarkdownCore;
  }
}
