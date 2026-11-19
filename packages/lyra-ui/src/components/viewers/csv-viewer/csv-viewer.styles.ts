import { delimitedGridStyles, tableCellHighlightStyles } from '../table-viewer-shared.styles.js';
import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
  }
  ${delimitedGridStyles(css`var(--lr-csv-viewer-max-height, none)`)}
  ${tableCellHighlightStyles({
    color: css`var(--lr-csv-viewer-highlight-color, var(--_lr-csv-viewer-highlight-color, var(--lr-color-brand)))`,
    padding: css`var(--lr-space-2xs) var(--lr-space-xs)`,
  })}
  [part='header-row'] { flex-shrink: 0; }
  [part='rows'] {
    display: flex;
    flex-direction: column;
    min-block-size: 0;
    min-inline-size: max-content;
  }
  [part='rows']::part(base) {
    block-size: auto;
    max-block-size: var(--lr-csv-viewer-max-height, var(--lr-size-20rem));
    min-block-size: 0;
  }
  .empty-note,
  [part='error'] {
    margin: 0;
    padding: var(--lr-space-m);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-md-sm);
  }
  [part='error'] {
    color: var(--lr-color-danger);
    text-align: center;
  }
`;
