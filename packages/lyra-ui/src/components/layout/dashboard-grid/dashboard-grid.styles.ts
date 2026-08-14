import { css } from "lit";

export const styles = css`
  :host {
    display: block;
    /* Query container so the @container rule below reacts to this grid's own allocated inline
       size (a dashboard-grid is commonly embedded in a panel of varying width, not the viewport)
       -- same convention as lr-button-group/lr-control-group's own container-query approach. */
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-20rem);
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }

  [part="base"] {
    display: grid;
    grid-template-columns: repeat(
      var(
        --lr-dashboard-grid-columns,
        var(--_lr-dashboard-grid-computed-columns, 12)
      ),
      minmax(0, 1fr)
    );
    grid-auto-rows: var(
      --lr-dashboard-grid-row-height,
      var(--_lr-dashboard-grid-computed-row-height, var(--lr-size-5rem))
    );
    gap: var(
      --lr-dashboard-grid-gap,
      var(--_lr-dashboard-grid-computed-gap, var(--lr-space-m))
    );
    align-items: stretch;
    min-inline-size: 0;
    max-inline-size: 100%;
  }

  [part="empty"] {
    grid-column: 1 / -1;
  }

  [part="cell"] {
    position: relative;
    display: flex;
    min-inline-size: 0;
    max-inline-size: 100%;
    min-block-size: 0;
    border-radius: var(--lr-radius);
    overflow-wrap: anywhere;
  }

  /* The resize handle is absolutely positioned and therefore cannot contribute to the cell's
     intrinsic block size. Apply the shared action floor only while that handle actually exists;
     readonly and locked short cells keep their content-derived height in the stacked layout. */
  [part="cell"][data-resizable] {
    min-block-size: var(--lr-icon-button-size);
  }

  /* A cell's slotted content (default lr-widget, or a consumer's own opaque markup) commonly
     fills the whole cell -- a background-color hover would paint underneath it and never be
     seen. An outline draws outside the box like [part='cell'][data-collision]'s own outline
     below, so it stays visible above any occluding content, matching the :focus-visible ring's
     own reliably-visible treatment for the exact same real, keyboard-navigable/draggable
     target. */
  /* no-pressed-state: the cell's real pressed interaction is a drag, which already has its own
     [data-dragging] treatment below; a plain :active rule would additionally fire for every press
     landing on the slotted widget's own buttons, since :active matches the ancestors of whatever
     was pressed. */
  [part="cell"]:hover {
    outline: var(--lr-border-width-thin) solid
      var(
        --lr-dashboard-grid-cell-hover-outline-color,
        var(--lr-color-border-strong)
      );
    outline-offset: calc(-1 * var(--lr-border-width-thin));
  }

  [part="cell"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part="cell"] ::slotted(*) {
    min-inline-size: 0;
    max-inline-size: 100%;
    min-block-size: 0;
    inline-size: 100%;
    overflow-wrap: anywhere;
  }

  [part="cell"][data-dragging],
  [part="cell"][data-resizing] {
    z-index: var(--lr-layer-content);
    /* A tile being dragged or resized has left the resting plane and is riding above its
       neighbours, so it takes the overlay step rather than the card step its siblings use. */
    box-shadow: var(--lr-dashboard-grid-interaction-shadow, var(--lr-shadow-m));
  }

  [part="cell"][data-collision] {
    outline: var(--lr-size-2px) solid
      var(--lr-dashboard-grid-collision-outline-color, var(--lr-color-danger));
    outline-offset: var(--lr-size-2px);
  }

  [part="resize-handle"] {
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

  [part="resize-handle"]:hover {
    background: var(--lr-color-brand-quiet);
  }
  /* Unlike [part="cell"] above, this handle is a leaf button with nothing slotted inside it, so
     :active means exactly one thing here: the resize gesture is under way. Pointer capture holds
     it for the whole drag. */
  [part="resize-handle"]:active {
    background: color-mix(
      in oklab,
      var(--lr-color-brand-quiet),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }

  :host(:dir(rtl)) [part="resize-handle"] {
    cursor: nesw-resize;
  }

  /* Below the breakpoint, drop the two-dimensional grid in favor of a single stacked column --
     each cell's authored x/y/w/h stops driving placement (document flow takes over), but the
     cells still render in row-major spatial DOM order, so the reading order stays the same
     one the grid itself would have shown. */
  @container (max-inline-size: 40rem) {
    [part="base"] {
      display: flex;
      flex-direction: column;
    }

    [part="cell"] {
      inline-size: 100%;
    }
  }
`;
