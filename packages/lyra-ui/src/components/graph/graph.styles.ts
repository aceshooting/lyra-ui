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
    fill: var(--lyra-color-brand);
    cursor: pointer;
  }
  [part='node']:focus-visible {
    outline: 2px solid var(--lyra-color-brand);
  }
  [part='label'] {
    font-size: 10px;
    fill: var(--lyra-color-text);
    font-family: var(--lyra-font);
    pointer-events: none;
  }
`;
