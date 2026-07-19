import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    inline-size: var(--lr-size-6em);
    block-size: var(--lr-size-1-5em);
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
    stroke: var(--lr-color-brand);
    stroke-width: var(--lr-sparkline-stroke-width, 1.5);
    stroke-linejoin: round;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
  }
  [part='area'] {
    fill: var(--lr-color-brand);
    opacity: var(--lr-sparkline-area-opacity, 0.15);
    stroke: none;
  }
  [part='bar'] {
    fill: var(--lr-color-brand);
  }
`;
