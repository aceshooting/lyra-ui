import {
  LyraSlider,
  LyraSwitch,
  LyraTable,
  LyraToolParamForm,
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
