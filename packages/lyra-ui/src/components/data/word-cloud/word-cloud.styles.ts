import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    /* Categorical palette for words with no explicit color/group, cycled by index and reused
       per-group once a group's first color is assigned. Data-driven, so retheme-able custom
       properties rather than literals in word-cloud.ts, as with lr-heatmap's
       --lr-heatmap-scale-lo/-hi. */
    --_lr-word-cloud-color-1-default: var(--lr-color-brand);
    --_lr-word-cloud-color-2-default: var(--lr-color-success);
    --_lr-word-cloud-color-3-default: var(--lr-color-warning);
    --_lr-word-cloud-color-4-default: var(--lr-color-danger);
    --_lr-word-cloud-color-5-default: var(--lr-color-chart-1);
    --_lr-word-cloud-color-6-default: var(--lr-color-chart-2);
    --_lr-word-cloud-color-7-default: var(--lr-color-chart-3);
    --_lr-word-cloud-color-8-default: var(--lr-color-chart-4);
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
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    cursor: pointer;
  }
  svg:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='word'] {
    pointer-events: none;
    font-family: var(--lr-font);
    font-weight: var(--lr-font-weight-semibold);
    text-anchor: middle;
    dominant-baseline: middle;
    transition: text-decoration-color var(--lr-transition-fast);
    text-decoration: underline transparent;
  }
  [part='word'][data-hovered] {
    text-decoration-color: currentColor;
  }
  [part='focus-ring'] {
    fill: none;
    stroke: var(--lr-focus-ring-color);
    stroke-width: var(--lr-focus-ring-width);
    pointer-events: none;
  }
  [part='focus-ring'][data-pressed] {
    stroke-width: var(--lr-border-width-thick);
    stroke-dasharray: var(--lr-size-4px) var(--lr-size-2px);
  }
  [part='empty'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-md-sm);
  }
  [part='legend'] {
    display: flex;
    flex-wrap: wrap;
    min-inline-size: 0;
    max-inline-size: 100%;
    gap: var(--lr-space-s);
    align-items: center;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }
  [part='legend-item'] {
    display: inline-flex;
    align-items: center;
    min-inline-size: 0;
    max-inline-size: 100%;
    gap: var(--lr-space-2xs);
  }
  [part='legend-swatch'] {
    inline-size: var(--lr-size-0-75rem);
    block-size: var(--lr-size-0-75rem);
    border-radius: var(--lr-radius-xs);
    flex: none;
  }
  [part='legend-label'] {
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  [part='limit'],
  [part='legend-limit'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
    font-variant-numeric: tabular-nums;
    text-align: end;
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
    [part='focus-ring'][data-pressed] {
      fill: Highlight;
      fill-opacity: 0.2;
    }
  }
`;
