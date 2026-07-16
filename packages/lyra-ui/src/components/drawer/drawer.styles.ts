import { css } from 'lit';

export const styles = css`
  :host {
    align-items: stretch;
    justify-content: flex-start;
    padding: 0;
  }
  :host([placement='end']) {
    justify-content: flex-end;
  }
  :host([placement='top']) {
    align-items: flex-start;
    justify-content: stretch;
  }
  :host([placement='bottom']) {
    align-items: flex-end;
    justify-content: stretch;
  }
  [part='panel'] {
    inline-size: min(var(--lyra-drawer-width, var(--lyra-size-24rem)), 100%);
    block-size: 100%;
    max-inline-size: 100%;
    max-block-size: 100%;
    border-radius: 0;
  }
  :host([placement='top']) [part='panel'],
  :host([placement='bottom']) [part='panel'] {
    inline-size: 100%;
    block-size: min(var(--lyra-drawer-height, var(--lyra-size-24rem)), 100%);
    max-block-size: 100%;
  }
  @media (prefers-reduced-motion: no-preference) {
    [part='panel'] {
      animation: lyra-drawer-in var(--lyra-transition-base) both;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    [part='panel'] {
      animation: none;
    }
  }
  @keyframes lyra-drawer-in {
    from {
      opacity: 0;
      transform: translateX(var(--lyra-drawer-enter-x, calc(-1 * var(--lyra-size-1rem))));
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  :host([placement='end']) [part='panel'] {
    --lyra-drawer-enter-x: var(--lyra-size-1rem);
  }
  /* translateX is a physical transform -- logical properties don't cover it -- so the
     enter-from offset is flipped explicitly under RTL, the same way app-rail's offscreen
     panel transform is. A 'start' drawer rests at the physical right edge under RTL and
     must enter from further right (positive X); an 'end' drawer rests at the physical left
     edge and must enter from further left (negative X) -- the mirror image of the LTR rules
     above. */
  :host(:dir(rtl)) [part='panel'] {
    --lyra-drawer-enter-x: var(--lyra-size-1rem);
  }
  :host(:dir(rtl)[placement='end']) [part='panel'] {
    --lyra-drawer-enter-x: calc(-1 * var(--lyra-size-1rem));
  }
  :host([placement='top']) [part='panel'],
  :host([placement='bottom']) [part='panel'] {
    animation-name: lyra-drawer-in-block;
  }
  @keyframes lyra-drawer-in-block {
    from {
      opacity: 0;
      transform: translateY(var(--lyra-drawer-enter-y, calc(-1 * var(--lyra-size-1rem))));
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  :host([placement='bottom']) [part='panel'] {
    --lyra-drawer-enter-y: var(--lyra-size-1rem);
  }
`;
