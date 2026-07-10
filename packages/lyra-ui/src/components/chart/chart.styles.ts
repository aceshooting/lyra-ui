import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    position: relative;
    block-size: var(--lyra-chart-height, 280px);
  }
  [part='base'] {
    position: relative;
    inline-size: 100%;
    block-size: 100%;
  }
  canvas {
    inline-size: 100% !important;
    block-size: 100% !important;
  }
  [part='reset-zoom-button'] {
    position: absolute;
    inset-block-start: var(--lyra-space-xs);
    inset-inline-end: var(--lyra-space-xs);
    font-size: 0.75rem;
    padding: 0.15rem 0.5rem;
    border: 1px solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    cursor: pointer;
  }
`;
