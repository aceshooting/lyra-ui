// GENERATED FILE — do not edit by hand. Opt-in Vue 3 custom-element declarations.
// Regenerate with `pnpm --filter @aceshooting/lyra-ui run framework-types`.
// This module contains types only; its emitted JavaScript is an empty module.
import type { EmitFn, HTMLAttributes, PublicProps } from 'vue';
import type { LyraComponentTypeMap, LyraBoundEvent, LyraCSSCustomProperties } from './framework-types.js';
export type { LyraUnknownAttributeValue, LyraAttributeValue, LyraCSSCustomProperties } from './framework-types.js';

type LyraVueEmit<
  ElementType extends HTMLElement,
  ElementEvents extends object,
  EventNames extends string,
> = EmitFn<{
  [Name in EventNames]: (event: LyraBoundEvent<ElementType, ElementEvents, Name>) => void;
}>;

type LyraVueCustomElement<
  Tag extends keyof LyraComponentTypeMap,
  ElementType extends HTMLElement = LyraComponentTypeMap[Tag]['element'],
  Properties extends object = LyraComponentTypeMap[Tag]['properties'],
  ElementEvents extends object = LyraComponentTypeMap[Tag]['events'],
  EventNames extends string = LyraComponentTypeMap[Tag]['eventNames'],
  CSSNames extends string = LyraComponentTypeMap[Tag]['cssNames'],
  AttributeAliases extends object = LyraComponentTypeMap[Tag]['attributeAliases'],
> = new () => ElementType & {
  /** @deprecated Template prop metadata only; this property does not exist at runtime. */
  $props: Omit<HTMLAttributes, keyof Properties | keyof AttributeAliases | 'style'> &
    Properties &
    AttributeAliases &
    PublicProps & {
      style?: HTMLAttributes['style'] | LyraCSSCustomProperties<CSSNames>;
    };
  /** @deprecated Template event metadata only; this property does not exist at runtime. */
  $emit: LyraVueEmit<ElementType, ElementEvents, EventNames>;
};

export type LyraAccordionVueProps = LyraVueCustomElement<'lr-accordion'>;

export type LyraAccordionItemVueProps = LyraVueCustomElement<'lr-accordion-item'>;

export type LyraActivityFeedVueProps = LyraVueCustomElement<'lr-activity-feed'>;

export type LyraAgentEvalDashboardVueProps = LyraVueCustomElement<'lr-agent-eval-dashboard'>;

export type LyraAgentQuestionVueProps = LyraVueCustomElement<'lr-agent-question'>;

export type LyraAgentRunVueProps = LyraVueCustomElement<'lr-agent-run'>;

export type LyraAgentTraceVueProps = LyraVueCustomElement<'lr-agent-trace'>;

export type LyraAgentWorkspaceVueProps = LyraVueCustomElement<'lr-agent-workspace'>;

export type LyraAlertVueProps = LyraVueCustomElement<'lr-alert'>;

export type LyraAnimatedImageVueProps = LyraVueCustomElement<'lr-animated-image'>;

export type LyraAnimationVueProps = LyraVueCustomElement<'lr-animation'>;

export type LyraAppRailVueProps = LyraVueCustomElement<'lr-app-rail'>;

export type LyraAppRailGroupVueProps = LyraVueCustomElement<'lr-app-rail-group'>;

export type LyraAppRailItemVueProps = LyraVueCustomElement<'lr-app-rail-item'>;

export type LyraApprovalQueueVueProps = LyraVueCustomElement<'lr-approval-queue'>;

export type LyraArchiveViewerVueProps = LyraVueCustomElement<'lr-archive-viewer'>;

export type LyraArtifactPanelVueProps = LyraVueCustomElement<'lr-artifact-panel'>;

export type LyraAttachmentChipVueProps = LyraVueCustomElement<'lr-attachment-chip'>;

export type LyraAttachmentTriggerVueProps = LyraVueCustomElement<'lr-attachment-trigger'>;

export type LyraAudioVisualizerVueProps = LyraVueCustomElement<'lr-audio-visualizer'>;

export type LyraAvPlayerVueProps = LyraVueCustomElement<'lr-av-player'>;

export type LyraAvatarVueProps = LyraVueCustomElement<'lr-avatar'>;

export type LyraAvatarGroupVueProps = LyraVueCustomElement<'lr-avatar-group'>;

export type LyraBackgroundRunsVueProps = LyraVueCustomElement<'lr-background-runs'>;

export type LyraBadgeVueProps = LyraVueCustomElement<'lr-badge'>;

export type LyraBarChartVueProps = LyraVueCustomElement<'lr-bar-chart'>;

export type LyraBoxPlotVueProps = LyraVueCustomElement<'lr-box-plot'>;

export type LyraBranchPickerVueProps = LyraVueCustomElement<'lr-branch-picker'>;

export type LyraBreadcrumbVueProps = LyraVueCustomElement<'lr-breadcrumb'>;

export type LyraBreadcrumbItemVueProps = LyraVueCustomElement<'lr-breadcrumb-item'>;

export type LyraBrowserFrameVueProps = LyraVueCustomElement<'lr-browser-frame'>;

export type LyraBubbleChartVueProps = LyraVueCustomElement<'lr-bubble-chart'>;

export type LyraBudgetMeterVueProps = LyraVueCustomElement<'lr-budget-meter'>;

export type LyraButtonVueProps = LyraVueCustomElement<'lr-button'>;

export type LyraButtonGroupVueProps = LyraVueCustomElement<'lr-button-group'>;

export type LyraCalendarVueProps = LyraVueCustomElement<'lr-calendar'>;

export type LyraCalendarViewerVueProps = LyraVueCustomElement<'lr-calendar-viewer'>;

export type LyraCalloutVueProps = LyraVueCustomElement<'lr-callout'>;

export type LyraCardVueProps = LyraVueCustomElement<'lr-card'>;

export type LyraCarouselVueProps = LyraVueCustomElement<'lr-carousel'>;

export type LyraCarouselItemVueProps = LyraVueCustomElement<'lr-carousel-item'>;

export type LyraChangeReviewVueProps = LyraVueCustomElement<'lr-change-review'>;

export type LyraChartVueProps = LyraVueCustomElement<'lr-chart'>;

export type LyraChatComposerVueProps = LyraVueCustomElement<'lr-chat-composer'>;

export type LyraChatMessageVueProps = LyraVueCustomElement<'lr-chat-message'>;

export type LyraChatViewportVueProps = LyraVueCustomElement<'lr-chat-viewport'>;

export type LyraCheckboxVueProps = LyraVueCustomElement<'lr-checkbox'>;

export type LyraCheckboxGroupVueProps = LyraVueCustomElement<'lr-checkbox-group'>;

export type LyraCheckpointVueProps = LyraVueCustomElement<'lr-checkpoint'>;

export type LyraChipVueProps = LyraVueCustomElement<'lr-chip'>;

export type LyraChipGroupVueProps = LyraVueCustomElement<'lr-chip-group'>;

export type LyraChunkInspectorVueProps = LyraVueCustomElement<'lr-chunk-inspector'>;

export type LyraCitationBadgeVueProps = LyraVueCustomElement<'lr-citation-badge'>;

export type LyraClaimEvidenceVueProps = LyraVueCustomElement<'lr-claim-evidence'>;

export type LyraCodeBlockVueProps = LyraVueCustomElement<'lr-code-block'>;

export type LyraCodeBlockCoreVueProps = LyraVueCustomElement<'lr-code-block-core'>;

export type LyraCodeEditorVueProps = LyraVueCustomElement<'lr-code-editor'>;

export type LyraColorPickerVueProps = LyraVueCustomElement<'lr-color-picker'>;

export type LyraComboboxVueProps = LyraVueCustomElement<'lr-combobox'>;

export type LyraCommandPaletteVueProps = LyraVueCustomElement<'lr-command-palette'>;

export type LyraCommitCardVueProps = LyraVueCustomElement<'lr-commit-card'>;

export type LyraCommunityCardVueProps = LyraVueCustomElement<'lr-community-card'>;

export type LyraComparePanelVueProps = LyraVueCustomElement<'lr-compare-panel'>;

export type LyraConditionBuilderVueProps = LyraVueCustomElement<'lr-condition-builder'>;

export type LyraConfirmBarVueProps = LyraVueCustomElement<'lr-confirm-bar'>;

export type LyraConnectorManagerVueProps = LyraVueCustomElement<'lr-connector-manager'>;

export type LyraContactViewerVueProps = LyraVueCustomElement<'lr-contact-viewer'>;

export type LyraContextInspectorVueProps = LyraVueCustomElement<'lr-context-inspector'>;

export type LyraContextMenuVueProps = LyraVueCustomElement<'lr-context-menu'>;

export type LyraContextMeterVueProps = LyraVueCustomElement<'lr-context-meter'>;

export type LyraControlGroupVueProps = LyraVueCustomElement<'lr-control-group'>;

export type LyraConversationItemVueProps = LyraVueCustomElement<'lr-conversation-item'>;

export type LyraCopyButtonVueProps = LyraVueCustomElement<'lr-copy-button'>;

export type LyraCsvViewerVueProps = LyraVueCustomElement<'lr-csv-viewer'>;

export type LyraDashboardGridVueProps = LyraVueCustomElement<'lr-dashboard-grid'>;

export type LyraDataGridVueProps = LyraVueCustomElement<'lr-data-grid'>;

export type LyraDatasetViewerVueProps = LyraVueCustomElement<'lr-dataset-viewer'>;

export type LyraDateInputVueProps = LyraVueCustomElement<'lr-date-input'>;

export type LyraDatePickerVueProps = LyraVueCustomElement<'lr-date-picker'>;

export type LyraDetailsVueProps = LyraVueCustomElement<'lr-details'>;

export type LyraDialogVueProps = LyraVueCustomElement<'lr-dialog'>;

export type LyraDiffViewVueProps = LyraVueCustomElement<'lr-diff-view'>;

export type LyraDividerVueProps = LyraVueCustomElement<'lr-divider'>;

export type LyraDockPanelVueProps = LyraVueCustomElement<'lr-dock-panel'>;

export type LyraDocumentCompareVueProps = LyraVueCustomElement<'lr-document-compare'>;

export type LyraDocumentLibraryVueProps = LyraVueCustomElement<'lr-document-library'>;

export type LyraDocumentPreviewVueProps = LyraVueCustomElement<'lr-document-preview'>;

export type LyraDocumentViewerVueProps = LyraVueCustomElement<'lr-document-viewer'>;

export type LyraDocxViewerVueProps = LyraVueCustomElement<'lr-docx-viewer'>;

export type LyraDoughnutChartVueProps = LyraVueCustomElement<'lr-doughnut-chart'>;

export type LyraDrawerVueProps = LyraVueCustomElement<'lr-drawer'>;

export type LyraDrilldownPanelVueProps = LyraVueCustomElement<'lr-drilldown-panel'>;

export type LyraDropZoneVueProps = LyraVueCustomElement<'lr-drop-zone'>;

export type LyraDropdownVueProps = LyraVueCustomElement<'lr-dropdown'>;

export type LyraDropdownItemVueProps = LyraVueCustomElement<'lr-dropdown-item'>;

export type LyraEbookViewerVueProps = LyraVueCustomElement<'lr-ebook-viewer'>;

export type LyraEmailViewerVueProps = LyraVueCustomElement<'lr-email-viewer'>;

export type LyraEmbeddingExplorerVueProps = LyraVueCustomElement<'lr-embedding-explorer'>;

export type LyraEmojiPickerVueProps = LyraVueCustomElement<'lr-emoji-picker'>;

export type LyraEmptyVueProps = LyraVueCustomElement<'lr-empty'>;

export type LyraEntityCardVueProps = LyraVueCustomElement<'lr-entity-card'>;

export type LyraEntityChipVueProps = LyraVueCustomElement<'lr-entity-chip'>;

export type LyraEntityDossierVueProps = LyraVueCustomElement<'lr-entity-dossier'>;

export type LyraEnvListVueProps = LyraVueCustomElement<'lr-env-list'>;

export type LyraEvalDatasetVueProps = LyraVueCustomElement<'lr-eval-dataset'>;

export type LyraEvalResultVueProps = LyraVueCustomElement<'lr-eval-result'>;

export type LyraEvalRunVueProps = LyraVueCustomElement<'lr-eval-run'>;

export type LyraExportButtonVueProps = LyraVueCustomElement<'lr-export-button'>;

export type LyraFileIconVueProps = LyraVueCustomElement<'lr-file-icon'>;

export type LyraFileInputVueProps = LyraVueCustomElement<'lr-file-input'>;

export type LyraFileTreeVueProps = LyraVueCustomElement<'lr-file-tree'>;

export type LyraFilterBarVueProps = LyraVueCustomElement<'lr-filter-bar'>;

export type LyraFlagVueProps = LyraVueCustomElement<'lr-flag'>;

export type LyraFlowCanvasVueProps = LyraVueCustomElement<'lr-flow-canvas'>;

export type LyraFlowControlsVueProps = LyraVueCustomElement<'lr-flow-controls'>;

export type LyraFlowMinimapVueProps = LyraVueCustomElement<'lr-flow-minimap'>;

export type LyraFlowNodeVueProps = LyraVueCustomElement<'lr-flow-node'>;

export type LyraFlowRunStatusVueProps = LyraVueCustomElement<'lr-flow-run-status'>;

export type LyraFormatBytesVueProps = LyraVueCustomElement<'lr-format-bytes'>;

export type LyraFormatDateVueProps = LyraVueCustomElement<'lr-format-date'>;

export type LyraFormatNumberVueProps = LyraVueCustomElement<'lr-format-number'>;

export type LyraFunnelVueProps = LyraVueCustomElement<'lr-funnel'>;

export type LyraGaugeVueProps = LyraVueCustomElement<'lr-gauge'>;

export type LyraGenerationMetricsVueProps = LyraVueCustomElement<'lr-generation-metrics'>;

export type LyraGeojsonViewVueProps = LyraVueCustomElement<'lr-geojson-view'>;

export type LyraGeoJsonViewerVueProps = LyraVueCustomElement<'lr-geojson-viewer'>;

export type LyraGraphVueProps = LyraVueCustomElement<'lr-graph'>;

export type LyraGraphLegendVueProps = LyraVueCustomElement<'lr-graph-legend'>;

export type LyraGraphQueryBuilderVueProps = LyraVueCustomElement<'lr-graph-query-builder'>;

export type LyraGroundingSummaryVueProps = LyraVueCustomElement<'lr-grounding-summary'>;

export type LyraHandoffDividerVueProps = LyraVueCustomElement<'lr-handoff-divider'>;

export type LyraHeatmapVueProps = LyraVueCustomElement<'lr-heatmap'>;

export type LyraHighlightLayerVueProps = LyraVueCustomElement<'lr-highlight-layer'>;

export type LyraHistogramVueProps = LyraVueCustomElement<'lr-histogram'>;

export type LyraHtmlViewerVueProps = LyraVueCustomElement<'lr-html-viewer'>;

export type LyraIconVueProps = LyraVueCustomElement<'lr-icon'>;

export type LyraIconButtonVueProps = LyraVueCustomElement<'lr-icon-button'>;

export type LyraImageComparerVueProps = LyraVueCustomElement<'lr-image-comparer'>;

export type LyraImageViewerVueProps = LyraVueCustomElement<'lr-image-viewer'>;

export type LyraIncludeVueProps = LyraVueCustomElement<'lr-include'>;

export type LyraIngestionQueueVueProps = LyraVueCustomElement<'lr-ingestion-queue'>;

export type LyraInputVueProps = LyraVueCustomElement<'lr-input'>;

export type LyraIntersectionObserverVueProps = LyraVueCustomElement<'lr-intersection-observer'>;

export type LyraJsonSchemaViewerVueProps = LyraVueCustomElement<'lr-json-schema-viewer'>;

export type LyraJsonViewerVueProps = LyraVueCustomElement<'lr-json-viewer'>;

export type LyraKbdVueProps = LyraVueCustomElement<'lr-kbd'>;

export type LyraKnowledgeBaseVueProps = LyraVueCustomElement<'lr-knowledge-base'>;

export type LyraKnowledgeBaseAdminVueProps = LyraVueCustomElement<'lr-knowledge-base-admin'>;

export type LyraKnowledgeGraphExplorerVueProps = LyraVueCustomElement<'lr-knowledge-graph-explorer'>;

export type LyraKnownDateVueProps = LyraVueCustomElement<'lr-known-date'>;

export type LyraLightboxVueProps = LyraVueCustomElement<'lr-lightbox'>;

export type LyraLineChartVueProps = LyraVueCustomElement<'lr-line-chart'>;

export type LyraLiteChartVueProps = LyraVueCustomElement<'lr-lite-chart'>;

export type LyraLiveRegionVueProps = LyraVueCustomElement<'lr-live-region'>;

export type LyraLocalePickerVueProps = LyraVueCustomElement<'lr-locale-picker'>;

export type LyraMapVueProps = LyraVueCustomElement<'lr-map'>;

export type LyraMarkdownVueProps = LyraVueCustomElement<'lr-markdown'>;

export type LyraMarkdownCoreVueProps = LyraVueCustomElement<'lr-markdown-core'>;

export type LyraMcpAppVueProps = LyraVueCustomElement<'lr-mcp-app'>;

export type LyraMediaCardVueProps = LyraVueCustomElement<'lr-media-card'>;

export type LyraMemoryPanelVueProps = LyraVueCustomElement<'lr-memory-panel'>;

export type LyraMentionPopoverVueProps = LyraVueCustomElement<'lr-mention-popover'>;

export type LyraMenuVueProps = LyraVueCustomElement<'lr-menu'>;

export type LyraMenuItemVueProps = LyraVueCustomElement<'lr-menu-item'>;

export type LyraMenuLabelVueProps = LyraVueCustomElement<'lr-menu-label'>;

export type LyraMenubarVueProps = LyraVueCustomElement<'lr-menubar'>;

export type LyraMenubarItemVueProps = LyraVueCustomElement<'lr-menubar-item'>;

export type LyraMessageActionsVueProps = LyraVueCustomElement<'lr-message-actions'>;

export type LyraMessageFeedbackVueProps = LyraVueCustomElement<'lr-message-feedback'>;

export type LyraMessagePartsVueProps = LyraVueCustomElement<'lr-message-parts'>;

export type LyraMindMapVueProps = LyraVueCustomElement<'lr-mind-map'>;

export type LyraModelSelectVueProps = LyraVueCustomElement<'lr-model-select'>;

export type LyraModelSettingsPanelVueProps = LyraVueCustomElement<'lr-model-settings-panel'>;

export type LyraMultiSplitVueProps = LyraVueCustomElement<'lr-multi-split'>;

export type LyraMutationObserverVueProps = LyraVueCustomElement<'lr-mutation-observer'>;

export type LyraNativeTimeInputVueProps = LyraVueCustomElement<'lr-native-time-input'>;

export type LyraNavigationMenuVueProps = LyraVueCustomElement<'lr-navigation-menu'>;

export type LyraNavigationMenuItemVueProps = LyraVueCustomElement<'lr-navigation-menu-item'>;

export type LyraNeighborListVueProps = LyraVueCustomElement<'lr-neighbor-list'>;

export type LyraNodePaletteVueProps = LyraVueCustomElement<'lr-node-palette'>;

export type LyraNotebookViewerVueProps = LyraVueCustomElement<'lr-notebook-viewer'>;

export type LyraNumberInputVueProps = LyraVueCustomElement<'lr-number-input'>;

export type LyraOptionVueProps = LyraVueCustomElement<'lr-option'>;

export type LyraOtpInputVueProps = LyraVueCustomElement<'lr-otp-input'>;

export type LyraPageVueProps = LyraVueCustomElement<'lr-page'>;

export type LyraPageRailVueProps = LyraVueCustomElement<'lr-page-rail'>;

export type LyraPaginationVueProps = LyraVueCustomElement<'lr-pagination'>;

export type LyraPanZoomVueProps = LyraVueCustomElement<'lr-pan-zoom'>;

export type LyraPathStripVueProps = LyraVueCustomElement<'lr-path-strip'>;

export type LyraPdfViewerVueProps = LyraVueCustomElement<'lr-pdf-viewer'>;

export type LyraPermissionGrantVueProps = LyraVueCustomElement<'lr-permission-grant'>;

export type LyraPermissionRulesVueProps = LyraVueCustomElement<'lr-permission-rules'>;

export type LyraPhoneInputVueProps = LyraVueCustomElement<'lr-phone-input'>;

export type LyraPieChartVueProps = LyraVueCustomElement<'lr-pie-chart'>;

export type LyraPolarAreaChartVueProps = LyraVueCustomElement<'lr-polar-area-chart'>;

export type LyraPolicySummaryVueProps = LyraVueCustomElement<'lr-policy-summary'>;

export type LyraPollStatusVueProps = LyraVueCustomElement<'lr-poll-status'>;

export type LyraPopoverVueProps = LyraVueCustomElement<'lr-popover'>;

export type LyraPopupVueProps = LyraVueCustomElement<'lr-popup'>;

export type LyraPptxViewerVueProps = LyraVueCustomElement<'lr-pptx-viewer'>;

export type LyraProgressBarVueProps = LyraVueCustomElement<'lr-progress-bar'>;

export type LyraProgressRingVueProps = LyraVueCustomElement<'lr-progress-ring'>;

export type LyraPromptInputVueProps = LyraVueCustomElement<'lr-prompt-input'>;

export type LyraPromptQueueVueProps = LyraVueCustomElement<'lr-prompt-queue'>;

export type LyraPromptStudioVueProps = LyraVueCustomElement<'lr-prompt-studio'>;

export type LyraProvenancePanelVueProps = LyraVueCustomElement<'lr-provenance-panel'>;

export type LyraPushToTalkVueProps = LyraVueCustomElement<'lr-push-to-talk'>;

export type LyraQrCodeVueProps = LyraVueCustomElement<'lr-qr-code'>;

export type LyraRadarChartVueProps = LyraVueCustomElement<'lr-radar-chart'>;

export type LyraRadioVueProps = LyraVueCustomElement<'lr-radio'>;

export type LyraRadioButtonVueProps = LyraVueCustomElement<'lr-radio-button'>;

export type LyraRadioGroupVueProps = LyraVueCustomElement<'lr-radio-group'>;

export type LyraRagAnswerVueProps = LyraVueCustomElement<'lr-rag-answer'>;

export type LyraRagEvalDashboardVueProps = LyraVueCustomElement<'lr-rag-eval-dashboard'>;

export type LyraRandomContentVueProps = LyraVueCustomElement<'lr-random-content'>;

export type LyraRatingVueProps = LyraVueCustomElement<'lr-rating'>;

export type LyraRealtimeSessionVueProps = LyraVueCustomElement<'lr-realtime-session'>;

export type LyraRelativeTimeVueProps = LyraVueCustomElement<'lr-relative-time'>;

export type LyraReorderItemVueProps = LyraVueCustomElement<'lr-reorder-item'>;

export type LyraReorderListVueProps = LyraVueCustomElement<'lr-reorder-list'>;

export type LyraResearchProgressVueProps = LyraVueCustomElement<'lr-research-progress'>;

export type LyraResizeObserverVueProps = LyraVueCustomElement<'lr-resize-observer'>;

export type LyraResponsivePanelVueProps = LyraVueCustomElement<'lr-responsive-panel'>;

export type LyraResultCardVueProps = LyraVueCustomElement<'lr-result-card'>;

export type LyraResultFieldVueProps = LyraVueCustomElement<'lr-result-field'>;

export type LyraRetrievalCompareVueProps = LyraVueCustomElement<'lr-retrieval-compare'>;

export type LyraRetrievalResultsVueProps = LyraVueCustomElement<'lr-retrieval-results'>;

export type LyraRetrievalSearchVueProps = LyraVueCustomElement<'lr-retrieval-search'>;

export type LyraRetrievalTraceVueProps = LyraVueCustomElement<'lr-retrieval-trace'>;

export type LyraRubricFormVueProps = LyraVueCustomElement<'lr-rubric-form'>;

export type LyraScatterChartVueProps = LyraVueCustomElement<'lr-scatter-chart'>;

export type LyraScrollerVueProps = LyraVueCustomElement<'lr-scroller'>;

export type LyraSegmentedVueProps = LyraVueCustomElement<'lr-segmented'>;

export type LyraSelectVueProps = LyraVueCustomElement<'lr-select'>;

export type LyraSelectionToolbarVueProps = LyraVueCustomElement<'lr-selection-toolbar'>;

export type LyraSequencePlaybackVueProps = LyraVueCustomElement<'lr-sequence-playback'>;

export type LyraSequenceStripVueProps = LyraVueCustomElement<'lr-sequence-strip'>;

export type LyraSkeletonVueProps = LyraVueCustomElement<'lr-skeleton'>;

export type LyraSliderVueProps = LyraVueCustomElement<'lr-slider'>;

export type LyraSourceCardVueProps = LyraVueCustomElement<'lr-source-card'>;

export type LyraSourceListVueProps = LyraVueCustomElement<'lr-source-list'>;

export type LyraSourcePickerVueProps = LyraVueCustomElement<'lr-source-picker'>;

export type LyraSpanWaterfallVueProps = LyraVueCustomElement<'lr-span-waterfall'>;

export type LyraSparklineVueProps = LyraVueCustomElement<'lr-sparkline'>;

export type LyraSpinnerVueProps = LyraVueCustomElement<'lr-spinner'>;

export type LyraSplitPanelVueProps = LyraVueCustomElement<'lr-split-panel'>;

export type LyraSpreadsheetViewerVueProps = LyraVueCustomElement<'lr-spreadsheet-viewer'>;

export type LyraStackTraceVueProps = LyraVueCustomElement<'lr-stack-trace'>;

export type LyraStatVueProps = LyraVueCustomElement<'lr-stat'>;

export type LyraStepperVueProps = LyraVueCustomElement<'lr-stepper'>;

export type LyraStreamStatusVueProps = LyraVueCustomElement<'lr-stream-status'>;

export type LyraStreamingTextVueProps = LyraVueCustomElement<'lr-streaming-text'>;

export type LyraStreamingTextCoreVueProps = LyraVueCustomElement<'lr-streaming-text-core'>;

export type LyraSubagentPanelVueProps = LyraVueCustomElement<'lr-subagent-panel'>;

export type LyraSuggestionChipsVueProps = LyraVueCustomElement<'lr-suggestion-chips'>;

export type LyraSvgViewerVueProps = LyraVueCustomElement<'lr-svg-viewer'>;

export type LyraSwatchPickerVueProps = LyraVueCustomElement<'lr-swatch-picker'>;

export type LyraSwitchVueProps = LyraVueCustomElement<'lr-switch'>;

export type LyraTabVueProps = LyraVueCustomElement<'lr-tab'>;

export type LyraTabGroupVueProps = LyraVueCustomElement<'lr-tab-group'>;

export type LyraTabPanelVueProps = LyraVueCustomElement<'lr-tab-panel'>;

export type LyraTableVueProps = LyraVueCustomElement<'lr-table'>;

export type LyraTagVueProps = LyraVueCustomElement<'lr-tag'>;

export type LyraTaskListVueProps = LyraVueCustomElement<'lr-task-list'>;

export type LyraTerminalVueProps = LyraVueCustomElement<'lr-terminal'>;

export type LyraTestResultsVueProps = LyraVueCustomElement<'lr-test-results'>;

export type LyraTextareaVueProps = LyraVueCustomElement<'lr-textarea'>;

export type LyraThinkingPanelVueProps = LyraVueCustomElement<'lr-thinking-panel'>;

export type LyraThreadListVueProps = LyraVueCustomElement<'lr-thread-list'>;

export type LyraTimeInputVueProps = LyraVueCustomElement<'lr-time-input'>;

export type LyraTimeRangeVueProps = LyraVueCustomElement<'lr-time-range'>;

export type LyraTimelineVueProps = LyraVueCustomElement<'lr-timeline'>;

export type LyraTimelineItemVueProps = LyraVueCustomElement<'lr-timeline-item'>;

export type LyraToastVueProps = LyraVueCustomElement<'lr-toast'>;

export type LyraToastItemVueProps = LyraVueCustomElement<'lr-toast-item'>;

export type LyraToggleVueProps = LyraVueCustomElement<'lr-toggle'>;

export type LyraToggleGroupVueProps = LyraVueCustomElement<'lr-toggle-group'>;

export type LyraTokenInputVueProps = LyraVueCustomElement<'lr-token-input'>;

export type LyraToolApprovalDialogVueProps = LyraVueCustomElement<'lr-tool-approval-dialog'>;

export type LyraToolCallBlockVueProps = LyraVueCustomElement<'lr-tool-call-block'>;

export type LyraToolCallChipVueProps = LyraVueCustomElement<'lr-tool-call-chip'>;

export type LyraToolParamFormVueProps = LyraVueCustomElement<'lr-tool-param-form'>;

export type LyraToolResultDialogVueProps = LyraVueCustomElement<'lr-tool-result-dialog'>;

export type LyraToolResultViewVueProps = LyraVueCustomElement<'lr-tool-result-view'>;

export type LyraToolSelectDialogVueProps = LyraVueCustomElement<'lr-tool-select-dialog'>;

export type LyraToolTimelineVueProps = LyraVueCustomElement<'lr-tool-timeline'>;

export type LyraTooltipVueProps = LyraVueCustomElement<'lr-tooltip'>;

export type LyraTourVueProps = LyraVueCustomElement<'lr-tour'>;

export type LyraTraceTreeVueProps = LyraVueCustomElement<'lr-trace-tree'>;

export type LyraTranscriptFeedVueProps = LyraVueCustomElement<'lr-transcript-feed'>;

export type LyraTreeVueProps = LyraVueCustomElement<'lr-tree'>;

export type LyraTreeItemVueProps = LyraVueCustomElement<'lr-tree-item'>;

export type LyraTypingIndicatorVueProps = LyraVueCustomElement<'lr-typing-indicator'>;

export type LyraUsageBadgeVueProps = LyraVueCustomElement<'lr-usage-badge'>;

export type LyraVideoVueProps = LyraVueCustomElement<'lr-video'>;

export type LyraVideoPlaylistVueProps = LyraVueCustomElement<'lr-video-playlist'>;

export type LyraVirtualListVueProps = LyraVueCustomElement<'lr-virtual-list'>;

export type LyraVisuallyHiddenVueProps = LyraVueCustomElement<'lr-visually-hidden'>;

export type LyraVoicePickerVueProps = LyraVueCustomElement<'lr-voice-picker'>;

export type LyraWidgetVueProps = LyraVueCustomElement<'lr-widget'>;

export type LyraWidgetRendererVueProps = LyraVueCustomElement<'lr-widget-renderer'>;

export type LyraWordCloudVueProps = LyraVueCustomElement<'lr-word-cloud'>;

export type LyraXmlViewerVueProps = LyraVueCustomElement<'lr-xml-viewer'>;

export type LyraZoomableFrameVueProps = LyraVueCustomElement<'lr-zoomable-frame'>;

export interface LyraVueGlobalComponents {
  'lr-accordion': LyraAccordionVueProps;
  'lr-accordion-item': LyraAccordionItemVueProps;
  'lr-activity-feed': LyraActivityFeedVueProps;
  'lr-agent-eval-dashboard': LyraAgentEvalDashboardVueProps;
  'lr-agent-question': LyraAgentQuestionVueProps;
  'lr-agent-run': LyraAgentRunVueProps;
  'lr-agent-trace': LyraAgentTraceVueProps;
  'lr-agent-workspace': LyraAgentWorkspaceVueProps;
  'lr-alert': LyraAlertVueProps;
  'lr-animated-image': LyraAnimatedImageVueProps;
  'lr-animation': LyraAnimationVueProps;
  'lr-app-rail': LyraAppRailVueProps;
  'lr-app-rail-group': LyraAppRailGroupVueProps;
  'lr-app-rail-item': LyraAppRailItemVueProps;
  'lr-approval-queue': LyraApprovalQueueVueProps;
  'lr-archive-viewer': LyraArchiveViewerVueProps;
  'lr-artifact-panel': LyraArtifactPanelVueProps;
  'lr-attachment-chip': LyraAttachmentChipVueProps;
  'lr-attachment-trigger': LyraAttachmentTriggerVueProps;
  'lr-audio-visualizer': LyraAudioVisualizerVueProps;
  'lr-av-player': LyraAvPlayerVueProps;
  'lr-avatar': LyraAvatarVueProps;
  'lr-avatar-group': LyraAvatarGroupVueProps;
  'lr-background-runs': LyraBackgroundRunsVueProps;
  'lr-badge': LyraBadgeVueProps;
  'lr-bar-chart': LyraBarChartVueProps;
  'lr-box-plot': LyraBoxPlotVueProps;
  'lr-branch-picker': LyraBranchPickerVueProps;
  'lr-breadcrumb': LyraBreadcrumbVueProps;
  'lr-breadcrumb-item': LyraBreadcrumbItemVueProps;
  'lr-browser-frame': LyraBrowserFrameVueProps;
  'lr-bubble-chart': LyraBubbleChartVueProps;
  'lr-budget-meter': LyraBudgetMeterVueProps;
  'lr-button': LyraButtonVueProps;
  'lr-button-group': LyraButtonGroupVueProps;
  'lr-calendar': LyraCalendarVueProps;
  'lr-calendar-viewer': LyraCalendarViewerVueProps;
  'lr-callout': LyraCalloutVueProps;
  'lr-card': LyraCardVueProps;
  'lr-carousel': LyraCarouselVueProps;
  'lr-carousel-item': LyraCarouselItemVueProps;
  'lr-change-review': LyraChangeReviewVueProps;
  'lr-chart': LyraChartVueProps;
  'lr-chat-composer': LyraChatComposerVueProps;
  'lr-chat-message': LyraChatMessageVueProps;
  'lr-chat-viewport': LyraChatViewportVueProps;
  'lr-checkbox': LyraCheckboxVueProps;
  'lr-checkbox-group': LyraCheckboxGroupVueProps;
  'lr-checkpoint': LyraCheckpointVueProps;
  'lr-chip': LyraChipVueProps;
  'lr-chip-group': LyraChipGroupVueProps;
  'lr-chunk-inspector': LyraChunkInspectorVueProps;
  'lr-citation-badge': LyraCitationBadgeVueProps;
  'lr-claim-evidence': LyraClaimEvidenceVueProps;
  'lr-code-block': LyraCodeBlockVueProps;
  'lr-code-block-core': LyraCodeBlockCoreVueProps;
  'lr-code-editor': LyraCodeEditorVueProps;
  'lr-color-picker': LyraColorPickerVueProps;
  'lr-combobox': LyraComboboxVueProps;
  'lr-command-palette': LyraCommandPaletteVueProps;
  'lr-commit-card': LyraCommitCardVueProps;
  'lr-community-card': LyraCommunityCardVueProps;
  'lr-compare-panel': LyraComparePanelVueProps;
  'lr-condition-builder': LyraConditionBuilderVueProps;
  'lr-confirm-bar': LyraConfirmBarVueProps;
  'lr-connector-manager': LyraConnectorManagerVueProps;
  'lr-contact-viewer': LyraContactViewerVueProps;
  'lr-context-inspector': LyraContextInspectorVueProps;
  'lr-context-menu': LyraContextMenuVueProps;
  'lr-context-meter': LyraContextMeterVueProps;
  'lr-control-group': LyraControlGroupVueProps;
  'lr-conversation-item': LyraConversationItemVueProps;
  'lr-copy-button': LyraCopyButtonVueProps;
  'lr-csv-viewer': LyraCsvViewerVueProps;
  'lr-dashboard-grid': LyraDashboardGridVueProps;
  'lr-data-grid': LyraDataGridVueProps;
  'lr-dataset-viewer': LyraDatasetViewerVueProps;
  'lr-date-input': LyraDateInputVueProps;
  'lr-date-picker': LyraDatePickerVueProps;
  'lr-details': LyraDetailsVueProps;
  'lr-dialog': LyraDialogVueProps;
  'lr-diff-view': LyraDiffViewVueProps;
  'lr-divider': LyraDividerVueProps;
  'lr-dock-panel': LyraDockPanelVueProps;
  'lr-document-compare': LyraDocumentCompareVueProps;
  'lr-document-library': LyraDocumentLibraryVueProps;
  'lr-document-preview': LyraDocumentPreviewVueProps;
  'lr-document-viewer': LyraDocumentViewerVueProps;
  'lr-docx-viewer': LyraDocxViewerVueProps;
  'lr-doughnut-chart': LyraDoughnutChartVueProps;
  'lr-drawer': LyraDrawerVueProps;
  'lr-drilldown-panel': LyraDrilldownPanelVueProps;
  'lr-drop-zone': LyraDropZoneVueProps;
  'lr-dropdown': LyraDropdownVueProps;
  'lr-dropdown-item': LyraDropdownItemVueProps;
  'lr-ebook-viewer': LyraEbookViewerVueProps;
  'lr-email-viewer': LyraEmailViewerVueProps;
  'lr-embedding-explorer': LyraEmbeddingExplorerVueProps;
  'lr-emoji-picker': LyraEmojiPickerVueProps;
  'lr-empty': LyraEmptyVueProps;
  'lr-entity-card': LyraEntityCardVueProps;
  'lr-entity-chip': LyraEntityChipVueProps;
  'lr-entity-dossier': LyraEntityDossierVueProps;
  'lr-env-list': LyraEnvListVueProps;
  'lr-eval-dataset': LyraEvalDatasetVueProps;
  'lr-eval-result': LyraEvalResultVueProps;
  'lr-eval-run': LyraEvalRunVueProps;
  'lr-export-button': LyraExportButtonVueProps;
  'lr-file-icon': LyraFileIconVueProps;
  'lr-file-input': LyraFileInputVueProps;
  'lr-file-tree': LyraFileTreeVueProps;
  'lr-filter-bar': LyraFilterBarVueProps;
  'lr-flag': LyraFlagVueProps;
  'lr-flow-canvas': LyraFlowCanvasVueProps;
  'lr-flow-controls': LyraFlowControlsVueProps;
  'lr-flow-minimap': LyraFlowMinimapVueProps;
  'lr-flow-node': LyraFlowNodeVueProps;
  'lr-flow-run-status': LyraFlowRunStatusVueProps;
  'lr-format-bytes': LyraFormatBytesVueProps;
  'lr-format-date': LyraFormatDateVueProps;
  'lr-format-number': LyraFormatNumberVueProps;
  'lr-funnel': LyraFunnelVueProps;
  'lr-gauge': LyraGaugeVueProps;
  'lr-generation-metrics': LyraGenerationMetricsVueProps;
  'lr-geojson-view': LyraGeojsonViewVueProps;
  'lr-geojson-viewer': LyraGeoJsonViewerVueProps;
  'lr-graph': LyraGraphVueProps;
  'lr-graph-legend': LyraGraphLegendVueProps;
  'lr-graph-query-builder': LyraGraphQueryBuilderVueProps;
  'lr-grounding-summary': LyraGroundingSummaryVueProps;
  'lr-handoff-divider': LyraHandoffDividerVueProps;
  'lr-heatmap': LyraHeatmapVueProps;
  'lr-highlight-layer': LyraHighlightLayerVueProps;
  'lr-histogram': LyraHistogramVueProps;
  'lr-html-viewer': LyraHtmlViewerVueProps;
  'lr-icon': LyraIconVueProps;
  'lr-icon-button': LyraIconButtonVueProps;
  'lr-image-comparer': LyraImageComparerVueProps;
  'lr-image-viewer': LyraImageViewerVueProps;
  'lr-include': LyraIncludeVueProps;
  'lr-ingestion-queue': LyraIngestionQueueVueProps;
  'lr-input': LyraInputVueProps;
  'lr-intersection-observer': LyraIntersectionObserverVueProps;
  'lr-json-schema-viewer': LyraJsonSchemaViewerVueProps;
  'lr-json-viewer': LyraJsonViewerVueProps;
  'lr-kbd': LyraKbdVueProps;
  'lr-knowledge-base': LyraKnowledgeBaseVueProps;
  'lr-knowledge-base-admin': LyraKnowledgeBaseAdminVueProps;
  'lr-knowledge-graph-explorer': LyraKnowledgeGraphExplorerVueProps;
  'lr-known-date': LyraKnownDateVueProps;
  'lr-lightbox': LyraLightboxVueProps;
  'lr-line-chart': LyraLineChartVueProps;
  'lr-lite-chart': LyraLiteChartVueProps;
  'lr-live-region': LyraLiveRegionVueProps;
  'lr-locale-picker': LyraLocalePickerVueProps;
  'lr-map': LyraMapVueProps;
  'lr-markdown': LyraMarkdownVueProps;
  'lr-markdown-core': LyraMarkdownCoreVueProps;
  'lr-mcp-app': LyraMcpAppVueProps;
  'lr-media-card': LyraMediaCardVueProps;
  'lr-memory-panel': LyraMemoryPanelVueProps;
  'lr-mention-popover': LyraMentionPopoverVueProps;
  'lr-menu': LyraMenuVueProps;
  'lr-menu-item': LyraMenuItemVueProps;
  'lr-menu-label': LyraMenuLabelVueProps;
  'lr-menubar': LyraMenubarVueProps;
  'lr-menubar-item': LyraMenubarItemVueProps;
  'lr-message-actions': LyraMessageActionsVueProps;
  'lr-message-feedback': LyraMessageFeedbackVueProps;
  'lr-message-parts': LyraMessagePartsVueProps;
  'lr-mind-map': LyraMindMapVueProps;
  'lr-model-select': LyraModelSelectVueProps;
  'lr-model-settings-panel': LyraModelSettingsPanelVueProps;
  'lr-multi-split': LyraMultiSplitVueProps;
  'lr-mutation-observer': LyraMutationObserverVueProps;
  'lr-native-time-input': LyraNativeTimeInputVueProps;
  'lr-navigation-menu': LyraNavigationMenuVueProps;
  'lr-navigation-menu-item': LyraNavigationMenuItemVueProps;
  'lr-neighbor-list': LyraNeighborListVueProps;
  'lr-node-palette': LyraNodePaletteVueProps;
  'lr-notebook-viewer': LyraNotebookViewerVueProps;
  'lr-number-input': LyraNumberInputVueProps;
  'lr-option': LyraOptionVueProps;
  'lr-otp-input': LyraOtpInputVueProps;
  'lr-page': LyraPageVueProps;
  'lr-page-rail': LyraPageRailVueProps;
  'lr-pagination': LyraPaginationVueProps;
  'lr-pan-zoom': LyraPanZoomVueProps;
  'lr-path-strip': LyraPathStripVueProps;
  'lr-pdf-viewer': LyraPdfViewerVueProps;
  'lr-permission-grant': LyraPermissionGrantVueProps;
  'lr-permission-rules': LyraPermissionRulesVueProps;
  'lr-phone-input': LyraPhoneInputVueProps;
  'lr-pie-chart': LyraPieChartVueProps;
  'lr-polar-area-chart': LyraPolarAreaChartVueProps;
  'lr-policy-summary': LyraPolicySummaryVueProps;
  'lr-poll-status': LyraPollStatusVueProps;
  'lr-popover': LyraPopoverVueProps;
  'lr-popup': LyraPopupVueProps;
  'lr-pptx-viewer': LyraPptxViewerVueProps;
  'lr-progress-bar': LyraProgressBarVueProps;
  'lr-progress-ring': LyraProgressRingVueProps;
  'lr-prompt-input': LyraPromptInputVueProps;
  'lr-prompt-queue': LyraPromptQueueVueProps;
  'lr-prompt-studio': LyraPromptStudioVueProps;
  'lr-provenance-panel': LyraProvenancePanelVueProps;
  'lr-push-to-talk': LyraPushToTalkVueProps;
  'lr-qr-code': LyraQrCodeVueProps;
  'lr-radar-chart': LyraRadarChartVueProps;
  'lr-radio': LyraRadioVueProps;
  'lr-radio-button': LyraRadioButtonVueProps;
  'lr-radio-group': LyraRadioGroupVueProps;
  'lr-rag-answer': LyraRagAnswerVueProps;
  'lr-rag-eval-dashboard': LyraRagEvalDashboardVueProps;
  'lr-random-content': LyraRandomContentVueProps;
  'lr-rating': LyraRatingVueProps;
  'lr-realtime-session': LyraRealtimeSessionVueProps;
  'lr-relative-time': LyraRelativeTimeVueProps;
  'lr-reorder-item': LyraReorderItemVueProps;
  'lr-reorder-list': LyraReorderListVueProps;
  'lr-research-progress': LyraResearchProgressVueProps;
  'lr-resize-observer': LyraResizeObserverVueProps;
  'lr-responsive-panel': LyraResponsivePanelVueProps;
  'lr-result-card': LyraResultCardVueProps;
  'lr-result-field': LyraResultFieldVueProps;
  'lr-retrieval-compare': LyraRetrievalCompareVueProps;
  'lr-retrieval-results': LyraRetrievalResultsVueProps;
  'lr-retrieval-search': LyraRetrievalSearchVueProps;
  'lr-retrieval-trace': LyraRetrievalTraceVueProps;
  'lr-rubric-form': LyraRubricFormVueProps;
  'lr-scatter-chart': LyraScatterChartVueProps;
  'lr-scroller': LyraScrollerVueProps;
  'lr-segmented': LyraSegmentedVueProps;
  'lr-select': LyraSelectVueProps;
  'lr-selection-toolbar': LyraSelectionToolbarVueProps;
  'lr-sequence-playback': LyraSequencePlaybackVueProps;
  'lr-sequence-strip': LyraSequenceStripVueProps;
  'lr-skeleton': LyraSkeletonVueProps;
  'lr-slider': LyraSliderVueProps;
  'lr-source-card': LyraSourceCardVueProps;
  'lr-source-list': LyraSourceListVueProps;
  'lr-source-picker': LyraSourcePickerVueProps;
  'lr-span-waterfall': LyraSpanWaterfallVueProps;
  'lr-sparkline': LyraSparklineVueProps;
  'lr-spinner': LyraSpinnerVueProps;
  'lr-split-panel': LyraSplitPanelVueProps;
  'lr-spreadsheet-viewer': LyraSpreadsheetViewerVueProps;
  'lr-stack-trace': LyraStackTraceVueProps;
  'lr-stat': LyraStatVueProps;
  'lr-stepper': LyraStepperVueProps;
  'lr-stream-status': LyraStreamStatusVueProps;
  'lr-streaming-text': LyraStreamingTextVueProps;
  'lr-streaming-text-core': LyraStreamingTextCoreVueProps;
  'lr-subagent-panel': LyraSubagentPanelVueProps;
  'lr-suggestion-chips': LyraSuggestionChipsVueProps;
  'lr-svg-viewer': LyraSvgViewerVueProps;
  'lr-swatch-picker': LyraSwatchPickerVueProps;
  'lr-switch': LyraSwitchVueProps;
  'lr-tab': LyraTabVueProps;
  'lr-tab-group': LyraTabGroupVueProps;
  'lr-tab-panel': LyraTabPanelVueProps;
  'lr-table': LyraTableVueProps;
  'lr-tag': LyraTagVueProps;
  'lr-task-list': LyraTaskListVueProps;
  'lr-terminal': LyraTerminalVueProps;
  'lr-test-results': LyraTestResultsVueProps;
  'lr-textarea': LyraTextareaVueProps;
  'lr-thinking-panel': LyraThinkingPanelVueProps;
  'lr-thread-list': LyraThreadListVueProps;
  'lr-time-input': LyraTimeInputVueProps;
  'lr-time-range': LyraTimeRangeVueProps;
  'lr-timeline': LyraTimelineVueProps;
  'lr-timeline-item': LyraTimelineItemVueProps;
  'lr-toast': LyraToastVueProps;
  'lr-toast-item': LyraToastItemVueProps;
  'lr-toggle': LyraToggleVueProps;
  'lr-toggle-group': LyraToggleGroupVueProps;
  'lr-token-input': LyraTokenInputVueProps;
  'lr-tool-approval-dialog': LyraToolApprovalDialogVueProps;
  'lr-tool-call-block': LyraToolCallBlockVueProps;
  'lr-tool-call-chip': LyraToolCallChipVueProps;
  'lr-tool-param-form': LyraToolParamFormVueProps;
  'lr-tool-result-dialog': LyraToolResultDialogVueProps;
  'lr-tool-result-view': LyraToolResultViewVueProps;
  'lr-tool-select-dialog': LyraToolSelectDialogVueProps;
  'lr-tool-timeline': LyraToolTimelineVueProps;
  'lr-tooltip': LyraTooltipVueProps;
  'lr-tour': LyraTourVueProps;
  'lr-trace-tree': LyraTraceTreeVueProps;
  'lr-transcript-feed': LyraTranscriptFeedVueProps;
  'lr-tree': LyraTreeVueProps;
  'lr-tree-item': LyraTreeItemVueProps;
  'lr-typing-indicator': LyraTypingIndicatorVueProps;
  'lr-usage-badge': LyraUsageBadgeVueProps;
  'lr-video': LyraVideoVueProps;
  'lr-video-playlist': LyraVideoPlaylistVueProps;
  'lr-virtual-list': LyraVirtualListVueProps;
  'lr-visually-hidden': LyraVisuallyHiddenVueProps;
  'lr-voice-picker': LyraVoicePickerVueProps;
  'lr-widget': LyraWidgetVueProps;
  'lr-widget-renderer': LyraWidgetRendererVueProps;
  'lr-word-cloud': LyraWordCloudVueProps;
  'lr-xml-viewer': LyraXmlViewerVueProps;
  'lr-zoomable-frame': LyraZoomableFrameVueProps;
}

declare module 'vue' {
  interface GlobalComponents extends LyraVueGlobalComponents {}
}
