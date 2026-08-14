import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    inline-size: 100%;
    block-size: var(--lr-audio-visualizer-height, var(--lr-size-3rem));
    --_lr-audio-visualizer-color-default: var(--lr-color-brand);
    --_lr-audio-visualizer-quiet-color-default: var(--lr-color-brand-quiet);
    --_lr-audio-visualizer-ambient-duration-default: var(--lr-duration-ambient);
  }
  [part='base'] {
    inline-size: 100%;
    block-size: 100%;
  }
  canvas {
    display: block;
    inline-size: 100%;
    block-size: 100%;
  }
`;
