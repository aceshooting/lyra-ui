// The `utility` slice of the bg translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/utility/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-translations/bg/utility';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs bg --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  copyJson: 'Копирай JSON в клипборда',
  circularReference: 'Циклична препратка',
  copyDiff: 'Копирай разликите',
  diffViewOldLabel: 'Оригинал',
  diffViewNewLabel: 'Променен',
  diffViewHiddenLines: {
    one: '{count} непроменен ред',
    other: '{count} непроменени реда',
  },
  diffViewTooLarge: 'Разликите са твърде големи за показване.',
  jsonArray: 'масив',
  jsonObject: 'обект',
  jsonValue: 'стойност',
  jsonCopyLabel: 'Копирай {label}',
  jsonExpandLabel: 'Разгъни {label}',
  jsonCollapseLabel: 'Свий {label}',
  jsonItemCount: {
    one: '{count} елемент',
    other: '{count} елемента',
  },
  jsonKeyCount: {
    one: '{count} ключ',
    other: '{count} ключа',
  },
  jsonViewerLimit: 'Показват се и се претърсват само първите {count} JSON възела и {depth} нива на вложеност.',
  pollPause: 'Пауза',
  pollResume: 'Продължи',
  pollRefresh: 'Обнови сега',
  pollInactive: 'Неактивно',
  pollRefreshing: 'Обновява се…',
  pollPaused: 'На пауза',
  pollPausedAnnounce: 'На пауза.',
  pollResumedAnnounce: 'Продължено.',
  pollRefreshingAnnounce: 'Обновява се сега.',
  randomContentPause: 'Спри редуването',
  randomContentResume: 'Продължи редуването',
  randomContentNext: 'Покажи друго',
  exportButtonLabel: 'Експортирай',
  knownDateDay: 'Ден',
  knownDateMonth: 'Месец',
  knownDateYear: 'Година',
  exportFormatMenuLabel: 'Формат {label}',
  mentionSuggestions: 'Предложения',
  mentionResultCount: {
    one: '{count} предложение',
    other: '{count} предложения',
  },
  mentionResultPosition: 'Предложение {current} от {total}',
  iconLoadError: 'Иконата не можа да се зареди.',
  iconTooLarge: 'Файлът на иконата е твърде голям за показване.',
  iconSanitizerMissing: 'За безопасно показване тази икона изисква инсталиран незадължителен пакет „dompurify“.',
  tourSkip: 'Пропусни',
  tourDone: 'Готово',
  tourStepOf: 'Стъпка {current} от {total}',
  mentionMoreResults: {
    one: 'Още {count} предложение',
    other: 'Още {count} предложения',
  },
  mentionInputLimit: 'Налични са само първите 10 000 кандидата за споменаване.',
  diffViewHighlightLimit: 'Дългият код се показва без оцветяване на синтаксиса.',
};

registerLyraLocale('bg', strings);
