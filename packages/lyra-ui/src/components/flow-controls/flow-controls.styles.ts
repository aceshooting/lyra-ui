import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
  }
  [part='base'] {
    display: flex;
    flex-direction: row;
    gap: var(--lyra-space-2xs);
    padding: var(--lyra-space-2xs);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    box-shadow: var(--lyra-shadow);
  }
  :host([orientation='vertical']) [part='base'] {
    flex-direction: column;
  }
  [part='base'] button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--lyra-icon-button-size);
    block-size: var(--lyra-icon-button-size);
    padding: 0;
    border: none;
    border-radius: var(--lyra-radius);
    background: transparent;
    color: var(--lyra-color-text);
    cursor: pointer;
  }
  [part='base'] button:hover:not(:disabled) {
    background: var(--lyra-color-surface-hover, var(--lyra-color-border));
  }
  [part='base'] button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  [part='base'] button:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='lock'][aria-pressed='true'] {
    color: var(--lyra-color-brand);
  }
`;
