import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    border: var(--lyra-size-1px) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    overflow: hidden;
    block-size: 100%;
  }
  [part='header'] {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--lyra-space-s);
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    border-block-end: var(--lyra-size-1px) solid var(--lyra-color-border);
  }
  [part='label'] {
    font-weight: var(--lyra-font-weight-semibold);
  }
  [part='kind'] {
    font-size: var(--lyra-font-size-xs);
    color: var(--lyra-color-text-quiet);
    border: var(--lyra-size-1px) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius-pill);
    padding: 0 var(--lyra-space-xs);
  }
  [part='view-toggle'] {
    display: flex;
    gap: var(--lyra-size-1px);
  }
  [part='view-button'] {
    font: inherit;
    font-size: var(--lyra-font-size-xs);
    background: var(--lyra-color-surface);
    border: var(--lyra-size-1px) solid var(--lyra-color-border);
    padding: var(--lyra-space-2xs) var(--lyra-space-s);
    cursor: pointer;
  }
  [part='view-button'][aria-pressed='true'] {
    background: var(--lyra-color-brand-quiet);
    color: var(--lyra-color-brand);
  }
  [part='version-nav'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    font-size: var(--lyra-font-size-xs);
    margin-inline-start: auto;
  }
  [part='version-previous'],
  [part='version-next'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lyra-icon-button-size);
    min-block-size: var(--lyra-icon-button-size);
    border: none;
    background: none;
    color: var(--lyra-color-text);
    font-size: var(--lyra-font-size-md);
    cursor: pointer;
    border-radius: var(--lyra-radius);
  }
  [part='version-previous']:hover,
  [part='version-next']:hover {
    background: var(--lyra-color-brand-quiet);
    color: var(--lyra-color-brand);
  }
  [part='version-previous']:focus-visible,
  [part='version-next']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='version-previous']:disabled,
  [part='version-next']:disabled {
    cursor: not-allowed;
    opacity: var(--lyra-opacity-disabled);
  }
  [part='body'] {
    flex: 1 1 auto;
    padding: var(--lyra-space-m);
    overflow: auto;
  }
  [part='body'][aria-busy='true'] {
    position: relative;
  }
  [part='streaming-indicator'] {
    font-size: var(--lyra-font-size-xs);
    color: var(--lyra-color-text-quiet);
  }
`;
