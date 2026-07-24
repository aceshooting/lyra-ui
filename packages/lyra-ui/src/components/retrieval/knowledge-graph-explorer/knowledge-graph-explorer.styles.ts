import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    min-inline-size: 0;
  }
  [part='toolbar'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-s);
  }
  [part='search'] {
    flex: 1 1 var(--lr-size-12rem);
    min-inline-size: 0;
  }
  [part='search-results'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-size-2px);
    max-block-size: var(--lr-size-12rem);
    overflow-y: auto;
    overflow-x: clip;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
  }
  [part='search-result'] {
    display: block;
  }
  [part='search-result'] button {
    display: block;
    inline-size: 100%;
    box-sizing: border-box;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    text-align: start;
    padding: var(--lr-space-xs) var(--lr-space-s);
    border: none;
    background: transparent;
    color: var(--lr-color-text);
    font: inherit;
    overflow-wrap: anywhere;
    cursor: pointer;
  }
  [part='search-result'] button:hover {
    background: color-mix(in srgb, var(--lr-color-text) 8%, transparent);
  }
  [part='search-result'] button:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-width));
  }
  [part='search-empty'] {
    padding: var(--lr-space-xs) var(--lr-space-s);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }
  [part='pinned'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
  }
  [part='pinned-heading'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }
  [part='graph'] {
    display: block;
    inline-size: 100%;
  }
  [part='detail-card'] {
    max-inline-size: min(var(--lr-popover-viewport-clamp), var(--lr-size-24rem));
  }
`;
