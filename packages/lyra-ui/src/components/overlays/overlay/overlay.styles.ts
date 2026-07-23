import { css } from 'lit';

export const styles = css`
  :host { display: inline-block; }
  [part='trigger'] { display: inline-block; }
  [part='popup'] {
    /* Fixed from the start (not only once JS positions it on open) so the closed popup --
       sized to its full slotted content -- never occupies a box in the host's normal flow.
       Otherwise a closed dropdown/popover inflates its own inline-block host to the popup's
       content size, and that invisible-but-still-hit-testable box sits on top of unrelated
       page content until the trigger is first clicked and place() takes over positioning.
       Physical top/left, not inset-block-start/inset-inline-start: positioner.ts's place()
       always overwrites this via the physical style.left/style.top, which only cleanly
       overrides a same-property CSS default. Under RTL, inset-inline-start resolves to the
       different physical property "right", so both right:0 (from here) and the JS's left:Npx
       would stay simultaneously active -- and per the CSS2.1 over-constrained resolution rules
       for a direction:rtl containing block, left is the one silently discarded, pinning the
       popup to the viewport's right edge no matter what Floating UI computed. Physical
       properties here sidestep that entirely, matching what JS always sets. */
    position: fixed;
    top: 0;
    /* policy-allow(physical-css): must stay the same physical property positioner.ts's place()
       overwrites via style.left; inset-inline-start would leave right:0 active under RTL and the
       over-constrained resolution would discard the JS-written left (see the comment above). */
    left: 0;
    z-index: var(--lr-overlay-stack-index, var(--lr-layer-popover));
    max-inline-size: min(var(--lr-overlay-max-inline-size, var(--lr-size-20rem)), var(--lr-positioner-available-inline-size, var(--lr-size-20rem)));
    max-block-size: var(--lr-positioner-available-block-size, var(--lr-size-20rem));
    overflow: auto;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    box-shadow: var(--lr-shadow);
  }
  [part='popup'][data-hidden] { visibility: hidden; opacity: 0; pointer-events: none; transform: translateY(var(--lr-size-neg-0-25rem)); }
  [part='popup'] { opacity: 1; transform: translateY(0); transition: opacity var(--lr-transition-fast), transform var(--lr-transition-fast), visibility var(--lr-transition-fast); }
  [part='content'] { padding: var(--lr-space-m); }
  @media (prefers-reduced-motion: reduce) { [part='popup'] { transition: none !important; } }
`;

export const tooltipStyles = css`
  :host { display: inline-block; }
  /* position: fixed from the start, same reasoning as overlay [part='popup'] above -- see its
     comment. Physical top/left there too, for the same RTL over-constraint reason. */
  /* policy-allow(physical-css): same physical property positioner.ts's place() writes; see above. */
  [part='popup'] { position: fixed; top: 0; left: 0; z-index: var(--lr-overlay-stack-index, var(--lr-layer-popover)); min-inline-size: 0; max-inline-size: min(var(--lr-tooltip-max-inline-size, var(--lr-size-20rem)), var(--lr-positioner-available-inline-size, 100vi)); max-block-size: var(--lr-positioner-available-block-size, 100vb); overflow-x: clip; overflow-y: auto; overflow-wrap: anywhere; padding: var(--lr-space-xs) var(--lr-space-s); border-radius: var(--lr-radius-xs); background: var(--lr-tooltip-background, var(--lr-color-neutral)); color: var(--lr-tooltip-color, var(--lr-color-on-neutral)); font-size: var(--lr-font-size-sm); line-height: var(--lr-line-height-compact); box-shadow: var(--lr-shadow); }
  [part='popup'][data-hidden] { visibility: hidden; opacity: 0; pointer-events: none; }
  [part='popup'] { opacity: 1; transition: opacity var(--lr-transition-fast), visibility var(--lr-transition-fast); }
  @media (prefers-reduced-motion: reduce) { [part='popup'] { transition: none !important; } }
`;
