import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  :host(:not([active])) {
    display: none;
  }
  [part='base'] {
    padding: var(--padding, 0);
  }
`;
