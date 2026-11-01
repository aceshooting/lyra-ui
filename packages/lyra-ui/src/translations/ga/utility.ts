// The `utility` slice of the ga translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/utility/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-translations/ga/utility';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs ga --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  copyJson: 'Cóipeáil an JSON chuig an ngearrthaisce',
  circularReference: 'Tagairt chiorclach',
  copyDiff: 'Cóipeáil an difríocht',
  diffViewOldLabel: 'Bunaidh',
  diffViewNewLabel: 'Athraithe',
  diffViewHiddenLines: {
    few: '{count} líne gan athrú',
    many: '{count} líne gan athrú',
    one: '{count} líne gan athrú',
    other: '{count} líne gan athrú',
    two: '{count} líne gan athrú',
  },
  diffViewTooLarge: 'Tá an difríocht rómhór le taispeáint.',
  jsonArray: 'eagar',
  jsonObject: 'réad',
  jsonValue: 'luach',
  jsonCopyLabel: 'Cóipeáil {label}',
  jsonExpandLabel: 'Leathnaigh {label}',
  jsonCollapseLabel: 'Laghdaigh {label}',
  jsonItemCount: {
    few: '{count} mhír',
    many: '{count} mír',
    one: '{count} mhír',
    other: '{count} mír',
    two: '{count} mhír',
  },
  jsonKeyCount: {
    few: '{count} eochair',
    many: '{count} n-eochair',
    one: '{count} eochair',
    other: '{count} eochair',
    two: '{count} eochair',
  },
  jsonViewerLimit: 'Ní thaispeántar agus ní chuardaítear ach an chéad {count} nód JSON agus {depth} leibhéal neadaithe.',
  pollPause: 'Cuir ar sos',
  pollResume: 'Atosaigh',
  pollRefresh: 'Athnuaigh anois',
  pollInactive: 'Neamhghníomhach',
  pollRefreshing: 'Á athnuachan…',
  pollPaused: 'Ar sos',
  pollPausedAnnounce: 'Curtha ar sos.',
  pollResumedAnnounce: 'Atosaithe.',
  pollRefreshingAnnounce: 'Á athnuachan anois.',
  randomContentPause: 'Cuir an rothlú ar sos',
  randomContentResume: 'Atosaigh an rothlú',
  randomContentNext: 'Taispeáin ceann eile',
  exportButtonLabel: 'Easpórtáil',
  knownDateDay: 'Lá',
  knownDateMonth: 'Mí',
  knownDateYear: 'Bliain',
  exportFormatMenuLabel: 'Formáid {label}',
  mentionSuggestions: 'Moltaí',
  mentionResultCount: {
    few: '{count} mholadh',
    many: '{count} moladh',
    one: '{count} mholadh',
    other: '{count} moladh',
    two: '{count} mholadh',
  },
  mentionResultPosition: 'Moladh {current} as {total}',
  iconLoadError: 'Theip ar lódáil na deilbhíne.',
  iconTooLarge: 'Tá comhad na deilbhíne rómhór le taispeáint.',
  iconSanitizerMissing: 'Teastaíonn an pacáiste roghnach "dompurify" ón deilbhín seo chun é a rindreáil go sábháilte.',
  tourSkip: 'Scipeáil',
  tourDone: 'Déanta',
  tourStepOf: 'Céim {current} as {total}',
  mentionMoreResults: {
    few: '{count} mholadh eile',
    many: '{count} moladh eile',
    one: '{count} mholadh eile',
    other: '{count} moladh eile',
    two: '{count} mholadh eile',
  },
  mentionInputLimit: 'Níl ar fáil ach an chéad 10,000 iarrthóir lua.',
  diffViewHighlightLimit: 'Taispeántar cód fada gan aibhsiú comhréire.',
};

registerLyraLocale('ga', strings);
