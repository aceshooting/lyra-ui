import { DEFAULT_MAX_FILE_SIZE_BYTES } from '../src/lyra.js';
import type {
  BadgeSize,
  BadgeVariant,
  BreadcrumbItemTarget,
  CalloutAppearance,
  CalloutSize,
  CardOrientation,
  ChipSize,
  ChipVariant,
  FormatBytesUnit,
  FormatDisplay,
  LyraCarouselOrientation,
  LyraChartArea,
  LyraChartConfiguration,
  LyraChartDataConfiguration,
  LyraChartDatasetConfiguration,
  LyraChartPlugin,
  LyraChartValueFormatter,
  LyraChartValueFormatterContext,
  LyraComboboxAppearance,
  LyraComboboxPlacement,
  LyraComboboxTagRenderer,
  LyraDatePicker,
  LyraDatePickerFirstDayOfWeek,
  LyraEmojiPickerSize,
  LyraEvalDataset,
  LyraFileInputCapture,
  LyraLiteChartScale,
  LyraMarkedParser,
  LyraModelSelectSize,
  LyraPopupRole,
  LyraTimeRangeSize,
  LyraTokenInputSize,
  MarkdownHeadingItem,
  MenuItemSelectDetail,
  MenuItemStateChangeDetail,
  MenuItemVariant,
  MessageFeedbackRating,
  MessageFeedbackValue,
  OtpInputSelectionDirection,
  OverlayVirtualRect,
  PlaceAutoSize,
  PlaceBoundary,
  PlaceFlipFallbackStrategy,
  PlaceStrategy,
  PlaceSync,
  RadioAppearance,
  RadioGroupOrientation,
  ResultCardAppearance,
  ShikiLanguageInput,
  TagVariant,
  TableColumnEditable,
  TableEdgeAlign,
  TableSelectionMode,
  TableSortMode,
  TaskListAppearance,
  ThinkingPanelAppearance,
  TreeBadgeTone,
  TreeSelection,
  LyraRatingSize,
  ToastSize,
  VirtualAnchor,
  WordCloudLegendItem,
  WordCloudOrientations,
  WordCloudScale,
} from '../src/lyra.js';

// These pre-v9 compatibility names duplicated the canonical variant types even though their
// properties have no corresponding `tone` alias. Their deliberate absence is part of the v9
// public contract; an accidental re-export makes each `@ts-expect-error` fail.
// @ts-expect-error ActivityEntryTone was removed in favor of LyraVariant.
import type { ActivityEntryTone as RemovedActivityEntryTone } from '../src/lyra.js';
// @ts-expect-error ConfirmBarTone was removed in favor of ConfirmBarVariant.
import type { ConfirmBarTone as RemovedConfirmBarTone } from '../src/lyra.js';
// @ts-expect-error ChipTone was removed in favor of ChipVariant.
import type { ChipTone as RemovedChipTone } from '../src/lyra.js';

declare const removedV9Aliases: [
  RemovedActivityEntryTone,
  RemovedConfirmBarTone,
  RemovedChipTone,
];
void removedV9Aliases;

// Registration-free package-root reachability for public property/configuration types. Keeping
// them in one tuple makes an accidental removal fail `test:types` even when the same name remains
// reachable from a granular component entry.
const rootPublicTypes:
  | [
      BreadcrumbItemTarget,
      BadgeSize,
      BadgeVariant,
      CalloutAppearance,
      CalloutSize,
      CardOrientation,
      ChipSize,
      ChipVariant,
      FormatBytesUnit,
      FormatDisplay,
      LyraCarouselOrientation,
      LyraChartArea,
      LyraChartConfiguration,
      LyraChartDataConfiguration,
      LyraChartDatasetConfiguration,
      LyraChartPlugin,
      LyraChartValueFormatter,
      LyraChartValueFormatterContext,
      LyraComboboxAppearance,
      LyraComboboxPlacement,
      LyraComboboxTagRenderer,
      LyraDatePickerFirstDayOfWeek,
      LyraEmojiPickerSize,
      LyraFileInputCapture,
      LyraLiteChartScale,
      LyraMarkedParser,
      LyraModelSelectSize,
      LyraPopupRole,
      LyraTimeRangeSize,
      LyraTokenInputSize,
      MarkdownHeadingItem,
      MenuItemSelectDetail,
      MenuItemStateChangeDetail,
      MenuItemVariant,
      MessageFeedbackRating,
      MessageFeedbackValue,
      OtpInputSelectionDirection,
      OverlayVirtualRect,
      PlaceAutoSize,
      PlaceBoundary,
      PlaceFlipFallbackStrategy,
      PlaceStrategy,
      PlaceSync,
      RadioAppearance,
      RadioGroupOrientation,
      ResultCardAppearance,
      ShikiLanguageInput,
      TagVariant,
      TableColumnEditable,
      TableEdgeAlign,
      TableSelectionMode,
      TableSortMode,
      TaskListAppearance,
      ThinkingPanelAppearance,
      TreeBadgeTone,
      TreeSelection,
      LyraRatingSize,
      ToastSize,
      VirtualAnchor,
      WordCloudLegendItem,
      WordCloudOrientations,
      WordCloudScale
    ]
  | undefined = undefined;

void rootPublicTypes;
void DEFAULT_MAX_FILE_SIZE_BYTES;

const mirroredTokenSpellings: [BadgeVariant, BadgeSize, TagVariant, LyraRatingSize, ToastSize] = [
  'primary',
  'small',
  'text',
  'medium',
  'large',
];
void mirroredTokenSpellings;

declare const datePicker: LyraDatePicker;
datePicker.firstDayOfWeek = 'mon';
// @ts-expect-error The picker shares the closed weekday vocabulary with lr-date-input.
datePicker.firstDayOfWeek = 'someday';

declare const evalDataset: LyraEvalDataset;
const evalDatasetSearchEditingProperties: [
  typeof evalDataset.autocomplete,
  typeof evalDataset.spellcheck,
  typeof evalDataset.autocapitalize,
  typeof evalDataset.autoCorrect,
  typeof evalDataset.inputMode,
  typeof evalDataset.enterKeyHint,
] = ['off', false, 'none', 'off', 'search', 'search'];
void evalDatasetSearchEditingProperties;
