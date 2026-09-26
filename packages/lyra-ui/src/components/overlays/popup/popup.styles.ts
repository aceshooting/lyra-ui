import { css } from 'lit';

export const styles = css`
  :host {
    display: contents;
  }
  [part='anchor'] {
    display: contents;
  }
  /* Settled inactive (no exit transition playing, gated by JS clearing 'hidden' only once the
     opacity/visibility fade has actually finished -- see settlePopupHidden()): out of layout
     entirely, so a stale placed box can no longer inflate whatever ancestor establishes this
     popup's CSS containing block. The live fade below is untouched: 'hidden' only ever lands
     after it settles, never during it, so the first measurement still reads a real box. */
  [part~='popup'][hidden] {
    display: none;
  }
  [part~='popup'] {
    /* Positioned by internal/positioner.ts, which writes physical position/left/top itself, so the
       baseline must use those same physical properties: inset-inline-start becomes right under RTL
       and would stay active beside the JS-written left, stretching or pinning the popup. Inactive
       is expressed by hiding (visibility/opacity), not 'hidden', while the fade plays. */
    position: absolute;
    top: 0;
    /* policy-allow(physical-css): positioner.ts overwrites this exact physical property; a
       logical right baseline under RTL would over-constrain the positioned box. */
    left: 0;
    z-index: var(--lr-overlay-stack-index, var(--lr-layer-popover));
    max-inline-size: var(--lr-positioner-available-inline-size, none);
    max-block-size: var(--lr-positioner-available-block-size, none);
    visibility: visible;
    opacity: 1;
    /* Opacity fades; visibility never interpolates. A discrete visibility transition still reads
       its start value ('hidden') at progress 0, so an engine that samples the style in the same
       task as activation would report an active popup as hidden. On show it therefore flips at
       once, and on hide it holds 'visible' through the fade and flips when the fade ends. */
    transition-property: opacity, visibility;
    transition-duration: var(--show-duration, var(--lr-duration-fast)), 0s;
    transition-delay: 0s, 0s;
    transition-timing-function: var(--lr-easing-standard);
  }
  [part~='popup']:not([data-active]) {
    visibility: hidden;
    opacity: 0;
    pointer-events: none;
    transition-duration: var(--hide-duration, var(--lr-duration-fast)), 0s;
    transition-delay: 0s, var(--hide-duration, var(--lr-duration-fast));
  }
  [part~='popup'][data-awaits-position] {
    /* An active request without a live, placed anchor is not a hide transition -- fading the old
       surface at stale coordinates paints unattached chrome for another frame. */
    transition: none;
  }

  [part~='hover-bridge'] {
    /* A viewport-sized transparent box clipped to the quad internal/positioner.ts writes between
       the anchor and the popup, so a pointer crossing the distance gap never leaves both at once.
       The coordinates are physical viewport pixels -- a polygon spanning two different boxes has
       no logical-property spelling -- and land here as custom properties. */
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
    inline-size: calc(2 * var(--arrow-size, var(--lr-popup-arrow-size, var(--lr-size-0-375rem))));
    block-size: calc(2 * var(--arrow-size, var(--lr-popup-arrow-size, var(--lr-size-0-375rem))));
    rotate: 45deg;
    background: var(--arrow-color, var(--lr-color-surface-raised));
    border: var(--popup-border-width, var(--lr-border-width-thin)) solid var(--lr-color-border);
    /* Only the two outward-facing edges of the rotated square should read as the popup's border;
       the other two sit under the panel. */
    clip-path: polygon(100% 0, 100% 100%, 0 100%);
  }
  @media (prefers-reduced-motion: reduce) {
    [part~='popup'] {
      transition: none !important;
    }
  }
`;
