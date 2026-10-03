// GENERATED FILE — do not edit by hand. Opt-in React 19 and JSX custom-element declarations.
// Regenerate with `pnpm --filter @aceshooting/lyra-ui run framework-types`.
// This module contains types only; its emitted JavaScript is an empty module.
import type * as React from 'react';
import type { LyraComponentTypeMap, LyraBoundEvent, LyraCSSCustomProperties } from './framework-types.js';
export type { LyraUnknownAttributeValue, LyraAttributeValue, LyraCSSCustomProperties } from './framework-types.js';

type LyraReactEventProps<
  ElementType extends HTMLElement,
  ElementEvents extends object,
  EventNames extends string,
> = {
  [Name in EventNames as `on${Name}`]?: (
    event: LyraBoundEvent<ElementType, ElementEvents, Name>,
  ) => void;
} & {
  [Name in EventNames as `on${Name}Capture`]?: (
    event: LyraBoundEvent<ElementType, ElementEvents, Name>,
  ) => void;
};

type LyraReactElementProps<
  Tag extends keyof LyraComponentTypeMap,
  ElementType extends HTMLElement = LyraComponentTypeMap[Tag]['element'],
  Properties extends object = LyraComponentTypeMap[Tag]['properties'],
  ElementEvents extends object = LyraComponentTypeMap[Tag]['events'],
  EventNames extends string = LyraComponentTypeMap[Tag]['eventNames'],
  CSSNames extends string = LyraComponentTypeMap[Tag]['cssNames'],
  AttributeAliases extends object = LyraComponentTypeMap[Tag]['attributeAliases'],
> = Omit<
  React.HTMLAttributes<ElementType>,
  keyof Properties | keyof AttributeAliases | keyof LyraReactEventProps<ElementType, ElementEvents, EventNames> | 'style'
> &
  React.RefAttributes<ElementType> &
  Properties &
  AttributeAliases &
  LyraReactEventProps<ElementType, ElementEvents, EventNames> & {
    style?: React.CSSProperties & LyraCSSCustomProperties<CSSNames>;
  };

export type LyraAccordionReactProps = LyraReactElementProps<'lr-accordion'>;

export type LyraAccordionItemReactProps = LyraReactElementProps<'lr-accordion-item'>;

export type LyraActivityFeedReactProps = LyraReactElementProps<'lr-activity-feed'>;

export type LyraAgentEvalDashboardReactProps = LyraReactElementProps<'lr-agent-eval-dashboard'>;

export type LyraAgentQuestionReactProps = LyraReactElementProps<'lr-agent-question'>;

export type LyraAgentRunReactProps = LyraReactElementProps<'lr-agent-run'>;

export type LyraAgentTraceReactProps = LyraReactElementProps<'lr-agent-trace'>;

export type LyraAgentWorkspaceReactProps = LyraReactElementProps<'lr-agent-workspace'>;

export type LyraAlertReactProps = LyraReactElementProps<'lr-alert'>;

export type LyraAnimatedImageReactProps = LyraReactElementProps<'lr-animated-image'>;

export type LyraAnimationReactProps = LyraReactElementProps<'lr-animation'>;

export type LyraAppRailReactProps = LyraReactElementProps<'lr-app-rail'>;

export type LyraAppRailGroupReactProps = LyraReactElementProps<'lr-app-rail-group'>;

export type LyraAppRailItemReactProps = LyraReactElementProps<'lr-app-rail-item'>;

export type LyraApprovalQueueReactProps = LyraReactElementProps<'lr-approval-queue'>;

export type LyraArchiveViewerReactProps = LyraReactElementProps<'lr-archive-viewer'>;

export type LyraArtifactPanelReactProps = LyraReactElementProps<'lr-artifact-panel'>;

export type LyraAttachmentChipReactProps = LyraReactElementProps<'lr-attachment-chip'>;

export type LyraAttachmentTriggerReactProps = LyraReactElementProps<'lr-attachment-trigger'>;

export type LyraAudioVisualizerReactProps = LyraReactElementProps<'lr-audio-visualizer'>;

export type LyraAvPlayerReactProps = LyraReactElementProps<'lr-av-player'>;

export type LyraAvatarReactProps = LyraReactElementProps<'lr-avatar'>;

export type LyraAvatarGroupReactProps = LyraReactElementProps<'lr-avatar-group'>;

export type LyraBackgroundRunsReactProps = LyraReactElementProps<'lr-background-runs'>;

export type LyraBadgeReactProps = LyraReactElementProps<'lr-badge'>;

export type LyraBarChartReactProps = LyraReactElementProps<'lr-bar-chart'>;

export type LyraBoxPlotReactProps = LyraReactElementProps<'lr-box-plot'>;

export type LyraBranchPickerReactProps = LyraReactElementProps<'lr-branch-picker'>;

export type LyraBreadcrumbReactProps = LyraReactElementProps<'lr-breadcrumb'>;

export type LyraBreadcrumbItemReactProps = LyraReactElementProps<'lr-breadcrumb-item'>;

export type LyraBrowserFrameReactProps = LyraReactElementProps<'lr-browser-frame'>;

export type LyraBubbleChartReactProps = LyraReactElementProps<'lr-bubble-chart'>;

export type LyraBudgetMeterReactProps = LyraReactElementProps<'lr-budget-meter'>;

export type LyraButtonReactProps = LyraReactElementProps<'lr-button'>;

export type LyraButtonGroupReactProps = LyraReactElementProps<'lr-button-group'>;

export type LyraCalendarReactProps = LyraReactElementProps<'lr-calendar'>;

export type LyraCalendarViewerReactProps = LyraReactElementProps<'lr-calendar-viewer'>;

export type LyraCalloutReactProps = LyraReactElementProps<'lr-callout'>;

export type LyraCardReactProps = LyraReactElementProps<'lr-card'>;

export type LyraCarouselReactProps = LyraReactElementProps<'lr-carousel'>;

export type LyraCarouselItemReactProps = LyraReactElementProps<'lr-carousel-item'>;

export type LyraChangeReviewReactProps = LyraReactElementProps<'lr-change-review'>;

export type LyraChartReactProps = LyraReactElementProps<'lr-chart'>;

export type LyraChatComposerReactProps = LyraReactElementProps<'lr-chat-composer'>;

export type LyraChatMessageReactProps = LyraReactElementProps<'lr-chat-message'>;

export type LyraChatViewportReactProps = LyraReactElementProps<'lr-chat-viewport'>;

export type LyraCheckboxReactProps = LyraReactElementProps<'lr-checkbox'>;

export type LyraCheckboxGroupReactProps = LyraReactElementProps<'lr-checkbox-group'>;

export type LyraCheckpointReactProps = LyraReactElementProps<'lr-checkpoint'>;

export type LyraChipReactProps = LyraReactElementProps<'lr-chip'>;

export type LyraChipGroupReactProps = LyraReactElementProps<'lr-chip-group'>;

export type LyraChunkInspectorReactProps = LyraReactElementProps<'lr-chunk-inspector'>;

export type LyraCitationBadgeReactProps = LyraReactElementProps<'lr-citation-badge'>;

export type LyraClaimEvidenceReactProps = LyraReactElementProps<'lr-claim-evidence'>;

export type LyraCodeBlockReactProps = LyraReactElementProps<'lr-code-block'>;

export type LyraCodeBlockCoreReactProps = LyraReactElementProps<'lr-code-block-core'>;

export type LyraCodeEditorReactProps = LyraReactElementProps<'lr-code-editor'>;

export type LyraColorPickerReactProps = LyraReactElementProps<'lr-color-picker'>;

export type LyraComboboxReactProps = LyraReactElementProps<'lr-combobox'>;

export type LyraCommandPaletteReactProps = LyraReactElementProps<'lr-command-palette'>;

export type LyraCommitCardReactProps = LyraReactElementProps<'lr-commit-card'>;

export type LyraCommunityCardReactProps = LyraReactElementProps<'lr-community-card'>;

export type LyraComparePanelReactProps = LyraReactElementProps<'lr-compare-panel'>;

export type LyraConditionBuilderReactProps = LyraReactElementProps<'lr-condition-builder'>;

export type LyraConfirmBarReactProps = LyraReactElementProps<'lr-confirm-bar'>;

export type LyraConnectorManagerReactProps = LyraReactElementProps<'lr-connector-manager'>;

export type LyraContactViewerReactProps = LyraReactElementProps<'lr-contact-viewer'>;

export type LyraContextInspectorReactProps = LyraReactElementProps<'lr-context-inspector'>;

export type LyraContextMenuReactProps = LyraReactElementProps<'lr-context-menu'>;

export type LyraContextMeterReactProps = LyraReactElementProps<'lr-context-meter'>;

export type LyraControlGroupReactProps = LyraReactElementProps<'lr-control-group'>;

export type LyraConversationItemReactProps = LyraReactElementProps<'lr-conversation-item'>;

export type LyraCopyButtonReactProps = LyraReactElementProps<'lr-copy-button'>;

export type LyraCountryPickerReactProps = LyraReactElementProps<'lr-country-picker'>;

export type LyraCsvViewerReactProps = LyraReactElementProps<'lr-csv-viewer'>;

export type LyraCurrencyPickerReactProps = LyraReactElementProps<'lr-currency-picker'>;

export type LyraDashboardGridReactProps = LyraReactElementProps<'lr-dashboard-grid'>;

export type LyraDataGridReactProps = LyraReactElementProps<'lr-data-grid'>;

export type LyraDatasetViewerReactProps = LyraReactElementProps<'lr-dataset-viewer'>;

export type LyraDateInputReactProps = LyraReactElementProps<'lr-date-input'>;

export type LyraDatePickerReactProps = LyraReactElementProps<'lr-date-picker'>;

export type LyraDetailsReactProps = LyraReactElementProps<'lr-details'>;

export type LyraDialogReactProps = LyraReactElementProps<'lr-dialog'>;

export type LyraDiffViewReactProps = LyraReactElementProps<'lr-diff-view'>;

export type LyraDividerReactProps = LyraReactElementProps<'lr-divider'>;

export type LyraDockPanelReactProps = LyraReactElementProps<'lr-dock-panel'>;

export type LyraDocumentCompareReactProps = LyraReactElementProps<'lr-document-compare'>;

export type LyraDocumentLibraryReactProps = LyraReactElementProps<'lr-document-library'>;

export type LyraDocumentPreviewReactProps = LyraReactElementProps<'lr-document-preview'>;

export type LyraDocumentViewerReactProps = LyraReactElementProps<'lr-document-viewer'>;

export type LyraDocxViewerReactProps = LyraReactElementProps<'lr-docx-viewer'>;

export type LyraDoughnutChartReactProps = LyraReactElementProps<'lr-doughnut-chart'>;

export type LyraDrawerReactProps = LyraReactElementProps<'lr-drawer'>;

export type LyraDrilldownPanelReactProps = LyraReactElementProps<'lr-drilldown-panel'>;

export type LyraDropZoneReactProps = LyraReactElementProps<'lr-drop-zone'>;

export type LyraDropdownReactProps = LyraReactElementProps<'lr-dropdown'>;

export type LyraDropdownItemReactProps = LyraReactElementProps<'lr-dropdown-item'>;

export type LyraEbookViewerReactProps = LyraReactElementProps<'lr-ebook-viewer'>;

export type LyraEmailViewerReactProps = LyraReactElementProps<'lr-email-viewer'>;

export type LyraEmbeddingExplorerReactProps = LyraReactElementProps<'lr-embedding-explorer'>;

export type LyraEmojiPickerReactProps = LyraReactElementProps<'lr-emoji-picker'>;

export type LyraEmptyReactProps = LyraReactElementProps<'lr-empty'>;

export type LyraEntityCardReactProps = LyraReactElementProps<'lr-entity-card'>;

export type LyraEntityChipReactProps = LyraReactElementProps<'lr-entity-chip'>;

export type LyraEntityDossierReactProps = LyraReactElementProps<'lr-entity-dossier'>;

export type LyraEnvListReactProps = LyraReactElementProps<'lr-env-list'>;

export type LyraEvalDatasetReactProps = LyraReactElementProps<'lr-eval-dataset'>;

export type LyraEvalResultReactProps = LyraReactElementProps<'lr-eval-result'>;

export type LyraEvalRunReactProps = LyraReactElementProps<'lr-eval-run'>;

export type LyraExportButtonReactProps = LyraReactElementProps<'lr-export-button'>;

export type LyraFileIconReactProps = LyraReactElementProps<'lr-file-icon'>;

export type LyraFileInputReactProps = LyraReactElementProps<'lr-file-input'>;

export type LyraFileTreeReactProps = LyraReactElementProps<'lr-file-tree'>;

export type LyraFilterBarReactProps = LyraReactElementProps<'lr-filter-bar'>;

export type LyraFlagReactProps = LyraReactElementProps<'lr-flag'>;

export type LyraFlowCanvasReactProps = LyraReactElementProps<'lr-flow-canvas'>;

export type LyraFlowControlsReactProps = LyraReactElementProps<'lr-flow-controls'>;

export type LyraFlowMinimapReactProps = LyraReactElementProps<'lr-flow-minimap'>;

export type LyraFlowNodeReactProps = LyraReactElementProps<'lr-flow-node'>;

export type LyraFlowRunStatusReactProps = LyraReactElementProps<'lr-flow-run-status'>;

export type LyraFormatBytesReactProps = LyraReactElementProps<'lr-format-bytes'>;

export type LyraFormatDateReactProps = LyraReactElementProps<'lr-format-date'>;

export type LyraFormatNumberReactProps = LyraReactElementProps<'lr-format-number'>;

export type LyraFunnelReactProps = LyraReactElementProps<'lr-funnel'>;

export type LyraGaugeReactProps = LyraReactElementProps<'lr-gauge'>;

export type LyraGenerationMetricsReactProps = LyraReactElementProps<'lr-generation-metrics'>;

export type LyraGeoJsonViewerReactProps = LyraReactElementProps<'lr-geojson-viewer'>;

export type LyraGraphReactProps = LyraReactElementProps<'lr-graph'>;

export type LyraGraphLegendReactProps = LyraReactElementProps<'lr-graph-legend'>;

export type LyraGraphQueryBuilderReactProps = LyraReactElementProps<'lr-graph-query-builder'>;

export type LyraGroundingSummaryReactProps = LyraReactElementProps<'lr-grounding-summary'>;

export type LyraHandoffDividerReactProps = LyraReactElementProps<'lr-handoff-divider'>;

export type LyraHeatmapReactProps = LyraReactElementProps<'lr-heatmap'>;

export type LyraHighlightLayerReactProps = LyraReactElementProps<'lr-highlight-layer'>;

export type LyraHistogramReactProps = LyraReactElementProps<'lr-histogram'>;

export type LyraHtmlViewerReactProps = LyraReactElementProps<'lr-html-viewer'>;

export type LyraIconReactProps = LyraReactElementProps<'lr-icon'>;

export type LyraIconButtonReactProps = LyraReactElementProps<'lr-icon-button'>;

export type LyraImageComparerReactProps = LyraReactElementProps<'lr-image-comparer'>;

export type LyraImageViewerReactProps = LyraReactElementProps<'lr-image-viewer'>;

export type LyraIncludeReactProps = LyraReactElementProps<'lr-include'>;

export type LyraIngestionQueueReactProps = LyraReactElementProps<'lr-ingestion-queue'>;

export type LyraInputReactProps = LyraReactElementProps<'lr-input'>;

export type LyraIntersectionObserverReactProps = LyraReactElementProps<'lr-intersection-observer'>;

export type LyraJsonSchemaViewerReactProps = LyraReactElementProps<'lr-json-schema-viewer'>;

export type LyraJsonViewerReactProps = LyraReactElementProps<'lr-json-viewer'>;

export type LyraKbdReactProps = LyraReactElementProps<'lr-kbd'>;

export type LyraKnowledgeBaseReactProps = LyraReactElementProps<'lr-knowledge-base'>;

export type LyraKnowledgeBaseAdminReactProps = LyraReactElementProps<'lr-knowledge-base-admin'>;

export type LyraKnowledgeGraphExplorerReactProps = LyraReactElementProps<'lr-knowledge-graph-explorer'>;

export type LyraKnownDateReactProps = LyraReactElementProps<'lr-known-date'>;

export type LyraLightboxReactProps = LyraReactElementProps<'lr-lightbox'>;

export type LyraLineChartReactProps = LyraReactElementProps<'lr-line-chart'>;

export type LyraLiteChartReactProps = LyraReactElementProps<'lr-lite-chart'>;

export type LyraLiveRegionReactProps = LyraReactElementProps<'lr-live-region'>;

export type LyraLocalePickerReactProps = LyraReactElementProps<'lr-locale-picker'>;

export type LyraMapReactProps = LyraReactElementProps<'lr-map'>;

export type LyraMarkdownReactProps = LyraReactElementProps<'lr-markdown'>;

export type LyraMarkdownCoreReactProps = LyraReactElementProps<'lr-markdown-core'>;

export type LyraMcpAppReactProps = LyraReactElementProps<'lr-mcp-app'>;

export type LyraMediaCardReactProps = LyraReactElementProps<'lr-media-card'>;

export type LyraMemoryPanelReactProps = LyraReactElementProps<'lr-memory-panel'>;

export type LyraMentionPopoverReactProps = LyraReactElementProps<'lr-mention-popover'>;

export type LyraMenuReactProps = LyraReactElementProps<'lr-menu'>;

export type LyraMenuItemReactProps = LyraReactElementProps<'lr-menu-item'>;

export type LyraMenuLabelReactProps = LyraReactElementProps<'lr-menu-label'>;

export type LyraMenubarReactProps = LyraReactElementProps<'lr-menubar'>;

export type LyraMenubarItemReactProps = LyraReactElementProps<'lr-menubar-item'>;

export type LyraMessageActionsReactProps = LyraReactElementProps<'lr-message-actions'>;

export type LyraMessageFeedbackReactProps = LyraReactElementProps<'lr-message-feedback'>;

export type LyraMessagePartsReactProps = LyraReactElementProps<'lr-message-parts'>;

export type LyraMindMapReactProps = LyraReactElementProps<'lr-mind-map'>;

export type LyraModelSelectReactProps = LyraReactElementProps<'lr-model-select'>;

export type LyraModelSettingsPanelReactProps = LyraReactElementProps<'lr-model-settings-panel'>;

export type LyraMultiSplitReactProps = LyraReactElementProps<'lr-multi-split'>;

export type LyraMutationObserverReactProps = LyraReactElementProps<'lr-mutation-observer'>;

export type LyraNativeTimeInputReactProps = LyraReactElementProps<'lr-native-time-input'>;

export type LyraNavigationMenuReactProps = LyraReactElementProps<'lr-navigation-menu'>;

export type LyraNavigationMenuItemReactProps = LyraReactElementProps<'lr-navigation-menu-item'>;

export type LyraNeighborListReactProps = LyraReactElementProps<'lr-neighbor-list'>;

export type LyraNodePaletteReactProps = LyraReactElementProps<'lr-node-palette'>;

export type LyraNotebookViewerReactProps = LyraReactElementProps<'lr-notebook-viewer'>;

export type LyraNumberInputReactProps = LyraReactElementProps<'lr-number-input'>;

export type LyraOptionReactProps = LyraReactElementProps<'lr-option'>;

export type LyraOtpInputReactProps = LyraReactElementProps<'lr-otp-input'>;

export type LyraPageReactProps = LyraReactElementProps<'lr-page'>;

export type LyraPageRailReactProps = LyraReactElementProps<'lr-page-rail'>;

export type LyraPaginationReactProps = LyraReactElementProps<'lr-pagination'>;

export type LyraPanZoomReactProps = LyraReactElementProps<'lr-pan-zoom'>;

export type LyraPathStripReactProps = LyraReactElementProps<'lr-path-strip'>;

export type LyraPdfViewerReactProps = LyraReactElementProps<'lr-pdf-viewer'>;

export type LyraPermissionGrantReactProps = LyraReactElementProps<'lr-permission-grant'>;

export type LyraPermissionRulesReactProps = LyraReactElementProps<'lr-permission-rules'>;

export type LyraPhoneInputReactProps = LyraReactElementProps<'lr-phone-input'>;

export type LyraPieChartReactProps = LyraReactElementProps<'lr-pie-chart'>;

export type LyraPolarAreaChartReactProps = LyraReactElementProps<'lr-polar-area-chart'>;

export type LyraPolicySummaryReactProps = LyraReactElementProps<'lr-policy-summary'>;

export type LyraPollStatusReactProps = LyraReactElementProps<'lr-poll-status'>;

export type LyraPopoverReactProps = LyraReactElementProps<'lr-popover'>;

export type LyraPopupReactProps = LyraReactElementProps<'lr-popup'>;

export type LyraPptxViewerReactProps = LyraReactElementProps<'lr-pptx-viewer'>;

export type LyraProgressBarReactProps = LyraReactElementProps<'lr-progress-bar'>;

export type LyraProgressRingReactProps = LyraReactElementProps<'lr-progress-ring'>;

export type LyraPromptInputReactProps = LyraReactElementProps<'lr-prompt-input'>;

export type LyraPromptQueueReactProps = LyraReactElementProps<'lr-prompt-queue'>;

export type LyraPromptStudioReactProps = LyraReactElementProps<'lr-prompt-studio'>;

export type LyraProvenancePanelReactProps = LyraReactElementProps<'lr-provenance-panel'>;

export type LyraPushToTalkReactProps = LyraReactElementProps<'lr-push-to-talk'>;

export type LyraQrCodeReactProps = LyraReactElementProps<'lr-qr-code'>;

export type LyraRadarChartReactProps = LyraReactElementProps<'lr-radar-chart'>;

export type LyraRadioReactProps = LyraReactElementProps<'lr-radio'>;

export type LyraRadioButtonReactProps = LyraReactElementProps<'lr-radio-button'>;

export type LyraRadioGroupReactProps = LyraReactElementProps<'lr-radio-group'>;

export type LyraRagAnswerReactProps = LyraReactElementProps<'lr-rag-answer'>;

export type LyraRagEvalDashboardReactProps = LyraReactElementProps<'lr-rag-eval-dashboard'>;

export type LyraRandomContentReactProps = LyraReactElementProps<'lr-random-content'>;

export type LyraRatingReactProps = LyraReactElementProps<'lr-rating'>;

export type LyraRealtimeSessionReactProps = LyraReactElementProps<'lr-realtime-session'>;

export type LyraRelativeTimeReactProps = LyraReactElementProps<'lr-relative-time'>;

export type LyraReorderItemReactProps = LyraReactElementProps<'lr-reorder-item'>;

export type LyraReorderListReactProps = LyraReactElementProps<'lr-reorder-list'>;

export type LyraResearchProgressReactProps = LyraReactElementProps<'lr-research-progress'>;

export type LyraResizeObserverReactProps = LyraReactElementProps<'lr-resize-observer'>;

export type LyraResponsivePanelReactProps = LyraReactElementProps<'lr-responsive-panel'>;

export type LyraResultCardReactProps = LyraReactElementProps<'lr-result-card'>;

export type LyraResultFieldReactProps = LyraReactElementProps<'lr-result-field'>;

export type LyraRetrievalCompareReactProps = LyraReactElementProps<'lr-retrieval-compare'>;

export type LyraRetrievalResultsReactProps = LyraReactElementProps<'lr-retrieval-results'>;

export type LyraRetrievalSearchReactProps = LyraReactElementProps<'lr-retrieval-search'>;

export type LyraRetrievalTraceReactProps = LyraReactElementProps<'lr-retrieval-trace'>;

export type LyraRubricFormReactProps = LyraReactElementProps<'lr-rubric-form'>;

export type LyraScatterChartReactProps = LyraReactElementProps<'lr-scatter-chart'>;

export type LyraScrollerReactProps = LyraReactElementProps<'lr-scroller'>;

export type LyraSegmentedReactProps = LyraReactElementProps<'lr-segmented'>;

export type LyraSelectReactProps = LyraReactElementProps<'lr-select'>;

export type LyraSelectionToolbarReactProps = LyraReactElementProps<'lr-selection-toolbar'>;

export type LyraSequencePlaybackReactProps = LyraReactElementProps<'lr-sequence-playback'>;

export type LyraSequenceStripReactProps = LyraReactElementProps<'lr-sequence-strip'>;

export type LyraSkeletonReactProps = LyraReactElementProps<'lr-skeleton'>;

export type LyraSliderReactProps = LyraReactElementProps<'lr-slider'>;

export type LyraSourceCardReactProps = LyraReactElementProps<'lr-source-card'>;

export type LyraSourceListReactProps = LyraReactElementProps<'lr-source-list'>;

export type LyraSourcePickerReactProps = LyraReactElementProps<'lr-source-picker'>;

export type LyraSpanWaterfallReactProps = LyraReactElementProps<'lr-span-waterfall'>;

export type LyraSparklineReactProps = LyraReactElementProps<'lr-sparkline'>;

export type LyraSpinnerReactProps = LyraReactElementProps<'lr-spinner'>;

export type LyraSplitPanelReactProps = LyraReactElementProps<'lr-split-panel'>;

export type LyraSpreadsheetViewerReactProps = LyraReactElementProps<'lr-spreadsheet-viewer'>;

export type LyraStackTraceReactProps = LyraReactElementProps<'lr-stack-trace'>;

export type LyraStatReactProps = LyraReactElementProps<'lr-stat'>;

export type LyraStepperReactProps = LyraReactElementProps<'lr-stepper'>;

export type LyraStreamStatusReactProps = LyraReactElementProps<'lr-stream-status'>;

export type LyraStreamingTextReactProps = LyraReactElementProps<'lr-streaming-text'>;

export type LyraStreamingTextCoreReactProps = LyraReactElementProps<'lr-streaming-text-core'>;

export type LyraSubagentPanelReactProps = LyraReactElementProps<'lr-subagent-panel'>;

export type LyraSuggestionChipsReactProps = LyraReactElementProps<'lr-suggestion-chips'>;

export type LyraSvgViewerReactProps = LyraReactElementProps<'lr-svg-viewer'>;

export type LyraSwatchPickerReactProps = LyraReactElementProps<'lr-swatch-picker'>;

export type LyraSwitchReactProps = LyraReactElementProps<'lr-switch'>;

export type LyraTabReactProps = LyraReactElementProps<'lr-tab'>;

export type LyraTabGroupReactProps = LyraReactElementProps<'lr-tab-group'>;

export type LyraTabPanelReactProps = LyraReactElementProps<'lr-tab-panel'>;

export type LyraTableReactProps = LyraReactElementProps<'lr-table'>;

export type LyraTagReactProps = LyraReactElementProps<'lr-tag'>;

export type LyraTaskListReactProps = LyraReactElementProps<'lr-task-list'>;

export type LyraTerminalReactProps = LyraReactElementProps<'lr-terminal'>;

export type LyraTestResultsReactProps = LyraReactElementProps<'lr-test-results'>;

export type LyraTextareaReactProps = LyraReactElementProps<'lr-textarea'>;

export type LyraThinkingPanelReactProps = LyraReactElementProps<'lr-thinking-panel'>;

export type LyraThreadListReactProps = LyraReactElementProps<'lr-thread-list'>;

export type LyraTimeInputReactProps = LyraReactElementProps<'lr-time-input'>;

export type LyraTimeRangeReactProps = LyraReactElementProps<'lr-time-range'>;

export type LyraTimeZonePickerReactProps = LyraReactElementProps<'lr-time-zone-picker'>;

export type LyraTimelineReactProps = LyraReactElementProps<'lr-timeline'>;

export type LyraTimelineItemReactProps = LyraReactElementProps<'lr-timeline-item'>;

export type LyraToastReactProps = LyraReactElementProps<'lr-toast'>;

export type LyraToastItemReactProps = LyraReactElementProps<'lr-toast-item'>;

export type LyraToggleReactProps = LyraReactElementProps<'lr-toggle'>;

export type LyraToggleGroupReactProps = LyraReactElementProps<'lr-toggle-group'>;

export type LyraTokenInputReactProps = LyraReactElementProps<'lr-token-input'>;

export type LyraToolApprovalDialogReactProps = LyraReactElementProps<'lr-tool-approval-dialog'>;

export type LyraToolCallBlockReactProps = LyraReactElementProps<'lr-tool-call-block'>;

export type LyraToolCallChipReactProps = LyraReactElementProps<'lr-tool-call-chip'>;

export type LyraToolParamFormReactProps = LyraReactElementProps<'lr-tool-param-form'>;

export type LyraToolResultDialogReactProps = LyraReactElementProps<'lr-tool-result-dialog'>;

export type LyraToolResultViewReactProps = LyraReactElementProps<'lr-tool-result-view'>;

export type LyraToolSelectDialogReactProps = LyraReactElementProps<'lr-tool-select-dialog'>;

export type LyraToolTimelineReactProps = LyraReactElementProps<'lr-tool-timeline'>;

export type LyraTooltipReactProps = LyraReactElementProps<'lr-tooltip'>;

export type LyraTourReactProps = LyraReactElementProps<'lr-tour'>;

export type LyraTraceTreeReactProps = LyraReactElementProps<'lr-trace-tree'>;

export type LyraTranscriptFeedReactProps = LyraReactElementProps<'lr-transcript-feed'>;

export type LyraTreeReactProps = LyraReactElementProps<'lr-tree'>;

export type LyraTreeItemReactProps = LyraReactElementProps<'lr-tree-item'>;

export type LyraTypingIndicatorReactProps = LyraReactElementProps<'lr-typing-indicator'>;

export type LyraUnitPickerReactProps = LyraReactElementProps<'lr-unit-picker'>;

export type LyraUsageBadgeReactProps = LyraReactElementProps<'lr-usage-badge'>;

export type LyraVideoReactProps = LyraReactElementProps<'lr-video'>;

export type LyraVideoPlaylistReactProps = LyraReactElementProps<'lr-video-playlist'>;

export type LyraVirtualListReactProps = LyraReactElementProps<'lr-virtual-list'>;

export type LyraVisuallyHiddenReactProps = LyraReactElementProps<'lr-visually-hidden'>;

export type LyraVoicePickerReactProps = LyraReactElementProps<'lr-voice-picker'>;

export type LyraWidgetReactProps = LyraReactElementProps<'lr-widget'>;

export type LyraWidgetRendererReactProps = LyraReactElementProps<'lr-widget-renderer'>;

export type LyraWordCloudReactProps = LyraReactElementProps<'lr-word-cloud'>;

export type LyraXmlViewerReactProps = LyraReactElementProps<'lr-xml-viewer'>;

export type LyraZoomableFrameReactProps = LyraReactElementProps<'lr-zoomable-frame'>;

export interface LyraReactIntrinsicElements {
  'lr-accordion': LyraAccordionReactProps;
  'lr-accordion-item': LyraAccordionItemReactProps;
  'lr-activity-feed': LyraActivityFeedReactProps;
  'lr-agent-eval-dashboard': LyraAgentEvalDashboardReactProps;
  'lr-agent-question': LyraAgentQuestionReactProps;
  'lr-agent-run': LyraAgentRunReactProps;
  'lr-agent-trace': LyraAgentTraceReactProps;
  'lr-agent-workspace': LyraAgentWorkspaceReactProps;
  'lr-alert': LyraAlertReactProps;
  'lr-animated-image': LyraAnimatedImageReactProps;
  'lr-animation': LyraAnimationReactProps;
  'lr-app-rail': LyraAppRailReactProps;
  'lr-app-rail-group': LyraAppRailGroupReactProps;
  'lr-app-rail-item': LyraAppRailItemReactProps;
  'lr-approval-queue': LyraApprovalQueueReactProps;
  'lr-archive-viewer': LyraArchiveViewerReactProps;
  'lr-artifact-panel': LyraArtifactPanelReactProps;
  'lr-attachment-chip': LyraAttachmentChipReactProps;
  'lr-attachment-trigger': LyraAttachmentTriggerReactProps;
  'lr-audio-visualizer': LyraAudioVisualizerReactProps;
  'lr-av-player': LyraAvPlayerReactProps;
  'lr-avatar': LyraAvatarReactProps;
  'lr-avatar-group': LyraAvatarGroupReactProps;
  'lr-background-runs': LyraBackgroundRunsReactProps;
  'lr-badge': LyraBadgeReactProps;
  'lr-bar-chart': LyraBarChartReactProps;
  'lr-box-plot': LyraBoxPlotReactProps;
  'lr-branch-picker': LyraBranchPickerReactProps;
  'lr-breadcrumb': LyraBreadcrumbReactProps;
  'lr-breadcrumb-item': LyraBreadcrumbItemReactProps;
  'lr-browser-frame': LyraBrowserFrameReactProps;
  'lr-bubble-chart': LyraBubbleChartReactProps;
  'lr-budget-meter': LyraBudgetMeterReactProps;
  'lr-button': LyraButtonReactProps;
  'lr-button-group': LyraButtonGroupReactProps;
  'lr-calendar': LyraCalendarReactProps;
  'lr-calendar-viewer': LyraCalendarViewerReactProps;
  'lr-callout': LyraCalloutReactProps;
  'lr-card': LyraCardReactProps;
  'lr-carousel': LyraCarouselReactProps;
  'lr-carousel-item': LyraCarouselItemReactProps;
  'lr-change-review': LyraChangeReviewReactProps;
  'lr-chart': LyraChartReactProps;
  'lr-chat-composer': LyraChatComposerReactProps;
  'lr-chat-message': LyraChatMessageReactProps;
  'lr-chat-viewport': LyraChatViewportReactProps;
  'lr-checkbox': LyraCheckboxReactProps;
  'lr-checkbox-group': LyraCheckboxGroupReactProps;
  'lr-checkpoint': LyraCheckpointReactProps;
  'lr-chip': LyraChipReactProps;
  'lr-chip-group': LyraChipGroupReactProps;
  'lr-chunk-inspector': LyraChunkInspectorReactProps;
  'lr-citation-badge': LyraCitationBadgeReactProps;
  'lr-claim-evidence': LyraClaimEvidenceReactProps;
  'lr-code-block': LyraCodeBlockReactProps;
  'lr-code-block-core': LyraCodeBlockCoreReactProps;
  'lr-code-editor': LyraCodeEditorReactProps;
  'lr-color-picker': LyraColorPickerReactProps;
  'lr-combobox': LyraComboboxReactProps;
  'lr-command-palette': LyraCommandPaletteReactProps;
  'lr-commit-card': LyraCommitCardReactProps;
  'lr-community-card': LyraCommunityCardReactProps;
  'lr-compare-panel': LyraComparePanelReactProps;
  'lr-condition-builder': LyraConditionBuilderReactProps;
  'lr-confirm-bar': LyraConfirmBarReactProps;
  'lr-connector-manager': LyraConnectorManagerReactProps;
  'lr-contact-viewer': LyraContactViewerReactProps;
  'lr-context-inspector': LyraContextInspectorReactProps;
  'lr-context-menu': LyraContextMenuReactProps;
  'lr-context-meter': LyraContextMeterReactProps;
  'lr-control-group': LyraControlGroupReactProps;
  'lr-conversation-item': LyraConversationItemReactProps;
  'lr-copy-button': LyraCopyButtonReactProps;
  'lr-country-picker': LyraCountryPickerReactProps;
  'lr-csv-viewer': LyraCsvViewerReactProps;
  'lr-currency-picker': LyraCurrencyPickerReactProps;
  'lr-dashboard-grid': LyraDashboardGridReactProps;
  'lr-data-grid': LyraDataGridReactProps;
  'lr-dataset-viewer': LyraDatasetViewerReactProps;
  'lr-date-input': LyraDateInputReactProps;
  'lr-date-picker': LyraDatePickerReactProps;
  'lr-details': LyraDetailsReactProps;
  'lr-dialog': LyraDialogReactProps;
  'lr-diff-view': LyraDiffViewReactProps;
  'lr-divider': LyraDividerReactProps;
  'lr-dock-panel': LyraDockPanelReactProps;
  'lr-document-compare': LyraDocumentCompareReactProps;
  'lr-document-library': LyraDocumentLibraryReactProps;
  'lr-document-preview': LyraDocumentPreviewReactProps;
  'lr-document-viewer': LyraDocumentViewerReactProps;
  'lr-docx-viewer': LyraDocxViewerReactProps;
  'lr-doughnut-chart': LyraDoughnutChartReactProps;
  'lr-drawer': LyraDrawerReactProps;
  'lr-drilldown-panel': LyraDrilldownPanelReactProps;
  'lr-drop-zone': LyraDropZoneReactProps;
  'lr-dropdown': LyraDropdownReactProps;
  'lr-dropdown-item': LyraDropdownItemReactProps;
  'lr-ebook-viewer': LyraEbookViewerReactProps;
  'lr-email-viewer': LyraEmailViewerReactProps;
  'lr-embedding-explorer': LyraEmbeddingExplorerReactProps;
  'lr-emoji-picker': LyraEmojiPickerReactProps;
  'lr-empty': LyraEmptyReactProps;
  'lr-entity-card': LyraEntityCardReactProps;
  'lr-entity-chip': LyraEntityChipReactProps;
  'lr-entity-dossier': LyraEntityDossierReactProps;
  'lr-env-list': LyraEnvListReactProps;
  'lr-eval-dataset': LyraEvalDatasetReactProps;
  'lr-eval-result': LyraEvalResultReactProps;
  'lr-eval-run': LyraEvalRunReactProps;
  'lr-export-button': LyraExportButtonReactProps;
  'lr-file-icon': LyraFileIconReactProps;
  'lr-file-input': LyraFileInputReactProps;
  'lr-file-tree': LyraFileTreeReactProps;
  'lr-filter-bar': LyraFilterBarReactProps;
  'lr-flag': LyraFlagReactProps;
  'lr-flow-canvas': LyraFlowCanvasReactProps;
  'lr-flow-controls': LyraFlowControlsReactProps;
  'lr-flow-minimap': LyraFlowMinimapReactProps;
  'lr-flow-node': LyraFlowNodeReactProps;
  'lr-flow-run-status': LyraFlowRunStatusReactProps;
  'lr-format-bytes': LyraFormatBytesReactProps;
  'lr-format-date': LyraFormatDateReactProps;
  'lr-format-number': LyraFormatNumberReactProps;
  'lr-funnel': LyraFunnelReactProps;
  'lr-gauge': LyraGaugeReactProps;
  'lr-generation-metrics': LyraGenerationMetricsReactProps;
  'lr-geojson-viewer': LyraGeoJsonViewerReactProps;
  'lr-graph': LyraGraphReactProps;
  'lr-graph-legend': LyraGraphLegendReactProps;
  'lr-graph-query-builder': LyraGraphQueryBuilderReactProps;
  'lr-grounding-summary': LyraGroundingSummaryReactProps;
  'lr-handoff-divider': LyraHandoffDividerReactProps;
  'lr-heatmap': LyraHeatmapReactProps;
  'lr-highlight-layer': LyraHighlightLayerReactProps;
  'lr-histogram': LyraHistogramReactProps;
  'lr-html-viewer': LyraHtmlViewerReactProps;
  'lr-icon': LyraIconReactProps;
  'lr-icon-button': LyraIconButtonReactProps;
  'lr-image-comparer': LyraImageComparerReactProps;
  'lr-image-viewer': LyraImageViewerReactProps;
  'lr-include': LyraIncludeReactProps;
  'lr-ingestion-queue': LyraIngestionQueueReactProps;
  'lr-input': LyraInputReactProps;
  'lr-intersection-observer': LyraIntersectionObserverReactProps;
  'lr-json-schema-viewer': LyraJsonSchemaViewerReactProps;
  'lr-json-viewer': LyraJsonViewerReactProps;
  'lr-kbd': LyraKbdReactProps;
  'lr-knowledge-base': LyraKnowledgeBaseReactProps;
  'lr-knowledge-base-admin': LyraKnowledgeBaseAdminReactProps;
  'lr-knowledge-graph-explorer': LyraKnowledgeGraphExplorerReactProps;
  'lr-known-date': LyraKnownDateReactProps;
  'lr-lightbox': LyraLightboxReactProps;
  'lr-line-chart': LyraLineChartReactProps;
  'lr-lite-chart': LyraLiteChartReactProps;
  'lr-live-region': LyraLiveRegionReactProps;
  'lr-locale-picker': LyraLocalePickerReactProps;
  'lr-map': LyraMapReactProps;
  'lr-markdown': LyraMarkdownReactProps;
  'lr-markdown-core': LyraMarkdownCoreReactProps;
  'lr-mcp-app': LyraMcpAppReactProps;
  'lr-media-card': LyraMediaCardReactProps;
  'lr-memory-panel': LyraMemoryPanelReactProps;
  'lr-mention-popover': LyraMentionPopoverReactProps;
  'lr-menu': LyraMenuReactProps;
  'lr-menu-item': LyraMenuItemReactProps;
  'lr-menu-label': LyraMenuLabelReactProps;
  'lr-menubar': LyraMenubarReactProps;
  'lr-menubar-item': LyraMenubarItemReactProps;
  'lr-message-actions': LyraMessageActionsReactProps;
  'lr-message-feedback': LyraMessageFeedbackReactProps;
  'lr-message-parts': LyraMessagePartsReactProps;
  'lr-mind-map': LyraMindMapReactProps;
  'lr-model-select': LyraModelSelectReactProps;
  'lr-model-settings-panel': LyraModelSettingsPanelReactProps;
  'lr-multi-split': LyraMultiSplitReactProps;
  'lr-mutation-observer': LyraMutationObserverReactProps;
  'lr-native-time-input': LyraNativeTimeInputReactProps;
  'lr-navigation-menu': LyraNavigationMenuReactProps;
  'lr-navigation-menu-item': LyraNavigationMenuItemReactProps;
  'lr-neighbor-list': LyraNeighborListReactProps;
  'lr-node-palette': LyraNodePaletteReactProps;
  'lr-notebook-viewer': LyraNotebookViewerReactProps;
  'lr-number-input': LyraNumberInputReactProps;
  'lr-option': LyraOptionReactProps;
  'lr-otp-input': LyraOtpInputReactProps;
  'lr-page': LyraPageReactProps;
  'lr-page-rail': LyraPageRailReactProps;
  'lr-pagination': LyraPaginationReactProps;
  'lr-pan-zoom': LyraPanZoomReactProps;
  'lr-path-strip': LyraPathStripReactProps;
  'lr-pdf-viewer': LyraPdfViewerReactProps;
  'lr-permission-grant': LyraPermissionGrantReactProps;
  'lr-permission-rules': LyraPermissionRulesReactProps;
  'lr-phone-input': LyraPhoneInputReactProps;
  'lr-pie-chart': LyraPieChartReactProps;
  'lr-polar-area-chart': LyraPolarAreaChartReactProps;
  'lr-policy-summary': LyraPolicySummaryReactProps;
  'lr-poll-status': LyraPollStatusReactProps;
  'lr-popover': LyraPopoverReactProps;
  'lr-popup': LyraPopupReactProps;
  'lr-pptx-viewer': LyraPptxViewerReactProps;
  'lr-progress-bar': LyraProgressBarReactProps;
  'lr-progress-ring': LyraProgressRingReactProps;
  'lr-prompt-input': LyraPromptInputReactProps;
  'lr-prompt-queue': LyraPromptQueueReactProps;
  'lr-prompt-studio': LyraPromptStudioReactProps;
  'lr-provenance-panel': LyraProvenancePanelReactProps;
  'lr-push-to-talk': LyraPushToTalkReactProps;
  'lr-qr-code': LyraQrCodeReactProps;
  'lr-radar-chart': LyraRadarChartReactProps;
  'lr-radio': LyraRadioReactProps;
  'lr-radio-button': LyraRadioButtonReactProps;
  'lr-radio-group': LyraRadioGroupReactProps;
  'lr-rag-answer': LyraRagAnswerReactProps;
  'lr-rag-eval-dashboard': LyraRagEvalDashboardReactProps;
  'lr-random-content': LyraRandomContentReactProps;
  'lr-rating': LyraRatingReactProps;
  'lr-realtime-session': LyraRealtimeSessionReactProps;
  'lr-relative-time': LyraRelativeTimeReactProps;
  'lr-reorder-item': LyraReorderItemReactProps;
  'lr-reorder-list': LyraReorderListReactProps;
  'lr-research-progress': LyraResearchProgressReactProps;
  'lr-resize-observer': LyraResizeObserverReactProps;
  'lr-responsive-panel': LyraResponsivePanelReactProps;
  'lr-result-card': LyraResultCardReactProps;
  'lr-result-field': LyraResultFieldReactProps;
  'lr-retrieval-compare': LyraRetrievalCompareReactProps;
  'lr-retrieval-results': LyraRetrievalResultsReactProps;
  'lr-retrieval-search': LyraRetrievalSearchReactProps;
  'lr-retrieval-trace': LyraRetrievalTraceReactProps;
  'lr-rubric-form': LyraRubricFormReactProps;
  'lr-scatter-chart': LyraScatterChartReactProps;
  'lr-scroller': LyraScrollerReactProps;
  'lr-segmented': LyraSegmentedReactProps;
  'lr-select': LyraSelectReactProps;
  'lr-selection-toolbar': LyraSelectionToolbarReactProps;
  'lr-sequence-playback': LyraSequencePlaybackReactProps;
  'lr-sequence-strip': LyraSequenceStripReactProps;
  'lr-skeleton': LyraSkeletonReactProps;
  'lr-slider': LyraSliderReactProps;
  'lr-source-card': LyraSourceCardReactProps;
  'lr-source-list': LyraSourceListReactProps;
  'lr-source-picker': LyraSourcePickerReactProps;
  'lr-span-waterfall': LyraSpanWaterfallReactProps;
  'lr-sparkline': LyraSparklineReactProps;
  'lr-spinner': LyraSpinnerReactProps;
  'lr-split-panel': LyraSplitPanelReactProps;
  'lr-spreadsheet-viewer': LyraSpreadsheetViewerReactProps;
  'lr-stack-trace': LyraStackTraceReactProps;
  'lr-stat': LyraStatReactProps;
  'lr-stepper': LyraStepperReactProps;
  'lr-stream-status': LyraStreamStatusReactProps;
  'lr-streaming-text': LyraStreamingTextReactProps;
  'lr-streaming-text-core': LyraStreamingTextCoreReactProps;
  'lr-subagent-panel': LyraSubagentPanelReactProps;
  'lr-suggestion-chips': LyraSuggestionChipsReactProps;
  'lr-svg-viewer': LyraSvgViewerReactProps;
  'lr-swatch-picker': LyraSwatchPickerReactProps;
  'lr-switch': LyraSwitchReactProps;
  'lr-tab': LyraTabReactProps;
  'lr-tab-group': LyraTabGroupReactProps;
  'lr-tab-panel': LyraTabPanelReactProps;
  'lr-table': LyraTableReactProps;
  'lr-tag': LyraTagReactProps;
  'lr-task-list': LyraTaskListReactProps;
  'lr-terminal': LyraTerminalReactProps;
  'lr-test-results': LyraTestResultsReactProps;
  'lr-textarea': LyraTextareaReactProps;
  'lr-thinking-panel': LyraThinkingPanelReactProps;
  'lr-thread-list': LyraThreadListReactProps;
  'lr-time-input': LyraTimeInputReactProps;
  'lr-time-range': LyraTimeRangeReactProps;
  'lr-time-zone-picker': LyraTimeZonePickerReactProps;
  'lr-timeline': LyraTimelineReactProps;
  'lr-timeline-item': LyraTimelineItemReactProps;
  'lr-toast': LyraToastReactProps;
  'lr-toast-item': LyraToastItemReactProps;
  'lr-toggle': LyraToggleReactProps;
  'lr-toggle-group': LyraToggleGroupReactProps;
  'lr-token-input': LyraTokenInputReactProps;
  'lr-tool-approval-dialog': LyraToolApprovalDialogReactProps;
  'lr-tool-call-block': LyraToolCallBlockReactProps;
  'lr-tool-call-chip': LyraToolCallChipReactProps;
  'lr-tool-param-form': LyraToolParamFormReactProps;
  'lr-tool-result-dialog': LyraToolResultDialogReactProps;
  'lr-tool-result-view': LyraToolResultViewReactProps;
  'lr-tool-select-dialog': LyraToolSelectDialogReactProps;
  'lr-tool-timeline': LyraToolTimelineReactProps;
  'lr-tooltip': LyraTooltipReactProps;
  'lr-tour': LyraTourReactProps;
  'lr-trace-tree': LyraTraceTreeReactProps;
  'lr-transcript-feed': LyraTranscriptFeedReactProps;
  'lr-tree': LyraTreeReactProps;
  'lr-tree-item': LyraTreeItemReactProps;
  'lr-typing-indicator': LyraTypingIndicatorReactProps;
  'lr-unit-picker': LyraUnitPickerReactProps;
  'lr-usage-badge': LyraUsageBadgeReactProps;
  'lr-video': LyraVideoReactProps;
  'lr-video-playlist': LyraVideoPlaylistReactProps;
  'lr-virtual-list': LyraVirtualListReactProps;
  'lr-visually-hidden': LyraVisuallyHiddenReactProps;
  'lr-voice-picker': LyraVoicePickerReactProps;
  'lr-widget': LyraWidgetReactProps;
  'lr-widget-renderer': LyraWidgetRendererReactProps;
  'lr-word-cloud': LyraWordCloudReactProps;
  'lr-xml-viewer': LyraXmlViewerReactProps;
  'lr-zoomable-frame': LyraZoomableFrameReactProps;
}

declare global {
  namespace JSX {
    interface IntrinsicElements extends LyraReactIntrinsicElements {}
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements extends LyraReactIntrinsicElements {}
  }
}
