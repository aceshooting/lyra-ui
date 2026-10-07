import { css } from 'lit';
import { mediumContainerQuery } from '../../../internal/container-breakpoints.styles.js';

// Deliberately its own sheet rather than a wholesale re-export of
// `chart.styles.ts`: unlike `lr-histogram`, `LyraBoxPlot` doesn't extend
// `LyraChart`, has no `zoomable` property, and its `render()` never emits a
// `part="reset-zoom-button"` element — so that rule (and any other
// `lr-chart`-only chrome) has no home here.
export const styles = css`
  [part='base'] {
    position: relative;
    inline-size: 100%;
    min-inline-size: 0;
    /* :host's block-size stays auto (a chart shrink-wraps to its content by default), but a
       CSS-Grid/flex-stretched host (default align-items: stretch) grows taller than that content --
       without this, [part='base'] keeps shrink-wrapping instead of filling the stretched host,
       leaving dead space below the chart. Same fix as lr-card/lr-stat/lr-word-cloud/
       lr-context-meter's own [part='base']. */
    block-size: 100%;
    box-sizing: border-box;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      'plot'
      'legend'
      'notice'
      'table-toggle'
      'table';
  }

  [part='data-truncation'] {
    grid-area: notice;
    margin: 0;
    padding: var(--lr-space-xs);
    color: var(--lr-color-warning);
    font-size: var(--lr-font-size-sm);
    overflow-wrap: anywhere;
  }
  [part='base']:where([data-legend-position='top']) {
    grid-template-areas:
      'legend'
      'plot'
      'notice'
      'table-toggle'
      'table';
  }
  [part='base']:where([data-legend-position='inline-start']) {
    grid-template-areas:
      'legend plot'
      'notice notice'
      'table-toggle table-toggle'
      'table table';
    grid-template-columns:
      minmax(0, min(33cqi, var(--lr-chart-legend-side-max, var(--lr-size-15rem))))
      minmax(0, 1fr);
  }
  [part='base']:where([data-legend-position='inline-end']) {
    grid-template-areas:
      'plot legend'
      'notice notice'
      'table-toggle table-toggle'
      'table table';
    grid-template-columns:
      minmax(0, 1fr)
      minmax(0, min(33cqi, var(--lr-chart-legend-side-max, var(--lr-size-15rem))));
  }
  @container ${mediumContainerQuery} {
    [part='base']:where([data-legend-position='inline-start']),
    [part='base']:where([data-legend-position='inline-end']) {
      grid-template-areas:
        'plot'
        'legend'
        'notice'
        'table-toggle'
        'table';
      grid-template-columns: minmax(0, 1fr);
    }
  }

  [part='data-table-toggle']:hover {
    background: var(
      --lr-box-plot-data-table-toggle-hover-bg,
      var(--lr-chart-data-table-toggle-hover-bg, var(--lr-color-brand-quiet))
    );
  }
  [part='data-table-toggle']:active {
    background: var(
      --lr-box-plot-data-table-toggle-active-bg,
      var(
        --lr-chart-data-table-toggle-active-bg,
        color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active))
      )
    );
  }
`;
