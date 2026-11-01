// The `utility` slice of the sr-Latn translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/utility/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-translations/sr-Latn/utility';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs sr-Latn --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  copyJson: 'Kopiraj JSON u privremenu memoriju',
  circularReference: 'Kružna referenca',
  copyDiff: 'Kopiraj razlike',
  diffViewOldLabel: 'Original',
  diffViewNewLabel: 'Izmenjeno',
  diffViewHiddenLines: {
    few: '{count} nepromenjena reda',
    one: '{count} nepromenjen red',
    other: '{count} nepromenjenih redova',
  },
  diffViewTooLarge: 'Razlike su prevelike za prikaz.',
  jsonArray: 'niz',
  jsonObject: 'objekat',
  jsonValue: 'vrednost',
  jsonCopyLabel: 'Kopiraj {label}',
  jsonExpandLabel: 'Proširi {label}',
  jsonCollapseLabel: 'Skupi {label}',
  jsonItemCount: {
    few: '{count} stavke',
    one: '{count} stavka',
    other: '{count} stavki',
  },
  jsonKeyCount: {
    few: '{count} ključa',
    one: '{count} ključ',
    other: '{count} ključeva',
  },
  jsonViewerLimit: 'Prikazuje se i pretražuje samo prvih {count} JSON čvorova i {depth} nivoa ugnežđavanja.',
  pollPause: 'Pauziraj',
  pollResume: 'Nastavi',
  pollRefresh: 'Osveži odmah',
  pollInactive: 'Neaktivno',
  pollRefreshing: 'Osvežavanje…',
  pollPaused: 'Pauzirano',
  pollPausedAnnounce: 'Pauzirano.',
  pollResumedAnnounce: 'Nastavljeno.',
  pollRefreshingAnnounce: 'Osvežava se odmah.',
  randomContentPause: 'Pauziraj smenjivanje',
  randomContentResume: 'Nastavi smenjivanje',
  randomContentNext: 'Prikaži drugo',
  exportButtonLabel: 'Izvezi',
  knownDateDay: 'Dan',
  knownDateMonth: 'Mesec',
  knownDateYear: 'Godina',
  exportFormatMenuLabel: 'Format za {label}',
  mentionSuggestions: 'Predlozi',
  mentionResultCount: {
    few: '{count} predloga',
    one: '{count} predlog',
    other: '{count} predloga',
  },
  mentionResultPosition: 'Predlog {current} od {total}',
  iconLoadError: 'Ikona nije mogla da se učita.',
  iconTooLarge: 'Datoteka ikone je prevelika za prikaz.',
  iconSanitizerMissing: 'Za bezbedan prikaz ove ikone potrebno je instalirati opcioni paket „dompurify“.',
  tourSkip: 'Preskoči',
  tourDone: 'Gotovo',
  tourStepOf: 'Korak {current} od {total}',
  mentionMoreResults: {
    few: 'Još {count} predloga',
    one: 'Još {count} predlog',
    other: 'Još {count} predloga',
  },
  mentionInputLimit: 'Dostupno je samo prvih 10.000 kandidata za pominjanje.',
  diffViewHighlightLimit: 'Dugačak kod se prikazuje bez isticanja sintakse.',
};

registerLyraLocale('sr-Latn', strings);
