import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: contents;
  }
  [part='row'],
  [part='col'],
  [part='text'] {
    display: flex;
    flex-direction: column;
    flex-wrap: nowrap;
  }
  [part='row'] {
    flex-direction: row;
    flex-wrap: wrap;
  }
  [part='row'],
  [part='col'] {
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part='text'],
  .widget-text {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
`;
