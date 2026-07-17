import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: var(--lyra-space-xs);
  }
  :host([disabled]) {
    cursor: not-allowed;
  }
  [part='trigger'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: relative;
    inline-size: var(--lyra-push-to-talk-size, var(--lyra-size-3rem));
    block-size: var(--lyra-push-to-talk-size, var(--lyra-size-3rem));
    border-radius: 50%;
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    cursor: pointer;
    touch-action: none;
  }
  [part='trigger']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='trigger']:disabled {
    opacity: var(--lyra-opacity-disabled);
    cursor: not-allowed;
  }
  :host([data-state='recording']) [part='trigger'] {
    border-color: var(--lyra-color-danger);
    color: var(--lyra-color-danger);
  }
  [part='icon'] {
    display: inline-flex;
    line-height: var(--lyra-line-height-none);
  }
  [part='pulse'] {
    position: absolute;
    inset: calc(-1 * var(--lyra-size-4px));
    border-radius: 50%;
    border: var(--lyra-border-width-medium) solid var(--lyra-color-danger);
    pointer-events: none;
    animation: lyra-push-to-talk-pulse var(--lyra-transition-ambient) infinite;
  }
  @keyframes lyra-push-to-talk-pulse {
    0%,
    100% {
      transform: scale(0.9);
      opacity: 0.7;
    }
    50% {
      transform: scale(1.15);
      opacity: 0.2;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    [part='pulse'] {
      animation: none !important;
      transform: none;
      opacity: 0.6;
    }
  }
  [part='status'] {
    font-size: var(--lyra-font-size-sm);
    color: var(--lyra-color-text-quiet);
    text-align: center;
  }
  [part='timer'] {
    font-size: var(--lyra-font-size-sm);
    font-variant-numeric: tabular-nums;
    color: var(--lyra-color-text-quiet);
  }
`;
