import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    container-type: inline-size;
  }

  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-m);
  }

  [part='heading'] {
    margin: 0;
    font-size: var(--lr-font-size-lg);
    font-weight: var(--lr-font-weight-semibold);
  }

  [part='tabs'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-2xs);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }

  [part='tab'] {
    box-sizing: border-box;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: var(--lr-space-xs) var(--lr-space-s);
    border: none;
    border-block-end: var(--lr-border-width-medium) solid transparent;
    background: transparent;
    color: var(--lr-color-text-quiet);
    font: inherit;
    cursor: pointer;
  }

  [part='tab']:hover {
    color: var(--lr-color-text);
  }

  /* Pressed adds a fill the hover deliberately has none of: the tab's label is already moving to
     --lr-color-text on hover, which is exactly what --lr-color-mix-partner tracks, so the only axis
     left that can read as "held" is the tab's own transparent background mixed toward the partner. */
  [part='tab']:active {
    color: var(--lr-color-text);
    background: color-mix(in oklab, transparent, var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }

  [part='tab']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  /* :where() zeroes the [aria-selected='true'] qualifier's specificity contribution -- otherwise
     this (0,2,0) rule would beat a consumer's own ::part(tab) color/border override on the active
     tab. Colors route through scoped cssprops so a consumer can retint just the selected tab
     without hijacking the shared --lr-color-brand/--lr-color-text tokens used everywhere else. */
  [part='tab']:where([aria-selected='true']) {
    border-block-end-color: var(--lr-knowledge-base-admin-tab-selected-border, var(--lr-color-brand));
    color: var(--lr-knowledge-base-admin-tab-selected-color, var(--lr-color-text));
    font-weight: var(--lr-font-weight-semibold);
  }

  [part='panel'] {
    min-inline-size: 0;
  }
`;
