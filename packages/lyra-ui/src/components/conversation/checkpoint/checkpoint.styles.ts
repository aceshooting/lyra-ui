import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-s);
    inline-size: 100%;
  }
  [part='line'] {
    flex: 1 1 auto;
    min-inline-size: var(--lr-size-1rem);
    block-size: var(--lr-border-width-thin);
    background: var(--lr-color-border);
  }
  [part='icon'] {
    flex: 0 0 auto;
    display: inline-flex;
    color: var(--lr-color-text-quiet);
  }
  [part='label'] {
    flex: 0 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: var(--lr-font-weight-semibold);
    font-size: var(--lr-font-size-sm);
  }
  [part='timestamp'] {
    flex: 0 0 auto;
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
  }
  [part='restore-button'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-size-0-35em);
    flex: 0 0 auto;
    box-sizing: border-box;
    padding: var(--lr-size-0-25rem) var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    font-size: var(--lr-font-size-xs);
    cursor: pointer;
    transition:
      background-color var(--lr-transition-fast),
      border-color var(--lr-transition-fast);
  }
  [part='restore-button']:hover {
    border-color: var(--lr-color-brand);
    color: var(--lr-color-brand);
  }
  [part='restore-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='restore-button'][aria-disabled='true'] {
    cursor: default;
    opacity: var(--lr-opacity-disabled);
  }
  .restore-spinner {
    display: inline-flex;
  }
  .restore-spinner svg {
    display: block;
    animation: lr-checkpoint-spin var(--lr-checkpoint-spin-duration, var(--lr-transition-ambient)) infinite;
  }
  [part='confirm-group'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
    flex: 0 0 auto;
  }
  [part='confirm-prompt'] {
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
  }
  [part='confirm-button'],
  [part='cancel-button'] {
    box-sizing: border-box;
    padding: var(--lr-size-0-25rem) var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    font-size: var(--lr-font-size-xs);
    cursor: pointer;
  }
  [part='confirm-button'] {
    border-color: var(--lr-color-brand);
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-brand);
    font-weight: var(--lr-font-weight-semibold);
  }
  [part='confirm-button']:focus-visible,
  [part='cancel-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='confirm-button']:hover, [part='cancel-button']:hover {
    background: var(--lr-color-brand-quiet);
  }
  @keyframes lr-checkpoint-spin {
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
