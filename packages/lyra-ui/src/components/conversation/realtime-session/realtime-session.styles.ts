import { css } from 'lit';

export const styles = css`
  :host { display: block; container-type: inline-size; }
  [part='base'] { display: flex; flex-direction: column; gap: var(--lr-space-m); }
  [part='header'] { display: grid; grid-template-columns: auto minmax(var(--lr-size-8rem), 1fr) auto; gap: var(--lr-space-s); align-items: center; }
  [part='activity'] { min-inline-size: 0; }
  [part='controls'] { display: flex; flex-wrap: wrap; gap: var(--lr-space-xs); }
  [part='controls'] button {
    min-block-size: var(--lr-icon-button-size); padding: var(--lr-space-xs) var(--lr-space-s); border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius); background: var(--lr-color-surface); color: var(--lr-color-text); font: inherit; cursor: pointer;
  }
  [part='controls'] button:hover { background: var(--lr-color-surface-raised); }
  [part='controls'] button:focus-visible { outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: var(--lr-focus-ring-offset); }
  [part='error'] { margin: 0; padding: var(--lr-space-s); border-inline-start: var(--lr-border-width-thick) solid var(--lr-color-danger); background: var(--lr-color-danger-quiet); color: var(--lr-color-text); }
  [part='capture'] { align-self: center; }
  [part='transcript'] { min-block-size: var(--lr-size-8rem); min-inline-size: 0; }
  @container (max-inline-size: 319.98px) { [part='header'] { grid-template-columns: 1fr; } [part='controls'] { justify-content: flex-start; } }
`;

