import { css } from 'lit';

export const styles = css`
  :host {
    position: fixed;
    z-index: var(--lr-layer-toast);
    display: block;
    --lr-toast-gap: var(--lr-space-s);
    --lr-toast-width: var(--lr-size-28rem);
    pointer-events: none;
  }
  [part='stack'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-toast-gap);
    inline-size: var(--lr-toast-width);
    max-inline-size: calc(
      100vw - (var(--lr-space-l) * 2) - var(--lr-safe-area-inline-start) -
        var(--lr-safe-area-inline-end)
    );
  }
  ::slotted(*) {
    pointer-events: auto;
  }

  :host([placement^='bottom']) [part='stack'] {
    flex-direction: column-reverse;
  }
  :host([placement='top-start']) {
    inset-block-start: max(var(--lr-space-l), var(--lr-safe-area-top));
    inset-inline-start: max(var(--lr-space-l), var(--lr-safe-area-inline-start));
  }
  :host([placement='top-end']) {
    inset-block-start: max(var(--lr-space-l), var(--lr-safe-area-top));
    inset-inline-end: max(var(--lr-space-l), var(--lr-safe-area-inline-end));
  }
  :host([placement='top-center']) {
    inset-block-start: max(var(--lr-space-l), var(--lr-safe-area-top));
    inset-inline: 0;
    margin-inline: auto;
  }
  :host([placement='bottom-start']) {
    inset-block-end: max(var(--lr-space-l), var(--lr-safe-area-bottom));
    inset-inline-start: max(var(--lr-space-l), var(--lr-safe-area-inline-start));
  }
  :host([placement='bottom-end']) {
    inset-block-end: max(var(--lr-space-l), var(--lr-safe-area-bottom));
    inset-inline-end: max(var(--lr-space-l), var(--lr-safe-area-inline-end));
  }
  :host([placement='bottom-center']) {
    inset-block-end: max(var(--lr-space-l), var(--lr-safe-area-bottom));
    inset-inline: 0;
    margin-inline: auto;
  }
`;
