import { css } from 'lit';

export const styles = css`
  :host {
    display: contents;
  }
  [part='anchor'] {
    display: contents;
  }
  [part~='popup'] {
    /* Positioned by internal/positioner.ts, which writes position/left/top itself. The element
       must still be laid out (not display:none) while inactive is expressed by hiding it, or the
       first measurement would read a zero rect. */
    position: fixed;
    inset-block-start: 0;
    inset-inline-start: 0;
    z-index: var(--lr-overlay-stack-index, var(--lr-layer-popover));
    max-inline-size: var(--lr-positioner-available-inline-size, none);
    max-block-size: var(--lr-positioner-available-block-size, none);
  }
  [part~='popup']:not([data-active]) {
    display: none;
  }

  [part~='hover-bridge'] {
    /* A viewport-sized transparent box clipped down to the quad internal/positioner.ts writes
       between the anchor and the popup, so a pointer crossing the distance gap never leaves
       both at once. The coordinates are physical viewport pixels — a polygon spanning two
       different boxes has no logical-property spelling — and land here as custom properties. */
    position: fixed;
    inset: 0;
    z-index: calc(var(--lr-overlay-stack-index, var(--lr-layer-popover)) - 1);
    clip-path: polygon(
      var(--lr-positioner-hover-bridge-top-left-x, 0) var(--lr-positioner-hover-bridge-top-left-y, 0),
      var(--lr-positioner-hover-bridge-top-right-x, 0) var(--lr-positioner-hover-bridge-top-right-y, 0),
      var(--lr-positioner-hover-bridge-bottom-right-x, 0) var(--lr-positioner-hover-bridge-bottom-right-y, 0),
      var(--lr-positioner-hover-bridge-bottom-left-x, 0) var(--lr-positioner-hover-bridge-bottom-left-y, 0)
    );
  }
  [part~='hover-bridge']:not([data-active]) {
    display: none;
  }

  [part~='arrow'] {
    position: absolute;
    inline-size: calc(2 * var(--lr-popup-arrow-size, var(--lr-size-0-375rem)));
    block-size: calc(2 * var(--lr-popup-arrow-size, var(--lr-size-0-375rem)));
    rotate: 45deg;
    background: var(--lr-color-surface-raised);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    /* Only the two outward-facing edges of the rotated square should read as the popup's border;
       the other two sit under the panel. */
    clip-path: polygon(100% 0, 100% 100%, 0 100%);
  }
`;
