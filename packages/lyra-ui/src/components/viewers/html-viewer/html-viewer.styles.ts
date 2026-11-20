import { css } from 'lit';
import { blockHost } from '../../../internal/layout-fragments.styles.js';

export const styles = css`
  :host {
    ${blockHost}
  }
  [part="body"] {
    min-block-size: var(--lr-size-10rem);
    max-block-size: var(--lr-html-viewer-max-height, none);
    box-sizing: border-box;
    overflow: auto;
    padding: var(--lr-space-m);
  }
  [part="html"] {
    display: block;
    max-inline-size: 100%;
    contain: paint;
    overflow-x: auto;
    overflow-wrap: anywhere;
  }
  [part="html"] img {
    max-inline-size: 100%;
    block-size: auto;
  }
  .empty-note,
  [part="error"] {
    margin: 0;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-md-sm);
    text-align: center;
  }
  [part="error"] {
    color: var(--lr-color-danger);
  }
`;
