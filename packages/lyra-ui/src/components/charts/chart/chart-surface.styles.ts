import { iconHitTarget, focusRing } from '../../../internal/interactive-control.styles.js';
import { css, unsafeCSS, type CSSResult } from 'lit';
import { mediumContainerQuery } from '../../../internal/container-breakpoints.styles.js';
import { forcedColorLegendSwatchStyles } from './chart-forced-colors.js';

export const chartSurfaceStyles = css`
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
    ${iconHitTarget}
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
    ${focusRing}
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

  :host {
    display: block;
    position: relative;
    inline-size: 100%;
    min-inline-size: 0;
    min-block-size: var(--lr-chart-height, var(--_lr-chart-height, var(--lr-size-280px)));
    block-size: auto;
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-20rem);

    --_lr-chart-grid-color: var(--lr-color-border-subtle);
    --_lr-chart-tick-color: var(--lr-color-text-quiet);

    --_lr-chart-tick-font-size: var(--lr-font-size-xs);
    --_lr-chart-legend-color: var(--lr-color-text);
    --_lr-chart-tooltip-bg: var(--lr-color-surface);
    --_lr-chart-tooltip-color: var(--lr-color-text);
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
  lr-skeleton {
    --lr-skeleton-w: 100%;
    --lr-skeleton-h: var(--lr-chart-height, var(--_lr-chart-height, var(--lr-size-280px)));
  }
  canvas {
    inline-size: 100% !important;
    block-size: 100% !important;
  }
  [part='canvas'] {
    ${iconHitTarget}
  }
  [part='canvas']:hover {

    outline: var(--lr-chart-canvas-hover-outline-width, var(--lr-border-width-thin)) solid
      var(
        --lr-chart-canvas-hover-outline-color,
        var(--lr-chart-grid-color, var(--lr-color-border))
      );
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='canvas']:active {
    outline-color: color-mix(
      in oklab,
      var(--lr-chart-canvas-hover-outline-color, var(--lr-chart-grid-color, var(--lr-color-border))),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part='canvas']:focus-visible {
    ${focusRing}
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
  [part='data-table-toggle'] {
    grid-area: table-toggle;
    align-self: flex-start;
    font: inherit;
    font-size: var(--lr-font-size-xs);
    ${iconHitTarget}
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
  [part='data-table-toggle']:focus-visible {
    ${focusRing}
  }
`;

/** Legend-position grid areas shared by the grid-based chart surfaces; `noticeArea` names the notice row. */
export function chartLegendPositionStyles(noticeArea: 'notice' | 'warning'): CSSResult {
  const area = unsafeCSS(noticeArea);
  return css`
  [part='base']:where([data-legend-position='top']) {
    grid-template-areas:
      'legend'
      'plot'
      '${area}'
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
      '${area} ${area}'
      'table-toggle table-toggle'
      'table table';
    grid-template-columns:
      minmax(0, min(33cqi, var(--lr-chart-legend-side-max, var(--lr-size-15rem))))
      minmax(0, 1fr);
  }
  [part='base']:where([data-legend-position='inline-end']) {
    grid-template-areas:
      'plot legend'
      '${area} ${area}'
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
        '${area}'
        'table-toggle'
        'table';
      grid-template-columns: minmax(0, 1fr);
    }
  }
`;
}
