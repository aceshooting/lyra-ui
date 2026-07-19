import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
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
    align-items: flex-end;
    gap: var(--lr-space-s);
  }
  [part='search'] {
    flex: 1 1 var(--lr-size-12rem);
    min-inline-size: 0;
  }
  [part='tag-filter'] {
    flex: 1 1 var(--lr-size-10rem);
    min-inline-size: 0;
  }
  [part='selection-bar'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--lr-space-s);
    padding-inline: var(--lr-space-s);
    padding-block: var(--lr-space-xs);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface-raised);
    color: var(--lr-color-text);
  }
  [part='selection-count'] {
    font-size: var(--lr-font-size-sm);
  }
  [part='clear-selection'] {
    border: 0;
    background: none;
    padding: 0;
    color: var(--lr-color-brand);
    font: inherit;
    cursor: pointer;
  }
  [part='clear-selection']:hover {
    text-decoration: underline;
  }
  [part='clear-selection']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='table'] {
    min-inline-size: 0;
  }
  [part='document-name'] {
    border: 0;
    background: none;
    padding: 0;
    color: var(--lr-color-brand);
    font: inherit;
    text-align: start;
    cursor: pointer;
  }
  [part='document-name']:hover {
    text-decoration: underline;
  }
  [part='document-name']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
`;
