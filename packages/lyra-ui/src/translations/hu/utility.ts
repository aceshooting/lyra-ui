// The `utility` slice of the hu translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/utility/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-ui/translations/hu/utility';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs hu --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  copyJson: 'JSON másolása a vágólapra',
  circularReference: 'Körkörös hivatkozás',
  copyDiff: 'Eltérések másolása',
  diffViewOldLabel: 'Eredeti',
  diffViewNewLabel: 'Módosított',
  diffViewHiddenLines: {
    one: '{count} változatlan sor',
    other: '{count} változatlan sor',
  },
  diffViewTooLarge: 'Az eltérés túl nagy a megjelenítéshez.',
  jsonArray: 'tömb',
  jsonObject: 'objektum',
  jsonValue: 'érték',
  jsonCopyLabel: 'Másolás: {label}',
  jsonExpandLabel: 'Kibontás: {label}',
  jsonCollapseLabel: 'Összecsukás: {label}',
  jsonItemCount: {
    one: '{count} elem',
    other: '{count} elem',
  },
  jsonKeyCount: {
    one: '{count} kulcs',
    other: '{count} kulcs',
  },
  jsonViewerLimit: 'Csak az első {count} JSON-csomópont és {depth} beágyazási szint látható és kereshető.',
  pollPause: 'Szüneteltetés',
  pollResume: 'Folytatás',
  pollInactive: 'Inaktív',
  pollRefreshing: 'Frissítés…',
  pollPaused: 'Szüneteltetve',
  pollPausedAnnounce: 'Szüneteltetve.',
  pollResumedAnnounce: 'Folytatva.',
  pollRefreshingAnnounce: 'Frissítés folyamatban.',
  randomContentPause: 'Váltakozás szüneteltetése',
  randomContentResume: 'Váltakozás folytatása',
  exportButtonLabel: 'Exportálás',
  knownDateDay: 'Nap',
  knownDateMonth: 'Hónap',
  knownDateYear: 'Év',
  exportFormatMenuLabel: 'Formátum: {label}',
  mentionSuggestions: 'Javaslatok',
  mentionResultCount: {
    one: '{count} javaslat',
    other: '{count} javaslat',
  },
  mentionResultPosition: '{current}/{total}. javaslat',
  iconLoadError: 'Az ikont nem sikerült betölteni.',
  iconTooLarge: 'Az ikonfájl túl nagy a megjelenítéshez.',
  iconSanitizerMissing: 'Az ikon biztonságos megjelenítéséhez szükség van az opcionális „dompurify” csomagra.',
  tourSkip: 'Kihagyás',
  tourDone: 'Kész',
  tourStepOf: '{current}/{total}. lépés',
};

registerLyraLocale('hu', strings);
