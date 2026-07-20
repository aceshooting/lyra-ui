import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: var(--lr-space-xs) var(--lr-space-s);
    align-items: baseline;
    margin: 0;
  }
  [part='name'] {
    font-family: var(--lr-font-mono, ui-monospace, monospace);
    font-weight: var(--lr-font-weight-semibold);
    margin: 0;
  }
  [part='value-cell'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
    margin: 0;
  }
  [part='value'] {
    font-family: var(--lr-font-mono, ui-monospace, monospace);
    overflow-wrap: anywhere;
  }
  [part='reveal-button'],
  [part='copy-button'] {
    font: inherit;
    font-size: var(--lr-font-size-xs);
    background: none;
    border: var(--lr-size-1px) solid var(--lr-color-border);
    border-radius: var(--lr-radius-xs);
    padding: var(--lr-space-2xs) var(--lr-space-xs);
    cursor: pointer;
  }
  [part='reveal-button']:hover,
  [part='copy-button']:hover {
    background: var(--lr-color-brand-quiet);
  }
  [part='reveal-button'][aria-pressed='true'] {
    background: var(--lr-env-list-reveal-active-bg, var(--lr-color-brand-quiet));
    border-color: var(--lr-env-list-reveal-active-border, var(--lr-color-brand));
  }
`;
