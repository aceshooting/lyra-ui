import { css } from 'lit';
import { forcedColorLegendSwatchStyles } from './chart-forced-colors.js';

export const styles = css`
  :host {
    display: block;
    position: relative;
    inline-size: 100%;
    min-inline-size: 0;
    min-block-size: var(--lr-chart-height, var(--_lr-chart-height, var(--lr-size-280px)));
    block-size: auto;
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-20rem);
    /* Chart.js renders to canvas, not the DOM, so it cannot consume a CSS var() -- chart.ts's
       themeColors() resolves these once per draw() via getComputedStyle, same pattern as
       heatmap.ts's scale-lo/-hi. Each has its own token, defaulting to a semantic one, so a host
       can retheme the chart's grid/ticks/legend/tooltip alone. */
    --_lr-chart-grid-color: var(--lr-color-border);
    --_lr-chart-tick-color: var(--lr-color-text-quiet);
    --_lr-chart-legend-color: var(--lr-color-text);
    --_lr-chart-tooltip-bg: var(--lr-color-surface);
    --_lr-chart-tooltip-text: var(--lr-color-text);
  }
  [part='base'] {
    position: relative;
    inline-size: 100%;
    min-inline-size: 0;
    display: grid;
    grid-template-areas:
      'plot'
      'legend'
      'warning'
      'table';
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
  }
  .config-slot {
    display: none;
  }
  [part='plot'] {
    grid-area: plot;
    position: relative;
    inline-size: 100%;
    block-size: var(--lr-chart-height, var(--_lr-chart-height, var(--lr-size-280px)));
    min-inline-size: 0;
  }
  [part='data-table'] {
    grid-area: table;
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-x: auto;
    overflow-y: hidden;
  }
  [part='data-table'][data-visually-hidden] {
    position: absolute;
    inline-size: var(--lr-size-1px);
    block-size: var(--lr-size-1px);
    overflow: clip;
    clip-path: inset(50%);
    white-space: nowrap;
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
  [part='data-table'] table {
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
  [part='legend'] {
    grid-area: legend;
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
    max-inline-size: 100%;
    padding-block: var(--lr-space-xs);
  }
  [part~='legend-item'] {
    display: inline-flex;
    align-items: center;
    /* Both axes: a short series name leaves the swatch+label pair narrower than the min-inline-size
       hit-area floor below, and the default justify-content (normal => flex-start) dumped that
       slack on the trailing side. A long name is safe -- overflow-wrap below wraps it, leaving no
       slack and making this a no-op. */
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    max-inline-size: 100%;
    border: 0;
    border-radius: var(--lr-radius);
    padding: var(--lr-space-2xs);
    gap: var(--lr-space-2xs);
    background: transparent;
    color: var(--lr-chart-legend-color, var(--_lr-chart-legend-color));
    font: inherit;
    text-align: start;
    overflow-wrap: anywhere;
    cursor: pointer;
  }
  [part~='legend-item']:where(:hover) {
    background: var(--lr-chart-legend-item-hover-bg, var(--lr-color-brand-quiet));
  }
  /* Pressed: the quiet brand tint pushed further toward the text colour, so the mousedown that
     toggles the series reads as distinct from merely pointing at it. */
  [part~='legend-item']:where(:active) {
    background: var(
      --lr-chart-legend-item-active-bg,
      color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active))
    );
  }
  [part~='legend-item']:where(:focus-visible) {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part~='legend-item']:where([part~='legend-item-hidden']) {
    text-decoration-line: line-through;
    text-decoration-thickness: var(--lr-border-width-medium);
  }
  [part='legend-swatch'] {
    inline-size: var(--lr-space-s);
    block-size: var(--lr-space-s);
    flex: 0 0 auto;
    border-radius: var(--lr-radius-xs);
  }
  ${forcedColorLegendSwatchStyles}
  [part='base']:where([data-legend-position='top']) {
    grid-template-areas:
      'legend'
      'plot'
      'warning'
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
      'table table';
    grid-template-columns:
      minmax(0, min(33cqi, var(--lr-chart-legend-side-max, var(--lr-size-15rem))))
      minmax(0, 1fr);
  }
  [part='base']:where([data-legend-position='inline-end']) {
    grid-template-areas:
      'plot legend'
      'warning warning'
      'table table';
    grid-template-columns:
      minmax(0, 1fr)
      minmax(0, min(33cqi, var(--lr-chart-legend-side-max, var(--lr-size-15rem))));
  }
  @container (max-width: 479px) {
    [part='base']:where([data-legend-position='inline-start']),
    [part='base']:where([data-legend-position='inline-end']) {
      grid-template-areas:
        'plot'
        'legend'
        'warning'
        'table';
      grid-template-columns: minmax(0, 1fr);
    }
  }
  lr-skeleton {
    --lr-skeleton-w: 100%;
    --lr-skeleton-h: var(--lr-chart-height, var(--_lr-chart-height, var(--lr-size-280px)));
  }
  canvas {
    inline-size: 100% !important;
    block-size: 100% !important;
  }
  [part='canvas'] {
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
  }
  /* no-pressed-state: the canvas is a role="application" keyboard surface with no click handler --
     a press activates a datum *inside* the bitmap, which no CSS rule can reach, and re-outlining
     the whole plot on mousedown would read as the entire chart being the target. */
  [part='canvas']:hover {
    /* Scoped so a consumer can retint or resize just this hover outline without affecting every
       other --lr-border-width-thin consumer on the page -- the --lr-chart-grid-color/-tick-color
       indirection above, applied to a state-specific rule. */
    outline: var(--lr-chart-canvas-hover-outline-width, var(--lr-border-width-thin)) solid
      var(--lr-chart-grid-color, var(--_lr-chart-grid-color));
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
    background: var(--lr-chart-data-table-button-hover-bg, var(--lr-color-brand-quiet));
  }
  [part='data-table'] button:active {
    background: var(
      --lr-chart-data-table-button-active-bg,
      color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active))
    );
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
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='data-table-toggle'] {
    align-self: flex-start;
    font: inherit;
    font-size: var(--lr-font-size-xs);
    min-block-size: var(--lr-icon-button-size);
    padding: var(--lr-size-0-15rem) var(--lr-size-0-5rem);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    max-inline-size: 100%;
    white-space: normal;
    overflow-wrap: break-word;
    cursor: pointer;
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
  [part='data-table-toggle']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* Mirrors map.styles.ts's identical [part='error'] treatment for the same "optional peer
     dependency missing" failure shape. */
  [part='error'] {
    margin: 0;
    padding: var(--lr-space-l);
    color: var(--lr-color-danger);
    font-size: var(--lr-font-size-md-sm);
    text-align: center;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
`;
