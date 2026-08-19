import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    /* Query container so the @container rule below reacts to this grid's own allocated inline
       size -- a dashboard-grid usually sits in a panel of varying width, not the viewport. Same
       convention as lr-button-group/lr-control-group. */
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

  /* An absolutely positioned resize handle cannot contribute to the cell's intrinsic block size,
     so the shared action floor applies only while that handle exists -- readonly and locked short
     cells keep their content-derived height in the stacked layout. */
  [part="cell"][data-resizable] {
    min-block-size: var(--lr-icon-button-size);
  }

  /* Slotted content (default lr-widget, or a consumer's own opaque markup) commonly fills the
     cell, so a background-color hover would paint underneath it. An outline draws outside the box
     like [part='cell'][data-collision]'s below, staying visible over occluding content -- matching
     the :focus-visible ring on this same keyboard-navigable, draggable target. */
  /* no-pressed-state: the cell's pressed interaction is a drag, already carrying its own
     [data-dragging] treatment below; a plain :active rule would also fire for every press landing
     on the slotted widget's own buttons, since :active matches the ancestors of whatever was
     pressed. */
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
    /* A dragged or resized tile rides above its neighbours, so it takes the overlay step rather
       than the card step its siblings use. */
    box-shadow: var(--lr-dashboard-grid-interaction-shadow, var(--lr-shadow-m));
  }

  /* Declared after [part="cell"]:focus-visible at the same (0,2,0), so an invalid drop takes the
     outline channel -- intended, since it outranks where focus is and the outline is this state's
     only channel. The side effect was not: the focus indicator vanished during a drag or resize
     preview, when a keyboard user most needs it. The rule below restores it on a second channel
     rather than reordering these two. */
  [part="cell"][data-collision] {
    outline: var(--lr-size-2px) solid
      var(--lr-dashboard-grid-collision-outline-color, var(--lr-color-danger));
    outline-offset: var(--lr-size-2px);
  }

  /* The focus ring as a box-shadow ring (lr-otp-input's shape), because the collision rule above
     owns the outline while both states are on. It sits at the border box, inside that outline's
     positive offset, so the two read as concentric. The lift shadow is restated here because
     box-shadow is one property and [data-collision] only appears during a drag or resize --
     omitting it would drop the tile back to the resting plane while colliding. */
  [part="cell"][data-collision]:focus-visible {
    box-shadow:
      0 0 0 var(--lr-focus-ring-width) var(--lr-focus-ring-color),
      var(--lr-dashboard-grid-interaction-shadow, var(--lr-shadow-m));
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
  /* Unlike [part="cell"] above, this handle is a leaf button with nothing slotted inside, so
     :active means only that the resize gesture is under way; pointer capture holds it for the
     whole drag. */
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

  /* Below the breakpoint the two-dimensional grid becomes a single stacked column: authored
     x/y/w/h stop driving placement and document flow takes over, but cells still render in
     row-major spatial DOM order, so reading order matches what the grid would have shown. */
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
