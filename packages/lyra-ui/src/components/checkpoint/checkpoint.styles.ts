import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lyra-space-s);
    inline-size: 100%;
  }
  [part='line'] {
    flex: 1 1 auto;
    min-inline-size: var(--lyra-size-1rem);
    block-size: var(--lyra-border-width-thin);
    background: var(--lyra-color-border);
  }
  [part='icon'] {
    flex: 0 0 auto;
    display: inline-flex;
    color: var(--lyra-color-text-quiet);
  }
  [part='label'] {
    flex: 0 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: var(--lyra-font-weight-semibold);
    font-size: var(--lyra-font-size-sm);
  }
  [part='timestamp'] {
    flex: 0 0 auto;
    font-size: var(--lyra-font-size-xs);
    color: var(--lyra-color-text-quiet);
  }
  [part='restore-button'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lyra-size-0-35em);
    flex: 0 0 auto;
    box-sizing: border-box;
    padding: var(--lyra-size-0-25rem) var(--lyra-space-s);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius-pill);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    font: inherit;
    font-size: var(--lyra-font-size-xs);
    cursor: pointer;
    transition:
      background-color var(--lyra-transition-fast),
      border-color var(--lyra-transition-fast);
  }
  [part='restore-button']:hover {
    border-color: var(--lyra-color-brand);
    color: var(--lyra-color-brand);
  }
  [part='restore-button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='restore-button'][aria-disabled='true'] {
    cursor: default;
    opacity: 0.7;
  }
  .restore-spinner {
    display: inline-flex;
  }
  .restore-spinner svg {
    display: block;
    animation: lyra-checkpoint-spin 1s linear infinite;
  }
  [part='confirm-group'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lyra-space-xs);
    flex: 0 0 auto;
  }
  [part='confirm-prompt'] {
    font-size: var(--lyra-font-size-xs);
    color: var(--lyra-color-text-quiet);
  }
  [part='confirm-button'],
  [part='cancel-button'] {
    box-sizing: border-box;
    padding: var(--lyra-size-0-25rem) var(--lyra-space-s);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    font: inherit;
    font-size: var(--lyra-font-size-xs);
    cursor: pointer;
  }
  [part='confirm-button'] {
    border-color: var(--lyra-color-brand);
    background: var(--lyra-color-brand-quiet);
    color: var(--lyra-color-brand);
    font-weight: var(--lyra-font-weight-semibold);
  }
  [part='confirm-button']:focus-visible,
  [part='cancel-button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  @keyframes lyra-checkpoint-spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    [part='restore-button'] {
      transition: none !important;
    }
    .restore-spinner svg {
      animation: none !important;
    }
  }
`;
