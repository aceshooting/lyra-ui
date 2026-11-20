import { normalizeShikiLanguage, type ShikiHighlighter } from '../../../internal/shiki/core.js';
import { loadShikiLanguage as loadLanguage } from '../../../internal/shiki/full.js';

export {
  SHIKI_DARK_THEME,
  SHIKI_LIGHT_THEME,
  SHIKI_THEMES,
  normalizeShikiLanguage,
  type ShikiHighlighter,
  type ShikiHighlighterCore,
  type ShikiLanguageInput,
} from '../../../internal/shiki/core.js';
export { loadShikiHighlighterCore } from '../../../internal/shiki/core.js';

export {
  loadShikiHighlighter,
  shikiHasLoadedLanguage,
} from '../../../internal/shiki/full.js';

/** The component's additional grammars, by language name; each loads the first time it is needed. */
const CUSTOM_LANGUAGE_NAMES = new Set(['gcl', 'greycat']);

/** Loads a bundled language or one of the component's additional grammars. */
export async function loadShikiLanguage(hl: ShikiHighlighter, lang: string): Promise<boolean> {
  const normalized = normalizeShikiLanguage(lang);
  if (!CUSTOM_LANGUAGE_NAMES.has(normalized)) return loadLanguage(hl, lang);
  let grammar;
  try {
    ({ GREYCAT_LANGUAGE: grammar } = await import('./greycat-language.js'));
  } catch {
    return false;
  }
  return loadLanguage(hl, lang, { [normalized]: grammar });
}
