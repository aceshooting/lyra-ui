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
  type LyraMessageKey,
} from '@aceshooting/lyra-ui/localization.js';

const strings: LyraLocaleStrings = { close: 'Fermer' };
const key: LyraMessageKey = 'close';
const host = document.createElement('div');

registerLyraLocale('fr', strings);
setLyraLocale('fr');
const unsubscribe = subscribeLyraLocaleRegistry(() => undefined);
const values: [
  string,
  string[],
  string,
  'ltr' | 'rtl',
  string,
  string,
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
