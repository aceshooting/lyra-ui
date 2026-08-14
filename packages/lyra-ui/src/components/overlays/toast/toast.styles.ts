import { css } from 'lit';

export const styles = css`
  :host {
    position: fixed;
    inset-block-start: max(var(--lr-space-l), var(--lr-safe-area-top));
    inset-block-end: max(var(--lr-space-l), var(--lr-safe-area-bottom));
    inset-inline-start: max(var(--lr-space-l), var(--lr-safe-area-inline-start));
    inset-inline-end: max(var(--lr-space-l), var(--lr-safe-area-inline-end));
    z-index: var(--lr-layer-toast);
    display: grid;
    --lr-toast-gap: var(--gap, var(--lr-space-s));
    --lr-toast-width: var(--width, var(--lr-size-28rem));
    pointer-events: none;
  }
  [part='stack'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-toast-gap);
    inline-size: min(var(--lr-toast-width), 100%);
    max-inline-size: 100%;
    min-block-size: 0;
    max-block-size: 100%;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  ::slotted(*) {
    pointer-events: auto;
  }
  ::slotted([data-toast-queued]) {
    display: none !important;
    pointer-events: none;
  }

  :host([placement^='top']) [part='stack'] {
    align-self: start;
  }
  :host([placement^='bottom']) [part='stack'] {
    align-self: end;
    flex-direction: column-reverse;
  }
  :host([placement$='start']) [part='stack'] {
    justify-self: start;
  }
  :host([placement$='center']) [part='stack'] {
    justify-self: center;
  }
  :host([placement$='end']) [part='stack'] {
    justify-self: end;
  }
`;
