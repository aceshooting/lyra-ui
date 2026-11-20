import { iconActionStyles } from '../../../internal/icon-action.styles.js';
import { activeFill } from '../../../internal/interactive-control.styles.js';
import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part='base'] {
    display: inline-flex;
    min-inline-size: 0;
    max-inline-size: 100%;
    align-items: center;
    gap: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  [part='countdown'] {
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  [part='indicator'] {
    flex-shrink: 0;
    display: inline-block;
    inline-size: var(--lr-size-0-375rem);
    block-size: var(--lr-size-0-375rem);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-brand);
    /* Same token and rationale as lr-stream-status's and lr-typing-indicator's own looping pulse:
       --lr-transition-ambient is the length the library reserves for ambient "still alive" motion,
       so every looping indicator shares one calm rhythm rather than its own duration. */
    animation: var(--_lr-motion-animation, lr-poll-status-pulse var(--lr-transition-ambient) infinite);
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
  ${iconActionStyles("[part='pause-button']", {
    color: 'inherit',
    hoverBackground: 'var(--lr-poll-status-pause-hover-bg, var(--lr-color-brand-quiet))',
    hoverColor: 'var(--lr-poll-status-pause-hover-color, var(--lr-color-brand))',
    activeBackground: `var(--lr-poll-status-pause-active-bg, ${activeFill('var(--lr-color-brand-quiet)').cssText})`,
    activeColor: 'var(--lr-poll-status-pause-active-color, var(--lr-color-brand))',
  })}
  ${iconActionStyles("[part='refresh-button']", {
    color: 'inherit',
    hoverBackground: 'var(--lr-poll-status-refresh-hover-bg, var(--lr-color-brand-quiet))',
    hoverColor: 'var(--lr-poll-status-refresh-hover-color, var(--lr-color-brand))',
    activeBackground: `var(--lr-poll-status-refresh-active-bg, ${activeFill('var(--lr-poll-status-refresh-hover-bg, var(--lr-color-brand-quiet))').cssText})`,
    activeColor: 'var(--lr-poll-status-refresh-active-color, var(--lr-color-brand))',
  })}
  [part='pause-button'],
  [part='refresh-button'] {
    flex-shrink: 0;
    padding: var(--lr-size-0-125rem);
  }
`;
