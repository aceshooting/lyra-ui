// GENERATED FILE — do not edit by hand. Opt-in Svelte 5 custom-element declarations.
// Regenerate with `pnpm --filter @aceshooting/lyra-ui run framework-types`.
// This module contains types only; its emitted JavaScript is an empty module.
import type { HTMLAttributes } from 'svelte/elements';
import type { LyraComponentTypeMap, LyraBoundEvent } from './framework-types.js';
export type { LyraUnknownAttributeValue, LyraAttributeValue, LyraCSSCustomProperties } from './framework-types.js';

type LyraSvelteEventProps<
  ElementType extends HTMLElement,
  ElementEvents extends object,
  EventNames extends string,
> = {
  [Name in EventNames as `on${Name}`]?: (
    event: LyraBoundEvent<ElementType, ElementEvents, Name>,
  ) => void | null;
} & {
  [Name in EventNames as `on:${Name}`]?: (
    event: LyraBoundEvent<ElementType, ElementEvents, Name>,
  ) => void | null;
};

type LyraSvelteStyleProps<CSSNames extends string> = {
  [Name in CSSNames as `style:${Name}`]?: string | number | null | undefined;
};

type LyraSvelteElementProps<
  Tag extends keyof LyraComponentTypeMap,
  ElementType extends HTMLElement = LyraComponentTypeMap[Tag]['element'],
  Properties extends object = LyraComponentTypeMap[Tag]['properties'],
  ElementEvents extends object = LyraComponentTypeMap[Tag]['events'],
  EventNames extends string = LyraComponentTypeMap[Tag]['eventNames'],
  CSSNames extends string = LyraComponentTypeMap[Tag]['cssNames'],
  AttributeAliases extends object = LyraComponentTypeMap[Tag]['attributeAliases'],
> = Omit<
  HTMLAttributes<ElementType>,
  keyof Properties | keyof AttributeAliases | keyof LyraSvelteEventProps<ElementType, ElementEvents, EventNames>
> &
  Properties &
  AttributeAliases &
  LyraSvelteEventProps<ElementType, ElementEvents, EventNames> &
  LyraSvelteStyleProps<CSSNames>;

export type LyraAccordionSvelteProps = LyraSvelteElementProps<'lr-accordion'>;

export type LyraAccordionItemSvelteProps = LyraSvelteElementProps<'lr-accordion-item'>;

export type LyraActivityFeedSvelteProps = LyraSvelteElementProps<'lr-activity-feed'>;

export type LyraAgentEvalDashboardSvelteProps = LyraSvelteElementProps<'lr-agent-eval-dashboard'>;

export type LyraAgentQuestionSvelteProps = LyraSvelteElementProps<'lr-agent-question'>;

export type LyraAgentRunSvelteProps = LyraSvelteElementProps<'lr-agent-run'>;

export type LyraAgentTraceSvelteProps = LyraSvelteElementProps<'lr-agent-trace'>;

export type LyraAgentWorkspaceSvelteProps = LyraSvelteElementProps<'lr-agent-workspace'>;

export type LyraAlertSvelteProps = LyraSvelteElementProps<'lr-alert'>;

export type LyraAnimatedImageSvelteProps = LyraSvelteElementProps<'lr-animated-image'>;

export type LyraAnimationSvelteProps = LyraSvelteElementProps<'lr-animation'>;

export type LyraAppRailSvelteProps = LyraSvelteElementProps<'lr-app-rail'>;

export type LyraAppRailGroupSvelteProps = LyraSvelteElementProps<'lr-app-rail-group'>;

export type LyraAppRailItemSvelteProps = LyraSvelteElementProps<'lr-app-rail-item'>;

export type LyraApprovalQueueSvelteProps = LyraSvelteElementProps<'lr-approval-queue'>;

export type LyraArchiveViewerSvelteProps = LyraSvelteElementProps<'lr-archive-viewer'>;

export type LyraArtifactPanelSvelteProps = LyraSvelteElementProps<'lr-artifact-panel'>;

export type LyraAttachmentChipSvelteProps = LyraSvelteElementProps<'lr-attachment-chip'>;

export type LyraAttachmentTriggerSvelteProps = LyraSvelteElementProps<'lr-attachment-trigger'>;

export type LyraAudioVisualizerSvelteProps = LyraSvelteElementProps<'lr-audio-visualizer'>;

export type LyraAvPlayerSvelteProps = LyraSvelteElementProps<'lr-av-player'>;

export type LyraAvatarSvelteProps = LyraSvelteElementProps<'lr-avatar'>;

export type LyraAvatarGroupSvelteProps = LyraSvelteElementProps<'lr-avatar-group'>;

export type LyraBackgroundRunsSvelteProps = LyraSvelteElementProps<'lr-background-runs'>;

export type LyraBadgeSvelteProps = LyraSvelteElementProps<'lr-badge'>;

export type LyraBarChartSvelteProps = LyraSvelteElementProps<'lr-bar-chart'>;

export type LyraBoxPlotSvelteProps = LyraSvelteElementProps<'lr-box-plot'>;

export type LyraBranchPickerSvelteProps = LyraSvelteElementProps<'lr-branch-picker'>;

export type LyraBreadcrumbSvelteProps = LyraSvelteElementProps<'lr-breadcrumb'>;

export type LyraBreadcrumbItemSvelteProps = LyraSvelteElementProps<'lr-breadcrumb-item'>;

export type LyraBrowserFrameSvelteProps = LyraSvelteElementProps<'lr-browser-frame'>;

export type LyraBubbleChartSvelteProps = LyraSvelteElementProps<'lr-bubble-chart'>;

export type LyraBudgetMeterSvelteProps = LyraSvelteElementProps<'lr-budget-meter'>;

export type LyraButtonSvelteProps = LyraSvelteElementProps<'lr-button'>;

export type LyraButtonGroupSvelteProps = LyraSvelteElementProps<'lr-button-group'>;

export type LyraCalendarSvelteProps = LyraSvelteElementProps<'lr-calendar'>;

export type LyraCalendarViewerSvelteProps = LyraSvelteElementProps<'lr-calendar-viewer'>;

export type LyraCalloutSvelteProps = LyraSvelteElementProps<'lr-callout'>;

export type LyraCardSvelteProps = LyraSvelteElementProps<'lr-card'>;

export type LyraCarouselSvelteProps = LyraSvelteElementProps<'lr-carousel'>;

export type LyraCarouselItemSvelteProps = LyraSvelteElementProps<'lr-carousel-item'>;

export type LyraChangeReviewSvelteProps = LyraSvelteElementProps<'lr-change-review'>;

export type LyraChartSvelteProps = LyraSvelteElementProps<'lr-chart'>;

export type LyraChatComposerSvelteProps = LyraSvelteElementProps<'lr-chat-composer'>;

export type LyraChatMessageSvelteProps = LyraSvelteElementProps<'lr-chat-message'>;

export type LyraChatViewportSvelteProps = LyraSvelteElementProps<'lr-chat-viewport'>;

export type LyraCheckboxSvelteProps = LyraSvelteElementProps<'lr-checkbox'>;

export type LyraCheckboxGroupSvelteProps = LyraSvelteElementProps<'lr-checkbox-group'>;

export type LyraCheckpointSvelteProps = LyraSvelteElementProps<'lr-checkpoint'>;

export type LyraChipSvelteProps = LyraSvelteElementProps<'lr-chip'>;

export type LyraChipGroupSvelteProps = LyraSvelteElementProps<'lr-chip-group'>;

export type LyraChunkInspectorSvelteProps = LyraSvelteElementProps<'lr-chunk-inspector'>;

export type LyraCitationBadgeSvelteProps = LyraSvelteElementProps<'lr-citation-badge'>;

export type LyraClaimEvidenceSvelteProps = LyraSvelteElementProps<'lr-claim-evidence'>;

export type LyraCodeBlockSvelteProps = LyraSvelteElementProps<'lr-code-block'>;

export type LyraCodeBlockCoreSvelteProps = LyraSvelteElementProps<'lr-code-block-core'>;

export type LyraCodeEditorSvelteProps = LyraSvelteElementProps<'lr-code-editor'>;

export type LyraColorPickerSvelteProps = LyraSvelteElementProps<'lr-color-picker'>;

export type LyraComboboxSvelteProps = LyraSvelteElementProps<'lr-combobox'>;

export type LyraCommandPaletteSvelteProps = LyraSvelteElementProps<'lr-command-palette'>;

export type LyraCommitCardSvelteProps = LyraSvelteElementProps<'lr-commit-card'>;

export type LyraCommunityCardSvelteProps = LyraSvelteElementProps<'lr-community-card'>;

export type LyraComparePanelSvelteProps = LyraSvelteElementProps<'lr-compare-panel'>;

export type LyraConditionBuilderSvelteProps = LyraSvelteElementProps<'lr-condition-builder'>;

export type LyraConfirmBarSvelteProps = LyraSvelteElementProps<'lr-confirm-bar'>;

export type LyraConnectorManagerSvelteProps = LyraSvelteElementProps<'lr-connector-manager'>;

export type LyraContactViewerSvelteProps = LyraSvelteElementProps<'lr-contact-viewer'>;

export type LyraContextInspectorSvelteProps = LyraSvelteElementProps<'lr-context-inspector'>;

export type LyraContextMenuSvelteProps = LyraSvelteElementProps<'lr-context-menu'>;

export type LyraContextMeterSvelteProps = LyraSvelteElementProps<'lr-context-meter'>;

export type LyraControlGroupSvelteProps = LyraSvelteElementProps<'lr-control-group'>;

export type LyraConversationItemSvelteProps = LyraSvelteElementProps<'lr-conversation-item'>;

export type LyraCopyButtonSvelteProps = LyraSvelteElementProps<'lr-copy-button'>;

export type LyraCsvViewerSvelteProps = LyraSvelteElementProps<'lr-csv-viewer'>;

export type LyraCurrencyPickerSvelteProps = LyraSvelteElementProps<'lr-currency-picker'>;

export type LyraDashboardGridSvelteProps = LyraSvelteElementProps<'lr-dashboard-grid'>;

export type LyraDataGridSvelteProps = LyraSvelteElementProps<'lr-data-grid'>;

export type LyraDatasetViewerSvelteProps = LyraSvelteElementProps<'lr-dataset-viewer'>;

export type LyraDateInputSvelteProps = LyraSvelteElementProps<'lr-date-input'>;

export type LyraDatePickerSvelteProps = LyraSvelteElementProps<'lr-date-picker'>;

export type LyraDetailsSvelteProps = LyraSvelteElementProps<'lr-details'>;

export type LyraDialogSvelteProps = LyraSvelteElementProps<'lr-dialog'>;

export type LyraDiffViewSvelteProps = LyraSvelteElementProps<'lr-diff-view'>;

export type LyraDividerSvelteProps = LyraSvelteElementProps<'lr-divider'>;

export type LyraDockPanelSvelteProps = LyraSvelteElementProps<'lr-dock-panel'>;

export type LyraDocumentCompareSvelteProps = LyraSvelteElementProps<'lr-document-compare'>;

export type LyraDocumentLibrarySvelteProps = LyraSvelteElementProps<'lr-document-library'>;

export type LyraDocumentPreviewSvelteProps = LyraSvelteElementProps<'lr-document-preview'>;

export type LyraDocumentViewerSvelteProps = LyraSvelteElementProps<'lr-document-viewer'>;

export type LyraDocxViewerSvelteProps = LyraSvelteElementProps<'lr-docx-viewer'>;

export type LyraDoughnutChartSvelteProps = LyraSvelteElementProps<'lr-doughnut-chart'>;

export type LyraDrawerSvelteProps = LyraSvelteElementProps<'lr-drawer'>;

export type LyraDrilldownPanelSvelteProps = LyraSvelteElementProps<'lr-drilldown-panel'>;

export type LyraDropZoneSvelteProps = LyraSvelteElementProps<'lr-drop-zone'>;

export type LyraDropdownSvelteProps = LyraSvelteElementProps<'lr-dropdown'>;

export type LyraDropdownItemSvelteProps = LyraSvelteElementProps<'lr-dropdown-item'>;

export type LyraEbookViewerSvelteProps = LyraSvelteElementProps<'lr-ebook-viewer'>;

export type LyraEmailViewerSvelteProps = LyraSvelteElementProps<'lr-email-viewer'>;

export type LyraEmbeddingExplorerSvelteProps = LyraSvelteElementProps<'lr-embedding-explorer'>;

export type LyraEmojiPickerSvelteProps = LyraSvelteElementProps<'lr-emoji-picker'>;

export type LyraEmptySvelteProps = LyraSvelteElementProps<'lr-empty'>;

export type LyraEntityCardSvelteProps = LyraSvelteElementProps<'lr-entity-card'>;

export type LyraEntityChipSvelteProps = LyraSvelteElementProps<'lr-entity-chip'>;

export type LyraEntityDossierSvelteProps = LyraSvelteElementProps<'lr-entity-dossier'>;

export type LyraEnvListSvelteProps = LyraSvelteElementProps<'lr-env-list'>;

export type LyraEvalDatasetSvelteProps = LyraSvelteElementProps<'lr-eval-dataset'>;

export type LyraEvalResultSvelteProps = LyraSvelteElementProps<'lr-eval-result'>;

export type LyraEvalRunSvelteProps = LyraSvelteElementProps<'lr-eval-run'>;

export type LyraExportButtonSvelteProps = LyraSvelteElementProps<'lr-export-button'>;

export type LyraFileIconSvelteProps = LyraSvelteElementProps<'lr-file-icon'>;

export type LyraFileInputSvelteProps = LyraSvelteElementProps<'lr-file-input'>;

export type LyraFileTreeSvelteProps = LyraSvelteElementProps<'lr-file-tree'>;

export type LyraFilterBarSvelteProps = LyraSvelteElementProps<'lr-filter-bar'>;

export type LyraFlagSvelteProps = LyraSvelteElementProps<'lr-flag'>;

export type LyraFlowCanvasSvelteProps = LyraSvelteElementProps<'lr-flow-canvas'>;

export type LyraFlowControlsSvelteProps = LyraSvelteElementProps<'lr-flow-controls'>;

export type LyraFlowMinimapSvelteProps = LyraSvelteElementProps<'lr-flow-minimap'>;

export type LyraFlowNodeSvelteProps = LyraSvelteElementProps<'lr-flow-node'>;

export type LyraFlowRunStatusSvelteProps = LyraSvelteElementProps<'lr-flow-run-status'>;

export type LyraFormatBytesSvelteProps = LyraSvelteElementProps<'lr-format-bytes'>;

export type LyraFormatDateSvelteProps = LyraSvelteElementProps<'lr-format-date'>;

export type LyraFormatNumberSvelteProps = LyraSvelteElementProps<'lr-format-number'>;

export type LyraFunnelSvelteProps = LyraSvelteElementProps<'lr-funnel'>;

export type LyraGaugeSvelteProps = LyraSvelteElementProps<'lr-gauge'>;

export type LyraGenerationMetricsSvelteProps = LyraSvelteElementProps<'lr-generation-metrics'>;

export type LyraGeoJsonViewerSvelteProps = LyraSvelteElementProps<'lr-geojson-viewer'>;

export type LyraGraphSvelteProps = LyraSvelteElementProps<'lr-graph'>;

export type LyraGraphLegendSvelteProps = LyraSvelteElementProps<'lr-graph-legend'>;

export type LyraGraphQueryBuilderSvelteProps = LyraSvelteElementProps<'lr-graph-query-builder'>;

export type LyraGroundingSummarySvelteProps = LyraSvelteElementProps<'lr-grounding-summary'>;

export type LyraHandoffDividerSvelteProps = LyraSvelteElementProps<'lr-handoff-divider'>;

export type LyraHeatmapSvelteProps = LyraSvelteElementProps<'lr-heatmap'>;

export type LyraHighlightLayerSvelteProps = LyraSvelteElementProps<'lr-highlight-layer'>;

export type LyraHistogramSvelteProps = LyraSvelteElementProps<'lr-histogram'>;

export type LyraHtmlViewerSvelteProps = LyraSvelteElementProps<'lr-html-viewer'>;

export type LyraIconSvelteProps = LyraSvelteElementProps<'lr-icon'>;

export type LyraIconButtonSvelteProps = LyraSvelteElementProps<'lr-icon-button'>;

export type LyraImageComparerSvelteProps = LyraSvelteElementProps<'lr-image-comparer'>;

export type LyraImageViewerSvelteProps = LyraSvelteElementProps<'lr-image-viewer'>;

export type LyraIncludeSvelteProps = LyraSvelteElementProps<'lr-include'>;

export type LyraIngestionQueueSvelteProps = LyraSvelteElementProps<'lr-ingestion-queue'>;

export type LyraInputSvelteProps = LyraSvelteElementProps<'lr-input'>;

export type LyraIntersectionObserverSvelteProps = LyraSvelteElementProps<'lr-intersection-observer'>;

export type LyraJsonSchemaViewerSvelteProps = LyraSvelteElementProps<'lr-json-schema-viewer'>;

export type LyraJsonViewerSvelteProps = LyraSvelteElementProps<'lr-json-viewer'>;

export type LyraKbdSvelteProps = LyraSvelteElementProps<'lr-kbd'>;

export type LyraKnowledgeBaseSvelteProps = LyraSvelteElementProps<'lr-knowledge-base'>;

export type LyraKnowledgeBaseAdminSvelteProps = LyraSvelteElementProps<'lr-knowledge-base-admin'>;

export type LyraKnowledgeGraphExplorerSvelteProps = LyraSvelteElementProps<'lr-knowledge-graph-explorer'>;

export type LyraKnownDateSvelteProps = LyraSvelteElementProps<'lr-known-date'>;

export type LyraLightboxSvelteProps = LyraSvelteElementProps<'lr-lightbox'>;

export type LyraLineChartSvelteProps = LyraSvelteElementProps<'lr-line-chart'>;

export type LyraLiteChartSvelteProps = LyraSvelteElementProps<'lr-lite-chart'>;

export type LyraLiveRegionSvelteProps = LyraSvelteElementProps<'lr-live-region'>;

export type LyraLocalePickerSvelteProps = LyraSvelteElementProps<'lr-locale-picker'>;

export type LyraMapSvelteProps = LyraSvelteElementProps<'lr-map'>;

export type LyraMarkdownSvelteProps = LyraSvelteElementProps<'lr-markdown'>;

export type LyraMarkdownCoreSvelteProps = LyraSvelteElementProps<'lr-markdown-core'>;

export type LyraMcpAppSvelteProps = LyraSvelteElementProps<'lr-mcp-app'>;

export type LyraMediaCardSvelteProps = LyraSvelteElementProps<'lr-media-card'>;

export type LyraMemoryPanelSvelteProps = LyraSvelteElementProps<'lr-memory-panel'>;

export type LyraMentionPopoverSvelteProps = LyraSvelteElementProps<'lr-mention-popover'>;

export type LyraMenuSvelteProps = LyraSvelteElementProps<'lr-menu'>;

export type LyraMenuItemSvelteProps = LyraSvelteElementProps<'lr-menu-item'>;

export type LyraMenuLabelSvelteProps = LyraSvelteElementProps<'lr-menu-label'>;

export type LyraMenubarSvelteProps = LyraSvelteElementProps<'lr-menubar'>;

export type LyraMenubarItemSvelteProps = LyraSvelteElementProps<'lr-menubar-item'>;

export type LyraMessageActionsSvelteProps = LyraSvelteElementProps<'lr-message-actions'>;

export type LyraMessageFeedbackSvelteProps = LyraSvelteElementProps<'lr-message-feedback'>;

export type LyraMessagePartsSvelteProps = LyraSvelteElementProps<'lr-message-parts'>;

export type LyraMindMapSvelteProps = LyraSvelteElementProps<'lr-mind-map'>;

export type LyraModelSelectSvelteProps = LyraSvelteElementProps<'lr-model-select'>;

export type LyraModelSettingsPanelSvelteProps = LyraSvelteElementProps<'lr-model-settings-panel'>;

export type LyraMultiSplitSvelteProps = LyraSvelteElementProps<'lr-multi-split'>;

export type LyraMutationObserverSvelteProps = LyraSvelteElementProps<'lr-mutation-observer'>;

export type LyraNativeTimeInputSvelteProps = LyraSvelteElementProps<'lr-native-time-input'>;

export type LyraNavigationMenuSvelteProps = LyraSvelteElementProps<'lr-navigation-menu'>;

export type LyraNavigationMenuItemSvelteProps = LyraSvelteElementProps<'lr-navigation-menu-item'>;

export type LyraNeighborListSvelteProps = LyraSvelteElementProps<'lr-neighbor-list'>;

export type LyraNodePaletteSvelteProps = LyraSvelteElementProps<'lr-node-palette'>;

export type LyraNotebookViewerSvelteProps = LyraSvelteElementProps<'lr-notebook-viewer'>;

export type LyraNumberInputSvelteProps = LyraSvelteElementProps<'lr-number-input'>;

export type LyraOptionSvelteProps = LyraSvelteElementProps<'lr-option'>;

export type LyraOtpInputSvelteProps = LyraSvelteElementProps<'lr-otp-input'>;

export type LyraPageSvelteProps = LyraSvelteElementProps<'lr-page'>;

export type LyraPageRailSvelteProps = LyraSvelteElementProps<'lr-page-rail'>;

export type LyraPaginationSvelteProps = LyraSvelteElementProps<'lr-pagination'>;

export type LyraPanZoomSvelteProps = LyraSvelteElementProps<'lr-pan-zoom'>;

export type LyraPathStripSvelteProps = LyraSvelteElementProps<'lr-path-strip'>;

export type LyraPdfViewerSvelteProps = LyraSvelteElementProps<'lr-pdf-viewer'>;

export type LyraPermissionGrantSvelteProps = LyraSvelteElementProps<'lr-permission-grant'>;

export type LyraPermissionRulesSvelteProps = LyraSvelteElementProps<'lr-permission-rules'>;

export type LyraPhoneInputSvelteProps = LyraSvelteElementProps<'lr-phone-input'>;

export type LyraPieChartSvelteProps = LyraSvelteElementProps<'lr-pie-chart'>;

export type LyraPolarAreaChartSvelteProps = LyraSvelteElementProps<'lr-polar-area-chart'>;

export type LyraPolicySummarySvelteProps = LyraSvelteElementProps<'lr-policy-summary'>;

export type LyraPollStatusSvelteProps = LyraSvelteElementProps<'lr-poll-status'>;

export type LyraPopoverSvelteProps = LyraSvelteElementProps<'lr-popover'>;

export type LyraPopupSvelteProps = LyraSvelteElementProps<'lr-popup'>;

export type LyraPptxViewerSvelteProps = LyraSvelteElementProps<'lr-pptx-viewer'>;

export type LyraProgressBarSvelteProps = LyraSvelteElementProps<'lr-progress-bar'>;

export type LyraProgressRingSvelteProps = LyraSvelteElementProps<'lr-progress-ring'>;

export type LyraPromptInputSvelteProps = LyraSvelteElementProps<'lr-prompt-input'>;

export type LyraPromptQueueSvelteProps = LyraSvelteElementProps<'lr-prompt-queue'>;

export type LyraPromptStudioSvelteProps = LyraSvelteElementProps<'lr-prompt-studio'>;

export type LyraProvenancePanelSvelteProps = LyraSvelteElementProps<'lr-provenance-panel'>;

export type LyraPushToTalkSvelteProps = LyraSvelteElementProps<'lr-push-to-talk'>;

export type LyraQrCodeSvelteProps = LyraSvelteElementProps<'lr-qr-code'>;

export type LyraRadarChartSvelteProps = LyraSvelteElementProps<'lr-radar-chart'>;

export type LyraRadioSvelteProps = LyraSvelteElementProps<'lr-radio'>;

export type LyraRadioButtonSvelteProps = LyraSvelteElementProps<'lr-radio-button'>;

export type LyraRadioGroupSvelteProps = LyraSvelteElementProps<'lr-radio-group'>;

export type LyraRagAnswerSvelteProps = LyraSvelteElementProps<'lr-rag-answer'>;

export type LyraRagEvalDashboardSvelteProps = LyraSvelteElementProps<'lr-rag-eval-dashboard'>;

export type LyraRandomContentSvelteProps = LyraSvelteElementProps<'lr-random-content'>;

export type LyraRatingSvelteProps = LyraSvelteElementProps<'lr-rating'>;

export type LyraRealtimeSessionSvelteProps = LyraSvelteElementProps<'lr-realtime-session'>;

export type LyraRelativeTimeSvelteProps = LyraSvelteElementProps<'lr-relative-time'>;

export type LyraReorderItemSvelteProps = LyraSvelteElementProps<'lr-reorder-item'>;

export type LyraReorderListSvelteProps = LyraSvelteElementProps<'lr-reorder-list'>;

export type LyraResearchProgressSvelteProps = LyraSvelteElementProps<'lr-research-progress'>;

export type LyraResizeObserverSvelteProps = LyraSvelteElementProps<'lr-resize-observer'>;

export type LyraResponsivePanelSvelteProps = LyraSvelteElementProps<'lr-responsive-panel'>;

export type LyraResultCardSvelteProps = LyraSvelteElementProps<'lr-result-card'>;

export type LyraResultFieldSvelteProps = LyraSvelteElementProps<'lr-result-field'>;

export type LyraRetrievalCompareSvelteProps = LyraSvelteElementProps<'lr-retrieval-compare'>;

export type LyraRetrievalResultsSvelteProps = LyraSvelteElementProps<'lr-retrieval-results'>;

export type LyraRetrievalSearchSvelteProps = LyraSvelteElementProps<'lr-retrieval-search'>;

export type LyraRetrievalTraceSvelteProps = LyraSvelteElementProps<'lr-retrieval-trace'>;

export type LyraRubricFormSvelteProps = LyraSvelteElementProps<'lr-rubric-form'>;

export type LyraScatterChartSvelteProps = LyraSvelteElementProps<'lr-scatter-chart'>;

export type LyraScrollerSvelteProps = LyraSvelteElementProps<'lr-scroller'>;

export type LyraSegmentedSvelteProps = LyraSvelteElementProps<'lr-segmented'>;

export type LyraSelectSvelteProps = LyraSvelteElementProps<'lr-select'>;

export type LyraSelectionToolbarSvelteProps = LyraSvelteElementProps<'lr-selection-toolbar'>;

export type LyraSequencePlaybackSvelteProps = LyraSvelteElementProps<'lr-sequence-playback'>;

export type LyraSequenceStripSvelteProps = LyraSvelteElementProps<'lr-sequence-strip'>;

export type LyraSkeletonSvelteProps = LyraSvelteElementProps<'lr-skeleton'>;

export type LyraSliderSvelteProps = LyraSvelteElementProps<'lr-slider'>;

export type LyraSourceCardSvelteProps = LyraSvelteElementProps<'lr-source-card'>;

export type LyraSourceListSvelteProps = LyraSvelteElementProps<'lr-source-list'>;

export type LyraSourcePickerSvelteProps = LyraSvelteElementProps<'lr-source-picker'>;

export type LyraSpanWaterfallSvelteProps = LyraSvelteElementProps<'lr-span-waterfall'>;

export type LyraSparklineSvelteProps = LyraSvelteElementProps<'lr-sparkline'>;

export type LyraSpinnerSvelteProps = LyraSvelteElementProps<'lr-spinner'>;

export type LyraSplitPanelSvelteProps = LyraSvelteElementProps<'lr-split-panel'>;

export type LyraSpreadsheetViewerSvelteProps = LyraSvelteElementProps<'lr-spreadsheet-viewer'>;

export type LyraStackTraceSvelteProps = LyraSvelteElementProps<'lr-stack-trace'>;

export type LyraStatSvelteProps = LyraSvelteElementProps<'lr-stat'>;

export type LyraStepperSvelteProps = LyraSvelteElementProps<'lr-stepper'>;

export type LyraStreamStatusSvelteProps = LyraSvelteElementProps<'lr-stream-status'>;

export type LyraStreamingTextSvelteProps = LyraSvelteElementProps<'lr-streaming-text'>;

export type LyraStreamingTextCoreSvelteProps = LyraSvelteElementProps<'lr-streaming-text-core'>;

export type LyraSubagentPanelSvelteProps = LyraSvelteElementProps<'lr-subagent-panel'>;

export type LyraSuggestionChipsSvelteProps = LyraSvelteElementProps<'lr-suggestion-chips'>;

export type LyraSvgViewerSvelteProps = LyraSvelteElementProps<'lr-svg-viewer'>;

export type LyraSwatchPickerSvelteProps = LyraSvelteElementProps<'lr-swatch-picker'>;

export type LyraSwitchSvelteProps = LyraSvelteElementProps<'lr-switch'>;

export type LyraTabSvelteProps = LyraSvelteElementProps<'lr-tab'>;

export type LyraTabGroupSvelteProps = LyraSvelteElementProps<'lr-tab-group'>;

export type LyraTabPanelSvelteProps = LyraSvelteElementProps<'lr-tab-panel'>;

export type LyraTableSvelteProps = LyraSvelteElementProps<'lr-table'>;

export type LyraTagSvelteProps = LyraSvelteElementProps<'lr-tag'>;

export type LyraTaskListSvelteProps = LyraSvelteElementProps<'lr-task-list'>;

export type LyraTerminalSvelteProps = LyraSvelteElementProps<'lr-terminal'>;

export type LyraTestResultsSvelteProps = LyraSvelteElementProps<'lr-test-results'>;

export type LyraTextareaSvelteProps = LyraSvelteElementProps<'lr-textarea'>;

export type LyraThinkingPanelSvelteProps = LyraSvelteElementProps<'lr-thinking-panel'>;

export type LyraThreadListSvelteProps = LyraSvelteElementProps<'lr-thread-list'>;

export type LyraTimeInputSvelteProps = LyraSvelteElementProps<'lr-time-input'>;

export type LyraTimeRangeSvelteProps = LyraSvelteElementProps<'lr-time-range'>;

export type LyraTimelineSvelteProps = LyraSvelteElementProps<'lr-timeline'>;

export type LyraTimelineItemSvelteProps = LyraSvelteElementProps<'lr-timeline-item'>;

export type LyraToastSvelteProps = LyraSvelteElementProps<'lr-toast'>;

export type LyraToastItemSvelteProps = LyraSvelteElementProps<'lr-toast-item'>;

export type LyraToggleSvelteProps = LyraSvelteElementProps<'lr-toggle'>;

export type LyraToggleGroupSvelteProps = LyraSvelteElementProps<'lr-toggle-group'>;

export type LyraTokenInputSvelteProps = LyraSvelteElementProps<'lr-token-input'>;

export type LyraToolApprovalDialogSvelteProps = LyraSvelteElementProps<'lr-tool-approval-dialog'>;

export type LyraToolCallBlockSvelteProps = LyraSvelteElementProps<'lr-tool-call-block'>;

export type LyraToolCallChipSvelteProps = LyraSvelteElementProps<'lr-tool-call-chip'>;

export type LyraToolParamFormSvelteProps = LyraSvelteElementProps<'lr-tool-param-form'>;

export type LyraToolResultDialogSvelteProps = LyraSvelteElementProps<'lr-tool-result-dialog'>;

export type LyraToolResultViewSvelteProps = LyraSvelteElementProps<'lr-tool-result-view'>;

export type LyraToolSelectDialogSvelteProps = LyraSvelteElementProps<'lr-tool-select-dialog'>;

export type LyraToolTimelineSvelteProps = LyraSvelteElementProps<'lr-tool-timeline'>;

export type LyraTooltipSvelteProps = LyraSvelteElementProps<'lr-tooltip'>;

export type LyraTourSvelteProps = LyraSvelteElementProps<'lr-tour'>;

export type LyraTraceTreeSvelteProps = LyraSvelteElementProps<'lr-trace-tree'>;

export type LyraTranscriptFeedSvelteProps = LyraSvelteElementProps<'lr-transcript-feed'>;

export type LyraTreeSvelteProps = LyraSvelteElementProps<'lr-tree'>;

export type LyraTreeItemSvelteProps = LyraSvelteElementProps<'lr-tree-item'>;

export type LyraTypingIndicatorSvelteProps = LyraSvelteElementProps<'lr-typing-indicator'>;

export type LyraUsageBadgeSvelteProps = LyraSvelteElementProps<'lr-usage-badge'>;

export type LyraVideoSvelteProps = LyraSvelteElementProps<'lr-video'>;

export type LyraVideoPlaylistSvelteProps = LyraSvelteElementProps<'lr-video-playlist'>;

export type LyraVirtualListSvelteProps = LyraSvelteElementProps<'lr-virtual-list'>;

export type LyraVisuallyHiddenSvelteProps = LyraSvelteElementProps<'lr-visually-hidden'>;

export type LyraVoicePickerSvelteProps = LyraSvelteElementProps<'lr-voice-picker'>;

export type LyraWidgetSvelteProps = LyraSvelteElementProps<'lr-widget'>;

export type LyraWidgetRendererSvelteProps = LyraSvelteElementProps<'lr-widget-renderer'>;

export type LyraWordCloudSvelteProps = LyraSvelteElementProps<'lr-word-cloud'>;

export type LyraXmlViewerSvelteProps = LyraSvelteElementProps<'lr-xml-viewer'>;

export type LyraZoomableFrameSvelteProps = LyraSvelteElementProps<'lr-zoomable-frame'>;

export interface LyraSvelteElements {
  'lr-accordion': LyraAccordionSvelteProps;
  'lr-accordion-item': LyraAccordionItemSvelteProps;
  'lr-activity-feed': LyraActivityFeedSvelteProps;
  'lr-agent-eval-dashboard': LyraAgentEvalDashboardSvelteProps;
  'lr-agent-question': LyraAgentQuestionSvelteProps;
  'lr-agent-run': LyraAgentRunSvelteProps;
  'lr-agent-trace': LyraAgentTraceSvelteProps;
  'lr-agent-workspace': LyraAgentWorkspaceSvelteProps;
  'lr-alert': LyraAlertSvelteProps;
  'lr-animated-image': LyraAnimatedImageSvelteProps;
  'lr-animation': LyraAnimationSvelteProps;
  'lr-app-rail': LyraAppRailSvelteProps;
  'lr-app-rail-group': LyraAppRailGroupSvelteProps;
  'lr-app-rail-item': LyraAppRailItemSvelteProps;
  'lr-approval-queue': LyraApprovalQueueSvelteProps;
  'lr-archive-viewer': LyraArchiveViewerSvelteProps;
  'lr-artifact-panel': LyraArtifactPanelSvelteProps;
  'lr-attachment-chip': LyraAttachmentChipSvelteProps;
  'lr-attachment-trigger': LyraAttachmentTriggerSvelteProps;
  'lr-audio-visualizer': LyraAudioVisualizerSvelteProps;
  'lr-av-player': LyraAvPlayerSvelteProps;
  'lr-avatar': LyraAvatarSvelteProps;
  'lr-avatar-group': LyraAvatarGroupSvelteProps;
  'lr-background-runs': LyraBackgroundRunsSvelteProps;
  'lr-badge': LyraBadgeSvelteProps;
  'lr-bar-chart': LyraBarChartSvelteProps;
  'lr-box-plot': LyraBoxPlotSvelteProps;
  'lr-branch-picker': LyraBranchPickerSvelteProps;
  'lr-breadcrumb': LyraBreadcrumbSvelteProps;
  'lr-breadcrumb-item': LyraBreadcrumbItemSvelteProps;
  'lr-browser-frame': LyraBrowserFrameSvelteProps;
  'lr-bubble-chart': LyraBubbleChartSvelteProps;
  'lr-budget-meter': LyraBudgetMeterSvelteProps;
  'lr-button': LyraButtonSvelteProps;
  'lr-button-group': LyraButtonGroupSvelteProps;
  'lr-calendar': LyraCalendarSvelteProps;
  'lr-calendar-viewer': LyraCalendarViewerSvelteProps;
  'lr-callout': LyraCalloutSvelteProps;
  'lr-card': LyraCardSvelteProps;
  'lr-carousel': LyraCarouselSvelteProps;
  'lr-carousel-item': LyraCarouselItemSvelteProps;
  'lr-change-review': LyraChangeReviewSvelteProps;
  'lr-chart': LyraChartSvelteProps;
  'lr-chat-composer': LyraChatComposerSvelteProps;
  'lr-chat-message': LyraChatMessageSvelteProps;
  'lr-chat-viewport': LyraChatViewportSvelteProps;
  'lr-checkbox': LyraCheckboxSvelteProps;
  'lr-checkbox-group': LyraCheckboxGroupSvelteProps;
  'lr-checkpoint': LyraCheckpointSvelteProps;
  'lr-chip': LyraChipSvelteProps;
  'lr-chip-group': LyraChipGroupSvelteProps;
  'lr-chunk-inspector': LyraChunkInspectorSvelteProps;
  'lr-citation-badge': LyraCitationBadgeSvelteProps;
  'lr-claim-evidence': LyraClaimEvidenceSvelteProps;
  'lr-code-block': LyraCodeBlockSvelteProps;
  'lr-code-block-core': LyraCodeBlockCoreSvelteProps;
  'lr-code-editor': LyraCodeEditorSvelteProps;
  'lr-color-picker': LyraColorPickerSvelteProps;
  'lr-combobox': LyraComboboxSvelteProps;
  'lr-command-palette': LyraCommandPaletteSvelteProps;
  'lr-commit-card': LyraCommitCardSvelteProps;
  'lr-community-card': LyraCommunityCardSvelteProps;
  'lr-compare-panel': LyraComparePanelSvelteProps;
  'lr-condition-builder': LyraConditionBuilderSvelteProps;
  'lr-confirm-bar': LyraConfirmBarSvelteProps;
  'lr-connector-manager': LyraConnectorManagerSvelteProps;
  'lr-contact-viewer': LyraContactViewerSvelteProps;
  'lr-context-inspector': LyraContextInspectorSvelteProps;
  'lr-context-menu': LyraContextMenuSvelteProps;
  'lr-context-meter': LyraContextMeterSvelteProps;
  'lr-control-group': LyraControlGroupSvelteProps;
  'lr-conversation-item': LyraConversationItemSvelteProps;
  'lr-copy-button': LyraCopyButtonSvelteProps;
  'lr-csv-viewer': LyraCsvViewerSvelteProps;
  'lr-currency-picker': LyraCurrencyPickerSvelteProps;
  'lr-dashboard-grid': LyraDashboardGridSvelteProps;
  'lr-data-grid': LyraDataGridSvelteProps;
  'lr-dataset-viewer': LyraDatasetViewerSvelteProps;
  'lr-date-input': LyraDateInputSvelteProps;
  'lr-date-picker': LyraDatePickerSvelteProps;
  'lr-details': LyraDetailsSvelteProps;
  'lr-dialog': LyraDialogSvelteProps;
  'lr-diff-view': LyraDiffViewSvelteProps;
  'lr-divider': LyraDividerSvelteProps;
  'lr-dock-panel': LyraDockPanelSvelteProps;
  'lr-document-compare': LyraDocumentCompareSvelteProps;
  'lr-document-library': LyraDocumentLibrarySvelteProps;
  'lr-document-preview': LyraDocumentPreviewSvelteProps;
  'lr-document-viewer': LyraDocumentViewerSvelteProps;
  'lr-docx-viewer': LyraDocxViewerSvelteProps;
  'lr-doughnut-chart': LyraDoughnutChartSvelteProps;
  'lr-drawer': LyraDrawerSvelteProps;
  'lr-drilldown-panel': LyraDrilldownPanelSvelteProps;
  'lr-drop-zone': LyraDropZoneSvelteProps;
  'lr-dropdown': LyraDropdownSvelteProps;
  'lr-dropdown-item': LyraDropdownItemSvelteProps;
  'lr-ebook-viewer': LyraEbookViewerSvelteProps;
  'lr-email-viewer': LyraEmailViewerSvelteProps;
  'lr-embedding-explorer': LyraEmbeddingExplorerSvelteProps;
  'lr-emoji-picker': LyraEmojiPickerSvelteProps;
  'lr-empty': LyraEmptySvelteProps;
  'lr-entity-card': LyraEntityCardSvelteProps;
  'lr-entity-chip': LyraEntityChipSvelteProps;
  'lr-entity-dossier': LyraEntityDossierSvelteProps;
  'lr-env-list': LyraEnvListSvelteProps;
  'lr-eval-dataset': LyraEvalDatasetSvelteProps;
  'lr-eval-result': LyraEvalResultSvelteProps;
  'lr-eval-run': LyraEvalRunSvelteProps;
  'lr-export-button': LyraExportButtonSvelteProps;
  'lr-file-icon': LyraFileIconSvelteProps;
  'lr-file-input': LyraFileInputSvelteProps;
  'lr-file-tree': LyraFileTreeSvelteProps;
  'lr-filter-bar': LyraFilterBarSvelteProps;
  'lr-flag': LyraFlagSvelteProps;
  'lr-flow-canvas': LyraFlowCanvasSvelteProps;
  'lr-flow-controls': LyraFlowControlsSvelteProps;
  'lr-flow-minimap': LyraFlowMinimapSvelteProps;
  'lr-flow-node': LyraFlowNodeSvelteProps;
  'lr-flow-run-status': LyraFlowRunStatusSvelteProps;
  'lr-format-bytes': LyraFormatBytesSvelteProps;
  'lr-format-date': LyraFormatDateSvelteProps;
  'lr-format-number': LyraFormatNumberSvelteProps;
  'lr-funnel': LyraFunnelSvelteProps;
  'lr-gauge': LyraGaugeSvelteProps;
  'lr-generation-metrics': LyraGenerationMetricsSvelteProps;
  'lr-geojson-viewer': LyraGeoJsonViewerSvelteProps;
  'lr-graph': LyraGraphSvelteProps;
  'lr-graph-legend': LyraGraphLegendSvelteProps;
  'lr-graph-query-builder': LyraGraphQueryBuilderSvelteProps;
  'lr-grounding-summary': LyraGroundingSummarySvelteProps;
  'lr-handoff-divider': LyraHandoffDividerSvelteProps;
  'lr-heatmap': LyraHeatmapSvelteProps;
  'lr-highlight-layer': LyraHighlightLayerSvelteProps;
  'lr-histogram': LyraHistogramSvelteProps;
  'lr-html-viewer': LyraHtmlViewerSvelteProps;
  'lr-icon': LyraIconSvelteProps;
  'lr-icon-button': LyraIconButtonSvelteProps;
  'lr-image-comparer': LyraImageComparerSvelteProps;
  'lr-image-viewer': LyraImageViewerSvelteProps;
  'lr-include': LyraIncludeSvelteProps;
  'lr-ingestion-queue': LyraIngestionQueueSvelteProps;
  'lr-input': LyraInputSvelteProps;
  'lr-intersection-observer': LyraIntersectionObserverSvelteProps;
  'lr-json-schema-viewer': LyraJsonSchemaViewerSvelteProps;
  'lr-json-viewer': LyraJsonViewerSvelteProps;
  'lr-kbd': LyraKbdSvelteProps;
  'lr-knowledge-base': LyraKnowledgeBaseSvelteProps;
  'lr-knowledge-base-admin': LyraKnowledgeBaseAdminSvelteProps;
  'lr-knowledge-graph-explorer': LyraKnowledgeGraphExplorerSvelteProps;
  'lr-known-date': LyraKnownDateSvelteProps;
  'lr-lightbox': LyraLightboxSvelteProps;
  'lr-line-chart': LyraLineChartSvelteProps;
  'lr-lite-chart': LyraLiteChartSvelteProps;
  'lr-live-region': LyraLiveRegionSvelteProps;
  'lr-locale-picker': LyraLocalePickerSvelteProps;
  'lr-map': LyraMapSvelteProps;
  'lr-markdown': LyraMarkdownSvelteProps;
  'lr-markdown-core': LyraMarkdownCoreSvelteProps;
  'lr-mcp-app': LyraMcpAppSvelteProps;
  'lr-media-card': LyraMediaCardSvelteProps;
  'lr-memory-panel': LyraMemoryPanelSvelteProps;
  'lr-mention-popover': LyraMentionPopoverSvelteProps;
  'lr-menu': LyraMenuSvelteProps;
  'lr-menu-item': LyraMenuItemSvelteProps;
  'lr-menu-label': LyraMenuLabelSvelteProps;
  'lr-menubar': LyraMenubarSvelteProps;
  'lr-menubar-item': LyraMenubarItemSvelteProps;
  'lr-message-actions': LyraMessageActionsSvelteProps;
  'lr-message-feedback': LyraMessageFeedbackSvelteProps;
  'lr-message-parts': LyraMessagePartsSvelteProps;
  'lr-mind-map': LyraMindMapSvelteProps;
  'lr-model-select': LyraModelSelectSvelteProps;
  'lr-model-settings-panel': LyraModelSettingsPanelSvelteProps;
  'lr-multi-split': LyraMultiSplitSvelteProps;
  'lr-mutation-observer': LyraMutationObserverSvelteProps;
  'lr-native-time-input': LyraNativeTimeInputSvelteProps;
  'lr-navigation-menu': LyraNavigationMenuSvelteProps;
  'lr-navigation-menu-item': LyraNavigationMenuItemSvelteProps;
  'lr-neighbor-list': LyraNeighborListSvelteProps;
  'lr-node-palette': LyraNodePaletteSvelteProps;
  'lr-notebook-viewer': LyraNotebookViewerSvelteProps;
  'lr-number-input': LyraNumberInputSvelteProps;
  'lr-option': LyraOptionSvelteProps;
  'lr-otp-input': LyraOtpInputSvelteProps;
  'lr-page': LyraPageSvelteProps;
  'lr-page-rail': LyraPageRailSvelteProps;
  'lr-pagination': LyraPaginationSvelteProps;
  'lr-pan-zoom': LyraPanZoomSvelteProps;
  'lr-path-strip': LyraPathStripSvelteProps;
  'lr-pdf-viewer': LyraPdfViewerSvelteProps;
  'lr-permission-grant': LyraPermissionGrantSvelteProps;
  'lr-permission-rules': LyraPermissionRulesSvelteProps;
  'lr-phone-input': LyraPhoneInputSvelteProps;
  'lr-pie-chart': LyraPieChartSvelteProps;
  'lr-polar-area-chart': LyraPolarAreaChartSvelteProps;
  'lr-policy-summary': LyraPolicySummarySvelteProps;
  'lr-poll-status': LyraPollStatusSvelteProps;
  'lr-popover': LyraPopoverSvelteProps;
  'lr-popup': LyraPopupSvelteProps;
  'lr-pptx-viewer': LyraPptxViewerSvelteProps;
  'lr-progress-bar': LyraProgressBarSvelteProps;
  'lr-progress-ring': LyraProgressRingSvelteProps;
  'lr-prompt-input': LyraPromptInputSvelteProps;
  'lr-prompt-queue': LyraPromptQueueSvelteProps;
  'lr-prompt-studio': LyraPromptStudioSvelteProps;
  'lr-provenance-panel': LyraProvenancePanelSvelteProps;
  'lr-push-to-talk': LyraPushToTalkSvelteProps;
  'lr-qr-code': LyraQrCodeSvelteProps;
  'lr-radar-chart': LyraRadarChartSvelteProps;
  'lr-radio': LyraRadioSvelteProps;
  'lr-radio-button': LyraRadioButtonSvelteProps;
  'lr-radio-group': LyraRadioGroupSvelteProps;
  'lr-rag-answer': LyraRagAnswerSvelteProps;
  'lr-rag-eval-dashboard': LyraRagEvalDashboardSvelteProps;
  'lr-random-content': LyraRandomContentSvelteProps;
  'lr-rating': LyraRatingSvelteProps;
  'lr-realtime-session': LyraRealtimeSessionSvelteProps;
  'lr-relative-time': LyraRelativeTimeSvelteProps;
  'lr-reorder-item': LyraReorderItemSvelteProps;
  'lr-reorder-list': LyraReorderListSvelteProps;
  'lr-research-progress': LyraResearchProgressSvelteProps;
  'lr-resize-observer': LyraResizeObserverSvelteProps;
  'lr-responsive-panel': LyraResponsivePanelSvelteProps;
  'lr-result-card': LyraResultCardSvelteProps;
  'lr-result-field': LyraResultFieldSvelteProps;
  'lr-retrieval-compare': LyraRetrievalCompareSvelteProps;
  'lr-retrieval-results': LyraRetrievalResultsSvelteProps;
  'lr-retrieval-search': LyraRetrievalSearchSvelteProps;
  'lr-retrieval-trace': LyraRetrievalTraceSvelteProps;
  'lr-rubric-form': LyraRubricFormSvelteProps;
  'lr-scatter-chart': LyraScatterChartSvelteProps;
  'lr-scroller': LyraScrollerSvelteProps;
  'lr-segmented': LyraSegmentedSvelteProps;
  'lr-select': LyraSelectSvelteProps;
  'lr-selection-toolbar': LyraSelectionToolbarSvelteProps;
  'lr-sequence-playback': LyraSequencePlaybackSvelteProps;
  'lr-sequence-strip': LyraSequenceStripSvelteProps;
  'lr-skeleton': LyraSkeletonSvelteProps;
  'lr-slider': LyraSliderSvelteProps;
  'lr-source-card': LyraSourceCardSvelteProps;
  'lr-source-list': LyraSourceListSvelteProps;
  'lr-source-picker': LyraSourcePickerSvelteProps;
  'lr-span-waterfall': LyraSpanWaterfallSvelteProps;
  'lr-sparkline': LyraSparklineSvelteProps;
  'lr-spinner': LyraSpinnerSvelteProps;
  'lr-split-panel': LyraSplitPanelSvelteProps;
  'lr-spreadsheet-viewer': LyraSpreadsheetViewerSvelteProps;
  'lr-stack-trace': LyraStackTraceSvelteProps;
  'lr-stat': LyraStatSvelteProps;
  'lr-stepper': LyraStepperSvelteProps;
  'lr-stream-status': LyraStreamStatusSvelteProps;
  'lr-streaming-text': LyraStreamingTextSvelteProps;
  'lr-streaming-text-core': LyraStreamingTextCoreSvelteProps;
  'lr-subagent-panel': LyraSubagentPanelSvelteProps;
  'lr-suggestion-chips': LyraSuggestionChipsSvelteProps;
  'lr-svg-viewer': LyraSvgViewerSvelteProps;
  'lr-swatch-picker': LyraSwatchPickerSvelteProps;
  'lr-switch': LyraSwitchSvelteProps;
  'lr-tab': LyraTabSvelteProps;
  'lr-tab-group': LyraTabGroupSvelteProps;
  'lr-tab-panel': LyraTabPanelSvelteProps;
  'lr-table': LyraTableSvelteProps;
  'lr-tag': LyraTagSvelteProps;
  'lr-task-list': LyraTaskListSvelteProps;
  'lr-terminal': LyraTerminalSvelteProps;
  'lr-test-results': LyraTestResultsSvelteProps;
  'lr-textarea': LyraTextareaSvelteProps;
  'lr-thinking-panel': LyraThinkingPanelSvelteProps;
  'lr-thread-list': LyraThreadListSvelteProps;
  'lr-time-input': LyraTimeInputSvelteProps;
  'lr-time-range': LyraTimeRangeSvelteProps;
  'lr-timeline': LyraTimelineSvelteProps;
  'lr-timeline-item': LyraTimelineItemSvelteProps;
  'lr-toast': LyraToastSvelteProps;
  'lr-toast-item': LyraToastItemSvelteProps;
  'lr-toggle': LyraToggleSvelteProps;
  'lr-toggle-group': LyraToggleGroupSvelteProps;
  'lr-token-input': LyraTokenInputSvelteProps;
  'lr-tool-approval-dialog': LyraToolApprovalDialogSvelteProps;
  'lr-tool-call-block': LyraToolCallBlockSvelteProps;
  'lr-tool-call-chip': LyraToolCallChipSvelteProps;
  'lr-tool-param-form': LyraToolParamFormSvelteProps;
  'lr-tool-result-dialog': LyraToolResultDialogSvelteProps;
  'lr-tool-result-view': LyraToolResultViewSvelteProps;
  'lr-tool-select-dialog': LyraToolSelectDialogSvelteProps;
  'lr-tool-timeline': LyraToolTimelineSvelteProps;
  'lr-tooltip': LyraTooltipSvelteProps;
  'lr-tour': LyraTourSvelteProps;
  'lr-trace-tree': LyraTraceTreeSvelteProps;
  'lr-transcript-feed': LyraTranscriptFeedSvelteProps;
  'lr-tree': LyraTreeSvelteProps;
  'lr-tree-item': LyraTreeItemSvelteProps;
  'lr-typing-indicator': LyraTypingIndicatorSvelteProps;
  'lr-usage-badge': LyraUsageBadgeSvelteProps;
  'lr-video': LyraVideoSvelteProps;
  'lr-video-playlist': LyraVideoPlaylistSvelteProps;
  'lr-virtual-list': LyraVirtualListSvelteProps;
  'lr-visually-hidden': LyraVisuallyHiddenSvelteProps;
  'lr-voice-picker': LyraVoicePickerSvelteProps;
  'lr-widget': LyraWidgetSvelteProps;
  'lr-widget-renderer': LyraWidgetRendererSvelteProps;
  'lr-word-cloud': LyraWordCloudSvelteProps;
  'lr-xml-viewer': LyraXmlViewerSvelteProps;
  'lr-zoomable-frame': LyraZoomableFrameSvelteProps;
}

export interface LyraElementTagNameMap {
  'lr-accordion': LyraComponentTypeMap['lr-accordion']['element'];
  'lr-accordion-item': LyraComponentTypeMap['lr-accordion-item']['element'];
  'lr-activity-feed': LyraComponentTypeMap['lr-activity-feed']['element'];
  'lr-agent-eval-dashboard': LyraComponentTypeMap['lr-agent-eval-dashboard']['element'];
  'lr-agent-question': LyraComponentTypeMap['lr-agent-question']['element'];
  'lr-agent-run': LyraComponentTypeMap['lr-agent-run']['element'];
  'lr-agent-trace': LyraComponentTypeMap['lr-agent-trace']['element'];
  'lr-agent-workspace': LyraComponentTypeMap['lr-agent-workspace']['element'];
  'lr-alert': LyraComponentTypeMap['lr-alert']['element'];
  'lr-animated-image': LyraComponentTypeMap['lr-animated-image']['element'];
  'lr-animation': LyraComponentTypeMap['lr-animation']['element'];
  'lr-app-rail': LyraComponentTypeMap['lr-app-rail']['element'];
  'lr-app-rail-group': LyraComponentTypeMap['lr-app-rail-group']['element'];
  'lr-app-rail-item': LyraComponentTypeMap['lr-app-rail-item']['element'];
  'lr-approval-queue': LyraComponentTypeMap['lr-approval-queue']['element'];
  'lr-archive-viewer': LyraComponentTypeMap['lr-archive-viewer']['element'];
  'lr-artifact-panel': LyraComponentTypeMap['lr-artifact-panel']['element'];
  'lr-attachment-chip': LyraComponentTypeMap['lr-attachment-chip']['element'];
  'lr-attachment-trigger': LyraComponentTypeMap['lr-attachment-trigger']['element'];
  'lr-audio-visualizer': LyraComponentTypeMap['lr-audio-visualizer']['element'];
  'lr-av-player': LyraComponentTypeMap['lr-av-player']['element'];
  'lr-avatar': LyraComponentTypeMap['lr-avatar']['element'];
  'lr-avatar-group': LyraComponentTypeMap['lr-avatar-group']['element'];
  'lr-background-runs': LyraComponentTypeMap['lr-background-runs']['element'];
  'lr-badge': LyraComponentTypeMap['lr-badge']['element'];
  'lr-bar-chart': LyraComponentTypeMap['lr-bar-chart']['element'];
  'lr-box-plot': LyraComponentTypeMap['lr-box-plot']['element'];
  'lr-branch-picker': LyraComponentTypeMap['lr-branch-picker']['element'];
  'lr-breadcrumb': LyraComponentTypeMap['lr-breadcrumb']['element'];
  'lr-breadcrumb-item': LyraComponentTypeMap['lr-breadcrumb-item']['element'];
  'lr-browser-frame': LyraComponentTypeMap['lr-browser-frame']['element'];
  'lr-bubble-chart': LyraComponentTypeMap['lr-bubble-chart']['element'];
  'lr-budget-meter': LyraComponentTypeMap['lr-budget-meter']['element'];
  'lr-button': LyraComponentTypeMap['lr-button']['element'];
  'lr-button-group': LyraComponentTypeMap['lr-button-group']['element'];
  'lr-calendar': LyraComponentTypeMap['lr-calendar']['element'];
  'lr-calendar-viewer': LyraComponentTypeMap['lr-calendar-viewer']['element'];
  'lr-callout': LyraComponentTypeMap['lr-callout']['element'];
  'lr-card': LyraComponentTypeMap['lr-card']['element'];
  'lr-carousel': LyraComponentTypeMap['lr-carousel']['element'];
  'lr-carousel-item': LyraComponentTypeMap['lr-carousel-item']['element'];
  'lr-change-review': LyraComponentTypeMap['lr-change-review']['element'];
  'lr-chart': LyraComponentTypeMap['lr-chart']['element'];
  'lr-chat-composer': LyraComponentTypeMap['lr-chat-composer']['element'];
  'lr-chat-message': LyraComponentTypeMap['lr-chat-message']['element'];
  'lr-chat-viewport': LyraComponentTypeMap['lr-chat-viewport']['element'];
  'lr-checkbox': LyraComponentTypeMap['lr-checkbox']['element'];
  'lr-checkbox-group': LyraComponentTypeMap['lr-checkbox-group']['element'];
  'lr-checkpoint': LyraComponentTypeMap['lr-checkpoint']['element'];
  'lr-chip': LyraComponentTypeMap['lr-chip']['element'];
  'lr-chip-group': LyraComponentTypeMap['lr-chip-group']['element'];
  'lr-chunk-inspector': LyraComponentTypeMap['lr-chunk-inspector']['element'];
  'lr-citation-badge': LyraComponentTypeMap['lr-citation-badge']['element'];
  'lr-claim-evidence': LyraComponentTypeMap['lr-claim-evidence']['element'];
  'lr-code-block': LyraComponentTypeMap['lr-code-block']['element'];
  'lr-code-block-core': LyraComponentTypeMap['lr-code-block-core']['element'];
  'lr-code-editor': LyraComponentTypeMap['lr-code-editor']['element'];
  'lr-color-picker': LyraComponentTypeMap['lr-color-picker']['element'];
  'lr-combobox': LyraComponentTypeMap['lr-combobox']['element'];
  'lr-command-palette': LyraComponentTypeMap['lr-command-palette']['element'];
  'lr-commit-card': LyraComponentTypeMap['lr-commit-card']['element'];
  'lr-community-card': LyraComponentTypeMap['lr-community-card']['element'];
  'lr-compare-panel': LyraComponentTypeMap['lr-compare-panel']['element'];
  'lr-condition-builder': LyraComponentTypeMap['lr-condition-builder']['element'];
  'lr-confirm-bar': LyraComponentTypeMap['lr-confirm-bar']['element'];
  'lr-connector-manager': LyraComponentTypeMap['lr-connector-manager']['element'];
  'lr-contact-viewer': LyraComponentTypeMap['lr-contact-viewer']['element'];
  'lr-context-inspector': LyraComponentTypeMap['lr-context-inspector']['element'];
  'lr-context-menu': LyraComponentTypeMap['lr-context-menu']['element'];
  'lr-context-meter': LyraComponentTypeMap['lr-context-meter']['element'];
  'lr-control-group': LyraComponentTypeMap['lr-control-group']['element'];
  'lr-conversation-item': LyraComponentTypeMap['lr-conversation-item']['element'];
  'lr-copy-button': LyraComponentTypeMap['lr-copy-button']['element'];
  'lr-csv-viewer': LyraComponentTypeMap['lr-csv-viewer']['element'];
  'lr-currency-picker': LyraComponentTypeMap['lr-currency-picker']['element'];
  'lr-dashboard-grid': LyraComponentTypeMap['lr-dashboard-grid']['element'];
  'lr-data-grid': LyraComponentTypeMap['lr-data-grid']['element'];
  'lr-dataset-viewer': LyraComponentTypeMap['lr-dataset-viewer']['element'];
  'lr-date-input': LyraComponentTypeMap['lr-date-input']['element'];
  'lr-date-picker': LyraComponentTypeMap['lr-date-picker']['element'];
  'lr-details': LyraComponentTypeMap['lr-details']['element'];
  'lr-dialog': LyraComponentTypeMap['lr-dialog']['element'];
  'lr-diff-view': LyraComponentTypeMap['lr-diff-view']['element'];
  'lr-divider': LyraComponentTypeMap['lr-divider']['element'];
  'lr-dock-panel': LyraComponentTypeMap['lr-dock-panel']['element'];
  'lr-document-compare': LyraComponentTypeMap['lr-document-compare']['element'];
  'lr-document-library': LyraComponentTypeMap['lr-document-library']['element'];
  'lr-document-preview': LyraComponentTypeMap['lr-document-preview']['element'];
  'lr-document-viewer': LyraComponentTypeMap['lr-document-viewer']['element'];
  'lr-docx-viewer': LyraComponentTypeMap['lr-docx-viewer']['element'];
  'lr-doughnut-chart': LyraComponentTypeMap['lr-doughnut-chart']['element'];
  'lr-drawer': LyraComponentTypeMap['lr-drawer']['element'];
  'lr-drilldown-panel': LyraComponentTypeMap['lr-drilldown-panel']['element'];
  'lr-drop-zone': LyraComponentTypeMap['lr-drop-zone']['element'];
  'lr-dropdown': LyraComponentTypeMap['lr-dropdown']['element'];
  'lr-dropdown-item': LyraComponentTypeMap['lr-dropdown-item']['element'];
  'lr-ebook-viewer': LyraComponentTypeMap['lr-ebook-viewer']['element'];
  'lr-email-viewer': LyraComponentTypeMap['lr-email-viewer']['element'];
  'lr-embedding-explorer': LyraComponentTypeMap['lr-embedding-explorer']['element'];
  'lr-emoji-picker': LyraComponentTypeMap['lr-emoji-picker']['element'];
  'lr-empty': LyraComponentTypeMap['lr-empty']['element'];
  'lr-entity-card': LyraComponentTypeMap['lr-entity-card']['element'];
  'lr-entity-chip': LyraComponentTypeMap['lr-entity-chip']['element'];
  'lr-entity-dossier': LyraComponentTypeMap['lr-entity-dossier']['element'];
  'lr-env-list': LyraComponentTypeMap['lr-env-list']['element'];
  'lr-eval-dataset': LyraComponentTypeMap['lr-eval-dataset']['element'];
  'lr-eval-result': LyraComponentTypeMap['lr-eval-result']['element'];
  'lr-eval-run': LyraComponentTypeMap['lr-eval-run']['element'];
  'lr-export-button': LyraComponentTypeMap['lr-export-button']['element'];
  'lr-file-icon': LyraComponentTypeMap['lr-file-icon']['element'];
  'lr-file-input': LyraComponentTypeMap['lr-file-input']['element'];
  'lr-file-tree': LyraComponentTypeMap['lr-file-tree']['element'];
  'lr-filter-bar': LyraComponentTypeMap['lr-filter-bar']['element'];
  'lr-flag': LyraComponentTypeMap['lr-flag']['element'];
  'lr-flow-canvas': LyraComponentTypeMap['lr-flow-canvas']['element'];
  'lr-flow-controls': LyraComponentTypeMap['lr-flow-controls']['element'];
  'lr-flow-minimap': LyraComponentTypeMap['lr-flow-minimap']['element'];
  'lr-flow-node': LyraComponentTypeMap['lr-flow-node']['element'];
  'lr-flow-run-status': LyraComponentTypeMap['lr-flow-run-status']['element'];
  'lr-format-bytes': LyraComponentTypeMap['lr-format-bytes']['element'];
  'lr-format-date': LyraComponentTypeMap['lr-format-date']['element'];
  'lr-format-number': LyraComponentTypeMap['lr-format-number']['element'];
  'lr-funnel': LyraComponentTypeMap['lr-funnel']['element'];
  'lr-gauge': LyraComponentTypeMap['lr-gauge']['element'];
  'lr-generation-metrics': LyraComponentTypeMap['lr-generation-metrics']['element'];
  'lr-geojson-viewer': LyraComponentTypeMap['lr-geojson-viewer']['element'];
  'lr-graph': LyraComponentTypeMap['lr-graph']['element'];
  'lr-graph-legend': LyraComponentTypeMap['lr-graph-legend']['element'];
  'lr-graph-query-builder': LyraComponentTypeMap['lr-graph-query-builder']['element'];
  'lr-grounding-summary': LyraComponentTypeMap['lr-grounding-summary']['element'];
  'lr-handoff-divider': LyraComponentTypeMap['lr-handoff-divider']['element'];
  'lr-heatmap': LyraComponentTypeMap['lr-heatmap']['element'];
  'lr-highlight-layer': LyraComponentTypeMap['lr-highlight-layer']['element'];
  'lr-histogram': LyraComponentTypeMap['lr-histogram']['element'];
  'lr-html-viewer': LyraComponentTypeMap['lr-html-viewer']['element'];
  'lr-icon': LyraComponentTypeMap['lr-icon']['element'];
  'lr-icon-button': LyraComponentTypeMap['lr-icon-button']['element'];
  'lr-image-comparer': LyraComponentTypeMap['lr-image-comparer']['element'];
  'lr-image-viewer': LyraComponentTypeMap['lr-image-viewer']['element'];
  'lr-include': LyraComponentTypeMap['lr-include']['element'];
  'lr-ingestion-queue': LyraComponentTypeMap['lr-ingestion-queue']['element'];
  'lr-input': LyraComponentTypeMap['lr-input']['element'];
  'lr-intersection-observer': LyraComponentTypeMap['lr-intersection-observer']['element'];
  'lr-json-schema-viewer': LyraComponentTypeMap['lr-json-schema-viewer']['element'];
  'lr-json-viewer': LyraComponentTypeMap['lr-json-viewer']['element'];
  'lr-kbd': LyraComponentTypeMap['lr-kbd']['element'];
  'lr-knowledge-base': LyraComponentTypeMap['lr-knowledge-base']['element'];
  'lr-knowledge-base-admin': LyraComponentTypeMap['lr-knowledge-base-admin']['element'];
  'lr-knowledge-graph-explorer': LyraComponentTypeMap['lr-knowledge-graph-explorer']['element'];
  'lr-known-date': LyraComponentTypeMap['lr-known-date']['element'];
  'lr-lightbox': LyraComponentTypeMap['lr-lightbox']['element'];
  'lr-line-chart': LyraComponentTypeMap['lr-line-chart']['element'];
  'lr-lite-chart': LyraComponentTypeMap['lr-lite-chart']['element'];
  'lr-live-region': LyraComponentTypeMap['lr-live-region']['element'];
  'lr-locale-picker': LyraComponentTypeMap['lr-locale-picker']['element'];
  'lr-map': LyraComponentTypeMap['lr-map']['element'];
  'lr-markdown': LyraComponentTypeMap['lr-markdown']['element'];
  'lr-markdown-core': LyraComponentTypeMap['lr-markdown-core']['element'];
  'lr-mcp-app': LyraComponentTypeMap['lr-mcp-app']['element'];
  'lr-media-card': LyraComponentTypeMap['lr-media-card']['element'];
  'lr-memory-panel': LyraComponentTypeMap['lr-memory-panel']['element'];
  'lr-mention-popover': LyraComponentTypeMap['lr-mention-popover']['element'];
  'lr-menu': LyraComponentTypeMap['lr-menu']['element'];
  'lr-menu-item': LyraComponentTypeMap['lr-menu-item']['element'];
  'lr-menu-label': LyraComponentTypeMap['lr-menu-label']['element'];
  'lr-menubar': LyraComponentTypeMap['lr-menubar']['element'];
  'lr-menubar-item': LyraComponentTypeMap['lr-menubar-item']['element'];
  'lr-message-actions': LyraComponentTypeMap['lr-message-actions']['element'];
  'lr-message-feedback': LyraComponentTypeMap['lr-message-feedback']['element'];
  'lr-message-parts': LyraComponentTypeMap['lr-message-parts']['element'];
  'lr-mind-map': LyraComponentTypeMap['lr-mind-map']['element'];
  'lr-model-select': LyraComponentTypeMap['lr-model-select']['element'];
  'lr-model-settings-panel': LyraComponentTypeMap['lr-model-settings-panel']['element'];
  'lr-multi-split': LyraComponentTypeMap['lr-multi-split']['element'];
  'lr-mutation-observer': LyraComponentTypeMap['lr-mutation-observer']['element'];
  'lr-native-time-input': LyraComponentTypeMap['lr-native-time-input']['element'];
  'lr-navigation-menu': LyraComponentTypeMap['lr-navigation-menu']['element'];
  'lr-navigation-menu-item': LyraComponentTypeMap['lr-navigation-menu-item']['element'];
  'lr-neighbor-list': LyraComponentTypeMap['lr-neighbor-list']['element'];
  'lr-node-palette': LyraComponentTypeMap['lr-node-palette']['element'];
  'lr-notebook-viewer': LyraComponentTypeMap['lr-notebook-viewer']['element'];
  'lr-number-input': LyraComponentTypeMap['lr-number-input']['element'];
  'lr-option': LyraComponentTypeMap['lr-option']['element'];
  'lr-otp-input': LyraComponentTypeMap['lr-otp-input']['element'];
  'lr-page': LyraComponentTypeMap['lr-page']['element'];
  'lr-page-rail': LyraComponentTypeMap['lr-page-rail']['element'];
  'lr-pagination': LyraComponentTypeMap['lr-pagination']['element'];
  'lr-pan-zoom': LyraComponentTypeMap['lr-pan-zoom']['element'];
  'lr-path-strip': LyraComponentTypeMap['lr-path-strip']['element'];
  'lr-pdf-viewer': LyraComponentTypeMap['lr-pdf-viewer']['element'];
  'lr-permission-grant': LyraComponentTypeMap['lr-permission-grant']['element'];
  'lr-permission-rules': LyraComponentTypeMap['lr-permission-rules']['element'];
  'lr-phone-input': LyraComponentTypeMap['lr-phone-input']['element'];
  'lr-pie-chart': LyraComponentTypeMap['lr-pie-chart']['element'];
  'lr-polar-area-chart': LyraComponentTypeMap['lr-polar-area-chart']['element'];
  'lr-policy-summary': LyraComponentTypeMap['lr-policy-summary']['element'];
  'lr-poll-status': LyraComponentTypeMap['lr-poll-status']['element'];
  'lr-popover': LyraComponentTypeMap['lr-popover']['element'];
  'lr-popup': LyraComponentTypeMap['lr-popup']['element'];
  'lr-pptx-viewer': LyraComponentTypeMap['lr-pptx-viewer']['element'];
  'lr-progress-bar': LyraComponentTypeMap['lr-progress-bar']['element'];
  'lr-progress-ring': LyraComponentTypeMap['lr-progress-ring']['element'];
  'lr-prompt-input': LyraComponentTypeMap['lr-prompt-input']['element'];
  'lr-prompt-queue': LyraComponentTypeMap['lr-prompt-queue']['element'];
  'lr-prompt-studio': LyraComponentTypeMap['lr-prompt-studio']['element'];
  'lr-provenance-panel': LyraComponentTypeMap['lr-provenance-panel']['element'];
  'lr-push-to-talk': LyraComponentTypeMap['lr-push-to-talk']['element'];
  'lr-qr-code': LyraComponentTypeMap['lr-qr-code']['element'];
  'lr-radar-chart': LyraComponentTypeMap['lr-radar-chart']['element'];
  'lr-radio': LyraComponentTypeMap['lr-radio']['element'];
  'lr-radio-button': LyraComponentTypeMap['lr-radio-button']['element'];
  'lr-radio-group': LyraComponentTypeMap['lr-radio-group']['element'];
  'lr-rag-answer': LyraComponentTypeMap['lr-rag-answer']['element'];
  'lr-rag-eval-dashboard': LyraComponentTypeMap['lr-rag-eval-dashboard']['element'];
  'lr-random-content': LyraComponentTypeMap['lr-random-content']['element'];
  'lr-rating': LyraComponentTypeMap['lr-rating']['element'];
  'lr-realtime-session': LyraComponentTypeMap['lr-realtime-session']['element'];
  'lr-relative-time': LyraComponentTypeMap['lr-relative-time']['element'];
  'lr-reorder-item': LyraComponentTypeMap['lr-reorder-item']['element'];
  'lr-reorder-list': LyraComponentTypeMap['lr-reorder-list']['element'];
  'lr-research-progress': LyraComponentTypeMap['lr-research-progress']['element'];
  'lr-resize-observer': LyraComponentTypeMap['lr-resize-observer']['element'];
  'lr-responsive-panel': LyraComponentTypeMap['lr-responsive-panel']['element'];
  'lr-result-card': LyraComponentTypeMap['lr-result-card']['element'];
  'lr-result-field': LyraComponentTypeMap['lr-result-field']['element'];
  'lr-retrieval-compare': LyraComponentTypeMap['lr-retrieval-compare']['element'];
  'lr-retrieval-results': LyraComponentTypeMap['lr-retrieval-results']['element'];
  'lr-retrieval-search': LyraComponentTypeMap['lr-retrieval-search']['element'];
  'lr-retrieval-trace': LyraComponentTypeMap['lr-retrieval-trace']['element'];
  'lr-rubric-form': LyraComponentTypeMap['lr-rubric-form']['element'];
  'lr-scatter-chart': LyraComponentTypeMap['lr-scatter-chart']['element'];
  'lr-scroller': LyraComponentTypeMap['lr-scroller']['element'];
  'lr-segmented': LyraComponentTypeMap['lr-segmented']['element'];
  'lr-select': LyraComponentTypeMap['lr-select']['element'];
  'lr-selection-toolbar': LyraComponentTypeMap['lr-selection-toolbar']['element'];
  'lr-sequence-playback': LyraComponentTypeMap['lr-sequence-playback']['element'];
  'lr-sequence-strip': LyraComponentTypeMap['lr-sequence-strip']['element'];
  'lr-skeleton': LyraComponentTypeMap['lr-skeleton']['element'];
  'lr-slider': LyraComponentTypeMap['lr-slider']['element'];
  'lr-source-card': LyraComponentTypeMap['lr-source-card']['element'];
  'lr-source-list': LyraComponentTypeMap['lr-source-list']['element'];
  'lr-source-picker': LyraComponentTypeMap['lr-source-picker']['element'];
  'lr-span-waterfall': LyraComponentTypeMap['lr-span-waterfall']['element'];
  'lr-sparkline': LyraComponentTypeMap['lr-sparkline']['element'];
  'lr-spinner': LyraComponentTypeMap['lr-spinner']['element'];
  'lr-split-panel': LyraComponentTypeMap['lr-split-panel']['element'];
  'lr-spreadsheet-viewer': LyraComponentTypeMap['lr-spreadsheet-viewer']['element'];
  'lr-stack-trace': LyraComponentTypeMap['lr-stack-trace']['element'];
  'lr-stat': LyraComponentTypeMap['lr-stat']['element'];
  'lr-stepper': LyraComponentTypeMap['lr-stepper']['element'];
  'lr-stream-status': LyraComponentTypeMap['lr-stream-status']['element'];
  'lr-streaming-text': LyraComponentTypeMap['lr-streaming-text']['element'];
  'lr-streaming-text-core': LyraComponentTypeMap['lr-streaming-text-core']['element'];
  'lr-subagent-panel': LyraComponentTypeMap['lr-subagent-panel']['element'];
  'lr-suggestion-chips': LyraComponentTypeMap['lr-suggestion-chips']['element'];
  'lr-svg-viewer': LyraComponentTypeMap['lr-svg-viewer']['element'];
  'lr-swatch-picker': LyraComponentTypeMap['lr-swatch-picker']['element'];
  'lr-switch': LyraComponentTypeMap['lr-switch']['element'];
  'lr-tab': LyraComponentTypeMap['lr-tab']['element'];
  'lr-tab-group': LyraComponentTypeMap['lr-tab-group']['element'];
  'lr-tab-panel': LyraComponentTypeMap['lr-tab-panel']['element'];
  'lr-table': LyraComponentTypeMap['lr-table']['element'];
  'lr-tag': LyraComponentTypeMap['lr-tag']['element'];
  'lr-task-list': LyraComponentTypeMap['lr-task-list']['element'];
  'lr-terminal': LyraComponentTypeMap['lr-terminal']['element'];
  'lr-test-results': LyraComponentTypeMap['lr-test-results']['element'];
  'lr-textarea': LyraComponentTypeMap['lr-textarea']['element'];
  'lr-thinking-panel': LyraComponentTypeMap['lr-thinking-panel']['element'];
  'lr-thread-list': LyraComponentTypeMap['lr-thread-list']['element'];
  'lr-time-input': LyraComponentTypeMap['lr-time-input']['element'];
  'lr-time-range': LyraComponentTypeMap['lr-time-range']['element'];
  'lr-timeline': LyraComponentTypeMap['lr-timeline']['element'];
  'lr-timeline-item': LyraComponentTypeMap['lr-timeline-item']['element'];
  'lr-toast': LyraComponentTypeMap['lr-toast']['element'];
  'lr-toast-item': LyraComponentTypeMap['lr-toast-item']['element'];
  'lr-toggle': LyraComponentTypeMap['lr-toggle']['element'];
  'lr-toggle-group': LyraComponentTypeMap['lr-toggle-group']['element'];
  'lr-token-input': LyraComponentTypeMap['lr-token-input']['element'];
  'lr-tool-approval-dialog': LyraComponentTypeMap['lr-tool-approval-dialog']['element'];
  'lr-tool-call-block': LyraComponentTypeMap['lr-tool-call-block']['element'];
  'lr-tool-call-chip': LyraComponentTypeMap['lr-tool-call-chip']['element'];
  'lr-tool-param-form': LyraComponentTypeMap['lr-tool-param-form']['element'];
  'lr-tool-result-dialog': LyraComponentTypeMap['lr-tool-result-dialog']['element'];
  'lr-tool-result-view': LyraComponentTypeMap['lr-tool-result-view']['element'];
  'lr-tool-select-dialog': LyraComponentTypeMap['lr-tool-select-dialog']['element'];
  'lr-tool-timeline': LyraComponentTypeMap['lr-tool-timeline']['element'];
  'lr-tooltip': LyraComponentTypeMap['lr-tooltip']['element'];
  'lr-tour': LyraComponentTypeMap['lr-tour']['element'];
  'lr-trace-tree': LyraComponentTypeMap['lr-trace-tree']['element'];
  'lr-transcript-feed': LyraComponentTypeMap['lr-transcript-feed']['element'];
  'lr-tree': LyraComponentTypeMap['lr-tree']['element'];
  'lr-tree-item': LyraComponentTypeMap['lr-tree-item']['element'];
  'lr-typing-indicator': LyraComponentTypeMap['lr-typing-indicator']['element'];
  'lr-usage-badge': LyraComponentTypeMap['lr-usage-badge']['element'];
  'lr-video': LyraComponentTypeMap['lr-video']['element'];
  'lr-video-playlist': LyraComponentTypeMap['lr-video-playlist']['element'];
  'lr-virtual-list': LyraComponentTypeMap['lr-virtual-list']['element'];
  'lr-visually-hidden': LyraComponentTypeMap['lr-visually-hidden']['element'];
  'lr-voice-picker': LyraComponentTypeMap['lr-voice-picker']['element'];
  'lr-widget': LyraComponentTypeMap['lr-widget']['element'];
  'lr-widget-renderer': LyraComponentTypeMap['lr-widget-renderer']['element'];
  'lr-word-cloud': LyraComponentTypeMap['lr-word-cloud']['element'];
  'lr-xml-viewer': LyraComponentTypeMap['lr-xml-viewer']['element'];
  'lr-zoomable-frame': LyraComponentTypeMap['lr-zoomable-frame']['element'];
}

declare module 'svelte/elements' {
  export interface SvelteHTMLElements extends LyraSvelteElements {}
}

declare global {
  interface HTMLElementTagNameMap extends LyraElementTagNameMap {}
}
