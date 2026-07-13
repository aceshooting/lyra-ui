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
    z-index: var(--lyra-layer-dropdown);
    box-sizing: border-box;
    min-inline-size: var(--lyra-size-10rem);
    max-inline-size: min(92vw, var(--lyra-size-20rem), var(--lyra-positioner-available-inline-size, 100vw));
    max-block-size: min(var(--lyra-size-20rem), var(--lyra-positioner-available-block-size, var(--lyra-size-20rem)));
    background: var(--lyra-color-surface);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    box-shadow: var(--lyra-shadow);
    /* Closed state: invisible + slightly raised -- visibility (not
       display:none) so opacity/transform can actually transition, and so a
       light-DOM <lyra-menu-item>'s inherited visibility (see
       menu.ts's class doc on tab-order safety) excludes it from sequential
       focus navigation while closed with no separate tabindex bookkeeping
       needed. Mirrors lyra-select's identical [part='listbox'] treatment. */
    visibility: hidden;
    opacity: 0;
    transform: translateY(var(--lyra-size-neg-0-25rem));
    transition:
      opacity var(--lyra-transition-fast),
      transform var(--lyra-transition-fast),
      visibility var(--lyra-transition-fast);
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
    max-block-size: min(var(--lyra-size-20rem), var(--lyra-positioner-available-block-size, var(--lyra-size-20rem)));
    overflow-y: auto;
    padding: var(--lyra-space-xs);
    outline: none;
  }
  /* A plain <hr> divider between item groups -- native <hr> already carries
     an implicit ARIA role of "separator", exactly what role="menu" expects
     between groups of menuitem children, so no role attribute needs adding. */
  ::slotted(hr) {
    border: none;
    border-block-start: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    margin: var(--lyra-space-xs) var(--lyra-space-xs);
  }
`;
