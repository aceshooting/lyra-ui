import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
  }
  [part='base'] {
    display: flex;
    flex-direction: row;
    gap: var(--lyra-space-2xs);
    padding: var(--lyra-space-2xs);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    box-shadow: var(--lyra-shadow);
  }
  :host([orientation='vertical']) [part='base'] {
    flex-direction: column;
  }
  /* Enumerated by part (rather than the previous bare "[part='base'] button"
     tag selector) so each control resolves to the shared minimum tappable
     size (--lyra-icon-button-size) directly off its own [part='...'] --
     the floating toolbar already has the room, this doesn't change the
     rendered box, just how it's declared. */
  [part='zoom-in'],
  [part='zoom-out'],
  [part='fit'],
  [part='lock'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lyra-icon-button-size);
    min-block-size: var(--lyra-icon-button-size);
    padding: 0;
    border: none;
    border-radius: var(--lyra-radius);
    background: transparent;
    color: var(--lyra-color-text);
    cursor: pointer;
  }
  [part='base'] button:hover:not(:disabled) {
    background: var(--lyra-color-surface-hover, var(--lyra-color-border));
  }
  [part='base'] button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  [part='base'] button:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='lock'][aria-pressed='true'] {
    color: var(--lyra-color-brand);
  }
`;
