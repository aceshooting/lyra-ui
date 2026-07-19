import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    vertical-align: middle;
    /* Swapped per-phase by the :host([phase]) rules below, rather than
       repeating color/opacity per rule -- same one-custom-property-per-tone
       shape as lr-tool-call-chip's --lr-tool-call-chip-accent. */
    --lr-stream-status-dot-color: var(--lr-color-text-quiet);
    --lr-stream-status-dot-opacity: 0.35;
  }

  /* 'connecting' gets a dimmer, static brand dot -- present but deliberately
     quieter than 'streaming' so the two are never confused at a glance. */
  :host([phase='connecting']) {
    --lr-stream-status-dot-color: var(--lr-color-brand);
    --lr-stream-status-dot-opacity: 0.6;
  }
  :host([phase='streaming']) {
    --lr-stream-status-dot-color: var(--lr-color-brand);
    --lr-stream-status-dot-opacity: 1;
  }
  /* Warning, not danger -- see the class doc's "Visual" section for why a
     stall defaults to the recoverable/actionable tone. */
  :host([phase='stalled']) {
    --lr-stream-status-dot-color: var(--lr-color-warning);
    --lr-stream-status-dot-opacity: 1;
  }

  [part='base'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-s);
    border-radius: var(--lr-radius);
    transition:
      background-color var(--lr-transition-base),
      border-color var(--lr-transition-base);
  }

  /* The one "unmistakable" treatment the spec calls for: a stall tints the
     whole row, not just the dot, so the message/actions read as one alert
     unit rather than a plain dot next to unrelated-looking text. */
  :host([phase='stalled']) [part='base'] {
    padding: var(--lr-space-xs) var(--lr-space-s);
    background: var(--lr-color-warning-quiet);
    border: var(--lr-border-width-thin) solid var(--lr-color-warning);
  }

  [part='indicator'] {
    flex: 0 0 auto;
    inline-size: var(--lr-size-0-5rem);
    block-size: var(--lr-size-0-5rem);
    border-radius: 50%;
    background: var(--lr-stream-status-dot-color);
    opacity: var(--lr-stream-status-dot-opacity);
    transition:
      background-color var(--lr-transition-base),
      opacity var(--lr-transition-base);
  }

  /* Only 'streaming' pulses -- a moving dot reads as "actively receiving
     data right now"; every other phase (including 'stalled', which wants
     steady attention via color/tint, not extra motion) stays static. Same
     token/rationale as lr-typing-indicator's pulse variant -- see that
     component's styles for the full explanation of why
     --lr-transition-ambient is the right length for an ambient loop. */
  :host([phase='streaming']) [part='indicator'] {
    animation: lr-stream-status-pulse var(--lr-transition-ambient) infinite;
  }
  @keyframes lr-stream-status-pulse {
    0%,
    100% {
      transform: scale(0.85);
      opacity: 0.6;
    }
    50% {
      transform: scale(1);
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    [part='indicator'] {
      animation: none !important;
    }
  }

  [part='message'] {
    color: var(--lr-color-warning);
    font-size: var(--lr-font-size-md-sm);
    font-weight: var(--lr-font-weight-semibold);
    line-height: var(--lr-line-height-snug);
  }

  [part='actions'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-xs);
  }
  [part='actions'][hidden] {
    display: none;
  }
`;
