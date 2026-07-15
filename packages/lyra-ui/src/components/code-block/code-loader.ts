import type { OptionalPeerApi } from '../../internal/optional-peer-types.js';
import { GREYCAT_LANGUAGE } from './greycat-language.js';

/** Re-exported under a component-scoped name so importers don't need their
 *  own `import type { Highlighter } from 'shiki'`. */
export type ShikiHighlighter = OptionalPeerApi;

/** Re-exported under a component-scoped name — see `loadShikiHighlighterCore()`
 *  below. Structurally similar to `ShikiHighlighter` (both are
 *  `HighlighterGeneric<...>` instances providing `codeToHtml()` etc.) but
 *  typed with no bundled-language/theme keys of its own (`never`, since
 *  `createHighlighterCore()` has no built-in bundle to know about), which is
 *  why it's a distinct exported type rather than reusing `ShikiHighlighter`. */
export type ShikiHighlighterCore = OptionalPeerApi;

/** Re-exported under a component-scoped name — the shape of one pre-imported
 *  shiki grammar module's default export (e.g. `import bash from
 *  'shiki/langs/bash.mjs'`), and what `<lyra-code-block>`'s `languages`
 *  property maps language ids to. See `loadShikiHighlighterCore()` below. */
export type ShikiLanguageInput = OptionalPeerApi;

/**
 * The two bundled themes every highlighter instance is seeded with, so a
 * single `codeToHtml()` call can emit a light *and* dark rendering at once
 * (shiki's "dual themes" feature — https://shiki.style/guide/dual-themes —
 * rather than maintaining two separately-highlighted copies). `github-light`/
 * `github-dark` are well-known, reasonably neutral, and already part of
 * shiki's bundled theme set, so picking them costs no extra install. See the
 * `prefers-color-scheme` block in `code-block.styles.ts` for how the dark
 * variant actually activates.
 */
export const SHIKI_LIGHT_THEME: string = 'github-light';
export const SHIKI_DARK_THEME: string = 'github-dark';

/** Passed directly as `codeToHtml()`'s `themes` option — see `tokenize()` in `code-block.ts`. */
export const SHIKI_THEMES: Record<'light' | 'dark', string> = {
  light: SHIKI_LIGHT_THEME,
  dark: SHIKI_DARK_THEME,
};

let highlighter: Promise<ShikiHighlighter | null> | undefined;

/** Language ids that have already failed `loadLanguage()` once — avoids
 *  retrying (and re-throwing on) the same unrecognized `language` value on
 *  every re-render of every `<lyra-code-block>` that requests it. Shared
 *  across every highlighter instance the page ever creates (there's only
 *  ever one, see `loadShikiHighlighter()` below), so this never needs
 *  resetting alongside it. */
const unsupportedLanguages = new Set<string>();

const CUSTOM_LANGUAGES: Record<string, ShikiLanguageInput> = {
  gcl: GREYCAT_LANGUAGE,
  greycat: GREYCAT_LANGUAGE,
};

/** Normalizes ids supplied by filename-oriented integrations and templates. */
export function normalizeShikiLanguage(lang: string): string {
  return lang.trim().toLowerCase().replace(/^\./, '');
}

/**
 * Lazily loads the optional peer dependency `shiki` once per page and builds
 * (and caches) a single `Highlighter` instance seeded with `SHIKI_THEMES` and
 * *zero* language grammars. Creating the highlighter — compiling its regex
 * engine, parsing the seed themes — is the expensive part, not the dynamic
 * `import()` itself, so the created instance is what's cached here rather
 * than just the resolved module (one level deeper than `map-loader.ts`'s
 * single-dependency cached-promise shape, which this otherwise mirrors).
 * Resolves to `null` (with a one-time `console.warn`) if shiki isn't
 * installed — `<lyra-code-block>` falls back to plain unhighlighted text in
 * that case, which is a fully supported default, not a degraded mode. No
 * language grammar is loaded up front; `loadShikiLanguage()` below loads each
 * one incrementally the first time a `language` value actually requests it.
 */
export function loadShikiHighlighter(): Promise<ShikiHighlighter | null> {
  if (!highlighter) {
    highlighter = import('shiki')
      .then((mod) => mod.createHighlighter({ themes: [SHIKI_LIGHT_THEME, SHIKI_DARK_THEME], langs: [] }))
      .catch((err) => {
        console.warn(
          '<lyra-code-block> needs the optional peer dependency `shiki` for syntax highlighting — install it ' +
            'with `pnpm add shiki`. Code still renders, just unhighlighted, without it:',
          err,
        );
        return null;
      });
  }
  return highlighter;
}

/**
 * Ensures `lang` is loaded into `hl`, loading it on demand the first time
 * it's requested rather than bundling every possible grammar up front —
 * shiki supports this incrementally via `Highlighter.loadLanguage()`, which
 * is what keeps this lazy instead of defeating the point of lazy-loading the
 * peer at all. Resolves `false` (and remembers not to retry) when `lang`
 * isn't a shiki-recognized grammar id or alias at all, so a caller can fall
 * back to plain-text rendering instead of retrying an id that can never
 * succeed on every future render.
 */
export async function loadShikiLanguage(hl: ShikiHighlighter, lang: string): Promise<boolean> {
  const normalizedLanguage = normalizeShikiLanguage(lang);
  if (hl.getLoadedLanguages().includes(normalizedLanguage)) return true;
  if (unsupportedLanguages.has(normalizedLanguage)) return false;
  try {
    await hl.loadLanguage(CUSTOM_LANGUAGES[normalizedLanguage] ?? normalizedLanguage);
    return true;
  } catch {
    // Not a shiki-recognized grammar id/alias, or the grammar failed to
    // load for some other reason — either way, <lyra-code-block> treats an
    // unrecognized language the same as an unset one (plain text), and
    // there's nothing more specific a caller could do with the reason.
    unsupportedLanguages.add(normalizedLanguage);
    return false;
  }
}

/** One cached `ShikiHighlighterCore` promise per distinct `languages` object
 *  a caller has passed in — keyed by object identity (not content), so a
 *  consumer that keeps passing the *same* `languages` map reference (the
 *  normal case: a module-level constant, not a fresh object literal on every
 *  render) only ever builds one highlighter for it, same "the highlighter
 *  itself is the expensive part" rationale as `loadShikiHighlighter()`'s
 *  single cached instance above. A `WeakMap` lets an abandoned `languages`
 *  object (and its highlighter) be garbage-collected once nothing else
 *  references it. */
const highlighterCores = new WeakMap<Record<string, ShikiLanguageInput>, Promise<ShikiHighlighterCore | null>>();

/**
 * Builds (and caches — see `highlighterCores` above) a fine-grained
 * `HighlighterCore` seeded with `SHIKI_THEMES` and *only* the grammars in
 * `languages`, via shiki's own "fine-grained bundle" recipe:
 * `createHighlighterCore()` (`shiki/core`) plus an explicit oniguruma engine
 * (`shiki/engine/oniguruma` + the `shiki/wasm` binary) instead of
 * `loadShikiHighlighter()`'s `createHighlighter()` (plain `shiki`).
 *
 * The point isn't runtime cost — `loadShikiHighlighter()`'s per-language
 * `loadLanguage()` dynamic import is already well-optimized for that (see its
 * doc comment). It's *build output*: `shiki`'s main entry point (what
 * `loadShikiHighlighter()` imports) bundles a lookup table of dynamic
 * `import()` calls, one per shiki-supported language (~200 of them), because
 * `loadLanguage(lang: string)` resolves that string against the table at
 * runtime — a bundler can't statically narrow which of those ~200 entries a
 * given app will ever actually request, so it conservatively emits a
 * build-output chunk for every one of them. `shiki/core` has no such
 * table — a bundler only ever sees the exact grammar modules a caller
 * `import`s for `languages` itself, so a consumer with a known, fixed
 * language set gets a build output scoped to just those languages instead of
 * shiki's full bundled set.
 *
 * This is *only* ever consulted for languages present in `languages` — see
 * `<lyra-code-block>`'s `syncHighlight()`. A language absent from it still
 * falls back to the ordinary `loadShikiHighlighter()` + `loadShikiLanguage()`
 * dynamic-import path entirely unchanged, so a caller can pin its own known
 * set while still letting an unexpected language through. Resolves to `null`
 * (with a one-time `console.warn`, same convention as `loadShikiHighlighter()`)
 * if building the fine-grained highlighter fails for any reason.
 */
export function loadShikiHighlighterCore(
  languages: Record<string, ShikiLanguageInput>,
): Promise<ShikiHighlighterCore | null> {
  let cached = highlighterCores.get(languages);
  if (!cached) {
    cached = Promise.all([
      import('shiki/core'),
      import('shiki/engine/oniguruma'),
      import('shiki/themes/github-light.mjs'),
      import('shiki/themes/github-dark.mjs'),
    ])
      .then(([{ createHighlighterCore }, { createOnigurumaEngine }, light, dark]) =>
        createHighlighterCore({
          themes: [light.default, dark.default],
          langs: Object.values(languages),
          engine: createOnigurumaEngine(import('shiki/wasm')),
        }),
      )
      .catch((err) => {
        console.warn(
          "<lyra-code-block>'s `languages` property failed to build a fine-grained shiki highlighter — " +
            'falling back to plain unhighlighted text for the languages it covers:',
          err,
        );
        return null;
      });
    highlighterCores.set(languages, cached);
  }
  return cached;
}
