// GENERATED FILE — do not edit by hand.
// Regenerate with `node scripts/build-testing-event-registry.mjs` (repo root: packages/lyra-ui)
// after adding, renaming or re-scoping a component event; `event-factory.test.ts` does not
// gate freshness automatically, so re-run this after any `Lyra*EventMap` change reachable from
// `createLyraEvent()`.
// Consumed by `event-factory.ts` — see that file, and this generator's own header comment,
// for what the two exports below mean and where each one's data comes from.

import type { LyraActivityFeedEventMap } from '../components/agent-tools/activity-feed/activity-feed.class.js';
import type { LyraAgentEvalDashboardEventMap } from '../components/agent-tools/agent-eval-dashboard/agent-eval-dashboard.class.js';
import type { LyraAgentRunEventMap } from '../components/agent-tools/agent-run/agent-run.class.js';
import type { LyraAgentTraceEventMap } from '../components/agent-tools/agent-trace/agent-trace.class.js';
import type { LyraApprovalQueueEventMap } from '../components/agent-tools/approval-queue/approval-queue.class.js';
import type { LyraArtifactPanelEventMap } from '../components/agent-tools/artifact-panel/artifact-panel.class.js';
import type { LyraBrowserFrameEventMap } from '../components/agent-tools/browser-frame/browser-frame.class.js';
import type { LyraCommitCardEventMap } from '../components/agent-tools/commit-card/commit-card.class.js';
import type { LyraComparePanelEventMap } from '../components/agent-tools/compare-panel/compare-panel.class.js';
import type { LyraConfirmBarEventMap } from '../components/agent-tools/confirm-bar/confirm-bar.class.js';
import type { LyraContextInspectorEventMap } from '../components/agent-tools/context-inspector/context-inspector.class.js';
import type { LyraEvalDatasetEventMap } from '../components/agent-tools/eval-dataset/eval-dataset.class.js';
import type { LyraEvalResultEventMap } from '../components/agent-tools/eval-result/eval-result.class.js';
import type { LyraEvalRunEventMap } from '../components/agent-tools/evaluation-run/evaluation-run.class.js';
import type { LyraMcpAppEventMap } from '../components/agent-tools/mcp-app/mcp-app.class.js';
import type { LyraPromptStudioEventMap } from '../components/agent-tools/prompt-studio/prompt-studio.class.js';
import type { LyraJsonSchemaViewerEventMap } from '../components/agent-tools/schema-viewer/schema-viewer.class.js';
import type { LyraSpanWaterfallEventMap } from '../components/agent-tools/span-waterfall/span-waterfall.class.js';
import type { LyraStackTraceEventMap } from '../components/agent-tools/stack-trace/stack-trace.class.js';
import type { LyraSubagentPanelEventMap } from '../components/agent-tools/subagent-panel/subagent-panel.class.js';
import type { LyraTaskListEventMap } from '../components/agent-tools/task-list/task-list.class.js';
import type { LyraTerminalEventMap } from '../components/agent-tools/terminal/terminal.class.js';
import type { LyraTestResultsEventMap } from '../components/agent-tools/test-results/test-results.class.js';
import type { LyraThinkingPanelEventMap } from '../components/agent-tools/thinking-panel/thinking-panel.class.js';
import type { LyraToolApprovalDialogEventMap } from '../components/agent-tools/tool-approval-dialog/tool-approval-dialog.class.js';
import type { LyraToolCallBlockEventMap } from '../components/agent-tools/tool-call-block/tool-call-block.class.js';
import type { LyraToolCallChipEventMap } from '../components/agent-tools/tool-call-chip/tool-call-chip.class.js';
import type { LyraToolParamFormEventMap } from '../components/agent-tools/tool-param-form/tool-param-form.class.js';
import type { LyraToolResultDialogEventMap } from '../components/agent-tools/tool-result-dialog/tool-result-dialog.class.js';
import type { LyraToolResultViewEventMap } from '../components/agent-tools/tool-result-view/tool-result-view.class.js';
import type { LyraToolSelectDialogEventMap } from '../components/agent-tools/tool-select-dialog/tool-select-dialog.class.js';
import type { LyraToolTimelineEventMap } from '../components/agent-tools/tool-timeline/tool-timeline.class.js';
import type { LyraTraceTreeEventMap } from '../components/agent-tools/trace-tree/trace-tree.class.js';
import type { LyraBoxPlotEventMap } from '../components/charts/chart/box-plot.class.js';
import type { LyraChartEventMap } from '../components/charts/chart/chart.class.js';
import type { LyraLiteChartEventMap } from '../components/charts/chart/lite-chart.class.js';
import type { LyraAgentWorkspaceEventMap } from '../components/conversation/agent-workspace/agent-workspace.class.js';
import type { LyraBranchPickerEventMap } from '../components/conversation/branch-picker/branch-picker.class.js';
import type { LyraChatComposerEventMap } from '../components/conversation/chat-composer/chat-composer.class.js';
import type { LyraChatMessageEventMap } from '../components/conversation/chat-message/chat-message.class.js';
import type { LyraChatViewportEventMap } from '../components/conversation/chat-viewport/chat-viewport.class.js';
import type { LyraCheckpointEventMap } from '../components/conversation/checkpoint/checkpoint.class.js';
import type { LyraCodeBlockCoreEventMap } from '../components/conversation/code-block/code-block-core.class.js';
import type { LyraCodeBlockEventMap } from '../components/conversation/code-block/code-block.class.js';
import type { LyraConversationItemEventMap } from '../components/conversation/conversation-item/conversation-item.class.js';
import type { LyraGenerationMetricsEventMap } from '../components/conversation/generation-metrics/generation-metrics.class.js';
import type { LyraMarkdownCoreEventMap } from '../components/conversation/markdown/markdown-core.class.js';
import type { LyraMarkdownEventMap } from '../components/conversation/markdown/markdown.class.js';
import type { LyraMessageActionsEventMap } from '../components/conversation/message-actions/message-actions.class.js';
import type { LyraMessageFeedbackEventMap } from '../components/conversation/message-feedback/message-feedback.class.js';
import type { LyraMessagePartsEventMap } from '../components/conversation/message-parts/message-parts.class.js';
import type { LyraModelSelectEventMap } from '../components/conversation/model-select/model-select.class.js';
import type { LyraModelSettingsPanelEventMap } from '../components/conversation/model-settings-panel/model-settings-panel.class.js';
import type { LyraPromptInputEventMap } from '../components/conversation/prompt-input/prompt-input.class.js';
import type { LyraPromptQueueEventMap } from '../components/conversation/prompt-queue/prompt-queue.class.js';
import type { LyraPushToTalkEventMap } from '../components/conversation/push-to-talk/push-to-talk.class.js';
import type { LyraRealtimeSessionEventMap } from '../components/conversation/realtime-session/realtime-session.class.js';
import type { LyraSelectionToolbarEventMap } from '../components/conversation/selection-toolbar/selection-toolbar.class.js';
import type { LyraStreamStatusEventMap } from '../components/conversation/stream-status/stream-status.class.js';
import type { LyraStreamingTextEventMap } from '../components/conversation/streaming-text/streaming-text-base.class.js';
import type { LyraStreamingTextCoreEventMap } from '../components/conversation/streaming-text/streaming-text-core.class.js';
import type { LyraSuggestionChipsEventMap } from '../components/conversation/suggestion-chips/suggestion-chips.class.js';
import type { LyraThreadListEventMap } from '../components/conversation/thread-list/thread-list.class.js';
import type { LyraTranscriptFeedEventMap } from '../components/conversation/transcript-feed/transcript-feed.class.js';
import type { LyraVoicePickerEventMap } from '../components/conversation/voice-picker/voice-picker.class.js';
import type { LyraWidgetRendererEventMap } from '../components/conversation/widget-renderer/widget-renderer.class.js';
import type { LyraCalendarEventMap } from '../components/data/calendar/calendar.class.js';
import type { LyraConditionBuilderEventMap } from '../components/data/condition-builder/condition-builder.class.js';
import type { LyraContextMeterEventMap } from '../components/data/context-meter/context-meter.class.js';
import type { LyraDataGridEventMap } from '../components/data/data-grid/data-grid-types.js';
import type { LyraDocumentLibraryEventMap } from '../components/data/document-library/document-library.class.js';
import type { LyraEnvListEventMap } from '../components/data/env-list/env-list.class.js';
import type { LyraFileTreeEventMap } from '../components/data/file-tree/file-tree.class.js';
import type { LyraFlowCanvasEventMap } from '../components/data/flow-canvas/flow-canvas.class.js';
import type { LyraGraphQueryBuilderEventMap } from '../components/data/graph-query-builder/graph-query-builder.class.js';
import type { LyraHeatmapEventMap } from '../components/data/heatmap/heatmap.class.js';
import type { LyraPaginationEventMap } from '../components/data/pagination/pagination.class.js';
import type { LyraSequenceStripEventMap } from '../components/data/sequence-strip/sequence-strip.class.js';
import type { LyraTableEventMap } from '../components/data/table/table.class.js';
import type { LyraTimelineEventMap } from '../components/data/timeline/timeline.class.js';
import type { LyraTreeItemEventMap } from '../components/data/tree/tree-item.class.js';
import type { LyraTreeEventMap } from '../components/data/tree/tree.class.js';
import type { LyraWordCloudEventMap } from '../components/data/word-cloud/word-cloud.class.js';
import type { LyraButtonEventMap } from '../components/forms/button/button.class.js';
import type { LyraCheckboxGroupEventMap } from '../components/forms/checkbox-group/checkbox-group.class.js';
import type { LyraCheckboxEventMap } from '../components/forms/checkbox/checkbox.class.js';
import type { LyraCodeEditorEventMap } from '../components/forms/code-editor/code-editor.class.js';
import type { LyraColorPickerEventMap } from '../components/forms/color-picker/color-picker.class.js';
import type { LyraComboboxEventMap } from '../components/forms/combobox/combobox.class.js';
import type { LyraOptionEventMap } from '../components/forms/combobox/option.class.js';
import type { LyraDateInputEventMap } from '../components/forms/date-picker/date-input.class.js';
import type { LyraDatePickerEventMap } from '../components/forms/date-picker/date-picker.class.js';
import type { LyraEmojiPickerEventMap } from '../components/forms/emoji-picker/emoji-picker.class.js';
import type { LyraIconButtonEventMap } from '../components/forms/icon-button/icon-button.class.js';
import type { LyraInputEventMap } from '../components/forms/input/input.class.js';
import type { LyraNumberInputEventMap } from '../components/forms/input/number-input.class.js';
import type { LyraTimeInputEventMap } from '../components/forms/input/time-input.class.js';
import type { LyraLocalePickerEventMap } from '../components/forms/locale-picker/locale-picker.class.js';
import type { LyraOtpInputEventMap } from '../components/forms/otp-input/otp-input.class.js';
import type { LyraPhoneInputEventMap } from '../components/forms/phone-input/phone-input.class.js';
import type { LyraRadioGroupEventMap } from '../components/forms/radio/radio-group.class.js';
import type { LyraRadioEventMap } from '../components/forms/radio/radio.class.js';
import type { LyraRubricFormEventMap } from '../components/forms/rubric-form/rubric-form.class.js';
import type { LyraSelectEventMap } from '../components/forms/select/select.class.js';
import type { LyraSliderEventMap } from '../components/forms/slider/slider.class.js';
import type { LyraSwatchPickerEventMap } from '../components/forms/swatch-picker/swatch-picker.class.js';
import type { LyraSwitchEventMap } from '../components/forms/switch/switch.class.js';
import type { LyraTextareaEventMap } from '../components/forms/textarea/textarea.class.js';
import type { LyraTimeRangeEventMap } from '../components/forms/time-range/time-range.class.js';
import type { LyraToggleGroupEventMap } from '../components/forms/toggle-group/toggle-group.class.js';
import type { LyraToggleEventMap } from '../components/forms/toggle/toggle.class.js';
import type { LyraTokenInputEventMap } from '../components/forms/token-input/token-input.class.js';
import type { LyraAppRailGroupEventMap } from '../components/layout/app-rail-group/app-rail-group.class.js';
import type { LyraAppRailItemEventMap } from '../components/layout/app-rail/app-rail-item.class.js';
import type { LyraAppRailEventMap } from '../components/layout/app-rail/app-rail.class.js';
import type { LyraCardEventMap } from '../components/layout/card/card.class.js';
import type { LyraCarouselEventMap } from '../components/layout/carousel/carousel.class.js';
import type { LyraCommandPaletteEventMap } from '../components/layout/command-palette/command-palette.class.js';
import type { LyraDashboardGridEventMap } from '../components/layout/dashboard-grid/dashboard-grid.class.js';
import type { LyraAccordionEventMap } from '../components/layout/details/accordion.class.js';
import type { LyraDetailsEventMap } from '../components/layout/details/details.class.js';
import type { LyraDockPanelEventMap } from '../components/layout/dock-panel/dock-panel.class.js';
import type { LyraDrilldownPanelEventMap } from '../components/layout/drilldown-panel/drilldown-panel.class.js';
import type { LyraFilterBarEventMap } from '../components/layout/filter-bar/filter-bar.class.js';
import type { LyraDropdownItemEventMap } from '../components/layout/menu/dropdown-item.class.js';
import type { LyraMenuItemEventMap } from '../components/layout/menu/menu-item.class.js';
import type { LyraMenuEventMap } from '../components/layout/menu/menu.class.js';
import type { LyraMultiSplitEventMap } from '../components/layout/multi-split/multi-split.class.js';
import type { LyraNavigationMenuItemEventMap } from '../components/layout/navigation-menu-item/navigation-menu-item.class.js';
import type { LyraNavigationMenuEventMap } from '../components/layout/navigation-menu/navigation-menu.class.js';
import type { LyraPageEventMap } from '../components/layout/page/page.class.js';
import type { LyraReorderItemEventMap } from '../components/layout/reorder-list/reorder-item.class.js';
import type { LyraReorderListEventMap } from '../components/layout/reorder-list/reorder-list.class.js';
import type { LyraResponsivePanelEventMap } from '../components/layout/responsive-panel/responsive-panel.class.js';
import type { LyraScrollerEventMap } from '../components/layout/scroller/scroller.class.js';
import type { LyraSegmentedEventMap } from '../components/layout/segmented/segmented.class.js';
import type { LyraSplitPanelEventMap } from '../components/layout/split-panel/split-panel.class.js';
import type { LyraStepperEventMap } from '../components/layout/stepper/stepper.class.js';
import type { LyraTabGroupEventMap } from '../components/layout/tab-group/tab-group.class.js';
import type { LyraTabEventMap } from '../components/layout/tab-group/tab.class.js';
import type { LyraVirtualListEventMap } from '../components/layout/virtual-list/virtual-list.class.js';
import type { LyraWidgetEventMap } from '../components/layout/widget/widget.class.js';
import type { LyraAnimatedImageEventMap } from '../components/media/animated-image/animated-image.class.js';
import type { LyraAnimationEventMap } from '../components/media/animation/animation.class.js';
import type { LyraAttachmentChipEventMap } from '../components/media/attachment-chip/attachment-chip.class.js';
import type { LyraAttachmentTriggerEventMap } from '../components/media/attachment-trigger/attachment-trigger.class.js';
import type { LyraAvPlayerEventMap } from '../components/media/av-player/av-player.class.js';
import type { LyraAvatarGroupEventMap } from '../components/media/avatar-group/avatar-group.class.js';
import type { LyraAvatarEventMap } from '../components/media/avatar/avatar.class.js';
import type { LyraDropZoneEventMap } from '../components/media/drop-zone/drop-zone.class.js';
import type { LyraFileInputEventMap } from '../components/media/file-input/file-input.class.js';
import type { LyraImageComparerEventMap } from '../components/media/image-comparer/image-comparer.class.js';
import type { LyraImageViewerEventMap } from '../components/media/image-viewer/image-viewer.class.js';
import type { LyraLightboxEventMap } from '../components/media/lightbox/lightbox.class.js';
import type { LyraMapEventMap } from '../components/media/map/map.class.js';
import type { LyraMediaCardEventMap } from '../components/media/media-card/media-card.class.js';
import type { LyraPanZoomEventMap } from '../components/media/pan-zoom/pan-zoom.class.js';
import type { LyraSequencePlaybackEventMap } from '../components/media/sequence-playback/sequence-playback.class.js';
import type { LyraVideoPlaylistEventMap } from '../components/media/video-playlist/video-playlist.class.js';
import type { LyraVideoEventMap } from '../components/media/video/video.class.js';
import type { LyraZoomableFrameEventMap } from '../components/media/zoomable-frame/zoomable-frame.class.js';
import type { LyraAlertEventMap } from '../components/overlays/alert/alert.class.js';
import type { LyraTagEventMap } from '../components/overlays/badge/tag.class.js';
import type { LyraCalloutEventMap } from '../components/overlays/callout/callout.class.js';
import type { LyraChipGroupEventMap } from '../components/overlays/chip/chip-group.class.js';
import type { LyraChipEventMap } from '../components/overlays/chip/chip.class.js';
import type { LyraContextMenuEventMap } from '../components/overlays/context-menu/context-menu.class.js';
import type { LyraDialogEventMap } from '../components/overlays/dialog/dialog.class.js';
import type { LyraDropdownEventMap } from '../components/overlays/overlay/dropdown.class.js';
import type { LyraPopoverEventMap } from '../components/overlays/overlay/popover.class.js';
import type { LyraTooltipEventMap } from '../components/overlays/overlay/tooltip.class.js';
import type { LyraPopupEventMap } from '../components/overlays/popup/popup.class.js';
import type { LyraRatingEventMap } from '../components/overlays/rating/rating.class.js';
import type { LyraToastItemEventMap } from '../components/overlays/toast/toast-item.class.js';
import type { LyraToastEventMap } from '../components/overlays/toast/toast.class.js';
import type { LyraChunkInspectorEventMap } from '../components/retrieval/chunk-inspector/chunk-inspector.class.js';
import type { LyraCitationBadgeEventMap } from '../components/retrieval/citation-badge/citation-badge.class.js';
import type { LyraClaimEvidenceEventMap } from '../components/retrieval/claim-evidence/claim-evidence.class.js';
import type { LyraCommunityCardEventMap } from '../components/retrieval/community-card/community-card.class.js';
import type { LyraEmbeddingExplorerEventMap } from '../components/retrieval/embedding-explorer/embedding-explorer.class.js';
import type { LyraEntityCardEventMap } from '../components/retrieval/entity-card/entity-card.class.js';
import type { LyraEntityChipEventMap } from '../components/retrieval/entity-chip/entity-chip.class.js';
import type { LyraEntityDossierEventMap } from '../components/retrieval/entity-dossier/entity-dossier.class.js';
import type { LyraGraphLegendEventMap } from '../components/retrieval/graph-legend/graph-legend.class.js';
import type { LyraGraphEventMap } from '../components/retrieval/graph/graph.class.js';
import type { LyraGroundingSummaryEventMap } from '../components/retrieval/grounding-summary/grounding-summary.class.js';
import type { LyraIngestionQueueEventMap } from '../components/retrieval/ingestion-queue/ingestion-queue.class.js';
import type { LyraKnowledgeBaseAdminEventMap } from '../components/retrieval/knowledge-base-admin/knowledge-base-admin.class.js';
import type { LyraKnowledgeBaseEventMap } from '../components/retrieval/knowledge-base/knowledge-base.class.js';
import type { LyraKnowledgeGraphExplorerEventMap } from '../components/retrieval/knowledge-graph-explorer/knowledge-graph-explorer.class.js';
import type { LyraMemoryPanelEventMap } from '../components/retrieval/memory-panel/memory-panel.class.js';
import type { LyraMindMapEventMap } from '../components/retrieval/mind-map/mind-map.class.js';
import type { LyraNeighborListEventMap } from '../components/retrieval/neighbor-list/neighbor-list.class.js';
import type { LyraNodePaletteEventMap } from '../components/retrieval/node-palette/node-palette.class.js';
import type { LyraPathStripEventMap } from '../components/retrieval/path-strip/path-strip.class.js';
import type { LyraProvenancePanelEventMap } from '../components/retrieval/provenance-panel/provenance-panel.class.js';
import type { LyraRagAnswerEventMap } from '../components/retrieval/rag-answer/rag-answer.class.js';
import type { LyraRagEvalDashboardEventMap } from '../components/retrieval/rag-eval-dashboard/rag-eval-dashboard.class.js';
import type { LyraRetrievalCompareEventMap } from '../components/retrieval/retrieval-compare/retrieval-compare.class.js';
import type { LyraRetrievalResultsEventMap } from '../components/retrieval/retrieval-results/retrieval-results.class.js';
import type { LyraRetrievalSearchEventMap } from '../components/retrieval/retrieval-search/retrieval-search.class.js';
import type { LyraRetrievalTraceEventMap } from '../components/retrieval/retrieval-trace/retrieval-trace.class.js';
import type { LyraSourceCardEventMap } from '../components/retrieval/source-card/source-card.class.js';
import type { LyraSourceListEventMap } from '../components/retrieval/source-list/source-list.class.js';
import type { LyraSourcePickerEventMap } from '../components/retrieval/source-picker/source-picker.class.js';
import type { LyraCopyButtonEventMap } from '../components/utility/copy-button/copy-button.class.js';
import type { LyraDiffViewEventMap } from '../components/utility/diff-view/diff-view.class.js';
import type { LyraExportButtonEventMap } from '../components/utility/export-button/export-button.class.js';
import type { LyraIconEventMap } from '../components/utility/icon/icon.class.js';
import type { LyraIntersectionObserverEventMap } from '../components/utility/intersection-observer/intersection-observer.class.js';
import type { LyraJsonViewerEventMap } from '../components/utility/json-viewer/json-viewer.class.js';
import type { LyraKnownDateEventMap } from '../components/utility/known-date/known-date.class.js';
import type { LyraMentionPopoverEventMap } from '../components/utility/mention-popover/mention-popover.class.js';
import type { LyraMutationObserverEventMap } from '../components/utility/mutation-observer/mutation-observer.class.js';
import type { LyraPollStatusEventMap } from '../components/utility/poll-status/poll-status.class.js';
import type { LyraRandomContentEventMap } from '../components/utility/random-content/random-content.class.js';
import type { LyraResizeObserverEventMap } from '../components/utility/resize-observer/resize-observer.class.js';
import type { LyraTourEventMap } from '../components/utility/tour/tour.class.js';
import type { LyraArchiveViewerEventMap } from '../components/viewers/archive-viewer/archive-viewer.class.js';
import type { LyraCalendarViewerEventMap } from '../components/viewers/calendar-viewer/calendar-viewer.class.js';
import type { LyraContactViewerEventMap } from '../components/viewers/contact-viewer/contact-viewer.class.js';
import type { LyraCsvViewerEventMap } from '../components/viewers/csv-viewer/csv-viewer.class.js';
import type { LyraDatasetViewerEventMap } from '../components/viewers/dataset-viewer/dataset-viewer.class.js';
import type { LyraDocumentCompareEventMap } from '../components/viewers/document-compare/document-compare.class.js';
import type { LyraDocumentPreviewEventMap } from '../components/viewers/document-preview/document-preview.class.js';
import type { LyraDocumentViewerEventMap } from '../components/viewers/document-viewer/document-viewer.class.js';
import type { LyraDocxViewerEventMap } from '../components/viewers/docx-viewer/docx-viewer.class.js';
import type { LyraEbookViewerEventMap } from '../components/viewers/ebook-viewer/ebook-viewer.class.js';
import type { LyraEmailViewerEventMap } from '../components/viewers/email-viewer/email-viewer.class.js';
import type { LyraGeoJsonViewerEventMap } from '../components/viewers/geojson-view/geojson-viewer.class.js';
import type { LyraHighlightLayerEventMap } from '../components/viewers/highlight-layer/highlight-layer.class.js';
import type { LyraHtmlViewerEventMap } from '../components/viewers/html-viewer/html-viewer.class.js';
import type { LyraIncludeEventMap } from '../components/viewers/include/include.class.js';
import type { LyraNotebookViewerEventMap } from '../components/viewers/notebook-viewer/notebook-viewer.class.js';
import type { LyraPageRailEventMap } from '../components/viewers/page-rail/page-rail.class.js';
import type { LyraPdfViewerEventMap } from '../components/viewers/pdf-viewer/pdf-viewer.class.js';
import type { LyraPptxViewerEventMap } from '../components/viewers/pptx-viewer/pptx-viewer.class.js';
import type { LyraSpreadsheetViewerEventMap } from '../components/viewers/spreadsheet-viewer/spreadsheet-viewer.class.js';
import type { LyraSvgViewerEventMap } from '../components/viewers/svg-viewer/svg-viewer.class.js';
import type { LyraXmlViewerEventMap } from '../components/viewers/xml-viewer/xml-viewer.class.js';

/** Every `lr-*` custom element tag with at least one documented event, mapped to the
 * `Lyra*EventMap` interface that types it -- its own class's, or (for a tag that inherits its
 * event map without redeclaring it) the nearest ancestor's that does. Consumed only by
 * `createLyraEvent()`'s generic parameters; never imported for its runtime value. */
export interface LyraTagEventTypes {
  'lr-accordion': LyraAccordionEventMap;
  'lr-activity-feed': LyraActivityFeedEventMap;
  'lr-agent-eval-dashboard': LyraAgentEvalDashboardEventMap;
  'lr-agent-run': LyraAgentRunEventMap;
  'lr-agent-trace': LyraAgentTraceEventMap;
  'lr-agent-workspace': LyraAgentWorkspaceEventMap;
  'lr-alert': LyraAlertEventMap;
  'lr-animated-image': LyraAnimatedImageEventMap;
  'lr-animation': LyraAnimationEventMap;
  'lr-app-rail': LyraAppRailEventMap;
  'lr-app-rail-group': LyraAppRailGroupEventMap;
  'lr-app-rail-item': LyraAppRailItemEventMap;
  'lr-approval-queue': LyraApprovalQueueEventMap;
  'lr-archive-viewer': LyraArchiveViewerEventMap;
  'lr-artifact-panel': LyraArtifactPanelEventMap;
  'lr-attachment-chip': LyraAttachmentChipEventMap;
  'lr-attachment-trigger': LyraAttachmentTriggerEventMap;
  'lr-av-player': LyraAvPlayerEventMap;
  'lr-avatar': LyraAvatarEventMap;
  'lr-avatar-group': LyraAvatarGroupEventMap;
  'lr-bar-chart': LyraChartEventMap;
  'lr-box-plot': LyraBoxPlotEventMap;
  'lr-branch-picker': LyraBranchPickerEventMap;
  'lr-browser-frame': LyraBrowserFrameEventMap;
  'lr-bubble-chart': LyraChartEventMap;
  'lr-button': LyraButtonEventMap;
  'lr-calendar': LyraCalendarEventMap;
  'lr-calendar-viewer': LyraCalendarViewerEventMap;
  'lr-callout': LyraCalloutEventMap;
  'lr-card': LyraCardEventMap;
  'lr-carousel': LyraCarouselEventMap;
  'lr-chart': LyraChartEventMap;
  'lr-chat-composer': LyraChatComposerEventMap;
  'lr-chat-message': LyraChatMessageEventMap;
  'lr-chat-viewport': LyraChatViewportEventMap;
  'lr-checkbox': LyraCheckboxEventMap;
  'lr-checkbox-group': LyraCheckboxGroupEventMap;
  'lr-checkpoint': LyraCheckpointEventMap;
  'lr-chip': LyraChipEventMap;
  'lr-chip-group': LyraChipGroupEventMap;
  'lr-chunk-inspector': LyraChunkInspectorEventMap;
  'lr-citation-badge': LyraCitationBadgeEventMap;
  'lr-claim-evidence': LyraClaimEvidenceEventMap;
  'lr-code-block': LyraCodeBlockEventMap;
  'lr-code-block-core': LyraCodeBlockCoreEventMap;
  'lr-code-editor': LyraCodeEditorEventMap;
  'lr-color-picker': LyraColorPickerEventMap;
  'lr-combobox': LyraComboboxEventMap;
  'lr-command-palette': LyraCommandPaletteEventMap;
  'lr-commit-card': LyraCommitCardEventMap;
  'lr-community-card': LyraCommunityCardEventMap;
  'lr-compare-panel': LyraComparePanelEventMap;
  'lr-condition-builder': LyraConditionBuilderEventMap;
  'lr-confirm-bar': LyraConfirmBarEventMap;
  'lr-contact-viewer': LyraContactViewerEventMap;
  'lr-context-inspector': LyraContextInspectorEventMap;
  'lr-context-menu': LyraContextMenuEventMap;
  'lr-context-meter': LyraContextMeterEventMap;
  'lr-conversation-item': LyraConversationItemEventMap;
  'lr-copy-button': LyraCopyButtonEventMap;
  'lr-csv-viewer': LyraCsvViewerEventMap;
  'lr-dashboard-grid': LyraDashboardGridEventMap;
  'lr-data-grid': LyraDataGridEventMap;
  'lr-dataset-viewer': LyraDatasetViewerEventMap;
  'lr-date-input': LyraDateInputEventMap;
  'lr-date-picker': LyraDatePickerEventMap;
  'lr-details': LyraDetailsEventMap;
  'lr-dialog': LyraDialogEventMap;
  'lr-diff-view': LyraDiffViewEventMap;
  'lr-dock-panel': LyraDockPanelEventMap;
  'lr-document-compare': LyraDocumentCompareEventMap;
  'lr-document-library': LyraDocumentLibraryEventMap;
  'lr-document-preview': LyraDocumentPreviewEventMap;
  'lr-document-viewer': LyraDocumentViewerEventMap;
  'lr-docx-viewer': LyraDocxViewerEventMap;
  'lr-doughnut-chart': LyraChartEventMap;
  'lr-drawer': LyraDialogEventMap;
  'lr-drilldown-panel': LyraDrilldownPanelEventMap;
  'lr-drop-zone': LyraDropZoneEventMap;
  'lr-dropdown': LyraDropdownEventMap;
  'lr-dropdown-item': LyraDropdownItemEventMap;
  'lr-ebook-viewer': LyraEbookViewerEventMap;
  'lr-email-viewer': LyraEmailViewerEventMap;
  'lr-embedding-explorer': LyraEmbeddingExplorerEventMap;
  'lr-emoji-picker': LyraEmojiPickerEventMap;
  'lr-entity-card': LyraEntityCardEventMap;
  'lr-entity-chip': LyraEntityChipEventMap;
  'lr-entity-dossier': LyraEntityDossierEventMap;
  'lr-env-list': LyraEnvListEventMap;
  'lr-eval-dataset': LyraEvalDatasetEventMap;
  'lr-eval-result': LyraEvalResultEventMap;
  'lr-eval-run': LyraEvalRunEventMap;
  'lr-export-button': LyraExportButtonEventMap;
  'lr-file-input': LyraFileInputEventMap;
  'lr-file-tree': LyraFileTreeEventMap;
  'lr-filter-bar': LyraFilterBarEventMap;
  'lr-flow-canvas': LyraFlowCanvasEventMap;
  'lr-generation-metrics': LyraGenerationMetricsEventMap;
  'lr-geojson-view': LyraGeoJsonViewerEventMap;
  'lr-geojson-viewer': LyraGeoJsonViewerEventMap;
  'lr-graph': LyraGraphEventMap;
  'lr-graph-legend': LyraGraphLegendEventMap;
  'lr-graph-query-builder': LyraGraphQueryBuilderEventMap;
  'lr-grounding-summary': LyraGroundingSummaryEventMap;
  'lr-heatmap': LyraHeatmapEventMap;
  'lr-highlight-layer': LyraHighlightLayerEventMap;
  'lr-histogram': LyraChartEventMap;
  'lr-html-viewer': LyraHtmlViewerEventMap;
  'lr-icon': LyraIconEventMap;
  'lr-icon-button': LyraIconButtonEventMap;
  'lr-image-comparer': LyraImageComparerEventMap;
  'lr-image-viewer': LyraImageViewerEventMap;
  'lr-include': LyraIncludeEventMap;
  'lr-ingestion-queue': LyraIngestionQueueEventMap;
  'lr-input': LyraInputEventMap;
  'lr-intersection-observer': LyraIntersectionObserverEventMap;
  'lr-json-schema-viewer': LyraJsonSchemaViewerEventMap;
  'lr-json-viewer': LyraJsonViewerEventMap;
  'lr-knowledge-base': LyraKnowledgeBaseEventMap;
  'lr-knowledge-base-admin': LyraKnowledgeBaseAdminEventMap;
  'lr-knowledge-graph-explorer': LyraKnowledgeGraphExplorerEventMap;
  'lr-known-date': LyraKnownDateEventMap;
  'lr-lightbox': LyraLightboxEventMap;
  'lr-line-chart': LyraChartEventMap;
  'lr-lite-chart': LyraLiteChartEventMap;
  'lr-locale-picker': LyraLocalePickerEventMap;
  'lr-map': LyraMapEventMap;
  'lr-markdown': LyraMarkdownEventMap;
  'lr-markdown-core': LyraMarkdownCoreEventMap;
  'lr-mcp-app': LyraMcpAppEventMap;
  'lr-media-card': LyraMediaCardEventMap;
  'lr-memory-panel': LyraMemoryPanelEventMap;
  'lr-mention-popover': LyraMentionPopoverEventMap;
  'lr-menu': LyraMenuEventMap;
  'lr-menu-item': LyraMenuItemEventMap;
  'lr-message-actions': LyraMessageActionsEventMap;
  'lr-message-feedback': LyraMessageFeedbackEventMap;
  'lr-message-parts': LyraMessagePartsEventMap;
  'lr-mind-map': LyraMindMapEventMap;
  'lr-model-select': LyraModelSelectEventMap;
  'lr-model-settings-panel': LyraModelSettingsPanelEventMap;
  'lr-multi-split': LyraMultiSplitEventMap;
  'lr-mutation-observer': LyraMutationObserverEventMap;
  'lr-native-time-input': LyraInputEventMap;
  'lr-navigation-menu': LyraNavigationMenuEventMap;
  'lr-navigation-menu-item': LyraNavigationMenuItemEventMap;
  'lr-neighbor-list': LyraNeighborListEventMap;
  'lr-node-palette': LyraNodePaletteEventMap;
  'lr-notebook-viewer': LyraNotebookViewerEventMap;
  'lr-number-input': LyraNumberInputEventMap;
  'lr-option': LyraOptionEventMap;
  'lr-otp-input': LyraOtpInputEventMap;
  'lr-page': LyraPageEventMap;
  'lr-page-rail': LyraPageRailEventMap;
  'lr-pagination': LyraPaginationEventMap;
  'lr-pan-zoom': LyraPanZoomEventMap;
  'lr-path-strip': LyraPathStripEventMap;
  'lr-pdf-viewer': LyraPdfViewerEventMap;
  'lr-phone-input': LyraPhoneInputEventMap;
  'lr-pie-chart': LyraChartEventMap;
  'lr-polar-area-chart': LyraChartEventMap;
  'lr-poll-status': LyraPollStatusEventMap;
  'lr-popover': LyraPopoverEventMap;
  'lr-popup': LyraPopupEventMap;
  'lr-pptx-viewer': LyraPptxViewerEventMap;
  'lr-prompt-input': LyraPromptInputEventMap;
  'lr-prompt-queue': LyraPromptQueueEventMap;
  'lr-prompt-studio': LyraPromptStudioEventMap;
  'lr-provenance-panel': LyraProvenancePanelEventMap;
  'lr-push-to-talk': LyraPushToTalkEventMap;
  'lr-radar-chart': LyraChartEventMap;
  'lr-radio': LyraRadioEventMap;
  'lr-radio-button': LyraRadioEventMap;
  'lr-radio-group': LyraRadioGroupEventMap;
  'lr-rag-answer': LyraRagAnswerEventMap;
  'lr-rag-eval-dashboard': LyraRagEvalDashboardEventMap;
  'lr-random-content': LyraRandomContentEventMap;
  'lr-rating': LyraRatingEventMap;
  'lr-realtime-session': LyraRealtimeSessionEventMap;
  'lr-reorder-item': LyraReorderItemEventMap;
  'lr-reorder-list': LyraReorderListEventMap;
  'lr-resize-observer': LyraResizeObserverEventMap;
  'lr-responsive-panel': LyraResponsivePanelEventMap;
  'lr-retrieval-compare': LyraRetrievalCompareEventMap;
  'lr-retrieval-results': LyraRetrievalResultsEventMap;
  'lr-retrieval-search': LyraRetrievalSearchEventMap;
  'lr-retrieval-trace': LyraRetrievalTraceEventMap;
  'lr-rubric-form': LyraRubricFormEventMap;
  'lr-scatter-chart': LyraChartEventMap;
  'lr-scroller': LyraScrollerEventMap;
  'lr-segmented': LyraSegmentedEventMap;
  'lr-select': LyraSelectEventMap;
  'lr-selection-toolbar': LyraSelectionToolbarEventMap;
  'lr-sequence-playback': LyraSequencePlaybackEventMap;
  'lr-sequence-strip': LyraSequenceStripEventMap;
  'lr-slider': LyraSliderEventMap;
  'lr-source-card': LyraSourceCardEventMap;
  'lr-source-list': LyraSourceListEventMap;
  'lr-source-picker': LyraSourcePickerEventMap;
  'lr-span-waterfall': LyraSpanWaterfallEventMap;
  'lr-split-panel': LyraSplitPanelEventMap;
  'lr-spreadsheet-viewer': LyraSpreadsheetViewerEventMap;
  'lr-stack-trace': LyraStackTraceEventMap;
  'lr-stepper': LyraStepperEventMap;
  'lr-stream-status': LyraStreamStatusEventMap;
  'lr-streaming-text': LyraStreamingTextEventMap;
  'lr-streaming-text-core': LyraStreamingTextCoreEventMap;
  'lr-subagent-panel': LyraSubagentPanelEventMap;
  'lr-suggestion-chips': LyraSuggestionChipsEventMap;
  'lr-svg-viewer': LyraSvgViewerEventMap;
  'lr-swatch-picker': LyraSwatchPickerEventMap;
  'lr-switch': LyraSwitchEventMap;
  'lr-tab': LyraTabEventMap;
  'lr-tab-group': LyraTabGroupEventMap;
  'lr-table': LyraTableEventMap;
  'lr-tag': LyraTagEventMap;
  'lr-task-list': LyraTaskListEventMap;
  'lr-terminal': LyraTerminalEventMap;
  'lr-test-results': LyraTestResultsEventMap;
  'lr-textarea': LyraTextareaEventMap;
  'lr-thinking-panel': LyraThinkingPanelEventMap;
  'lr-thread-list': LyraThreadListEventMap;
  'lr-time-input': LyraTimeInputEventMap;
  'lr-time-range': LyraTimeRangeEventMap;
  'lr-timeline': LyraTimelineEventMap;
  'lr-toast': LyraToastEventMap;
  'lr-toast-item': LyraToastItemEventMap;
  'lr-toggle': LyraToggleEventMap;
  'lr-toggle-group': LyraToggleGroupEventMap;
  'lr-token-input': LyraTokenInputEventMap;
  'lr-tool-approval-dialog': LyraToolApprovalDialogEventMap;
  'lr-tool-call-block': LyraToolCallBlockEventMap;
  'lr-tool-call-chip': LyraToolCallChipEventMap;
  'lr-tool-param-form': LyraToolParamFormEventMap;
  'lr-tool-result-dialog': LyraToolResultDialogEventMap;
  'lr-tool-result-view': LyraToolResultViewEventMap;
  'lr-tool-select-dialog': LyraToolSelectDialogEventMap;
  'lr-tool-timeline': LyraToolTimelineEventMap;
  'lr-tooltip': LyraTooltipEventMap;
  'lr-tour': LyraTourEventMap;
  'lr-trace-tree': LyraTraceTreeEventMap;
  'lr-transcript-feed': LyraTranscriptFeedEventMap;
  'lr-tree': LyraTreeEventMap;
  'lr-tree-item': LyraTreeItemEventMap;
  'lr-video': LyraVideoEventMap;
  'lr-video-playlist': LyraVideoPlaylistEventMap;
  'lr-virtual-list': LyraVirtualListEventMap;
  'lr-voice-picker': LyraVoicePickerEventMap;
  'lr-widget': LyraWidgetEventMap;
  'lr-widget-renderer': LyraWidgetRendererEventMap;
  'lr-word-cloud': LyraWordCloudEventMap;
  'lr-xml-viewer': LyraXmlViewerEventMap;
  'lr-zoomable-frame': LyraZoomableFrameEventMap;
}

/** tag -> event name -> whether that component's own `this.emit()` call site passes
 * `{ cancelable: true }`, derived from the same authored event descriptions
 * `check-event-contracts.mjs` already cross-checks against real dispatch call sites.
 * Absent entries (an unlisted tag, or an unlisted event on a listed tag) are never cancelable. */
export const LYRA_EVENT_CANCELABLE: {
  readonly [tag: string]: { readonly [name: string]: boolean } | undefined;
} = {
  'lr-accordion': { 'lr-collapse': true, 'lr-expand': true, 'lr-toggle-request': true },
  'lr-alert': { 'lr-hide': true, 'lr-show': true },
  'lr-app-rail': { 'lr-rail-resize-request': true, 'lr-toggle': true },
  'lr-app-rail-group': { 'lr-toggle-request': true },
  'lr-app-rail-item': { 'lr-toggle-request': true },
  'lr-approval-queue': { 'lr-approval-decision': true },
  'lr-bar-chart': { 'lr-before-datum-visibility-change': true, 'lr-before-legend-visibility-change': true, 'lr-datum-visibility-change-request': true, 'lr-legend-visibility-change-request': true },
  'lr-box-plot': { 'lr-before-legend-visibility-change': true, 'lr-legend-visibility-change-request': true },
  'lr-bubble-chart': { 'lr-before-datum-visibility-change': true, 'lr-before-legend-visibility-change': true, 'lr-datum-visibility-change-request': true, 'lr-legend-visibility-change-request': true },
  'lr-button': { 'lr-invalid': true },
  'lr-callout': { 'lr-close': true },
  'lr-chart': { 'lr-before-datum-visibility-change': true, 'lr-before-legend-visibility-change': true, 'lr-datum-visibility-change-request': true, 'lr-legend-visibility-change-request': true },
  'lr-chat-composer': { 'lr-invalid': true },
  'lr-chat-message': { 'lr-toggle-request': true },
  'lr-checkbox': { 'lr-checkbox-toggle-request': true, 'lr-invalid': true },
  'lr-checkbox-group': { 'lr-checkbox-group-toggle-request': true, 'lr-invalid': true },
  'lr-chip': { 'lr-chip-select': true },
  'lr-code-block': { 'lr-toggle-request': true },
  'lr-code-block-core': { 'lr-toggle-request': true },
  'lr-code-editor': { 'lr-invalid': true },
  'lr-color-picker': { 'lr-hide': true, 'lr-invalid': true, 'lr-show': true },
  'lr-combobox': { 'lr-create': true, 'lr-hide': true, 'lr-invalid': true, 'lr-retry': true, 'lr-show': true },
  'lr-command-palette': { 'lr-close': true, 'lr-open': true, 'lr-show': true },
  'lr-compare-panel': { 'lr-vote': true },
  'lr-confirm-bar': { 'lr-approve': true, 'lr-deny': true },
  'lr-context-inspector': { 'lr-export': true },
  'lr-context-menu': { 'lr-hide': true, 'lr-select': true, 'lr-show': true },
  'lr-context-meter': { 'lr-segment-activate': true },
  'lr-data-grid': { 'lr-cell-contextmenu': true, 'lr-retry': true, 'lr-sort-request': true },
  'lr-date-input': { 'lr-hide': true, 'lr-invalid': true, 'lr-show': true },
  'lr-details': { 'lr-hide': true, 'lr-show': true },
  'lr-dialog': { 'lr-close': true, 'lr-hide': true, 'lr-initial-focus': true, 'lr-request-close': true, 'lr-show': true },
  'lr-dock-panel': { 'lr-collapse-request': true, 'lr-resize-request': true },
  'lr-document-library': { 'lr-retry': true, 'lr-sort-request': true },
  'lr-doughnut-chart': { 'lr-before-datum-visibility-change': true, 'lr-before-legend-visibility-change': true, 'lr-datum-visibility-change-request': true, 'lr-legend-visibility-change-request': true },
  'lr-drawer': { 'lr-close': true, 'lr-hide': true, 'lr-initial-focus': true, 'lr-request-close': true, 'lr-show': true },
  'lr-dropdown': { 'lr-hide': true, 'lr-select': true, 'lr-show': true },
  'lr-dropdown-item': { 'lr-menu-item-change': true },
  'lr-emoji-picker': { 'lr-invalid': true },
  'lr-eval-run': { 'lr-example-tool-approval-decide': true },
  'lr-export-button': { 'lr-export': true, 'lr-hide': true, 'lr-show': true },
  'lr-file-input': { 'lr-invalid': true },
  'lr-graph-legend': { 'lr-before-visibility-change': true, 'lr-visibility-change-request': true },
  'lr-graph-query-builder': { 'lr-before-query-delete': true, 'lr-before-query-load': true, 'lr-before-query-run': true, 'lr-before-query-save': true, 'lr-invalid': true, 'lr-query-delete-request': true, 'lr-query-load-request': true, 'lr-query-run-request': true, 'lr-query-save-request': true },
  'lr-histogram': { 'lr-before-datum-visibility-change': true, 'lr-before-legend-visibility-change': true, 'lr-datum-visibility-change-request': true, 'lr-legend-visibility-change-request': true },
  'lr-input': { 'lr-invalid': true },
  'lr-knowledge-base': { 'lr-retry': true },
  'lr-known-date': { 'lr-invalid': true },
  'lr-lightbox': { 'lr-hide': true, 'lr-lightbox-close': true, 'lr-show': true },
  'lr-line-chart': { 'lr-before-datum-visibility-change': true, 'lr-before-legend-visibility-change': true, 'lr-datum-visibility-change-request': true, 'lr-legend-visibility-change-request': true },
  'lr-locale-picker': { 'lr-change': true, 'lr-invalid': true },
  'lr-map': { 'lr-map-legend-panel-toggle': true, 'lr-map-legend-toggle': true },
  'lr-media-card': { 'lr-before-media-download': true },
  'lr-menu': { 'lr-select': true },
  'lr-menu-item': { 'lr-menu-item-change': true },
  'lr-message-actions': { 'lr-feedback-submit': true },
  'lr-message-feedback': { 'lr-feedback-submit': true },
  'lr-model-select': { 'lr-invalid': true },
  'lr-multi-split': { 'lr-resize-request': true, 'lr-toggle': true },
  'lr-native-time-input': { 'lr-invalid': true },
  'lr-number-input': { 'lr-invalid': true },
  'lr-otp-input': { 'lr-complete': true, 'lr-invalid': true },
  'lr-page': { 'lr-nav-toggle': true },
  'lr-pagination': { 'lr-before-page-change': true },
  'lr-phone-input': { 'lr-invalid': true },
  'lr-pie-chart': { 'lr-before-datum-visibility-change': true, 'lr-before-legend-visibility-change': true, 'lr-datum-visibility-change-request': true, 'lr-legend-visibility-change-request': true },
  'lr-polar-area-chart': { 'lr-before-datum-visibility-change': true, 'lr-before-legend-visibility-change': true, 'lr-datum-visibility-change-request': true, 'lr-legend-visibility-change-request': true },
  'lr-popover': { 'lr-hide': true, 'lr-show': true },
  'lr-prompt-input': { 'lr-attachment-preview-request': true },
  'lr-prompt-studio': { 'lr-change': true, 'lr-message-reorder': true },
  'lr-radar-chart': { 'lr-before-datum-visibility-change': true, 'lr-before-legend-visibility-change': true, 'lr-datum-visibility-change-request': true, 'lr-legend-visibility-change-request': true },
  'lr-radio': { 'lr-invalid': true },
  'lr-radio-button': { 'lr-invalid': true },
  'lr-radio-group': { 'lr-invalid': true },
  'lr-rating': { 'lr-invalid': true },
  'lr-reorder-list': { 'lr-reorder': true },
  'lr-responsive-panel': { 'lr-close': true },
  'lr-rubric-form': { 'lr-invalid': true },
  'lr-scatter-chart': { 'lr-before-datum-visibility-change': true, 'lr-before-legend-visibility-change': true, 'lr-datum-visibility-change-request': true, 'lr-legend-visibility-change-request': true },
  'lr-select': { 'lr-hide': true, 'lr-invalid': true, 'lr-show': true },
  'lr-slider': { 'lr-invalid': true },
  'lr-split-panel': { 'lr-reposition-request': true },
  'lr-switch': { 'lr-invalid': true, 'lr-switch-toggle-request': true },
  'lr-table': { 'lr-column-resize': true, 'lr-retry': true, 'lr-row-expand-request': true, 'lr-sort-request': true },
  'lr-terminal': { 'lr-download': true },
  'lr-textarea': { 'lr-invalid': true },
  'lr-thinking-panel': { 'lr-toggle-request': true },
  'lr-thread-list': { 'lr-group-toggle-request': true, 'lr-retry': true },
  'lr-time-input': { 'lr-hide': true, 'lr-invalid': true, 'lr-show': true },
  'lr-time-range': { 'lr-invalid': true },
  'lr-toast-item': { 'lr-hide': true, 'lr-show': true },
  'lr-toggle': { 'lr-toggle-toggle-request': true },
  'lr-toggle-group': { 'lr-toggle-group-toggle-request': true },
  'lr-token-input': { 'lr-add': true, 'lr-invalid': true, 'lr-remove': true, 'lr-token-edit': true },
  'lr-tool-approval-dialog': { 'lr-approve': true, 'lr-deny': true },
  'lr-tool-param-form': { 'lr-invalid': true },
  'lr-tool-result-dialog': { 'lr-maximize-change': true },
  'lr-tool-select-dialog': { 'lr-change': true },
  'lr-tool-timeline': { 'lr-tool-approval-decide': true },
  'lr-tooltip': { 'lr-hide': true, 'lr-show': true },
  'lr-tour': { 'lr-tour-end': true, 'lr-tour-step-change': true },
  'lr-voice-picker': { 'lr-invalid': true, 'lr-preview-request': true },
  'lr-widget': { 'lr-collapse-request': true, 'lr-fullscreen-request': true, 'lr-view-request': true },
};
