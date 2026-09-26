// The `utility` slice of the nb translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/utility/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-ui/translations/nb/utility';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs nb --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  copyJson: 'Kopier JSON til utklippstavlen',
  circularReference: 'Sirkulær referanse',
  copyDiff: 'Kopier diff',
  diffViewOldLabel: 'Opprinnelig',
  diffViewNewLabel: 'Endret',
  diffViewHiddenLines: {
    one: '{count} uendret linje',
    other: '{count} uendrede linjer',
  },
  diffViewTooLarge: 'Diffen er for stor til å vises.',
  jsonArray: 'matrise',
  jsonObject: 'objekt',
  jsonValue: 'verdi',
  jsonCopyLabel: 'Kopier {label}',
  jsonExpandLabel: 'Utvid {label}',
  jsonCollapseLabel: 'Skjul {label}',
  jsonItemCount: {
    one: '{count} element',
    other: '{count} elementer',
  },
  jsonKeyCount: {
    one: '{count} nøkkel',
    other: '{count} nøkler',
  },
  jsonViewerLimit: 'Bare de første {count} JSON-nodene og {depth} nestenivåene vises og søkes i.',
  pollPause: 'Sett på pause',
  pollResume: 'Gjenoppta',
  pollInactive: 'Inaktiv',
  pollRefreshing: 'Oppdaterer …',
  pollPaused: 'Satt på pause',
  pollPausedAnnounce: 'Satt på pause.',
  pollResumedAnnounce: 'Gjenopptatt.',
  pollRefreshingAnnounce: 'Oppdaterer nå.',
  randomContentPause: 'Sett rotasjonen på pause',
  randomContentResume: 'Gjenoppta rotasjonen',
  exportButtonLabel: 'Eksporter',
  knownDateDay: 'Dag',
  knownDateMonth: 'Måned',
  knownDateYear: 'År',
  exportFormatMenuLabel: 'Format for {label}',
  mentionSuggestions: 'Forslag',
  mentionResultCount: {
    one: '{count} forslag',
    other: '{count} forslag',
  },
  mentionResultPosition: 'Forslag {current} av {total}',
  iconLoadError: 'Ikonet kunne ikke lastes inn.',
  iconTooLarge: 'Ikonfilen er for stor til å vises.',
  iconSanitizerMissing: 'Dette ikonet krever at den valgfrie pakken «dompurify» er installert for å vises trygt.',
  tourSkip: 'Hopp over',
  tourDone: 'Ferdig',
  tourStepOf: 'Trinn {current} av {total}',
};

registerLyraLocale('nb', strings);
