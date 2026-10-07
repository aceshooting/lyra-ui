export interface LyraSplitPanelSnapFunctionParams {
  /** Proposed position in pixels, measured from the primary panel's edge. */
  pos: number;
  /** Split-panel size in pixels along its resize axis. */
  size: number;
  /** The configured snap threshold in pixels. */
  snapThreshold: number;
}

export type LyraSplitPanelSnapFunction = (options: LyraSplitPanelSnapFunctionParams) => number;

/** A snap function that returns the proposed position unchanged. */
export const SNAP_NONE: LyraSplitPanelSnapFunction = ({ pos }) => pos;
