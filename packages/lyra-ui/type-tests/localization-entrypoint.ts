import {
  bridgeLyraLocale,
  getLyraLocale,
  getRegisteredLyraLocales,
  registerLyraLocale,
  resolveLyraDirection,
  resolveLyraLocale,
  resolveLyraString,
  resolveLyraScopedString,
  setLyraLocale,
  subscribeLyraLocale,
  subscribeLyraLocaleRegistry,
  LYRA_DEFAULT_STRINGS,
  type LyraLocaleBridgeCleanup,
  type LyraLocaleBridgeOptions,
  type LyraLocaleStrings,
  type LyraMessage,
  type LyraMessageKey,
  type LyraPluralCategory,
  type LyraPluralMessage,
} from '../src/localization.js';
import type * as DeprecatedUtilitiesLocalization from '../src/utilities/localization.js';

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2)
    ? true
    : false;
type Assert<Value extends true> = Value;

// `localization.js` is a superset of the deprecated `utilities/localization.js` entry: every name the
// deprecated entry exports resolves to the identical type here, so migrating an import is a
// specifier rename and nothing else.
type SameBridge = Assert<Equal<typeof bridgeLyraLocale, typeof DeprecatedUtilitiesLocalization.bridgeLyraLocale>>;
type SameScopedResolver = Assert<
  Equal<typeof resolveLyraScopedString, typeof DeprecatedUtilitiesLocalization.resolveLyraScopedString>
>;
type SameSubscription = Assert<
  Equal<typeof subscribeLyraLocale, typeof DeprecatedUtilitiesLocalization.subscribeLyraLocale>
>;
type SameBridgeOptions = Assert<Equal<LyraLocaleBridgeOptions, DeprecatedUtilitiesLocalization.LyraLocaleBridgeOptions>>;
type SameBridgeCleanup = Assert<Equal<LyraLocaleBridgeCleanup, DeprecatedUtilitiesLocalization.LyraLocaleBridgeCleanup>>;
declare const supersetContract: [
  SameBridge,
  SameScopedResolver,
  SameSubscription,
  SameBridgeOptions,
  SameBridgeCleanup,
];
void supersetContract;

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

const bridgeOptions: LyraLocaleBridgeOptions = { target: host, direction: false };
const stopBridge: LyraLocaleBridgeCleanup = bridgeLyraLocale(bridgeOptions);
const stopActive: () => void = subscribeLyraLocale(() => undefined);
const scoped: string = resolveLyraScopedString(host, 'save', { save: 'Save' });
stopBridge();
stopActive();
void scoped;
