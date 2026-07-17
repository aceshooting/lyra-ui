import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  svg {
    display: block;
    inline-size: 100%;
    block-size: 100%;
  }
  [part='link'] {
    stroke: var(--lyra-link-color, var(--lyra-color-border));
    fill: none;
    cursor: pointer;
  }
  [part='arrowhead'] {
    fill: context-stroke;
  }
  [part='link']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='link'][data-dangling] {
    stroke-dasharray: var(--lyra-size-2px) var(--lyra-size-2px);
    opacity: var(--lyra-opacity-disabled);
  }
  [part='node'] {
    /* --lyra-node-fill is set inline per-node (see graph.ts) from GraphNode.color;
       falls back to the brand token when a node doesn't supply one. An inline
       style declaration always wins the cascade over this selector, so setting
       fill directly here (rather than via the presentation attribute) is what
       lets a per-node color actually take effect. */
    fill: var(--lyra-node-fill, var(--lyra-color-brand));
    cursor: pointer;
  }
  [part='node']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='label'] {
    font-size: var(--lyra-font-size-2xs);
    fill: var(--lyra-color-text);
    font-family: var(--lyra-font);
    pointer-events: none;
  }
  [part='link-label'] {
    font-size: var(--lyra-font-size-2xs);
    fill: var(--lyra-color-text);
    font-family: var(--lyra-font);
    pointer-events: none;
    paint-order: stroke;
    stroke: var(--lyra-graph-edge-label-halo, var(--lyra-color-surface));
    stroke-width: var(--lyra-size-3px);
  }
  g[data-edge-labels-hidden] [part='link-label'],
  g[data-edge-labels-hidden] [part='community-label'] {
    display: none;
  }
  [part='empty'] {
    color: var(--lyra-color-text-quiet);
    font-size: var(--lyra-font-size-md-sm);
  }
  [part='expand-indicator'] circle {
    fill: var(--lyra-color-surface);
    stroke: var(--lyra-color-border-strong);
    stroke-width: var(--lyra-size-1px);
  }
  [part='expand-indicator'] path {
    stroke: var(--lyra-color-text);
    stroke-width: var(--lyra-size-1px);
    fill: none;
  }
  [part='focus-halo'] {
    fill: none;
    stroke: var(--lyra-graph-focus-halo-color, var(--lyra-color-brand));
    stroke-width: var(--lyra-size-2px);
    pointer-events: none;
  }
  [part='node'][data-selected] {
    stroke: var(--lyra-graph-selected-color, var(--lyra-color-success));
    stroke-width: var(--lyra-size-2px);
  }
  [part='link'][data-selected] {
    stroke: var(--lyra-graph-selected-color, var(--lyra-color-success)) !important;
    stroke-width: var(--lyra-size-3px);
  }
  [part='hull'] {
    fill: var(--lyra-graph-hull-fill, var(--lyra-color-brand));
    stroke: var(--lyra-graph-hull-fill, var(--lyra-color-brand));
    stroke-width: calc(var(--lyra-size-24px) * 2);
    stroke-linejoin: round;
    stroke-linecap: round;
    opacity: var(--lyra-graph-hull-opacity, 0.12);
    cursor: pointer;
  }
  [part='hull']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='community-label'] {
    font-size: var(--lyra-font-size-2xs);
    fill: var(--lyra-color-text);
    font-family: var(--lyra-font);
    text-anchor: middle;
    pointer-events: none;
    paint-order: stroke;
    stroke: var(--lyra-graph-edge-label-halo, var(--lyra-color-surface));
    stroke-width: var(--lyra-size-3px);
  }
`;
