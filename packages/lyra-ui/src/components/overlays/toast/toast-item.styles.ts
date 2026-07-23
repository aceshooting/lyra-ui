import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --lr-toast-accent-width: var(--lr-size-4px);
    --lr-toast-show-duration: var(--lr-transition-base, 180ms ease-out);
    --lr-toast-hide-duration: var(--lr-transition-base, 180ms ease-out);
    --lr-toast-padding: var(--lr-space-m);
    --lr-toast-font-size: var(--lr-font-size-md);
    --lr-toast-accent-color: var(--lr-color-border);
  }
  :host([variant='brand']) {
    --lr-toast-accent-color: var(--lr-color-brand);
  }
  :host([variant='success']) {
    --lr-toast-accent-color: var(--lr-color-success);
  }
  :host([variant='warning']) {
    --lr-toast-accent-color: var(--lr-color-warning);
  }
  :host([variant='danger']) {
    --lr-toast-accent-color: var(--lr-color-danger);
  }
  :host([size='xs']) {
    --lr-toast-padding: var(--lr-space-xs);
    --lr-toast-font-size: var(--lr-font-size-xs);
  }
  :host([size='s']) {
    --lr-toast-padding: var(--lr-space-s);
    --lr-toast-font-size: var(--lr-font-size-md-sm);
  }
  :host([size='m']) {
    --lr-toast-padding: var(--lr-space-m);
    --lr-toast-font-size: var(--lr-font-size-md);
  }
  :host([size='l']) {
    --lr-toast-padding: var(--lr-space-l);
    --lr-toast-font-size: var(--lr-font-size-lg);
  }
  :host([size='xl']) {
    --lr-toast-padding: calc(var(--lr-space-l) * 1.5);
    --lr-toast-font-size: var(--lr-font-size-xl);
  }

  [part='toast-item'] {
    position: relative;
    display: flex;
    align-items: start;
    gap: var(--lr-space-s);
    inline-size: 100%;
    padding: var(--lr-toast-padding);
    padding-inline-start: calc(var(--lr-toast-padding) + var(--lr-toast-accent-width));
    font-size: var(--lr-toast-font-size);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    box-shadow: var(--lr-shadow);
    opacity: 0;
    transform: translateY(var(--lr-size-neg-8px));
    transition:
      opacity var(--lr-toast-show-duration),
      transform var(--lr-toast-show-duration);
  }
  :host([data-hiding]) [part='toast-item'] {
    transition:
      opacity var(--lr-toast-hide-duration),
      transform var(--lr-toast-hide-duration);
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
    inline-size: var(--lr-toast-accent-width);
    background: var(--lr-toast-accent-color);
    border-start-start-radius: var(--lr-radius);
    border-end-start-radius: var(--lr-radius);
  }
  [part='icon'] {
    display: inline-flex;
    flex: 0 0 auto;
    color: var(--lr-toast-accent-color);
  }
  [part='content'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow-wrap: anywhere;
    /* Resolve each slotted message from its own first strong character. dir="auto" on the
       shadow wrapper cannot inspect assigned light-DOM text in every browser, while plaintext
       participates in the flattened text run and keeps an English message/action ordered inside
       an RTL page (and vice versa for Arabic content in LTR). */
    unicode-bidi: plaintext;
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
    /* Symmetric logical spacing remains on the correct side when plaintext bidi resolution makes
       the slotted content's reading direction differ from the page direction. */
    margin-inline: var(--lr-space-s);
    padding: 0;
    border: none;
    background: none;
    font: inherit;
    font-weight: var(--lr-font-weight-bold);
    color: var(--lr-toast-accent-color);
    text-decoration: underline;
    cursor: pointer;
  }
  ::slotted(button:hover) {
    color: var(--lr-color-text);
  }
  ::slotted(button:focus-visible) {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='close-button'] {
    flex: 0 0 auto;
    margin-inline-start: auto;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-size-1em);
    line-height: var(--lr-line-height-none);
    padding: var(--lr-space-xs);
    border-radius: var(--lr-radius);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
  }
  [part='close-button']:hover:not([aria-disabled='true']) {
    color: var(--lr-color-text);
  }
  [part='close-button'][aria-disabled='true'] {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part='close-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
`;
