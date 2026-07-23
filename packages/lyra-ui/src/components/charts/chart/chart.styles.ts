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
  [part='canvas'] {
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
  }
  [part='canvas']:hover {
    outline: var(--lr-border-width-thin) solid var(--lr-chart-grid-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='canvas']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='data-table'] button {
    font: inherit;
    color: inherit;
    border: 0;
    border-radius: var(--lr-radius);
    background: transparent;
    padding: var(--lr-space-2xs);
    cursor: pointer;
  }
  [part='data-table'] button:hover {
    background: var(--lr-color-brand-quiet);
  }
  [part='data-table'] button:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
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
    font: inherit;
    font-size: var(--lr-font-size-xs);
    padding: var(--lr-size-0-15rem) var(--lr-size-0-5rem);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    cursor: pointer;
  }
  [part='reset-zoom-button']:hover {
    background: var(--lr-color-brand-quiet);
  }
  [part='reset-zoom-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* Mirrors map.styles.ts's identical [part='error'] treatment for the same "optional
     peer dependency missing" failure shape. */
  [part='error'] {
    margin: 0;
    padding: var(--lr-space-l);
    color: var(--lr-color-danger);
    font-size: var(--lr-font-size-md-sm);
    text-align: center;
  }
`;
