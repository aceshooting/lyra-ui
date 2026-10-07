import { css } from 'lit';
import { flowStatusPaint } from '../flow-canvas/flow-status.styles.js';

export const styles = css`
  ${flowStatusPaint}
  :host {
    display: block;
    inline-size: var(--lr-flow-minimap-inline-size, var(--lr-size-12rem));
    block-size: var(--lr-flow-minimap-block-size, var(--lr-size-8rem));
  }
  [part='base'] {
    inline-size: 100%;
    block-size: 100%;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    overflow: hidden;
  }
  /* Chrome-less escape, mirroring the shared LyraFrame vocabulary's frame="plain" (lr-flow-controls,
     lr-flow-run-status): a minimap embedded in a host toolbar or panel that already draws its own
     border/background doubles the frame. Only the box decoration goes -- overflow: hidden stays,
     since it clips the map/viewport geometry rather than decorating the surface. */
  :host([frame='plain']) [part='base'] {
    border: 0;
    border-radius: 0;
    background: transparent;
  }
  [part='map'] {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    cursor: pointer;
    /* Hover/active below only repaint background, so that is all this needs; without it this
       map's fill snaps while lr-button/lr-icon-button ease. */
    transition: background-color var(--lr-transition-fast);
  }
  /* Mouse-hover cue matching the cursor: pointer affordance above -- the reveal-button/copy-button/
     sources-summary brand-quiet tint the library uses for a clickable surface with no dedicated
     icon of its own. */
  [part='map']:hover {
    background: var(--lr-color-brand-quiet);
  }
  /* Clicking the map recenters the canvas viewport, and that jump is the only confirmation -- the
     pressed fill says the click landed on the map rather than on the viewport rect drawn over it.
     */
  [part='map']:active {
    background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='base'][data-locked] [part='map'] {
    cursor: default;
  }
  [part='base'][data-locked] [part='map']:hover,
  [part='base'][data-locked] [part='map']:active {
    background: transparent;
  }
  [part='node'] {
    fill: var(--_lr-flow-status-paint, var(--lr-flow-status-color, var(--lr-color-border-strong)));
  }
  [part='viewport'] {
    --_lr-flow-minimap-viewport: var(--lr-flow-minimap-viewport-color, var(--lr-color-brand));
    fill: color-mix(in srgb, var(--_lr-flow-minimap-viewport) 15%, transparent);
    stroke: var(--_lr-flow-minimap-viewport);
    stroke-width: 2;
    pointer-events: none;
  }
  [part='viewport-hit-area'] {
    fill: transparent;
    stroke: transparent;
    pointer-events: all;
    cursor: grab;
  }
  [data-viewport-control]:hover [part='viewport'] {
    fill: color-mix(in srgb, var(--_lr-flow-minimap-viewport) 25%, transparent);
    stroke-width: 3;
  }
  /* The rect is a grab handle, so its pressed state is also its dragging state and stays applied
     for the whole gesture. Both channels step past the hover values and the cursor flips to
     grabbing, matching the [data-panning] treatment lr-flow-canvas gives its own background. */
  [data-viewport-control]:has([part='viewport-hit-area']:active) [part='viewport'] {
    fill: color-mix(in srgb, var(--_lr-flow-minimap-viewport) 40%, transparent);
    stroke-width: 4;
  }
  [part='viewport-hit-area']:active {
    cursor: grabbing;
  }
  [part='viewport-hit-area']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='base'][data-locked] [part='viewport-hit-area'] {
    cursor: default;
    pointer-events: none;
  }
  [part='base'][data-locked] [data-viewport-control]:hover [part='viewport'] {
    fill: color-mix(in srgb, var(--_lr-flow-minimap-viewport) 15%, transparent);
    stroke-width: 2;
  }
`;
