import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
  }
  [part='search-field'] {
    position: relative;
    display: flex;
    min-inline-size: 0;
  }
  [part='search'] {
    inline-size: 100%;
    box-sizing: border-box;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: var(--lr-space-xs) var(--lr-space-s);
    /* Room for the search-clear button, rendered only once the field has a value. */
    padding-inline-end: calc(var(--lr-icon-button-size) + var(--lr-space-2xs));
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
  }
  [part='search']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* no-pressed-state: a press on a text field lands the caret rather than activating a control, so
     a pressed tint would last only the mousedown before the :focus-visible ring above -- the state
     that actually persists and communicates -- replaced it. */
  [part='search']:hover {
    border-color: var(--lr-color-border-strong);
  }
  [part='search']::-webkit-search-cancel-button,
  [part='search']::-webkit-search-decoration {
    /* Replaced by the themed search-clear button (unthemed glyph otherwise), not merely hidden. */
    appearance: none;
    -webkit-appearance: none;
    display: none;
  }
  [part='search']::placeholder {
    color: var(--lr-color-text-quiet);
  }
  [part='search-clear'] {
    position: absolute;
    inset-inline-end: var(--lr-space-2xs);
    inset-block-start: 50%;
    translate: 0 -50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: 0;
    border: none;
    border-radius: var(--lr-radius);
    background: none;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-m);
    cursor: pointer;
  }
  [part='search-clear']:hover {
    color: var(--lr-color-text);
    background: color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-hover));
  }
  [part='search-clear']:active {
    color: var(--lr-color-text);
    background: color-mix(
      in oklab,
      var(--lr-color-surface),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part='search-clear']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='list'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-size-2px);
    overflow-y: auto;
    overflow-x: clip;
    min-inline-size: 0;
  }
  [part='group-header'] {
    padding: var(--lr-space-2xs) var(--lr-space-s);
    font-size: var(--lr-font-size-xs);
    font-weight: var(--lr-font-weight-medium);
    color: var(--lr-color-text-quiet);
    text-transform: uppercase;
  }
  [part='item'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-size-2px);
    box-sizing: border-box;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: var(--lr-space-xs) var(--lr-space-s);
    border-radius: var(--lr-radius);
    cursor: grab;
  }
  [part='item'][aria-disabled='true'] {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }
  /* :where() zeroes the wrapped attribute-selector and pseudo-class, leaving :hover/:focus-visible
     alone at (0,1,0). Unwrapped, [part='item']:not([aria-disabled='true']):hover is (0,3,0) and
     out-ranks the source-later :active rule below, leaving a dragged item with no pressed fill. */
  :where([part='item']):hover:where(:not([aria-disabled='true'])),
  :where([part='item']):focus-visible:where(:not([aria-disabled='true'])) {
    background: var(--lr-color-surface-hover, var(--lr-color-border));
  }
  /* These items are drag sources (cursor: grab above), so the press is the moment the drag starts:
     deeper fill plus the grabbing cursor. Same :where() shape as the hover rule, so the two tie at
     (0,1,0) and source order hands this one the press. */
  :where([part='item']):active:where(:not([aria-disabled='true'])) {
    background: color-mix(in oklab, var(--lr-color-surface-hover, var(--lr-color-border)), var(--lr-color-mix-partner) var(--lr-color-mix-active));
    cursor: grabbing;
  }
  [part='item']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-width));
  }
  [part='item-label'] {
    font-weight: var(--lr-font-weight-medium);
  }
  [part='item-description'] {
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part='empty'] {
    padding: var(--lr-space-m);
    color: var(--lr-color-text-quiet);
    text-align: center;
  }
`;
