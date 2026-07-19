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
    align-items: center;
    gap: var(--lr-space-xs);
  }
  [part='add-button'],
  [part='remove-button'] {
    display: inline-flex;
    align-items: center;
    padding: var(--lr-space-xs) var(--lr-space-m);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    cursor: pointer;
  }
  [part='add-button']:hover:not(:disabled),
  [part='remove-button']:hover:not(:disabled) {
    border-color: var(--lr-color-brand);
  }
  [part='add-button']:disabled,
  [part='remove-button']:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part='add-button']:focus-visible,
  [part='remove-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='import'] {
    flex: 0 1 auto;
    min-inline-size: 0;
    max-inline-size: var(--lr-size-14rem);
  }
  [part='search'] {
    display: block;
  }
  [part='search-input'] {
    box-sizing: border-box;
    inline-size: 100%;
    padding-inline: var(--lr-space-s);
    padding-block: var(--lr-space-xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
  }
  [part='search-input']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='tag-filter'] {
    display: block;
  }
  [part='grid'] {
    display: block;
    min-inline-size: 0;
  }
`;
