/**
 * Side-effect-free public access to Lyra's application-level localization runtime.
 *
 * Import this entry when an application needs to register or select a locale without registering
 * the component graph exposed by the package root. Locale tags share one canonical public BCP-47
 * spelling across registration, active selection and enumeration (`PT_BR` becomes `pt-BR`), while
 * catalogs are retained as bounded immutable snapshots rather than caller-owned objects.
 */
export {
  getLyraLocale,
  getLyraLocaleDirection,
  getRegisteredLyraLocales,
  registerLyraLocale,
  resolveLyraDirection,
  resolveLyraLocale,
  resolveLyraString,
  setLyraLocale,
  subscribeLyraLocaleRegistry,
  LYRA_DEFAULT_STRINGS,
} from './internal/localization.js';
export type {
  LyraLocaleDirection,
  LyraLocaleMeta,
  LyraLocaleStrings,
  LyraMessage,
  LyraMessageKey,
  LyraPluralCategory,
  LyraPluralMessage,
} from './internal/localization.js';
