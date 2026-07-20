import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: var(--lr-space-xs);
  }
  :host([disabled]) {
    cursor: not-allowed;
  }
  [part='trigger'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: relative;
    inline-size: var(--lr-push-to-talk-size, var(--lr-size-3rem));
    block-size: var(--lr-push-to-talk-size, var(--lr-size-3rem));
    border-radius: 50%;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    cursor: pointer;
    touch-action: none;
  }
  [part='trigger']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='trigger']:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part='trigger']:hover:not(:disabled) {
    background: var(--lr-color-brand-quiet);
  }
  :host([data-state='recording']) [part='trigger'] {
    border-color: var(--lr-push-to-talk-recording-color, var(--lr-color-danger));
    color: var(--lr-push-to-talk-recording-color, var(--lr-color-danger));
  }
  [part='icon'] {
    display: inline-flex;
    line-height: var(--lr-line-height-none);
  }
  [part='pulse'] {
    position: absolute;
    inset: calc(-1 * var(--lr-size-4px));
    border-radius: 50%;
    border: var(--lr-border-width-medium) solid var(--lr-color-danger);
    pointer-events: none;
    animation: lr-push-to-talk-pulse var(--lr-transition-ambient) infinite;
  }
  @keyframes lr-push-to-talk-pulse {
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
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
    text-align: center;
  }
  [part='timer'] {
    font-size: var(--lr-font-size-sm);
    font-variant-numeric: tabular-nums;
    color: var(--lr-color-text-quiet);
  }
`;
