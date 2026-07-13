import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --lyra-toast-accent-width: 4px;
    --lyra-toast-show-duration: var(--lyra-transition-base, 180ms ease-out);
    --lyra-toast-hide-duration: var(--lyra-transition-base, 180ms ease-out);
    --lyra-toast-padding: var(--lyra-space-m);
    --lyra-toast-font-size: 1rem;
    --lyra-toast-accent-color: var(--lyra-color-border);
  }
  :host([variant='brand']) {
    --lyra-toast-accent-color: var(--lyra-color-brand);
  }
  :host([variant='success']) {
    --lyra-toast-accent-color: var(--lyra-color-success);
  }
  :host([variant='warning']) {
    --lyra-toast-accent-color: var(--lyra-color-warning);
  }
  :host([variant='danger']) {
    --lyra-toast-accent-color: var(--lyra-color-danger);
  }
  :host([size='xs']) {
    --lyra-toast-padding: var(--lyra-space-xs);
    --lyra-toast-font-size: 0.75rem;
  }
  :host([size='s']) {
    --lyra-toast-padding: var(--lyra-space-s);
    --lyra-toast-font-size: 0.875rem;
  }
  :host([size='m']) {
    --lyra-toast-padding: var(--lyra-space-m);
    --lyra-toast-font-size: 1rem;
  }
  :host([size='l']) {
    --lyra-toast-padding: var(--lyra-space-l);
    --lyra-toast-font-size: 1.125rem;
  }
  :host([size='xl']) {
    --lyra-toast-padding: calc(var(--lyra-space-l) * 1.5);
    --lyra-toast-font-size: 1.25rem;
  }

  [part='toast-item'] {
    position: relative;
    display: flex;
    align-items: start;
    gap: var(--lyra-space-s);
    inline-size: 100%;
    padding: var(--lyra-toast-padding);
    padding-inline-start: calc(var(--lyra-toast-padding) + var(--lyra-toast-accent-width));
    font-size: var(--lyra-toast-font-size);
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
    border: 1px solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    box-shadow: var(--lyra-shadow);
    opacity: 0;
    transform: translateY(-8px);
    transition:
      opacity var(--lyra-toast-show-duration),
      transform var(--lyra-toast-show-duration);
  }
  :host([data-hiding]) [part='toast-item'] {
    transition:
      opacity var(--lyra-toast-hide-duration),
      transform var(--lyra-toast-hide-duration);
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
    inline-size: var(--lyra-toast-accent-width);
    background: var(--lyra-toast-accent-color);
    border-start-start-radius: var(--lyra-radius);
    border-end-start-radius: var(--lyra-radius);
  }
  [part='icon'] {
    display: inline-flex;
    flex: 0 0 auto;
    color: var(--lyra-toast-accent-color);
  }
  [part='content'] {
    flex: 1 1 auto;
    min-inline-size: 0;
  }
  /* toaster.ts's action option (and the WithIcon/Triggers stories) append a
     plain light-DOM button as a sibling of the message text -- without
     this, it renders with the browser's unstyled default button chrome,
     clashing with the rest of the token-driven design. Styled as an inline
     text action (matching the toast's own accent color) rather than a
     boxed button, since it sits directly after the message inside the
     content part rather than in its own layout slot. */
  ::slotted(button) {
    display: inline-block;
    margin-inline-start: var(--lyra-space-s);
    padding: 0;
    border: none;
    background: none;
    font: inherit;
    font-weight: bold;
    color: var(--lyra-toast-accent-color);
    text-decoration: underline;
    cursor: pointer;
  }
  ::slotted(button:hover) {
    color: var(--lyra-color-text);
  }
  ::slotted(button:focus-visible) {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
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
