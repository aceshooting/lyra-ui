/**
 * Side-effect-free public access to Lyra's application-level localization runtime.
 *
 * Import this entry when an application needs to register or select a locale without registering
 * the component graph exposed by the package root. Locale tags share one canonical public BCP-47
 * spelling across registration, active selection and enumeration (`PT_BR` becomes `pt-BR`), while
 * catalogs are retained as bounded immutable snapshots rather than caller-owned objects.
 *
 * It also carries the active-locale subscription (`subscribeLyraLocale()`), the opt-in `lang`/`dir`
 * bridge (`bridgeLyraLocale()`) and the scoped resolver (`resolveLyraScopedString()`). These are the
 * very same bindings the deprecated `@aceshooting/lyra-ui/utilities/localization.js` entry exports,
 * so moving an import here is a specifier rename and nothing else.
 */
export {
  getLyraLocale,
  getLyraLocaleDirection,
  getRegisteredLyraLocaleKeys,
  getRegisteredLyraLocales,
  registerLyraLocale,
  registerLyraLocaleDelta,
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
// Re-exported from their declaring modules, never through a deprecated specifier: a re-export
// chain that passes through a `@deprecated` specifier would strike these names through here too.
export { subscribeLyraLocale } from './internal/localization-runtime.js';
export { bridgeLyraLocale, resolveLyraScopedString } from './utilities/localization.js';
export type {
  LyraLocaleBridgeCleanup,
  LyraLocaleBridgeOptions,
} from './utilities/localization.js';
