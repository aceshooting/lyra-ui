import { css } from 'lit';
import {
  anchoredPopupSettle,
  overlaySurface,
  overlaySurfaceFill,
} from '../../../internal/overlay-surface.styles.js';

/* Popover and tooltip share the arrow rules verbatim; only the size custom property differs, so
   each sheet declares its own copy against its own token name. */
export const styles = css`
  :host { display: inline-block; }
  [part='trigger'] { display: inline-block; }
  /* full-width-trigger: the host, the trigger wrapper and the slotted trigger all take the full
     inline size of the host's container, for a trigger laid out as a block-level field. */
  :host([full-width-trigger]) { display: block; }
  :host([full-width-trigger]) [part='trigger'] { display: block; }
  :host([full-width-trigger]) slot[name='trigger']::slotted(*) {
    box-sizing: border-box;
    inline-size: 100%;
  }
  [part~='popup'] {
    /* Fixed from the start, not only once JS positions it on open, so the closed popup -- sized to
       its full slotted content -- never occupies a box in normal flow; otherwise it inflates its
       inline-block host to the popup's content size and that invisible but hit-testable box covers
       unrelated page content until the first click hands over to place(). Physical top/left, not
       inset-block-start/inset-inline-start: positioner.ts's place() overwrites them via
       style.left/style.top, which only cleanly overrides a same-property CSS default. Under RTL
       inset-inline-start resolves to the physical "right", leaving right:0 and the JS's left:Npx
       both active, and CSS2.1 over-constrained resolution in a direction:rtl containing block
       discards left -- pinning the popup to the viewport's right edge whatever Floating UI
       computed. */
    position: fixed;
    top: 0;
    /* policy-allow(physical-css): must stay the same physical property place() overwrites via
       style.left; inset-inline-start would leave right:0 active under RTL and over-constrained
       resolution would discard the JS-written left (see above). */
    left: 0;
    z-index: var(--lr-overlay-stack-index, var(--lr-layer-popover));
    /* --lr-overlay-inline-size is an assertive width (auto, shrink-to-fit, while unset). With it set
       and no explicit maximum, the cap falls back to the requested width rather than the 20rem
       default, so an assertive width is not silently clipped; the available space stays a hard
       limit either way. */
    inline-size: var(--lr-overlay-inline-size, auto);
    max-inline-size: min(var(--max-width, var(--lr-overlay-max-inline-size, var(--lr-overlay-inline-size, var(--lr-size-20rem)))), var(--lr-positioner-available-inline-size, var(--lr-size-20rem)));
    /* A floor for short content, itself capped by the available space so it never pushes the popup
       off-screen. The private arm lets a composing component (lr-context-menu) put its own
       component-scoped floor ahead of the shared one; it is only declared while that component's
       token is set. 0px is the used value of the initial auto here. */
    min-inline-size: min(
      var(--_lr-popup-min-inline-size, var(--lr-overlay-min-inline-size, 0px)),
      var(--lr-positioner-available-inline-size, 100vw)
    );
    max-block-size: var(--lr-positioner-available-block-size, var(--lr-size-20rem));
    overflow: auto;
    /* The shared overlay-surface family (internal/overlay-surface.styles.ts), not the page-surface
       tokens this rule used to read directly: a popup is a floating surface, and an application has
       to be able to retint every popup without repainting every card and input behind them. */
    ${overlaySurface}
    /* Anchored overlay: a positioner-placed popup floating over page content, not a modal layer.
       Its own elevation tier, so a theme can raise anchored popups without touching dialogs. */
    box-shadow: var(--lr-overlay-shadow-anchored, var(--lr-shadow-m));
  }
  /* The hover bridge: a full-viewport box clipped to the quad spanning the trigger and the popup,
     so a pointer crossing the offset gap never leaves both at once. positioner.ts writes the four
     corners as viewport-pixel custom properties; every corner defaults to the same point, which
     clips the element to nothing and leaves it inert until the first placement lands. Physical
     coordinates and inset are deliberate -- both source rects are already viewport pixels and a
     quad whose edges belong to two different boxes has no logical spelling. */
  /* policy-allow(physical-css): the quad's coordinates come from getBoundingClientRect() in
     viewport pixels, which no logical property can express. */
  [part~='hover-bridge'] {
    position: fixed;
    inset: 0;
    z-index: var(--lr-overlay-stack-index, var(--lr-layer-popover));
    clip-path: polygon(
      var(--lr-positioner-hover-bridge-top-left-x, 0) var(--lr-positioner-hover-bridge-top-left-y, 0),
      var(--lr-positioner-hover-bridge-top-right-x, 0) var(--lr-positioner-hover-bridge-top-right-y, 0),
      var(--lr-positioner-hover-bridge-bottom-right-x, 0) var(--lr-positioner-hover-bridge-bottom-right-y, 0),
      var(--lr-positioner-hover-bridge-bottom-left-x, 0) var(--lr-positioner-hover-bridge-bottom-left-y, 0)
    );
  }
  [part~='popup'] { --_lr-popup-exit-transform: translateY(var(--lr-size-neg-0-25rem)); }
  ${anchoredPopupSettle}
  [part~='content'] { padding: var(--lr-overlay-content-padding, var(--lr-space-m)); }
  /* An arrow protrudes past the popup's edge, so the scroll container moves inwards for it -- an
     overflow: auto popup would clip the arrow away entirely. Scoped to the arrow case so an
     arrowless popover keeps its box model exactly. */
  [part~='popup']:where([data-has-arrow]) { overflow: visible; }
  [part~='popup']:where([data-has-arrow]) [part~='content'] {
    overflow: auto;
    max-block-size: var(--lr-positioner-available-block-size, var(--lr-size-20rem));
  }
  [part~='arrow'] {
    position: absolute;
    inline-size: calc(2 * var(--arrow-size, var(--lr-overlay-arrow-size, var(--lr-size-0-375rem))));
    block-size: calc(2 * var(--arrow-size, var(--lr-overlay-arrow-size, var(--lr-size-0-375rem))));
    rotate: 45deg;
    /* Fill and edge only, never the radius arm: the arrow is a rotated square whose corners are
       already cut by the clip-path below, and rounding them would pull the tip away from the
       anchor. */
    ${overlaySurfaceFill}
    /* Only the two outward-facing edges of the rotated square read as the popup's border; the
       other two sit under the panel. */
    clip-path: polygon(100% 0, 100% 100%, 0 100%);
  }
`;

export const tooltipStyles = css`
  :host { display: inline-block; }
  [part='trigger'] { display: inline-block; }
  /* position: absolute from the start, matching the mapped non-hoisted default. Physical top/left
     here too, for the same RTL over-constraint reason as the popover above. */
  /* policy-allow(physical-css): same physical property positioner.ts's place() writes; see above. */
  /* Intrinsic sizing must not depend on the placed inset: shrink-to-fit can rewrap on every
     shift when an absolute popup's containing block is narrower than its clipping boundary. */
  [part~='popup'] { position: absolute; top: 0; left: 0; z-index: var(--lr-overlay-stack-index, var(--lr-layer-popover)); min-inline-size: 0; inline-size: max-content; max-inline-size: min(var(--max-width, var(--lr-tooltip-max-inline-size, var(--lr-size-20rem))), var(--lr-positioner-available-inline-size, 100vi)); max-block-size: var(--lr-positioner-available-block-size, 100vb); overflow-x: clip; overflow-y: auto; overflow-wrap: anywhere; padding: var(--lr-space-xs) var(--lr-space-s); border-radius: var(--lr-overlay-radius, var(--lr-radius-xs)); background: var(--lr-tooltip-bg, var(--lr-color-neutral)); color: var(--lr-tooltip-color, var(--lr-color-on-neutral)); font-size: var(--lr-font-size-sm); line-height: var(--lr-line-height-compact); box-shadow: var(--lr-overlay-shadow-anchored, var(--lr-shadow-m)); }
  [part~='popup'] { --_lr-popup-exit-transform: none; }
  ${anchoredPopupSettle}
  /* A tooltip popup has no inner scroll wrapper to move the overflow onto, so switching to
     visible trades internal scrolling for a visible arrow. Use <lr-popover> when both are
     needed. */
  [part~='popup']:where([data-has-arrow]) { overflow: visible; }
  [part~='arrow'] {
    position: absolute;
    inline-size: calc(2 * var(--arrow-size, var(--lr-tooltip-arrow-size, var(--lr-size-0-375rem))));
    block-size: calc(2 * var(--arrow-size, var(--lr-tooltip-arrow-size, var(--lr-size-0-375rem))));
    rotate: 45deg;
    background: var(--lr-tooltip-bg, var(--lr-color-neutral));
  }
`;
