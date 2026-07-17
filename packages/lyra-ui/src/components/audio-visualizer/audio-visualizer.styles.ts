import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    inline-size: 100%;
    block-size: var(--lyra-audio-visualizer-height, var(--lyra-size-3rem));
    --lyra-audio-visualizer-color: var(--lyra-color-brand);
    --lyra-audio-visualizer-quiet-color: var(--lyra-color-brand-quiet);
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
