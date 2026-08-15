import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --_lr-mind-map-ring-gap: var(--lr-size-6rem);
  }
  [part="base"] {
    display: block;
  }
  [part="svg"] {
    display: block;
    inline-size: 100%;
    block-size: 100%;
  }
  [part="svg"]:focus-visible {
    outline: none;
  }
  [part="link"] {
    stroke: var(--lr-color-border);
    stroke-width: 1.5;
  }
  [part="node"] {
    cursor: pointer;
    transition: transform var(--lr-transition-base);
  }
  .node-hit {
    fill: none;
    stroke: transparent;
    stroke-width: var(--lr-icon-button-size);
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
    pointer-events: stroke;
  }
  [part="node"] circle {
    fill: var(--lr-color-brand);
    stroke: transparent;
    stroke-width: var(--lr-space-xs);
    transition: stroke var(--lr-transition-fast);
  }
  [part="node"]:hover circle {
    stroke: var(--lr-mind-map-node-hover-halo, var(--lr-color-brand-quiet));
  }
  /* Pressed is the same halo pushed one step toward --lr-color-mix-partner, so it stays whatever
     hue a consumer set --lr-mind-map-node-hover-halo to while reading as visibly held. */
  [part="node"]:active circle {
    stroke: color-mix(
      in oklab,
      var(--lr-mind-map-node-hover-halo, var(--lr-color-brand-quiet)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part="node-label"] {
    fill: var(--lr-color-text);
    font-size: var(--lr-font-size-sm);
  }
  [part="focus-ring"] {
    fill: none;
    stroke: var(--lr-focus-ring-color);
    stroke-width: var(--lr-focus-ring-width);
    pointer-events: none;
  }
  [part="empty"] {
    padding: var(--lr-space-m);
    color: var(--lr-color-text-quiet);
  }
`;
