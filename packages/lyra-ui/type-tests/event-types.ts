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
appRail.addEventListener('lyra-mode-change', (event) => {
  const mode: 'full' | 'icon-only' | 'mobile' = event.detail.mode;
  void mode;
});
appRail.addEventListener('lyra-toggle', (event) => {
  const open: boolean = event.detail.open;
  void open;
});
appRail.addEventListener('lyra-rail-resize', (event) => {
  const widthPx: number = event.detail.widthPx;
  void widthPx;
});

declare const attachmentChip: LyraAttachmentChip;
attachmentChip.addEventListener('lyra-remove', (event) => {
  const id: string = event.detail.id;
  void id;
});
attachmentChip.addEventListener('lyra-preview', (event) => {
  const src: string = event.detail.src;
  void src;
});

declare const attachmentTrigger: LyraAttachmentTrigger;
attachmentTrigger.addEventListener('lyra-pick', (event) => {
  // A real `FileList`, not an array -- see the `lyra-pick` @event doc.
  const files: FileList = event.detail.files;
  const capability: 'files' | 'image' = event.detail.capability;
  void files;
  void capability;
});

// The close-reason unions are the point of these three: each is already
// exported, but before its event map existed the union was unreachable
// through a typed listener -- `event.detail` was a bare `Event`.
declare const dialog: LyraDialog;
dialog.addEventListener('lyra-dialog-close', (event) => {
  const reason: DialogCloseReason = event.detail;
  void reason;
});

declare const toolApproval: LyraToolApprovalDialog;
toolApproval.addEventListener('lyra-close', (event) => {
  const reason: ToolApprovalDialogCloseReason = event.detail;
  void reason;
});
toolApproval.addEventListener('lyra-approve', (event) => {
  const args: unknown = event.detail.args;
  void args;
});

declare const toolSelect: LyraToolSelectDialog;
toolSelect.addEventListener('lyra-close', (event) => {
  const reason: ToolSelectDialogCloseReason = event.detail;
  void reason;
});
toolSelect.addEventListener('lyra-change', (event) => {
  const selected: string[] = event.detail.selected;
  void selected;
});

declare const responsivePanel: LyraResponsivePanel;
responsivePanel.addEventListener('lyra-close', (event) => {
  const reason: ResponsivePanelCloseReason = event.detail;
  void reason;
});
responsivePanel.addEventListener('lyra-mode-change', (event) => {
  const mode: 'inline' | 'overlay' = event.detail.mode;
  void mode;
});

declare const dockPanel: LyraDockPanel;
dockPanel.addEventListener('lyra-resize', (event) => {
  const size: string = event.detail.size;
  void size;
});
dockPanel.addEventListener('lyra-collapse-change', (event) => {
  const collapsed: boolean = event.detail.collapsed;
  void collapsed;
});

declare const modelSettings: LyraModelSettingsPanel;
modelSettings.addEventListener('lyra-change', (event) => {
  const temperature: number = event.detail.temperature;
  void temperature;
});

declare const sourceList: LyraSourceList;
sourceList.addEventListener('lyra-toggle', (event) => {
  const expanded: boolean = event.detail.expanded;
  void expanded;
});

declare const thinkingPanel: LyraThinkingPanel;
thinkingPanel.addEventListener('lyra-toggle', (event) => {
  const expanded: boolean = event.detail.expanded;
  void expanded;
});

declare const menuItem: LyraMenuItem;
menuItem.addEventListener('lyra-menu-item-change', (event) => {
  const checked: boolean = event.detail.checked;
  const value: string = event.detail.value;
  void checked;
  void value;
});

declare const split: LyraSplit;
split.addEventListener('lyra-split-collapse-change', (event) => {
  const state: 'wide' | 'rail' | 'floating' = event.detail.state;
  void state;
});
split.addEventListener('lyra-split-constraints-invalid', (event) => {
  const panelCount: number = event.detail.panelCount;
  void panelCount;
});

declare const slider: LyraSlider;
slider.addEventListener('lyra-change', (event) => {
  const value: number = event.detail.value;
  void value;
});

declare const toggle: LyraSwitch;
toggle.addEventListener('lyra-change', (event) => {
  const checked: boolean = event.detail.checked;
  void checked;
});

declare const table: LyraTable<{ id: string }>;
table.addEventListener('lyra-row-click', (event) => {
  const id: string = event.detail.row.id;
  void id;
});

declare const form: LyraToolParamForm;
form.addEventListener('lyra-validity-change', (event) => {
  const valid: boolean = event.detail.valid;
  const message: string | undefined = event.detail.errors.prompt;
  void valid;
  void message;
});

declare const list: LyraVirtualList;
list.addEventListener('lyra-visible-range-changed', (event) => {
  const start: number = event.detail.start;
  const end: number = event.detail.end;
  void start;
  void end;
});
