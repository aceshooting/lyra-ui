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
    /* A column so a filled header/footer keeps its full height and the list
       gives up space instead (see [part='list']'s min-block-size below). With
       neither region filled this lays out identically to the plain block box
       it replaced -- one full-width child, sized by its own content. */
    display: flex;
    flex-direction: column;
    min-inline-size: var(--lr-size-10rem);
    max-inline-size: min(var(--lr-popover-viewport-clamp), var(--lr-size-20rem), var(--lr-positioner-available-inline-size, 100vw));
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
  /* Composed content that is deliberately NOT a menu item, rendered outside
     the role="menu" list (arbitrary content inside role="menu" is an
     aria-required-children violation). Both wrappers collapse to no box at
     all while their slot is unfilled, which is what keeps a menu that uses
     neither slot rendering exactly as it did before they existed.
     An :empty selector cannot drive that: Chromium's :empty does not ignore
     the whitespace-only text nodes Lit leaves inside a part, so the rule
     would silently never match -- the host attributes below are set from the
     slots' own slotchange instead. */
  [part='header'],
  [part='footer'] {
    flex: 0 0 auto;
    padding: var(--lr-space-xs);
  }
  :host(:not([data-has-header])) [part='header'],
  :host(:not([data-has-footer])) [part='footer'] {
    display: none;
  }
  /* The divider only earns its keep when there are items on the other side of
     it -- a header above an empty list would otherwise draw a stray rule. */
  :host(:not([data-list-empty])) [part='header'] {
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  :host(:not([data-list-empty])) [part='footer'] {
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='list'] {
    display: flex;
    flex-direction: column;
    /* The list, not a filled header/footer, is what scrolls when the popup
       runs out of room -- min-block-size:0 is what lets it shrink below its
       content height inside the popup's own column. */
    flex: 0 1 auto;
    min-block-size: 0;
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
