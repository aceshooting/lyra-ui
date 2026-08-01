/**
 * Side-effect-free public access to Lyra's application-level localization runtime.
 *
 * Import this entry when an application needs to register or select a locale without registering
 * the component graph exposed by the package root.
 */
export {
  getLyraLocale,
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
  LyraLocaleStrings,
  LyraMessage,
  LyraMessageKey,
  LyraPluralCategory,
  LyraPluralMessage,
} from './internal/localization.js';
