import { delimitedGridStyles, tableCellHighlightStyles } from '../table-viewer-shared.styles.js';
import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
  }
  ${delimitedGridStyles(css`--lr-csv-viewer-max-height`)}
  [part='base'] {
    background: var(--lr-csv-viewer-background, transparent);
    border: var(--lr-csv-viewer-border, none);
    border-radius: var(--lr-csv-viewer-border-radius, 0);
  }
  [part='header-row'] {
    background: var(--lr-csv-viewer-header-row-bg, var(--lr-color-surface));
  }
  ${tableCellHighlightStyles({
    color: css`var(--lr-csv-viewer-highlight-color, var(--_lr-csv-viewer-highlight-color, var(--lr-color-brand)))`,
    padding: css`var(--lr-space-2xs) var(--lr-space-xs)`,
  })}
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
