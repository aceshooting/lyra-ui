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
    /* No-data cell fill (the -1 sentinel / NaN case) — same resolve-via-
       getComputedStyle pattern as the ramp endpoints above, so hosts can
       retheme it instead of it being a hardcoded literal in heatmap.ts. */
    --lyra-heatmap-no-data-fill: rgba(128, 128, 128, 0.25);
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
