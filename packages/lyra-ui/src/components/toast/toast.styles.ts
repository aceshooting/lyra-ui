import { css } from 'lit';

export const styles = css`
  :host {
    position: fixed;
    z-index: var(--lyra-layer-toast);
    display: block;
    --lyra-toast-gap: var(--lyra-space-s);
    --lyra-toast-width: var(--lyra-size-28rem);
    pointer-events: none;
  }
  [part='stack'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-toast-gap);
    inline-size: var(--lyra-toast-width);
    max-inline-size: calc(
      100vw - (var(--lyra-space-l) * 2) - var(--lyra-safe-area-inline-start) -
        var(--lyra-safe-area-inline-end)
    );
  }
  ::slotted(*) {
    pointer-events: auto;
  }

  :host([placement^='bottom']) [part='stack'] {
    flex-direction: column-reverse;
  }
  :host([placement='top-start']) {
    inset-block-start: max(var(--lyra-space-l), var(--lyra-safe-area-top));
    inset-inline-start: max(var(--lyra-space-l), var(--lyra-safe-area-inline-start));
  }
  :host([placement='top-end']) {
    inset-block-start: max(var(--lyra-space-l), var(--lyra-safe-area-top));
    inset-inline-end: max(var(--lyra-space-l), var(--lyra-safe-area-inline-end));
  }
  :host([placement='top-center']) {
    inset-block-start: max(var(--lyra-space-l), var(--lyra-safe-area-top));
    inset-inline: 0;
    margin-inline: auto;
  }
  :host([placement='bottom-start']) {
    inset-block-end: max(var(--lyra-space-l), var(--lyra-safe-area-bottom));
    inset-inline-start: max(var(--lyra-space-l), var(--lyra-safe-area-inline-start));
  }
  :host([placement='bottom-end']) {
    inset-block-end: max(var(--lyra-space-l), var(--lyra-safe-area-bottom));
    inset-inline-end: max(var(--lyra-space-l), var(--lyra-safe-area-inline-end));
  }
  :host([placement='bottom-center']) {
    inset-block-end: max(var(--lyra-space-l), var(--lyra-safe-area-bottom));
    inset-inline: 0;
    margin-inline: auto;
  }
`;
