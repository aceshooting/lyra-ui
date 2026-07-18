import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    position: relative;
    inline-size: 100%;
    min-inline-size: 0;
    block-size: var(--lr-chart-height, var(--lr-size-280px));
    /* Chart.js renders to canvas, not the DOM, so it can't consume CSS
       var() directly — chart.ts's themeColors() resolves these once per
       draw() via getComputedStyle, same pattern as heatmap.ts's scale-lo/-hi.
       Each is its own token (rather than reusing the semantic ones directly)
       so a host can retheme just the chart's grid/ticks/legend/tooltip
       without affecting unrelated text/border/surface colors elsewhere in
       the component, while still defaulting to those semantic tokens. */
    --lr-chart-grid-color: var(--lr-color-border);
    --lr-chart-tick-color: var(--lr-color-text-quiet);
    --lr-chart-legend-color: var(--lr-color-text);
    --lr-chart-tooltip-bg: var(--lr-color-surface);
    --lr-chart-tooltip-text: var(--lr-color-text);
  }
  [part='base'] {
    position: relative;
    inline-size: 100%;
    block-size: 100%;
  }
  lr-skeleton {
    --lr-skeleton-w: 100%;
    --lr-skeleton-h: 100%;
  }
  canvas {
    inline-size: 100% !important;
    block-size: 100% !important;
  }
  [part='center'] {
    position: absolute;
    transform: translate(-50%, -50%);
    pointer-events: none;
    text-align: center;
  }
  [part='reset-zoom-button'] {
    position: absolute;
    inset-block-start: var(--lr-space-xs);
    inset-inline-end: var(--lr-space-xs);
    font-size: var(--lr-font-size-xs);
    padding: var(--lr-size-0-15rem) var(--lr-size-0-5rem);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    cursor: pointer;
  }
  [part='reset-zoom-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
`;
