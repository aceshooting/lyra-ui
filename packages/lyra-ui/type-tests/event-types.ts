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
