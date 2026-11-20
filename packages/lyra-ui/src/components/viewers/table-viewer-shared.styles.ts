import { css, unsafeCSS, type CSSResult } from 'lit';

/**
 * A column divider the last column drops: renderCell() zeroes the private width there, because the
 * frame already draws the table's inline-end edge.
 */
export const tableColumnDivider = css`
  border-inline-end: var(--_lr-table-column-divider, var(--lr-border-width-thin)) solid var(--lr-color-border-subtle);
`;
import { activeFill, focusRingShorthandInward, iconHitTarget, interactiveTransition } from '../../internal/interactive-control.styles.js';

/**
 * Grid chrome shared by the csv and spreadsheet viewers; `maxHeightToken` names the viewer's own
 * max-height custom property. The body caps at that token (uncapped by default) and the composed
 * row list shrinks to its content up to the same token (the default list cap when unset).
 */
export function delimitedGridStyles(maxHeightToken: CSSResult): CSSResult {
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
    max-block-size: var(${maxHeightToken}, none);
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
    ${tableColumnDivider}
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
  [part='header-row'] { flex-shrink: 0; }
  [part='rows'] {
    display: flex;
    flex-direction: column;
    min-block-size: 0;
    min-inline-size: max-content;
  }
  [part='rows']::part(base) {
    block-size: auto;
    max-block-size: var(${maxHeightToken}, var(--lr-size-20rem));
    min-block-size: 0;
  }
  :host([scroll-mode='page']) :is([part='body'], [part='sheet']),
  :host([scroll-mode='page']) [part='rows']::part(base) {
    max-block-size: none;
    overflow: visible;
  }
  :host([scroll-mode='page']) [part='header-row'] {
    position: sticky;
    inset-block-start: 0;
    z-index: var(--lr-layer-content);
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
  /** Component tag without the prefix (for example `csv-viewer`), naming the action's state tokens. */
  tag: string;
}

/** Highlighted-cell outline and its nested action button, shared by the three table viewers. */
export function tableCellHighlightStyles({
  color,
  padding,
  outlineOffset = css`calc(-1 * var(--lr-border-width-medium))`,
  cellCursor = true,
  tag,
}: TableCellHighlightOptions): CSSResult {
  const hover = unsafeCSS(`--lr-${tag}-cell-action-hover-bg`);
  const active = unsafeCSS(`--lr-${tag}-cell-action-active-bg`);
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
    ${interactiveTransition}
  }
  [part='cell-highlight-action']:hover,
  lr-virtual-list::part(cell-highlight-action):hover {
    background: var(${hover}, var(--lr-color-brand-quiet));
  }
  [part='cell-highlight-action']:active,
  lr-virtual-list::part(cell-highlight-action):active {
    background: var(${active}, ${activeFill('var(' + hover.cssText + ', var(--lr-color-brand-quiet))')});
  }
  [part='cell-highlight-action']:focus-visible,
  lr-virtual-list::part(cell-highlight-action):focus-visible {
    ${focusRingShorthandInward}
  }
`;
}
