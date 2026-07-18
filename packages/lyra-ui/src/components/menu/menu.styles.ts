import { css } from 'lit';

export const styles = css`
  /* Fully transparent to layout -- the visible/clickable surface is entirely
     the consumer's own slotted trigger element (see [part='trigger'] below),
     so the host contributes no box of its own for that trigger to sit inside
     (no stray margin/inline-block quirks around, say, a plain icon button). */
  :host {
    display: contents;
  }
  [part='trigger'] {
    /* Same reasoning as :host above -- event listeners still fire on a
       display:contents element (only layout/hit-testing are affected), so
       click/keydown delegation from the slotted trigger keeps working. */
    display: contents;
  }
  [part='popup'] {
    position: fixed;
    z-index: var(--lr-layer-dropdown);
    box-sizing: border-box;
    min-inline-size: var(--lr-size-10rem);
    max-inline-size: min(92vw, var(--lr-size-20rem), var(--lr-positioner-available-inline-size, 100vw));
    max-block-size: min(var(--lr-size-20rem), var(--lr-positioner-available-block-size, var(--lr-size-20rem)));
    background: var(--lr-color-surface);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    box-shadow: var(--lr-shadow);
    /* Closed state: invisible + slightly raised -- visibility (not
       display:none) so opacity/transform can actually transition, and so a
       light-DOM <lr-menu-item>'s inherited visibility (see
       menu.ts's class doc on tab-order safety) excludes it from sequential
       focus navigation while closed with no separate tabindex bookkeeping
       needed. Mirrors lr-select's identical [part='listbox'] treatment. */
    visibility: hidden;
    opacity: 0;
    transform: translateY(var(--lr-size-neg-0-25rem));
    transition:
      opacity var(--lr-transition-fast),
      transform var(--lr-transition-fast),
      visibility var(--lr-transition-fast);
  }
  :host([open]) [part='popup'] {
    visibility: visible;
    opacity: 1;
    transform: translateY(0);
  }
  @media (prefers-reduced-motion: reduce) {
    [part='popup'] {
      transition: none !important;
    }
  }
  [part='list'] {
    display: flex;
    flex-direction: column;
    max-block-size: min(var(--lr-size-20rem), var(--lr-positioner-available-block-size, var(--lr-size-20rem)));
    overflow-y: auto;
    padding: var(--lr-space-xs);
    outline: none;
  }
  /* A plain <hr> divider between item groups -- native <hr> already carries
     an implicit ARIA role of "separator", exactly what role="menu" expects
     between groups of menuitem children, so no role attribute needs adding. */
  ::slotted(hr) {
    border: none;
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
    margin: var(--lr-space-xs) var(--lr-space-xs);
  }
`;
