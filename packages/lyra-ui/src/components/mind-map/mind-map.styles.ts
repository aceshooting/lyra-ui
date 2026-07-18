import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --lyra-mind-map-ring-gap: var(--lyra-size-6rem);
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
    stroke: var(--lyra-color-border);
    stroke-width: 1.5;
  }
  [part='node'] {
    cursor: pointer;
    transition: transform var(--lyra-transition-base);
  }
  [part='node'] circle {
    fill: var(--lyra-color-brand);
  }
  [part='node-label'] {
    fill: var(--lyra-color-text);
    font-size: var(--lyra-font-size-sm);
  }
  [part='focus-ring'] {
    fill: none;
    stroke: var(--lyra-focus-ring-color);
    stroke-width: var(--lyra-focus-ring-width);
  }
  [part='empty'] {
    padding: var(--lyra-space-m);
    color: var(--lyra-color-text-quiet);
  }
`;
