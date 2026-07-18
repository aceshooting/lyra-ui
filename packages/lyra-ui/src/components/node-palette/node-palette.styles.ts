import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-xs);
    min-inline-size: 0;
  }
  [part='search'] {
    inline-size: 100%;
    box-sizing: border-box;
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    font: inherit;
  }
  [part='list'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-size-2px);
    overflow-y: auto;
    min-inline-size: 0;
  }
  [part='group-header'] {
    padding: var(--lyra-space-2xs) var(--lyra-space-s);
    font-size: var(--lyra-font-size-xs);
    font-weight: var(--lyra-font-weight-medium);
    color: var(--lyra-color-text-quiet);
    text-transform: uppercase;
  }
  [part='item'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-size-2px);
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    border-radius: var(--lyra-radius);
    cursor: grab;
    min-inline-size: 0;
  }
  [part='item'][aria-disabled='true'] {
    cursor: not-allowed;
    opacity: 0.5;
  }
  [part='item']:not([aria-disabled='true']):hover,
  [part='item']:not([aria-disabled='true']):focus-visible {
    background: var(--lyra-color-surface-hover, var(--lyra-color-border));
  }
  [part='item']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: calc(-1 * var(--lyra-focus-ring-width));
  }
  [part='item-label'] {
    font-weight: var(--lyra-font-weight-medium);
  }
  [part='item-description'] {
    font-size: var(--lyra-font-size-xs);
    color: var(--lyra-color-text-quiet);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part='empty'] {
    padding: var(--lyra-space-m);
    color: var(--lyra-color-text-quiet);
    text-align: center;
  }
`;
