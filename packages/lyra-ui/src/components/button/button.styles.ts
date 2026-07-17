import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    /* A host width is meaningful for the public component, so the native
       button follows it. The variable keeps the contract opt-out-able for
       compact inline compositions. */
    --lyra-button-width: 100%;
    --lyra-button-size-xs: var(--lyra-size-1-5rem);
    --lyra-button-size-s: var(--lyra-size-1-75rem);
    --lyra-button-size-m: var(--lyra-size-2rem);
    --lyra-button-size-l: var(--lyra-size-2-5rem);
    --lyra-button-size-xl: var(--lyra-size-3rem);
    --lyra-button-accent: var(--lyra-color-text);
    --lyra-button-fill: var(--lyra-color-surface);
    --lyra-button-on-fill: var(--lyra-color-text);
    --lyra-button-border: var(--lyra-color-border);
    --lyra-button-outlined-border: var(--lyra-color-border-strong);
    /* appearance="accent"'s loud fill for the neutral variant -- every other variant's own
       --lyra-button-fill/-on-fill (below) already reads its semantic loud Lyra token, so those
       variants' accent-fill/-on-fill blocks reuse it. Only neutral needs a dedicated loud fill. */
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
    position: relative;
    inline-size: var(--lyra-button-width);
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
    border-color: var(--lyra-button-outlined-border);
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
    min-block-size: var(--lyra-button-size-xs);
  }
  :host([size='s']) [part='base'] {
    padding-inline: var(--lyra-space-s);
    padding-block: var(--lyra-space-2xs);
    font-size: var(--lyra-font-size-sm);
    min-block-size: var(--lyra-button-size-s);
  }
  :host([size='m']) [part='base'] {
    padding-inline: var(--lyra-space-m);
    padding-block: var(--lyra-space-xs);
    font-size: var(--lyra-font-size-m);
    min-block-size: var(--lyra-button-size-m);
  }
  :host([size='l']) [part='base'] {
    padding-inline: var(--lyra-space-l);
    padding-block: var(--lyra-space-s);
    font-size: var(--lyra-font-size-md);
    min-block-size: var(--lyra-button-size-l);
  }
  :host([size='xl']) [part='base'] {
    padding-inline: var(--lyra-space-2xl);
    padding-block: var(--lyra-space-m);
    font-size: var(--lyra-font-size-lg);
    min-block-size: var(--lyra-button-size-xl);
  }
  /* A true inline-link appearance: zero chrome (no padding, border, radius, or min-height floor),
     underlined, colored from the same accent token "plain" uses, and inheriting the ambient font
     so it flows within surrounding text. Declared after the size rules so it overrides the
     per-size font-size/padding/min-block-size regardless of the active "size". */
  :host([appearance='link']) [part='base'] {
    inline-size: auto;
    padding: 0;
    border: 0;
    min-block-size: 0;
    border-radius: 0;
    background: transparent;
    color: var(--lyra-button-accent);
    font: inherit;
    text-decoration: underline;
    text-underline-offset: var(--lyra-size-0-15rem);
  }
  [part='spinner'] {
    display: inline-flex;
    position: absolute;
    inset: 0;
    align-items: center;
    justify-content: center;
    animation: lyra-button-spin var(--lyra-button-spinner-duration, 1s) linear infinite;
  }
  :host([loading]) [part='start'],
  :host([loading]) [part='label'],
  :host([loading]) [part='end'] {
    opacity: 0;
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
