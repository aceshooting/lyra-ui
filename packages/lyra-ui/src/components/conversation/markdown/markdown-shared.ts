/**
 * Pure parsing, rendering, cache, anchor, and highlight helpers shared by `<lr-markdown>` and
 * `<lr-markdown-core>`. Their common reactive lifecycle and DOM orchestration live in
 * `markdown-base.class.ts`; the concrete classes supply only their distinct Shiki loading
 * strategies and public reactive-property declarations.
 *
 * Nothing in this shared module may `import` a *value* from `code-loader.js`'s full-table half
 * (`loadShikiHighlighter`/`loadShikiLanguage`): `<lr-markdown-core>`'s build-leanness claim rests on
 * its own module graph never reaching that call, and this module is in that graph.
 */

import { html, nothing, type TemplateResult } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { Slugger } from '../../../internal/slugger.js';
import { finiteInteger } from '../../../internal/numbers.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import {
  createTextQuoteIndex,
  rangeFromTextQuoteMatch,
  rangesFromTextQuoteMatches,
  scopeFromElement,
  TEXT_QUOTE_LIMITS,
  TEXT_SELECTION_RECT_LIMIT,
  type TextQuoteIndex,
  type TextQuoteMatch,
} from '../../../internal/text-quote.js';
import { prioritizedHighlightCandidates } from '../../../internal/anchor-target.js';
import { supportsCustomHighlights, type HighlightHandle } from '../../../internal/text-highlights.js';
import type { LyraAnchor, LyraHighlight, LyraHighlightTone } from '../../viewers/document-viewer/anchors.js';
import { normalizeShikiLanguage, SHIKI_THEMES, type ShikiHighlighter } from '../code-block/shiki-types.js';
import { resolveIsDarkTheme, watchDarkTheme } from '../code-block/shiki-dark-theme.js';
import type { ShikiTransformer } from '../code-block/shiki-types.js';
import {
  loadMarkdownDeps,
  getMarkdownDepsIfLoaded,
  type LyraMarkedParser,
  type MarkdownDeps,
  type MarkedModule,
} from './markdown-loader.js';
import { getKatex, type KatexApi } from './katex-loader.js';

/** Creates a parser owned by one component instance. Parser extensions can no longer leak into
 * sibling instances; a consumer mutates the instance it intends to refresh. */
export function createMarkdownParser(marked: MarkedModule | undefined): LyraMarkedParser | undefined {
  if (!marked || (typeof marked !== 'object' && typeof marked !== 'function') || typeof marked.Marked !== 'function') {
    return undefined;
  }
  return new marked.Marked() as unknown as LyraMarkedParser;
}

/** Owns one configurable parser and replaces it only when the resolved optional-peer module
 * changes. Full and core use the same controller without sharing instance configuration. */
export class MarkdownParserController {
  private module?: MarkedModule;
  private parser?: LyraMarkedParser;

  get(marked: MarkedModule | undefined): LyraMarkedParser | undefined {
    if (!marked) return undefined;
    if (this.module !== marked) {
      this.module = marked;
      this.parser = createMarkdownParser(marked);
    }
    return this.parser;
  }
}

/** Converts tabs only in a line's indentation to spaces at real tab stops. Markdown treats four
 * leading spaces as an indented code block, so a fixed replacement is wrong after existing spaces;
 * the next stop depends on the current indentation column. Shared by both Markdown variants so
 * their source parsing differs only in the documented syntax-highlighting loader. */
export function normalizeMarkdownLeadingTabs(content: string, tabSize: number): string {
  const width = finiteInteger(tabSize, 4, 1, 32);
  return content.replace(/^[\t ]+/gm, (indentation) => {
    let column = 0;
    let normalized = '';
    for (const character of indentation) {
      const spaces = character === '\t' ? width - (column % width) : 1;
      normalized += ' '.repeat(spaces);
      column += spaces;
    }
    return normalized;
  });
}

/** One owner-window animation frame plus a settlement promise that cleanup can resolve. */
interface MarkdownOwnedAnimationFrame {
  owner: Window;
  handle?: number;
  settled: Promise<void>;
  resolve(): void;
}

/** Owns the single coalesced animation frame shared by each Markdown variant's streaming path. */
export class MarkdownOwnedAnimationFrameController {
  private pending?: MarkdownOwnedAnimationFrame;

  get handle(): number | undefined {
    return this.pending?.handle;
  }

  get settled(): Promise<void> | undefined {
    return this.pending?.settled;
  }

  request(owner: Window, callback: () => void): number | undefined {
    if (this.pending) return this.pending.handle;
    let resolveFrame!: () => void;
    const settled = new Promise<void>((resolve) => {
      resolveFrame = resolve;
    });
    const pending: MarkdownOwnedAnimationFrame = {
      owner,
      settled,
      resolve: resolveFrame,
    };
    this.pending = pending;
    try {
      pending.handle = owner.requestAnimationFrame(() => {
        if (this.pending !== pending) return;
        this.pending = undefined;
        pending.resolve();
        callback();
      });
    } catch {
      if (this.pending === pending) this.pending = undefined;
      pending.resolve();
      return undefined;
    }
    return pending.handle;
  }

  cancel(): boolean {
    const pending = this.pending;
    if (!pending) return false;
    this.pending = undefined;
    try {
      if (pending.handle !== undefined) pending.owner.cancelAnimationFrame(pending.handle);
    } catch {
      // The owner browsing context may already be gone; clearing `pending` above keeps any late
      // callback inert, and settlement remains mandatory for `updateComplete` callers.
    } finally {
      pending.resolve();
    }
    return true;
  }
}

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
export const HIGHLIGHT_CACHE_MAX_BYTES = 2 * 1024 * 1024;
export const HIGHLIGHT_CACHE_ENTRY_MAX_BYTES = 512 * 1024;
export const FAILED_HIGHLIGHT_MAX = 256;

/** Bounded content key: raw source never remains retained merely because it was used as a cache
 * key. Two 32-bit FNV streams plus source length make accidental collisions vanishingly unlikely. */
export function markdownHighlightKey(language: string, code: string): string {
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;
  const input = `${language}\0${code}`;
  for (let index = 0; index < input.length; index++) {
    const unit = input.charCodeAt(index);
    a = Math.imul(a ^ unit, 0x01000193) >>> 0;
    b = Math.imul(b ^ unit, 0x85ebca6b) >>> 0;
  }
  return `${language}:${code.length}:${a.toString(36)}:${b.toString(36)}`;
}

export function addFailedHighlightKey(failed: Set<string>, key: string): void {
  if (failed.has(key)) return;
  if (failed.size >= FAILED_HIGHLIGHT_MAX) {
    const oldest = failed.values().next().value;
    if (oldest !== undefined) failed.delete(oldest);
  }
  failed.add(key);
}

/** Runs each unique highlight key once with bounded parallelism so one large document cannot
 * fan out hundreds of simultaneous grammar/tokenization jobs. */
export async function processPendingHighlights(
  pending: readonly PendingHighlight[],
  worker: (item: PendingHighlight) => Promise<void>,
  concurrency = 4,
): Promise<void> {
  const unique = [...new Map(pending.map((item) => [item.key, item])).values()];
  let next = 0;
  const run = async (): Promise<void> => {
    while (next < unique.length) {
      const item = unique[next++];
      if (item) await worker(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, unique.length) }, () => run()));
}

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
  maxBytes: number = HIGHLIGHT_CACHE_MAX_BYTES,
): boolean {
  const entryBytes = (key.length + html.length) * 2;
  if (entryBytes > HIGHLIGHT_CACHE_ENTRY_MAX_BYTES || entryBytes > maxBytes) return false;
  if (cache.has(key)) {
    cache.delete(key);
  }
  let retainedBytes = 0;
  for (const [cachedKey, cachedHtml] of cache) retainedBytes += (cachedKey.length + cachedHtml.length) * 2;
  while (cache.size >= max || retainedBytes + entryBytes > maxBytes) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    const oldestHtml = cache.get(oldest) ?? '';
    retainedBytes -= (oldest.length + oldestHtml.length) * 2;
    cache.delete(oldest);
  }
  cache.set(key, html);
  return true;
}

// -- math (KaTeX) -----------------------------------------------------------------------------

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
      if (src.startsWith('$$')) {
        const close = src.indexOf('$$', 2);
        if (close > 2) {
          const raw = src.slice(0, close + 2);
          const tex = src.slice(2, close).trim();
          if (tex) {
            return {
              type: 'math',
              raw,
              tex,
              display: true,
            };
          }
        }
      }
      const inline = MATH_INLINE_RE.exec(src);
      if (inline)
        return {
          type: 'math',
          raw: inline[0],
          tex: inline[1]!.replace(/\\\$/g, '$').trim(),
          display: false,
        };
      return undefined;
    },
    renderer(token: unknown): string {
      return renderMath(token as MathToken);
    },
  };
}

/** Everything `parseMarkdownDocument()` needs that would otherwise come from `this` on either
 *  `LyraMarkdown` or `LyraMarkdownCore` -- both components resolve identical inputs from their own
 *  properties/state and pass them through unchanged, so this is the single parsing contract for
 *  both. */
export interface ParseMarkdownOptions {
  marked: MarkedModule;
  /** Ordered snapshots of parser defaults. Later entries override earlier entries. */
  markedConfigurations?: readonly (Record<string, unknown> | undefined)[];
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
export function parseMarkdownDocument(options: ParseMarkdownOptions): {
  html: string;
  hadMathFallback: boolean;
} {
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
  const activeHighlightKeys = new Set<string>();
  const pendingHighlightKeys = new Set(options.pendingKeys.map(({ key }) => key));
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
            const mathml = cachedKatex.renderToString(token.tex, {
              output: 'mathml',
              throwOnError: false,
            });
            return `<span part='math' data-display='${token.display ? 'block' : 'inline'}'>${mathml}</span>`;
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
      heading(token) {
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
        const idAttr = headingAnchorsOption && slug ? ` id='${escapeHtml(slug)}'` : '';
        return `<h${depth} part='heading'${idAttr}>${this.parser.parseInline(token.tokens)}</h${depth}>\n`;
      },
      paragraph(token) {
        return `<p part='paragraph'>${this.parser.parseInline(token.tokens)}</p>\n`;
      },
      list(token) {
        const ordered = token.ordered;
        const start = token.start;
        let body = '';
        for (const item of token.items) body += this.listitem(item);
        const tag = ordered ? 'ol' : 'ul';
        const startAttr = ordered && start !== 1 ? ` start='${start}'` : '';
        return `<${tag} part='list'${startAttr}>\n${body}</${tag}>\n`;
      },
      code(token) {
        const lang = (token.lang ?? '').trim().split(/\s+/)[0] ?? '';
        const body = `${token.text.replace(/\n$/, '')}\n`;
        const text = token.escaped ? body : escapeHtml(body);
        if (highlightCodeOption && lang) {
          const key = markdownHighlightKey(lang, body);
          const admitted = activeHighlightKeys.has(key) || activeHighlightKeys.size < HIGHLIGHT_CACHE_MAX;
          if (admitted) {
            activeHighlightKeys.add(key);
            const cached = getCached(key);
            if (cached !== undefined) return cached;
            if (!failedHighlightKeys.has(key) && !pendingHighlightKeys.has(key)) {
              pendingHighlightKeys.add(key);
              pendingKeys.push({ key, lang, code: body });
            }
          }
        }
        const cls = lang ? ` class='language-${escapeHtml(lang)}'` : '';
        return `<pre part='code-block' tabindex='0'><code${cls}>${text}</code></pre>\n`;
      },
      codespan(token) {
        // Mirrors marked's own default codespan() renderer's escaping exactly (it does not
        // pre-escape token.text itself) -- only the added part='inline-code' differs.
        return `<code part='inline-code'>${escapeHtml(token.text)}</code>`;
      },
      blockquote(token) {
        return `<blockquote part='blockquote'>\n${this.parser.parse(token.tokens)}</blockquote>\n`;
      },
      table(token) {
        // Built directly here (rather than delegating to the inherited
        // tablecell()) so a scope='col' can be added -- marked's own
        // default tablecell() never emits it, and without it a screen
        // reader can't reliably associate a data cell with its column
        // header beyond the simplest table.
        let headerRow = '';
        for (const cell of token.header) {
          const text = this.parser.parseInline(cell.tokens);
          const alignAttr = cell.align ? ` align='${cell.align}'` : '';
          headerRow += `<th scope='col'${alignAttr}>${text}</th>`;
        }
        let bodyRows = '';
        for (const row of token.rows) {
          let rowHtml = '';
          for (const cell of row) rowHtml += this.tablecell(cell);
          bodyRows += this.tablerow({ text: rowHtml });
        }
        const thead = `<thead>\n${this.tablerow({
          text: headerRow,
        })}</thead>\n`;
        const tbody = bodyRows ? `<tbody>${bodyRows}</tbody>\n` : '';
        return `<table part='table'>\n${thead}${tbody}</table>\n`;
      },
      link(token) {
        const text = this.parser.parseInline(token.tokens);
        const href = cleanHref(token.href);
        if (href === null) return text;
        const titleAttr = token.title ? ` title='${escapeHtml(token.title)}'` : '';
        const targetAttr = linkTarget ? ` target='${escapeHtml(linkTarget)}' rel='noopener noreferrer'` : '';
        return `<a part='link' href='${escapeHtml(href)}'${titleAttr}${targetAttr}>${text}</a>`;
      },
      image(token) {
        // Mirrors marked's own default image() renderer (alt text
        // re-rendered through the plain textRenderer so nested emphasis/
        // strong/etc. inside the alt collapses to plain text, href run
        // through the same cleanHref() the link() override above uses)
        // with a part='img' added.
        const altText = this.parser.parseInline(token.tokens, this.parser.textRenderer);
        const href = cleanHref(token.href);
        if (href === null) return escapeHtml(altText);
        const titleAttr = token.title ? ` title='${escapeHtml(token.title)}'` : '';
        return `<img part='img' src='${escapeHtml(href)}' alt='${escapeHtml(altText)}'${titleAttr}>`;
      },
      html(token) {
        return escapeHtmlOption ? escapeHtml(token.text) : token.text;
      },
    },
  });
  // Both Markdown variants expose a shared configurable parser, but this function still creates a
  // fresh internal instance so its renderer closures always capture current component properties.
  // Apply the public parser's current defaults last: consumer hooks/extensions are meaningful,
  // and sanitization still runs over the resulting HTML in `renderMarkdownDocument()`.
  for (const configuration of options.markedConfigurations ?? []) {
    if (!configuration || typeof configuration !== 'object') continue;
    // A pristine `Marked#defaults` contains `renderer: null`, `hooks: null`, and similar reset
    // sentinels. Passing those through `.use()` after our renderer would erase the part-bearing
    // overrides above. Keep meaningful configured values (including `false`) and discard only
    // nullish defaults; once a consumer installs a real renderer/hook, that object survives.
    const configuredDefaults = Object.fromEntries(Object.entries(configuration).filter(([, value]) => value != null));
    if (Object.keys(configuredDefaults).length > 0) instance.use(configuredDefaults as never);
  }
  return {
    html: instance.parse(content, { gfm, async: false }),
    hadMathFallback,
  };
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
  /** The katex module to render this pass's math with, or `null` for the literal-TeX fallback
   *  (peer missing *or* still loading -- the fallback is the same either way). */
  getIfLoaded(): KatexApi | null;
  /** Whether the load has definitively finished with no peer available -- distinct from
   *  `getIfLoaded()` returning falsy, which also covers a load that's merely still in flight. Used
   *  only to decide whether a literal fallback should also report `lr-render-error`. */
  isConfirmedMissing(): boolean;
  /** Subscribes one instance to the shared page-wide `getKatex()` load and kicks that load off the
   *  first time math needs it. Reusing the same callback is idempotent, so repeated renders while
   *  the peer is pending do not produce duplicate completion work.
   *  `onResolved` runs after the module lands; the caller still guards its own liveness. */
  startLoad(onResolved: () => void): void;
}

const KATEX_OVERRIDE = Symbol.for('@aceshooting/lyra-ui/markdown-katex-override');

function readKatexOverride(): { present: boolean; value: KatexApi | null } {
  return Reflect.has(globalThis, KATEX_OVERRIDE)
    ? {
        present: true,
        value: Reflect.get(globalThis, KATEX_OVERRIDE) as KatexApi | null,
      }
    : { present: false, value: null };
}

export function createMarkdownKatexState(): MarkdownKatexState {
  // `undefined` means no load has been kicked off yet, `null` that one finished but the peer isn't
  // installed -- kept distinguishable from `loadStarted` so "in flight' and 'confirmed missing"
  // never collapse into the same falsy value.
  let resolved: KatexApi | null | undefined;
  let loadStarted = false;
  const subscribers = new Set<() => void>();
  return {
    getIfLoaded() {
      const override = readKatexOverride();
      return override.present ? override.value : resolved ?? null;
    },
    isConfirmedMissing() {
      const override = readKatexOverride();
      return (override.present ? override.value : resolved) === null;
    },
    startLoad(onResolved) {
      if (readKatexOverride().present || resolved !== undefined) return;
      subscribers.add(onResolved);
      if (loadStarted) return;
      loadStarted = true;
      void getKatex().then((katex) => {
        resolved = katex;
        const pending = [...subscribers];
        subscribers.clear();
        for (const subscriber of pending) subscriber();
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
 * `<lr-code-block>`'s `part="pre'`/`part='code"`/line-numbers contract, which doesn't apply here.
 */
export function markdownCodeTransformer(lang: string): ShikiTransformer {
  return {
    name: 'lr-markdown-code-block',
    pre(node) {
      node.properties.part = ['code-block'];
      node.properties['tabindex'] = '0';
    },
    code(node) {
      const classValue = node.properties['class'];
      const classes = Array.isArray(classValue) ? classValue.map(String) : classValue ? [String(classValue)] : [];
      node.properties['class'] = [...classes, `language-${lang}`];
    },
  };
}

const SHIKI_COLOR = /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i;
const SHIKI_STYLE_TO_DATA: Readonly<Record<string, string>> = {
  color: 'data-lr-shiki-light',
  'background-color': 'data-lr-shiki-light-bg',
  '--shiki-light': 'data-lr-shiki-light',
  '--shiki-light-bg': 'data-lr-shiki-light-bg',
  '--shiki-dark': 'data-lr-shiki-dark',
  '--shiki-dark-bg': 'data-lr-shiki-dark-bg',
};
const SHIKI_DATA_TO_STYLE: Readonly<Record<string, string>> = {
  'data-lr-shiki-light': 'color',
  'data-lr-shiki-light-bg': 'background-color',
  'data-lr-shiki-dark': '--shiki-dark',
  'data-lr-shiki-dark-bg': '--shiki-dark-bg',
};

/**
 * Converts Shiki's generated inline palette into inert data before it shares a sanitizer pass
 * with authored Markdown HTML. Only literal hex theme colors survive; layout, resource, and other
 * declarations are discarded even if a future or compromised highlighter emits them.
 */
function encodeMarkdownHighlightStyles(markup: string): string {
  return markup.replace(/\sstyle=(["'])(.*?)\1/gi, (_attribute, _quote: string, value: string) => {
    const attributes: string[] = [];
    for (const declaration of value.split(';')) {
      const separator = declaration.indexOf(':');
      if (separator < 0) continue;
      const property = declaration.slice(0, separator).trim().toLowerCase();
      const color = declaration.slice(separator + 1).trim();
      const dataAttribute = SHIKI_STYLE_TO_DATA[property];
      if (dataAttribute && SHIKI_COLOR.test(color)) attributes.push(`${dataAttribute}="${color}"`);
    }
    return attributes.length > 0 ? ` ${attributes.join(' ')}` : '';
  });
}

/** Rehydrates only the inert, strict-color Shiki palette after DOMPurify has removed every style
 * attribute. Authored markup can imitate these data attributes, but the strict value/property map
 * can produce only color declarations -- never a resource fetch, overlay, or layout mutation. */
function restoreMarkdownHighlightStyles(markup: string): string {
  return markup.replace(/<[a-z][^<>]*>/gi, (openingTag) => {
    const declarations: string[] = [];
    const cleanTag = openingTag.replace(
      /\s(data-lr-shiki-(?:light-bg|dark-bg|light|dark))=(["'])(#[\da-f]+)\2/gi,
      (attribute, name: string, _quote: string, color: string) => {
        const property = SHIKI_DATA_TO_STYLE[name.toLowerCase()];
        if (!property || !SHIKI_COLOR.test(color)) return attribute;
        declarations.push(`${property}:${color}`);
        return '';
      },
    );
    if (declarations.length === 0) return cleanTag;
    return `${cleanTag.slice(0, -1)} style="${declarations.join(';')}">`;
  });
}

/**
 * Tokenizes one pending fenced block with an already-resolved highlighter and returns the exact
 * string to cache (trailing newline included, matching the plain `code()` renderer's own output).
 * `null` means "leave this key uncached" -- the caller records it in `failedHighlightKeys` so the
 * block keeps its plain fallback permanently rather than being rediscovered as pending forever.
 * Shared by both variants' `highlightPending()`; only the *loading* half above it differs.
 */
export function tokenizeMarkdownHighlight(hl: ShikiHighlighter, pending: PendingHighlight): string | null {
  try {
    const highlighted = hl.codeToHtml(pending.code, {
      lang: normalizeShikiLanguage(pending.lang),
      themes: SHIKI_THEMES,
      transformers: [markdownCodeTransformer(pending.lang)],
    }) as string;
    return `${encodeMarkdownHighlightStyles(highlighted)}\n`;
  } catch {
    // Tokenization failed for a reason other than an unrecognized grammar (each variant's loader
    // reports that itself) -- same effect either way: permanent plain fallback for this block.
    return null;
  }
}

// -- the render pipeline ------------------------------------------------------------------------

const markdownDepsLoadGenerations = new WeakMap<object, number>();

/**
 * `connectedCallback()`'s optional-peer load for both variants. A settled shared cache is always
 * adopted synchronously; {@link loadMarkdownDeps} / `preloadMarkdown()` is the sole eager-loading
 * API when a consumer wants the first instance to avoid the dynamic-import window.
 *
 * The (module-cached, page-lifetime) `loadMarkdownDeps()` promise can resolve after the instance
 * was removed from the DOM -- e.g. a markdown viewer inside a conditionally-rendered chat message
 * or a virtualized list. Without the `isConnected` guard, a detached instance would still have its
 * deps applied and a render scheduled that no one will ever see. A per-host connection generation
 * also invalidates the earlier subscription when the same instance reconnects before the shared
 * promise settles, so one settlement cannot apply twice to the current connection.
 */
export function beginMarkdownDepsLoad(
  host: object & { readonly isConnected: boolean },
  apply: (deps: MarkdownDeps) => void,
): void {
  const generation = (markdownDepsLoadGenerations.get(host) ?? 0) + 1;
  markdownDepsLoadGenerations.set(host, generation);
  const alreadyLoaded = getMarkdownDepsIfLoaded();
  if (alreadyLoaded) {
    apply(alreadyLoaded);
    return;
  }
  void loadMarkdownDeps().then((resolved) => {
    if (!host.isConnected || markdownDepsLoadGenerations.get(host) !== generation) return;
    apply(resolved);
  });
}

/** Every property whose change means the document has to be reparsed. */
export function markdownNeedsReparse(changed: Map<PropertyKey, unknown>): boolean {
  return (
    changed.has('content') ||
    changed.has('tabSize') ||
    changed.has('htmlMode') ||
    changed.has('gfm') ||
    changed.has('linkTarget') ||
    changed.has('headingOffset') ||
    changed.has('streaming') ||
    changed.has('headingAnchors') ||
    changed.has('math') ||
    changed.has('highlightCode') ||
    changed.has('languages')
  );
}

/** Whether the *highlighting* configuration changed, invalidating in-flight work and the
 *  permanently-failed key set. */
export function markdownHighlightConfigChanged(changed: Map<PropertyKey, unknown>): boolean {
  return changed.has('highlightCode') || changed.has('languages');
}

/** Whether the *grammar set* changed, additionally invalidating already-highlighted output. */
export function markdownLanguageSetChanged(changed: Map<PropertyKey, unknown>): boolean {
  return changed.has('languages');
}

/** The rendered outcome of one `renderMarkdownDocument()` pass. `headingTree` is non-`null`
 *  whenever the parse itself succeeded -- including the `fallback` produced by a missing
 *  `dompurify`, which still computed a real outline before refusing to render. */
export type MarkdownRenderOutcome =
  | {
      status: 'fallback';
      error: unknown;
      headingTree: MarkdownHeadingItem[] | null;
    }
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

export type MarkdownHtmlMode = 'sanitize' | 'escape' | 'trusted';

export function normalizeMarkdownHtmlMode(value: unknown): MarkdownHtmlMode {
  return value === 'escape' || value === 'trusted' ? value : 'sanitize';
}

export interface RenderMarkdownOptions {
  /** This variant's own tag, for the peer-failure diagnostics below. */
  tag: 'lr-markdown' | 'lr-markdown-core';
  deps: MarkdownDeps;
  htmlMode: MarkdownHtmlMode;
  math: boolean;
  /** The instance's own `parseMarkdown()` -- see `ParseMarkdownOptions` for what it resolves. */
  parse: (
    marked: MarkedModule,
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
 * missing `dompurify` in `sanitize` mode both fall back to plain text plus `lr-render-error`.
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

  if (options.htmlMode !== 'sanitize') {
    // Shiki palette data is trusted output from Lyra's highlighter, not authored HTML. Restore its
    // strict color-only declarations in both escape and trusted modes as well as after DOMPurify.
    return {
      status: 'rendered',
      html: restoreMarkdownHighlightStyles(rawHtml),
      headingTree,
      mathFailed,
      pendingKeys,
    };
  }

  if (!deps.DOMPurify) {
    const error = new Error(
      `<${tag}> could not render: sanitize is enabled (the default) but the "dompurify" peer ` +
        'dependency failed to load — refusing to render unsanitized HTML. Install it with `pnpm add ' +
        'dompurify`, or set html-mode="trusted" to explicitly opt out of sanitization.',
    );
    console.warn(error.message);
    return { status: 'fallback', error, headingTree };
  }

  // `target` is not in DOMPurify's default attribute allowlist (unlike `part`/`rel`/`class`, which
  // already are) -- without ADD_ATTR here, every rendered link's target="..." would be silently
  // stripped even though the anchor itself survives sanitization. Every `style` is forbidden:
  // Shiki's trusted palette was converted to strict, inert data attributes before this shared pass
  // and is restored below; raw authored CSS must never gain the same privilege. `semantics`/
  // `annotation` join only when `math` is on -- the only KaTeX MathML output elements outside the
  // default allowlist. `annotation-xml` is deliberately never added: KaTeX's own MathML output
  // never emits it, and DOMPurify already treats it as a namespace-switching element worth
  // keeping stripped.
  const sanitized = deps.DOMPurify.sanitize(rawHtml, {
    ADD_ATTR: ['target'],
    FORBID_ATTR: ['style'],
    ...(options.math ? { ADD_TAGS: ['semantics', 'annotation'] } : {}),
  }) as string;
  return {
    status: 'rendered',
    html: restoreMarkdownHighlightStyles(sanitized),
    headingTree,
    mathFailed,
    pendingKeys,
  };
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

function markdownScrollBehavior(root: Element): ScrollBehavior {
  const view = root.ownerDocument.defaultView;
  return !view || prefersReducedMotion(view) ? 'auto' : 'smooth';
}

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
  let index = -1;
  const headingLimit = Math.min(headingTree.length, TEXT_QUOTE_LIMITS.maxTraversalNodes);
  for (let headingIndex = 0; headingIndex < headingLimit; headingIndex++) {
    if (headingTree[headingIndex]?.id === anchor.id) {
      index = headingIndex;
      break;
    }
  }
  if (index < 0) return false;
  const walker = root.ownerDocument.createTreeWalker(root, 0x1 /* NodeFilter.SHOW_ELEMENT */);
  let inspected = 0;
  let headingIndex = 0;
  let escapedIdMatch: Element | null = null;
  let positionalMatch: Element | null = null;
  let node: Node | null;
  while (
    inspected < TEXT_QUOTE_LIMITS.maxTraversalNodes
    && (node = walker.nextNode())
  ) {
    inspected++;
    const candidate = node as Element;
    if (candidate.getAttribute('id') === anchor.id) escapedIdMatch ??= candidate;
    if (/^H[1-6]$/.test(candidate.tagName)) {
      if (headingIndex === index) positionalMatch = candidate;
      headingIndex++;
    }
    if (escapedIdMatch && positionalMatch) break;
  }
  const el = escapedIdMatch ?? positionalMatch;
  if (!el) return false;
  el.scrollIntoView({
    behavior: markdownScrollBehavior(root),
    block: 'start',
  });
  return true;
}

/** Scrolls a `text-quote` anchor's resolved range into view, centered. */
export function applyMarkdownTextQuoteAnchor(
  root: Element,
  anchor: Extract<LyraAnchor, { kind: 'text-quote' }>,
  /** The component's resolved locale. Text-quote matching case-folds, and casing is
   *  locale-sensitive -- under `lang="tr"` an unlocalized fold never matches "İSTANBUL". */
  locale?: string,
  index: TextQuoteIndex = createTextQuoteIndex(scopeFromElement(root), locale),
): boolean {
  const match = index.resolve(anchor);
  const range = match ? rangeFromTextQuoteMatch(index.scope, match) : null;
  if (!range) return false;
  const target =
    range.startContainer.nodeType === 1 ? (range.startContainer as Element) : range.startContainer.parentElement;
  (target ?? root).scrollIntoView({
    behavior: markdownScrollBehavior(root),
    block: 'center',
  });
  return true;
}

// -- highlight painting ---------------------------------------------------------------------------

/** Every `LyraHighlightTone`, used to always call `HighlightHandle.setRanges()` once per tone on
 *  every repaint (with an empty array for an unused tone) -- `setRanges()` replaces a tone's ranges
 *  wholesale per call, so a tone this pass has nothing for still needs an explicit empty call to
 *  clear whatever it painted last pass. */
const HIGHLIGHT_TONES: LyraHighlightTone[] = ['accent', 'success', 'warning', 'danger', 'neutral'];
export const MARKDOWN_PAINTED_HIGHLIGHT_LIMIT = 100;

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
  index: TextQuoteIndex;
  /** The component's resolved locale; see applyMarkdownTextQuoteAnchor. */
  locale?: string;
}): ResolvedHighlightRange[] {
  const resolved: ResolvedHighlightRange[] = [];
  const rangesByTone = new Map<LyraHighlightTone, Range[]>(HIGHLIGHT_TONES.map((tone) => [tone, []]));
  let activeRange: Range | null = null;
  const workBudget = options.index.createWorkBudget();
  const matches: Array<{ highlight: LyraHighlight; match: TextQuoteMatch }> = [];
  for (const highlight of prioritizedHighlightCandidates(options.highlights, options.activeHighlightId)) {
    if (matches.length >= MARKDOWN_PAINTED_HIGHLIGHT_LIMIT) break;
    if (highlight.anchor.kind !== 'text-quote') continue;
    const match = options.index.resolve(highlight.anchor, workBudget);
    if (match) matches.push({ highlight, match });
  }
  const ranges = rangesFromTextQuoteMatches(
    options.index.scope,
    matches.map(({ match }) => match),
  );
  for (let position = 0; position < matches.length; position++) {
    const { highlight } = matches[position]!;
    const range = ranges[position] ?? null;
    if (!range) continue;
    rangesByTone.get(highlight.tone ?? 'accent')!.push(range);
    resolved.push({ id: highlight.id, range });
    if (highlight.id === options.activeHighlightId) activeRange = range;
  }
  for (const [tone, ranges] of rangesByTone) options.handle.setRanges(tone, ranges);
  options.handle.setActive(activeRange);
  if (!supportsCustomHighlights(options.root.ownerDocument)) {
    // The `<mark>`-wrap fallback creates real elements but carries no `part` of its own (the module
    // is shared by every adopting viewer, so it can't know this component's part naming) -- stamped
    // here so a consumer can still target `::part(highlight)` in browsers lacking the CSS Custom
    // Highlight API. Nothing to stamp on the API path: no DOM element is created there.
    const walker = options.root.ownerDocument.createTreeWalker(
      options.root,
      0x1 /* NodeFilter.SHOW_ELEMENT */,
    );
    let inspected = 0;
    let node: Node | null;
    while (
      inspected < TEXT_QUOTE_LIMITS.maxTraversalNodes + MARKDOWN_PAINTED_HIGHLIGHT_LIMIT
      && (node = walker.nextNode())
    ) {
      inspected++;
      const mark = node as Element;
      if (
        mark.localName === 'mark'
        && mark.hasAttribute('data-lr-highlight-tone')
        && !mark.hasAttribute('part')
      ) mark.setAttribute('part', 'highlight');
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
export function hitTestHighlightRanges(ranges: readonly ResolvedHighlightRange[], x: number, y: number): string | null {
  let remainingRects = TEXT_SELECTION_RECT_LIMIT;
  for (let i = ranges.length - 1; i >= 0; i--) {
    const hit = ranges[i];
    if (!hit) continue; // unreachable: counted loop, i is in [0, length - 1]
    for (const rect of hit.range.getClientRects()) {
      if (remainingRects-- <= 0) return null;
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
  const anchor = e.composedPath().find(
    (
      target,
    ): target is EventTarget & {
      localName: string;
      getAttribute(name: string): string | null;
    } =>
      typeof target === 'object' &&
      target !== null &&
      'localName' in target &&
      target.localName === 'a' &&
      'getAttribute' in target &&
      typeof target.getAttribute === 'function',
  );
  if (!anchor) return null;
  const href = anchor.getAttribute('href') ?? '';
  return href.startsWith(prefix) ? href : null;
}

export interface MarkdownContentOptions {
  /** The Markdown source -- also the plain-text fallback rendering when `renderedHtml` is `null`. */
  content: string;
  /** Whether the rendered document passed through DOMPurify. Unsanitized content gets an explicit
   *  paint-containment boundary in the shared stylesheet. */
  sanitized: boolean;
  /** Sanitized (or deliberately unsanitized) HTML, or `null` for the plain-text fallback: peers
   *  still loading, or a render attempt just fell back after a failure. The two states look
   *  identical on purpose -- a consumer distinguishes them via `lr-render-error`. */
  renderedHtml: string | null;
  /** The host's own `aria-label`, forwarded to the element that actually owns `role="document"` --
   *  a host `aria-label` doesn't reach shadow internals on its own. */
  hostAriaLabel: string | null;
  /** Whether the host's *resolved* `--lr-color-*` palette is a dark scheme. Shiki's dual-theme
   *  output carries its light colors as plain inline `color`/`background-color` and its dark ones
   *  in `--shiki-dark`/`--shiki-dark-bg`; the stylesheet's `[data-dark-theme='true']` rule is what
   *  swaps them, so without this flag every highlighted block paints light on a dark page. */
  isDarkTheme: boolean;
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
        aria-label=${options.hostAriaLabel ?? nothing}
        ?data-fallback=${isFallback}
        ?data-unsanitized=${!options.sanitized}
        data-dark-theme=${options.isDarkTheme ? 'true' : nothing}
        @click=${options.onClick}
      >
        ${isFallback ? options.content : unsafeHTML(options.renderedHtml)}
      </div>
      ${options.liveRegion}
    `;
}

/**
 * Starts (and immediately applies) the resolved-theme watch both markdown variants need so
 * Shiki's dual-theme output can be switched to its dark half. Returns the teardown; call it from
 * `disconnectedCallback()`/`adoptedCallback()`.
 *
 * Keyed on the component's own resolved `--lr-color-text`/`--lr-color-surface` rather than the
 * OS-level `prefers-color-scheme` query directly, so a consumer who sets `--lr-theme-color-*`
 * explicitly gets the dark palette too -- identical to `<lr-code-block>`'s own handling.
 */
export function watchMarkdownDarkTheme(host: HTMLElement, apply: (isDarkTheme: boolean) => void): () => void {
  apply(resolveIsDarkTheme(host));
  return watchDarkTheme(host, () => apply(resolveIsDarkTheme(host)));
}

/** Resolves the current Shiki palette half for shared ThemeWatcher callbacks and explicit refresh. */
export function resolveMarkdownDarkTheme(host: Element): boolean {
  return resolveIsDarkTheme(host);
}
