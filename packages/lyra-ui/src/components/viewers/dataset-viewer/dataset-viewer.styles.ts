import { tableCellHighlightStyles } from '../table-viewer-shared.styles.js';
import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    min-inline-size: 0;
    border: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    overflow: hidden;
  }
  [part='body'] {
    box-sizing: border-box;
    overflow: auto;
    max-block-size: var(--lr-dataset-viewer-max-height, none);
  }
  /* A scroll container clips both axes and becomes the sticky header's containing block even when
     it has no height cap and therefore never scrolls. Page mode accepts page-level horizontal
     overflow in exchange for keeping an uncapped header pinned to the page scrollport. */
  :host([scroll-mode='page']) [part='base'] {
    overflow: visible;
  }
  :host([scroll-mode='page']) [part='header-row'] {
    border-start-start-radius: calc(var(--lr-radius) - var(--lr-border-width-thin));
    border-start-end-radius: calc(var(--lr-radius) - var(--lr-border-width-thin));
    overflow: clip;
  }
  :host([scroll-mode='page']) [part='body'] {
    overflow: visible;
    max-block-size: none;
  }
  [part='table'] {
    display: flex;
    flex-direction: column;
    min-inline-size: max-content;
    font-size: var(--lr-font-size-sm);
  }
  [part='header-row'] {
    position: sticky;
    inset-block-start: 0;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(var(--lr-size-8rem), 1fr);
    z-index: var(--lr-layer-content);
    background: var(--lr-dataset-viewer-header-row-bg, var(--lr-color-brand-quiet));
    color: var(--lr-color-text);
    font-weight: var(--lr-font-weight-semibold);
    border-block-end: var(--lr-border-width-medium) solid var(--lr-color-border-subtle);
  }
  [part='header-cell'] {
    padding: var(--lr-space-xs) var(--lr-space-s);
    border-inline-end: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* [part='data-row']/[part~='cell']/etc. below render inside <lr-virtual-list>'s own shadow root
     -- they are renderRow()'s return value, passed in as virtual-list's .renderItem -- so a plain
     [part=] selector scoped to this component's shadow root would never match a node in a
     *different* tree. lr-virtual-list::part(x) reaches that one boundary in. */
  lr-virtual-list::part(data-row) {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(var(--lr-size-8rem), 1fr);
  }
  lr-virtual-list::part(cell) {
    padding: var(--lr-space-xs) var(--lr-space-s);
    border-inline-end: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--lr-color-text);
  }
  ${tableCellHighlightStyles({
    color: css`var(--lr-dataset-viewer-highlight-color, var(--_lr-dataset-viewer-highlight-color, var(--lr-color-brand)))`,
    padding: css`var(--lr-space-xs) var(--lr-space-s)`,
  })}
  lr-virtual-list {
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
    padding: var(--lr-space-l);
    color: var(--lr-color-danger);
    text-align: center;
  }
`;
