import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
  }
  [part='base'] {
    min-inline-size: 0;
    overflow: hidden;
    border: var(--lr-border-width-thin) solid var(--lr-accordion-outlined-border-color, var(--lr-color-border));
    border-radius: var(--lr-radius);
    background: var(--lr-accordion-outlined-bg, var(--lr-color-surface));
  }
  :host([appearance='filled']) [part='base'] {
    border-color: var(--lr-accordion-filled-border-color, transparent);
    background: var(--lr-accordion-filled-bg, var(--lr-color-surface-raised));
  }
  :host([appearance='filled-outlined']) [part='base'] {
    border-color: var(--lr-accordion-filled-outlined-border-color, var(--lr-color-border));
    background: var(--lr-accordion-filled-outlined-bg, var(--lr-color-surface-raised));
  }
  :host([appearance='plain']) [part='base'] {
    overflow: visible;
    border-color: transparent;
    border-radius: 0;
    background: transparent;
  }
  ::slotted(:not(:first-child)) {
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
`;
