import { devWarnOnce } from '../../../internal/dev-mode-attribute-warning.js';

/**
 * The peer-neutral highlighter capability used by Lyra's code-rendering components.
 *
 * This deliberately describes only the operations Lyra invokes. It keeps public declarations
 * useful without requiring consumers to install Shiki merely to type-check an element reference.
 */
export interface ShikiHighlighter {
  codeToHtml(code: string, options: Record<string, unknown>): string;
  getLoadedLanguages(): string[];
  loadLanguage(language: string | ShikiLanguageInput): Promise<void>;
}

/**
 * A fine-grained Shiki highlighter has the same capability surface Lyra consumes as the default
 * highlighter, but is constructed from application-supplied grammars.
 */
export type ShikiHighlighterCore = ShikiHighlighter;

/**
 * Narrows an unknown value (the resolved output of `shiki`'s `createHighlighter()`/
 * `createHighlighterCore()`) to the highlighter capability Lyra actually calls. Both
 * `loadShikiHighlighter()` (`code-loader.ts`) and `loadShikiHighlighterCore()` below validate
 * their built instance through this before caching/returning it, so a malformed or spoofed peer
 * fails closed at load time -- resolving `null` with the documented warning -- instead of reaching
 * `<lr-code-block>`/`<lr-markdown>`'s render path and throwing there. Exported so a call site that
 * receives an already-resolved highlighter from elsewhere (e.g. `syncHighlight()`'s live
 * per-language check) can also tolerate a shape-valid peer whose method throws only when actually
 * invoked, which a load-time shape check alone cannot catch.
 */
export function isShikiHighlighter(candidate: unknown): candidate is ShikiHighlighter {
  return (
    (typeof candidate === 'object' || typeof candidate === 'function') &&
    candidate !== null &&
    typeof (candidate as ShikiHighlighter).getLoadedLanguages === 'function' &&
    typeof (candidate as ShikiHighlighter).loadLanguage === 'function' &&
    typeof (candidate as ShikiHighlighter).codeToHtml === 'function'
  );
}

/** The peer-neutral shape of one TextMate grammar registration. */
export interface ShikiLanguageRegistration {
  name: string;
  scopeName: string;
  displayName?: string;
  aliases?: string[];
  patterns?: unknown[];
  repository?: Record<string, unknown>;
}

/** A pre-imported Shiki language module's default export. Shiki 4 language modules export an
 *  array because one language entry can register multiple related TextMate grammars. */
export type ShikiLanguageInput =
  | ShikiLanguageRegistration
  | readonly ShikiLanguageRegistration[];

/** The subset of a Shiki/HAST element node that Lyra's transformers mutate. */
interface ShikiTransformerNode {
  properties: Record<string, unknown> & {
    part?: unknown;
    role?: unknown;
  };
}

/**
 * The peer-neutral transformer hooks used by Lyra's code and Markdown renderers.
 * Consumers do not need Shiki installed merely to consume the generated declarations.
 */
export interface ShikiTransformer {
  name?: string;
  pre?(node: ShikiTransformerNode): void;
  code?(node: ShikiTransformerNode): void;
  line?(node: ShikiTransformerNode, line: number): void;
}

// Peer-neutral values shared by the full and fine-grained loaders. This module must never import
// Shiki's main entry: lean component entry points depend on it and promise not to reach the full
// language table.
export const SHIKI_LIGHT_THEME: string = 'github-light';
export const SHIKI_DARK_THEME: string = 'github-dark';

/** Passed directly as `codeToHtml()`'s dual-theme option. */
export const SHIKI_THEMES: Record<'light' | 'dark', string> = {
  light: SHIKI_LIGHT_THEME,
  dark: SHIKI_DARK_THEME,
};

/** Normalizes ids supplied by filename-oriented integrations and templates. */
export function normalizeShikiLanguage(lang: string): string {
  return lang.trim().toLowerCase().replace(/^\./, '');
}

/** One cached fine-grained highlighter promise per distinct `languages` object identity. */
const highlighterCores = new WeakMap<
  Record<string, ShikiLanguageInput>,
  Promise<ShikiHighlighterCore | null>
>();

// Owned component assignments detach equal grammar maps. Keep a small, weak recent index so
// those snapshots can reuse a core without retaining application grammars or changing the public
// identity cache. Eviction only loses reuse; it never disposes a highlighter a caller still owns.
const recentHighlighterCores: {
  languages: WeakRef<Record<string, ShikiLanguageInput>>;
  promise: WeakRef<Promise<ShikiHighlighterCore | null>>;
}[] = [];

/** Exact, bounded comparison of immutable grammar data; unusual inputs keep identity-only reuse. */
function equalFrozenGrammars(left: unknown, right: unknown): boolean {
  let remaining = 20_000;
  const leftSeen = new WeakSet<object>();
  const rightSeen = new WeakSet<object>();
  const equal = (a: unknown, b: unknown, depth: number): boolean => {
    if (--remaining < 0 || depth > 32 || typeof a !== typeof b) return false;
    if (typeof a === 'function' || typeof a === 'symbol') return false;
    if (typeof a === 'number' && (!Number.isFinite(a) || !Number.isFinite(b))) return false;
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object')
      return Object.is(a, b);
    if (!Object.isFrozen(a) || !Object.isFrozen(b) || leftSeen.has(a) || rightSeen.has(b))
      return false;
    const prototype = Object.getPrototypeOf(a) as object | null;
    if (
      prototype !== Object.getPrototypeOf(b) ||
      (prototype !== Object.prototype && prototype !== Array.prototype && prototype !== null) ||
      Array.isArray(a) !== Array.isArray(b)
    ) return false;
    leftSeen.add(a);
    rightSeen.add(b);
    const leftKeys = Reflect.ownKeys(a);
    const rightKeys = Reflect.ownKeys(b);
    if (leftKeys.length !== rightKeys.length || leftKeys.length > remaining) return false;
    for (let i = 0; i < leftKeys.length; i += 1) {
      const key = leftKeys[i]!;
      if (typeof key !== 'string' || key !== rightKeys[i]) return false;
      const first = Object.getOwnPropertyDescriptor(a, key)!;
      const second = Object.getOwnPropertyDescriptor(b, key)!;
      if (
        !('value' in first) || !('value' in second) ||
        first.enumerable !== second.enumerable ||
        !equal(first.value, second.value, depth + 1)
      ) return false;
    }
    return true;
  };
  try {
    return equal(left, right, 0);
  } catch {
    return false;
  }
}

type ShikiHighlighterCoreLoader = (
  languages: Record<string, ShikiLanguageInput>
) => Promise<ShikiHighlighterCore | null>;
let highlighterCoreLoaderForTesting: ShikiHighlighterCoreLoader | undefined;

const FINE_GRAINED_SHIKI_WARNING_KEY = 'lyra-fine-grained-shiki-highlighter-unavailable';
const FINE_GRAINED_SHIKI_WARNING =
  'Lyra syntax highlighting failed to build a fine-grained shiki highlighter from the supplied grammars. Code is rendered as plain text.';

/** @internal Replaces the fine-grained loader for deterministic async-generation tests. */
export function __setShikiHighlighterCoreLoaderForTesting(
  loader: ShikiHighlighterCoreLoader | undefined
): void {
  highlighterCoreLoaderForTesting = loader;
}

/**
 * Builds and caches a fine-grained `HighlighterCore` seeded with only the supplied grammars.
 * The identity cache also shares recently used equivalent, deeply frozen plain grammar maps.
 * This bounded weak reuse never changes mutable or unusual inputs' identity-only caching.
 * Only Shiki subpaths are imported here; the package's main entry and full grammar table remain
 * unreachable from lean component graphs.
 */
export function loadShikiHighlighterCore(
  languages: Record<string, ShikiLanguageInput>
): Promise<ShikiHighlighterCore | null> {
  if (highlighterCoreLoaderForTesting)
    return highlighterCoreLoaderForTesting(languages);
  let cached = highlighterCores.get(languages);
  let frozen = false;
  if (!cached) {
    try {
      frozen = Object.isFrozen(languages);
    } catch {
      // Reflection failures retain the existing asynchronous plain-text fallback.
    }
  }
  if (frozen) {
    for (let i = recentHighlighterCores.length - 1; i >= 0; i -= 1) {
      const entry = recentHighlighterCores[i]!;
      const previous = entry.languages.deref();
      const promise = entry.promise.deref();
      if (!previous || !promise) recentHighlighterCores.splice(i, 1);
      else if (equalFrozenGrammars(languages, previous)) {
        cached = promise;
        recentHighlighterCores.splice(i, 1);
        recentHighlighterCores.push({ languages: new WeakRef(languages), promise: entry.promise });
        highlighterCores.set(languages, cached);
        break;
      }
    }
  }
  if (!cached) {
    cached = Promise.all([
      import('shiki/core'),
      import('shiki/engine/oniguruma'),
      import('shiki/themes/github-light.mjs'),
      import('shiki/themes/github-dark.mjs'),
    ])
      .then(
        async ([{ createHighlighterCore }, { createOnigurumaEngine }, light, dark]) => {
          const core = await createHighlighterCore({
            themes: [light.default, dark.default],
            langs: Object.values(languages) as never,
            engine: createOnigurumaEngine(import('shiki/wasm')),
          });
          if (!isShikiHighlighter(core)) {
            throw new Error(
              'Invalid optional peer `shiki`: `createHighlighterCore()` did not produce a usable highlighter capability.',
            );
          }
          return core;
        }
      )
      .catch(() => {
        devWarnOnce(FINE_GRAINED_SHIKI_WARNING_KEY, FINE_GRAINED_SHIKI_WARNING);
        return null;
      });
    highlighterCores.set(languages, cached);
    if (frozen) {
      recentHighlighterCores.push({ languages: new WeakRef(languages), promise: new WeakRef(cached) });
      if (recentHighlighterCores.length > 8) recentHighlighterCores.shift();
      const pending = cached;
      void pending.then(core => {
        if (core) return;
        for (let i = recentHighlighterCores.length - 1; i >= 0; i -= 1)
          if (recentHighlighterCores[i]!.promise.deref() === pending)
            recentHighlighterCores.splice(i, 1);
      });
    }
  }
  return cached;
}
