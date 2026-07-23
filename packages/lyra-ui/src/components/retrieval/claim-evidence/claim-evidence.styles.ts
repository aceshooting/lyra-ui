import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    container-type: inline-size;
  }
  [part='list'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  [part~='claim'] {
    min-inline-size: 0;
    overflow: hidden;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
  }
  [part~='claim-selected'] {
    border-color: var(--lr-color-brand);
  }
  [part='claim-trigger'] {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: var(--lr-space-s);
    align-items: center;
    inline-size: 100%;
    min-block-size: var(--lr-icon-button-size);
    padding: var(--lr-space-s);
    border: 0;
    background: transparent;
    color: var(--lr-color-text);
    font: inherit;
    text-align: start;
    cursor: pointer;
  }
  [part='claim-trigger']:hover {
    background: var(--lr-color-surface-raised);
  }
  [part='claim-trigger']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(var(--lr-focus-ring-offset) * -1);
  }
  [part='claim-text'] {
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  [part='confidence'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
    white-space: nowrap;
  }
  [part='explanation'] {
    margin: 0;
    padding: 0 var(--lr-space-s) var(--lr-space-s);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }
  [part='evidence'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-xs);
    align-items: center;
    padding: var(--lr-space-s);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='evidence'] q {
    min-inline-size: 0;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
    overflow-wrap: anywhere;
  }
  @container (max-inline-size: 319.98px) {
    [part='claim-trigger'] {
      grid-template-columns: 1fr;
    }
  }
`;

