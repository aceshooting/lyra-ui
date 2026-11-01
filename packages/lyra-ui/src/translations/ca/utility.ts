// The `utility` slice of the ca translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/utility/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-translations/ca/utility';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs ca --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  copyJson: 'Copia el JSON al porta-retalls',
  circularReference: 'Referència circular',
  copyDiff: 'Copia les diferències',
  diffViewOldLabel: 'Original',
  diffViewNewLabel: 'Modificat',
  diffViewHiddenLines: {
    many: '{count} línies sense canvis',
    one: '{count} línia sense canvis',
    other: '{count} línies sense canvis',
  },
  diffViewTooLarge: 'Les diferències són massa grans per mostrar-les.',
  jsonArray: 'matriu',
  jsonObject: 'objecte',
  jsonValue: 'valor',
  jsonCopyLabel: 'Copia {label}',
  jsonExpandLabel: 'Desplega {label}',
  jsonCollapseLabel: 'Replega {label}',
  jsonItemCount: {
    many: '{count} elements',
    one: '{count} element',
    other: '{count} elements',
  },
  jsonKeyCount: {
    many: '{count} claus',
    one: '{count} clau',
    other: '{count} claus',
  },
  jsonViewerLimit: 'Només es mostren i es cerquen els primers {count} nodes JSON i {depth} nivells d’imbricació.',
  pollPause: 'Pausa',
  pollResume: 'Reprèn',
  pollRefresh: 'Actualitza ara',
  pollInactive: 'Inactiu',
  pollRefreshing: 'S’està actualitzant…',
  pollPaused: 'En pausa',
  pollPausedAnnounce: 'En pausa.',
  pollResumedAnnounce: 'S’ha reprès.',
  pollRefreshingAnnounce: 'S’està actualitzant ara.',
  randomContentPause: 'Atura la rotació',
  randomContentResume: 'Reprèn la rotació',
  randomContentNext: 'Mostra’n un altre',
  exportButtonLabel: 'Exporta',
  knownDateDay: 'Dia',
  knownDateMonth: 'Mes',
  knownDateYear: 'Any',
  exportFormatMenuLabel: 'Format de {label}',
  mentionSuggestions: 'Suggeriments',
  mentionResultCount: {
    many: '{count} suggeriments',
    one: '{count} suggeriment',
    other: '{count} suggeriments',
  },
  mentionResultPosition: 'Suggeriment {current} de {total}',
  iconLoadError: 'No s’ha pogut carregar la icona.',
  iconTooLarge: 'El fitxer de la icona és massa gran per mostrar-lo.',
  iconSanitizerMissing: 'Aquesta icona necessita el paquet opcional «dompurify» instal·lat per mostrar-se de manera segura.',
  tourSkip: 'Omet',
  tourDone: 'Fet',
  tourStepOf: 'Pas {current} de {total}',
  mentionMoreResults: {
    many: '{count} suggeriments més',
    one: '{count} suggeriment més',
    other: '{count} suggeriments més',
  },
  mentionInputLimit: 'Només hi ha disponibles els primers 10.000 candidats a menció.',
  diffViewHighlightLimit: 'El codi llarg es mostra sense ressaltat de sintaxi.',
};

registerLyraLocale('ca', strings);
