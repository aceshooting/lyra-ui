import { LyraSplitPanel } from '../src/lyra.js';
import { LyraSplitPanel as LayoutLyraSplitPanel } from '../src/components/layout/index.js';
import type {
  LyraSplitPanelEventMap,
  SnapFunction,
  SnapFunctionParams,
  SplitPanelOrientation,
  SplitPanelPrimary,
  SplitPanelSnapFunction,
} from '../src/lyra.js';

const layoutConstructor: typeof LyraSplitPanel = LayoutLyraSplitPanel;
void layoutConstructor;

const snap: SnapFunction = ({ pos, size, snapThreshold }) =>
  Math.min(size, Math.max(0, Math.round(pos / snapThreshold) * snapThreshold));
const qualifiedSnap: SplitPanelSnapFunction = snap;
const snapParams: SnapFunctionParams = {
  pos: 120,
  size: 480,
  snapThreshold: 12,
};
// `SplitPanelSnapFunctionOptions`/`SplitPanelSnapFunctionParams` were removed in 9.0.0: both were
// bare aliases of `SnapFunctionParams`, which is the one exported name for a snap callback's
// argument. A stale import of either is now a compile error, not a silent behavior change.
void qualifiedSnap;
void snapParams;

declare const panel: LyraSplitPanel;
panel.position = 35;
panel.positionInPixels = 240;
panel.orientation = 'vertical';
panel.vertical = false;
panel.primary = 'end';
panel.snap = snap;
panel.snapThreshold = 8;

const orientation: SplitPanelOrientation = panel.orientation;
const primary: SplitPanelPrimary | undefined = panel.primary;
void orientation;
void primary;

panel.addEventListener('lr-reposition', (event) => {
  const detail: undefined = event.detail;
  void detail;
});

const repositionEvent: LyraSplitPanelEventMap['lr-reposition'] | undefined = undefined;
void repositionEvent;
