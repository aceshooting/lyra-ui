import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    /* Categorical palette for words with no explicit color/group, cycled by
       index (and reused per-group once a group's first color is assigned).
       Data-driven literals, same rationale as lyra-heatmap's
       --lyra-heatmap-scale-lo/-hi -- exposed as retheme-able custom
       properties instead of hardcoded in word-cloud.ts. */
    --lyra-word-cloud-color-1: #0969da;
    --lyra-word-cloud-color-2: #1a7f37;
    --lyra-word-cloud-color-3: #9a6700;
    --lyra-word-cloud-color-4: #cf222e;
    --lyra-word-cloud-color-5: #8250df;
    --lyra-word-cloud-color-6: #bf3989;
    --lyra-word-cloud-color-7: #0a7d91;
    --lyra-word-cloud-color-8: #57606a;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-xs);
  }
  svg {
    display: block;
    inline-size: 100%;
    block-size: 100%;
  }
  svg:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='word'] {
    cursor: pointer;
    font-family: var(--lyra-font);
    font-weight: 600;
    text-anchor: middle;
    dominant-baseline: middle;
    transition: text-decoration-color var(--lyra-transition-fast);
    text-decoration: underline transparent;
  }
  [part='word']:hover {
    text-decoration-color: currentColor;
  }
  [part='focus-ring'] {
    fill: none;
    stroke: var(--lyra-focus-ring-color);
    stroke-width: 2px;
    pointer-events: none;
  }
  [part='empty'] {
    color: var(--lyra-color-text-quiet);
    font-size: 0.875rem;
  }
`;
