import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
  }
  [part='base'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  [part='indicator'] {
    display: inline-block;
    inline-size: var(--lr-size-0-375rem);
    block-size: var(--lr-size-0-375rem);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-brand);
    /* Same token/rationale as lr-stream-status's and lr-typing-indicator's
       own looping pulse: --lr-transition-ambient is the length the library
       reserves for ambient "still alive" motion, so every looping indicator
       shares one calm rhythm instead of hand-rolling its own duration. */
    animation: lr-poll-status-pulse var(--lr-transition-ambient) infinite;
  }
  [part='indicator'][data-due] {
    background: var(--lr-poll-status-due-bg, var(--lr-color-success));
  }
  [part='indicator'][data-inactive] {
    animation: none;
    opacity: var(--lr-opacity-disabled);
  }
  @keyframes lr-poll-status-pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    [part='indicator'] {
      animation: none;
    }
  }
  [part='pause-button'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    padding: var(--lr-size-0-125rem);
    border-radius: var(--lr-radius);
  }
  [part='pause-button']:hover:not(:disabled) {
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-brand);
  }
  [part='pause-button']:disabled {
    cursor: default;
    opacity: var(--lr-opacity-disabled);
  }
  [part='pause-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
`;
