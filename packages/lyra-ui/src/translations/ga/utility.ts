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
  copyJson: 'Copy JSON to clipboard',
  circularReference: 'Circular reference',
  copyDiff: 'Copy diff',
  diffViewOldLabel: 'Original',
  diffViewNewLabel: 'Modified',
  diffViewHiddenLines: {
    few: '{count} unchanged lines',
    many: '{count} unchanged lines',
    one: '{count} unchanged line',
    other: '{count} unchanged lines',
    two: '{count} unchanged lines',
  },
  diffViewTooLarge: 'Diff is too large to display.',
  jsonArray: 'array',
  jsonObject: 'object',
  jsonValue: 'value',
  jsonCopyLabel: 'Copy {label}',
  jsonExpandLabel: 'Expand {label}',
  jsonCollapseLabel: 'Collapse {label}',
  jsonItemCount: {
    few: '{count} items',
    many: '{count} items',
    one: '{count} item',
    other: '{count} items',
    two: '{count} items',
  },
  jsonKeyCount: {
    few: '{count} keys',
    many: '{count} keys',
    one: '{count} key',
    other: '{count} keys',
    two: '{count} keys',
  },
  jsonViewerLimit: 'Only the first {count} JSON nodes and {depth} nesting levels are shown and searched.',
  pollPause: 'Pause',
  pollResume: 'Resume',
  pollRefresh: 'Refresh now',
  pollInactive: 'Inactive',
  pollRefreshing: 'Refreshing…',
  pollPaused: 'Paused',
  pollPausedAnnounce: 'Paused.',
  pollResumedAnnounce: 'Resumed.',
  pollRefreshingAnnounce: 'Refreshing now.',
  randomContentPause: 'Pause rotation',
  randomContentResume: 'Resume rotation',
  randomContentNext: 'Show another',
  exportButtonLabel: 'Export',
  knownDateDay: 'Day',
  knownDateMonth: 'Month',
  knownDateYear: 'Year',
  exportFormatMenuLabel: '{label} format',
  mentionSuggestions: 'Suggestions',
  mentionResultCount: {
    few: '{count} suggestions',
    many: '{count} suggestions',
    one: '{count} suggestion',
    other: '{count} suggestions',
    two: '{count} suggestions',
  },
  mentionResultPosition: 'Suggestion {current} of {total}',
  iconLoadError: 'The icon failed to load.',
  iconTooLarge: 'The icon file is too large to display.',
  iconSanitizerMissing: 'This icon needs the optional "dompurify" package installed to render safely.',
  tourSkip: 'Skip',
  tourDone: 'Done',
  tourStepOf: 'Step {current} of {total}',
  mentionMoreResults: {
    few: '{count} more suggestions',
    many: '{count} more suggestions',
    one: '{count} more suggestion',
    other: '{count} more suggestions',
    two: '{count} more suggestions',
  },
  mentionInputLimit: 'Only the first 10,000 mention candidates are available.',
  diffViewHighlightLimit: 'Long code is shown without syntax highlighting.',
};

registerLyraLocale('ga', strings);
