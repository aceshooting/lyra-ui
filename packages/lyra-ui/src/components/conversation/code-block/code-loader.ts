import { GREYCAT_LANGUAGE } from './greycat-language.js';
import type { ShikiHighlighter, ShikiLanguageInput } from '../../../internal/shiki/core.js';
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

const CUSTOM_LANGUAGES: Record<string, ShikiLanguageInput> = {
  gcl: GREYCAT_LANGUAGE,
  greycat: GREYCAT_LANGUAGE,
};

/** Loads a bundled language or one of the component's additional grammars. */
export function loadShikiLanguage(hl: ShikiHighlighter, lang: string): Promise<boolean> {
  return loadLanguage(hl, lang, CUSTOM_LANGUAGES);
}
