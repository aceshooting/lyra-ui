import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
  }
  [part='base'] {
    display: flex;
    flex-direction: row;
    gap: var(--lr-space-2xs);
    padding: var(--lr-space-2xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    box-shadow: var(--lr-shadow);
  }
  :host([orientation='vertical']) [part='base'] {
    flex-direction: column;
  }
  /* Enumerated by part (rather than the previous bare "[part='base'] button"
     tag selector) so each control resolves to the shared minimum tappable
     size (--lr-icon-button-size) directly off its own [part='...'] --
     the floating toolbar already has the room, this doesn't change the
     rendered box, just how it's declared. */
  [part='zoom-in'],
  [part='zoom-out'],
  [part='fit'],
  [part='lock'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: 0;
    border: none;
    border-radius: var(--lr-radius);
    background: transparent;
    color: var(--lr-color-text);
    cursor: pointer;
  }
  [part='base'] button:hover:not(:disabled) {
    background: var(--lr-color-surface-hover, var(--lr-color-border));
  }
  [part='base'] button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  [part='base'] button:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='lock'][aria-pressed='true'] {
    color: var(--lr-color-brand);
  }
`;
