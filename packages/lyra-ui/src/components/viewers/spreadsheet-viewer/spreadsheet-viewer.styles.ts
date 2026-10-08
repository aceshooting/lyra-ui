import { delimitedGridStyles, tableCellHighlightStyles } from '../table-viewer-shared.styles.js';
import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
  }
  ${delimitedGridStyles(css`var(--lr-spreadsheet-viewer-max-height, none)`)}
  [part='header-row'] {
    position: sticky;
    inset-block-start: 0;
    z-index: var(--lr-layer-content);
  }
  ${tableCellHighlightStyles({
    color: css`var(--lr-spreadsheet-viewer-highlight-color, var(--_lr-spreadsheet-viewer-highlight-color, var(--lr-color-brand)))`,
    padding: css`var(--lr-space-2xs) var(--lr-space-xs)`,
    outlineOffset: css`var(--lr-spreadsheet-viewer-highlight-outline-offset, calc(-1 * var(--lr-border-width-medium)))`,
    cellCursor: false,
  })}
  [part='rows'] {
    --lr-virtual-list-height: var(--lr-size-20rem);
    min-inline-size: max-content;
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
