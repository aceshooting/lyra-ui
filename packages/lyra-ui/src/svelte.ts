// GENERATED FILE — do not edit by hand. Opt-in Svelte 5 custom-element declarations.
// Regenerate with `pnpm --filter @aceshooting/lyra-ui run framework-types`.
// This module contains types only; its emitted JavaScript is an empty module.
import type { HTMLAttributes } from 'svelte/elements';
import type { LyraGlobalEventMap } from './events.js';
import type { LyraActivityFeed, LyraActivityFeedEventMap } from './components/agent-tools/activity-feed/activity-feed.class.js';
import type { LyraAgentEvalDashboard, LyraAgentEvalDashboardEventMap } from './components/agent-tools/agent-eval-dashboard/agent-eval-dashboard.class.js';
import type { LyraAgentRun, LyraAgentRunEventMap } from './components/agent-tools/agent-run/agent-run.class.js';
import type { LyraAgentTrace, LyraAgentTraceEventMap } from './components/agent-tools/agent-trace/agent-trace.class.js';
import type { LyraApprovalQueue, LyraApprovalQueueEventMap } from './components/agent-tools/approval-queue/approval-queue.class.js';
import type { LyraArtifactPanel, LyraArtifactPanelEventMap } from './components/agent-tools/artifact-panel/artifact-panel.class.js';
import type { LyraBrowserFrame, LyraBrowserFrameEventMap } from './components/agent-tools/browser-frame/browser-frame.class.js';
import type { LyraCommitCard, LyraCommitCardEventMap } from './components/agent-tools/commit-card/commit-card.class.js';
import type { LyraComparePanel, LyraComparePanelEventMap } from './components/agent-tools/compare-panel/compare-panel.class.js';
import type { LyraConfirmBar, LyraConfirmBarEventMap } from './components/agent-tools/confirm-bar/confirm-bar.class.js';
import type { LyraContextInspector, LyraContextInspectorEventMap } from './components/agent-tools/context-inspector/context-inspector.class.js';
import type { LyraEvalDataset, LyraEvalDatasetEventMap } from './components/agent-tools/eval-dataset/eval-dataset.class.js';
import type { LyraEvalResult, LyraEvalResultEventMap } from './components/agent-tools/eval-result/eval-result.class.js';
import type { LyraEvaluationRun, LyraEvaluationRunEventMap } from './components/agent-tools/evaluation-run/evaluation-run.class.js';
import type { LyraMcpApp, LyraMcpAppEventMap } from './components/agent-tools/mcp-app/mcp-app.class.js';
import type { LyraPolicySummary } from './components/agent-tools/policy-summary/policy-summary.class.js';
import type { LyraPromptStudio, LyraPromptStudioEventMap } from './components/agent-tools/prompt-studio/prompt-studio.class.js';
import type { LyraResultCard } from './components/agent-tools/result-card/result-card.class.js';
import type { LyraResultField } from './components/agent-tools/result-card/result-field.class.js';
import type { LyraSchemaViewer, LyraSchemaViewerEventMap } from './components/agent-tools/schema-viewer/schema-viewer.class.js';
import type { LyraSpanWaterfall, LyraSpanWaterfallEventMap } from './components/agent-tools/span-waterfall/span-waterfall.class.js';
import type { LyraStackTrace, LyraStackTraceEventMap } from './components/agent-tools/stack-trace/stack-trace.class.js';
import type { LyraSubagentPanel, LyraSubagentPanelEventMap } from './components/agent-tools/subagent-panel/subagent-panel.class.js';
import type { LyraTaskList, LyraTaskListEventMap } from './components/agent-tools/task-list/task-list.class.js';
import type { LyraTerminal, LyraTerminalEventMap } from './components/agent-tools/terminal/terminal.class.js';
import type { LyraTestResults, LyraTestResultsEventMap } from './components/agent-tools/test-results/test-results.class.js';
import type { LyraThinkingPanel, LyraThinkingPanelEventMap } from './components/agent-tools/thinking-panel/thinking-panel.class.js';
import type { LyraToolApprovalDialog, LyraToolApprovalDialogEventMap } from './components/agent-tools/tool-approval-dialog/tool-approval-dialog.class.js';
import type { LyraToolCallChip, LyraToolCallChipEventMap } from './components/agent-tools/tool-call-chip/tool-call-chip.class.js';
import type { LyraToolParamForm, LyraToolParamFormEventMap } from './components/agent-tools/tool-param-form/tool-param-form.class.js';
import type { LyraToolResultDialog, LyraToolResultDialogEventMap } from './components/agent-tools/tool-result-dialog/tool-result-dialog.class.js';
import type { LyraToolResultView, LyraToolResultViewEventMap } from './components/agent-tools/tool-result-view/tool-result-view.class.js';
import type { LyraToolSelectDialog, LyraToolSelectDialogEventMap } from './components/agent-tools/tool-select-dialog/tool-select-dialog.class.js';
import type { LyraToolTimeline, LyraToolTimelineEventMap } from './components/agent-tools/tool-timeline/tool-timeline.class.js';
import type { LyraTraceTree, LyraTraceTreeEventMap } from './components/agent-tools/trace-tree/trace-tree.class.js';
import type { LyraBarChart } from './components/charts/chart/bar-chart.class.js';
import type { LyraBoxPlot, LyraBoxPlotEventMap } from './components/charts/chart/box-plot.class.js';
import type { LyraBubbleChart } from './components/charts/chart/bubble-chart.class.js';
import type { LyraChart, LyraChartEventMap } from './components/charts/chart/chart.class.js';
import type { LyraDoughnutChart } from './components/charts/chart/doughnut-chart.class.js';
import type { LyraHistogram } from './components/charts/chart/histogram.class.js';
import type { LyraLineChart } from './components/charts/chart/line-chart.class.js';
import type { LyraLiteChart, LyraLiteChartEventMap } from './components/charts/chart/lite-chart.class.js';
import type { LyraPieChart } from './components/charts/chart/pie-chart.class.js';
import type { LyraPolarAreaChart } from './components/charts/chart/polar-area-chart.class.js';
import type { LyraRadarChart } from './components/charts/chart/radar-chart.class.js';
import type { LyraScatterChart } from './components/charts/chart/scatter-chart.class.js';
import type { LyraAgentWorkspace, LyraAgentWorkspaceEventMap } from './components/conversation/agent-workspace/agent-workspace.class.js';
import type { LyraAudioVisualizer } from './components/conversation/audio-visualizer/audio-visualizer.class.js';
import type { LyraBranchPicker, LyraBranchPickerEventMap } from './components/conversation/branch-picker/branch-picker.class.js';
import type { LyraChatComposer, LyraChatComposerEventMap } from './components/conversation/chat-composer/chat-composer.class.js';
import type { LyraChatMessage, LyraChatMessageEventMap } from './components/conversation/chat-message/chat-message.class.js';
import type { LyraChatViewport, LyraChatViewportEventMap } from './components/conversation/chat-viewport/chat-viewport.class.js';
import type { LyraCheckpoint, LyraCheckpointEventMap } from './components/conversation/checkpoint/checkpoint.class.js';
import type { LyraCodeBlockCore, LyraCodeBlockCoreEventMap } from './components/conversation/code-block/code-block-core.class.js';
import type { LyraCodeBlock, LyraCodeBlockEventMap } from './components/conversation/code-block/code-block.class.js';
import type { LyraConversationItem, LyraConversationItemEventMap } from './components/conversation/conversation-item/conversation-item.class.js';
import type { LyraGenerationStatus, LyraGenerationStatusEventMap } from './components/conversation/generation-status/generation-status.class.js';
import type { LyraHandoffDivider } from './components/conversation/handoff-divider/handoff-divider.class.js';
import type { LyraMarkdownCore, LyraMarkdownCoreEventMap } from './components/conversation/markdown/markdown-core.class.js';
import type { LyraMarkdown, LyraMarkdownEventMap } from './components/conversation/markdown/markdown.class.js';
import type { LyraMessageActions, LyraMessageActionsEventMap } from './components/conversation/message-actions/message-actions.class.js';
import type { LyraMessageFeedback, LyraMessageFeedbackEventMap } from './components/conversation/message-feedback/message-feedback.class.js';
import type { LyraMessageParts, LyraMessagePartsEventMap } from './components/conversation/message-parts/message-parts.class.js';
import type { LyraModelSelect, LyraModelSelectEventMap } from './components/conversation/model-select/model-select.class.js';
import type { LyraModelSettingsPanel, LyraModelSettingsPanelEventMap } from './components/conversation/model-settings-panel/model-settings-panel.class.js';
import type { LyraPromptInput, LyraPromptInputEventMap } from './components/conversation/prompt-input/prompt-input.class.js';
import type { LyraPromptQueue, LyraPromptQueueEventMap } from './components/conversation/prompt-queue/prompt-queue.class.js';
import type { LyraPushToTalk, LyraPushToTalkEventMap } from './components/conversation/push-to-talk/push-to-talk.class.js';
import type { LyraRealtimeSession, LyraRealtimeSessionEventMap } from './components/conversation/realtime-session/realtime-session.class.js';
import type { LyraSelectionToolbar, LyraSelectionToolbarEventMap } from './components/conversation/selection-toolbar/selection-toolbar.class.js';
import type { LyraStreamStatus, LyraStreamStatusEventMap } from './components/conversation/stream-status/stream-status.class.js';
import type { LyraStreamingText } from './components/conversation/streaming-text/streaming-text.class.js';
import type { LyraSuggestionChips, LyraSuggestionChipsEventMap } from './components/conversation/suggestion-chips/suggestion-chips.class.js';
import type { LyraThreadList, LyraThreadListEventMap } from './components/conversation/thread-list/thread-list.class.js';
import type { LyraTranscriptFeed, LyraTranscriptFeedEventMap } from './components/conversation/transcript-feed/transcript-feed.class.js';
import type { LyraTypingIndicator } from './components/conversation/typing-indicator/typing-indicator.class.js';
import type { LyraUsageBadge } from './components/conversation/usage-badge/usage-badge.class.js';
import type { LyraVoicePicker, LyraVoicePickerEventMap } from './components/conversation/voice-picker/voice-picker.class.js';
import type { LyraWidgetRenderer, LyraWidgetRendererEventMap } from './components/conversation/widget-renderer/widget-renderer.class.js';
import type { LyraCalendar, LyraCalendarEventMap } from './components/data/calendar/calendar.class.js';
import type { LyraContextMeter } from './components/data/context-meter/context-meter.class.js';
import type { LyraDataGrid, LyraDataGridEventMap } from './components/data/data-grid/data-grid.class.js';
import type { LyraDocumentLibrary, LyraDocumentLibraryEventMap } from './components/data/document-library/document-library.class.js';
import type { LyraEnvList, LyraEnvListEventMap } from './components/data/env-list/env-list.class.js';
import type { LyraFileTree, LyraFileTreeEventMap } from './components/data/file-tree/file-tree.class.js';
import type { LyraFlowCanvas, LyraFlowCanvasEventMap } from './components/data/flow-canvas/flow-canvas.class.js';
import type { LyraFlowControls } from './components/data/flow-controls/flow-controls.class.js';
import type { LyraFlowMinimap } from './components/data/flow-minimap/flow-minimap.class.js';
import type { LyraFlowNode } from './components/data/flow-node/flow-node.class.js';
import type { LyraFlowRunOverlay } from './components/data/flow-run-overlay/flow-run-overlay.class.js';
import type { LyraGauge } from './components/data/gauge/gauge.class.js';
import type { LyraGraphQueryBuilder, LyraGraphQueryBuilderEventMap } from './components/data/graph-query-builder/graph-query-builder.class.js';
import type { LyraHeatmap, LyraHeatmapEventMap } from './components/data/heatmap/heatmap.class.js';
import type { LyraPagination, LyraPaginationEventMap } from './components/data/pagination/pagination.class.js';
import type { LyraQueryBuilder, LyraQueryBuilderEventMap } from './components/data/query-builder/query-builder.class.js';
import type { LyraSequenceStrip } from './components/data/sequence-strip/sequence-strip.class.js';
import type { LyraSparkline } from './components/data/sparkline/sparkline.class.js';
import type { LyraStat } from './components/data/stat/stat.class.js';
import type { LyraTable, LyraTableEventMap } from './components/data/table/table.class.js';
import type { LyraTimelineItem } from './components/data/timeline/timeline-item.class.js';
import type { LyraTimeline } from './components/data/timeline/timeline.class.js';
import type { LyraTreeItem, LyraTreeItemEventMap } from './components/data/tree/tree-item.class.js';
import type { LyraTree, LyraTreeEventMap } from './components/data/tree/tree.class.js';
import type { LyraWordCloud, LyraWordCloudEventMap } from './components/data/word-cloud/word-cloud.class.js';
import type { LyraButton, LyraButtonEventMap } from './components/forms/button/button.class.js';
import type { LyraCheckboxGroup, LyraCheckboxGroupEventMap } from './components/forms/checkbox-group/checkbox-group.class.js';
import type { LyraCheckbox, LyraCheckboxEventMap } from './components/forms/checkbox/checkbox.class.js';
import type { LyraCodeEditor, LyraCodeEditorEventMap } from './components/forms/code-editor/code-editor.class.js';
import type { LyraColorPicker, LyraColorPickerEventMap } from './components/forms/color-picker/color-picker.class.js';
import type { LyraCombobox, LyraComboboxEventMap } from './components/forms/combobox/combobox.class.js';
import type { LyraOption, LyraOptionEventMap } from './components/forms/combobox/option.class.js';
import type { LyraDateInput, LyraDateInputEventMap } from './components/forms/date-picker/date-input.class.js';
import type { LyraDatePicker, LyraDatePickerEventMap } from './components/forms/date-picker/date-picker.class.js';
import type { LyraEmojiPicker, LyraEmojiPickerEventMap } from './components/forms/emoji-picker/emoji-picker.class.js';
import type { LyraIconButton, LyraIconButtonEventMap } from './components/forms/icon-button/icon-button.class.js';
import type { LyraInput, LyraInputEventMap } from './components/forms/input/input.class.js';
import type { LyraNativeTimeInput } from './components/forms/input/native-time-input.class.js';
import type { LyraNumberInput, LyraNumberInputEventMap } from './components/forms/input/number-input.class.js';
import type { LyraTimeInput, LyraTimeInputEventMap } from './components/forms/input/time-input.class.js';
import type { LyraLocalePicker, LyraLocalePickerEventMap } from './components/forms/locale-picker/locale-picker.class.js';
import type { LyraOtpInput, LyraOtpInputEventMap } from './components/forms/otp-input/otp-input.class.js';
import type { LyraPhoneInput, LyraPhoneInputEventMap } from './components/forms/phone-input/phone-input.class.js';
import type { LyraRadioButton } from './components/forms/radio/radio-button.class.js';
import type { LyraRadioGroup, LyraRadioGroupEventMap } from './components/forms/radio/radio-group.class.js';
import type { LyraRadio, LyraRadioEventMap } from './components/forms/radio/radio.class.js';
import type { LyraRubricForm, LyraRubricFormEventMap } from './components/forms/rubric-form/rubric-form.class.js';
import type { LyraSelect, LyraSelectEventMap } from './components/forms/select/select.class.js';
import type { LyraSlider, LyraSliderEventMap } from './components/forms/slider/slider.class.js';
import type { LyraSwatchPicker, LyraSwatchPickerEventMap } from './components/forms/swatch-picker/swatch-picker.class.js';
import type { LyraSwitch, LyraSwitchEventMap } from './components/forms/switch/switch.class.js';
import type { LyraTextarea, LyraTextareaEventMap } from './components/forms/textarea/textarea.class.js';
import type { LyraTimeRange, LyraTimeRangeEventMap } from './components/forms/time-range/time-range.class.js';
import type { LyraTokenInput, LyraTokenInputEventMap } from './components/forms/token-input/token-input.class.js';
import type { LyraAppRailItem } from './components/layout/app-rail/app-rail-item.class.js';
import type { LyraAppRail, LyraAppRailEventMap } from './components/layout/app-rail/app-rail.class.js';
import type { LyraBreadcrumbItem } from './components/layout/breadcrumb/breadcrumb-item.class.js';
import type { LyraBreadcrumb } from './components/layout/breadcrumb/breadcrumb.class.js';
import type { LyraButtonGroup } from './components/layout/button-group/button-group.class.js';
import type { LyraCard, LyraCardEventMap } from './components/layout/card/card.class.js';
import type { LyraCarouselItem } from './components/layout/carousel/carousel-item.class.js';
import type { LyraCarousel, LyraCarouselEventMap } from './components/layout/carousel/carousel.class.js';
import type { LyraCommandPalette, LyraCommandPaletteEventMap } from './components/layout/command-palette/command-palette.class.js';
import type { LyraControlGroup } from './components/layout/control-group/control-group.class.js';
import type { LyraDashboardGrid, LyraDashboardGridEventMap } from './components/layout/dashboard-grid/dashboard-grid.class.js';
import type { LyraAccordionItem } from './components/layout/details/accordion-item.class.js';
import type { LyraAccordion, LyraAccordionEventMap } from './components/layout/details/accordion.class.js';
import type { LyraDetails, LyraDetailsEventMap } from './components/layout/details/details.class.js';
import type { LyraDockPanel, LyraDockPanelEventMap } from './components/layout/dock-panel/dock-panel.class.js';
import type { LyraDrilldownPanel, LyraDrilldownPanelEventMap } from './components/layout/drilldown-panel/drilldown-panel.class.js';
import type { LyraFilterBar, LyraFilterBarEventMap } from './components/layout/filter-bar/filter-bar.class.js';
import type { LyraDropdownItem, LyraDropdownItemEventMap } from './components/layout/menu/dropdown-item.class.js';
import type { LyraMenuItem, LyraMenuItemEventMap } from './components/layout/menu/menu-item.class.js';
import type { LyraMenuLabel } from './components/layout/menu/menu-label.class.js';
import type { LyraMenu, LyraMenuEventMap } from './components/layout/menu/menu.class.js';
import type { LyraPage, LyraPageEventMap } from './components/layout/page/page.class.js';
import type { LyraReorderItem, LyraReorderItemEventMap } from './components/layout/reorder-list/reorder-item.class.js';
import type { LyraReorderList, LyraReorderListEventMap } from './components/layout/reorder-list/reorder-list.class.js';
import type { LyraResponsivePanel, LyraResponsivePanelEventMap } from './components/layout/responsive-panel/responsive-panel.class.js';
import type { LyraScroller, LyraScrollerEventMap } from './components/layout/scroller/scroller.class.js';
import type { LyraSegmented, LyraSegmentedEventMap } from './components/layout/segmented/segmented.class.js';
import type { LyraSplitPanel, LyraSplitPanelEventMap } from './components/layout/split-panel/split-panel.class.js';
import type { LyraSplit, LyraSplitEventMap } from './components/layout/split/split.class.js';
import type { LyraStepper, LyraStepperEventMap } from './components/layout/stepper/stepper.class.js';
import type { LyraTabGroup, LyraTabGroupEventMap } from './components/layout/tab-group/tab-group.class.js';
import type { LyraTabPanel } from './components/layout/tab-group/tab-panel.class.js';
import type { LyraTab, LyraTabEventMap } from './components/layout/tab-group/tab.class.js';
import type { LyraVirtualList, LyraVirtualListEventMap } from './components/layout/virtual-list/virtual-list.class.js';
import type { LyraWidget, LyraWidgetEventMap } from './components/layout/widget/widget.class.js';
import type { LyraAnimatedImage, LyraAnimatedImageEventMap } from './components/media/animated-image/animated-image.class.js';
import type { LyraAnimation, LyraAnimationEventMap } from './components/media/animation/animation.class.js';
import type { LyraAttachmentChip, LyraAttachmentChipEventMap } from './components/media/attachment-chip/attachment-chip.class.js';
import type { LyraAttachmentTrigger, LyraAttachmentTriggerEventMap } from './components/media/attachment-trigger/attachment-trigger.class.js';
import type { LyraAvPlayer, LyraAvPlayerEventMap } from './components/media/av-player/av-player.class.js';
import type { LyraAvatarGroup, LyraAvatarGroupEventMap } from './components/media/avatar-group/avatar-group.class.js';
import type { LyraAvatar, LyraAvatarEventMap } from './components/media/avatar/avatar.class.js';
import type { LyraFileIcon } from './components/media/file-icon/file-icon.class.js';
import type { LyraFileInput, LyraFileInputEventMap } from './components/media/file-input/file-input.class.js';
import type { LyraFlag } from './components/media/flag/flag.class.js';
import type { LyraImageComparer, LyraImageComparerEventMap } from './components/media/image-comparer/image-comparer.class.js';
import type { LyraImageViewer, LyraImageViewerEventMap } from './components/media/image-viewer/image-viewer.class.js';
import type { LyraLightbox, LyraLightboxEventMap } from './components/media/lightbox/lightbox.class.js';
import type { LyraMap, LyraMapEventMap } from './components/media/map/map.class.js';
import type { LyraMediaCard, LyraMediaCardEventMap } from './components/media/media-card/media-card.class.js';
import type { LyraPanZoom, LyraPanZoomEventMap } from './components/media/pan-zoom/pan-zoom.class.js';
import type { LyraPlayback, LyraPlaybackEventMap } from './components/media/playback/playback.class.js';
import type { LyraQrCode } from './components/media/qr-code/qr-code.class.js';
import type { LyraVideoPlaylist, LyraVideoPlaylistEventMap } from './components/media/video-playlist/video-playlist.class.js';
import type { LyraVideo, LyraVideoEventMap } from './components/media/video/video.class.js';
import type { LyraZoomableFrame, LyraZoomableFrameEventMap } from './components/media/zoomable-frame/zoomable-frame.class.js';
import type { LyraAlert, LyraAlertEventMap } from './components/overlays/alert/alert.class.js';
import type { LyraBadge } from './components/overlays/badge/badge.class.js';
import type { LyraTag, LyraTagEventMap } from './components/overlays/badge/tag.class.js';
import type { LyraCallout, LyraCalloutEventMap } from './components/overlays/callout/callout.class.js';
import type { LyraChipGroup, LyraChipGroupEventMap } from './components/overlays/chip/chip-group.class.js';
import type { LyraChip, LyraChipEventMap } from './components/overlays/chip/chip.class.js';
import type { LyraDialog, LyraDialogEventMap } from './components/overlays/dialog/dialog.class.js';
import type { LyraDrawer } from './components/overlays/drawer/drawer.class.js';
import type { LyraEmpty } from './components/overlays/empty/empty.class.js';
import type { LyraKbd } from './components/overlays/kbd/kbd.class.js';
import type { LyraDropdown, LyraDropdownEventMap } from './components/overlays/overlay/dropdown.class.js';
import type { LyraPopover, LyraPopoverEventMap } from './components/overlays/overlay/popover.class.js';
import type { LyraTooltip, LyraTooltipEventMap } from './components/overlays/overlay/tooltip.class.js';
import type { LyraPopup, LyraPopupEventMap } from './components/overlays/popup/popup.class.js';
import type { LyraProgressBar } from './components/overlays/progress/progress-bar.class.js';
import type { LyraProgressRing } from './components/overlays/progress/progress-ring.class.js';
import type { LyraRating, LyraRatingEventMap } from './components/overlays/rating/rating.class.js';
import type { LyraSkeleton } from './components/overlays/skeleton/skeleton.class.js';
import type { LyraSpinner } from './components/overlays/spinner/spinner.class.js';
import type { LyraToastItem, LyraToastItemEventMap } from './components/overlays/toast/toast-item.class.js';
import type { LyraToast, LyraToastEventMap } from './components/overlays/toast/toast.class.js';
import type { LyraChunkInspector, LyraChunkInspectorEventMap } from './components/retrieval/chunk-inspector/chunk-inspector.class.js';
import type { LyraCitationBadge, LyraCitationBadgeEventMap } from './components/retrieval/citation-badge/citation-badge.class.js';
import type { LyraClaimEvidence, LyraClaimEvidenceEventMap } from './components/retrieval/claim-evidence/claim-evidence.class.js';
import type { LyraCommunityCard, LyraCommunityCardEventMap } from './components/retrieval/community-card/community-card.class.js';
import type { LyraEmbeddingExplorer, LyraEmbeddingExplorerEventMap } from './components/retrieval/embedding-explorer/embedding-explorer.class.js';
import type { LyraEntityCard, LyraEntityCardEventMap } from './components/retrieval/entity-card/entity-card.class.js';
import type { LyraEntityChip, LyraEntityChipEventMap } from './components/retrieval/entity-chip/entity-chip.class.js';
import type { LyraEntityDossier, LyraEntityDossierEventMap } from './components/retrieval/entity-dossier/entity-dossier.class.js';
import type { LyraGraphLegend, LyraGraphLegendEventMap } from './components/retrieval/graph-legend/graph-legend.class.js';
import type { LyraGraph, LyraGraphEventMap } from './components/retrieval/graph/graph.class.js';
import type { LyraGroundingSummary, LyraGroundingSummaryEventMap } from './components/retrieval/grounding-summary/grounding-summary.class.js';
import type { LyraIngestionQueue, LyraIngestionQueueEventMap } from './components/retrieval/ingestion-queue/ingestion-queue.class.js';
import type { LyraKnowledgeBaseAdmin, LyraKnowledgeBaseAdminEventMap } from './components/retrieval/knowledge-base-admin/knowledge-base-admin.class.js';
import type { LyraKnowledgeBase, LyraKnowledgeBaseEventMap } from './components/retrieval/knowledge-base/knowledge-base.class.js';
import type { LyraKnowledgeGraphExplorer, LyraKnowledgeGraphExplorerEventMap } from './components/retrieval/knowledge-graph-explorer/knowledge-graph-explorer.class.js';
import type { LyraMemoryPanel, LyraMemoryPanelEventMap } from './components/retrieval/memory-panel/memory-panel.class.js';
import type { LyraMindMap, LyraMindMapEventMap } from './components/retrieval/mind-map/mind-map.class.js';
import type { LyraNeighborList, LyraNeighborListEventMap } from './components/retrieval/neighbor-list/neighbor-list.class.js';
import type { LyraNodePalette, LyraNodePaletteEventMap } from './components/retrieval/node-palette/node-palette.class.js';
import type { LyraPathStrip, LyraPathStripEventMap } from './components/retrieval/path-strip/path-strip.class.js';
import type { LyraProvenancePanel, LyraProvenancePanelEventMap } from './components/retrieval/provenance-panel/provenance-panel.class.js';
import type { LyraRagAnswer, LyraRagAnswerEventMap } from './components/retrieval/rag-answer/rag-answer.class.js';
import type { LyraRagEvalDashboard, LyraRagEvalDashboardEventMap } from './components/retrieval/rag-eval-dashboard/rag-eval-dashboard.class.js';
import type { LyraRetrievalCompare, LyraRetrievalCompareEventMap } from './components/retrieval/retrieval-compare/retrieval-compare.class.js';
import type { LyraRetrievalResults, LyraRetrievalResultsEventMap } from './components/retrieval/retrieval-results/retrieval-results.class.js';
import type { LyraRetrievalSearch, LyraRetrievalSearchEventMap } from './components/retrieval/retrieval-search/retrieval-search.class.js';
import type { LyraRetrievalTrace, LyraRetrievalTraceEventMap } from './components/retrieval/retrieval-trace/retrieval-trace.class.js';
import type { LyraSourceCard, LyraSourceCardEventMap } from './components/retrieval/source-card/source-card.class.js';
import type { LyraSourceList, LyraSourceListEventMap } from './components/retrieval/source-list/source-list.class.js';
import type { LyraSourcePicker, LyraSourcePickerEventMap } from './components/retrieval/source-picker/source-picker.class.js';
import type { LyraCopyButton, LyraCopyButtonEventMap } from './components/utility/copy-button/copy-button.class.js';
import type { LyraDiffView, LyraDiffViewEventMap } from './components/utility/diff-view/diff-view.class.js';
import type { LyraDivider } from './components/utility/divider/divider.class.js';
import type { LyraExportButton, LyraExportButtonEventMap } from './components/utility/export-button/export-button.class.js';
import type { LyraFormatBytes } from './components/utility/format/format-bytes.class.js';
import type { LyraFormatDate } from './components/utility/format/format-date.class.js';
import type { LyraFormatNumber } from './components/utility/format/format-number.class.js';
import type { LyraRelativeTime } from './components/utility/format/relative-time.class.js';
import type { LyraIcon, LyraIconEventMap } from './components/utility/icon/icon.class.js';
import type { LyraIntersectionObserver, LyraIntersectionObserverEventMap } from './components/utility/intersection-observer/intersection-observer.class.js';
import type { LyraJsonViewer, LyraJsonViewerEventMap } from './components/utility/json-viewer/json-viewer.class.js';
import type { LyraKnownDate, LyraKnownDateEventMap } from './components/utility/known-date/known-date.class.js';
import type { LyraLiveRegion } from './components/utility/live-region/live-region.class.js';
import type { LyraMentionPopover, LyraMentionPopoverEventMap } from './components/utility/mention-popover/mention-popover.class.js';
import type { LyraMutationObserver, LyraMutationObserverEventMap } from './components/utility/mutation-observer/mutation-observer.class.js';
import type { LyraPollStatus, LyraPollStatusEventMap } from './components/utility/poll-status/poll-status.class.js';
import type { LyraRandomContent, LyraRandomContentEventMap } from './components/utility/random-content/random-content.class.js';
import type { LyraResizeObserver, LyraResizeObserverEventMap } from './components/utility/resize-observer/resize-observer.class.js';
import type { LyraTour, LyraTourEventMap } from './components/utility/tour/tour.class.js';
import type { LyraVisuallyHidden } from './components/utility/visually-hidden/visually-hidden.class.js';
import type { LyraArchiveViewer, LyraArchiveViewerEventMap } from './components/viewers/archive-viewer/archive-viewer.class.js';
import type { LyraCalendarViewer, LyraCalendarViewerEventMap } from './components/viewers/calendar-viewer/calendar-viewer.class.js';
import type { LyraContactViewer, LyraContactViewerEventMap } from './components/viewers/contact-viewer/contact-viewer.class.js';
import type { LyraCsvViewer, LyraCsvViewerEventMap } from './components/viewers/csv-viewer/csv-viewer.class.js';
import type { LyraDatasetViewer, LyraDatasetViewerEventMap } from './components/viewers/dataset-viewer/dataset-viewer.class.js';
import type { LyraDocumentCompare, LyraDocumentCompareEventMap } from './components/viewers/document-compare/document-compare.class.js';
import type { LyraDocumentPreview, LyraDocumentPreviewEventMap } from './components/viewers/document-preview/document-preview.class.js';
import type { LyraDocumentViewer, LyraDocumentViewerEventMap } from './components/viewers/document-viewer/document-viewer.class.js';
import type { LyraDocxViewer, LyraDocxViewerEventMap } from './components/viewers/docx-viewer/docx-viewer.class.js';
import type { LyraEbookViewer, LyraEbookViewerEventMap } from './components/viewers/ebook-viewer/ebook-viewer.class.js';
import type { LyraEmailViewer, LyraEmailViewerEventMap } from './components/viewers/email-viewer/email-viewer.class.js';
import type { LyraGeojsonView, LyraGeojsonViewEventMap } from './components/viewers/geojson-view/geojson-view.class.js';
import type { LyraHighlightLayer, LyraHighlightLayerEventMap } from './components/viewers/highlight-layer/highlight-layer.class.js';
import type { LyraHtmlViewer, LyraHtmlViewerEventMap } from './components/viewers/html-viewer/html-viewer.class.js';
import type { LyraInclude, LyraIncludeEventMap } from './components/viewers/include/include.class.js';
import type { LyraNotebookViewer, LyraNotebookViewerEventMap } from './components/viewers/notebook-viewer/notebook-viewer.class.js';
import type { LyraPageRail, LyraPageRailEventMap } from './components/viewers/page-rail/page-rail.class.js';
import type { LyraPdfViewer, LyraPdfViewerEventMap } from './components/viewers/pdf-viewer/pdf-viewer.class.js';
import type { LyraPptxViewer, LyraPptxViewerEventMap } from './components/viewers/pptx-viewer/pptx-viewer.class.js';
import type { LyraSpreadsheetViewer, LyraSpreadsheetViewerEventMap } from './components/viewers/spreadsheet-viewer/spreadsheet-viewer.class.js';
import type { LyraSvgViewer, LyraSvgViewerEventMap } from './components/viewers/svg-viewer/svg-viewer.class.js';
import type { LyraXmlViewer, LyraXmlViewerEventMap } from './components/viewers/xml-viewer/xml-viewer.class.js';

export type LyraUnknownAttributeValue = string | number | boolean | null | undefined;

type LyraFallbackEvent<Name extends string> = Name extends keyof LyraGlobalEventMap
  ? LyraGlobalEventMap[Name]
  : Name extends keyof HTMLElementEventMap
    ? HTMLElementEventMap[Name]
    : Event;

type LyraEventFor<
  ElementEvents extends object,
  Name extends string,
> = Name extends keyof ElementEvents
  ? ElementEvents[Name] extends Event
    ? ElementEvents[Name]
    : LyraFallbackEvent<Name>
  : LyraFallbackEvent<Name>;

type LyraBoundEvent<
  ElementType extends HTMLElement,
  ElementEvents extends object,
  Name extends string,
> = LyraEventFor<ElementEvents, Name> & { readonly currentTarget: ElementType };

export type LyraCSSCustomProperties<Names extends string> = Partial<
  Record<Names, string | number>
>;

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
  ElementType extends HTMLElement,
  PropertyNames extends keyof ElementType,
  ElementEvents extends object,
  EventNames extends string,
  CSSNames extends string,
  AttributeAliases extends object,
> = Omit<
  HTMLAttributes<ElementType>,
  PropertyNames | keyof AttributeAliases | keyof LyraSvelteEventProps<ElementType, ElementEvents, EventNames>
> &
  Partial<Pick<ElementType, PropertyNames>> &
  AttributeAliases &
  LyraSvelteEventProps<ElementType, ElementEvents, EventNames> &
  LyraSvelteStyleProps<CSSNames>;

export type LyraAccordionSvelteProps = LyraSvelteElementProps<
  LyraAccordion,
  | 'appearance'
  | 'headingLevel'
  | 'iconPlacement'
  | 'locale'
  | 'mode'
  | 'multiple'
  | 'strings',
  LyraAccordionEventMap,
  | 'lr-after-collapse'
  | 'lr-after-expand'
  | 'lr-collapse'
  | 'lr-expand',
  | '--lr-accordion-filled-bg'
  | '--lr-accordion-filled-border-color'
  | '--lr-accordion-filled-outlined-bg'
  | '--lr-accordion-filled-outlined-border-color'
  | '--lr-accordion-outlined-bg'
  | '--lr-accordion-outlined-border-color',
  {
    'heading-level'?: LyraAccordion['headingLevel'];
    'icon-placement'?: LyraAccordion['iconPlacement'];
  }
>;

export type LyraAccordionItemSvelteProps = LyraSvelteElementProps<
  LyraAccordionItem,
  | 'appearance'
  | 'disabled'
  | 'expanded'
  | 'headingLevel'
  | 'iconPlacement'
  | 'label'
  | 'locale'
  | 'name'
  | 'open'
  | 'size'
  | 'strings'
  | 'summary',
  LyraDetailsEventMap,
  | 'lr-after-hide'
  | 'lr-after-show'
  | 'lr-hide'
  | 'lr-show'
  | 'lr-toggle',
  | '--easing'
  | '--hide-duration'
  | '--lr-accordion-item-button-active-bg'
  | '--lr-accordion-item-button-hover-bg'
  | '--lr-accordion-item-easing'
  | '--lr-accordion-item-filled-bg'
  | '--lr-accordion-item-filled-outlined-bg'
  | '--lr-accordion-item-hide-duration'
  | '--lr-accordion-item-outlined-bg'
  | '--lr-accordion-item-show-duration'
  | '--lr-accordion-item-spacing'
  | '--lr-details-filled-bg'
  | '--lr-details-filled-border-color'
  | '--lr-details-filled-outlined-bg'
  | '--lr-details-filled-outlined-border-color'
  | '--lr-details-font-size'
  | '--lr-details-gap'
  | '--lr-details-outlined-bg'
  | '--lr-details-outlined-border-color'
  | '--lr-details-radius'
  | '--lr-details-spacing'
  | '--lr-details-summary-active-bg'
  | '--lr-details-summary-hover-bg'
  | '--show-duration'
  | '--spacing',
  {
    'heading-level'?: LyraAccordionItem['headingLevel'];
    'icon-placement'?: LyraAccordionItem['iconPlacement'];
  }
>;

export type LyraActivityFeedSvelteProps = LyraSvelteElementProps<
  LyraActivityFeed,
  | 'entries'
  | 'expanded'
  | 'follow'
  | 'formatTimestamp'
  | 'label'
  | 'locale'
  | 'mode'
  | 'renderText'
  | 'showTimestamps'
  | 'strings'
  | 'virtualizeAt',
  LyraActivityFeedEventMap,
  | 'lr-follow-change'
  | 'lr-toggle',
  | '--lr-activity-feed-live-status-color'
  | '--lr-activity-feed-max-height',
  {
    'show-timestamps'?: LyraActivityFeed['showTimestamps'];
    'virtualize-at'?: LyraActivityFeed['virtualizeAt'];
  }
>;

export type LyraAgentEvalDashboardSvelteProps = LyraSvelteElementProps<
  LyraAgentEvalDashboard,
  | 'chartHeight'
  | 'currency'
  | 'label'
  | 'locale'
  | 'metricId'
  | 'metrics'
  | 'runs'
  | 'showChart'
  | 'strings',
  LyraAgentEvalDashboardEventMap,
  | 'lr-metric-change'
  | 'lr-run-select',
  | '--lr-agent-eval-dashboard-active-background'
  | '--lr-agent-eval-dashboard-active-border',
  {
    'chart-height'?: LyraAgentEvalDashboard['chartHeight'];
    'metric-id'?: LyraAgentEvalDashboard['metricId'];
    'show-chart'?: LyraAgentEvalDashboard['showChart'];
  }
>;

export type LyraAgentRunSvelteProps = LyraSvelteElementProps<
  LyraAgentRun,
  | 'compact'
  | 'formatCost'
  | 'frame'
  | 'locale'
  | 'metrics'
  | 'run'
  | 'showCancel'
  | 'showRetry'
  | 'statusLabels'
  | 'statusVariants'
  | 'strings',
  LyraAgentRunEventMap,
  | 'lr-cancel'
  | 'lr-retry',
  | '--lr-agent-run-compact-gap'
  | '--lr-agent-run-compact-padding'
  | '--lr-agent-run-metric-danger-color'
  | '--lr-agent-run-metric-success-color'
  | '--lr-agent-run-metric-warning-color'
  | '--lr-agent-run-spin',
  {
    'show-cancel'?: LyraAgentRun['showCancel'];
    'show-retry'?: LyraAgentRun['showRetry'];
  }
>;

export type LyraAgentTraceSvelteProps = LyraSvelteElementProps<
  LyraAgentTrace,
  | 'activeSpanId'
  | 'hiddenKinds'
  | 'hideBars'
  | 'label'
  | 'locale'
  | 'showCost'
  | 'showTokens'
  | 'spans'
  | 'strings',
  LyraAgentTraceEventMap,
  | 'lr-span-select'
  | 'lr-span-toggle'
  | 'lr-visibility-change',
  | '--lr-agent-trace-handoff-active-bg',
  {
    'active-span-id'?: LyraAgentTrace['activeSpanId'];
    'hide-bars'?: LyraAgentTrace['hideBars'];
    'show-cost'?: LyraAgentTrace['showCost'];
    'show-tokens'?: LyraAgentTrace['showTokens'];
  }
>;

export type LyraAgentWorkspaceSvelteProps = LyraSvelteElementProps<
  LyraAgentWorkspace,
  | 'accessibleLabel'
  | 'citations'
  | 'composerMaxRows'
  | 'composerMinRows'
  | 'composerPlaceholder'
  | 'composerStatus'
  | 'composerValue'
  | 'contextSegments'
  | 'contextTotal'
  | 'follow'
  | 'groundingAssessment'
  | 'label'
  | 'locale'
  | 'messages'
  | 'metrics'
  | 'retrievalChunks'
  | 'retrievalError'
  | 'retrievalHasMore'
  | 'retrievalLoading'
  | 'run'
  | 'selectedRetrievalIds'
  | 'showComposer'
  | 'showDetails'
  | 'strings'
  | 'tools'
  | 'unreadStartIndex',
  LyraAgentWorkspaceEventMap,
  | 'lr-cancel'
  | 'lr-citation-select'
  | 'lr-follow-change'
  | 'lr-input'
  | 'lr-message-retry'
  | 'lr-retrieval-select'
  | 'lr-retry'
  | 'lr-stop'
  | 'lr-submit'
  | 'lr-tool-approval-decide',
never,
  {
    'aria-label'?: LyraAgentWorkspace['accessibleLabel'];
    'composer-max-rows'?: LyraAgentWorkspace['composerMaxRows'];
    'composer-min-rows'?: LyraAgentWorkspace['composerMinRows'];
    'composer-placeholder'?: LyraAgentWorkspace['composerPlaceholder'];
    'composer-status'?: LyraAgentWorkspace['composerStatus'];
    'composer-value'?: LyraAgentWorkspace['composerValue'];
    'context-total'?: LyraAgentWorkspace['contextTotal'];
    'retrieval-error'?: LyraAgentWorkspace['retrievalError'];
    'retrieval-has-more'?: LyraAgentWorkspace['retrievalHasMore'];
    'retrieval-loading'?: LyraAgentWorkspace['retrievalLoading'];
    'show-composer'?: LyraAgentWorkspace['showComposer'];
    'show-details'?: LyraAgentWorkspace['showDetails'];
    'unread-start-index'?: LyraAgentWorkspace['unreadStartIndex'];
  }
>;

export type LyraAlertSvelteProps = LyraSvelteElementProps<
  LyraAlert,
  | 'closable'
  | 'countdown'
  | 'duration'
  | 'locale'
  | 'open'
  | 'strings'
  | 'variant',
  LyraAlertEventMap,
  | 'lr-after-hide'
  | 'lr-after-show'
  | 'lr-hide'
  | 'lr-show',
never,
  {}
>;

export type LyraAnimatedImageSvelteProps = LyraSvelteElementProps<
  LyraAnimatedImage,
  | 'accessibleLabel'
  | 'alt'
  | 'locale'
  | 'play'
  | 'playing'
  | 'respectReducedMotion'
  | 'src'
  | 'strings',
  LyraAnimatedImageEventMap,
  | 'blur'
  | 'focus'
  | 'lr-blur'
  | 'lr-error'
  | 'lr-focus'
  | 'lr-load'
  | 'lr-pause'
  | 'lr-play',
  | '--control-box-size'
  | '--icon-size'
  | '--lr-animated-image-control-box-size'
  | '--lr-animated-image-icon-size'
  | '--lr-animated-image-max-height',
  {
    'aria-label'?: LyraAnimatedImage['accessibleLabel'];
    'respect-reduced-motion'?: LyraAnimatedImage['respectReducedMotion'];
  }
>;

export type LyraAnimationSvelteProps = LyraSvelteElementProps<
  LyraAnimation,
  | 'currentTime'
  | 'delay'
  | 'direction'
  | 'duration'
  | 'easing'
  | 'endDelay'
  | 'fill'
  | 'iterations'
  | 'iterationStart'
  | 'keyframes'
  | 'locale'
  | 'name'
  | 'play'
  | 'playbackRate'
  | 'playOnVisible'
  | 'playOnVisibleRepeat'
  | 'respectReducedMotion'
  | 'root'
  | 'rootMargin'
  | 'strings'
  | 'threshold'
  | 'timingPreset',
  LyraAnimationEventMap,
  | 'lr-cancel'
  | 'lr-finish'
  | 'lr-start',
  | '--lr-animation-bounce-height'
  | '--lr-animation-shake-distance'
  | '--lr-animation-slide-distance'
  | '--lr-animation-zoom-scale',
  {
    'end-delay'?: LyraAnimation['endDelay'];
    'iteration-start'?: LyraAnimation['iterationStart'];
    'play-on-visible'?: LyraAnimation['playOnVisible'];
    'play-on-visible-repeat'?: LyraAnimation['playOnVisibleRepeat'];
    'playback-rate'?: LyraAnimation['playbackRate'];
    'respect-reduced-motion'?: LyraAnimation['respectReducedMotion'];
    'root-margin'?: LyraAnimation['rootMargin'];
    'timing-preset'?: LyraAnimation['timingPreset'];
  }
>;

export type LyraAppRailSvelteProps = LyraSvelteElementProps<
  LyraAppRail,
  | 'dragging'
  | 'hideToggle'
  | 'iconOnlyBreakpoint'
  | 'label'
  | 'locale'
  | 'maxRailWidthPx'
  | 'minRailWidthPx'
  | 'mobileBreakpoint'
  | 'mode'
  | 'open'
  | 'persist'
  | 'preferredMode'
  | 'railWidthPx'
  | 'resizable'
  | 'storageKey'
  | 'strings',
  LyraAppRailEventMap,
  | 'lr-mode-change'
  | 'lr-rail-resize'
  | 'lr-rail-resize-request'
  | 'lr-toggle',
  | '--lr-app-rail-icon-width'
  | '--lr-app-rail-mobile-width'
  | '--lr-app-rail-overlay-color'
  | '--lr-app-rail-resizer-active-bg'
  | '--lr-app-rail-resizer-hover-bg'
  | '--lr-app-rail-toggle-active-bg'
  | '--lr-app-rail-toggle-active-color'
  | '--lr-app-rail-toggle-hover-bg'
  | '--lr-app-rail-toggle-hover-color'
  | '--lr-app-rail-width',
  {
    'aria-label'?: LyraUnknownAttributeValue;
    'hide-toggle'?: LyraAppRail['hideToggle'];
    'icon-only-breakpoint'?: LyraAppRail['iconOnlyBreakpoint'];
    'max-rail-width-px'?: LyraAppRail['maxRailWidthPx'];
    'min-rail-width-px'?: LyraAppRail['minRailWidthPx'];
    'mobile-breakpoint'?: LyraAppRail['mobileBreakpoint'];
    'preferred-mode'?: LyraAppRail['preferredMode'];
    'rail-width-px'?: LyraAppRail['railWidthPx'];
    'storage-key'?: LyraAppRail['storageKey'];
  }
>;

export type LyraAppRailItemSvelteProps = LyraSvelteElementProps<
  LyraAppRailItem,
  | 'active'
  | 'disabled'
  | 'href'
  | 'locale'
  | 'strings'
  | 'target'
  | 'tooltip',
  {},
never,
  | '--lr-app-rail-item-active-bg'
  | '--lr-app-rail-item-active-color'
  | '--lr-app-rail-item-current-bg'
  | '--lr-app-rail-item-current-color'
  | '--lr-app-rail-item-hover-bg'
  | '--lr-app-rail-item-hover-color',
  {
    'icon-only'?: LyraUnknownAttributeValue;
  }
>;

export type LyraApprovalQueueSvelteProps = LyraSvelteElementProps<
  LyraApprovalQueue,
  | 'editable'
  | 'label'
  | 'locale'
  | 'open'
  | 'requests'
  | 'selectedId'
  | 'strings',
  LyraApprovalQueueEventMap,
  | 'lr-approval-close'
  | 'lr-approval-decision'
  | 'lr-approval-select',
  | '--lr-approval-queue-selected-border',
  {
    'selected-id'?: LyraApprovalQueue['selectedId'];
  }
>;

export type LyraArchiveViewerSvelteProps = LyraSvelteElementProps<
  LyraArchiveViewer,
  | 'activeHighlightId'
  | 'anchor'
  | 'highlights'
  | 'name'
  | 'src',
  LyraArchiveViewerEventMap,
  | 'lr-anchor-result'
  | 'lr-render-error'
  | 'lr-search-change'
  | 'lr-text-select',
  | '--lr-archive-viewer-highlight-accent-background'
  | '--lr-archive-viewer-highlight-active-background'
  | '--lr-archive-viewer-highlight-active-outline'
  | '--lr-archive-viewer-highlight-danger-background'
  | '--lr-archive-viewer-highlight-neutral-background'
  | '--lr-archive-viewer-highlight-success-background'
  | '--lr-archive-viewer-highlight-warning-background',
  {
    'active-highlight-id'?: LyraArchiveViewer['activeHighlightId'];
  }
>;

export type LyraArtifactPanelSvelteProps = LyraSvelteElementProps<
  LyraArtifactPanel,
  | 'activeVersionId'
  | 'copyText'
  | 'downloadName'
  | 'downloadSrc'
  | 'kind'
  | 'label'
  | 'locale'
  | 'streaming'
  | 'strings'
  | 'versions'
  | 'view',
  LyraArtifactPanelEventMap,
  | 'lr-copy'
  | 'lr-download'
  | 'lr-restore'
  | 'lr-version-change'
  | 'lr-view-change',
  | '--lr-artifact-panel-view-active-bg'
  | '--lr-artifact-panel-view-active-color',
  {
    'active-version-id'?: LyraArtifactPanel['activeVersionId'];
    'copy-text'?: LyraArtifactPanel['copyText'];
    'download-name'?: LyraArtifactPanel['downloadName'];
    'download-src'?: LyraArtifactPanel['downloadSrc'];
  }
>;

export type LyraAttachmentChipSvelteProps = LyraSvelteElementProps<
  LyraAttachmentChip,
  | 'bytes'
  | 'compact'
  | 'file'
  | 'locale'
  | 'mimeType'
  | 'name'
  | 'previewable'
  | 'previewSrc'
  | 'progress'
  | 'removable'
  | 'removeLabel'
  | 'retryLabel'
  | 'status'
  | 'strings'
  | 'thumbnailOnly'
  | 'thumbnailSrc'
  | 'untitledLabel'
  | 'uploadFailedLabel'
  | 'uploadingLabel',
  LyraAttachmentChipEventMap,
  | 'lr-preview'
  | 'lr-remove'
  | 'lr-retry',
  | '--lr-attachment-chip-accent'
  | '--lr-attachment-chip-bg'
  | '--lr-attachment-chip-border'
  | '--lr-attachment-chip-compact-font-size'
  | '--lr-attachment-chip-compact-gap'
  | '--lr-attachment-chip-compact-thumbnail-size'
  | '--lr-attachment-chip-spinner-duration',
  {
    'mime-type'?: LyraAttachmentChip['mimeType'];
    'preview-src'?: LyraAttachmentChip['previewSrc'];
    'remove-label'?: LyraAttachmentChip['removeLabel'];
    'retry-label'?: LyraAttachmentChip['retryLabel'];
    'thumbnail-only'?: LyraAttachmentChip['thumbnailOnly'];
    'thumbnail-src'?: LyraAttachmentChip['thumbnailSrc'];
    'untitled-label'?: LyraAttachmentChip['untitledLabel'];
    'upload-failed-label'?: LyraAttachmentChip['uploadFailedLabel'];
    'uploading-label'?: LyraAttachmentChip['uploadingLabel'];
  }
>;

export type LyraAttachmentTriggerSvelteProps = LyraSvelteElementProps<
  LyraAttachmentTrigger,
  | 'accept'
  | 'capabilities'
  | 'disabled'
  | 'locale'
  | 'multiple'
  | 'strings'
  | 'triggerLabel'
  | 'triggerTitle',
  LyraAttachmentTriggerEventMap,
  | 'blur'
  | 'focus'
  | 'lr-audio-request'
  | 'lr-blur'
  | 'lr-camera-request'
  | 'lr-focus'
  | 'lr-pick',
never,
  {
    'trigger-label'?: LyraAttachmentTrigger['triggerLabel'];
    'trigger-title'?: LyraAttachmentTrigger['triggerTitle'];
  }
>;

export type LyraAudioVisualizerSvelteProps = LyraSvelteElementProps<
  LyraAudioVisualizer,
  | 'barCount'
  | 'gain'
  | 'label'
  | 'level'
  | 'locale'
  | 'state'
  | 'stream'
  | 'strings'
  | 'variant',
  {},
never,
  | '--lr-audio-visualizer-ambient-duration'
  | '--lr-audio-visualizer-color'
  | '--lr-audio-visualizer-height'
  | '--lr-audio-visualizer-quiet-color',
  {
    'bar-count'?: LyraAudioVisualizer['barCount'];
  }
>;

export type LyraAvPlayerSvelteProps = LyraSvelteElementProps<
  LyraAvPlayer,
  | 'activeHighlightId'
  | 'anchor'
  | 'cues'
  | 'currentTime'
  | 'highlights'
  | 'kind'
  | 'locale'
  | 'loop'
  | 'mimeType'
  | 'muted'
  | 'name'
  | 'peaks'
  | 'playbackRate'
  | 'poster'
  | 'preload'
  | 'rates'
  | 'src'
  | 'strings'
  | 'tracks',
  LyraAvPlayerEventMap,
  | 'blur'
  | 'ended'
  | 'error'
  | 'focus'
  | 'loadedmetadata'
  | 'lr-anchor-result'
  | 'lr-blur'
  | 'lr-cue-change'
  | 'lr-focus'
  | 'lr-highlight-activate'
  | 'lr-load'
  | 'lr-pause'
  | 'lr-play'
  | 'lr-rate-change'
  | 'lr-render-error'
  | 'lr-search-change'
  | 'lr-time-change'
  | 'pause'
  | 'play'
  | 'timeupdate'
  | 'volumechange',
  | '--lr-av-player-cue-active-match-color'
  | '--lr-av-player-cue-current-bg'
  | '--lr-av-player-marker-active-color'
  | '--lr-av-player-marker-bg'
  | '--lr-av-player-marker-danger-bg'
  | '--lr-av-player-marker-fill'
  | '--lr-av-player-marker-neutral-bg'
  | '--lr-av-player-marker-success-bg'
  | '--lr-av-player-marker-warning-bg'
  | '--lr-av-player-transcript-height',
  {
    'active-highlight-id'?: LyraAvPlayer['activeHighlightId'];
    'mime-type'?: LyraAvPlayer['mimeType'];
    'playback-rate'?: LyraAvPlayer['playbackRate'];
  }
>;

export type LyraAvatarSvelteProps = LyraSvelteElementProps<
  LyraAvatar,
  | 'alt'
  | 'image'
  | 'initials'
  | 'label'
  | 'loading'
  | 'locale'
  | 'shape'
  | 'size'
  | 'strings'
  | 'variant',
  LyraAvatarEventMap,
  | 'lr-error',
  | '--lr-avatar-bg'
  | '--lr-avatar-color'
  | '--lr-avatar-font-size'
  | '--lr-avatar-size'
  | '--size',
  {}
>;

export type LyraAvatarGroupSvelteProps = LyraSvelteElementProps<
  LyraAvatarGroup,
  | 'label'
  | 'locale'
  | 'max'
  | 'shape'
  | 'size'
  | 'strings'
  | 'variant',
  LyraAvatarGroupEventMap,
  | 'lr-overflow-click',
  | '--lr-avatar-group-avatar-size'
  | '--lr-avatar-group-badge-bg'
  | '--lr-avatar-group-badge-color'
  | '--lr-avatar-group-badge-font-size'
  | '--lr-avatar-group-overlap'
  | '--lr-avatar-group-ring-color'
  | '--lr-avatar-group-ring-width',
  {}
>;

export type LyraBadgeSvelteProps = LyraSvelteElementProps<
  LyraBadge,
  | 'appearance'
  | 'attention'
  | 'locale'
  | 'pill'
  | 'pulse'
  | 'size'
  | 'strings'
  | 'variant',
  {},
never,
  | '--lr-badge-attention-duration'
  | '--lr-badge-attention-easing'
  | '--lr-badge-background'
  | '--lr-badge-border'
  | '--lr-badge-bounce-distance'
  | '--lr-badge-color'
  | '--lr-badge-edge'
  | '--lr-badge-fill'
  | '--lr-badge-font-size'
  | '--lr-badge-gap'
  | '--lr-badge-ink'
  | '--lr-badge-min-height'
  | '--lr-badge-on-solid'
  | '--lr-badge-padding-inline'
  | '--lr-badge-pulse-color'
  | '--lr-badge-pulse-spread'
  | '--lr-badge-radius'
  | '--lr-badge-solid'
  | '--lr-badge-stroke'
  | '--lr-badge-text'
  | '--lr-badge-tint'
  | '--pulse-color',
  {}
>;

export type LyraBarChartSvelteProps = LyraSvelteElementProps<
  LyraBarChart,
  | 'accessibleDescription'
  | 'accessibleLabel'
  | 'area'
  | 'beginAtZero'
  | 'config'
  | 'dataLabels'
  | 'datasets'
  | 'description'
  | 'grid'
  | 'height'
  | 'hiddenDatasets'
  | 'indexAxis'
  | 'label'
  | 'labels'
  | 'legend'
  | 'legendPosition'
  | 'locale'
  | 'max'
  | 'min'
  | 'plugins'
  | 'showDataTable'
  | 'stacked'
  | 'stackTotals'
  | 'strings'
  | 'type'
  | 'valueFormatter'
  | 'withoutAnimation'
  | 'withoutLegend'
  | 'withoutTooltip'
  | 'xLabel'
  | 'y2Label'
  | 'yLabel'
  | 'zoom',
  LyraChartEventMap,
  | 'lr-before-legend-visibility-change'
  | 'lr-legend-visibility-change'
  | 'lr-point-click'
  | 'lr-zoom',
  | '--border-color-1'
  | '--border-color-2'
  | '--border-color-3'
  | '--border-color-4'
  | '--border-color-5'
  | '--border-color-6'
  | '--border-radius'
  | '--border-width'
  | '--fill-color-1'
  | '--fill-color-2'
  | '--fill-color-3'
  | '--fill-color-4'
  | '--fill-color-5'
  | '--fill-color-6'
  | '--grid-border-width'
  | '--grid-color'
  | '--line-border-width'
  | '--lr-chart-canvas-hover-outline-width'
  | '--lr-chart-data-table-button-active-bg'
  | '--lr-chart-data-table-button-hover-bg'
  | '--lr-chart-grid-color'
  | '--lr-chart-height'
  | '--lr-chart-legend-color'
  | '--lr-chart-legend-item-active-bg'
  | '--lr-chart-legend-item-hover-bg'
  | '--lr-chart-pattern-step'
  | '--lr-chart-reset-zoom-button-active-bg'
  | '--lr-chart-reset-zoom-button-hover-bg'
  | '--lr-chart-tick-color'
  | '--lr-chart-tooltip-bg'
  | '--lr-chart-tooltip-text'
  | '--point-radius',
  {
    'accessible-description'?: LyraBarChart['accessibleDescription'];
    'accessible-label'?: LyraBarChart['accessibleLabel'];
    'begin-at-zero'?: LyraBarChart['beginAtZero'];
    'data-labels'?: LyraBarChart['dataLabels'];
    'index-axis'?: LyraBarChart['indexAxis'];
    'legend-position'?: LyraBarChart['legendPosition'];
    'show-data-table'?: LyraBarChart['showDataTable'];
    'stack-totals'?: LyraBarChart['stackTotals'];
    'without-animation'?: LyraBarChart['withoutAnimation'];
    'without-legend'?: LyraBarChart['withoutLegend'];
    'without-tooltip'?: LyraBarChart['withoutTooltip'];
    'x-label'?: LyraBarChart['xLabel'];
    'y-label'?: LyraBarChart['yLabel'];
    'y2-label'?: LyraBarChart['y2Label'];
  }
>;

export type LyraBoxPlotSvelteProps = LyraSvelteElementProps<
  LyraBoxPlot,
  | 'accessibleDescription'
  | 'accessibleLabel'
  | 'beginAtZero'
  | 'boxes'
  | 'height'
  | 'hiddenDatasets'
  | 'labels'
  | 'legend'
  | 'locale'
  | 'showDataTable'
  | 'strings'
  | 'yLabel',
  LyraBoxPlotEventMap,
  | 'lr-before-legend-visibility-change'
  | 'lr-legend-visibility-change'
  | 'lr-point-click',
  | '--lr-chart-canvas-hover-outline-width'
  | '--lr-chart-height'
  | '--lr-chart-pattern-step',
  {
    'accessible-description'?: LyraBoxPlot['accessibleDescription'];
    'accessible-label'?: LyraBoxPlot['accessibleLabel'];
    'begin-at-zero'?: LyraBoxPlot['beginAtZero'];
    'show-data-table'?: LyraBoxPlot['showDataTable'];
    'y-label'?: LyraBoxPlot['yLabel'];
  }
>;

export type LyraBranchPickerSvelteProps = LyraSvelteElementProps<
  LyraBranchPicker,
  | 'count'
  | 'index'
  | 'label'
  | 'locale'
  | 'strings',
  LyraBranchPickerEventMap,
  | 'lr-branch-change',
never,
  {}
>;

export type LyraBreadcrumbSvelteProps = LyraSvelteElementProps<
  LyraBreadcrumb,
  | 'accessibleLabel'
  | 'label'
  | 'locale'
  | 'strings',
  {},
never,
never,
  {
    'aria-label'?: LyraBreadcrumb['accessibleLabel'];
  }
>;

export type LyraBreadcrumbItemSvelteProps = LyraSvelteElementProps<
  LyraBreadcrumbItem,
  | 'current'
  | 'href'
  | 'locale'
  | 'rel'
  | 'strings'
  | 'target',
  {},
never,
  | '--lr-breadcrumb-current-color'
  | '--lr-breadcrumb-item-active-bg',
  {}
>;

export type LyraBrowserFrameSvelteProps = LyraSvelteElementProps<
  LyraBrowserFrame,
  | 'controller'
  | 'controls'
  | 'frameSrc'
  | 'locale'
  | 'pings'
  | 'status'
  | 'strings'
  | 'url',
  LyraBrowserFrameEventMap,
  | 'lr-stop'
  | 'lr-take-over',
  | '--lr-browser-frame-aspect-ratio'
  | '--lr-browser-frame-controller-background'
  | '--lr-browser-frame-controller-color'
  | '--lr-browser-frame-ping-click-color'
  | '--lr-browser-frame-ping-move-color'
  | '--lr-browser-frame-ping-scroll-color'
  | '--lr-browser-frame-ping-type-color',
  {
    'frame-src'?: LyraBrowserFrame['frameSrc'];
  }
>;

export type LyraBubbleChartSvelteProps = LyraSvelteElementProps<
  LyraBubbleChart,
  | 'accessibleDescription'
  | 'accessibleLabel'
  | 'area'
  | 'beginAtZero'
  | 'config'
  | 'dataLabels'
  | 'datasets'
  | 'description'
  | 'grid'
  | 'height'
  | 'hiddenDatasets'
  | 'indexAxis'
  | 'label'
  | 'labels'
  | 'legend'
  | 'legendPosition'
  | 'locale'
  | 'max'
  | 'min'
  | 'plugins'
  | 'showDataTable'
  | 'stacked'
  | 'stackTotals'
  | 'strings'
  | 'type'
  | 'valueFormatter'
  | 'withoutAnimation'
  | 'withoutLegend'
  | 'withoutTooltip'
  | 'xLabel'
  | 'y2Label'
  | 'yLabel'
  | 'zoom',
  LyraChartEventMap,
  | 'lr-before-legend-visibility-change'
  | 'lr-legend-visibility-change'
  | 'lr-point-click'
  | 'lr-zoom',
  | '--border-color-1'
  | '--border-color-2'
  | '--border-color-3'
  | '--border-color-4'
  | '--border-color-5'
  | '--border-color-6'
  | '--border-radius'
  | '--border-width'
  | '--fill-color-1'
  | '--fill-color-2'
  | '--fill-color-3'
  | '--fill-color-4'
  | '--fill-color-5'
  | '--fill-color-6'
  | '--grid-border-width'
  | '--grid-color'
  | '--line-border-width'
  | '--lr-chart-canvas-hover-outline-width'
  | '--lr-chart-data-table-button-active-bg'
  | '--lr-chart-data-table-button-hover-bg'
  | '--lr-chart-grid-color'
  | '--lr-chart-height'
  | '--lr-chart-legend-color'
  | '--lr-chart-legend-item-active-bg'
  | '--lr-chart-legend-item-hover-bg'
  | '--lr-chart-pattern-step'
  | '--lr-chart-reset-zoom-button-active-bg'
  | '--lr-chart-reset-zoom-button-hover-bg'
  | '--lr-chart-tick-color'
  | '--lr-chart-tooltip-bg'
  | '--lr-chart-tooltip-text'
  | '--point-radius',
  {
    'accessible-description'?: LyraBubbleChart['accessibleDescription'];
    'accessible-label'?: LyraBubbleChart['accessibleLabel'];
    'begin-at-zero'?: LyraBubbleChart['beginAtZero'];
    'data-labels'?: LyraBubbleChart['dataLabels'];
    'index-axis'?: LyraBubbleChart['indexAxis'];
    'legend-position'?: LyraBubbleChart['legendPosition'];
    'show-data-table'?: LyraBubbleChart['showDataTable'];
    'stack-totals'?: LyraBubbleChart['stackTotals'];
    'without-animation'?: LyraBubbleChart['withoutAnimation'];
    'without-legend'?: LyraBubbleChart['withoutLegend'];
    'without-tooltip'?: LyraBubbleChart['withoutTooltip'];
    'x-label'?: LyraBubbleChart['xLabel'];
    'y-label'?: LyraBubbleChart['yLabel'];
    'y2-label'?: LyraBubbleChart['y2Label'];
  }
>;

export type LyraButtonSvelteProps = LyraSvelteElementProps<
  LyraButton,
  | 'accessibleLabel'
  | 'appearance'
  | 'caret'
  | 'circle'
  | 'customError'
  | 'disabled'
  | 'download'
  | 'form'
  | 'formAction'
  | 'formEnctype'
  | 'formMethod'
  | 'formNoValidate'
  | 'formTarget'
  | 'href'
  | 'loading'
  | 'locale'
  | 'name'
  | 'outline'
  | 'pill'
  | 'rel'
  | 'required'
  | 'size'
  | 'strings'
  | 'target'
  | 'type'
  | 'value'
  | 'variant'
  | 'withCaret'
  | 'withEnd'
  | 'withStart',
  LyraButtonEventMap,
  | 'blur'
  | 'focus'
  | 'lr-blur'
  | 'lr-focus'
  | 'lr-invalid',
  | '--lr-button-accent'
  | '--lr-button-accent-fill'
  | '--lr-button-accent-on-fill'
  | '--lr-button-active-background'
  | '--lr-button-active-scale'
  | '--lr-button-border'
  | '--lr-button-caret-size'
  | '--lr-button-fill'
  | '--lr-button-font-size'
  | '--lr-button-gap'
  | '--lr-button-height'
  | '--lr-button-hover-background'
  | '--lr-button-hover-base'
  | '--lr-button-min-height'
  | '--lr-button-on-fill'
  | '--lr-button-outlined-border'
  | '--lr-button-outlined-fill'
  | '--lr-button-padding-block'
  | '--lr-button-padding-inline'
  | '--lr-button-quiet-border'
  | '--lr-button-quiet-text'
  | '--lr-button-radius'
  | '--lr-button-shadow'
  | '--lr-button-size-2xs'
  | '--lr-button-size-l'
  | '--lr-button-size-m'
  | '--lr-button-size-s'
  | '--lr-button-size-xl'
  | '--lr-button-size-xs'
  | '--lr-button-spinner-duration'
  | '--lr-button-width',
  {
    'aria-controls'?: LyraUnknownAttributeValue;
    'aria-describedby'?: LyraUnknownAttributeValue;
    'aria-expanded'?: LyraUnknownAttributeValue;
    'aria-haspopup'?: LyraUnknownAttributeValue;
    'aria-label'?: LyraButton['accessibleLabel'];
    'custom-error'?: LyraButton['customError'];
    'form-action'?: LyraUnknownAttributeValue;
    'form-enctype'?: LyraUnknownAttributeValue;
    'form-method'?: LyraUnknownAttributeValue;
    'form-no-validate'?: LyraUnknownAttributeValue;
    'form-target'?: LyraUnknownAttributeValue;
    'formaction'?: LyraButton['formAction'];
    'formenctype'?: LyraButton['formEnctype'];
    'formmethod'?: LyraButton['formMethod'];
    'formnovalidate'?: LyraButton['formNoValidate'];
    'formtarget'?: LyraButton['formTarget'];
    'with-caret'?: LyraButton['withCaret'];
    'with-end'?: LyraButton['withEnd'];
    'with-start'?: LyraButton['withStart'];
  }
>;

export type LyraButtonGroupSvelteProps = LyraSvelteElementProps<
  LyraButtonGroup,
  | 'label'
  | 'locale'
  | 'orientation'
  | 'strings',
  {},
never,
  | '--lr-button-group-gap',
  {}
>;

export type LyraCalendarSvelteProps = LyraSvelteElementProps<
  LyraCalendar,
  | 'accessibleLabel'
  | 'events'
  | 'firstDayOfWeek'
  | 'locale'
  | 'strings'
  | 'value'
  | 'view'
  | 'viewDate',
  LyraCalendarEventMap,
  | 'lr-date-select'
  | 'lr-event-select'
  | 'lr-view-change',
  | '--lr-calendar-day-min-block-size'
  | '--lr-calendar-day-min-block-size-narrow'
  | '--lr-calendar-day-outside-bg'
  | '--lr-calendar-day-outside-color'
  | '--lr-calendar-day-selected-bg'
  | '--lr-calendar-day-today-outline-color',
  {
    'aria-label'?: LyraCalendar['accessibleLabel'];
    'first-day-of-week'?: LyraCalendar['firstDayOfWeek'];
    'view-date'?: LyraCalendar['viewDate'];
  }
>;

export type LyraCalendarViewerSvelteProps = LyraSvelteElementProps<
  LyraCalendarViewer,
  | 'activeHighlightId'
  | 'anchor'
  | 'highlights'
  | 'locale'
  | 'maxHeight'
  | 'name'
  | 'src'
  | 'strings',
  LyraCalendarViewerEventMap,
  | 'lr-anchor-result'
  | 'lr-render-error'
  | 'lr-search-change'
  | 'lr-text-select',
  | '--lr-calendar-viewer-max-height',
  {
    'active-highlight-id'?: LyraCalendarViewer['activeHighlightId'];
    'max-height'?: LyraCalendarViewer['maxHeight'];
  }
>;

export type LyraCalloutSvelteProps = LyraSvelteElementProps<
  LyraCallout,
  | 'accessibleLabel'
  | 'appearance'
  | 'closable'
  | 'heading'
  | 'headingLevel'
  | 'inline'
  | 'locale'
  | 'open'
  | 'size'
  | 'strings'
  | 'variant',
  LyraCalloutEventMap,
  | 'lr-close',
  | '--lr-callout-background'
  | '--lr-callout-border'
  | '--lr-callout-close-hover-bg'
  | '--lr-callout-color'
  | '--lr-callout-font-size'
  | '--lr-callout-gap'
  | '--lr-callout-padding',
  {
    'accessible-label'?: LyraCallout['accessibleLabel'];
    'heading-level'?: LyraCallout['headingLevel'];
  }
>;

export type LyraCardSvelteProps = LyraSvelteElementProps<
  LyraCard,
  | 'accessibleLabel'
  | 'appearance'
  | 'href'
  | 'interactive'
  | 'locale'
  | 'orientation'
  | 'strings'
  | 'target'
  | 'withFooter'
  | 'withFooterActions'
  | 'withHeader'
  | 'withHeaderActions'
  | 'withMedia',
  LyraCardEventMap,
  | 'lr-card-activate',
  | '--border-color'
  | '--border-radius'
  | '--border-width'
  | '--lr-card-accent-border-color'
  | '--lr-card-filled-bg'
  | '--lr-card-filled-outlined-bg'
  | '--lr-card-interactive-active-border-color'
  | '--lr-card-interactive-active-overlay'
  | '--lr-card-interactive-hover-border-color'
  | '--padding'
  | '--spacing',
  {
    'aria-label'?: LyraCard['accessibleLabel'];
    'with-footer'?: LyraCard['withFooter'];
    'with-footer-actions'?: LyraCard['withFooterActions'];
    'with-header'?: LyraCard['withHeader'];
    'with-header-actions'?: LyraCard['withHeaderActions'];
    'with-media'?: LyraCard['withMedia'];
  }
>;

export type LyraCarouselSvelteProps = LyraSvelteElementProps<
  LyraCarousel,
  | 'accessibleLabel'
  | 'autoplay'
  | 'autoplayInterval'
  | 'currentSlide'
  | 'index'
  | 'locale'
  | 'loop'
  | 'mouseDragging'
  | 'navigation'
  | 'orientation'
  | 'pagination'
  | 'showIndicators'
  | 'slides'
  | 'slidesPerMove'
  | 'slidesPerPage'
  | 'strings',
  LyraCarouselEventMap,
  | 'lr-slide-change',
  | '--aspect-ratio'
  | '--lr-carousel-indicator-current-bg'
  | '--lr-carousel-indicator-current-border-color'
  | '--lr-carousel-navigation-active-bg'
  | '--lr-carousel-navigation-active-border-color'
  | '--lr-carousel-navigation-hover-bg'
  | '--lr-carousel-navigation-hover-border-color'
  | '--lr-carousel-pagination-active-bg'
  | '--lr-carousel-pagination-active-border-color'
  | '--lr-carousel-pagination-hover-bg'
  | '--lr-carousel-pagination-hover-border-color'
  | '--lr-carousel-slide-basis'
  | '--scroll-hint'
  | '--slide-gap',
  {
    'accessible-label'?: LyraCarousel['accessibleLabel'];
    'aria-label'?: LyraUnknownAttributeValue;
    'autoplay-interval'?: LyraCarousel['autoplayInterval'];
    'current-slide'?: LyraCarousel['currentSlide'];
    'mouse-dragging'?: LyraCarousel['mouseDragging'];
    'show-indicators'?: LyraCarousel['showIndicators'];
    'slides-per-move'?: LyraCarousel['slidesPerMove'];
    'slides-per-page'?: LyraCarousel['slidesPerPage'];
  }
>;

export type LyraCarouselItemSvelteProps = LyraSvelteElementProps<
  LyraCarouselItem,
  | 'locale'
  | 'strings',
  {},
never,
  | '--aspect-ratio',
  {}
>;

export type LyraChartSvelteProps = LyraSvelteElementProps<
  LyraChart,
  | 'accessibleDescription'
  | 'accessibleLabel'
  | 'area'
  | 'beginAtZero'
  | 'config'
  | 'dataLabels'
  | 'datasets'
  | 'description'
  | 'grid'
  | 'height'
  | 'hiddenDatasets'
  | 'indexAxis'
  | 'label'
  | 'labels'
  | 'legend'
  | 'legendPosition'
  | 'locale'
  | 'max'
  | 'min'
  | 'plugins'
  | 'showDataTable'
  | 'stacked'
  | 'stackTotals'
  | 'strings'
  | 'type'
  | 'valueFormatter'
  | 'withoutAnimation'
  | 'withoutLegend'
  | 'withoutTooltip'
  | 'xLabel'
  | 'y2Label'
  | 'yLabel'
  | 'zoom',
  LyraChartEventMap,
  | 'lr-before-legend-visibility-change'
  | 'lr-legend-visibility-change'
  | 'lr-point-click'
  | 'lr-zoom',
  | '--border-color-1'
  | '--border-color-2'
  | '--border-color-3'
  | '--border-color-4'
  | '--border-color-5'
  | '--border-color-6'
  | '--border-radius'
  | '--border-width'
  | '--fill-color-1'
  | '--fill-color-2'
  | '--fill-color-3'
  | '--fill-color-4'
  | '--fill-color-5'
  | '--fill-color-6'
  | '--grid-border-width'
  | '--grid-color'
  | '--line-border-width'
  | '--lr-chart-canvas-hover-outline-width'
  | '--lr-chart-data-table-button-active-bg'
  | '--lr-chart-data-table-button-hover-bg'
  | '--lr-chart-grid-color'
  | '--lr-chart-height'
  | '--lr-chart-legend-color'
  | '--lr-chart-legend-item-active-bg'
  | '--lr-chart-legend-item-hover-bg'
  | '--lr-chart-pattern-step'
  | '--lr-chart-reset-zoom-button-active-bg'
  | '--lr-chart-reset-zoom-button-hover-bg'
  | '--lr-chart-tick-color'
  | '--lr-chart-tooltip-bg'
  | '--lr-chart-tooltip-text'
  | '--point-radius',
  {
    'accessible-description'?: LyraChart['accessibleDescription'];
    'accessible-label'?: LyraChart['accessibleLabel'];
    'begin-at-zero'?: LyraChart['beginAtZero'];
    'data-labels'?: LyraChart['dataLabels'];
    'index-axis'?: LyraChart['indexAxis'];
    'legend-position'?: LyraChart['legendPosition'];
    'show-data-table'?: LyraChart['showDataTable'];
    'stack-totals'?: LyraChart['stackTotals'];
    'without-animation'?: LyraChart['withoutAnimation'];
    'without-legend'?: LyraChart['withoutLegend'];
    'without-tooltip'?: LyraChart['withoutTooltip'];
    'x-label'?: LyraChart['xLabel'];
    'y-label'?: LyraChart['yLabel'];
    'y2-label'?: LyraChart['y2Label'];
  }
>;

export type LyraChatComposerSvelteProps = LyraSvelteElementProps<
  LyraChatComposer,
  | 'accessibleLabel'
  | 'autocapitalize'
  | 'autocomplete'
  | 'autoCorrect'
  | 'customError'
  | 'defaultValue'
  | 'disabled'
  | 'enterKeyHint'
  | 'form'
  | 'frame'
  | 'inputMode'
  | 'locale'
  | 'maxRows'
  | 'minRows'
  | 'name'
  | 'placeholder'
  | 'required'
  | 'selectionDirection'
  | 'selectionEnd'
  | 'selectionStart'
  | 'spellcheck'
  | 'status'
  | 'stoppable'
  | 'strings'
  | 'submitDisabled'
  | 'submitOnEnter'
  | 'value'
  | 'wrap',
  LyraChatComposerEventMap,
  | 'blur'
  | 'focus'
  | 'lr-input'
  | 'lr-invalid'
  | 'lr-stop'
  | 'lr-submit',
  | '--lr-chat-composer-busy-bg',
  {
    'aria-label'?: LyraChatComposer['accessibleLabel'];
    'autocorrect'?: LyraChatComposer['autoCorrect'];
    'custom-error'?: LyraChatComposer['customError'];
    'enterkeyhint'?: LyraChatComposer['enterKeyHint'];
    'inputmode'?: LyraChatComposer['inputMode'];
    'max-rows'?: LyraChatComposer['maxRows'];
    'min-rows'?: LyraChatComposer['minRows'];
    'submit-disabled'?: LyraChatComposer['submitDisabled'];
    'submit-on-enter'?: LyraChatComposer['submitOnEnter'];
    'value'?: LyraChatComposer['defaultValue'];
  }
>;

export type LyraChatMessageSvelteProps = LyraSvelteElementProps<
  LyraChatMessage,
  | 'actionsOutsideBubble'
  | 'attachmentsPosition'
  | 'collapsed'
  | 'collapsible'
  | 'formatTimestamp'
  | 'locale'
  | 'messageId'
  | 'role'
  | 'status'
  | 'strings'
  | 'timestamp',
  LyraChatMessageEventMap,
  | 'lr-collapse-toggle'
  | 'lr-retry',
  | '--lr-chat-message-bubble-bg'
  | '--lr-chat-message-bubble-color'
  | '--lr-chat-message-bubble-padding'
  | '--lr-chat-message-bubble-radius'
  | '--lr-chat-message-failed-bg'
  | '--lr-chat-message-failed-border-color'
  | '--lr-chat-message-failed-footer-color'
  | '--lr-chat-message-failed-indicator-color'
  | '--lr-chat-message-failed-status-color'
  | '--lr-chat-message-footer-color'
  | '--lr-chat-message-indicator-color'
  | '--lr-chat-message-max-width'
  | '--lr-chat-message-streaming-border-color'
  | '--lr-chat-message-streaming-indicator-color'
  | '--lr-chat-message-system-color'
  | '--lr-chat-message-user-bubble-bg'
  | '--lr-chat-message-user-bubble-color'
  | '--lr-chat-message-user-footer-color'
  | '--lr-transition-ambient',
  {
    'actions-outside-bubble'?: LyraChatMessage['actionsOutsideBubble'];
    'attachments-position'?: LyraChatMessage['attachmentsPosition'];
    'data-role'?: LyraChatMessage['role'];
    'message-id'?: LyraChatMessage['messageId'];
  }
>;

export type LyraChatViewportSvelteProps = LyraSvelteElementProps<
  LyraChatViewport,
  | 'accessibleLabel'
  | 'bottomThreshold'
  | 'follow'
  | 'label'
  | 'live'
  | 'locale'
  | 'strings'
  | 'unreadStartIndex',
  LyraChatViewportEventMap,
  | 'lr-follow-change',
never,
  {
    'aria-label'?: LyraChatViewport['accessibleLabel'];
    'bottom-threshold'?: LyraChatViewport['bottomThreshold'];
    'unread-start-index'?: LyraChatViewport['unreadStartIndex'];
  }
>;

export type LyraCheckboxSvelteProps = LyraSvelteElementProps<
  LyraCheckbox,
  | 'checked'
  | 'customError'
  | 'defaultChecked'
  | 'disabled'
  | 'errorText'
  | 'form'
  | 'helpText'
  | 'hint'
  | 'indeterminate'
  | 'locale'
  | 'name'
  | 'required'
  | 'size'
  | 'strings'
  | 'value',
  LyraCheckboxEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-blur'
  | 'lr-change'
  | 'lr-focus'
  | 'lr-input'
  | 'lr-invalid',
  | '--checked-icon-color'
  | '--checked-icon-scale'
  | '--lr-checkbox-active-border'
  | '--lr-checkbox-active-ring'
  | '--lr-checkbox-box-size'
  | '--lr-checkbox-checked-bg'
  | '--lr-checkbox-checked-border'
  | '--lr-checkbox-hover-border'
  | '--lr-checkbox-invalid-border'
  | '--lr-checkbox-label-indent',
  {
    'checked'?: LyraCheckbox['defaultChecked'];
    'custom-error'?: LyraCheckbox['customError'];
    'default-checked'?: LyraUnknownAttributeValue;
    'error-text'?: LyraCheckbox['errorText'];
    'help-text'?: LyraCheckbox['helpText'];
  }
>;

export type LyraCheckboxGroupSvelteProps = LyraSvelteElementProps<
  LyraCheckboxGroup,
  | 'accessibleLabel'
  | 'customError'
  | 'disabled'
  | 'errorText'
  | 'form'
  | 'hint'
  | 'label'
  | 'locale'
  | 'name'
  | 'orientation'
  | 'required'
  | 'size'
  | 'strings'
  | 'value'
  | 'withHint'
  | 'withLabel',
  LyraCheckboxGroupEventMap,
  | 'change'
  | 'input'
  | 'lr-change'
  | 'lr-invalid',
  | '--gap'
  | '--lr-checkbox-group-invalid-border'
  | '--lr-checkbox-group-option-gap'
  | '--lr-checkbox-group-row-gap'
  | '--lr-form-control-required-color'
  | '--lr-form-control-required-content'
  | '--lr-form-control-required-offset',
  {
    'aria-label'?: LyraCheckboxGroup['accessibleLabel'];
    'custom-error'?: LyraCheckboxGroup['customError'];
    'error-text'?: LyraCheckboxGroup['errorText'];
    'with-hint'?: LyraCheckboxGroup['withHint'];
    'with-label'?: LyraCheckboxGroup['withLabel'];
  }
>;

export type LyraCheckpointSvelteProps = LyraSvelteElementProps<
  LyraCheckpoint,
  | 'checkpointId'
  | 'confirmRestore'
  | 'formatTimestamp'
  | 'label'
  | 'locale'
  | 'restorable'
  | 'restoring'
  | 'strings'
  | 'timestamp',
  LyraCheckpointEventMap,
  | 'lr-restore',
  | '--lr-checkpoint-spin-duration',
  {
    'checkpoint-id'?: LyraCheckpoint['checkpointId'];
    'confirm-restore'?: LyraCheckpoint['confirmRestore'];
  }
>;

export type LyraChipSvelteProps = LyraSvelteElementProps<
  LyraChip,
  | 'disabled'
  | 'locale'
  | 'pill'
  | 'removable'
  | 'selected'
  | 'size'
  | 'strings'
  | 'toggleable'
  | 'value'
  | 'variant',
  LyraChipEventMap,
  | 'lr-chip-select'
  | 'lr-remove',
  | '--lr-chip-accent'
  | '--lr-chip-bg'
  | '--lr-chip-border'
  | '--lr-chip-font-size'
  | '--lr-chip-gap'
  | '--lr-chip-height'
  | '--lr-chip-icon-size'
  | '--lr-chip-min-height'
  | '--lr-chip-padding-block'
  | '--lr-chip-padding-inline'
  | '--lr-chip-pressed-bg'
  | '--lr-chip-pressed-border'
  | '--lr-chip-radius',
  {}
>;

export type LyraChipGroupSvelteProps = LyraSvelteElementProps<
  LyraChipGroup,
  | 'locale'
  | 'maxVisible'
  | 'strings',
  LyraChipGroupEventMap,
  | 'lr-overflow-toggle',
  | '--lr-chip-group-overflow-expanded-border-style'
  | '--lr-chip-group-overflow-expanded-color',
  {
    'max-visible'?: LyraChipGroup['maxVisible'];
  }
>;

export type LyraChunkInspectorSvelteProps = LyraSvelteElementProps<
  LyraChunkInspector,
  | 'activeId'
  | 'chunks'
  | 'compact'
  | 'label'
  | 'locale'
  | 'sort'
  | 'strings'
  | 'thresholds'
  | 'virtualizeAt',
  LyraChunkInspectorEventMap,
  | 'lr-chunk-open'
  | 'lr-expand',
  | '--lr-chunk-inspector-current-bg'
  | '--lr-chunk-inspector-current-color',
  {
    'active-id'?: LyraChunkInspector['activeId'];
    'virtualize-at'?: LyraChunkInspector['virtualizeAt'];
  }
>;

export type LyraCitationBadgeSvelteProps = LyraSvelteElementProps<
  LyraCitationBadge,
  | 'href'
  | 'index'
  | 'label'
  | 'locale'
  | 'sourceId'
  | 'status'
  | 'strings',
  LyraCitationBadgeEventMap,
  | 'lr-citation-activate'
  | 'lr-citation-open',
  | '--lr-citation-badge-accent'
  | '--lr-citation-badge-bg'
  | '--lr-citation-badge-border',
  {
    'source-id'?: LyraCitationBadge['sourceId'];
  }
>;

export type LyraClaimEvidenceSvelteProps = LyraSvelteElementProps<
  LyraClaimEvidence,
  | 'citations'
  | 'claims'
  | 'compact'
  | 'frame'
  | 'label'
  | 'locale'
  | 'selectedClaimId'
  | 'strings',
  LyraClaimEvidenceEventMap,
  | 'lr-citation-select'
  | 'lr-claim-select',
  | '--lr-claim-evidence-compact-gap'
  | '--lr-claim-evidence-compact-padding',
  {
    'selected-claim-id'?: LyraClaimEvidence['selectedClaimId'];
  }
>;

export type LyraCodeBlockSvelteProps = LyraSvelteElementProps<
  LyraCodeBlock,
  | 'accessibleLabel'
  | 'activeHighlightId'
  | 'code'
  | 'collapsed'
  | 'collapsible'
  | 'copyable'
  | 'filename'
  | 'highlightLines'
  | 'highlights'
  | 'interactiveLines'
  | 'language'
  | 'languages'
  | 'languagesOnly'
  | 'lineNumbers'
  | 'locale'
  | 'maxHeight'
  | 'strings',
  LyraCodeBlockEventMap,
  | 'lr-copy'
  | 'lr-line-click'
  | 'lr-text-select'
  | 'lr-toggle',
  | '--lr-code-block-active-line-outline-color'
  | '--lr-code-block-font'
  | '--lr-code-block-highlighted-line-bg'
  | '--lr-code-block-max-height'
  | '--lr-code-block-tab-size',
  {
    'active-highlight-id'?: LyraCodeBlock['activeHighlightId'];
    'aria-label'?: LyraCodeBlock['accessibleLabel'];
    'highlight-lines'?: LyraCodeBlock['highlightLines'];
    'interactive-lines'?: LyraCodeBlock['interactiveLines'];
    'languages-only'?: LyraCodeBlock['languagesOnly'];
    'line-numbers'?: LyraCodeBlock['lineNumbers'];
    'max-height'?: LyraCodeBlock['maxHeight'];
  }
>;

export type LyraCodeBlockCoreSvelteProps = LyraSvelteElementProps<
  LyraCodeBlockCore,
  | 'accessibleLabel'
  | 'activeHighlightId'
  | 'code'
  | 'collapsed'
  | 'collapsible'
  | 'copyable'
  | 'filename'
  | 'highlightLines'
  | 'highlights'
  | 'interactiveLines'
  | 'language'
  | 'languages'
  | 'lineNumbers'
  | 'locale'
  | 'maxHeight'
  | 'strings',
  LyraCodeBlockCoreEventMap,
  | 'lr-copy'
  | 'lr-line-click'
  | 'lr-text-select'
  | 'lr-toggle',
  | '--lr-code-block-active-line-outline-color'
  | '--lr-code-block-font'
  | '--lr-code-block-highlighted-line-bg'
  | '--lr-code-block-max-height'
  | '--lr-code-block-tab-size',
  {
    'active-highlight-id'?: LyraCodeBlockCore['activeHighlightId'];
    'aria-label'?: LyraCodeBlockCore['accessibleLabel'];
    'highlight-lines'?: LyraCodeBlockCore['highlightLines'];
    'interactive-lines'?: LyraCodeBlockCore['interactiveLines'];
    'line-numbers'?: LyraCodeBlockCore['lineNumbers'];
    'max-height'?: LyraCodeBlockCore['maxHeight'];
  }
>;

export type LyraCodeEditorSvelteProps = LyraSvelteElementProps<
  LyraCodeEditor,
  | 'accessibleLabel'
  | 'autocapitalize'
  | 'autoCorrect'
  | 'customError'
  | 'defaultValue'
  | 'disabled'
  | 'errorText'
  | 'form'
  | 'hint'
  | 'label'
  | 'language'
  | 'lineNumbers'
  | 'locale'
  | 'name'
  | 'placeholder'
  | 'readonly'
  | 'required'
  | 'resize'
  | 'selectionDirection'
  | 'selectionEnd'
  | 'selectionStart'
  | 'size'
  | 'spellcheck'
  | 'strings'
  | 'tabSize'
  | 'value'
  | 'wrap',
  LyraCodeEditorEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-invalid',
  | '--lr-code-editor-font-size'
  | '--lr-code-editor-hover-border'
  | '--lr-code-editor-invalid-border'
  | '--lr-code-editor-line-height'
  | '--lr-code-editor-min-block-size'
  | '--lr-code-editor-padding'
  | '--lr-code-editor-tab-size'
  | '--lr-form-control-required-color'
  | '--lr-form-control-required-content'
  | '--lr-form-control-required-offset',
  {
    'aria-label'?: LyraCodeEditor['accessibleLabel'];
    'autocorrect'?: LyraCodeEditor['autoCorrect'];
    'custom-error'?: LyraCodeEditor['customError'];
    'error-text'?: LyraCodeEditor['errorText'];
    'line-numbers'?: LyraCodeEditor['lineNumbers'];
    'tab-size'?: LyraCodeEditor['tabSize'];
    'value'?: LyraCodeEditor['defaultValue'];
  }
>;

export type LyraColorPickerSvelteProps = LyraSvelteElementProps<
  LyraColorPicker,
  | 'accessibleLabel'
  | 'customError'
  | 'defaultValue'
  | 'disabled'
  | 'errorText'
  | 'form'
  | 'format'
  | 'hint'
  | 'hoist'
  | 'inline'
  | 'label'
  | 'locale'
  | 'name'
  | 'noFormatToggle'
  | 'opacity'
  | 'open'
  | 'placement'
  | 'required'
  | 'size'
  | 'strings'
  | 'swatches'
  | 'uppercase'
  | 'value'
  | 'withHint'
  | 'withLabel'
  | 'withoutFormatToggle',
  LyraColorPickerEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-after-hide'
  | 'lr-after-show'
  | 'lr-blur'
  | 'lr-change'
  | 'lr-focus'
  | 'lr-hide'
  | 'lr-input'
  | 'lr-invalid'
  | 'lr-show',
  | '--grid-handle-size'
  | '--grid-height'
  | '--grid-width'
  | '--lr-color-picker-checker-color'
  | '--lr-color-picker-checker-size'
  | '--lr-color-picker-gap'
  | '--lr-color-picker-grid-block-size'
  | '--lr-color-picker-grid-handle-size'
  | '--lr-color-picker-grid-hue'
  | '--lr-color-picker-grid-inline-size'
  | '--lr-color-picker-hover-border-color'
  | '--lr-color-picker-hue-stops'
  | '--lr-color-picker-opacity-gradient'
  | '--lr-color-picker-palette-swatch-size'
  | '--lr-color-picker-radius'
  | '--lr-color-picker-selected-border'
  | '--lr-color-picker-selected-check-color'
  | '--lr-color-picker-slider-block-size'
  | '--lr-color-picker-slider-handle-size'
  | '--lr-color-picker-swatch-color'
  | '--lr-color-picker-swatch-size'
  | '--lr-form-control-required-color'
  | '--lr-form-control-required-content'
  | '--lr-form-control-required-offset'
  | '--slider-handle-size'
  | '--slider-height'
  | '--swatch-size',
  {
    'aria-label'?: LyraColorPicker['accessibleLabel'];
    'custom-error'?: LyraColorPicker['customError'];
    'default-value'?: LyraColorPicker['defaultValue'];
    'error-text'?: LyraColorPicker['errorText'];
    'no-format-toggle'?: LyraColorPicker['noFormatToggle'];
    'value'?: LyraColorPicker['defaultValue'];
    'with-hint'?: LyraColorPicker['withHint'];
    'with-label'?: LyraColorPicker['withLabel'];
    'without-format-toggle'?: LyraColorPicker['withoutFormatToggle'];
  }
>;

export type LyraComboboxSvelteProps = LyraSvelteElementProps<
  LyraCombobox,
  | 'allowCreate'
  | 'allowCustomValue'
  | 'appearance'
  | 'autocapitalize'
  | 'autocomplete'
  | 'autocorrect'
  | 'clearable'
  | 'customError'
  | 'disabled'
  | 'emptyText'
  | 'enterkeyhint'
  | 'enterKeyHint'
  | 'errorText'
  | 'filter'
  | 'form'
  | 'getTag'
  | 'hint'
  | 'inputmode'
  | 'inputMode'
  | 'inputValue'
  | 'label'
  | 'loadingText'
  | 'locale'
  | 'maxOptionsVisible'
  | 'maxRender'
  | 'multiple'
  | 'name'
  | 'open'
  | 'overflowText'
  | 'pill'
  | 'placeholder'
  | 'placement'
  | 'required'
  | 'selectionDirection'
  | 'selectionEnd'
  | 'selectionStart'
  | 'size'
  | 'source'
  | 'sourceDelay'
  | 'spellcheck'
  | 'strings'
  | 'validationTarget'
  | 'validators'
  | 'value'
  | 'withClear'
  | 'withHint'
  | 'withLabel',
  LyraComboboxEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-after-hide'
  | 'lr-after-show'
  | 'lr-change'
  | 'lr-clear'
  | 'lr-create'
  | 'lr-filter'
  | 'lr-hide'
  | 'lr-invalid'
  | 'lr-show',
  | '--hide-duration'
  | '--lr-combobox-expand-size'
  | '--lr-combobox-font-size'
  | '--lr-combobox-gap'
  | '--lr-combobox-option-active-bg'
  | '--lr-combobox-option-selected-bg'
  | '--lr-combobox-option-selected-border'
  | '--lr-combobox-option-selected-color'
  | '--lr-combobox-option-selected-font-weight'
  | '--lr-combobox-radius'
  | '--lr-combobox-tag-font-size'
  | '--lr-combobox-tag-padding'
  | '--lr-combobox-trigger-height'
  | '--lr-combobox-trigger-min-height'
  | '--lr-combobox-trigger-padding'
  | '--lr-form-control-required-color'
  | '--lr-form-control-required-content'
  | '--lr-form-control-required-offset'
  | '--show-duration'
  | '--tag-max-size',
  {
    'allow-create'?: LyraCombobox['allowCreate'];
    'allow-custom-value'?: LyraCombobox['allowCustomValue'];
    'custom-error'?: LyraCombobox['customError'];
    'empty-text'?: LyraCombobox['emptyText'];
    'enterkeyhint'?: LyraCombobox['enterKeyHint'];
    'error-text'?: LyraCombobox['errorText'];
    'inputmode'?: LyraCombobox['inputMode'];
    'loading-text'?: LyraCombobox['loadingText'];
    'max-options-visible'?: LyraCombobox['maxOptionsVisible'];
    'max-render'?: LyraCombobox['maxRender'];
    'overflow-text'?: LyraCombobox['overflowText'];
    'source-delay'?: LyraCombobox['sourceDelay'];
    'with-clear'?: LyraCombobox['withClear'];
    'with-hint'?: LyraCombobox['withHint'];
    'with-label'?: LyraCombobox['withLabel'];
  }
>;

export type LyraCommandPaletteSvelteProps = LyraSvelteElementProps<
  LyraCommandPalette,
  | 'accessibleLabel'
  | 'commands'
  | 'locale'
  | 'open'
  | 'shortcut'
  | 'strings',
  LyraCommandPaletteEventMap,
  | 'lr-close'
  | 'lr-open'
  | 'lr-select',
  | '--lr-command-palette-active-bg'
  | '--lr-command-palette-group-height'
  | '--lr-command-palette-list-max-block-size'
  | '--lr-command-palette-max-block-size'
  | '--lr-command-palette-max-inline-size'
  | '--lr-command-palette-offset-block-start'
  | '--lr-command-palette-row-height'
  | '--lr-command-palette-z-index',
  {
    'aria-label'?: LyraCommandPalette['accessibleLabel'];
  }
>;

export type LyraCommitCardSvelteProps = LyraSvelteElementProps<
  LyraCommitCard,
  | 'author'
  | 'compact'
  | 'copyable'
  | 'files'
  | 'filesCollapsed'
  | 'frame'
  | 'hash'
  | 'locale'
  | 'message'
  | 'strings'
  | 'timestamp',
  LyraCommitCardEventMap,
  | 'lr-copy'
  | 'lr-file-select'
  | 'lr-toggle',
  | '--lr-commit-card-compact-padding',
  {
    'files-collapsed'?: LyraCommitCard['filesCollapsed'];
  }
>;

export type LyraCommunityCardSvelteProps = LyraSvelteElementProps<
  LyraCommunityCard,
  | 'community'
  | 'compact'
  | 'frame'
  | 'locale'
  | 'maxMembers'
  | 'members'
  | 'strings',
  LyraCommunityCardEventMap,
  | 'lr-drill'
  | 'lr-entity-activate',
never,
  {
    'max-members'?: LyraCommunityCard['maxMembers'];
  }
>;

export type LyraComparePanelSvelteProps = LyraSvelteElementProps<
  LyraComparePanel,
  | 'disabled'
  | 'hideBothBad'
  | 'hideTie'
  | 'itemId'
  | 'labelA'
  | 'labelB'
  | 'locale'
  | 'strings'
  | 'syncScroll'
  | 'vote',
  LyraComparePanelEventMap,
  | 'lr-vote',
  | '--lr-compare-panel-max-height'
  | '--lr-compare-panel-selected-background'
  | '--lr-compare-panel-selected-border-color'
  | '--lr-compare-panel-selected-color'
  | '--lr-compare-panel-selected-font-weight',
  {
    'hide-both-bad'?: LyraComparePanel['hideBothBad'];
    'hide-tie'?: LyraComparePanel['hideTie'];
    'item-id'?: LyraComparePanel['itemId'];
    'label-a'?: LyraComparePanel['labelA'];
    'label-b'?: LyraComparePanel['labelB'];
    'sync-scroll'?: LyraComparePanel['syncScroll'];
  }
>;

export type LyraConfirmBarSvelteProps = LyraSvelteElementProps<
  LyraConfirmBar,
  | 'args'
  | 'compact'
  | 'decision'
  | 'frame'
  | 'heading'
  | 'locale'
  | 'pending'
  | 'strings'
  | 'toolName'
  | 'variant',
  LyraConfirmBarEventMap,
  | 'lr-approve'
  | 'lr-deny',
  | '--lr-confirm-bar-approved-color'
  | '--lr-confirm-bar-compact-gap'
  | '--lr-confirm-bar-compact-padding'
  | '--lr-confirm-bar-denied-color',
  {
    'tool-name'?: LyraConfirmBar['toolName'];
  }
>;

export type LyraContactViewerSvelteProps = LyraSvelteElementProps<
  LyraContactViewer,
  | 'activeHighlightId'
  | 'anchor'
  | 'headingLevel'
  | 'highlights'
  | 'locale'
  | 'maxHeight'
  | 'name'
  | 'src'
  | 'strings',
  LyraContactViewerEventMap,
  | 'lr-anchor-result'
  | 'lr-render-error'
  | 'lr-search-change'
  | 'lr-text-select',
  | '--lr-contact-viewer-max-height',
  {
    'active-highlight-id'?: LyraContactViewer['activeHighlightId'];
    'heading-level'?: LyraContactViewer['headingLevel'];
    'max-height'?: LyraContactViewer['maxHeight'];
  }
>;

export type LyraContextInspectorSvelteProps = LyraSvelteElementProps<
  LyraContextInspector,
  | 'filename'
  | 'formats'
  | 'label'
  | 'locale'
  | 'segments'
  | 'strings'
  | 'total',
  LyraContextInspectorEventMap,
  | 'lr-citation-activate'
  | 'lr-citation-open'
  | 'lr-copy'
  | 'lr-copy-error'
  | 'lr-error'
  | 'lr-export'
  | 'lr-export-complete'
  | 'lr-export-error'
  | 'lr-hide'
  | 'lr-show',
never,
  {}
>;

export type LyraContextMeterSvelteProps = LyraSvelteElementProps<
  LyraContextMeter,
  | 'label'
  | 'locale'
  | 'segments'
  | 'showLegend'
  | 'strings'
  | 'total'
  | 'variant',
  {},
never,
  | '--lr-context-meter-legend-swatch-size'
  | '--lr-context-meter-segment-color',
  {
    'show-legend'?: LyraContextMeter['showLegend'];
  }
>;

export type LyraControlGroupSvelteProps = LyraSvelteElementProps<
  LyraControlGroup,
  | 'label'
  | 'locale'
  | 'responsive'
  | 'strings',
  {},
never,
  | '--lr-control-group-gap',
  {}
>;

export type LyraConversationItemSvelteProps = LyraSvelteElementProps<
  LyraConversationItem,
  | 'active'
  | 'autocapitalize'
  | 'autoCorrect'
  | 'compact'
  | 'editable'
  | 'excerpt'
  | 'formatTimestamp'
  | 'locale'
  | 'spellcheck'
  | 'strings'
  | 'timestamp'
  | 'title',
  LyraConversationItemEventMap,
  | 'blur'
  | 'focus'
  | 'lr-rename'
  | 'lr-select',
  | '--lr-conversation-item-active-bg'
  | '--lr-conversation-item-active-color'
  | '--lr-conversation-item-active-indicator-color'
  | '--lr-conversation-item-active-indicator-inset-inline'
  | '--lr-conversation-item-active-indicator-width'
  | '--lr-conversation-item-compact-gap'
  | '--lr-conversation-item-compact-padding',
  {
    'autocorrect'?: LyraConversationItem['autoCorrect'];
  }
>;

export type LyraCopyButtonSvelteProps = LyraSvelteElementProps<
  LyraCopyButton,
  | 'accessibleLabel'
  | 'copyLabel'
  | 'disabled'
  | 'errorLabel'
  | 'feedbackDuration'
  | 'from'
  | 'hoist'
  | 'locale'
  | 'role'
  | 'strings'
  | 'successLabel'
  | 'tooltip'
  | 'tooltipPlacement'
  | 'value',
  LyraCopyButtonEventMap,
  | 'lr-copy'
  | 'lr-copy-error'
  | 'lr-error',
  | '--error-color'
  | '--success-color',
  {
    'aria-label'?: LyraCopyButton['accessibleLabel'];
    'copy-label'?: LyraCopyButton['copyLabel'];
    'error-label'?: LyraCopyButton['errorLabel'];
    'feedback-duration'?: LyraCopyButton['feedbackDuration'];
    'success-label'?: LyraCopyButton['successLabel'];
    'tooltip-placement'?: LyraCopyButton['tooltipPlacement'];
  }
>;

export type LyraCsvViewerSvelteProps = LyraSvelteElementProps<
  LyraCsvViewer,
  | 'activeHighlightId'
  | 'anchor'
  | 'hasHeaderRow'
  | 'highlights'
  | 'locale'
  | 'maxHeight'
  | 'name'
  | 'src'
  | 'strings',
  LyraCsvViewerEventMap,
  | 'lr-anchor-result'
  | 'lr-highlight-activate'
  | 'lr-render-error'
  | 'lr-search-change',
  | '--lr-csv-viewer-highlight-color'
  | '--lr-csv-viewer-max-height',
  {
    'active-highlight-id'?: LyraCsvViewer['activeHighlightId'];
    'has-header-row'?: LyraCsvViewer['hasHeaderRow'];
    'max-height'?: LyraCsvViewer['maxHeight'];
  }
>;

export type LyraDashboardGridSvelteProps = LyraSvelteElementProps<
  LyraDashboardGrid,
  | 'accessibleLabel'
  | 'cellsDraggable'
  | 'cellsResizable'
  | 'collision'
  | 'columns'
  | 'gap'
  | 'layout'
  | 'locale'
  | 'locked'
  | 'rowHeight'
  | 'strings',
  LyraDashboardGridEventMap,
  | 'lr-cell-move'
  | 'lr-cell-resize'
  | 'lr-collision'
  | 'lr-layout-change',
  | '--lr-dashboard-grid-cell-hover-outline-color'
  | '--lr-dashboard-grid-collision-outline-color'
  | '--lr-dashboard-grid-columns'
  | '--lr-dashboard-grid-gap'
  | '--lr-dashboard-grid-interaction-shadow'
  | '--lr-dashboard-grid-row-height',
  {
    'aria-label'?: LyraDashboardGrid['accessibleLabel'];
    'cells-draggable'?: LyraDashboardGrid['cellsDraggable'];
    'cells-resizable'?: LyraDashboardGrid['cellsResizable'];
    'row-height'?: LyraDashboardGrid['rowHeight'];
  }
>;

export type LyraDataGridSvelteProps = LyraSvelteElementProps<
  LyraDataGrid,
  | 'appearance'
  | 'childRows'
  | 'columnOrder'
  | 'columns'
  | 'data'
  | 'dataSource'
  | 'expandedKeys'
  | 'filterDebounce'
  | 'filterFromLeafRows'
  | 'filters'
  | 'groupBy'
  | 'label'
  | 'loading'
  | 'locale'
  | 'maxMultiSort'
  | 'page'
  | 'pageSize'
  | 'pageSizeOptions'
  | 'paginate'
  | 'pinnable'
  | 'reorderable'
  | 'resizable'
  | 'rowClass'
  | 'rowDetail'
  | 'rowKey'
  | 'searchFn'
  | 'searchTerm'
  | 'selectable'
  | 'selectableRows'
  | 'selectedKeys'
  | 'selectedRows'
  | 'server'
  | 'size'
  | 'sort'
  | 'sortDescFirst'
  | 'strings'
  | 'striped'
  | 'total'
  | 'withColumnMenu'
  | 'withColumnsMenu'
  | 'withoutSortRemoval'
  | 'withSearch',
  LyraDataGridEventMap,
  | 'blur'
  | 'focus'
  | 'lr-cell-click'
  | 'lr-cell-contextmenu'
  | 'lr-column-move'
  | 'lr-column-pin'
  | 'lr-column-resize'
  | 'lr-column-visibility-change'
  | 'lr-data-error'
  | 'lr-data-request'
  | 'lr-filter-change'
  | 'lr-page-change'
  | 'lr-row-collapse'
  | 'lr-row-expand'
  | 'lr-row-select'
  | 'lr-sort-change'
  | 'request',
  | '--accent-color'
  | '--background-color'
  | '--border-color'
  | '--border-radius'
  | '--border-width'
  | '--cell-padding'
  | '--focus-ring'
  | '--header-background'
  | '--header-row-height'
  | '--header-text-color'
  | '--indent-size'
  | '--max-height'
  | '--row-height'
  | '--row-hover-background'
  | '--selected-background'
  | '--stripe-background'
  | '--text-color'
  | '--transition-duration',
  {
    'child-rows'?: LyraDataGrid['childRows'];
    'filter-debounce'?: LyraDataGrid['filterDebounce'];
    'filter-from-leaf-rows'?: LyraDataGrid['filterFromLeafRows'];
    'group-by'?: LyraDataGrid['groupBy'];
    'max-multi-sort'?: LyraDataGrid['maxMultiSort'];
    'page-size'?: LyraDataGrid['pageSize'];
    'row-key'?: LyraDataGrid['rowKey'];
    'sort-desc-first'?: LyraDataGrid['sortDescFirst'];
    'with-column-menu'?: LyraDataGrid['withColumnMenu'];
    'with-columns-menu'?: LyraDataGrid['withColumnsMenu'];
    'with-search'?: LyraDataGrid['withSearch'];
    'without-sort-removal'?: LyraDataGrid['withoutSortRemoval'];
  }
>;

export type LyraDatasetViewerSvelteProps = LyraSvelteElementProps<
  LyraDatasetViewer,
  | 'activeHighlightId'
  | 'anchor'
  | 'highlights'
  | 'locale'
  | 'maxHeight'
  | 'name'
  | 'src'
  | 'strings',
  LyraDatasetViewerEventMap,
  | 'lr-anchor-result'
  | 'lr-highlight-activate'
  | 'lr-render-error'
  | 'lr-search-change',
  | '--lr-dataset-viewer-highlight-color'
  | '--lr-dataset-viewer-max-height',
  {
    'active-highlight-id'?: LyraDatasetViewer['activeHighlightId'];
    'max-height'?: LyraDatasetViewer['maxHeight'];
  }
>;

export type LyraDateInputSvelteProps = LyraSvelteElementProps<
  LyraDateInput,
  | 'accessibleLabel'
  | 'appearance'
  | 'assumeInteractionOn'
  | 'autocapitalize'
  | 'autocomplete'
  | 'autoCorrect'
  | 'clearLabel'
  | 'customError'
  | 'dayContent'
  | 'defaultValue'
  | 'dialogLabel'
  | 'disabled'
  | 'disabledDates'
  | 'disabledDaysOfWeek'
  | 'disableFuture'
  | 'disablePast'
  | 'distance'
  | 'enterKeyHint'
  | 'errorText'
  | 'firstDayOfWeek'
  | 'form'
  | 'hint'
  | 'inputMode'
  | 'isDateDisabled'
  | 'label'
  | 'locale'
  | 'max'
  | 'maxRange'
  | 'min'
  | 'minRange'
  | 'mode'
  | 'months'
  | 'name'
  | 'open'
  | 'openLabel'
  | 'pageBy'
  | 'pill'
  | 'placeholder'
  | 'placement'
  | 'readonly'
  | 'required'
  | 'selectionDirection'
  | 'selectionEnd'
  | 'selectionStart'
  | 'size'
  | 'spellcheck'
  | 'strings'
  | 'today'
  | 'validationTarget'
  | 'validators'
  | 'value'
  | 'valueAsDate'
  | 'valueAsRange'
  | 'weekdayFormat'
  | 'withClear'
  | 'withHint'
  | 'withLabel'
  | 'withOutsideDays'
  | 'withWeekNumbers',
  LyraDateInputEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-after-hide'
  | 'lr-after-show'
  | 'lr-clear'
  | 'lr-hide'
  | 'lr-invalid'
  | 'lr-show',
  | '--hide-duration'
  | '--lr-date-input-control-height'
  | '--lr-date-input-control-min-height'
  | '--lr-date-input-focus-border-color'
  | '--lr-date-input-font-size'
  | '--lr-date-input-gap'
  | '--lr-date-input-padding-block'
  | '--lr-date-input-padding-inline'
  | '--lr-date-input-placeholder-color'
  | '--lr-date-input-radius'
  | '--lr-form-control-required-color'
  | '--lr-form-control-required-content'
  | '--lr-form-control-required-offset'
  | '--show-duration',
  {
    'aria-label'?: LyraDateInput['accessibleLabel'];
    'autocorrect'?: LyraDateInput['autoCorrect'];
    'clear-label'?: LyraDateInput['clearLabel'];
    'custom-error'?: LyraDateInput['customError'];
    'dialog-label'?: LyraDateInput['dialogLabel'];
    'disable-future'?: LyraDateInput['disableFuture'];
    'disable-past'?: LyraDateInput['disablePast'];
    'disabled-dates'?: LyraDateInput['disabledDates'];
    'disabled-days-of-week'?: LyraDateInput['disabledDaysOfWeek'];
    'enterkeyhint'?: LyraDateInput['enterKeyHint'];
    'error-text'?: LyraDateInput['errorText'];
    'first-day-of-week'?: LyraDateInput['firstDayOfWeek'];
    'inputmode'?: LyraDateInput['inputMode'];
    'max-range'?: LyraDateInput['maxRange'];
    'min-range'?: LyraDateInput['minRange'];
    'open-label'?: LyraDateInput['openLabel'];
    'page-by'?: LyraDateInput['pageBy'];
    'value'?: LyraDateInput['defaultValue'];
    'weekday-format'?: LyraDateInput['weekdayFormat'];
    'with-clear'?: LyraDateInput['withClear'];
    'with-hint'?: LyraDateInput['withHint'];
    'with-label'?: LyraDateInput['withLabel'];
    'with-outside-days'?: LyraDateInput['withOutsideDays'];
    'with-week-numbers'?: LyraDateInput['withWeekNumbers'];
  }
>;

export type LyraDatePickerSvelteProps = LyraSvelteElementProps<
  LyraDatePicker,
  | 'dayContent'
  | 'disabled'
  | 'disabledDates'
  | 'disabledDaysOfWeek'
  | 'disableFuture'
  | 'disablePast'
  | 'firstDayOfWeek'
  | 'focusedDate'
  | 'isDateDisabled'
  | 'locale'
  | 'max'
  | 'maxRange'
  | 'min'
  | 'minRange'
  | 'mode'
  | 'months'
  | 'nextLabel'
  | 'pageBy'
  | 'previousLabel'
  | 'readonly'
  | 'size'
  | 'strings'
  | 'today'
  | 'value'
  | 'valueAsDate'
  | 'valueAsRange'
  | 'view'
  | 'weekdayFormat'
  | 'withOutsideDays'
  | 'withWeekNumbers',
  LyraDatePickerEventMap,
  | 'change'
  | 'input'
  | 'lr-focus-day'
  | 'lr-view-change',
  | '--lr-cell-size'
  | '--lr-date-picker-day-active-bg'
  | '--lr-date-picker-day-hover-bg'
  | '--lr-date-picker-day-outside-color'
  | '--lr-date-picker-disabled-color'
  | '--lr-date-picker-disabled-opacity'
  | '--lr-date-picker-header-gap'
  | '--lr-date-picker-month-gap'
  | '--lr-date-picker-nav-active-bg'
  | '--lr-date-picker-nav-hover-bg'
  | '--lr-date-picker-radius'
  | '--lr-date-picker-range-bg'
  | '--lr-date-picker-range-color'
  | '--lr-date-picker-range-preview-bg'
  | '--lr-date-picker-selected-bg'
  | '--lr-date-picker-selected-color'
  | '--lr-date-picker-title-active-bg'
  | '--lr-date-picker-title-active-color'
  | '--lr-date-picker-title-hover-color'
  | '--lr-date-picker-today-outline'
  | '--lr-date-picker-view-active-bg'
  | '--lr-date-picker-view-disabled-opacity'
  | '--lr-date-picker-view-hover-bg'
  | '--lr-date-picker-view-selected-bg'
  | '--lr-date-picker-view-selected-color'
  | '--lr-date-picker-view-today-outline',
  {
    'disable-future'?: LyraDatePicker['disableFuture'];
    'disable-past'?: LyraDatePicker['disablePast'];
    'disabled-dates'?: LyraDatePicker['disabledDates'];
    'disabled-days-of-week'?: LyraDatePicker['disabledDaysOfWeek'];
    'first-day-of-week'?: LyraDatePicker['firstDayOfWeek'];
    'focused-date'?: LyraDatePicker['focusedDate'];
    'max-range'?: LyraDatePicker['maxRange'];
    'min-range'?: LyraDatePicker['minRange'];
    'next-label'?: LyraDatePicker['nextLabel'];
    'page-by'?: LyraDatePicker['pageBy'];
    'previous-label'?: LyraDatePicker['previousLabel'];
    'weekday-format'?: LyraDatePicker['weekdayFormat'];
    'with-outside-days'?: LyraDatePicker['withOutsideDays'];
    'with-week-numbers'?: LyraDatePicker['withWeekNumbers'];
  }
>;

export type LyraDetailsSvelteProps = LyraSvelteElementProps<
  LyraDetails,
  | 'appearance'
  | 'disabled'
  | 'iconPlacement'
  | 'locale'
  | 'name'
  | 'open'
  | 'size'
  | 'strings'
  | 'summary',
  LyraDetailsEventMap,
  | 'lr-after-hide'
  | 'lr-after-show'
  | 'lr-hide'
  | 'lr-show'
  | 'lr-toggle',
  | '--hide-duration'
  | '--lr-details-filled-bg'
  | '--lr-details-filled-border-color'
  | '--lr-details-filled-outlined-bg'
  | '--lr-details-filled-outlined-border-color'
  | '--lr-details-font-size'
  | '--lr-details-gap'
  | '--lr-details-outlined-bg'
  | '--lr-details-outlined-border-color'
  | '--lr-details-radius'
  | '--lr-details-spacing'
  | '--lr-details-summary-active-bg'
  | '--lr-details-summary-hover-bg'
  | '--show-duration'
  | '--spacing',
  {
    'icon-placement'?: LyraDetails['iconPlacement'];
  }
>;

export type LyraDialogSvelteProps = LyraSvelteElementProps<
  LyraDialog,
  | 'accessibleLabel'
  | 'closable'
  | 'heading'
  | 'headingLevel'
  | 'label'
  | 'lightDismiss'
  | 'locale'
  | 'modal'
  | 'noHeader'
  | 'open'
  | 'strings'
  | 'withFooter'
  | 'withoutHeader',
  LyraDialogEventMap,
  | 'lr-after-hide'
  | 'lr-after-show'
  | 'lr-dialog-close'
  | 'lr-hide'
  | 'lr-initial-focus'
  | 'lr-request-close'
  | 'lr-show',
  | '--backdrop-filter'
  | '--body-spacing'
  | '--footer-spacing'
  | '--header-spacing'
  | '--hide-duration'
  | '--lr-dialog-backdrop-duration'
  | '--lr-dialog-backdrop-filter'
  | '--lr-dialog-max-width'
  | '--lr-dialog-overlay-color'
  | '--lr-dialog-panel-duration'
  | '--lr-dialog-spacing'
  | '--lr-dialog-spacing-block'
  | '--lr-dialog-width'
  | '--show-duration'
  | '--spacing'
  | '--width',
  {
    'accessible-label'?: LyraDialog['accessibleLabel'];
    'aria-label'?: LyraUnknownAttributeValue;
    'heading-level'?: LyraDialog['headingLevel'];
    'light-dismiss'?: LyraDialog['lightDismiss'];
    'no-header'?: LyraDialog['noHeader'];
    'with-footer'?: LyraDialog['withFooter'];
    'without-header'?: LyraDialog['withoutHeader'];
  }
>;

export type LyraDiffViewSvelteProps = LyraSvelteElementProps<
  LyraDiffView,
  | 'contextLines'
  | 'copyable'
  | 'language'
  | 'languages'
  | 'layout'
  | 'locale'
  | 'maxLines'
  | 'newText'
  | 'oldText'
  | 'strings',
  LyraDiffViewEventMap,
  | 'lr-copy'
  | 'lr-copy-error'
  | 'lr-error',
  | '--lr-diff-view-add-background'
  | '--lr-diff-view-add-color'
  | '--lr-diff-view-fold-background'
  | '--lr-diff-view-fold-color'
  | '--lr-diff-view-font'
  | '--lr-diff-view-remove-background'
  | '--lr-diff-view-remove-color',
  {
    'context-lines'?: LyraDiffView['contextLines'];
    'max-lines'?: LyraDiffView['maxLines'];
  }
>;

export type LyraDividerSvelteProps = LyraSvelteElementProps<
  LyraDivider,
  | 'locale'
  | 'orientation'
  | 'strings'
  | 'vertical',
  {},
never,
  | '--color'
  | '--spacing'
  | '--width',
  {}
>;

export type LyraDockPanelSvelteProps = LyraSvelteElementProps<
  LyraDockPanel,
  | 'collapsed'
  | 'collapsible'
  | 'edge'
  | 'extent'
  | 'locale'
  | 'maxExtent'
  | 'minExtent'
  | 'resizable'
  | 'strings',
  LyraDockPanelEventMap,
  | 'lr-collapse-change'
  | 'lr-collapse-request'
  | 'lr-resize',
  | '--lr-dock-panel-collapse-toggle-hover-bg'
  | '--lr-dock-panel-collapse-toggle-hover-color'
  | '--lr-dock-panel-collapsed-size'
  | '--lr-dock-panel-handle-active-color'
  | '--lr-dock-panel-handle-hover-color',
  {
    'max-extent'?: LyraDockPanel['maxExtent'];
    'min-extent'?: LyraDockPanel['minExtent'];
  }
>;

export type LyraDocumentCompareSvelteProps = LyraSvelteElementProps<
  LyraDocumentCompare,
  | 'anchor'
  | 'copyable'
  | 'diffLayout'
  | 'language'
  | 'languages'
  | 'locale'
  | 'newVersion'
  | 'oldVersion'
  | 'strings'
  | 'syncScroll'
  | 'view',
  LyraDocumentCompareEventMap,
  | 'lr-copy'
  | 'lr-download'
  | 'lr-highlight-activate'
  | 'lr-render-error',
  | '--lr-document-compare-pane-max-height',
  {
    'diff-layout'?: LyraDocumentCompare['diffLayout'];
    'sync-scroll'?: LyraDocumentCompare['syncScroll'];
  }
>;

export type LyraDocumentLibrarySvelteProps = LyraSvelteElementProps<
  LyraDocumentLibrary,
  | 'documents'
  | 'filter'
  | 'label'
  | 'loading'
  | 'locale'
  | 'selectedIds'
  | 'sortDirection'
  | 'sortKey'
  | 'strings'
  | 'tagFilter',
  LyraDocumentLibraryEventMap,
  | 'lr-filter-change'
  | 'lr-open'
  | 'lr-selection-change'
  | 'lr-sort',
never,
  {
    'sort-direction'?: LyraDocumentLibrary['sortDirection'];
    'sort-key'?: LyraDocumentLibrary['sortKey'];
  }
>;

export type LyraDocumentPreviewSvelteProps = LyraSvelteElementProps<
  LyraDocumentPreview,
  | 'activeHighlightId'
  | 'alt'
  | 'errorText'
  | 'filename'
  | 'highlights'
  | 'locale'
  | 'maxHeight'
  | 'mimeType'
  | 'progress'
  | 'src'
  | 'status'
  | 'strings'
  | 'suppressDownload'
  | 'zoomable',
  LyraDocumentPreviewEventMap,
  | 'lr-download'
  | 'lr-highlight-activate'
  | 'lr-render-error',
  | '--lr-document-preview-active-border'
  | '--lr-document-preview-font'
  | '--lr-document-preview-highlight-accent-color'
  | '--lr-document-preview-highlight-danger-color'
  | '--lr-document-preview-highlight-neutral-color'
  | '--lr-document-preview-highlight-success-color'
  | '--lr-document-preview-highlight-warning-color'
  | '--lr-document-preview-max-height'
  | '--lr-document-preview-progress'
  | '--lr-document-preview-spin-duration',
  {
    'active-highlight-id'?: LyraDocumentPreview['activeHighlightId'];
    'error-text'?: LyraDocumentPreview['errorText'];
    'max-height'?: LyraDocumentPreview['maxHeight'];
    'mime-type'?: LyraDocumentPreview['mimeType'];
  }
>;

export type LyraDocumentViewerSvelteProps = LyraSvelteElementProps<
  LyraDocumentViewer,
  | 'alt'
  | 'anchor'
  | 'highlights'
  | 'locale'
  | 'mimeType'
  | 'name'
  | 'open'
  | 'registry'
  | 'src'
  | 'strings',
  LyraDocumentViewerEventMap,
  | 'lr-anchor-result'
  | 'lr-close'
  | 'lr-download',
  | '--lr-document-viewer-max-height',
  {
    'mime-type'?: LyraDocumentViewer['mimeType'];
  }
>;

export type LyraDocxViewerSvelteProps = LyraSvelteElementProps<
  LyraDocxViewer,
  | 'activeHighlightId'
  | 'anchor'
  | 'highlights'
  | 'locale'
  | 'maxHeight'
  | 'name'
  | 'src'
  | 'strings',
  LyraDocxViewerEventMap,
  | 'lr-anchor-result'
  | 'lr-highlight-activate'
  | 'lr-render-error'
  | 'lr-search-change'
  | 'lr-text-select',
  | '--lr-docx-viewer-highlight-accent-background'
  | '--lr-docx-viewer-highlight-active-background'
  | '--lr-docx-viewer-highlight-active-outline'
  | '--lr-docx-viewer-highlight-danger-background'
  | '--lr-docx-viewer-highlight-neutral-background'
  | '--lr-docx-viewer-highlight-success-background'
  | '--lr-docx-viewer-highlight-warning-background'
  | '--lr-docx-viewer-max-height'
  | '--lr-docx-viewer-search-match-active-background'
  | '--lr-docx-viewer-search-match-active-foreground'
  | '--lr-docx-viewer-search-match-background',
  {
    'active-highlight-id'?: LyraDocxViewer['activeHighlightId'];
    'max-height'?: LyraDocxViewer['maxHeight'];
  }
>;

export type LyraDoughnutChartSvelteProps = LyraSvelteElementProps<
  LyraDoughnutChart,
  | 'accessibleDescription'
  | 'accessibleLabel'
  | 'area'
  | 'beginAtZero'
  | 'config'
  | 'dataLabels'
  | 'datasets'
  | 'description'
  | 'grid'
  | 'height'
  | 'hiddenDatasets'
  | 'indexAxis'
  | 'label'
  | 'labels'
  | 'legend'
  | 'legendPosition'
  | 'locale'
  | 'max'
  | 'min'
  | 'plugins'
  | 'showDataTable'
  | 'stacked'
  | 'stackTotals'
  | 'strings'
  | 'type'
  | 'valueFormatter'
  | 'withoutAnimation'
  | 'withoutLegend'
  | 'withoutTooltip'
  | 'xLabel'
  | 'y2Label'
  | 'yLabel'
  | 'zoom',
  LyraChartEventMap,
  | 'lr-before-legend-visibility-change'
  | 'lr-legend-visibility-change'
  | 'lr-point-click'
  | 'lr-zoom',
  | '--border-color-1'
  | '--border-color-2'
  | '--border-color-3'
  | '--border-color-4'
  | '--border-color-5'
  | '--border-color-6'
  | '--border-radius'
  | '--border-width'
  | '--fill-color-1'
  | '--fill-color-2'
  | '--fill-color-3'
  | '--fill-color-4'
  | '--fill-color-5'
  | '--fill-color-6'
  | '--grid-border-width'
  | '--grid-color'
  | '--line-border-width'
  | '--lr-chart-canvas-hover-outline-width'
  | '--lr-chart-data-table-button-active-bg'
  | '--lr-chart-data-table-button-hover-bg'
  | '--lr-chart-grid-color'
  | '--lr-chart-height'
  | '--lr-chart-legend-color'
  | '--lr-chart-legend-item-active-bg'
  | '--lr-chart-legend-item-hover-bg'
  | '--lr-chart-pattern-step'
  | '--lr-chart-reset-zoom-button-active-bg'
  | '--lr-chart-reset-zoom-button-hover-bg'
  | '--lr-chart-tick-color'
  | '--lr-chart-tooltip-bg'
  | '--lr-chart-tooltip-text'
  | '--point-radius',
  {
    'accessible-description'?: LyraDoughnutChart['accessibleDescription'];
    'accessible-label'?: LyraDoughnutChart['accessibleLabel'];
    'begin-at-zero'?: LyraDoughnutChart['beginAtZero'];
    'data-labels'?: LyraDoughnutChart['dataLabels'];
    'index-axis'?: LyraDoughnutChart['indexAxis'];
    'legend-position'?: LyraDoughnutChart['legendPosition'];
    'show-data-table'?: LyraDoughnutChart['showDataTable'];
    'stack-totals'?: LyraDoughnutChart['stackTotals'];
    'without-animation'?: LyraDoughnutChart['withoutAnimation'];
    'without-legend'?: LyraDoughnutChart['withoutLegend'];
    'without-tooltip'?: LyraDoughnutChart['withoutTooltip'];
    'x-label'?: LyraDoughnutChart['xLabel'];
    'y-label'?: LyraDoughnutChart['yLabel'];
    'y2-label'?: LyraDoughnutChart['y2Label'];
  }
>;

export type LyraDrawerSvelteProps = LyraSvelteElementProps<
  LyraDrawer,
  | 'accessibleLabel'
  | 'closable'
  | 'contained'
  | 'heading'
  | 'headingLevel'
  | 'label'
  | 'lightDismiss'
  | 'locale'
  | 'modal'
  | 'noHeader'
  | 'open'
  | 'placement'
  | 'strings'
  | 'withFooter'
  | 'withoutHeader',
  LyraDialogEventMap,
  | 'lr-after-hide'
  | 'lr-after-show'
  | 'lr-dialog-close'
  | 'lr-hide'
  | 'lr-initial-focus'
  | 'lr-request-close'
  | 'lr-show',
  | '--backdrop-filter'
  | '--body-spacing'
  | '--footer-spacing'
  | '--header-spacing'
  | '--hide-duration'
  | '--lr-dialog-backdrop-duration'
  | '--lr-dialog-backdrop-filter'
  | '--lr-dialog-max-width'
  | '--lr-dialog-overlay-color'
  | '--lr-dialog-panel-duration'
  | '--lr-dialog-spacing'
  | '--lr-dialog-spacing-block'
  | '--lr-dialog-width'
  | '--lr-drawer-enter-x'
  | '--lr-drawer-enter-y'
  | '--lr-drawer-height'
  | '--lr-drawer-width'
  | '--show-duration'
  | '--size'
  | '--spacing'
  | '--width',
  {
    'accessible-label'?: LyraDrawer['accessibleLabel'];
    'aria-label'?: LyraUnknownAttributeValue;
    'heading-level'?: LyraDrawer['headingLevel'];
    'light-dismiss'?: LyraDrawer['lightDismiss'];
    'no-header'?: LyraDrawer['noHeader'];
    'with-footer'?: LyraDrawer['withFooter'];
    'without-header'?: LyraDrawer['withoutHeader'];
  }
>;

export type LyraDrilldownPanelSvelteProps = LyraSvelteElementProps<
  LyraDrilldownPanel,
  | 'accessibleLabel'
  | 'communityLabel'
  | 'locale'
  | 'path'
  | 'showFocusButton'
  | 'strings'
  | 'types',
  LyraDrilldownPanelEventMap,
  | 'lr-drilldown-navigate',
never,
  {
    'aria-label'?: LyraDrilldownPanel['accessibleLabel'];
    'community-label'?: LyraDrilldownPanel['communityLabel'];
    'show-focus-button'?: LyraDrilldownPanel['showFocusButton'];
  }
>;

export type LyraDropdownSvelteProps = LyraSvelteElementProps<
  LyraDropdown,
  | 'accessibleLabel'
  | 'anchor'
  | 'arrow'
  | 'arrowPadding'
  | 'arrowPlacement'
  | 'containingElement'
  | 'disabled'
  | 'distance'
  | 'for'
  | 'hoist'
  | 'locale'
  | 'open'
  | 'placement'
  | 'popupRole'
  | 'size'
  | 'skidding'
  | 'stayOpenOnSelect'
  | 'strings'
  | 'sync'
  | 'withoutArrow',
  LyraDropdownEventMap,
  | 'lr-after-hide'
  | 'lr-after-show'
  | 'lr-hide'
  | 'lr-select'
  | 'lr-show',
  | '--arrow-size'
  | '--hide-duration'
  | '--lr-overlay-arrow-size'
  | '--lr-overlay-max-inline-size'
  | '--max-width'
  | '--show-duration',
  {
    'aria-label'?: LyraDropdown['accessibleLabel'];
    'arrow-padding'?: LyraDropdown['arrowPadding'];
    'arrow-placement'?: LyraDropdown['arrowPlacement'];
    'popup-role'?: LyraDropdown['popupRole'];
    'stay-open-on-select'?: LyraDropdown['stayOpenOnSelect'];
    'without-arrow'?: LyraDropdown['withoutArrow'];
  }
>;

export type LyraDropdownItemSvelteProps = LyraSvelteElementProps<
  LyraDropdownItem,
  | 'checked'
  | 'destructive'
  | 'disabled'
  | 'loading'
  | 'locale'
  | 'size'
  | 'strings'
  | 'submenuOpen'
  | 'type'
  | 'value'
  | 'variant',
  LyraDropdownItemEventMap,
  | 'blur'
  | 'focus'
  | 'lr-menu-item-change'
  | 'lr-menu-item-select'
  | 'lr-menu-item-state-change',
  | '--lr-menu-item-danger-active-bg'
  | '--lr-menu-item-danger-color'
  | '--lr-menu-item-danger-hover-bg'
  | '--lr-menu-item-gap'
  | '--lr-menu-item-radius'
  | '--submenu-offset',
  {
    'submenu-open'?: LyraDropdownItem['submenuOpen'];
    'submenuopen'?: LyraUnknownAttributeValue;
  }
>;

export type LyraEbookViewerSvelteProps = LyraSvelteElementProps<
  LyraEbookViewer,
  | 'activeHighlightId'
  | 'anchor'
  | 'highlights'
  | 'locale'
  | 'location'
  | 'maxHeight'
  | 'name'
  | 'src'
  | 'strings',
  LyraEbookViewerEventMap,
  | 'lr-anchor-result'
  | 'lr-highlight-activate'
  | 'lr-location-change'
  | 'lr-render-error'
  | 'lr-search-change'
  | 'lr-text-select',
  | '--lr-ebook-viewer-max-height',
  {
    'active-highlight-id'?: LyraEbookViewer['activeHighlightId'];
    'aria-label'?: LyraUnknownAttributeValue;
    'max-height'?: LyraEbookViewer['maxHeight'];
  }
>;

export type LyraEmailViewerSvelteProps = LyraSvelteElementProps<
  LyraEmailViewer,
  | 'activeHighlightId'
  | 'anchor'
  | 'foldQuotes'
  | 'highlights'
  | 'locale'
  | 'maxHeight'
  | 'name'
  | 'src'
  | 'strings',
  LyraEmailViewerEventMap,
  | 'lr-anchor-result'
  | 'lr-attachment-open'
  | 'lr-render-error'
  | 'lr-search-change'
  | 'lr-text-select',
  | '--lr-email-viewer-max-height',
  {
    'active-highlight-id'?: LyraEmailViewer['activeHighlightId'];
    'fold-quotes'?: LyraEmailViewer['foldQuotes'];
    'max-height'?: LyraEmailViewer['maxHeight'];
  }
>;

export type LyraEmbeddingExplorerSvelteProps = LyraSvelteElementProps<
  LyraEmbeddingExplorer,
  | 'accessibleLabel'
  | 'height'
  | 'locale'
  | 'points'
  | 'selectedId'
  | 'strings',
  LyraEmbeddingExplorerEventMap,
  | 'lr-point-select',
  | '--lr-embedding-explorer-height'
  | '--lr-embedding-explorer-selected-stroke',
  {
    'aria-label'?: LyraEmbeddingExplorer['accessibleLabel'];
    'selected-id'?: LyraEmbeddingExplorer['selectedId'];
  }
>;

export type LyraEmojiPickerSvelteProps = LyraSvelteElementProps<
  LyraEmojiPicker,
  | 'accessibleLabel'
  | 'customError'
  | 'defaultValue'
  | 'disabled'
  | 'errorText'
  | 'form'
  | 'groups'
  | 'hint'
  | 'label'
  | 'locale'
  | 'name'
  | 'required'
  | 'size'
  | 'strings'
  | 'value',
  LyraEmojiPickerEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-blur'
  | 'lr-change'
  | 'lr-focus'
  | 'lr-input'
  | 'lr-invalid',
  | '--lr-emoji-picker-active-bg'
  | '--lr-emoji-picker-control-gap'
  | '--lr-emoji-picker-gap'
  | '--lr-emoji-picker-glyph-size'
  | '--lr-emoji-picker-item-radius'
  | '--lr-emoji-picker-item-size'
  | '--lr-emoji-picker-radius'
  | '--lr-emoji-picker-row-height'
  | '--lr-emoji-picker-search-hover-border-color'
  | '--lr-form-control-required-color'
  | '--lr-form-control-required-content'
  | '--lr-form-control-required-offset',
  {
    'aria-label'?: LyraEmojiPicker['accessibleLabel'];
    'custom-error'?: LyraEmojiPicker['customError'];
    'error-text'?: LyraEmojiPicker['errorText'];
    'value'?: LyraEmojiPicker['defaultValue'];
  }
>;

export type LyraEmptySvelteProps = LyraSvelteElementProps<
  LyraEmpty,
  | 'compact'
  | 'description'
  | 'heading'
  | 'headingLevel'
  | 'locale'
  | 'strings',
  {},
never,
  | '--lr-empty-compact-align'
  | '--lr-empty-compact-font-size'
  | '--lr-empty-compact-gap'
  | '--lr-empty-compact-padding',
  {
    'heading-level'?: LyraEmpty['headingLevel'];
  }
>;

export type LyraEntityCardSvelteProps = LyraSvelteElementProps<
  LyraEntityCard,
  | 'communityLabel'
  | 'compact'
  | 'entity'
  | 'frame'
  | 'locale'
  | 'showFocusButton'
  | 'strings'
  | 'types',
  LyraEntityCardEventMap,
  | 'lr-entity-activate',
  | '--lr-entity-card-compact-gap'
  | '--lr-entity-card-compact-padding',
  {
    'community-label'?: LyraEntityCard['communityLabel'];
    'show-focus-button'?: LyraEntityCard['showFocusButton'];
  }
>;

export type LyraEntityChipSvelteProps = LyraSvelteElementProps<
  LyraEntityChip,
  | 'entityId'
  | 'label'
  | 'locale'
  | 'strings'
  | 'type'
  | 'typeLabel',
  LyraEntityChipEventMap,
  | 'lr-entity-activate'
  | 'lr-entity-open',
  | '--lr-entity-chip-bg'
  | '--lr-entity-chip-border'
  | '--lr-entity-chip-color',
  {
    'entity-id'?: LyraEntityChip['entityId'];
    'type-label'?: LyraEntityChip['typeLabel'];
  }
>;

export type LyraEntityDossierSvelteProps = LyraSvelteElementProps<
  LyraEntityDossier,
  | 'accessibleLabel'
  | 'chunks'
  | 'communityLabel'
  | 'confidence'
  | 'entity'
  | 'expandable'
  | 'groupByRelation'
  | 'locale'
  | 'neighbors'
  | 'provenance'
  | 'showFocusButton'
  | 'strings'
  | 'thresholds'
  | 'types',
  LyraEntityDossierEventMap,
  | 'lr-chunk-open'
  | 'lr-drill'
  | 'lr-entity-activate'
  | 'lr-entity-open'
  | 'lr-expand'
  | 'lr-node-expand'
  | 'lr-relation-activate'
  | 'lr-tab-show'
  | 'lr-toggle',
never,
  {
    'aria-label'?: LyraEntityDossier['accessibleLabel'];
    'community-label'?: LyraEntityDossier['communityLabel'];
    'group-by-relation'?: LyraEntityDossier['groupByRelation'];
    'show-focus-button'?: LyraEntityDossier['showFocusButton'];
  }
>;

export type LyraEnvListSvelteProps = LyraSvelteElementProps<
  LyraEnvList,
  | 'copyable'
  | 'entries'
  | 'label'
  | 'locale'
  | 'revealable'
  | 'strings',
  LyraEnvListEventMap,
  | 'lr-copy'
  | 'lr-reveal-change',
  | '--lr-env-list-reveal-active-bg'
  | '--lr-env-list-reveal-active-border',
  {}
>;

export type LyraEvalDatasetSvelteProps = LyraSvelteElementProps<
  LyraEvalDataset,
  | 'accept'
  | 'autocapitalize'
  | 'autocomplete'
  | 'autoCorrect'
  | 'disabled'
  | 'enterKeyHint'
  | 'examples'
  | 'exportFormats'
  | 'inputMode'
  | 'label'
  | 'locale'
  | 'searchable'
  | 'spellcheck'
  | 'strings',
  LyraEvalDatasetEventMap,
  | 'blur'
  | 'focus'
  | 'lr-example-add-request'
  | 'lr-example-remove-request'
  | 'lr-example-select'
  | 'lr-export-request'
  | 'lr-import-request',
never,
  {
    'autocorrect'?: LyraEvalDataset['autoCorrect'];
    'enterkeyhint'?: LyraEvalDataset['enterKeyHint'];
    'inputmode'?: LyraEvalDataset['inputMode'];
  }
>;

export type LyraEvalResultSvelteProps = LyraSvelteElementProps<
  LyraEvalResult,
  | 'baselineRunId'
  | 'columns'
  | 'disabled'
  | 'locale'
  | 'reviewSkippable'
  | 'rubricKeys'
  | 'runs'
  | 'selectedRunId'
  | 'strings',
  LyraEvalResultEventMap,
  | 'lr-review-input'
  | 'lr-review-skip'
  | 'lr-review-submit'
  | 'lr-review-validity-change'
  | 'lr-run-select',
never,
  {
    'baseline-run-id'?: LyraEvalResult['baselineRunId'];
    'review-skippable'?: LyraEvalResult['reviewSkippable'];
    'selected-run-id'?: LyraEvalResult['selectedRunId'];
  }
>;

export type LyraEvaluationRunSvelteProps = LyraSvelteElementProps<
  LyraEvaluationRun,
  | 'examples'
  | 'label'
  | 'locale'
  | 'strings'
  | 'total',
  LyraEvaluationRunEventMap,
  | 'lr-example-citation-select'
  | 'lr-example-toggle'
  | 'lr-example-tool-approval-decide',
never,
  {}
>;

export type LyraExportButtonSvelteProps = LyraSvelteElementProps<
  LyraExportButton,
  | 'accessibleLabel'
  | 'columns'
  | 'disabled'
  | 'filename'
  | 'formats'
  | 'label'
  | 'loading'
  | 'locale'
  | 'open'
  | 'rows'
  | 'strings',
  LyraExportButtonEventMap,
  | 'lr-export'
  | 'lr-export-complete'
  | 'lr-export-error'
  | 'lr-hide'
  | 'lr-show',
never,
  {
    'aria-label'?: LyraExportButton['accessibleLabel'];
  }
>;

export type LyraFileIconSvelteProps = LyraSvelteElementProps<
  LyraFileIcon,
  | 'bytes'
  | 'decorative'
  | 'label'
  | 'locale'
  | 'mimeType'
  | 'name'
  | 'strings'
  | 'variant',
  {},
never,
  | '--lr-file-icon-size',
  {
    'mime-type'?: LyraFileIcon['mimeType'];
  }
>;

export type LyraFileInputSvelteProps = LyraSvelteElementProps<
  LyraFileInput,
  | 'accept'
  | 'acceptedMessage'
  | 'accessibleLabel'
  | 'allowedMimeTypes'
  | 'capture'
  | 'compact'
  | 'customError'
  | 'directory'
  | 'disabled'
  | 'dragging'
  | 'errorText'
  | 'fileCount'
  | 'files'
  | 'forbiddenMimeTypes'
  | 'form'
  | 'hint'
  | 'label'
  | 'locale'
  | 'maxFileSize'
  | 'multiple'
  | 'name'
  | 'paste'
  | 'rejectedMessage'
  | 'required'
  | 'size'
  | 'strings'
  | 'validationTarget'
  | 'validators'
  | 'withError'
  | 'withHint'
  | 'withLabel',
  LyraFileInputEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-files'
  | 'lr-invalid',
  | '--lr-file-input-accept-bg'
  | '--lr-file-input-accept-border-color'
  | '--lr-file-input-compact-font-size'
  | '--lr-file-input-compact-gap'
  | '--lr-file-input-compact-padding'
  | '--lr-file-input-detail-font-size'
  | '--lr-file-input-dropzone-font-size'
  | '--lr-file-input-dropzone-icon-size'
  | '--lr-file-input-dropzone-padding'
  | '--lr-file-input-font-size'
  | '--lr-file-input-gap'
  | '--lr-file-input-radius'
  | '--lr-file-input-reject-bg'
  | '--lr-file-input-reject-border-color'
  | '--lr-form-control-required-color'
  | '--lr-form-control-required-content'
  | '--lr-form-control-required-offset',
  {
    'accepted-message'?: LyraFileInput['acceptedMessage'];
    'aria-label'?: LyraFileInput['accessibleLabel'];
    'custom-error'?: LyraFileInput['customError'];
    'error-text'?: LyraFileInput['errorText'];
    'max-file-size'?: LyraFileInput['maxFileSize'];
    'rejected-message'?: LyraFileInput['rejectedMessage'];
    'with-error'?: LyraFileInput['withError'];
    'with-hint'?: LyraFileInput['withHint'];
    'with-label'?: LyraFileInput['withLabel'];
  }
>;

export type LyraFileTreeSvelteProps = LyraSvelteElementProps<
  LyraFileTree,
  | 'label'
  | 'locale'
  | 'nodes'
  | 'selectedPath'
  | 'strings',
  LyraFileTreeEventMap,
  | 'lr-file-open'
  | 'lr-file-select'
  | 'lr-load-children',
never,
  {
    'selected-path'?: LyraFileTree['selectedPath'];
  }
>;

export type LyraFilterBarSvelteProps = LyraSvelteElementProps<
  LyraFilterBar,
  | 'disabled'
  | 'filters'
  | 'label'
  | 'loading'
  | 'locale'
  | 'strings'
  | 'value',
  LyraFilterBarEventMap,
  | 'lr-input'
  | 'lr-reset'
  | 'lr-validity-change',
never,
  {}
>;

export type LyraFlagSvelteProps = LyraSvelteElementProps<
  LyraFlag,
  | 'accessibleLabel'
  | 'country'
  | 'label'
  | 'language'
  | 'locale'
  | 'round'
  | 'src'
  | 'strings'
  | 'variant',
  {},
never,
  | '--lr-flag-aspect-ratio'
  | '--lr-flag-object-fit'
  | '--lr-flag-radius',
  {
    'aria-label'?: LyraFlag['accessibleLabel'];
  }
>;

export type LyraFlowCanvasSvelteProps = LyraSvelteElementProps<
  LyraFlowCanvas,
  | 'accessibleLabel'
  | 'connectable'
  | 'decorations'
  | 'droppable'
  | 'edges'
  | 'grid'
  | 'layerGap'
  | 'locale'
  | 'locked'
  | 'maxZoom'
  | 'minZoom'
  | 'nodeGap'
  | 'nodes'
  | 'nodesDraggable'
  | 'orientation'
  | 'selectedEdgeIds'
  | 'selectedNodeIds'
  | 'strings',
  LyraFlowCanvasEventMap,
  | 'lr-connect'
  | 'lr-edge-click'
  | 'lr-layout-change'
  | 'lr-node-add'
  | 'lr-node-click'
  | 'lr-node-move'
  | 'lr-selection-change'
  | 'lr-selection-delete'
  | 'lr-viewport-change',
  | '--lr-flow-canvas-drop-active-outline-color'
  | '--lr-flow-canvas-edge-accent-color'
  | '--lr-flow-canvas-edge-danger-color'
  | '--lr-flow-canvas-edge-neutral-color'
  | '--lr-flow-canvas-edge-success-color'
  | '--lr-flow-canvas-edge-warning-color'
  | '--lr-flow-canvas-grid-size'
  | '--lr-flow-canvas-march-duration'
  | '--lr-flow-canvas-node-connect-invalid-outline-color'
  | '--lr-flow-canvas-node-connect-target-outline-color'
  | '--lr-flow-canvas-node-hover-outline-color'
  | '--lr-flow-canvas-node-selected-outline-color',
  {
    'aria-label'?: LyraFlowCanvas['accessibleLabel'];
    'layer-gap'?: LyraFlowCanvas['layerGap'];
    'max-zoom'?: LyraFlowCanvas['maxZoom'];
    'min-zoom'?: LyraFlowCanvas['minZoom'];
    'node-gap'?: LyraFlowCanvas['nodeGap'];
    'nodes-draggable'?: LyraFlowCanvas['nodesDraggable'];
  }
>;

export type LyraFlowControlsSvelteProps = LyraSvelteElementProps<
  LyraFlowControls,
  | 'for'
  | 'frame'
  | 'hideLock'
  | 'locale'
  | 'orientation'
  | 'strings',
  {},
never,
  | '--lr-flow-controls-lock-active-color',
  {
    'hide-lock'?: LyraFlowControls['hideLock'];
  }
>;

export type LyraFlowMinimapSvelteProps = LyraSvelteElementProps<
  LyraFlowMinimap,
  | 'for'
  | 'label'
  | 'locale'
  | 'strings',
  {},
never,
  | '--lr-flow-minimap-block-size'
  | '--lr-flow-minimap-inline-size'
  | '--lr-flow-minimap-node-color'
  | '--lr-flow-minimap-node-denied-color'
  | '--lr-flow-minimap-node-error-color'
  | '--lr-flow-minimap-node-pending-color'
  | '--lr-flow-minimap-node-running-color'
  | '--lr-flow-minimap-node-success-color'
  | '--lr-flow-minimap-viewport-min-size',
  {}
>;

export type LyraFlowNodeSvelteProps = LyraSvelteElementProps<
  LyraFlowNode,
  | 'compact'
  | 'durationMs'
  | 'heading'
  | 'inputs'
  | 'locale'
  | 'nodeId'
  | 'orientation'
  | 'outputs'
  | 'progress'
  | 'selected'
  | 'status'
  | 'statusDetail'
  | 'strings',
  {},
never,
  | '--lr-flow-node-compact-gap'
  | '--lr-flow-node-compact-padding'
  | '--lr-flow-node-min-inline-size'
  | '--lr-flow-node-progress-fill-color'
  | '--lr-flow-node-progress-track-color'
  | '--lr-flow-node-running-border'
  | '--lr-flow-node-running-glow'
  | '--lr-flow-node-selected-border'
  | '--lr-flow-node-status-color'
  | '--lr-flow-node-status-denied-color'
  | '--lr-flow-node-status-error-color'
  | '--lr-flow-node-status-pending-color'
  | '--lr-flow-node-status-running-color'
  | '--lr-flow-node-status-success-color',
  {
    'duration-ms'?: LyraFlowNode['durationMs'];
    'node-id'?: LyraFlowNode['nodeId'];
    'status-detail'?: LyraFlowNode['statusDetail'];
  }
>;

export type LyraFlowRunOverlaySvelteProps = LyraSvelteElementProps<
  LyraFlowRunOverlay,
  | 'decorations'
  | 'for'
  | 'frame'
  | 'hideSummary'
  | 'label'
  | 'locale'
  | 'strings',
  {},
never,
  | '--lr-flow-run-overlay-status-color'
  | '--lr-flow-run-overlay-status-denied-color'
  | '--lr-flow-run-overlay-status-error-color'
  | '--lr-flow-run-overlay-status-pending-color'
  | '--lr-flow-run-overlay-status-running-color'
  | '--lr-flow-run-overlay-status-success-color',
  {
    'hide-summary'?: LyraFlowRunOverlay['hideSummary'];
  }
>;

export type LyraFormatBytesSvelteProps = LyraSvelteElementProps<
  LyraFormatBytes,
  | 'decimals'
  | 'display'
  | 'locale'
  | 'strings'
  | 'unit'
  | 'unitStep'
  | 'value',
  {},
never,
never,
  {
    'unit-step'?: LyraFormatBytes['unitStep'];
  }
>;

export type LyraFormatDateSvelteProps = LyraSvelteElementProps<
  LyraFormatDate,
  | 'date'
  | 'dateStyle'
  | 'day'
  | 'era'
  | 'hour'
  | 'hourFormat'
  | 'locale'
  | 'minute'
  | 'month'
  | 'second'
  | 'strings'
  | 'timeStyle'
  | 'timeZone'
  | 'timeZoneName'
  | 'weekday'
  | 'year',
  {},
never,
never,
  {
    'date-style'?: LyraFormatDate['dateStyle'];
    'hour-format'?: LyraFormatDate['hourFormat'];
    'time-style'?: LyraFormatDate['timeStyle'];
    'time-zone'?: LyraFormatDate['timeZone'];
    'time-zone-name'?: LyraFormatDate['timeZoneName'];
  }
>;

export type LyraFormatNumberSvelteProps = LyraSvelteElementProps<
  LyraFormatNumber,
  | 'currency'
  | 'currencyDisplay'
  | 'locale'
  | 'maximumFractionDigits'
  | 'maximumSignificantDigits'
  | 'minimumFractionDigits'
  | 'minimumIntegerDigits'
  | 'minimumSignificantDigits'
  | 'noGrouping'
  | 'notation'
  | 'strings'
  | 'type'
  | 'value'
  | 'withoutGrouping',
  {},
never,
never,
  {
    'currency-display'?: LyraFormatNumber['currencyDisplay'];
    'maximum-fraction-digits'?: LyraFormatNumber['maximumFractionDigits'];
    'maximum-significant-digits'?: LyraFormatNumber['maximumSignificantDigits'];
    'minimum-fraction-digits'?: LyraFormatNumber['minimumFractionDigits'];
    'minimum-integer-digits'?: LyraFormatNumber['minimumIntegerDigits'];
    'minimum-significant-digits'?: LyraFormatNumber['minimumSignificantDigits'];
    'no-grouping'?: LyraFormatNumber['noGrouping'];
    'without-grouping'?: LyraFormatNumber['withoutGrouping'];
  }
>;

export type LyraGaugeSvelteProps = LyraSvelteElementProps<
  LyraGauge,
  | 'label'
  | 'locale'
  | 'max'
  | 'min'
  | 'strings'
  | 'type'
  | 'value'
  | 'valueLabel',
  {},
never,
  | '--lr-gauge-fill',
  {}
>;

export type LyraGenerationStatusSvelteProps = LyraSvelteElementProps<
  LyraGenerationStatus,
  | 'active'
  | 'locale'
  | 'showStop'
  | 'startedAt'
  | 'strings'
  | 'tokenCount'
  | 'tokensPerSecond',
  LyraGenerationStatusEventMap,
  | 'lr-stop',
never,
  {
    'show-stop'?: LyraGenerationStatus['showStop'];
    'started-at'?: LyraGenerationStatus['startedAt'];
    'token-count'?: LyraGenerationStatus['tokenCount'];
    'tokens-per-second'?: LyraGenerationStatus['tokensPerSecond'];
  }
>;

export type LyraGeojsonViewSvelteProps = LyraSvelteElementProps<
  LyraGeojsonView,
  | 'activeHighlightId'
  | 'anchor'
  | 'highlights'
  | 'locale'
  | 'name'
  | 'src'
  | 'strings',
  LyraGeojsonViewEventMap,
  | 'lr-anchor-result'
  | 'lr-render-error'
  | 'lr-search-change'
  | 'lr-text-select',
never,
  {
    'active-highlight-id'?: LyraGeojsonView['activeHighlightId'];
  }
>;

export type LyraGraphSvelteProps = LyraSvelteElementProps<
  LyraGraph,
  | 'accessibleLabel'
  | 'chargeStrength'
  | 'communities'
  | 'dimmedLinkIds'
  | 'dimmedNodeIds'
  | 'edgeLabelMinZoom'
  | 'focusId'
  | 'height'
  | 'hiddenTypes'
  | 'layout'
  | 'linkDistance'
  | 'links'
  | 'locale'
  | 'maxZoom'
  | 'minZoom'
  | 'nodes'
  | 'nodeTypes'
  | 'renderer'
  | 'seed'
  | 'selectedLinkIds'
  | 'selectedNodeIds'
  | 'selectionMode'
  | 'showEdgeLabels'
  | 'strings'
  | 'width',
  LyraGraphEventMap,
  | 'lr-community-click'
  | 'lr-link-click'
  | 'lr-link-enter'
  | 'lr-link-leave'
  | 'lr-node-click'
  | 'lr-node-enter'
  | 'lr-node-expand'
  | 'lr-node-leave'
  | 'lr-selection-change'
  | 'lr-viewport-change',
  | '--lr-graph-cat-1'
  | '--lr-graph-cat-2'
  | '--lr-graph-cat-3'
  | '--lr-graph-cat-4'
  | '--lr-graph-cat-5'
  | '--lr-graph-cat-6'
  | '--lr-graph-cat-7'
  | '--lr-graph-cat-8'
  | '--lr-graph-dimmed-opacity'
  | '--lr-graph-edge-label-halo'
  | '--lr-graph-focus-halo-color'
  | '--lr-graph-hull-fill'
  | '--lr-graph-hull-opacity'
  | '--lr-graph-selected-color'
  | '--lr-link-color'
  | '--lr-node-fill',
  {
    'aria-label'?: LyraGraph['accessibleLabel'];
    'charge-strength'?: LyraGraph['chargeStrength'];
    'edge-label-min-zoom'?: LyraGraph['edgeLabelMinZoom'];
    'focus-id'?: LyraGraph['focusId'];
    'link-distance'?: LyraGraph['linkDistance'];
    'max-zoom'?: LyraGraph['maxZoom'];
    'min-zoom'?: LyraGraph['minZoom'];
    'selection-mode'?: LyraGraph['selectionMode'];
    'show-edge-labels'?: LyraGraph['showEdgeLabels'];
  }
>;

export type LyraGraphLegendSvelteProps = LyraSvelteElementProps<
  LyraGraphLegend,
  | 'counts'
  | 'hiddenTypes'
  | 'interactive'
  | 'label'
  | 'locale'
  | 'strings'
  | 'types',
  LyraGraphLegendEventMap,
  | 'lr-visibility-change',
  | '--lr-graph-legend-hidden-color'
  | '--lr-graph-legend-hidden-swatch-opacity',
  {}
>;

export type LyraGraphQueryBuilderSvelteProps = LyraSvelteElementProps<
  LyraGraphQueryBuilder,
  | 'customError'
  | 'disabled'
  | 'errorText'
  | 'form'
  | 'hint'
  | 'hopLimit'
  | 'label'
  | 'locale'
  | 'name'
  | 'nodeTypeOptions'
  | 'relationshipTypeOptions'
  | 'savedQueries'
  | 'strings'
  | 'value',
  LyraGraphQueryBuilderEventMap,
  | 'lr-input'
  | 'lr-invalid'
  | 'lr-query-delete'
  | 'lr-query-load'
  | 'lr-query-run'
  | 'lr-query-save'
  | 'lr-validity-change',
  | '--lr-graph-query-builder-run-active-bg'
  | '--lr-graph-query-builder-run-bg'
  | '--lr-graph-query-builder-run-border-color'
  | '--lr-graph-query-builder-run-color'
  | '--lr-graph-query-builder-run-hover-bg'
  | '--lr-graph-query-builder-save-active-bg'
  | '--lr-graph-query-builder-save-bg'
  | '--lr-graph-query-builder-save-border-color'
  | '--lr-graph-query-builder-save-color'
  | '--lr-graph-query-builder-save-hover-bg'
  | '--lr-graph-query-builder-saved-delete-active-bg'
  | '--lr-graph-query-builder-saved-delete-active-color'
  | '--lr-graph-query-builder-saved-delete-color'
  | '--lr-graph-query-builder-saved-delete-hover-color'
  | '--lr-graph-query-builder-saved-load-active-bg'
  | '--lr-graph-query-builder-saved-load-color',
  {
    'custom-error'?: LyraGraphQueryBuilder['customError'];
    'error-text'?: LyraGraphQueryBuilder['errorText'];
    'hop-limit'?: LyraGraphQueryBuilder['hopLimit'];
  }
>;

export type LyraGroundingSummarySvelteProps = LyraSvelteElementProps<
  LyraGroundingSummary,
  | 'assessment'
  | 'citations'
  | 'label'
  | 'locale'
  | 'showClaims'
  | 'strings'
  | 'thresholds',
  LyraGroundingSummaryEventMap,
  | 'lr-citation-select'
  | 'lr-claim-select',
never,
  {
    'show-claims'?: LyraGroundingSummary['showClaims'];
  }
>;

export type LyraHandoffDividerSvelteProps = LyraSvelteElementProps<
  LyraHandoffDivider,
  | 'agent'
  | 'fromAgent'
  | 'label'
  | 'locale'
  | 'strings',
  {},
never,
never,
  {
    'from-agent'?: LyraHandoffDivider['fromAgent'];
  }
>;

export type LyraHeatmapSvelteProps = LyraSvelteElementProps<
  LyraHeatmap,
  | 'accessibleCells'
  | 'annotations'
  | 'bucketCount'
  | 'cellColor'
  | 'cellInteractive'
  | 'cellSize'
  | 'cellText'
  | 'colLabels'
  | 'colorSteps'
  | 'columnX'
  | 'days'
  | 'firstDayOfWeek'
  | 'fitToWidth'
  | 'legendStops'
  | 'locale'
  | 'maxCellSize'
  | 'minCellSize'
  | 'mode'
  | 'monthLabelText'
  | 'rowLabels'
  | 'rowY'
  | 'scale'
  | 'selectedCell'
  | 'strings'
  | 'valueLabel'
  | 'values'
  | 'weekdayLabelText',
  LyraHeatmapEventMap,
  | 'lr-cell-click',
  | '--lr-heatmap-annotation-color'
  | '--lr-heatmap-color-steps-gradient'
  | '--lr-heatmap-focus-ring-color'
  | '--lr-heatmap-label-font'
  | '--lr-heatmap-no-data-fill'
  | '--lr-heatmap-scale-hi'
  | '--lr-heatmap-scale-lo'
  | '--lr-heatmap-selected-color'
  | '--lr-heatmap-tooltip-bg'
  | '--lr-heatmap-tooltip-text',
  {
    'accessible-cells'?: LyraHeatmap['accessibleCells'];
    'bucket-count'?: LyraHeatmap['bucketCount'];
    'cell-size'?: LyraHeatmap['cellSize'];
    'first-day-of-week'?: LyraHeatmap['firstDayOfWeek'];
    'fit-to-width'?: LyraHeatmap['fitToWidth'];
    'max-cell-size'?: LyraHeatmap['maxCellSize'];
    'min-cell-size'?: LyraHeatmap['minCellSize'];
    'value-label'?: LyraHeatmap['valueLabel'];
  }
>;

export type LyraHighlightLayerSvelteProps = LyraSvelteElementProps<
  LyraHighlightLayer,
  | 'activeId'
  | 'interactive'
  | 'items'
  | 'locale'
  | 'strings',
  LyraHighlightLayerEventMap,
  | 'lr-highlight-activate',
  | '--lr-highlight-layer-accent-background'
  | '--lr-highlight-layer-accent-outline'
  | '--lr-highlight-layer-danger-background'
  | '--lr-highlight-layer-danger-outline'
  | '--lr-highlight-layer-flash-background'
  | '--lr-highlight-layer-neutral-background'
  | '--lr-highlight-layer-neutral-outline'
  | '--lr-highlight-layer-success-background'
  | '--lr-highlight-layer-success-outline'
  | '--lr-highlight-layer-warning-background'
  | '--lr-highlight-layer-warning-outline',
  {
    'active-id'?: LyraHighlightLayer['activeId'];
  }
>;

export type LyraHistogramSvelteProps = LyraSvelteElementProps<
  LyraHistogram,
  | 'accessibleDescription'
  | 'accessibleLabel'
  | 'area'
  | 'beginAtZero'
  | 'bins'
  | 'config'
  | 'dataLabels'
  | 'datasets'
  | 'description'
  | 'grid'
  | 'height'
  | 'hiddenDatasets'
  | 'indexAxis'
  | 'label'
  | 'labels'
  | 'legend'
  | 'legendPosition'
  | 'locale'
  | 'max'
  | 'min'
  | 'plugins'
  | 'showDataTable'
  | 'stacked'
  | 'stackTotals'
  | 'strings'
  | 'type'
  | 'valueFormatter'
  | 'values'
  | 'withoutAnimation'
  | 'withoutLegend'
  | 'withoutTooltip'
  | 'xLabel'
  | 'y2Label'
  | 'yLabel'
  | 'zoom',
  LyraChartEventMap,
  | 'lr-before-legend-visibility-change'
  | 'lr-legend-visibility-change'
  | 'lr-point-click'
  | 'lr-zoom',
  | '--border-color-1'
  | '--border-color-2'
  | '--border-color-3'
  | '--border-color-4'
  | '--border-color-5'
  | '--border-color-6'
  | '--border-radius'
  | '--border-width'
  | '--fill-color-1'
  | '--fill-color-2'
  | '--fill-color-3'
  | '--fill-color-4'
  | '--fill-color-5'
  | '--fill-color-6'
  | '--grid-border-width'
  | '--grid-color'
  | '--line-border-width'
  | '--lr-chart-canvas-hover-outline-width'
  | '--lr-chart-data-table-button-active-bg'
  | '--lr-chart-data-table-button-hover-bg'
  | '--lr-chart-grid-color'
  | '--lr-chart-height'
  | '--lr-chart-legend-color'
  | '--lr-chart-legend-item-active-bg'
  | '--lr-chart-legend-item-hover-bg'
  | '--lr-chart-pattern-step'
  | '--lr-chart-reset-zoom-button-active-bg'
  | '--lr-chart-reset-zoom-button-hover-bg'
  | '--lr-chart-tick-color'
  | '--lr-chart-tooltip-bg'
  | '--lr-chart-tooltip-text'
  | '--point-radius',
  {
    'accessible-description'?: LyraHistogram['accessibleDescription'];
    'accessible-label'?: LyraHistogram['accessibleLabel'];
    'begin-at-zero'?: LyraHistogram['beginAtZero'];
    'data-labels'?: LyraHistogram['dataLabels'];
    'index-axis'?: LyraHistogram['indexAxis'];
    'legend-position'?: LyraHistogram['legendPosition'];
    'show-data-table'?: LyraHistogram['showDataTable'];
    'stack-totals'?: LyraHistogram['stackTotals'];
    'without-animation'?: LyraHistogram['withoutAnimation'];
    'without-legend'?: LyraHistogram['withoutLegend'];
    'without-tooltip'?: LyraHistogram['withoutTooltip'];
    'x-label'?: LyraHistogram['xLabel'];
    'y-label'?: LyraHistogram['yLabel'];
    'y2-label'?: LyraHistogram['y2Label'];
  }
>;

export type LyraHtmlViewerSvelteProps = LyraSvelteElementProps<
  LyraHtmlViewer,
  | 'activeHighlightId'
  | 'anchor'
  | 'highlights'
  | 'locale'
  | 'maxHeight'
  | 'name'
  | 'src'
  | 'strings',
  LyraHtmlViewerEventMap,
  | 'lr-anchor-result'
  | 'lr-render-error'
  | 'lr-search-change'
  | 'lr-text-select',
  | '--lr-html-viewer-max-height',
  {
    'active-highlight-id'?: LyraHtmlViewer['activeHighlightId'];
    'max-height'?: LyraHtmlViewer['maxHeight'];
  }
>;

export type LyraIconSvelteProps = LyraSvelteElementProps<
  LyraIcon,
  | 'animation'
  | 'autoWidth'
  | 'canvas'
  | 'family'
  | 'fixedWidth'
  | 'flip'
  | 'label'
  | 'library'
  | 'locale'
  | 'name'
  | 'path'
  | 'rotate'
  | 'src'
  | 'strings'
  | 'swapOpacity'
  | 'variant',
  LyraIconEventMap,
  | 'lr-error'
  | 'lr-load',
  | '--animation-delay'
  | '--animation-direction'
  | '--animation-duration'
  | '--animation-iteration-count'
  | '--animation-timing'
  | '--beat-fade-opacity'
  | '--beat-fade-scale'
  | '--beat-scale'
  | '--bounce-anticipation'
  | '--bounce-height'
  | '--bounce-jump-scale-x'
  | '--bounce-jump-scale-y'
  | '--bounce-land-scale-x'
  | '--bounce-land-scale-y'
  | '--bounce-rebound'
  | '--bounce-start-scale-x'
  | '--bounce-start-scale-y'
  | '--buzz-distance'
  | '--fade-opacity'
  | '--flip-angle'
  | '--flip-anticipation-scale'
  | '--flip-overshoot'
  | '--flip-x'
  | '--flip-y'
  | '--flip-z'
  | '--float-drift'
  | '--float-height'
  | '--float-squash-x'
  | '--float-squash-y'
  | '--float-stretch-x'
  | '--float-stretch-y'
  | '--float-tilt'
  | '--jello-scale-x'
  | '--jello-scale-y'
  | '--lr-icon-fixed-width'
  | '--lr-icon-flip-x'
  | '--lr-icon-flip-y'
  | '--lr-icon-rotate'
  | '--lr-icon-size'
  | '--primary-color'
  | '--primary-opacity'
  | '--secondary-color'
  | '--secondary-opacity'
  | '--swing-angle'
  | '--wag-angle',
  {
    'auto-width'?: LyraIcon['autoWidth'];
    'fixed-width'?: LyraIcon['fixedWidth'];
    'swap-opacity'?: LyraIcon['swapOpacity'];
  }
>;

export type LyraIconButtonSvelteProps = LyraSvelteElementProps<
  LyraIconButton,
  | 'accessibleLabel'
  | 'disabled'
  | 'download'
  | 'form'
  | 'href'
  | 'icon'
  | 'label'
  | 'library'
  | 'locale'
  | 'name'
  | 'src'
  | 'strings'
  | 'target'
  | 'type',
  LyraIconButtonEventMap,
  | 'blur'
  | 'focus'
  | 'lr-blur'
  | 'lr-focus',
  | '--lr-icon-button-background'
  | '--lr-icon-button-background-active'
  | '--lr-icon-button-background-hover'
  | '--lr-icon-button-border'
  | '--lr-icon-button-border-active'
  | '--lr-icon-button-border-hover'
  | '--lr-icon-button-color'
  | '--lr-icon-button-color-active'
  | '--lr-icon-button-color-hover'
  | '--lr-icon-button-radius'
  | '--lr-icon-button-size',
  {
    'aria-controls'?: LyraUnknownAttributeValue;
    'aria-describedby'?: LyraUnknownAttributeValue;
    'aria-expanded'?: LyraUnknownAttributeValue;
    'aria-haspopup'?: LyraUnknownAttributeValue;
    'aria-label'?: LyraIconButton['accessibleLabel'];
  }
>;

export type LyraImageComparerSvelteProps = LyraSvelteElementProps<
  LyraImageComparer,
  | 'accessibleLabel'
  | 'afterLabel'
  | 'beforeLabel'
  | 'locale'
  | 'orientation'
  | 'position'
  | 'strings',
  LyraImageComparerEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-blur'
  | 'lr-change'
  | 'lr-focus'
  | 'lr-position-change',
  | '--divider-width'
  | '--handle-size'
  | '--lr-image-comparer-divider-width'
  | '--lr-image-comparer-handle-size',
  {
    'after-label'?: LyraImageComparer['afterLabel'];
    'aria-label'?: LyraImageComparer['accessibleLabel'];
    'before-label'?: LyraImageComparer['beforeLabel'];
  }
>;

export type LyraImageViewerSvelteProps = LyraSvelteElementProps<
  LyraImageViewer,
  | 'activeHighlightId'
  | 'alt'
  | 'anchor'
  | 'annotatable'
  | 'fit'
  | 'highlights'
  | 'locale'
  | 'maxZoom'
  | 'minZoom'
  | 'name'
  | 'resetZoom'
  | 'rotation'
  | 'src'
  | 'strings'
  | 'zoom'
  | 'zoomIn'
  | 'zoomOut'
  | 'zoomStep',
  LyraImageViewerEventMap,
  | 'lr-anchor-result'
  | 'lr-annotation-create'
  | 'lr-fit-change'
  | 'lr-highlight-activate'
  | 'lr-load'
  | 'lr-render-error'
  | 'lr-rotation-change'
  | 'lr-zoom-change',
  | '--lr-image-viewer-annotate-active-bg'
  | '--lr-image-viewer-annotate-active-border'
  | '--lr-image-viewer-highlight-active-border-width'
  | '--lr-image-viewer-highlight-active-color'
  | '--lr-image-viewer-highlight-active-outline-offset'
  | '--lr-image-viewer-highlight-active-outline-width'
  | '--lr-image-viewer-highlight-bg'
  | '--lr-image-viewer-highlight-border'
  | '--lr-image-viewer-highlight-danger-bg'
  | '--lr-image-viewer-highlight-danger-border'
  | '--lr-image-viewer-highlight-fill'
  | '--lr-image-viewer-highlight-neutral-bg'
  | '--lr-image-viewer-highlight-neutral-border'
  | '--lr-image-viewer-highlight-success-bg'
  | '--lr-image-viewer-highlight-success-border'
  | '--lr-image-viewer-highlight-warning-bg'
  | '--lr-image-viewer-highlight-warning-border',
  {
    'active-highlight-id'?: LyraImageViewer['activeHighlightId'];
    'max-zoom'?: LyraImageViewer['maxZoom'];
    'min-zoom'?: LyraImageViewer['minZoom'];
    'zoom-step'?: LyraImageViewer['zoomStep'];
  }
>;

export type LyraIncludeSvelteProps = LyraSvelteElementProps<
  LyraInclude,
  | 'activeHighlightId'
  | 'anchor'
  | 'cache'
  | 'highlights'
  | 'locale'
  | 'mode'
  | 'src'
  | 'strings',
  LyraIncludeEventMap,
  | 'lr-anchor-result'
  | 'lr-error'
  | 'lr-include-error'
  | 'lr-load'
  | 'lr-search-change'
  | 'lr-text-select',
never,
  {
    'active-highlight-id'?: LyraInclude['activeHighlightId'];
  }
>;

export type LyraIngestionQueueSvelteProps = LyraSvelteElementProps<
  LyraIngestionQueue,
  | 'items'
  | 'label'
  | 'locale'
  | 'strings'
  | 'virtualizeAt',
  LyraIngestionQueueEventMap,
  | 'lr-cancel'
  | 'lr-retry',
  | '--lr-ingestion-queue-max-height',
  {
    'virtualize-at'?: LyraIngestionQueue['virtualizeAt'];
  }
>;

export type LyraInputSvelteProps = LyraSvelteElementProps<
  LyraInput,
  | 'accessibleLabel'
  | 'appearance'
  | 'autocapitalize'
  | 'autocomplete'
  | 'autocorrect'
  | 'autofocus'
  | 'clearable'
  | 'customError'
  | 'defaultValue'
  | 'disabled'
  | 'enterkeyhint'
  | 'enterKeyHint'
  | 'errorText'
  | 'filled'
  | 'form'
  | 'helpText'
  | 'hint'
  | 'inputmode'
  | 'inputMode'
  | 'label'
  | 'locale'
  | 'max'
  | 'maxlength'
  | 'min'
  | 'minlength'
  | 'name'
  | 'noSpinButtons'
  | 'passwordToggle'
  | 'passwordVisible'
  | 'pattern'
  | 'pill'
  | 'placeholder'
  | 'readonly'
  | 'required'
  | 'selectionEnd'
  | 'selectionStart'
  | 'size'
  | 'spellcheck'
  | 'step'
  | 'strings'
  | 'title'
  | 'type'
  | 'value'
  | 'valueAsDate'
  | 'valueAsNumber'
  | 'withClear'
  | 'withHint'
  | 'withLabel'
  | 'withoutSpinButtons',
  LyraInputEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-blur'
  | 'lr-change'
  | 'lr-clear'
  | 'lr-focus'
  | 'lr-input'
  | 'lr-invalid',
  | '--lr-form-control-required-color'
  | '--lr-form-control-required-content'
  | '--lr-form-control-required-offset'
  | '--lr-input-action-active-bg'
  | '--lr-input-action-active-color'
  | '--lr-input-action-color'
  | '--lr-input-action-hover-color'
  | '--lr-input-border-color'
  | '--lr-input-control-height'
  | '--lr-input-control-min-height'
  | '--lr-input-fill'
  | '--lr-input-focus-border-color'
  | '--lr-input-font-size'
  | '--lr-input-gap'
  | '--lr-input-padding-block'
  | '--lr-input-padding-inline'
  | '--lr-input-radius',
  {
    'aria-label'?: LyraInput['accessibleLabel'];
    'custom-error'?: LyraInput['customError'];
    'default-value'?: LyraInput['defaultValue'];
    'enterkeyhint'?: LyraInput['enterKeyHint'];
    'error-text'?: LyraInput['errorText'];
    'help-text'?: LyraInput['helpText'];
    'inputmode'?: LyraInput['inputMode'];
    'no-spin-buttons'?: LyraInput['noSpinButtons'];
    'password-toggle'?: LyraInput['passwordToggle'];
    'password-visible'?: LyraInput['passwordVisible'];
    'value'?: LyraInput['defaultValue'];
    'with-clear'?: LyraInput['withClear'];
    'with-hint'?: LyraInput['withHint'];
    'with-label'?: LyraInput['withLabel'];
    'without-spin-buttons'?: LyraInput['withoutSpinButtons'];
  }
>;

export type LyraIntersectionObserverSvelteProps = LyraSvelteElementProps<
  LyraIntersectionObserver,
  | 'disabled'
  | 'intersectClass'
  | 'locale'
  | 'once'
  | 'root'
  | 'rootMargin'
  | 'strings'
  | 'threshold',
  LyraIntersectionObserverEventMap,
  | 'lr-intersect'
  | 'lr-intersection',
never,
  {
    'intersect-class'?: LyraIntersectionObserver['intersectClass'];
    'root-margin'?: LyraIntersectionObserver['rootMargin'];
  }
>;

export type LyraJsonViewerSvelteProps = LyraSvelteElementProps<
  LyraJsonViewer,
  | 'collapsedDepth'
  | 'copyable'
  | 'data'
  | 'locale'
  | 'maxHeight'
  | 'search'
  | 'strings',
  LyraJsonViewerEventMap,
  | 'lr-copy'
  | 'lr-search-change',
  | '--lr-json-viewer-active-outline'
  | '--lr-json-viewer-boolean-color'
  | '--lr-json-viewer-font'
  | '--lr-json-viewer-match-bg'
  | '--lr-json-viewer-max-height'
  | '--lr-json-viewer-null-color'
  | '--lr-json-viewer-number-color'
  | '--lr-json-viewer-row-hover-bg'
  | '--lr-json-viewer-string-color',
  {
    'collapsed-depth'?: LyraJsonViewer['collapsedDepth'];
    'max-height'?: LyraJsonViewer['maxHeight'];
  }
>;

export type LyraKbdSvelteProps = LyraSvelteElementProps<
  LyraKbd,
  | 'keys'
  | 'locale'
  | 'strings',
  {},
never,
never,
  {}
>;

export type LyraKnowledgeBaseSvelteProps = LyraSvelteElementProps<
  LyraKnowledgeBase,
  | 'hideCreate'
  | 'hideSummary'
  | 'label'
  | 'locale'
  | 'sources'
  | 'strings',
  LyraKnowledgeBaseEventMap,
  | 'lr-source-create'
  | 'lr-source-delete'
  | 'lr-source-pause'
  | 'lr-source-sync',
never,
  {
    'hide-create'?: LyraKnowledgeBase['hideCreate'];
    'hide-summary'?: LyraKnowledgeBase['hideSummary'];
  }
>;

export type LyraKnowledgeBaseAdminSvelteProps = LyraSvelteElementProps<
  LyraKnowledgeBaseAdmin,
  | 'activeTab'
  | 'hideIngestion'
  | 'ingestionItems'
  | 'label'
  | 'locale'
  | 'sources'
  | 'strings',
  LyraKnowledgeBaseAdminEventMap,
  | 'lr-ingestion-cancel'
  | 'lr-ingestion-retry'
  | 'lr-source-create'
  | 'lr-source-delete'
  | 'lr-source-pause'
  | 'lr-source-sync'
  | 'lr-tab-change',
  | '--lr-knowledge-base-admin-tab-selected-border'
  | '--lr-knowledge-base-admin-tab-selected-color',
  {
    'active-tab'?: LyraKnowledgeBaseAdmin['activeTab'];
    'hide-ingestion'?: LyraKnowledgeBaseAdmin['hideIngestion'];
  }
>;

export type LyraKnowledgeGraphExplorerSvelteProps = LyraSvelteElementProps<
  LyraKnowledgeGraphExplorer,
  | 'communities'
  | 'entityDetails'
  | 'height'
  | 'hiddenTypes'
  | 'highlight'
  | 'label'
  | 'links'
  | 'locale'
  | 'nodes'
  | 'nodeTypes'
  | 'path'
  | 'pinnedNodeIds'
  | 'renderer'
  | 'searchQuery'
  | 'selectedNodeId'
  | 'strings'
  | 'width',
  LyraKnowledgeGraphExplorerEventMap,
  | 'lr-community-click'
  | 'lr-link-click'
  | 'lr-node-click'
  | 'lr-node-expand'
  | 'lr-path-request'
  | 'lr-pin-change'
  | 'lr-relation-activate'
  | 'lr-search-change'
  | 'lr-selection-change',
never,
  {
    'search-query'?: LyraKnowledgeGraphExplorer['searchQuery'];
    'selected-node-id'?: LyraKnowledgeGraphExplorer['selectedNodeId'];
  }
>;

export type LyraKnownDateSvelteProps = LyraSvelteElementProps<
  LyraKnownDate,
  | 'accessibleLabel'
  | 'appearance'
  | 'autocomplete'
  | 'customError'
  | 'dayLabel'
  | 'defaultValue'
  | 'disabled'
  | 'errorText'
  | 'form'
  | 'hint'
  | 'label'
  | 'locale'
  | 'max'
  | 'min'
  | 'monthLabel'
  | 'name'
  | 'parts'
  | 'pill'
  | 'readonly'
  | 'required'
  | 'size'
  | 'strings'
  | 'value'
  | 'valueAsDate'
  | 'valueInput'
  | 'withHint'
  | 'withLabel'
  | 'yearLabel',
  LyraKnownDateEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-invalid',
  | '--lr-form-control-required-color'
  | '--lr-form-control-required-content'
  | '--lr-form-control-required-offset'
  | '--lr-known-date-day-field-width'
  | '--lr-known-date-field-font-size'
  | '--lr-known-date-field-gap'
  | '--lr-known-date-field-height'
  | '--lr-known-date-field-min-height'
  | '--lr-known-date-field-padding-block'
  | '--lr-known-date-field-padding-inline'
  | '--lr-known-date-invalid-border-color'
  | '--lr-known-date-month-field-width'
  | '--lr-known-date-year-field-width',
  {
    'aria-label'?: LyraKnownDate['accessibleLabel'];
    'custom-error'?: LyraKnownDate['customError'];
    'day-label'?: LyraKnownDate['dayLabel'];
    'error-text'?: LyraKnownDate['errorText'];
    'month-label'?: LyraKnownDate['monthLabel'];
    'value'?: LyraKnownDate['defaultValue'];
    'with-hint'?: LyraKnownDate['withHint'];
    'with-label'?: LyraKnownDate['withLabel'];
    'year-label'?: LyraKnownDate['yearLabel'];
  }
>;

export type LyraLightboxSvelteProps = LyraSvelteElementProps<
  LyraLightbox,
  | 'accessibleLabel'
  | 'goTo'
  | 'images'
  | 'index'
  | 'lightDismiss'
  | 'locale'
  | 'loop'
  | 'maxZoom'
  | 'minZoom'
  | 'next'
  | 'open'
  | 'previous'
  | 'showCounter'
  | 'strings'
  | 'zoomStep',
  LyraLightboxEventMap,
  | 'lr-index-change'
  | 'lr-lightbox-close'
  | 'lr-zoom-change',
  | '--lr-lightbox-control-bg'
  | '--lr-lightbox-control-color'
  | '--lr-lightbox-overlay-color',
  {
    'aria-label'?: LyraLightbox['accessibleLabel'];
    'light-dismiss'?: LyraLightbox['lightDismiss'];
    'max-zoom'?: LyraLightbox['maxZoom'];
    'min-zoom'?: LyraLightbox['minZoom'];
    'show-counter'?: LyraLightbox['showCounter'];
    'zoom-step'?: LyraLightbox['zoomStep'];
  }
>;

export type LyraLineChartSvelteProps = LyraSvelteElementProps<
  LyraLineChart,
  | 'accessibleDescription'
  | 'accessibleLabel'
  | 'area'
  | 'beginAtZero'
  | 'config'
  | 'dataLabels'
  | 'datasets'
  | 'description'
  | 'grid'
  | 'height'
  | 'hiddenDatasets'
  | 'indexAxis'
  | 'label'
  | 'labels'
  | 'legend'
  | 'legendPosition'
  | 'locale'
  | 'max'
  | 'min'
  | 'plugins'
  | 'showDataTable'
  | 'stacked'
  | 'stackTotals'
  | 'strings'
  | 'type'
  | 'valueFormatter'
  | 'withoutAnimation'
  | 'withoutLegend'
  | 'withoutTooltip'
  | 'xLabel'
  | 'y2Label'
  | 'yLabel'
  | 'zoom',
  LyraChartEventMap,
  | 'lr-before-legend-visibility-change'
  | 'lr-legend-visibility-change'
  | 'lr-point-click'
  | 'lr-zoom',
  | '--border-color-1'
  | '--border-color-2'
  | '--border-color-3'
  | '--border-color-4'
  | '--border-color-5'
  | '--border-color-6'
  | '--border-radius'
  | '--border-width'
  | '--fill-color-1'
  | '--fill-color-2'
  | '--fill-color-3'
  | '--fill-color-4'
  | '--fill-color-5'
  | '--fill-color-6'
  | '--grid-border-width'
  | '--grid-color'
  | '--line-border-width'
  | '--lr-chart-canvas-hover-outline-width'
  | '--lr-chart-data-table-button-active-bg'
  | '--lr-chart-data-table-button-hover-bg'
  | '--lr-chart-grid-color'
  | '--lr-chart-height'
  | '--lr-chart-legend-color'
  | '--lr-chart-legend-item-active-bg'
  | '--lr-chart-legend-item-hover-bg'
  | '--lr-chart-pattern-step'
  | '--lr-chart-reset-zoom-button-active-bg'
  | '--lr-chart-reset-zoom-button-hover-bg'
  | '--lr-chart-tick-color'
  | '--lr-chart-tooltip-bg'
  | '--lr-chart-tooltip-text'
  | '--point-radius',
  {
    'accessible-description'?: LyraLineChart['accessibleDescription'];
    'accessible-label'?: LyraLineChart['accessibleLabel'];
    'begin-at-zero'?: LyraLineChart['beginAtZero'];
    'data-labels'?: LyraLineChart['dataLabels'];
    'index-axis'?: LyraLineChart['indexAxis'];
    'legend-position'?: LyraLineChart['legendPosition'];
    'show-data-table'?: LyraLineChart['showDataTable'];
    'stack-totals'?: LyraLineChart['stackTotals'];
    'without-animation'?: LyraLineChart['withoutAnimation'];
    'without-legend'?: LyraLineChart['withoutLegend'];
    'without-tooltip'?: LyraLineChart['withoutTooltip'];
    'x-label'?: LyraLineChart['xLabel'];
    'y-label'?: LyraLineChart['yLabel'];
    'y2-label'?: LyraLineChart['y2Label'];
  }
>;

export type LyraLiteChartSvelteProps = LyraSvelteElementProps<
  LyraLiteChart,
  | 'accessibleLabel'
  | 'barGapRatio'
  | 'barWidth'
  | 'barX'
  | 'beginAtZero'
  | 'datasets'
  | 'height'
  | 'hideAxis'
  | 'labels'
  | 'layout'
  | 'legend'
  | 'legendText'
  | 'locale'
  | 'maxLabels'
  | 'minBarHeight'
  | 'padLeft'
  | 'pointText'
  | 'roundedBars'
  | 'scale'
  | 'selectedIndex'
  | 'skipZero'
  | 'stacked'
  | 'strings'
  | 'tableCellFormatter'
  | 'tableTotals'
  | 'tickFormat'
  | 'type'
  | 'xLabel'
  | 'yLabel',
  LyraLiteChartEventMap,
  | 'lr-point-click',
  | '--lr-chart-height'
  | '--lr-chart-pattern-step'
  | '--lr-lite-chart-selected-outline-color'
  | '--lr-lite-chart-selected-outline-width',
  {
    'accessible-label'?: LyraLiteChart['accessibleLabel'];
    'bar-gap-ratio'?: LyraLiteChart['barGapRatio'];
    'bar-width'?: LyraLiteChart['barWidth'];
    'begin-at-zero'?: LyraLiteChart['beginAtZero'];
    'hide-axis'?: LyraLiteChart['hideAxis'];
    'max-labels'?: LyraLiteChart['maxLabels'];
    'min-bar-height'?: LyraLiteChart['minBarHeight'];
    'pad-left'?: LyraLiteChart['padLeft'];
    'rounded-bars'?: LyraLiteChart['roundedBars'];
    'skip-zero'?: LyraLiteChart['skipZero'];
    'table-totals'?: LyraLiteChart['tableTotals'];
    'x-label'?: LyraLiteChart['xLabel'];
    'y-label'?: LyraLiteChart['yLabel'];
  }
>;

export type LyraLiveRegionSvelteProps = LyraSvelteElementProps<
  LyraLiveRegion,
  | 'locale'
  | 'mode'
  | 'strings'
  | 'throttleMs',
  {},
never,
never,
  {
    'throttle-ms'?: LyraLiveRegion['throttleMs'];
  }
>;

export type LyraLocalePickerSvelteProps = LyraSvelteElementProps<
  LyraLocalePicker,
  | 'customError'
  | 'defaultValue'
  | 'disabled'
  | 'errorText'
  | 'form'
  | 'hint'
  | 'label'
  | 'locale'
  | 'locales'
  | 'name'
  | 'open'
  | 'required'
  | 'showFlags'
  | 'size'
  | 'strings'
  | 'value',
  LyraLocalePickerEventMap,
  | 'blur'
  | 'focus'
  | 'lr-blur'
  | 'lr-change'
  | 'lr-focus'
  | 'lr-invalid',
  | '--lr-form-control-required-color'
  | '--lr-form-control-required-content'
  | '--lr-form-control-required-offset'
  | '--lr-locale-picker-expand-size'
  | '--lr-locale-picker-font-size'
  | '--lr-locale-picker-gap'
  | '--lr-locale-picker-open-border-color'
  | '--lr-locale-picker-option-active-bg'
  | '--lr-locale-picker-option-selected-border-color'
  | '--lr-locale-picker-option-selected-color'
  | '--lr-locale-picker-option-selected-font-weight'
  | '--lr-locale-picker-radius'
  | '--lr-locale-picker-trigger-height'
  | '--lr-locale-picker-trigger-hover-bg'
  | '--lr-locale-picker-trigger-min-height'
  | '--lr-locale-picker-trigger-padding',
  {
    'custom-error'?: LyraLocalePicker['customError'];
    'error-text'?: LyraLocalePicker['errorText'];
    'show-flags'?: LyraLocalePicker['showFlags'];
    'value'?: LyraLocalePicker['defaultValue'];
  }
>;

export type LyraMapSvelteProps = LyraSvelteElementProps<
  LyraMap,
  | 'center'
  | 'choropleth'
  | 'dataLayers'
  | 'label'
  | 'legend'
  | 'locale'
  | 'mapStyle'
  | 'markers'
  | 'strings'
  | 'zoom',
  LyraMapEventMap,
  | 'lr-map-click'
  | 'lr-map-load',
  | '--lr-map-choropleth-fill-opacity'
  | '--lr-map-popup-close-button-active-bg'
  | '--lr-map-popup-close-button-active-color'
  | '--lr-map-popup-close-button-hover-bg'
  | '--lr-map-popup-close-button-hover-color',
  {}
>;

export type LyraMarkdownSvelteProps = LyraSvelteElementProps<
  LyraMarkdown,
  | 'activeHighlightId'
  | 'anchor'
  | 'content'
  | 'eagerLoad'
  | 'escapeHtml'
  | 'gfm'
  | 'headingAnchors'
  | 'headingOffset'
  | 'highlightCode'
  | 'highlights'
  | 'internalLinkPrefix'
  | 'languages'
  | 'languagesOnly'
  | 'linkTarget'
  | 'locale'
  | 'math'
  | 'sanitize'
  | 'streaming'
  | 'strings'
  | 'tabSize',
  LyraMarkdownEventMap,
  | 'lr-anchor-result'
  | 'lr-highlight-activate'
  | 'lr-link-click'
  | 'lr-render-error'
  | 'lr-text-select',
  | '--lr-code-block-tab-size'
  | '--lr-markdown-font-mono'
  | '--lr-markdown-highlight-accent-bg'
  | '--lr-markdown-highlight-active-bg'
  | '--lr-markdown-highlight-active-outline-color'
  | '--lr-markdown-highlight-danger-bg'
  | '--lr-markdown-highlight-neutral-bg'
  | '--lr-markdown-highlight-success-bg'
  | '--lr-markdown-highlight-warning-bg',
  {
    'active-highlight-id'?: LyraMarkdown['activeHighlightId'];
    'eager-load'?: LyraMarkdown['eagerLoad'];
    'escape-html'?: LyraMarkdown['escapeHtml'];
    'heading-anchors'?: LyraMarkdown['headingAnchors'];
    'heading-offset'?: LyraMarkdown['headingOffset'];
    'highlight-code'?: LyraMarkdown['highlightCode'];
    'internal-link-prefix'?: LyraMarkdown['internalLinkPrefix'];
    'languages-only'?: LyraMarkdown['languagesOnly'];
    'link-target'?: LyraMarkdown['linkTarget'];
    'tab-size'?: LyraMarkdown['tabSize'];
  }
>;

export type LyraMarkdownCoreSvelteProps = LyraSvelteElementProps<
  LyraMarkdownCore,
  | 'activeHighlightId'
  | 'anchor'
  | 'content'
  | 'eagerLoad'
  | 'escapeHtml'
  | 'gfm'
  | 'headingAnchors'
  | 'headingOffset'
  | 'highlightCode'
  | 'highlights'
  | 'internalLinkPrefix'
  | 'languages'
  | 'linkTarget'
  | 'locale'
  | 'math'
  | 'sanitize'
  | 'streaming'
  | 'strings'
  | 'tabSize',
  LyraMarkdownCoreEventMap,
  | 'lr-anchor-result'
  | 'lr-highlight-activate'
  | 'lr-link-click'
  | 'lr-render-error'
  | 'lr-text-select',
  | '--lr-code-block-tab-size'
  | '--lr-markdown-highlight-accent-bg'
  | '--lr-markdown-highlight-active-bg'
  | '--lr-markdown-highlight-active-outline-color'
  | '--lr-markdown-highlight-danger-bg'
  | '--lr-markdown-highlight-neutral-bg'
  | '--lr-markdown-highlight-success-bg'
  | '--lr-markdown-highlight-warning-bg',
  {
    'active-highlight-id'?: LyraMarkdownCore['activeHighlightId'];
    'eager-load'?: LyraMarkdownCore['eagerLoad'];
    'escape-html'?: LyraMarkdownCore['escapeHtml'];
    'heading-anchors'?: LyraMarkdownCore['headingAnchors'];
    'heading-offset'?: LyraMarkdownCore['headingOffset'];
    'highlight-code'?: LyraMarkdownCore['highlightCode'];
    'internal-link-prefix'?: LyraMarkdownCore['internalLinkPrefix'];
    'link-target'?: LyraMarkdownCore['linkTarget'];
    'tab-size'?: LyraMarkdownCore['tabSize'];
  }
>;

export type LyraMcpAppSvelteProps = LyraSvelteElementProps<
  LyraMcpApp,
  | 'accessibleLabel'
  | 'height'
  | 'label'
  | 'locale'
  | 'maxHeight'
  | 'resource'
  | 'strings',
  LyraMcpAppEventMap,
  | 'lr-mcp-log'
  | 'lr-mcp-open-link'
  | 'lr-mcp-ready'
  | 'lr-mcp-resize'
  | 'lr-mcp-send-message'
  | 'lr-mcp-tool-call',
never,
  {
    'aria-label'?: LyraMcpApp['accessibleLabel'];
    'max-height'?: LyraMcpApp['maxHeight'];
  }
>;

export type LyraMediaCardSvelteProps = LyraSvelteElementProps<
  LyraMediaCard,
  | 'accessibleLabel'
  | 'alt'
  | 'filename'
  | 'frame'
  | 'kind'
  | 'locale'
  | 'maxHeight'
  | 'mimeType'
  | 'src'
  | 'strings',
  LyraMediaCardEventMap,
  | 'lr-open',
  | '--lr-media-card-active-bg'
  | '--lr-media-card-active-border-color'
  | '--lr-media-card-max-height',
  {
    'aria-label'?: LyraMediaCard['accessibleLabel'];
    'max-height'?: LyraMediaCard['maxHeight'];
    'mime-type'?: LyraMediaCard['mimeType'];
  }
>;

export type LyraMemoryPanelSvelteProps = LyraSvelteElementProps<
  LyraMemoryPanel,
  | 'label'
  | 'locale'
  | 'longTerm'
  | 'shortTerm'
  | 'strings'
  | 'thresholds'
  | 'types',
  LyraMemoryPanelEventMap,
  | 'lr-add'
  | 'lr-expand'
  | 'lr-forget'
  | 'lr-remove',
  | '--lr-memory-panel-confidence-danger-color'
  | '--lr-memory-panel-confidence-success-color'
  | '--lr-memory-panel-confidence-warning-color',
  {}
>;

export type LyraMentionPopoverSvelteProps = LyraSvelteElementProps<
  LyraMentionPopover,
  | 'anchor'
  | 'emptyText'
  | 'filter'
  | 'items'
  | 'label'
  | 'locale'
  | 'open'
  | 'query'
  | 'strings',
  LyraMentionPopoverEventMap,
  | 'lr-mention-close'
  | 'lr-mention-select',
  | '--lr-mention-popover-option-active-bg',
  {
    'empty-text'?: LyraMentionPopover['emptyText'];
  }
>;

export type LyraMenuSvelteProps = LyraSvelteElementProps<
  LyraMenu,
  | 'anchor'
  | 'closeOnEscapeAnywhere'
  | 'label'
  | 'locale'
  | 'open'
  | 'placement'
  | 'strings',
  LyraMenuEventMap,
  | 'lr-hide'
  | 'lr-menu-select'
  | 'lr-select'
  | 'lr-show',
never,
  {
    'close-on-escape-anywhere'?: LyraMenu['closeOnEscapeAnywhere'];
  }
>;

export type LyraMenuItemSvelteProps = LyraSvelteElementProps<
  LyraMenuItem,
  | 'checked'
  | 'destructive'
  | 'disabled'
  | 'loading'
  | 'locale'
  | 'size'
  | 'strings'
  | 'submenuOpen'
  | 'type'
  | 'value'
  | 'variant',
  LyraMenuItemEventMap,
  | 'lr-menu-item-change'
  | 'lr-menu-item-select'
  | 'lr-menu-item-state-change',
  | '--lr-menu-item-danger-active-bg'
  | '--lr-menu-item-danger-color'
  | '--lr-menu-item-danger-hover-bg'
  | '--lr-menu-item-gap'
  | '--lr-menu-item-radius'
  | '--submenu-offset',
  {}
>;

export type LyraMenuLabelSvelteProps = LyraSvelteElementProps<
  LyraMenuLabel,
  | 'locale'
  | 'strings',
  {},
never,
never,
  {}
>;

export type LyraMessageActionsSvelteProps = LyraSvelteElementProps<
  LyraMessageActions,
  | 'accessibleLabel'
  | 'controls'
  | 'copyText'
  | 'feedbackValue'
  | 'label'
  | 'locale'
  | 'revealOnHover'
  | 'strings',
  LyraMessageActionsEventMap,
  | 'lr-change'
  | 'lr-copy'
  | 'lr-edit'
  | 'lr-regenerate'
  | 'lr-submit',
never,
  {
    'aria-label'?: LyraMessageActions['accessibleLabel'];
    'copy-text'?: LyraMessageActions['copyText'];
    'feedback-value'?: LyraMessageActions['feedbackValue'];
    'reveal-on-hover'?: LyraMessageActions['revealOnHover'];
  }
>;

export type LyraMessageFeedbackSvelteProps = LyraSvelteElementProps<
  LyraMessageFeedback,
  | 'commentable'
  | 'detailFor'
  | 'disabled'
  | 'locale'
  | 'pending'
  | 'reasons'
  | 'strings'
  | 'value',
  LyraMessageFeedbackEventMap,
  | 'blur'
  | 'focus'
  | 'lr-change'
  | 'lr-submit',
  | '--lr-message-feedback-down-active-bg'
  | '--lr-message-feedback-down-active-border'
  | '--lr-message-feedback-down-active-color'
  | '--lr-message-feedback-up-active-bg'
  | '--lr-message-feedback-up-active-border'
  | '--lr-message-feedback-up-active-color',
  {
    'detail-for'?: LyraMessageFeedback['detailFor'];
  }
>;

export type LyraMessagePartsSvelteProps = LyraSvelteElementProps<
  LyraMessageParts,
  | 'accessibleLabel'
  | 'label'
  | 'locale'
  | 'parts'
  | 'renderMarkdown'
  | 'renderPart'
  | 'showReasoning'
  | 'strings',
  LyraMessagePartsEventMap,
  | 'lr-anchor-result'
  | 'lr-citation-open'
  | 'lr-citation-select'
  | 'lr-copy'
  | 'lr-highlight-activate'
  | 'lr-link-click'
  | 'lr-part-retry'
  | 'lr-preview'
  | 'lr-remove'
  | 'lr-render-error'
  | 'lr-retry'
  | 'lr-search-change'
  | 'lr-text-select'
  | 'lr-toggle'
  | 'lr-tool-call-chip-select'
  | 'lr-widget-action'
  | 'lr-widget-state-change',
  | '--lr-message-parts-audio-transcript-color'
  | '--lr-message-parts-error-background'
  | '--lr-message-parts-error-border-color'
  | '--lr-message-parts-error-color'
  | '--lr-message-parts-streaming-color',
  {
    'aria-label'?: LyraMessageParts['accessibleLabel'];
    'render-markdown'?: LyraMessageParts['renderMarkdown'];
    'show-reasoning'?: LyraMessageParts['showReasoning'];
  }
>;

export type LyraMindMapSvelteProps = LyraSvelteElementProps<
  LyraMindMap,
  | 'expandDepth'
  | 'label'
  | 'locale'
  | 'strings'
  | 'topics',
  LyraMindMapEventMap,
  | 'lr-topic-select'
  | 'lr-topic-toggle',
  | '--lr-mind-map-node-hover-halo'
  | '--lr-mind-map-ring-gap',
  {
    'expand-depth'?: LyraMindMap['expandDepth'];
  }
>;

export type LyraModelSelectSvelteProps = LyraSvelteElementProps<
  LyraModelSelect,
  | 'allowCustom'
  | 'autocapitalize'
  | 'autocomplete'
  | 'autoCorrect'
  | 'catalog'
  | 'customError'
  | 'defaultValue'
  | 'disabled'
  | 'enterKeyHint'
  | 'errorText'
  | 'form'
  | 'hint'
  | 'inputMode'
  | 'label'
  | 'locale'
  | 'name'
  | 'open'
  | 'placeholder'
  | 'provider'
  | 'required'
  | 'selectionDirection'
  | 'selectionEnd'
  | 'selectionStart'
  | 'size'
  | 'spellcheck'
  | 'strings'
  | 'value',
  LyraModelSelectEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-blur'
  | 'lr-change'
  | 'lr-focus'
  | 'lr-invalid',
  | '--lr-form-control-required-color'
  | '--lr-form-control-required-content'
  | '--lr-form-control-required-offset'
  | '--lr-model-select-expand-size'
  | '--lr-model-select-font-size'
  | '--lr-model-select-gap'
  | '--lr-model-select-open-border-color'
  | '--lr-model-select-option-active-bg'
  | '--lr-model-select-option-selected-bg'
  | '--lr-model-select-option-selected-border'
  | '--lr-model-select-option-selected-color'
  | '--lr-model-select-option-selected-font-weight'
  | '--lr-model-select-option-synthetic-border-color'
  | '--lr-model-select-option-synthetic-border-style'
  | '--lr-model-select-radius'
  | '--lr-model-select-trigger-min-height'
  | '--lr-model-select-trigger-padding',
  {
    'allow-custom'?: LyraModelSelect['allowCustom'];
    'autocorrect'?: LyraModelSelect['autoCorrect'];
    'custom-error'?: LyraModelSelect['customError'];
    'enterkeyhint'?: LyraModelSelect['enterKeyHint'];
    'error-text'?: LyraModelSelect['errorText'];
    'inputmode'?: LyraModelSelect['inputMode'];
    'value'?: LyraModelSelect['defaultValue'];
  }
>;

export type LyraModelSettingsPanelSvelteProps = LyraSvelteElementProps<
  LyraModelSettingsPanel,
  | 'allowCustom'
  | 'catalog'
  | 'disabled'
  | 'layout'
  | 'locale'
  | 'modelValue'
  | 'provider'
  | 'strings'
  | 'temperature'
  | 'temperatureMax'
  | 'temperatureMin'
  | 'temperatureStep',
  LyraModelSettingsPanelEventMap,
  | 'lr-change',
never,
  {
    'allow-custom'?: LyraModelSettingsPanel['allowCustom'];
    'model-value'?: LyraModelSettingsPanel['modelValue'];
    'temperature-max'?: LyraModelSettingsPanel['temperatureMax'];
    'temperature-min'?: LyraModelSettingsPanel['temperatureMin'];
    'temperature-step'?: LyraModelSettingsPanel['temperatureStep'];
  }
>;

export type LyraMutationObserverSvelteProps = LyraSvelteElementProps<
  LyraMutationObserver,
  | 'attr'
  | 'attributeFilter'
  | 'attrOldValue'
  | 'characterData'
  | 'charData'
  | 'charDataOldValue'
  | 'childList'
  | 'disabled'
  | 'locale'
  | 'observeAttributes'
  | 'strings'
  | 'subtree',
  LyraMutationObserverEventMap,
  | 'lr-mutation',
never,
  {
    'attr-old-value'?: LyraMutationObserver['attrOldValue'];
    'attributes'?: LyraMutationObserver['observeAttributes'];
    'char-data'?: LyraMutationObserver['charData'];
    'char-data-old-value'?: LyraMutationObserver['charDataOldValue'];
    'character-data'?: LyraMutationObserver['characterData'];
    'child-list'?: LyraMutationObserver['childList'];
  }
>;

export type LyraNativeTimeInputSvelteProps = LyraSvelteElementProps<
  LyraNativeTimeInput,
  | 'accessibleLabel'
  | 'appearance'
  | 'autocapitalize'
  | 'autocomplete'
  | 'autocorrect'
  | 'autofocus'
  | 'clearable'
  | 'customError'
  | 'defaultValue'
  | 'disabled'
  | 'enterkeyhint'
  | 'enterKeyHint'
  | 'errorText'
  | 'filled'
  | 'form'
  | 'helpText'
  | 'hint'
  | 'inputmode'
  | 'inputMode'
  | 'label'
  | 'locale'
  | 'max'
  | 'maxlength'
  | 'min'
  | 'minlength'
  | 'name'
  | 'noSpinButtons'
  | 'passwordToggle'
  | 'passwordVisible'
  | 'pattern'
  | 'pill'
  | 'placeholder'
  | 'readonly'
  | 'required'
  | 'selectionEnd'
  | 'selectionStart'
  | 'size'
  | 'spellcheck'
  | 'step'
  | 'strings'
  | 'title'
  | 'type'
  | 'value'
  | 'valueAsDate'
  | 'valueAsNumber'
  | 'withClear'
  | 'withHint'
  | 'withLabel'
  | 'withoutSpinButtons',
  LyraInputEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-blur'
  | 'lr-change'
  | 'lr-clear'
  | 'lr-focus'
  | 'lr-input'
  | 'lr-invalid',
  | '--lr-form-control-required-color'
  | '--lr-form-control-required-content'
  | '--lr-form-control-required-offset'
  | '--lr-input-action-active-bg'
  | '--lr-input-action-active-color'
  | '--lr-input-action-color'
  | '--lr-input-action-hover-color'
  | '--lr-input-border-color'
  | '--lr-input-control-height'
  | '--lr-input-control-min-height'
  | '--lr-input-fill'
  | '--lr-input-focus-border-color'
  | '--lr-input-font-size'
  | '--lr-input-gap'
  | '--lr-input-padding-block'
  | '--lr-input-padding-inline'
  | '--lr-input-radius',
  {
    'aria-label'?: LyraNativeTimeInput['accessibleLabel'];
    'custom-error'?: LyraNativeTimeInput['customError'];
    'default-value'?: LyraNativeTimeInput['defaultValue'];
    'enterkeyhint'?: LyraNativeTimeInput['enterKeyHint'];
    'error-text'?: LyraNativeTimeInput['errorText'];
    'help-text'?: LyraNativeTimeInput['helpText'];
    'inputmode'?: LyraNativeTimeInput['inputMode'];
    'no-spin-buttons'?: LyraNativeTimeInput['noSpinButtons'];
    'password-toggle'?: LyraNativeTimeInput['passwordToggle'];
    'password-visible'?: LyraNativeTimeInput['passwordVisible'];
    'value'?: LyraNativeTimeInput['defaultValue'];
    'with-clear'?: LyraNativeTimeInput['withClear'];
    'with-hint'?: LyraNativeTimeInput['withHint'];
    'with-label'?: LyraNativeTimeInput['withLabel'];
    'without-spin-buttons'?: LyraNativeTimeInput['withoutSpinButtons'];
  }
>;

export type LyraNeighborListSvelteProps = LyraSvelteElementProps<
  LyraNeighborList,
  | 'expandable'
  | 'groupByRelation'
  | 'label'
  | 'locale'
  | 'rows'
  | 'strings'
  | 'virtualizeAt',
  LyraNeighborListEventMap,
  | 'lr-entity-activate'
  | 'lr-node-expand',
never,
  {
    'group-by-relation'?: LyraNeighborList['groupByRelation'];
    'virtualize-at'?: LyraNeighborList['virtualizeAt'];
  }
>;

export type LyraNodePaletteSvelteProps = LyraSvelteElementProps<
  LyraNodePalette,
  | 'accessibleLabel'
  | 'items'
  | 'label'
  | 'locale'
  | 'reorderable'
  | 'strings',
  LyraNodePaletteEventMap,
  | 'blur'
  | 'focus'
  | 'lr-palette-place'
  | 'lr-reorder'
  | 'lr-select',
never,
  {
    'aria-label'?: LyraNodePalette['accessibleLabel'];
  }
>;

export type LyraNotebookViewerSvelteProps = LyraSvelteElementProps<
  LyraNotebookViewer,
  | 'activeHighlightId'
  | 'anchor'
  | 'highlights'
  | 'locale'
  | 'maxHeight'
  | 'name'
  | 'notebook'
  | 'outputCollapseLines'
  | 'src'
  | 'strings',
  LyraNotebookViewerEventMap,
  | 'lr-anchor-result'
  | 'lr-load'
  | 'lr-render-error'
  | 'lr-search-change',
  | '--lr-notebook-viewer-active-bg'
  | '--lr-notebook-viewer-max-height',
  {
    'active-highlight-id'?: LyraNotebookViewer['activeHighlightId'];
    'max-height'?: LyraNotebookViewer['maxHeight'];
    'output-collapse-lines'?: LyraNotebookViewer['outputCollapseLines'];
  }
>;

export type LyraNumberInputSvelteProps = LyraSvelteElementProps<
  LyraNumberInput,
  | 'accessibleLabel'
  | 'appearance'
  | 'autocapitalize'
  | 'autocomplete'
  | 'autocorrect'
  | 'autofocus'
  | 'clearable'
  | 'customError'
  | 'defaultValue'
  | 'disabled'
  | 'enterkeyhint'
  | 'enterKeyHint'
  | 'errorText'
  | 'filled'
  | 'form'
  | 'helpText'
  | 'hint'
  | 'inputmode'
  | 'inputMode'
  | 'label'
  | 'locale'
  | 'max'
  | 'maxlength'
  | 'min'
  | 'minlength'
  | 'name'
  | 'noSpinButtons'
  | 'passwordToggle'
  | 'passwordVisible'
  | 'pattern'
  | 'pill'
  | 'placeholder'
  | 'readonly'
  | 'required'
  | 'selectionEnd'
  | 'selectionStart'
  | 'size'
  | 'spellcheck'
  | 'step'
  | 'steppers'
  | 'strings'
  | 'title'
  | 'type'
  | 'value'
  | 'valueAsDate'
  | 'valueAsNumber'
  | 'withClear'
  | 'withHint'
  | 'withLabel'
  | 'withoutSpinButtons'
  | 'withoutSteppers',
  LyraNumberInputEventMap,
  | 'beforeinput'
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-blur'
  | 'lr-change'
  | 'lr-clear'
  | 'lr-focus'
  | 'lr-input'
  | 'lr-invalid',
  | '--lr-form-control-required-color'
  | '--lr-form-control-required-content'
  | '--lr-form-control-required-offset'
  | '--lr-input-action-active-bg'
  | '--lr-input-action-active-color'
  | '--lr-input-action-color'
  | '--lr-input-action-hover-color'
  | '--lr-input-border-color'
  | '--lr-input-control-height'
  | '--lr-input-control-min-height'
  | '--lr-input-fill'
  | '--lr-input-focus-border-color'
  | '--lr-input-font-size'
  | '--lr-input-gap'
  | '--lr-input-padding-block'
  | '--lr-input-padding-inline'
  | '--lr-input-radius',
  {
    'aria-label'?: LyraNumberInput['accessibleLabel'];
    'custom-error'?: LyraNumberInput['customError'];
    'default-value'?: LyraNumberInput['defaultValue'];
    'enterkeyhint'?: LyraNumberInput['enterKeyHint'];
    'error-text'?: LyraNumberInput['errorText'];
    'help-text'?: LyraNumberInput['helpText'];
    'inputmode'?: LyraNumberInput['inputMode'];
    'no-spin-buttons'?: LyraNumberInput['noSpinButtons'];
    'password-toggle'?: LyraNumberInput['passwordToggle'];
    'password-visible'?: LyraNumberInput['passwordVisible'];
    'value'?: LyraNumberInput['defaultValue'];
    'with-clear'?: LyraNumberInput['withClear'];
    'with-hint'?: LyraNumberInput['withHint'];
    'with-label'?: LyraNumberInput['withLabel'];
    'without-spin-buttons'?: LyraNumberInput['withoutSpinButtons'];
    'without-steppers'?: LyraNumberInput['withoutSteppers'];
  }
>;

export type LyraOptionSvelteProps = LyraSvelteElementProps<
  LyraOption,
  | 'defaultSelected'
  | 'disabled'
  | 'dotColor'
  | 'group'
  | 'label'
  | 'locale'
  | 'searchText'
  | 'selected'
  | 'strings'
  | 'sub'
  | 'value',
  LyraOptionEventMap,
  | 'lr-option-change',
  | '--current-text-color'
  | '--lr-option-active-bg'
  | '--lr-option-checked-icon-color'
  | '--lr-option-current-bg'
  | '--lr-option-current-color'
  | '--lr-option-hover-bg'
  | '--lr-option-selected-font-weight',
  {
    'dot-color'?: LyraOption['dotColor'];
    'search-text'?: LyraOption['searchText'];
    'selected'?: LyraOption['defaultSelected'];
  }
>;

export type LyraOtpInputSvelteProps = LyraSvelteElementProps<
  LyraOtpInput,
  | 'appearance'
  | 'autocomplete'
  | 'autofocus'
  | 'autosubmit'
  | 'case'
  | 'customError'
  | 'defaultValue'
  | 'disabled'
  | 'errorText'
  | 'form'
  | 'format'
  | 'hint'
  | 'label'
  | 'length'
  | 'locale'
  | 'mask'
  | 'name'
  | 'readonly'
  | 'required'
  | 'selectionDirection'
  | 'selectionEnd'
  | 'selectionStart'
  | 'size'
  | 'strings'
  | 'type'
  | 'value'
  | 'withMask',
  LyraOtpInputEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-blur'
  | 'lr-clear'
  | 'lr-complete'
  | 'lr-focus'
  | 'lr-invalid',
  | '--lr-form-control-required-color'
  | '--lr-form-control-required-content'
  | '--lr-form-control-required-offset'
  | '--lr-otp-input-active-border-color'
  | '--lr-otp-input-active-ring-color'
  | '--lr-otp-input-invalid-border-color'
  | '--lr-otp-input-mask-char'
  | '--lr-otp-input-segment-border-color'
  | '--lr-otp-input-segment-fill'
  | '--lr-otp-input-segment-radius'
  | '--lr-otp-input-segment-size'
  | '--mask-char'
  | '--segment-border-radius'
  | '--segment-gap'
  | '--segment-size',
  {
    'custom-error'?: LyraOtpInput['customError'];
    'error-text'?: LyraOtpInput['errorText'];
    'value'?: LyraOtpInput['defaultValue'];
    'with-mask'?: LyraOtpInput['withMask'];
  }
>;

export type LyraPageSvelteProps = LyraSvelteElementProps<
  LyraPage,
  | 'disableNavigationToggle'
  | 'locale'
  | 'mobileBreakpoint'
  | 'navigationPlacement'
  | 'navOpen'
  | 'strings'
  | 'view',
  LyraPageEventMap,
  | 'lr-nav-toggle',
  | '--aside-width'
  | '--banner-height'
  | '--header-height'
  | '--lr-page-aside-width'
  | '--lr-page-banner-height'
  | '--lr-page-header-height'
  | '--lr-page-main-width'
  | '--lr-page-menu-width'
  | '--lr-page-navigation-backdrop-bg'
  | '--lr-page-navigation-drawer-bg'
  | '--lr-page-navigation-drawer-shadow'
  | '--lr-page-navigation-toggle-active-bg'
  | '--lr-page-navigation-toggle-active-color'
  | '--lr-page-navigation-toggle-hover-bg'
  | '--lr-page-navigation-toggle-hover-color'
  | '--lr-page-skip-to-content-active-bg'
  | '--lr-page-skip-to-content-active-color'
  | '--lr-page-skip-to-content-hover-bg'
  | '--lr-page-skip-to-content-hover-color'
  | '--lr-page-subheader-height'
  | '--main-width'
  | '--menu-width'
  | '--subheader-height',
  {
    'aria-label'?: LyraUnknownAttributeValue;
    'disable-navigation-toggle'?: LyraPage['disableNavigationToggle'];
    'mobile-breakpoint'?: LyraPage['mobileBreakpoint'];
    'nav-open'?: LyraPage['navOpen'];
    'navigation-placement'?: LyraPage['navigationPlacement'];
  }
>;

export type LyraPageRailSvelteProps = LyraSvelteElementProps<
  LyraPageRail,
  | 'for'
  | 'highlights'
  | 'label'
  | 'locale'
  | 'page'
  | 'pageCount'
  | 'strings'
  | 'thumbWidth'
  | 'viewer',
  LyraPageRailEventMap,
  | 'lr-page-select',
  | '--lr-page-rail-current-bg'
  | '--lr-page-rail-heat-accent-color'
  | '--lr-page-rail-heat-danger-color'
  | '--lr-page-rail-heat-neutral-color'
  | '--lr-page-rail-heat-success-color'
  | '--lr-page-rail-heat-warning-color'
  | '--lr-page-rail-height',
  {
    'page-count'?: LyraPageRail['pageCount'];
    'thumb-width'?: LyraPageRail['thumbWidth'];
  }
>;

export type LyraPaginationSvelteProps = LyraSvelteElementProps<
  LyraPagination,
  | 'accessibleLabel'
  | 'appearance'
  | 'boundaryCount'
  | 'disabled'
  | 'firstLabel'
  | 'format'
  | 'hideSinglePage'
  | 'hrefTemplate'
  | 'itemLabel'
  | 'label'
  | 'lastLabel'
  | 'loading'
  | 'locale'
  | 'nextLabel'
  | 'page'
  | 'pageLabel'
  | 'pageSize'
  | 'previousLabel'
  | 'siblingCount'
  | 'size'
  | 'strings'
  | 'total'
  | 'withEdges'
  | 'withoutNav'
  | 'withSummary',
  LyraPaginationEventMap,
  | 'blur'
  | 'focus'
  | 'lr-before-page-change'
  | 'lr-page-change',
  | '--lr-pagination-active-bg'
  | '--lr-pagination-active-border-color'
  | '--lr-pagination-base-gap'
  | '--lr-pagination-control-bg'
  | '--lr-pagination-control-border-color'
  | '--lr-pagination-control-color'
  | '--lr-pagination-control-padding'
  | '--lr-pagination-control-radius'
  | '--lr-pagination-control-size'
  | '--lr-pagination-controls-gap'
  | '--lr-pagination-current-active-bg'
  | '--lr-pagination-current-active-border-color'
  | '--lr-pagination-current-bg'
  | '--lr-pagination-current-border-color'
  | '--lr-pagination-current-color'
  | '--lr-pagination-current-hover-bg'
  | '--lr-pagination-current-hover-border-color'
  | '--lr-pagination-font-size'
  | '--lr-pagination-hover-bg'
  | '--lr-pagination-hover-border-color'
  | '--lr-pagination-invalid-border'
  | '--lr-pagination-pages-gap',
  {
    'aria-label'?: LyraPagination['accessibleLabel'];
    'boundary-count'?: LyraPagination['boundaryCount'];
    'first-label'?: LyraPagination['firstLabel'];
    'hide-single-page'?: LyraPagination['hideSinglePage'];
    'href-template'?: LyraPagination['hrefTemplate'];
    'item-label'?: LyraPagination['itemLabel'];
    'last-label'?: LyraPagination['lastLabel'];
    'next-label'?: LyraPagination['nextLabel'];
    'page-label'?: LyraPagination['pageLabel'];
    'page-size'?: LyraPagination['pageSize'];
    'previous-label'?: LyraPagination['previousLabel'];
    'sibling-count'?: LyraPagination['siblingCount'];
    'with-edges'?: LyraPagination['withEdges'];
    'with-summary'?: LyraPagination['withSummary'];
    'without-nav'?: LyraPagination['withoutNav'];
  }
>;

export type LyraPanZoomSvelteProps = LyraSvelteElementProps<
  LyraPanZoom,
  | 'accessibleLabel'
  | 'alt'
  | 'locale'
  | 'maxZoom'
  | 'minZoom'
  | 'src'
  | 'strings'
  | 'zoom'
  | 'zoomStep',
  LyraPanZoomEventMap,
  | 'blur'
  | 'focus'
  | 'lr-blur'
  | 'lr-focus'
  | 'lr-zoom-change',
  | '--lr-pan-zoom-min-block-size'
  | '--lr-pan-zoom-zoom',
  {
    'aria-label'?: LyraPanZoom['accessibleLabel'];
    'max-zoom'?: LyraPanZoom['maxZoom'];
    'min-zoom'?: LyraPanZoom['minZoom'];
    'zoom-step'?: LyraPanZoom['zoomStep'];
  }
>;

export type LyraPathStripSvelteProps = LyraSvelteElementProps<
  LyraPathStrip,
  | 'label'
  | 'locale'
  | 'path'
  | 'strings',
  LyraPathStripEventMap,
  | 'lr-entity-activate'
  | 'lr-relation-activate',
never,
  {}
>;

export type LyraPdfViewerSvelteProps = LyraSvelteElementProps<
  LyraPdfViewer,
  | 'activeHighlightId'
  | 'anchor'
  | 'highlights'
  | 'locale'
  | 'maxHeight'
  | 'name'
  | 'page'
  | 'src'
  | 'strings'
  | 'zoom',
  LyraPdfViewerEventMap,
  | 'lr-anchor-result'
  | 'lr-highlight-activate'
  | 'lr-load'
  | 'lr-page-change'
  | 'lr-render-error'
  | 'lr-search-change'
  | 'lr-text-select'
  | 'lr-zoom-change',
  | '--lr-pdf-viewer-height'
  | '--lr-pdf-viewer-search-match-active-bg'
  | '--lr-pdf-viewer-search-match-bg'
  | '--lr-pdf-viewer-toolbar-button-hover-bg',
  {
    'active-highlight-id'?: LyraPdfViewer['activeHighlightId'];
    'max-height'?: LyraPdfViewer['maxHeight'];
  }
>;

export type LyraPhoneInputSvelteProps = LyraSvelteElementProps<
  LyraPhoneInput,
  | 'accessibleLabel'
  | 'adapter'
  | 'autocapitalize'
  | 'autocomplete'
  | 'autoCorrect'
  | 'countries'
  | 'country'
  | 'countryLabel'
  | 'customError'
  | 'defaultCountry'
  | 'defaultValue'
  | 'disabled'
  | 'enterkeyhint'
  | 'errorText'
  | 'flags'
  | 'form'
  | 'hint'
  | 'incompleteText'
  | 'inputmode'
  | 'invalidText'
  | 'label'
  | 'locale'
  | 'name'
  | 'phoneLabel'
  | 'pill'
  | 'placeholder'
  | 'required'
  | 'selectionDirection'
  | 'selectionEnd'
  | 'selectionStart'
  | 'size'
  | 'spellcheck'
  | 'strings'
  | 'value',
  LyraPhoneInputEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-blur'
  | 'lr-change'
  | 'lr-focus'
  | 'lr-input'
  | 'lr-invalid',
  | '--lr-form-control-required-color'
  | '--lr-form-control-required-content'
  | '--lr-form-control-required-offset'
  | '--lr-phone-input-control-height'
  | '--lr-phone-input-control-min-height'
  | '--lr-phone-input-country-hover-bg'
  | '--lr-phone-input-flag-size'
  | '--lr-phone-input-focus-border-color'
  | '--lr-phone-input-font-size'
  | '--lr-phone-input-gap'
  | '--lr-phone-input-glyph-size'
  | '--lr-phone-input-invalid-border-color'
  | '--lr-phone-input-padding-block'
  | '--lr-phone-input-radius',
  {
    'aria-label'?: LyraPhoneInput['accessibleLabel'];
    'autocorrect'?: LyraPhoneInput['autoCorrect'];
    'country-label'?: LyraPhoneInput['countryLabel'];
    'custom-error'?: LyraPhoneInput['customError'];
    'default-country'?: LyraPhoneInput['defaultCountry'];
    'error-text'?: LyraPhoneInput['errorText'];
    'incomplete-text'?: LyraPhoneInput['incompleteText'];
    'invalid-text'?: LyraPhoneInput['invalidText'];
    'phone-label'?: LyraPhoneInput['phoneLabel'];
    'value'?: LyraPhoneInput['defaultValue'];
  }
>;

export type LyraPieChartSvelteProps = LyraSvelteElementProps<
  LyraPieChart,
  | 'accessibleDescription'
  | 'accessibleLabel'
  | 'area'
  | 'beginAtZero'
  | 'config'
  | 'dataLabels'
  | 'datasets'
  | 'description'
  | 'grid'
  | 'height'
  | 'hiddenDatasets'
  | 'indexAxis'
  | 'label'
  | 'labels'
  | 'legend'
  | 'legendPosition'
  | 'locale'
  | 'max'
  | 'min'
  | 'plugins'
  | 'showDataTable'
  | 'stacked'
  | 'stackTotals'
  | 'strings'
  | 'type'
  | 'valueFormatter'
  | 'withoutAnimation'
  | 'withoutLegend'
  | 'withoutTooltip'
  | 'xLabel'
  | 'y2Label'
  | 'yLabel'
  | 'zoom',
  LyraChartEventMap,
  | 'lr-before-legend-visibility-change'
  | 'lr-legend-visibility-change'
  | 'lr-point-click'
  | 'lr-zoom',
  | '--border-color-1'
  | '--border-color-2'
  | '--border-color-3'
  | '--border-color-4'
  | '--border-color-5'
  | '--border-color-6'
  | '--border-radius'
  | '--border-width'
  | '--fill-color-1'
  | '--fill-color-2'
  | '--fill-color-3'
  | '--fill-color-4'
  | '--fill-color-5'
  | '--fill-color-6'
  | '--grid-border-width'
  | '--grid-color'
  | '--line-border-width'
  | '--lr-chart-canvas-hover-outline-width'
  | '--lr-chart-data-table-button-active-bg'
  | '--lr-chart-data-table-button-hover-bg'
  | '--lr-chart-grid-color'
  | '--lr-chart-height'
  | '--lr-chart-legend-color'
  | '--lr-chart-legend-item-active-bg'
  | '--lr-chart-legend-item-hover-bg'
  | '--lr-chart-pattern-step'
  | '--lr-chart-reset-zoom-button-active-bg'
  | '--lr-chart-reset-zoom-button-hover-bg'
  | '--lr-chart-tick-color'
  | '--lr-chart-tooltip-bg'
  | '--lr-chart-tooltip-text'
  | '--point-radius',
  {
    'accessible-description'?: LyraPieChart['accessibleDescription'];
    'accessible-label'?: LyraPieChart['accessibleLabel'];
    'begin-at-zero'?: LyraPieChart['beginAtZero'];
    'data-labels'?: LyraPieChart['dataLabels'];
    'index-axis'?: LyraPieChart['indexAxis'];
    'legend-position'?: LyraPieChart['legendPosition'];
    'show-data-table'?: LyraPieChart['showDataTable'];
    'stack-totals'?: LyraPieChart['stackTotals'];
    'without-animation'?: LyraPieChart['withoutAnimation'];
    'without-legend'?: LyraPieChart['withoutLegend'];
    'without-tooltip'?: LyraPieChart['withoutTooltip'];
    'x-label'?: LyraPieChart['xLabel'];
    'y-label'?: LyraPieChart['yLabel'];
    'y2-label'?: LyraPieChart['y2Label'];
  }
>;

export type LyraPlaybackSvelteProps = LyraSvelteElementProps<
  LyraPlayback,
  | 'hidden'
  | 'index'
  | 'intervalMs'
  | 'length'
  | 'locale'
  | 'loop'
  | 'playing'
  | 'strings',
  LyraPlaybackEventMap,
  | 'blur'
  | 'focus'
  | 'lr-blur'
  | 'lr-focus'
  | 'lr-pause'
  | 'lr-play'
  | 'lr-step',
  | '--lr-playback-icon-size'
  | '--lr-playback-play-button-active-bg'
  | '--lr-playback-play-button-active-border-color',
  {
    'interval-ms'?: LyraPlayback['intervalMs'];
  }
>;

export type LyraPolarAreaChartSvelteProps = LyraSvelteElementProps<
  LyraPolarAreaChart,
  | 'accessibleDescription'
  | 'accessibleLabel'
  | 'area'
  | 'beginAtZero'
  | 'config'
  | 'dataLabels'
  | 'datasets'
  | 'description'
  | 'grid'
  | 'height'
  | 'hiddenDatasets'
  | 'indexAxis'
  | 'label'
  | 'labels'
  | 'legend'
  | 'legendPosition'
  | 'locale'
  | 'max'
  | 'min'
  | 'plugins'
  | 'showDataTable'
  | 'stacked'
  | 'stackTotals'
  | 'strings'
  | 'type'
  | 'valueFormatter'
  | 'withoutAnimation'
  | 'withoutLegend'
  | 'withoutTooltip'
  | 'xLabel'
  | 'y2Label'
  | 'yLabel'
  | 'zoom',
  LyraChartEventMap,
  | 'lr-before-legend-visibility-change'
  | 'lr-legend-visibility-change'
  | 'lr-point-click'
  | 'lr-zoom',
  | '--border-color-1'
  | '--border-color-2'
  | '--border-color-3'
  | '--border-color-4'
  | '--border-color-5'
  | '--border-color-6'
  | '--border-radius'
  | '--border-width'
  | '--fill-color-1'
  | '--fill-color-2'
  | '--fill-color-3'
  | '--fill-color-4'
  | '--fill-color-5'
  | '--fill-color-6'
  | '--grid-border-width'
  | '--grid-color'
  | '--line-border-width'
  | '--lr-chart-canvas-hover-outline-width'
  | '--lr-chart-data-table-button-active-bg'
  | '--lr-chart-data-table-button-hover-bg'
  | '--lr-chart-grid-color'
  | '--lr-chart-height'
  | '--lr-chart-legend-color'
  | '--lr-chart-legend-item-active-bg'
  | '--lr-chart-legend-item-hover-bg'
  | '--lr-chart-pattern-step'
  | '--lr-chart-reset-zoom-button-active-bg'
  | '--lr-chart-reset-zoom-button-hover-bg'
  | '--lr-chart-tick-color'
  | '--lr-chart-tooltip-bg'
  | '--lr-chart-tooltip-text'
  | '--point-radius',
  {
    'accessible-description'?: LyraPolarAreaChart['accessibleDescription'];
    'accessible-label'?: LyraPolarAreaChart['accessibleLabel'];
    'begin-at-zero'?: LyraPolarAreaChart['beginAtZero'];
    'data-labels'?: LyraPolarAreaChart['dataLabels'];
    'index-axis'?: LyraPolarAreaChart['indexAxis'];
    'legend-position'?: LyraPolarAreaChart['legendPosition'];
    'show-data-table'?: LyraPolarAreaChart['showDataTable'];
    'stack-totals'?: LyraPolarAreaChart['stackTotals'];
    'without-animation'?: LyraPolarAreaChart['withoutAnimation'];
    'without-legend'?: LyraPolarAreaChart['withoutLegend'];
    'without-tooltip'?: LyraPolarAreaChart['withoutTooltip'];
    'x-label'?: LyraPolarAreaChart['xLabel'];
    'y-label'?: LyraPolarAreaChart['yLabel'];
    'y2-label'?: LyraPolarAreaChart['y2Label'];
  }
>;

export type LyraPolicySummarySvelteProps = LyraSvelteElementProps<
  LyraPolicySummary,
  | 'decisions'
  | 'locale'
  | 'strings',
  {},
never,
  | '--lr-policy-summary-count-allow-color'
  | '--lr-policy-summary-count-deny-color'
  | '--lr-policy-summary-count-needs-review-color',
  {}
>;

export type LyraPollStatusSvelteProps = LyraSvelteElementProps<
  LyraPollStatus,
  | 'active'
  | 'locale'
  | 'nextInMs'
  | 'paused'
  | 'strings',
  LyraPollStatusEventMap,
  | 'lr-pause-change'
  | 'lr-poll-due',
  | '--lr-poll-status-due-bg',
  {
    'next-in-ms'?: LyraPollStatus['nextInMs'];
  }
>;

export type LyraPopoverSvelteProps = LyraSvelteElementProps<
  LyraPopover,
  | 'accessibleLabel'
  | 'anchor'
  | 'arrow'
  | 'arrowPadding'
  | 'arrowPlacement'
  | 'distance'
  | 'for'
  | 'locale'
  | 'open'
  | 'placement'
  | 'popupRole'
  | 'skidding'
  | 'strings'
  | 'withoutArrow',
  LyraPopoverEventMap,
  | 'lr-after-hide'
  | 'lr-after-show'
  | 'lr-hide'
  | 'lr-show',
  | '--arrow-size'
  | '--hide-duration'
  | '--lr-overlay-arrow-size'
  | '--lr-overlay-max-inline-size'
  | '--max-width'
  | '--show-duration',
  {
    'aria-label'?: LyraPopover['accessibleLabel'];
    'arrow-padding'?: LyraPopover['arrowPadding'];
    'arrow-placement'?: LyraPopover['arrowPlacement'];
    'popup-role'?: LyraPopover['popupRole'];
    'without-arrow'?: LyraPopover['withoutArrow'];
  }
>;

export type LyraPopupSvelteProps = LyraSvelteElementProps<
  LyraPopup,
  | 'active'
  | 'anchor'
  | 'arrow'
  | 'arrowPadding'
  | 'arrowPlacement'
  | 'autoSize'
  | 'autoSizeBoundary'
  | 'autoSizePadding'
  | 'boundary'
  | 'distance'
  | 'flip'
  | 'flipBoundary'
  | 'flipFallbackPlacements'
  | 'flipFallbackStrategy'
  | 'flipPadding'
  | 'for'
  | 'hoverBridge'
  | 'locale'
  | 'padding'
  | 'placement'
  | 'popup'
  | 'shift'
  | 'shiftBoundary'
  | 'shiftPadding'
  | 'skidding'
  | 'strategy'
  | 'strings'
  | 'sync'
  | 'virtualAnchor',
  LyraPopupEventMap,
  | 'lr-reposition',
  | '--arrow-color'
  | '--arrow-size'
  | '--auto-size-available-height'
  | '--auto-size-available-width'
  | '--hide-duration'
  | '--lr-popup-arrow-size'
  | '--popup-border-width'
  | '--show-duration',
  {
    'arrow-padding'?: LyraPopup['arrowPadding'];
    'arrow-placement'?: LyraPopup['arrowPlacement'];
    'auto-size'?: LyraPopup['autoSize'];
    'auto-size-padding'?: LyraPopup['autoSizePadding'];
    'flip-fallback-placements'?: LyraPopup['flipFallbackPlacements'];
    'flip-fallback-strategy'?: LyraPopup['flipFallbackStrategy'];
    'flip-padding'?: LyraPopup['flipPadding'];
    'hover-bridge'?: LyraPopup['hoverBridge'];
    'shift-padding'?: LyraPopup['shiftPadding'];
  }
>;

export type LyraPptxViewerSvelteProps = LyraSvelteElementProps<
  LyraPptxViewer,
  | 'activeHighlightId'
  | 'anchor'
  | 'highlights'
  | 'label'
  | 'locale'
  | 'maxHeight'
  | 'name'
  | 'src'
  | 'strings',
  LyraPptxViewerEventMap,
  | 'lr-anchor-result'
  | 'lr-load'
  | 'lr-render-error'
  | 'lr-search-change'
  | 'lr-slide-change'
  | 'lr-text-select',
  | '--lr-pptx-viewer-max-height',
  {
    'active-highlight-id'?: LyraPptxViewer['activeHighlightId'];
    'max-height'?: LyraPptxViewer['maxHeight'];
  }
>;

export type LyraProgressBarSvelteProps = LyraSvelteElementProps<
  LyraProgressBar,
  | 'accessibleLabel'
  | 'indeterminate'
  | 'label'
  | 'locale'
  | 'max'
  | 'showValue'
  | 'strings'
  | 'value'
  | 'variant',
  {},
never,
  | '--height'
  | '--indicator-color'
  | '--label-color'
  | '--lr-progress-duration'
  | '--lr-progress-indicator-color'
  | '--lr-progress-indicator-variant-color'
  | '--lr-progress-label-color'
  | '--lr-progress-track-color'
  | '--lr-progress-track-height'
  | '--track-color'
  | '--track-height',
  {
    'accessible-label'?: LyraProgressBar['accessibleLabel'];
    'show-value'?: LyraProgressBar['showValue'];
  }
>;

export type LyraProgressRingSvelteProps = LyraSvelteElementProps<
  LyraProgressRing,
  | 'accessibleLabel'
  | 'indeterminate'
  | 'label'
  | 'locale'
  | 'max'
  | 'strings'
  | 'value',
  {},
never,
  | '--indicator-color'
  | '--indicator-transition-duration'
  | '--indicator-width'
  | '--lr-progress-duration'
  | '--lr-progress-ring-indicator-color'
  | '--lr-progress-ring-indicator-transition-duration'
  | '--lr-progress-ring-indicator-width'
  | '--lr-progress-ring-size'
  | '--lr-progress-ring-track-color'
  | '--lr-progress-ring-track-width'
  | '--size'
  | '--track-color'
  | '--track-width',
  {
    'accessible-label'?: LyraProgressRing['accessibleLabel'];
  }
>;

export type LyraPromptInputSvelteProps = LyraSvelteElementProps<
  LyraPromptInput,
  | 'accessibleLabel'
  | 'attachmentCapabilities'
  | 'attachments'
  | 'autocapitalize'
  | 'autocomplete'
  | 'autoCorrect'
  | 'commandItems'
  | 'disabled'
  | 'enterKeyHint'
  | 'inputMode'
  | 'label'
  | 'locale'
  | 'mentionItems'
  | 'model'
  | 'modelCatalog'
  | 'placeholder'
  | 'queue'
  | 'selectedSourceIds'
  | 'selectionDirection'
  | 'selectionEnd'
  | 'selectionStart'
  | 'sources'
  | 'spellcheck'
  | 'status'
  | 'strings'
  | 'submitOnEnter'
  | 'value'
  | 'voice'
  | 'voiceCatalog'
  | 'wrap',
  LyraPromptInputEventMap,
  | 'lr-attachment-preview'
  | 'lr-attachment-remove'
  | 'lr-attachment-retry'
  | 'lr-attachments-add'
  | 'lr-audio-request'
  | 'lr-camera-request'
  | 'lr-input'
  | 'lr-mention-select'
  | 'lr-model-change'
  | 'lr-queue-change'
  | 'lr-send-now'
  | 'lr-sources-change'
  | 'lr-stop'
  | 'lr-submit'
  | 'lr-voice-change',
never,
  {
    'aria-label'?: LyraPromptInput['accessibleLabel'];
    'autocorrect'?: LyraPromptInput['autoCorrect'];
    'enterkeyhint'?: LyraPromptInput['enterKeyHint'];
    'inputmode'?: LyraPromptInput['inputMode'];
    'submit-on-enter'?: LyraPromptInput['submitOnEnter'];
  }
>;

export type LyraPromptQueueSvelteProps = LyraSvelteElementProps<
  LyraPromptQueue,
  | 'accessibleLabel'
  | 'disabled'
  | 'editable'
  | 'items'
  | 'label'
  | 'locale'
  | 'strings',
  LyraPromptQueueEventMap,
  | 'lr-queue-change'
  | 'lr-send-now',
never,
  {
    'aria-label'?: LyraPromptQueue['accessibleLabel'];
  }
>;

export type LyraPromptStudioSvelteProps = LyraSvelteElementProps<
  LyraPromptStudio,
  | 'autocapitalize'
  | 'autoCorrect'
  | 'disabled'
  | 'label'
  | 'locale'
  | 'messages'
  | 'reorderable'
  | 'running'
  | 'selectedVersionId'
  | 'spellcheck'
  | 'strings'
  | 'variables'
  | 'versions'
  | 'wrap',
  LyraPromptStudioEventMap,
  | 'blur'
  | 'focus'
  | 'lr-change'
  | 'lr-message-reorder'
  | 'lr-run'
  | 'lr-save'
  | 'lr-version-select',
  | '--lr-prompt-studio-field-hover-border'
  | '--lr-prompt-studio-version-selected-bg'
  | '--lr-prompt-studio-version-selected-border'
  | '--lr-prompt-studio-version-selected-color'
  | '--lr-prompt-studio-version-selected-hover-bg',
  {
    'autocorrect'?: LyraPromptStudio['autoCorrect'];
    'selected-version-id'?: LyraPromptStudio['selectedVersionId'];
  }
>;

export type LyraProvenancePanelSvelteProps = LyraSvelteElementProps<
  LyraProvenancePanel,
  | 'label'
  | 'locale'
  | 'provenance'
  | 'strings'
  | 'thresholds'
  | 'types',
  LyraProvenancePanelEventMap,
  | 'lr-drill'
  | 'lr-entity-activate'
  | 'lr-entity-open'
  | 'lr-relation-activate'
  | 'lr-toggle',
  | '--lr-provenance-panel-entity-justify',
  {}
>;

export type LyraPushToTalkSvelteProps = LyraSvelteElementProps<
  LyraPushToTalk,
  | 'audioConstraints'
  | 'deviceId'
  | 'disabled'
  | 'levelEvents'
  | 'locale'
  | 'maxDurationMs'
  | 'mimeType'
  | 'mode'
  | 'showTimer'
  | 'state'
  | 'strings'
  | 'timesliceMs',
  LyraPushToTalkEventMap,
  | 'lr-level'
  | 'lr-record-cancel'
  | 'lr-record-chunk'
  | 'lr-record-error'
  | 'lr-record-start'
  | 'lr-record-stop'
  | 'lr-state-change',
  | '--lr-push-to-talk-pulse-recording-border-color'
  | '--lr-push-to-talk-recording-color'
  | '--lr-push-to-talk-size'
  | '--lr-push-to-talk-trigger-recording-border-color'
  | '--lr-push-to-talk-trigger-recording-color',
  {
    'device-id'?: LyraPushToTalk['deviceId'];
    'level-events'?: LyraPushToTalk['levelEvents'];
    'max-duration-ms'?: LyraPushToTalk['maxDurationMs'];
    'mime-type'?: LyraPushToTalk['mimeType'];
    'show-timer'?: LyraPushToTalk['showTimer'];
    'timeslice-ms'?: LyraPushToTalk['timesliceMs'];
  }
>;

export type LyraQrCodeSvelteProps = LyraSvelteElementProps<
  LyraQrCode,
  | 'background'
  | 'errorCorrection'
  | 'fill'
  | 'image'
  | 'imageBackground'
  | 'imageCoverage'
  | 'imagePadding'
  | 'label'
  | 'locale'
  | 'radius'
  | 'size'
  | 'strings'
  | 'value',
  {},
never,
  | '--lr-qr-code-background'
  | '--lr-qr-code-fill',
  {
    'error-correction'?: LyraQrCode['errorCorrection'];
    'image-background'?: LyraQrCode['imageBackground'];
    'image-coverage'?: LyraQrCode['imageCoverage'];
    'image-padding'?: LyraQrCode['imagePadding'];
  }
>;

export type LyraQueryBuilderSvelteProps = LyraSvelteElementProps<
  LyraQueryBuilder,
  | 'disabled'
  | 'fields'
  | 'locale'
  | 'strings'
  | 'value',
  LyraQueryBuilderEventMap,
  | 'lr-add-condition'
  | 'lr-input'
  | 'lr-remove-condition',
never,
  {}
>;

export type LyraRadarChartSvelteProps = LyraSvelteElementProps<
  LyraRadarChart,
  | 'accessibleDescription'
  | 'accessibleLabel'
  | 'area'
  | 'beginAtZero'
  | 'config'
  | 'dataLabels'
  | 'datasets'
  | 'description'
  | 'grid'
  | 'height'
  | 'hiddenDatasets'
  | 'indexAxis'
  | 'label'
  | 'labels'
  | 'legend'
  | 'legendPosition'
  | 'locale'
  | 'max'
  | 'min'
  | 'plugins'
  | 'showDataTable'
  | 'stacked'
  | 'stackTotals'
  | 'strings'
  | 'type'
  | 'valueFormatter'
  | 'withoutAnimation'
  | 'withoutLegend'
  | 'withoutTooltip'
  | 'xLabel'
  | 'y2Label'
  | 'yLabel'
  | 'zoom',
  LyraChartEventMap,
  | 'lr-before-legend-visibility-change'
  | 'lr-legend-visibility-change'
  | 'lr-point-click'
  | 'lr-zoom',
  | '--border-color-1'
  | '--border-color-2'
  | '--border-color-3'
  | '--border-color-4'
  | '--border-color-5'
  | '--border-color-6'
  | '--border-radius'
  | '--border-width'
  | '--fill-color-1'
  | '--fill-color-2'
  | '--fill-color-3'
  | '--fill-color-4'
  | '--fill-color-5'
  | '--fill-color-6'
  | '--grid-border-width'
  | '--grid-color'
  | '--line-border-width'
  | '--lr-chart-canvas-hover-outline-width'
  | '--lr-chart-data-table-button-active-bg'
  | '--lr-chart-data-table-button-hover-bg'
  | '--lr-chart-grid-color'
  | '--lr-chart-height'
  | '--lr-chart-legend-color'
  | '--lr-chart-legend-item-active-bg'
  | '--lr-chart-legend-item-hover-bg'
  | '--lr-chart-pattern-step'
  | '--lr-chart-reset-zoom-button-active-bg'
  | '--lr-chart-reset-zoom-button-hover-bg'
  | '--lr-chart-tick-color'
  | '--lr-chart-tooltip-bg'
  | '--lr-chart-tooltip-text'
  | '--point-radius',
  {
    'accessible-description'?: LyraRadarChart['accessibleDescription'];
    'accessible-label'?: LyraRadarChart['accessibleLabel'];
    'begin-at-zero'?: LyraRadarChart['beginAtZero'];
    'data-labels'?: LyraRadarChart['dataLabels'];
    'index-axis'?: LyraRadarChart['indexAxis'];
    'legend-position'?: LyraRadarChart['legendPosition'];
    'show-data-table'?: LyraRadarChart['showDataTable'];
    'stack-totals'?: LyraRadarChart['stackTotals'];
    'without-animation'?: LyraRadarChart['withoutAnimation'];
    'without-legend'?: LyraRadarChart['withoutLegend'];
    'without-tooltip'?: LyraRadarChart['withoutTooltip'];
    'x-label'?: LyraRadarChart['xLabel'];
    'y-label'?: LyraRadarChart['yLabel'];
    'y2-label'?: LyraRadarChart['y2Label'];
  }
>;

export type LyraRadioSvelteProps = LyraSvelteElementProps<
  LyraRadio,
  | 'appearance'
  | 'checked'
  | 'customError'
  | 'defaultChecked'
  | 'disabled'
  | 'form'
  | 'locale'
  | 'name'
  | 'pill'
  | 'required'
  | 'size'
  | 'strings'
  | 'value',
  LyraRadioEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-blur'
  | 'lr-change'
  | 'lr-focus'
  | 'lr-input'
  | 'lr-invalid',
  | '--checked-icon-color'
  | '--checked-icon-scale'
  | '--lr-radio-active-border-color'
  | '--lr-radio-active-ring-color'
  | '--lr-radio-checked-border-color'
  | '--lr-radio-checked-dot-color'
  | '--lr-radio-circle-size'
  | '--lr-radio-dot-size'
  | '--lr-radio-hover-border-color'
  | '--lr-radio-label-indent'
  | '--lr-radio-radius',
  {
    'checked'?: LyraRadio['defaultChecked'];
    'custom-error'?: LyraRadio['customError'];
  }
>;

export type LyraRadioButtonSvelteProps = LyraSvelteElementProps<
  LyraRadioButton,
  | 'appearance'
  | 'checked'
  | 'customError'
  | 'defaultChecked'
  | 'disabled'
  | 'form'
  | 'locale'
  | 'name'
  | 'pill'
  | 'required'
  | 'size'
  | 'strings'
  | 'value',
  LyraRadioEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-blur'
  | 'lr-change'
  | 'lr-focus'
  | 'lr-input'
  | 'lr-invalid',
  | '--checked-icon-color'
  | '--checked-icon-scale'
  | '--lr-radio-active-border-color'
  | '--lr-radio-active-ring-color'
  | '--lr-radio-button-active-bg'
  | '--lr-radio-button-active-border-color'
  | '--lr-radio-button-checked-active-bg'
  | '--lr-radio-button-checked-active-border-color'
  | '--lr-radio-button-checked-bg'
  | '--lr-radio-button-checked-border-color'
  | '--lr-radio-button-checked-color'
  | '--lr-radio-button-checked-hover-bg'
  | '--lr-radio-button-checked-hover-border-color'
  | '--lr-radio-button-gap'
  | '--lr-radio-button-hover-bg'
  | '--lr-radio-button-hover-border-color'
  | '--lr-radio-checked-border-color'
  | '--lr-radio-checked-dot-color'
  | '--lr-radio-circle-size'
  | '--lr-radio-dot-size'
  | '--lr-radio-hover-border-color'
  | '--lr-radio-label-indent'
  | '--lr-radio-radius',
  {
    'checked'?: LyraRadioButton['defaultChecked'];
    'custom-error'?: LyraRadioButton['customError'];
  }
>;

export type LyraRadioGroupSvelteProps = LyraSvelteElementProps<
  LyraRadioGroup,
  | 'accessibleLabel'
  | 'customError'
  | 'defaultValue'
  | 'disabled'
  | 'errorText'
  | 'form'
  | 'helpText'
  | 'hint'
  | 'label'
  | 'locale'
  | 'name'
  | 'orientation'
  | 'required'
  | 'size'
  | 'strings'
  | 'value'
  | 'withHint'
  | 'withLabel',
  LyraRadioGroupEventMap,
  | 'change'
  | 'input'
  | 'lr-change'
  | 'lr-input'
  | 'lr-invalid',
  | '--lr-form-control-required-color'
  | '--lr-form-control-required-content'
  | '--lr-form-control-required-offset'
  | '--lr-radio-group-row-gap',
  {
    'aria-label'?: LyraRadioGroup['accessibleLabel'];
    'custom-error'?: LyraRadioGroup['customError'];
    'default-value'?: LyraUnknownAttributeValue;
    'error-text'?: LyraRadioGroup['errorText'];
    'help-text'?: LyraRadioGroup['helpText'];
    'value'?: LyraRadioGroup['defaultValue'];
    'with-hint'?: LyraRadioGroup['withHint'];
    'with-label'?: LyraRadioGroup['withLabel'];
  }
>;

export type LyraRagAnswerSvelteProps = LyraSvelteElementProps<
  LyraRagAnswer,
  | 'accessibleLabel'
  | 'answer'
  | 'assessment'
  | 'citations'
  | 'errorText'
  | 'label'
  | 'loading'
  | 'locale'
  | 'showClaims'
  | 'showSources'
  | 'sources'
  | 'strings',
  LyraRagAnswerEventMap,
  | 'lr-citation-select'
  | 'lr-claim-select'
  | 'lr-retry',
never,
  {
    'aria-label'?: LyraRagAnswer['accessibleLabel'];
    'error-text'?: LyraRagAnswer['errorText'];
    'show-claims'?: LyraRagAnswer['showClaims'];
    'show-sources'?: LyraRagAnswer['showSources'];
  }
>;

export type LyraRagEvalDashboardSvelteProps = LyraSvelteElementProps<
  LyraRagEvalDashboard,
  | 'chartHeight'
  | 'label'
  | 'locale'
  | 'metricId'
  | 'metrics'
  | 'runs'
  | 'showChart'
  | 'slice'
  | 'strings',
  LyraRagEvalDashboardEventMap,
  | 'lr-metric-change'
  | 'lr-run-select'
  | 'lr-slice-change',
never,
  {
    'chart-height'?: LyraRagEvalDashboard['chartHeight'];
    'metric-id'?: LyraRagEvalDashboard['metricId'];
    'show-chart'?: LyraRagEvalDashboard['showChart'];
  }
>;

export type LyraRandomContentSvelteProps = LyraSvelteElementProps<
  LyraRandomContent,
  | 'animation'
  | 'autoplay'
  | 'autoplayInterval'
  | 'items'
  | 'locale'
  | 'mode'
  | 'paused'
  | 'strings',
  LyraRandomContentEventMap,
  | 'lr-content-change'
  | 'lr-pause-change',
  | '--animation-duration'
  | '--animation-easing'
  | '--animation-translate'
  | '--lr-animation-duration'
  | '--lr-animation-easing'
  | '--lr-animation-translate'
  | '--lr-random-content-animation-duration'
  | '--lr-random-content-animation-easing'
  | '--lr-random-content-animation-translate',
  {
    'autoplay-interval'?: LyraRandomContent['autoplayInterval'];
  }
>;

export type LyraRatingSvelteProps = LyraSvelteElementProps<
  LyraRating,
  | 'accessibleLabel'
  | 'customError'
  | 'defaultValue'
  | 'disabled'
  | 'form'
  | 'getSymbol'
  | 'label'
  | 'locale'
  | 'max'
  | 'name'
  | 'precision'
  | 'readonly'
  | 'required'
  | 'size'
  | 'strings'
  | 'value',
  LyraRatingEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'lr-blur'
  | 'lr-change'
  | 'lr-focus'
  | 'lr-hover'
  | 'lr-invalid',
  | '--lr-rating-active-color'
  | '--lr-rating-empty-color'
  | '--lr-rating-fill'
  | '--lr-rating-gap'
  | '--lr-rating-size'
  | '--symbol-color'
  | '--symbol-color-active'
  | '--symbol-size'
  | '--symbol-spacing',
  {
    'custom-error'?: LyraRating['customError'];
    'default-value'?: LyraRating['defaultValue'];
  }
>;

export type LyraRealtimeSessionSvelteProps = LyraSvelteElementProps<
  LyraRealtimeSession,
  | 'entries'
  | 'errorCode'
  | 'label'
  | 'level'
  | 'locale'
  | 'muted'
  | 'showCapture'
  | 'state'
  | 'stream'
  | 'strings'
  | 'voiceState',
  LyraRealtimeSessionEventMap,
  | 'lr-connect'
  | 'lr-disconnect'
  | 'lr-interrupt'
  | 'lr-level'
  | 'lr-mute-change'
  | 'lr-record-cancel'
  | 'lr-record-chunk'
  | 'lr-record-error'
  | 'lr-record-start'
  | 'lr-record-stop'
  | 'lr-state-change',
never,
  {
    'error-code'?: LyraRealtimeSession['errorCode'];
    'show-capture'?: LyraRealtimeSession['showCapture'];
    'voice-state'?: LyraRealtimeSession['voiceState'];
  }
>;

export type LyraRelativeTimeSvelteProps = LyraSvelteElementProps<
  LyraRelativeTime,
  | 'date'
  | 'format'
  | 'locale'
  | 'numeric'
  | 'strings'
  | 'sync'
  | 'unit',
  {},
never,
never,
  {}
>;

export type LyraReorderItemSvelteProps = LyraSvelteElementProps<
  LyraReorderItem,
  | 'atEnd'
  | 'atStart'
  | 'disabled'
  | 'listDisabled'
  | 'locale'
  | 'pending'
  | 'strings'
  | 'value',
  LyraReorderItemEventMap,
  | 'lr-move-request',
  | '--lr-reorder-item-gap'
  | '--lr-reorder-item-move-button-active-bg'
  | '--lr-reorder-item-move-button-active-color'
  | '--lr-reorder-item-move-button-hover-bg'
  | '--lr-reorder-item-move-button-hover-color',
  {}
>;

export type LyraReorderListSvelteProps = LyraSvelteElementProps<
  LyraReorderList,
  | 'disabled'
  | 'label'
  | 'locale'
  | 'strings',
  LyraReorderListEventMap,
  | 'lr-reorder',
  | '--lr-reorder-list-gap',
  {}
>;

export type LyraResizeObserverSvelteProps = LyraSvelteElementProps<
  LyraResizeObserver,
  | 'box'
  | 'disabled'
  | 'locale'
  | 'strings',
  LyraResizeObserverEventMap,
  | 'lr-resize',
never,
  {}
>;

export type LyraResponsivePanelSvelteProps = LyraSvelteElementProps<
  LyraResponsivePanel,
  | 'label'
  | 'locale'
  | 'mobileBreakpoint'
  | 'mode'
  | 'open'
  | 'strings'
  | 'variant',
  LyraResponsivePanelEventMap,
  | 'lr-close'
  | 'lr-mode-change',
  | '--lr-responsive-panel-overlay-color'
  | '--lr-responsive-panel-overlay-panel-bg'
  | '--lr-responsive-panel-overlay-panel-shadow'
  | '--lr-responsive-panel-sheet-max-block-size',
  {
    'aria-label'?: LyraUnknownAttributeValue;
    'mobile-breakpoint'?: LyraResponsivePanel['mobileBreakpoint'];
  }
>;

export type LyraResultCardSvelteProps = LyraSvelteElementProps<
  LyraResultCard,
  | 'compact'
  | 'frame'
  | 'locale'
  | 'strings'
  | 'title'
  | 'withActions',
  {},
never,
  | '--lr-result-card-compact-body-gap'
  | '--lr-result-card-compact-body-padding'
  | '--lr-result-card-compact-header-gap'
  | '--lr-result-card-compact-header-padding',
  {
    'with-actions'?: LyraResultCard['withActions'];
  }
>;

export type LyraResultFieldSvelteProps = LyraSvelteElementProps<
  LyraResultField,
  | 'label'
  | 'locale'
  | 'strings'
  | 'value',
  {},
never,
never,
  {}
>;

export type LyraRetrievalCompareSvelteProps = LyraSvelteElementProps<
  LyraRetrievalCompare,
  | 'label'
  | 'locale'
  | 'selectedChunkId'
  | 'sets'
  | 'strings'
  | 'topK',
  LyraRetrievalCompareEventMap,
  | 'lr-chunk-select',
  | '--lr-retrieval-compare-selected-border',
  {
    'selected-chunk-id'?: LyraRetrievalCompare['selectedChunkId'];
    'top-k'?: LyraRetrievalCompare['topK'];
  }
>;

export type LyraRetrievalResultsSvelteProps = LyraSvelteElementProps<
  LyraRetrievalResults,
  | 'activeId'
  | 'chunks'
  | 'dedupe'
  | 'errorText'
  | 'groupBy'
  | 'grouping'
  | 'groupLabel'
  | 'groupOrder'
  | 'hasMore'
  | 'label'
  | 'loading'
  | 'locale'
  | 'presentation'
  | 'selectable'
  | 'selectedIds'
  | 'sort'
  | 'strings'
  | 'thresholds'
  | 'virtualizeAt',
  LyraRetrievalResultsEventMap,
  | 'lr-chunk-open'
  | 'lr-load-more'
  | 'lr-select',
  | '--lr-retrieval-results-selected-border',
  {
    'active-id'?: LyraRetrievalResults['activeId'];
    'error-text'?: LyraRetrievalResults['errorText'];
    'has-more'?: LyraRetrievalResults['hasMore'];
    'virtualize-at'?: LyraRetrievalResults['virtualizeAt'];
  }
>;

export type LyraRetrievalSearchSvelteProps = LyraSvelteElementProps<
  LyraRetrievalSearch,
  | 'accessibleLabel'
  | 'empty'
  | 'errorText'
  | 'filters'
  | 'label'
  | 'loading'
  | 'locale'
  | 'mode'
  | 'placeholder'
  | 'query'
  | 'scope'
  | 'strings',
  LyraRetrievalSearchEventMap,
  | 'lr-cancel'
  | 'lr-filters-change'
  | 'lr-search',
never,
  {
    'aria-label'?: LyraRetrievalSearch['accessibleLabel'];
    'error-text'?: LyraRetrievalSearch['errorText'];
  }
>;

export type LyraRetrievalTraceSvelteProps = LyraSvelteElementProps<
  LyraRetrievalTrace,
  | 'activeStageId'
  | 'label'
  | 'locale'
  | 'stages'
  | 'strings',
  LyraRetrievalTraceEventMap,
  | 'lr-stage-select'
  | 'lr-stage-toggle',
  | '--lr-retrieval-trace-active-border',
  {
    'active-stage-id'?: LyraRetrievalTrace['activeStageId'];
  }
>;

export type LyraRubricFormSvelteProps = LyraSvelteElementProps<
  LyraRubricForm,
  | 'customError'
  | 'disabled'
  | 'errorText'
  | 'form'
  | 'hasNext'
  | 'helpText'
  | 'hint'
  | 'itemId'
  | 'keys'
  | 'label'
  | 'locale'
  | 'name'
  | 'skippable'
  | 'strings'
  | 'value'
  | 'withHint'
  | 'withLabel',
  LyraRubricFormEventMap,
  | 'lr-input'
  | 'lr-invalid'
  | 'lr-skip'
  | 'lr-submit'
  | 'lr-validity-change',
  | '--lr-form-control-required-color'
  | '--lr-form-control-required-content'
  | '--lr-form-control-required-offset'
  | '--lr-rubric-form-skip-active-bg'
  | '--lr-rubric-form-skip-bg'
  | '--lr-rubric-form-skip-border-color'
  | '--lr-rubric-form-skip-color'
  | '--lr-rubric-form-skip-hover-bg'
  | '--lr-rubric-form-submit-active-bg'
  | '--lr-rubric-form-submit-active-border-color'
  | '--lr-rubric-form-submit-bg'
  | '--lr-rubric-form-submit-border-color'
  | '--lr-rubric-form-submit-color'
  | '--lr-rubric-form-submit-hover-bg'
  | '--lr-rubric-form-submit-hover-border-color',
  {
    'custom-error'?: LyraRubricForm['customError'];
    'error-text'?: LyraRubricForm['errorText'];
    'has-next'?: LyraRubricForm['hasNext'];
    'help-text'?: LyraRubricForm['helpText'];
    'item-id'?: LyraRubricForm['itemId'];
    'with-hint'?: LyraRubricForm['withHint'];
    'with-label'?: LyraRubricForm['withLabel'];
  }
>;

export type LyraScatterChartSvelteProps = LyraSvelteElementProps<
  LyraScatterChart,
  | 'accessibleDescription'
  | 'accessibleLabel'
  | 'area'
  | 'beginAtZero'
  | 'config'
  | 'dataLabels'
  | 'datasets'
  | 'description'
  | 'grid'
  | 'height'
  | 'hiddenDatasets'
  | 'indexAxis'
  | 'label'
  | 'labels'
  | 'legend'
  | 'legendPosition'
  | 'locale'
  | 'max'
  | 'min'
  | 'plugins'
  | 'showDataTable'
  | 'stacked'
  | 'stackTotals'
  | 'strings'
  | 'type'
  | 'valueFormatter'
  | 'withoutAnimation'
  | 'withoutLegend'
  | 'withoutTooltip'
  | 'xLabel'
  | 'y2Label'
  | 'yLabel'
  | 'zoom',
  LyraChartEventMap,
  | 'lr-before-legend-visibility-change'
  | 'lr-legend-visibility-change'
  | 'lr-point-click'
  | 'lr-zoom',
  | '--border-color-1'
  | '--border-color-2'
  | '--border-color-3'
  | '--border-color-4'
  | '--border-color-5'
  | '--border-color-6'
  | '--border-radius'
  | '--border-width'
  | '--fill-color-1'
  | '--fill-color-2'
  | '--fill-color-3'
  | '--fill-color-4'
  | '--fill-color-5'
  | '--fill-color-6'
  | '--grid-border-width'
  | '--grid-color'
  | '--line-border-width'
  | '--lr-chart-canvas-hover-outline-width'
  | '--lr-chart-data-table-button-active-bg'
  | '--lr-chart-data-table-button-hover-bg'
  | '--lr-chart-grid-color'
  | '--lr-chart-height'
  | '--lr-chart-legend-color'
  | '--lr-chart-legend-item-active-bg'
  | '--lr-chart-legend-item-hover-bg'
  | '--lr-chart-pattern-step'
  | '--lr-chart-reset-zoom-button-active-bg'
  | '--lr-chart-reset-zoom-button-hover-bg'
  | '--lr-chart-tick-color'
  | '--lr-chart-tooltip-bg'
  | '--lr-chart-tooltip-text'
  | '--point-radius',
  {
    'accessible-description'?: LyraScatterChart['accessibleDescription'];
    'accessible-label'?: LyraScatterChart['accessibleLabel'];
    'begin-at-zero'?: LyraScatterChart['beginAtZero'];
    'data-labels'?: LyraScatterChart['dataLabels'];
    'index-axis'?: LyraScatterChart['indexAxis'];
    'legend-position'?: LyraScatterChart['legendPosition'];
    'show-data-table'?: LyraScatterChart['showDataTable'];
    'stack-totals'?: LyraScatterChart['stackTotals'];
    'without-animation'?: LyraScatterChart['withoutAnimation'];
    'without-legend'?: LyraScatterChart['withoutLegend'];
    'without-tooltip'?: LyraScatterChart['withoutTooltip'];
    'x-label'?: LyraScatterChart['xLabel'];
    'y-label'?: LyraScatterChart['yLabel'];
    'y2-label'?: LyraScatterChart['y2Label'];
  }
>;

export type LyraSchemaViewerSvelteProps = LyraSvelteElementProps<
  LyraSchemaViewer,
  | 'issues'
  | 'label'
  | 'locale'
  | 'maxDepth'
  | 'schema'
  | 'selectedPath'
  | 'strings',
  LyraSchemaViewerEventMap,
  | 'lr-schema-select',
  | '--lr-schema-viewer-error-bg'
  | '--lr-schema-viewer-error-border'
  | '--lr-schema-viewer-info-bg'
  | '--lr-schema-viewer-info-border'
  | '--lr-schema-viewer-selected-border'
  | '--lr-schema-viewer-warning-bg'
  | '--lr-schema-viewer-warning-border',
  {
    'max-depth'?: LyraSchemaViewer['maxDepth'];
    'selected-path'?: LyraSchemaViewer['selectedPath'];
  }
>;

export type LyraScrollerSvelteProps = LyraSvelteElementProps<
  LyraScroller,
  | 'controls'
  | 'hideScrollbar'
  | 'label'
  | 'locale'
  | 'orientation'
  | 'scrollStep'
  | 'strings'
  | 'withoutScrollbar'
  | 'withoutShadow',
  LyraScrollerEventMap,
  | 'lr-scroll',
  | '--lr-scroller-control-size'
  | '--lr-scroller-min-block-size'
  | '--shadow-color'
  | '--shadow-size',
  {
    'hide-scrollbar'?: LyraScroller['hideScrollbar'];
    'scroll-step'?: LyraScroller['scrollStep'];
    'without-scrollbar'?: LyraScroller['withoutScrollbar'];
    'without-shadow'?: LyraScroller['withoutShadow'];
  }
>;

export type LyraSegmentedSvelteProps = LyraSvelteElementProps<
  LyraSegmented,
  | 'items'
  | 'label'
  | 'locale'
  | 'size'
  | 'strings'
  | 'value',
  LyraSegmentedEventMap,
  | 'lr-change',
  | '--lr-scroll-fade-size'
  | '--lr-segmented-active-bg'
  | '--lr-segmented-active-color'
  | '--lr-segmented-font-size'
  | '--lr-segmented-hover-color'
  | '--lr-segmented-segment-padding'
  | '--lr-segmented-selected-bg'
  | '--lr-segmented-selected-color'
  | '--lr-segmented-selected-font-weight'
  | '--lr-segmented-selected-shadow'
  | '--lr-segmented-track-gap'
  | '--lr-segmented-track-height'
  | '--lr-segmented-track-min-height'
  | '--lr-segmented-track-padding'
  | '--lr-segmented-track-radius',
  {}
>;

export type LyraSelectSvelteProps = LyraSvelteElementProps<
  LyraSelect,
  | 'appearance'
  | 'autoCommitSingleOption'
  | 'autofocus'
  | 'clearable'
  | 'customError'
  | 'defaultValue'
  | 'disabled'
  | 'errorText'
  | 'filled'
  | 'form'
  | 'getTag'
  | 'helpText'
  | 'hint'
  | 'hoist'
  | 'label'
  | 'locale'
  | 'maxOptionsVisible'
  | 'multiple'
  | 'name'
  | 'open'
  | 'pill'
  | 'placeholder'
  | 'placement'
  | 'required'
  | 'selectedOptions'
  | 'size'
  | 'strings'
  | 'title'
  | 'value'
  | 'withClear'
  | 'withHint'
  | 'withLabel',
  LyraSelectEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-after-hide'
  | 'lr-after-show'
  | 'lr-blur'
  | 'lr-change'
  | 'lr-clear'
  | 'lr-focus'
  | 'lr-hide'
  | 'lr-input'
  | 'lr-invalid'
  | 'lr-show',
  | '--hide-duration'
  | '--lr-form-control-required-color'
  | '--lr-form-control-required-content'
  | '--lr-form-control-required-offset'
  | '--lr-select-expand-size'
  | '--lr-select-font-size'
  | '--lr-select-gap'
  | '--lr-select-open-border-color'
  | '--lr-select-option-active-bg'
  | '--lr-select-option-selected-bg'
  | '--lr-select-option-selected-border'
  | '--lr-select-option-selected-color'
  | '--lr-select-option-selected-font-weight'
  | '--lr-select-radius'
  | '--lr-select-tag-font-size'
  | '--lr-select-tag-padding'
  | '--lr-select-trigger-active-bg'
  | '--lr-select-trigger-height'
  | '--lr-select-trigger-hover-bg'
  | '--lr-select-trigger-min-height'
  | '--lr-select-trigger-padding'
  | '--show-duration'
  | '--tag-max-size',
  {
    'auto-commit-single-option'?: LyraSelect['autoCommitSingleOption'];
    'custom-error'?: LyraSelect['customError'];
    'default-value'?: LyraSelect['defaultValue'];
    'error-text'?: LyraSelect['errorText'];
    'help-text'?: LyraSelect['helpText'];
    'max-options-visible'?: LyraSelect['maxOptionsVisible'];
    'with-clear'?: LyraSelect['withClear'];
    'with-hint'?: LyraSelect['withHint'];
    'with-label'?: LyraSelect['withLabel'];
  }
>;

export type LyraSelectionToolbarSvelteProps = LyraSvelteElementProps<
  LyraSelectionToolbar,
  | 'accessibleLabel'
  | 'actions'
  | 'anchor'
  | 'label'
  | 'locale'
  | 'open'
  | 'rect'
  | 'strings'
  | 'text',
  LyraSelectionToolbarEventMap,
  | 'lr-copy-error'
  | 'lr-dismiss'
  | 'lr-selection-action',
  | '--lr-selection-toolbar-block-shift'
  | '--lr-selection-toolbar-block-start'
  | '--lr-selection-toolbar-inline-shift'
  | '--lr-selection-toolbar-inline-start'
  | '--lr-selection-toolbar-placement-gap',
  {
    'aria-label'?: LyraSelectionToolbar['accessibleLabel'];
  }
>;

export type LyraSequenceStripSvelteProps = LyraSvelteElementProps<
  LyraSequenceStrip,
  | 'accessibleLabel'
  | 'categories'
  | 'items'
  | 'locale'
  | 'markerLabel'
  | 'showLegend'
  | 'strings',
  {},
never,
  | '--lr-sequence-strip-height'
  | '--lr-sequence-strip-legend-marker-bg'
  | '--lr-sequence-strip-legend-swatch-size'
  | '--lr-sequence-strip-marker-color',
  {
    'accessible-label'?: LyraSequenceStrip['accessibleLabel'];
    'aria-label'?: LyraUnknownAttributeValue;
    'marker-label'?: LyraSequenceStrip['markerLabel'];
    'show-legend'?: LyraSequenceStrip['showLegend'];
  }
>;

export type LyraSkeletonSvelteProps = LyraSvelteElementProps<
  LyraSkeleton,
  | 'announce'
  | 'effect'
  | 'height'
  | 'label'
  | 'locale'
  | 'strings'
  | 'variant'
  | 'width',
  {},
never,
  | '--border-radius'
  | '--color'
  | '--lr-skeleton-border-radius'
  | '--lr-skeleton-color'
  | '--lr-skeleton-h'
  | '--lr-skeleton-sheen-color'
  | '--lr-skeleton-w'
  | '--lr-transition-ambient'
  | '--sheen-color',
  {}
>;

export type LyraSliderSvelteProps = LyraSvelteElementProps<
  LyraSlider,
  | 'autofocus'
  | 'customError'
  | 'defaultValue'
  | 'disabled'
  | 'errorText'
  | 'form'
  | 'helpText'
  | 'hint'
  | 'indicatorOffset'
  | 'label'
  | 'locale'
  | 'max'
  | 'maxValue'
  | 'min'
  | 'minValue'
  | 'name'
  | 'orientation'
  | 'range'
  | 'readonly'
  | 'required'
  | 'showValue'
  | 'size'
  | 'step'
  | 'strings'
  | 'tooltip'
  | 'tooltipDistance'
  | 'tooltipFormatter'
  | 'tooltipPlacement'
  | 'value'
  | 'valueAsNumber'
  | 'valueAsString'
  | 'valueFormatter'
  | 'withHint'
  | 'withLabel'
  | 'withMarkers'
  | 'withTooltip',
  LyraSliderEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-blur'
  | 'lr-change'
  | 'lr-focus'
  | 'lr-input'
  | 'lr-invalid',
  | '--lr-form-control-required-color'
  | '--lr-form-control-required-content'
  | '--lr-form-control-required-offset'
  | '--lr-slider-gap'
  | '--lr-slider-row-size'
  | '--lr-slider-thumb-active-ring-color'
  | '--lr-slider-thumb-bg'
  | '--lr-slider-thumb-border-color'
  | '--lr-slider-thumb-hover-ring-color'
  | '--lr-slider-thumb-size'
  | '--lr-slider-tooltip-distance'
  | '--lr-slider-track-length'
  | '--lr-slider-track-thickness'
  | '--marker-height'
  | '--marker-width'
  | '--thumb-height'
  | '--thumb-size'
  | '--thumb-width'
  | '--tooltip-offset'
  | '--track-active-offset'
  | '--track-color-active'
  | '--track-color-inactive'
  | '--track-height'
  | '--track-size',
  {
    'custom-error'?: LyraSlider['customError'];
    'error-text'?: LyraSlider['errorText'];
    'help-text'?: LyraSlider['helpText'];
    'indicator-offset'?: LyraSlider['indicatorOffset'];
    'max-value'?: LyraSlider['maxValue'];
    'min-value'?: LyraSlider['minValue'];
    'show-value'?: LyraSlider['showValue'];
    'tooltip-distance'?: LyraSlider['tooltipDistance'];
    'tooltip-placement'?: LyraSlider['tooltipPlacement'];
    'value'?: LyraSlider['defaultValue'];
    'with-hint'?: LyraSlider['withHint'];
    'with-label'?: LyraSlider['withLabel'];
    'with-markers'?: LyraSlider['withMarkers'];
    'with-tooltip'?: LyraSlider['withTooltip'];
  }
>;

export type LyraSourceCardSvelteProps = LyraSvelteElementProps<
  LyraSourceCard,
  | 'compact'
  | 'frame'
  | 'href'
  | 'locale'
  | 'page'
  | 'sourceId'
  | 'strings'
  | 'title',
  LyraSourceCardEventMap,
  | 'lr-expand'
  | 'lr-open',
  | '--lr-source-card-compact-gap'
  | '--lr-source-card-compact-padding',
  {
    'source-id'?: LyraSourceCard['sourceId'];
  }
>;

export type LyraSourceListSvelteProps = LyraSvelteElementProps<
  LyraSourceList,
  | 'expanded'
  | 'label'
  | 'labelPlural'
  | 'locale'
  | 'strings',
  LyraSourceListEventMap,
  | 'lr-toggle',
never,
  {
    'label-plural'?: LyraSourceList['labelPlural'];
  }
>;

export type LyraSourcePickerSvelteProps = LyraSvelteElementProps<
  LyraSourcePicker,
  | 'accessibleLabel'
  | 'label'
  | 'locale'
  | 'searchable'
  | 'selectedIds'
  | 'showSelectAll'
  | 'sources'
  | 'strings',
  LyraSourcePickerEventMap,
  | 'lr-sources-change',
  | '--lr-source-picker-checked-bg'
  | '--lr-source-picker-checked-border'
  | '--lr-source-picker-depth'
  | '--lr-source-picker-indent-size'
  | '--lr-source-picker-mixed-bg',
  {
    'aria-label'?: LyraSourcePicker['accessibleLabel'];
    'show-select-all'?: LyraSourcePicker['showSelectAll'];
  }
>;

export type LyraSpanWaterfallSvelteProps = LyraSvelteElementProps<
  LyraSpanWaterfall,
  | 'activeSpanId'
  | 'hideAxis'
  | 'label'
  | 'locale'
  | 'spans'
  | 'strings'
  | 'viewEndMs'
  | 'viewStartMs',
  LyraSpanWaterfallEventMap,
  | 'lr-span-select',
  | '--lr-span-waterfall-denied-color'
  | '--lr-span-waterfall-error-color'
  | '--lr-span-waterfall-name-width'
  | '--lr-span-waterfall-pending-border-color'
  | '--lr-span-waterfall-row-active-bg'
  | '--lr-span-waterfall-running-color'
  | '--lr-span-waterfall-running-stripe-color'
  | '--lr-span-waterfall-stripe-speed'
  | '--lr-span-waterfall-success-color',
  {
    'active-span-id'?: LyraSpanWaterfall['activeSpanId'];
    'hide-axis'?: LyraSpanWaterfall['hideAxis'];
    'view-end-ms'?: LyraSpanWaterfall['viewEndMs'];
    'view-start-ms'?: LyraSpanWaterfall['viewStartMs'];
  }
>;

export type LyraSparklineSvelteProps = LyraSvelteElementProps<
  LyraSparkline,
  | 'accessibleLabel'
  | 'appearance'
  | 'curve'
  | 'data'
  | 'label'
  | 'locale'
  | 'max'
  | 'min'
  | 'strings'
  | 'trend'
  | 'type'
  | 'values',
  {},
never,
  | '--fill-color'
  | '--line-color'
  | '--line-width'
  | '--lr-sparkline-stroke-width',
  {
    'aria-label'?: LyraSparkline['accessibleLabel'];
  }
>;

export type LyraSpinnerSvelteProps = LyraSvelteElementProps<
  LyraSpinner,
  | 'accessibleLabel'
  | 'labelPlacement'
  | 'locale'
  | 'strings',
  {},
never,
  | '--indicator-color'
  | '--lr-spinner-duration'
  | '--lr-spinner-size'
  | '--lr-spinner-track-width'
  | '--speed'
  | '--track-color'
  | '--track-width',
  {
    'aria-label'?: LyraSpinner['accessibleLabel'];
    'label-placement'?: LyraSpinner['labelPlacement'];
  }
>;

export type LyraSplitSvelteProps = LyraSvelteElementProps<
  LyraSplit,
  | 'collapse'
  | 'collapseBreakpointBasis'
  | 'collapseState'
  | 'defaultSizes'
  | 'dividerLabel'
  | 'floatBreakpoint'
  | 'locale'
  | 'min'
  | 'narrowOrientation'
  | 'open'
  | 'orientation'
  | 'orientationBreakpoint'
  | 'orientationBreakpointBasis'
  | 'panelConstraints'
  | 'railBreakpoint'
  | 'railWidth'
  | 'sizes'
  | 'storageKey'
  | 'strings',
  LyraSplitEventMap,
  | 'lr-resize'
  | 'lr-resize-request'
  | 'lr-split-collapse-change'
  | 'lr-split-constraints-invalid'
  | 'lr-split-orientation-change',
  | '--lr-split-divider-hit-slop'
  | '--lr-split-overlay-color',
  {
    'collapse-breakpoint-basis'?: LyraSplit['collapseBreakpointBasis'];
    'collapse-state'?: LyraSplit['collapseState'];
    'float-breakpoint'?: LyraSplit['floatBreakpoint'];
    'narrow-orientation'?: LyraSplit['narrowOrientation'];
    'orientation-breakpoint'?: LyraSplit['orientationBreakpoint'];
    'orientation-breakpoint-basis'?: LyraSplit['orientationBreakpointBasis'];
    'rail-breakpoint'?: LyraSplit['railBreakpoint'];
    'rail-width'?: LyraSplit['railWidth'];
    'storage-key'?: LyraSplit['storageKey'];
  }
>;

export type LyraSplitPanelSvelteProps = LyraSvelteElementProps<
  LyraSplitPanel,
  | 'disabled'
  | 'locale'
  | 'orientation'
  | 'position'
  | 'positionInPixels'
  | 'primary'
  | 'snap'
  | 'snapThreshold'
  | 'strings'
  | 'vertical',
  LyraSplitPanelEventMap,
  | 'lr-reposition'
  | 'lr-reposition-request',
  | '--divider-hit-area'
  | '--divider-width'
  | '--lr-split-panel-divider-hit-area'
  | '--lr-split-panel-divider-width'
  | '--lr-split-panel-max'
  | '--lr-split-panel-min'
  | '--max'
  | '--min',
  {
    'position-in-pixels'?: LyraSplitPanel['positionInPixels'];
    'snap-threshold'?: LyraSplitPanel['snapThreshold'];
  }
>;

export type LyraSpreadsheetViewerSvelteProps = LyraSvelteElementProps<
  LyraSpreadsheetViewer,
  | 'activeHighlightId'
  | 'anchor'
  | 'highlights'
  | 'locale'
  | 'maxHeight'
  | 'name'
  | 'src'
  | 'strings',
  LyraSpreadsheetViewerEventMap,
  | 'lr-anchor-result'
  | 'lr-highlight-activate'
  | 'lr-render-error'
  | 'lr-search-change',
  | '--lr-spreadsheet-viewer-highlight-color'
  | '--lr-spreadsheet-viewer-highlight-outline-offset'
  | '--lr-spreadsheet-viewer-max-height',
  {
    'active-highlight-id'?: LyraSpreadsheetViewer['activeHighlightId'];
    'max-height'?: LyraSpreadsheetViewer['maxHeight'];
  }
>;

export type LyraStackTraceSvelteProps = LyraSvelteElementProps<
  LyraStackTrace,
  | 'collapseInternal'
  | 'compact'
  | 'copyable'
  | 'frame'
  | 'internalPatterns'
  | 'locale'
  | 'maxHeight'
  | 'strings'
  | 'trace',
  LyraStackTraceEventMap,
  | 'lr-copy'
  | 'lr-frame-select',
  | '--lr-stack-trace-compact-gap'
  | '--lr-stack-trace-compact-padding'
  | '--lr-stack-trace-font'
  | '--lr-stack-trace-interactive-color'
  | '--lr-stack-trace-internal-frame-color'
  | '--lr-stack-trace-max-height',
  {
    'collapse-internal'?: LyraStackTrace['collapseInternal'];
    'max-height'?: LyraStackTrace['maxHeight'];
  }
>;

export type LyraStatSvelteProps = LyraSvelteElementProps<
  LyraStat,
  | 'accessibleLabel'
  | 'caption'
  | 'compact'
  | 'emphasis'
  | 'exactValue'
  | 'frame'
  | 'goodDirection'
  | 'href'
  | 'label'
  | 'locale'
  | 'orientation'
  | 'prose'
  | 'rows'
  | 'strings'
  | 'sub'
  | 'target'
  | 'trend'
  | 'unit'
  | 'value'
  | 'variant',
  {},
never,
  | '--lr-stat-emphasis-border-color'
  | '--lr-stat-emphasis-value-color'
  | '--lr-stat-trend-bad-bg'
  | '--lr-stat-trend-bad-color'
  | '--lr-stat-trend-good-bg'
  | '--lr-stat-trend-good-color'
  | '--lr-stat-value-brand-color'
  | '--lr-stat-value-danger-color'
  | '--lr-stat-value-success-color'
  | '--lr-stat-value-warning-color',
  {
    'aria-label'?: LyraStat['accessibleLabel'];
    'exact-value'?: LyraStat['exactValue'];
    'good-direction'?: LyraStat['goodDirection'];
  }
>;

export type LyraStepperSvelteProps = LyraSvelteElementProps<
  LyraStepper,
  | 'accessibleLabel'
  | 'locale'
  | 'narrowOrientation'
  | 'orientation'
  | 'orientationBreakpoint'
  | 'orientationBreakpointBasis'
  | 'steps'
  | 'strings'
  | 'wrapLabels',
  LyraStepperEventMap,
  | 'lr-step-select'
  | 'lr-stepper-orientation-change',
  | '--lr-stepper-active-bg'
  | '--lr-stepper-active-color'
  | '--lr-stepper-current-color'
  | '--lr-stepper-current-font-weight'
  | '--lr-stepper-current-index-bg'
  | '--lr-stepper-current-index-color'
  | '--lr-stepper-error-color'
  | '--lr-stepper-hover-bg'
  | '--lr-stepper-hover-color',
  {
    'aria-label'?: LyraStepper['accessibleLabel'];
    'narrow-orientation'?: LyraStepper['narrowOrientation'];
    'orientation-breakpoint'?: LyraStepper['orientationBreakpoint'];
    'orientation-breakpoint-basis'?: LyraStepper['orientationBreakpointBasis'];
    'wrap-labels'?: LyraStepper['wrapLabels'];
  }
>;

export type LyraStreamStatusSvelteProps = LyraSvelteElementProps<
  LyraStreamStatus,
  | 'locale'
  | 'phase'
  | 'stallThresholdMs'
  | 'strings',
  LyraStreamStatusEventMap,
  | 'lr-recover'
  | 'lr-stall',
  | '--lr-stream-status-dot-color'
  | '--lr-stream-status-dot-opacity'
  | '--lr-stream-status-message-color'
  | '--lr-stream-status-stalled-bg'
  | '--lr-stream-status-stalled-border-color',
  {
    'stall-threshold-ms'?: LyraStreamStatus['stallThresholdMs'];
  }
>;

export type LyraStreamingTextSvelteProps = LyraSvelteElementProps<
  LyraStreamingText,
  | 'coalesceMs'
  | 'content'
  | 'locale'
  | 'markdown'
  | 'streaming'
  | 'strings',
  {},
never,
  | '--lr-streaming-text-cursor-height'
  | '--lr-streaming-text-cursor-width',
  {
    'coalesce-ms'?: LyraStreamingText['coalesceMs'];
  }
>;

export type LyraSubagentPanelSvelteProps = LyraSvelteElementProps<
  LyraSubagentPanel,
  | 'label'
  | 'locale'
  | 'runs'
  | 'selectedRunId'
  | 'strings',
  LyraSubagentPanelEventMap,
  | 'lr-cancel'
  | 'lr-retry'
  | 'lr-run-select',
  | '--lr-subagent-panel-progress-fill'
  | '--lr-subagent-panel-progress-track'
  | '--lr-subagent-panel-selected-border',
  {
    'selected-run-id'?: LyraSubagentPanel['selectedRunId'];
  }
>;

export type LyraSuggestionChipsSvelteProps = LyraSvelteElementProps<
  LyraSuggestionChips,
  | 'label'
  | 'locale'
  | 'strings'
  | 'suggestions'
  | 'wrap',
  LyraSuggestionChipsEventMap,
  | 'lr-suggestion-select',
  | '--lr-suggestion-chips-hover-bg'
  | '--lr-suggestion-chips-hover-border'
  | '--lr-suggestion-chips-justify',
  {}
>;

export type LyraSvgViewerSvelteProps = LyraSvelteElementProps<
  LyraSvgViewer,
  | 'activeHighlightId'
  | 'anchor'
  | 'highlights'
  | 'locale'
  | 'maxHeight'
  | 'name'
  | 'src'
  | 'strings'
  | 'zoomable',
  LyraSvgViewerEventMap,
  | 'lr-anchor-result'
  | 'lr-highlight-activate'
  | 'lr-render-error',
  | '--lr-svg-viewer-active-border'
  | '--lr-svg-viewer-highlight-accent-color'
  | '--lr-svg-viewer-highlight-danger-color'
  | '--lr-svg-viewer-highlight-neutral-color'
  | '--lr-svg-viewer-highlight-success-color'
  | '--lr-svg-viewer-highlight-warning-color'
  | '--lr-svg-viewer-max-height',
  {
    'active-highlight-id'?: LyraSvgViewer['activeHighlightId'];
    'max-height'?: LyraSvgViewer['maxHeight'];
  }
>;

export type LyraSwatchPickerSvelteProps = LyraSvelteElementProps<
  LyraSwatchPicker,
  | 'disabled'
  | 'label'
  | 'locale'
  | 'mode'
  | 'options'
  | 'size'
  | 'strings'
  | 'value',
  LyraSwatchPickerEventMap,
  | 'lr-change',
  | '--lr-swatch-picker-fill-size'
  | '--lr-swatch-picker-gap'
  | '--lr-swatch-picker-gemstone-selected-blur'
  | '--lr-swatch-picker-gemstone-shine-duration'
  | '--lr-swatch-picker-hit-size'
  | '--lr-swatch-picker-selected-blur'
  | '--lr-swatch-picker-selected-color'
  | '--lr-swatch-picker-shine-duration',
  {}
>;

export type LyraSwitchSvelteProps = LyraSvelteElementProps<
  LyraSwitch,
  | 'checked'
  | 'customError'
  | 'defaultChecked'
  | 'disabled'
  | 'errorText'
  | 'form'
  | 'helpText'
  | 'hint'
  | 'locale'
  | 'name'
  | 'required'
  | 'size'
  | 'strings'
  | 'value'
  | 'withHint',
  LyraSwitchEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-blur'
  | 'lr-change'
  | 'lr-focus'
  | 'lr-input'
  | 'lr-invalid',
  | '--height'
  | '--lr-switch-checked-track-fill'
  | '--lr-switch-gap'
  | '--lr-switch-thumb-fill'
  | '--lr-switch-thumb-offset'
  | '--lr-switch-track-active-fill'
  | '--lr-switch-track-block-size'
  | '--lr-switch-track-fill'
  | '--lr-switch-track-hover-fill'
  | '--lr-switch-track-inline-size'
  | '--thumb-size'
  | '--width',
  {
    'checked'?: LyraSwitch['defaultChecked'];
    'custom-error'?: LyraSwitch['customError'];
    'default-checked'?: LyraUnknownAttributeValue;
    'error-text'?: LyraSwitch['errorText'];
    'help-text'?: LyraSwitch['helpText'];
    'with-hint'?: LyraSwitch['withHint'];
  }
>;

export type LyraTabSvelteProps = LyraSvelteElementProps<
  LyraTab,
  | 'active'
  | 'closable'
  | 'disabled'
  | 'locale'
  | 'panel'
  | 'strings',
  LyraTabEventMap,
  | 'lr-close',
never,
  {}
>;

export type LyraTabGroupSvelteProps = LyraSvelteElementProps<
  LyraTabGroup,
  | 'accessibleLabel'
  | 'activation'
  | 'active'
  | 'defaultSlot'
  | 'fixedScrollControls'
  | 'locale'
  | 'noScrollControls'
  | 'placement'
  | 'strings'
  | 'withoutScrollControls',
  LyraTabGroupEventMap,
  | 'lr-tab-hide'
  | 'lr-tab-show',
  | '--indicator-color'
  | '--lr-scroll-fade-size'
  | '--lr-tab-group-active-bg'
  | '--lr-tab-group-active-color'
  | '--lr-tab-group-hover-color'
  | '--lr-tab-group-indicator-color'
  | '--lr-tab-group-scroll-button-active-bg'
  | '--lr-tab-group-scroll-button-active-color'
  | '--lr-tab-group-scroll-button-hover-color'
  | '--lr-tab-group-selected-color'
  | '--lr-tab-group-vertical-nav-max-inline-size'
  | '--track-color'
  | '--track-width',
  {
    'aria-label'?: LyraTabGroup['accessibleLabel'];
    'fixed-scroll-controls'?: LyraTabGroup['fixedScrollControls'];
    'no-scroll-controls'?: LyraTabGroup['noScrollControls'];
    'without-scroll-controls'?: LyraTabGroup['withoutScrollControls'];
  }
>;

export type LyraTabPanelSvelteProps = LyraSvelteElementProps<
  LyraTabPanel,
  | 'active'
  | 'locale'
  | 'name'
  | 'strings',
  {},
never,
  | '--padding',
  {}
>;

export type LyraTableSvelteProps = LyraSvelteElementProps<
  LyraTable,
  | 'accessibleLabel'
  | 'autocapitalize'
  | 'autoCorrect'
  | 'canExpand'
  | 'caption'
  | 'columns'
  | 'columnsHidden'
  | 'defaultSortDir'
  | 'emptyCompact'
  | 'emptyDescription'
  | 'emptyHeading'
  | 'expandedContent'
  | 'expandedKeys'
  | 'filter'
  | 'filterable'
  | 'filterLabel'
  | 'filterPlaceholder'
  | 'filterText'
  | 'grandTotal'
  | 'groupBy'
  | 'groupLabel'
  | 'hasMore'
  | 'heatTintScale'
  | 'hideColumnsLabel'
  | 'layout'
  | 'loading'
  | 'loadingAppearance'
  | 'loadingLabel'
  | 'locale'
  | 'moreLabel'
  | 'noColumnsDescription'
  | 'noColumnsHeading'
  | 'page'
  | 'pageSize'
  | 'paginationMode'
  | 'revealColumnsLabel'
  | 'rowKey'
  | 'rows'
  | 'rowTotal'
  | 'selectedKey'
  | 'selectedKeys'
  | 'selectionMode'
  | 'showAllColumns'
  | 'skeletonRows'
  | 'sortDir'
  | 'sortKey'
  | 'sortMode'
  | 'spellcheck'
  | 'storageKey'
  | 'strings'
  | 'totalItems',
  LyraTableEventMap,
  | 'blur'
  | 'focus'
  | 'lr-cell-edit'
  | 'lr-column-resize'
  | 'lr-columns-hidden-change'
  | 'lr-columns-revealed'
  | 'lr-filter-change'
  | 'lr-load-more'
  | 'lr-page-change'
  | 'lr-row-click'
  | 'lr-row-expand-toggle'
  | 'lr-selection-change'
  | 'lr-sort',
  | '--lr-table-header-sorted-bg'
  | '--lr-table-header-sorted-color'
  | '--lr-table-heat-t'
  | '--lr-table-heat-tint-hi'
  | '--lr-table-heat-tint-lo'
  | '--lr-table-max-height'
  | '--lr-table-resize-handle-opacity'
  | '--lr-table-resize-min-width'
  | '--lr-table-row-selected-bg'
  | '--lr-table-row-stripe-bg'
  | '--lr-table-sticky-offset',
  {
    'accessible-label'?: LyraTable['accessibleLabel'];
    'autocorrect'?: LyraTable['autoCorrect'];
    'columns-hidden'?: LyraTable['columnsHidden'];
    'default-sort-dir'?: LyraTable['defaultSortDir'];
    'empty-compact'?: LyraTable['emptyCompact'];
    'empty-description'?: LyraTable['emptyDescription'];
    'empty-heading'?: LyraTable['emptyHeading'];
    'filter-label'?: LyraTable['filterLabel'];
    'filter-placeholder'?: LyraTable['filterPlaceholder'];
    'filter-text'?: LyraTable['filterText'];
    'has-more'?: LyraTable['hasMore'];
    'hide-columns-label'?: LyraTable['hideColumnsLabel'];
    'loading-appearance'?: LyraTable['loadingAppearance'];
    'loading-label'?: LyraTable['loadingLabel'];
    'more-label'?: LyraTable['moreLabel'];
    'no-columns-description'?: LyraTable['noColumnsDescription'];
    'no-columns-heading'?: LyraTable['noColumnsHeading'];
    'page-size'?: LyraTable['pageSize'];
    'pagination-mode'?: LyraTable['paginationMode'];
    'reveal-columns-label'?: LyraTable['revealColumnsLabel'];
    'selection-mode'?: LyraTable['selectionMode'];
    'show-all-columns'?: LyraTable['showAllColumns'];
    'skeleton-rows'?: LyraTable['skeletonRows'];
    'sort-dir'?: LyraTable['sortDir'];
    'sort-key'?: LyraTable['sortKey'];
    'sort-mode'?: LyraTable['sortMode'];
    'storage-key'?: LyraTable['storageKey'];
    'total-items'?: LyraTable['totalItems'];
  }
>;

export type LyraTagSvelteProps = LyraSvelteElementProps<
  LyraTag,
  | 'appearance'
  | 'attention'
  | 'locale'
  | 'pill'
  | 'pulse'
  | 'removable'
  | 'size'
  | 'strings'
  | 'variant'
  | 'withRemove',
  LyraTagEventMap,
  | 'lr-remove',
  | '--lr-badge-attention-duration'
  | '--lr-badge-attention-easing'
  | '--lr-badge-background'
  | '--lr-badge-border'
  | '--lr-badge-bounce-distance'
  | '--lr-badge-color'
  | '--lr-badge-edge'
  | '--lr-badge-fill'
  | '--lr-badge-font-size'
  | '--lr-badge-gap'
  | '--lr-badge-ink'
  | '--lr-badge-min-height'
  | '--lr-badge-on-solid'
  | '--lr-badge-padding-inline'
  | '--lr-badge-pulse-color'
  | '--lr-badge-pulse-spread'
  | '--lr-badge-radius'
  | '--lr-badge-solid'
  | '--lr-badge-stroke'
  | '--lr-badge-text'
  | '--lr-badge-tint'
  | '--lr-tag-remove-hover-background'
  | '--lr-tag-remove-radius'
  | '--pulse-color',
  {
    'with-remove'?: LyraTag['withRemove'];
  }
>;

export type LyraTaskListSvelteProps = LyraSvelteElementProps<
  LyraTaskList,
  | 'collapsible'
  | 'compact'
  | 'expanded'
  | 'frame'
  | 'headingLevel'
  | 'items'
  | 'label'
  | 'locale'
  | 'reorderable'
  | 'strings',
  LyraTaskListEventMap,
  | 'lr-reorder'
  | 'lr-toggle',
  | '--lr-task-list-compact-body-padding'
  | '--lr-task-list-compact-gap'
  | '--lr-task-list-compact-header-font-size'
  | '--lr-task-list-compact-header-gap'
  | '--lr-task-list-compact-header-padding'
  | '--lr-task-list-error-color'
  | '--lr-task-list-pending-color'
  | '--lr-task-list-running-color'
  | '--lr-task-list-spin'
  | '--lr-task-list-success-color',
  {
    'heading-level'?: LyraTaskList['headingLevel'];
  }
>;

export type LyraTerminalSvelteProps = LyraSvelteElementProps<
  LyraTerminal,
  | 'accessibleLabel'
  | 'activeHighlightId'
  | 'announceOutput'
  | 'compact'
  | 'content'
  | 'copyable'
  | 'downloadable'
  | 'filename'
  | 'follow'
  | 'frame'
  | 'highlights'
  | 'locale'
  | 'maxScrollback'
  | 'strings'
  | 'wrap',
  LyraTerminalEventMap,
  | 'lr-copy'
  | 'lr-download'
  | 'lr-follow-change'
  | 'lr-highlight-activate'
  | 'lr-search-change'
  | 'lr-text-select',
  | '--lr-terminal-compact-line-padding-inline'
  | '--lr-terminal-compact-toolbar-gap'
  | '--lr-terminal-compact-toolbar-padding'
  | '--lr-terminal-height'
  | '--lr-terminal-highlight-accent-bg'
  | '--lr-terminal-highlight-danger-bg'
  | '--lr-terminal-highlight-neutral-bg'
  | '--lr-terminal-highlight-success-bg'
  | '--lr-terminal-highlight-warning-bg'
  | '--lr-terminal-search-active-outline-color'
  | '--lr-terminal-search-outline-color',
  {
    'announce-output'?: LyraTerminal['announceOutput'];
    'aria-label'?: LyraTerminal['accessibleLabel'];
    'max-scrollback'?: LyraTerminal['maxScrollback'];
  }
>;

export type LyraTestResultsSvelteProps = LyraSvelteElementProps<
  LyraTestResults,
  | 'autoExpandFailures'
  | 'locale'
  | 'statusFilter'
  | 'strings'
  | 'suites',
  LyraTestResultsEventMap,
  | 'lr-filter-change'
  | 'lr-test-select'
  | 'lr-toggle',
  | '--lr-test-results-failed-color'
  | '--lr-test-results-filter-active-bg'
  | '--lr-test-results-filter-active-border'
  | '--lr-test-results-filter-active-color'
  | '--lr-test-results-passed-color'
  | '--lr-test-results-running-color'
  | '--lr-test-results-skipped-color',
  {
    'auto-expand-failures'?: LyraTestResults['autoExpandFailures'];
  }
>;

export type LyraTextareaSvelteProps = LyraSvelteElementProps<
  LyraTextarea,
  | 'accessibleLabel'
  | 'appearance'
  | 'autocapitalize'
  | 'autocomplete'
  | 'autocorrect'
  | 'autofocus'
  | 'customError'
  | 'defaultValue'
  | 'disabled'
  | 'enterkeyhint'
  | 'enterKeyHint'
  | 'errorText'
  | 'filled'
  | 'form'
  | 'helpText'
  | 'hint'
  | 'inputmode'
  | 'inputMode'
  | 'label'
  | 'locale'
  | 'maxlength'
  | 'minlength'
  | 'name'
  | 'pill'
  | 'placeholder'
  | 'readonly'
  | 'required'
  | 'resize'
  | 'rows'
  | 'selectionDirection'
  | 'selectionEnd'
  | 'selectionStart'
  | 'size'
  | 'spellcheck'
  | 'strings'
  | 'title'
  | 'value'
  | 'withCount'
  | 'withHint'
  | 'withLabel'
  | 'wrap',
  LyraTextareaEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-blur'
  | 'lr-change'
  | 'lr-focus'
  | 'lr-input'
  | 'lr-invalid',
  | '--lr-form-control-required-color'
  | '--lr-form-control-required-content'
  | '--lr-form-control-required-offset'
  | '--lr-textarea-border-color'
  | '--lr-textarea-fill'
  | '--lr-textarea-font-size'
  | '--lr-textarea-hover-border-color'
  | '--lr-textarea-max-block-size'
  | '--lr-textarea-padding'
  | '--lr-textarea-radius',
  {
    'aria-label'?: LyraTextarea['accessibleLabel'];
    'custom-error'?: LyraTextarea['customError'];
    'default-value'?: LyraTextarea['defaultValue'];
    'enterkeyhint'?: LyraTextarea['enterKeyHint'];
    'error-text'?: LyraTextarea['errorText'];
    'help-text'?: LyraTextarea['helpText'];
    'inputmode'?: LyraTextarea['inputMode'];
    'value'?: LyraTextarea['defaultValue'];
    'with-count'?: LyraTextarea['withCount'];
    'with-hint'?: LyraTextarea['withHint'];
    'with-label'?: LyraTextarea['withLabel'];
  }
>;

export type LyraThinkingPanelSvelteProps = LyraSvelteElementProps<
  LyraThinkingPanel,
  | 'compact'
  | 'durationMs'
  | 'expanded'
  | 'frame'
  | 'label'
  | 'locale'
  | 'mode'
  | 'strings',
  LyraThinkingPanelEventMap,
  | 'lr-toggle',
  | '--lr-thinking-panel-compact-body-padding'
  | '--lr-thinking-panel-compact-header-gap'
  | '--lr-thinking-panel-compact-header-padding'
  | '--lr-thinking-panel-max-block-size'
  | '--lr-thinking-panel-pending-color',
  {
    'duration-ms'?: LyraThinkingPanel['durationMs'];
  }
>;

export type LyraThreadListSvelteProps = LyraSvelteElementProps<
  LyraThreadList,
  | 'activeId'
  | 'collapsedGroupIds'
  | 'compact'
  | 'editable'
  | 'filter'
  | 'formatDate'
  | 'formatGroup'
  | 'formatGroupLabel'
  | 'groupBy'
  | 'grouping'
  | 'groupOrder'
  | 'label'
  | 'locale'
  | 'renderActions'
  | 'renderExcerpt'
  | 'renderLeading'
  | 'renderMeta'
  | 'renderRowContent'
  | 'rowActions'
  | 'searchable'
  | 'showArchived'
  | 'stickyGroups'
  | 'strings'
  | 'threads'
  | 'wrapRow',
  LyraThreadListEventMap,
  | 'blur'
  | 'focus'
  | 'lr-filter-change'
  | 'lr-group-toggle'
  | 'lr-select'
  | 'lr-thread-archive'
  | 'lr-thread-delete'
  | 'lr-thread-pin'
  | 'lr-thread-rename',
  | '--lr-thread-list-excerpt-highlight-background'
  | '--lr-thread-list-excerpt-highlight-foreground'
  | '--lr-thread-list-excerpt-highlight-padding'
  | '--lr-thread-list-excerpt-highlight-radius',
  {
    'active-id'?: LyraThreadList['activeId'];
    'show-archived'?: LyraThreadList['showArchived'];
    'sticky-groups'?: LyraThreadList['stickyGroups'];
  }
>;

export type LyraTimeInputSvelteProps = LyraSvelteElementProps<
  LyraTimeInput,
  | 'appearance'
  | 'autocomplete'
  | 'customError'
  | 'defaultValue'
  | 'disabled'
  | 'distance'
  | 'errorText'
  | 'form'
  | 'hint'
  | 'hourFormat'
  | 'label'
  | 'locale'
  | 'max'
  | 'min'
  | 'name'
  | 'open'
  | 'pill'
  | 'placement'
  | 'readonly'
  | 'required'
  | 'size'
  | 'step'
  | 'strings'
  | 'value'
  | 'withClear'
  | 'withHint'
  | 'withLabel'
  | 'withNow',
  LyraTimeInputEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-after-hide'
  | 'lr-after-show'
  | 'lr-blur'
  | 'lr-change'
  | 'lr-clear'
  | 'lr-focus'
  | 'lr-hide'
  | 'lr-input'
  | 'lr-invalid'
  | 'lr-show',
  | '--column-item-height'
  | '--column-width'
  | '--hide-duration'
  | '--lr-form-control-required-color'
  | '--lr-form-control-required-content'
  | '--lr-form-control-required-offset'
  | '--lr-time-input-action-active-bg'
  | '--lr-time-input-action-color'
  | '--lr-time-input-action-hover-bg'
  | '--lr-time-input-action-hover-color'
  | '--lr-time-input-border-color'
  | '--lr-time-input-color'
  | '--lr-time-input-column-active-bg'
  | '--lr-time-input-column-hover-bg'
  | '--lr-time-input-column-selected-active-bg'
  | '--lr-time-input-column-selected-bg'
  | '--lr-time-input-column-selected-color'
  | '--lr-time-input-column-selected-font-weight'
  | '--lr-time-input-column-selected-hover-bg'
  | '--lr-time-input-fill'
  | '--lr-time-input-focus-border-color'
  | '--lr-time-input-gap'
  | '--lr-time-input-radius'
  | '--lr-time-input-segment-active-bg'
  | '--lr-time-input-segment-focus-bg'
  | '--lr-time-input-segment-hover-bg'
  | '--show-duration',
  {
    'custom-error'?: LyraTimeInput['customError'];
    'error-text'?: LyraTimeInput['errorText'];
    'hour-format'?: LyraTimeInput['hourFormat'];
    'value'?: LyraTimeInput['defaultValue'];
    'with-clear'?: LyraTimeInput['withClear'];
    'with-hint'?: LyraTimeInput['withHint'];
    'with-label'?: LyraTimeInput['withLabel'];
    'with-now'?: LyraTimeInput['withNow'];
  }
>;

export type LyraTimeRangeSvelteProps = LyraSvelteElementProps<
  LyraTimeRange,
  | 'disabled'
  | 'end'
  | 'endLabel'
  | 'form'
  | 'locale'
  | 'max'
  | 'min'
  | 'presets'
  | 'size'
  | 'start'
  | 'startLabel'
  | 'step'
  | 'strings'
  | 'valueFormatter',
  LyraTimeRangeEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-blur'
  | 'lr-change'
  | 'lr-focus'
  | 'lr-input',
  | '--lr-time-range-base-size'
  | '--lr-time-range-handle-bg'
  | '--lr-time-range-handle-border-color'
  | '--lr-time-range-handle-hover-bg'
  | '--lr-time-range-handle-pressed-bg'
  | '--lr-time-range-handle-size'
  | '--lr-time-range-hit-size'
  | '--lr-time-range-preset-active-bg'
  | '--lr-time-range-preset-active-border-color'
  | '--lr-time-range-preset-active-color'
  | '--lr-time-range-preset-font-size'
  | '--lr-time-range-preset-gap'
  | '--lr-time-range-preset-hover-border-color'
  | '--lr-time-range-preset-padding'
  | '--lr-time-range-preset-pressed-bg'
  | '--lr-time-range-preset-pressed-border-color'
  | '--lr-time-range-preset-radius'
  | '--lr-time-range-size-scale'
  | '--lr-time-range-track-size',
  {
    'end-label'?: LyraTimeRange['endLabel'];
    'start-label'?: LyraTimeRange['startLabel'];
  }
>;

export type LyraTimelineSvelteProps = LyraSvelteElementProps<
  LyraTimeline,
  | 'accessibleLabel'
  | 'locale'
  | 'orientation'
  | 'strings',
  {},
never,
  | '--lr-timeline-gap',
  {
    'aria-label'?: LyraTimeline['accessibleLabel'];
  }
>;

export type LyraTimelineItemSvelteProps = LyraSvelteElementProps<
  LyraTimelineItem,
  | 'active'
  | 'locale'
  | 'strings'
  | 'sync'
  | 'timestamp'
  | 'variant',
  {},
never,
  | '--lr-timeline-item-direction'
  | '--lr-timeline-item-gap-block-end'
  | '--lr-timeline-item-gap-inline-end'
  | '--lr-timeline-item-rail-visibility'
  | '--lr-timeline-item-track-direction'
  | '--lr-timeline-marker-color'
  | '--lr-timeline-marker-size'
  | '--lr-timeline-rail-color'
  | '--lr-timeline-rail-width',
  {}
>;

export type LyraToastSvelteProps = LyraSvelteElementProps<
  LyraToast,
  | 'locale'
  | 'placement'
  | 'strings',
  LyraToastEventMap,
  | 'lr-toast-overflow',
  | '--gap'
  | '--lr-toast-accent-color'
  | '--lr-toast-accent-width'
  | '--lr-toast-font-size'
  | '--lr-toast-gap'
  | '--lr-toast-hide-duration'
  | '--lr-toast-padding'
  | '--lr-toast-show-duration'
  | '--lr-toast-width'
  | '--width',
  {}
>;

export type LyraToastItemSvelteProps = LyraSvelteElementProps<
  LyraToastItem,
  | 'duration'
  | 'locale'
  | 'size'
  | 'strings'
  | 'variant'
  | 'withIcon',
  LyraToastItemEventMap,
  | 'lr-after-hide'
  | 'lr-after-show'
  | 'lr-hide'
  | 'lr-show',
  | '--accent-width'
  | '--hide-duration'
  | '--lr-toast-accent-color'
  | '--lr-toast-accent-width'
  | '--lr-toast-close-button-active-bg'
  | '--lr-toast-close-button-active-color'
  | '--lr-toast-close-button-hover-bg'
  | '--lr-toast-close-button-hover-color'
  | '--lr-toast-font-size'
  | '--lr-toast-hide-duration'
  | '--lr-toast-item-gap'
  | '--lr-toast-item-radius'
  | '--lr-toast-padding'
  | '--lr-toast-show-duration'
  | '--padding'
  | '--show-duration',
  {
    'with-icon'?: LyraToastItem['withIcon'];
  }
>;

export type LyraTokenInputSvelteProps = LyraSvelteElementProps<
  LyraTokenInput,
  | 'accessibleLabel'
  | 'allowDuplicates'
  | 'autocapitalize'
  | 'autoCorrect'
  | 'customError'
  | 'defaultValue'
  | 'delimiter'
  | 'disabled'
  | 'editable'
  | 'errorText'
  | 'form'
  | 'hint'
  | 'label'
  | 'locale'
  | 'name'
  | 'pill'
  | 'placeholder'
  | 'required'
  | 'selectionDirection'
  | 'selectionEnd'
  | 'selectionStart'
  | 'size'
  | 'spellcheck'
  | 'strings'
  | 'value',
  LyraTokenInputEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-add'
  | 'lr-blur'
  | 'lr-change'
  | 'lr-focus'
  | 'lr-input'
  | 'lr-invalid'
  | 'lr-remove'
  | 'lr-token-edit',
  | '--lr-form-control-required-color'
  | '--lr-form-control-required-content'
  | '--lr-form-control-required-offset'
  | '--lr-token-input-action-hover-bg'
  | '--lr-token-input-control-height'
  | '--lr-token-input-control-min-height'
  | '--lr-token-input-edit-hover-bg'
  | '--lr-token-input-edit-pressed-bg'
  | '--lr-token-input-editor-inline-size'
  | '--lr-token-input-focus-border-color'
  | '--lr-token-input-font-size'
  | '--lr-token-input-gap'
  | '--lr-token-input-input-inline-size'
  | '--lr-token-input-invalid-border-color'
  | '--lr-token-input-min-input-inline-size'
  | '--lr-token-input-padding'
  | '--lr-token-input-radius'
  | '--lr-token-input-remove-hover-bg'
  | '--lr-token-input-remove-pressed-bg'
  | '--lr-token-input-token-bg'
  | '--lr-token-input-token-gap'
  | '--lr-token-input-token-padding',
  {
    'allow-duplicates'?: LyraTokenInput['allowDuplicates'];
    'aria-label'?: LyraTokenInput['accessibleLabel'];
    'autocorrect'?: LyraTokenInput['autoCorrect'];
    'custom-error'?: LyraTokenInput['customError'];
    'error-text'?: LyraTokenInput['errorText'];
    'value'?: LyraTokenInput['defaultValue'];
  }
>;

export type LyraToolApprovalDialogSvelteProps = LyraSvelteElementProps<
  LyraToolApprovalDialog,
  | 'accessibleLabel'
  | 'args'
  | 'autocapitalize'
  | 'autocomplete'
  | 'autoCorrect'
  | 'editable'
  | 'enterKeyHint'
  | 'inputMode'
  | 'locale'
  | 'open'
  | 'pending'
  | 'spellcheck'
  | 'strings'
  | 'toolName'
  | 'wrap',
  LyraToolApprovalDialogEventMap,
  | 'blur'
  | 'focus'
  | 'lr-approve'
  | 'lr-close'
  | 'lr-deny',
  | '--lr-tool-approval-dialog-hover-border-color'
  | '--lr-tool-approval-dialog-invalid-border-color'
  | '--lr-tool-approval-dialog-mono-font'
  | '--lr-tool-approval-dialog-overlay-color',
  {
    'aria-label'?: LyraToolApprovalDialog['accessibleLabel'];
    'autocorrect'?: LyraToolApprovalDialog['autoCorrect'];
    'enterkeyhint'?: LyraToolApprovalDialog['enterKeyHint'];
    'inputmode'?: LyraToolApprovalDialog['inputMode'];
    'tool-name'?: LyraToolApprovalDialog['toolName'];
  }
>;

export type LyraToolCallChipSvelteProps = LyraSvelteElementProps<
  LyraToolCallChip,
  | 'callId'
  | 'category'
  | 'durationMs'
  | 'icon'
  | 'locale'
  | 'name'
  | 'status'
  | 'strings'
  | 'summary',
  LyraToolCallChipEventMap,
  | 'lr-tool-call-chip-select',
  | '--lr-tool-call-chip-accent'
  | '--lr-tool-call-chip-bg'
  | '--lr-tool-call-chip-border'
  | '--lr-tool-call-chip-spin'
  | '--lr-transition-ambient',
  {
    'call-id'?: LyraToolCallChip['callId'];
    'duration-ms'?: LyraToolCallChip['durationMs'];
  }
>;

export type LyraToolParamFormSvelteProps = LyraSvelteElementProps<
  LyraToolParamForm,
  | 'customError'
  | 'disabled'
  | 'form'
  | 'locale'
  | 'name'
  | 'schema'
  | 'strings'
  | 'value',
  LyraToolParamFormEventMap,
  | 'blur'
  | 'focus'
  | 'lr-input'
  | 'lr-invalid'
  | 'lr-validity-change',
  | '--lr-form-control-required-color'
  | '--lr-form-control-required-content'
  | '--lr-form-control-required-offset'
  | '--lr-tool-param-form-invalid-border-color',
  {
    'custom-error'?: LyraToolParamForm['customError'];
  }
>;

export type LyraToolResultDialogSvelteProps = LyraSvelteElementProps<
  LyraToolResultDialog,
  | 'accessibleLabel'
  | 'durationMs'
  | 'locale'
  | 'maximized'
  | 'open'
  | 'status'
  | 'strings'
  | 'toolName',
  LyraToolResultDialogEventMap,
  | 'lr-close'
  | 'lr-maximize-change',
  | '--lr-tool-result-dialog-denied-bg'
  | '--lr-tool-result-dialog-denied-color'
  | '--lr-tool-result-dialog-error-bg'
  | '--lr-tool-result-dialog-error-color'
  | '--lr-tool-result-dialog-maximized-inset'
  | '--lr-tool-result-dialog-overlay-color'
  | '--lr-tool-result-dialog-pending-bg'
  | '--lr-tool-result-dialog-pending-color'
  | '--lr-tool-result-dialog-running-bg'
  | '--lr-tool-result-dialog-running-color'
  | '--lr-tool-result-dialog-spin'
  | '--lr-tool-result-dialog-success-bg'
  | '--lr-tool-result-dialog-success-color',
  {
    'aria-label'?: LyraToolResultDialog['accessibleLabel'];
    'duration-ms'?: LyraToolResultDialog['durationMs'];
    'tool-name'?: LyraToolResultDialog['toolName'];
  }
>;

export type LyraToolResultViewSvelteProps = LyraSvelteElementProps<
  LyraToolResultView,
  | 'args'
  | 'copyable'
  | 'fallback'
  | 'locale'
  | 'registry'
  | 'result'
  | 'status'
  | 'strings'
  | 'toolName',
  LyraToolResultViewEventMap,
  | 'lr-render-error',
  | '--lr-tool-result-view-font',
  {
    'tool-name'?: LyraToolResultView['toolName'];
  }
>;

export type LyraToolSelectDialogSvelteProps = LyraSvelteElementProps<
  LyraToolSelectDialog,
  | 'accessibleLabel'
  | 'autocapitalize'
  | 'autocomplete'
  | 'autoCorrect'
  | 'enterKeyHint'
  | 'filter'
  | 'inputMode'
  | 'label'
  | 'locale'
  | 'open'
  | 'searchPlaceholder'
  | 'selected'
  | 'spellcheck'
  | 'strings'
  | 'tools'
  | 'useDefaults',
  LyraToolSelectDialogEventMap,
  | 'blur'
  | 'focus'
  | 'lr-change'
  | 'lr-close',
  | '--lr-tool-select-dialog-overlay-color',
  {
    'aria-label'?: LyraToolSelectDialog['accessibleLabel'];
    'autocorrect'?: LyraToolSelectDialog['autoCorrect'];
    'enterkeyhint'?: LyraToolSelectDialog['enterKeyHint'];
    'inputmode'?: LyraToolSelectDialog['inputMode'];
    'search-placeholder'?: LyraToolSelectDialog['searchPlaceholder'];
    'use-defaults'?: LyraToolSelectDialog['useDefaults'];
  }
>;

export type LyraToolTimelineSvelteProps = LyraSvelteElementProps<
  LyraToolTimeline,
  | 'approvalEditable'
  | 'entries'
  | 'formatTimestamp'
  | 'locale'
  | 'strings',
  LyraToolTimelineEventMap,
  | 'lr-tool-approval-decide',
  | '--lr-tool-timeline-approved-bg'
  | '--lr-tool-timeline-approved-color'
  | '--lr-tool-timeline-denied-bg'
  | '--lr-tool-timeline-denied-color'
  | '--lr-tool-timeline-denied-marker-color'
  | '--lr-tool-timeline-error-color'
  | '--lr-tool-timeline-error-marker-color'
  | '--lr-tool-timeline-gap'
  | '--lr-tool-timeline-marker-size'
  | '--lr-tool-timeline-pending-approval-border-color'
  | '--lr-tool-timeline-pending-marker-color'
  | '--lr-tool-timeline-running-marker-color'
  | '--lr-tool-timeline-success-marker-color',
  {
    'approval-editable'?: LyraToolTimeline['approvalEditable'];
  }
>;

export type LyraTooltipSvelteProps = LyraSvelteElementProps<
  LyraTooltip,
  | 'accessibleLabel'
  | 'anchor'
  | 'arrow'
  | 'arrowPadding'
  | 'arrowPlacement'
  | 'content'
  | 'disabled'
  | 'distance'
  | 'for'
  | 'hideDelay'
  | 'hoist'
  | 'locale'
  | 'manual'
  | 'open'
  | 'placement'
  | 'showDelay'
  | 'skidding'
  | 'strings'
  | 'trigger'
  | 'withoutArrow',
  LyraTooltipEventMap,
  | 'lr-after-hide'
  | 'lr-after-show'
  | 'lr-hide'
  | 'lr-show',
  | '--arrow-size'
  | '--hide-delay'
  | '--lr-tooltip-arrow-size'
  | '--lr-tooltip-background'
  | '--lr-tooltip-color'
  | '--lr-tooltip-max-inline-size'
  | '--max-width'
  | '--show-delay',
  {
    'aria-label'?: LyraTooltip['accessibleLabel'];
    'arrow-padding'?: LyraTooltip['arrowPadding'];
    'arrow-placement'?: LyraTooltip['arrowPlacement'];
    'hide-delay'?: LyraTooltip['hideDelay'];
    'show-delay'?: LyraTooltip['showDelay'];
    'without-arrow'?: LyraTooltip['withoutArrow'];
  }
>;

export type LyraTourSvelteProps = LyraSvelteElementProps<
  LyraTour,
  | 'activeIndex'
  | 'distance'
  | 'lightDismiss'
  | 'locale'
  | 'open'
  | 'placement'
  | 'showProgress'
  | 'spotlightPadding'
  | 'steps'
  | 'strings',
  LyraTourEventMap,
  | 'lr-tour-end'
  | 'lr-tour-start'
  | 'lr-tour-step-change'
  | 'lr-tour-target-missing',
  | '--lr-tour-backdrop-color'
  | '--lr-tour-popover-max-width'
  | '--lr-tour-progress-dot-current-bg'
  | '--lr-tour-spotlight-radius'
  | '--lr-tour-spotlight-ring-color'
  | '--lr-tour-spotlight-ring-width',
  {
    'active-index'?: LyraTour['activeIndex'];
    'aria-label'?: LyraUnknownAttributeValue;
    'light-dismiss'?: LyraTour['lightDismiss'];
    'show-progress'?: LyraTour['showProgress'];
    'spotlight-padding'?: LyraTour['spotlightPadding'];
  }
>;

export type LyraTraceTreeSvelteProps = LyraSvelteElementProps<
  LyraTraceTree,
  | 'activeSpanId'
  | 'hideBars'
  | 'label'
  | 'locale'
  | 'showCost'
  | 'showTokens'
  | 'spans'
  | 'strings',
  LyraTraceTreeEventMap,
  | 'lr-span-select'
  | 'lr-span-toggle',
  | '--lr-trace-tree-bar-track-bg'
  | '--lr-trace-tree-denied-color'
  | '--lr-trace-tree-error-color'
  | '--lr-trace-tree-pending-color'
  | '--lr-trace-tree-row-active-bg'
  | '--lr-trace-tree-row-active-color'
  | '--lr-trace-tree-running-color'
  | '--lr-trace-tree-running-stripe-bg'
  | '--lr-trace-tree-success-color'
  | '--lr-trace-tree-toggle-hover-bg',
  {
    'active-span-id'?: LyraTraceTree['activeSpanId'];
    'hide-bars'?: LyraTraceTree['hideBars'];
    'show-cost'?: LyraTraceTree['showCost'];
    'show-tokens'?: LyraTraceTree['showTokens'];
  }
>;

export type LyraTranscriptFeedSvelteProps = LyraSvelteElementProps<
  LyraTranscriptFeed,
  | 'accessibleLabel'
  | 'entries'
  | 'follow'
  | 'formatTimestamp'
  | 'label'
  | 'locale'
  | 'maxRenderedEntries'
  | 'showTimestamps'
  | 'strings',
  LyraTranscriptFeedEventMap,
  | 'lr-follow-change',
never,
  {
    'aria-label'?: LyraTranscriptFeed['accessibleLabel'];
    'max-rendered-entries'?: LyraTranscriptFeed['maxRenderedEntries'];
    'show-timestamps'?: LyraTranscriptFeed['showTimestamps'];
  }
>;

export type LyraTreeSvelteProps = LyraSvelteElementProps<
  LyraTree,
  | 'data'
  | 'label'
  | 'locale'
  | 'reorderable'
  | 'selection'
  | 'strings',
  LyraTreeEventMap,
  | 'lr-after-collapse'
  | 'lr-after-expand'
  | 'lr-collapse'
  | 'lr-expand'
  | 'lr-lazy-change'
  | 'lr-lazy-load'
  | 'lr-node-select'
  | 'lr-node-toggle'
  | 'lr-reorder'
  | 'lr-selection-change',
  | '--indent-guide-color'
  | '--indent-guide-offset'
  | '--indent-guide-style'
  | '--indent-guide-width'
  | '--indent-size',
  {}
>;

export type LyraTreeItemSvelteProps = LyraSvelteElementProps<
  LyraTreeItem,
  | 'activeId'
  | 'ancestry'
  | 'depth'
  | 'disabled'
  | 'expanded'
  | 'item'
  | 'label'
  | 'lazy'
  | 'locale'
  | 'posInSet'
  | 'selected'
  | 'setSize'
  | 'strings',
  LyraTreeItemEventMap,
  | 'lr-after-collapse'
  | 'lr-after-expand'
  | 'lr-collapse'
  | 'lr-expand'
  | 'lr-lazy-change'
  | 'lr-lazy-load'
  | 'lr-node-select'
  | 'lr-node-toggle',
  | '--hide-duration'
  | '--lr-tree-badge-brand-bg'
  | '--lr-tree-badge-brand-color'
  | '--lr-tree-badge-danger-bg'
  | '--lr-tree-badge-danger-color'
  | '--lr-tree-badge-neutral-bg'
  | '--lr-tree-badge-neutral-color'
  | '--lr-tree-badge-success-bg'
  | '--lr-tree-badge-success-color'
  | '--lr-tree-badge-warning-bg'
  | '--lr-tree-badge-warning-color'
  | '--lr-tree-checkbox-checked-bg'
  | '--lr-tree-checkbox-checked-border-color'
  | '--lr-tree-checkbox-checked-color'
  | '--lr-tree-checkbox-indeterminate-bg'
  | '--lr-tree-checkbox-indeterminate-border-color'
  | '--lr-tree-checkbox-indeterminate-color'
  | '--lr-tree-depth'
  | '--lr-tree-selected-bg'
  | '--lr-tree-selected-color'
  | '--show-duration',
  {}
>;

export type LyraTypingIndicatorSvelteProps = LyraSvelteElementProps<
  LyraTypingIndicator,
  | 'label'
  | 'locale'
  | 'size'
  | 'strings'
  | 'variant',
  {},
never,
  | '--lr-typing-cursor-height'
  | '--lr-typing-cursor-width'
  | '--lr-typing-dot-size'
  | '--lr-typing-dot-stagger-1'
  | '--lr-typing-dot-stagger-2'
  | '--lr-typing-duration'
  | '--lr-typing-gap',
  {}
>;

export type LyraUsageBadgeSvelteProps = LyraSvelteElementProps<
  LyraUsageBadge,
  | 'abbreviate'
  | 'costText'
  | 'formatLatency'
  | 'latencyMs'
  | 'locale'
  | 'strings'
  | 'tokensIn'
  | 'tokensOut',
  {},
never,
never,
  {
    'cost-text'?: LyraUsageBadge['costText'];
    'latency-ms'?: LyraUsageBadge['latencyMs'];
    'tokens-in'?: LyraUsageBadge['tokensIn'];
    'tokens-out'?: LyraUsageBadge['tokensOut'];
  }
>;

export type LyraVideoSvelteProps = LyraSvelteElementProps<
  LyraVideo,
  | 'autoplay'
  | 'autoplayMuted'
  | 'autoplayOnVisible'
  | 'controls'
  | 'currentTime'
  | 'duration'
  | 'iconLibrary'
  | 'locale'
  | 'loop'
  | 'muted'
  | 'playing'
  | 'poster'
  | 'preload'
  | 'src'
  | 'strings'
  | 'thumbnails'
  | 'title'
  | 'volume',
  LyraVideoEventMap,
  | 'blur'
  | 'ended'
  | 'error'
  | 'focus'
  | 'loadedmetadata'
  | 'lr-blur'
  | 'lr-focus'
  | 'pause'
  | 'play'
  | 'timeupdate'
  | 'volumechange',
  | '--controls-background'
  | '--controls-color'
  | '--lr-video-poster-play-button-hover-background'
  | '--lr-video-poster-play-button-hover-border-color'
  | '--poster-play-button-background',
  {
    'autoplay-muted'?: LyraVideo['autoplayMuted'];
    'autoplay-on-visible'?: LyraVideo['autoplayOnVisible'];
    'icon-library'?: LyraVideo['iconLibrary'];
  }
>;

export type LyraVideoPlaylistSvelteProps = LyraSvelteElementProps<
  LyraVideoPlaylist,
  | 'autoAdvance'
  | 'controls'
  | 'iconLibrary'
  | 'items'
  | 'locale'
  | 'repeat'
  | 'strings',
  LyraVideoPlaylistEventMap,
  | 'blur'
  | 'focus'
  | 'lr-blur'
  | 'lr-focus'
  | 'lr-video-change',
  | '--lr-video-playlist-item-current-background'
  | '--lr-video-playlist-item-current-border-color',
  {
    'auto-advance'?: LyraVideoPlaylist['autoAdvance'];
    'icon-library'?: LyraVideoPlaylist['iconLibrary'];
  }
>;

export type LyraVirtualListSvelteProps = LyraSvelteElementProps<
  LyraVirtualList,
  | 'activeId'
  | 'groups'
  | 'hasMore'
  | 'itemRole'
  | 'items'
  | 'keyFunction'
  | 'loading'
  | 'locale'
  | 'overscan'
  | 'renderItem'
  | 'renderStickyGroup'
  | 'rowHeight'
  | 'rowIndexOffset'
  | 'strings',
  LyraVirtualListEventMap,
  | 'lr-load-more'
  | 'lr-scroll'
  | 'lr-visible-range-changed',
  | '--lr-virtual-list-height'
  | '--lr-virtual-list-hover-outline-color'
  | '--lr-virtual-list-hover-outline-offset'
  | '--lr-virtual-list-hover-outline-style'
  | '--lr-virtual-list-hover-outline-width',
  {
    'active-id'?: LyraVirtualList['activeId'];
    'has-more'?: LyraVirtualList['hasMore'];
    'item-role'?: LyraVirtualList['itemRole'];
    'row-height'?: LyraVirtualList['rowHeight'];
    'row-index-offset'?: LyraVirtualList['rowIndexOffset'];
  }
>;

export type LyraVisuallyHiddenSvelteProps = LyraSvelteElementProps<
  LyraVisuallyHidden,
  | 'locale'
  | 'strings',
  {},
never,
never,
  {}
>;

export type LyraVoicePickerSvelteProps = LyraSvelteElementProps<
  LyraVoicePicker,
  | 'allowCustom'
  | 'autocapitalize'
  | 'autocomplete'
  | 'autoCorrect'
  | 'catalog'
  | 'customError'
  | 'defaultValue'
  | 'disabled'
  | 'enterKeyHint'
  | 'errorText'
  | 'form'
  | 'hint'
  | 'inputMode'
  | 'label'
  | 'locale'
  | 'name'
  | 'open'
  | 'placeholder'
  | 'preview'
  | 'provider'
  | 'required'
  | 'selectionDirection'
  | 'selectionEnd'
  | 'selectionStart'
  | 'size'
  | 'spellcheck'
  | 'strings'
  | 'value',
  LyraVoicePickerEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-change'
  | 'lr-invalid'
  | 'lr-preview-change'
  | 'lr-preview-request',
  | '--lr-form-control-required-color'
  | '--lr-form-control-required-content'
  | '--lr-form-control-required-offset'
  | '--lr-voice-picker-open-border-color'
  | '--lr-voice-picker-option-active-bg'
  | '--lr-voice-picker-option-selected-bg'
  | '--lr-voice-picker-option-selected-border'
  | '--lr-voice-picker-option-selected-color'
  | '--lr-voice-picker-option-selected-font-weight'
  | '--lr-voice-picker-option-synthetic-border-color'
  | '--lr-voice-picker-option-synthetic-border-style'
  | '--lr-voice-picker-option-synthetic-font-style'
  | '--lr-voice-picker-preview-active-border'
  | '--lr-voice-picker-preview-active-color'
  | '--lr-voice-picker-preview-hover-bg'
  | '--lr-voice-picker-preview-hover-color',
  {
    'allow-custom'?: LyraVoicePicker['allowCustom'];
    'autocorrect'?: LyraVoicePicker['autoCorrect'];
    'custom-error'?: LyraVoicePicker['customError'];
    'enterkeyhint'?: LyraVoicePicker['enterKeyHint'];
    'error-text'?: LyraVoicePicker['errorText'];
    'inputmode'?: LyraVoicePicker['inputMode'];
    'value'?: LyraVoicePicker['defaultValue'];
  }
>;

export type LyraWidgetSvelteProps = LyraSvelteElementProps<
  LyraWidget,
  | 'accessibleLabel'
  | 'activeView'
  | 'backdropInset'
  | 'collapsed'
  | 'collapsible'
  | 'compact'
  | 'expandable'
  | 'fullscreen'
  | 'fullscreenInset'
  | 'label'
  | 'locale'
  | 'storageKey'
  | 'strings'
  | 'sublabel'
  | 'views',
  LyraWidgetEventMap,
  | 'lr-collapse-change'
  | 'lr-collapse-request'
  | 'lr-fullscreen-change'
  | 'lr-fullscreen-request'
  | 'lr-view-change'
  | 'lr-view-request',
  | '--lr-widget-backdrop-inset'
  | '--lr-widget-fullscreen-inset'
  | '--lr-widget-overlay-color'
  | '--lr-widget-view-toggle-active-bg'
  | '--lr-widget-view-toggle-active-border-color'
  | '--lr-widget-view-toggle-active-color'
  | '--lr-widget-view-toggle-hover-bg'
  | '--lr-widget-view-toggle-hover-color',
  {
    'aria-label'?: LyraWidget['accessibleLabel'];
    'backdrop-inset'?: LyraWidget['backdropInset'];
    'fullscreen-inset'?: LyraWidget['fullscreenInset'];
    'storage-key'?: LyraWidget['storageKey'];
  }
>;

export type LyraWidgetRendererSvelteProps = LyraSvelteElementProps<
  LyraWidgetRenderer,
  | 'document'
  | 'locale'
  | 'registry'
  | 'state'
  | 'strings'
  | 'tree',
  LyraWidgetRendererEventMap,
  | 'lr-render-error'
  | 'lr-widget-action'
  | 'lr-widget-state-change',
never,
  {}
>;

export type LyraWordCloudSvelteProps = LyraSvelteElementProps<
  LyraWordCloud,
  | 'legend'
  | 'locale'
  | 'maxFontSize'
  | 'minFontSize'
  | 'orientations'
  | 'palette'
  | 'scale'
  | 'showLegend'
  | 'strings'
  | 'words',
  LyraWordCloudEventMap,
  | 'lr-word-click',
  | '--lr-word-cloud-color-1'
  | '--lr-word-cloud-color-2'
  | '--lr-word-cloud-color-3'
  | '--lr-word-cloud-color-4'
  | '--lr-word-cloud-color-5'
  | '--lr-word-cloud-color-6'
  | '--lr-word-cloud-color-7'
  | '--lr-word-cloud-color-8',
  {
    'max-font-size'?: LyraWordCloud['maxFontSize'];
    'min-font-size'?: LyraWordCloud['minFontSize'];
    'show-legend'?: LyraWordCloud['showLegend'];
  }
>;

export type LyraXmlViewerSvelteProps = LyraSvelteElementProps<
  LyraXmlViewer,
  | 'activeHighlightId'
  | 'anchor'
  | 'collapsedDepth'
  | 'copyable'
  | 'highlights'
  | 'locale'
  | 'maxHeight'
  | 'name'
  | 'src'
  | 'strings'
  | 'xml',
  LyraXmlViewerEventMap,
  | 'lr-anchor-result'
  | 'lr-copy'
  | 'lr-highlight-activate'
  | 'lr-render-error'
  | 'lr-search-change',
  | '--lr-xml-viewer-active-attribute-color'
  | '--lr-xml-viewer-active-match-color'
  | '--lr-xml-viewer-highlight-accent-background'
  | '--lr-xml-viewer-highlight-active-outline'
  | '--lr-xml-viewer-highlight-danger-background'
  | '--lr-xml-viewer-highlight-neutral-background'
  | '--lr-xml-viewer-highlight-success-background'
  | '--lr-xml-viewer-highlight-warning-background'
  | '--lr-xml-viewer-match-bg'
  | '--lr-xml-viewer-match-color'
  | '--lr-xml-viewer-max-height',
  {
    'active-highlight-id'?: LyraXmlViewer['activeHighlightId'];
    'collapsed-depth'?: LyraXmlViewer['collapsedDepth'];
    'max-height'?: LyraXmlViewer['maxHeight'];
  }
>;

export type LyraZoomableFrameSvelteProps = LyraSvelteElementProps<
  LyraZoomableFrame,
  | 'accessibleLabel'
  | 'allowfullscreen'
  | 'iframe'
  | 'loading'
  | 'locale'
  | 'referrerpolicy'
  | 'sandbox'
  | 'src'
  | 'srcdoc'
  | 'strings'
  | 'withoutControls'
  | 'withoutInteraction'
  | 'withThemeSync'
  | 'zoom'
  | 'zoomLevels',
  LyraZoomableFrameEventMap,
  | 'blur'
  | 'error'
  | 'focus'
  | 'load'
  | 'lr-blur'
  | 'lr-focus',
  | '--lr-zoomable-frame-control-hover-background'
  | '--lr-zoomable-frame-zoom',
  {
    'aria-label'?: LyraZoomableFrame['accessibleLabel'];
    'with-theme-sync'?: LyraZoomableFrame['withThemeSync'];
    'without-controls'?: LyraZoomableFrame['withoutControls'];
    'without-interaction'?: LyraZoomableFrame['withoutInteraction'];
    'zoom-levels'?: LyraZoomableFrame['zoomLevels'];
  }
>;

export interface LyraSvelteElements {
  'lr-accordion': LyraAccordionSvelteProps;
  'lr-accordion-item': LyraAccordionItemSvelteProps;
  'lr-activity-feed': LyraActivityFeedSvelteProps;
  'lr-agent-eval-dashboard': LyraAgentEvalDashboardSvelteProps;
  'lr-agent-run': LyraAgentRunSvelteProps;
  'lr-agent-trace': LyraAgentTraceSvelteProps;
  'lr-agent-workspace': LyraAgentWorkspaceSvelteProps;
  'lr-alert': LyraAlertSvelteProps;
  'lr-animated-image': LyraAnimatedImageSvelteProps;
  'lr-animation': LyraAnimationSvelteProps;
  'lr-app-rail': LyraAppRailSvelteProps;
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
  'lr-badge': LyraBadgeSvelteProps;
  'lr-bar-chart': LyraBarChartSvelteProps;
  'lr-box-plot': LyraBoxPlotSvelteProps;
  'lr-branch-picker': LyraBranchPickerSvelteProps;
  'lr-breadcrumb': LyraBreadcrumbSvelteProps;
  'lr-breadcrumb-item': LyraBreadcrumbItemSvelteProps;
  'lr-browser-frame': LyraBrowserFrameSvelteProps;
  'lr-bubble-chart': LyraBubbleChartSvelteProps;
  'lr-button': LyraButtonSvelteProps;
  'lr-button-group': LyraButtonGroupSvelteProps;
  'lr-calendar': LyraCalendarSvelteProps;
  'lr-calendar-viewer': LyraCalendarViewerSvelteProps;
  'lr-callout': LyraCalloutSvelteProps;
  'lr-card': LyraCardSvelteProps;
  'lr-carousel': LyraCarouselSvelteProps;
  'lr-carousel-item': LyraCarouselItemSvelteProps;
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
  'lr-confirm-bar': LyraConfirmBarSvelteProps;
  'lr-contact-viewer': LyraContactViewerSvelteProps;
  'lr-context-inspector': LyraContextInspectorSvelteProps;
  'lr-context-meter': LyraContextMeterSvelteProps;
  'lr-control-group': LyraControlGroupSvelteProps;
  'lr-conversation-item': LyraConversationItemSvelteProps;
  'lr-copy-button': LyraCopyButtonSvelteProps;
  'lr-csv-viewer': LyraCsvViewerSvelteProps;
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
  'lr-evaluation-run': LyraEvaluationRunSvelteProps;
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
  'lr-flow-run-overlay': LyraFlowRunOverlaySvelteProps;
  'lr-format-bytes': LyraFormatBytesSvelteProps;
  'lr-format-date': LyraFormatDateSvelteProps;
  'lr-format-number': LyraFormatNumberSvelteProps;
  'lr-gauge': LyraGaugeSvelteProps;
  'lr-generation-status': LyraGenerationStatusSvelteProps;
  'lr-geojson-view': LyraGeojsonViewSvelteProps;
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
  'lr-message-actions': LyraMessageActionsSvelteProps;
  'lr-message-feedback': LyraMessageFeedbackSvelteProps;
  'lr-message-parts': LyraMessagePartsSvelteProps;
  'lr-mind-map': LyraMindMapSvelteProps;
  'lr-model-select': LyraModelSelectSvelteProps;
  'lr-model-settings-panel': LyraModelSettingsPanelSvelteProps;
  'lr-mutation-observer': LyraMutationObserverSvelteProps;
  'lr-native-time-input': LyraNativeTimeInputSvelteProps;
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
  'lr-phone-input': LyraPhoneInputSvelteProps;
  'lr-pie-chart': LyraPieChartSvelteProps;
  'lr-playback': LyraPlaybackSvelteProps;
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
  'lr-query-builder': LyraQueryBuilderSvelteProps;
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
  'lr-schema-viewer': LyraSchemaViewerSvelteProps;
  'lr-scroller': LyraScrollerSvelteProps;
  'lr-segmented': LyraSegmentedSvelteProps;
  'lr-select': LyraSelectSvelteProps;
  'lr-selection-toolbar': LyraSelectionToolbarSvelteProps;
  'lr-sequence-strip': LyraSequenceStripSvelteProps;
  'lr-skeleton': LyraSkeletonSvelteProps;
  'lr-slider': LyraSliderSvelteProps;
  'lr-source-card': LyraSourceCardSvelteProps;
  'lr-source-list': LyraSourceListSvelteProps;
  'lr-source-picker': LyraSourcePickerSvelteProps;
  'lr-span-waterfall': LyraSpanWaterfallSvelteProps;
  'lr-sparkline': LyraSparklineSvelteProps;
  'lr-spinner': LyraSpinnerSvelteProps;
  'lr-split': LyraSplitSvelteProps;
  'lr-split-panel': LyraSplitPanelSvelteProps;
  'lr-spreadsheet-viewer': LyraSpreadsheetViewerSvelteProps;
  'lr-stack-trace': LyraStackTraceSvelteProps;
  'lr-stat': LyraStatSvelteProps;
  'lr-stepper': LyraStepperSvelteProps;
  'lr-stream-status': LyraStreamStatusSvelteProps;
  'lr-streaming-text': LyraStreamingTextSvelteProps;
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
  'lr-token-input': LyraTokenInputSvelteProps;
  'lr-tool-approval-dialog': LyraToolApprovalDialogSvelteProps;
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
  'lr-accordion': LyraAccordion;
  'lr-accordion-item': LyraAccordionItem;
  'lr-activity-feed': LyraActivityFeed;
  'lr-agent-eval-dashboard': LyraAgentEvalDashboard;
  'lr-agent-run': LyraAgentRun;
  'lr-agent-trace': LyraAgentTrace;
  'lr-agent-workspace': LyraAgentWorkspace;
  'lr-alert': LyraAlert;
  'lr-animated-image': LyraAnimatedImage;
  'lr-animation': LyraAnimation;
  'lr-app-rail': LyraAppRail;
  'lr-app-rail-item': LyraAppRailItem;
  'lr-approval-queue': LyraApprovalQueue;
  'lr-archive-viewer': LyraArchiveViewer;
  'lr-artifact-panel': LyraArtifactPanel;
  'lr-attachment-chip': LyraAttachmentChip;
  'lr-attachment-trigger': LyraAttachmentTrigger;
  'lr-audio-visualizer': LyraAudioVisualizer;
  'lr-av-player': LyraAvPlayer;
  'lr-avatar': LyraAvatar;
  'lr-avatar-group': LyraAvatarGroup;
  'lr-badge': LyraBadge;
  'lr-bar-chart': LyraBarChart;
  'lr-box-plot': LyraBoxPlot;
  'lr-branch-picker': LyraBranchPicker;
  'lr-breadcrumb': LyraBreadcrumb;
  'lr-breadcrumb-item': LyraBreadcrumbItem;
  'lr-browser-frame': LyraBrowserFrame;
  'lr-bubble-chart': LyraBubbleChart;
  'lr-button': LyraButton;
  'lr-button-group': LyraButtonGroup;
  'lr-calendar': LyraCalendar;
  'lr-calendar-viewer': LyraCalendarViewer;
  'lr-callout': LyraCallout;
  'lr-card': LyraCard;
  'lr-carousel': LyraCarousel;
  'lr-carousel-item': LyraCarouselItem;
  'lr-chart': LyraChart;
  'lr-chat-composer': LyraChatComposer;
  'lr-chat-message': LyraChatMessage;
  'lr-chat-viewport': LyraChatViewport;
  'lr-checkbox': LyraCheckbox;
  'lr-checkbox-group': LyraCheckboxGroup;
  'lr-checkpoint': LyraCheckpoint;
  'lr-chip': LyraChip;
  'lr-chip-group': LyraChipGroup;
  'lr-chunk-inspector': LyraChunkInspector;
  'lr-citation-badge': LyraCitationBadge;
  'lr-claim-evidence': LyraClaimEvidence;
  'lr-code-block': LyraCodeBlock;
  'lr-code-block-core': LyraCodeBlockCore;
  'lr-code-editor': LyraCodeEditor;
  'lr-color-picker': LyraColorPicker;
  'lr-combobox': LyraCombobox;
  'lr-command-palette': LyraCommandPalette;
  'lr-commit-card': LyraCommitCard;
  'lr-community-card': LyraCommunityCard;
  'lr-compare-panel': LyraComparePanel;
  'lr-confirm-bar': LyraConfirmBar;
  'lr-contact-viewer': LyraContactViewer;
  'lr-context-inspector': LyraContextInspector;
  'lr-context-meter': LyraContextMeter;
  'lr-control-group': LyraControlGroup;
  'lr-conversation-item': LyraConversationItem;
  'lr-copy-button': LyraCopyButton;
  'lr-csv-viewer': LyraCsvViewer;
  'lr-dashboard-grid': LyraDashboardGrid;
  'lr-data-grid': LyraDataGrid;
  'lr-dataset-viewer': LyraDatasetViewer;
  'lr-date-input': LyraDateInput;
  'lr-date-picker': LyraDatePicker;
  'lr-details': LyraDetails;
  'lr-dialog': LyraDialog;
  'lr-diff-view': LyraDiffView;
  'lr-divider': LyraDivider;
  'lr-dock-panel': LyraDockPanel;
  'lr-document-compare': LyraDocumentCompare;
  'lr-document-library': LyraDocumentLibrary;
  'lr-document-preview': LyraDocumentPreview;
  'lr-document-viewer': LyraDocumentViewer;
  'lr-docx-viewer': LyraDocxViewer;
  'lr-doughnut-chart': LyraDoughnutChart;
  'lr-drawer': LyraDrawer;
  'lr-drilldown-panel': LyraDrilldownPanel;
  'lr-dropdown': LyraDropdown;
  'lr-dropdown-item': LyraDropdownItem;
  'lr-ebook-viewer': LyraEbookViewer;
  'lr-email-viewer': LyraEmailViewer;
  'lr-embedding-explorer': LyraEmbeddingExplorer;
  'lr-emoji-picker': LyraEmojiPicker;
  'lr-empty': LyraEmpty;
  'lr-entity-card': LyraEntityCard;
  'lr-entity-chip': LyraEntityChip;
  'lr-entity-dossier': LyraEntityDossier;
  'lr-env-list': LyraEnvList;
  'lr-eval-dataset': LyraEvalDataset;
  'lr-eval-result': LyraEvalResult;
  'lr-evaluation-run': LyraEvaluationRun;
  'lr-export-button': LyraExportButton;
  'lr-file-icon': LyraFileIcon;
  'lr-file-input': LyraFileInput;
  'lr-file-tree': LyraFileTree;
  'lr-filter-bar': LyraFilterBar;
  'lr-flag': LyraFlag;
  'lr-flow-canvas': LyraFlowCanvas;
  'lr-flow-controls': LyraFlowControls;
  'lr-flow-minimap': LyraFlowMinimap;
  'lr-flow-node': LyraFlowNode;
  'lr-flow-run-overlay': LyraFlowRunOverlay;
  'lr-format-bytes': LyraFormatBytes;
  'lr-format-date': LyraFormatDate;
  'lr-format-number': LyraFormatNumber;
  'lr-gauge': LyraGauge;
  'lr-generation-status': LyraGenerationStatus;
  'lr-geojson-view': LyraGeojsonView;
  'lr-graph': LyraGraph;
  'lr-graph-legend': LyraGraphLegend;
  'lr-graph-query-builder': LyraGraphQueryBuilder;
  'lr-grounding-summary': LyraGroundingSummary;
  'lr-handoff-divider': LyraHandoffDivider;
  'lr-heatmap': LyraHeatmap;
  'lr-highlight-layer': LyraHighlightLayer;
  'lr-histogram': LyraHistogram;
  'lr-html-viewer': LyraHtmlViewer;
  'lr-icon': LyraIcon;
  'lr-icon-button': LyraIconButton;
  'lr-image-comparer': LyraImageComparer;
  'lr-image-viewer': LyraImageViewer;
  'lr-include': LyraInclude;
  'lr-ingestion-queue': LyraIngestionQueue;
  'lr-input': LyraInput;
  'lr-intersection-observer': LyraIntersectionObserver;
  'lr-json-viewer': LyraJsonViewer;
  'lr-kbd': LyraKbd;
  'lr-knowledge-base': LyraKnowledgeBase;
  'lr-knowledge-base-admin': LyraKnowledgeBaseAdmin;
  'lr-knowledge-graph-explorer': LyraKnowledgeGraphExplorer;
  'lr-known-date': LyraKnownDate;
  'lr-lightbox': LyraLightbox;
  'lr-line-chart': LyraLineChart;
  'lr-lite-chart': LyraLiteChart;
  'lr-live-region': LyraLiveRegion;
  'lr-locale-picker': LyraLocalePicker;
  'lr-map': LyraMap;
  'lr-markdown': LyraMarkdown;
  'lr-markdown-core': LyraMarkdownCore;
  'lr-mcp-app': LyraMcpApp;
  'lr-media-card': LyraMediaCard;
  'lr-memory-panel': LyraMemoryPanel;
  'lr-mention-popover': LyraMentionPopover;
  'lr-menu': LyraMenu;
  'lr-menu-item': LyraMenuItem;
  'lr-menu-label': LyraMenuLabel;
  'lr-message-actions': LyraMessageActions;
  'lr-message-feedback': LyraMessageFeedback;
  'lr-message-parts': LyraMessageParts;
  'lr-mind-map': LyraMindMap;
  'lr-model-select': LyraModelSelect;
  'lr-model-settings-panel': LyraModelSettingsPanel;
  'lr-mutation-observer': LyraMutationObserver;
  'lr-native-time-input': LyraNativeTimeInput;
  'lr-neighbor-list': LyraNeighborList;
  'lr-node-palette': LyraNodePalette;
  'lr-notebook-viewer': LyraNotebookViewer;
  'lr-number-input': LyraNumberInput;
  'lr-option': LyraOption;
  'lr-otp-input': LyraOtpInput;
  'lr-page': LyraPage;
  'lr-page-rail': LyraPageRail;
  'lr-pagination': LyraPagination;
  'lr-pan-zoom': LyraPanZoom;
  'lr-path-strip': LyraPathStrip;
  'lr-pdf-viewer': LyraPdfViewer;
  'lr-phone-input': LyraPhoneInput;
  'lr-pie-chart': LyraPieChart;
  'lr-playback': LyraPlayback;
  'lr-polar-area-chart': LyraPolarAreaChart;
  'lr-policy-summary': LyraPolicySummary;
  'lr-poll-status': LyraPollStatus;
  'lr-popover': LyraPopover;
  'lr-popup': LyraPopup;
  'lr-pptx-viewer': LyraPptxViewer;
  'lr-progress-bar': LyraProgressBar;
  'lr-progress-ring': LyraProgressRing;
  'lr-prompt-input': LyraPromptInput;
  'lr-prompt-queue': LyraPromptQueue;
  'lr-prompt-studio': LyraPromptStudio;
  'lr-provenance-panel': LyraProvenancePanel;
  'lr-push-to-talk': LyraPushToTalk;
  'lr-qr-code': LyraQrCode;
  'lr-query-builder': LyraQueryBuilder;
  'lr-radar-chart': LyraRadarChart;
  'lr-radio': LyraRadio;
  'lr-radio-button': LyraRadioButton;
  'lr-radio-group': LyraRadioGroup;
  'lr-rag-answer': LyraRagAnswer;
  'lr-rag-eval-dashboard': LyraRagEvalDashboard;
  'lr-random-content': LyraRandomContent;
  'lr-rating': LyraRating;
  'lr-realtime-session': LyraRealtimeSession;
  'lr-relative-time': LyraRelativeTime;
  'lr-reorder-item': LyraReorderItem;
  'lr-reorder-list': LyraReorderList;
  'lr-resize-observer': LyraResizeObserver;
  'lr-responsive-panel': LyraResponsivePanel;
  'lr-result-card': LyraResultCard;
  'lr-result-field': LyraResultField;
  'lr-retrieval-compare': LyraRetrievalCompare;
  'lr-retrieval-results': LyraRetrievalResults;
  'lr-retrieval-search': LyraRetrievalSearch;
  'lr-retrieval-trace': LyraRetrievalTrace;
  'lr-rubric-form': LyraRubricForm;
  'lr-scatter-chart': LyraScatterChart;
  'lr-schema-viewer': LyraSchemaViewer;
  'lr-scroller': LyraScroller;
  'lr-segmented': LyraSegmented;
  'lr-select': LyraSelect;
  'lr-selection-toolbar': LyraSelectionToolbar;
  'lr-sequence-strip': LyraSequenceStrip;
  'lr-skeleton': LyraSkeleton;
  'lr-slider': LyraSlider;
  'lr-source-card': LyraSourceCard;
  'lr-source-list': LyraSourceList;
  'lr-source-picker': LyraSourcePicker;
  'lr-span-waterfall': LyraSpanWaterfall;
  'lr-sparkline': LyraSparkline;
  'lr-spinner': LyraSpinner;
  'lr-split': LyraSplit;
  'lr-split-panel': LyraSplitPanel;
  'lr-spreadsheet-viewer': LyraSpreadsheetViewer;
  'lr-stack-trace': LyraStackTrace;
  'lr-stat': LyraStat;
  'lr-stepper': LyraStepper;
  'lr-stream-status': LyraStreamStatus;
  'lr-streaming-text': LyraStreamingText;
  'lr-subagent-panel': LyraSubagentPanel;
  'lr-suggestion-chips': LyraSuggestionChips;
  'lr-svg-viewer': LyraSvgViewer;
  'lr-swatch-picker': LyraSwatchPicker;
  'lr-switch': LyraSwitch;
  'lr-tab': LyraTab;
  'lr-tab-group': LyraTabGroup;
  'lr-tab-panel': LyraTabPanel;
  'lr-table': LyraTable;
  'lr-tag': LyraTag;
  'lr-task-list': LyraTaskList;
  'lr-terminal': LyraTerminal;
  'lr-test-results': LyraTestResults;
  'lr-textarea': LyraTextarea;
  'lr-thinking-panel': LyraThinkingPanel;
  'lr-thread-list': LyraThreadList;
  'lr-time-input': LyraTimeInput;
  'lr-time-range': LyraTimeRange;
  'lr-timeline': LyraTimeline;
  'lr-timeline-item': LyraTimelineItem;
  'lr-toast': LyraToast;
  'lr-toast-item': LyraToastItem;
  'lr-token-input': LyraTokenInput;
  'lr-tool-approval-dialog': LyraToolApprovalDialog;
  'lr-tool-call-chip': LyraToolCallChip;
  'lr-tool-param-form': LyraToolParamForm;
  'lr-tool-result-dialog': LyraToolResultDialog;
  'lr-tool-result-view': LyraToolResultView;
  'lr-tool-select-dialog': LyraToolSelectDialog;
  'lr-tool-timeline': LyraToolTimeline;
  'lr-tooltip': LyraTooltip;
  'lr-tour': LyraTour;
  'lr-trace-tree': LyraTraceTree;
  'lr-transcript-feed': LyraTranscriptFeed;
  'lr-tree': LyraTree;
  'lr-tree-item': LyraTreeItem;
  'lr-typing-indicator': LyraTypingIndicator;
  'lr-usage-badge': LyraUsageBadge;
  'lr-video': LyraVideo;
  'lr-video-playlist': LyraVideoPlaylist;
  'lr-virtual-list': LyraVirtualList;
  'lr-visually-hidden': LyraVisuallyHidden;
  'lr-voice-picker': LyraVoicePicker;
  'lr-widget': LyraWidget;
  'lr-widget-renderer': LyraWidgetRenderer;
  'lr-word-cloud': LyraWordCloud;
  'lr-xml-viewer': LyraXmlViewer;
  'lr-zoomable-frame': LyraZoomableFrame;
}

declare module 'svelte/elements' {
  export interface SvelteHTMLElements extends LyraSvelteElements {}
}

declare global {
  interface HTMLElementTagNameMap extends LyraElementTagNameMap {}
}
