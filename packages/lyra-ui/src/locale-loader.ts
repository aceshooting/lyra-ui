/**
 * Optional lazy loading for the built-in complete locale catalogs. Importing this module does not
 * load any catalog until loadLyraLocale() is called, and never changes the active page locale.
 * Equivalent canonical spellings share one load. Rejection clears the helper's promise cache,
 * but a browser may retain a failed module fetch until page reload; retry need not refetch. Only exact
 * shipped tags are accepted: `en` needs no import, while unshipped regional tags reject.
 */
import { createLocaleLoader } from './internal/locale-loader.js';
import { localeLoaders } from './internal/locale-loaders.generated.js';

export type { LyraLocaleLoader } from './internal/locale-loader.js';
export const loadLyraLocale = createLocaleLoader(localeLoaders);
