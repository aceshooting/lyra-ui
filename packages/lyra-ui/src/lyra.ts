// Side-effect imports register every component…
import './components/sparkline/sparkline.js';
import './components/toast/toast.js';
import './components/toast/toast-item.js';
import './components/combobox/combobox.js';
import './components/combobox/option.js';
import './components/select/select.js';
import './components/date-picker/date-picker.js';
import './components/date-picker/date-input.js';
import './components/flag/flag.js';
import './components/empty/empty.js';
import './components/skeleton/skeleton.js';
import './components/stat/stat.js';
import './components/table/table.js';
import './components/gauge/gauge.js';
import './components/export-button/export-button.js';
import './components/split/split.js';
import './components/time-range/time-range.js';
import './components/playback/playback.js';
import './components/heatmap/heatmap.js';
import './components/graph/graph.js';
import './components/tree/tree.js';
import './components/tree/tree-node.js';
import './components/chart/chart.js';
import './components/chart/lite-chart.js';
import './components/chart/bar-chart.js';
import './components/chart/line-chart.js';
import './components/chart/pie-chart.js';
import './components/chart/doughnut-chart.js';
import './components/chart/scatter-chart.js';
import './components/chart/bubble-chart.js';
import './components/chart/radar-chart.js';
import './components/chart/polar-area-chart.js';
import './components/chart/box-plot.js';
import './components/chart/histogram.js';
import './components/map/map.js';
import './components/file-input/file-input.js';
import './components/widget/widget.js';
import './components/word-cloud/word-cloud.js';
import './components/dialog/dialog.js';
import './components/tabs/tabs.js';
import './components/checkbox/checkbox.js';
import './components/switch/switch.js';
import './components/json-viewer/json-viewer.js';
import './components/live-region/live-region.js';
import './components/markdown/markdown.js';
import './components/chat-message/chat-message.js';
import './components/typing-indicator/typing-indicator.js';
import './components/tool-call-chip/tool-call-chip.js';
import './components/tool-result-view/tool-result-view.js';
import './components/tool-result-dialog/tool-result-dialog.js';
import './components/chat-composer/chat-composer.js';
import './components/attachment-chip/attachment-chip.js';
import './components/stream-status/stream-status.js';
import './components/virtual-list/virtual-list.js';
import './components/conversation-item/conversation-item.js';
import './components/model-select/model-select.js';
import './components/slider/slider.js';
import './components/tool-select-dialog/tool-select-dialog.js';
import './components/citation-badge/citation-badge.js';
import './components/source-list/source-list.js';
import './components/source-card/source-card.js';
import './components/app-rail/app-rail.js';
import './components/responsive-panel/responsive-panel.js';
import './components/mention-popover/mention-popover.js';
import './components/streaming-text/streaming-text.js';
import './components/thinking-panel/thinking-panel.js';
import './components/generation-status/generation-status.js';
import './components/code-block/code-block.js';
import './components/tool-approval-dialog/tool-approval-dialog.js';
import './components/tool-param-form/tool-param-form.js';
import './components/menu/menu.js';
import './components/menu/menu-item.js';
import './components/chip/chip.js';
import './components/chip/chip-group.js';
import './components/model-settings-panel/model-settings-panel.js';
import './components/context-meter/context-meter.js';
import './components/dock-panel/dock-panel.js';
import './components/document-preview/document-preview.js';
import './components/media-card/media-card.js';
import './components/attachment-trigger/attachment-trigger.js';
import './components/kbd/kbd.js';
import './components/result-card/result-card.js';
import './components/result-card/result-field.js';

// …and the barrel re-exports classes, helpers, and types.
export { LyraSparkline } from './components/sparkline/sparkline.js';
export { LyraToast } from './components/toast/toast.js';
export type { ToastPlacement, ToastCreateOptions } from './components/toast/toast.js';
export { LyraToastItem } from './components/toast/toast-item.js';
export type { ToastVariant, ToastSize } from './components/toast/toast-item.js';
export { toast } from './components/toast/toaster.js';
export type { ToastOptions, ToastHandle } from './components/toast/toaster.js';
export { LyraCombobox } from './components/combobox/combobox.js';
export type { OptionFilter } from './components/combobox/combobox.js';
export { LyraOption } from './components/combobox/option.js';
export { LyraSelect } from './components/select/select.js';
export { LyraDatePicker } from './components/date-picker/date-picker.js';
export type { DateRange } from './components/date-picker/date-picker.js';
export { LyraDateInput } from './components/date-picker/date-input.js';
export { LyraFlag } from './components/flag/flag.js';
export { LANGUAGE_TO_COUNTRY, languageToCountry } from './components/flag/language-map.js';
export { LyraEmpty } from './components/empty/empty.js';
export { LyraSkeleton } from './components/skeleton/skeleton.js';
export type { SkeletonVariant, SkeletonEffect } from './components/skeleton/skeleton.js';
export { LyraStat } from './components/stat/stat.js';
export type { StatVariant, StatGoodDirection } from './components/stat/stat.js';
export { LyraTable } from './components/table/table.js';
export type { TableColumn } from './components/table/table.js';
export { LyraGauge } from './components/gauge/gauge.js';
export type { GaugeType } from './components/gauge/gauge.js';
export { LyraExportButton } from './components/export-button/export-button.js';
export type { ExportFormat } from './components/export-button/export-button.js';
export { escapeCsvField, buildCsv, downloadBlob } from './components/export-button/csv.js';
export type { CsvColumn } from './components/export-button/csv.js';
export { LyraSplit } from './components/split/split.js';
export { LyraTimeRange } from './components/time-range/time-range.js';
export { LyraPlayback } from './components/playback/playback.js';
export { LyraHeatmap } from './components/heatmap/heatmap.js';
export { linearAlpha, sqrtStep } from './components/heatmap/heatmap-scale.js';
export { LyraGraph } from './components/graph/graph.js';
export type { GraphNode, GraphLink } from './components/graph/graph.js';
export { LyraTree } from './components/tree/tree.js';
export type { TreeItem } from './components/tree/tree.js';
export { LyraTreeNode } from './components/tree/tree-node.js';
export { LyraChart } from './components/chart/chart.js';
export type { Series, LyraChartType } from './components/chart/chart.js';
export { LyraLiteChart } from './components/chart/lite-chart.js';
export type { LiteSeries, LyraLiteChartType } from './components/chart/lite-chart.js';
export { LyraBarChart } from './components/chart/bar-chart.js';
export { LyraLineChart } from './components/chart/line-chart.js';
export { LyraPieChart } from './components/chart/pie-chart.js';
export { LyraDoughnutChart } from './components/chart/doughnut-chart.js';
export { LyraScatterChart } from './components/chart/scatter-chart.js';
export { LyraBubbleChart } from './components/chart/bubble-chart.js';
export { LyraRadarChart } from './components/chart/radar-chart.js';
export { LyraPolarAreaChart } from './components/chart/polar-area-chart.js';
export { LyraBoxPlot } from './components/chart/box-plot.js';
export type { BoxPlotSeries, BoxPlotPoint } from './components/chart/box-plot.js';
export { LyraHistogram } from './components/chart/histogram.js';
export { binValues } from './components/chart/histogram-bin.js';
export type { HistogramBucket } from './components/chart/histogram-bin.js';
export { LyraMap } from './components/map/map.js';
export type { LegendEntry, ChoroplethLayer } from './components/map/map.js';
export { LyraFileInput } from './components/file-input/file-input.js';
export { LyraWidget } from './components/widget/widget.js';
export { LyraWordCloud } from './components/word-cloud/word-cloud.js';
export type { WordCloudWord } from './components/word-cloud/word-cloud.js';
export type { MapMarker } from './components/map/map.js';
export type { ComboboxSource, ComboboxSourceRow } from './components/combobox/combobox.js';
export type { CalendarDay } from './components/heatmap/calendar-grid.js';
export { LyraDialog } from './components/dialog/dialog.js';
export type { DialogCloseReason } from './components/dialog/dialog.js';
export { confirm } from './components/dialog/confirm.js';
export type { ConfirmOptions } from './components/dialog/confirm.js';
export { LyraTabs } from './components/tabs/tabs.js';
export { LyraCheckbox } from './components/checkbox/checkbox.js';
export { LyraSwitch } from './components/switch/switch.js';
export { LyraJsonViewer } from './components/json-viewer/json-viewer.js';
export { LyraLiveRegion } from './components/live-region/live-region.js';
export type { LiveRegionMode } from './components/live-region/live-region.js';
export { Announcer } from './internal/announcer.js';
export type { AnnounceOptions, AnnouncerOptions } from './internal/announcer.js';
export { LyraMarkdown } from './components/markdown/markdown.js';
export { LyraChatMessage } from './components/chat-message/chat-message.js';
export type { ChatMessageRole, ChatMessageStatus } from './components/chat-message/chat-message.js';
export { LyraTypingIndicator } from './components/typing-indicator/typing-indicator.js';
export type {
  TypingIndicatorVariant,
  TypingIndicatorSize,
} from './components/typing-indicator/typing-indicator.js';
export { LyraToolCallChip } from './components/tool-call-chip/tool-call-chip.js';
export type { ToolCallStatus, ToolChipSelectDetail } from './components/tool-call-chip/tool-call-chip.js';
export { LyraToolResultView } from './components/tool-result-view/tool-result-view.js';
export {
  registerToolRenderer,
  getDefaultToolRendererRegistry,
  findToolRenderer,
  loadToolRenderer,
  clearToolRenderers,
} from './components/tool-result-view/registry.js';
export type {
  ToolRendererDefinition,
  ToolRendererRegistry,
} from './components/tool-result-view/registry.js';
export { LyraToolResultDialog } from './components/tool-result-dialog/tool-result-dialog.js';
export type {
  ToolResultStatus,
  ToolResultDialogCloseReason,
} from './components/tool-result-dialog/tool-result-dialog.js';
export { LyraChatComposer } from './components/chat-composer/chat-composer.js';
export type { ChatComposerStatus } from './components/chat-composer/chat-composer.js';
export { LyraAttachmentChip, formatFileSize } from './components/attachment-chip/attachment-chip.js';
export type {
  AttachmentChipStatus,
  AttachmentChipIdDetail,
} from './components/attachment-chip/attachment-chip.js';
export { LyraStreamStatus } from './components/stream-status/stream-status.js';
export type { StreamStatusPhase } from './components/stream-status/stream-status.js';
export { LyraVirtualList } from './components/virtual-list/virtual-list.js';
export type { VirtualListRange, VirtualListGroup } from './components/virtual-list/virtual-list.js';
export { LyraConversationItem } from './components/conversation-item/conversation-item.js';
export type { ConversationItemRenameDetail } from './components/conversation-item/conversation-item.js';
export { LyraModelSelect } from './components/model-select/model-select.js';
export type {
  LyraModelCatalogEntry,
  LyraModelCatalog,
} from './components/model-select/model-select.js';
export { LyraSlider } from './components/slider/slider.js';
export { LyraToolSelectDialog } from './components/tool-select-dialog/tool-select-dialog.js';
export type {
  ToolSelectDialogTool,
  ToolSelectFilter,
  ToolSelectionChangeDetail,
  ToolSelectDialogCloseReason,
} from './components/tool-select-dialog/tool-select-dialog.js';
export { LyraCitationBadge } from './components/citation-badge/citation-badge.js';
export type {
  CitationBadgeStatus,
  CitationActivateDetail,
  CitationOpenDetail,
} from './components/citation-badge/citation-badge.js';
export { LyraSourceList } from './components/source-list/source-list.js';
export type { SourceListToggleDetail } from './components/source-list/source-list.js';
export { LyraSourceCard } from './components/source-card/source-card.js';
export type {
  SourceCardExpandDetail,
  SourceCardOpenDetail,
} from './components/source-card/source-card.js';
export { LyraAppRail, computeAppRailMode } from './components/app-rail/app-rail.js';
export type {
  AppRailMode,
  AppRailModeInput,
  AppRailModeChangeDetail,
  AppRailToggleDetail,
} from './components/app-rail/app-rail.js';
export {
  LyraResponsivePanel,
  resolveEffectiveMode as resolveResponsivePanelEffectiveMode,
} from './components/responsive-panel/responsive-panel.js';
export type {
  ResponsivePanelMode,
  ResponsivePanelEffectiveMode,
  ResponsivePanelVariant,
  ResponsivePanelCloseReason,
  ResponsivePanelModeChangeDetail,
} from './components/responsive-panel/responsive-panel.js';
export { LyraMentionPopover } from './components/mention-popover/mention-popover.js';
export type {
  MentionItem,
  MentionFilter,
  MentionSelectDetail,
} from './components/mention-popover/mention-popover.js';
export { LyraStreamingText, looksLikeMarkdown } from './components/streaming-text/streaming-text.js';
export { LyraThinkingPanel } from './components/thinking-panel/thinking-panel.js';
export type {
  ThinkingPanelMode,
  ThinkingPanelToggleDetail,
} from './components/thinking-panel/thinking-panel.js';
export { LyraGenerationStatus } from './components/generation-status/generation-status.js';
export { LyraCodeBlock } from './components/code-block/code-block.js';
export { LyraToolApprovalDialog } from './components/tool-approval-dialog/tool-approval-dialog.js';
export type { ToolApprovalDialogCloseReason } from './components/tool-approval-dialog/tool-approval-dialog.js';
export { LyraToolParamForm } from './components/tool-param-form/tool-param-form.js';
export type {
  ToolParamFormPropertyType,
  ToolParamFormProperty,
  ToolParamFormSchema,
} from './components/tool-param-form/tool-param-form.js';
export { LyraMenu } from './components/menu/menu.js';
export type { MenuSelectDetail } from './components/menu/menu.js';
export { LyraMenuItem } from './components/menu/menu-item.js';
export { LyraChip } from './components/chip/chip.js';
export type { ChipTone, ChipRemoveDetail } from './components/chip/chip.js';
export { LyraChipGroup } from './components/chip/chip-group.js';
export type { ChipGroupOverflowToggleDetail } from './components/chip/chip-group.js';
export { LyraModelSettingsPanel } from './components/model-settings-panel/model-settings-panel.js';
export type {
  ModelSettingsPanelLayout,
  ModelSettingsChangeDetail,
} from './components/model-settings-panel/model-settings-panel.js';
export { LyraContextMeter } from './components/context-meter/context-meter.js';
export type {
  ContextMeterTone,
  ContextMeterVariant,
  ContextMeterSegment,
} from './components/context-meter/context-meter.js';
export { LyraDockPanel, parseLengthPx } from './components/dock-panel/dock-panel.js';
export type {
  DockPanelEdge,
  DockPanelResizeDetail,
  DockPanelCollapseChangeDetail,
} from './components/dock-panel/dock-panel.js';
export { LyraDocumentPreview } from './components/document-preview/document-preview.js';
export type { DocumentPreviewStatus } from './components/document-preview/document-preview.js';
export { LyraMediaCard, safeMediaSrc, safeLinkHref } from './components/media-card/media-card.js';
export type { MediaCardKind, MediaCardOpenDetail } from './components/media-card/media-card.js';
export { LyraAttachmentTrigger } from './components/attachment-trigger/attachment-trigger.js';
export type {
  AttachmentCapability,
  FileBackedCapability,
  AttachmentPickDetail,
} from './components/attachment-trigger/attachment-trigger.js';
export { LyraKbd, shortcutTokenLabel, parseShortcut } from './components/kbd/kbd.js';
export type { KbdKeyLabel } from './components/kbd/kbd.js';
export { LyraResultCard } from './components/result-card/result-card.js';
export { LyraResultField } from './components/result-card/result-field.js';
export { groupByRecency } from './internal/group-by-recency.js';
export type {
  RecencyLabels,
  GroupByRecencyOptions,
  RecencyBucket,
} from './internal/group-by-recency.js';

export { LyraElement } from './internal/lyra-element.js';
export { FormAssociated } from './internal/form-associated.js';
export { LYRA_PREFIX, tag, defineElement } from './internal/prefix.js';
