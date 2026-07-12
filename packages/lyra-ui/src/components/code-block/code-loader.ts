import type { Highlighter, BundledLanguage, BundledTheme } from 'shiki';

/** Re-exported under a component-scoped name so importers don't need their
 *  own `import type { Highlighter } from 'shiki'`. */
export type ShikiHighlighter = Highlighter;

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
export const SHIKI_LIGHT_THEME: BundledTheme = 'github-light';
export const SHIKI_DARK_THEME: BundledTheme = 'github-dark';

/** Passed directly as `codeToHtml()`'s `themes` option — see `tokenize()` in `code-block.ts`. */
export const SHIKI_THEMES: Record<'light' | 'dark', BundledTheme> = {
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
  if (hl.getLoadedLanguages().includes(lang)) return true;
  if (unsupportedLanguages.has(lang)) return false;
  try {
    await hl.loadLanguage(lang as BundledLanguage);
    return true;
  } catch {
    // Not a shiki-recognized grammar id/alias, or the grammar failed to
    // load for some other reason — either way, <lyra-code-block> treats an
    // unrecognized language the same as an unset one (plain text), and
    // there's nothing more specific a caller could do with the reason.
    unsupportedLanguages.add(lang);
    return false;
  }
}
