// The `utility` slice of the hr translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/utility/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-ui/translations/hr/utility';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs hr --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  copyJson: 'Kopiraj JSON u međuspremnik',
  circularReference: 'Kružna referenca',
  copyDiff: 'Kopiraj razlike',
  diffViewOldLabel: 'Izvornik',
  diffViewNewLabel: 'Izmijenjeno',
  diffViewHiddenLines: {
    few: '{count} nepromijenjena retka',
    one: '{count} nepromijenjen redak',
    other: '{count} nepromijenjenih redaka',
  },
  diffViewTooLarge: 'Razlike su prevelike za prikaz.',
  jsonArray: 'polje',
  jsonObject: 'objekt',
  jsonValue: 'vrijednost',
  jsonCopyLabel: 'Kopiraj: {label}',
  jsonExpandLabel: 'Proširi: {label}',
  jsonCollapseLabel: 'Sažmi: {label}',
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
  jsonViewerLimit: 'Prikazuje se i pretražuje samo prvih {count} JSON čvorova i {depth} razina ugniježđivanja.',
  pollPause: 'Pauziraj',
  pollResume: 'Nastavi',
  pollInactive: 'Neaktivno',
  pollRefreshing: 'Osvježavanje…',
  pollPaused: 'Pauzirano',
  pollPausedAnnounce: 'Pauzirano.',
  pollResumedAnnounce: 'Nastavljeno.',
  pollRefreshingAnnounce: 'Osvježavanje u tijeku.',
  randomContentPause: 'Pauziraj izmjenjivanje',
  randomContentResume: 'Nastavi izmjenjivanje',
  exportButtonLabel: 'Izvezi',
  knownDateDay: 'Dan',
  knownDateMonth: 'Mjesec',
  knownDateYear: 'Godina',
  exportFormatMenuLabel: 'Format: {label}',
  mentionSuggestions: 'Prijedlozi',
  mentionResultCount: {
    few: '{count} prijedloga',
    one: '{count} prijedlog',
    other: '{count} prijedloga',
  },
  mentionResultPosition: 'Prijedlog {current} od {total}',
  iconLoadError: 'Učitavanje ikone nije uspjelo.',
  iconTooLarge: 'Datoteka ikone prevelika je za prikaz.',
  iconSanitizerMissing: 'Za siguran prikaz ova ikona zahtijeva instaliran izborni paket „dompurify”.',
  tourSkip: 'Preskoči',
  tourDone: 'Gotovo',
  tourStepOf: 'Korak {current} od {total}',
};

registerLyraLocale('hr', strings);
