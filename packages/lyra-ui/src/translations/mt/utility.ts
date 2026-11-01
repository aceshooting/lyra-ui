// The `utility` slice of the mt translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/utility/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-translations/mt/utility';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs mt --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  copyJson: 'Ikkopja l-JSON fil-clipboard',
  circularReference: 'Referenza ċirkolari',
  copyDiff: 'Ikkopja d-differenzi',
  diffViewOldLabel: 'Oriġinali',
  diffViewNewLabel: 'Modifikat',
  diffViewHiddenLines: {
    few: '{count} linji mhux mibdula',
    many: '{count} linja mhux mibdula',
    one: '{count} linja mhux mibdula',
    other: '{count} linja mhux mibdula',
    two: '{count} linji mhux mibdula',
  },
  diffViewTooLarge: 'Id-differenzi huma kbar wisq biex jintwerew.',
  jsonArray: 'array',
  jsonObject: 'oġġett',
  jsonValue: 'valur',
  jsonCopyLabel: 'Ikkopja {label}',
  jsonExpandLabel: 'Espandi {label}',
  jsonCollapseLabel: 'Ikkollassa {label}',
  jsonItemCount: {
    few: '{count} elementi',
    many: '{count} element',
    one: '{count} element',
    other: '{count} element',
    two: '{count} elementi',
  },
  jsonKeyCount: {
    few: '{count} ċwievet',
    many: '{count} ċavetta',
    one: '{count} ċavetta',
    other: '{count} ċavetta',
    two: '{count} ċwievet',
  },
  jsonViewerLimit: 'Jintwerew u jiġu mfittxija biss l-ewwel {count} nodi JSON u {depth} livelli ta’ inkapsulament.',
  pollPause: 'Waqqaf temporanjament',
  pollResume: 'Kompli',
  pollRefresh: 'Aġġorna issa',
  pollInactive: 'Inattiv',
  pollRefreshing: 'Qed jaġġorna…',
  pollPaused: 'Imwaqqaf temporanjament',
  pollPausedAnnounce: 'Imwaqqaf temporanjament.',
  pollResumedAnnounce: 'Kompla.',
  pollRefreshingAnnounce: 'Qed jaġġorna issa.',
  randomContentPause: 'Waqqaf ir-rotazzjoni',
  randomContentResume: 'Kompli r-rotazzjoni',
  randomContentNext: 'Uri ieħor',
  exportButtonLabel: 'Esporta',
  knownDateDay: 'Jum',
  knownDateMonth: 'Xahar',
  knownDateYear: 'Sena',
  exportFormatMenuLabel: 'Format {label}',
  mentionSuggestions: 'Suġġerimenti',
  mentionResultCount: {
    few: '{count} suġġerimenti',
    many: '{count} suġġeriment',
    one: '{count} suġġeriment',
    other: '{count} suġġeriment',
    two: '{count} suġġerimenti',
  },
  mentionResultPosition: 'Suġġeriment {current} minn {total}',
  iconLoadError: 'L-ikona ma setgħetx titgħabba.',
  iconTooLarge: 'Il-fajl tal-ikona huwa kbir wisq biex jintwera.',
  iconSanitizerMissing: 'Din l-ikona teħtieġ il-pakkett fakultattiv "dompurify" installat biex tintwera b’mod sigur.',
  tourSkip: 'Aqbeż',
  tourDone: 'Lest',
  tourStepOf: 'Pass {current} minn {total}',
  mentionMoreResults: {
    few: '{count} suġġerimenti oħra',
    many: '{count} suġġeriment ieħor',
    one: '{count} suġġeriment ieħor',
    other: '{count} suġġeriment ieħor',
    two: '{count} suġġerimenti oħra',
  },
  mentionInputLimit: 'Huma disponibbli biss l-ewwel 10,000 kandidat għas-semmija.',
  diffViewHighlightLimit: 'Il-kodiċi twil jintwera mingħajr enfasi tas-sintassi.',
};

registerLyraLocale('mt', strings);
