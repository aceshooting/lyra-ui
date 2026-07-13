import { css } from 'lit';

// Deliberately its own sheet rather than a wholesale re-export of
// `chart.styles.ts`: unlike `lyra-histogram`, `LyraBoxPlot` doesn't extend
// `LyraChart`, has no `zoom` property, and its `render()` never emits a
// `part="reset-zoom-button"` element — so that rule (and any other
// `lyra-chart`-only chrome) has no home here.
export const styles = css`
  :host {
    display: block;
    position: relative;
    block-size: var(--lyra-chart-height, var(--lyra-size-280px));
    /* Same theme tokens as chart.styles.ts's :host — Chart.js renders to
       canvas, not the DOM, so it can't consume CSS var() directly;
       box-plot.ts's themeColors() resolves these once per draw() via
       getComputedStyle, mirroring chart.ts. Each is its own token (rather
       than reusing the semantic ones directly) so a host can retheme just
       the chart's grid/ticks/legend/tooltip without affecting unrelated
       text/border/surface colors elsewhere in the component, while still
       defaulting to those semantic tokens. */
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
`;
