import { css } from 'lit';

export const styles = css`
  :host {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    min-inline-size: var(--lr-size-10rem);
    max-inline-size: min(
      var(--lr-popover-viewport-clamp),
      var(--lr-size-20rem),
      100%
    );
    background: var(--lr-color-surface);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
  }
  /* A dropdown supplies the visible surface; a submenu supplies the private surface below. */
  :host([data-contained]),
  :host([data-submenu]) {
    display: contents;
    min-inline-size: 0;
    max-inline-size: none;
    background: transparent;
    border: 0;
  }
  .submenu-surface {
    position: fixed;
    z-index: var(--lr-layer-dropdown);
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    min-inline-size: var(--lr-size-10rem);
    max-inline-size: min(
      var(--lr-popover-viewport-clamp),
      var(--lr-size-20rem),
      var(--lr-positioner-available-inline-size, 100vw)
    );
    max-block-size: min(
      var(--lr-size-20rem),
      var(--lr-positioner-available-block-size, var(--lr-size-20rem))
    );
    background: var(--lr-color-surface);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    box-shadow: var(--lr-shadow-m);
    visibility: hidden;
    opacity: 0;
    transform: translateY(var(--lr-size-neg-0-25rem));
    translate: var(--_lr-menu-item-submenu-translation, 0) 0;
    transition: opacity var(--lr-transition-fast),
      transform var(--lr-transition-fast), visibility var(--lr-transition-fast);
  }
  .submenu-surface.open {
    visibility: visible;
    opacity: 1;
    transform: translateY(0);
    transition: opacity var(--lr-transition-fast),
      transform var(--lr-transition-fast);
  }
  @media (prefers-reduced-motion: reduce) {
    .submenu-surface {
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
    max-block-size: min(
      var(--lr-size-20rem),
      var(--lr-positioner-available-block-size, var(--lr-size-20rem))
    );
    overflow-x: hidden;
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
