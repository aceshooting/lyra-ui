// The `utility` slice of the sr translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/utility/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-translations/sr/utility';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs sr --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  copyJson: 'Копирај JSON у привремену меморију',
  circularReference: 'Кружна референца',
  copyDiff: 'Копирај разлике',
  diffViewOldLabel: 'Оригинал',
  diffViewNewLabel: 'Измењено',
  diffViewHiddenLines: {
    few: '{count} непромењена реда',
    one: '{count} непромењен ред',
    other: '{count} непромењених редова',
  },
  diffViewTooLarge: 'Разлике су превелике за приказ.',
  jsonArray: 'низ',
  jsonObject: 'објекат',
  jsonValue: 'вредност',
  jsonCopyLabel: 'Копирај {label}',
  jsonExpandLabel: 'Прошири {label}',
  jsonCollapseLabel: 'Скупи {label}',
  jsonItemCount: {
    few: '{count} ставке',
    one: '{count} ставка',
    other: '{count} ставки',
  },
  jsonKeyCount: {
    few: '{count} кључа',
    one: '{count} кључ',
    other: '{count} кључева',
  },
  jsonViewerLimit: 'Приказује се и претражује само првих {count} JSON чворова и {depth} нивоа угнежђавања.',
  pollPause: 'Паузирај',
  pollResume: 'Настави',
  pollRefresh: 'Освежи одмах',
  pollInactive: 'Неактивно',
  pollRefreshing: 'Освежавање…',
  pollPaused: 'Паузирано',
  pollPausedAnnounce: 'Паузирано.',
  pollResumedAnnounce: 'Настављено.',
  pollRefreshingAnnounce: 'Освежава се одмах.',
  randomContentPause: 'Паузирај смењивање',
  randomContentResume: 'Настави смењивање',
  randomContentNext: 'Прикажи друго',
  exportButtonLabel: 'Извези',
  knownDateDay: 'Дан',
  knownDateMonth: 'Месец',
  knownDateYear: 'Година',
  exportFormatMenuLabel: 'Формат за {label}',
  mentionSuggestions: 'Предлози',
  mentionResultCount: {
    few: '{count} предлога',
    one: '{count} предлог',
    other: '{count} предлога',
  },
  mentionResultPosition: 'Предлог {current} од {total}',
  iconLoadError: 'Икона није могла да се учита.',
  iconTooLarge: 'Датотека иконе је превелика за приказ.',
  iconSanitizerMissing: 'За безбедан приказ ове иконе потребно је инсталирати опциони пакет „dompurify“.',
  tourSkip: 'Прескочи',
  tourDone: 'Готово',
  tourStepOf: 'Корак {current} од {total}',
  mentionMoreResults: {
    few: 'Још {count} предлога',
    one: 'Још {count} предлог',
    other: 'Још {count} предлога',
  },
  mentionInputLimit: 'Доступно је само првих 10.000 кандидата за помињање.',
  diffViewHighlightLimit: 'Дугачак код се приказује без истицања синтаксе.',
};

registerLyraLocale('sr', strings);
