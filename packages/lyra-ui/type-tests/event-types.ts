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
  LyraTree,
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
  ChartPoint,
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
  LyraTreeEventMap,
} from '../src/lyra.js';
import type {
  LyraContextInspectorEventMap,
  LyraEntityDossierEventMap,
  LyraEvalDatasetEventMap,
  LyraToolApprovalDialogEventMap,
  LyraToolParamFormEventMap,
  LyraToolSelectDialogEventMap,
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
  LyraCardEventMap,
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
  LyraModelSelectEventMap,
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
// The opt-in form a consumer writes: a bare side-effect import of the generated global
// typed-event surface. It resolves to a module whose every statement is type-only, so this line
// compiles to an empty module and costs zero runtime bytes -- but it is what pulls the
// `declare global` augmentation into the consumer's program.
import '../src/events.js';
import type {
  LyraGlobalEventMap,
  LyraNodeToggleEvent,
  LyraRailResizeEvent,
  LyraSplitCollapseChangeEvent,
  LyraTabShowEvent,
  LyraVisibleRangeChangedEvent,
} from '../src/events.js';

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

// Compile-only guard: native-style events explicitly documented by conversation controls must
// also be present in their exported event maps, rather than relying on HTMLElementEventMap.
const conversationNativeEventMapTypes: [
  LyraModelSelectEventMap['input'],
  LyraModelSelectEventMap['change'],
  LyraThreadListEventMap['focus'],
  LyraThreadListEventMap['blur'],
] | undefined = undefined;
void conversationNativeEventMapTypes;

// Compile-only guard: composed focus/blur bridges are part of these components' named
// event-map contracts, not merely inherited guesses from HTMLElementEventMap.
const agentToolNativeEventMapTypes: [
  LyraEvalDatasetEventMap['focus'],
  LyraEvalDatasetEventMap['blur'],
  LyraToolApprovalDialogEventMap['focus'],
  LyraToolApprovalDialogEventMap['blur'],
  LyraToolParamFormEventMap['focus'],
  LyraToolParamFormEventMap['blur'],
  LyraToolSelectDialogEventMap['focus'],
  LyraToolSelectDialogEventMap['blur'],
] | undefined = undefined;
void agentToolNativeEventMapTypes;

// Compile-only guard: pure composition components expose the typed child events that bubble
// through their own shadow boundary, without re-emitting a duplicate event.
const composedEventMapTypes: [
  LyraContextInspectorEventMap['lr-copy'],
  LyraContextInspectorEventMap['lr-export'],
  LyraContextInspectorEventMap['lr-export-complete'],
  LyraContextInspectorEventMap['lr-citation-activate'],
  LyraContextInspectorEventMap['lr-citation-open'],
  LyraEntityDossierEventMap['lr-entity-activate'],
  LyraEntityDossierEventMap['lr-node-expand'],
  LyraEntityDossierEventMap['lr-chunk-open'],
  LyraEntityDossierEventMap['lr-expand'],
  LyraEntityDossierEventMap['lr-toggle'],
  LyraEntityDossierEventMap['lr-tab-show'],
] | undefined = undefined;
void composedEventMapTypes;

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
  LyraTreeEventMap,
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
  LyraCardEventMap,
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
  LyraContextInspectorEventMap,
  LyraCsvViewerEventMap,
  LyraDatasetViewerEventMap,
  LyraDetailsEventMap,
  LyraDocumentViewerEventMap,
  LyraDocxViewerEventMap,
  LyraEbookViewerEventMap,
  LyraEmailViewerEventMap,
  LyraEmojiPickerEventMap,
  LyraEntityCardEventMap,
  LyraEntityChipEventMap,
  LyraEntityDossierEventMap,
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
  ChartPoint,
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
  const extent: string = event.detail.extent;
  void extent;
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
  const message: string | undefined = event.detail.errors['prompt'];
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

// Before LyraTreeEventMap existed, LyraTree had no Events generic at all, so a
// listener registered here got a bare `Event` -- `event.detail` didn't typecheck.
declare const tree: LyraTree;
tree.addEventListener('lr-node-toggle', (event) => {
  const id: string = event.detail.id;
  const expanded: boolean = event.detail.expanded;
  void id;
  void expanded;
});
tree.addEventListener('lr-node-select', (event) => {
  const id: string = event.detail.id;
  void id;
});
tree.addEventListener('lr-reorder', (event) => {
  const id: string = event.detail.id;
  const parentId: string | null = event.detail.parentId;
  const fromIndex: number = event.detail.fromIndex;
  const toIndex: number = event.detail.toIndex;
  void id;
  void parentId;
  void fromIndex;
  void toIndex;
});

// ---------------------------------------------------------------------------
// Generated global typed-event surface (src/events.ts).
//
// Everything above types a listener attached to a *lyra element reference*, where the component's
// own `Lyra*EventMap` generic does the work. Every component event is `bubbles`/`composed`, so the
// far more common real-world shape -- one delegated listener on a container, on `document`, or on
// `window` -- had no typing at all: `event` arrived as a bare `Event` and `event.detail` did not
// exist. The block below is the regression guard for that.
// ---------------------------------------------------------------------------

// Compile-only guard: the generated aggregate map and the per-event alias types stay exported
// from the `./events.js` entry point. A consumer writing a typed wrapper names these.
const globalEventSurfaceTypes: [
  LyraGlobalEventMap,
  LyraNodeToggleEvent,
  LyraRailResizeEvent,
  LyraSplitCollapseChangeEvent,
  LyraTabShowEvent,
  LyraVisibleRangeChangedEvent,
] | undefined = undefined;
void globalEventSurfaceTypes;

// `document` uses `DocumentEventMap`, a plain element uses `HTMLElementEventMap`, and `window`
// uses `WindowEventMap` -- three separate interfaces, all of which extend the one this library
// augments (`GlobalEventHandlersEventMap`). Assert all three, because augmenting only
// `HTMLElementEventMap` would silently leave the `document`/`window` cases untyped.
document.addEventListener('lr-visible-range-changed', (event) => {
  const start: number = event.detail.start;
  const end: number = event.detail.end;
  void start;
  void end;
});

declare const delegationRoot: HTMLElement;
delegationRoot.addEventListener('lr-rail-resize', (event) => {
  const widthPx: number = event.detail.widthPx;
  void widthPx;
});

window.addEventListener('lr-split-collapse-change', (event) => {
  const state: 'wide' | 'rail' | 'floating' = event.detail.state;
  void state;
});

// A name emitted by more than one component becomes a union of those components' own entries, so
// only what every arm carries is readable without narrowing. `lr-node-toggle` comes from both
// `<lr-tree>` and `<lr-tree-item>` and both carry `{ id, expanded }`, so both still read.
document.addEventListener('lr-node-toggle', (event) => {
  const id: string = event.detail.id;
  const expanded: boolean = event.detail.expanded;
  void id;
  void expanded;
});

// ...and where the arms genuinely disagree, the union is the honest answer rather than a lie.
// `lr-change` is emitted by two dozen form controls with unrelated details, so a property only
// some of them carry must NOT typecheck off the global map. `@ts-expect-error` inverts the
// assertion: this fails the build if the line ever starts compiling.
document.addEventListener('lr-change', (event) => {
  // @ts-expect-error - `value` exists on some `lr-change` details (e.g. `<lr-slider>`) but not
  // all (e.g. `<lr-checkbox>` carries `checked`). Narrow through the emitting component's own
  // map -- `LyraSelectEventMap['lr-change']` -- when one component's exact detail is needed.
  const value = event.detail.value;
  void value;
});

// The precise, per-element maps remain the source of truth the global map is derived from, and
// stay directly nameable for exactly that narrowing.
declare const preciseChange: LyraSelectEventMap['lr-change'];
const preciseChangeValue: string | string[] = preciseChange.detail.value;
void preciseChangeValue;

// A detail property that does not exist must not typecheck. Before the global map existed this
// line compiled fine, because `event` was a bare `Event` and `event.detail` was an error for a
// different reason entirely -- so this is the assertion that proves the map is doing real work.
document.addEventListener('lr-visible-range-changed', (event) => {
  // @ts-expect-error - the detail is `{ start, end }`; there is no `firstIndex`.
  const missing = event.detail.firstIndex;
  void missing;
});

// A generic helper keyed by the aggregate map -- the shape an application wraps the library in.
function onLyraEvent<K extends keyof LyraGlobalEventMap>(
  target: EventTarget,
  type: K,
  listener: (event: LyraGlobalEventMap[K]) => void,
): void {
  target.addEventListener(type, listener as EventListener);
}
onLyraEvent(document, 'lr-rail-resize', (event) => {
  const widthPx: number = event.detail.widthPx;
  void widthPx;
});
