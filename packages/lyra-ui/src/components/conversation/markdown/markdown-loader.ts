import {
  isHtmlSanitizer,
  resolveOptionalPeerCapability,
  type HtmlSanitizer,
} from '../../../internal/optional-peer-capabilities.js';
import { devWarnOnce } from '../../../internal/dev-mode-attribute-warning.js';

const MARKDOWN_PARSER_WARNING_KEY = 'lyra-markdown-marked-unavailable';
const MARKDOWN_PARSER_WARNING =
  '<lr-markdown>/<lr-markdown-core>: Markdown parsing is unavailable because the optional marked peer could not load. Content is rendered as plain text.';
const MARKDOWN_SANITIZER_WARNING_KEY = 'lyra-markdown-dompurify-unavailable';
const MARKDOWN_SANITIZER_WARNING =
  '<lr-markdown>/<lr-markdown-core>: HTML sanitization is unavailable because the optional DOMPurify peer could not load. Content is rendered as plain text unless trusted HTML is explicitly selected.';

function warnMarkdownParserUnavailable(): void {
  devWarnOnce(MARKDOWN_PARSER_WARNING_KEY, MARKDOWN_PARSER_WARNING);
}

function warnMarkdownSanitizerUnavailable(): void {
  devWarnOnce(MARKDOWN_SANITIZER_WARNING_KEY, MARKDOWN_SANITIZER_WARNING);
}

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
  importMarked: () => Promise<unknown> = () => import('marked'),
  importDompurify: () => Promise<unknown> = () => import('dompurify'),
): Promise<MarkdownDeps> {
  let marked: MarkedModule | undefined;
  try {
    marked = resolveOptionalPeerCapability(await importMarked(), isMarkedModule) ?? undefined;
  } catch {
    warnMarkdownParserUnavailable();
  }

  let DOMPurify: HtmlSanitizer | undefined;
  try {
    // Different bundler/interop configurations resolve a CJS-published optional peer as either
    // `{ default: X }` or the bare module namespace -- reading only `.default` would silently
    // substitute `undefined` for the real sanitizer under the other resolution, a security-
    // relevant regression (sanitization would silently no-op). Mirrors email-loader.ts's and
    // calendar-loader.ts's identical `module.default ?? module` fallback.
    DOMPurify = resolveOptionalPeerCapability(await importDompurify(), isHtmlSanitizer) ?? undefined;
  } catch {
    warnMarkdownSanitizerUnavailable();
  }

  return { marked, DOMPurify };
}

/**
 * Lazily loads `marked` + `dompurify` once per page (see
 * `loadMarkdownAndSanitizer()` for why each is loaded and caught
 * independently). Cached the same way `chart-core-loader.ts`/`map-loader.ts`
 * cache their promise, so every `<lr-markdown>` instance on a page shares
 * one load.
 *
 * The dynamic `import()` inside `loadMarkdownAndSanitizer()` is always
 * asynchronous — even when both peers are already installed and resolve
 * without error — so every `<lr-markdown>` that calls this from
 * `connectedCallback()` paints its plain-text fallback (`data-fallback` on
 * the `content` part) for at least one microtask before the real rendered
 * output replaces it. That window is unconditional, not just a failure
 * path: it ends only once this promise settles. A consumer that wants to avoid it can call the
 * public `preloadMarkdown()` helper before mounting the first instance. Every later instance
 * adopts the settled cache synchronously.
 */
export function loadMarkdownDeps(): Promise<MarkdownDeps> {
  if (!deps) {
    deps = loadMarkdownAndSanitizer().then((resolved) => {
      resolvedDeps = resolved;
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
