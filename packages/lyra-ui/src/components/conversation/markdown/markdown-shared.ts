/**
 * Everything `<lr-markdown>` and `<lr-markdown-core>` parse, render and compute identically: the
 * whole `marked` renderer contract (`parseMarkdownDocument()`), the `highlightCache` LRU helpers
 * around it, the optional-peer load/sanitize/fallback pipeline (`renderMarkdownDocument()`), the
 * `katex` resolution state, `fragment`/`text-quote` anchor application, highlight painting and
 * hit-testing, the internal-link contract, and the rendered `[part="content"]` template itself.
 *
 * The two components differ in exactly one axis -- *which* shiki loader highlights a fenced block
 * (the full ~200-language dynamic-import table plus a per-language `loadLanguage()`, vs.
 * `shiki/core` seeded from a pre-supplied `languages` map), which is why `highlightPending()` stays
 * on each class. Everything else was previously duplicated verbatim across both ~890-line class
 * files, mirroring the same drift risk `code-block-shared.ts` was created to end for the
 * `<lr-code-block>` / `<lr-code-block-core>` pair. A fix or behavior change now has exactly one
 * place to land.
 *
 * Nothing here may `import` a *value* from `code-loader.js`'s full-table half
 * (`loadShikiHighlighter`/`loadShikiLanguage`): `<lr-markdown-core>`'s build-leanness claim rests on
 * its own module graph never reaching that call, and this module is in that graph.
 */

import { html, nothing, type TemplateResult } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import type { OptionalPeerApi } from '../../../internal/optional-peer-types.js';
import { Slugger } from '../../../internal/slugger.js';
import { finiteInteger } from '../../../internal/numbers.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { scopeFromElement, resolveTextQuote } from '../../../internal/text-quote.js';
import { supportsCustomHighlights, type HighlightHandle } from '../../../internal/text-highlights.js';
import type { LyraAnchor, LyraHighlight, LyraHighlightTone } from '../../viewers/document-viewer/anchors.js';
import { normalizeShikiLanguage, SHIKI_THEMES } from '../code-block/code-loader.js';
import { loadMarkdownDeps, getMarkdownDepsIfLoaded, type MarkdownDeps } from './markdown-loader.js';
import { getKatex, type KatexApi } from './katex-loader.js';

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(text: string): string {
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
export function cleanHref(href: string): string | null {
  try {
    return encodeURI(href).replace(/%25/g, '%');
  } catch {
    return null;
  }
}

/** One pending fenced-code block discovered during a `parseMarkdownDocument()` pass whose
 *  `(lang, code)` pair wasn't already in the highlight cache -- collected as a side effect of the
 *  `code()` renderer so the caller (`renderMarkdown()`) knows what to highlight next, without a
 *  second pass over the source. `key` is the highlight cache's own lookup key for this pair. */
export interface PendingHighlight {
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

/** Upper bound on a per-instance highlight cache's entries. Each entry holds a fully-highlighted
 *  HTML string (potentially large for a long code block), and the cache is content-addressed --
 *  on a long-lived instance whose `content` keeps changing (a chat transcript, live docs), an
 *  unbounded map would retain the highlighted HTML of every code block ever rendered. 100 far
 *  exceeds the fenced-block count of any one document, so eviction only trims blocks that
 *  scrolled out of the content long ago. */
export const HIGHLIGHT_CACHE_MAX = 100;

/** LRU read: a hit is re-inserted so Map iteration order (insertion order) keeps the first key
 *  the least recently used one -- the entry `setCachedHighlight()` evicts when full. */
export function getCachedHighlight(cache: Map<string, string>, key: string): string | undefined {
  const cached = cache.get(key);
  if (cached !== undefined) {
    cache.delete(key);
    cache.set(key, cached);
  }
  return cached;
}

export function setCachedHighlight(
  cache: Map<string, string>,
  key: string,
  html: string,
  max: number = HIGHLIGHT_CACHE_MAX,
): void {
  if (cache.has(key)) {
    cache.delete(key);
  } else if (cache.size >= max) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, html);
}

// -- math (KaTeX) -----------------------------------------------------------------------------

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
 *  against whatever katex state the caller already resolved -- mirroring this component's
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
      // safe: both regexes have a single non-optional capture group, present on any match.
      if (block) return { type: 'math', raw: block[0], tex: block[1]!.trim(), display: true };
      const inline = MATH_INLINE_RE.exec(src);
      if (inline) return { type: 'math', raw: inline[0], tex: inline[1]!.replace(/\\\$/g, '$').trim(), display: false };
      return undefined;
    },
    renderer(token: OptionalPeerApi): string {
      return renderMath(token as MathToken);
    },
  };
}

/** Everything `parseMarkdownDocument()` needs that would otherwise come from `this` on either
 *  `LyraMarkdown` or `LyraMarkdownCore` -- both components resolve identical inputs from their own
 *  properties/state and pass them through unchanged, so this is the single parsing contract for
 *  both. */
export interface ParseMarkdownOptions {
  marked: OptionalPeerApi;
  content: string;
  gfm: boolean;
  linkTarget: string | null;
  /** Raw, possibly-unnormalized `headingOffset` property value -- `finiteInteger()`-guarded
   *  internally, same as before extraction. */
  headingOffset: number;
  escapeHtmlOption: boolean;
  /** Already combines `highlightCode && !streaming` -- computed by the caller since that
   *  combination differs by call site only in name, never in meaning. */
  highlightCodeOption: boolean;
  /** Bound LRU accessor (not the raw map): reads must go through it so a hit refreshes its
   *  recency, exactly as before extraction. */
  getCachedHighlight: (key: string) => string | undefined;
  failedHighlightKeys: Set<string>;
  headingAnchorsOption: boolean;
  mathOption: boolean;
  /** Already-resolved katex module (or `null`) -- each component keeps its own katex-loading
   *  singleton (unrelated to this shared parsing logic), so the caller resolves it before calling
   *  in, exactly as `parseMarkdown()` did internally before extraction. */
  cachedKatex: KatexApi | null;
  pendingKeys: PendingHighlight[];
  headingTreeOut: MarkdownHeadingItem[];
}

/**
 * Parses `options.content` into sanitizer-ready HTML via a fresh `marked` renderer, mirroring
 * `<lr-markdown>`'s original `parseMarkdown()` (now shared verbatim with `<lr-markdown-core>`).
 * Every `part="..."` injected into the output, the `heading-offset`/`link-target`/
 * `internal-link-prefix`-driven behavior, and the math-token extension are documented on
 * `LyraMarkdown`'s own class doc -- this function's contract is exactly that doc.
 */
export function parseMarkdownDocument(options: ParseMarkdownOptions): { html: string; hadMathFallback: boolean } {
  const {
    marked,
    content,
    gfm,
    linkTarget,
    escapeHtmlOption,
    highlightCodeOption,
    getCachedHighlight: getCached,
    failedHighlightKeys,
    headingAnchorsOption,
    mathOption,
    cachedKatex,
    pendingKeys,
    headingTreeOut,
  } = options;
  // A raw NaN (e.g. an invalid `heading-offset` attribute) would otherwise flow straight into
  // `token.depth + headingOffset` below, producing a NaN heading depth and an invalid `<hNaN>`
  // tag -- finiteInteger() normalizes it back to the documented `0` (additive-only) default.
  const headingOffset = finiteInteger(options.headingOffset, 0);
  const slugger = new Slugger();
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
          const cached = getCached(key);
          if (cached !== undefined) return cached;
          if (!failedHighlightKeys.has(key)) pendingKeys.push({ key, lang, code: body });
        }
        const cls = lang ? ` class="language-${escapeHtml(lang)}"` : '';
        return `<pre part="code-block" tabindex="0"><code${cls}>${text}</code></pre>\n`;
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
  return { html: instance.parse(content, { gfm, async: false }), hadMathFallback };
}

// -- katex resolution state -------------------------------------------------------------------

/**
 * One variant's `katex` bookkeeping. Deliberately *per-variant* rather than one process-wide
 * singleton: each of `<lr-markdown>`/`<lr-markdown-core>` creates exactly one of these at its own
 * module scope, reproducing the four module-level bindings each class file used to declare for
 * itself. Sharing a single instance across both would also share `loadStarted`, so a
 * `<lr-markdown>` that started the load would suppress a `<lr-markdown-core>`'s own
 * re-render-on-resolve on the same page (and vice versa) -- a behavior change this extraction has
 * no reason to make. The underlying `getKatex()` promise is page-cached anyway, so two states cost
 * one load.
 */
export interface MarkdownKatexState {
  /** Test-only override bypassing the real dynamic `import('katex')` and the module cache
   *  entirely -- `undefined` (the default) defers to the resolved module. */
  setForTesting(katex: KatexApi | null | undefined): void;
  /** The katex module to render this pass's math with, or `null` for the literal-TeX fallback
   *  (peer missing *or* still loading -- the fallback is the same either way). */
  getIfLoaded(): KatexApi | null;
  /** Whether the load has definitively finished with no peer available -- distinct from
   *  `getIfLoaded()` returning falsy, which also covers a load that's merely still in flight. Used
   *  only to decide whether a literal fallback should also report `lr-render-error`. */
  isConfirmedMissing(): boolean;
  /** Kicks off the shared page-wide `getKatex()` load the first time math needs it, at most once.
   *  Skipped entirely while `setForTesting()` is active -- that seam controls math-rendering
   *  behavior directly and must never race a real, unmocked `import('katex')` settling underneath
   *  it. `onResolved` runs after the module lands; the caller still guards its own liveness. */
  startLoad(onResolved: () => void): void;
}

export function createMarkdownKatexState(): MarkdownKatexState {
  // `undefined` means no load has been kicked off yet, `null` that one finished but the peer isn't
  // installed -- kept distinguishable from `loadStarted` so "in flight" and "confirmed missing"
  // never collapse into the same falsy value.
  let resolved: KatexApi | null | undefined;
  let loadStarted = false;
  let override: KatexApi | null | undefined;
  return {
    setForTesting(katex) {
      override = katex;
    },
    getIfLoaded() {
      return override !== undefined ? override : (resolved ?? null);
    },
    isConfirmedMissing() {
      return (override !== undefined ? override : resolved) === null;
    },
    startLoad(onResolved) {
      if (loadStarted || override !== undefined) return;
      loadStarted = true;
      void getKatex().then((katex) => {
        resolved = katex;
        onResolved();
      });
    },
  };
}

// -- fenced-code highlighting -------------------------------------------------------------------

/**
 * Rewrites shiki's generated `<pre>`/`<code>` hast nodes so the highlighted output keeps the
 * markdown viewers' own `part="code-block"` hook and a `language-${lang}` class on `<code>` --
 * matching the plain-render output shape exactly, so existing consumer CSS targeting either keeps
 * working whether or not a given block ended up highlighted. A separate, purpose-built function
 * from `code-block-shared.ts`'s own `codeBlockLineTransformer` -- that one targets
 * `<lr-code-block>`'s `part="pre"`/`part="code"`/line-numbers contract, which doesn't apply here.
 */
export function markdownCodeTransformer(lang: string) {
  return {
    name: 'lr-markdown-code-block',
    pre(node: OptionalPeerApi) {
      node.properties.part = ['code-block'];
      node.properties.tabindex = '0';
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

/**
 * Tokenizes one pending fenced block with an already-resolved highlighter and returns the exact
 * string to cache (trailing newline included, matching the plain `code()` renderer's own output).
 * `null` means "leave this key uncached" -- the caller records it in `failedHighlightKeys` so the
 * block keeps its plain fallback permanently rather than being rediscovered as pending forever.
 * Shared by both variants' `highlightPending()`; only the *loading* half above it differs.
 */
export function tokenizeMarkdownHighlight(hl: OptionalPeerApi, pending: PendingHighlight): string | null {
  try {
    const highlighted = hl.codeToHtml(pending.code, {
      lang: normalizeShikiLanguage(pending.lang),
      themes: SHIKI_THEMES,
      transformers: [markdownCodeTransformer(pending.lang)],
    }) as string;
    return `${highlighted}\n`;
  } catch {
    // Tokenization failed for a reason other than an unrecognized grammar (each variant's loader
    // reports that itself) -- same effect either way: permanent plain fallback for this block.
    return null;
  }
}

// -- the render pipeline ------------------------------------------------------------------------

/**
 * `connectedCallback()`'s optional-peer load for both variants. `eagerLoad` only takes the
 * synchronous path when the shared `marked`/`dompurify` module cache has *already* settled (see
 * `getMarkdownDepsIfLoaded()`'s doc) -- otherwise it falls through to the same async path as the
 * default, since a dynamic `import()` can't be made synchronous from scratch.
 *
 * The (module-cached, page-lifetime) `loadMarkdownDeps()` promise can resolve after the instance
 * was removed from the DOM -- e.g. a markdown viewer inside a conditionally-rendered chat message
 * or a virtualized list. Without the `isConnected` guard, a detached instance would still have its
 * deps applied and a render scheduled that no one will ever see. Mirrors `chart.ts`'s own
 * `connectedCallback()` guard for the identical race.
 */
export function beginMarkdownDepsLoad(
  host: { readonly eagerLoad: boolean; readonly isConnected: boolean },
  apply: (deps: MarkdownDeps) => void,
): void {
  if (host.eagerLoad) {
    const alreadyLoaded = getMarkdownDepsIfLoaded();
    if (alreadyLoaded) {
      apply(alreadyLoaded);
      return;
    }
  }
  void loadMarkdownDeps().then((resolved) => {
    if (!host.isConnected) return;
    apply(resolved);
  });
}

/** Every property whose change means the document has to be reparsed. `languagesOnly` is listed
 *  for `<lr-markdown>`; `<lr-markdown-core>` has no such property, so it simply never appears in
 *  that component's changed map. */
export function markdownNeedsReparse(changed: Map<PropertyKey, unknown>): boolean {
  return (
    changed.has('content') ||
    changed.has('sanitize') ||
    changed.has('gfm') ||
    changed.has('linkTarget') ||
    changed.has('headingOffset') ||
    changed.has('escapeHtml') ||
    changed.has('streaming') ||
    changed.has('headingAnchors') ||
    changed.has('math') ||
    changed.has('highlightCode') ||
    changed.has('languages') ||
    changed.has('languagesOnly')
  );
}

/** Whether the *highlighting* configuration changed, invalidating in-flight work and the
 *  permanently-failed key set. */
export function markdownHighlightConfigChanged(changed: Map<PropertyKey, unknown>): boolean {
  return changed.has('highlightCode') || changed.has('languages') || changed.has('languagesOnly');
}

/** Whether the *grammar set* changed, additionally invalidating already-highlighted output. */
export function markdownLanguageSetChanged(changed: Map<PropertyKey, unknown>): boolean {
  return changed.has('languages') || changed.has('languagesOnly');
}

/** The rendered outcome of one `renderMarkdownDocument()` pass. `headingTree` is non-`null`
 *  whenever the parse itself succeeded -- including the `fallback` produced by a missing
 *  `dompurify`, which still computed a real outline before refusing to render. */
export type MarkdownRenderOutcome =
  | { status: 'fallback'; error: unknown; headingTree: MarkdownHeadingItem[] | null }
  | {
      status: 'rendered';
      html: string;
      headingTree: MarkdownHeadingItem[];
      /** A math token rendered its literal TeX fallback *and* the peer is confirmed missing --
       *  worth one `lr-render-error`. A fallback while the load is merely still in flight is the
       *  same one-microtask transient window every other optional peer here has, and reporting it
       *  would be a false positive. */
      mathFailed: boolean;
      pendingKeys: PendingHighlight[];
    };

export interface RenderMarkdownOptions {
  /** This variant's own tag, for the peer-failure diagnostics below. */
  tag: 'lr-markdown' | 'lr-markdown-core';
  deps: MarkdownDeps;
  sanitize: boolean;
  math: boolean;
  /** The instance's own `parseMarkdown()` -- see `ParseMarkdownOptions` for what it resolves. */
  parse: (
    marked: OptionalPeerApi,
    pendingKeys: PendingHighlight[],
    headingTreeOut: MarkdownHeadingItem[],
  ) => { html: string; hadMathFallback: boolean };
  /** Runs immediately after a successful parse, before sanitization -- where each instance kicks
   *  off its variant's katex load. */
  onParsed: () => void;
  isKatexConfirmedMissing: () => boolean;
}

/**
 * The optional-peer load / parse / sanitize / fallback pipeline both variants run, returning what
 * changed rather than mutating the instance -- the caller owns every `@state` assignment and every
 * event, so this stays a pure function of its inputs.
 *
 * Rendering never ships unsanitized or broken markup silently: a missing/throwing `marked`, or a
 * missing `dompurify` while `sanitize` is on, both fall back to plain text plus `lr-render-error`;
 * an explicit `sanitize="false"` renders marked's raw output regardless of whether `dompurify` is
 * installed, because the consumer opted out.
 */
export function renderMarkdownDocument(options: RenderMarkdownOptions): MarkdownRenderOutcome {
  const { deps, tag } = options;
  if (!deps.marked) {
    // markdown-loader.ts already logged the specific import failure.
    return {
      status: 'fallback',
      error: new Error(`<${tag}> could not render: the "marked" peer dependency failed to load.`),
      headingTree: null,
    };
  }

  const pendingKeys: PendingHighlight[] = [];
  const headingTree: MarkdownHeadingItem[] = [];
  let rawHtml: string;
  let hadMathFallback: boolean;
  try {
    const parsed = options.parse(deps.marked, pendingKeys, headingTree);
    rawHtml = parsed.html;
    hadMathFallback = parsed.hadMathFallback;
  } catch (error) {
    return { status: 'fallback', error, headingTree: null };
  }
  options.onParsed();
  const mathFailed = hadMathFallback && options.isKatexConfirmedMissing();

  if (!options.sanitize) {
    // Consumer explicitly opted out of sanitization -- dompurify's presence or absence is
    // irrelevant to this path.
    return { status: 'rendered', html: rawHtml, headingTree, mathFailed, pendingKeys };
  }

  if (!deps.DOMPurify) {
    const error = new Error(
      `<${tag}> could not render: sanitize is enabled (the default) but the "dompurify" peer ` +
        'dependency failed to load — refusing to render unsanitized HTML. Install it with `pnpm add ' +
        'dompurify`, or set sanitize="false" to explicitly opt out of sanitization.',
    );
    console.warn(error.message);
    return { status: 'fallback', error, headingTree };
  }

  // `target` is not in DOMPurify's default attribute allowlist (unlike `part`/`rel`/`class`, which
  // already are) -- without ADD_ATTR here, every rendered link's target="..." would be silently
  // stripped even though the anchor itself survives sanitization. 'style' joins it because shiki's
  // per-token output carries inline style="color:..." (theme colors), equally absent from the
  // default allowlist. `semantics`/`annotation` join only when `math` is on -- the only KaTeX
  // MathML output elements outside the default allowlist. `annotation-xml` is deliberately never
  // added: KaTeX's own MathML output never emits it, and DOMPurify's default allowlist already
  // treats it as a namespace-switching element worth keeping stripped.
  const sanitized = deps.DOMPurify.sanitize(rawHtml, {
    ADD_ATTR: ['target', 'style'],
    ...(options.math ? { ADD_TAGS: ['semantics', 'annotation'] } : {}),
  }) as string;
  return { status: 'rendered', html: sanitized, headingTree, mathFailed, pendingKeys };
}

/** The `lr-render-error` payload for a permanently-missing `katex` peer while `math` is set. */
export function markdownMathPeerError(tag: 'lr-markdown' | 'lr-markdown-core'): Error {
  return new Error(
    `<${tag}> needs the optional peer dependency \`katex\` to render math (the \`math\` property is set) — install it with \`pnpm add katex\`.`,
  );
}

/** Mirrors "the document is not final" onto the host as `aria-busy`, so assistive technology knows
 *  the rendered output is still resolving (peers loading, or `streaming` still on). */
export function applyMarkdownAriaBusy(host: Element, busy: boolean): void {
  if (busy) host.setAttribute('aria-busy', 'true');
  else host.removeAttribute('aria-busy');
}

// -- anchors ------------------------------------------------------------------------------------

/**
 * Scrolls a `fragment` anchor's heading into view. `headingAnchors` may be off, so the target
 * heading might carry no `id` attribute in the DOM at all -- and even with it on, DOMPurify's
 * DOM-clobbering protection strips a slug colliding with a real `document` property name. Both
 * cases fall back to re-deriving the same slug order `getHeadingTree()` was built in and matching
 * by position instead of by attribute.
 */
export function applyMarkdownFragmentAnchor(
  root: Element,
  anchor: Extract<LyraAnchor, { kind: 'fragment' }>,
  headingTree: readonly MarkdownHeadingItem[],
): boolean {
  if (!anchor.id) return false;
  const index = headingTree.findIndex((h) => h.id === anchor.id);
  if (index < 0) return false;
  const el = root.querySelector(`#${CSS.escape(anchor.id)}`) ?? root.querySelectorAll('h1, h2, h3, h4, h5, h6')[index];
  if (!el) return false;
  el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  return true;
}

/** Scrolls a `text-quote` anchor's resolved range into view, centered. */
export function applyMarkdownTextQuoteAnchor(
  root: Element,
  anchor: Extract<LyraAnchor, { kind: 'text-quote' }>,
): boolean {
  const range = resolveTextQuote(scopeFromElement(root), anchor);
  if (!range) return false;
  const target =
    range.startContainer.nodeType === Node.ELEMENT_NODE
      ? (range.startContainer as Element)
      : range.startContainer.parentElement;
  (target ?? root).scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
  return true;
}

// -- highlight painting ---------------------------------------------------------------------------

/** Every `LyraHighlightTone`, used to always call `HighlightHandle.setRanges()` once per tone on
 *  every repaint (with an empty array for an unused tone) -- `setRanges()` replaces a tone's ranges
 *  wholesale per call, so a tone this pass has nothing for still needs an explicit empty call to
 *  clear whatever it painted last pass. */
const HIGHLIGHT_TONES: LyraHighlightTone[] = ['accent', 'success', 'warning', 'danger', 'neutral'];

/** One `text-quote` highlight resolved against the currently rendered content. */
export interface ResolvedHighlightRange {
  id: string;
  range: Range;
}

/**
 * Re-resolves every `text-quote` highlight against the current rendered content and repaints via
 * the caller's `acquireHighlightHandle()` handle -- resolution is always by quote text, never by
 * node identity, so a highlight set before its quote exists in `content` yet (e.g. mid-`streaming`)
 * simply paints nothing until a later render's text actually contains it. `fragment` highlights
 * aren't painted (there is no literal span of text to wrap/underline for a whole section).
 * Returns the resolved ranges for `hitTestHighlightRanges()` to activate against.
 */
export function repaintMarkdownHighlights(options: {
  root: Element;
  handle: HighlightHandle;
  highlights: readonly LyraHighlight[];
  activeHighlightId: string | null;
}): ResolvedHighlightRange[] {
  const resolved: ResolvedHighlightRange[] = [];
  const scope = scopeFromElement(options.root);
  const rangesByTone = new Map<LyraHighlightTone, Range[]>(HIGHLIGHT_TONES.map((tone) => [tone, []]));
  let activeRange: Range | null = null;
  for (const highlight of options.highlights) {
    if (highlight.anchor.kind !== 'text-quote') continue;
    const range = resolveTextQuote(scope, highlight.anchor);
    if (!range) continue;
    rangesByTone.get(highlight.tone ?? 'accent')!.push(range);
    resolved.push({ id: highlight.id, range });
    if (highlight.id === options.activeHighlightId) activeRange = range;
  }
  for (const [tone, ranges] of rangesByTone) options.handle.setRanges(tone, ranges);
  options.handle.setActive(activeRange);
  if (!supportsCustomHighlights()) {
    // The `<mark>`-wrap fallback creates real elements but carries no `part` of its own (the module
    // is shared by every adopting viewer, so it can't know this component's part naming) -- stamped
    // here so a consumer can still target `::part(highlight)` in browsers lacking the CSS Custom
    // Highlight API. Nothing to stamp on the API path: no DOM element is created there.
    for (const mark of options.root.querySelectorAll('mark[data-lr-highlight-tone]')) {
      if (!mark.hasAttribute('part')) mark.setAttribute('part', 'highlight');
    }
  }
  return resolved;
}

/**
 * Hit-tests a click point against every currently-resolved highlight's `getClientRects()`, topmost
 * (last-resolved) first. The CSS Custom Highlight API paints ranges without creating any DOM element
 * to attach a click listener to, so this is the only activation path that works identically on both
 * paint paths -- mirrors `<lr-pdf-viewer>`'s own coordinate-based `onPageClick()` hit-test for the
 * same reason (its own painted highlights sit under a text layer that intercepts most pointer
 * events).
 */
export function hitTestHighlightRanges(
  ranges: readonly ResolvedHighlightRange[],
  x: number,
  y: number,
): string | null {
  for (let i = ranges.length - 1; i >= 0; i--) {
    const hit = ranges[i];
    if (!hit) continue; // unreachable: counted loop, i is in [0, length - 1]
    for (const rect of hit.range.getClientRects()) {
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return hit.id;
    }
  }
  return null;
}

// -- rendering ------------------------------------------------------------------------------------

/** The `href` of the rendered link a click landed on, when `internal-link-prefix` claims it --
 *  `null` for every other click, including one on an ordinary external link.
 *
 *  Compared against the raw `href` *attribute*, not the `.href` IDL property: the property is
 *  always browser-resolved to an absolute URL (e.g. "https://example.com/docs") even for a
 *  relative/prefixed path, which would never match a relative `internal-link-prefix`. */
export function internalLinkHrefFrom(e: MouseEvent, prefix: string): string | null {
  if (!prefix) return null;
  const anchor = e.composedPath().find((el): el is HTMLAnchorElement => el instanceof HTMLAnchorElement);
  if (!anchor) return null;
  const href = anchor.getAttribute('href') ?? '';
  return href.startsWith(prefix) ? href : null;
}

export interface MarkdownContentOptions {
  /** The Markdown source -- also the plain-text fallback rendering when `renderedHtml` is `null`. */
  content: string;
  /** Sanitized (or deliberately unsanitized) HTML, or `null` for the plain-text fallback: peers
   *  still loading, or a render attempt just fell back after a failure. The two states look
   *  identical on purpose -- a consumer distinguishes them via `lr-render-error`. */
  renderedHtml: string | null;
  /** The host's own `aria-label`, forwarded to the element that actually owns `role="document"` --
   *  a host `aria-label` doesn't reach shadow internals on its own. */
  hostAriaLabel: string | null;
  onClick: (e: MouseEvent) => void;
  /** `DocumentAnchorTarget`'s `renderAnchorLiveRegion()` output. */
  liveRegion: unknown;
}

/** The rendered tree both variants produce: one `[part="content"]` wrapper plus the anchor-target
 *  live region. Only non-empty content is focusable -- an empty document is not a scrollable region
 *  worth a tab stop. */
export function renderMarkdownContent(options: MarkdownContentOptions): TemplateResult {
  const isFallback = options.renderedHtml === null;
  // Indented two levels deeper than this function body on purpose. `[part='content'][data-fallback]`
  // is `white-space: pre-wrap` (markdown.styles.ts), so the literal indentation around the binding
  // below is *rendered* whitespace in the plain-text fallback state -- keeping the exact text both
  // class files used before the extraction keeps that state pixel-identical.
  // prettier-ignore
  return html`
      <div
        part="content"
        role="document"
        tabindex=${options.content.trim() ? '0' : nothing}
        aria-label=${options.hostAriaLabel || nothing}
        ?data-fallback=${isFallback}
        @click=${options.onClick}
      >
        ${isFallback ? options.content : unsafeHTML(options.renderedHtml)}
      </div>
      ${options.liveRegion}
    `;
}
