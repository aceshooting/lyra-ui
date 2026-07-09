import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    inline-size: 6em;
    block-size: 1.5em;
    vertical-align: middle;
  }
  svg {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    overflow: visible;
  }
  [part='line'] {
    fill: none;
    stroke: var(--lyra-color-brand);
    stroke-width: 1.5;
    stroke-linejoin: round;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
  }
  [part='area'] {
    fill: var(--lyra-color-brand);
    opacity: 0.15;
    stroke: none;
  }
  [part='bar'] {
    fill: var(--lyra-color-brand);
  }
`;
