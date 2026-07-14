import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    --lyra-button-accent: var(--lyra-color-text);
    --lyra-button-fill: var(--lyra-color-surface);
    --lyra-button-on-fill: var(--lyra-color-text);
    --lyra-button-border: var(--lyra-color-border);
  }
  :host([variant='brand']) {
    --lyra-button-accent: var(--lyra-color-brand);
    --lyra-button-fill: var(--lyra-color-brand);
    --lyra-button-on-fill: var(--lyra-color-on-brand);
    --lyra-button-border: var(--lyra-color-brand);
  }
  :host([variant='success']) {
    --lyra-button-accent: var(--lyra-color-success);
    --lyra-button-fill: var(--lyra-color-success);
    --lyra-button-on-fill: var(--lyra-color-on-success);
    --lyra-button-border: var(--lyra-color-success);
  }
  :host([variant='warning']) {
    --lyra-button-accent: var(--lyra-color-warning);
    --lyra-button-fill: var(--lyra-color-warning);
    --lyra-button-on-fill: var(--lyra-color-on-warning);
    --lyra-button-border: var(--lyra-color-warning);
  }
  :host([variant='danger']) {
    --lyra-button-accent: var(--lyra-color-danger);
    --lyra-button-fill: var(--lyra-color-danger);
    --lyra-button-on-fill: var(--lyra-color-on-danger);
    --lyra-button-border: var(--lyra-color-danger);
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
