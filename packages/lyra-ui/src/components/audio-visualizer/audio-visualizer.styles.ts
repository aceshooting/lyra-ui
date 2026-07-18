import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    inline-size: 100%;
    block-size: var(--lr-audio-visualizer-height, var(--lr-size-3rem));
    --lr-audio-visualizer-color: var(--lr-color-brand);
    --lr-audio-visualizer-quiet-color: var(--lr-color-brand-quiet);
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
