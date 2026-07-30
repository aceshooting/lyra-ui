import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
  }

  [part='base'] {
    min-inline-size: 0;
  }

  [part='metadata'] {
    box-sizing: border-box;
    display: block;
    inline-size: 100%;
    max-inline-size: 100%;
    min-inline-size: 0;
    overflow-x: auto;
    white-space: pre;
  }
`;
