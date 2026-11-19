import { createOptionalPeerLoader, type HtmlSanitizer } from '../../../internal/optional-peer-capabilities.js';
import { loadDompurify } from '../../../internal/dompurify-loader.js';

/**
 * The configurable parser capability exposed by both Markdown variants' `marked` getter.
 * It is intentionally owned by Lyra so core declarations remain usable when
 * the optional `marked` peer is not installed.
 */
export interface LyraMarkedParser {
  readonly defaults: Record<string, unknown>;
  /** Installs one or more Marked extensions on the shared parser. */
  use(...extensions: MarkedExtension[]): LyraMarkedParser;
  parse(source: string, options: Record<string, unknown> & { async: false }): string;
  parse(source: string, options?: Record<string, unknown>): string | Promise<string>;
}

export interface MarkedParserContext {
  parser: {
    parse(tokens: unknown[]): string;
    parseInline(tokens: unknown[], renderer?: unknown): string;
    textRenderer: unknown;
  };
  listitem(token: unknown): string;
  tablecell(token: unknown): string;
  tablerow(token: { text: string }): string;
}

interface MarkedTokenBase {
  tokens: unknown[];
}

export interface MarkedRenderer {
  heading(this: MarkedParserContext, token: MarkedTokenBase & { depth: number }): string;
  paragraph(this: MarkedParserContext, token: MarkedTokenBase): string;
  list(
    this: MarkedParserContext,
    token: {
      ordered: boolean;
      start: number;
      items: unknown[];
    },
  ): string;
  code(
    this: MarkedParserContext,
    token: {
      lang?: string;
      text: string;
      escaped: boolean;
    },
  ): string;
  codespan(this: MarkedParserContext, token: { text: string }): string;
  blockquote(this: MarkedParserContext, token: MarkedTokenBase): string;
  table(
    this: MarkedParserContext,
    token: {
      header: Array<MarkedTokenBase & { align?: string | null }>;
      rows: Array<Array<MarkedTokenBase & { align?: string | null }>>;
    },
  ): string;
  link(
    this: MarkedParserContext,
    token: MarkedTokenBase & {
      href: string;
      title?: string | null;
    },
  ): string;
  image(
    this: MarkedParserContext,
    token: MarkedTokenBase & {
      href: string;
      title?: string | null;
    },
  ): string;
  html(this: MarkedParserContext, token: { text: string }): string;
}

/** Peer-neutral configuration accepted by the subset of `Marked#use()` Lyra invokes. */
export interface MarkedExtension {
  renderer?: Partial<MarkedRenderer>;
  extensions?: unknown[];
  [key: string]: unknown;
}

/** The constructor capability Lyra consumes from the optional `marked` peer. */
export interface MarkedModule {
  Marked: new () => LyraMarkedParser;
}

function isLyraMarkedParser(value: unknown): value is LyraMarkedParser {
  return (
    typeof value === 'object' &&
    value !== null &&
    'defaults' in value &&
    typeof value.defaults === 'object' &&
    value.defaults !== null &&
    'use' in value &&
    typeof value.use === 'function' &&
    'parse' in value &&
    typeof value.parse === 'function'
  );
}

function isMarkedModule(value: unknown): value is MarkedModule {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null || !('Marked' in value)) {
    return false;
  }

  try {
    const Marked = value.Marked;
    if (typeof Marked !== 'function') return false;
    return isLyraMarkedParser(new (Marked as new () => unknown)());
  } catch {
    return false;
  }
}

const markedLoader = /* @__PURE__ */ createOptionalPeerLoader<MarkedModule>({
  cache: 'generation',
  load: () => import('marked'),
  isCapability: isMarkedModule,
  warningKey: 'lyra-markdown-marked-unavailable',
  warning:
    '<lr-markdown>/<lr-markdown-core>: Markdown parsing is unavailable because the optional marked peer could not load. Content is rendered as plain text.',
});

/**
 * The two optional peers `<lr-markdown>` needs, loaded independently (see
 * `loadMarkdownAndSanitizer()`). Either half can be `undefined` on its own —
 * a consumer who only installs `marked` (having explicitly selected
 * `html-mode="trusted"`) is a valid, supported combination.
 */
export interface MarkdownDeps {
  marked: MarkedModule | undefined;
  DOMPurify: HtmlSanitizer | undefined;
}

let deps: Promise<MarkdownDeps> | undefined;

// Populated the instant `deps` settles (inside `loadMarkdownDeps()` below) so
// `getMarkdownDepsIfLoaded()` can hand one back synchronously -- the whole
// point of that function, since `deps` itself is a Promise and awaiting it
// always costs at least one microtask, even once already resolved.
let resolvedDeps: MarkdownDeps | undefined;

/**
 * Independently loads the optional peer dependencies `marked` (Markdown
 * parsing) and `dompurify` (HTML sanitizing), mirroring `chart-feature-loader.ts`'s
 * `loadChartAndZoom()` shape for two independent optional peers. A partial
 * install — most usefully `marked` alone, for a consumer who has explicitly
 * set `html-mode="trusted"` and doesn't need `dompurify` at all — degrades to
 * "that one half is missing" rather than failing outright. Exported (in
 * addition to the cached `loadMarkdownDeps()` below) so both failure paths —
 * and their development diagnostics — are directly testable without
 * needing to actually uninstall either package.
 */
export async function loadMarkdownAndSanitizer(
  importMarked?: () => Promise<unknown>,
  importDompurify?: () => Promise<unknown>,
): Promise<MarkdownDeps> {
  const [marked, DOMPurify] = await Promise.all([importMarked ? markedLoader.loadWith(importMarked) : markedLoader.load(), loadDompurify(importDompurify)]);
  return { marked: marked ?? undefined, DOMPurify: DOMPurify ?? undefined };
}

/** Shares in-flight peer loads and caches a complete parser and sanitizer pair. A later
 *  connection retries after a partial load, keeping the plain-text fallback available. */
export function loadMarkdownDeps(): Promise<MarkdownDeps> {
  if (!deps) {
    deps = loadMarkdownAndSanitizer().then((resolved) => {
      if (resolved.marked && resolved.DOMPurify) resolvedDeps = resolved;
      else deps = undefined;
      return resolved;
    });
  }
  return deps;
}

/**
 * Synchronous companion to `loadMarkdownDeps()`: returns the same
 * module-level cached `MarkdownDeps` if some earlier call to
 * `loadMarkdownDeps()` — from any `<lr-markdown>` instance on the page, or
 * a consumer priming it directly at startup — has already settled by the
 * time this is called, or `undefined` if the cache isn't warm yet (nothing
 * has called `loadMarkdownDeps()` before, or it's still in flight). Used by
 * every instance to skip the dynamic `import()`'s async hop once the peers are already loaded. It
 * cannot make the *very first* `<lr-markdown>` on a page synchronous unless a consumer called
 * `preloadMarkdown()` first.
 */
export function getMarkdownDepsIfLoaded(): MarkdownDeps | undefined {
  return resolvedDeps;
}
