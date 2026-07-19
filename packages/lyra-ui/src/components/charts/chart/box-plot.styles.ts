import { css } from 'lit';

// Deliberately its own sheet rather than a wholesale re-export of
// `chart.styles.ts`: unlike `lr-histogram`, `LyraBoxPlot` doesn't extend
// `LyraChart`, has no `zoom` property, and its `render()` never emits a
// `part="reset-zoom-button"` element — so that rule (and any other
// `lr-chart`-only chrome) has no home here.
export const styles = css`
  :host {
    display: block;
    position: relative;
    inline-size: 100%;
    min-inline-size: 0;
    block-size: var(--lr-chart-height, var(--lr-size-280px));
    /* Same theme tokens as chart.styles.ts's :host — Chart.js renders to
       canvas, not the DOM, so it can't consume CSS var() directly;
       box-plot.ts's themeColors() resolves these once per draw() via
       getComputedStyle, mirroring chart.ts. Each is its own token (rather
       than reusing the semantic ones directly) so a host can retheme just
       the chart's grid/ticks/legend/tooltip without affecting unrelated
       text/border/surface colors elsewhere in the component, while still
       defaulting to those semantic tokens. */
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
`;
