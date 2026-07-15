import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    --lyra-button-accent: var(--lyra-color-text);
    --lyra-button-fill: var(--lyra-color-surface);
    --lyra-button-on-fill: var(--lyra-color-text);
    --lyra-button-border: var(--lyra-color-border);
    /* appearance="accent"'s loud fill for the neutral variant -- every other variant's own
       --lyra-button-fill/-on-fill (below) already reads a *-fill-loud WA token (see
       tokens.styles.ts's --lyra-color-brand/-success/-warning/-danger), so those variants'
       own accent-fill/-on-fill blocks just reuse it, making "accent" and "filled" coincide
       there -- only the neutral variant needs a dedicated loud fill of its own. */
    --lyra-button-accent-fill: var(--lyra-color-neutral);
    --lyra-button-accent-on-fill: var(--lyra-color-on-neutral);
  }
  :host([variant='brand']) {
    --lyra-button-accent: var(--lyra-color-brand);
    --lyra-button-fill: var(--lyra-color-brand);
    --lyra-button-on-fill: var(--lyra-color-on-brand);
    --lyra-button-border: var(--lyra-color-brand);
    --lyra-button-accent-fill: var(--lyra-color-brand);
    --lyra-button-accent-on-fill: var(--lyra-color-on-brand);
  }
  :host([variant='success']) {
    --lyra-button-accent: var(--lyra-color-success);
    --lyra-button-fill: var(--lyra-color-success);
    --lyra-button-on-fill: var(--lyra-color-on-success);
    --lyra-button-border: var(--lyra-color-success);
    --lyra-button-accent-fill: var(--lyra-color-success);
    --lyra-button-accent-on-fill: var(--lyra-color-on-success);
  }
  :host([variant='warning']) {
    --lyra-button-accent: var(--lyra-color-warning);
    --lyra-button-fill: var(--lyra-color-warning);
    --lyra-button-on-fill: var(--lyra-color-on-warning);
    --lyra-button-border: var(--lyra-color-warning);
    --lyra-button-accent-fill: var(--lyra-color-warning);
    --lyra-button-accent-on-fill: var(--lyra-color-on-warning);
  }
  :host([variant='danger']) {
    --lyra-button-accent: var(--lyra-color-danger);
    --lyra-button-fill: var(--lyra-color-danger);
    --lyra-button-on-fill: var(--lyra-color-on-danger);
    --lyra-button-border: var(--lyra-color-danger);
    --lyra-button-accent-fill: var(--lyra-color-danger);
    --lyra-button-accent-on-fill: var(--lyra-color-on-danger);
  }
  [part='base'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--lyra-space-2xs);
    border-radius: var(--lyra-radius);
    border: var(--lyra-border-width-thin) solid var(--lyra-button-border);
    font: inherit;
    font-weight: var(--lyra-font-weight-semibold);
    cursor: pointer;
  }
  :host([appearance='filled']) [part='base'] {
    background: var(--lyra-button-fill);
    color: var(--lyra-button-on-fill);
  }
  :host([appearance='accent']) [part='base'] {
    background: var(--lyra-button-accent-fill);
    color: var(--lyra-button-accent-on-fill);
    border-color: var(--lyra-button-accent-fill);
  }
  :host([appearance='outlined']) [part='base'] {
    background: transparent;
    color: var(--lyra-button-accent);
  }
  :host([appearance='plain']) [part='base'] {
    background: transparent;
    color: var(--lyra-button-accent);
    border-color: transparent;
  }
  [part='base']:disabled {
    opacity: var(--lyra-opacity-disabled);
    cursor: not-allowed;
  }
  [part='base']:not(:disabled) {
    transition: filter var(--lyra-transition-fast), transform var(--lyra-transition-fast);
  }
  [part='base']:not(:disabled):hover {
    filter: brightness(var(--lyra-button-hover-brightness, 1.08));
  }
  [part='base']:not(:disabled):active {
    transform: scale(var(--lyra-button-active-scale, 0.9875));
  }
  @media (prefers-reduced-motion: reduce) {
    [part='base']:not(:disabled):active {
      transform: none;
    }
  }
  [part='base']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='start']:empty,
  [part='end']:empty {
    display: none;
  }
  [part='start'],
  [part='end'] {
    display: inline-flex;
    align-items: center;
  }
  :host([size='xs']) [part='base'] {
    padding-inline: var(--lyra-space-xs);
    padding-block: var(--lyra-space-2xs);
    font-size: var(--lyra-font-size-xs);
    min-block-size: var(--lyra-size-1-5rem);
  }
  :host([size='s']) [part='base'] {
    padding-inline: var(--lyra-space-s);
    padding-block: var(--lyra-space-2xs);
    font-size: var(--lyra-font-size-sm);
    min-block-size: var(--lyra-size-1-75rem);
  }
  :host([size='m']) [part='base'] {
    padding-inline: var(--lyra-space-m);
    padding-block: var(--lyra-space-xs);
    font-size: var(--lyra-font-size-md-sm);
    min-block-size: var(--lyra-size-2rem);
  }
  :host([size='l']) [part='base'] {
    padding-inline: var(--lyra-space-l);
    padding-block: var(--lyra-space-s);
    font-size: var(--lyra-font-size-md);
    min-block-size: var(--lyra-size-2-5rem);
  }
  :host([size='xl']) [part='base'] {
    padding-inline: var(--lyra-space-2xl);
    padding-block: var(--lyra-space-m);
    font-size: var(--lyra-font-size-lg);
    min-block-size: var(--lyra-size-3rem);
  }
  [part='spinner'] {
    display: inline-flex;
    animation: lyra-button-spin 1s linear infinite;
  }
  @keyframes lyra-button-spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    [part='spinner'] {
      animation-duration: 0.001ms;
      animation-iteration-count: 1;
    }
  }
`;
