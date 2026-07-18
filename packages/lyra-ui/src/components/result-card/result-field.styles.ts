import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  /* Dense "label: value" single-line row by default -- the compact
     presentation short status/duration/count content (the kind this
     component is meant for) reads best as, versus a stacked two-line
     layout. A consumer that prefers stacked can override this from the
     light DOM: :host { } / [part='base'] { flex-direction: column; }. */
  [part='base'] {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    column-gap: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
    line-height: var(--lr-line-height-1-4);
  }
  [part='label'] {
    flex: 0 0 auto;
    color: var(--lr-color-text-quiet);
  }
  [part='value'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    color: var(--lr-color-text);
    overflow-wrap: anywhere;
  }
  [part='value'] ::slotted(*) {
    vertical-align: middle;
  }
`;
