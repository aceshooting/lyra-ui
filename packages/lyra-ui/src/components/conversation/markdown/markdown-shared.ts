/**
 * Shared parsing/cache logic for `<lr-markdown>` and `<lr-markdown-core>`. Both components render
 * an otherwise-identical document (GFM tables, fenced code blocks, links, blockquotes, headings,
 * math) and previously duplicated their entire `parseMarkdown()` implementation (and the small
 * `highlightCache` LRU helpers around it) verbatim across both class files -- mirroring the same
 * drift risk `code-block-shared.ts` was created to end for the `<lr-code-block>` /
 * `<lr-code-block-core>` pair. A fix or behavior change to Markdown parsing now has exactly one
 * place to land. `highlightPending()` (the shiki-loading strategy) is deliberately *not* here --
 * it's the one piece that genuinely differs between the full and lean-bundle variants.
 */

import type { OptionalPeerApi } from '../../../internal/optional-peer-types.js';
import { Slugger } from '../../../internal/slugger.js';
import { finiteInteger } from '../../../internal/numbers.js';
import type { KatexApi } from './katex-loader.js';

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
