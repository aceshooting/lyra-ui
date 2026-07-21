import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    /* Categorical palette for words with no explicit color/group, cycled by
       index (and reused per-group once a group's first color is assigned).
       Data-driven literals, same rationale as lr-heatmap's
       --lr-heatmap-scale-lo/-hi -- exposed as retheme-able custom
       properties instead of hardcoded in word-cloud.ts. */
    --lr-word-cloud-color-1: var(--lr-color-brand);
    --lr-word-cloud-color-2: var(--lr-color-success);
    --lr-word-cloud-color-3: var(--lr-color-warning);
    --lr-word-cloud-color-4: var(--lr-color-danger);
    --lr-word-cloud-color-5: var(--lr-color-chart-1);
    --lr-word-cloud-color-6: var(--lr-color-chart-2);
    --lr-word-cloud-color-7: var(--lr-color-chart-3);
    --lr-word-cloud-color-8: var(--lr-color-chart-4);
  }
  @media (prefers-color-scheme: dark) {
    :host {
      /* Colors 1-4 alias the semantic tokens (--lr-color-brand/-success/-warning/-danger),
         which already flip to their dark-mode fill in tokens.styles.ts -- redeclaring them
         here would just repeat the same resolved value, not add a variant. Only the
         chart-ramp colors (5-8) need an explicit dark swap: they draw from a fixed 4-color
         segment of the categorical --lr-color-chart-* ramp, and the ramp's *next* segment
         (5-8) is the one tuned for dark backgrounds, so the swap is a deliberate palette
         change rather than a token-layer duplicate. */
      --lr-word-cloud-color-5: var(--lr-color-chart-5);
      --lr-word-cloud-color-6: var(--lr-color-chart-6);
      --lr-word-cloud-color-7: var(--lr-color-chart-7);
      --lr-word-cloud-color-8: var(--lr-color-chart-8);
    }
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    block-size: 100%;
  }
  svg {
    display: block;
    inline-size: 100%;
    block-size: 100%;
  }
  svg:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='word'] {
    cursor: pointer;
    font-family: var(--lr-font);
    font-weight: var(--lr-font-weight-semibold);
    text-anchor: middle;
    dominant-baseline: middle;
    transition: text-decoration-color var(--lr-transition-fast);
    text-decoration: underline transparent;
  }
  [part='word']:hover {
    text-decoration-color: currentColor;
  }
  [part='focus-ring'] {
    fill: none;
    stroke: var(--lr-focus-ring-color);
    stroke-width: var(--lr-focus-ring-width);
    pointer-events: none;
  }
  [part='empty'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-md-sm);
  }
  [part='legend'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-s);
    align-items: center;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }
  [part='legend-item'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-2xs);
  }
  [part='legend-swatch'] {
    inline-size: var(--lr-size-0-75rem);
    block-size: var(--lr-size-0-75rem);
    border-radius: var(--lr-radius-xs);
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
