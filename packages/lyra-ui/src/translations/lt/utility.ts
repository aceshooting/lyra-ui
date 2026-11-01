// The `utility` slice of the lt translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/utility/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-translations/lt/utility';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs lt --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  copyJson: 'Kopijuoti JSON į iškarpinę',
  circularReference: 'Ciklinė nuoroda',
  copyDiff: 'Kopijuoti skirtumus',
  diffViewOldLabel: 'Originalas',
  diffViewNewLabel: 'Pakeista',
  diffViewHiddenLines: {
    few: '{count} nepakeistos eilutės',
    many: '{count} nepakeistos eilutės',
    one: '{count} nepakeista eilutė',
    other: '{count} nepakeistų eilučių',
  },
  diffViewTooLarge: 'Skirtumai per dideli, kad būtų parodyti.',
  jsonArray: 'masyvas',
  jsonObject: 'objektas',
  jsonValue: 'reikšmė',
  jsonCopyLabel: 'Kopijuoti {label}',
  jsonExpandLabel: 'Išskleisti {label}',
  jsonCollapseLabel: 'Suskleisti {label}',
  jsonItemCount: {
    few: '{count} elementai',
    many: '{count} elemento',
    one: '{count} elementas',
    other: '{count} elementų',
  },
  jsonKeyCount: {
    few: '{count} raktai',
    many: '{count} rakto',
    one: '{count} raktas',
    other: '{count} raktų',
  },
  jsonViewerLimit: 'Rodomi ir ieškomi tik pirmieji JSON mazgai ({count}) ir įdėjimo lygiai ({depth}).',
  pollPause: 'Pristabdyti',
  pollResume: 'Tęsti',
  pollRefresh: 'Atnaujinti dabar',
  pollInactive: 'Neaktyvu',
  pollRefreshing: 'Atnaujinama…',
  pollPaused: 'Pristabdyta',
  pollPausedAnnounce: 'Pristabdyta.',
  pollResumedAnnounce: 'Tęsiama.',
  pollRefreshingAnnounce: 'Atnaujinama dabar.',
  randomContentPause: 'Pristabdyti kaitaliojimą',
  randomContentResume: 'Tęsti kaitaliojimą',
  randomContentNext: 'Rodyti kitą',
  exportButtonLabel: 'Eksportuoti',
  knownDateDay: 'Diena',
  knownDateMonth: 'Mėnuo',
  knownDateYear: 'Metai',
  exportFormatMenuLabel: '{label} formatas',
  mentionSuggestions: 'Pasiūlymai',
  mentionResultCount: {
    few: '{count} pasiūlymai',
    many: '{count} pasiūlymo',
    one: '{count} pasiūlymas',
    other: '{count} pasiūlymų',
  },
  mentionResultPosition: 'Pasiūlymas {current} iš {total}',
  iconLoadError: 'Nepavyko įkelti piktogramos.',
  iconTooLarge: 'Piktogramos failas per didelis, kad būtų parodytas.',
  iconSanitizerMissing: 'Kad būtų saugiai atvaizduota, šiai piktogramai reikia įdiegti pasirenkamą paketą „dompurify“.',
  tourSkip: 'Praleisti',
  tourDone: 'Atlikta',
  tourStepOf: 'Veiksmas {current} iš {total}',
  mentionMoreResults: {
    few: 'Dar {count} pasiūlymai',
    many: 'Dar {count} pasiūlymo',
    one: 'Dar {count} pasiūlymas',
    other: 'Dar {count} pasiūlymų',
  },
  mentionInputLimit: 'Pasiekiama tik pirmųjų 10 000 paminėjimo kandidatų.',
  diffViewHighlightLimit: 'Ilgas kodas rodomas be sintaksės paryškinimo.',
};

registerLyraLocale('lt', strings);
