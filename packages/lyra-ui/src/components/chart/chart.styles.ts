import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    position: relative;
    inline-size: 100%;
    min-inline-size: 0;
    block-size: var(--lyra-chart-height, var(--lyra-size-280px));
    /* Chart.js renders to canvas, not the DOM, so it can't consume CSS
       var() directly — chart.ts's themeColors() resolves these once per
       draw() via getComputedStyle, same pattern as heatmap.ts's scale-lo/-hi.
       Each is its own token (rather than reusing the semantic ones directly)
       so a host can retheme just the chart's grid/ticks/legend/tooltip
       without affecting unrelated text/border/surface colors elsewhere in
       the component, while still defaulting to those semantic tokens. */
    --lyra-chart-grid-color: var(--lyra-color-border);
    --lyra-chart-tick-color: var(--lyra-color-text-quiet);
    --lyra-chart-legend-color: var(--lyra-color-text);
    --lyra-chart-tooltip-bg: var(--lyra-color-surface);
    --lyra-chart-tooltip-text: var(--lyra-color-text);
  }
  [part='base'] {
    position: relative;
    inline-size: 100%;
    block-size: 100%;
  }
  lyra-skeleton {
    --lyra-skeleton-w: 100%;
    --lyra-skeleton-h: 100%;
  }
  canvas {
    inline-size: 100% !important;
    block-size: 100% !important;
  }
  [part='reset-zoom-button'] {
    position: absolute;
    inset-block-start: var(--lyra-space-xs);
    inset-inline-end: var(--lyra-space-xs);
    font-size: var(--lyra-font-size-xs);
    padding: var(--lyra-size-0-15rem) var(--lyra-size-0-5rem);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    cursor: pointer;
  }
  [part='reset-zoom-button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
`;
