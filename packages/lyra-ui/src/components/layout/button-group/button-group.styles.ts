import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    /* A column host sizes the row on its cross axis, so an auto row inline size fills the host. */
    flex-direction: column;
    min-inline-size: 0;
    max-inline-size: 100%;
    vertical-align: middle;
  }

  [part~='base'] {
    display: flex;
    flex-wrap: wrap;
    align-items: stretch;
    gap: var(--lr-button-group-gap, var(--lr-space-2xs));
    min-inline-size: 0;
    max-inline-size: 100%;
    /*
      Compact by default: the row hugs its content even inside a wider host. An authored
      --lr-button-group-justify keyword is invalid as an inline size, so the declaration falls
      back to its initial auto and the row fills a host given a width, giving the justify value
      room to distribute.
    */
    inline-size: var(--lr-button-group-justify, fit-content);
    justify-content: var(--lr-button-group-justify, normal);
  }

  :host([orientation='vertical']) [part~='base'] {
    flex-direction: column;
    inline-size: fit-content;
    align-items: stretch;
  }

  ::slotted(*) {
    min-inline-size: 0;
  }

`;
