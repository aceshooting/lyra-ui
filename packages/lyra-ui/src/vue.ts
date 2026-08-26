// GENERATED FILE — do not edit by hand. Opt-in Vue 3 custom-element declarations.
// Regenerate with `pnpm --filter @aceshooting/lyra-ui run framework-types`.
// This module contains types only; its emitted JavaScript is an empty module.
import type { EmitFn, HTMLAttributes, PublicProps } from 'vue';
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
import type { LyraEvalRun, LyraEvalRunEventMap } from './components/agent-tools/evaluation-run/evaluation-run.class.js';
import type { LyraMcpApp, LyraMcpAppEventMap } from './components/agent-tools/mcp-app/mcp-app.class.js';
import type { LyraPolicySummary } from './components/agent-tools/policy-summary/policy-summary.class.js';
import type { LyraPromptStudio, LyraPromptStudioEventMap } from './components/agent-tools/prompt-studio/prompt-studio.class.js';
import type { LyraResultCard } from './components/agent-tools/result-card/result-card.class.js';
import type { LyraResultField } from './components/agent-tools/result-card/result-field.class.js';
import type { LyraJsonSchemaViewer, LyraJsonSchemaViewerEventMap } from './components/agent-tools/schema-viewer/schema-viewer.class.js';
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
import type { LyraGenerationMetrics, LyraGenerationMetricsEventMap } from './components/conversation/generation-metrics/generation-metrics.class.js';
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
import type { LyraConditionBuilder, LyraConditionBuilderEventMap } from './components/data/condition-builder/condition-builder.class.js';
import type { LyraContextMeter } from './components/data/context-meter/context-meter.class.js';
import type { LyraDataGrid, LyraDataGridEventMap } from './components/data/data-grid/data-grid.class.js';
import type { LyraDocumentLibrary, LyraDocumentLibraryEventMap } from './components/data/document-library/document-library.class.js';
import type { LyraEnvList, LyraEnvListEventMap } from './components/data/env-list/env-list.class.js';
import type { LyraFileTree, LyraFileTreeEventMap } from './components/data/file-tree/file-tree.class.js';
import type { LyraFlowCanvas, LyraFlowCanvasEventMap } from './components/data/flow-canvas/flow-canvas.class.js';
import type { LyraFlowControls } from './components/data/flow-controls/flow-controls.class.js';
import type { LyraFlowMinimap } from './components/data/flow-minimap/flow-minimap.class.js';
import type { LyraFlowNode } from './components/data/flow-node/flow-node.class.js';
import type { LyraFlowRunStatus } from './components/data/flow-run-status/flow-run-status.class.js';
import type { LyraFunnel } from './components/data/funnel/funnel.class.js';
import type { LyraGauge } from './components/data/gauge/gauge.class.js';
import type { LyraGraphQueryBuilder, LyraGraphQueryBuilderEventMap } from './components/data/graph-query-builder/graph-query-builder.class.js';
import type { LyraHeatmap, LyraHeatmapEventMap } from './components/data/heatmap/heatmap.class.js';
import type { LyraPagination, LyraPaginationEventMap } from './components/data/pagination/pagination.class.js';
import type { LyraSequenceStrip, LyraSequenceStripEventMap } from './components/data/sequence-strip/sequence-strip.class.js';
import type { LyraSparkline } from './components/data/sparkline/sparkline.class.js';
import type { LyraStat } from './components/data/stat/stat.class.js';
import type { LyraTable, LyraTableEventMap } from './components/data/table/table.class.js';
import type { LyraTimelineItem } from './components/data/timeline/timeline-item.class.js';
import type { LyraTimeline, LyraTimelineEventMap } from './components/data/timeline/timeline.class.js';
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
import type { LyraFilterBar, LyraFilterBarEventMap, LyraFilterBarFilterDefinition, LyraFilterBarValue } from './components/layout/filter-bar/filter-bar.class.js';
import type { LyraDropdownItem, LyraDropdownItemEventMap } from './components/layout/menu/dropdown-item.class.js';
import type { LyraMenuItem, LyraMenuItemEventMap } from './components/layout/menu/menu-item.class.js';
import type { LyraMenuLabel } from './components/layout/menu/menu-label.class.js';
import type { LyraMenu, LyraMenuEventMap } from './components/layout/menu/menu.class.js';
import type { LyraMultiSplit, LyraMultiSplitEventMap } from './components/layout/multi-split/multi-split.class.js';
import type { LyraPage, LyraPageEventMap } from './components/layout/page/page.class.js';
import type { LyraReorderItem, LyraReorderItemEventMap } from './components/layout/reorder-list/reorder-item.class.js';
import type { LyraReorderList, LyraReorderListEventMap } from './components/layout/reorder-list/reorder-list.class.js';
import type { LyraResponsivePanel, LyraResponsivePanelEventMap } from './components/layout/responsive-panel/responsive-panel.class.js';
import type { LyraScroller, LyraScrollerEventMap } from './components/layout/scroller/scroller.class.js';
import type { LyraSegmented, LyraSegmentedEventMap } from './components/layout/segmented/segmented.class.js';
import type { LyraSplitPanel, LyraSplitPanelEventMap, LyraSplitPanelSnapFunction } from './components/layout/split-panel/split-panel.class.js';
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
import type { LyraQrCode } from './components/media/qr-code/qr-code.class.js';
import type { LyraSequencePlayback, LyraSequencePlaybackEventMap } from './components/media/sequence-playback/sequence-playback.class.js';
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
import type { LyraGeojsonView } from './components/viewers/geojson-view/geojson-view.class.js';
import type { LyraGeoJsonViewer, LyraGeoJsonViewerEventMap } from './components/viewers/geojson-view/geojson-viewer.class.js';
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

type LyraAttributePrimitive<Value> = Value extends boolean
  ? Value | '' | 'true' | 'false'
  : Value extends number
    ? Value | `${Value}`
    : Value extends string
      ? Value
      : LyraUnknownAttributeValue;

/** Markup-compatible values for a typed attribute alias that has no public class field. */
export type LyraAttributeValue<Value> =
  | LyraAttributePrimitive<Exclude<Value, null | undefined>>
  | Extract<Value, null | undefined>;

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

type LyraVueEmit<
  ElementType extends HTMLElement,
  ElementEvents extends object,
  EventNames extends string,
> = EmitFn<{
  [Name in EventNames]: (event: LyraBoundEvent<ElementType, ElementEvents, Name>) => void;
}>;

type LyraVueCustomElement<
  ElementType extends HTMLElement,
  PropertyNames extends keyof ElementType,
  PropertyOverrides extends object,
  ElementEvents extends object,
  EventNames extends string,
  CSSNames extends string,
  AttributeAliases extends object,
> = new () => ElementType & {
  /** @deprecated Template prop metadata only; this property does not exist at runtime. */
  $props: Omit<HTMLAttributes, PropertyNames | keyof AttributeAliases | 'style'> &
    Partial<Omit<Pick<ElementType, PropertyNames>, keyof PropertyOverrides> & PropertyOverrides> &
    AttributeAliases &
    PublicProps & {
      style?: HTMLAttributes['style'] | LyraCSSCustomProperties<CSSNames>;
    };
  /** @deprecated Template event metadata only; this property does not exist at runtime. */
  $emit: LyraVueEmit<ElementType, ElementEvents, EventNames>;
};

export type LyraAccordionVueProps = LyraVueCustomElement<
  LyraAccordion,
  | 'appearance'
  | 'headingLevel'
  | 'iconPlacement'
  | 'locale'
  | 'mode'
  | 'strings',
  {},
  LyraAccordionEventMap,
  | 'lr-after-collapse'
  | 'lr-after-expand'
  | 'lr-collapse'
  | 'lr-expand'
  | 'lr-toggle-request',
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

export type LyraAccordionItemVueProps = LyraVueCustomElement<
  LyraAccordionItem,
  | 'appearance'
  | 'disabled'
  | 'expanded'
  | 'headingLevel'
  | 'iconPlacement'
  | 'label'
  | 'locale'
  | 'strings',
  {},
  {},
never,
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
  | '--show-duration'
  | '--spacing',
  {
    'heading-level'?: LyraAccordionItem['headingLevel'];
    'icon-placement'?: LyraAccordionItem['iconPlacement'];
  }
>;

export type LyraActivityFeedVueProps = LyraVueCustomElement<
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
  {},
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

export type LyraAgentEvalDashboardVueProps = LyraVueCustomElement<
  LyraAgentEvalDashboard,
  | 'chartHeight'
  | 'currency'
  | 'label'
  | 'locale'
  | 'maxRenderedRuns'
  | 'metricId'
  | 'metrics'
  | 'runs'
  | 'showChart'
  | 'strings',
  {},
  LyraAgentEvalDashboardEventMap,
  | 'lr-metric-change'
  | 'lr-run-activate',
  | '--lr-agent-eval-dashboard-active-background'
  | '--lr-agent-eval-dashboard-active-border',
  {
    'chart-height'?: LyraAgentEvalDashboard['chartHeight'];
    'max-rendered-runs'?: LyraAgentEvalDashboard['maxRenderedRuns'];
    'metric-id'?: LyraAgentEvalDashboard['metricId'];
    'show-chart'?: LyraAgentEvalDashboard['showChart'];
  }
>;

export type LyraAgentRunVueProps = LyraVueCustomElement<
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
  {},
  LyraAgentRunEventMap,
  | 'lr-cancel'
  | 'lr-run-retry',
  | '--lr-agent-run-compact-gap'
  | '--lr-agent-run-compact-padding'
  | '--lr-agent-run-metric-brand-color'
  | '--lr-agent-run-metric-danger-color'
  | '--lr-agent-run-metric-success-color'
  | '--lr-agent-run-metric-warning-color'
  | '--lr-agent-run-spin',
  {
    'show-cancel'?: LyraAgentRun['showCancel'];
    'show-retry'?: LyraAgentRun['showRetry'];
  }
>;

export type LyraAgentTraceVueProps = LyraVueCustomElement<
  LyraAgentTrace,
  | 'activeSpanId'
  | 'hiddenKinds'
  | 'label'
  | 'locale'
  | 'showBars'
  | 'showCost'
  | 'showTokens'
  | 'spans'
  | 'strings',
  {},
  LyraAgentTraceEventMap,
  | 'lr-span-select'
  | 'lr-span-toggle'
  | 'lr-span-visibility-change',
  | '--lr-agent-trace-handoff-active-bg',
  {
    'active-span-id'?: LyraAgentTrace['activeSpanId'];
    'show-bars'?: LyraAgentTrace['showBars'];
    'show-cost'?: LyraAgentTrace['showCost'];
    'show-tokens'?: LyraAgentTrace['showTokens'];
  }
>;

export type LyraAgentWorkspaceVueProps = LyraVueCustomElement<
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
  | 'retrievalErrorText'
  | 'retrievalHasMore'
  | 'retrievalLoading'
  | 'run'
  | 'selectedRetrievalChunkIds'
  | 'showComposer'
  | 'showDetails'
  | 'strings'
  | 'tools'
  | 'unreadStartIndex',
  {},
  LyraAgentWorkspaceEventMap,
  | 'lr-cancel'
  | 'lr-citation-select'
  | 'lr-follow-change'
  | 'lr-input'
  | 'lr-message-retry'
  | 'lr-retrieval-select'
  | 'lr-run-retry'
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
    'retrieval-error-text'?: LyraAgentWorkspace['retrievalErrorText'];
    'retrieval-has-more'?: LyraAgentWorkspace['retrievalHasMore'];
    'retrieval-loading'?: LyraAgentWorkspace['retrievalLoading'];
    'show-composer'?: LyraAgentWorkspace['showComposer'];
    'show-details'?: LyraAgentWorkspace['showDetails'];
    'unread-start-index'?: LyraAgentWorkspace['unreadStartIndex'];
  }
>;

export type LyraAlertVueProps = LyraVueCustomElement<
  LyraAlert,
  | 'closable'
  | 'countdown'
  | 'duration'
  | 'locale'
  | 'open'
  | 'role'
  | 'strings'
  | 'variant',
  {},
  LyraAlertEventMap,
  | 'lr-after-hide'
  | 'lr-after-show'
  | 'lr-hide'
  | 'lr-show',
never,
  {}
>;

export type LyraAnimatedImageVueProps = LyraVueCustomElement<
  LyraAnimatedImage,
  | 'accessibleLabel'
  | 'alt'
  | 'locale'
  | 'play'
  | 'respectReducedMotion'
  | 'src'
  | 'strings',
  {},
  LyraAnimatedImageEventMap,
  | 'blur'
  | 'focus'
  | 'lr-error'
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

export type LyraAnimationVueProps = LyraVueCustomElement<
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
  {},
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

export type LyraAppRailVueProps = LyraVueCustomElement<
  LyraAppRail,
  | 'forceMode'
  | 'hideToggle'
  | 'iconOnlyBreakpoint'
  | 'label'
  | 'locale'
  | 'maxRailWidthPx'
  | 'minRailWidthPx'
  | 'mobileBreakpoint'
  | 'open'
  | 'persist'
  | 'preferredMode'
  | 'railWidthPx'
  | 'resizable'
  | 'storageKey'
  | 'strings',
  {},
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
    'aria-label'?: LyraAttributeValue<string | null>;
    'force-mode'?: LyraAppRail['forceMode'];
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

export type LyraAppRailItemVueProps = LyraVueCustomElement<
  LyraAppRailItem,
  | 'active'
  | 'current'
  | 'disabled'
  | 'href'
  | 'locale'
  | 'strings'
  | 'target'
  | 'tooltip',
  {},
  {},
never,
  | '--lr-app-rail-item-active-bg'
  | '--lr-app-rail-item-active-color'
  | '--lr-app-rail-item-current-bg'
  | '--lr-app-rail-item-current-color'
  | '--lr-app-rail-item-hover-bg'
  | '--lr-app-rail-item-hover-color',
  {
    'icon-only'?: LyraAttributeValue<boolean>;
  }
>;

export type LyraApprovalQueueVueProps = LyraVueCustomElement<
  LyraApprovalQueue,
  | 'editable'
  | 'label'
  | 'locale'
  | 'open'
  | 'requests'
  | 'selectedInvocationId'
  | 'strings',
  {},
  LyraApprovalQueueEventMap,
  | 'lr-approval-close'
  | 'lr-approval-decision'
  | 'lr-approval-select',
  | '--lr-approval-queue-selected-border',
  {
    'selected-invocation-id'?: LyraApprovalQueue['selectedInvocationId'];
  }
>;

export type LyraArchiveViewerVueProps = LyraVueCustomElement<
  LyraArchiveViewer,
  | 'activeHighlightId'
  | 'anchor'
  | 'highlights'
  | 'locale'
  | 'maxHeight'
  | 'name'
  | 'src'
  | 'strings',
  {},
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
  | '--lr-archive-viewer-highlight-warning-background'
  | '--lr-archive-viewer-max-height',
  {
    'active-highlight-id'?: LyraArchiveViewer['activeHighlightId'];
    'max-height'?: LyraArchiveViewer['maxHeight'];
  }
>;

export type LyraArtifactPanelVueProps = LyraVueCustomElement<
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
  {},
  LyraArtifactPanelEventMap,
  | 'lr-copy'
  | 'lr-copy-error'
  | 'lr-download'
  | 'lr-error'
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

export type LyraAttachmentChipVueProps = LyraVueCustomElement<
  LyraAttachmentChip,
  | 'attachmentId'
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
  {},
  LyraAttachmentChipEventMap,
  | 'lr-preview-request'
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
    'attachment-id'?: LyraAttachmentChip['attachmentId'];
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

export type LyraAttachmentTriggerVueProps = LyraVueCustomElement<
  LyraAttachmentTrigger,
  | 'accept'
  | 'accessibleLabel'
  | 'capabilities'
  | 'disabled'
  | 'locale'
  | 'multiple'
  | 'strings'
  | 'triggerTitle',
  {},
  LyraAttachmentTriggerEventMap,
  | 'blur'
  | 'focus'
  | 'lr-audio-request'
  | 'lr-camera-request'
  | 'lr-files',
never,
  {
    'accessible-label'?: LyraAttachmentTrigger['accessibleLabel'];
    'trigger-title'?: LyraAttachmentTrigger['triggerTitle'];
  }
>;

export type LyraAudioVisualizerVueProps = LyraVueCustomElement<
  LyraAudioVisualizer,
  | 'barCount'
  | 'gain'
  | 'label'
  | 'level'
  | 'locale'
  | 'mode'
  | 'state'
  | 'stream'
  | 'strings',
  {},
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

export type LyraAvPlayerVueProps = LyraVueCustomElement<
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
  | 'tracks'
  | 'volume',
  {},
  LyraAvPlayerEventMap,
  | 'blur'
  | 'ended'
  | 'error'
  | 'focus'
  | 'loadedmetadata'
  | 'lr-anchor-result'
  | 'lr-cue-change'
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

export type LyraAvatarVueProps = LyraVueCustomElement<
  LyraAvatar,
  | 'image'
  | 'initials'
  | 'label'
  | 'loading'
  | 'locale'
  | 'shape'
  | 'size'
  | 'strings'
  | 'variant',
  {},
  LyraAvatarEventMap,
  | 'lr-error',
  | '--lr-avatar-bg'
  | '--lr-avatar-color'
  | '--lr-avatar-font-size'
  | '--lr-avatar-size'
  | '--size',
  {}
>;

export type LyraAvatarGroupVueProps = LyraVueCustomElement<
  LyraAvatarGroup,
  | 'label'
  | 'locale'
  | 'max'
  | 'shape'
  | 'size'
  | 'strings'
  | 'variant',
  {},
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

export type LyraBadgeVueProps = LyraVueCustomElement<
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

export type LyraBarChartVueProps = LyraVueCustomElement<
  LyraBarChart,
  | 'annotations'
  | 'area'
  | 'beginAtZero'
  | 'chart'
  | 'config'
  | 'dataLabels'
  | 'datasets'
  | 'dataTableToggle'
  | 'description'
  | 'formatter'
  | 'grid'
  | 'height'
  | 'hiddenDatasets'
  | 'indexAxis'
  | 'label'
  | 'labels'
  | 'legendPosition'
  | 'locale'
  | 'max'
  | 'min'
  | 'plugins'
  | 'scaleType'
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
  {},
  LyraChartEventMap,
  | 'lr-before-legend-visibility-change'
  | 'lr-datum-activate'
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
  | '--lr-chart-data-table-toggle-active-bg'
  | '--lr-chart-data-table-toggle-hover-bg'
  | '--lr-chart-grid-color'
  | '--lr-chart-height'
  | '--lr-chart-legend-color'
  | '--lr-chart-legend-item-active-bg'
  | '--lr-chart-legend-item-hover-bg'
  | '--lr-chart-legend-side-max'
  | '--lr-chart-pattern-step'
  | '--lr-chart-reset-zoom-button-active-bg'
  | '--lr-chart-reset-zoom-button-hover-bg'
  | '--lr-chart-tick-color'
  | '--lr-chart-tooltip-bg'
  | '--lr-chart-tooltip-text'
  | '--point-radius',
  {
    'begin-at-zero'?: LyraBarChart['beginAtZero'];
    'data-labels'?: LyraBarChart['dataLabels'];
    'data-table-toggle'?: LyraBarChart['dataTableToggle'];
    'index-axis'?: LyraBarChart['indexAxis'];
    'legend-position'?: LyraBarChart['legendPosition'];
    'scale-type'?: LyraBarChart['scaleType'];
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

export type LyraBoxPlotVueProps = LyraVueCustomElement<
  LyraBoxPlot,
  | 'beginAtZero'
  | 'datasets'
  | 'dataTableToggle'
  | 'description'
  | 'formatter'
  | 'height'
  | 'hiddenDatasets'
  | 'label'
  | 'labels'
  | 'legend'
  | 'legendPosition'
  | 'locale'
  | 'showDataTable'
  | 'strings'
  | 'valueFormatter'
  | 'yLabel',
  {},
  LyraBoxPlotEventMap,
  | 'lr-before-legend-visibility-change'
  | 'lr-datum-activate'
  | 'lr-legend-visibility-change'
  | 'lr-point-click',
  | '--lr-box-plot-data-table-toggle-active-bg'
  | '--lr-box-plot-data-table-toggle-hover-bg'
  | '--lr-chart-canvas-hover-outline-width'
  | '--lr-chart-grid-color'
  | '--lr-chart-height'
  | '--lr-chart-legend-color'
  | '--lr-chart-legend-item-active-bg'
  | '--lr-chart-legend-item-hover-bg'
  | '--lr-chart-legend-side-max'
  | '--lr-chart-pattern-step'
  | '--lr-chart-tick-color'
  | '--lr-chart-tooltip-bg'
  | '--lr-chart-tooltip-text',
  {
    'begin-at-zero'?: LyraBoxPlot['beginAtZero'];
    'data-table-toggle'?: LyraBoxPlot['dataTableToggle'];
    'legend-position'?: LyraBoxPlot['legendPosition'];
    'show-data-table'?: LyraBoxPlot['showDataTable'];
    'y-label'?: LyraBoxPlot['yLabel'];
  }
>;

export type LyraBranchPickerVueProps = LyraVueCustomElement<
  LyraBranchPicker,
  | 'count'
  | 'index'
  | 'label'
  | 'locale'
  | 'strings',
  {},
  LyraBranchPickerEventMap,
  | 'lr-branch-change'
  | 'lr-toolbar-actions-change',
never,
  {}
>;

export type LyraBreadcrumbVueProps = LyraVueCustomElement<
  LyraBreadcrumb,
  | 'accessibleLabel'
  | 'label'
  | 'locale'
  | 'strings',
  {},
  {},
never,
never,
  {
    'aria-label'?: LyraBreadcrumb['accessibleLabel'];
  }
>;

export type LyraBreadcrumbItemVueProps = LyraVueCustomElement<
  LyraBreadcrumbItem,
  | 'current'
  | 'href'
  | 'locale'
  | 'rel'
  | 'strings'
  | 'target',
  {
    href: string | undefined;
  },
  {},
never,
  | '--lr-breadcrumb-current-color'
  | '--lr-breadcrumb-item-active-bg',
  {}
>;

export type LyraBrowserFrameVueProps = LyraVueCustomElement<
  LyraBrowserFrame,
  | 'controller'
  | 'controls'
  | 'frameSrc'
  | 'locale'
  | 'phase'
  | 'pings'
  | 'strings'
  | 'url',
  {},
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

export type LyraBubbleChartVueProps = LyraVueCustomElement<
  LyraBubbleChart,
  | 'annotations'
  | 'area'
  | 'beginAtZero'
  | 'chart'
  | 'config'
  | 'dataLabels'
  | 'datasets'
  | 'dataTableToggle'
  | 'description'
  | 'formatter'
  | 'grid'
  | 'height'
  | 'hiddenDatasets'
  | 'indexAxis'
  | 'label'
  | 'labels'
  | 'legendPosition'
  | 'locale'
  | 'max'
  | 'min'
  | 'plugins'
  | 'scaleType'
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
  {},
  LyraChartEventMap,
  | 'lr-before-legend-visibility-change'
  | 'lr-datum-activate'
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
  | '--lr-chart-data-table-toggle-active-bg'
  | '--lr-chart-data-table-toggle-hover-bg'
  | '--lr-chart-grid-color'
  | '--lr-chart-height'
  | '--lr-chart-legend-color'
  | '--lr-chart-legend-item-active-bg'
  | '--lr-chart-legend-item-hover-bg'
  | '--lr-chart-legend-side-max'
  | '--lr-chart-pattern-step'
  | '--lr-chart-reset-zoom-button-active-bg'
  | '--lr-chart-reset-zoom-button-hover-bg'
  | '--lr-chart-tick-color'
  | '--lr-chart-tooltip-bg'
  | '--lr-chart-tooltip-text'
  | '--point-radius',
  {
    'begin-at-zero'?: LyraBubbleChart['beginAtZero'];
    'data-labels'?: LyraBubbleChart['dataLabels'];
    'data-table-toggle'?: LyraBubbleChart['dataTableToggle'];
    'index-axis'?: LyraBubbleChart['indexAxis'];
    'legend-position'?: LyraBubbleChart['legendPosition'];
    'scale-type'?: LyraBubbleChart['scaleType'];
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

export type LyraButtonVueProps = LyraVueCustomElement<
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
  {
    form: HTMLFormElement | string | null;
  },
  LyraButtonEventMap,
  | 'blur'
  | 'focus'
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
    'aria-controls'?: LyraAttributeValue<string | null>;
    'aria-describedby'?: LyraAttributeValue<string | null>;
    'aria-expanded'?: LyraAttributeValue<string | null>;
    'aria-haspopup'?: LyraAttributeValue<string | null>;
    'aria-label'?: LyraButton['accessibleLabel'];
    'custom-error'?: LyraButton['customError'];
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

export type LyraButtonGroupVueProps = LyraVueCustomElement<
  LyraButtonGroup,
  | 'label'
  | 'locale'
  | 'orientation'
  | 'strings',
  {},
  {},
never,
  | '--lr-button-group-gap',
  {}
>;

export type LyraCalendarVueProps = LyraVueCustomElement<
  LyraCalendar,
  | 'accessibleLabel'
  | 'events'
  | 'firstDayOfWeek'
  | 'locale'
  | 'strings'
  | 'value'
  | 'view'
  | 'viewDate',
  {},
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

export type LyraCalendarViewerVueProps = LyraVueCustomElement<
  LyraCalendarViewer,
  | 'activeHighlightId'
  | 'anchor'
  | 'highlights'
  | 'locale'
  | 'maxHeight'
  | 'name'
  | 'src'
  | 'strings',
  {},
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

export type LyraCalloutVueProps = LyraVueCustomElement<
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
  {},
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

export type LyraCardVueProps = LyraVueCustomElement<
  LyraCard,
  | 'accessibleLabel'
  | 'actionable'
  | 'appearance'
  | 'href'
  | 'locale'
  | 'orientation'
  | 'rel'
  | 'strings'
  | 'target'
  | 'withFooter'
  | 'withFooterActions'
  | 'withHeader'
  | 'withHeaderActions'
  | 'withMedia',
  {},
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

export type LyraCarouselVueProps = LyraVueCustomElement<
  LyraCarousel,
  | 'accessibleLabel'
  | 'autoplay'
  | 'autoplayInterval'
  | 'currentSlide'
  | 'locale'
  | 'loop'
  | 'mouseDragging'
  | 'navigation'
  | 'orientation'
  | 'pagination'
  | 'slidesPerMove'
  | 'slidesPerPage'
  | 'strings',
  {},
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
    'aria-label'?: LyraAttributeValue<string | null>;
    'autoplay-interval'?: LyraCarousel['autoplayInterval'];
    'current-slide'?: LyraCarousel['currentSlide'];
    'mouse-dragging'?: LyraCarousel['mouseDragging'];
    'slides-per-move'?: LyraCarousel['slidesPerMove'];
    'slides-per-page'?: LyraCarousel['slidesPerPage'];
  }
>;

export type LyraCarouselItemVueProps = LyraVueCustomElement<
  LyraCarouselItem,
  | 'locale'
  | 'strings',
  {},
  {},
never,
  | '--aspect-ratio',
  {}
>;

export type LyraChartVueProps = LyraVueCustomElement<
  LyraChart,
  | 'annotations'
  | 'area'
  | 'beginAtZero'
  | 'chart'
  | 'config'
  | 'dataLabels'
  | 'datasets'
  | 'dataTableToggle'
  | 'description'
  | 'formatter'
  | 'grid'
  | 'height'
  | 'hiddenDatasets'
  | 'indexAxis'
  | 'label'
  | 'labels'
  | 'legendPosition'
  | 'locale'
  | 'max'
  | 'min'
  | 'plugins'
  | 'scaleType'
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
  {},
  LyraChartEventMap,
  | 'lr-before-legend-visibility-change'
  | 'lr-datum-activate'
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
  | '--lr-chart-data-table-toggle-active-bg'
  | '--lr-chart-data-table-toggle-hover-bg'
  | '--lr-chart-grid-color'
  | '--lr-chart-height'
  | '--lr-chart-legend-color'
  | '--lr-chart-legend-item-active-bg'
  | '--lr-chart-legend-item-hover-bg'
  | '--lr-chart-legend-side-max'
  | '--lr-chart-pattern-step'
  | '--lr-chart-reset-zoom-button-active-bg'
  | '--lr-chart-reset-zoom-button-hover-bg'
  | '--lr-chart-tick-color'
  | '--lr-chart-tooltip-bg'
  | '--lr-chart-tooltip-text'
  | '--point-radius',
  {
    'begin-at-zero'?: LyraChart['beginAtZero'];
    'data-labels'?: LyraChart['dataLabels'];
    'data-table-toggle'?: LyraChart['dataTableToggle'];
    'index-axis'?: LyraChart['indexAxis'];
    'legend-position'?: LyraChart['legendPosition'];
    'scale-type'?: LyraChart['scaleType'];
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

export type LyraChatComposerVueProps = LyraVueCustomElement<
  LyraChatComposer,
  | 'accessibleLabel'
  | 'autocapitalize'
  | 'autocomplete'
  | 'autocorrect'
  | 'customError'
  | 'defaultValue'
  | 'disabled'
  | 'enterKeyHint'
  | 'form'
  | 'frame'
  | 'inputMode'
  | 'locale'
  | 'maxLength'
  | 'maxRows'
  | 'minLength'
  | 'minRows'
  | 'name'
  | 'placeholder'
  | 'readOnly'
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
  {
    form: HTMLFormElement | string | null;
  },
  LyraChatComposerEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-change'
  | 'lr-input'
  | 'lr-invalid'
  | 'lr-stop'
  | 'lr-submit',
  | '--lr-chat-composer-busy-bg',
  {
    'aria-label'?: LyraChatComposer['accessibleLabel'];
    'custom-error'?: LyraChatComposer['customError'];
    'enterkeyhint'?: LyraChatComposer['enterKeyHint'];
    'inputmode'?: LyraChatComposer['inputMode'];
    'max-rows'?: LyraChatComposer['maxRows'];
    'maxlength'?: LyraChatComposer['maxLength'];
    'min-rows'?: LyraChatComposer['minRows'];
    'minlength'?: LyraChatComposer['minLength'];
    'readonly'?: LyraChatComposer['readOnly'];
    'submit-disabled'?: LyraChatComposer['submitDisabled'];
    'submit-on-enter'?: LyraChatComposer['submitOnEnter'];
    'value'?: LyraChatComposer['defaultValue'];
  }
>;

export type LyraChatMessageVueProps = LyraVueCustomElement<
  LyraChatMessage,
  | 'actionsPosition'
  | 'attachmentsPosition'
  | 'collapsed'
  | 'collapsible'
  | 'formatTimestamp'
  | 'locale'
  | 'messageId'
  | 'messageRole'
  | 'status'
  | 'strings'
  | 'timestamp',
  {},
  LyraChatMessageEventMap,
  | 'lr-message-retry'
  | 'lr-toggle'
  | 'lr-toggle-request',
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
    'actions-position'?: LyraChatMessage['actionsPosition'];
    'attachments-position'?: LyraChatMessage['attachmentsPosition'];
    'message-id'?: LyraChatMessage['messageId'];
    'message-role'?: LyraChatMessage['messageRole'];
  }
>;

export type LyraChatViewportVueProps = LyraVueCustomElement<
  LyraChatViewport,
  | 'accessibleLabel'
  | 'bottomThreshold'
  | 'follow'
  | 'label'
  | 'live'
  | 'locale'
  | 'strings'
  | 'unreadStartIndex',
  {},
  LyraChatViewportEventMap,
  | 'lr-follow-change',
never,
  {
    'aria-label'?: LyraChatViewport['accessibleLabel'];
    'bottom-threshold'?: LyraChatViewport['bottomThreshold'];
    'unread-start-index'?: LyraChatViewport['unreadStartIndex'];
  }
>;

export type LyraCheckboxVueProps = LyraVueCustomElement<
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
  {
    form: HTMLFormElement | string | null;
  },
  LyraCheckboxEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-change'
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
    'error-text'?: LyraCheckbox['errorText'];
    'help-text'?: LyraCheckbox['helpText'];
  }
>;

export type LyraCheckboxGroupVueProps = LyraVueCustomElement<
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
  {
    form: HTMLFormElement | string | null;
  },
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

export type LyraCheckpointVueProps = LyraVueCustomElement<
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
  {},
  LyraCheckpointEventMap,
  | 'lr-restore',
  | '--lr-checkpoint-spin-duration',
  {
    'checkpoint-id'?: LyraCheckpoint['checkpointId'];
    'confirm-restore'?: LyraCheckpoint['confirmRestore'];
  }
>;

export type LyraChipVueProps = LyraVueCustomElement<
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
  {},
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

export type LyraChipGroupVueProps = LyraVueCustomElement<
  LyraChipGroup,
  | 'accessibleLabel'
  | 'locale'
  | 'maxVisible'
  | 'strings',
  {},
  LyraChipGroupEventMap,
  | 'lr-overflow-toggle',
  | '--lr-chip-group-overflow-expanded-border-style'
  | '--lr-chip-group-overflow-expanded-color',
  {
    'aria-label'?: LyraChipGroup['accessibleLabel'];
    'max-visible'?: LyraChipGroup['maxVisible'];
  }
>;

export type LyraChunkInspectorVueProps = LyraVueCustomElement<
  LyraChunkInspector,
  | 'activeChunkId'
  | 'chunks'
  | 'compact'
  | 'label'
  | 'locale'
  | 'sort'
  | 'strings'
  | 'thresholds'
  | 'virtualizeAt',
  {},
  LyraChunkInspectorEventMap,
  | 'lr-chunk-open'
  | 'lr-expand',
  | '--lr-chunk-inspector-current-bg'
  | '--lr-chunk-inspector-current-color',
  {
    'active-chunk-id'?: LyraChunkInspector['activeChunkId'];
    'virtualize-at'?: LyraChunkInspector['virtualizeAt'];
  }
>;

export type LyraCitationBadgeVueProps = LyraVueCustomElement<
  LyraCitationBadge,
  | 'href'
  | 'index'
  | 'label'
  | 'locale'
  | 'sourceId'
  | 'status'
  | 'strings',
  {},
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

export type LyraClaimEvidenceVueProps = LyraVueCustomElement<
  LyraClaimEvidence,
  | 'citations'
  | 'claims'
  | 'compact'
  | 'frame'
  | 'label'
  | 'locale'
  | 'selectedClaimId'
  | 'strings',
  {},
  LyraClaimEvidenceEventMap,
  | 'lr-citation-select'
  | 'lr-claim-select',
  | '--lr-claim-evidence-compact-gap'
  | '--lr-claim-evidence-compact-padding',
  {
    'selected-claim-id'?: LyraClaimEvidence['selectedClaimId'];
  }
>;

export type LyraCodeBlockVueProps = LyraVueCustomElement<
  LyraCodeBlock,
  | 'accessibleLabel'
  | 'activatableLines'
  | 'activeHighlightId'
  | 'code'
  | 'collapsed'
  | 'collapsible'
  | 'copyable'
  | 'filename'
  | 'highlightLines'
  | 'highlights'
  | 'language'
  | 'languages'
  | 'lineNumbers'
  | 'locale'
  | 'maxHeight'
  | 'strings',
  {},
  LyraCodeBlockEventMap,
  | 'lr-copy'
  | 'lr-copy-error'
  | 'lr-error'
  | 'lr-line-activate'
  | 'lr-text-select'
  | 'lr-toggle'
  | 'lr-toggle-request',
  | '--lr-code-block-active-line-outline-color'
  | '--lr-code-block-font'
  | '--lr-code-block-highlighted-line-bg'
  | '--lr-code-block-max-height'
  | '--lr-code-block-tab-size',
  {
    'activatable-lines'?: LyraCodeBlock['activatableLines'];
    'active-highlight-id'?: LyraCodeBlock['activeHighlightId'];
    'aria-label'?: LyraCodeBlock['accessibleLabel'];
    'highlight-lines'?: LyraCodeBlock['highlightLines'];
    'line-numbers'?: LyraCodeBlock['lineNumbers'];
    'max-height'?: LyraCodeBlock['maxHeight'];
  }
>;

export type LyraCodeBlockCoreVueProps = LyraVueCustomElement<
  LyraCodeBlockCore,
  | 'accessibleLabel'
  | 'activatableLines'
  | 'activeHighlightId'
  | 'code'
  | 'collapsed'
  | 'collapsible'
  | 'copyable'
  | 'filename'
  | 'highlightLines'
  | 'highlights'
  | 'language'
  | 'languages'
  | 'lineNumbers'
  | 'locale'
  | 'maxHeight'
  | 'strings',
  {},
  LyraCodeBlockCoreEventMap,
  | 'lr-copy'
  | 'lr-copy-error'
  | 'lr-error'
  | 'lr-line-activate'
  | 'lr-text-select'
  | 'lr-toggle'
  | 'lr-toggle-request',
  | '--lr-code-block-active-line-outline-color'
  | '--lr-code-block-font'
  | '--lr-code-block-highlighted-line-bg'
  | '--lr-code-block-max-height'
  | '--lr-code-block-tab-size',
  {
    'activatable-lines'?: LyraCodeBlockCore['activatableLines'];
    'active-highlight-id'?: LyraCodeBlockCore['activeHighlightId'];
    'aria-label'?: LyraCodeBlockCore['accessibleLabel'];
    'highlight-lines'?: LyraCodeBlockCore['highlightLines'];
    'line-numbers'?: LyraCodeBlockCore['lineNumbers'];
    'max-height'?: LyraCodeBlockCore['maxHeight'];
  }
>;

export type LyraCodeEditorVueProps = LyraVueCustomElement<
  LyraCodeEditor,
  | 'accessibleLabel'
  | 'autocapitalize'
  | 'autocomplete'
  | 'autocorrect'
  | 'autofocus'
  | 'cols'
  | 'customError'
  | 'defaultValue'
  | 'disabled'
  | 'enterkeyhint'
  | 'enterKeyHint'
  | 'errorText'
  | 'form'
  | 'hint'
  | 'inputmode'
  | 'inputMode'
  | 'label'
  | 'language'
  | 'lineNumbers'
  | 'locale'
  | 'maxlength'
  | 'minlength'
  | 'name'
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
  | 'tabSize'
  | 'title'
  | 'value'
  | 'wrap',
  {
    form: HTMLFormElement | string | null;
  },
  LyraCodeEditorEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-change'
  | 'lr-input'
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
    'custom-error'?: LyraCodeEditor['customError'];
    'enterkeyhint'?: LyraCodeEditor['enterKeyHint'];
    'error-text'?: LyraCodeEditor['errorText'];
    'inputmode'?: LyraCodeEditor['inputMode'];
    'line-numbers'?: LyraCodeEditor['lineNumbers'];
    'tab-size'?: LyraCodeEditor['tabSize'];
    'value'?: LyraCodeEditor['defaultValue'];
  }
>;

export type LyraColorPickerVueProps = LyraVueCustomElement<
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
  {
    form: HTMLFormElement | string | null;
  },
  LyraColorPickerEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-after-hide'
  | 'lr-after-show'
  | 'lr-change'
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
    'error-text'?: LyraColorPicker['errorText'];
    'no-format-toggle'?: LyraColorPicker['noFormatToggle'];
    'value'?: LyraColorPicker['defaultValue'];
    'with-hint'?: LyraColorPicker['withHint'];
    'with-label'?: LyraColorPicker['withLabel'];
    'without-format-toggle'?: LyraColorPicker['withoutFormatToggle'];
  }
>;

export type LyraComboboxVueProps = LyraVueCustomElement<
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
  | 'selectedRows'
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
  | 'visibleOptions'
  | 'withClear'
  | 'withHint'
  | 'withLabel',
  {
    form: HTMLFormElement | string | null;
  },
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
    'visible-options'?: LyraCombobox['visibleOptions'];
    'with-clear'?: LyraCombobox['withClear'];
    'with-hint'?: LyraCombobox['withHint'];
    'with-label'?: LyraCombobox['withLabel'];
  }
>;

export type LyraCommandPaletteVueProps = LyraVueCustomElement<
  LyraCommandPalette,
  | 'accessibleLabel'
  | 'commands'
  | 'hotkey'
  | 'locale'
  | 'open'
  | 'strings',
  {},
  LyraCommandPaletteEventMap,
  | 'blur'
  | 'focus'
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

export type LyraCommitCardVueProps = LyraVueCustomElement<
  LyraCommitCard,
  | 'author'
  | 'compact'
  | 'copyable'
  | 'files'
  | 'filesExpanded'
  | 'frame'
  | 'hash'
  | 'locale'
  | 'message'
  | 'strings'
  | 'timestamp',
  {},
  LyraCommitCardEventMap,
  | 'lr-copy'
  | 'lr-copy-error'
  | 'lr-error'
  | 'lr-file-select'
  | 'lr-toggle',
  | '--lr-commit-card-compact-padding',
  {
    'files-expanded'?: LyraCommitCard['filesExpanded'];
  }
>;

export type LyraCommunityCardVueProps = LyraVueCustomElement<
  LyraCommunityCard,
  | 'community'
  | 'compact'
  | 'frame'
  | 'locale'
  | 'maxMembers'
  | 'members'
  | 'strings',
  {},
  LyraCommunityCardEventMap,
  | 'lr-drill'
  | 'lr-entity-activate',
never,
  {
    'max-members'?: LyraCommunityCard['maxMembers'];
  }
>;

export type LyraComparePanelVueProps = LyraVueCustomElement<
  LyraComparePanel,
  | 'allowedVotes'
  | 'disabled'
  | 'itemId'
  | 'labelA'
  | 'labelB'
  | 'locale'
  | 'strings'
  | 'syncScroll'
  | 'vote',
  {},
  LyraComparePanelEventMap,
  | 'lr-vote',
  | '--lr-compare-panel-max-height'
  | '--lr-compare-panel-selected-background'
  | '--lr-compare-panel-selected-border-color'
  | '--lr-compare-panel-selected-color'
  | '--lr-compare-panel-selected-font-weight',
  {
    'item-id'?: LyraComparePanel['itemId'];
    'label-a'?: LyraComparePanel['labelA'];
    'label-b'?: LyraComparePanel['labelB'];
    'sync-scroll'?: LyraComparePanel['syncScroll'];
  }
>;

export type LyraConditionBuilderVueProps = LyraVueCustomElement<
  LyraConditionBuilder,
  | 'disabled'
  | 'fields'
  | 'locale'
  | 'strings'
  | 'value',
  {},
  LyraConditionBuilderEventMap,
  | 'lr-add-condition'
  | 'lr-input'
  | 'lr-remove-condition',
never,
  {}
>;

export type LyraConfirmBarVueProps = LyraVueCustomElement<
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
  {},
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

export type LyraContactViewerVueProps = LyraVueCustomElement<
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
  {},
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

export type LyraContextInspectorVueProps = LyraVueCustomElement<
  LyraContextInspector,
  | 'exportFilename'
  | 'exportFormats'
  | 'label'
  | 'locale'
  | 'segments'
  | 'strings'
  | 'total',
  {},
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
  | 'lr-show'
  | 'lr-toolbar-actions-change',
never,
  {
    'export-filename'?: LyraContextInspector['exportFilename'];
  }
>;

export type LyraContextMeterVueProps = LyraVueCustomElement<
  LyraContextMeter,
  | 'label'
  | 'locale'
  | 'segments'
  | 'shape'
  | 'showLegend'
  | 'strings'
  | 'total',
  {},
  {},
never,
  | '--lr-context-meter-legend-swatch-size'
  | '--lr-context-meter-segment-color',
  {
    'show-legend'?: LyraContextMeter['showLegend'];
  }
>;

export type LyraControlGroupVueProps = LyraVueCustomElement<
  LyraControlGroup,
  | 'label'
  | 'locale'
  | 'responsive'
  | 'strings',
  {},
  {},
never,
  | '--lr-control-group-gap',
  {}
>;

export type LyraConversationItemVueProps = LyraVueCustomElement<
  LyraConversationItem,
  | 'active'
  | 'autocapitalize'
  | 'autocorrect'
  | 'compact'
  | 'conversationId'
  | 'excerpt'
  | 'formatTimestamp'
  | 'label'
  | 'locale'
  | 'renamable'
  | 'spellcheck'
  | 'strings'
  | 'timestamp',
  {},
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
    'conversation-id'?: LyraConversationItem['conversationId'];
  }
>;

export type LyraCopyButtonVueProps = LyraVueCustomElement<
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
  {},
  LyraCopyButtonEventMap,
  | 'lr-copy'
  | 'lr-copy-error'
  | 'lr-error'
  | 'lr-toolbar-actions-change',
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

export type LyraCsvViewerVueProps = LyraVueCustomElement<
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
  {},
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

export type LyraDashboardGridVueProps = LyraVueCustomElement<
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
  {},
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

export type LyraDataGridVueProps = LyraVueCustomElement<
  LyraDataGrid,
  | 'appearance'
  | 'childRows'
  | 'columnOrder'
  | 'columns'
  | 'data'
  | 'dataSource'
  | 'expandedKeys'
  | 'expandedRowKeys'
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
  | 'selectedRowKeys'
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
  {},
  LyraDataGridEventMap,
  | 'blur'
  | 'focus'
  | 'lr-cell-click'
  | 'lr-cell-contextmenu'
  | 'lr-column-move'
  | 'lr-column-pin'
  | 'lr-column-resize'
  | 'lr-column-visibility-change'
  | 'lr-copy'
  | 'lr-copy-error'
  | 'lr-data-error'
  | 'lr-error'
  | 'lr-filter-change'
  | 'lr-group-collapse'
  | 'lr-group-expand'
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
  | '--lr-data-grid-cell-color'
  | '--lr-data-grid-cell-link-color'
  | '--lr-data-grid-cell-link-hover-color'
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

export type LyraDatasetViewerVueProps = LyraVueCustomElement<
  LyraDatasetViewer,
  | 'activeHighlightId'
  | 'anchor'
  | 'highlights'
  | 'locale'
  | 'maxHeight'
  | 'name'
  | 'scrollMode'
  | 'src'
  | 'strings',
  {},
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
    'scroll-mode'?: LyraDatasetViewer['scrollMode'];
  }
>;

export type LyraDateInputVueProps = LyraVueCustomElement<
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
  | 'presets'
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
  {
    form: HTMLFormElement | string | null;
  },
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
  | '--lr-date-input-action-active-bg'
  | '--lr-date-input-action-active-color'
  | '--lr-date-input-action-active-radius'
  | '--lr-date-input-action-hover-bg'
  | '--lr-date-input-action-hover-color'
  | '--lr-date-input-action-hover-radius'
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

export type LyraDatePickerVueProps = LyraVueCustomElement<
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
  | 'presets'
  | 'previousLabel'
  | 'readonly'
  | 'selection'
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
  {},
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
  | '--lr-date-picker-preset-active-bg'
  | '--lr-date-picker-preset-hover-bg'
  | '--lr-date-picker-preset-selected-bg'
  | '--lr-date-picker-radius'
  | '--lr-date-picker-range-bg'
  | '--lr-date-picker-range-color'
  | '--lr-date-picker-range-preview-bg'
  | '--lr-date-picker-selected-bg'
  | '--lr-date-picker-selected-color'
  | '--lr-date-picker-title-active-bg'
  | '--lr-date-picker-title-active-color'
  | '--lr-date-picker-title-active-radius'
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

export type LyraDetailsVueProps = LyraVueCustomElement<
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
  {},
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

export type LyraDialogVueProps = LyraVueCustomElement<
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
  {},
  LyraDialogEventMap,
  | 'lr-after-hide'
  | 'lr-after-show'
  | 'lr-close'
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
    'aria-label'?: LyraAttributeValue<string | null>;
    'heading-level'?: LyraDialog['headingLevel'];
    'light-dismiss'?: LyraDialog['lightDismiss'];
    'no-header'?: LyraDialog['noHeader'];
    'with-footer'?: LyraDialog['withFooter'];
    'without-header'?: LyraDialog['withoutHeader'];
  }
>;

export type LyraDiffViewVueProps = LyraVueCustomElement<
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
  {},
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

export type LyraDividerVueProps = LyraVueCustomElement<
  LyraDivider,
  | 'locale'
  | 'orientation'
  | 'strings'
  | 'vertical',
  {},
  {},
never,
  | '--color'
  | '--spacing'
  | '--width',
  {}
>;

export type LyraDockPanelVueProps = LyraVueCustomElement<
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
  {},
  LyraDockPanelEventMap,
  | 'lr-collapse-change'
  | 'lr-collapse-request'
  | 'lr-resize-change'
  | 'lr-resize-input'
  | 'lr-resize-request',
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

export type LyraDocumentCompareVueProps = LyraVueCustomElement<
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
  {},
  LyraDocumentCompareEventMap,
  | 'lr-copy'
  | 'lr-copy-error'
  | 'lr-download'
  | 'lr-error'
  | 'lr-highlight-activate'
  | 'lr-render-error',
  | '--lr-document-compare-pane-max-height',
  {
    'diff-layout'?: LyraDocumentCompare['diffLayout'];
    'sync-scroll'?: LyraDocumentCompare['syncScroll'];
  }
>;

export type LyraDocumentLibraryVueProps = LyraVueCustomElement<
  LyraDocumentLibrary,
  | 'documents'
  | 'filter'
  | 'label'
  | 'loading'
  | 'locale'
  | 'searchTerm'
  | 'selectedDocumentIds'
  | 'sortDir'
  | 'sortKey'
  | 'strings'
  | 'tagFilter',
  {},
  LyraDocumentLibraryEventMap,
  | 'lr-filter-change'
  | 'lr-open'
  | 'lr-selection-change'
  | 'lr-sort'
  | 'lr-sort-request',
never,
  {
    'search-term'?: LyraDocumentLibrary['searchTerm'];
    'sort-dir'?: LyraDocumentLibrary['sortDir'];
    'sort-key'?: LyraDocumentLibrary['sortKey'];
  }
>;

export type LyraDocumentPreviewVueProps = LyraVueCustomElement<
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
  {},
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

export type LyraDocumentViewerVueProps = LyraVueCustomElement<
  LyraDocumentViewer,
  | 'alt'
  | 'anchor'
  | 'highlights'
  | 'locale'
  | 'mimeType'
  | 'name'
  | 'open'
  | 'payload'
  | 'registry'
  | 'src'
  | 'strings',
  {},
  LyraDocumentViewerEventMap,
  | 'lr-anchor-result'
  | 'lr-close'
  | 'lr-download'
  | 'lr-render-error',
  | '--lr-document-viewer-max-height',
  {
    'mime-type'?: LyraDocumentViewer['mimeType'];
  }
>;

export type LyraDocxViewerVueProps = LyraVueCustomElement<
  LyraDocxViewer,
  | 'activeHighlightId'
  | 'anchor'
  | 'highlights'
  | 'locale'
  | 'maxHeight'
  | 'name'
  | 'src'
  | 'strings',
  {},
  LyraDocxViewerEventMap,
  | 'lr-anchor-result'
  | 'lr-highlight-activate'
  | 'lr-render-error'
  | 'lr-search-change'
  | 'lr-text-select'
  | 'lr-viewer-diagnostic',
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

export type LyraDoughnutChartVueProps = LyraVueCustomElement<
  LyraDoughnutChart,
  | 'annotations'
  | 'area'
  | 'beginAtZero'
  | 'chart'
  | 'config'
  | 'dataLabels'
  | 'datasets'
  | 'dataTableToggle'
  | 'description'
  | 'formatter'
  | 'grid'
  | 'height'
  | 'hiddenDatasets'
  | 'indexAxis'
  | 'label'
  | 'labels'
  | 'legendPosition'
  | 'locale'
  | 'max'
  | 'min'
  | 'plugins'
  | 'scaleType'
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
  {},
  LyraChartEventMap,
  | 'lr-before-legend-visibility-change'
  | 'lr-datum-activate'
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
  | '--lr-chart-data-table-toggle-active-bg'
  | '--lr-chart-data-table-toggle-hover-bg'
  | '--lr-chart-grid-color'
  | '--lr-chart-height'
  | '--lr-chart-legend-color'
  | '--lr-chart-legend-item-active-bg'
  | '--lr-chart-legend-item-hover-bg'
  | '--lr-chart-legend-side-max'
  | '--lr-chart-pattern-step'
  | '--lr-chart-reset-zoom-button-active-bg'
  | '--lr-chart-reset-zoom-button-hover-bg'
  | '--lr-chart-tick-color'
  | '--lr-chart-tooltip-bg'
  | '--lr-chart-tooltip-text'
  | '--point-radius',
  {
    'begin-at-zero'?: LyraDoughnutChart['beginAtZero'];
    'data-labels'?: LyraDoughnutChart['dataLabels'];
    'data-table-toggle'?: LyraDoughnutChart['dataTableToggle'];
    'index-axis'?: LyraDoughnutChart['indexAxis'];
    'legend-position'?: LyraDoughnutChart['legendPosition'];
    'scale-type'?: LyraDoughnutChart['scaleType'];
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

export type LyraDrawerVueProps = LyraVueCustomElement<
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
  {},
  LyraDialogEventMap,
  | 'lr-after-hide'
  | 'lr-after-show'
  | 'lr-close'
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
    'aria-label'?: LyraAttributeValue<string | null>;
    'heading-level'?: LyraDrawer['headingLevel'];
    'light-dismiss'?: LyraDrawer['lightDismiss'];
    'no-header'?: LyraDrawer['noHeader'];
    'with-footer'?: LyraDrawer['withFooter'];
    'without-header'?: LyraDrawer['withoutHeader'];
  }
>;

export type LyraDrilldownPanelVueProps = LyraVueCustomElement<
  LyraDrilldownPanel,
  | 'accessibleLabel'
  | 'activeCategory'
  | 'communityLabel'
  | 'locale'
  | 'path'
  | 'showFocusButton'
  | 'strings'
  | 'types',
  {},
  LyraDrilldownPanelEventMap,
  | 'lr-drilldown-category-change'
  | 'lr-drilldown-document-download'
  | 'lr-drilldown-document-highlight-activate'
  | 'lr-drilldown-document-render-error'
  | 'lr-drilldown-entity-activate'
  | 'lr-drilldown-evidence-expand'
  | 'lr-drilldown-evidence-open'
  | 'lr-drilldown-navigate',
never,
  {
    'active-category'?: LyraDrilldownPanel['activeCategory'];
    'aria-label'?: LyraDrilldownPanel['accessibleLabel'];
    'community-label'?: LyraDrilldownPanel['communityLabel'];
    'show-focus-button'?: LyraDrilldownPanel['showFocusButton'];
  }
>;

export type LyraDropdownVueProps = LyraVueCustomElement<
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
  {},
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

export type LyraDropdownItemVueProps = LyraVueCustomElement<
  LyraDropdownItem,
  | 'checked'
  | 'disabled'
  | 'loading'
  | 'locale'
  | 'size'
  | 'strings'
  | 'submenuOpen'
  | 'type'
  | 'value'
  | 'variant',
  {},
  LyraDropdownItemEventMap,
  | 'blur'
  | 'focus'
  | 'lr-menu-item-change'
  | 'lr-menu-item-state-change',
  | '--lr-menu-item-danger-active-bg'
  | '--lr-menu-item-danger-color'
  | '--lr-menu-item-danger-hover-bg'
  | '--lr-menu-item-gap'
  | '--lr-menu-item-radius'
  | '--submenu-offset',
  {
    'submenu-open'?: LyraDropdownItem['submenuOpen'];
    'submenuopen'?: LyraAttributeValue<boolean>;
  }
>;

export type LyraEbookViewerVueProps = LyraVueCustomElement<
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
  {},
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
    'aria-label'?: LyraAttributeValue<string | null>;
    'max-height'?: LyraEbookViewer['maxHeight'];
  }
>;

export type LyraEmailViewerVueProps = LyraVueCustomElement<
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
  {},
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

export type LyraEmbeddingExplorerVueProps = LyraVueCustomElement<
  LyraEmbeddingExplorer,
  | 'accessibleLabel'
  | 'height'
  | 'locale'
  | 'points'
  | 'selectedPointId'
  | 'strings',
  {},
  LyraEmbeddingExplorerEventMap,
  | 'lr-point-select',
  | '--lr-color-chart-1'
  | '--lr-color-chart-2'
  | '--lr-color-chart-3'
  | '--lr-color-chart-4'
  | '--lr-color-chart-5'
  | '--lr-color-chart-6'
  | '--lr-color-chart-7'
  | '--lr-color-chart-8'
  | '--lr-embedding-explorer-height'
  | '--lr-embedding-explorer-selected-stroke',
  {
    'aria-label'?: LyraEmbeddingExplorer['accessibleLabel'];
    'selected-point-id'?: LyraEmbeddingExplorer['selectedPointId'];
  }
>;

export type LyraEmojiPickerVueProps = LyraVueCustomElement<
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
  {
    form: HTMLFormElement | string | null;
  },
  LyraEmojiPickerEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-change'
  | 'lr-input'
  | 'lr-invalid',
  | '--lr-emoji-picker-active-bg'
  | '--lr-emoji-picker-control-gap'
  | '--lr-emoji-picker-gap'
  | '--lr-emoji-picker-glyph-size'
  | '--lr-emoji-picker-hover-bg'
  | '--lr-emoji-picker-item-radius'
  | '--lr-emoji-picker-item-size'
  | '--lr-emoji-picker-keyboard-active-bg'
  | '--lr-emoji-picker-keyboard-active-outline-color'
  | '--lr-emoji-picker-pressed-bg'
  | '--lr-emoji-picker-pressed-outline-color'
  | '--lr-emoji-picker-radius'
  | '--lr-emoji-picker-row-height'
  | '--lr-emoji-picker-search-hover-border-color'
  | '--lr-emoji-picker-selected-bg'
  | '--lr-emoji-picker-selected-color'
  | '--lr-emoji-picker-selected-outline-color'
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

export type LyraEmptyVueProps = LyraVueCustomElement<
  LyraEmpty,
  | 'compact'
  | 'description'
  | 'heading'
  | 'headingLevel'
  | 'locale'
  | 'strings',
  {},
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

export type LyraEntityCardVueProps = LyraVueCustomElement<
  LyraEntityCard,
  | 'communityLabel'
  | 'compact'
  | 'entity'
  | 'frame'
  | 'locale'
  | 'showFocusButton'
  | 'strings'
  | 'types',
  {},
  LyraEntityCardEventMap,
  | 'lr-entity-select',
  | '--lr-entity-card-compact-gap'
  | '--lr-entity-card-compact-padding',
  {
    'community-label'?: LyraEntityCard['communityLabel'];
    'show-focus-button'?: LyraEntityCard['showFocusButton'];
  }
>;

export type LyraEntityChipVueProps = LyraVueCustomElement<
  LyraEntityChip,
  | 'entityId'
  | 'locale'
  | 'strings'
  | 'text'
  | 'type'
  | 'typeLabel',
  {},
  LyraEntityChipEventMap,
  | 'lr-entity-open'
  | 'lr-entity-select',
  | '--lr-entity-chip-bg'
  | '--lr-entity-chip-border'
  | '--lr-entity-chip-color',
  {
    'entity-id'?: LyraEntityChip['entityId'];
    'type-label'?: LyraEntityChip['typeLabel'];
  }
>;

export type LyraEntityDossierVueProps = LyraVueCustomElement<
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
  {},
  LyraEntityDossierEventMap,
  | 'lr-chunk-open'
  | 'lr-drill'
  | 'lr-entity-activate'
  | 'lr-entity-open'
  | 'lr-entity-select'
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

export type LyraEnvListVueProps = LyraVueCustomElement<
  LyraEnvList,
  | 'copyable'
  | 'entries'
  | 'label'
  | 'locale'
  | 'revealable'
  | 'strings',
  {},
  LyraEnvListEventMap,
  | 'lr-copy'
  | 'lr-copy-error'
  | 'lr-error'
  | 'lr-reveal-change',
  | '--lr-env-list-reveal-active-bg'
  | '--lr-env-list-reveal-active-border',
  {}
>;

export type LyraEvalDatasetVueProps = LyraVueCustomElement<
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
  {},
  LyraEvalDatasetEventMap,
  | 'blur'
  | 'focus'
  | 'lr-example-add-request'
  | 'lr-example-remove-request'
  | 'lr-example-select'
  | 'lr-export-request'
  | 'lr-import-request'
  | 'lr-sort',
never,
  {
    'autocorrect'?: LyraEvalDataset['autoCorrect'];
    'enterkeyhint'?: LyraEvalDataset['enterKeyHint'];
    'inputmode'?: LyraEvalDataset['inputMode'];
  }
>;

export type LyraEvalResultVueProps = LyraVueCustomElement<
  LyraEvalResult,
  | 'baselineRunId'
  | 'columns'
  | 'disabled'
  | 'label'
  | 'locale'
  | 'reviewSkippable'
  | 'rubricKeys'
  | 'runs'
  | 'selectedRunId'
  | 'strings',
  {},
  LyraEvalResultEventMap,
  | 'lr-review-input'
  | 'lr-review-skip'
  | 'lr-review-submit'
  | 'lr-review-validity-change'
  | 'lr-run-activate',
never,
  {
    'baseline-run-id'?: LyraEvalResult['baselineRunId'];
    'review-skippable'?: LyraEvalResult['reviewSkippable'];
    'selected-run-id'?: LyraEvalResult['selectedRunId'];
  }
>;

export type LyraEvalRunVueProps = LyraVueCustomElement<
  LyraEvalRun,
  | 'examples'
  | 'label'
  | 'locale'
  | 'strings'
  | 'total',
  {},
  LyraEvalRunEventMap,
  | 'lr-example-citation-select'
  | 'lr-example-claim-select'
  | 'lr-example-toggle'
  | 'lr-example-tool-activate'
  | 'lr-example-tool-approval-decide'
  | 'lr-example-tool-render-error',
never,
  {}
>;

export type LyraExportButtonVueProps = LyraVueCustomElement<
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
  {},
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

export type LyraFileIconVueProps = LyraVueCustomElement<
  LyraFileIcon,
  | 'bytes'
  | 'decorative'
  | 'label'
  | 'locale'
  | 'mimeType'
  | 'mode'
  | 'name'
  | 'registry'
  | 'strings',
  {},
  {},
never,
  | '--lr-file-icon-size',
  {
    'mime-type'?: LyraFileIcon['mimeType'];
  }
>;

export type LyraFileInputVueProps = LyraVueCustomElement<
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
  | 'errorText'
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
  {
    form: HTMLFormElement | string | null;
  },
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
    'accessible-label'?: LyraFileInput['accessibleLabel'];
    'custom-error'?: LyraFileInput['customError'];
    'error-text'?: LyraFileInput['errorText'];
    'max-file-size'?: LyraFileInput['maxFileSize'];
    'rejected-message'?: LyraFileInput['rejectedMessage'];
    'with-error'?: LyraFileInput['withError'];
    'with-hint'?: LyraFileInput['withHint'];
    'with-label'?: LyraFileInput['withLabel'];
  }
>;

export type LyraFileTreeVueProps = LyraVueCustomElement<
  LyraFileTree,
  | 'label'
  | 'locale'
  | 'nodes'
  | 'selectedPath'
  | 'strings',
  {},
  LyraFileTreeEventMap,
  | 'lr-file-open'
  | 'lr-file-select'
  | 'lr-load-children',
never,
  {
    'selected-path'?: LyraFileTree['selectedPath'];
  }
>;

export type LyraFilterBarVueProps = LyraVueCustomElement<
  LyraFilterBar,
  | 'disabled'
  | 'filters'
  | 'label'
  | 'loading'
  | 'locale'
  | 'strings'
  | 'value',
  {
    filters: readonly LyraFilterBarFilterDefinition[] | null | undefined;
    value: LyraFilterBarValue | null | undefined;
  },
  LyraFilterBarEventMap,
  | 'lr-input'
  | 'lr-reset'
  | 'lr-validity-change',
never,
  {}
>;

export type LyraFlagVueProps = LyraVueCustomElement<
  LyraFlag,
  | 'country'
  | 'fallback'
  | 'fidelity'
  | 'label'
  | 'language'
  | 'locale'
  | 'shape'
  | 'src'
  | 'strings',
  {},
  {},
never,
  | '--lr-flag-aspect-ratio'
  | '--lr-flag-object-fit'
  | '--lr-flag-radius',
  {}
>;

export type LyraFlowCanvasVueProps = LyraVueCustomElement<
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
  {},
  LyraFlowCanvasEventMap,
  | 'lr-connect'
  | 'lr-edge-activate'
  | 'lr-layout-change'
  | 'lr-node-activate'
  | 'lr-node-add'
  | 'lr-node-move'
  | 'lr-selection-change'
  | 'lr-selection-delete'
  | 'lr-viewport-change',
  | '--lr-canvas-reserved-height'
  | '--lr-flow-canvas-drop-active-outline-color'
  | '--lr-flow-canvas-edge-brand-color'
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

export type LyraFlowControlsVueProps = LyraVueCustomElement<
  LyraFlowControls,
  | 'for'
  | 'frame'
  | 'hideLock'
  | 'locale'
  | 'orientation'
  | 'strings',
  {},
  {},
never,
  | '--lr-flow-controls-lock-active-color',
  {
    'hide-lock'?: LyraFlowControls['hideLock'];
  }
>;

export type LyraFlowMinimapVueProps = LyraVueCustomElement<
  LyraFlowMinimap,
  | 'for'
  | 'label'
  | 'locale'
  | 'strings',
  {},
  {},
never,
  | '--lr-flow-minimap-block-size'
  | '--lr-flow-minimap-inline-size'
  | '--lr-flow-minimap-viewport-min-size'
  | '--lr-flow-status-color'
  | '--lr-flow-status-denied-color'
  | '--lr-flow-status-error-color'
  | '--lr-flow-status-pending-color'
  | '--lr-flow-status-running-color'
  | '--lr-flow-status-success-color',
  {}
>;

export type LyraFlowNodeVueProps = LyraVueCustomElement<
  LyraFlowNode,
  | 'compact'
  | 'durationMs'
  | 'flowType'
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
  {},
never,
  | '--lr-flow-node-compact-gap'
  | '--lr-flow-node-compact-padding'
  | '--lr-flow-node-min-inline-size'
  | '--lr-flow-node-progress-fill-color'
  | '--lr-flow-node-progress-track-color'
  | '--lr-flow-node-running-border'
  | '--lr-flow-node-running-glow'
  | '--lr-flow-node-selected-outline-color'
  | '--lr-flow-status-color'
  | '--lr-flow-status-denied-color'
  | '--lr-flow-status-error-color'
  | '--lr-flow-status-pending-color'
  | '--lr-flow-status-running-color'
  | '--lr-flow-status-success-color',
  {
    'data-node-type'?: LyraFlowNode['flowType'];
    'duration-ms'?: LyraFlowNode['durationMs'];
    'node-id'?: LyraFlowNode['nodeId'];
    'status-detail'?: LyraFlowNode['statusDetail'];
  }
>;

export type LyraFlowRunStatusVueProps = LyraVueCustomElement<
  LyraFlowRunStatus,
  | 'decorations'
  | 'for'
  | 'frame'
  | 'hideSummary'
  | 'label'
  | 'locale'
  | 'strings',
  {},
  {},
never,
  | '--lr-flow-status-color'
  | '--lr-flow-status-denied-color'
  | '--lr-flow-status-error-color'
  | '--lr-flow-status-pending-color'
  | '--lr-flow-status-running-color'
  | '--lr-flow-status-success-color',
  {
    'hide-summary'?: LyraFlowRunStatus['hideSummary'];
  }
>;

export type LyraFormatBytesVueProps = LyraVueCustomElement<
  LyraFormatBytes,
  | 'decimals'
  | 'display'
  | 'locale'
  | 'strings'
  | 'unit'
  | 'unitStep'
  | 'value',
  {},
  {},
never,
never,
  {
    'unit-step'?: LyraFormatBytes['unitStep'];
  }
>;

export type LyraFormatDateVueProps = LyraVueCustomElement<
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

export type LyraFormatNumberVueProps = LyraVueCustomElement<
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

export type LyraFunnelVueProps = LyraVueCustomElement<
  LyraFunnel,
  | 'comparison'
  | 'comparisonLabel'
  | 'dropoff'
  | 'label'
  | 'locale'
  | 'sharePrecision'
  | 'stages'
  | 'strings',
  {},
  {},
never,
  | '--lr-funnel-bar-color'
  | '--lr-funnel-bar-size'
  | '--lr-funnel-comparison-color'
  | '--lr-funnel-track-color',
  {
    'comparison-label'?: LyraFunnel['comparisonLabel'];
    'share-precision'?: LyraFunnel['sharePrecision'];
  }
>;

export type LyraGaugeVueProps = LyraVueCustomElement<
  LyraGauge,
  | 'label'
  | 'locale'
  | 'max'
  | 'min'
  | 'shape'
  | 'strings'
  | 'value'
  | 'valueText',
  {},
  {},
never,
  | '--lr-gauge-fill',
  {
    'value-text'?: LyraGauge['valueText'];
  }
>;

export type LyraGenerationMetricsVueProps = LyraVueCustomElement<
  LyraGenerationMetrics,
  | 'locale'
  | 'showStop'
  | 'startedAt'
  | 'status'
  | 'strings'
  | 'tokenCount'
  | 'tokensPerSecond',
  {},
  LyraGenerationMetricsEventMap,
  | 'lr-stop',
never,
  {
    'show-stop'?: LyraGenerationMetrics['showStop'];
    'started-at'?: LyraGenerationMetrics['startedAt'];
    'token-count'?: LyraGenerationMetrics['tokenCount'];
    'tokens-per-second'?: LyraGenerationMetrics['tokensPerSecond'];
  }
>;

export type LyraGeojsonViewVueProps = LyraVueCustomElement<
  LyraGeojsonView,
  | 'activeHighlightId'
  | 'anchor'
  | 'highlights'
  | 'locale'
  | 'name'
  | 'src'
  | 'strings',
  {},
  LyraGeoJsonViewerEventMap,
  | 'lr-anchor-result'
  | 'lr-render-error'
  | 'lr-search-change'
  | 'lr-text-select',
never,
  {
    'active-highlight-id'?: LyraGeojsonView['activeHighlightId'];
  }
>;

export type LyraGeoJsonViewerVueProps = LyraVueCustomElement<
  LyraGeoJsonViewer,
  | 'activeHighlightId'
  | 'anchor'
  | 'highlights'
  | 'locale'
  | 'name'
  | 'src'
  | 'strings',
  {},
  LyraGeoJsonViewerEventMap,
  | 'lr-anchor-result'
  | 'lr-render-error'
  | 'lr-search-change'
  | 'lr-text-select',
never,
  {
    'active-highlight-id'?: LyraGeoJsonViewer['activeHighlightId'];
  }
>;

export type LyraGraphVueProps = LyraVueCustomElement<
  LyraGraph,
  | 'accessibleLabel'
  | 'chargeStrength'
  | 'communities'
  | 'dimmedLinkIds'
  | 'dimmedNodeIds'
  | 'edgeLabelMinZoom'
  | 'focusNodeId'
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
  {},
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
  | '--lr-canvas-reserved-height'
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
    'focus-node-id'?: LyraGraph['focusNodeId'];
    'link-distance'?: LyraGraph['linkDistance'];
    'max-zoom'?: LyraGraph['maxZoom'];
    'min-zoom'?: LyraGraph['minZoom'];
    'selection-mode'?: LyraGraph['selectionMode'];
    'show-edge-labels'?: LyraGraph['showEdgeLabels'];
  }
>;

export type LyraGraphLegendVueProps = LyraVueCustomElement<
  LyraGraphLegend,
  | 'counts'
  | 'hiddenTypes'
  | 'interactive'
  | 'label'
  | 'locale'
  | 'strings'
  | 'types',
  {},
  LyraGraphLegendEventMap,
  | 'lr-visibility-change',
  | '--lr-graph-legend-hidden-color'
  | '--lr-graph-legend-hidden-swatch-opacity',
  {}
>;

export type LyraGraphQueryBuilderVueProps = LyraVueCustomElement<
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
  {
    form: HTMLFormElement | string | null;
  },
  LyraGraphQueryBuilderEventMap,
  | 'lr-before-query-delete'
  | 'lr-before-query-load'
  | 'lr-before-query-run'
  | 'lr-before-query-save'
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

export type LyraGroundingSummaryVueProps = LyraVueCustomElement<
  LyraGroundingSummary,
  | 'assessment'
  | 'citations'
  | 'headingLevel'
  | 'label'
  | 'locale'
  | 'showClaims'
  | 'strings'
  | 'thresholds',
  {},
  LyraGroundingSummaryEventMap,
  | 'lr-citation-select'
  | 'lr-claim-select',
never,
  {
    'heading-level'?: LyraGroundingSummary['headingLevel'];
    'show-claims'?: LyraGroundingSummary['showClaims'];
  }
>;

export type LyraHandoffDividerVueProps = LyraVueCustomElement<
  LyraHandoffDivider,
  | 'fromAgent'
  | 'label'
  | 'locale'
  | 'strings'
  | 'toAgent',
  {},
  {},
never,
never,
  {
    'from-agent'?: LyraHandoffDivider['fromAgent'];
    'to-agent'?: LyraHandoffDivider['toAgent'];
  }
>;

export type LyraHeatmapVueProps = LyraVueCustomElement<
  LyraHeatmap,
  | 'accessibleCells'
  | 'annotations'
  | 'bucketCount'
  | 'cellColor'
  | 'cellInteractive'
  | 'cellSize'
  | 'cellText'
  | 'colLabelHeight'
  | 'colLabelRotation'
  | 'colorSteps'
  | 'data'
  | 'domain'
  | 'fitToWidth'
  | 'legendStops'
  | 'locale'
  | 'maxCellSize'
  | 'midpoint'
  | 'minCellSize'
  | 'rowLabelWidth'
  | 'scale'
  | 'selectedCell'
  | 'stickyLabels'
  | 'strings'
  | 'valueLabel',
  {},
  LyraHeatmapEventMap,
  | 'lr-cell-click'
  | 'lr-matrix-geometry-change',
  | '--lr-heatmap-annotation-color'
  | '--lr-heatmap-color-steps-gradient'
  | '--lr-heatmap-focus-ring-color'
  | '--lr-heatmap-grid-max-block-size'
  | '--lr-heatmap-label-font'
  | '--lr-heatmap-no-data-fill'
  | '--lr-heatmap-scale-hi'
  | '--lr-heatmap-scale-lo'
  | '--lr-heatmap-selected-color'
  | '--lr-heatmap-sticky-label-bg'
  | '--lr-heatmap-tooltip-bg'
  | '--lr-heatmap-tooltip-text',
  {
    'accessible-cells'?: LyraHeatmap['accessibleCells'];
    'bucket-count'?: LyraHeatmap['bucketCount'];
    'cell-size'?: LyraHeatmap['cellSize'];
    'col-label-height'?: LyraHeatmap['colLabelHeight'];
    'col-label-rotation'?: LyraHeatmap['colLabelRotation'];
    'fit-to-width'?: LyraHeatmap['fitToWidth'];
    'max-cell-size'?: LyraHeatmap['maxCellSize'];
    'min-cell-size'?: LyraHeatmap['minCellSize'];
    'row-label-width'?: LyraHeatmap['rowLabelWidth'];
    'sticky-labels'?: LyraHeatmap['stickyLabels'];
    'value-label'?: LyraHeatmap['valueLabel'];
  }
>;

export type LyraHighlightLayerVueProps = LyraVueCustomElement<
  LyraHighlightLayer,
  | 'activeHighlightId'
  | 'interactive'
  | 'items'
  | 'locale'
  | 'strings',
  {},
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
    'active-highlight-id'?: LyraHighlightLayer['activeHighlightId'];
  }
>;

export type LyraHistogramVueProps = LyraVueCustomElement<
  LyraHistogram,
  | 'annotations'
  | 'area'
  | 'beginAtZero'
  | 'bins'
  | 'chart'
  | 'config'
  | 'dataLabels'
  | 'datasets'
  | 'dataTableToggle'
  | 'description'
  | 'formatter'
  | 'grid'
  | 'height'
  | 'hiddenDatasets'
  | 'indexAxis'
  | 'label'
  | 'labels'
  | 'legendPosition'
  | 'locale'
  | 'max'
  | 'min'
  | 'plugins'
  | 'scaleType'
  | 'seriesLabel'
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
  {},
  LyraChartEventMap,
  | 'lr-before-legend-visibility-change'
  | 'lr-datum-activate'
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
  | '--lr-chart-data-table-toggle-active-bg'
  | '--lr-chart-data-table-toggle-hover-bg'
  | '--lr-chart-grid-color'
  | '--lr-chart-height'
  | '--lr-chart-legend-color'
  | '--lr-chart-legend-item-active-bg'
  | '--lr-chart-legend-item-hover-bg'
  | '--lr-chart-legend-side-max'
  | '--lr-chart-pattern-step'
  | '--lr-chart-reset-zoom-button-active-bg'
  | '--lr-chart-reset-zoom-button-hover-bg'
  | '--lr-chart-tick-color'
  | '--lr-chart-tooltip-bg'
  | '--lr-chart-tooltip-text'
  | '--point-radius',
  {
    'begin-at-zero'?: LyraHistogram['beginAtZero'];
    'data-labels'?: LyraHistogram['dataLabels'];
    'data-table-toggle'?: LyraHistogram['dataTableToggle'];
    'index-axis'?: LyraHistogram['indexAxis'];
    'legend-position'?: LyraHistogram['legendPosition'];
    'scale-type'?: LyraHistogram['scaleType'];
    'series-label'?: LyraHistogram['seriesLabel'];
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

export type LyraHtmlViewerVueProps = LyraVueCustomElement<
  LyraHtmlViewer,
  | 'activeHighlightId'
  | 'anchor'
  | 'highlights'
  | 'locale'
  | 'maxHeight'
  | 'name'
  | 'src'
  | 'strings',
  {},
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

export type LyraIconVueProps = LyraVueCustomElement<
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
  {
    name: string | undefined;
    src: string | undefined;
  },
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

export type LyraIconButtonVueProps = LyraVueCustomElement<
  LyraIconButton,
  | 'accessibleLabel'
  | 'disabled'
  | 'download'
  | 'href'
  | 'icon'
  | 'label'
  | 'library'
  | 'locale'
  | 'name'
  | 'src'
  | 'strings'
  | 'target',
  {
    name: string | undefined;
  },
  LyraIconButtonEventMap,
  | 'blur'
  | 'focus',
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
    'aria-controls'?: LyraAttributeValue<string | null>;
    'aria-describedby'?: LyraAttributeValue<string | null>;
    'aria-expanded'?: LyraAttributeValue<string | null>;
    'aria-haspopup'?: LyraAttributeValue<string | null>;
    'aria-label'?: LyraIconButton['accessibleLabel'];
  }
>;

export type LyraImageComparerVueProps = LyraVueCustomElement<
  LyraImageComparer,
  | 'accessibleLabel'
  | 'afterLabel'
  | 'beforeLabel'
  | 'locale'
  | 'orientation'
  | 'position'
  | 'strings',
  {},
  LyraImageComparerEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input',
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

export type LyraImageViewerVueProps = LyraVueCustomElement<
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
  {},
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

export type LyraIncludeVueProps = LyraVueCustomElement<
  LyraInclude,
  | 'activeHighlightId'
  | 'anchor'
  | 'cache'
  | 'highlights'
  | 'locale'
  | 'mode'
  | 'src'
  | 'strings',
  {},
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

export type LyraIngestionQueueVueProps = LyraVueCustomElement<
  LyraIngestionQueue,
  | 'items'
  | 'label'
  | 'locale'
  | 'strings'
  | 'virtualizeAt',
  {},
  LyraIngestionQueueEventMap,
  | 'lr-cancel'
  | 'lr-retry',
  | '--lr-ingestion-queue-max-height',
  {
    'virtualize-at'?: LyraIngestionQueue['virtualizeAt'];
  }
>;

export type LyraInputVueProps = LyraVueCustomElement<
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
  {
    autocorrect: boolean | 'off' | 'on';
    form: HTMLFormElement | string | null;
  },
  LyraInputEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-change'
  | 'lr-clear'
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
  | '--lr-input-radius'
  | '--lr-input-time-picker-active-bg'
  | '--lr-input-time-picker-focus-bg'
  | '--lr-input-time-picker-focus-ring'
  | '--lr-input-time-picker-hover-bg',
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

export type LyraIntersectionObserverVueProps = LyraVueCustomElement<
  LyraIntersectionObserver,
  | 'disabled'
  | 'intersectClass'
  | 'locale'
  | 'once'
  | 'root'
  | 'rootMargin'
  | 'strings'
  | 'threshold',
  {},
  LyraIntersectionObserverEventMap,
  | 'lr-intersect'
  | 'lr-intersection',
never,
  {
    'intersect-class'?: LyraIntersectionObserver['intersectClass'];
    'root-margin'?: LyraIntersectionObserver['rootMargin'];
  }
>;

export type LyraJsonSchemaViewerVueProps = LyraVueCustomElement<
  LyraJsonSchemaViewer,
  | 'issues'
  | 'label'
  | 'locale'
  | 'maxDepth'
  | 'schema'
  | 'selectedPath'
  | 'strings',
  {},
  LyraJsonSchemaViewerEventMap,
  | 'lr-schema-select',
  | '--lr-schema-viewer-error-bg'
  | '--lr-schema-viewer-error-border'
  | '--lr-schema-viewer-info-bg'
  | '--lr-schema-viewer-info-border'
  | '--lr-schema-viewer-max-indent'
  | '--lr-schema-viewer-selected-border'
  | '--lr-schema-viewer-warning-bg'
  | '--lr-schema-viewer-warning-border',
  {
    'max-depth'?: LyraJsonSchemaViewer['maxDepth'];
    'selected-path'?: LyraJsonSchemaViewer['selectedPath'];
  }
>;

export type LyraJsonViewerVueProps = LyraVueCustomElement<
  LyraJsonViewer,
  | 'collapsedDepth'
  | 'copyable'
  | 'data'
  | 'locale'
  | 'maxHeight'
  | 'search'
  | 'strings',
  {},
  LyraJsonViewerEventMap,
  | 'lr-copy'
  | 'lr-copy-error'
  | 'lr-error'
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

export type LyraKbdVueProps = LyraVueCustomElement<
  LyraKbd,
  | 'keys'
  | 'locale'
  | 'platform'
  | 'strings',
  {},
  {},
never,
never,
  {}
>;

export type LyraKnowledgeBaseVueProps = LyraVueCustomElement<
  LyraKnowledgeBase,
  | 'hideCreate'
  | 'hideSummary'
  | 'label'
  | 'locale'
  | 'sources'
  | 'strings',
  {},
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

export type LyraKnowledgeBaseAdminVueProps = LyraVueCustomElement<
  LyraKnowledgeBaseAdmin,
  | 'activeTab'
  | 'hideIngestion'
  | 'ingestionItems'
  | 'label'
  | 'locale'
  | 'sources'
  | 'strings',
  {},
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

export type LyraKnowledgeGraphExplorerVueProps = LyraVueCustomElement<
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
  {},
  LyraKnowledgeGraphExplorerEventMap,
  | 'lr-community-click'
  | 'lr-hidden-types-change'
  | 'lr-link-click'
  | 'lr-node-click'
  | 'lr-node-expand'
  | 'lr-path-request'
  | 'lr-pin-change'
  | 'lr-relation-activate'
  | 'lr-search-change'
  | 'lr-selection-change',
  | '--lr-canvas-reserved-height',
  {
    'search-query'?: LyraKnowledgeGraphExplorer['searchQuery'];
    'selected-node-id'?: LyraKnowledgeGraphExplorer['selectedNodeId'];
  }
>;

export type LyraKnownDateVueProps = LyraVueCustomElement<
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
  | 'validationTarget'
  | 'value'
  | 'valueAsDate'
  | 'valueInput'
  | 'withHint'
  | 'withLabel'
  | 'yearLabel',
  {
    form: HTMLFormElement | string | null;
  },
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

export type LyraLightboxVueProps = LyraVueCustomElement<
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
  {},
  LyraLightboxEventMap,
  | 'lr-after-hide'
  | 'lr-after-show'
  | 'lr-hide'
  | 'lr-index-change'
  | 'lr-lightbox-close'
  | 'lr-show'
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

export type LyraLineChartVueProps = LyraVueCustomElement<
  LyraLineChart,
  | 'annotations'
  | 'area'
  | 'beginAtZero'
  | 'chart'
  | 'config'
  | 'dataLabels'
  | 'datasets'
  | 'dataTableToggle'
  | 'description'
  | 'formatter'
  | 'grid'
  | 'height'
  | 'hiddenDatasets'
  | 'indexAxis'
  | 'label'
  | 'labels'
  | 'legendPosition'
  | 'locale'
  | 'max'
  | 'min'
  | 'plugins'
  | 'scaleType'
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
  {},
  LyraChartEventMap,
  | 'lr-before-legend-visibility-change'
  | 'lr-datum-activate'
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
  | '--lr-chart-data-table-toggle-active-bg'
  | '--lr-chart-data-table-toggle-hover-bg'
  | '--lr-chart-grid-color'
  | '--lr-chart-height'
  | '--lr-chart-legend-color'
  | '--lr-chart-legend-item-active-bg'
  | '--lr-chart-legend-item-hover-bg'
  | '--lr-chart-legend-side-max'
  | '--lr-chart-pattern-step'
  | '--lr-chart-reset-zoom-button-active-bg'
  | '--lr-chart-reset-zoom-button-hover-bg'
  | '--lr-chart-tick-color'
  | '--lr-chart-tooltip-bg'
  | '--lr-chart-tooltip-text'
  | '--point-radius',
  {
    'begin-at-zero'?: LyraLineChart['beginAtZero'];
    'data-labels'?: LyraLineChart['dataLabels'];
    'data-table-toggle'?: LyraLineChart['dataTableToggle'];
    'index-axis'?: LyraLineChart['indexAxis'];
    'legend-position'?: LyraLineChart['legendPosition'];
    'scale-type'?: LyraLineChart['scaleType'];
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

export type LyraLiteChartVueProps = LyraVueCustomElement<
  LyraLiteChart,
  | 'accessibleLabel'
  | 'barGapRatio'
  | 'barWidth'
  | 'barX'
  | 'beginAtZero'
  | 'datasets'
  | 'dataTableToggle'
  | 'description'
  | 'formatter'
  | 'height'
  | 'label'
  | 'labels'
  | 'layout'
  | 'legend'
  | 'legendPosition'
  | 'legendText'
  | 'locale'
  | 'maxLabels'
  | 'minBarHeight'
  | 'pointText'
  | 'roundedBars'
  | 'scale'
  | 'selectedIndices'
  | 'showDataTable'
  | 'skipZero'
  | 'stacked'
  | 'strings'
  | 'tableCellFormatter'
  | 'tableTotals'
  | 'tickFormat'
  | 'type'
  | 'valueAxisGutter'
  | 'withoutValueAxis'
  | 'xLabel'
  | 'yLabel',
  {},
  LyraLiteChartEventMap,
  | 'lr-datum-activate'
  | 'lr-point-click',
  | '--lr-chart-color-1'
  | '--lr-chart-color-2'
  | '--lr-chart-color-3'
  | '--lr-chart-color-4'
  | '--lr-chart-color-5'
  | '--lr-chart-color-6'
  | '--lr-chart-color-7'
  | '--lr-chart-color-8'
  | '--lr-chart-grid-color'
  | '--lr-chart-height'
  | '--lr-chart-legend-color'
  | '--lr-chart-legend-side-max'
  | '--lr-chart-pattern-step'
  | '--lr-chart-tick-color'
  | '--lr-lite-chart-data-table-toggle-active-bg'
  | '--lr-lite-chart-data-table-toggle-hover-bg'
  | '--lr-lite-chart-selected-outline-color'
  | '--lr-lite-chart-selected-outline-width',
  {
    'accessible-label'?: LyraLiteChart['accessibleLabel'];
    'bar-gap-ratio'?: LyraLiteChart['barGapRatio'];
    'bar-width'?: LyraLiteChart['barWidth'];
    'begin-at-zero'?: LyraLiteChart['beginAtZero'];
    'data-table-toggle'?: LyraLiteChart['dataTableToggle'];
    'legend-position'?: LyraLiteChart['legendPosition'];
    'max-labels'?: LyraLiteChart['maxLabels'];
    'min-bar-height'?: LyraLiteChart['minBarHeight'];
    'rounded-bars'?: LyraLiteChart['roundedBars'];
    'show-data-table'?: LyraLiteChart['showDataTable'];
    'skip-zero'?: LyraLiteChart['skipZero'];
    'table-totals'?: LyraLiteChart['tableTotals'];
    'value-axis-gutter'?: LyraLiteChart['valueAxisGutter'];
    'without-value-axis'?: LyraLiteChart['withoutValueAxis'];
    'x-label'?: LyraLiteChart['xLabel'];
    'y-label'?: LyraLiteChart['yLabel'];
  }
>;

export type LyraLiveRegionVueProps = LyraVueCustomElement<
  LyraLiveRegion,
  | 'locale'
  | 'mode'
  | 'strings'
  | 'throttleMs',
  {},
  {},
never,
never,
  {
    'throttle-ms'?: LyraLiveRegion['throttleMs'];
  }
>;

export type LyraLocalePickerVueProps = LyraVueCustomElement<
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
  {
    form: HTMLFormElement | string | null;
  },
  LyraLocalePickerEventMap,
  | 'blur'
  | 'focus'
  | 'lr-change'
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

export type LyraMapVueProps = LyraVueCustomElement<
  LyraMap,
  | 'center'
  | 'choropleth'
  | 'dataLayers'
  | 'label'
  | 'legend'
  | 'legendGradient'
  | 'legendGradientHiLabel'
  | 'legendGradientLoLabel'
  | 'locale'
  | 'mapStyle'
  | 'markers'
  | 'maxBounds'
  | 'renderWorldCopies'
  | 'strings'
  | 'zoom',
  {},
  LyraMapEventMap,
  | 'lr-map-click'
  | 'lr-map-load'
  | 'lr-map-marker-activate',
  | '--lr-map-choropleth-fill-opacity'
  | '--lr-map-height'
  | '--lr-map-popup-close-button-active-bg'
  | '--lr-map-popup-close-button-active-color'
  | '--lr-map-popup-close-button-hover-bg'
  | '--lr-map-popup-close-button-hover-color',
  {
    'legend-gradient-hi-label'?: LyraMap['legendGradientHiLabel'];
    'legend-gradient-lo-label'?: LyraMap['legendGradientLoLabel'];
  }
>;

export type LyraMarkdownVueProps = LyraVueCustomElement<
  LyraMarkdown,
  | 'activeHighlightId'
  | 'anchor'
  | 'content'
  | 'gfm'
  | 'headingAnchors'
  | 'headingOffset'
  | 'highlightCode'
  | 'highlights'
  | 'htmlMode'
  | 'internalLinkPrefix'
  | 'languages'
  | 'linkTarget'
  | 'locale'
  | 'math'
  | 'streaming'
  | 'strings'
  | 'tabSize',
  {},
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
    'heading-anchors'?: LyraMarkdown['headingAnchors'];
    'heading-offset'?: LyraMarkdown['headingOffset'];
    'highlight-code'?: LyraMarkdown['highlightCode'];
    'html-mode'?: LyraMarkdown['htmlMode'];
    'internal-link-prefix'?: LyraMarkdown['internalLinkPrefix'];
    'link-target'?: LyraMarkdown['linkTarget'];
    'tab-size'?: LyraMarkdown['tabSize'];
  }
>;

export type LyraMarkdownCoreVueProps = LyraVueCustomElement<
  LyraMarkdownCore,
  | 'activeHighlightId'
  | 'anchor'
  | 'content'
  | 'gfm'
  | 'headingAnchors'
  | 'headingOffset'
  | 'highlightCode'
  | 'highlights'
  | 'htmlMode'
  | 'internalLinkPrefix'
  | 'languages'
  | 'linkTarget'
  | 'locale'
  | 'math'
  | 'streaming'
  | 'strings'
  | 'tabSize',
  {},
  LyraMarkdownCoreEventMap,
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
    'active-highlight-id'?: LyraMarkdownCore['activeHighlightId'];
    'heading-anchors'?: LyraMarkdownCore['headingAnchors'];
    'heading-offset'?: LyraMarkdownCore['headingOffset'];
    'highlight-code'?: LyraMarkdownCore['highlightCode'];
    'html-mode'?: LyraMarkdownCore['htmlMode'];
    'internal-link-prefix'?: LyraMarkdownCore['internalLinkPrefix'];
    'link-target'?: LyraMarkdownCore['linkTarget'];
    'tab-size'?: LyraMarkdownCore['tabSize'];
  }
>;

export type LyraMcpAppVueProps = LyraVueCustomElement<
  LyraMcpApp,
  | 'accessibleLabel'
  | 'height'
  | 'label'
  | 'locale'
  | 'maxHeight'
  | 'resource'
  | 'strings',
  {},
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

export type LyraMediaCardVueProps = LyraVueCustomElement<
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
  {},
  LyraMediaCardEventMap,
  | 'blur'
  | 'focus'
  | 'lr-before-media-download'
  | 'lr-media-open',
  | '--lr-media-card-active-bg'
  | '--lr-media-card-active-border-color'
  | '--lr-media-card-max-height',
  {
    'aria-label'?: LyraMediaCard['accessibleLabel'];
    'max-height'?: LyraMediaCard['maxHeight'];
    'mime-type'?: LyraMediaCard['mimeType'];
  }
>;

export type LyraMemoryPanelVueProps = LyraVueCustomElement<
  LyraMemoryPanel,
  | 'label'
  | 'locale'
  | 'longTerm'
  | 'shortTerm'
  | 'strings'
  | 'thresholds'
  | 'types',
  {},
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

export type LyraMentionPopoverVueProps = LyraVueCustomElement<
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
  {},
  LyraMentionPopoverEventMap,
  | 'lr-mention-close'
  | 'lr-mention-select',
  | '--lr-mention-popover-option-active-bg',
  {
    'empty-text'?: LyraMentionPopover['emptyText'];
  }
>;

export type LyraMenuVueProps = LyraVueCustomElement<
  LyraMenu,
  | 'dropdownOpen'
  | 'label'
  | 'locale'
  | 'strings',
  {},
  LyraMenuEventMap,
  | 'lr-select',
never,
  {}
>;

export type LyraMenuItemVueProps = LyraVueCustomElement<
  LyraMenuItem,
  | 'checked'
  | 'disabled'
  | 'loading'
  | 'locale'
  | 'size'
  | 'strings'
  | 'submenuOpen'
  | 'type'
  | 'value'
  | 'variant',
  {},
  LyraMenuItemEventMap,
  | 'lr-menu-item-change'
  | 'lr-menu-item-state-change',
  | '--lr-menu-item-danger-active-bg'
  | '--lr-menu-item-danger-color'
  | '--lr-menu-item-danger-hover-bg'
  | '--lr-menu-item-gap'
  | '--lr-menu-item-radius'
  | '--submenu-offset',
  {}
>;

export type LyraMenuLabelVueProps = LyraVueCustomElement<
  LyraMenuLabel,
  | 'locale'
  | 'role'
  | 'strings',
  {},
  {},
never,
never,
  {}
>;

export type LyraMessageActionsVueProps = LyraVueCustomElement<
  LyraMessageActions,
  | 'accessibleLabel'
  | 'controls'
  | 'copyText'
  | 'feedbackRating'
  | 'label'
  | 'locale'
  | 'revealOnInteraction'
  | 'strings',
  {},
  LyraMessageActionsEventMap,
  | 'lr-copy'
  | 'lr-copy-error'
  | 'lr-edit'
  | 'lr-error'
  | 'lr-feedback-change'
  | 'lr-feedback-submit'
  | 'lr-regenerate',
never,
  {
    'aria-label'?: LyraMessageActions['accessibleLabel'];
    'copy-text'?: LyraMessageActions['copyText'];
    'feedback-rating'?: LyraMessageActions['feedbackRating'];
    'reveal-on-interaction'?: LyraMessageActions['revealOnInteraction'];
  }
>;

export type LyraMessageFeedbackVueProps = LyraVueCustomElement<
  LyraMessageFeedback,
  | 'detail'
  | 'detailFor'
  | 'disabled'
  | 'locale'
  | 'pending'
  | 'rating'
  | 'strings',
  {},
  LyraMessageFeedbackEventMap,
  | 'blur'
  | 'focus'
  | 'lr-feedback-change'
  | 'lr-feedback-submit'
  | 'lr-toolbar-actions-change',
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

export type LyraMessagePartsVueProps = LyraVueCustomElement<
  LyraMessageParts,
  | 'accessibleLabel'
  | 'contentMode'
  | 'locale'
  | 'parts'
  | 'renderPart'
  | 'showReasoning'
  | 'strings',
  {},
  LyraMessagePartsEventMap,
  | 'lr-anchor-result'
  | 'lr-citation-open'
  | 'lr-citation-select'
  | 'lr-copy'
  | 'lr-highlight-activate'
  | 'lr-link-click'
  | 'lr-part-retry'
  | 'lr-preview-request'
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
    'content-mode'?: LyraMessageParts['contentMode'];
    'show-reasoning'?: LyraMessageParts['showReasoning'];
  }
>;

export type LyraMindMapVueProps = LyraVueCustomElement<
  LyraMindMap,
  | 'expandDepth'
  | 'label'
  | 'locale'
  | 'strings'
  | 'topics',
  {},
  LyraMindMapEventMap,
  | 'lr-topic-select'
  | 'lr-topic-toggle',
  | '--lr-mind-map-node-hover-halo'
  | '--lr-mind-map-ring-gap',
  {
    'expand-depth'?: LyraMindMap['expandDepth'];
  }
>;

export type LyraModelSelectVueProps = LyraVueCustomElement<
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
  {
    form: HTMLFormElement | string | null;
  },
  LyraModelSelectEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-change'
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

export type LyraModelSettingsPanelVueProps = LyraVueCustomElement<
  LyraModelSettingsPanel,
  | 'allowCustom'
  | 'catalog'
  | 'disabled'
  | 'layout'
  | 'locale'
  | 'model'
  | 'provider'
  | 'strings'
  | 'temperature'
  | 'temperatureMax'
  | 'temperatureMin'
  | 'temperatureStep',
  {},
  LyraModelSettingsPanelEventMap,
  | 'lr-change',
never,
  {
    'allow-custom'?: LyraModelSettingsPanel['allowCustom'];
    'temperature-max'?: LyraModelSettingsPanel['temperatureMax'];
    'temperature-min'?: LyraModelSettingsPanel['temperatureMin'];
    'temperature-step'?: LyraModelSettingsPanel['temperatureStep'];
  }
>;

export type LyraMultiSplitVueProps = LyraVueCustomElement<
  LyraMultiSplit,
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
  {},
  LyraMultiSplitEventMap,
  | 'lr-multi-split-collapse-change'
  | 'lr-multi-split-constraints-invalid'
  | 'lr-multi-split-orientation-change'
  | 'lr-resize'
  | 'lr-resize-request',
  | '--lr-multi-split-divider-target-size'
  | '--lr-multi-split-overlay-color',
  {
    'collapse-breakpoint-basis'?: LyraMultiSplit['collapseBreakpointBasis'];
    'collapse-state'?: LyraMultiSplit['collapseState'];
    'float-breakpoint'?: LyraMultiSplit['floatBreakpoint'];
    'narrow-orientation'?: LyraMultiSplit['narrowOrientation'];
    'orientation-breakpoint'?: LyraMultiSplit['orientationBreakpoint'];
    'orientation-breakpoint-basis'?: LyraMultiSplit['orientationBreakpointBasis'];
    'rail-breakpoint'?: LyraMultiSplit['railBreakpoint'];
    'rail-width'?: LyraMultiSplit['railWidth'];
    'storage-key'?: LyraMultiSplit['storageKey'];
  }
>;

export type LyraMutationObserverVueProps = LyraVueCustomElement<
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
  {},
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

export type LyraNativeTimeInputVueProps = LyraVueCustomElement<
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
  {
    autocorrect: boolean | 'off' | 'on';
    form: HTMLFormElement | string | null;
  },
  LyraInputEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-change'
  | 'lr-clear'
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
  | '--lr-input-radius'
  | '--lr-input-time-picker-active-bg'
  | '--lr-input-time-picker-focus-bg'
  | '--lr-input-time-picker-focus-ring'
  | '--lr-input-time-picker-hover-bg',
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

export type LyraNeighborListVueProps = LyraVueCustomElement<
  LyraNeighborList,
  | 'expandable'
  | 'groupByRelation'
  | 'label'
  | 'locale'
  | 'rows'
  | 'strings'
  | 'virtualizeAt',
  {},
  LyraNeighborListEventMap,
  | 'lr-entity-select'
  | 'lr-node-expand',
never,
  {
    'group-by-relation'?: LyraNeighborList['groupByRelation'];
    'virtualize-at'?: LyraNeighborList['virtualizeAt'];
  }
>;

export type LyraNodePaletteVueProps = LyraVueCustomElement<
  LyraNodePalette,
  | 'accessibleLabel'
  | 'items'
  | 'label'
  | 'locale'
  | 'reorderable'
  | 'strings',
  {},
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

export type LyraNotebookViewerVueProps = LyraVueCustomElement<
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
  {},
  LyraNotebookViewerEventMap,
  | 'lr-anchor-result'
  | 'lr-load'
  | 'lr-render-error'
  | 'lr-search-change',
  | '--lr-notebook-viewer-active-bg'
  | '--lr-notebook-viewer-highlight-accent-background'
  | '--lr-notebook-viewer-highlight-active-outline'
  | '--lr-notebook-viewer-highlight-danger-background'
  | '--lr-notebook-viewer-highlight-neutral-background'
  | '--lr-notebook-viewer-highlight-success-background'
  | '--lr-notebook-viewer-highlight-warning-background'
  | '--lr-notebook-viewer-max-height',
  {
    'active-highlight-id'?: LyraNotebookViewer['activeHighlightId'];
    'max-height'?: LyraNotebookViewer['maxHeight'];
    'output-collapse-lines'?: LyraNotebookViewer['outputCollapseLines'];
  }
>;

export type LyraNumberInputVueProps = LyraVueCustomElement<
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
  {
    autocorrect: boolean | 'off' | 'on';
    form: HTMLFormElement | string | null;
  },
  LyraNumberInputEventMap,
  | 'beforeinput'
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-change'
  | 'lr-clear'
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
  | '--lr-input-radius'
  | '--lr-input-time-picker-active-bg'
  | '--lr-input-time-picker-focus-bg'
  | '--lr-input-time-picker-focus-ring'
  | '--lr-input-time-picker-hover-bg',
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

export type LyraOptionVueProps = LyraVueCustomElement<
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
  {},
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

export type LyraOtpInputVueProps = LyraVueCustomElement<
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
  {
    form: HTMLFormElement | string | null;
  },
  LyraOtpInputEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-clear'
  | 'lr-complete'
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

export type LyraPageVueProps = LyraVueCustomElement<
  LyraPage,
  | 'disableNavigationToggle'
  | 'locale'
  | 'mobileBreakpoint'
  | 'navigationPlacement'
  | 'navOpen'
  | 'strings'
  | 'view',
  {},
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
    'aria-label'?: LyraAttributeValue<string | null>;
    'disable-navigation-toggle'?: LyraPage['disableNavigationToggle'];
    'disable-sticky'?: LyraAttributeValue<string>;
    'id'?: LyraAttributeValue<string | null>;
    'mobile-breakpoint'?: LyraPage['mobileBreakpoint'];
    'nav-open'?: LyraPage['navOpen'];
    'navigation-placement'?: LyraPage['navigationPlacement'];
    'tabindex'?: LyraAttributeValue<string | null>;
  }
>;

export type LyraPageRailVueProps = LyraVueCustomElement<
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
  {},
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

export type LyraPaginationVueProps = LyraVueCustomElement<
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
  {},
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

export type LyraPanZoomVueProps = LyraVueCustomElement<
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
  {},
  LyraPanZoomEventMap,
  | 'blur'
  | 'focus'
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

export type LyraPathStripVueProps = LyraVueCustomElement<
  LyraPathStrip,
  | 'label'
  | 'locale'
  | 'path'
  | 'strings',
  {},
  LyraPathStripEventMap,
  | 'lr-entity-activate'
  | 'lr-relation-activate',
never,
  {}
>;

export type LyraPdfViewerVueProps = LyraVueCustomElement<
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
  | 'workerSrc'
  | 'zoom',
  {},
  LyraPdfViewerEventMap,
  | 'lr-anchor-result'
  | 'lr-highlight-activate'
  | 'lr-load'
  | 'lr-page-change'
  | 'lr-page-viewer-state-change'
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
    'worker-src'?: LyraPdfViewer['workerSrc'];
  }
>;

export type LyraPhoneInputVueProps = LyraVueCustomElement<
  LyraPhoneInput,
  | 'accessibleLabel'
  | 'adapter'
  | 'autocapitalize'
  | 'autocomplete'
  | 'autoCorrect'
  | 'autofocus'
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
  | 'readonly'
  | 'required'
  | 'selectionDirection'
  | 'selectionEnd'
  | 'selectionStart'
  | 'size'
  | 'spellcheck'
  | 'strings'
  | 'value',
  {
    form: HTMLFormElement | string | null;
  },
  LyraPhoneInputEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-change'
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

export type LyraPieChartVueProps = LyraVueCustomElement<
  LyraPieChart,
  | 'annotations'
  | 'area'
  | 'beginAtZero'
  | 'chart'
  | 'config'
  | 'dataLabels'
  | 'datasets'
  | 'dataTableToggle'
  | 'description'
  | 'formatter'
  | 'grid'
  | 'height'
  | 'hiddenDatasets'
  | 'indexAxis'
  | 'label'
  | 'labels'
  | 'legendPosition'
  | 'locale'
  | 'max'
  | 'min'
  | 'plugins'
  | 'scaleType'
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
  {},
  LyraChartEventMap,
  | 'lr-before-legend-visibility-change'
  | 'lr-datum-activate'
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
  | '--lr-chart-data-table-toggle-active-bg'
  | '--lr-chart-data-table-toggle-hover-bg'
  | '--lr-chart-grid-color'
  | '--lr-chart-height'
  | '--lr-chart-legend-color'
  | '--lr-chart-legend-item-active-bg'
  | '--lr-chart-legend-item-hover-bg'
  | '--lr-chart-legend-side-max'
  | '--lr-chart-pattern-step'
  | '--lr-chart-reset-zoom-button-active-bg'
  | '--lr-chart-reset-zoom-button-hover-bg'
  | '--lr-chart-tick-color'
  | '--lr-chart-tooltip-bg'
  | '--lr-chart-tooltip-text'
  | '--point-radius',
  {
    'begin-at-zero'?: LyraPieChart['beginAtZero'];
    'data-labels'?: LyraPieChart['dataLabels'];
    'data-table-toggle'?: LyraPieChart['dataTableToggle'];
    'index-axis'?: LyraPieChart['indexAxis'];
    'legend-position'?: LyraPieChart['legendPosition'];
    'scale-type'?: LyraPieChart['scaleType'];
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

export type LyraPolarAreaChartVueProps = LyraVueCustomElement<
  LyraPolarAreaChart,
  | 'annotations'
  | 'area'
  | 'beginAtZero'
  | 'chart'
  | 'config'
  | 'dataLabels'
  | 'datasets'
  | 'dataTableToggle'
  | 'description'
  | 'formatter'
  | 'grid'
  | 'height'
  | 'hiddenDatasets'
  | 'indexAxis'
  | 'label'
  | 'labels'
  | 'legendPosition'
  | 'locale'
  | 'max'
  | 'min'
  | 'plugins'
  | 'scaleType'
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
  {},
  LyraChartEventMap,
  | 'lr-before-legend-visibility-change'
  | 'lr-datum-activate'
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
  | '--lr-chart-data-table-toggle-active-bg'
  | '--lr-chart-data-table-toggle-hover-bg'
  | '--lr-chart-grid-color'
  | '--lr-chart-height'
  | '--lr-chart-legend-color'
  | '--lr-chart-legend-item-active-bg'
  | '--lr-chart-legend-item-hover-bg'
  | '--lr-chart-legend-side-max'
  | '--lr-chart-pattern-step'
  | '--lr-chart-reset-zoom-button-active-bg'
  | '--lr-chart-reset-zoom-button-hover-bg'
  | '--lr-chart-tick-color'
  | '--lr-chart-tooltip-bg'
  | '--lr-chart-tooltip-text'
  | '--point-radius',
  {
    'begin-at-zero'?: LyraPolarAreaChart['beginAtZero'];
    'data-labels'?: LyraPolarAreaChart['dataLabels'];
    'data-table-toggle'?: LyraPolarAreaChart['dataTableToggle'];
    'index-axis'?: LyraPolarAreaChart['indexAxis'];
    'legend-position'?: LyraPolarAreaChart['legendPosition'];
    'scale-type'?: LyraPolarAreaChart['scaleType'];
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

export type LyraPolicySummaryVueProps = LyraVueCustomElement<
  LyraPolicySummary,
  | 'decisions'
  | 'locale'
  | 'strings',
  {},
  {},
never,
  | '--lr-policy-summary-count-allow-color'
  | '--lr-policy-summary-count-deny-color'
  | '--lr-policy-summary-count-needs-review-color',
  {}
>;

export type LyraPollStatusVueProps = LyraVueCustomElement<
  LyraPollStatus,
  | 'active'
  | 'locale'
  | 'nextInMs'
  | 'paused'
  | 'strings',
  {},
  LyraPollStatusEventMap,
  | 'lr-pause-change'
  | 'lr-poll-due',
  | '--lr-poll-status-due-bg',
  {
    'next-in-ms'?: LyraPollStatus['nextInMs'];
  }
>;

export type LyraPopoverVueProps = LyraVueCustomElement<
  LyraPopover,
  | 'accessibleLabel'
  | 'anchor'
  | 'arrow'
  | 'arrowPadding'
  | 'arrowPlacement'
  | 'disabled'
  | 'distance'
  | 'for'
  | 'locale'
  | 'open'
  | 'placement'
  | 'popupRole'
  | 'skidding'
  | 'strings'
  | 'withoutArrow',
  {},
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

export type LyraPopupVueProps = LyraVueCustomElement<
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
  {},
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

export type LyraPptxViewerVueProps = LyraVueCustomElement<
  LyraPptxViewer,
  | 'activeHighlightId'
  | 'anchor'
  | 'highlights'
  | 'label'
  | 'locale'
  | 'maxHeight'
  | 'name'
  | 'page'
  | 'src'
  | 'strings',
  {},
  LyraPptxViewerEventMap,
  | 'lr-anchor-result'
  | 'lr-load'
  | 'lr-page-viewer-state-change'
  | 'lr-render-error'
  | 'lr-search-change'
  | 'lr-slide-change'
  | 'lr-text-select'
  | 'lr-viewer-diagnostic',
  | '--lr-pptx-viewer-max-height',
  {
    'active-highlight-id'?: LyraPptxViewer['activeHighlightId'];
    'max-height'?: LyraPptxViewer['maxHeight'];
  }
>;

export type LyraProgressBarVueProps = LyraVueCustomElement<
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

export type LyraProgressRingVueProps = LyraVueCustomElement<
  LyraProgressRing,
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
  {},
never,
  | '--indicator-color'
  | '--indicator-transition-duration'
  | '--indicator-width'
  | '--lr-progress-duration'
  | '--lr-progress-ring-indicator-color'
  | '--lr-progress-ring-indicator-transition-duration'
  | '--lr-progress-ring-indicator-variant-color'
  | '--lr-progress-ring-indicator-width'
  | '--lr-progress-ring-size'
  | '--lr-progress-ring-track-color'
  | '--lr-progress-ring-track-width'
  | '--size'
  | '--track-color'
  | '--track-width',
  {
    'accessible-label'?: LyraProgressRing['accessibleLabel'];
    'show-value'?: LyraProgressRing['showValue'];
  }
>;

export type LyraPromptInputVueProps = LyraVueCustomElement<
  LyraPromptInput,
  | 'accessibleLabel'
  | 'attachmentCapabilities'
  | 'attachments'
  | 'autocapitalize'
  | 'autocomplete'
  | 'autocorrect'
  | 'commandItems'
  | 'disabled'
  | 'enterKeyHint'
  | 'inputMode'
  | 'label'
  | 'locale'
  | 'maxLength'
  | 'mentionItems'
  | 'minLength'
  | 'model'
  | 'modelCatalog'
  | 'placeholder'
  | 'queue'
  | 'readOnly'
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
  {},
  LyraPromptInputEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-attachment-preview-request'
  | 'lr-attachment-remove'
  | 'lr-attachment-retry'
  | 'lr-attachments-add'
  | 'lr-audio-request'
  | 'lr-camera-request'
  | 'lr-change'
  | 'lr-input'
  | 'lr-mention-select'
  | 'lr-model-change'
  | 'lr-queue-change'
  | 'lr-send-now'
  | 'lr-sources-change'
  | 'lr-stop'
  | 'lr-submit'
  | 'lr-voice-change',
  | '--lr-prompt-input-control-width',
  {
    'aria-label'?: LyraPromptInput['accessibleLabel'];
    'enterkeyhint'?: LyraPromptInput['enterKeyHint'];
    'inputmode'?: LyraPromptInput['inputMode'];
    'maxlength'?: LyraPromptInput['maxLength'];
    'minlength'?: LyraPromptInput['minLength'];
    'readonly'?: LyraPromptInput['readOnly'];
    'submit-on-enter'?: LyraPromptInput['submitOnEnter'];
  }
>;

export type LyraPromptQueueVueProps = LyraVueCustomElement<
  LyraPromptQueue,
  | 'accessibleLabel'
  | 'disabled'
  | 'editable'
  | 'items'
  | 'label'
  | 'locale'
  | 'strings',
  {},
  LyraPromptQueueEventMap,
  | 'lr-queue-change'
  | 'lr-send-now',
never,
  {
    'aria-label'?: LyraPromptQueue['accessibleLabel'];
  }
>;

export type LyraPromptStudioVueProps = LyraVueCustomElement<
  LyraPromptStudio,
  | 'autocapitalize'
  | 'autoCorrect'
  | 'disabled'
  | 'heading'
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
  {},
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

export type LyraProvenancePanelVueProps = LyraVueCustomElement<
  LyraProvenancePanel,
  | 'label'
  | 'locale'
  | 'provenance'
  | 'strings'
  | 'thresholds'
  | 'types',
  {},
  LyraProvenancePanelEventMap,
  | 'lr-chunk-open'
  | 'lr-drill'
  | 'lr-entity-activate'
  | 'lr-entity-open'
  | 'lr-entity-select'
  | 'lr-expand'
  | 'lr-relation-activate'
  | 'lr-toggle',
  | '--lr-provenance-panel-entity-justify',
  {}
>;

export type LyraPushToTalkVueProps = LyraVueCustomElement<
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
  | 'strings'
  | 'timesliceMs',
  {},
  LyraPushToTalkEventMap,
  | 'lr-level'
  | 'lr-record-cancel'
  | 'lr-record-chunk'
  | 'lr-record-error'
  | 'lr-record-start'
  | 'lr-record-state-change'
  | 'lr-record-stop',
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

export type LyraQrCodeVueProps = LyraVueCustomElement<
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

export type LyraRadarChartVueProps = LyraVueCustomElement<
  LyraRadarChart,
  | 'annotations'
  | 'area'
  | 'beginAtZero'
  | 'chart'
  | 'config'
  | 'dataLabels'
  | 'datasets'
  | 'dataTableToggle'
  | 'description'
  | 'formatter'
  | 'grid'
  | 'height'
  | 'hiddenDatasets'
  | 'indexAxis'
  | 'label'
  | 'labels'
  | 'legendPosition'
  | 'locale'
  | 'max'
  | 'min'
  | 'plugins'
  | 'scaleType'
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
  {},
  LyraChartEventMap,
  | 'lr-before-legend-visibility-change'
  | 'lr-datum-activate'
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
  | '--lr-chart-data-table-toggle-active-bg'
  | '--lr-chart-data-table-toggle-hover-bg'
  | '--lr-chart-grid-color'
  | '--lr-chart-height'
  | '--lr-chart-legend-color'
  | '--lr-chart-legend-item-active-bg'
  | '--lr-chart-legend-item-hover-bg'
  | '--lr-chart-legend-side-max'
  | '--lr-chart-pattern-step'
  | '--lr-chart-reset-zoom-button-active-bg'
  | '--lr-chart-reset-zoom-button-hover-bg'
  | '--lr-chart-tick-color'
  | '--lr-chart-tooltip-bg'
  | '--lr-chart-tooltip-text'
  | '--point-radius',
  {
    'begin-at-zero'?: LyraRadarChart['beginAtZero'];
    'data-labels'?: LyraRadarChart['dataLabels'];
    'data-table-toggle'?: LyraRadarChart['dataTableToggle'];
    'index-axis'?: LyraRadarChart['indexAxis'];
    'legend-position'?: LyraRadarChart['legendPosition'];
    'scale-type'?: LyraRadarChart['scaleType'];
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

export type LyraRadioVueProps = LyraVueCustomElement<
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
  {
    form: HTMLFormElement | string | null;
  },
  LyraRadioEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-change'
  | 'lr-input'
  | 'lr-invalid',
  | '--checked-icon-color'
  | '--checked-icon-scale'
  | '--lr-radio-active-border-color'
  | '--lr-radio-active-ring-color'
  | '--lr-radio-button-gap'
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

export type LyraRadioButtonVueProps = LyraVueCustomElement<
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
  {
    form: HTMLFormElement | string | null;
  },
  LyraRadioEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-change'
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

export type LyraRadioGroupVueProps = LyraVueCustomElement<
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
  {
    form: HTMLFormElement | string | null;
  },
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
    'default-value'?: LyraAttributeValue<string>;
    'error-text'?: LyraRadioGroup['errorText'];
    'help-text'?: LyraRadioGroup['helpText'];
    'value'?: LyraRadioGroup['defaultValue'];
    'with-hint'?: LyraRadioGroup['withHint'];
    'with-label'?: LyraRadioGroup['withLabel'];
  }
>;

export type LyraRagAnswerVueProps = LyraVueCustomElement<
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
  {},
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

export type LyraRagEvalDashboardVueProps = LyraVueCustomElement<
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
  {},
  LyraRagEvalDashboardEventMap,
  | 'lr-metric-change'
  | 'lr-run-change'
  | 'lr-slice-change',
  | '--lr-rag-eval-dashboard-selected-border-color',
  {
    'chart-height'?: LyraRagEvalDashboard['chartHeight'];
    'metric-id'?: LyraRagEvalDashboard['metricId'];
    'show-chart'?: LyraRagEvalDashboard['showChart'];
  }
>;

export type LyraRandomContentVueProps = LyraVueCustomElement<
  LyraRandomContent,
  | 'animation'
  | 'autoplay'
  | 'autoplayInterval'
  | 'items'
  | 'locale'
  | 'mode'
  | 'paused'
  | 'strings',
  {},
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
  | '--lr-random-content-animation-translate'
  | '--lr-random-content-item-alignment'
  | '--lr-random-content-item-gap',
  {
    'autoplay-interval'?: LyraRandomContent['autoplayInterval'];
  }
>;

export type LyraRatingVueProps = LyraVueCustomElement<
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
  {
    form: HTMLFormElement | string | null;
  },
  LyraRatingEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'lr-change'
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

export type LyraRealtimeSessionVueProps = LyraVueCustomElement<
  LyraRealtimeSession,
  | 'entries'
  | 'label'
  | 'level'
  | 'locale'
  | 'muted'
  | 'sessionId'
  | 'showCapture'
  | 'state'
  | 'stream'
  | 'strings'
  | 'voiceState',
  {},
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
  | 'lr-record-state-change'
  | 'lr-record-stop',
never,
  {
    'session-id'?: LyraRealtimeSession['sessionId'];
    'show-capture'?: LyraRealtimeSession['showCapture'];
    'voice-state'?: LyraRealtimeSession['voiceState'];
  }
>;

export type LyraRelativeTimeVueProps = LyraVueCustomElement<
  LyraRelativeTime,
  | 'date'
  | 'format'
  | 'locale'
  | 'numeric'
  | 'strings'
  | 'sync'
  | 'unit',
  {},
  {},
never,
never,
  {}
>;

export type LyraReorderItemVueProps = LyraVueCustomElement<
  LyraReorderItem,
  | 'accessibleLabel'
  | 'disabled'
  | 'locale'
  | 'strings'
  | 'value',
  {},
  LyraReorderItemEventMap,
  | 'lr-move-request',
  | '--lr-reorder-item-gap'
  | '--lr-reorder-item-move-button-active-bg'
  | '--lr-reorder-item-move-button-active-color'
  | '--lr-reorder-item-move-button-hover-bg'
  | '--lr-reorder-item-move-button-hover-color',
  {
    'accessible-label'?: LyraReorderItem['accessibleLabel'];
  }
>;

export type LyraReorderListVueProps = LyraVueCustomElement<
  LyraReorderList,
  | 'disabled'
  | 'label'
  | 'locale'
  | 'strings',
  {},
  LyraReorderListEventMap,
  | 'lr-reorder',
  | '--lr-reorder-list-gap',
  {}
>;

export type LyraResizeObserverVueProps = LyraVueCustomElement<
  LyraResizeObserver,
  | 'box'
  | 'disabled'
  | 'locale'
  | 'strings',
  {},
  LyraResizeObserverEventMap,
  | 'lr-resize',
never,
  {}
>;

export type LyraResponsivePanelVueProps = LyraVueCustomElement<
  LyraResponsivePanel,
  | 'label'
  | 'locale'
  | 'mode'
  | 'open'
  | 'overlayBreakpoint'
  | 'strings'
  | 'variant',
  {},
  LyraResponsivePanelEventMap,
  | 'lr-close'
  | 'lr-mode-change',
  | '--lr-responsive-panel-overlay-color'
  | '--lr-responsive-panel-overlay-panel-bg'
  | '--lr-responsive-panel-overlay-panel-shadow'
  | '--lr-responsive-panel-sheet-max-block-size',
  {
    'aria-label'?: LyraAttributeValue<string | null>;
    'overlay-breakpoint'?: LyraResponsivePanel['overlayBreakpoint'];
  }
>;

export type LyraResultCardVueProps = LyraVueCustomElement<
  LyraResultCard,
  | 'compact'
  | 'frame'
  | 'heading'
  | 'locale'
  | 'strings'
  | 'withActions',
  {},
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

export type LyraResultFieldVueProps = LyraVueCustomElement<
  LyraResultField,
  | 'label'
  | 'locale'
  | 'strings'
  | 'value',
  {},
  {},
never,
never,
  {}
>;

export type LyraRetrievalCompareVueProps = LyraVueCustomElement<
  LyraRetrievalCompare,
  | 'label'
  | 'locale'
  | 'selectedChunkId'
  | 'sets'
  | 'strings'
  | 'topK',
  {},
  LyraRetrievalCompareEventMap,
  | 'lr-chunk-select',
  | '--lr-retrieval-compare-selected-border',
  {
    'selected-chunk-id'?: LyraRetrievalCompare['selectedChunkId'];
    'top-k'?: LyraRetrievalCompare['topK'];
  }
>;

export type LyraRetrievalResultsVueProps = LyraVueCustomElement<
  LyraRetrievalResults,
  | 'activeChunkId'
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
  | 'selectedChunkIds'
  | 'sort'
  | 'strings'
  | 'thresholds'
  | 'virtualizeAt',
  {},
  LyraRetrievalResultsEventMap,
  | 'lr-chunk-open'
  | 'lr-load-more'
  | 'lr-select',
  | '--lr-retrieval-results-selected-border',
  {
    'active-chunk-id'?: LyraRetrievalResults['activeChunkId'];
    'error-text'?: LyraRetrievalResults['errorText'];
    'has-more'?: LyraRetrievalResults['hasMore'];
    'virtualize-at'?: LyraRetrievalResults['virtualizeAt'];
  }
>;

export type LyraRetrievalSearchVueProps = LyraVueCustomElement<
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
  {},
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

export type LyraRetrievalTraceVueProps = LyraVueCustomElement<
  LyraRetrievalTrace,
  | 'activeStageId'
  | 'label'
  | 'locale'
  | 'stages'
  | 'strings',
  {},
  LyraRetrievalTraceEventMap,
  | 'lr-stage-chunk-action'
  | 'lr-stage-select'
  | 'lr-stage-toggle',
  | '--lr-retrieval-trace-active-border',
  {
    'active-stage-id'?: LyraRetrievalTrace['activeStageId'];
  }
>;

export type LyraRubricFormVueProps = LyraVueCustomElement<
  LyraRubricForm,
  | 'customError'
  | 'defaultValue'
  | 'disabled'
  | 'errorText'
  | 'form'
  | 'hasNext'
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
  {
    form: HTMLFormElement | string | null;
  },
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
    'item-id'?: LyraRubricForm['itemId'];
    'with-hint'?: LyraRubricForm['withHint'];
    'with-label'?: LyraRubricForm['withLabel'];
  }
>;

export type LyraScatterChartVueProps = LyraVueCustomElement<
  LyraScatterChart,
  | 'annotations'
  | 'area'
  | 'beginAtZero'
  | 'chart'
  | 'config'
  | 'dataLabels'
  | 'datasets'
  | 'dataTableToggle'
  | 'description'
  | 'formatter'
  | 'grid'
  | 'height'
  | 'hiddenDatasets'
  | 'indexAxis'
  | 'label'
  | 'labels'
  | 'legendPosition'
  | 'locale'
  | 'max'
  | 'min'
  | 'plugins'
  | 'scaleType'
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
  {},
  LyraChartEventMap,
  | 'lr-before-legend-visibility-change'
  | 'lr-datum-activate'
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
  | '--lr-chart-data-table-toggle-active-bg'
  | '--lr-chart-data-table-toggle-hover-bg'
  | '--lr-chart-grid-color'
  | '--lr-chart-height'
  | '--lr-chart-legend-color'
  | '--lr-chart-legend-item-active-bg'
  | '--lr-chart-legend-item-hover-bg'
  | '--lr-chart-legend-side-max'
  | '--lr-chart-pattern-step'
  | '--lr-chart-reset-zoom-button-active-bg'
  | '--lr-chart-reset-zoom-button-hover-bg'
  | '--lr-chart-tick-color'
  | '--lr-chart-tooltip-bg'
  | '--lr-chart-tooltip-text'
  | '--point-radius',
  {
    'begin-at-zero'?: LyraScatterChart['beginAtZero'];
    'data-labels'?: LyraScatterChart['dataLabels'];
    'data-table-toggle'?: LyraScatterChart['dataTableToggle'];
    'index-axis'?: LyraScatterChart['indexAxis'];
    'legend-position'?: LyraScatterChart['legendPosition'];
    'scale-type'?: LyraScatterChart['scaleType'];
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

export type LyraScrollerVueProps = LyraVueCustomElement<
  LyraScroller,
  | 'controls'
  | 'label'
  | 'locale'
  | 'orientation'
  | 'scrollStep'
  | 'strings'
  | 'withoutScrollbar'
  | 'withoutShadow',
  {},
  LyraScrollerEventMap,
  | 'lr-scroll',
  | '--lr-scroller-control-size'
  | '--lr-scroller-min-block-size'
  | '--lr-scroller-shadow-color'
  | '--lr-scroller-shadow-size'
  | '--shadow-color'
  | '--shadow-size',
  {
    'scroll-step'?: LyraScroller['scrollStep'];
    'without-scrollbar'?: LyraScroller['withoutScrollbar'];
    'without-shadow'?: LyraScroller['withoutShadow'];
  }
>;

export type LyraSegmentedVueProps = LyraVueCustomElement<
  LyraSegmented,
  | 'items'
  | 'label'
  | 'locale'
  | 'size'
  | 'strings'
  | 'value',
  {},
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

export type LyraSelectVueProps = LyraVueCustomElement<
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
  {
    form: HTMLFormElement | string | null;
  },
  LyraSelectEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-after-hide'
  | 'lr-after-show'
  | 'lr-change'
  | 'lr-clear'
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

export type LyraSelectionToolbarVueProps = LyraVueCustomElement<
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
  {},
  LyraSelectionToolbarEventMap,
  | 'lr-copy'
  | 'lr-copy-error'
  | 'lr-dismiss'
  | 'lr-error'
  | 'lr-selection-action',
  | '--lr-selection-toolbar-placement-gap',
  {
    'aria-label'?: LyraSelectionToolbar['accessibleLabel'];
  }
>;

export type LyraSequencePlaybackVueProps = LyraVueCustomElement<
  LyraSequencePlayback,
  | 'currentIndex'
  | 'hidden'
  | 'intervalMs'
  | 'itemCount'
  | 'locale'
  | 'loop'
  | 'playing'
  | 'strings',
  {},
  LyraSequencePlaybackEventMap,
  | 'blur'
  | 'focus'
  | 'lr-pause'
  | 'lr-play'
  | 'lr-sequence-step',
  | '--lr-sequence-playback-icon-size'
  | '--lr-sequence-playback-play-button-active-bg'
  | '--lr-sequence-playback-play-button-active-border-color',
  {
    'current-index'?: LyraSequencePlayback['currentIndex'];
    'interval-ms'?: LyraSequencePlayback['intervalMs'];
    'item-count'?: LyraSequencePlayback['itemCount'];
  }
>;

export type LyraSequenceStripVueProps = LyraVueCustomElement<
  LyraSequenceStrip,
  | 'accessibleLabel'
  | 'categories'
  | 'items'
  | 'locale'
  | 'markerLabel'
  | 'selectedIndex'
  | 'showLegend'
  | 'strings',
  {},
  LyraSequenceStripEventMap,
  | 'lr-item-activate',
  | '--lr-sequence-strip-height'
  | '--lr-sequence-strip-legend-marker-bg'
  | '--lr-sequence-strip-legend-swatch-size'
  | '--lr-sequence-strip-marker-color',
  {
    'accessible-label'?: LyraSequenceStrip['accessibleLabel'];
    'marker-label'?: LyraSequenceStrip['markerLabel'];
    'selected-index'?: LyraSequenceStrip['selectedIndex'];
    'show-legend'?: LyraSequenceStrip['showLegend'];
  }
>;

export type LyraSkeletonVueProps = LyraVueCustomElement<
  LyraSkeleton,
  | 'announce'
  | 'effect'
  | 'height'
  | 'label'
  | 'locale'
  | 'shape'
  | 'strings'
  | 'width',
  {},
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

export type LyraSliderVueProps = LyraVueCustomElement<
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
  {
    form: HTMLFormElement | string | null;
  },
  LyraSliderEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-change'
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

export type LyraSourceCardVueProps = LyraVueCustomElement<
  LyraSourceCard,
  | 'compact'
  | 'frame'
  | 'href'
  | 'locale'
  | 'page'
  | 'sourceId'
  | 'strings'
  | 'title',
  {},
  LyraSourceCardEventMap,
  | 'lr-expand'
  | 'lr-open',
  | '--lr-source-card-compact-gap'
  | '--lr-source-card-compact-padding',
  {
    'source-id'?: LyraSourceCard['sourceId'];
  }
>;

export type LyraSourceListVueProps = LyraVueCustomElement<
  LyraSourceList,
  | 'expanded'
  | 'label'
  | 'labelPlural'
  | 'locale'
  | 'strings',
  {},
  LyraSourceListEventMap,
  | 'lr-toggle',
never,
  {
    'label-plural'?: LyraSourceList['labelPlural'];
  }
>;

export type LyraSourcePickerVueProps = LyraVueCustomElement<
  LyraSourcePicker,
  | 'accessibleLabel'
  | 'label'
  | 'locale'
  | 'searchable'
  | 'selectedSourceIds'
  | 'showSelectAll'
  | 'sources'
  | 'strings',
  {},
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

export type LyraSpanWaterfallVueProps = LyraVueCustomElement<
  LyraSpanWaterfall,
  | 'activeSpanId'
  | 'hideAxis'
  | 'label'
  | 'locale'
  | 'spans'
  | 'strings'
  | 'viewEndMs'
  | 'viewStartMs',
  {},
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

export type LyraSparklineVueProps = LyraVueCustomElement<
  LyraSparkline,
  | 'accessibleLabel'
  | 'appearance'
  | 'curve'
  | 'data'
  | 'label'
  | 'locale'
  | 'mark'
  | 'max'
  | 'min'
  | 'strings'
  | 'trend'
  | 'values',
  {},
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

export type LyraSpinnerVueProps = LyraVueCustomElement<
  LyraSpinner,
  | 'accessibleLabel'
  | 'labelPlacement'
  | 'locale'
  | 'strings',
  {},
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

export type LyraSplitPanelVueProps = LyraVueCustomElement<
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
  {
    snap: string | LyraSplitPanelSnapFunction | undefined;
  },
  LyraSplitPanelEventMap,
  | 'lr-reposition'
  | 'lr-reposition-request',
  | '--divider-hit-area'
  | '--divider-width'
  | '--lr-split-panel-divider-active-color'
  | '--lr-split-panel-divider-hit-area'
  | '--lr-split-panel-divider-hover-color'
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

export type LyraSpreadsheetViewerVueProps = LyraVueCustomElement<
  LyraSpreadsheetViewer,
  | 'activeHighlightId'
  | 'anchor'
  | 'highlights'
  | 'locale'
  | 'maxHeight'
  | 'name'
  | 'src'
  | 'strings',
  {},
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

export type LyraStackTraceVueProps = LyraVueCustomElement<
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
  {},
  LyraStackTraceEventMap,
  | 'lr-copy'
  | 'lr-copy-error'
  | 'lr-error'
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

export type LyraStatVueProps = LyraVueCustomElement<
  LyraStat,
  | 'accessibleLabel'
  | 'caption'
  | 'compact'
  | 'deltaPercent'
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
  | 'unit'
  | 'value'
  | 'variant',
  {},
  {},
never,
  | '--lr-stat-emphasis-border-color'
  | '--lr-stat-emphasis-value-color'
  | '--lr-stat-link-active-bg'
  | '--lr-stat-link-active-border-color'
  | '--lr-stat-link-active-shadow'
  | '--lr-stat-link-hover-border-color'
  | '--lr-stat-link-hover-shadow'
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
    'delta-percent'?: LyraStat['deltaPercent'];
    'exact-value'?: LyraStat['exactValue'];
    'good-direction'?: LyraStat['goodDirection'];
  }
>;

export type LyraStepperVueProps = LyraVueCustomElement<
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
  {},
  LyraStepperEventMap,
  | 'lr-step-select'
  | 'lr-stepper-orientation-change',
  | '--lr-scroll-fade-size'
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

export type LyraStreamStatusVueProps = LyraVueCustomElement<
  LyraStreamStatus,
  | 'connectionState'
  | 'locale'
  | 'stallThresholdMs'
  | 'strings',
  {},
  LyraStreamStatusEventMap,
  | 'lr-recover'
  | 'lr-stall',
  | '--lr-stream-status-dot-color'
  | '--lr-stream-status-dot-opacity'
  | '--lr-stream-status-message-color'
  | '--lr-stream-status-stalled-bg'
  | '--lr-stream-status-stalled-border-color',
  {
    'connection-state'?: LyraStreamStatus['connectionState'];
    'stall-threshold-ms'?: LyraStreamStatus['stallThresholdMs'];
  }
>;

export type LyraStreamingTextVueProps = LyraVueCustomElement<
  LyraStreamingText,
  | 'coalesceMs'
  | 'content'
  | 'contentMode'
  | 'locale'
  | 'streaming'
  | 'strings',
  {},
  {},
never,
  | '--lr-inline-cursor-height'
  | '--lr-inline-cursor-width',
  {
    'coalesce-ms'?: LyraStreamingText['coalesceMs'];
    'content-mode'?: LyraStreamingText['contentMode'];
  }
>;

export type LyraSubagentPanelVueProps = LyraVueCustomElement<
  LyraSubagentPanel,
  | 'label'
  | 'locale'
  | 'runs'
  | 'selectedRunId'
  | 'strings',
  {},
  LyraSubagentPanelEventMap,
  | 'lr-cancel'
  | 'lr-run-activate'
  | 'lr-run-retry',
  | '--lr-subagent-panel-progress-fill'
  | '--lr-subagent-panel-progress-track'
  | '--lr-subagent-panel-selected-border',
  {
    'selected-run-id'?: LyraSubagentPanel['selectedRunId'];
  }
>;

export type LyraSuggestionChipsVueProps = LyraVueCustomElement<
  LyraSuggestionChips,
  | 'label'
  | 'locale'
  | 'strings'
  | 'suggestions'
  | 'wrap',
  {},
  LyraSuggestionChipsEventMap,
  | 'lr-suggestion-select',
  | '--lr-suggestion-chips-hover-bg'
  | '--lr-suggestion-chips-hover-border'
  | '--lr-suggestion-chips-justify',
  {}
>;

export type LyraSvgViewerVueProps = LyraVueCustomElement<
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
  {},
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

export type LyraSwatchPickerVueProps = LyraVueCustomElement<
  LyraSwatchPicker,
  | 'accessibleLabel'
  | 'disabled'
  | 'items'
  | 'locale'
  | 'mode'
  | 'size'
  | 'strings'
  | 'value',
  {},
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
  {
    'aria-label'?: LyraSwatchPicker['accessibleLabel'];
  }
>;

export type LyraSwitchVueProps = LyraVueCustomElement<
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
  {
    form: HTMLFormElement | string | null;
  },
  LyraSwitchEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-change'
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
    'error-text'?: LyraSwitch['errorText'];
    'help-text'?: LyraSwitch['helpText'];
    'with-hint'?: LyraSwitch['withHint'];
  }
>;

export type LyraTabVueProps = LyraVueCustomElement<
  LyraTab,
  | 'active'
  | 'closable'
  | 'disabled'
  | 'locale'
  | 'panel'
  | 'strings',
  {},
  LyraTabEventMap,
  | 'lr-close',
never,
  {}
>;

export type LyraTabGroupVueProps = LyraVueCustomElement<
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
  {},
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

export type LyraTabPanelVueProps = LyraVueCustomElement<
  LyraTabPanel,
  | 'active'
  | 'locale'
  | 'name'
  | 'strings',
  {},
  {},
never,
  | '--padding',
  {}
>;

export type LyraTableVueProps = LyraVueCustomElement<
  LyraTable,
  | 'accessibleLabel'
  | 'autocapitalize'
  | 'autoCorrect'
  | 'canExpand'
  | 'caption'
  | 'columns'
  | 'defaultSortDir'
  | 'emptyCompact'
  | 'emptyDescription'
  | 'emptyHeading'
  | 'expandedContent'
  | 'expandedRowKeys'
  | 'filter'
  | 'filterable'
  | 'filterLabel'
  | 'filterPlaceholder'
  | 'filterText'
  | 'grandTotal'
  | 'groupBy'
  | 'groupLabel'
  | 'hasHiddenPriorityColumns'
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
  | 'priorityColumnsVisible'
  | 'revealColumnsLabel'
  | 'rowKey'
  | 'rows'
  | 'rowTotal'
  | 'scrollMode'
  | 'selectedRowKeys'
  | 'selectionMode'
  | 'skeletonRows'
  | 'sortDir'
  | 'sortKey'
  | 'sortMode'
  | 'spellcheck'
  | 'storageKey'
  | 'strings'
  | 'totalItems',
  {},
  LyraTableEventMap,
  | 'blur'
  | 'focus'
  | 'lr-cell-edit'
  | 'lr-column-resize'
  | 'lr-filter-change'
  | 'lr-load-more'
  | 'lr-page-change'
  | 'lr-priority-columns-visibility-change'
  | 'lr-row-click'
  | 'lr-row-expand-toggle'
  | 'lr-selection-change'
  | 'lr-sort'
  | 'lr-sort-request',
  | '--lr-table-cell-color'
  | '--lr-table-cell-link-color'
  | '--lr-table-cell-link-hover-color'
  | '--lr-table-header-sorted-bg'
  | '--lr-table-header-sorted-color'
  | '--lr-table-heat-t'
  | '--lr-table-heat-tint-hi'
  | '--lr-table-heat-tint-lo'
  | '--lr-table-max-height'
  | '--lr-table-resize-handle-active-bg'
  | '--lr-table-resize-handle-active-opacity'
  | '--lr-table-resize-handle-hover-bg'
  | '--lr-table-resize-handle-hover-opacity'
  | '--lr-table-resize-handle-opacity'
  | '--lr-table-resize-min-width'
  | '--lr-table-row-selected-bg'
  | '--lr-table-row-stripe-bg'
  | '--lr-table-sticky-offset',
  {
    'accessible-label'?: LyraTable['accessibleLabel'];
    'autocorrect'?: LyraTable['autoCorrect'];
    'default-sort-dir'?: LyraTable['defaultSortDir'];
    'empty-compact'?: LyraTable['emptyCompact'];
    'empty-description'?: LyraTable['emptyDescription'];
    'empty-heading'?: LyraTable['emptyHeading'];
    'filter-label'?: LyraTable['filterLabel'];
    'filter-placeholder'?: LyraTable['filterPlaceholder'];
    'filter-text'?: LyraTable['filterText'];
    'has-hidden-priority-columns'?: LyraTable['hasHiddenPriorityColumns'];
    'has-more'?: LyraTable['hasMore'];
    'hide-columns-label'?: LyraTable['hideColumnsLabel'];
    'loading-appearance'?: LyraTable['loadingAppearance'];
    'loading-label'?: LyraTable['loadingLabel'];
    'more-label'?: LyraTable['moreLabel'];
    'no-columns-description'?: LyraTable['noColumnsDescription'];
    'no-columns-heading'?: LyraTable['noColumnsHeading'];
    'page-size'?: LyraTable['pageSize'];
    'pagination-mode'?: LyraTable['paginationMode'];
    'priority-columns-visible'?: LyraTable['priorityColumnsVisible'];
    'reveal-columns-label'?: LyraTable['revealColumnsLabel'];
    'scroll-mode'?: LyraTable['scrollMode'];
    'selection-mode'?: LyraTable['selectionMode'];
    'skeleton-rows'?: LyraTable['skeletonRows'];
    'sort-dir'?: LyraTable['sortDir'];
    'sort-key'?: LyraTable['sortKey'];
    'sort-mode'?: LyraTable['sortMode'];
    'storage-key'?: LyraTable['storageKey'];
    'total-items'?: LyraTable['totalItems'];
  }
>;

export type LyraTagVueProps = LyraVueCustomElement<
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
  {},
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

export type LyraTaskListVueProps = LyraVueCustomElement<
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
  {},
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

export type LyraTerminalVueProps = LyraVueCustomElement<
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
  {},
  LyraTerminalEventMap,
  | 'lr-copy'
  | 'lr-copy-error'
  | 'lr-download'
  | 'lr-error'
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

export type LyraTestResultsVueProps = LyraVueCustomElement<
  LyraTestResults,
  | 'autoExpandFailures'
  | 'locale'
  | 'runId'
  | 'runState'
  | 'statusFilter'
  | 'strings'
  | 'suites',
  {},
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
  | '--lr-test-results-skipped-color'
  | '--lr-test-results-spinner-size',
  {
    'auto-expand-failures'?: LyraTestResults['autoExpandFailures'];
    'run-id'?: LyraTestResults['runId'];
    'run-state'?: LyraTestResults['runState'];
  }
>;

export type LyraTextareaVueProps = LyraVueCustomElement<
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
  {
    autocorrect: boolean | string;
    form: HTMLFormElement | string | null;
  },
  LyraTextareaEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-change'
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

export type LyraThinkingPanelVueProps = LyraVueCustomElement<
  LyraThinkingPanel,
  | 'compact'
  | 'durationMs'
  | 'expanded'
  | 'follow'
  | 'frame'
  | 'label'
  | 'locale'
  | 'mode'
  | 'strings',
  {},
  LyraThinkingPanelEventMap,
  | 'lr-follow-change'
  | 'lr-toggle'
  | 'lr-toggle-request',
  | '--lr-thinking-panel-compact-body-padding'
  | '--lr-thinking-panel-compact-header-gap'
  | '--lr-thinking-panel-compact-header-padding'
  | '--lr-thinking-panel-max-block-size'
  | '--lr-thinking-panel-pending-color',
  {
    'duration-ms'?: LyraThinkingPanel['durationMs'];
  }
>;

export type LyraThreadListVueProps = LyraVueCustomElement<
  LyraThreadList,
  | 'activeConversationId'
  | 'collapsedGroupIds'
  | 'compact'
  | 'filter'
  | 'formatDate'
  | 'getGroupLabel'
  | 'groupBy'
  | 'grouping'
  | 'groupOrder'
  | 'label'
  | 'locale'
  | 'renamable'
  | 'renderActions'
  | 'renderExcerpt'
  | 'renderGroupAdornment'
  | 'renderMeta'
  | 'renderRowContent'
  | 'renderStart'
  | 'rowActions'
  | 'searchable'
  | 'showArchived'
  | 'stickyGroups'
  | 'strings'
  | 'threads'
  | 'wrapRow',
  {},
  LyraThreadListEventMap,
  | 'blur'
  | 'focus'
  | 'lr-filter-change'
  | 'lr-group-toggle'
  | 'lr-query-change'
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
    'active-conversation-id'?: LyraThreadList['activeConversationId'];
    'show-archived'?: LyraThreadList['showArchived'];
    'sticky-groups'?: LyraThreadList['stickyGroups'];
  }
>;

export type LyraTimeInputVueProps = LyraVueCustomElement<
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
  | 'valueAsDate'
  | 'valueAsNumber'
  | 'withClear'
  | 'withHint'
  | 'withLabel'
  | 'withNow',
  {
    form: HTMLFormElement | string | null;
  },
  LyraTimeInputEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-after-hide'
  | 'lr-after-show'
  | 'lr-change'
  | 'lr-clear'
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

export type LyraTimeRangeVueProps = LyraVueCustomElement<
  LyraTimeRange,
  | 'customError'
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
  {
    form: HTMLFormElement | string | null;
  },
  LyraTimeRangeEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-change'
  | 'lr-input'
  | 'lr-invalid',
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
    'custom-error'?: LyraTimeRange['customError'];
    'end-label'?: LyraTimeRange['endLabel'];
    'start-label'?: LyraTimeRange['startLabel'];
  }
>;

export type LyraTimelineVueProps = LyraVueCustomElement<
  LyraTimeline,
  | 'accessibleLabel'
  | 'collision'
  | 'locale'
  | 'orientation'
  | 'rangeEnd'
  | 'rangeStart'
  | 'scale'
  | 'strings',
  {},
  LyraTimelineEventMap,
  | 'lr-cluster-activate',
  | '--lr-scroll-fade-size'
  | '--lr-timeline-cluster-bg'
  | '--lr-timeline-cluster-color'
  | '--lr-timeline-cluster-size'
  | '--lr-timeline-collision-offset'
  | '--lr-timeline-gap'
  | '--lr-timeline-time-extent',
  {
    'aria-label'?: LyraTimeline['accessibleLabel'];
  }
>;

export type LyraTimelineItemVueProps = LyraVueCustomElement<
  LyraTimelineItem,
  | 'active'
  | 'locale'
  | 'strings'
  | 'sync'
  | 'timestamp'
  | 'variant',
  {},
  {},
never,
  | '--lr-timeline-active-ring-color'
  | '--lr-timeline-cluster-bg'
  | '--lr-timeline-cluster-color'
  | '--lr-timeline-cluster-size'
  | '--lr-timeline-marker-color'
  | '--lr-timeline-marker-size'
  | '--lr-timeline-rail-color'
  | '--lr-timeline-rail-width',
  {}
>;

export type LyraToastVueProps = LyraVueCustomElement<
  LyraToast,
  | 'locale'
  | 'placement'
  | 'strings',
  {},
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

export type LyraToastItemVueProps = LyraVueCustomElement<
  LyraToastItem,
  | 'duration'
  | 'locale'
  | 'size'
  | 'strings'
  | 'variant'
  | 'withIcon',
  {},
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

export type LyraTokenInputVueProps = LyraVueCustomElement<
  LyraTokenInput,
  | 'accessibleLabel'
  | 'allowDuplicates'
  | 'autocapitalize'
  | 'autocorrect'
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
  {
    form: HTMLFormElement | string | null;
  },
  LyraTokenInputEventMap,
  | 'blur'
  | 'change'
  | 'focus'
  | 'input'
  | 'lr-add'
  | 'lr-change'
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
    'custom-error'?: LyraTokenInput['customError'];
    'error-text'?: LyraTokenInput['errorText'];
    'value'?: LyraTokenInput['defaultValue'];
  }
>;

export type LyraToolApprovalDialogVueProps = LyraVueCustomElement<
  LyraToolApprovalDialog,
  | 'accessibleLabel'
  | 'args'
  | 'autocapitalize'
  | 'autocomplete'
  | 'autoCorrect'
  | 'editable'
  | 'enterKeyHint'
  | 'inputMode'
  | 'lightDismiss'
  | 'locale'
  | 'open'
  | 'pending'
  | 'proposalKey'
  | 'spellcheck'
  | 'strings'
  | 'toolName'
  | 'wrap',
  {},
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
    'light-dismiss'?: LyraToolApprovalDialog['lightDismiss'];
    'proposal-key'?: LyraToolApprovalDialog['proposalKey'];
    'tool-name'?: LyraToolApprovalDialog['toolName'];
  }
>;

export type LyraToolCallChipVueProps = LyraVueCustomElement<
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
  {},
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

export type LyraToolParamFormVueProps = LyraVueCustomElement<
  LyraToolParamForm,
  | 'customError'
  | 'disabled'
  | 'form'
  | 'locale'
  | 'name'
  | 'schema'
  | 'strings'
  | 'value',
  {
    form: HTMLFormElement | string | null;
  },
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

export type LyraToolResultDialogVueProps = LyraVueCustomElement<
  LyraToolResultDialog,
  | 'accessibleLabel'
  | 'durationMs'
  | 'lightDismiss'
  | 'locale'
  | 'maximized'
  | 'open'
  | 'status'
  | 'strings'
  | 'toolName',
  {},
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
    'light-dismiss'?: LyraToolResultDialog['lightDismiss'];
    'tool-name'?: LyraToolResultDialog['toolName'];
  }
>;

export type LyraToolResultViewVueProps = LyraVueCustomElement<
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
  {},
  LyraToolResultViewEventMap,
  | 'lr-render-error',
  | '--lr-tool-result-view-font',
  {
    'tool-name'?: LyraToolResultView['toolName'];
  }
>;

export type LyraToolSelectDialogVueProps = LyraVueCustomElement<
  LyraToolSelectDialog,
  | 'accessibleLabel'
  | 'autocapitalize'
  | 'autocomplete'
  | 'autoCorrect'
  | 'enterKeyHint'
  | 'filter'
  | 'inputMode'
  | 'label'
  | 'lightDismiss'
  | 'locale'
  | 'open'
  | 'searchPlaceholder'
  | 'selectedToolIds'
  | 'spellcheck'
  | 'strings'
  | 'tools'
  | 'useDefaults',
  {},
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
    'light-dismiss'?: LyraToolSelectDialog['lightDismiss'];
    'search-placeholder'?: LyraToolSelectDialog['searchPlaceholder'];
    'use-defaults'?: LyraToolSelectDialog['useDefaults'];
  }
>;

export type LyraToolTimelineVueProps = LyraVueCustomElement<
  LyraToolTimeline,
  | 'approvalEditable'
  | 'entries'
  | 'formatTimestamp'
  | 'locale'
  | 'strings',
  {},
  LyraToolTimelineEventMap,
  | 'lr-tool-activate'
  | 'lr-tool-approval-decide'
  | 'lr-tool-render-error',
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

export type LyraTooltipVueProps = LyraVueCustomElement<
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
  {},
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

export type LyraTourVueProps = LyraVueCustomElement<
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
  {},
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
    'aria-label'?: LyraAttributeValue<string | null>;
    'light-dismiss'?: LyraTour['lightDismiss'];
    'show-progress'?: LyraTour['showProgress'];
    'spotlight-padding'?: LyraTour['spotlightPadding'];
  }
>;

export type LyraTraceTreeVueProps = LyraVueCustomElement<
  LyraTraceTree,
  | 'activeSpanId'
  | 'hideBars'
  | 'label'
  | 'locale'
  | 'showCost'
  | 'showTokens'
  | 'spans'
  | 'strings',
  {},
  LyraTraceTreeEventMap,
  | 'lr-span-select'
  | 'lr-span-toggle',
  | '--lr-trace-tree-bar-track-bg'
  | '--lr-trace-tree-denied-color'
  | '--lr-trace-tree-error-color'
  | '--lr-trace-tree-max-indent'
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

export type LyraTranscriptFeedVueProps = LyraVueCustomElement<
  LyraTranscriptFeed,
  | 'accessibleLabel'
  | 'entries'
  | 'follow'
  | 'formatTimestamp'
  | 'label'
  | 'locale'
  | 'maxRenderedEntries'
  | 'sessionId'
  | 'showTimestamps'
  | 'strings',
  {},
  LyraTranscriptFeedEventMap,
  | 'lr-follow-change',
never,
  {
    'aria-label'?: LyraTranscriptFeed['accessibleLabel'];
    'max-rendered-entries'?: LyraTranscriptFeed['maxRenderedEntries'];
    'session-id'?: LyraTranscriptFeed['sessionId'];
    'show-timestamps'?: LyraTranscriptFeed['showTimestamps'];
  }
>;

export type LyraTreeVueProps = LyraVueCustomElement<
  LyraTree,
  | 'data'
  | 'label'
  | 'locale'
  | 'reorderable'
  | 'selection'
  | 'strings',
  {},
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

export type LyraTreeItemVueProps = LyraVueCustomElement<
  LyraTreeItem,
  | 'disabled'
  | 'expanded'
  | 'item'
  | 'label'
  | 'lazy'
  | 'locale'
  | 'selected'
  | 'strings',
  {},
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
  | '--indent-guide-color'
  | '--indent-guide-offset'
  | '--indent-guide-style'
  | '--indent-guide-width'
  | '--indent-size'
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

export type LyraTypingIndicatorVueProps = LyraVueCustomElement<
  LyraTypingIndicator,
  | 'label'
  | 'locale'
  | 'shape'
  | 'size'
  | 'strings',
  {},
  {},
never,
  | '--lr-inline-cursor-height'
  | '--lr-inline-cursor-width'
  | '--lr-typing-dot-size'
  | '--lr-typing-dot-stagger-1'
  | '--lr-typing-dot-stagger-2'
  | '--lr-typing-duration'
  | '--lr-typing-gap',
  {}
>;

export type LyraUsageBadgeVueProps = LyraVueCustomElement<
  LyraUsageBadge,
  | 'abbreviate'
  | 'costText'
  | 'formatLatency'
  | 'latencyMs'
  | 'locale'
  | 'strings'
  | 'summary'
  | 'tokensIn'
  | 'tokensOut',
  {},
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

export type LyraVideoVueProps = LyraVueCustomElement<
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
  {},
  LyraVideoEventMap,
  | 'blur'
  | 'ended'
  | 'error'
  | 'focus'
  | 'loadedmetadata'
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

export type LyraVideoPlaylistVueProps = LyraVueCustomElement<
  LyraVideoPlaylist,
  | 'autoAdvance'
  | 'controls'
  | 'iconLibrary'
  | 'items'
  | 'locale'
  | 'repeat'
  | 'strings',
  {},
  LyraVideoPlaylistEventMap,
  | 'blur'
  | 'focus'
  | 'lr-video-change',
  | '--lr-video-playlist-item-current-background'
  | '--lr-video-playlist-item-current-border-color',
  {
    'auto-advance'?: LyraVideoPlaylist['autoAdvance'];
    'icon-library'?: LyraVideoPlaylist['iconLibrary'];
  }
>;

export type LyraVirtualListVueProps = LyraVueCustomElement<
  LyraVirtualList,
  | 'activeItemId'
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
  | 'source'
  | 'strings',
  {},
  LyraVirtualListEventMap,
  | 'lr-load-more'
  | 'lr-virtual-scroll'
  | 'lr-visible-range-change',
  | '--lr-virtual-list-height'
  | '--lr-virtual-list-hover-outline-color'
  | '--lr-virtual-list-hover-outline-offset'
  | '--lr-virtual-list-hover-outline-style'
  | '--lr-virtual-list-hover-outline-width',
  {
    'active-item-id'?: LyraVirtualList['activeItemId'];
    'has-more'?: LyraVirtualList['hasMore'];
    'item-role'?: LyraVirtualList['itemRole'];
    'row-height'?: LyraVirtualList['rowHeight'];
    'row-index-offset'?: LyraVirtualList['rowIndexOffset'];
  }
>;

export type LyraVisuallyHiddenVueProps = LyraVueCustomElement<
  LyraVisuallyHidden,
  | 'locale'
  | 'strings',
  {},
  {},
never,
never,
  {}
>;

export type LyraVoicePickerVueProps = LyraVueCustomElement<
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
  {
    form: HTMLFormElement | string | null;
  },
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
  | '--lr-voice-picker-gap'
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
  | '--lr-voice-picker-preview-hover-color'
  | '--lr-voice-picker-radius',
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

export type LyraWidgetVueProps = LyraVueCustomElement<
  LyraWidget,
  | 'accessibleLabel'
  | 'activeView'
  | 'activeViewId'
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
  {},
  LyraWidgetEventMap,
  | 'lr-collapse-change'
  | 'lr-collapse-request'
  | 'lr-fullscreen-change'
  | 'lr-fullscreen-request'
  | 'lr-view-change'
  | 'lr-view-request',
  | '--lr-scroll-fade-size'
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

export type LyraWidgetRendererVueProps = LyraVueCustomElement<
  LyraWidgetRenderer,
  | 'bindingState'
  | 'document'
  | 'locale'
  | 'registry'
  | 'strings',
  {},
  LyraWidgetRendererEventMap,
  | 'lr-render-error'
  | 'lr-widget-action'
  | 'lr-widget-state-change',
never,
  {}
>;

export type LyraWordCloudVueProps = LyraVueCustomElement<
  LyraWordCloud,
  | 'domain'
  | 'legend'
  | 'locale'
  | 'maxFontSize'
  | 'minFontSize'
  | 'palette'
  | 'scale'
  | 'showLegend'
  | 'strings'
  | 'wordRotation'
  | 'words',
  {},
  LyraWordCloudEventMap,
  | 'lr-word-activate',
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
    'word-rotation'?: LyraWordCloud['wordRotation'];
  }
>;

export type LyraXmlViewerVueProps = LyraVueCustomElement<
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
  {},
  LyraXmlViewerEventMap,
  | 'lr-anchor-result'
  | 'lr-copy'
  | 'lr-copy-error'
  | 'lr-error'
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

export type LyraZoomableFrameVueProps = LyraVueCustomElement<
  LyraZoomableFrame,
  | 'accessibleLabel'
  | 'allowfullscreen'
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
  {},
  LyraZoomableFrameEventMap,
  | 'blur'
  | 'error'
  | 'focus'
  | 'load',
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

export interface LyraVueGlobalComponents {
  'lr-accordion': LyraAccordionVueProps;
  'lr-accordion-item': LyraAccordionItemVueProps;
  'lr-activity-feed': LyraActivityFeedVueProps;
  'lr-agent-eval-dashboard': LyraAgentEvalDashboardVueProps;
  'lr-agent-run': LyraAgentRunVueProps;
  'lr-agent-trace': LyraAgentTraceVueProps;
  'lr-agent-workspace': LyraAgentWorkspaceVueProps;
  'lr-alert': LyraAlertVueProps;
  'lr-animated-image': LyraAnimatedImageVueProps;
  'lr-animation': LyraAnimationVueProps;
  'lr-app-rail': LyraAppRailVueProps;
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
  'lr-badge': LyraBadgeVueProps;
  'lr-bar-chart': LyraBarChartVueProps;
  'lr-box-plot': LyraBoxPlotVueProps;
  'lr-branch-picker': LyraBranchPickerVueProps;
  'lr-breadcrumb': LyraBreadcrumbVueProps;
  'lr-breadcrumb-item': LyraBreadcrumbItemVueProps;
  'lr-browser-frame': LyraBrowserFrameVueProps;
  'lr-bubble-chart': LyraBubbleChartVueProps;
  'lr-button': LyraButtonVueProps;
  'lr-button-group': LyraButtonGroupVueProps;
  'lr-calendar': LyraCalendarVueProps;
  'lr-calendar-viewer': LyraCalendarViewerVueProps;
  'lr-callout': LyraCalloutVueProps;
  'lr-card': LyraCardVueProps;
  'lr-carousel': LyraCarouselVueProps;
  'lr-carousel-item': LyraCarouselItemVueProps;
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
  'lr-contact-viewer': LyraContactViewerVueProps;
  'lr-context-inspector': LyraContextInspectorVueProps;
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
  'lr-message-actions': LyraMessageActionsVueProps;
  'lr-message-feedback': LyraMessageFeedbackVueProps;
  'lr-message-parts': LyraMessagePartsVueProps;
  'lr-mind-map': LyraMindMapVueProps;
  'lr-model-select': LyraModelSelectVueProps;
  'lr-model-settings-panel': LyraModelSettingsPanelVueProps;
  'lr-multi-split': LyraMultiSplitVueProps;
  'lr-mutation-observer': LyraMutationObserverVueProps;
  'lr-native-time-input': LyraNativeTimeInputVueProps;
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
  'lr-token-input': LyraTokenInputVueProps;
  'lr-tool-approval-dialog': LyraToolApprovalDialogVueProps;
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
