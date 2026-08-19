import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    min-inline-size: 0;
    max-inline-size: 100%;
    vertical-align: middle;
    /* Public hooks stay undeclared here so a consumer can set either on an ancestor; the private
       values below hold the per-phase defaults, following lr-timeline-item's marker pattern. */
    --_lr-stream-status-dot-color-default: var(--lr-color-text-quiet);
    --_lr-stream-status-dot-opacity-default: 0.35;
  }

  /* 'connecting' gets a dimmer, static brand dot -- deliberately quieter than 'streaming' so the
     two are never confused at a glance. */
  :host([connection-state='connecting']) {
    --_lr-stream-status-dot-color-default: var(--lr-color-brand);
    --_lr-stream-status-dot-opacity-default: 0.6;
  }
  :host([connection-state='streaming']:not([data-stalled])) {
    --_lr-stream-status-dot-color-default: var(--lr-color-brand);
    --_lr-stream-status-dot-opacity-default: 1;
  }
  /* Warning, not danger: a stall defaults to the recoverable/actionable tone -- see the class doc's
     "Visual" section. */
  :host([data-stalled]) {
    --_lr-stream-status-dot-color-default: var(--lr-color-warning);
    --_lr-stream-status-dot-opacity-default: 1;
  }

  [part='base'] {
    display: inline-flex;
    flex-wrap: wrap;
    min-inline-size: 0;
    max-inline-size: 100%;
    align-items: center;
    gap: var(--lr-space-s);
    border-radius: var(--lr-radius);
    transition:
      background-color var(--lr-transition-base),
      border-color var(--lr-transition-base);
  }

  /* A stall tints the whole row, not just the dot, so the message and actions read as one alert
     unit rather than a plain dot next to unrelated-looking text. */
  :host([data-stalled]) [part='base'] {
    padding: var(--lr-space-xs) var(--lr-space-s);
    background: var(--lr-stream-status-stalled-bg, var(--lr-color-warning-quiet));
    border: var(--lr-border-width-thin) solid
      var(--lr-stream-status-stalled-border-color, var(--lr-color-warning));
  }

  [part='indicator'] {
    flex: 0 0 auto;
    inline-size: var(--lr-size-0-5rem);
    block-size: var(--lr-size-0-5rem);
    border-radius: 50%;
    background: var(--lr-stream-status-dot-color, var(--_lr-stream-status-dot-color-default));
    opacity: var(--lr-stream-status-dot-opacity, var(--_lr-stream-status-dot-opacity-default));
    transition:
      background-color var(--lr-transition-base),
      opacity var(--lr-transition-base);
  }

  [part='phase'] {
    min-inline-size: 0;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-md-sm);
    overflow-wrap: anywhere;
  }

  :host([data-stalled]) [part='phase'] {
    color: var(--lr-stream-status-message-color, var(--lr-color-warning));
    font-weight: var(--lr-font-weight-semibold);
  }

  /* Only 'streaming' pulses -- a moving dot reads as "actively receiving data right now". Every
     other phase stays static, 'stalled' included: it wants steady attention via color/tint, not
     motion. Same token and rationale as lr-typing-indicator's pulse variant, whose styles explain
     why --lr-transition-ambient suits an ambient loop. */
  :host([connection-state='streaming']:not([data-stalled])) [part='indicator'] {
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
    min-inline-size: 0;
    overflow-wrap: anywhere;
    color: var(--lr-stream-status-message-color, var(--lr-color-warning));
    font-size: var(--lr-font-size-md-sm);
    font-weight: var(--lr-font-weight-semibold);
    line-height: var(--lr-line-height-snug);
  }

  [part='actions'] {
    flex: 0 1 auto;
    min-inline-size: 0;
    flex-wrap: wrap;
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-xs);
  }
  [part='actions'][hidden] {
    display: none;
  }
`;
