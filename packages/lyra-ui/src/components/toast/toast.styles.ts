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
    max-inline-size: calc(100vw - (var(--lyra-space-l) * 2));
  }
  ::slotted(*) {
    pointer-events: auto;
  }

  :host([placement^='bottom']) [part='stack'] {
    flex-direction: column-reverse;
  }
  :host([placement='top-start']) {
    inset-block-start: var(--lyra-space-l);
    inset-inline-start: var(--lyra-space-l);
  }
  :host([placement='top-end']) {
    inset-block-start: var(--lyra-space-l);
    inset-inline-end: var(--lyra-space-l);
  }
  :host([placement='top-center']) {
    inset-block-start: var(--lyra-space-l);
    inset-inline: 0;
    margin-inline: auto;
  }
  :host([placement='bottom-start']) {
    inset-block-end: var(--lyra-space-l);
    inset-inline-start: var(--lyra-space-l);
  }
  :host([placement='bottom-end']) {
    inset-block-end: var(--lyra-space-l);
    inset-inline-end: var(--lyra-space-l);
  }
  :host([placement='bottom-center']) {
    inset-block-end: var(--lyra-space-l);
    inset-inline: 0;
    margin-inline: auto;
  }
`;
