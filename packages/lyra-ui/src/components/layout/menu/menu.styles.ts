import { css } from 'lit';
import { overlaySurface } from '../../../internal/overlay-surface.styles.js';

export const styles = css`
  /* --_lr-menu-max-inline-size is the ceiling hook's sanitising indirection. It is REGISTERED, as
     <length-percentage> with a 100% initial value and inherits: false, by registerMenuWidthScale()
     in menu.class.ts -- from script, because an @property rule inside a shadow-root stylesheet
     registers nothing in any current engine (verified: the rule parses and is then ignored, which
     is exactly the silently-inert CSS this library refuses to ship). The registration is what
     makes the guarantee below true. --lr-menu-max-inline-size takes a length or a percentage, but
     "none" is what every sibling width hook in this library takes as "uncap", so it is the first
     value a consumer reaches for -- and read straight into the min() below, "none" is not a valid
     min() term: the whole declaration is invalid at computed-value time and max-inline-size falls
     back to its initial value, which IS none, discarding the viewport clamp and the container
     allocation along with the hook. Assigned to the registered name first, an out-of-syntax value
     is invalid at computed-value time for that name alone and computes to its 100% initial value,
     which is precisely the "uncap to the container" the consumer meant. */
  :host {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    /* Both width names are read ONLY through these var() fallbacks and are never declared by the
       component, so a value set on an ancestor theme wrapper or on :root still reaches the menu.
       They move as a pair: the 10rem floor used to be unreachable too, so capping a menu narrower
       than 10rem did nothing at all, and a max name on its own would have shipped half-working.
       The viewport clamp and the 100% allocation term stay outside the hook deliberately -- they
       are overflow safety, not a style choice, so no value of the hook can make a menu wider than
       its container or the viewport. Take 100% or none to uncap to the container. */
    --_lr-menu-max-inline-size: var(--lr-menu-max-inline-size, var(--lr-size-20rem));
    min-inline-size: var(--lr-menu-min-inline-size, var(--lr-size-10rem));
    max-inline-size: min(
      var(--lr-popover-viewport-clamp),
      var(--_lr-menu-max-inline-size),
      100%
    );
    /* The shared overlay-surface family (internal/overlay-surface.styles.ts): a standalone menu is
       a floating surface, and it now retints with every other popup instead of with the page. */
    ${overlaySurface}
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
  .submenu-surface[hidden] {
    display: none;
  }
  .submenu-surface {
    position: fixed;
    z-index: var(--lr-layer-dropdown);
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    /* The submenu is this same component's own floating surface, so it answers to the same two
       public names -- a consumer who narrows lr-menu and finds its submenus still 20rem wide has
       been given half a hook. It re-assigns the sanitising registered name rather than inheriting
       the host's copy -- that name is registered with inherits: false precisely so the fallback is
       a deterministic 100% here rather than whatever an ancestor menu happened to carry. */
    --_lr-menu-max-inline-size: var(--lr-menu-max-inline-size, var(--lr-size-20rem));
    min-inline-size: var(--lr-menu-min-inline-size, var(--lr-size-10rem));
    max-inline-size: min(
      var(--lr-popover-viewport-clamp),
      var(--_lr-menu-max-inline-size),
      var(--lr-positioner-available-inline-size, 100vw)
    );
    max-block-size: min(
      var(--lr-size-20rem),
      var(--lr-positioner-available-block-size, var(--lr-size-20rem))
    );
    ${overlaySurface}
    /* Anchored overlay: a positioner-placed submenu floating over page content, on the same
       elevation tier as every other anchored popup. */
    box-shadow: var(--lr-overlay-shadow-anchored, var(--lr-shadow-m));
    /* Retain layout during the outgoing transition. Once it settles, the paired [hidden] rule
       above removes the closed surface from layout so its stale placed position cannot enlarge
       an ancestor's scrollable overflow (see menu.class.ts's presentationHidden). */
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
  /* Composed content deliberately NOT a menu item, rendered outside the role="menu" list --
     arbitrary content inside role="menu" is an aria-required-children violation. Both wrappers
     collapse to no box while their slot is unfilled, so a menu using neither renders as before.
     :empty cannot drive that: Chromium's :empty does not ignore the whitespace-only text nodes Lit
     leaves inside a part, so the rule would never match -- the host attributes below come from the
     slots' own slotchange. */
  [part='header'],
  [part='footer'] {
    flex: 0 0 auto;
    padding: var(--lr-space-xs);
  }
  :host(:not([data-has-header])) [part='header'],
  :host(:not([data-has-footer])) [part='footer'] {
    display: none;
  }
  /* The divider only earns its keep when there are items on the other side -- a header above an
     empty list would otherwise draw a stray rule. */
  :host(:not([data-list-empty])) [part='header'] {
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
  }
  :host(:not([data-list-empty])) [part='footer'] {
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
  }
  [part='list'] {
    display: flex;
    flex-direction: column;
    /* The list, not a filled header/footer, scrolls when the popup runs out of room --
       min-block-size:0 lets it shrink below its content height inside the popup's own column. */
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
  /* A plain <hr> divider between item groups: native <hr> already carries the implicit ARIA role
     "separator", exactly what role="menu" expects between groups of menuitem children, so no role
     attribute is needed. */
  ::slotted(hr) {
    border: none;
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
    margin: var(--lr-space-xs) var(--lr-space-xs);
  }
`;
