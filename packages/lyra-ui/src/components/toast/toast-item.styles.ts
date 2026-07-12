import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --accent-width: 4px;
    --show-duration: var(--lyra-transition-base, 180ms ease-out);
    --hide-duration: var(--lyra-transition-base, 180ms ease-out);
    --padding: var(--lyra-space-m);
    --font-size: 1rem;
    --accent-color: var(--lyra-color-border);
  }
  :host([variant='brand']) {
    --accent-color: var(--lyra-color-brand);
  }
  :host([variant='success']) {
    --accent-color: var(--lyra-color-success);
  }
  :host([variant='warning']) {
    --accent-color: var(--lyra-color-warning);
  }
  :host([variant='danger']) {
    --accent-color: var(--lyra-color-danger);
  }
  :host([size='xs']) {
    --padding: var(--lyra-space-xs);
    --font-size: 0.75rem;
  }
  :host([size='s']) {
    --padding: var(--lyra-space-s);
    --font-size: 0.875rem;
  }
  :host([size='m']) {
    --padding: var(--lyra-space-m);
    --font-size: 1rem;
  }
  :host([size='l']) {
    --padding: var(--lyra-space-l);
    --font-size: 1.125rem;
  }
  :host([size='xl']) {
    --padding: calc(var(--lyra-space-l) * 1.5);
    --font-size: 1.25rem;
  }

  [part='toast-item'] {
    position: relative;
    display: flex;
    align-items: start;
    gap: var(--lyra-space-s);
    inline-size: 100%;
    padding: var(--padding);
    padding-inline-start: calc(var(--padding) + var(--accent-width));
    font-size: var(--font-size);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    border: 1px solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    box-shadow: var(--lyra-shadow);
    opacity: 0;
    transform: translateY(-8px);
    transition:
      opacity var(--show-duration),
      transform var(--show-duration);
  }
  :host([data-visible]) [part='toast-item'] {
    opacity: 1;
    transform: none;
  }
  @media (prefers-reduced-motion: reduce) {
    [part='toast-item'] {
      transition-duration: 0.01ms !important;
    }
  }

  [part='accent'] {
    position: absolute;
    inset-block: 0;
    inset-inline-start: 0;
    inline-size: var(--accent-width);
    background: var(--accent-color);
    border-start-start-radius: var(--lyra-radius);
    border-end-start-radius: var(--lyra-radius);
  }
  [part='icon'] {
    display: inline-flex;
    flex: 0 0 auto;
    color: var(--accent-color);
  }
  [part='content'] {
    flex: 1 1 auto;
    min-inline-size: 0;
  }
  [part='close-button'] {
    flex: 0 0 auto;
    margin-inline-start: auto;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--lyra-color-text-quiet);
    font-size: 1em;
    line-height: 1;
    padding: var(--lyra-space-xs);
    border-radius: var(--lyra-radius);
  }
  [part='close-button']:hover:not([aria-disabled='true']) {
    color: var(--lyra-color-text);
  }
  [part='close-button'][aria-disabled='true'] {
    opacity: var(--lyra-opacity-disabled);
    cursor: not-allowed;
  }
  [part='close-button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
`;
