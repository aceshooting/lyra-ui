import {
  getLyraLocale,
  getRegisteredLyraLocales,
  registerLyraLocale,
  resolveLyraDirection,
  resolveLyraLocale,
  resolveLyraString,
  setLyraLocale,
  subscribeLyraLocaleRegistry,
  LYRA_DEFAULT_STRINGS,
  type LyraLocaleStrings,
  type LyraMessage,
  type LyraMessageKey,
  type LyraPluralCategory,
  type LyraPluralMessage,
} from '../src/localization.js';

// A catalog accepts a plain string or, since 8.0.0, one string per CLDR plural
// category the language needs — with `other` mandatory as the fallback terminal.
const strings: LyraLocaleStrings = {
  close: 'Fermer',
  selectedCount: { one: '{count} sélectionné', other: '{count} sélectionnés' },
};
const key: LyraMessageKey = 'close';
const plural: LyraPluralMessage = { other: '{count} éléments' };
const category: LyraPluralCategory = 'other';
const host = document.createElement('div');
void plural;
void category;

registerLyraLocale('fr', strings);
setLyraLocale('fr');
const unsubscribe = subscribeLyraLocaleRegistry(() => undefined);
// `resolveLyraString` still narrows to a plain string — plural selection happens
// inside it — while the raw catalog entry is now the wider `LyraMessage`.
const values: [
  string,
  readonly string[],
  string,
  'ltr' | 'rtl',
  string,
  LyraMessage,
] = [
  getLyraLocale(),
  getRegisteredLyraLocales(),
  resolveLyraLocale(host),
  resolveLyraDirection(host),
  resolveLyraString(host, key),
  LYRA_DEFAULT_STRINGS[key],
];
unsubscribe();
void values;
