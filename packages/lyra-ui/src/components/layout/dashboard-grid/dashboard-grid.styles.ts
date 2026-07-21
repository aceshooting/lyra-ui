import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    /* Query container so the @container rule below reacts to this grid's own allocated inline
       size (a dashboard-grid is commonly embedded in a panel of varying width, not the viewport)
       -- same convention as lr-button-group/lr-control-group's own container-query approach. */
    container-type: inline-size;
    min-inline-size: 0;
  }

  [part='base'] {
    display: grid;
    grid-template-columns: repeat(var(--lr-dashboard-grid-columns, 12), minmax(0, 1fr));
    grid-auto-rows: var(--lr-dashboard-grid-row-height, var(--lr-size-5rem));
    gap: var(--lr-dashboard-grid-gap, var(--lr-space-m));
    align-items: stretch;
  }

  [part='empty'] {
    grid-column: 1 / -1;
  }

  [part='cell'] {
    position: relative;
    display: flex;
    min-inline-size: 0;
    min-block-size: 0;
    border-radius: var(--lr-radius);
  }

  /* A cell's slotted content (default lr-widget, or a consumer's own opaque markup) commonly
     fills the whole cell -- a background-color hover would paint underneath it and never be
     seen. An outline draws outside the box like [part='cell'][data-collision]'s own outline
     below, so it stays visible above any occluding content, matching the :focus-visible ring's
     own reliably-visible treatment for the exact same real, keyboard-navigable/draggable
     target. */
  [part='cell']:hover {
    outline: var(--lr-border-width-thin) solid
      var(--lr-dashboard-grid-cell-hover-outline-color, var(--lr-color-border-strong));
    outline-offset: calc(-1 * var(--lr-border-width-thin));
  }

  [part='cell']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part='cell'] ::slotted(*) {
    min-inline-size: 0;
    min-block-size: 0;
    inline-size: 100%;
  }

  [part='cell'][data-dragging],
  [part='cell'][data-resizing] {
    z-index: var(--lr-layer-content);
    box-shadow: var(--lr-shadow);
  }

  [part='cell'][data-collision] {
    outline: var(--lr-size-2px) solid var(--lr-color-danger);
    outline-offset: var(--lr-size-2px);
  }

  [part='resize-handle'] {
    position: absolute;
    inset-block-end: 0;
    inset-inline-end: 0;
    inline-size: var(--lr-space-l);
    block-size: var(--lr-space-l);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: 0;
    border: none;
    background: transparent;
    cursor: nwse-resize;
    touch-action: none;
  }

  [part='resize-handle']:hover {
    background: var(--lr-color-brand-quiet);
  }

  :host(:dir(rtl)) [part='resize-handle'] {
    cursor: nesw-resize;
  }

  /* Below the breakpoint, drop the two-dimensional grid in favor of a single stacked column --
     each cell's authored x/y/w/h stops driving placement (document flow takes over), but the
     cells still render in row-major (sortSpatial) DOM order, so the reading order stays the same
     one the grid itself would have shown. */
  @container (max-inline-size: 40rem) {
    [part='base'] {
      display: flex;
      flex-direction: column;
    }

    [part='cell'] {
      inline-size: 100%;
    }
  }
`;
