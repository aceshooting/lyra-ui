import { focusRing } from '../../internal/interactive-control.styles.js';
import { css } from 'lit';

/** Shared chrome for native actions whose existing parts and event targets remain public. */
export const agentActionButtonStyles = css`
  button[data-agent-action] {
    --_lr-agent-action-state-fill: var(--lr-button-fill, var(--_lr-agent-action-fill, var(--lr-color-surface)));
    box-sizing: border-box;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-button-size-m, var(--lr-icon-button-size));
    max-inline-size: 100%;
    padding-block: var(--lr-button-padding-block, var(--lr-space-xs));
    padding-inline: var(--lr-button-padding-inline, var(--_lr-agent-action-padding-inline, var(--lr-space-s)));
    border: var(--lr-border-width-thin) solid var(--lr-button-border, var(--lr-color-border));
    border-radius: var(--lr-button-radius, var(--_lr-agent-action-radius, var(--lr-radius-button)));
    background: var(--_lr-agent-action-state-fill);
    color: var(--lr-button-on-fill, var(--lr-color-text));
    font: inherit;
    overflow-wrap: anywhere;
    cursor: pointer;
    transition: var(--lr-transition-interactive);
  }
  button[data-agent-action='brand'] {
    --_lr-agent-action-state-fill: var(--lr-button-accent-fill, var(--lr-color-brand));
    border-color: var(--lr-button-accent-fill, var(--lr-color-brand));
    color: var(--lr-button-accent-on-fill, var(--lr-color-on-brand));
  }
  button[data-agent-action='inline'] {
    border: 0;
    border-inline-start: var(--lr-border-width-thin) solid var(--_lr-agent-action-separator-color, var(--lr-color-border));
    border-radius: 0;
  }
  button[data-agent-action='filter'] {
    border-radius: var(--lr-button-radius, var(--lr-radius-pill));
  }
  button[data-agent-action='detail'] {
    --_lr-agent-action-state-fill: var(--lr-button-fill, transparent);
    border-radius: var(--lr-button-radius, var(--lr-radius-xs));
    color: var(--lr-button-on-fill, var(--lr-color-text-quiet));
  }
  button[data-agent-action]:where([aria-pressed='true']) {
    --_lr-agent-action-state-fill: var(--_lr-agent-action-selected-fill, var(--lr-color-brand-quiet));
    border-color: var(--_lr-agent-action-selected-border, var(--lr-button-accent-fill, var(--lr-color-brand)));
    color: var(--_lr-agent-action-selected-color, var(--lr-button-on-fill, var(--lr-color-text)));
  }
  button[data-agent-action]:where(:not(:disabled)):hover {
    background: var(--lr-button-hover-bg, color-mix(in oklab, var(--lr-button-hover-base, var(--_lr-agent-action-hover-base, var(--_lr-agent-action-state-fill))), var(--lr-color-mix-partner) var(--lr-color-mix-hover)));
  }
  button[data-agent-action]:where(:not(:disabled)):active {
    background: var(--lr-button-active-bg, color-mix(in oklab, var(--lr-button-hover-base, var(--_lr-agent-action-hover-base, var(--_lr-agent-action-state-fill))), var(--lr-color-mix-partner) var(--lr-color-mix-active)));
  }
  button[data-agent-action]:focus-visible {
    ${focusRing}
  }
  button[data-agent-action]:disabled {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }
  @media (prefers-reduced-motion: reduce) {
    button[data-agent-action] { transition: none; }
  }
`;
