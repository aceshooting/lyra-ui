import { css } from 'lit';
import { forcedColorLegendSwatchStyles } from './chart-forced-colors.js';

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
    min-block-size: var(--lr-chart-height, var(--_lr-chart-height, var(--lr-size-280px)));
    block-size: auto;
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-20rem);
    /* Same theme tokens as chart.styles.ts's :host — Chart.js renders to
       canvas, not the DOM, so it can't consume CSS var() directly;
       box-plot.ts's themeColors() resolves these once per draw() via
       getComputedStyle, mirroring chart.ts. Each is its own token (rather
       than reusing the semantic ones directly) so a host can retheme just
       the chart's grid/ticks/legend/tooltip without affecting unrelated
       text/border/surface colors elsewhere in the component, while still
       defaulting to those semantic tokens. */
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
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      'plot'
      'legend'
      'notice'
      'table';
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
  [part='data-table'] table {
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
  [part='data-truncation'] {
    grid-area: notice;
    margin: 0;
    padding: var(--lr-space-xs);
    color: var(--lr-color-warning);
    font-size: var(--lr-font-size-sm);
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
    /* Both axes, matching <lr-chart>'s legend item: a short series name leaves the swatch+label
       pair narrower than the min-inline-size hit-area floor below, and the default
       justify-content (normal => flex-start) dumped that slack on the trailing side. */
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
  /* Pressed, matching <lr-chart>'s legend item: the same quiet brand tint pushed further toward
     the text colour, so the mousedown that toggles the series reads as distinct from hovering. */
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
      'notice'
      'table';
  }
  [part='base']:where([data-legend-position='inline-start']) {
    grid-template-areas:
      'legend plot'
      'notice notice'
      'table table';
    grid-template-columns:
      minmax(0, min(33cqi, var(--lr-chart-legend-side-max, var(--lr-size-15rem))))
      minmax(0, 1fr);
  }
  [part='base']:where([data-legend-position='inline-end']) {
    grid-template-areas:
      'plot legend'
      'notice notice'
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
        'notice'
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
  /* no-pressed-state: the canvas is a role="application" keyboard surface with no click handler of
     its own -- pressing it activates a box *inside* the bitmap, which no CSS rule can reach, and
     re-outlining the whole plot on mousedown would read as the entire chart being the target.
     Same treatment, and same rationale, as chart.styles.ts's canvas. */
  [part='canvas']:hover {
    /* Scoped so a consumer can retint/resize just this hover outline without also affecting every
       other --lr-border-width-thin consumer on the page -- the same indirection rationale as the
       --lr-chart-grid-color/-tick-color/etc. block above, applied to a state-specific rule. */
    outline: var(--lr-chart-canvas-hover-outline-width, var(--lr-border-width-thin)) solid
      var(--lr-chart-grid-color, var(--_lr-chart-grid-color));
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='canvas']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
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
