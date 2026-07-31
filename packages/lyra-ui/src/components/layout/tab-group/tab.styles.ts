import { css } from 'lit';

export const styles = css`
  /* The group renders the real button and projects this element into it; contributing a box of its
     own would put a second layout node inside that button. */
  :host {
    display: contents;
  }
`;
