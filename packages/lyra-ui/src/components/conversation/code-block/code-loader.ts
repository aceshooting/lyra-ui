import { GREYCAT_LANGUAGE } from './greycat-language.js';
import {
  SHIKI_DARK_THEME,
  SHIKI_LIGHT_THEME,
  normalizeShikiLanguage,
  type ShikiHighlighter,
  type ShikiLanguageInput,
} from './shiki-types.js';

// Preserve the established full-loader module surface. Lean components import the peer-neutral
// and fine-grained leaves directly so this module's `import('shiki')` cannot enter their graph.
export {
  SHIKI_DARK_THEME,
  SHIKI_LIGHT_THEME,
  SHIKI_THEMES,
  normalizeShikiLanguage,
  type ShikiHighlighter,
  type ShikiHighlighterCore,
  type ShikiLanguageInput,
} from './shiki-types.js';
export { loadShikiHighlighterCore } from './shiki-types.js';

let highlighter: Promise<ShikiHighlighter | null> | undefined;

/** Language ids that have already failed `loadLanguage()` once — avoids
 *  retrying (and re-throwing on) the same unrecognized `language` value on
 *  every re-render of every `<lr-code-block>` that requests it. Shared
 *  across every highlighter instance the page ever creates (there's only
 *  ever one, see `loadShikiHighlighter()` below), so this never needs
 *  resetting alongside it. */
const unsupportedLanguages = new Set<string>();

const CUSTOM_LANGUAGES: Record<string, ShikiLanguageInput> = {
  gcl: GREYCAT_LANGUAGE,
  greycat: GREYCAT_LANGUAGE,
};

/**
 * Lazily loads the optional peer dependency `shiki` once per page and builds
 * (and caches) a single `Highlighter` instance seeded with `SHIKI_THEMES` and
 * *zero* language grammars. Creating the highlighter — compiling its regex
 * engine, parsing the seed themes — is the expensive part, not the dynamic
 * `import()` itself, so the created instance is what's cached here rather
 * than just the resolved module (one level deeper than `map-loader.ts`'s
 * single-dependency cached-promise shape, which this otherwise mirrors).
 * Resolves to `null` (with a one-time `console.warn`) if shiki isn't
 * installed — `<lr-code-block>` falls back to plain unhighlighted text in
 * that case, which is a fully supported default, not a degraded mode. No
 * language grammar is loaded up front; `loadShikiLanguage()` below loads each
 * one incrementally the first time a `language` value actually requests it.
 */
export function loadShikiHighlighter(): Promise<ShikiHighlighter | null> {
  if (!highlighter) {
    highlighter = import('shiki')
      .then(
        (mod) =>
          mod.createHighlighter({
            themes: [SHIKI_LIGHT_THEME, SHIKI_DARK_THEME],
            langs: [],
          }) as unknown as ShikiHighlighter
      )
      .catch((err) => {
        console.warn(
          '<lr-code-block> needs the optional peer dependency `shiki` for syntax highlighting — install it ' +
            'with `pnpm add shiki`. Code still renders, just unhighlighted, without it:',
          err
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
export async function loadShikiLanguage(
  hl: ShikiHighlighter,
  lang: string
): Promise<boolean> {
  const normalizedLanguage = normalizeShikiLanguage(lang);
  if (hl.getLoadedLanguages().includes(normalizedLanguage)) return true;
  if (unsupportedLanguages.has(normalizedLanguage)) return false;
  try {
    await hl.loadLanguage(
      CUSTOM_LANGUAGES[normalizedLanguage] ?? normalizedLanguage
    );
    return true;
  } catch {
    // Not a shiki-recognized grammar id/alias, or the grammar failed to
    // load for some other reason — either way, <lr-code-block> treats an
    // unrecognized language the same as an unset one (plain text), and
    // there's nothing more specific a caller could do with the reason.
    unsupportedLanguages.add(normalizedLanguage);
    return false;
  }
}
