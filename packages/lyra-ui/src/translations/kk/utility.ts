// The `utility` slice of the kk translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/utility/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-ui/translations/kk/utility';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs kk --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  copyJson: 'JSON-ды алмасу буферіне көшіру',
  circularReference: 'Циклдік сілтеме',
  copyDiff: 'Айырмашылықты көшіру',
  diffViewOldLabel: 'Бастапқы',
  diffViewNewLabel: 'Өзгертілген',
  diffViewHiddenLines: {
    one: '{count} өзгермеген жол',
    other: '{count} өзгермеген жол',
  },
  diffViewTooLarge: 'Айырмашылық көрсету үшін тым үлкен.',
  jsonArray: 'массив',
  jsonObject: 'нысан',
  jsonValue: 'мән',
  jsonCopyLabel: 'Көшіру: {label}',
  jsonExpandLabel: 'Жаю: {label}',
  jsonCollapseLabel: 'Жию: {label}',
  jsonItemCount: {
    one: '{count} элемент',
    other: '{count} элемент',
  },
  jsonKeyCount: {
    one: '{count} кілт',
    other: '{count} кілт',
  },
  jsonViewerLimit: 'Тек алғашқы {count} JSON түйіні және {depth} кірістіру деңгейі көрсетіледі және ізделеді.',
  pollPause: 'Кідірту',
  pollResume: 'Жалғастыру',
  pollInactive: 'Белсенді емес',
  pollRefreshing: 'Жаңартылуда…',
  pollPaused: 'Кідіртілді',
  pollPausedAnnounce: 'Кідіртілді.',
  pollResumedAnnounce: 'Жалғастырылды.',
  pollRefreshingAnnounce: 'Қазір жаңартылуда.',
  randomContentPause: 'Ауысуды кідірту',
  randomContentResume: 'Ауысуды жалғастыру',
  exportButtonLabel: 'Экспорттау',
  knownDateDay: 'Күн',
  knownDateMonth: 'Ай',
  knownDateYear: 'Жыл',
  exportFormatMenuLabel: 'Пішім: {label}',
  mentionSuggestions: 'Ұсыныстар',
  mentionResultCount: {
    one: '{count} ұсыныс',
    other: '{count} ұсыныс',
  },
  mentionResultPosition: 'Ұсыныс {current}, барлығы {total}',
  iconLoadError: 'Белгішені жүктеу мүмкін болмады.',
  iconTooLarge: 'Белгіше файлы көрсету үшін тым үлкен.',
  iconSanitizerMissing: 'Бұл белгішені қауіпсіз көрсету үшін қосымша "dompurify" бумасын орнату қажет.',
  tourSkip: 'Өткізіп жіберу',
  tourDone: 'Дайын',
  tourStepOf: 'Қадам {current}, барлығы {total}',
};

registerLyraLocale('kk', strings);
