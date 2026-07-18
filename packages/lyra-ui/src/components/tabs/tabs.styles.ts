import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-s);
  }
  [part='tablist'] {
    display: flex;
    align-items: stretch;
    gap: var(--lyra-space-m);
    border-block-end: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    overflow-x: auto;
    overflow-y: hidden;
    /* Static edge affordance: scrolling remains native and no scroll listener is needed. */
    -webkit-mask-image: linear-gradient(
      to right,
      transparent,
      var(--lyra-color-shadow) var(--lyra-scroll-fade-size),
      var(--lyra-color-shadow) calc(100% - var(--lyra-scroll-fade-size)),
      transparent
    );
    mask-image: linear-gradient(
      to right,
      transparent,
      var(--lyra-color-shadow) var(--lyra-scroll-fade-size),
      var(--lyra-color-shadow) calc(100% - var(--lyra-scroll-fade-size)),
      transparent
    );
  }
  [part='tab'] {
    appearance: none;
    background: none;
    border: none;
    /* Sits directly over the tablist's own border-block-end so the accent
       underline below replaces it, pixel for pixel, when selected. */
    border-block-end: var(--lyra-border-width-medium) solid transparent;
    margin-block-end: var(--lyra-size-neg-1px);
    padding: var(--lyra-space-s) var(--lyra-space-xs);
    font: inherit;
    font-weight: var(--lyra-font-weight-medium);
    color: var(--lyra-color-text-quiet);
    cursor: pointer;
    white-space: nowrap;
    /* inline-flex only matters once a tab-icon part is also present (gap
       has no effect with a single child) -- a text-only tab lays out
       identically to the previous plain inline-block button. */
    display: inline-flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    transition:
      color var(--lyra-transition-fast),
      border-color var(--lyra-transition-fast);
  }
  [part='tab-icon'] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
  }
  [part='tab']:hover:not([aria-disabled='true']) {
    color: var(--lyra-color-text);
  }
  [part='tab'][aria-selected='true'] {
    color: var(--lyra-color-brand);
    border-block-end-color: var(--lyra-color-brand);
  }
  [part='tab'][aria-disabled='true'] {
    cursor: not-allowed;
    /* No :hover color change and no pointer feedback -- the click handler
       already no-ops on a disabled tab, this just matches it visually. */
    pointer-events: none;
    opacity: var(--lyra-opacity-disabled);
  }
  [part='tab']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: calc(var(--lyra-focus-ring-offset) * -1);
    border-radius: var(--lyra-radius);
  }
  [part='panel'] {
    padding-block-start: var(--lyra-space-xs);
  }
  [part='panel']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
    border-radius: var(--lyra-radius);
  }
  @media (prefers-reduced-motion: reduce) {
    [part='tab'] {
      transition: none !important;
    }
  }
`;
