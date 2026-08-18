// The package root is registration-free: importing it defines no custom element, so a bundler
// can drop every component a consumer never names. `@aceshooting/lyra-ui/all.js` is the explicit
// entry that registers the whole root-included set (the pre-8 side effect of this module).
//
// Every component re-export below therefore points at the pure `*.class.js` module rather than the
// sibling `*.js` registration entry; importing a class here must never define its tag.
export { LyraEnvList } from './components/data/env-list/env-list.class.js';
export type {
  EnvEntry,
  LyraEnvListEventMap,
} from './components/data/env-list/env-list.class.js';
export { LyraHandoffDivider } from './components/conversation/handoff-divider/handoff-divider.class.js';
export { LyraActivityFeed } from './components/agent-tools/activity-feed/activity-feed.class.js';
export type {
  ActivityEntry,
  ActivityFeedMode,
  ActivityFeedToggleDetail,
  ActivityFeedFollowChangeDetail,
  LyraActivityFeedEventMap,
} from './components/agent-tools/activity-feed/activity-feed.class.js';
export { LyraMessageActions } from './components/conversation/message-actions/message-actions.class.js';
export type {
  MessageActionControl,
  LyraMessageActionsEventMap,
} from './components/conversation/message-actions/message-actions.class.js';
export { isLyraToolbarActionProvider } from './components/conversation/message-actions/toolbar-actions.js';
export type {
  LyraToolbarAction,
  LyraToolbarActionProvider,
} from './components/conversation/message-actions/toolbar-actions.js';
export { LyraTranscriptFeed } from './components/conversation/transcript-feed/transcript-feed.class.js';
export type {
  LyraTranscriptEntry,
  LyraTranscriptFeedEventMap,
} from './components/conversation/transcript-feed/transcript-feed.class.js';
export { LyraAudioVisualizer } from './components/conversation/audio-visualizer/audio-visualizer.class.js';
export type {
  AudioVisualizerMode,
  AudioVisualizerState,
} from './components/conversation/audio-visualizer/audio-visualizer.class.js';
export { LyraBranchPicker } from './components/conversation/branch-picker/branch-picker.class.js';
export type { LyraBranchPickerEventMap } from './components/conversation/branch-picker/branch-picker.class.js';
export { LyraComparePanel } from './components/agent-tools/compare-panel/compare-panel.class.js';
export type {
  CompareVote,
  LyraComparePanelEventMap,
} from './components/agent-tools/compare-panel/compare-panel.class.js';
export { LyraHighlightLayer } from './components/viewers/highlight-layer/highlight-layer.class.js';
export type {
  HighlightLayerItem,
  LyraHighlightLayerEventMap,
} from './components/viewers/highlight-layer/highlight-layer.class.js';
export { LyraMessageFeedback } from './components/conversation/message-feedback/message-feedback.class.js';
export type {
  MessageFeedbackDetailConfiguration,
  MessageFeedbackDetailFor,
  MessageFeedbackReason,
  MessageFeedbackRating,
  MessageFeedbackSubmitDetail,
  MessageFeedbackValue,
  LyraMessageFeedbackEventMap,
} from './components/conversation/message-feedback/message-feedback.class.js';
export * from './components/conversation/message-parts/message-parts.class.js';
export { LyraPageRail } from './components/viewers/page-rail/page-rail.class.js';
export type {
  LyraPageRailEventMap,
  LyraPageViewerSnapshot,
  LyraPageViewerStateChangeDetail,
  LyraPageViewerStatus,
  PageThumbnailRenderHandle,
  PageThumbnailSource,
} from './components/viewers/page-rail/page-rail.class.js';
export { LyraPushToTalk } from './components/conversation/push-to-talk/push-to-talk.class.js';
export type {
  PushToTalkMode,
  PushToTalkState,
  PushToTalkAudioConstraints,
  LyraPushToTalkEventMap,
} from './components/conversation/push-to-talk/push-to-talk.class.js';
export { LyraPromptInput } from './components/conversation/prompt-input/prompt-input.class.js';
export type {
  LyraPromptInputAttachment,
  LyraPromptInputEventMap,
  LyraPromptSuggestion,
} from './components/conversation/prompt-input/prompt-input.class.js';
export * from './components/conversation/prompt-queue/prompt-queue.class.js';
export * from './components/conversation/selection-toolbar/selection-toolbar.class.js';
export { LyraRubricForm } from './components/forms/rubric-form/rubric-form.class.js';
export type {
  CategoryRubricKey,
  CommentRubricKey,
  RubricKeyOption,
  RubricKey,
  RubricValue,
  ScoreRubricKey,
  LyraRubricFormEventMap,
} from './components/forms/rubric-form/rubric-form.class.js';
export { LyraSpanWaterfall } from './components/agent-tools/span-waterfall/span-waterfall.class.js';
export type {
  LyraSpan,
  LyraSpanWaterfallEventMap,
} from './components/agent-tools/span-waterfall/span-waterfall.class.js';
export { LyraTaskList } from './components/agent-tools/task-list/task-list.class.js';
export type {
  TaskStatus,
  TaskItem,
  TaskListAppearance,
  TaskListToggleDetail,
  LyraTaskListEventMap,
} from './components/agent-tools/task-list/task-list.class.js';
export { LyraTerminal } from './components/agent-tools/terminal/terminal.class.js';
export type { LyraTerminalEventMap } from './components/agent-tools/terminal/terminal.class.js';
export { LyraTraceTree } from './components/agent-tools/trace-tree/trace-tree.class.js';
export type { LyraTraceTreeEventMap } from './components/agent-tools/trace-tree/trace-tree.class.js';
export {
  MAX_RENDERED_LYRA_SPANS,
  normalizeLyraSpanKind,
  normalizeLyraSpans,
  normalizeLyraSpanStatus,
} from './components/agent-tools/trace-tree/span.js';
export type { LyraSpanProjection } from './components/agent-tools/trace-tree/span.js';
export {
  agentStatusKind,
  agentStatusLabel,
  agentStatusMessage,
  agentStatusVariant,
  isAgentStatusActive,
  isAgentStatusTerminal,
} from './components/agent-tools/agent-status-presentation.js';
export type {
  AgentStatusPresentation,
  AgentStatusValue,
} from './components/agent-tools/agent-status-presentation.js';
export {
  approvalAction,
  approvalDecision,
} from './components/agent-tools/approval-state.js';
export type {
  ApprovalAction,
  ApprovalDecision,
} from './components/agent-tools/approval-state.js';
export type { AgentRunActivateDetail } from './components/agent-tools/run-events.js';
export { LyraSparkline } from './components/data/sparkline/sparkline.class.js';
export type {
  LyraSparklineAppearance,
  LyraSparklineCurve,
  LyraSparklineMark,
  LyraSparklineTrend,
} from './components/data/sparkline/sparkline.class.js';
export { LyraSequenceStrip } from './components/data/sequence-strip/sequence-strip.class.js';
export type {
  SequenceStripItem,
  SequenceStripCategory,
} from './components/data/sequence-strip/sequence-strip.class.js';
export { LyraEmojiPicker } from './components/forms/emoji-picker/emoji-picker.class.js';
export type {
  EmojiPickerItem,
  EmojiPickerGroup,
  LyraEmojiPickerEventMap,
} from './components/forms/emoji-picker/emoji-picker.class.js';
export { LyraLocalePicker } from './components/forms/locale-picker/locale-picker.class.js';
export type {
  LyraLocaleEntry,
  LyraLocaleCatalog,
  LyraLocaleChangeDetail,
  LyraLocalePickerEventMap,
} from './components/forms/locale-picker/locale-picker.class.js';
export { LyraToast } from './components/overlays/toast/toast.class.js';
export type {
  LyraToastIcon,
  LyraToastIconContent,
  LyraToastOptions,
  LyraToastPlacement,
  LyraToastCreateOptions,
  LyraToastOverflowDetail,
  LyraToastEventMap,
} from './components/overlays/toast/toast.class.js';
export { LyraToastItem } from './components/overlays/toast/toast-item.class.js';
export type {
  LyraToastVariant,
  LyraToastSize,
} from './components/overlays/toast/toast-item.class.js';
export { toast } from './components/overlays/toast/toaster.js';
export type { ToastHandle } from './components/overlays/toast/toaster.js';
export { LyraCombobox } from './components/forms/combobox/combobox.class.js';
export type {
  LyraComboboxPlacement,
  OptionFilter,
  LyraComboboxSelectionDirection,
  LyraComboboxTagRenderer,
  ComboboxSourceResult,
} from './components/forms/combobox/combobox.class.js';
export type {
  LyraComboboxValidator,
  LyraComboboxValidatorResult,
  LyraComboboxObjectValidator,
  LyraComboboxObjectValidatorResult,
} from './components/forms/combobox/combobox.class.js';

export { LyraOption } from './components/forms/combobox/option.class.js';
export { LyraSelect } from './components/forms/select/select.class.js';
export type { LyraSelectTagRenderer } from './components/forms/select/select.class.js';
export { LyraDatePicker } from './components/forms/date-picker/date-picker.class.js';
export type {
  DateRange,
  LyraDatePickerDayContent,
  LyraDatePickerDisabledDates,
  LyraDatePickerFirstDayOfWeek,
  LyraDatePickerPageBy,
  LyraDatePickerView,
} from './components/forms/date-picker/date-picker.class.js';
export { LyraDateInput } from './components/forms/date-picker/date-input.class.js';
export type {
  LyraDateInputFirstDayOfWeek,
  LyraDateInputObjectValidator,
  LyraDateInputObjectValidatorResult,
  LyraDateInputPlacement,
  LyraDateInputSelectionDirection,
  LyraDateInputValidator,
  LyraDateInputValidatorResult,
} from './components/forms/date-picker/date-input.class.js';
export { LyraAnimatedImage } from './components/media/animated-image/animated-image.class.js';
export type { LyraAnimatedImageEventMap } from './components/media/animated-image/animated-image.class.js';
export {
  animations,
  getAnimationNames,
  getEasingNames,
  LYRA_ANIMATION_NAMES,
  LYRA_EASINGS,
  LyraAnimation,
} from './components/media/animation/animation.class.js';
export type {
  LyraAnimationCatalog,
  LyraAnimationEasingName,
  LyraAnimationPreset,
  LyraAnimationTimingPreset,
  LyraAnimationEventMap,
  LyraMirrorAnimationName,
} from './components/media/animation/animation.class.js';
export {
  getAnimation,
  setAnimation,
  setDefaultAnimation,
} from './utilities/animation-registry.js';
export type {
  LyraAnimationCleanup,
  LyraElementAnimation,
  LyraGetAnimationOptions,
  LyraResolvedElementAnimation,
} from './utilities/animation-registry.js';
export { invalidateLyraTheme } from './utilities/theme.js';
export type { LyraThemeRoot } from './utilities/theme.js';
export {
  bridgeLyraLocale,
  subscribeLyraLocale,
} from './utilities/localization.js';
export type {
  LyraLocaleBridgeCleanup,
  LyraLocaleBridgeOptions,
} from './utilities/localization.js';
export { LyraAvatarGroup } from './components/media/avatar-group/avatar-group.class.js';
export type {
  LyraAvatarGroupOverflowDetail,
  LyraAvatarGroupEventMap,
} from './components/media/avatar-group/avatar-group.class.js';
export { LyraInclude } from './components/viewers/include/include.class.js';
export type {
  LyraIncludeMode,
  LyraIncludeErrorDetail,
  LyraIncludeErrorReason,
  LyraIncludeEventMap,
} from './components/viewers/include/include.class.js';
export { LyraKnownDate } from './components/utility/known-date/known-date.class.js';
export type {
  LyraKnownDateAppearance,
  LyraKnownDateField,
  LyraKnownDateEventDetail,
  LyraKnownDateEventMap,
  LyraKnownDateParts,
} from './components/utility/known-date/known-date.class.js';
export { LyraLightbox } from './components/media/lightbox/lightbox.class.js';
export type {
  LyraLightboxImage,
  LyraLightboxCloseReason,
  LyraLightboxHideDetail,
  LyraLightboxEventMap,
} from './components/media/lightbox/lightbox.class.js';
export { LyraQrCode } from './components/media/qr-code/qr-code.class.js';
export type { LyraQrCodeErrorCorrection } from './components/media/qr-code/qr-code.class.js';
export { LyraRandomContent } from './components/utility/random-content/random-content.class.js';
export type {
  LyraRandomContentAnimation,
  LyraRandomContentMode,
  LyraRandomContentEventMap,
} from './components/utility/random-content/random-content.class.js';
export { LyraTimeline } from './components/data/timeline/timeline.class.js';
export type { LyraTimelineScale } from './components/data/timeline/timeline.class.js';
export { LyraTimelineItem } from './components/data/timeline/timeline-item.class.js';
export { LyraTour } from './components/utility/tour/tour.class.js';
export type {
  LyraTourTarget,
  LyraTourStep,
  LyraTourEndReason,
  LyraTourEventMap,
} from './components/utility/tour/tour.class.js';
export {
  LyraFlag,
  setFlagUrlResolver,
} from './components/media/flag/flag.class.js';
export type {
  LyraFlagFidelity,
  LyraFlagShape,
  LyraFlagUrlResolver,
} from './components/media/flag/flag.class.js';
export {
  LANGUAGE_TO_COUNTRY,
  languageToCountry,
  localeNativeName,
} from './components/media/flag/language-map.js';
export { LyraEmpty } from './components/overlays/empty/empty.class.js';
export { LyraSkeleton } from './components/overlays/skeleton/skeleton.class.js';
export type {
  LyraSkeletonShape,
  LyraSkeletonEffect,
} from './components/overlays/skeleton/skeleton.class.js';
export { LyraStat } from './components/data/stat/stat.class.js';
export type {
  StatGoodDirection,
  StatRow,
  StatOrientation,
} from './components/data/stat/stat.class.js';
export { LyraTable } from './components/data/table/table.class.js';
export type {
  TableColumn,
  TableColumnEditTrigger,
  TableEdgeAlign,
  TableLoadingAppearance,
  TableSelectionMode,
  TableSortCommitDetail,
  TableSortDetail,
  TableSortDirection,
  TableSortMode,
  TableSortRequestDetail,
} from './components/data/table/table.class.js';
export { LyraDataGrid } from './components/data/data-grid/data-grid.class.js';
export type {
  DataGridAggregation,
  DataGridAppearance,
  DataGridCellContextMenuDetail,
  DataGridCellDetail,
  DataGridColumn,
  DataGridColumnMoveDetail,
  DataGridColumnPinDetail,
  DataGridColumnResizeDetail,
  DataGridColumnState,
  DataGridColumnVisibilityDetail,
  DataGridCopyOptions,
  DataGridCsvOptions,
  DataGridDataErrorDetail,
  DataGridExportOptions,
  DataGridFacets,
  DataGridFilter,
  DataGridFilterType,
  DataGridGroupDetail,
  DataGridJsonValue,
  DataGridKey,
  DataGridPageDetail,
  DataGridPinSide,
  DataGridRequest,
  DataGridResponse,
  DataGridRowDetail,
  DataGridScrollOptions,
  DataGridSelectable,
  DataGridSelectionDetail,
  DataGridSize,
  DataGridSort,
  DataGridSortAlgorithm,
  DataGridSortingState,
  DataGridState,
  DataGridStateFilter,
  LyraDataGridEventMap,
  SortingState,
} from './components/data/data-grid/data-grid.class.js';
export { LyraGauge } from './components/data/gauge/gauge.class.js';
export type { GaugeShape } from './components/data/gauge/gauge.class.js';
export { LyraExportButton } from './components/utility/export-button/export-button.class.js';
export type {
  LyraExportFormat,
  LyraExportFormatDescriptor,
  LyraExportFormatOption,
} from './components/utility/export-button/export-button.class.js';
export {
  escapeCsvField,
  buildCsv,
  downloadBlob,
} from './components/utility/export-button/csv.js';
export type { LyraCsvColumn } from './components/utility/export-button/csv.js';
export { LyraCopyButton } from './components/utility/copy-button/copy-button.class.js';
export { LyraMultiSplit } from './components/layout/multi-split/multi-split.class.js';
export type {
  LyraMultiSplitCollapseChangeDetail,
  LyraMultiSplitCollapseMode,
  LyraMultiSplitCollapseState,
  LyraMultiSplitCollapseStateInput,
  LyraMultiSplitConstraintIssueDetail,
  LyraMultiSplitConstraintIssueReason,
  LyraMultiSplitEventMap,
  LyraMultiSplitOrientationChangeDetail,
  LyraMultiSplitPanelConstraint,
  LyraMultiSplitResizeDetail,
} from './components/layout/multi-split/multi-split.class.js';
export {
  LyraSplitPanel,
  SNAP_NONE,
} from './components/layout/split-panel/split-panel.class.js';
export type {
  LyraSplitPanelEventMap,
  LyraSplitPanelSnapFunction,
  LyraSplitPanelSnapFunctionParams,
  LyraSplitPanelOrientation,
  LyraSplitPanelPrimary,
  LyraSplitPanelRepositionDetail,
} from './components/layout/split-panel/split-panel.class.js';
export { LyraPage } from './components/layout/page/page.class.js';
export type {
  LyraPageEventMap,
  PageNavigationPlacement,
  PageView,
} from './components/layout/page/page.class.js';
export { LyraTimeRange } from './components/forms/time-range/time-range.class.js';
export type {
  TimeRangeHandle,
  TimeRangePreset,
  TimeRangeValueFormatter,
} from './components/forms/time-range/time-range.class.js';
export { LyraSequencePlayback } from './components/media/sequence-playback/sequence-playback.class.js';
export { LyraPagination } from './components/data/pagination/pagination.class.js';
export type {
  LyraPaginationFormat,
  LyraPaginationChangeDetail,
} from './components/data/pagination/pagination.class.js';
export { LyraHeatmap } from './components/data/heatmap/heatmap.class.js';
export type {
  HeatmapData,
  HeatmapMatrixData,
  HeatmapCalendarData,
  HeatmapMode,
  HeatmapScale,
  MatrixCellPos,
  CalendarCellPos,
  HeatmapAnnotation,
  HeatmapLegendStop,
  HeatmapSelectedCell,
  LyraHeatmapCellClickDetail,
} from './components/data/heatmap/heatmap.class.js';
export {
  linearAlpha,
  sqrtStep,
} from './components/data/heatmap/heatmap-scale.js';
export { LyraTree } from './components/data/tree/tree.class.js';
export type {
  LyraTreeNodeData,
  TreeBadge,
  TreeSelection,
  LyraTreeEventMap,
} from './components/data/tree/tree.class.js';
export { LyraFileTree } from './components/data/file-tree/file-tree.class.js';
export type {
  FileTreeNode,
  GitStatus,
  LyraFileTreeEventMap,
} from './components/data/file-tree/file-tree.class.js';
export { LyraCommitCard } from './components/agent-tools/commit-card/commit-card.class.js';
export type {
  CommitCardAppearance,
  CommitFileChange,
  LyraCommitCardEventMap,
} from './components/agent-tools/commit-card/commit-card.class.js';
export { LyraStackTrace } from './components/agent-tools/stack-trace/stack-trace.class.js';
export type {
  LyraStackTraceEventMap,
  StackTraceAppearance,
} from './components/agent-tools/stack-trace/stack-trace.class.js';
export {
  parseStackTrace,
  DEFAULT_INTERNAL_PATTERNS,
  STACK_TRACE_LIMITS,
} from './components/agent-tools/stack-trace/stack-trace-parse.js';
export type {
  StackFrame,
  StackGroup,
  StackTraceParseOptions,
  StackTraceParseResult,
} from './components/agent-tools/stack-trace/stack-trace-parse.js';
export {
  LyraTestResults,
  testResultDetailSlotName,
} from './components/agent-tools/test-results/test-results.class.js';
export type {
  TestStatus,
  TestRunState,
  TestCaseResult,
  TestSuiteResult,
  LyraTestResultsEventMap,
} from './components/agent-tools/test-results/test-results.class.js';
export { LyraTreeItem } from './components/data/tree/tree-item.class.js';
export { LyraLiteChart } from './components/charts/chart/lite-chart.class.js';
export type {
  LyraLiteChartSeries,
  LyraLiteChartType,
  LyraLiteChartScale,
  LyraLiteChartLayout,
  LyraLiteChartExportFormat,
  LyraLiteChartTableCellKind,
  LyraLiteChartTableCellContext,
  LyraLiteChartTableCellFormatter,
} from './components/charts/chart/lite-chart.class.js';
export { binValues } from './components/charts/chart/histogram-bin.js';
export type { HistogramBucket } from './components/charts/chart/histogram-bin.js';
export { LyraChart } from './components/charts/chart/chart.class.js';
export { LyraBarChart } from './components/charts/chart/bar-chart.class.js';
export { LyraBubbleChart } from './components/charts/chart/bubble-chart.class.js';
export { LyraDoughnutChart } from './components/charts/chart/doughnut-chart.class.js';
export { LyraLineChart } from './components/charts/chart/line-chart.class.js';
export { LyraPieChart } from './components/charts/chart/pie-chart.class.js';
export { LyraPolarAreaChart } from './components/charts/chart/polar-area-chart.class.js';
export { LyraRadarChart } from './components/charts/chart/radar-chart.class.js';
export { LyraScatterChart } from './components/charts/chart/scatter-chart.class.js';
export { LyraHistogram } from './components/charts/chart/histogram.class.js';
export type {
  LyraChartPoint,
  LyraChartSeries,
  LyraChartInstance,
  LyraChartArea,
  LyraChartConfiguration,
  LyraChartDataConfiguration,
  LyraChartDatasetConfiguration,
  LyraChartType,
  LyraChartGrid,
  LyraChartIndexAxis,
  LyraChartScaleType,
  LyraChartAnnotation,
  LyraChartLayoutPosition,
  LyraChartLegendPosition,
  LyraChartExportFormat,
  LyraChartPlugin,
  LyraChartFormatSurface,
  LyraChartFormatter,
  LyraChartFormatterContext,
  LyraChartDatumKind,
  LyraChartDatumActivateDetail,
  LyraChartValueFormatter,
  LyraChartValueFormatterContext,
} from './components/charts/chart/chart.class.js';
export { preloadCharts } from './components/charts/chart/chart-preload.js';
export type {
  LyraChartPreloadOptions,
  LyraChartPreloadResult,
} from './components/charts/chart/chart-preload.js';
export type { LyraChartLegendVisibilityChangeDetail } from './components/charts/chart/chart-legend-visibility.js';
export type { LyraChartChromeLegendPosition } from './components/charts/chart/chart-chrome.js';
export { LyraBoxPlot } from './components/charts/chart/box-plot.class.js';
export type {
  LyraBoxPlotSummary,
  LyraBoxPlotSeries,
  LyraBoxPlotPointDetail,
  LyraBoxPlotEventMap,
} from './components/charts/chart/box-plot.class.js';
export { LyraGraph } from './components/retrieval/graph/graph.class.js';
export type {
  LyraGraphCommunity,
  LyraGraphLayout,
  LyraGraphPickKind,
  LyraGraphRenderer,
  LyraGraphSelectionMode,
  LyraGraphLink,
  LyraGraphNode,
  LyraScoreThresholds,
} from './components/retrieval/graph/graph.class.js';
export type { LyraNodeTypeStyle } from './internal/node-type-style.js';
export { LyraMap } from './components/media/map/map.class.js';
export type {
  LyraMapLegendEntry,
  LyraMapLegendGradientStop,
  LyraMapLegendPattern,
  LyraMapLegendProjection,
  LyraMapChoroplethLayer,
  LyraMapMarker,
  LyraMapGeoJsonDataLayer,
  LyraMapStyleSpecification,
  LyraMapInstance,
} from './components/media/map/map.class.js';
export {
  DEFAULT_MAX_FILE_SIZE_BYTES,
  LyraFileInput,
} from './components/media/file-input/file-input.class.js';
export type {
  LyraFileInputCapture,
  LyraFileInputFilesDetail,
  LyraFileInputRejectedFile,
  LyraFileInputValidator,
  LyraFileInputValidatorResult,
  LyraFileInputObjectValidator,
  LyraFileInputObjectValidatorResult,
} from './components/media/file-input/file-input.class.js';

export {
  LyraPhoneInput,
  loadLibphonenumberAdapter,
} from './components/forms/phone-input/phone-input.class.js';
export type {
  LyraPhoneNumberStatus,
  LyraPhoneCountry,
  LyraPhoneNumberParseResult,
  LyraPhoneNumberAdapter,
  LibphonenumberModuleLike,
  LyraPhoneInputEventDetail,
  LyraPhoneInputSelectionDirection,
} from './components/forms/phone-input/phone-input.class.js';
export { LyraWidget } from './components/layout/widget/widget.class.js';
export type { LyraWidgetView } from './components/layout/widget/widget.class.js';
export { LyraWordCloud } from './components/data/word-cloud/word-cloud.class.js';
export type {
  WordCloudLegendItem,
  WordCloudRotation,
  WordCloudScale,
  WordCloudWord,
} from './components/data/word-cloud/word-cloud.class.js';
export type {
  ComboboxFilterDetail,
  ComboboxSource,
  ComboboxSourceRow,
} from './components/forms/combobox/combobox.class.js';
export type { CalendarDay } from './components/data/heatmap/calendar-grid.js';
export { LyraDialog } from './components/overlays/dialog/dialog.class.js';
export { LyraDrawer } from './components/overlays/drawer/drawer.class.js';
export type { LyraDrawerPlacement } from './components/overlays/drawer/drawer.class.js';
export type {
  DialogCloseReason,
  LyraDialogHideDetail,
  LyraDialogModalController,
  LyraDialogRequestCloseDetail,
  LyraDialogRequestCloseSource,
} from './components/overlays/dialog/dialog.class.js';
export { confirm } from './components/overlays/dialog/confirm.js';
export type { ConfirmOptions } from './components/overlays/dialog/confirm.js';
export { LyraTabGroup } from './components/layout/tab-group/tab-group.class.js';
export type {
  LyraTabGroupPlacement,
  LyraTabGroupActivation,
} from './components/layout/tab-group/tab-group.class.js';
export { LyraTab } from './components/layout/tab-group/tab.class.js';
export type { LyraTabEventMap } from './components/layout/tab-group/tab.class.js';
export { LyraTabPanel } from './components/layout/tab-group/tab-panel.class.js';
export { LyraCheckbox } from './components/forms/checkbox/checkbox.class.js';
export { LyraSwitch } from './components/forms/switch/switch.class.js';
export { LyraJsonViewer } from './components/utility/json-viewer/json-viewer.class.js';
export { LyraLiveRegion } from './components/utility/live-region/live-region.class.js';
export type { LyraLiveRegionMode } from './components/utility/live-region/live-region.class.js';
export { Announcer, acquireAnnouncementSink } from './internal/announcer.js';
export type {
  AnnounceOptions,
  AnnouncementSink,
  AnnouncementSinkOptions,
  AnnouncerOptions,
  AnnouncerTimerHost,
} from './internal/announcer.js';
export type { LyraEmitOptions } from './internal/lyra-element.js';
export type { LyraEventMap } from './internal/lyra-element.js';
export type { LyraEventDetailSnapshot } from './internal/lyra-element.js';
export {
  getLyraLocale,
  getLyraLocaleDirection,
  registerLyraLocale,
  setLyraLocale,
  getRegisteredLyraLocales,
  subscribeLyraLocaleRegistry,
  resolveLyraDirection,
  resolveLyraLocale,
  resolveLyraString,
  LYRA_DEFAULT_STRINGS,
} from './localization.js';
export type {
  LyraLocaleDirection,
  LyraLocaleMeta,
  LyraLocaleStrings,
  LyraMessageKey,
} from './localization.js';
export type { FormAssociatedInterface } from './internal/form-associated.js';
export type {
  LyraFormValidator,
  LyraFormValidatorResult,
} from './components/forms/form-validator.js';
export { LyraMarkdown } from './components/conversation/markdown/markdown.class.js';
export { LyraMarkdownCore } from './components/conversation/markdown/markdown-core.class.js';
export { loadMarkdownDeps as preloadMarkdown } from './components/conversation/markdown/markdown-loader.js';
export type { MarkdownHtmlMode } from './components/conversation/markdown/markdown-shared.js';
export { LyraChatMessage } from './components/conversation/chat-message/chat-message.class.js';
export type {
  ChatMessageActionsPosition,
  ChatMessageRole,
  ChatMessageStatus,
  ChatMessageToggleDetail,
} from './components/conversation/chat-message/chat-message.class.js';
export { LyraTypingIndicator } from './components/conversation/typing-indicator/typing-indicator.class.js';
export type {
  TypingIndicatorShape,
  TypingIndicatorSize,
} from './components/conversation/typing-indicator/typing-indicator.class.js';
export { LyraToolCallChip } from './components/agent-tools/tool-call-chip/tool-call-chip.class.js';
export type {
  ToolCallStatus,
  ToolChipSelectDetail,
  LyraToolCallChipEventMap,
} from './components/agent-tools/tool-call-chip/tool-call-chip.class.js';
export { LyraToolResultView } from './components/agent-tools/tool-result-view/tool-result-view.class.js';
export type { ToolResultFallback } from './components/agent-tools/tool-result-view/tool-result-view.class.js';
export {
  registerToolRenderer,
  getDefaultToolRendererRegistry,
  findToolRenderer,
  loadToolRenderer,
} from './components/agent-tools/tool-result-view/registry.js';
export type {
  DirectToolRendererDefinition,
  LazyToolRendererDefinition,
  ToolRendererDefinition,
  ToolRendererRegistry,
  ToolRenderContext,
} from './components/agent-tools/tool-result-view/registry.js';
export { LyraToolResultDialog } from './components/agent-tools/tool-result-dialog/tool-result-dialog.class.js';
export type {
  ToolResultStatus,
  ToolResultDialogCloseReason,
  LyraToolResultDialogEventMap,
} from './components/agent-tools/tool-result-dialog/tool-result-dialog.class.js';
export { LyraChatComposer } from './components/conversation/chat-composer/chat-composer.class.js';
export type {
  ChatComposerFrame,
  ChatComposerStatus,
  ChatComposerWrap,
  ChatComposerSelectionDirection,
} from './components/conversation/chat-composer/chat-composer.class.js';
export {
  LyraAttachmentChip,
  formatFileSize,
} from './components/media/attachment-chip/attachment-chip.class.js';
export type {
  LyraAttachmentIdDetail,
  LyraAttachmentPreviewRequestDetail,
  LyraAttachmentUploadStatus,
} from './components/media/attachment-chip/attachment-chip.class.js';
export { LyraStreamStatus } from './components/conversation/stream-status/stream-status.class.js';
export type { StreamConnectionState } from './components/conversation/stream-status/stream-status.class.js';
export type { LyraStreamPhase } from './internal/stream-phase.js';
export { LyraVirtualList } from './components/layout/virtual-list/virtual-list.class.js';
export type {
  LyraVirtualListIndexedSource,
  LyraVirtualListGroup,
  LyraVirtualListItemRole,
  LyraVirtualListRange,
  LyraVirtualListRowHeight,
  LyraVirtualListScroll,
  LyraVirtualListSource,
} from './components/layout/virtual-list/virtual-list.class.js';
export { LyraConversationItem } from './components/conversation/conversation-item/conversation-item.class.js';
export type {
  ConversationItemRenameDetail,
  ConversationItemSelectDetail,
} from './components/conversation/conversation-item/conversation-item.class.js';
export type { LyraTimestamp } from './components/conversation/timestamp.js';
export type { LyraCatalog, LyraCatalogEntry } from './utilities/catalog.js';
export { LyraModelSelect } from './components/conversation/model-select/model-select.class.js';
export type {
  LyraModelCatalogEntry,
  LyraModelSelectSelectionDirection,
} from './components/conversation/model-select/model-select.class.js';
export { LyraSlider } from './components/forms/slider/slider.class.js';
export { LyraToolSelectDialog } from './components/agent-tools/tool-select-dialog/tool-select-dialog.class.js';
export type {
  ToolSelectDialogTool,
  ToolSelectFilter,
  ToolSelectionChangeDetail,
  ToolSelectDialogCloseReason,
} from './components/agent-tools/tool-select-dialog/tool-select-dialog.class.js';
export { LyraCitationBadge } from './components/retrieval/citation-badge/citation-badge.class.js';
export type {
  CitationBadgeStatus,
  CitationActivateDetail,
  CitationOpenDetail,
} from './components/retrieval/citation-badge/citation-badge.class.js';
export { LyraSourceList } from './components/retrieval/source-list/source-list.class.js';
export type { SourceListToggleDetail } from './components/retrieval/source-list/source-list.class.js';
export { LyraSourceCard } from './components/retrieval/source-card/source-card.class.js';
export type {
  SourceCardExpandDetail,
  SourceCardOpenDetail,
} from './components/retrieval/source-card/source-card.class.js';
export {
  LyraAppRail,
  computeAppRailMode,
} from './components/layout/app-rail/app-rail.class.js';
export { LyraAppRailItem } from './components/layout/app-rail/app-rail-item.class.js';
export type {
  LyraAppRailMode,
  LyraAppRailModeInput,
  LyraAppRailPreferredMode,
  LyraAppRailPersistField,
  LyraAppRailModeChangeDetail,
  LyraAppRailToggleDetail,
  LyraAppRailResizeDetail,
} from './components/layout/app-rail/app-rail.class.js';
export { LyraReorderItem } from './components/layout/reorder-list/reorder-item.class.js';
export { LyraReorderList } from './components/layout/reorder-list/reorder-list.class.js';
export {
  LyraResponsivePanel,
  resolveResponsivePanelEffectiveMode,
} from './components/layout/responsive-panel/responsive-panel.class.js';
export type {
  LyraResponsivePanelMode,
  LyraResponsivePanelEffectiveMode,
  LyraResponsivePanelVariant,
  LyraResponsivePanelCloseReason,
  LyraResponsivePanelModeChangeDetail,
} from './components/layout/responsive-panel/responsive-panel.class.js';
export { LyraMentionPopover } from './components/utility/mention-popover/mention-popover.class.js';
export type {
  LyraMentionFocusOptions,
  LyraMentionItem,
  LyraMentionFilter,
  LyraMentionSelectDetail,
} from './components/utility/mention-popover/mention-popover.class.js';
export {
  LyraStreamingText,
  looksLikeMarkdown,
} from './components/conversation/streaming-text/streaming-text.class.js';
export type { StreamingTextContentMode } from './components/conversation/streaming-text/streaming-text.class.js';
export { LyraThinkingPanel } from './components/agent-tools/thinking-panel/thinking-panel.class.js';
export type {
  ThinkingPanelMode,
  ThinkingPanelAppearance,
  ThinkingPanelToggleDetail,
} from './components/agent-tools/thinking-panel/thinking-panel.class.js';
export { LyraGenerationMetrics } from './components/conversation/generation-metrics/generation-metrics.class.js';
export type {
  GenerationMetricsStatus,
  LyraGenerationMetricsEventMap,
} from './components/conversation/generation-metrics/generation-metrics.class.js';
export { LyraCodeBlock } from './components/conversation/code-block/code-block.class.js';
export { LyraToolApprovalDialog } from './components/agent-tools/tool-approval-dialog/tool-approval-dialog.class.js';
export type {
  ToolApprovalDialogWrap,
  ToolApprovalDialogCloseReason,
  ToolApprovalDialogPending,
} from './components/agent-tools/tool-approval-dialog/tool-approval-dialog.class.js';
export { LyraToolParamForm } from './components/agent-tools/tool-param-form/tool-param-form.class.js';
export type {
  ToolParamFormPropertyType,
  ToolParamFormPrimitive,
  ToolParamFormProperty,
  ToolParamFormValue,
  FlatToolParamSchema,
} from './components/agent-tools/tool-param-form/tool-param-form.class.js';
export { LyraMenu } from './components/layout/menu/menu.class.js';
export type {
  MenuFocusTarget,
  MenuItemSelectDetail,
} from './components/layout/menu/menu.class.js';
export { LyraMenuItem } from './components/layout/menu/menu-item.class.js';
export { LyraMenuLabel } from './components/layout/menu/menu-label.class.js';
export type {
  MenuItemChangeDetail,
  MenuItemStateChangeDetail,
  MenuItemType,
  MenuItemVariant,
} from './components/layout/menu/menu-item.class.js';
export { LyraDropdownItem } from './components/layout/menu/dropdown-item.class.js';
export type { LyraDropdownItemEventMap } from './components/layout/menu/dropdown-item.class.js';
export { LyraPopover } from './components/overlays/overlay/popover.class.js';
export { LyraPopup } from './components/overlays/popup/popup.class.js';
export type {
  LyraPopupAnchor,
  LyraPopupBoundary,
  LyraPopupEventMap,
  LyraPopupFlipFallbackStrategy,
  PlaceAutoSize,
  PlaceBoundary,
  PlaceFlipFallbackStrategy,
  PlaceStrategy,
  PlaceSync,
  VirtualAnchor,
} from './components/overlays/popup/popup.class.js';
export type {
  LyraPopoverEventMap,
  LyraPopupRole,
  OverlayVirtualRect,
} from './components/overlays/overlay/popover.class.js';
export type {
  LyraTooltipEventMap,
  LyraTooltipTrigger,
} from './components/overlays/overlay/tooltip.class.js';
export type { LyraArrowPlacement } from './components/overlays/overlay/popover.class.js';
export { LyraTooltip } from './components/overlays/overlay/tooltip.class.js';
export {
  LyraDropdown,
  type LyraDropdownEventMap,
} from './components/overlays/overlay/dropdown.class.js';
export { LyraChip } from './components/overlays/chip/chip.class.js';
export type {
  ChipRemoveDetail,
  ChipSelectDetail,
  ChipSize,
  ChipVariant,
} from './components/overlays/chip/chip.class.js';
export { LyraChipGroup } from './components/overlays/chip/chip-group.class.js';
export type { ChipGroupOverflowToggleDetail } from './components/overlays/chip/chip-group.class.js';
export { LyraModelSettingsPanel } from './components/conversation/model-settings-panel/model-settings-panel.class.js';
export type {
  ModelSettingsPanelLayout,
  ModelSettingsChangeDetail,
} from './components/conversation/model-settings-panel/model-settings-panel.class.js';
export { LyraContextMeter } from './components/data/context-meter/context-meter.class.js';
export type {
  ContextMeterShape,
  ContextMeterTone,
  ContextMeterSegment,
} from './components/data/context-meter/context-meter.class.js';
export { LyraControlGroup } from './components/layout/control-group/control-group.class.js';
export { LyraDockPanel } from './components/layout/dock-panel/dock-panel.class.js';
export type {
  LyraDockPanelCollapseChangeDetail,
  LyraDockPanelEdge,
  LyraDockPanelEventMap,
  LyraDockPanelResizeDetail,
} from './components/layout/dock-panel/dock-panel.class.js';
export { resolveCssLength } from './utilities/css-length.js';
export type { ResolveCssLengthOptions } from './utilities/css-length.js';
export { LyraDocumentPreview } from './components/viewers/document-preview/document-preview.class.js';
export type { DocumentPreviewStatus } from './components/viewers/document-preview/document-preview.class.js';
export { LyraDocumentViewer } from './components/viewers/document-viewer/document-viewer.class.js';
export {
  adaptDocumentRenderer,
  createDocumentRendererAdapter,
  createDocumentRendererRegistry,
  registerDocumentRenderer,
  getDefaultDocumentRendererRegistry,
  findDocumentRenderer,
  loadDocumentRenderer,
  snapshotLyraDocumentRendererPayload,
} from './components/viewers/document-viewer/registry.js';
export type { DocumentViewerCloseReason } from './components/viewers/document-viewer/document-viewer.class.js';
export type {
  DirectDocumentRendererDefinition,
  DocumentFile,
  DocumentRendererDefinition,
  DocumentRendererRegistry,
  LazyDocumentRendererDefinition,
  LyraAdaptedDocumentRenderer,
  LyraAdaptedDocumentRendererDefinition,
  LyraAvDocumentRendererPayload,
  LyraDocumentFile,
  LyraDocumentRendererAdapter,
  LyraDocumentRendererAdapterDefinition,
  LyraDocumentRendererDefinition,
  LyraDocumentRendererPayload,
  LyraDocumentRendererPayloadFor,
  LyraDocumentRendererPayloadKind,
  LyraGenericDocumentRendererPayload,
  LyraResolvedDocumentRendererDefinition,
} from './components/viewers/document-viewer/registry.js';
export { LyraEbookViewer } from './components/viewers/ebook-viewer/ebook-viewer.class.js';
export type {
  EbookTocItem,
  LyraEbookViewerEventMap,
} from './components/viewers/ebook-viewer/ebook-viewer.class.js';
export { LyraPptxViewer } from './components/viewers/pptx-viewer/pptx-viewer.class.js';
export type {
  LyraPptxViewerEventMap,
  LyraViewerDiagnostic,
  LyraViewerDiagnosticCode,
  LyraViewerDiagnosticEventDetail,
  LyraViewerDiagnosticSeverity,
} from './components/viewers/pptx-viewer/pptx-viewer.class.js';
export { LyraFileIcon } from './components/media/file-icon/file-icon.class.js';
export {
  createFileTypeMetadataRegistry,
  defaultFileTypeMetadataRegistry,
  getFileTypeMetadata,
} from './components/media/file-icon/file-type-metadata.js';
export type { LyraFileIconMode } from './components/media/file-icon/file-icon.class.js';
export type {
  LyraFileTypeIcon,
  LyraFileTypeCategory,
  LyraFileTypeMetadata,
  LyraFileTypeMetadataEntry,
  LyraFileTypeMetadataRegistry,
  LyraResolvedFileTypeMetadata,
} from './components/media/file-icon/file-type-metadata.js';
export { LyraSvgViewer } from './components/viewers/svg-viewer/svg-viewer.class.js';
export { LyraHtmlViewer } from './components/viewers/html-viewer/html-viewer.class.js';
export { LyraDatasetViewer } from './components/viewers/dataset-viewer/dataset-viewer.class.js';
export type { DatasetTable } from './components/viewers/dataset-viewer/dataset-viewer.class.js';
export { LyraContactViewer } from './components/viewers/contact-viewer/contact-viewer.class.js';
export type {
  VCardAddress,
  VCardContact,
  VCardName,
  VCardTypedValue,
} from './components/viewers/contact-viewer/vcard.js';
export { LyraMediaCard } from './components/media/media-card/media-card.class.js';
export type {
  LyraMediaCardKind,
  LyraMediaCardOpenDetail,
} from './components/media/media-card/media-card.class.js';
export { LyraAttachmentTrigger } from './components/media/attachment-trigger/attachment-trigger.class.js';
export type {
  LyraAttachmentCapability,
  LyraAttachmentFilesDetail,
  LyraFileBackedCapability,
} from './components/media/attachment-trigger/attachment-trigger.class.js';
export {
  LyraKbd,
  shortcutTokenLabel,
  parseShortcut,
} from './components/overlays/kbd/kbd.class.js';
export type {
  EffectiveKbdPlatform,
  KbdKeyLabel,
  KbdLocalize,
  KbdPlatform,
} from './components/overlays/kbd/kbd.class.js';
export { LyraResultCard } from './components/agent-tools/result-card/result-card.class.js';
export type { ResultCardAppearance } from './components/agent-tools/result-card/result-card.class.js';
export { LyraResultField } from './components/agent-tools/result-card/result-field.class.js';
export { groupByRecency } from './internal/group-by-recency.js';
export type {
  RecencyLabels,
  GroupByRecencyOptions,
  RecencyBucket,
} from './internal/group-by-recency.js';
export { LyraAvatar } from './components/media/avatar/avatar.class.js';
export type {
  LyraAvatarErrorDetail,
  LyraAvatarLoading,
  LyraAvatarShape,
  LyraAvatarEventMap,
} from './components/media/avatar/avatar.class.js';
export { LyraCard } from './components/layout/card/card.class.js';
export { LyraCarousel } from './components/layout/carousel/carousel.class.js';
export type {
  LyraCarouselEventMap,
  LyraCarouselOrientation,
} from './components/layout/carousel/carousel.class.js';
export { LyraCarouselItem } from './components/layout/carousel/carousel-item.class.js';
export { LyraButtonGroup } from './components/layout/button-group/button-group.class.js';
export { LyraImageComparer } from './components/media/image-comparer/image-comparer.class.js';
export type {
  LyraImageComparerEventMap,
  LyraImageComparerOrientation,
} from './components/media/image-comparer/image-comparer.class.js';
export { LyraPanZoom } from './components/media/pan-zoom/pan-zoom.class.js';
export type { LyraPanZoomEventMap } from './components/media/pan-zoom/pan-zoom.class.js';
export { LyraZoomableFrame } from './components/media/zoomable-frame/zoomable-frame.class.js';
export type {
  LyraZoomableFrameEventMap,
  LyraZoomableFrameLoading,
} from './components/media/zoomable-frame/zoomable-frame.class.js';
export { LyraScroller } from './components/layout/scroller/scroller.class.js';
export type { LyraScrollerEventMap } from './components/layout/scroller/scroller.class.js';
export { LyraResizeObserver } from './components/utility/resize-observer/resize-observer.class.js';
export type {
  ResizeObserverBox,
  LyraResizeObserverEventMap,
} from './components/utility/resize-observer/resize-observer.class.js';
export { LyraIntersectionObserver } from './components/utility/intersection-observer/intersection-observer.class.js';
export type { LyraIntersectionObserverEventMap } from './components/utility/intersection-observer/intersection-observer.class.js';
export { LyraMutationObserver } from './components/utility/mutation-observer/mutation-observer.class.js';
export type { LyraMutationObserverEventMap } from './components/utility/mutation-observer/mutation-observer.class.js';
export type {
  LyraCardEventMap,
} from './components/layout/card/card.class.js';
export { LyraStepper } from './components/layout/stepper/stepper.class.js';
export type {
  LyraStepItem,
  LyraStepperOrientationChangeDetail,
  LyraStepState,
} from './components/layout/stepper/stepper.class.js';
export { LyraSegmented } from './components/layout/segmented/segmented.class.js';
export type { LyraSegmentedItem } from './components/layout/segmented/segmented.class.js';
export { LyraSwatchPicker } from './components/forms/swatch-picker/swatch-picker.class.js';
export type {
  LyraSwatchPickerMode,
  SwatchPickerItem,
  SwatchOption,
} from './components/forms/swatch-picker/swatch-picker.class.js';
export {
  DEFAULT_GEMSTONE,
  GEMSTONE_KEYS,
  GEMSTONES,
  gemstoneGlyph,
} from './theme/gemstones.js';
export type { GemstoneAccent, GemstoneKey } from './theme/gemstones.js';
export { LyraDiffView } from './components/utility/diff-view/diff-view.class.js';
export { computeLineDiff } from './components/utility/diff-view/diff-line-diff.js';
export type { LyraDiffOp } from './components/utility/diff-view/diff-line-diff.js';
export { LyraPollStatus } from './components/utility/poll-status/poll-status.class.js';
export { LyraCodeBlockCore } from './components/conversation/code-block/code-block-core.class.js';
export { LyraTextarea } from './components/forms/textarea/textarea.class.js';
export type {
  TextareaResize,
  TextareaWrap,
  TextareaSelectionDirection,
  TextareaScrollPosition,
} from './components/forms/textarea/textarea.class.js';

export { LyraButton } from './components/forms/button/button.class.js';
export type {
  ButtonVariant,
  ButtonAppearance,
  ButtonType,
  ButtonFormEnctype,
  ButtonFormMethod,
  LyraButtonEventMap,
} from './components/forms/button/button.class.js';

export { LyraInput } from './components/forms/input/input.class.js';
export type { LyraInputType } from './components/forms/input/input.class.js';
export { LyraNativeTimeInput } from './components/forms/input/native-time-input.class.js';
export { LyraNumberInput } from './components/forms/input/number-input.class.js';
export { LyraTimeInput } from './components/forms/input/time-input.class.js';
export type {
  LyraTimeInputHourFormat,
  LyraTimeInputPlacement,
  LyraTimeInputStep,
} from './components/forms/input/time-input.class.js';
export { LyraRadio } from './components/forms/radio/radio.class.js';
export { LyraRadioButton } from './components/forms/radio/radio-button.class.js';
export type { RadioAppearance } from './components/forms/radio/radio.class.js';
export { LyraOtpInput } from './components/forms/otp-input/otp-input.class.js';
export type {
  OtpInputType,
  OtpInputCase,
  OtpInputAppearance,
  OtpInputSelectionDirection,
} from './components/forms/otp-input/otp-input.class.js';
export type { LyraOtpInputEventMap } from './components/forms/otp-input/otp-input.class.js';
export { LyraRadioGroup } from './components/forms/radio/radio-group.class.js';
export type { RadioGroupOrientation } from './components/forms/radio/radio-group.class.js';
export { LyraSpinner } from './components/overlays/spinner/spinner.class.js';
export type { LyraSpinnerLabelPlacement } from './components/overlays/spinner/spinner.class.js';
export { LyraProgressBar } from './components/overlays/progress/progress-bar.class.js';
export type { LyraProgressVariant } from './components/overlays/progress/progress-bar.class.js';
export { LyraProgressRing } from './components/overlays/progress/progress-ring.class.js';
export { LyraBadge } from './components/overlays/badge/badge.class.js';
export type {
  BadgeVariant,
  BadgeSize,
  BadgeAppearance,
  BadgeAttention,
} from './components/overlays/badge/badge.class.js';
export { LyraTag } from './components/overlays/badge/tag.class.js';
export type {
  LyraTagEventMap,
  TagVariant,
} from './components/overlays/badge/tag.class.js';
export { LyraAlert } from './components/overlays/alert/alert.class.js';
export type {
  AlertCountdown,
  AlertVariant,
  LyraAlertEventMap,
} from './components/overlays/alert/alert.class.js';
export { LyraCallout } from './components/overlays/callout/callout.class.js';
export type {
  CalloutAppearance,
  CalloutSize,
  CalloutVariant,
  LyraCalloutEventMap,
} from './components/overlays/callout/callout.class.js';
export { LyraDetails } from './components/layout/details/details.class.js';
export type {
  LyraDetailsAppearance,
  LyraDetailsEventMap,
  LyraDetailsIconPlacement,
  LyraDetailsSize,
  LyraDetailsToggleDetail,
  LyraDetailsToggleSource,
} from './components/layout/details/details.class.js';
export { LyraAccordion } from './components/layout/details/accordion.class.js';
export type {
  LyraAccordionEventDetail,
  LyraAccordionEventMap,
  LyraAccordionMode,
} from './components/layout/details/accordion.class.js';
export { LyraAccordionItem } from './components/layout/details/accordion-item.class.js';
export type {
  LyraAccordionAppearance,
  LyraAccordionHeadingLevel,
  LyraAccordionIconPlacement,
} from './components/layout/details/accordion-item.class.js';
export { LyraDivider } from './components/utility/divider/divider.class.js';
export { LyraVisuallyHidden } from './components/utility/visually-hidden/visually-hidden.class.js';
export type { LyraDividerOrientation } from './components/utility/divider/divider.class.js';
export { LyraBreadcrumb } from './components/layout/breadcrumb/breadcrumb.class.js';
export { LyraBreadcrumbItem } from './components/layout/breadcrumb/breadcrumb-item.class.js';
export type { LyraBreadcrumbItemTarget } from './components/layout/breadcrumb/breadcrumb-item.class.js';
export { LyraFormatNumber } from './components/utility/format/format-number.class.js';
export { LyraFormatDate } from './components/utility/format/format-date.class.js';
export { LyraFormatBytes } from './components/utility/format/format-bytes.class.js';
export type {
  LyraFormatBytesUnit,
  LyraFormatDisplay,
} from './components/utility/format/format-bytes.class.js';
export { LyraRelativeTime } from './components/utility/format/relative-time.class.js';
export type { LyraRelativeTimeUnit } from './components/utility/format/relative-time.class.js';
export { LyraRating } from './components/overlays/rating/rating.class.js';
export type {
  LyraRatingEventMap,
  LyraRatingHoverPhase,
  LyraRatingSize,
  LyraRatingSymbolRenderer,
} from './components/overlays/rating/rating.class.js';
export { LyraColorPicker } from './components/forms/color-picker/color-picker.class.js';
export type {
  LyraColorPickerEventMap,
  LyraColorPickerSwatch,
  LyraColorPickerFormat,
  LyraColorPickerOutputFormat,
  LyraColorHsva,
} from './components/forms/color-picker/color-picker.class.js';
export { LyraCheckboxGroup } from './components/forms/checkbox-group/checkbox-group.class.js';
export type {
  CheckboxGroupOrientation,
  LyraCheckboxGroupEventMap,
} from './components/forms/checkbox-group/checkbox-group.class.js';
export { LyraTokenInput } from './components/forms/token-input/token-input.class.js';
export type {
  LyraTokenInputEventMap,
} from './components/forms/token-input/token-input.class.js';
export { LyraIcon } from './components/utility/icon/icon.class.js';
export {
  registerIconLibrary,
  unregisterIconLibrary,
  getIconLibrary,
} from './components/utility/icon/icon-library.js';
export type {
  LyraIconAnimation,
  LyraIconCanvas,
  LyraIconFlip,
  LyraIconEventMap,
} from './components/utility/icon/icon.class.js';
export type {
  LyraIconLibrary,
  LyraIconLibraryOptions,
  LyraIconLibraryResolver,
  LyraIconLibraryMutator,
} from './components/utility/icon/icon-library.js';
export { LyraIconButton } from './components/forms/icon-button/icon-button.class.js';
export type { LyraIconButtonEventMap } from './components/forms/icon-button/icon-button.class.js';
export { LyraCommandPalette } from './components/layout/command-palette/command-palette.class.js';
export type {
  LyraCommand,
  LyraCommandPaletteEventMap,
} from './components/layout/command-palette/command-palette.class.js';
export { LyraCodeEditor } from './components/forms/code-editor/code-editor.class.js';
export type {
  LyraCodeEditorEventMap,
  LyraCodeEditorResize,
  LyraCodeEditorWrap,
} from './components/forms/code-editor/code-editor.class.js';
export { LyraCalendar } from './components/data/calendar/calendar.class.js';
export type {
  CalendarEvent,
  CalendarView,
  LyraCalendarEventMap,
} from './components/data/calendar/calendar.class.js';

export type { LyraAppRailEventMap } from './components/layout/app-rail/app-rail.class.js';
export type { LyraAttachmentChipEventMap } from './components/media/attachment-chip/attachment-chip.class.js';
export type { LyraAttachmentTriggerEventMap } from './components/media/attachment-trigger/attachment-trigger.class.js';
export type { LyraChartEventMap } from './components/charts/chart/chart.class.js';
export type { LyraChatComposerEventMap } from './components/conversation/chat-composer/chat-composer.class.js';
export type { LyraChatMessageEventMap } from './components/conversation/chat-message/chat-message.class.js';
export type { LyraCheckboxEventMap } from './components/forms/checkbox/checkbox.class.js';
export type { LyraChipEventMap } from './components/overlays/chip/chip.class.js';
export type { LyraChipGroupEventMap } from './components/overlays/chip/chip-group.class.js';
export type { LyraCitationBadgeEventMap } from './components/retrieval/citation-badge/citation-badge.class.js';
export type { LyraCodeBlockEventMap } from './components/conversation/code-block/code-block.class.js';
export type { LyraCodeBlockCoreEventMap } from './components/conversation/code-block/code-block-core.class.js';
export type { LyraComboboxEventMap } from './components/forms/combobox/combobox.class.js';
export type { LyraOptionEventMap } from './components/forms/combobox/option.class.js';
export type { LyraConversationItemEventMap } from './components/conversation/conversation-item/conversation-item.class.js';
export type {
  LyraCopyButtonEventMap,
  LyraCopyErrorReason,
  LyraCopyButtonTooltip,
  LyraCopyButtonTooltipPlacement,
} from './components/utility/copy-button/copy-button.class.js';
export type {
  LyraClipboardWriteFailure,
  LyraClipboardWriteOutcome,
  LyraClipboardWriteSuccess,
} from './internal/clipboard.js';
export type { LyraDateInputEventMap } from './components/forms/date-picker/date-input.class.js';
export type { LyraDatePickerEventMap } from './components/forms/date-picker/date-picker.class.js';
export type { LyraDialogEventMap } from './components/overlays/dialog/dialog.class.js';
export type {
  LyraDiffViewEventMap,
  LyraDiffViewLayout,
} from './components/utility/diff-view/diff-view.class.js';
export type { LyraDocumentPreviewEventMap } from './components/viewers/document-preview/document-preview.class.js';
export type { LyraDocumentViewerEventMap } from './components/viewers/document-viewer/document-viewer.class.js';
export type {
  AnchorResultDetail,
  AnchorTargetCapabilities,
  HighlightActivateDetail,
  LyraAnchor,
  LyraAnchorKind,
  LyraHighlight,
  LyraHighlightTone,
  TextSelectDetail,
  TextSelectRect,
} from './components/viewers/document-viewer/anchors.js';
export type { LyraSvgViewerEventMap } from './components/viewers/svg-viewer/svg-viewer.class.js';
export type { LyraHtmlViewerEventMap } from './components/viewers/html-viewer/html-viewer.class.js';
export type { LyraDatasetViewerEventMap } from './components/viewers/dataset-viewer/dataset-viewer.class.js';
export type { LyraContactViewerEventMap } from './components/viewers/contact-viewer/contact-viewer.class.js';
export * from './components/viewers/pdf-viewer/pdf-viewer.class.js';
export * from './components/media/image-viewer/image-viewer.class.js';
export * from './components/media/av-player/av-player.class.js';
export { LyraVideo } from './components/media/video/video.class.js';
export type {
  LyraVideoControls,
  LyraVideoEventMap,
  LyraVideoPreload,
  VideoState,
} from './components/media/video/video.class.js';
export { LyraVideoPlaylist } from './components/media/video-playlist/video-playlist.class.js';
export type {
  LyraVideoPlaylistChangeDetail,
  LyraVideoPlaylistEventMap,
  LyraVideoPlaylistItem,
  LyraVideoPlaylistRepeat,
  LyraVideoPlaylistSource,
  LyraVideoPlaylistTrack,
  LyraVideoPlaylistVideo,
} from './components/media/video-playlist/video-playlist.class.js';
export * from './components/agent-tools/artifact-panel/artifact-panel.class.js';
export * from './components/agent-tools/browser-frame/browser-frame.class.js';
export * from './components/conversation/chat-viewport/chat-viewport.class.js';
export * from './components/conversation/checkpoint/checkpoint.class.js';
export * from './components/agent-tools/confirm-bar/confirm-bar.class.js';
export * from './components/viewers/notebook-viewer/notebook-viewer.class.js';
export * from './components/conversation/suggestion-chips/suggestion-chips.class.js';
export { LyraThreadList } from './components/conversation/thread-list/thread-list.class.js';
export type {
  LyraChatThread,
  LyraThreadListEventMap,
  ThreadBucketKey,
  ThreadGroupContext,
  ThreadListGrouping,
  ThreadRowAction,
} from './components/conversation/thread-list/thread-list.class.js';
export * from './components/conversation/usage-badge/usage-badge.class.js';
export * from './components/conversation/voice-picker/voice-picker.class.js';
export { LyraWidgetRenderer } from './components/conversation/widget-renderer/widget-renderer.class.js';
export type { LyraWidgetRendererEventMap } from './components/conversation/widget-renderer/widget-renderer.class.js';
export { createWidgetDocument } from './components/conversation/widget-renderer/resolve.js';
export type {
  LyraWidgetBinding,
  LyraWidgetDocument,
  LyraWidgetNode,
} from './components/conversation/widget-renderer/resolve.js';
export {
  createWidgetTypeRegistry,
  isWidgetTypeRegistry,
} from './components/conversation/widget-renderer/registry.js';
export type {
  LyraWidgetInteraction,
  LyraWidgetPropType,
  LyraWidgetTypeDefinition,
  LyraWidgetTypeRegistry,
} from './components/conversation/widget-renderer/registry.js';
export { DEFAULT_WIDGET_TYPE_REGISTRY } from './components/conversation/widget-renderer/default-registry.js';
export * from './components/data/flow-canvas/flow-canvas.class.js';
export * from './components/data/flow-node/flow-node.class.js';
export * from './components/data/flow-minimap/flow-minimap.class.js';
export * from './components/data/flow-controls/flow-controls.class.js';
export * from './components/retrieval/node-palette/node-palette.class.js';
export * from './components/data/flow-run-status/flow-run-status.class.js';
export * from './components/retrieval/graph-legend/graph-legend.class.js';
export * from './components/retrieval/entity-card/entity-card.class.js';
export * from './components/retrieval/entity-chip/entity-chip.class.js';
export * from './components/retrieval/neighbor-list/neighbor-list.class.js';
export * from './components/retrieval/path-strip/path-strip.class.js';
export * from './components/retrieval/community-card/community-card.class.js';
export * from './components/retrieval/chunk-inspector/chunk-inspector.class.js';
export * from './components/retrieval/source-picker/source-picker.class.js';
export * from './components/retrieval/provenance-panel/provenance-panel.class.js';
export * from './components/retrieval/mind-map/mind-map.class.js';
export * from './components/agent-tools/agent-run/agent-run.class.js';
export * from './components/agent-tools/agent-eval-dashboard/agent-eval-dashboard.class.js';
export * from './components/agent-tools/mcp-app/mcp-app.class.js';
export * from './components/agent-tools/approval-queue/approval-queue.class.js';
export * from './components/conversation/agent-workspace/agent-workspace.class.js';
export * from './components/agent-tools/agent-trace/agent-trace.class.js';
export * from './components/agent-tools/context-inspector/context-inspector.class.js';
export { LyraDashboardGrid } from './components/layout/dashboard-grid/dashboard-grid.class.js';
export type {
  LyraDashboardCellMoveDetail,
  LyraDashboardCellResizeDetail,
  LyraDashboardCollisionDetail,
  LyraDashboardLayoutChangeDetail,
  LyraDashboardGridEventMap,
} from './components/layout/dashboard-grid/dashboard-grid.class.js';
export { resolveLyraDashboardPlacement } from './components/layout/dashboard-grid/layout.js';
export type {
  LyraDashboardCell,
  LyraDashboardCollisionPolicy,
  LyraDashboardPlacementResult,
} from './components/layout/dashboard-grid/layout.js';
export * from './components/viewers/document-compare/document-compare.class.js';
export * from './components/data/document-library/document-library.class.js';
export * from './components/layout/drilldown-panel/drilldown-panel.class.js';
export * from './components/retrieval/entity-dossier/entity-dossier.class.js';
export * from './components/agent-tools/eval-dataset/eval-dataset.class.js';
export * from './components/agent-tools/eval-result/eval-result.class.js';
export * from './components/agent-tools/evaluation-run/evaluation-run.class.js';
export * from './components/layout/filter-bar/filter-bar.class.js';
export * from './components/data/graph-query-builder/graph-query-builder.class.js';
export * from './components/retrieval/grounding-summary/grounding-summary.class.js';
export * from './components/retrieval/claim-evidence/claim-evidence.class.js';
export * from './components/retrieval/ingestion-queue/ingestion-queue.class.js';
export * from './components/retrieval/knowledge-base/knowledge-base.class.js';
export * from './components/retrieval/knowledge-base-admin/knowledge-base-admin.class.js';
export * from './components/retrieval/rag-answer/rag-answer.class.js';
export { LyraRagEvalDashboard } from './components/retrieval/rag-eval-dashboard/rag-eval-dashboard.class.js';
export type {
  LyraRagEvalDashboardEventMap,
  LyraRagEvaluationMetric,
  LyraRagEvaluationMetricCategory,
  LyraRagEvaluationMetricFormat,
  LyraRagEvaluationRun,
} from './components/retrieval/rag-eval-dashboard/rag-eval-dashboard.class.js';
export * from './components/retrieval/embedding-explorer/embedding-explorer.class.js';
export * from './components/retrieval/knowledge-graph-explorer/knowledge-graph-explorer.class.js';
export * from './components/retrieval/memory-panel/memory-panel.class.js';
export * from './components/agent-tools/policy-summary/policy-summary.class.js';
export * from './components/data/condition-builder/condition-builder.class.js';
export * from './components/retrieval/retrieval-results/retrieval-results.class.js';
export { LyraRetrievalCompare } from './components/retrieval/retrieval-compare/retrieval-compare.class.js';
export type {
  LyraRetrievalCompareEventMap,
  RetrievalComparisonSet,
} from './components/retrieval/retrieval-compare/retrieval-compare.class.js';
export * from './components/retrieval/retrieval-search/retrieval-search.class.js';
export * from './components/retrieval/retrieval-trace/retrieval-trace.class.js';
export * from './components/agent-tools/tool-timeline/tool-timeline.class.js';
export * from './components/conversation/realtime-session/realtime-session.class.js';
export * from './components/agent-tools/prompt-studio/prompt-studio.class.js';
export * from './components/agent-tools/schema-viewer/schema-viewer.class.js';
export * from './components/agent-tools/subagent-panel/subagent-panel.class.js';
export * from './components/viewers/spreadsheet-viewer/spreadsheet-viewer.class.js';
export * from './components/viewers/spreadsheet-viewer/spreadsheet-loader.js';
export * from './components/viewers/csv-viewer/csv-viewer.class.js';
export * from './components/viewers/xml-viewer/xml-viewer.class.js';
export * from './components/viewers/docx-viewer/docx-viewer.class.js';
export * from './components/viewers/docx-viewer/docx-loader.js';
export * from './components/viewers/email-viewer/email-viewer.class.js';
export * from './components/viewers/email-viewer/email-loader.js';
export * from './components/viewers/calendar-viewer/calendar-viewer.class.js';
export * from './components/viewers/calendar-viewer/calendar-loader.js';
export * from './components/viewers/archive-viewer/archive-viewer.class.js';
export type { LyraExportButtonEventMap } from './components/utility/export-button/export-button.class.js';
export type { LyraFileInputEventMap } from './components/media/file-input/file-input.class.js';
export type { LyraGraphEventMap } from './components/retrieval/graph/graph.class.js';
export type { LyraHeatmapEventMap } from './components/data/heatmap/heatmap.class.js';
export type { LyraInputEventMap } from './components/forms/input/input.class.js';
export type { LyraNumberInputEventMap } from './components/forms/input/number-input.class.js';
export type { LyraTimeInputEventMap } from './components/forms/input/time-input.class.js';
export type { LyraRadioEventMap } from './components/forms/radio/radio.class.js';
export type { LyraRadioGroupEventMap } from './components/forms/radio/radio-group.class.js';
export type { LyraJsonViewerEventMap } from './components/utility/json-viewer/json-viewer.class.js';
export type { LyraLiteChartEventMap } from './components/charts/chart/lite-chart.class.js';
export type { LyraMapEventMap } from './components/media/map/map.class.js';
export { LyraGeoJsonViewer } from './components/viewers/geojson-view/geojson-viewer.class.js';
export type {
  GeoJsonTypeTag,
  LyraGeoJsonViewerEventMap,
} from './components/viewers/geojson-view/geojson-viewer.class.js';
export { LyraGeojsonView } from './components/viewers/geojson-view/geojson-view.class.js';
export type { LyraGeojsonViewEventMap } from './components/viewers/geojson-view/geojson-view.class.js';
export type { LyraMarkdownEventMap } from './components/conversation/markdown/markdown.class.js';
export type { LyraMarkdownCoreEventMap } from './components/conversation/markdown/markdown-core.class.js';
export type {
  Marked,
  MarkdownHeadingItem,
} from './components/conversation/markdown/markdown.class.js';
export type { LyraMarkedParser } from './components/conversation/markdown/markdown-loader.js';
export type { KatexApi } from './components/conversation/markdown/katex-loader.js';
export type {
  MarkdownHighlightAttempt,
  MarkdownRuntimeEventMap,
  MarkdownVariantContext,
} from './components/conversation/markdown/markdown-base.class.js';
export type {
  MarkdownKatexState,
  PendingHighlight,
} from './components/conversation/markdown/markdown-shared.js';
export type { ShikiLanguageInput } from './components/conversation/code-block/shiki-types.js';
export type { LyraMediaCardEventMap } from './components/media/media-card/media-card.class.js';
export type { LyraMentionPopoverEventMap } from './components/utility/mention-popover/mention-popover.class.js';
export type { LyraMenuItemEventMap } from './components/layout/menu/menu-item.class.js';
export type { LyraMenuEventMap } from './components/layout/menu/menu.class.js';
export type { LyraModelSelectEventMap } from './components/conversation/model-select/model-select.class.js';
export type { LyraModelSettingsPanelEventMap } from './components/conversation/model-settings-panel/model-settings-panel.class.js';
export type {
  LyraSequencePlaybackEventMap,
  LyraSequencePlaybackStepDetail,
} from './components/media/sequence-playback/sequence-playback.class.js';
export type { LyraPaginationEventMap } from './components/data/pagination/pagination.class.js';
export type { LyraPollStatusEventMap } from './components/utility/poll-status/poll-status.class.js';
export type { LyraPhoneInputEventMap } from './components/forms/phone-input/phone-input.class.js';
export type { LyraReorderItemEventMap } from './components/layout/reorder-list/reorder-item.class.js';
export type {
  LyraReorderDetail,
  LyraReorderListEventMap,
} from './components/layout/reorder-list/reorder-list.class.js';
export type { LyraResponsivePanelEventMap } from './components/layout/responsive-panel/responsive-panel.class.js';
export type { LyraSegmentedEventMap } from './components/layout/segmented/segmented.class.js';
export type { LyraSwatchPickerEventMap } from './components/forms/swatch-picker/swatch-picker.class.js';
export type { LyraSelectEventMap } from './components/forms/select/select.class.js';
export type {
  LyraSliderChangeDetail,
  LyraSliderEventMap,
  SliderHandle,
  SliderOrientation,
  SliderTooltipPlacement,
  SliderValueFormatter,
} from './components/forms/slider/slider.class.js';
export type { LyraSourceCardEventMap } from './components/retrieval/source-card/source-card.class.js';
export type { LyraSourceListEventMap } from './components/retrieval/source-list/source-list.class.js';
export type { LyraStepperEventMap } from './components/layout/stepper/stepper.class.js';
export type { LyraStreamStatusEventMap } from './components/conversation/stream-status/stream-status.class.js';
export type { LyraSwitchEventMap } from './components/forms/switch/switch.class.js';
export type { LyraTableEventMap } from './components/data/table/table.class.js';
export type { LyraTabGroupEventMap } from './components/layout/tab-group/tab-group.class.js';
export type { LyraTextareaEventMap } from './components/forms/textarea/textarea.class.js';
export type { LyraThinkingPanelEventMap } from './components/agent-tools/thinking-panel/thinking-panel.class.js';
export type { LyraTimeRangeEventMap } from './components/forms/time-range/time-range.class.js';
export type { LyraToastItemEventMap } from './components/overlays/toast/toast-item.class.js';
export type { LyraToolApprovalDialogEventMap } from './components/agent-tools/tool-approval-dialog/tool-approval-dialog.class.js';
export type { LyraToolParamFormEventMap } from './components/agent-tools/tool-param-form/tool-param-form.class.js';
export type { LyraToolResultViewEventMap } from './components/agent-tools/tool-result-view/tool-result-view.class.js';
export type { LyraToolSelectDialogEventMap } from './components/agent-tools/tool-select-dialog/tool-select-dialog.class.js';
export type { LyraTreeItemEventMap } from './components/data/tree/tree-item.class.js';
export type { LyraVirtualListEventMap } from './components/layout/virtual-list/virtual-list.class.js';
export type { LyraWidgetEventMap } from './components/layout/widget/widget.class.js';
export type { LyraWordCloudEventMap } from './components/data/word-cloud/word-cloud.class.js';

export { LyraElement } from './internal/lyra-element.js';
export { FormAssociated } from './internal/form-associated.js';
export { LYRA_PREFIX, tag, defineElement } from './internal/prefix.js';
export type {
  LyraAnchorTarget,
  LyraAnchorTargetEventMap,
} from './utilities/anchor-target.js';

// Public support types reached by component class signatures. Keep this list type-only: these
// modules contain implementation helpers, while the contracts themselves are semver-covered by
// the registration-free root. `check:event-barrel` derives this closure from the source graph and
// fails if a newly exposed support type is not reachable here.
export type { AnsiStyles } from './internal/ansi.js';
export type { BreakpointBasis } from './internal/orientation-breakpoint.js';
export type {
  FormOwnerValue,
  FormSubmissionValue,
  FormValueAdapter,
} from './internal/form-associated.js';
export type {
  LyraAppearance,
  LyraFrame,
  LyraSize,
  LyraSizeAlias,
  LyraSizeStep,
  LyraVariant,
} from './internal/variants.js';
export type {
  LyraEmitArgs,
  LyraEmittedEvent,
} from './internal/lyra-element.js';
export type {
  LyraSelectionDirection,
  LyraOrientation,
  LyraTextWrap,
  LyraToolStatus,
  LyraTranscriptMode,
} from './internal/shared-unions.js';
export type {
  LyraSearchChangeDetail,
  LyraTextViewerTarget,
  LyraTextViewerTargetEventMap,
} from './internal/text-viewer-target.js';
export type { LyraViewerSource } from './components/viewers/viewer-source.js';
export type { OverlayDeactivateOptions } from './internal/overlay-manager.js';
export type { RegisteredAnimationSpec } from './internal/registered-animation.js';
export type { LyraHeadingLevel } from './internal/heading-level.js';
export type {
  CalendarMode,
  WeekdayFormat,
} from './components/forms/date-picker/calendar-core.js';
export type { TimeHourFormat } from './components/forms/input/time-input-shared.js';
export type {
  LyraFormatCurrencyDisplay,
  LyraFormatDateHour,
  LyraFormatDateMonth,
  LyraFormatDateNumeric,
  LyraFormatDateStyle,
  LyraFormatDateText,
  LyraFormatDateTimeZoneName,
  LyraFormatNumberNotation,
  LyraFormatNumberType,
  LyraRelativeTimeNumeric,
} from './components/utility/format/format-options.js';
export type {
  LyraSpanKind,
  LyraSpanStatus,
} from './components/agent-tools/trace-tree/span.js';
export type {
  MarkedExtension,
  MarkedParserContext,
  MarkedRenderer,
} from './components/conversation/markdown/markdown-loader.js';

export type * from './ai/types.js';

// Global typed-event surface (generated; see scripts/generate-event-types.mjs). Type-only, so it
// adds zero runtime bytes to the barrel -- but it pulls the `declare global` augmentation into any
// program that imports the package root, which is what types `document.addEventListener('lr-...')`.
export type { LyraGlobalEventMap } from './events.js';
