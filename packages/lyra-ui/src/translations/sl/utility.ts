// The `utility` slice of the sl translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/utility/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-ui/translations/sl/utility';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs sl --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  copyJson: 'Kopiraj JSON v odložišče',
  circularReference: 'Krožni sklic',
  copyDiff: 'Kopiraj razlike',
  diffViewOldLabel: 'Izvirnik',
  diffViewNewLabel: 'Spremenjeno',
  diffViewHiddenLines: {
    few: '{count} nespremenjene vrstice',
    one: '{count} nespremenjena vrstica',
    two: '{count} nespremenjeni vrstici',
    other: '{count} nespremenjenih vrstic',
  },
  diffViewTooLarge: 'Razlike so prevelike za prikaz.',
  jsonArray: 'polje',
  jsonObject: 'objekt',
  jsonValue: 'vrednost',
  jsonCopyLabel: 'Kopiraj {label}',
  jsonExpandLabel: 'Razširi {label}',
  jsonCollapseLabel: 'Strni {label}',
  jsonItemCount: {
    few: '{count} elementi',
    one: '{count} element',
    two: '{count} elementa',
    other: '{count} elementov',
  },
  jsonKeyCount: {
    few: '{count} ključi',
    one: '{count} ključ',
    two: '{count} ključa',
    other: '{count} ključev',
  },
  jsonViewerLimit: 'Prikazana in preiskana so samo prva vozlišča JSON (največ {count}) in ravni gnezdenja (največ {depth}).',
  pollPause: 'Začasno ustavi',
  pollResume: 'Nadaljuj',
  pollInactive: 'Nedejavno',
  pollRefreshing: 'Osveževanje …',
  pollPaused: 'Začasno ustavljeno',
  pollPausedAnnounce: 'Začasno ustavljeno.',
  pollResumedAnnounce: 'Nadaljevano.',
  pollRefreshingAnnounce: 'Osveževanje poteka.',
  randomContentPause: 'Začasno ustavi menjavanje',
  randomContentResume: 'Nadaljuj menjavanje',
  exportButtonLabel: 'Izvozi',
  knownDateDay: 'Dan',
  knownDateMonth: 'Mesec',
  knownDateYear: 'Leto',
  exportFormatMenuLabel: 'Oblika zapisa: {label}',
  mentionSuggestions: 'Predlogi',
  mentionResultCount: {
    few: '{count} predlogi',
    one: '{count} predlog',
    two: '{count} predloga',
    other: '{count} predlogov',
  },
  mentionResultPosition: 'Predlog {current} od {total}',
  iconLoadError: 'Ikone ni bilo mogoče naložiti.',
  iconTooLarge: 'Datoteka ikone je prevelika za prikaz.',
  iconSanitizerMissing: 'Ta ikona za varen izris potrebuje nameščen izbirni paket »dompurify«.',
  tourSkip: 'Preskoči',
  tourDone: 'Končano',
  tourStepOf: 'Korak {current} od {total}',
};

registerLyraLocale('sl', strings);
