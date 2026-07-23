import { css } from 'lit';

/** Shared non-layout shell for slotted native-observer wrapper components. */
export const observerWrapperStyles = css`
  :host,
  [part='base'] {
    display: contents;
  }
`;

