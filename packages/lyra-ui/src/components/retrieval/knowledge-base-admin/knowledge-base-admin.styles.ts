import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-20rem);
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

  /* Pressed adds a fill hover has none of: hover already moves the label to --lr-color-text,
     which is what --lr-color-mix-partner tracks, so the only axis left to read as held is the
     tab's own transparent background mixed toward the partner. */
  [part='tab']:active {
    color: var(--lr-color-text);
    background: color-mix(in oklab, transparent, var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }

  [part='tab']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  /* :where() zeroes the [aria-selected='true'] qualifier's specificity, keeping this at (0,1,0)
     -- below the (0,2,0) :hover and :active rules above, so the selected tab still shows pointer
     feedback. Colors route through scoped cssprops so a consumer can retint just the selected tab
     without hijacking the shared --lr-color-brand and --lr-color-text tokens used everywhere
     else. */
  [part='tab']:where([aria-selected='true']) {
    border-block-end-color: var(--lr-knowledge-base-admin-tab-selected-border, var(--lr-color-brand));
    color: var(--lr-knowledge-base-admin-tab-selected-color, var(--lr-color-text));
    font-weight: var(--lr-font-weight-semibold);
  }

  [part='panel'] {
    min-inline-size: 0;
  }
`;
