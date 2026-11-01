// The `utility` slice of the sk translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/utility/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-translations/sk/utility';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs sk --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  copyJson: 'Kopírovať JSON do schránky',
  circularReference: 'Cyklický odkaz',
  copyDiff: 'Kopírovať rozdiely',
  diffViewOldLabel: 'Pôvodné',
  diffViewNewLabel: 'Upravené',
  diffViewHiddenLines: {
    few: '{count} nezmenené riadky',
    many: '{count} nezmeneného riadka',
    one: '{count} nezmenený riadok',
    other: '{count} nezmenených riadkov',
  },
  diffViewTooLarge: 'Rozdiely sú príliš veľké na zobrazenie.',
  jsonArray: 'pole',
  jsonObject: 'objekt',
  jsonValue: 'hodnota',
  jsonCopyLabel: 'Kopírovať {label}',
  jsonExpandLabel: 'Rozbaliť {label}',
  jsonCollapseLabel: 'Zbaliť {label}',
  jsonItemCount: {
    few: '{count} položky',
    many: '{count} položky',
    one: '{count} položka',
    other: '{count} položiek',
  },
  jsonKeyCount: {
    few: '{count} kľúče',
    many: '{count} kľúča',
    one: '{count} kľúč',
    other: '{count} kľúčov',
  },
  jsonViewerLimit: 'Zobrazuje a prehľadáva sa len prvých {count} uzlov JSON a {depth} úrovní vnorenia.',
  pollPause: 'Pozastaviť',
  pollResume: 'Pokračovať',
  pollRefresh: 'Obnoviť teraz',
  pollInactive: 'Neaktívne',
  pollRefreshing: 'Obnovuje sa…',
  pollPaused: 'Pozastavené',
  pollPausedAnnounce: 'Pozastavené.',
  pollResumedAnnounce: 'Obnovené.',
  pollRefreshingAnnounce: 'Prebieha obnovenie.',
  randomContentPause: 'Pozastaviť striedanie',
  randomContentResume: 'Obnoviť striedanie',
  randomContentNext: 'Zobraziť iný',
  exportButtonLabel: 'Exportovať',
  knownDateDay: 'Deň',
  knownDateMonth: 'Mesiac',
  knownDateYear: 'Rok',
  exportFormatMenuLabel: 'Formát {label}',
  mentionSuggestions: 'Návrhy',
  mentionResultCount: {
    few: '{count} návrhy',
    many: '{count} návrhu',
    one: '{count} návrh',
    other: '{count} návrhov',
  },
  mentionResultPosition: 'Návrh {current} z {total}',
  iconLoadError: 'Ikonu sa nepodarilo načítať.',
  iconTooLarge: 'Súbor ikony je príliš veľký na zobrazenie.',
  iconSanitizerMissing: 'Táto ikona vyžaduje na bezpečné vykreslenie nainštalovaný voliteľný balík „dompurify“.',
  tourSkip: 'Preskočiť',
  tourDone: 'Hotovo',
  tourStepOf: 'Krok {current} z {total}',
  mentionMoreResults: {
    few: '{count} ďalšie návrhy',
    many: '{count} ďalšieho návrhu',
    one: '{count} ďalší návrh',
    other: '{count} ďalších návrhov',
  },
  mentionInputLimit: 'K dispozícii je len prvých 10 000 návrhov na zmienky.',
  diffViewHighlightLimit: 'Dlhý kód sa zobrazuje bez zvýraznenia syntaxe.',
};

registerLyraLocale('sk', strings);
