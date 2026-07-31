import { css } from "lit";

export const styles = css`
  :host {
    display: block;
  }
  [part="base"] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
  }
  [part="tablist"] {
    display: flex;
    align-items: stretch;
    gap: var(--lr-space-m);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    overflow-x: auto;
    overflow-y: hidden;
  }
  /* Edge affordance, gated on the tablist actually overflowing -- ScrollOverflowController toggles
     data-scroll-overflow from a real scrollWidth/clientWidth measurement; scrolling itself stays
     native, with no scroll listener. Painted unconditionally (as it used to be) it fades the first
     and last tab of a row that fits, for no reason. */
  [part="tablist"][data-scroll-overflow] {
    -webkit-mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-mask-opaque) var(--lr-scroll-fade-size),
      var(--lr-mask-opaque) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
    mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-mask-opaque) var(--lr-scroll-fade-size),
      var(--lr-mask-opaque) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
  }
  [part="tab"] {
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
    transition: color var(--lr-transition-fast),
      border-color var(--lr-transition-fast);
  }
  [part="tab-icon"] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
  }
  /* Reads its own prop, not the shared --lr-color-text token: recoloring the selected tab must
     never repaint hovered-unselected tabs with the selected color. :where() zeroes the wrapped
     selectors' specificity contribution, leaving only :hover itself -- (0,1,0) total, so a
     consumer's own ::part(tab):hover override ((0,1,1)) always wins without needing !important
     (mirrors lr-attachment-trigger's identical fix). */
  :where([part="tab"]):hover:where(:not([aria-disabled="true"])) {
    color: var(--lr-tab-group-hover-color, var(--lr-color-text));
  }
  /* Inline var() fallbacks rather than :host-declared properties, so a consumer can set them on any
     ancestor and a :host declaration can never shadow that. Unset, each falls back to the token the
     rule used before the hooks existed, so the rendering is unchanged. */
  [part="tab"][aria-selected="true"] {
    color: var(--lr-tab-group-selected-color, var(--lr-color-brand));
    border-block-end-color: var(
      --lr-tab-group-indicator-color,
      var(--lr-color-brand)
    );
  }
  [part="tab"][aria-disabled="true"] {
    cursor: not-allowed;
    /* No :hover color change and no pointer feedback -- the click handler
       already no-ops on a disabled tab, this just matches it visually. */
    pointer-events: none;
    opacity: var(--lr-opacity-disabled);
  }
  [part="tab"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(var(--lr-focus-ring-offset) * -1);
    border-radius: var(--lr-radius);
  }
  [part="panel"] {
    padding-block-start: var(--lr-space-xs);
  }
  [part="panel"]:hover {
    outline: var(--lr-border-width-thin) solid var(--lr-color-border);
    outline-offset: var(--lr-focus-ring-offset);
    border-radius: var(--lr-radius);
  }
  [part="panel"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
    border-radius: var(--lr-radius);
  }
  @media (prefers-reduced-motion: reduce) {
    [part="tab"] {
      transition: none !important;
    }
  }

  /* Placement. The base flex direction moves the strip relative to the panels; start/end are
     logical, so row/row-reverse mirror under RTL with no :dir() rule. A vertical strip trades
     its block-end rule for an inline-end one, in the matching logical direction. */
  :host([placement='bottom']) [part='base'] {
    flex-direction: column-reverse;
  }
  :host([placement='bottom']) [part='tablist'] {
    border-block-end: none;
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  :host([placement='start']) [part='base'],
  :host([placement='end']) [part='base'] {
    flex-direction: row;
    align-items: start;
  }
  :host([placement='end']) [part='base'] {
    flex-direction: row-reverse;
  }
  :host([placement='start']) [part='tablist'],
  :host([placement='end']) [part='tablist'] {
    flex-direction: column;
    align-items: stretch;
    flex: 0 0 auto;
    gap: var(--lr-space-2xs);
    overflow-x: hidden;
    overflow-y: auto;
    border-block-end: none;
  }
  :host([placement='start']) [part='tablist'] {
    border-inline-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  :host([placement='end']) [part='tablist'] {
    border-inline-start: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  /* The horizontal edge fade measures inline overflow; a vertical strip scrolls in the block
     direction instead, so the mask would dim the wrong ends. */
  :host([placement='start']) [part='tablist'][data-scroll-overflow],
  :host([placement='end']) [part='tablist'][data-scroll-overflow] {
    -webkit-mask-image: none;
    mask-image: none;
  }
  /* The selected-tab indicator runs along whichever edge the panels are on. */
  :host([placement='start']) [part='tab'][aria-selected='true'],
  :host([placement='end']) [part='tab'][aria-selected='true'] {
    box-shadow: none;
  }
  :host([placement='start']) [part='tab'][aria-selected='true'] {
    border-inline-end: var(--lr-border-width-thick) solid
      var(--lr-tab-group-indicator-color, var(--lr-color-brand));
  }
  :host([placement='end']) [part='tab'][aria-selected='true'] {
    border-inline-start: var(--lr-border-width-thick) solid
      var(--lr-tab-group-indicator-color, var(--lr-color-brand));
  }
  :host([placement='start']) [part='panel'],
  :host([placement='end']) [part='panel'] {
    flex: 1 1 auto;
    min-inline-size: 0;
  }
`;
