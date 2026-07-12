import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    align-items: center;
    gap: var(--lyra-space-s);
  }
  [part='base'] {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-s);
  }
  [part='play-button'] {
    inline-size: var(--lyra-icon-button-size);
    block-size: var(--lyra-icon-button-size);
    border-radius: 50%;
    border: 1px solid var(--lyra-color-border);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.875rem;
  }
  [part='play-button']:hover {
    border-color: var(--lyra-color-brand);
  }
  [part='play-button']:disabled {
    opacity: var(--lyra-opacity-disabled);
    cursor: not-allowed;
  }
  [part='play-button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='slider'] {
    accent-color: var(--lyra-color-brand);
  }
  [part='slider']:disabled {
    opacity: var(--lyra-opacity-disabled);
    cursor: not-allowed;
  }
  [part='slider']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
`;
