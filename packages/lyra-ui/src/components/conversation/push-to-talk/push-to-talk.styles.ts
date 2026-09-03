import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    min-inline-size: 0;
    max-inline-size: 100%;
    flex-direction: column;
    align-items: center;
    gap: var(--lr-space-xs);
  }
  :host([disabled]) {
    cursor: not-allowed;
  }
  [part='trigger'] {
    font: inherit;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: relative;
    inline-size: var(--lr-push-to-talk-size, var(--lr-size-3rem));
    block-size: var(--lr-push-to-talk-size, var(--lr-size-3rem));
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
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
  /* :where() leaves this at (0,1,0) so the pressed rule below -- same specificity, later in source
     order -- still wins during the hold. It buys nothing against a consumer's own
     ::part(trigger):hover: encapsulation context sorts before specificity, so an outer normal
     declaration wins whatever this rule weighs. */
  :where([part='trigger']):hover:where(:not(:disabled)) {
    background: var(--lr-color-brand-quiet);
  }
  /* Press-and-hold is this component's entire interaction, so the pressed fill is the
     hold-registered signal, not decoration; it appears the instant the pointer goes down, before
     the recording state and its pulse ring have anything to show. */
  :where([part='trigger']):active:where(:not(:disabled)) {
    background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  :host([data-state='recording']) [part='trigger'] {
    border-color: var(
      --lr-push-to-talk-trigger-recording-border-color,
      var(--lr-push-to-talk-recording-color, var(--lr-color-danger))
    );
    color: var(
      --lr-push-to-talk-trigger-recording-color,
      var(--lr-push-to-talk-recording-color, var(--lr-color-danger))
    );
  }
  [part='icon'] {
    display: inline-flex;
    line-height: var(--lr-line-height-none);
  }
  [part='pulse'] {
    position: absolute;
    inset: calc(-1 * var(--lr-size-4px));
    border-radius: 50%;
    /* The aggregate recording color stays the shared fallback; the ring can be retinted
       independently of the trigger's border and foreground. */
    border: var(--lr-border-width-medium) solid
      var(
        --lr-push-to-talk-pulse-recording-border-color,
        var(--lr-push-to-talk-recording-color, var(--lr-color-danger))
      );
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
    max-inline-size: 100%;
    overflow-wrap: anywhere;
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
