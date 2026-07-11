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
    stroke: var(--lyra-color-border);
    fill: none;
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
    font-size: 10px;
    fill: var(--lyra-color-text);
    font-family: var(--lyra-font);
    pointer-events: none;
  }
`;
