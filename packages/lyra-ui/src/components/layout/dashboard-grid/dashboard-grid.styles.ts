import { activeFill, focusRing, interactiveTransition } from '../../../internal/interactive-control.styles.js';
import { css } from 'lit';
import { minimumPointerTarget } from '../../../internal/minimum-pointer-target.styles.js';
import { wideContainerQuery } from '../../../internal/container-breakpoints.styles.js';
import { inlineSizeContainer } from '../../../internal/layout-fragments.styles.js';

export const styles = css`
  :host {
    display: block;
    /* Query container so the @container rule below reacts to this grid's own allocated inline
       size -- a dashboard-grid usually sits in a panel of varying width, not the viewport. Same
       convention as lr-button-group/lr-control-group. */
    ${inlineSizeContainer}
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
  [part="cell"]:where([data-draggable]):hover:not(:focus-visible) {
    outline: var(--lr-border-width-thin) solid
      var(
        --lr-dashboard-grid-cell-hover-outline-color,
        var(--lr-color-border-strong)
      );
    outline-offset: calc(-1 * var(--lr-border-width-thin));
  }

  [part="cell"]:focus-visible {
    ${focusRing}
  }

  /* box-sizing does not cross the slot boundary, so a slotted tile keeps the outer tree's value
     (the UA's content-box unless the author set otherwise) and every definite size here would
     allocate 100% to its CONTENT box. The flex cell plus min-inline-size:0 already shrinks a
     padded tile back inside, so this changes nothing for a shrinkable tile -- it is what keeps
     the guarantee for one the author pinned with its own flex-shrink: 0, and states the
     allocation the three percentages here were written to mean. */
  [part="cell"] ::slotted(*) {
    box-sizing: border-box;
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
    outline: var(--lr-border-width-medium) solid
      var(--lr-dashboard-grid-collision-outline-color, var(--lr-color-danger));
    outline-offset: var(--lr-border-width-medium);
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

  /* The corner grip lies over the slotted widget's own trailing corner, so it keeps to the WCAG
     2.5.8 minimum by default (rethemeable through --lr-dashboard-grid-resize-handle-hit-area)
     rather than the larger icon-button size: a widget's scrollbar end or corner button next to it
     stays reachable. Coarse or hover-less pointers are floored at --lr-icon-button-size below. */
  [part="resize-handle"] {
    --_lr-dashboard-grid-resize-hit-area: var(
      --lr-dashboard-grid-resize-handle-hit-area,
      ${minimumPointerTarget}
    );
    position: absolute;
    inset-block-end: 0;
    inset-inline-end: 0;
    inline-size: var(--_lr-dashboard-grid-resize-hit-area);
    block-size: var(--_lr-dashboard-grid-resize-hit-area);
    padding: 0;
    border: none;
    background: transparent;
    cursor: nwse-resize;
    touch-action: none;
    ${interactiveTransition}
  }
  [part="resize-handle"]::before {
    content: '';
    position: absolute;
    inset-block-end: var(--lr-space-2xs);
    inset-inline-end: var(--lr-space-2xs);
    inline-size: var(--lr-space-s);
    block-size: var(--lr-space-s);
    border-block-end: var(--lr-border-width-medium) solid var(--lr-dashboard-grid-resize-handle-color, var(--lr-color-border-strong));
    border-inline-end: var(--lr-border-width-medium) solid var(--lr-dashboard-grid-resize-handle-color, var(--lr-color-border-strong));
    pointer-events: none;
  }

  [part="resize-handle"]:hover {
    background: var(--lr-dashboard-grid-resize-handle-hover-bg, var(--lr-color-brand-quiet));
  }
  /* Unlike [part="cell"] above, this handle is a leaf button with nothing slotted inside, so
     :active means only that the resize gesture is under way; pointer capture holds it for the
     whole drag. */
  [part="resize-handle"]:active {
    background: ${activeFill('var(--lr-dashboard-grid-resize-handle-hover-bg, var(--lr-color-brand-quiet))')};
  }

  :host(:dir(rtl)) [part="resize-handle"] {
    cursor: nesw-resize;
  }
  @media (hover: none), (pointer: coarse) {
    [part="resize-handle"] {
      --_lr-dashboard-grid-resize-hit-area: max(
        var(--lr-icon-button-size),
        var(--lr-dashboard-grid-resize-handle-hit-area, ${minimumPointerTarget})
      );
    }
  }

  /* Below the breakpoint the two-dimensional grid becomes a single stacked column: authored
     x/y/w/h stop driving placement and document flow takes over, but cells still render in
     row-major spatial DOM order, so reading order matches what the grid would have shown. */
  @container ${wideContainerQuery} {
    [part="base"] {
      display: flex;
      flex-direction: column;
    }

    [part="cell"] {
      inline-size: 100%;
    }
  }
`;
