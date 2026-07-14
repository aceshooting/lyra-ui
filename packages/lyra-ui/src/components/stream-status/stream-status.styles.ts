import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    vertical-align: middle;
    /* Swapped per-phase by the :host([phase]) rules below, rather than
       repeating color/opacity per rule -- same one-custom-property-per-tone
       shape as lyra-tool-call-chip's --lyra-tool-call-chip-accent. */
    --lyra-stream-status-dot-color: var(--lyra-color-text-quiet);
    --lyra-stream-status-dot-opacity: 0.35;
  }

  /* 'connecting' gets a dimmer, static brand dot -- present but deliberately
     quieter than 'streaming' so the two are never confused at a glance. */
  :host([phase='connecting']) {
    --lyra-stream-status-dot-color: var(--lyra-color-brand);
    --lyra-stream-status-dot-opacity: 0.6;
  }
  :host([phase='streaming']) {
    --lyra-stream-status-dot-color: var(--lyra-color-brand);
    --lyra-stream-status-dot-opacity: 1;
  }
  /* Warning, not danger -- see the class doc's "Visual" section for why a
     stall defaults to the recoverable/actionable tone. */
  :host([phase='stalled']) {
    --lyra-stream-status-dot-color: var(--lyra-color-warning);
    --lyra-stream-status-dot-opacity: 1;
  }

  [part='base'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lyra-space-s);
    border-radius: var(--lyra-radius);
    transition:
      background-color var(--lyra-transition-base),
      border-color var(--lyra-transition-base);
  }

  /* The one "unmistakable" treatment the spec calls for: a stall tints the
     whole row, not just the dot, so the message/actions read as one alert
     unit rather than a plain dot next to unrelated-looking text. */
  :host([phase='stalled']) [part='base'] {
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    background: var(--lyra-color-warning-quiet);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-warning);
  }

  [part='indicator'] {
    flex: 0 0 auto;
    inline-size: var(--lyra-size-0-5rem);
    block-size: var(--lyra-size-0-5rem);
    border-radius: 50%;
    background: var(--lyra-stream-status-dot-color);
    opacity: var(--lyra-stream-status-dot-opacity);
    transition:
      background-color var(--lyra-transition-base),
      opacity var(--lyra-transition-base);
  }

  /* Only 'streaming' pulses -- a moving dot reads as "actively receiving
     data right now"; every other phase (including 'stalled', which wants
     steady attention via color/tint, not extra motion) stays static. Same
     token/rationale as lyra-typing-indicator's pulse variant -- see that
     component's styles for the full explanation of why
     --lyra-transition-ambient is the right length for an ambient loop. */
  :host([phase='streaming']) [part='indicator'] {
    animation: lyra-stream-status-pulse var(--lyra-transition-ambient) infinite;
  }
  @keyframes lyra-stream-status-pulse {
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
    color: var(--lyra-color-warning);
    font-size: var(--lyra-font-size-md-sm);
    font-weight: var(--lyra-font-weight-semibold);
    line-height: var(--lyra-line-height-snug);
  }

  [part='actions'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lyra-space-xs);
  }
  [part='actions'][hidden] {
    display: none;
  }
`;
