import type {
  Chart3dType,
  LyraChart3dAxis,
  LyraChart3dCamera,
  LyraChart3dColumns,
  LyraChart3dEventMap,
  LyraChart3dRow,
  LyraChart3dSelectDetail,
} from '../src/lyra.js';
import type { LyraChart3d } from '../src/components/charts/chart-3d/chart-3d.class.js';

declare const chart: LyraChart3d;

const columns: LyraChart3dColumns = {
  ids: ['a', 'b'],
  x: new Float32Array(2),
  y: new Float32Array(2),
  z: new Float32Array(2),
  size: new Float32Array(2),
  category: new Uint16Array(2),
  categories: ['first'],
  labels: ['A', 'B'],
};
chart.data = columns;
chart.data = null;
// @ts-expect-error z is required: a chart without a third coordinate is rejected at compile time.
const missingZ: LyraChart3dColumns = { ids: ['a'], x: new Float32Array(1), y: new Float32Array(1) };
// @ts-expect-error the three coordinate columns must be Float32Array.
const doubleX: LyraChart3dColumns = { ids: ['a'], x: new Float64Array(1), y: new Float32Array(1), z: new Float32Array(1) };
// @ts-expect-error columns are immutable once published.
columns.ids = [];

const type: Chart3dType = 'bubble';
chart.type = type;
// @ts-expect-error only scatter, bubble and line exist.
chart.type = 'pie';
chart.engine = 'webgl';
// @ts-expect-error the renderer preference is builtin or webgl.
chart.engine = 'canvas';

const axis: LyraChart3dAxis = { label: 'Distance', unit: 'km' };
chart.xAxis = axis;
chart.yAxis = {};
const camera: LyraChart3dCamera = { yaw: 0, pitch: 0, distance: 5, target: { x: 0, y: 0, z: 0 } };
chart.camera = camera;
chart.camera = undefined;
chart.hiddenCategories = new Set([0, 2]);
// @ts-expect-error hidden categories are category indices, not names.
chart.hiddenCategories = new Set(['first']);
chart.selectedId = 'a';
chart.label = undefined;
const focused: boolean = chart.focusRow('a');
chart.fit();

const selection: LyraChart3dEventMap['lr-chart-row-select']['detail'] = { id: 'a', index: 0 };
const named: LyraChart3dSelectDetail = selection;
const moved: LyraChart3dEventMap['lr-camera-change']['detail'] = { camera };
const fallback: LyraChart3dEventMap['lr-engine-fallback']['detail'] = { from: 'webgl', to: 'list', reason: 'unsupported' };
const row: LyraChart3dRow = { id: 'a', index: 0, label: 'A', x: 0, y: 0, z: 0 };
// @ts-expect-error the selection detail has no label; read the row from the source columns.
const invalidSelection: LyraChart3dSelectDetail = { id: 'a', index: 0, label: 'A' };

void missingZ;
void doubleX;
void focused;
void named;
void moved;
void fallback;
void row;
void invalidSelection;
