import {
  LyraAppRail,
  LyraAttachmentChip,
  LyraAttachmentTrigger,
  LyraDialog,
  LyraDockPanel,
  LyraMenuItem,
  LyraModelSettingsPanel,
  LyraResponsivePanel,
  LyraSlider,
  LyraSourceList,
  LyraSplit,
  LyraSwitch,
  LyraTable,
  LyraThinkingPanel,
  LyraToolApprovalDialog,
  LyraToolParamForm,
  LyraToolSelectDialog,
  LyraVirtualList,
} from '../src/lyra.js';
import type {
  CalendarCellPos,
  FormAssociatedInterface,
  HeatmapAnnotation,
  LyraLiteChartLayout,
  LyraSelectSize,
  MatrixCellPos,
  PanelConstraint,
  RejectedFile,
  StatRow,
  TimeRangePreset,
} from '../src/lyra.js';
import type {
  DialogCloseReason,
  ResponsivePanelCloseReason,
  ToolApprovalDialogCloseReason,
  ToolSelectDialogCloseReason,
} from '../src/lyra.js';
import type {
  AppRailResizeDetail,
  BoxPlotPoint,
  BoxPlotSeries,
  ChipSelectDetail,
  ChoroplethLayer,
  GraphLink,
  GraphNode,
  HeatmapSelectedCell,
  KbdLocalize,
  LegendEntry,
  LyraChartType,
  LyraComboboxSelectionDirection,
  MapMarker,
  MenuItemChangeDetail,
  MenuItemType,
  Series,
  ToolApprovalDialogWrap,
  WidgetView,
} from '../src/lyra.js';
import type {
  LyraChipEventMap,
  LyraChipGroupEventMap,
  LyraCitationBadgeEventMap,
  LyraCopyButtonEventMap,
  LyraDiffViewEventMap,
  LyraFileInputEventMap,
  LyraHeatmapEventMap,
  LyraLiteChartEventMap,
  LyraMediaCardEventMap,
  LyraSelectEventMap,
  LyraSourceCardEventMap,
  LyraSplitEventMap,
  LyraTimeRangeEventMap,
} from '../src/lyra.js';
import type {
  LyraActivityFeedEventMap,
  LyraAnimatedImageEventMap,
  LyraAnimationEventMap,
  LyraArchiveViewerEventMap,
  LyraArtifactPanelEventMap,
  LyraAvatarGroupEventMap,
  LyraAvPlayerEventMap,
  LyraBranchPickerEventMap,
  LyraBrowserFrameEventMap,
  LyraCalendarEventMap,
  LyraCalendarViewerEventMap,
  LyraCalloutEventMap,
  LyraCarouselEventMap,
  LyraChatViewportEventMap,
  LyraCheckboxGroupEventMap,
  LyraCheckpointEventMap,
  LyraChunkInspectorEventMap,
  LyraCodeBlockCoreEventMap,
  LyraCodeEditorEventMap,
  LyraColorPickerEventMap,
  LyraCommandPaletteEventMap,
  LyraCommitCardEventMap,
  LyraCommunityCardEventMap,
  LyraComparePanelEventMap,
  LyraConfirmBarEventMap,
  LyraContactViewerEventMap,
  LyraCsvViewerEventMap,
  LyraDataGridEventMap,
  LyraDatasetViewerEventMap,
  LyraDetailsEventMap,
  LyraDocumentViewerEventMap,
  LyraDocxViewerEventMap,
  LyraEbookViewerEventMap,
  LyraEmailViewerEventMap,
  LyraEmojiPickerEventMap,
  LyraEntityCardEventMap,
  LyraEntityChipEventMap,
  LyraEnvListEventMap,
  LyraFileTreeEventMap,
  LyraFlowCanvasEventMap,
  LyraGeojsonViewEventMap,
  LyraGraphLegendEventMap,
  LyraHighlightLayerEventMap,
  LyraHtmlViewerEventMap,
  LyraImageComparerEventMap,
  LyraImageViewerEventMap,
  LyraIncludeEventMap,
  LyraInputEventMap,
  LyraIntersectionObserverEventMap,
  LyraKnownDateEventMap,
  LyraLightboxEventMap,
  LyraMessageActionsEventMap,
  LyraMessageFeedbackEventMap,
  LyraMindMapEventMap,
  LyraMutationObserverEventMap,
  LyraNeighborListEventMap,
  LyraNodePaletteEventMap,
  LyraNotebookViewerEventMap,
  LyraPageRailEventMap,
  LyraPaginationEventMap,
  LyraPathStripEventMap,
  LyraPdfViewerEventMap,
  LyraPhoneInputEventMap,
  LyraPollStatusEventMap,
  LyraPopoverEventMap,
  LyraPptxViewerEventMap,
  LyraProvenancePanelEventMap,
  LyraPushToTalkEventMap,
  LyraRadioEventMap,
  LyraRadioGroupEventMap,
  LyraRandomContentEventMap,
  LyraRatingEventMap,
  LyraResizeObserverEventMap,
  LyraRubricFormEventMap,
  LyraScrollerEventMap,
  LyraSegmentedEventMap,
  LyraSourcePickerEventMap,
  LyraSpanWaterfallEventMap,
  LyraSpreadsheetViewerEventMap,
  LyraStackTraceEventMap,
  LyraStepperEventMap,
  LyraSuggestionChipsEventMap,
  LyraSvgViewerEventMap,
  LyraSwatchPickerEventMap,
  LyraTaskListEventMap,
  LyraTerminalEventMap,
  LyraTestResultsEventMap,
  LyraTextareaEventMap,
  LyraThreadListEventMap,
  LyraTokenInputEventMap,
  LyraTourEventMap,
  LyraTraceTreeEventMap,
  LyraTranscriptFeedEventMap,
  LyraVoicePickerEventMap,
  LyraWidgetRendererEventMap,
  LyraZoomableFrameEventMap,
} from '../src/lyra.js';

const publicTypes: [
  StatRow,
  LyraSelectSize,
  PanelConstraint,
  TimeRangePreset,
  HeatmapAnnotation,
  MatrixCellPos,
  CalendarCellPos,
  LyraLiteChartLayout,
  RejectedFile,
  FormAssociatedInterface,
] | undefined = undefined;
void publicTypes;

// Compile-only guard: fails to typecheck if the root barrel (src/lyra.ts) ever
// stops re-exporting one of these component event-map types, even though the
// owning class itself stays exported -- otherwise a consumer building a typed
// wrapper/event helper for one of these components has no way to name its
// event-detail type from the package root.
const barrelEventMapTypes: [
  LyraChipEventMap,
  LyraChipGroupEventMap,
  LyraCitationBadgeEventMap,
  LyraCopyButtonEventMap,
  LyraDiffViewEventMap,
  LyraFileInputEventMap,
  LyraHeatmapEventMap,
  LyraLiteChartEventMap,
  LyraMediaCardEventMap,
  LyraSelectEventMap,
  LyraSourceCardEventMap,
  LyraSplitEventMap,
  LyraTimeRangeEventMap,
] | undefined = undefined;
void barrelEventMapTypes;

// Same guard as `barrelEventMapTypes` above, extended to the ~100 components
// added by the 2026-07 "Agentic Expansion" epic (11 families / 103 tasks,
// commits after 3910120) -- that whole wave went in without ever being added
// here, which is exactly how `LyraEmojiPickerEventMap` (Family H/I) went
// missing from the root barrel. Regenerate this list with:
//   git diff --diff-filter=A --name-only 3910120..HEAD -- packages/lyra-ui/src/components \
//     | grep '\.class\.ts$' | xargs grep -oP 'export interface \KLyra\w*EventMap' \
//     | sort -u
// (minus any name already covered by `barrelEventMapTypes` above) when the
// next epic lands, rather than leaving new components uncovered again.
const epicBarrelEventMapTypes: [
  LyraActivityFeedEventMap,
  LyraAnimatedImageEventMap,
  LyraAnimationEventMap,
  LyraArchiveViewerEventMap,
  LyraArtifactPanelEventMap,
  LyraAvatarGroupEventMap,
  LyraAvPlayerEventMap,
  LyraBranchPickerEventMap,
  LyraBrowserFrameEventMap,
  LyraCalendarEventMap,
  LyraCalendarViewerEventMap,
  LyraCalloutEventMap,
  LyraCarouselEventMap,
  LyraChatViewportEventMap,
  LyraCheckboxGroupEventMap,
  LyraCheckpointEventMap,
  LyraChunkInspectorEventMap,
  LyraCodeBlockCoreEventMap,
  LyraCodeEditorEventMap,
  LyraColorPickerEventMap,
  LyraCommandPaletteEventMap,
  LyraCommitCardEventMap,
  LyraCommunityCardEventMap,
  LyraComparePanelEventMap,
  LyraConfirmBarEventMap,
  LyraContactViewerEventMap,
  LyraCsvViewerEventMap,
  LyraDataGridEventMap,
  LyraDatasetViewerEventMap,
  LyraDetailsEventMap,
  LyraDocumentViewerEventMap,
  LyraDocxViewerEventMap,
  LyraEbookViewerEventMap,
  LyraEmailViewerEventMap,
  LyraEmojiPickerEventMap,
  LyraEntityCardEventMap,
  LyraEntityChipEventMap,
  LyraEnvListEventMap,
  LyraFileTreeEventMap,
  LyraFlowCanvasEventMap,
  LyraGeojsonViewEventMap,
  LyraGraphLegendEventMap,
  LyraHighlightLayerEventMap,
  LyraHtmlViewerEventMap,
  LyraImageComparerEventMap,
  LyraImageViewerEventMap,
  LyraIncludeEventMap,
  LyraInputEventMap,
  LyraIntersectionObserverEventMap,
  LyraKnownDateEventMap,
  LyraLightboxEventMap,
  LyraMessageActionsEventMap,
  LyraMessageFeedbackEventMap,
  LyraMindMapEventMap,
  LyraMutationObserverEventMap,
  LyraNeighborListEventMap,
  LyraNodePaletteEventMap,
  LyraNotebookViewerEventMap,
  LyraPageRailEventMap,
  LyraPaginationEventMap,
  LyraPathStripEventMap,
  LyraPdfViewerEventMap,
  LyraPhoneInputEventMap,
  LyraPollStatusEventMap,
  LyraPopoverEventMap,
  LyraPptxViewerEventMap,
  LyraProvenancePanelEventMap,
  LyraPushToTalkEventMap,
  LyraRadioEventMap,
  LyraRadioGroupEventMap,
  LyraRandomContentEventMap,
  LyraRatingEventMap,
  LyraResizeObserverEventMap,
  LyraRubricFormEventMap,
  LyraScrollerEventMap,
  LyraSegmentedEventMap,
  LyraSourcePickerEventMap,
  LyraSpanWaterfallEventMap,
  LyraSpreadsheetViewerEventMap,
  LyraStackTraceEventMap,
  LyraStepperEventMap,
  LyraSuggestionChipsEventMap,
  LyraSvgViewerEventMap,
  LyraSwatchPickerEventMap,
  LyraTaskListEventMap,
  LyraTerminalEventMap,
  LyraTestResultsEventMap,
  LyraTextareaEventMap,
  LyraThreadListEventMap,
  LyraTokenInputEventMap,
  LyraTourEventMap,
  LyraTraceTreeEventMap,
  LyraTranscriptFeedEventMap,
  LyraVoicePickerEventMap,
  LyraWidgetRendererEventMap,
  LyraZoomableFrameEventMap,
] | undefined = undefined;
void epicBarrelEventMapTypes;

// Compile-only guard: each of these types the public surface of an @property,
// an accessor, or an event detail on a component whose class the barrel
// already exports -- so naming one must never require reaching past the
// package root into a `.class.js` deep import (which the entry contract
// forbids). Fails to typecheck if the barrel ever drops one.
const barrelPublicSurfaceTypes: [
  HeatmapSelectedCell,
  Series,
  LyraChartType,
  BoxPlotSeries,
  BoxPlotPoint,
  GraphNode,
  GraphLink,
  LegendEntry,
  ChoroplethLayer,
  MapMarker,
  WidgetView,
  MenuItemType,
  ToolApprovalDialogWrap,
  LyraComboboxSelectionDirection,
  AppRailResizeDetail,
  ChipSelectDetail,
  MenuItemChangeDetail,
  KbdLocalize,
] | undefined = undefined;
void barrelPublicSurfaceTypes;

declare const appRail: LyraAppRail;
appRail.addEventListener('lr-mode-change', (event) => {
  const mode: 'full' | 'icon-only' | 'mobile' = event.detail.mode;
  void mode;
});
appRail.addEventListener('lr-toggle', (event) => {
  const open: boolean = event.detail.open;
  void open;
});
appRail.addEventListener('lr-rail-resize', (event) => {
  const widthPx: number = event.detail.widthPx;
  void widthPx;
});

declare const attachmentChip: LyraAttachmentChip;
attachmentChip.addEventListener('lr-remove', (event) => {
  const id: string = event.detail.id;
  void id;
});
attachmentChip.addEventListener('lr-preview', (event) => {
  const src: string = event.detail.src;
  void src;
});

declare const attachmentTrigger: LyraAttachmentTrigger;
attachmentTrigger.addEventListener('lr-pick', (event) => {
  // A real `FileList`, not an array -- see the `lr-pick` @event doc.
  const files: FileList = event.detail.files;
  const capability: 'files' | 'image' = event.detail.capability;
  void files;
  void capability;
});

// The close-reason unions are the point of these three: each is already
// exported, but before its event map existed the union was unreachable
// through a typed listener -- `event.detail` was a bare `Event`.
declare const dialog: LyraDialog;
dialog.addEventListener('lr-dialog-close', (event) => {
  const reason: DialogCloseReason = event.detail;
  void reason;
});

declare const toolApproval: LyraToolApprovalDialog;
toolApproval.addEventListener('lr-close', (event) => {
  const reason: ToolApprovalDialogCloseReason = event.detail;
  void reason;
});
toolApproval.addEventListener('lr-approve', (event) => {
  const args: unknown = event.detail.args;
  void args;
});

declare const toolSelect: LyraToolSelectDialog;
toolSelect.addEventListener('lr-close', (event) => {
  const reason: ToolSelectDialogCloseReason = event.detail;
  void reason;
});
toolSelect.addEventListener('lr-change', (event) => {
  const selected: string[] = event.detail.selected;
  void selected;
});

declare const responsivePanel: LyraResponsivePanel;
responsivePanel.addEventListener('lr-close', (event) => {
  const reason: ResponsivePanelCloseReason = event.detail;
  void reason;
});
responsivePanel.addEventListener('lr-mode-change', (event) => {
  const mode: 'inline' | 'overlay' = event.detail.mode;
  void mode;
});

declare const dockPanel: LyraDockPanel;
dockPanel.addEventListener('lr-resize', (event) => {
  const size: string = event.detail.size;
  void size;
});
dockPanel.addEventListener('lr-collapse-change', (event) => {
  const collapsed: boolean = event.detail.collapsed;
  void collapsed;
});

declare const modelSettings: LyraModelSettingsPanel;
modelSettings.addEventListener('lr-change', (event) => {
  const temperature: number = event.detail.temperature;
  void temperature;
});

declare const sourceList: LyraSourceList;
sourceList.addEventListener('lr-toggle', (event) => {
  const expanded: boolean = event.detail.expanded;
  void expanded;
});

declare const thinkingPanel: LyraThinkingPanel;
thinkingPanel.addEventListener('lr-toggle', (event) => {
  const expanded: boolean = event.detail.expanded;
  void expanded;
});

declare const menuItem: LyraMenuItem;
menuItem.addEventListener('lr-menu-item-change', (event) => {
  const checked: boolean = event.detail.checked;
  const value: string = event.detail.value;
  void checked;
  void value;
});

declare const split: LyraSplit;
split.addEventListener('lr-split-collapse-change', (event) => {
  const state: 'wide' | 'rail' | 'floating' = event.detail.state;
  void state;
});
split.addEventListener('lr-split-constraints-invalid', (event) => {
  const panelCount: number = event.detail.panelCount;
  void panelCount;
});

declare const slider: LyraSlider;
slider.addEventListener('lr-change', (event) => {
  const value: number = event.detail.value;
  void value;
});

declare const toggle: LyraSwitch;
toggle.addEventListener('lr-change', (event) => {
  const checked: boolean = event.detail.checked;
  void checked;
});

declare const table: LyraTable<{ id: string }>;
table.addEventListener('lr-row-click', (event) => {
  const id: string = event.detail.row.id;
  void id;
});

declare const form: LyraToolParamForm;
form.addEventListener('lr-validity-change', (event) => {
  const valid: boolean = event.detail.valid;
  const message: string | undefined = event.detail.errors.prompt;
  void valid;
  void message;
});

declare const list: LyraVirtualList;
list.addEventListener('lr-visible-range-changed', (event) => {
  const start: number = event.detail.start;
  const end: number = event.detail.end;
  void start;
  void end;
});
