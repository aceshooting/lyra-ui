import { css } from 'lit';

export const styles = css`
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
  [part='map'] {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    cursor: pointer;
  }
  /* Mouse-hover cue matching the cursor: pointer affordance above -- mirrors the reveal-button/
     copy-button/sources-summary brand-quiet hover tint used across the library for a clickable
     surface with no dedicated icon of its own. */
  [part='map']:hover {
    background: var(--lr-color-brand-quiet);
  }
  /* Clicking the map recenters the canvas viewport, and that jump is the only confirmation the user
     gets -- the pressed fill is what says the click landed on the map rather than on the viewport
     rect drawn over it. */
  [part='map']:active {
    background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='node'] {
    fill: var(--lr-flow-minimap-node-color, var(--lr-color-border-strong));
  }
  [part='node'][data-status='pending'] {
    fill: var(--lr-flow-minimap-node-pending-color, var(--lr-color-border-strong));
  }
  [part='node'][data-status='running'] {
    fill: var(--lr-flow-minimap-node-running-color, var(--lr-color-brand));
  }
  [part='node'][data-status='success'] {
    fill: var(--lr-flow-minimap-node-success-color, var(--lr-color-success));
  }
  [part='node'][data-status='error'] {
    fill: var(--lr-flow-minimap-node-error-color, var(--lr-color-danger));
  }
  [part='node'][data-status='denied'] {
    fill: var(--lr-flow-minimap-node-denied-color, var(--lr-color-warning));
  }
  [part='viewport'] {
    fill: color-mix(in srgb, var(--lr-color-brand) 15%, transparent);
    stroke: var(--lr-color-brand);
    stroke-width: 2;
    cursor: grab;
  }
  [part='viewport']:hover {
    fill: color-mix(in srgb, var(--lr-color-brand) 25%, transparent);
    stroke-width: 3;
  }
  /* The rect is a grab handle, so its pressed state is also its dragging state -- it stays applied
     for the whole gesture. Both channels step past the hovered values, and the cursor flips to
     grabbing, matching the [data-panning] treatment lr-flow-canvas gives its own background. */
  [part='viewport']:active {
    fill: color-mix(in srgb, var(--lr-color-brand) 40%, transparent);
    stroke-width: 4;
    cursor: grabbing;
  }
  [part='viewport']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
`;
