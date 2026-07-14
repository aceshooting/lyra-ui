import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
  }
  [part='base'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    font-size: var(--lyra-font-size-sm);
    color: var(--lyra-color-text-quiet);
  }
  [part='indicator'] {
    display: inline-block;
    inline-size: var(--lyra-size-0-375rem);
    block-size: var(--lyra-size-0-375rem);
    border-radius: var(--lyra-radius-pill);
    background: var(--lyra-color-brand);
    /* Same token/rationale as lyra-stream-status's and lyra-typing-indicator's
       own looping pulse: --lyra-transition-ambient is the length the library
       reserves for ambient "still alive" motion, so every looping indicator
       shares one calm rhythm instead of hand-rolling its own duration. */
    animation: lyra-poll-status-pulse var(--lyra-transition-ambient) infinite;
  }
  [part='indicator'][data-due] {
    background: var(--lyra-color-success);
  }
  @keyframes lyra-poll-status-pulse {
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
    min-inline-size: var(--lyra-icon-button-size);
    min-block-size: var(--lyra-icon-button-size);
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    padding: var(--lyra-size-0-125rem);
    border-radius: var(--lyra-radius);
  }
  [part='pause-button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
`;
