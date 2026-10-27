import { css } from 'lit';

/** Resets native popover defaults inside a modal host's own styling scope. */
export const modalHostStyles = css`
  :host(:popover-open) {
    inset: auto;
    margin: 0;
    inline-size: auto;
    block-size: auto;
    border: none;
    padding: 0;
    overflow: visible;
    background: transparent;
  }
`;
