import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
  }
  [part='tablist'] {
    display: flex;
    align-items: stretch;
    gap: var(--lr-space-m);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    overflow-x: auto;
    overflow-y: hidden;
    /* Static edge affordance: scrolling remains native and no scroll listener is needed. */
    -webkit-mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-color-shadow) var(--lr-scroll-fade-size),
      var(--lr-color-shadow) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
    mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-color-shadow) var(--lr-scroll-fade-size),
      var(--lr-color-shadow) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
  }
  [part='tab'] {
    appearance: none;
    background: none;
    border: none;
    /* Sits directly over the tablist's own border-block-end so the accent
       underline below replaces it, pixel for pixel, when selected. */
    border-block-end: var(--lr-border-width-medium) solid transparent;
    margin-block-end: var(--lr-size-neg-1px);
    padding: var(--lr-space-s) var(--lr-space-xs);
    font: inherit;
    font-weight: var(--lr-font-weight-medium);
    color: var(--lr-color-text-quiet);
    cursor: pointer;
    white-space: nowrap;
    /* inline-flex only matters once a tab-icon part is also present (gap
       has no effect with a single child) -- a text-only tab lays out
       identically to the previous plain inline-block button. */
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-xs);
    transition:
      color var(--lr-transition-fast),
      border-color var(--lr-transition-fast);
  }
  [part='tab-icon'] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
  }
  /* Reads its own prop, not the shared --lr-color-text token: recoloring the selected tab must
     never repaint hovered-unselected tabs with the selected color. */
  [part='tab']:hover:not([aria-disabled='true']) {
    color: var(--lr-tabs-hover-color, var(--lr-color-text));
  }
  /* Inline var() fallbacks rather than :host-declared properties, so a consumer can set them on any
     ancestor and a :host declaration can never shadow that. Unset, each falls back to the token the
     rule used before the hooks existed, so the rendering is unchanged. */
  [part='tab'][aria-selected='true'] {
    color: var(--lr-tabs-selected-color, var(--lr-color-brand));
    border-block-end-color: var(--lr-tabs-indicator-color, var(--lr-color-brand));
  }
  [part='tab'][aria-disabled='true'] {
    cursor: not-allowed;
    /* No :hover color change and no pointer feedback -- the click handler
       already no-ops on a disabled tab, this just matches it visually. */
    pointer-events: none;
    opacity: var(--lr-opacity-disabled);
  }
  [part='tab']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(var(--lr-focus-ring-offset) * -1);
    border-radius: var(--lr-radius);
  }
  [part='panel'] {
    padding-block-start: var(--lr-space-xs);
  }
  [part='panel']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
    border-radius: var(--lr-radius);
  }
  @media (prefers-reduced-motion: reduce) {
    [part='tab'] {
      transition: none !important;
    }
  }
`;
