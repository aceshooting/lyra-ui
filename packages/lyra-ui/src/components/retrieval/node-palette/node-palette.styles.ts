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
  [part='search'] {
    inline-size: 100%;
    box-sizing: border-box;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: var(--lr-space-xs) var(--lr-space-s);
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
     a pressed tint would show only for the length of the mousedown and then be replaced by the
     :focus-visible ring above, which is the state that actually persists and communicates. */
  [part='search']:hover {
    border-color: var(--lr-color-border-strong);
  }
  [part='search']::-webkit-search-cancel-button,
  [part='search']::-webkit-search-decoration {
    appearance: none;
  }
  [part='search']::placeholder {
    color: var(--lr-color-text-quiet);
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
  /* :where() zeroes the wrapped attribute-selector/pseudo-class contribution, leaving only
     :hover/:focus-visible itself -- (0,1,0) total, functionally identical selection to
     [part='item']:not([aria-disabled='true']):hover ((0,3,0)) but now losing (on the
     pseudo-element tiebreak) to a consumer's own ::part(item):hover override ((0,1,1)) without
     that consumer needing !important. Matches attachment-trigger.styles.ts's remediation pattern. */
  :where([part='item']):hover:where(:not([aria-disabled='true'])),
  :where([part='item']):focus-visible:where(:not([aria-disabled='true'])) {
    background: var(--lr-color-surface-hover, var(--lr-color-border));
  }
  /* These items are drag sources (cursor: grab above), so the pressed state is the moment the drag
     starts -- the deeper fill and the grabbing cursor together. Kept in the same :where() shape as
     the hover rule so a consumer's ::part(item):active still outranks it. */
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
