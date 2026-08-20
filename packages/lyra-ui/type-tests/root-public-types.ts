import {
  adaptDocumentRenderer,
  agentStatusKind,
  agentStatusLabel,
  agentStatusMessage,
  agentStatusVariant,
  animations,
  approvalAction,
  approvalDecision,
  createDocumentRendererAdapter,
  createDocumentRendererRegistry,
  createFileTypeMetadataRegistry,
  createWidgetDocument,
  createWidgetTypeRegistry,
  DEFAULT_WIDGET_TYPE_REGISTRY,
  DEFAULT_MAX_FILE_SIZE_BYTES,
  isAgentStatusActive,
  isAgentStatusTerminal,
  isLyraToolbarActionProvider,
  defaultFileTypeMetadataRegistry,
  findDocumentRenderer,
  getAnimationNames,
  getDefaultDocumentRendererRegistry,
  getEasingNames,
  getFileTypeMetadata,
  IMAGE_VIEWER_HIGHLIGHT_LIMIT,
  looksLikeMarkdown,
  LyraDashboardGrid,
  LyraGeoJsonViewer,
  LyraMultiSplit,
  LyraPromptInput,
  LyraRagEvalDashboard,
  LyraRetrievalCompare,
  LyraSequencePlayback,
  LYRA_ANIMATION_NAMES,
  LYRA_EASINGS,
  MAX_RENDERED_LYRA_SPANS,
  normalizeLyraSpanKind,
  normalizeLyraSpans,
  normalizeLyraSpanStatus,
  loadDocumentRenderer,
  preloadCharts,
  preloadMarkdown,
  resolveCssLength,
  resolveLyraDashboardPlacement,
  resolveResponsivePanelEffectiveMode,
  registerDocumentRenderer,
  setFlagUrlResolver,
  SNAP_NONE,
  STACK_TRACE_LIMITS,
  snapshotLyraDocumentRendererPayload,
  isWidgetTypeRegistry,
} from '../src/lyra.js';
import type {
  AgentRunActivateDetail,
  AgentStatusPresentation,
  AgentStatusValue,
  ApprovalAction,
  ApprovalDecision,
  AudioVisualizerMode,
  AudioVisualizerState,
  BadgeSize,
  BadgeVariant,
  BreakpointBasis,
  LyraBreadcrumbItemTarget,
  CalloutAppearance,
  CalloutSize,
  CategoryRubricKey,
  ChatMessageActionsPosition,
  ChatMessageToggleDetail,
  ChipSize,
  ChipVariant,
  ComboboxSourceResult,
  CommentRubricKey,
  ContextMeterShape,
  ConversationItemSelectDetail,
  DataGridGroupDetail,
  DataGridJsonValue,
  DataGridStateFilter,
  DirectDocumentRendererDefinition,
  DocumentFile,
  DocumentViewerCloseReason,
  DocumentLibrarySortCommitDetail,
  DocumentLibrarySortDetail,
  DocumentLibrarySortRequestDetail,
  DocumentRendererDefinition,
  DocumentRendererRegistry,
  EffectiveKbdPlatform,
  EvalContent,
  EvalContentFormat,
  LyraFormatBytesUnit,
  LyraFormatDisplay,
  EvalCitationSelectDetail,
  EvalClaimSelectDetail,
  EvalExampleToggleDetail,
  EvalToolActivateDetail,
  EvalToolApprovalDetail,
  EvalToolRenderErrorDetail,
  FlatToolParamSchema,
  GaugeShape,
  GenerationMetricsStatus,
  HeatmapCalendarData,
  HeatmapData,
  HeatmapMatrixData,
  LyraHeatmapStickyLabels,
  LyraCarouselOrientation,
  LyraAppearance,
  LyraAnimationCleanup,
  LyraAnimationCatalog,
  LyraAnimationEasingName,
  LyraAvCue,
  LyraAvCueChangeDetail,
  LyraAvKind,
  LyraAvPlayerEventMap,
  LyraAvPreload,
  LyraAvTrack,
  LyraAvatarErrorDetail,
  LyraAvatarGroupOverflowDetail,
  LyraAvatarLoading,
  LyraAvatarShape,
  LyraAttachmentCapability,
  LyraAttachmentChipEventMap,
  LyraAttachmentFilesDetail,
  LyraAttachmentIdDetail,
  LyraAttachmentPreviewRequestDetail,
  LyraAttachmentTriggerEventMap,
  LyraAttachmentUploadStatus,
  LyraChartArea,
  LyraChartDatumActivateDetail,
  LyraChartDatumKind,
  LyraChartFormatSurface,
  LyraChartFormatter,
  LyraChartFormatterContext,
  LyraChartInstance,
  LyraChartPoint,
  LyraChartPreloadOptions,
  LyraChartPreloadResult,
  LyraChartSeries,
  LyraChartConfiguration,
  LyraChartChromeLegendPosition,
  LyraChartDataConfiguration,
  LyraChartDatasetConfiguration,
  LyraChartPlugin,
  LyraChartValueFormatter,
  LyraChartValueFormatterContext,
  LyraChatSuggestion,
  LyraClipboardWriteFailure,
  LyraClipboardWriteOutcome,
  LyraClipboardWriteSuccess,
  LyraComboboxPlacement,
  LyraComboboxTagRenderer,
  LyraCsvColumn,
  LyraDatePicker,
  LyraDatePickerFirstDayOfWeek,
  LyraDashboardCell,
  LyraDashboardCellMoveDetail,
  LyraDashboardCellResizeDetail,
  LyraDashboardCollisionDetail,
  LyraDashboardCollisionPolicy,
  LyraDashboardGridEventMap,
  LyraDashboardLayoutChangeDetail,
  LyraDashboardPlacementResult,
  LyraDiffOp,
  LyraDockPanelCollapseChangeDetail,
  LyraDockPanelEdge,
  LyraDockPanelEventMap,
  LyraDockPanelResizeDetail,
  LyraEvalDataset,
  LyraExportFormat,
  LyraExportFormatDescriptor,
  LyraExportFormatOption,
  LyraFileInputCapture,
  LyraFileInputFilesDetail,
  LyraFileInputRejectedFile,
  LyraFileIconMode,
  LyraFileTypeMetadata,
  LyraFileTypeMetadataEntry,
  LyraFileTypeMetadataRegistry,
  LyraResolvedFileTypeMetadata,
  LyraFileBackedCapability,
  LyraFlagFidelity,
  LyraFlagShape,
  LyraFlagUrlResolver,
  LyraFrame,
  LyraFlowRunStatus,
  LyraFormValidator,
  LyraFormValidatorResult,
  LyraGeoJsonViewerEventMap,
  LyraGeojsonView,
  LyraGeojsonViewEventMap,
  LyraGenerationMetrics,
  LyraGenerationMetricsEventMap,
  LyraGraphLink,
  LyraGraphNode,
  LyraGetAnimationOptions,
  LyraImageComparerOrientation,
  LyraImageViewerEventMap,
  LyraLightboxCloseReason,
  LyraLightboxHideDetail,
  LyraKnownDateParts,
  LyraLiteChartScale,
  LyraLiteChartSeries,
  LyraBoxPlotSeries,
  LyraBoxPlotSummary,
  LyraMapChoroplethLayer,
  LyraMapGeoJsonDataLayer,
  LyraMapLegendEntry,
  LyraMapLegendPattern,
  LyraMapLegendProjection,
  LyraMapMarker,
  LyraMarkedParser,
  LyraMediaCardKind,
  LyraMediaCardOpenDetail,
  LyraMirrorAnimationName,
  LyraElementAnimation,
  LyraLiveRegionMode,
  LyraMentionFilter,
  LyraMentionFocusOptions,
  LyraMentionItem,
  LyraMentionSelectDetail,
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
  LyraNodeTypeStyle,
  LyraOrientation,
  LyraPageViewerSnapshot,
  LyraPageViewerStateChangeDetail,
  LyraPageViewerStatus,
  LyraPhoneCountry,
  LyraPhoneInputSelectionDirection,
  LyraPhoneNumberAdapter,
  LyraPhoneNumberParseResult,
  LyraPhoneNumberStatus,
  LyraPopupRole,
  LyraPromptInputAttachment,
  LyraPromptInputEventMap,
  LyraPromptSuggestion,
  LyraRagEvalDashboardEventMap,
  LyraResponsivePanelCloseReason,
  LyraResponsivePanelEffectiveMode,
  LyraResponsivePanelMode,
  LyraResponsivePanelModeChangeDetail,
  LyraResponsivePanelVariant,
  LyraRetrievalCompareEventMap,
  LyraSegmentedItem,
  LyraSequencePlaybackEventMap,
  LyraSequencePlaybackStepDetail,
  LyraSkeletonShape,
  LyraSparklineMark,
  LyraSpanKind,
  LyraSpanProjection,
  LyraSpanStatus,
  LyraStepItem,
  LyraStepperOrientationChangeDetail,
  LyraStepState,
  LyraStreamPhase,
  LyraScoreThresholds,
  LyraSize,
  LyraCodeEditorResize,
  LyraCodeEditorWrap,
  LyraToolbarAction,
  LyraToolbarActionProvider,
  LyraToastIcon,
  LyraToastIconContent,
  LyraToastOptions,
  LyraTreeItem,
  LyraTreeNodeData,
  LyraTourEndReason,
  LyraTourStep,
  LyraTourTarget,
  LyraVariant,
  LyraViewerDiagnostic,
  LyraViewerDiagnosticCode,
  LyraViewerDiagnosticEventDetail,
  LyraViewerDiagnosticSeverity,
  MarkdownHeadingItem,
  MarkdownHtmlMode,
  Marked,
  McpAppResource,
  McpAppToolResultOptions,
  LazyDocumentRendererDefinition,
  DirectToolRendererDefinition,
  LazyToolRendererDefinition,
  MenuItemSelectDetail,
  MenuItemStateChangeDetail,
  MenuItemVariant,
  MessageFeedbackRating,
  MessageFeedbackDetailConfiguration,
  MessageFeedbackDetailFor,
  MessageFeedbackSubmitDetail,
  MessageFeedbackValue,
  OtpInputSelectionDirection,
  PageThumbnailRenderHandle,
  PageThumbnailSource,
  OverlayVirtualRect,
  PlaceAutoSize,
  PlaceBoundary,
  PlaceFlipFallbackStrategy,
  PlaceStrategy,
  PlaceSync,
  RadioAppearance,
  RadioGroupOrientation,
  LyraRagEvaluationMetric,
  LyraRagEvaluationMetricCategory,
  LyraRagEvaluationMetricFormat,
  LyraRagEvaluationRun,
  ResultCardAppearance,
  RetrievalComparisonSet,
  ResolveCssLengthOptions,
  ScoreRubricKey,
  ShikiLanguageInput,
  StackTraceParseOptions,
  StackTraceParseResult,
  StreamingTextContentMode,
  ToolResultFallback,
  SwatchPickerItem,
  StreamConnectionState,
  TagVariant,
  TableColumnEditTrigger,
  TableEdgeAlign,
  TableSelectionMode,
  TableSortCommitDetail,
  TableSortDetail,
  TableSortDirection,
  TableSortMode,
  TableSortRequestDetail,
  TaskListAppearance,
  TestRunState,
  ThinkingPanelAppearance,
  ToolTimelineActivateDetail,
  ToolTimelineRenderErrorDetail,
  TypingIndicatorShape,
  TreeBadge,
  TreeSelection,
  LyraRatingSize,
  LyraReorderDetail,
  LyraResolvedElementAnimation,
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
  LyraTimestamp,
  LyraChatThread,
  LyraWidgetBinding,
  LyraWidgetDocument,
  LyraWidgetInteraction,
  LyraWidgetNode,
  LyraWidgetPropType,
  LyraWidgetTypeDefinition,
  LyraWidgetTypeRegistry,
  LyraZoomableFrameLoading,
  PushToTalkAudioConstraints,
  LyraToastSize,
  LyraVirtualListIndexedSource,
  LyraVirtualListRowHeight,
  LyraVirtualListSource,
  VirtualAnchor,
  VideoState,
  LyraWidgetView,
  KbdPlatform,
  LyraViewerSource,
  LyraImageFit,
  LyraImageRegionRect,
  LyraImageRotation,
  WordCloudLegendItem,
  WordCloudRotation,
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
// @ts-expect-error ContextMeterVariant was removed in favor of ContextMeterShape.
import type { ContextMeterVariant as RemovedContextMeterVariant } from '../src/lyra.js';
// @ts-expect-error GaugeType was removed in favor of GaugeShape.
import type { GaugeType as RemovedGaugeType } from '../src/lyra.js';
// @ts-expect-error LyraSparklineType was removed in favor of LyraSparklineMark.
import type { LyraSparklineType as RemovedLyraSparklineType } from '../src/lyra.js';
// @ts-expect-error LyraPaginationAppearance was removed in favor of the shared LyraAppearance.
import type { LyraPaginationAppearance as RemovedLyraPaginationAppearance } from '../src/lyra.js';
// @ts-expect-error LyraPaginationSize was removed in favor of the shared LyraSize.
import type { LyraPaginationSize as RemovedLyraPaginationSize } from '../src/lyra.js';
// @ts-expect-error MenuSelectDetail was removed with the duplicate lr-menu-select event.
import type { MenuSelectDetail as RemovedMenuSelectDetail } from '../src/lyra.js';
// @ts-expect-error BrowserFrameStatus was replaced by the shared LyraStreamPhase.
import type { BrowserFrameStatus as RemovedBrowserFrameStatus } from '../src/lyra.js';
// @ts-expect-error BrowserFramePhase was replaced by the shared LyraStreamPhase.
import type { BrowserFramePhase as RemovedBrowserFramePhase } from '../src/lyra.js';
// @ts-expect-error StreamStatusPhase was replaced by the shared LyraStreamPhase.
import type { StreamStatusPhase as RemovedStreamStatusPhase } from '../src/lyra.js';
// @ts-expect-error GraphLink was removed in favor of LyraGraphLink.
import type { GraphLink as RemovedGraphLink } from '../src/lyra.js';
// @ts-expect-error GraphNode was removed in favor of LyraGraphNode.
import type { GraphNode as RemovedGraphNode } from '../src/lyra.js';
// @ts-expect-error GraphNodeType was removed in favor of LyraNodeTypeStyle.
import type { GraphNodeType as RemovedGraphNodeType } from '../src/lyra.js';
// @ts-expect-error LyraGraphNodeStyle was replaced by the shared LyraNodeTypeStyle.
import type { LyraGraphNodeStyle as RemovedLyraGraphNodeStyle } from '../src/lyra.js';
// @ts-expect-error LyraGraphLegendType was folded into the shared LyraNodeTypeStyle.
import type { LyraGraphLegendType as RemovedLyraGraphLegendType } from '../src/lyra.js';
// @ts-expect-error LyraDrilldownNodeTypeStyle was folded into the shared LyraNodeTypeStyle.
import type { LyraDrilldownNodeTypeStyle as RemovedLyraDrilldownNodeTypeStyle } from '../src/lyra.js';
// @ts-expect-error LyraPlayback was renamed to the domain-specific LyraSequencePlayback.
import type { LyraPlayback as RemovedLyraPlayback } from '../src/lyra.js';
// @ts-expect-error LyraPlaybackEventMap was renamed to LyraSequencePlaybackEventMap.
import type { LyraPlaybackEventMap as RemovedLyraPlaybackEventMap } from '../src/lyra.js';
// @ts-expect-error StatVariant was removed in favor of the shared LyraVariant.
import type { StatVariant as RemovedStatVariant } from '../src/lyra.js';
// @ts-expect-error StatAppearance was removed in favor of the shared LyraFrame.
import type { StatAppearance as RemovedStatAppearance } from '../src/lyra.js';
// @ts-expect-error SourceCardAppearance was removed in favor of the shared LyraFrame.
import type { SourceCardAppearance as RemovedSourceCardAppearance } from '../src/lyra.js';
// @ts-expect-error TypingIndicatorVariant was removed in favor of TypingIndicatorShape.
import type { TypingIndicatorVariant as RemovedTypingIndicatorVariant } from '../src/lyra.js';
// @ts-expect-error TimelineItemVariant was removed in favor of the shared LyraVariant.
import type { TimelineItemVariant as RemovedTimelineItemVariant } from '../src/lyra.js';
// @ts-expect-error TimelineOrientation was removed in favor of the shared LyraOrientation.
import type { TimelineOrientation as RemovedTimelineOrientation } from '../src/lyra.js';
// @ts-expect-error CardOrientation was removed in favor of the shared LyraOrientation.
import type { CardOrientation as RemovedCardOrientation } from '../src/lyra.js';
// @ts-expect-error ButtonGroupOrientation was removed in favor of the shared LyraOrientation.
import type { ButtonGroupOrientation as RemovedButtonGroupOrientation } from '../src/lyra.js';
// @ts-expect-error BreadcrumbItemTarget was renamed to LyraBreadcrumbItemTarget.
import type { BreadcrumbItemTarget as RemovedBreadcrumbItemTarget } from '../src/lyra.js';
// @ts-expect-error WordCloudOrientations was removed in favor of WordCloudRotation.
import type { WordCloudOrientations as RemovedWordCloudOrientations } from '../src/lyra.js';
// @ts-expect-error CsvColumn was removed in favor of LyraCsvColumn.
import type { CsvColumn as RemovedCsvColumn } from '../src/lyra.js';
// @ts-expect-error DateParts was removed in favor of LyraKnownDateParts.
import type { DateParts as RemovedDateParts } from '../src/lyra.js';
// @ts-expect-error DiffOp was removed in favor of LyraDiffOp.
import type { DiffOp as RemovedDiffOp } from '../src/lyra.js';
// @ts-expect-error ExportFormat was removed in favor of LyraExportFormat.
import type { ExportFormat as RemovedExportFormat } from '../src/lyra.js';
// @ts-expect-error ExportFormatDescriptor was removed in favor of LyraExportFormatDescriptor.
import type { ExportFormatDescriptor as RemovedExportFormatDescriptor } from '../src/lyra.js';
// @ts-expect-error ExportFormatOption was removed in favor of LyraExportFormatOption.
import type { ExportFormatOption as RemovedExportFormatOption } from '../src/lyra.js';
// @ts-expect-error LiveRegionMode was removed in favor of LyraLiveRegionMode.
import type { LiveRegionMode as RemovedLiveRegionMode } from '../src/lyra.js';
// @ts-expect-error LyraKnownDateSize was removed in favor of LyraSize.
import type { LyraKnownDateSize as RemovedLyraKnownDateSize } from '../src/lyra.js';
// @ts-expect-error MentionFilter was removed in favor of LyraMentionFilter.
import type { MentionFilter as RemovedMentionFilter } from '../src/lyra.js';
// @ts-expect-error MentionItem was removed in favor of LyraMentionItem.
import type { MentionItem as RemovedMentionItem } from '../src/lyra.js';
// @ts-expect-error MentionSelectDetail was removed in favor of LyraMentionSelectDetail.
import type { MentionSelectDetail as RemovedMentionSelectDetail } from '../src/lyra.js';
// @ts-expect-error PromptInputAttachment was removed in favor of LyraPromptInputAttachment.
import type { PromptInputAttachment as RemovedPromptInputAttachment } from '../src/lyra.js';
// @ts-expect-error PromptSuggestion was removed in favor of LyraPromptSuggestion.
import type { PromptSuggestion as RemovedPromptSuggestion } from '../src/lyra.js';
// @ts-expect-error ChatSuggestion was removed in favor of LyraChatSuggestion.
import type { ChatSuggestion as RemovedChatSuggestion } from '../src/lyra.js';
// @ts-expect-error TourEndReason was removed in favor of LyraTourEndReason.
import type { TourEndReason as RemovedTourEndReason } from '../src/lyra.js';
// @ts-expect-error TourStep was removed in favor of LyraTourStep.
import type { TourStep as RemovedTourStep } from '../src/lyra.js';
// @ts-expect-error TourTarget was removed in favor of LyraTourTarget.
import type { TourTarget as RemovedTourTarget } from '../src/lyra.js';
// @ts-expect-error AnimationCleanup was removed in favor of LyraAnimationCleanup.
import type { AnimationCleanup as RemovedAnimationCleanup } from '../src/lyra.js';
// @ts-expect-error ElementAnimation was removed in favor of LyraElementAnimation.
import type { ElementAnimation as RemovedElementAnimation } from '../src/lyra.js';
// @ts-expect-error GetAnimationOptions was removed in favor of LyraGetAnimationOptions.
import type { GetAnimationOptions as RemovedGetAnimationOptions } from '../src/lyra.js';
// @ts-expect-error ResolvedElementAnimation was removed in favor of LyraResolvedElementAnimation.
import type { ResolvedElementAnimation as RemovedResolvedElementAnimation } from '../src/lyra.js';
// @ts-expect-error TreeItem was removed in favor of LyraTreeNodeData.
import type { TreeItem as RemovedTreeItem } from '../src/lyra.js';
// @ts-expect-error TreeBadgeTone was removed in favor of the shared LyraVariant.
import type { TreeBadgeTone as RemovedTreeBadgeTone } from '../src/lyra.js';
// @ts-expect-error LyraLocalePickerSize was removed in favor of the shared LyraSize.
import type { LyraLocalePickerSize as RemovedLyraLocalePickerSize } from '../src/lyra.js';
// @ts-expect-error LyraColorPickerSize was removed in favor of the shared LyraSize.
import type { LyraColorPickerSize as RemovedLyraColorPickerSize } from '../src/lyra.js';
// @ts-expect-error ButtonSize was removed in favor of the shared LyraSize.
import type { ButtonSize as RemovedButtonSize } from '../src/lyra.js';
// @ts-expect-error LyraComboboxSize was removed in favor of the shared LyraSize.
import type { LyraComboboxSize as RemovedLyraComboboxSize } from '../src/lyra.js';
// @ts-expect-error LyraComboboxAppearance was removed in favor of the shared LyraAppearance.
import type { LyraComboboxAppearance as RemovedLyraComboboxAppearance } from '../src/lyra.js';
// @ts-expect-error LyraDateInputSize was removed in favor of the shared LyraSize.
import type { LyraDateInputSize as RemovedLyraDateInputSize } from '../src/lyra.js';
// @ts-expect-error LyraDateInputAppearance was removed in favor of the shared LyraAppearance.
import type { LyraDateInputAppearance as RemovedLyraDateInputAppearance } from '../src/lyra.js';
// @ts-expect-error LyraDatePickerSize was removed in favor of the shared LyraSize.
import type { LyraDatePickerSize as RemovedLyraDatePickerSize } from '../src/lyra.js';
// @ts-expect-error LyraEmojiPickerSize was removed in favor of the shared LyraSize.
import type { LyraEmojiPickerSize as RemovedLyraEmojiPickerSize } from '../src/lyra.js';
// @ts-expect-error LyraInputSize was removed in favor of the shared LyraSize.
import type { LyraInputSize as RemovedLyraInputSize } from '../src/lyra.js';
// @ts-expect-error LyraInputAppearance was removed in favor of the shared LyraAppearance.
import type { LyraInputAppearance as RemovedLyraInputAppearance } from '../src/lyra.js';
// @ts-expect-error LyraPhoneInputSize was removed in favor of the shared LyraSize.
import type { LyraPhoneInputSize as RemovedLyraPhoneInputSize } from '../src/lyra.js';
// @ts-expect-error LyraSelectSize was removed in favor of the shared LyraSize.
import type { LyraSelectSize as RemovedLyraSelectSize } from '../src/lyra.js';
// @ts-expect-error LyraSelectAppearance was removed in favor of the shared LyraAppearance.
import type { LyraSelectAppearance as RemovedLyraSelectAppearance } from '../src/lyra.js';
// @ts-expect-error LyraSwatchPickerSize was removed in favor of the shared LyraSize.
import type { LyraSwatchPickerSize as RemovedLyraSwatchPickerSize } from '../src/lyra.js';
// @ts-expect-error TextareaSize was removed in favor of the shared LyraSize.
import type { TextareaSize as RemovedTextareaSize } from '../src/lyra.js';
// @ts-expect-error TextareaAppearance was removed in favor of the shared LyraAppearance.
import type { TextareaAppearance as RemovedTextareaAppearance } from '../src/lyra.js';
// @ts-expect-error LyraTimeRangeSize was removed in favor of the shared LyraSize.
import type { LyraTimeRangeSize as RemovedLyraTimeRangeSize } from '../src/lyra.js';
// @ts-expect-error LyraTokenInputSize was removed in favor of the shared LyraSize.
import type { LyraTokenInputSize as RemovedLyraTokenInputSize } from '../src/lyra.js';
// @ts-expect-error CardAppearance was removed in favor of the shared LyraAppearance.
import type { CardAppearance as RemovedCardAppearance } from '../src/lyra.js';
// @ts-expect-error LyraModelSelectSize was removed in favor of the shared LyraSize.
import type { LyraModelSelectSize as RemovedLyraModelSelectSize } from '../src/lyra.js';
// @ts-expect-error PhoneCountry was replaced by the canonical LyraPhoneCountry.
import type { PhoneCountry as RemovedPhoneCountry } from '../src/lyra.js';
// @ts-expect-error PhoneInputSelectionDirection was replaced by LyraPhoneInputSelectionDirection.
import type { PhoneInputSelectionDirection as RemovedPhoneInputSelectionDirection } from '../src/lyra.js';
// @ts-expect-error PhoneNumberAdapter was replaced by the canonical LyraPhoneNumberAdapter.
import type { PhoneNumberAdapter as RemovedPhoneNumberAdapter } from '../src/lyra.js';
// @ts-expect-error PhoneNumberParseResult was replaced by LyraPhoneNumberParseResult.
import type { PhoneNumberParseResult as RemovedPhoneNumberParseResult } from '../src/lyra.js';
// @ts-expect-error PhoneNumberStatus was replaced by the canonical LyraPhoneNumberStatus.
import type { PhoneNumberStatus as RemovedPhoneNumberStatus } from '../src/lyra.js';
// @ts-expect-error AttachmentChipStatus was replaced by LyraAttachmentUploadStatus.
import type { AttachmentChipStatus as RemovedAttachmentChipStatus } from '../src/lyra.js';
// @ts-expect-error AttachmentChipIdDetail was replaced by LyraAttachmentIdDetail.
import type { AttachmentChipIdDetail as RemovedAttachmentChipIdDetail } from '../src/lyra.js';
// @ts-expect-error AttachmentChipPreviewDetail was replaced by LyraAttachmentPreviewRequestDetail.
import type { AttachmentChipPreviewDetail as RemovedAttachmentChipPreviewDetail } from '../src/lyra.js';
// @ts-expect-error AttachmentCapability was replaced by LyraAttachmentCapability.
import type { AttachmentCapability as RemovedAttachmentCapability } from '../src/lyra.js';
// @ts-expect-error FileBackedCapability was replaced by LyraFileBackedCapability.
import type { FileBackedCapability as RemovedFileBackedCapability } from '../src/lyra.js';
// @ts-expect-error AttachmentPickDetail was replaced by LyraAttachmentFilesDetail.
import type { AttachmentPickDetail as RemovedAttachmentPickDetail } from '../src/lyra.js';
// @ts-expect-error AttachmentFilesDetail was replaced by LyraAttachmentFilesDetail.
import type { AttachmentFilesDetail as RemovedAttachmentFilesDetail } from '../src/lyra.js';
// @ts-expect-error AvKind was replaced by LyraAvKind.
import type { AvKind as RemovedAvKind } from '../src/lyra.js';
// @ts-expect-error AvPreload was replaced by LyraAvPreload.
import type { AvPreload as RemovedAvPreload } from '../src/lyra.js';
// @ts-expect-error AvCue was replaced by LyraAvCue.
import type { AvCue as RemovedAvCue } from '../src/lyra.js';
// @ts-expect-error AvTrack was replaced by LyraAvTrack.
import type { AvTrack as RemovedAvTrack } from '../src/lyra.js';
// @ts-expect-error AvCueChangeDetail was replaced by LyraAvCueChangeDetail.
import type { AvCueChangeDetail as RemovedAvCueChangeDetail } from '../src/lyra.js';
// @ts-expect-error AudioVisualizerVariant was replaced by AudioVisualizerMode.
import type { AudioVisualizerVariant as RemovedAudioVisualizerVariant } from '../src/lyra.js';
// @ts-expect-error ScrollerOrientation was replaced by the shared LyraOrientation.
import type { ScrollerOrientation as RemovedScrollerOrientation } from '../src/lyra.js';
// @ts-expect-error AvatarSize was replaced by the shared LyraSize.
import type { AvatarSize as RemovedAvatarSize } from '../src/lyra.js';
// @ts-expect-error AvatarShape was replaced by LyraAvatarShape.
import type { AvatarShape as RemovedAvatarShape } from '../src/lyra.js';
// @ts-expect-error AvatarVariant was replaced by the shared LyraVariant.
import type { AvatarVariant as RemovedAvatarVariant } from '../src/lyra.js';
// @ts-expect-error AvatarLoading was replaced by LyraAvatarLoading.
import type { AvatarLoading as RemovedAvatarLoading } from '../src/lyra.js';
// @ts-expect-error AvatarGroupOverflowClickDetail was replaced by LyraAvatarGroupOverflowDetail.
import type { AvatarGroupOverflowClickDetail as RemovedAvatarGroupOverflowClickDetail } from '../src/lyra.js';
// @ts-expect-error ImageFit was replaced by LyraImageFit.
import type { ImageFit as RemovedImageFit } from '../src/lyra.js';
// @ts-expect-error ImageRotation was replaced by LyraImageRotation.
import type { ImageRotation as RemovedImageRotation } from '../src/lyra.js';
// @ts-expect-error ImageRegionRect was replaced by LyraImageRegionRect.
import type { ImageRegionRect as RemovedImageRegionRect } from '../src/lyra.js';
// @ts-expect-error LegendEntry was replaced by LyraMapLegendEntry.
import type { LegendEntry as RemovedLegendEntry } from '../src/lyra.js';
// @ts-expect-error ChoroplethLayer was replaced by LyraMapChoroplethLayer.
import type { ChoroplethLayer as RemovedChoroplethLayer } from '../src/lyra.js';
// @ts-expect-error GeoJsonDataLayer was replaced by LyraMapGeoJsonDataLayer.
import type { GeoJsonDataLayer as RemovedGeoJsonDataLayer } from '../src/lyra.js';
// @ts-expect-error MapMarker was replaced by LyraMapMarker.
import type { MapMarker as RemovedMapMarker } from '../src/lyra.js';
// @ts-expect-error MediaCardFrame was replaced by the shared LyraFrame.
import type { MediaCardFrame as RemovedMediaCardFrame } from '../src/lyra.js';
// @ts-expect-error MediaCardKind was replaced by LyraMediaCardKind.
import type { MediaCardKind as RemovedMediaCardKind } from '../src/lyra.js';
// @ts-expect-error MediaCardOpenDetail was replaced by LyraMediaCardOpenDetail.
import type { MediaCardOpenDetail as RemovedMediaCardOpenDetail } from '../src/lyra.js';
// @ts-expect-error ZoomableFrameLoading was replaced by LyraZoomableFrameLoading.
import type { ZoomableFrameLoading as RemovedZoomableFrameLoading } from '../src/lyra.js';
// @ts-expect-error LyraVideoState was removed in favor of the upstream-compatible VideoState.
import type { LyraVideoState as RemovedLyraVideoState } from '../src/lyra.js';
// @ts-expect-error LyraFileIconVariant was replaced by LyraFileIconMode.
import type { LyraFileIconVariant as RemovedLyraFileIconVariant } from '../src/lyra.js';
// @ts-expect-error SkeletonVariant was replaced by LyraSkeletonShape.
import type { SkeletonVariant as RemovedSkeletonVariant } from '../src/lyra.js';
// @ts-expect-error TableColumnEditable was replaced by TableColumnEditTrigger.
import type { TableColumnEditable as RemovedTableColumnEditable } from '../src/lyra.js';
// @ts-expect-error RejectedFile was replaced by LyraFileInputRejectedFile.
import type { RejectedFile as RemovedRejectedFile } from '../src/lyra.js';
// @ts-expect-error ReorderDetail was replaced by LyraReorderDetail.
import type { ReorderDetail as RemovedReorderDetail } from '../src/lyra.js';
// @ts-expect-error WidgetView was replaced by LyraWidgetView.
import type { WidgetView as RemovedWidgetView } from '../src/lyra.js';
// @ts-expect-error ResponsivePanelMode was replaced by LyraResponsivePanelMode.
import type { ResponsivePanelMode as RemovedResponsivePanelMode } from '../src/lyra.js';
// @ts-expect-error ResponsivePanelEffectiveMode was replaced by LyraResponsivePanelEffectiveMode.
import type { ResponsivePanelEffectiveMode as RemovedResponsivePanelEffectiveMode } from '../src/lyra.js';
// @ts-expect-error ResponsivePanelVariant was replaced by LyraResponsivePanelVariant.
import type { ResponsivePanelVariant as RemovedResponsivePanelVariant } from '../src/lyra.js';
// @ts-expect-error ResponsivePanelCloseReason was replaced by LyraResponsivePanelCloseReason.
import type { ResponsivePanelCloseReason as RemovedResponsivePanelCloseReason } from '../src/lyra.js';
// @ts-expect-error ResponsivePanelModeChangeDetail was replaced by LyraResponsivePanelModeChangeDetail.
import type { ResponsivePanelModeChangeDetail as RemovedResponsivePanelModeChangeDetail } from '../src/lyra.js';
// @ts-expect-error LyraGenerationStatus was replaced by LyraGenerationMetrics.
import type { LyraGenerationStatus as RemovedLyraGenerationStatus } from '../src/lyra.js';
// @ts-expect-error LyraGenerationStatusEventMap was replaced by LyraGenerationMetricsEventMap.
import type { LyraGenerationStatusEventMap as RemovedLyraGenerationStatusEventMap } from '../src/lyra.js';
// @ts-expect-error LyraFlowRunOverlay was replaced by LyraFlowRunStatus.
import type { LyraFlowRunOverlay as RemovedLyraFlowRunOverlay } from '../src/lyra.js';
// @ts-expect-error FlagVariant was replaced by LyraFlagFidelity.
import type { FlagVariant as RemovedFlagVariant } from '../src/lyra.js';
// @ts-expect-error FlagUrlResolver was replaced by LyraFlagUrlResolver.
import type { FlagUrlResolver as RemovedFlagUrlResolver } from '../src/lyra.js';
// @ts-expect-error StepItem was replaced by LyraStepItem.
import type { StepItem as RemovedStepItem } from '../src/lyra.js';
// @ts-expect-error StepState was replaced by LyraStepState.
import type { StepState as RemovedStepState } from '../src/lyra.js';
// @ts-expect-error StepperOrientation was replaced by the shared LyraOrientation.
import type { StepperOrientation as RemovedStepperOrientation } from '../src/lyra.js';
// @ts-expect-error StepperOrientationChangeDetail was replaced by LyraStepperOrientationChangeDetail.
import type { StepperOrientationChangeDetail as RemovedStepperOrientationChangeDetail } from '../src/lyra.js';
// @ts-expect-error OrientationBreakpointBasis was replaced by BreakpointBasis.
import type { OrientationBreakpointBasis as RemovedOrientationBreakpointBasis } from '../src/lyra.js';
// @ts-expect-error SegmentedItem was replaced by LyraSegmentedItem.
import type { SegmentedItem as RemovedSegmentedItem } from '../src/lyra.js';
// @ts-expect-error LyraSegmentedSize was replaced by the shared LyraSize.
import type { LyraSegmentedSize as RemovedLyraSegmentedSize } from '../src/lyra.js';
// @ts-expect-error LyraSplit was renamed to the domain-specific LyraMultiSplit.
import { LyraSplit as removedLyraSplit } from '../src/lyra.js';
// @ts-expect-error PanelConstraint was replaced by LyraMultiSplitPanelConstraint.
import type { PanelConstraint as RemovedPanelConstraint } from '../src/lyra.js';
// @ts-expect-error SplitConstraintIssueReason was replaced by LyraMultiSplitConstraintIssueReason.
import type { SplitConstraintIssueReason as RemovedSplitConstraintIssueReason } from '../src/lyra.js';
// @ts-expect-error SplitConstraintIssueDetail was replaced by LyraMultiSplitConstraintIssueDetail.
import type { SplitConstraintIssueDetail as RemovedSplitConstraintIssueDetail } from '../src/lyra.js';
// @ts-expect-error SplitCollapseMode was replaced by LyraMultiSplitCollapseMode.
import type { SplitCollapseMode as RemovedSplitCollapseMode } from '../src/lyra.js';
// @ts-expect-error SplitCollapseState was replaced by LyraMultiSplitCollapseState.
import type { SplitCollapseState as RemovedSplitCollapseState } from '../src/lyra.js';
// @ts-expect-error SplitCollapseStateInput was replaced by LyraMultiSplitCollapseStateInput.
import type { SplitCollapseStateInput as RemovedSplitCollapseStateInput } from '../src/lyra.js';
// @ts-expect-error SplitCollapseChangeDetail was replaced by LyraMultiSplitCollapseChangeDetail.
import type { SplitCollapseChangeDetail as RemovedSplitCollapseChangeDetail } from '../src/lyra.js';
// @ts-expect-error SplitResizeDetail was replaced by LyraMultiSplitResizeDetail.
import type { SplitResizeDetail as RemovedSplitResizeDetail } from '../src/lyra.js';
// @ts-expect-error SplitOrientation was replaced by the shared LyraOrientation.
import type { SplitOrientation as RemovedSplitOrientation } from '../src/lyra.js';
// @ts-expect-error SplitOrientationChangeDetail was replaced by LyraMultiSplitOrientationChangeDetail.
import type { SplitOrientationChangeDetail as RemovedSplitOrientationChangeDetail } from '../src/lyra.js';
// @ts-expect-error LyraSplitEventMap was replaced by LyraMultiSplitEventMap.
import type { LyraSplitEventMap as RemovedLyraSplitEventMap } from '../src/lyra.js';
// @ts-expect-error DockPanelEdge was replaced by LyraDockPanelEdge.
import type { DockPanelEdge as RemovedDockPanelEdge } from '../src/lyra.js';
// @ts-expect-error DockPanelResizeDetail was replaced by LyraDockPanelResizeDetail.
import type { DockPanelResizeDetail as RemovedDockPanelResizeDetail } from '../src/lyra.js';
// @ts-expect-error DockPanelCollapseChangeDetail was replaced by LyraDockPanelCollapseChangeDetail.
import type { DockPanelCollapseChangeDetail as RemovedDockPanelCollapseChangeDetail } from '../src/lyra.js';
// @ts-expect-error TerminalCell is an internal terminal parsing/rendering detail in v9.
import type { TerminalCell as RemovedTerminalCell } from '../src/lyra.js';
// @ts-expect-error TerminalLine is an internal terminal parsing/rendering detail in v9.
import type { TerminalLine as RemovedTerminalLine } from '../src/lyra.js';
// @ts-expect-error ToolParamFormSchema was renamed to the truthful FlatToolParamSchema.
import type { ToolParamFormSchema as RemovedToolParamFormSchema } from '../src/lyra.js';
// @ts-expect-error global mutation was replaced by createFileTypeMetadataRegistry().
import { registerFileTypeMetadata as removedRegisterFileTypeMetadata } from '../src/lyra.js';
// @ts-expect-error media URL policy is sink-specific implementation detail in v9.
import { safeMediaSrc as removedSafeMediaSrc } from '../src/lyra.js';
// @ts-expect-error link URL policy is sink-specific implementation detail in v9.
import { safeLinkHref as removedSafeLinkHref } from '../src/lyra.js';
// @ts-expect-error the dock-specific CSS-length helper was removed from the curated v9 root.
import { parseLengthPx as removedParseLengthPx } from '../src/lyra.js';
// @ts-expect-error mutable global widget registration was replaced by createWidgetTypeRegistry().
import { registerWidgetType as removedRegisterWidgetType } from '../src/lyra.js';
// @ts-expect-error mutable global widget clearing was removed with the global registry.
import { clearWidgetTypes as removedClearWidgetTypes } from '../src/lyra.js';
// @ts-expect-error the mutable global registry was replaced by DEFAULT_WIDGET_TYPE_REGISTRY.
import { getDefaultWidgetTypeRegistry as removedGetDefaultWidgetTypeRegistry } from '../src/lyra.js';
// @ts-expect-error import-time default mutation was replaced by DEFAULT_WIDGET_TYPE_REGISTRY.
import { registerDefaultWidgetTypes as removedRegisterDefaultWidgetTypes } from '../src/lyra.js';
// @ts-expect-error ChatThread was replaced by the root-safe LyraChatThread authoring name.
import type { ChatThread as RemovedChatThread } from '../src/lyra.js';
// @ts-expect-error WidgetNode was replaced by LyraWidgetNode at the curated root.
import type { WidgetNode as RemovedWidgetNode } from '../src/lyra.js';
// @ts-expect-error WidgetBinding was replaced by LyraWidgetBinding at the curated root.
import type { WidgetBinding as RemovedWidgetBinding } from '../src/lyra.js';
// @ts-expect-error WidgetPropType was replaced by LyraWidgetPropType at the curated root.
import type { WidgetPropType as RemovedWidgetPropType } from '../src/lyra.js';
// @ts-expect-error WidgetInteraction was replaced by LyraWidgetInteraction at the curated root.
import type { WidgetInteraction as RemovedWidgetInteraction } from '../src/lyra.js';
// @ts-expect-error WidgetTypeDefinition was replaced by LyraWidgetTypeDefinition at the curated root.
import type { WidgetTypeDefinition as RemovedWidgetTypeDefinition } from '../src/lyra.js';
// @ts-expect-error WidgetTypeRegistry was replaced by LyraWidgetTypeRegistry at the curated root.
import type { WidgetTypeRegistry as RemovedWidgetTypeRegistry } from '../src/lyra.js';
// @ts-expect-error resolver implementation context is available only from its expert granular entry.
import type { ResolveContext as RemovedRootResolveContext } from '../src/lyra.js';
// @ts-expect-error resolved widget nodes are available only from the resolver expert entry.
import type { ResolvedNode as RemovedRootResolvedNode } from '../src/lyra.js';
// @ts-expect-error resolved widget text is available only from the resolver expert entry.
import type { ResolvedText as RemovedRootResolvedText } from '../src/lyra.js';
// @ts-expect-error resolved widget elements are available only from the resolver expert entry.
import type { ResolvedElement as RemovedRootResolvedElement } from '../src/lyra.js';
// @ts-expect-error widget tree resolution is available only from the resolver expert entry.
import { resolveTree as removedRootResolveTree } from '../src/lyra.js';
// @ts-expect-error widget pointer resolution is available only from the resolver expert entry.
import { readWidgetPointer as removedRootReadWidgetPointer } from '../src/lyra.js';
// @ts-expect-error resolver depth limits are available only from the resolver expert entry.
import { WIDGET_MAX_DEPTH as removedRootWidgetMaxDepth } from '../src/lyra.js';
// @ts-expect-error resolver node limits are available only from the resolver expert entry.
import { WIDGET_MAX_NODES as removedRootWidgetMaxNodes } from '../src/lyra.js';
// @ts-expect-error resolver prop limits are available only from the resolver expert entry.
import { WIDGET_MAX_PROPS_PER_NODE as removedRootWidgetMaxPropsPerNode } from '../src/lyra.js';
// @ts-expect-error resolver warning limits are available only from the resolver expert entry.
import { WIDGET_MAX_WARNINGS as removedRootWidgetMaxWarnings } from '../src/lyra.js';

declare const removedV9Aliases: [
  RemovedActivityEntryTone,
  RemovedConfirmBarTone,
  RemovedChipTone,
  RemovedContextMeterVariant,
  RemovedGaugeType,
  RemovedLyraSparklineType,
  RemovedLyraPaginationAppearance,
  RemovedLyraPaginationSize,
  RemovedBrowserFrameStatus,
  RemovedBrowserFramePhase,
  RemovedStreamStatusPhase,
  RemovedGraphLink,
  RemovedGraphNode,
  RemovedGraphNodeType,
  RemovedLyraGraphNodeStyle,
  RemovedLyraGraphLegendType,
  RemovedLyraDrilldownNodeTypeStyle,
  RemovedLyraPlayback,
  RemovedLyraPlaybackEventMap,
  RemovedStatVariant,
  RemovedStatAppearance,
  RemovedSourceCardAppearance,
  RemovedTypingIndicatorVariant,
  RemovedTimelineItemVariant,
  RemovedTimelineOrientation,
  RemovedWordCloudOrientations,
  RemovedCsvColumn,
  RemovedDateParts,
  RemovedDiffOp,
  RemovedExportFormat,
  RemovedExportFormatDescriptor,
  RemovedExportFormatOption,
  RemovedLiveRegionMode,
  RemovedLyraKnownDateSize,
  RemovedMentionFilter,
  RemovedMentionItem,
  RemovedMentionSelectDetail,
  RemovedPromptInputAttachment,
  RemovedPromptSuggestion,
  RemovedChatSuggestion,
  RemovedTourEndReason,
  RemovedTourStep,
  RemovedTourTarget,
  RemovedAnimationCleanup,
  RemovedElementAnimation,
  RemovedGetAnimationOptions,
  RemovedResolvedElementAnimation,
  RemovedTreeItem,
  RemovedTreeBadgeTone,
  RemovedLyraLocalePickerSize,
  RemovedLyraColorPickerSize,
  RemovedButtonSize,
  RemovedLyraComboboxSize,
  RemovedLyraComboboxAppearance,
  RemovedLyraDateInputSize,
  RemovedLyraDateInputAppearance,
  RemovedLyraDatePickerSize,
  RemovedLyraEmojiPickerSize,
  RemovedLyraInputSize,
  RemovedLyraInputAppearance,
  RemovedLyraPhoneInputSize,
  RemovedLyraSelectSize,
  RemovedLyraSelectAppearance,
  RemovedLyraSwatchPickerSize,
  RemovedTextareaSize,
  RemovedTextareaAppearance,
  RemovedLyraTimeRangeSize,
  RemovedLyraTokenInputSize,
  RemovedCardAppearance,
  RemovedLyraModelSelectSize,
  RemovedPhoneCountry,
  RemovedPhoneInputSelectionDirection,
  RemovedPhoneNumberAdapter,
  RemovedPhoneNumberParseResult,
  RemovedPhoneNumberStatus,
  RemovedAttachmentChipStatus,
  RemovedAttachmentChipIdDetail,
  RemovedAttachmentChipPreviewDetail,
  RemovedAttachmentCapability,
  RemovedFileBackedCapability,
  RemovedAttachmentPickDetail,
  RemovedAttachmentFilesDetail,
  RemovedAvKind,
  RemovedAvPreload,
  RemovedAvCue,
  RemovedAvTrack,
  RemovedAvCueChangeDetail,
  RemovedAudioVisualizerVariant,
  RemovedScrollerOrientation,
  RemovedAvatarSize,
  RemovedAvatarShape,
  RemovedAvatarVariant,
  RemovedAvatarLoading,
  RemovedAvatarGroupOverflowClickDetail,
  RemovedImageFit,
  RemovedImageRotation,
  RemovedImageRegionRect,
  RemovedLegendEntry,
  RemovedChoroplethLayer,
  RemovedGeoJsonDataLayer,
  RemovedMapMarker,
  RemovedMediaCardFrame,
  RemovedMediaCardKind,
  RemovedMediaCardOpenDetail,
  RemovedZoomableFrameLoading,
  RemovedLyraVideoState,
  RemovedLyraFileIconVariant,
  RemovedSkeletonVariant,
  RemovedTableColumnEditable,
  RemovedRejectedFile,
  RemovedReorderDetail,
  RemovedWidgetView,
  RemovedResponsivePanelMode,
  RemovedResponsivePanelEffectiveMode,
  RemovedResponsivePanelVariant,
  RemovedResponsivePanelCloseReason,
  RemovedResponsivePanelModeChangeDetail,
  RemovedLyraGenerationStatus,
  RemovedLyraGenerationStatusEventMap,
  RemovedLyraFlowRunOverlay,
  RemovedFlagVariant,
  RemovedFlagUrlResolver,
  RemovedStepItem,
  RemovedStepState,
  RemovedStepperOrientation,
  RemovedStepperOrientationChangeDetail,
  RemovedOrientationBreakpointBasis,
  RemovedSegmentedItem,
  RemovedLyraSegmentedSize,
  RemovedPanelConstraint,
  RemovedSplitConstraintIssueReason,
  RemovedSplitConstraintIssueDetail,
  RemovedSplitCollapseMode,
  RemovedSplitCollapseState,
  RemovedSplitCollapseStateInput,
  RemovedSplitCollapseChangeDetail,
  RemovedSplitResizeDetail,
  RemovedSplitOrientation,
  RemovedSplitOrientationChangeDetail,
  RemovedLyraSplitEventMap,
  RemovedDockPanelEdge,
  RemovedDockPanelResizeDetail,
  RemovedDockPanelCollapseChangeDetail,
  RemovedTerminalCell,
  RemovedTerminalLine,
  RemovedToolParamFormSchema,
  RemovedChatThread,
  RemovedWidgetNode,
  RemovedWidgetBinding,
  RemovedWidgetPropType,
  RemovedWidgetInteraction,
  RemovedWidgetTypeDefinition,
  RemovedWidgetTypeRegistry,
  RemovedRootResolveContext,
  RemovedRootResolvedNode,
  RemovedRootResolvedText,
  RemovedRootResolvedElement,
];
void removedV9Aliases;
void removedLyraSplit;
void removedRegisterFileTypeMetadata;
void removedSafeMediaSrc;
void removedSafeLinkHref;
void removedParseLengthPx;
void removedRegisterWidgetType;
void removedClearWidgetTypes;
void removedGetDefaultWidgetTypeRegistry;
void removedRegisterDefaultWidgetTypes;
void removedRootResolveTree;
void removedRootReadWidgetPointer;
void removedRootWidgetMaxDepth;
void removedRootWidgetMaxNodes;
void removedRootWidgetMaxPropsPerNode;
void removedRootWidgetMaxWarnings;

// Registration-free package-root reachability for public property/configuration types. Keeping
// them in one tuple makes an accidental removal fail `test:types` even when the same name remains
// reachable from a granular component entry.
const rootPublicTypes:
  | [
      LyraBreadcrumbItemTarget,
      AgentRunActivateDetail,
      AgentStatusPresentation,
      AgentStatusValue,
      ApprovalAction,
      ApprovalDecision,
      AudioVisualizerMode,
      AudioVisualizerState,
      BadgeSize,
      BadgeVariant,
      BreakpointBasis,
      CalloutAppearance,
      CalloutSize,
      CategoryRubricKey,
      ChatMessageActionsPosition,
      ChatMessageToggleDetail,
      ChipSize,
      ChipVariant,
      ComboboxSourceResult,
      CommentRubricKey,
      ContextMeterShape,
      ConversationItemSelectDetail,
      DataGridGroupDetail,
      DataGridJsonValue,
      DataGridStateFilter,
      DirectDocumentRendererDefinition,
      DocumentFile,
      DocumentViewerCloseReason,
      DocumentLibrarySortCommitDetail,
      DocumentLibrarySortDetail,
      DocumentLibrarySortRequestDetail,
      DocumentRendererDefinition,
      DocumentRendererRegistry,
      EffectiveKbdPlatform,
      EvalContent,
      EvalContentFormat,
      LyraFormatBytesUnit,
      LyraFormatDisplay,
      EvalCitationSelectDetail,
      EvalClaimSelectDetail,
      EvalExampleToggleDetail,
      EvalToolActivateDetail,
      EvalToolApprovalDetail,
      EvalToolRenderErrorDetail,
      FlatToolParamSchema,
      GaugeShape,
      GenerationMetricsStatus,
      HeatmapCalendarData,
      HeatmapData,
      HeatmapMatrixData,
      LyraHeatmapStickyLabels,
      LyraCarouselOrientation,
      LyraAppearance,
      LyraAnimationCleanup,
      LyraAnimationCatalog,
      LyraAnimationEasingName,
      LyraAvCue,
      LyraAvCueChangeDetail,
      LyraAvKind,
      LyraAvPlayerEventMap,
      LyraAvPreload,
      LyraAvTrack,
      LyraAvatarErrorDetail,
      LyraAvatarGroupOverflowDetail,
      LyraAvatarLoading,
      LyraAvatarShape,
      LyraAttachmentCapability,
      LyraAttachmentChipEventMap,
      LyraAttachmentFilesDetail,
      LyraAttachmentIdDetail,
      LyraAttachmentPreviewRequestDetail,
      LyraAttachmentTriggerEventMap,
      LyraAttachmentUploadStatus,
      LyraChartArea,
      LyraChartChromeLegendPosition,
      LyraChartDatumActivateDetail,
      LyraChartDatumKind,
      LyraChartFormatSurface,
      LyraChartFormatter,
      LyraChartFormatterContext,
      LyraChartInstance,
      LyraChartPoint,
      LyraChartPreloadOptions,
      LyraChartPreloadResult,
      LyraChartSeries,
      LyraChartConfiguration,
      LyraChartDataConfiguration,
      LyraChartDatasetConfiguration,
      LyraChartPlugin,
      LyraChartValueFormatter,
      LyraChartValueFormatterContext,
      LyraChatSuggestion,
      LyraClipboardWriteFailure,
      LyraClipboardWriteOutcome,
      LyraClipboardWriteSuccess,
      LyraComboboxPlacement,
      LyraComboboxTagRenderer,
      LyraCsvColumn,
      LyraDatePickerFirstDayOfWeek,
      LyraDashboardCell,
      LyraDashboardCellMoveDetail,
      LyraDashboardCellResizeDetail,
      LyraDashboardCollisionDetail,
      LyraDashboardCollisionPolicy,
      LyraDashboardGridEventMap,
      LyraDashboardLayoutChangeDetail,
      LyraDashboardPlacementResult,
      LyraDiffOp,
      LyraDockPanelCollapseChangeDetail,
      LyraDockPanelEdge,
      LyraDockPanelEventMap,
      LyraDockPanelResizeDetail,
      LyraExportFormat,
      LyraExportFormatDescriptor,
      LyraExportFormatOption,
      LyraFileBackedCapability,
      LyraFileIconMode,
      LyraFileInputCapture,
      LyraFileInputFilesDetail,
      LyraFileInputRejectedFile,
      LyraFileTypeMetadata,
      LyraFileTypeMetadataEntry,
      LyraFileTypeMetadataRegistry,
      LyraFlagFidelity,
      LyraFlagShape,
      LyraFlagUrlResolver,
      LyraFrame,
      LyraFlowRunStatus,
      LyraFormValidator<{
        readonly validity: ValidityState;
        readonly validationMessage: string;
      }>,
      LyraFormValidatorResult,
      LyraGeoJsonViewerEventMap,
      LyraGeojsonView,
      LyraGeojsonViewEventMap,
      LyraGenerationMetrics,
      LyraGenerationMetricsEventMap,
      LyraGraphLink,
      LyraGraphNode,
      LyraGetAnimationOptions,
      LyraImageComparerOrientation,
      LyraImageViewerEventMap,
      LyraLightboxCloseReason,
      LyraLightboxHideDetail,
      LyraKnownDateParts,
      LyraLiteChartScale,
      LyraLiteChartSeries,
      LyraBoxPlotSeries,
      LyraBoxPlotSummary,
      LyraMapChoroplethLayer,
      LyraMapGeoJsonDataLayer,
      LyraMapLegendEntry,
      LyraMapLegendPattern,
      LyraMapLegendProjection,
      LyraMapMarker,
      LyraMarkedParser,
      LyraMediaCardKind,
      LyraMediaCardOpenDetail,
      LyraMirrorAnimationName,
      LyraElementAnimation,
      LyraLiveRegionMode,
      LyraMentionFilter,
      LyraMentionFocusOptions,
      LyraMentionItem,
      LyraMentionSelectDetail,
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
      LyraNodeTypeStyle,
      LyraOrientation,
      LyraPageViewerSnapshot,
      LyraPageViewerStateChangeDetail,
      LyraPageViewerStatus,
      LyraPhoneCountry,
      LyraPhoneInputSelectionDirection,
      LyraPhoneNumberAdapter,
      LyraPhoneNumberParseResult,
      LyraPhoneNumberStatus,
      LyraPopupRole,
      LyraPromptInputAttachment,
      LyraPromptInputEventMap,
      LyraPromptSuggestion,
      LyraRagEvalDashboardEventMap,
      LyraResponsivePanelCloseReason,
      LyraResponsivePanelEffectiveMode,
      LyraResponsivePanelMode,
      LyraResponsivePanelModeChangeDetail,
      LyraResponsivePanelVariant,
      LyraRetrievalCompareEventMap,
      LyraSegmentedItem,
      LyraSequencePlaybackEventMap,
      LyraSequencePlaybackStepDetail,
      LyraSkeletonShape,
      LyraSparklineMark,
      LyraSpanKind,
      LyraSpanProjection,
      LyraSpanStatus,
      LyraStepItem,
      LyraStepperOrientationChangeDetail,
      LyraStepState,
      LyraStreamPhase,
      LyraScoreThresholds,
      LyraSize,
      LyraCodeEditorResize,
      LyraCodeEditorWrap,
      LyraToolbarAction,
      LyraToolbarActionProvider,
      LyraToastIcon,
      LyraToastIconContent,
      LyraToastOptions,
      LyraTreeNodeData,
      LyraTourEndReason,
      LyraTourStep,
      LyraTourTarget,
      LyraVariant,
      LyraViewerDiagnostic,
      LyraViewerDiagnosticCode,
      LyraViewerDiagnosticEventDetail,
      LyraViewerDiagnosticSeverity,
      MarkdownHeadingItem,
      MarkdownHtmlMode,
      Marked,
      McpAppResource,
      McpAppToolResultOptions,
      LazyDocumentRendererDefinition,
      DirectToolRendererDefinition,
      LazyToolRendererDefinition,
      MenuItemSelectDetail,
      MenuItemStateChangeDetail,
      MenuItemVariant,
      MessageFeedbackRating,
      MessageFeedbackDetailConfiguration,
      MessageFeedbackDetailFor,
      MessageFeedbackSubmitDetail,
      MessageFeedbackValue,
      OtpInputSelectionDirection,
      PageThumbnailRenderHandle,
      PageThumbnailSource,
      OverlayVirtualRect,
      PlaceAutoSize,
      PlaceBoundary,
      PlaceFlipFallbackStrategy,
      PlaceStrategy,
      PlaceSync,
      RadioAppearance,
      RadioGroupOrientation,
      LyraRagEvaluationMetric,
      LyraRagEvaluationMetricCategory,
      LyraRagEvaluationMetricFormat,
      LyraRagEvaluationRun,
      ResultCardAppearance,
      RetrievalComparisonSet,
      ResolveCssLengthOptions,
      ScoreRubricKey,
      ShikiLanguageInput,
      StackTraceParseOptions,
      StackTraceParseResult,
      StreamingTextContentMode,
      ToolResultFallback,
      SwatchPickerItem,
      StreamConnectionState,
      TagVariant,
      TableColumnEditTrigger,
      TableEdgeAlign,
      TableSelectionMode,
      TableSortCommitDetail,
      TableSortDetail,
      TableSortDirection,
      TableSortMode,
      TableSortRequestDetail,
      TaskListAppearance,
      TestRunState,
      ThinkingPanelAppearance,
      ToolTimelineActivateDetail,
      ToolTimelineRenderErrorDetail,
      TypingIndicatorShape,
      TreeBadge,
      TreeSelection,
      LyraRatingSize,
      LyraReorderDetail,
      LyraResolvedElementAnimation,
      LyraResolvedFileTypeMetadata,
      LyraAdaptedDocumentRenderer,
      LyraAdaptedDocumentRendererDefinition,
      LyraAvDocumentRendererPayload,
      LyraDocumentFile,
      LyraDocumentRendererAdapter,
      LyraDocumentRendererAdapterDefinition<LyraDocumentRendererPayloadKind>,
      LyraDocumentRendererDefinition,
      LyraDocumentRendererPayload,
      LyraDocumentRendererPayloadFor<LyraDocumentRendererPayloadKind>,
      LyraGenericDocumentRendererPayload,
      LyraResolvedDocumentRendererDefinition,
      LyraTimestamp,
      LyraChatThread,
      LyraWidgetBinding,
      LyraWidgetDocument,
      LyraWidgetInteraction,
      LyraWidgetNode,
      LyraWidgetPropType,
      LyraWidgetTypeDefinition,
      LyraWidgetTypeRegistry,
      LyraZoomableFrameLoading,
      PushToTalkAudioConstraints,
      LyraToastSize,
      LyraVirtualListIndexedSource,
      LyraVirtualListRowHeight,
      LyraVirtualListSource,
      VirtualAnchor,
      VideoState,
      LyraWidgetView,
      LyraImageFit,
      LyraImageRegionRect,
      LyraImageRotation,
      KbdPlatform,
      LyraViewerSource<unknown>,
      WordCloudLegendItem,
      WordCloudRotation,
      WordCloudScale
    ]
  | undefined = undefined;

void rootPublicTypes;
void adaptDocumentRenderer;
void agentStatusKind;
void agentStatusLabel;
void agentStatusMessage;
void agentStatusVariant;
void animations;
void approvalAction;
void approvalDecision;
void createDocumentRendererAdapter;
void createDocumentRendererRegistry;
void createFileTypeMetadataRegistry;
void createWidgetDocument;
void createWidgetTypeRegistry;
void DEFAULT_WIDGET_TYPE_REGISTRY;
void defaultFileTypeMetadataRegistry;
void findDocumentRenderer;
void getAnimationNames;
void getDefaultDocumentRendererRegistry;
void getEasingNames;
void getFileTypeMetadata;
void IMAGE_VIEWER_HIGHLIGHT_LIMIT;
void looksLikeMarkdown;
void LyraDashboardGrid;
void LyraGeoJsonViewer;
void LyraMultiSplit;
void LyraPromptInput;
void LyraRagEvalDashboard;
void LyraRetrievalCompare;
void LyraSequencePlayback;
void LYRA_ANIMATION_NAMES;
void LYRA_EASINGS;
void DEFAULT_MAX_FILE_SIZE_BYTES;
void isAgentStatusActive;
void isAgentStatusTerminal;
void isLyraToolbarActionProvider;
void MAX_RENDERED_LYRA_SPANS;
void normalizeLyraSpanKind;
void normalizeLyraSpans;
void normalizeLyraSpanStatus;
void loadDocumentRenderer;
void preloadCharts;
void preloadMarkdown;
const resolvedCssLength: number | undefined = resolveCssLength('50%', {
  percentBase: 320,
  viewportBasis: { inlineSize: 320, blockSize: 240 },
});
void resolvedCssLength;
void resolveLyraDashboardPlacement;
void resolveResponsivePanelEffectiveMode;
void registerDocumentRenderer;
void setFlagUrlResolver;
void SNAP_NONE;
void STACK_TRACE_LIMITS;
void snapshotLyraDocumentRendererPayload;
void isWidgetTypeRegistry;

const mirroredTokenSpellings: [BadgeVariant, BadgeSize, TagVariant, LyraRatingSize, LyraToastSize] = [
  'primary',
  'small',
  'text',
  'medium',
  'large',
];
void mirroredTokenSpellings;

declare const treeItem: LyraTreeItem;
// @ts-expect-error Tree owner state is private in v9.
void treeItem.activeId;
// @ts-expect-error Tree owner state is private in v9.
void treeItem.ancestry;
// @ts-expect-error Tree owner state is private in v9.
void treeItem.depth;
// @ts-expect-error Tree owner state is private in v9.
void treeItem.setSize;
// @ts-expect-error Tree owner state is private in v9.
void treeItem.posInSet;
// @ts-expect-error Tree owner coordination is not a public component method in v9.
void treeItem.setTreeContext;
// @ts-expect-error Tree owner coordination is not a public component method in v9.
void treeItem.setTreeIdentityContext;
// @ts-expect-error Tree owner coordination is not a public component method in v9.
void treeItem.setSelectionState;

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
