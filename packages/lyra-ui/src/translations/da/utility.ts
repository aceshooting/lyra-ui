// The `utility` slice of the da translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/utility/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-ui/translations/da/utility';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs da --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  copyJson: 'Kopiér JSON til udklipsholderen',
  circularReference: 'Cirkulær reference',
  copyDiff: 'Kopiér diff',
  diffViewOldLabel: 'Original',
  diffViewNewLabel: 'Ændret',
  diffViewHiddenLines: {
    one: '{count} uændret linje',
    other: '{count} uændrede linjer',
  },
  diffViewTooLarge: 'Diff er for stor til at blive vist.',
  jsonArray: 'array',
  jsonObject: 'objekt',
  jsonValue: 'værdi',
  jsonCopyLabel: 'Kopiér {label}',
  jsonExpandLabel: 'Udvid {label}',
  jsonCollapseLabel: 'Skjul {label}',
  jsonItemCount: {
    one: '{count} element',
    other: '{count} elementer',
  },
  jsonKeyCount: {
    one: '{count} nøgle',
    other: '{count} nøgler',
  },
  jsonViewerLimit: 'Kun de første {count} JSON-noder og {depth} indlejringsniveauer vises og gennemsøges.',
  pollPause: 'Pause',
  pollResume: 'Genoptag',
  pollInactive: 'Inaktiv',
  pollRefreshing: 'Opdaterer…',
  pollPaused: 'Sat på pause',
  pollPausedAnnounce: 'Sat på pause.',
  pollResumedAnnounce: 'Genoptaget.',
  pollRefreshingAnnounce: 'Opdaterer nu.',
  randomContentPause: 'Sæt rotation på pause',
  randomContentResume: 'Genoptag rotation',
  exportButtonLabel: 'Eksportér',
  knownDateDay: 'Dag',
  knownDateMonth: 'Måned',
  knownDateYear: 'År',
  exportFormatMenuLabel: '{label}-format',
  mentionSuggestions: 'Forslag',
  mentionResultCount: {
    one: '{count} forslag',
    other: '{count} forslag',
  },
  mentionResultPosition: 'Forslag {current} af {total}',
  iconLoadError: 'Ikonet kunne ikke indlæses.',
  iconTooLarge: 'Ikonfilen er for stor til at blive vist.',
  iconSanitizerMissing: 'Dette ikon kræver, at den valgfrie pakke "dompurify" er installeret, for at kunne vises sikkert.',
  tourSkip: 'Spring over',
  tourDone: 'Færdig',
  tourStepOf: 'Trin {current} af {total}',
};

registerLyraLocale('da', strings);
