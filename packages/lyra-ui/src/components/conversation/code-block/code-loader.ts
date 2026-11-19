import { GREYCAT_LANGUAGE } from './greycat-language.js';
import {
  SHIKI_DARK_THEME,
  SHIKI_LIGHT_THEME,
  isShikiHighlighter,
  normalizeShikiLanguage,
  type ShikiHighlighter,
  type ShikiLanguageInput,
} from './shiki-types.js';
import { createOptionalPeerLoader, resolveOptionalPeerCapability } from '../../../internal/optional-peer-capabilities.js';

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

type ShikiModuleLoader = () => Promise<unknown>;
let shikiModuleLoaderForTesting: ShikiModuleLoader | undefined;
const bundledByHighlighter = new WeakMap<ShikiHighlighter, object>();

const FULL_HIGHLIGHTER_WARNING_KEY = 'lyra-code-block-shiki-unavailable';
const FULL_HIGHLIGHTER_WARNING =
  '<lr-code-block>: syntax highlighting is unavailable because the optional Shiki peer could not load. Code is rendered as plain text.';

/** @internal Replaces the optional-peer import for deterministic loader-failure tests. */
export function __setShikiModuleLoaderForTesting(
  loader: ShikiModuleLoader | undefined
): void {
  shikiModuleLoaderForTesting = loader;
  highlighter.reset();
}

const CUSTOM_LANGUAGES: Record<string, ShikiLanguageInput> = {
  gcl: GREYCAT_LANGUAGE,
  greycat: GREYCAT_LANGUAGE,
};

/** The shape of the `shiki` module namespace this loader actually calls -- the highlighter
 *  `createHighlighter()` produces is validated separately by `isShikiHighlighter()` below. */
interface ShikiModule {
  bundledLanguages?: object;
  createHighlighter(options: Record<string, unknown>): Promise<unknown>;
}

function isShikiModule(candidate: unknown): candidate is ShikiModule {
  return (
    (typeof candidate === 'object' || typeof candidate === 'function') &&
    candidate !== null &&
    typeof (candidate as ShikiModule).createHighlighter === 'function'
  );
}

const highlighter = /* @__PURE__ */ createOptionalPeerLoader<ShikiHighlighter>({
  cache: 'generation',
  async load() {
    const mod = await (shikiModuleLoaderForTesting?.() ?? import('shiki'));
    const peer = resolveOptionalPeerCapability(mod, isShikiModule);
    if (!peer) return null;
    const instance = await peer.createHighlighter({ themes: [SHIKI_LIGHT_THEME, SHIKI_DARK_THEME], langs: [] });
    if (!isShikiHighlighter(instance)) return null;
    if (peer.bundledLanguages && typeof peer.bundledLanguages === 'object') {
      bundledByHighlighter.set(instance, peer.bundledLanguages);
    }
    return instance;
  },
  isCapability: isShikiHighlighter,
  warningKey: FULL_HIGHLIGHTER_WARNING_KEY,
  warning: '<lr-code-block>: Shiki could not be resolved to a usable peer for syntax highlighting. Code is rendered as plain text.',
  failedWarning: FULL_HIGHLIGHTER_WARNING,
});

/** Shares the full highlighter and retries a rejected import or construction on the next request. */
export function loadShikiHighlighter(): Promise<ShikiHighlighter | null> {
  return highlighter.load();
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

/** Loads a recognized grammar on demand, allowing a failed chunk to be retried. */
export async function loadShikiLanguage(
  hl: ShikiHighlighter,
  lang: string
): Promise<boolean> {
  const normalizedLanguage = normalizeShikiLanguage(lang);
  if (shikiHasLoadedLanguage(hl, normalizedLanguage)) return true;
  const bundled = bundledByHighlighter.get(hl);
  const custom = Object.hasOwn(CUSTOM_LANGUAGES, normalizedLanguage) ? CUSTOM_LANGUAGES[normalizedLanguage] : undefined;
  if (!custom && bundled && !Object.hasOwn(bundled, normalizedLanguage)) return false;
  try {
    await hl.loadLanguage(custom ?? normalizedLanguage);
    return true;
  } catch {
    return false;
  }
}
