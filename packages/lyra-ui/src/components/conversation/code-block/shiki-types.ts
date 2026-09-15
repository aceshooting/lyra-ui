import { devWarnOnce } from '../../../internal/dev-mode-attribute-warning.js';
import { unwrapOptionalPeerDefault } from '../../../internal/optional-peer-capabilities.js';

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

/** A `languages` entry that hasn't been imported/resolved yet -- called at most once per
 *  distinct (`HighlighterCore`, normalized key) pair, the first time that key is actually
 *  requested (see `ensureShikiLanguageLoaded()`). May return either a grammar directly or an ES
 *  module namespace/default-export wrapper around one, matching a plain
 *  `() => import('@shikijs/langs/<name>')` call site verbatim -- no `.then(m => m.default)`
 *  required from the caller. */
export type ShikiLanguageLoader = () => Promise<ShikiLanguageInput | { default: ShikiLanguageInput }>;

/** One `languages` map entry: either an already-resolved grammar (today's contract, seeded eagerly
 *  into the `HighlighterCore` at creation) or a {@link ShikiLanguageLoader}, resolved and loaded
 *  into the core lazily via `HighlighterCore.loadLanguage()` the first time a fence actually
 *  requests that key -- see `resolvedShikiLanguages()` and `ensureShikiLanguageLoaded()`. */
export type ShikiLanguageSource = ShikiLanguageInput | ShikiLanguageLoader;

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

/**
 * The peer-neutral regex-scanning capability `createHighlighterCore()`'s own `engine` option
 * accepts. Lyra never calls either method itself -- a resolved value is only ever forwarded
 * straight through to Shiki's own `createHighlighterCore()` -- so this need only describe the
 * shape well enough to type-check a consumer-supplied factory, the same "just enough to
 * type-check" contract as {@link ShikiHighlighter} above.
 */
export interface ShikiRegexEngine {
  createScanner(patterns: readonly (string | RegExp)[]): unknown;
  createString(value: string): unknown;
}

/** A factory `setShikiCoreEngine()` accepts directly: called once per distinct `languages` object
 *  on first use, producing (synchronously or via a promise) the engine `loadShikiHighlighterCore()`
 *  builds its `HighlighterCore` with. */
export type ShikiRegexEngineFactory = () => ShikiRegexEngine | Promise<ShikiRegexEngine>;

/** `setShikiCoreEngine()`'s accepted values -- either of the two built-in presets, or a caller-
 *  supplied factory for a pre-instantiated engine or a WASM asset served from elsewhere. */
export type ShikiEngineOption = 'oniguruma' | 'javascript' | ShikiRegexEngineFactory;

/**
 * The Oniguruma engine, fetching the binary `shiki/onig.wasm` asset rather than importing
 * `shiki/wasm` (the base64-inlined module that specifier resolves to by default) -- streaming-
 * compilable and roughly 82 KB gzip smaller. `new URL('shiki/onig.wasm', import.meta.url)` is the
 * pattern a bundler statically detects and rewrites to the real built/served asset URL (Vite and
 * webpack 5 both support it); a bundler that does not support it makes the `fetch()` below reject,
 * which `loadShikiHighlighterCore()`'s own `.catch()` already degrades to the documented
 * plain-text fallback, so an unsupported bundler fails closed rather than throwing.
 */
function defaultOnigurumaEngineFactory(): Promise<ShikiRegexEngine> {
  return import('shiki/engine/oniguruma').then(
    ({ createOnigurumaEngine }) =>
      createOnigurumaEngine(fetch(new URL('shiki/onig.wasm', import.meta.url))) as unknown as Promise<ShikiRegexEngine>,
  );
}

/** The pure-JS regex engine -- no WebAssembly at all, at the cost of not every TextMate grammar
 *  being supported (an unsupported pattern throws while loading a grammar unless a `languages`
 *  entry is itself built with `forgiving` semantics). Opt in only once a bounded `languages` set is
 *  verified to highlight correctly with it. */
function javascriptEngineFactory(): Promise<ShikiRegexEngine> {
  return import('shiki/engine/javascript').then(
    ({ createJavaScriptRegexEngine }) => createJavaScriptRegexEngine() as unknown as ShikiRegexEngine,
  );
}

let engineFactory: ShikiRegexEngineFactory = defaultOnigurumaEngineFactory;

/**
 * Selects the regex-scanning engine every subsequent `loadShikiHighlighterCore()` call builds its
 * `HighlighterCore` with. `'oniguruma'` (the default) is the binary-WASM Oniguruma engine
 * documented on {@link defaultOnigurumaEngineFactory}; `'javascript'` selects
 * `createJavaScriptRegexEngine()` instead. A function value is called on first use per distinct
 * `languages` object and may return a {@link ShikiRegexEngine} synchronously or via a promise, for
 * a consumer supplying its own pre-instantiated engine or a WASM asset served from a different URL.
 * Every distinct engine gets its own cached `HighlighterCore` per `languages` object -- two engines
 * never share one, so switching engines mid-session cannot return a highlighter built for the
 * previous one.
 */
export function setShikiCoreEngine(engine: ShikiEngineOption): void {
  engineFactory =
    engine === 'oniguruma'
      ? defaultOnigurumaEngineFactory
      : engine === 'javascript'
        ? javascriptEngineFactory
        : engine;
}

/** @internal Test-only reset back to the built-in Oniguruma/WASM default. */
export function __resetShikiCoreEngineForTesting(): void {
  engineFactory = defaultOnigurumaEngineFactory;
}

/** One cached fine-grained highlighter promise per distinct `languages` object identity, further
 *  keyed by the engine factory active when it was built -- see `setShikiCoreEngine()`. */
const highlighterCores = new WeakMap<
  Record<string, ShikiLanguageInput>,
  Map<ShikiRegexEngineFactory, Promise<ShikiHighlighterCore | null>>
>();

// Owned component assignments detach equal grammar maps. Keep a small, weak recent index so
// those snapshots can reuse a core without retaining application grammars or changing the public
// identity cache. Eviction only loses reuse; it never disposes a highlighter a caller still owns.
const recentHighlighterCores: {
  languages: WeakRef<Record<string, ShikiLanguageInput>>;
  engine: ShikiRegexEngineFactory;
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

/** A registration's own registered `name` (if any) plus every name Shiki resolves to it without
 *  help -- its `name` and its declared `aliases`.
 *
 *  Tolerant of a *malformed* grammar by itself: a null, primitive, or wrong-shaped registration,
 *  and a non-string `name`/`aliases`, all degrade to "not a known name" rather than failing. It is
 *  NOT tolerant of a *reflection-hostile* one: the property reads below are plain, so a registration
 *  whose `name` is a throwing accessor throws out of this function, and the caller's own try/catch
 *  is what absorbs it (returning whatever aliases were derived before the throw). Do not restate
 *  the stronger "never throws" claim here -- it was written that way once and was wrong.
 *
 *  Note the separate, larger limitation this cannot fix: Shiki's own `createHighlighterCore()`
 *  reads the same properties while registering `langs`, outside any of this module's guards, so a
 *  single throwing accessor anywhere in the `languages` map fails the whole load and drops every
 *  valid sibling grammar with it -- degrading to unhighlighted code rather than to partial
 *  highlighting. Isolating that would mean pre-probing every property Shiki might touch, which is
 *  unbounded; it is recorded rather than guessed at, and left until a consumer actually hits it. */
function shikiGrammarOwnNames(input: ShikiLanguageInput): {
  primaryName: string | undefined;
  known: Set<string>;
} {
  const known = new Set<string>();
  let primaryName: string | undefined;
  const registrations = Array.isArray(input) ? input : [input];
  for (const registration of registrations) {
    if (!registration || typeof registration !== 'object') continue;
    const name = (registration as ShikiLanguageRegistration).name;
    if (typeof name === 'string' && name !== '') {
      known.add(name);
      primaryName ??= name;
    }
    const aliases = (registration as ShikiLanguageRegistration).aliases;
    if (Array.isArray(aliases)) {
      for (const alias of aliases) if (typeof alias === 'string') known.add(alias);
    }
  }
  return { primaryName, known };
}

/**
 * Derives a Shiki `langAlias` map (`{ [authorKey]: grammarOwnName }`) for every `languages` map
 * key that is neither the grammar's own registered `name` nor one of its declared `aliases`.
 * Shiki resolves a `lang` id (from `codeToHtml()`/`loadLanguage()`) strictly against each loaded
 * grammar's own name/aliases -- a `languages` entry keyed by anything else (e.g. reusing a
 * TypeScript grammar under the author-chosen key `'tsx'`, a common way to avoid bundling a second,
 * near-identical grammar) registers correctly but never matches that key, so
 * `codeToHtml({ lang: authorKey })` throws "Language `authorKey` not found" -- caught by every
 * caller here and downgraded to the plain-text fallback, so highlighting silently never activates
 * for that key. Passing the derived map as `createHighlighterCore()`'s own `langAlias` teaches
 * Shiki the author's key without renaming anything the grammar itself declares.
 *
 * Pure in `languages`: two maps `equalFrozenGrammars()` (this module's own highlighter-core reuse
 * check, above) considers equal always derive equal alias maps, so reusing a cached/recent core
 * for an equal `languages` object never carries a stale `langAlias` -- this needs no cache key of
 * its own.
 */
function buildShikiLangAlias(
  languages: Record<string, ShikiLanguageInput>,
): Record<string, string> | undefined {
  let aliases: Record<string, string> | undefined;
  try {
    for (const key of Object.keys(languages)) {
      const grammar = languages[key];
      if (grammar === undefined) continue;
      const { primaryName, known } = shikiGrammarOwnNames(grammar);
      if (!primaryName || known.has(key)) continue;
      aliases ??= {};
      aliases[key] = primaryName;
    }
  } catch {
    // Reflection failure on a hostile `languages` map -- fall back to whatever was already
    // derived, same as this module's other defensive catches.
    return aliases;
  }
  return aliases;
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
  const engine = engineFactory;
  let perEngine = highlighterCores.get(languages);
  let cached = perEngine?.get(engine);
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
      else if (entry.engine === engine && equalFrozenGrammars(languages, previous)) {
        cached = promise;
        recentHighlighterCores.splice(i, 1);
        recentHighlighterCores.push({ languages: new WeakRef(languages), engine, promise: entry.promise });
        perEngine ??= new Map();
        perEngine.set(engine, cached);
        highlighterCores.set(languages, perEngine);
        break;
      }
    }
  }
  if (!cached) {
    cached = Promise.all([
      import('shiki/core'),
      Promise.resolve(engine()),
      import('shiki/themes/github-light.mjs'),
      import('shiki/themes/github-dark.mjs'),
    ])
      .then(
        async ([{ createHighlighterCore }, resolvedEngine, light, dark]) => {
          const core = await createHighlighterCore({
            themes: [light.default, dark.default],
            langs: Object.values(languages) as never,
            langAlias: buildShikiLangAlias(languages),
            engine: resolvedEngine as never,
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
    perEngine ??= new Map();
    perEngine.set(engine, cached);
    highlighterCores.set(languages, perEngine);
    if (frozen) {
      recentHighlighterCores.push({ languages: new WeakRef(languages), engine, promise: new WeakRef(cached) });
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

// Memoizes resolvedShikiLanguages()'s derived, loader-free subset per input `languages` object
// identity -- see that function's own doc for why identity stability matters here.
const resolvedLanguagesCache = new WeakMap<
  Readonly<Record<string, ShikiLanguageSource>>,
  Record<string, ShikiLanguageInput>
>();

/**
 * The already-resolved subset of a `languages` map that may also contain lazy
 * {@link ShikiLanguageLoader} entries -- the subset `loadShikiHighlighterCore()` seeds a
 * `HighlighterCore` with at creation; a loader entry contributes nothing at seed time and is
 * loaded lazily instead, via `ensureShikiLanguageLoaded()`, the first time a fence actually
 * requests it.
 *
 * When `languages` contains no loader at all, the very same object is returned unchanged --
 * preserving `loadShikiHighlighterCore()`'s own identity-keyed cache for every caller that never
 * uses a loader, unchanged from before this function existed. Otherwise the derived subset is
 * memoized per input object identity, so a caller that re-derives it on every render for the same
 * stable `languages` object still gets the same output object back, and therefore still hits
 * `loadShikiHighlighterCore()`'s identity cache instead of rebuilding (and re-seeding) a
 * `HighlighterCore` on every call.
 */
export function resolvedShikiLanguages(
  languages: Readonly<Record<string, ShikiLanguageSource>>,
): Record<string, ShikiLanguageInput> {
  let hasLoader = false;
  for (const key of Object.keys(languages)) {
    if (typeof languages[key] === 'function') {
      hasLoader = true;
      break;
    }
  }
  if (!hasLoader) return languages as Record<string, ShikiLanguageInput>;
  let cached = resolvedLanguagesCache.get(languages);
  if (!cached) {
    cached = {};
    for (const key of Object.keys(languages)) {
      const value = languages[key];
      if (value !== undefined && typeof value !== 'function') cached[key] = value;
    }
    resolvedLanguagesCache.set(languages, cached);
  }
  return cached;
}

// Per-(core, normalized key) memoization of a loader's resolution + `loadLanguage()` call, so a
// core shared across multiple component instances or re-renders (via loadShikiHighlighterCore()'s
// own identity/content cache) never re-imports or re-registers the same lazy grammar twice. A
// failed load is memoized too, same convention as code-loader.ts's `unsupportedLanguages` Set --
// it never retries on every re-render, it just keeps rendering the plain-text fallback.
const loadedLanguageSources = new WeakMap<ShikiHighlighterCore, Map<string, Promise<boolean>>>();

const LAZY_LANGUAGE_SOURCE_WARNING_KEY = 'lyra-shiki-lazy-language-source-failed';
const LAZY_LANGUAGE_SOURCE_WARNING =
  'Lyra syntax highlighting could not load a lazy `languages` grammar loader. That language renders as plain text.';

/**
 * Resolves one `languages` entry that may be a {@link ShikiLanguageLoader}, loading it into `core`
 * via `HighlighterCore.loadLanguage()` the first time a given (core, key) pair is seen. Resolves to
 * `true` immediately, with no work done, for an entry that is already a plain grammar --
 * `loadShikiHighlighterCore()` already seeded that one into `core` at creation. Never rejects: a
 * loader that throws, or a `loadLanguage()` call that rejects, resolves to `false` instead (with a
 * one-time dev warning), so a caller can render the plain-text fallback for that key the same way
 * it already does for a key absent from `languages` altogether.
 *
 * Unlike an already-resolved entry (seeded through `buildShikiLangAlias()` at core creation, so an
 * author-chosen `languages` key never needs to match the grammar's own registered name), a lazily
 * loaded grammar is registered under whatever name/aliases it declares *itself* -- `loadLanguage()`
 * has no alias parameter. `codeToHtml`/`tokenize` calls must therefore request the grammar's own
 * name or a declared alias, not an arbitrary `languages` key, unless that key already happens to be
 * one of those (true for shiki's own bundled grammars keyed by their conventional short id, e.g.
 * `bash`/`ts`).
 */
export function ensureShikiLanguageLoaded(
  core: ShikiHighlighterCore,
  key: string,
  source: ShikiLanguageSource,
): Promise<boolean> {
  if (typeof source !== 'function') return Promise.resolve(true);
  let perCore = loadedLanguageSources.get(core);
  if (!perCore) {
    perCore = new Map();
    loadedLanguageSources.set(core, perCore);
  }
  let pending = perCore.get(key);
  if (!pending) {
    pending = Promise.resolve()
      .then(source)
      .then((resolved) => core.loadLanguage(unwrapOptionalPeerDefault(resolved) as ShikiLanguageInput))
      .then(() => true)
      .catch(() => {
        devWarnOnce(LAZY_LANGUAGE_SOURCE_WARNING_KEY, LAZY_LANGUAGE_SOURCE_WARNING);
        return false;
      });
    perCore.set(key, pending);
  }
  return pending;
}
