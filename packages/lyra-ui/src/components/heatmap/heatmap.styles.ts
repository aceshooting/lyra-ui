import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    /* Sequential ramp endpoints for the data-driven cell colors (canvas can't
       consume var() directly, so heatmap.ts resolves these via
       getComputedStyle and interpolates between them). Componentspecific
       business color per Global Constraints — exposed so hosts can retheme
       the ramp without raw hex leaking into the public API. */
    --lyra-heatmap-scale-lo: #cde2fb;
    --lyra-heatmap-scale-hi: #0969da;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-xs);
  }
  canvas {
    display: block;
    inline-size: 100%;
  }
  [part='legend'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    font-size: 0.75rem;
    color: var(--lyra-color-text-quiet);
  }
  [part='legend'] .bar {
    inline-size: 6rem;
    block-size: 0.5rem;
    border-radius: 2px;
    background: linear-gradient(
      to right,
      var(--lyra-heatmap-scale-lo),
      var(--lyra-heatmap-scale-hi)
    );
  }
`;
