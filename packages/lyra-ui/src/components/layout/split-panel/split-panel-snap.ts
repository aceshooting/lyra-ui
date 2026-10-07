import type { LyraSplitPanelSnapFunction } from './split-panel.class.js';

/** A snap function that returns the proposed position unchanged. */
export const SNAP_NONE: LyraSplitPanelSnapFunction = ({ pos }) => pos;
