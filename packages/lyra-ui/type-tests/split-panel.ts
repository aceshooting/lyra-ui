import { LyraSplitPanel } from '../src/lyra.js';
import { LyraSplitPanel as LayoutLyraSplitPanel } from '../src/components/layout/index.js';
import type {
  LyraSplitPanelEventMap,
  LyraSplitPanelSnapFunction,
  LyraSplitPanelSnapFunctionParams,
  LyraSplitPanelOrientation,
  LyraSplitPanelPrimary,
} from '../src/lyra.js';

const layoutConstructor: typeof LyraSplitPanel = LayoutLyraSplitPanel;
void layoutConstructor;

const snap: LyraSplitPanelSnapFunction = ({ pos, size, snapThreshold }) =>
  Math.min(size, Math.max(0, Math.round(pos / snapThreshold) * snapThreshold));
const snapParams: LyraSplitPanelSnapFunctionParams = {
  pos: 120,
  size: 480,
  snapThreshold: 12,
};
// `SnapFunction`/`SnapFunctionParams`/`SplitPanelSnapFunction` (the latter an undocumented,
// unreferenced compatibility alias) were all renamed/removed in 9.0.0: the one canonical exported
// name for a snap callback and its argument are now `LyraSplitPanelSnapFunction` /
// `LyraSplitPanelSnapFunctionParams`. A stale import of any of the old names is now a compile
// error, not a silent behavior change.
void snapParams;

declare const panel: LyraSplitPanel;
panel.position = 35;
panel.positionInPixels = 240;
panel.orientation = 'vertical';
panel.vertical = false;
panel.primary = 'end';
panel.snap = snap;
panel.snapThreshold = 8;

const orientation: LyraSplitPanelOrientation = panel.orientation;
const primary: LyraSplitPanelPrimary | undefined = panel.primary;
void orientation;
void primary;

panel.addEventListener('lr-reposition', (event) => {
  const detail: null = event.detail;
  void detail;
});

const repositionEvent: LyraSplitPanelEventMap['lr-reposition'] | undefined = undefined;
void repositionEvent;
