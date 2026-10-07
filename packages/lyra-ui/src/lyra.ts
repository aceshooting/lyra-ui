// The package root is registration-free: importing it defines no custom element, so a bundler
// can drop every component a consumer never names. `@aceshooting/lyra-ui/all.js` is the explicit
// entry that registers the whole root-included set (the pre-8 side effect of this module).
//
// Component constructors are available from their canonical registration-free `*.class.js`
// subpaths. This curated root contains shared helpers and types without registering custom elements.
export type {
  EnvEntry,
  LyraEnvListEventMap,
} from './components/data/env-list/env-list.class.js';
export type {
  ActivityEntry,
  ActivityFeedMode,
  ActivityFeedToggleDetail,
  ActivityFeedFollowChangeDetail,
  LyraActivityFeedEventMap,
} from './components/agent-tools/activity-feed/activity-feed.class.js';
export type {
  MessageActionControl,
  LyraMessageActionsEventMap,
} from './components/conversation/message-actions/message-actions.class.js';
export { isLyraToolbarActionProvider } from './components/conversation/message-actions/toolbar-actions.js';
export type {
  LyraToolbarAction,
  LyraToolbarActionProvider,
} from './components/conversation/message-actions/toolbar-actions.js';
export type {
  LyraTranscriptEntry,
  LyraTranscriptFeedEventMap,
} from './components/conversation/transcript-feed/transcript-feed.class.js';
export type {
  AudioVisualizerMode,
  AudioVisualizerState,
} from './components/conversation/audio-visualizer/audio-visualizer.class.js';
export type { LyraBranchPickerEventMap } from './components/conversation/branch-picker/branch-picker.class.js';
export type {
  CompareVote,
  LyraComparePanelEventMap,
} from './components/agent-tools/compare-panel/compare-panel.class.js';
export type {
  HighlightLayerItem,
  LyraHighlightLayerEventMap,
} from './components/viewers/highlight-layer/highlight-layer.class.js';
export type {
  MessageFeedbackDetailConfiguration,
  MessageFeedbackDetailFor,
  MessageFeedbackReason,
  MessageFeedbackRating,
  MessageFeedbackSubmitDetail,
  MessageFeedbackValue,
  MessageFeedbackWrap,
  LyraMessageFeedbackEventMap,
} from './components/conversation/message-feedback/message-feedback.class.js';
export type {
  MessagePartRenderer,
  MessagePartsContentMode,
  MessagePartsToolDisplay,
  LyraMessagePartsEventMap,
} from './components/conversation/message-parts/message-parts.class.js';
export type {
  LyraPageRailEventMap,
  LyraPageViewerSnapshot,
  LyraPageViewerStateChangeDetail,
  LyraPageViewerStatus,
  PageThumbnailRenderHandle,
  PageThumbnailSource,
} from './components/viewers/page-rail/page-rail.class.js';
export type {
  PushToTalkMode,
  PushToTalkState,
  PushToTalkAudioConstraints,
  LyraPushToTalkEventMap,
} from './components/conversation/push-to-talk/push-to-talk.class.js';
export type {
  LyraPromptInputAttachment,
  LyraPromptInputEventMap,
  LyraPromptSuggestion,
} from './components/conversation/prompt-input/prompt-input.class.js';
export type {
  PromptQueueItem,
  PromptQueueChangeReason,
  PromptQueueChangeDetail,
  LyraPromptQueueEventMap,
} from './components/conversation/prompt-queue/prompt-queue.class.js';
export type {
  SelectionAction,
  SelectionActionDetail,
  LyraSelectionToolbarEventMap,
} from './components/conversation/selection-toolbar/selection-toolbar.class.js';
export type {
  CategoryRubricKey,
  CommentRubricKey,
  RubricKeyOption,
  RubricKey,
  RubricValue,
  ScoreRubricKey,
  LyraRubricFormEventMap,
} from './components/forms/rubric-form/rubric-form.class.js';
export type {
  LyraSpan,
  LyraSpanWaterfallEventMap,
} from './components/agent-tools/span-waterfall/span-waterfall.class.js';
export type {
  TaskStatus,
  TaskItem,
  TaskListAppearance,
  TaskListToggleDetail,
  LyraTaskListEventMap,
} from './components/agent-tools/task-list/task-list.class.js';
export type { LyraTerminalEventMap } from './components/agent-tools/terminal/terminal.class.js';
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
export type {
  LyraSparklineAppearance,
  LyraSparklineCurve,
  LyraSparklineMark,
  LyraSparklineTrend,
} from './components/data/sparkline/sparkline.class.js';
export type {
  SequenceStripItem,
  SequenceStripCategory,
} from './components/data/sequence-strip/sequence-strip.class.js';
export type {
  EmojiPickerItem,
  EmojiPickerGroup,
  LyraEmojiPickerEventMap,
} from './components/forms/emoji-picker/emoji-picker.class.js';
export type {
  LyraLocaleCatalog,
  LyraLocaleChangeDetail,
  LyraLocaleEntry,
  LyraLocaleOptionDisplay,
  LyraLocalePickerEventMap,
  LyraLocaleTriggerDisplay,
} from './components/forms/locale-picker/locale-picker.class.js';
export type {
  LyraToastIcon,
  LyraToastIconContent,
  LyraToastOptions,
  LyraToastPlacement,
  LyraToastCreateOptions,
  LyraToastOverflowDetail,
  LyraToastEventMap,
} from './components/overlays/toast/toast.class.js';
export type {
  LyraToastVariant,
  LyraToastSize,
} from './components/overlays/toast/toast-item.class.js';
export { toast } from './components/overlays/toast/toaster.js';
export type { ToastHandle } from './components/overlays/toast/toaster.js';
export type { LyraPickerDetailValue, LyraPickerValue } from './internal/picker-value.js';
export type {
  ComboboxSourceResult,
  LyraComboboxChangeEvent,
  LyraComboboxInputEvent,
  LyraComboboxPlacement,
  LyraComboboxSelectionDirection,
  LyraComboboxSourceErrorEvent,
  LyraComboboxTagRenderer,
  OptionFilter,
} from './components/forms/combobox/combobox.class.js';
export type {
  LyraComboboxValidator,
  LyraComboboxValidatorResult,
  LyraComboboxObjectValidator,
  LyraComboboxObjectValidatorResult,
} from './components/forms/combobox/combobox.class.js';

export type {
  LyraSelectChangeEvent,
  LyraSelectInputEvent,
  LyraSelectTagRenderer,
} from './components/forms/select/select.class.js';
export type {
  DateRange,
  LyraDateRangePreset,
  LyraDatePickerDayContent,
  LyraDatePickerDisabledDates,
  LyraDatePickerFirstDayOfWeek,
  LyraDatePickerPageBy,
  LyraDatePickerView,
} from './components/forms/date-picker/date-picker.class.js';
export type {
  LyraDateInputFirstDayOfWeek,
  LyraDateInputObjectValidator,
  LyraDateInputObjectValidatorResult,
  LyraDateInputPlacement,
  LyraDateInputSelectionDirection,
  LyraDateInputValidator,
  LyraDateInputValidatorResult,
} from './components/forms/date-picker/date-input.class.js';
export type { LyraAnimatedImageEventMap } from './components/media/animated-image/animated-image.class.js';
export {
  animations,
  getAnimationNames,
  getEasingNames,
  LYRA_ANIMATION_NAMES,
  LYRA_EASINGS,
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
export { bridgeLyraLocale } from './localization.js';
export { subscribeLyraLocale } from './internal/localization-runtime.js';
export type {
  LyraLocaleBridgeCleanup,
  LyraLocaleBridgeOptions,
} from './localization.js';
export type {
  LyraAvatarGroupOverflowDetail,
  LyraAvatarGroupEventMap,
} from './components/media/avatar-group/avatar-group.class.js';
export type {
  LyraIncludeMode,
  LyraIncludeErrorDetail,
  LyraIncludeErrorReason,
  LyraIncludeEventMap,
} from './components/viewers/include/include.class.js';
export type {
  LyraKnownDateAppearance,
  LyraKnownDateField,
  LyraKnownDateEventDetail,
  LyraKnownDateEventMap,
  LyraKnownDateParts,
} from './components/utility/known-date/known-date.class.js';
export type {
  LyraLightboxImage,
  LyraLightboxCloseReason,
  LyraLightboxHideDetail,
  LyraLightboxEventMap,
  LyraLightboxCloseDetail,
} from './components/media/lightbox/lightbox.class.js';
export type { LyraQrCodeErrorCorrection } from './components/media/qr-code/qr-code.class.js';
export type {
  LyraRandomContentAnimation,
  LyraRandomContentMode,
  LyraRandomContentEventMap,
} from './components/utility/random-content/random-content.class.js';
export type {
  LyraTimelineScale,
  LyraTimelineCollision,
  LyraTimelineClusterActivateDetail,
  LyraTimelineEventMap,
} from './components/data/timeline/timeline.class.js';
export type {
  LyraSequenceStripActivateDetail,
  LyraSequenceStripEventMap,
} from './components/data/sequence-strip/sequence-strip.class.js';
export type {
  LyraTourTarget,
  LyraTourStep,
  LyraTourEndReason,
  LyraTourEventMap,
} from './components/utility/tour/tour.class.js';
export {
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
export type {
  LyraSkeletonShape,
  LyraSkeletonEffect,
} from './components/overlays/skeleton/skeleton.class.js';
export type {
  StatGoodDirection,
  StatRow,
  StatOrientation,
} from './components/data/stat/stat.class.js';
export type {
  TableColumn,
  TableColumnEditOption,
  TableColumnEditTrigger,
  TableEdgeAlign,
  TableExpansionMode,
  TableLoadingAppearance,
  TableScrollMode,
  TableSelectionMode,
  TableSortCommitDetail,
  TableSortDetail,
  TableSortDirection,
  TableSortIndicators,
  TableSortMode,
  TableSortRequestDetail,
} from './components/data/table/table.class.js';
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
export type { GaugeShape, LyraGaugeThreshold } from './components/data/gauge/gauge.class.js';
export type { LyraFunnelStage } from './components/data/funnel/funnel.class.js';
export type {
  LyraExportButtonAppearance,
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
  LyraMultiSplitToggleDetail,
} from './components/layout/multi-split/multi-split.class.js';
export {
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
export type {
  LyraPageEventMap,
  PageNavigationPlacement,
  PageView,
} from './components/layout/page/page.class.js';
export type {
  LyraNavigationMenuEventMap,
  LyraNavigationMenuExpandedChangeDetail,
  LyraNavigationMenuExpandedChangeSource,
  LyraNavigationMenuPanelAnchor,
} from './components/layout/navigation-menu/navigation-menu.class.js';
export type {
  LyraNavigationMenuItemEventMap,
  LyraNavigationMenuToggleDetail,
} from './components/layout/navigation-menu-item/navigation-menu-item.class.js';
export type {
  TimeRangeHandle,
  TimeRangePreset,
  TimeRangeValueFormatter,
} from './components/forms/time-range/time-range.class.js';
export type {
  LyraPaginationFormat,
  LyraPaginationChangeDetail,
} from './components/data/pagination/pagination.class.js';
export type {
  HeatmapData,
  HeatmapMatrixData,
  HeatmapCalendarData,
  HeatmapMode,
  HeatmapScale,
  LyraHeatmapStickyLabels,
  MatrixCellPos,
  CalendarCellPos,
  HeatmapAnnotation,
  HeatmapLegendStop,
  HeatmapSelectedCell,
  HeatmapSelectionChangeDetail,
  HeatmapSelectionSource,
  LyraHeatmapCellClickDetail,
  LyraHeatmapExportFormat,
  LyraHeatmapMatrixGeometryChangeDetail,
  LyraHeatmapCalendarGeometry,
} from './components/data/heatmap/heatmap.class.js';
export {
  linearAlpha,
  sqrtStep,
} from './components/data/heatmap/heatmap-scale.js';
export type {
  LyraTreeNodeData,
  TreeBadge,
  TreeSelection,
  LyraTreeEventMap,
} from './components/data/tree/tree.class.js';
export type {
  FileTreeNode,
  GitStatus,
  LyraFileTreeEventMap,
} from './components/data/file-tree/file-tree.class.js';
export type {
  CommitCardAppearance,
  CommitFileChange,
  LyraCommitCardEventMap,
} from './components/agent-tools/commit-card/commit-card.class.js';
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
  testResultDetailSlotName,
} from './components/agent-tools/test-results/test-results.class.js';
export type {
  TestStatus,
  TestRunState,
  TestCaseResult,
  TestSuiteResult,
  LyraTestResultsEventMap,
} from './components/agent-tools/test-results/test-results.class.js';
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
export type {
  LyraChartAnnotation,
  LyraChartArea,
  LyraChartAxes,
  LyraChartConfiguration,
  LyraChartDataConfiguration,
  LyraChartDatasetConfiguration,
  LyraChartDatumActivateDetail,
  LyraChartDatumKind,
  LyraChartExportFormat,
  LyraChartFormatSurface,
  LyraChartFormatter,
  LyraChartFormatterAxis,
  LyraChartFormatterContext,
  LyraChartGrid,
  LyraChartIndexAxis,
  LyraChartInstance,
  LyraChartLayoutPosition,
  LyraChartLegendDisplay,
  LyraChartLegendMode,
  LyraChartLegendPosition,
  LyraChartPlugin,
  LyraChartPoint,
  LyraChartScaleType,
  LyraChartSeries,
  LyraChartStatistic,
  LyraChartTooltipGroupFormatter,
  LyraChartType,
  LyraChartValueFormatter,
  LyraChartValueFormatterContext,
} from './components/charts/chart/chart.class.js';
export { preloadCharts } from './components/charts/chart/chart-preload.js';
export type {
  LyraChartPreloadOptions,
  LyraChartPreloadResult,
} from './components/charts/chart/chart-preload.js';
export type { LyraChartLegendVisibilityChangeDetail, LyraChartDatumVisibilityChangeDetail } from './components/charts/chart/chart-legend-visibility.js';
export type { LyraChartChromeLegendPosition } from './components/charts/chart/chart-chrome.js';
export type {
  LyraBoxPlotSummary,
  LyraBoxPlotSeries,
  LyraBoxPlotPointDetail,
  LyraBoxPlotEventMap,
} from './components/charts/chart/box-plot.class.js';
export type {
  LyraGraphCommunity,
  LyraGraphEdge,
  LyraGraphFit,
  LyraGraphLayout,
  LyraGraphNode,
  LyraGraphNodeLabelsMode,
  LyraGraphPickKind,
  LyraGraphRenderer,
  LyraGraphSelectionMode,
  LyraScoreThresholds,
} from './components/retrieval/graph/graph.class.js';
export type { LyraNodeTypeStyle } from './internal/node-type-style.js';
export type {
  LyraMapBounds,
  LyraMapFitBoundsOptions,
  LyraMapPadding,
  LyraMapViewChangeDetail,
  LyraMapViewChangeSource,
  LyraMapLegendEntry,
  LyraMapChoroplethInterpolation,
  LyraMapLegendGradientStop,
  LyraMapLegendPattern,
  LyraMapLegendControlRole,
  LyraMapLegendProjection,
  LyraMapChoroplethLayer,
  LyraMapMarker,
  LyraMapGeoJsonDataLayer,
  LyraMapDataLayerKind,
  LyraMapClusterOptions,
  LyraMapHeatmapOptions,
  LyraMapHeatmapZoomValue,
  LyraMapLineOptions,
  LyraMapPointOptions,
  LyraMapPointIcon,
  LyraMapPointRadiusOptions,
  LyraMapPointRadiusInterpolation,
  LyraMapPointIconMode,
  LyraMapPointIconLineCap,
  LyraMapPointIconLineJoin,
  LyraMapLegendToggleDetail,
  LyraMapLegendPanelToggleDetail,
  LyraMapMarkerActivationDetail,
  LyraMapMarkerActivationSource,
  LyraMapStyleSpecification,
  LyraMapInstance,
} from './components/media/map/map.class.js';
export {
  DEFAULT_MAX_FILE_SIZE_BYTES,
} from './components/media/file-input/file-input.class.js';
export type {
  LyraFileInputCapture,
  LyraFileInputFilesDetail,
  LyraFileInputRejectedFile,
  LyraFileInputValidator,
  LyraFileInputValidatorResult,
  LyraFileInputObjectValidator,
  LyraFileInputObjectValidatorResult,
  LyraFileInputFilesEvent,
} from './components/media/file-input/file-input.class.js';
export type {
  LyraDropZoneEventMap,
  LyraDropZoneFilesDetail,
  LyraDropZoneFilesEvent,
  LyraDropZoneRejectedFile,
} from './components/media/drop-zone/drop-zone.class.js';

export {
  loadLibphonenumberAdapter,
} from './components/forms/phone-input/phone-number-adapter.js';
export type {
  LyraPhoneNumberStatus,
  LyraPhoneCountry,
  LyraPhoneNumberParseResult,
  LyraPhoneNumberAdapter,
  LibphonenumberModuleLike,
} from './components/forms/phone-input/phone-number-adapter.js';
export type {
  LyraPhoneInputEventDetail,
  LyraPhoneInputSelectionDirection,
} from './components/forms/phone-input/phone-input.class.js';
export type { LyraWidgetView } from './components/layout/widget/widget.class.js';
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
export type { LyraDrawerPlacement } from './components/overlays/drawer/drawer.class.js';
export type {
  DialogCloseReason,
  LyraDialogHideDetail,
  LyraDialogModalController,
  LyraDialogRequestCloseDetail,
  LyraDialogRequestCloseSource,
  LyraDialogCloseDetail,
} from './components/overlays/dialog/dialog.class.js';
export { confirm } from './components/overlays/dialog/confirm.js';
export type { ConfirmOptions } from './components/overlays/dialog/confirm.js';
export type {
  LyraTabGroupPlacement,
  LyraTabGroupActivation,
} from './components/layout/tab-group/tab-group.class.js';
export type { LyraTabEventMap } from './components/layout/tab-group/tab.class.js';
export type { LyraLiveRegionMode } from './components/utility/live-region/live-region.class.js';
export { Announcer, acquireAnnouncementSink } from './internal/announcer.js';
export type {
  AnnounceOptions,
  AnnouncementSink,
  AnnouncementSinkOptions,
  AnnouncerOptions,
  AnnouncerTimerHost,
} from './internal/announcer.js';
export type { LyraAliasMapping, LyraDeprecatedAliases } from './internal/deprecated-aliases.js';
export type { LyraEmitOptions } from './internal/lyra-element.js';
export type { LyraEventMap } from './internal/lyra-element.js';
export type { LyraMatchTarget } from './internal/match-constraint.js';
export type { LyraEventDetailSnapshot } from './internal/lyra-element.js';
export {
  getLyraLocale,
  getLyraLocaleDirection,
  registerLyraLocale,
  setLyraLocale,
  getRegisteredLyraLocales,
  getRegisteredLyraLocaleKeys,
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
export type { LyraStreamingTextCoreEventMap } from './components/conversation/streaming-text/streaming-text-core.class.js';
export { loadMarkdownDeps as preloadMarkdown } from './components/conversation/markdown/markdown-loader.js';
export type { MarkdownHtmlMode } from './components/conversation/markdown/markdown-shared.js';
export type {
  ChatMessageActionsPlacement,
  ChatMessageActionsPosition,
  ChatMessageAttachmentsPlacement,
  ChatMessageRole,
  ChatMessageStatus,
  ChatMessageToggleDetail,
} from './components/conversation/chat-message/chat-message.class.js';
export type {
  TypingIndicatorLabelPlacement,
  TypingIndicatorShape,
  TypingIndicatorSize,
} from './components/conversation/typing-indicator/typing-indicator.class.js';
export type {
  ToolCallStatus,
  ToolChipSelectDetail,
  LyraToolCallChipEventMap,
} from './components/agent-tools/tool-call-chip/tool-call-chip.class.js';
export type {
  ToolCallBlockToggleDetail,
  ToolCallBlockRenderErrorDetail,
  LyraToolCallBlockEventMap,
} from './components/agent-tools/tool-call-block/tool-call-block.class.js';
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
export type {
  ToolResultStatus,
  ToolResultDialogCloseReason,
  LyraToolResultDialogEventMap,
  LyraToolResultDialogCloseDetail,
} from './components/agent-tools/tool-result-dialog/tool-result-dialog.class.js';
export type {
  ChatComposerActionsLayout,
  ChatComposerFrame,
  ChatComposerStatus,
  ChatComposerWrap,
  ChatComposerSelectionDirection,
} from './components/conversation/chat-composer/chat-composer.class.js';
export {
  formatFileSize,
} from './components/media/attachment-chip/attachment-chip.class.js';
export type {
  LyraAttachmentIdDetail,
  LyraAttachmentPreviewRequestDetail,
  LyraAttachmentUploadStatus,
} from './components/media/attachment-chip/attachment-chip.class.js';
export type {
  StreamConnectionState,
  StreamStatusPhase,
} from './components/conversation/stream-status/stream-status.class.js';
export type { LyraStreamPhase } from './internal/stream-phase.js';
export {
  VIRTUAL_LIST_ROW_ATTRIBUTE,
  VIRTUAL_LIST_STICKY_ATTRIBUTE,
} from './components/layout/virtual-list/virtual-list.class.js';
export type {
  LyraVirtualListIndexedSource,
  LyraVirtualListGroup,
  LyraVirtualListItemRole,
  LyraVirtualListRange,
  LyraVirtualListRowHeight,
  LyraVirtualListRowProjection,
  LyraVirtualListScroll,
  LyraVirtualListSource,
} from './components/layout/virtual-list/virtual-list.class.js';
export type {
  ConversationItemRenameDetail,
  ConversationItemSelectDetail,
} from './components/conversation/conversation-item/conversation-item.class.js';
export type { LyraTimestamp } from './components/conversation/timestamp.js';
export type { LyraCatalog, LyraCatalogEntry } from './utilities/catalog.js';
export type {
  LyraModelCatalogEntry,
  LyraModelSelectSelectionDirection,
} from './components/conversation/model-select/model-select.class.js';
export type {
  ToolSelectDialogTool,
  ToolSelectFilter,
  ToolSelectionChangeDetail,
  ToolSelectDialogCloseReason,
  LyraToolSelectDialogCloseDetail,
} from './components/agent-tools/tool-select-dialog/tool-select-dialog.class.js';
export type {
  CitationBadgeStatus,
  CitationActivateDetail,
  CitationOpenDetail,
} from './components/retrieval/citation-badge/citation-badge.class.js';
export type { SourceListToggleDetail } from './components/retrieval/source-list/source-list.class.js';
export type {
  SourceCardExpandDetail,
  SourceCardOpenDetail,
} from './components/retrieval/source-card/source-card.class.js';
export {
  computeAppRailMode,
} from './components/layout/app-rail/app-rail.class.js';
export type {
  LyraAppRailItemEventMap,
  LyraAppRailItemToggleDetail,
} from './components/layout/app-rail/app-rail-item.class.js';
export type {
  LyraAppRailGroupEventMap,
  LyraAppRailGroupToggleDetail,
} from './components/layout/app-rail-group/app-rail-group.class.js';
export type {
  LyraAppRailMode,
  LyraAppRailModeInput,
  LyraAppRailPreferredMode,
  LyraAppRailPersistField,
  LyraAppRailModeChangeDetail,
  LyraAppRailToggleDetail,
  LyraAppRailResizeDetail,
} from './components/layout/app-rail/app-rail.class.js';
export {
  resolveResponsivePanelEffectiveMode,
} from './components/layout/responsive-panel/responsive-panel.class.js';
export type {
  LyraResponsivePanelMode,
  LyraResponsivePanelEffectiveMode,
  LyraResponsivePanelShape,
  LyraResponsivePanelCloseReason,
  LyraResponsivePanelModeChangeDetail,
  LyraResponsivePanelCloseDetail,
} from './components/layout/responsive-panel/responsive-panel.class.js';
export type {
  LyraMentionFocusOptions,
  LyraMentionItem,
  LyraMentionFilter,
  LyraMentionSelectDetail,
} from './components/utility/mention-popover/mention-popover.class.js';
export {
  looksLikeMarkdown,
} from './components/conversation/streaming-text/streaming-text.class.js';
export type {
  LyraStreamingTextEventMap,
  StreamingTextContentMode,
} from './components/conversation/streaming-text/streaming-text.class.js';
export type {
  ThinkingPanelMode,
  ThinkingPanelAppearance,
  ThinkingPanelToggleDetail,
} from './components/agent-tools/thinking-panel/thinking-panel.class.js';
export type {
  GenerationMetricsStatus,
  LyraGenerationMetricsEventMap,
} from './components/conversation/generation-metrics/generation-metrics.class.js';
export type { LyraCodeBlockCopyAppearance, LyraCodeBlockToggleDetail } from './components/conversation/code-block/code-block-shared.js';
export type {
  ToolApprovalDialogWrap,
  ToolApprovalDialogCloseReason,
  ToolApprovalDialogPending,
  LyraToolApprovalDialogCloseDetail,
} from './components/agent-tools/tool-approval-dialog/tool-approval-dialog.class.js';
export type {
  ToolParamFormPropertyType,
  ToolParamFormPrimitive,
  ToolParamFormProperty,
  ToolParamFormValue,
  FlatToolParamSchema,
  ToolParamEnumItems,
  ToolParamEnumOption,
  ToolParamStringFormat,
} from './components/agent-tools/tool-param-form/tool-param-form.class.js';
export type {
  MenuFocusTarget,
  MenuItemSelectDetail,
} from './components/layout/menu/menu.class.js';
export type {
  MenuItemChangeDetail,
  MenuItemStateChangeDetail,
  MenuItemType,
  MenuItemVariant,
} from './components/layout/menu/menu-item.class.js';
export type { LyraDropdownItemEventMap } from './components/layout/menu/dropdown-item.class.js';
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
  LyraPopoverTrigger,
  LyraPopupRole,
  OverlayVirtualRect,
} from './components/overlays/overlay/popover.class.js';
export type {
  LyraTooltipEventMap,
  LyraTooltipTrigger,
} from './components/overlays/overlay/tooltip.class.js';
export type { LyraArrowPlacement } from './components/overlays/overlay/popover.class.js';
export {
  type LyraDropdownEventMap,
} from './components/overlays/overlay/dropdown.class.js';
export {
  type LyraContextMenuEventMap,
  type LyraContextMenuPoint,
  type LyraContextMenuShowDetail,
  type LyraContextMenuSource,
} from './components/overlays/context-menu/context-menu.class.js';
export type {
  ChipRemoveDetail,
  ChipSelectDetail,
  ChipSize,
  ChipVariant,
} from './components/overlays/chip/chip.class.js';
export type { ChipGroupOverflowToggleDetail } from './components/overlays/chip/chip-group.class.js';
export type {
  ModelSettingsPanelLayout,
  ModelSettingsChangeDetail,
} from './components/conversation/model-settings-panel/model-settings-panel.class.js';
export type {
  ContextMeterLegendDisplay,
  ContextMeterSegment,
  ContextMeterShape,
  ContextMeterTone,
  LyraContextMeterEventMap,
  LyraContextMeterSegmentActivateDetail,
} from './components/data/context-meter/context-meter.class.js';
export type {
  LyraDockPanelCollapseChangeDetail,
  LyraDockPanelEdge,
  LyraDockPanelEventMap,
  LyraDockPanelResizeDetail,
} from './components/layout/dock-panel/dock-panel.class.js';
export { resolveCssLength } from './utilities/css-length.js';
export type { ResolveCssLengthOptions } from './utilities/css-length.js';
export type { DocumentPreviewStatus } from './components/viewers/document-preview/document-preview.class.js';
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
export type {
  DocumentViewerCloseReason,
  LyraDocumentViewerCloseDetail,
} from './components/viewers/document-viewer/document-viewer.class.js';
export type {
  DirectDocumentRendererDefinition,
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
export type {
  EbookTocItem,
  LyraEbookViewerEventMap,
} from './components/viewers/ebook-viewer/ebook-viewer.class.js';
export type {
  LyraPptxViewerEventMap,
  LyraViewerDiagnostic,
  LyraViewerDiagnosticCode,
  LyraViewerDiagnosticEventDetail,
  LyraViewerDiagnosticSeverity,
} from './components/viewers/pptx-viewer/pptx-viewer.class.js';
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
export type {
  DatasetTable,
  DatasetViewerScrollMode,
} from './components/viewers/dataset-viewer/dataset-viewer.class.js';
export type {
  VCardAddress,
  VCardContact,
  VCardName,
  VCardTypedValue,
} from './components/viewers/contact-viewer/vcard.js';
export type {
  LyraMediaCardKind,
  LyraMediaCardOpenDetail,
} from './components/media/media-card/media-card.class.js';
export type {
  LyraAttachmentCapability,
  LyraAttachmentFilesDetail,
  LyraFileBackedCapability,
} from './components/media/attachment-trigger/attachment-trigger.class.js';
export {
  shortcutTokenLabel,
  parseShortcut,
} from './components/overlays/kbd/kbd.class.js';
export type {
  EffectiveKbdPlatform,
  KbdKeyLabel,
  KbdLocalize,
  KbdPlatform,
} from './components/overlays/kbd/kbd.class.js';
export type { ResultCardAppearance } from './components/agent-tools/result-card/result-card.class.js';
export { groupByRecency } from './internal/group-by-recency.js';
export type {
  RecencyLabels,
  GroupByRecencyOptions,
  RecencyBucket,
} from './internal/group-by-recency.js';
export type {
  LyraAvatarErrorDetail,
  LyraAvatarLoading,
  LyraAvatarShape,
  LyraAvatarEventMap,
} from './components/media/avatar/avatar.class.js';
export type {
  LyraCarouselEventMap,
  LyraCarouselOrientation,
} from './components/layout/carousel/carousel.class.js';
export type {
  LyraImageComparerEventMap,
  LyraImageComparerOrientation,
} from './components/media/image-comparer/image-comparer.class.js';
export type { LyraPanZoomEventMap } from './components/media/pan-zoom/pan-zoom.class.js';
export type {
  LyraZoomableFrameEventMap,
  LyraZoomableFrameLoading,
} from './components/media/zoomable-frame/zoomable-frame.class.js';
export type { LyraScrollerEventMap } from './components/layout/scroller/scroller.class.js';
export type {
  ResizeObserverBox,
  LyraResizeObserverEventMap,
} from './components/utility/resize-observer/resize-observer.class.js';
export type { LyraIntersectionObserverEventMap } from './components/utility/intersection-observer/intersection-observer.class.js';
export type { LyraMutationObserverEventMap } from './components/utility/mutation-observer/mutation-observer.class.js';
export type {
  LyraCardEventMap,
} from './components/layout/card/card.class.js';
export type {
  LyraStepItem,
  LyraStepperOrientationChangeDetail,
  LyraStepState,
} from './components/layout/stepper/stepper.class.js';
export type { LyraSegmentedItem } from './components/layout/segmented/segmented.class.js';
export type {
  LyraSwatchPickerMode,
  SwatchPickerItem,
} from './components/forms/swatch-picker/swatch-picker.class.js';
export {
  DEFAULT_GEMSTONE,
  GEMSTONE_KEYS,
  GEMSTONES,
  gemstoneGlyph,
} from './theme/gemstones.js';
export type { GemstoneAccent, GemstoneKey } from './theme/gemstones.js';
export { computeLineDiff } from './components/utility/diff-view/diff-line-diff.js';
export type { LyraDiffOp } from './components/utility/diff-view/diff-line-diff.js';
export type {
  TextareaResize,
  TextareaWrap,
  TextareaSelectionDirection,
  TextareaScrollPosition,
} from './components/forms/textarea/textarea.class.js';

export type {
  ButtonVariant,
  ButtonAppearance,
  ButtonType,
  ButtonFormEnctype,
  ButtonFormMethod,
  ButtonPressedState,
  LyraButtonEventMap,
} from './components/forms/button/button.class.js';

export type { LyraInputType } from './components/forms/input/input.class.js';
export type {
  LyraTimeInputHourFormat,
  LyraTimeInputPlacement,
  LyraTimeInputStep,
} from './components/forms/input/time-input.class.js';
export type { RadioAppearance } from './components/forms/radio/radio.class.js';
export type {
  OtpInputType,
  OtpInputCase,
  OtpInputAppearance,
  OtpInputSelectionDirection,
} from './components/forms/otp-input/otp-input.class.js';
export type { LyraOtpInputEventMap } from './components/forms/otp-input/otp-input.class.js';
export type { RadioGroupOrientation } from './components/forms/radio/radio-group.class.js';
export type { LyraSpinnerLabelPlacement } from './components/overlays/spinner/spinner.class.js';
export type { LyraProgressVariant } from './components/overlays/progress/progress-bar.class.js';
export type {
  BadgeVariant,
  BadgeSize,
  BadgeAppearance,
  BadgeAttention,
} from './components/overlays/badge/badge.class.js';
export type {
  LyraTagEventMap,
  TagVariant,
} from './components/overlays/badge/tag.class.js';
export type {
  AlertCountdown,
  AlertVariant,
  LyraAlertEventMap,
} from './components/overlays/alert/alert.class.js';
export type {
  CalloutAppearance,
  CalloutSize,
  CalloutVariant,
  LyraCalloutEventMap,
  LyraCalloutCloseDetail,
} from './components/overlays/callout/callout.class.js';
export type {
  LyraDetailsAppearance,
  LyraDetailsEventMap,
  LyraDetailsIconPlacement,
  LyraDetailsSize,
  LyraDetailsToggleDetail,
  LyraDetailsToggleSource,
} from './components/layout/details/details.class.js';
export type {
  LyraAccordionEventDetail,
  LyraAccordionEventMap,
  LyraAccordionMode,
} from './components/layout/details/accordion.class.js';
export type {
  LyraAccordionAppearance,
  LyraAccordionHeadingLevel,
  LyraAccordionIconPlacement,
} from './components/layout/details/accordion-item.class.js';
export type { LyraDividerOrientation } from './components/utility/divider/divider.class.js';
export type { LyraBreadcrumbItemTarget } from './components/layout/breadcrumb/breadcrumb-item.class.js';
export type {
  LyraFormatBytesUnit,
  LyraFormatDisplay,
} from './components/utility/format/format-bytes.class.js';
export type { LyraRelativeTimeUnit } from './components/utility/format/relative-time.class.js';
export type {
  LyraRatingEventMap,
  LyraRatingHoverPhase,
  LyraRatingSize,
  LyraRatingSymbolRenderer,
} from './components/overlays/rating/rating.class.js';
export type {
  LyraColorPickerEventMap,
  LyraColorPickerSwatch,
  LyraColorPickerFormat,
  LyraColorPickerOutputFormat,
  LyraColorHsva,
} from './components/forms/color-picker/color-picker.class.js';
export type {
  CheckboxGroupOrientation,
  LyraCheckboxGroupEventMap,
  LyraCheckboxGroupToggleRequestDetail,
} from './components/forms/checkbox-group/checkbox-group.class.js';
export type {
  LyraToggleAppearance,
  LyraToggleChangeDetail,
  LyraToggleEventMap,
} from './components/forms/toggle/toggle.class.js';
export type {
  LyraToggleGroupEventMap,
  LyraToggleGroupSelectionMode,
  LyraToggleGroupToggleRequestDetail,
} from './components/forms/toggle-group/toggle-group.class.js';
export type {
  LyraTokenInputEventMap,
} from './components/forms/token-input/token-input.class.js';
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
export type { LyraIconButtonEventMap } from './components/forms/icon-button/icon-button.class.js';
export type {
  LyraCommand,
  LyraCommandPaletteEventMap,
  LyraCommandPaletteCloseDetail,
  LyraCommandPaletteCloseReason,
} from './components/layout/command-palette/command-palette.class.js';
export type {
  LyraCodeEditorEventMap,
  LyraCodeEditorResize,
  LyraCodeEditorWrap,
} from './components/forms/code-editor/code-editor.class.js';
export type {
  CalendarEvent,
  CalendarView,
  LyraCalendarEventMap,
  LyraCalendarFirstDayOfWeek,
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
export type {
  PdfOutlineItem,
  LyraPdfViewerEventMap,
} from './components/viewers/pdf-viewer/pdf-viewer.class.js';
export { IMAGE_VIEWER_HIGHLIGHT_LIMIT } from './components/media/image-viewer/image-viewer.class.js';
export type {
  LyraImageFit,
  LyraImageRotation,
  LyraImageRegionRect,
  LyraImageViewerEventMap,
} from './components/media/image-viewer/image-viewer.class.js';
export type {
  LyraAvCue,
  LyraAvTrack,
  LyraAvKind,
  LyraAvPreload,
  LyraAvControlsSurface,
  LyraAvCueChangeDetail,
  LyraAvPlayerEventMap,
} from './components/media/av-player/av-player.class.js';
export type {
  LyraVideoControls,
  LyraVideoEventMap,
  LyraVideoPreload,
  VideoState,
} from './components/media/video/video.class.js';
export type {
  LyraVideoPlaylistChangeDetail,
  LyraVideoPlaylistEventMap,
  LyraVideoPlaylistItem,
  LyraVideoPlaylistRepeat,
  LyraVideoPlaylistSource,
  LyraVideoPlaylistTrack,
  LyraVideoPlaylistVideo,
} from './components/media/video-playlist/video-playlist.class.js';
export type {
  ArtifactVersion,
  ArtifactPanelView,
  LyraArtifactPanelEventMap,
} from './components/agent-tools/artifact-panel/artifact-panel.class.js';
export type {
  BrowserPing,
  BrowserFrameController,
  LyraBrowserFrameEventMap,
} from './components/agent-tools/browser-frame/browser-frame.class.js';
export type {
  ChatViewportLive,
  LyraChatViewportEventMap,
} from './components/conversation/chat-viewport/chat-viewport.class.js';
export type {
  CheckpointRestoreDetail,
  LyraCheckpointEventMap,
} from './components/conversation/checkpoint/checkpoint.class.js';
export type {
  ConfirmBarDecision,
  ConfirmBarVariant,
  ConfirmBarReturnFocusTarget,
  ConfirmBarWaitUntil,
  LyraConfirmBarEventMap,
} from './components/agent-tools/confirm-bar/confirm-bar.class.js';
export type {
  LyraNotebookViewerSource,
  LyraNotebookViewerEventMap,
} from './components/viewers/notebook-viewer/notebook-viewer.class.js';
export type {
  LyraChatSuggestion,
  LyraSuggestionChipsEventMap,
} from './components/conversation/suggestion-chips/suggestion-chips.class.js';
export type {
  LyraChatThread,
  LyraThreadListEventMap,
  ThreadBucketKey,
  ThreadGroupContext,
  ThreadGroupToggleDetail,
  ThreadListGrouping,
  ThreadRowAction,
} from './components/conversation/thread-list/thread-list.class.js';
export type {
  LyraVoiceCatalogEntry,
  LyraVoicePickerSelectionDirection,
  LyraVoicePickerEventMap,
} from './components/conversation/voice-picker/voice-picker.class.js';
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
export { FLOW_PALETTE_MIME_TYPE } from './components/data/flow-canvas/flow-canvas.class.js';
export type {
  FlowHandle,
  FlowNode,
  FlowEdge,
  FlowRunDecoration,
  FlowRunDecorations,
  FlowStructureNodeSnapshot,
  FlowStructureEdgeSnapshot,
  FlowViewportSnapshot,
  FlowStructureSnapshot,
  FlowLayoutChangeDetail,
  LyraFlowCanvasEventMap,
} from './components/data/flow-canvas/flow-canvas.class.js';
export type { LyraFlowControlsEventMap } from './components/data/flow-controls/flow-controls.class.js';
export type {
  LyraPaletteItem,
  LyraNodePaletteEventMap,
} from './components/retrieval/node-palette/node-palette.class.js';
export type {
  LyraGraphLegendVisibilityDetail,
  LyraGraphLegendEventMap,
} from './components/retrieval/graph-legend/graph-legend.class.js';
export type {
  LyraEntity,
  EntityCardAppearance,
  LyraEntityCardEventMap,
} from './components/retrieval/entity-card/entity-card.class.js';
export type {
  LyraEntityChipEventMap,
} from './components/retrieval/entity-chip/entity-chip.class.js';
export type {
  LyraNeighborRow,
  LyraNeighborListEventMap,
} from './components/retrieval/neighbor-list/neighbor-list.class.js';
export type {
  LyraPathElement,
  LyraPathStripEventMap,
} from './components/retrieval/path-strip/path-strip.class.js';
export type {
  LyraCommunity,
  CommunityCardAppearance,
  LyraCommunityCardEventMap,
} from './components/retrieval/community-card/community-card.class.js';
export type {
  LyraChunk,
  LyraChunkInspectorEventMap,
  ChunkInspectorSort,
} from './components/retrieval/chunk-inspector/chunk-inspector.class.js';
export type {
  LyraSourceEntry,
  LyraSourcePickerEventMap,
} from './components/retrieval/source-picker/source-picker.class.js';
export type {
  LyraProvenance,
  LyraProvenancePanelEventMap,
} from './components/retrieval/provenance-panel/provenance-panel.class.js';
export type {
  LyraTopic,
  LyraMindMapEventMap,
} from './components/retrieval/mind-map/mind-map.class.js';
export type {
  AgentRunMetric,
  AgentRunAppearance,
  AgentRunCancelDetail,
  AgentRunRetryDetail,
  LyraAgentRunEventMap,
} from './components/agent-tools/agent-run/agent-run.class.js';
export type {
  EvaluationMetricFormat,
  AgentEvaluationMetric,
  AgentEvaluationDashboardRun,
  LyraAgentEvalDashboardEventMap,
} from './components/agent-tools/agent-eval-dashboard/agent-eval-dashboard.class.js';
export type {
  McpAppPermissions,
  McpAppCsp,
  McpAppResource,
  McpAppToolCallDetail,
  McpAppToolResultOptions,
  LyraMcpAppEventMap,
} from './components/agent-tools/mcp-app/mcp-app.class.js';
export type {
  ApprovalRequestStatus,
  ToolApprovalRequest,
  LyraApprovalQueueEventMap,
} from './components/agent-tools/approval-queue/approval-queue.class.js';
export type {
  ContextInspectorSegment,
  ToolTimelineEntry,
  LyraAgentWorkspaceEventMap,
} from './components/conversation/agent-workspace/agent-workspace.class.js';
export type {
  LyraAgentTraceEventMap,
} from './components/agent-tools/agent-trace/agent-trace.class.js';
export type {
  ContextInspectorRedaction,
  LyraContextInspectorEventMap,
} from './components/agent-tools/context-inspector/context-inspector.class.js';
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
export type {
  DocumentComparePaneSide,
  LyraDocumentCompareView,
  LyraDocumentCompareEventMap,
  DocumentCompareVersion,
} from './components/viewers/document-compare/document-compare.class.js';
export type {
  LibraryDocumentFreshness,
  LibraryDocument,
  LibraryDocumentSortKey,
  DocumentLibraryFilterChangeDetail,
  DocumentLibrarySortRequestDetail,
  DocumentLibrarySortCommitDetail,
  DocumentLibrarySortDetail,
  DocumentLibrarySelectionChangeDetail,
  DocumentLibraryOpenDetail,
  LyraDocumentLibraryEventMap,
} from './components/data/document-library/document-library.class.js';
export type {
  LyraDrilldownCategory,
  LyraDrilldownEvidenceItem,
  LyraDrilldownDocument,
  LyraDrilldownEntity,
  LyraDrilldownNode,
  LyraDrilldownNavigateDetail,
  LyraDrilldownCategoryChangeDetail,
  LyraDrilldownEvidenceExpandDetail,
  LyraDrilldownEvidenceOpenDetail,
  LyraDrilldownDocumentDownloadDetail,
  LyraDrilldownDocumentRenderErrorDetail,
  LyraDrilldownDocumentHighlightActivateDetail,
  LyraDrilldownEntityActivateDetail,
  LyraDrilldownPanelEventMap,
} from './components/layout/drilldown-panel/drilldown-panel.class.js';
export type {
  LyraEntityDossierTab,
  LyraEntityDossierConfidence,
  LyraEntityDossierEventMap,
} from './components/retrieval/entity-dossier/entity-dossier.class.js';
export type {
  EvalExample,
  LyraEvalDatasetEventMap,
} from './components/agent-tools/eval-dataset/eval-dataset.class.js';
export type {
  EvalRunResult,
  LyraEvalResultEventMap,
} from './components/agent-tools/eval-result/eval-result.class.js';
export type {
  EvalContentFormat,
  EvalContent,
  EvalExampleResult,
  EvalExampleToggleDetail,
  EvalCitationSelectDetail,
  EvalToolApprovalDetail,
  EvalToolActivateDetail,
  EvalToolRenderErrorDetail,
  EvalClaimSelectDetail,
  LyraEvalRunEventMap,
} from './components/agent-tools/evaluation-run/evaluation-run.class.js';
export type {
  LyraFilterBarControlType,
  LyraFilterBarOption,
  LyraFilterBarFieldValue,
  LyraFilterBarCustomControlAdapter,
  LyraFilterBarCustomControlContext,
  LyraFilterBarCustomControl,
  LyraFilterBarLabelVisibility,
  LyraFilterBarActiveFiltersDisplay,
  LyraFilterBarSelectDefinition,
  LyraFilterBarCheckboxMenuDefinition,
  LyraFilterBarComboboxDefinition,
  LyraFilterBarTextDefinition,
  LyraFilterBarDateDefinition,
  LyraFilterBarDateRangeDefinition,
  LyraFilterBarCustomDefinition,
  LyraFilterBarChipDefinition,
  LyraFilterBarFilterDefinition,
  LyraFilterBarValue,
  LyraFilterBarDefinitionValue,
  LyraFilterBarValueFor,
  LyraFilterBarInputDetail,
  LyraFilterBarValidityDetail,
  LyraFilterBarResetDetail,
  LyraFilterBarEventMap,
  LyraFilterBarInputEvent,
  LyraFilterBarResetEvent,
} from './components/layout/filter-bar/filter-bar.class.js';
export type {
  GraphQueryDirection,
  GraphQueryTypeOption,
  GraphQuery,
  GraphQuerySavedItem,
  GraphQueryRunDetail,
  GraphQuerySaveDetail,
  GraphQueryLoadDetail,
  GraphQueryDeleteDetail,
  LyraGraphQueryBuilderEventMap,
} from './components/data/graph-query-builder/graph-query-builder.class.js';
export type {
  LyraGroundingSummaryEventMap,
} from './components/retrieval/grounding-summary/grounding-summary.class.js';
export type {
  LyraClaimEvidenceEventMap,
} from './components/retrieval/claim-evidence/claim-evidence.class.js';
export type {
  IngestionStage,
  IngestionQueueItem,
  IngestionRetryEventDetail,
  IngestionCancelEventDetail,
  LyraIngestionQueueEventMap,
} from './components/retrieval/ingestion-queue/ingestion-queue.class.js';
export type {
  KnowledgeSourceSyncStatus,
  KnowledgeSourceIndexingHealth,
  KnowledgeSourcePermission,
  KnowledgeSource,
  LyraKnowledgeBaseEventMap,
} from './components/retrieval/knowledge-base/knowledge-base.class.js';
export type {
  KnowledgeBaseAdminTab,
  LyraKnowledgeBaseAdminEventMap,
} from './components/retrieval/knowledge-base-admin/knowledge-base-admin.class.js';
export type {
  LyraRagAnswerState,
  LyraRagCitationSelectDetail,
  LyraRagAnswerEventMap,
} from './components/retrieval/rag-answer/rag-answer.class.js';
export type {
  LyraRagEvalDashboardEventMap,
  LyraRagEvaluationMetric,
  LyraRagEvaluationMetricCategory,
  LyraRagEvaluationMetricFormat,
  LyraRagEvaluationRun,
} from './components/retrieval/rag-eval-dashboard/rag-eval-dashboard.class.js';
export type {
  EmbeddingPoint,
  LyraEmbeddingExplorerEventMap,
} from './components/retrieval/embedding-explorer/embedding-explorer.class.js';
export type {
  LyraKnowledgeGraphEntityDetails,
  KnowledgeGraphHighlight,
  LyraKnowledgeGraphExplorerEventMap,
} from './components/retrieval/knowledge-graph-explorer/knowledge-graph-explorer.class.js';
export type {
  LyraMemoryItem,
  LyraMemoryAddDetail,
  LyraMemoryRemoveDetail,
  LyraMemoryExpandDetail,
  LyraMemoryPanelEventMap,
} from './components/retrieval/memory-panel/memory-panel.class.js';
export type {
  PolicyDecisionState,
  PolicyDecisionCategory,
  PolicyDecision,
} from './components/agent-tools/policy-summary/policy-summary.class.js';
export type {
  ConditionBuilderFieldType,
  ConditionBuilderOperator,
  ConditionBuilderFieldOption,
  ConditionBuilderField,
  ConditionBuilderCondition,
  ConditionBuilderCombinator,
  ConditionBuilderValue,
  ConditionBuilderValidationIssueCode,
  ConditionBuilderValidationIssue,
  LyraConditionBuilderEventMap,
} from './components/data/condition-builder/condition-builder.class.js';
export type {
  RetrievalResultsSelectDetail,
  LyraRetrievalResultsEventMap,
  RetrievalResultsGrouping,
  RetrievalResultsPresentation,
} from './components/retrieval/retrieval-results/retrieval-results.class.js';
export type {
  LyraRetrievalCompareEventMap,
  RetrievalComparisonSet,
} from './components/retrieval/retrieval-compare/retrieval-compare.class.js';
export type {
  LyraRetrievalMode,
  RetrievalFiltersChangeDetail,
  LyraRetrievalSearchEventMap,
} from './components/retrieval/retrieval-search/retrieval-search.class.js';
export type {
  RetrievalStageKind,
  RetrievalStageEvidence,
  RetrievalStage,
  LyraRetrievalTraceEventMap,
  LyraRetrievalTraceChunkActionDetail,
} from './components/retrieval/retrieval-trace/retrieval-trace.class.js';
export type {
  ToolTimelineApprovalDetail,
  ToolTimelineActivateDetail,
  ToolTimelineRenderErrorDetail,
  ToolTimelineApprovalPending,
  LyraToolTimelineEventMap,
} from './components/agent-tools/tool-timeline/tool-timeline.class.js';
export type {
  RealtimeConnectionState,
  LyraRealtimeSessionEventMap,
} from './components/conversation/realtime-session/realtime-session.class.js';
export type {
  PromptStudioRole,
  PromptStudioWrap,
  PromptStudioMessage,
  PromptStudioVariable,
  PromptStudioVersion,
  PromptStudioState,
  PromptStudioMessageReorderDetail,
  LyraPromptStudioEventMap,
} from './components/agent-tools/prompt-studio/prompt-studio.class.js';
export type {
  JsonSchemaNode,
  SchemaValidationIssue,
  LyraJsonSchemaViewerEventMap,
} from './components/agent-tools/schema-viewer/schema-viewer.class.js';
export type {
  SubagentRun,
  LyraSubagentPanelEventMap,
} from './components/agent-tools/subagent-panel/subagent-panel.class.js';
export type {
  LyraSpreadsheetViewerEventMap,
} from './components/viewers/spreadsheet-viewer/spreadsheet-viewer.class.js';
export * from './components/viewers/spreadsheet-viewer/spreadsheet-loader.js';
export type {
  LyraCsvViewerEventMap,
} from './components/viewers/csv-viewer/csv-viewer.class.js';
export type {
  LyraXmlViewerEventMap,
  LyraXmlViewerSource,
} from './components/viewers/xml-viewer/xml-viewer.class.js';
export type {
  DocxHeadingItem,
  LyraDocxViewerEventMap,
} from './components/viewers/docx-viewer/docx-viewer.class.js';
export * from './components/viewers/docx-viewer/docx-loader.js';
export type {
  ParsedEmailAttachment,
  ParsedEmail,
  LyraEmailAttachmentOpenDetail,
  LyraEmailViewerEventMap,
} from './components/viewers/email-viewer/email-viewer.class.js';
export {
  clearEmailDepsCache,
  getEmailDepsIfLoaded,
  loadEmailAndSanitizer,
  loadEmailDeps,
} from './components/viewers/email-viewer/email-loader.js';
export type {
  EmailDeps,
  PostalAddressApi,
  PostalAttachmentApi,
  PostalMessageApi,
  PostalMimeApi,
} from './components/viewers/email-viewer/email-loader.js';
export type {
  ParsedCalendarTimeKind,
  ParsedCalendarEvent,
  LyraCalendarViewerEventMap,
} from './components/viewers/calendar-viewer/calendar-viewer.class.js';
export * from './components/viewers/calendar-viewer/calendar-loader.js';
export type {
  ArchiveEntry,
  LyraArchiveViewerEventMap,
} from './components/viewers/archive-viewer/archive-viewer.class.js';
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
export type {
  GeoJsonTypeTag,
  LyraGeoJsonViewerEventMap,
} from './components/viewers/geojson-view/geojson-viewer.class.js';
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
  MarkdownStreamingRenderMode,
  MarkdownVariantContext,
} from './components/conversation/markdown/markdown-base.class.js';
export type {
  MarkdownKatexState,
  MarkdownStreamingRender,
  PendingHighlight,
} from './components/conversation/markdown/markdown-shared.js';
export type {
  ShikiLanguageInput,
  ShikiLanguageLoader,
  ShikiLanguageRegistration,
  ShikiLanguageSource,
} from './components/conversation/code-block/shiki-types.js';
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
  SliderValueDisplay,
  SliderValuePlacement,
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

export type {
  AgentConnector,
  AgentConnectorKind,
  AgentConnectorStatus,
  ConnectorAction,
  LyraConnectorManagerEventMap,
} from './components/agent-tools/connector-manager/connector-manager.class.js';
export type {
  AgentQuestionAction,
  AgentQuestionResponse,
  AgentQuestionStatus,
  LyraAgentQuestionEventMap,
} from './components/agent-tools/agent-question/agent-question.class.js';
export type {
  BackgroundRun,
  BackgroundRunStatus,
  LyraBackgroundRunsEventMap,
} from './components/agent-tools/background-runs/background-runs.class.js';
export type {
  ChangeReviewDecision,
  ChangeReviewFile,
  ChangeReviewHunk,
  LyraChangeReviewEventMap,
} from './components/agent-tools/change-review/change-review.class.js';
export type { LyraCodeBlockBaseEventMap } from './components/conversation/code-block/code-block-base.class.js';
export type { ShikiHighlighter } from './components/conversation/code-block/shiki-types.js';
export type { LyraLocaleLoader } from './locale-loader.js';
export type {
  LyraPermissionGrantEventMap,
  PermissionGrantDecision,
  PermissionGrantStatus,
} from './components/agent-tools/permission-grant/permission-grant.class.js';
export type {
  LyraPermissionRulesEventMap,
  PermissionRule,
  PermissionRuleDecision,
} from './components/agent-tools/permission-rules/permission-rules.class.js';
export type {
  ResearchStep,
  ResearchStepStatus,
} from './components/retrieval/research-progress/research-progress.class.js';

export type * from './ai/types.js';

// Global typed-event surface (generated; see scripts/generate-event-types.mjs). Type-only, so it
// adds zero runtime bytes to the barrel -- but it pulls the `declare global` augmentation into any
// program that imports the package root, which is what types `document.addEventListener('lr-...')`.
export type { LyraGlobalEventMap } from './events.js';

export type { LyraMenubarEventMap } from './components/layout/menubar/menubar.class.js';

export type {
  LyraCurrencyEntry,
  LyraCurrencyCatalog,
  LyraCurrencyChangeDetail,
  LyraCurrencyPickerEventMap,
} from './components/forms/currency-picker/currency-picker.class.js';

export { CURRENCY_CODES, getCurrencyCatalog, normalizeCurrencyRates, loadCurrencyRates, convertCurrency } from './currency.js';
export type { LyraCurrencyCode, LyraCurrencyDisplayEntry, LyraCurrencyRateSnapshot, LyraCurrencyRateLoader, LyraCurrencyRateLoadOptions, LyraCurrencyRateSource } from './currency.js';
export { COUNTRY_CODES, resolveCountryNames } from './countries.js';
export type { LyraCountryCode, LyraCountryEntry, LyraCountryCatalog } from './countries.js';
export { getTimeZoneCodes } from './time-zones.js';
export type { LyraTimeZoneEntry, LyraTimeZoneCatalog } from './time-zones.js';
export { UNIT_CODES, resolveUnitNames } from './units.js';
export type { LyraUnitCode, LyraUnitEntry, LyraUnitCatalog } from './units.js';
export type { LyraCountryPickerEventMap, LyraCountryChangeDetail } from './components/forms/country-picker/country-picker.class.js';
export type { LyraTimeZonePickerEventMap, LyraTimeZoneChangeDetail } from './components/forms/time-zone-picker/time-zone-picker.class.js';
export type { LyraUnitPickerEventMap, LyraUnitChangeDetail } from './components/forms/unit-picker/unit-picker.class.js';
export type { SelectionCatalogEntry, SelectionCatalogRow } from './internal/selection-catalog.js';
export type { LyraCatalogPickerChangeDetail, LyraCatalogPickerEventMap } from './components/forms/catalog-picker-base.js';
