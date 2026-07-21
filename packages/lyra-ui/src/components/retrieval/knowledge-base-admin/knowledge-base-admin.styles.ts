import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    container-type: inline-size;
  }

  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-m);
  }

  [part='heading'] {
    margin: 0;
    font-size: var(--lr-font-size-lg);
    font-weight: var(--lr-font-weight-semibold);
  }

  [part='tabs'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-2xs);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }

  [part='tab'] {
    padding: var(--lr-space-xs) var(--lr-space-s);
    border: none;
    border-block-end: var(--lr-border-width-medium) solid transparent;
    background: transparent;
    color: var(--lr-color-text-quiet);
    font: inherit;
    cursor: pointer;
  }

  [part='tab']:hover {
    color: var(--lr-color-text);
  }

  [part='tab']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part='tab'][aria-selected='true'] {
    border-block-end-color: var(--lr-color-brand);
    color: var(--lr-color-text);
    font-weight: var(--lr-font-weight-semibold);
  }

  [part='panel'] {
    min-inline-size: 0;
  }
`;
