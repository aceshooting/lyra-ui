import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    /* Fallback for a deeply-indented node whose row still overflows despite
       the [part=label] truncation + padding-inline-start cap in tree-node.ts. */
    overflow-x: auto;
  }
`;
