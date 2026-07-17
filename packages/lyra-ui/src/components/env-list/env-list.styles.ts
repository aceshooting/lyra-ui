import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: var(--lyra-space-xs) var(--lyra-space-s);
    align-items: baseline;
    margin: 0;
  }
  [part='name'] {
    font-family: var(--lyra-font-mono, ui-monospace, monospace);
    font-weight: var(--lyra-font-weight-semibold);
    margin: 0;
  }
  [part='value-cell'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lyra-space-xs);
    margin: 0;
  }
  [part='value'] {
    font-family: var(--lyra-font-mono, ui-monospace, monospace);
    overflow-wrap: anywhere;
  }
  [part='reveal-button'],
  [part='copy-button'] {
    font: inherit;
    font-size: var(--lyra-font-size-xs);
    background: none;
    border: var(--lyra-size-1px) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius-xs);
    padding: var(--lyra-space-2xs) var(--lyra-space-xs);
    cursor: pointer;
  }
  [part='reveal-button'][aria-pressed='true'] {
    background: var(--lyra-color-brand-quiet);
    border-color: var(--lyra-color-brand);
  }
`;
