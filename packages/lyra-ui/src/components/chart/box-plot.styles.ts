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
    block-size: var(--lyra-chart-height, 280px);
  }
  [part='base'] {
    position: relative;
    inline-size: 100%;
    block-size: 100%;
  }
  canvas {
    inline-size: 100% !important;
    block-size: 100% !important;
  }
`;
