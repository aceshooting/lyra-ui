// The `utility` slice of the et translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/utility/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-translations/et/utility';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs et --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  copyJson: 'Kopeeri JSON lõikelauale',
  circularReference: 'Ringviide',
  copyDiff: 'Kopeeri erinevused',
  diffViewOldLabel: 'Algne',
  diffViewNewLabel: 'Muudetud',
  diffViewHiddenLines: {
    one: '{count} muutmata rida',
    other: '{count} muutmata rida',
  },
  diffViewTooLarge: 'Erinevused on kuvamiseks liiga suured.',
  jsonArray: 'massiiv',
  jsonObject: 'objekt',
  jsonValue: 'väärtus',
  jsonCopyLabel: 'Kopeeri {label}',
  jsonExpandLabel: 'Laienda {label}',
  jsonCollapseLabel: 'Ahenda {label}',
  jsonItemCount: {
    one: '{count} element',
    other: '{count} elementi',
  },
  jsonKeyCount: {
    one: '{count} võti',
    other: '{count} võtit',
  },
  jsonViewerLimit: 'Kuvatakse ja otsitakse ainult esimestest {count} JSON-sõlmest ja {depth} pesastustasemest.',
  pollPause: 'Peata',
  pollResume: 'Jätka',
  pollRefresh: 'Värskenda kohe',
  pollInactive: 'Passiivne',
  pollRefreshing: 'Värskendamine…',
  pollPaused: 'Peatatud',
  pollPausedAnnounce: 'Peatatud.',
  pollResumedAnnounce: 'Jätkatud.',
  pollRefreshingAnnounce: 'Värskendan kohe.',
  randomContentPause: 'Peata vahetumine',
  randomContentResume: 'Jätka vahetumist',
  randomContentNext: 'Näita teist',
  exportButtonLabel: 'Ekspordi',
  knownDateDay: 'Päev',
  knownDateMonth: 'Kuu',
  knownDateYear: 'Aasta',
  exportFormatMenuLabel: '{label} vorming',
  mentionSuggestions: 'Soovitused',
  mentionResultCount: {
    one: '{count} soovitus',
    other: '{count} soovitust',
  },
  mentionResultPosition: 'Soovitus {current}/{total}',
  iconLoadError: 'Ikooni laadimine ebaõnnestus.',
  iconTooLarge: 'Ikoonifail on kuvamiseks liiga suur.',
  iconSanitizerMissing: 'Ikooni turvaliseks kuvamiseks on vaja paigaldada valikuline pakett „dompurify”.',
  tourSkip: 'Jäta vahele',
  tourDone: 'Valmis',
  tourStepOf: 'Samm {current}/{total}',
  mentionMoreResults: {
    one: 'Veel {count} soovitus',
    other: 'Veel {count} soovitust',
  },
  mentionInputLimit: 'Saadaval on ainult esimesed 10 000 mainimiskandidaati.',
  diffViewHighlightLimit: 'Pikk kood kuvatakse ilma süntaksi esiletõstuta.',
};

registerLyraLocale('et', strings);
