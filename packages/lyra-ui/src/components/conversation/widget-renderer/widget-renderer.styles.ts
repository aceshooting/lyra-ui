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
    max-inline-size: 100%;
  }
  .widget-text {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
`;
