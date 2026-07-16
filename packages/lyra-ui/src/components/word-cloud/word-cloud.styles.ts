import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    /* Categorical palette for words with no explicit color/group, cycled by
       index (and reused per-group once a group's first color is assigned).
       Data-driven literals, same rationale as lyra-heatmap's
       --lyra-heatmap-scale-lo/-hi -- exposed as retheme-able custom
       properties instead of hardcoded in word-cloud.ts. */
    --lyra-word-cloud-color-1: var(--lyra-color-brand);
    --lyra-word-cloud-color-2: var(--lyra-color-success);
    --lyra-word-cloud-color-3: var(--lyra-color-warning);
    --lyra-word-cloud-color-4: var(--lyra-color-danger);
    --lyra-word-cloud-color-5: var(--lyra-color-chart-1);
    --lyra-word-cloud-color-6: var(--lyra-color-chart-2);
    --lyra-word-cloud-color-7: var(--lyra-color-chart-3);
    --lyra-word-cloud-color-8: var(--lyra-color-chart-4);
  }
  @media (prefers-color-scheme: dark) {
    :host {
      /* Colors 1-4 alias the semantic tokens (--lyra-color-brand/-success/-warning/-danger),
         which already flip to their dark-mode fill in tokens.styles.ts -- redeclaring them
         here would just repeat the same resolved value, not add a variant. Only the
         chart-ramp colors (5-8) need an explicit dark swap: they draw from a fixed 4-color
         segment of the categorical --lyra-color-chart-* ramp, and the ramp's *next* segment
         (5-8) is the one tuned for dark backgrounds, so the swap is a deliberate palette
         change rather than a token-layer duplicate. */
      --lyra-word-cloud-color-5: var(--lyra-color-chart-5);
      --lyra-word-cloud-color-6: var(--lyra-color-chart-6);
      --lyra-word-cloud-color-7: var(--lyra-color-chart-7);
      --lyra-word-cloud-color-8: var(--lyra-color-chart-8);
    }
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-xs);
    block-size: 100%;
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
    font-weight: var(--lyra-font-weight-semibold);
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
    stroke-width: var(--lyra-focus-ring-width);
    pointer-events: none;
  }
  [part='empty'] {
    color: var(--lyra-color-text-quiet);
    font-size: var(--lyra-font-size-md-sm);
  }
  @media (prefers-reduced-motion: reduce) {
    [part='word'] {
      transition: none !important;
    }
  }
  @media (forced-colors: active) {
    [part='word'] {
      fill: CanvasText;
    }
    [part='focus-ring'] {
      stroke: Highlight;
    }
  }
`;
