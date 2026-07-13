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
    animation: lyra-poll-status-pulse 2s ease-in-out infinite;
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
