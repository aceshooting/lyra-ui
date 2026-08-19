import { css } from 'lit';

/* Popover and tooltip share the arrow rules verbatim; only the size custom property differs, so
   each sheet declares its own copy against its own token name. */
export const styles = css`
  :host { display: inline-block; }
  [part='trigger'] { display: inline-block; }
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
    max-inline-size: min(var(--max-width, var(--lr-overlay-max-inline-size, var(--lr-size-20rem))), var(--lr-positioner-available-inline-size, var(--lr-size-20rem)));
    max-block-size: var(--lr-positioner-available-block-size, var(--lr-size-20rem));
    overflow: auto;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    /* Anchored overlay: a positioner-placed popup floating over page content, not a modal layer. */
    box-shadow: var(--lr-shadow-m);
  }
  [part~='popup'][data-hidden] { visibility: hidden; opacity: 0; pointer-events: none; transform: translateY(var(--lr-size-neg-0-25rem)); }
  [part~='popup'] { opacity: 1; transform: translateY(0); }
  :host([data-closing]) [part~='popup'][data-hidden] { visibility: visible; }
  [part~='content'] { padding: var(--lr-space-m); }
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
    background: var(--lr-color-surface);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
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
  [part~='popup'] { position: absolute; top: 0; left: 0; z-index: var(--lr-overlay-stack-index, var(--lr-layer-popover)); min-inline-size: 0; max-inline-size: min(var(--max-width, var(--lr-tooltip-max-inline-size, var(--lr-size-20rem))), var(--lr-positioner-available-inline-size, 100vi)); max-block-size: var(--lr-positioner-available-block-size, 100vb); overflow-x: clip; overflow-y: auto; overflow-wrap: anywhere; padding: var(--lr-space-xs) var(--lr-space-s); border-radius: var(--lr-radius-xs); background: var(--lr-tooltip-background, var(--lr-color-neutral)); color: var(--lr-tooltip-color, var(--lr-color-on-neutral)); font-size: var(--lr-font-size-sm); line-height: var(--lr-line-height-compact); box-shadow: var(--lr-shadow-m); }
  [part~='popup'][data-hidden] { visibility: hidden; opacity: 0; pointer-events: none; }
  [part~='popup'] { opacity: 1; }
  :host([data-closing]) [part~='popup'][data-hidden] { visibility: visible; }
  /* A tooltip popup has no inner scroll wrapper to move the overflow onto, so switching to
     visible trades internal scrolling for a visible arrow. Use <lr-popover> when both are
     needed. */
  [part~='popup']:where([data-has-arrow]) { overflow: visible; }
  [part~='arrow'] {
    position: absolute;
    inline-size: calc(2 * var(--arrow-size, var(--lr-tooltip-arrow-size, var(--lr-size-0-375rem))));
    block-size: calc(2 * var(--arrow-size, var(--lr-tooltip-arrow-size, var(--lr-size-0-375rem))));
    rotate: 45deg;
    background: var(--lr-tooltip-background, var(--lr-color-neutral));
  }
`;
