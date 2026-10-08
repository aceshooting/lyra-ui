import { focusRing } from '../../../internal/interactive-control.styles.js';
import { css } from 'lit';
import { chartLegendPositionStyles } from './chart-surface.styles.js';

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

  ${chartLegendPositionStyles('warning')}

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
