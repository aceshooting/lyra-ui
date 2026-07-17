import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: contents;
  }
  [part='row'],
  [part='col'] {
    min-inline-size: 0;
  }
`;
