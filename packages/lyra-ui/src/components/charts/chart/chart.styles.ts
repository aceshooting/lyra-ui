import { focusRing } from '../../../internal/interactive-control.styles.js';
import { css } from 'lit';
import { mediumContainerQuery } from '../../../internal/container-breakpoints.styles.js';

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
    grid-template-areas:
      'plot'
      'legend'
      'warning'
      'table-toggle'
      'table';
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
  }
  .config-slot {
    display: none;
  }

  [part='notices'] {
    grid-area: warning;
    display: grid;
    gap: var(--lr-space-2xs);
  }
  [part='feature-warning'],
  [part='data-truncation'] {
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
      'warning'
      'table-toggle'
      'table';
  }
  /* Column 1 vs column 2, not physical left vs right: a grid numbers columns along the inline axis,
     so this pair mirrors itself under dir=rtl. The host resolves every legend-position value
     (logical alias, physical edge, or auto) into the column that lands on the intended physical
     edge after that mirror -- see legendGridPlacement(). */
  [part='base']:where([data-legend-position='inline-start']) {
    grid-template-areas:
      'legend plot'
      'warning warning'
      'table-toggle table-toggle'
      'table table';
    grid-template-columns:
      minmax(0, min(33cqi, var(--lr-chart-legend-side-max, var(--lr-size-15rem))))
      minmax(0, 1fr);
  }
  [part='base']:where([data-legend-position='inline-end']) {
    grid-template-areas:
      'plot legend'
      'warning warning'
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
        'warning'
        'table-toggle'
        'table';
      grid-template-columns: minmax(0, 1fr);
    }
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
    background: var(--lr-chart-data-table-button-hover-bg, var(--lr-color-brand-quiet));
  }
  [part='data-table'] button:active {
    background: var(
      --lr-chart-data-table-button-active-bg,
      color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active))
    );
  }
  [part='data-table'] button:focus-visible {
    ${focusRing}
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
    max-inline-size: calc(100% - var(--lr-space-xs) - var(--lr-space-xs));
    white-space: normal;
    overflow-wrap: anywhere;
    cursor: pointer;
  }
  [part='reset-zoom-button']:hover {
    background: var(--lr-chart-reset-zoom-button-hover-bg, var(--lr-color-brand-quiet));
  }
  [part='reset-zoom-button']:active {
    background: var(
      --lr-chart-reset-zoom-button-active-bg,
      color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active))
    );
  }
  [part='reset-zoom-button']:focus-visible {
    ${focusRing}
  }

  [part='data-table-toggle']:hover {
    background: var(--lr-chart-data-table-toggle-hover-bg, var(--lr-color-brand-quiet));
  }
  [part='data-table-toggle']:active {
    background: var(
      --lr-chart-data-table-toggle-active-bg,
      color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active))
    );
  }
`;
