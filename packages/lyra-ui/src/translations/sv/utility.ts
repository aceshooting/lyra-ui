// The `utility` slice of the sv translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/utility/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-ui/translations/sv/utility';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs sv --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  copyJson: 'Kopiera JSON till urklipp',
  circularReference: 'Cirkelreferens',
  copyDiff: 'Kopiera diff',
  diffViewOldLabel: 'Original',
  diffViewNewLabel: 'Ändrad',
  diffViewHiddenLines: {
    one: '{count} oförändrad rad',
    other: '{count} oförändrade rader',
  },
  diffViewTooLarge: 'Diffen är för stor för att visas.',
  jsonArray: 'matris',
  jsonObject: 'objekt',
  jsonValue: 'värde',
  jsonCopyLabel: 'Kopiera {label}',
  jsonExpandLabel: 'Expandera {label}',
  jsonCollapseLabel: 'Komprimera {label}',
  jsonItemCount: {
    one: '{count} element',
    other: '{count} element',
  },
  jsonKeyCount: {
    one: '{count} nyckel',
    other: '{count} nycklar',
  },
  jsonViewerLimit: 'Endast de första {count} JSON-noderna och {depth} kapslingsnivåerna visas och genomsöks.',
  pollPause: 'Pausa',
  pollResume: 'Återuppta',
  pollInactive: 'Inaktiv',
  pollRefreshing: 'Uppdaterar…',
  pollPaused: 'Pausad',
  pollPausedAnnounce: 'Pausad.',
  pollResumedAnnounce: 'Återupptagen.',
  pollRefreshingAnnounce: 'Uppdaterar nu.',
  randomContentPause: 'Pausa rotation',
  randomContentResume: 'Återuppta rotation',
  exportButtonLabel: 'Exportera',
  knownDateDay: 'Dag',
  knownDateMonth: 'Månad',
  knownDateYear: 'År',
  exportFormatMenuLabel: 'Format för {label}',
  mentionSuggestions: 'Förslag',
  mentionResultCount: {
    one: '{count} förslag',
    other: '{count} förslag',
  },
  mentionResultPosition: 'Förslag {current} av {total}',
  iconLoadError: 'Ikonen kunde inte läsas in.',
  iconTooLarge: 'Ikonfilen är för stor för att visas.',
  iconSanitizerMissing: 'Den här ikonen behöver det valfria paketet ”dompurify” för att kunna visas säkert.',
  tourSkip: 'Hoppa över',
  tourDone: 'Klar',
  tourStepOf: 'Steg {current} av {total}',
};

registerLyraLocale('sv', strings);
