import { css } from 'lit';

export const styles = css`
  :host {
    position: fixed;
    z-index: 9999;
    display: block;
    --gap: var(--lyra-space-s);
    --width: 28rem;
    pointer-events: none;
  }
  [part='stack'] {
    display: flex;
    flex-direction: column;
    gap: var(--gap);
    inline-size: var(--width);
    max-inline-size: calc(100vw - 2rem);
  }
  ::slotted(*) {
    pointer-events: auto;
  }

  :host([placement^='bottom']) [part='stack'] {
    flex-direction: column-reverse;
  }
  :host([placement='top-start']) {
    inset-block-start: 1rem;
    inset-inline-start: 1rem;
  }
  :host([placement='top-end']) {
    inset-block-start: 1rem;
    inset-inline-end: 1rem;
  }
  :host([placement='top-center']) {
    inset-block-start: 1rem;
    inset-inline: 0;
    margin-inline: auto;
  }
  :host([placement='bottom-start']) {
    inset-block-end: 1rem;
    inset-inline-start: 1rem;
  }
  :host([placement='bottom-end']) {
    inset-block-end: 1rem;
    inset-inline-end: 1rem;
  }
  :host([placement='bottom-center']) {
    inset-block-end: 1rem;
    inset-inline: 0;
    margin-inline: auto;
  }
`;
