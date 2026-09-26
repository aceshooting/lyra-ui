// The `utility` slice of the nn translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/utility/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-ui/translations/nn/utility';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs nn --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  copyJson: 'Kopier JSON til utklippstavla',
  circularReference: 'Sirkulær referanse',
  copyDiff: 'Kopier diff',
  diffViewOldLabel: 'Original',
  diffViewNewLabel: 'Endra',
  diffViewHiddenLines: {
    one: '{count} uendra linje',
    other: '{count} uendra linjer',
  },
  diffViewTooLarge: 'Diffen er for stor til å visast.',
  jsonArray: 'tabell',
  jsonObject: 'objekt',
  jsonValue: 'verdi',
  jsonCopyLabel: 'Kopier {label}',
  jsonExpandLabel: 'Utvid {label}',
  jsonCollapseLabel: 'Fald saman {label}',
  jsonItemCount: {
    one: '{count} element',
    other: '{count} element',
  },
  jsonKeyCount: {
    one: '{count} nøkkel',
    other: '{count} nøklar',
  },
  jsonViewerLimit: 'Berre dei første {count} JSON-nodane og {depth} nivå med nesting blir viste og gjennomsøkte.',
  pollPause: 'Set på pause',
  pollResume: 'Hald fram',
  pollInactive: 'Inaktiv',
  pollRefreshing: 'Oppdaterer…',
  pollPaused: 'Pausa',
  pollPausedAnnounce: 'Pausa.',
  pollResumedAnnounce: 'Held fram.',
  pollRefreshingAnnounce: 'Oppdaterer no.',
  randomContentPause: 'Set rotasjonen på pause',
  randomContentResume: 'Hald fram med rotasjonen',
  exportButtonLabel: 'Eksporter',
  knownDateDay: 'Dag',
  knownDateMonth: 'Månad',
  knownDateYear: 'År',
  exportFormatMenuLabel: 'Format for {label}',
  mentionSuggestions: 'Forslag',
  mentionResultCount: {
    one: '{count} forslag',
    other: '{count} forslag',
  },
  mentionResultPosition: 'Forslag {current} av {total}',
  iconLoadError: 'Klarte ikkje å laste inn ikonet.',
  iconTooLarge: 'Ikonfila er for stor til å visast.',
  iconSanitizerMissing: 'Dette ikonet treng den valfrie pakken «dompurify» for å kunne visast trygt.',
  tourSkip: 'Hopp over',
  tourDone: 'Ferdig',
  tourStepOf: 'Steg {current} av {total}',
};

registerLyraLocale('nn', strings);
