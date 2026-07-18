import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    border: var(--lr-size-1px) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    overflow: hidden;
    block-size: 100%;
  }
  [part='header'] {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--lr-space-s);
    padding: var(--lr-space-xs) var(--lr-space-s);
    border-block-end: var(--lr-size-1px) solid var(--lr-color-border);
  }
  [part='label'] {
    font-weight: var(--lr-font-weight-semibold);
  }
  [part='kind'] {
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
    border: var(--lr-size-1px) solid var(--lr-color-border);
    border-radius: var(--lr-radius-pill);
    padding: 0 var(--lr-space-xs);
  }
  [part='view-toggle'] {
    display: flex;
    gap: var(--lr-size-1px);
  }
  [part='view-button'] {
    font: inherit;
    font-size: var(--lr-font-size-xs);
    background: var(--lr-color-surface);
    border: var(--lr-size-1px) solid var(--lr-color-border);
    padding: var(--lr-space-2xs) var(--lr-space-s);
    cursor: pointer;
  }
  [part='view-button'][aria-pressed='true'] {
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-brand);
  }
  [part='version-nav'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    font-size: var(--lr-font-size-xs);
    margin-inline-start: auto;
  }
  [part='version-previous'],
  [part='version-next'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border: none;
    background: none;
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-md);
    cursor: pointer;
    border-radius: var(--lr-radius);
  }
  [part='version-previous']:hover,
  [part='version-next']:hover {
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-brand);
  }
  [part='version-previous']:focus-visible,
  [part='version-next']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='version-previous']:disabled,
  [part='version-next']:disabled {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }
  [part='body'] {
    flex: 1 1 auto;
    padding: var(--lr-space-m);
    overflow: auto;
  }
  [part='body'][aria-busy='true'] {
    position: relative;
  }
  [part='streaming-indicator'] {
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
  }
`;
