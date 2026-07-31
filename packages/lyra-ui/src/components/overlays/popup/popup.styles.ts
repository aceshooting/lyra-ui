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

  [part='arrow'] {
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
