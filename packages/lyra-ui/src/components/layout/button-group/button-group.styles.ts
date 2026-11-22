import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    min-inline-size: 0;
    max-inline-size: 100%;
    vertical-align: middle;
  }

  [part~='base'] {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: stretch;
    gap: var(--lr-button-group-gap, var(--lr-space-2xs));
    max-inline-size: 100%;
    /* Grows into a host given a width, so --lr-button-group-justify has room to distribute. */
    flex-grow: 1;
    justify-content: var(--lr-button-group-justify, normal);
  }

  :host([orientation='vertical']) [part~='base'] {
    flex-direction: column;
    flex-grow: 0;
    align-items: stretch;
  }

  ::slotted(*) {
    min-inline-size: 0;
  }

`;
