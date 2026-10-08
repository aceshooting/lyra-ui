import { css, type CSSResult } from 'lit';
import { iconHitTarget } from '../../internal/interactive-control.styles.js';

/** Grid chrome shared by the csv and spreadsheet viewers; `maxHeight` is the viewer's own `var()` hook. */
export function delimitedGridStyles(maxHeight: CSSResult): CSSResult {
  return css`
  [part='base'],
  [part='body'],
  [part='sheet'] {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
  }
  [part='body'] {
    box-sizing: border-box;
    overflow-y: auto;
    overflow-x: hidden;
    max-block-size: ${maxHeight};
  }
  /* The body caps the vertical axis and the sheet owns horizontal overflow; both axes stay pinned
     non-visible because pinning only overflow-x forces overflow-y to auto (phantom scrollbar). */
  [part='sheet'] {
    overflow-x: auto;
    overflow-y: hidden;
  }
  [part='header-row'] {
    display: grid;
    min-inline-size: max-content;
    align-items: center;
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font-weight: var(--lr-font-weight-semibold);
    border-block-end: var(--lr-border-width-medium) solid var(--lr-color-border-subtle);
  }
  [part='cell'],
  lr-virtual-list::part(cell) {
    padding: var(--lr-space-2xs) var(--lr-space-xs);
    border-inline-end: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text);
  }
  /* Data rows render inside lr-virtual-list's shadow root, so ::part() reaches one boundary in. */
  lr-virtual-list::part(data-row) {
    display: grid;
    min-inline-size: max-content;
    align-items: center;
  }
`;
}

export interface TableCellHighlightOptions {
  /** Outline color: the viewer's own `var()` hook chain. */
  color: CSSResult;
  /** Padding of the nested action button (the highlighted cell itself has none). */
  padding: CSSResult;
  /** Outline offset; defaults to inset by the medium border width. */
  outlineOffset?: CSSResult;
  /** Sets `cursor: pointer` on the structural highlighted cell. */
  cellCursor?: boolean;
}

/** Highlighted-cell outline and its nested action button, shared by the three table viewers. */
export function tableCellHighlightStyles({
  color,
  padding,
  outlineOffset = css`calc(-1 * var(--lr-border-width-medium))`,
  cellCursor = true,
}: TableCellHighlightOptions): CSSResult {
  const cursor = cellCursor ? css`cursor: pointer;` : css``;
  return css`
  /* Body highlights render in lr-virtual-list's shadow root, so they use ::part(); a [data-active]
     selector cannot chain onto ::part(), so renderCell() sets a private active default inline and
     the public hook stays an inheritable input that wins over it. */
  /* no-hover-state: pointer feedback belongs to the nested [part='cell-highlight-action'], sized to
     cover this cell edge to edge, so a second treatment here would double-tint one gesture. */
  [part~='cell-highlight'],
  lr-virtual-list::part(cell-highlight) {
    outline: var(--lr-border-width-medium) solid ${color};
    outline-offset: ${outlineOffset};
    ${cursor}
    padding: 0;
  }
  [part='cell-highlight-action'],
  lr-virtual-list::part(cell-highlight-action) {
    all: unset;
    box-sizing: border-box;
    display: block;
    inline-size: 100%;
    ${iconHitTarget}
    padding: ${padding};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
    transition: background-color var(--lr-transition-fast);
  }
  [part='cell-highlight-action']:hover,
  lr-virtual-list::part(cell-highlight-action):hover {
    background: var(--lr-color-brand-quiet);
  }
  [part='cell-highlight-action']:active,
  lr-virtual-list::part(cell-highlight-action):active {
    background: color-mix(
      in oklab,
      var(--lr-color-brand-quiet),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part='cell-highlight-action']:focus-visible,
  lr-virtual-list::part(cell-highlight-action):focus-visible {
    outline: var(--lr-focus-ring);
    outline-offset: calc(var(--lr-focus-ring-offset) * -1);
  }
`;
}
