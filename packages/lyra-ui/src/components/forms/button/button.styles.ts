import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    /* A host width is meaningful for the public component, so the native
       button follows it. The variable keeps the contract opt-out-able for
       compact inline compositions. */
    --lr-button-width: 100%;
    --lr-button-size-2xs: var(--lr-size-1-25rem);
    --lr-button-size-xs: var(--lr-size-1-5rem);
    --lr-button-size-s: var(--lr-size-1-75rem);
    --lr-button-size-m: var(--lr-size-2rem);
    --lr-button-size-l: var(--lr-size-2-5rem);
    --lr-button-size-xl: var(--lr-size-3rem);
    --lr-button-accent: var(--lr-color-text);
    --lr-button-fill: var(--lr-color-surface);
    --lr-button-on-fill: var(--lr-color-text);
    --lr-button-border: var(--lr-color-border);
    --lr-button-outlined-border: var(--lr-color-border-strong);
    --lr-button-quiet-border: var(--lr-color-border);
    --lr-button-quiet-text: var(--lr-color-text-quiet);
    /* appearance="accent"'s loud fill for the neutral variant -- every other variant's own
       --lr-button-fill/-on-fill (below) already reads its semantic loud Lyra token, so those
       variants' accent-fill/-on-fill blocks reuse it. Only neutral needs a dedicated loud fill. */
    --lr-button-accent-fill: var(--lr-color-neutral);
    --lr-button-accent-on-fill: var(--lr-color-on-neutral);
  }
  :host([variant='brand']) {
    --lr-button-accent: var(--lr-color-brand);
    --lr-button-fill: var(--lr-color-brand);
    --lr-button-on-fill: var(--lr-color-on-brand);
    --lr-button-border: var(--lr-color-brand);
    --lr-button-accent-fill: var(--lr-color-brand);
    --lr-button-accent-on-fill: var(--lr-color-on-brand);
  }
  :host([variant='success']) {
    --lr-button-accent: var(--lr-color-success);
    --lr-button-fill: var(--lr-color-success);
    --lr-button-on-fill: var(--lr-color-on-success);
    --lr-button-border: var(--lr-color-success);
    --lr-button-accent-fill: var(--lr-color-success);
    --lr-button-accent-on-fill: var(--lr-color-on-success);
  }
  :host([variant='warning']) {
    --lr-button-accent: var(--lr-color-warning);
    --lr-button-fill: var(--lr-color-warning);
    --lr-button-on-fill: var(--lr-color-on-warning);
    --lr-button-border: var(--lr-color-warning);
    --lr-button-accent-fill: var(--lr-color-warning);
    --lr-button-accent-on-fill: var(--lr-color-on-warning);
  }
  :host([variant='danger']) {
    --lr-button-accent: var(--lr-color-danger);
    --lr-button-fill: var(--lr-color-danger);
    --lr-button-on-fill: var(--lr-color-on-danger);
    --lr-button-border: var(--lr-color-danger);
    --lr-button-accent-fill: var(--lr-color-danger);
    --lr-button-accent-on-fill: var(--lr-color-on-danger);
  }
  [part='base'] {
    display: inline-flex;
    position: relative;
    inline-size: var(--lr-button-width);
    align-items: center;
    justify-content: center;
    gap: var(--lr-space-2xs);
    border-radius: var(--lr-radius);
    border: var(--lr-border-width-thin) solid var(--lr-button-border);
    font: inherit;
    font-weight: var(--lr-font-weight-semibold);
    cursor: pointer;
  }
  :host([appearance='filled']) [part='base'] {
    background: var(--lr-button-fill);
    color: var(--lr-button-on-fill);
  }
  :host([appearance='accent']) [part='base'] {
    background: var(--lr-button-accent-fill);
    color: var(--lr-button-accent-on-fill);
    border-color: var(--lr-button-accent-fill);
  }
  :host([appearance='outlined']) [part='base'] {
    background: transparent;
    color: var(--lr-button-accent);
    border-color: var(--lr-button-outlined-border);
  }
  :host([appearance='plain']) [part='base'] {
    background: transparent;
    color: var(--lr-button-accent);
    border-color: transparent;
  }
  :host([appearance='quiet']) [part='base'] {
    background: transparent;
    color: var(--lr-button-quiet-text);
    border-color: var(--lr-button-quiet-border);
  }
  :host([appearance='quiet']) [part='base']:not(:disabled):hover {
    background: var(--lr-color-surface);
  }
  [part='base']:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part='base']:not(:disabled) {
    transition: filter var(--lr-transition-fast), transform var(--lr-transition-fast);
  }
  [part='base']:not(:disabled):hover {
    filter: brightness(var(--lr-button-hover-brightness, 1.08));
  }
  [part='base']:not(:disabled):active {
    transform: scale(var(--lr-button-active-scale, 0.9875));
  }
  @media (prefers-reduced-motion: reduce) {
    [part='base']:not(:disabled):active {
      transform: none;
    }
  }
  [part='base']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
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
  :host([size='2xs']) [part='base'] {
    padding-inline: var(--lr-space-2xs);
    padding-block: var(--lr-space-2xs);
    font-size: var(--lr-font-size-2xs);
    min-block-size: var(--lr-button-size-2xs);
  }
  :host([size='xs']) [part='base'] {
    padding-inline: var(--lr-space-xs);
    padding-block: var(--lr-space-2xs);
    font-size: var(--lr-font-size-xs);
    min-block-size: var(--lr-button-size-xs);
  }
  :host([size='s']) [part='base'] {
    padding-inline: var(--lr-space-s);
    padding-block: var(--lr-space-2xs);
    font-size: var(--lr-font-size-sm);
    min-block-size: var(--lr-button-size-s);
  }
  :host([size='m']) [part='base'] {
    padding-inline: var(--lr-space-m);
    padding-block: var(--lr-space-xs);
    font-size: var(--lr-font-size-m);
    min-block-size: var(--lr-button-size-m);
  }
  :host([size='l']) [part='base'] {
    padding-inline: var(--lr-space-l);
    padding-block: var(--lr-space-s);
    font-size: var(--lr-font-size-md);
    min-block-size: var(--lr-button-size-l);
  }
  :host([size='xl']) [part='base'] {
    padding-inline: var(--lr-space-2xl);
    padding-block: var(--lr-space-m);
    font-size: var(--lr-font-size-lg);
    min-block-size: var(--lr-button-size-xl);
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
    color: var(--lr-button-accent);
    font: inherit;
    text-decoration: underline;
    text-underline-offset: var(--lr-size-0-15rem);
  }
  [part='spinner'] {
    display: inline-flex;
    position: absolute;
    inset: 0;
    align-items: center;
    justify-content: center;
    animation: lr-button-spin var(--lr-button-spinner-duration, 1s) linear infinite;
  }
  :host([loading]) [part='start'],
  :host([loading]) [part='label'],
  :host([loading]) [part='end'] {
    opacity: 0;
  }
  @keyframes lr-button-spin {
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
