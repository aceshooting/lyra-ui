import { GREYCAT_LANGUAGE } from './greycat-language.js';
import {
  SHIKI_DARK_THEME,
  SHIKI_LIGHT_THEME,
  isShikiHighlighter,
  normalizeShikiLanguage,
  type ShikiHighlighter,
  type ShikiLanguageInput,
} from './shiki-types.js';
import { resolveOptionalPeerCapability } from '../../../internal/optional-peer-capabilities.js';

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

/** The shape of the `shiki` module namespace this loader actually calls -- the highlighter
 *  `createHighlighter()` produces is validated separately by `isShikiHighlighter()` below. */
interface ShikiModule {
  createHighlighter(options: Record<string, unknown>): Promise<unknown>;
}

function isShikiModule(candidate: unknown): candidate is ShikiModule {
  return (
    (typeof candidate === 'object' || typeof candidate === 'function') &&
    candidate !== null &&
    typeof (candidate as ShikiModule).createHighlighter === 'function'
  );
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
 * installed — `<lr-code-block>` falls back to plain unhighlighted text in
 * that case, which is a fully supported default, not a degraded mode. No
 * language grammar is loaded up front; `loadShikiLanguage()` below loads each
 * one incrementally the first time a `language` value actually requests it.
 */
export function loadShikiHighlighter(): Promise<ShikiHighlighter | null> {
  if (!highlighter) {
    highlighter = import('shiki')
      .then(async (mod) => {
        // Handles both the flat-namespace shape a native ESM `shiki` import produces and a
        // `{ default }`-wrapped shape a CJS-interop bundler/test harness might produce instead.
        const shikiModule = resolveOptionalPeerCapability(mod, isShikiModule);
        if (!shikiModule) {
          throw new Error(
            'Invalid optional peer `shiki`: missing `createHighlighter` capability.'
          );
        }
        const instance = await shikiModule.createHighlighter({
          themes: [SHIKI_LIGHT_THEME, SHIKI_DARK_THEME],
          langs: [],
        });
        if (!isShikiHighlighter(instance)) {
          throw new Error(
            'Invalid optional peer `shiki`: `createHighlighter()` did not produce a usable highlighter capability.'
          );
        }
        return instance;
      })
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
 * Safely reports whether `lang` is already loaded into `hl`, tolerating a highlighter whose
 * `getLoadedLanguages()` itself throws -- treated the same as "not loaded", which routes the
 * caller into the existing unhighlighted-fallback path instead of throwing out of it.
 * `loadShikiHighlighter()`/`loadShikiHighlighterCore()` already validate a highlighter's
 * capability *shape* at load time, so `hl` here is never missing the method outright; this
 * additionally tolerates a shape-valid peer whose method throws only when actually called (a
 * load-time shape check alone cannot catch that). Shared by `loadShikiLanguage()` below and
 * `<lr-code-block>`'s own synchronous per-render check in `syncHighlight()`.
 */
export function shikiHasLoadedLanguage(hl: ShikiHighlighter, lang: string): boolean {
  try {
    return hl.getLoadedLanguages().includes(lang);
  } catch {
    return false;
  }
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
  if (shikiHasLoadedLanguage(hl, normalizedLanguage)) return true;
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
