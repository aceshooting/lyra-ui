import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --lr-mind-map-ring-gap: var(--lr-size-6rem);
  }
  [part='base'] {
    display: block;
  }
  [part='svg'] {
    display: block;
    inline-size: 100%;
    block-size: 100%;
  }
  [part='svg']:focus-visible {
    outline: none;
  }
  [part='link'] {
    stroke: var(--lr-color-border);
    stroke-width: 1.5;
  }
  [part='node'] {
    cursor: pointer;
    transition: transform var(--lr-transition-base);
  }
  [part='node'] circle {
    fill: var(--lr-color-brand);
  }
  [part='node-label'] {
    fill: var(--lr-color-text);
    font-size: var(--lr-font-size-sm);
  }
  [part='focus-ring'] {
    fill: none;
    stroke: var(--lr-focus-ring-color);
    stroke-width: var(--lr-focus-ring-width);
  }
  [part='empty'] {
    padding: var(--lr-space-m);
    color: var(--lr-color-text-quiet);
  }
`;
