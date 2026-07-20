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
  [part='search']::-webkit-search-cancel-button,
  [part='search']::-webkit-search-decoration {
    appearance: none;
  }
  [part='list'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-size-2px);
    overflow-y: auto;
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
    padding: var(--lr-space-xs) var(--lr-space-s);
    border-radius: var(--lr-radius);
    cursor: grab;
    min-inline-size: 0;
  }
  [part='item'][aria-disabled='true'] {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }
  [part='item']:not([aria-disabled='true']):hover,
  [part='item']:not([aria-disabled='true']):focus-visible {
    background: var(--lr-color-surface-hover, var(--lr-color-border));
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
