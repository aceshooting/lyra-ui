// The `utility` slice of the lv translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/utility/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-translations/lv/utility';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs lv --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  copyJson: 'Kopēt JSON starpliktuvē',
  circularReference: 'Cikliska atsauce',
  copyDiff: 'Kopēt atšķirības',
  diffViewOldLabel: 'Sākotnējais',
  diffViewNewLabel: 'Modificētais',
  diffViewHiddenLines: {
    one: '{count} nemainīta rinda',
    other: '{count} nemainītas rindas',
    zero: '{count} nemainītas rindas',
  },
  diffViewTooLarge: 'Atšķirības ir pārāk lielas, lai tās attēlotu.',
  jsonArray: 'masīvs',
  jsonObject: 'objekts',
  jsonValue: 'vērtība',
  jsonCopyLabel: 'Kopēt {label}',
  jsonExpandLabel: 'Izvērst {label}',
  jsonCollapseLabel: 'Sakļaut {label}',
  jsonItemCount: {
    one: '{count} vienums',
    other: '{count} vienumi',
    zero: '{count} vienumi',
  },
  jsonKeyCount: {
    one: '{count} atslēga',
    other: '{count} atslēgas',
    zero: '{count} atslēgas',
  },
  jsonViewerLimit: 'Tiek rādīti un pārmeklēti tikai pirmie {count} JSON mezgli un {depth} ligzdošanas līmeņi.',
  pollPause: 'Pauzēt',
  pollResume: 'Atsākt',
  pollRefresh: 'Atsvaidzināt tagad',
  pollInactive: 'Neaktīvs',
  pollRefreshing: 'Atsvaidzina…',
  pollPaused: 'Pauzēts',
  pollPausedAnnounce: 'Pauzēts.',
  pollResumedAnnounce: 'Atsākts.',
  pollRefreshingAnnounce: 'Notiek atsvaidzināšana.',
  randomContentPause: 'Pauzēt rotāciju',
  randomContentResume: 'Atsākt rotāciju',
  randomContentNext: 'Rādīt citu',
  exportButtonLabel: 'Eksportēt',
  knownDateDay: 'Diena',
  knownDateMonth: 'Mēnesis',
  knownDateYear: 'Gads',
  exportFormatMenuLabel: '{label} formāts',
  mentionSuggestions: 'Ieteikumi',
  mentionResultCount: {
    one: '{count} ieteikums',
    other: '{count} ieteikumi',
    zero: '{count} ieteikumi',
  },
  mentionResultPosition: 'Ieteikums {current} no {total}',
  iconLoadError: 'Neizdevās ielādēt ikonu.',
  iconTooLarge: 'Ikonas fails ir pārāk liels, lai to attēlotu.',
  iconSanitizerMissing: 'Lai šo ikonu atveidotu droši, ir jāinstalē neobligātā pakotne “dompurify”.',
  tourSkip: 'Izlaist',
  tourDone: 'Gatavs',
  tourStepOf: 'Solis {current} no {total}',
  mentionMoreResults: {
    one: 'Vēl {count} ieteikums',
    other: 'Vēl {count} ieteikumi',
    zero: 'Vēl {count} ieteikumi',
  },
  mentionInputLimit: 'Pieejami tikai pirmie 10 000 pieminēšanas kandidāti.',
  diffViewHighlightLimit: 'Garš kods tiek rādīts bez sintakses izcelšanas.',
};

registerLyraLocale('lv', strings);
