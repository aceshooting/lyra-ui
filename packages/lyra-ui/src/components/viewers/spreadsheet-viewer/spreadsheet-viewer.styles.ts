import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    --_lr-spreadsheet-viewer-max-height: none;
  }
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
    max-block-size: var(
      --lr-spreadsheet-viewer-max-height,
      var(--_lr-spreadsheet-viewer-max-height)
    );
  }
  /* [part='body'] above caps and scrolls the vertical axis; [part='sheet'] below owns horizontal
     overflow, with both axes pinned non-visible -- per the CSS overflow spec, pinning only
     overflow-x forces overflow-y's used value to auto, risking a phantom scrollbar from sub-pixel
     rounding on a grid that never overflows vertically. Matches lr-csv-viewer. */
  [part='sheet'] {
    overflow-x: auto;
    overflow-y: hidden;
  }
  [part='header-row'] {
    display: grid;
    min-inline-size: max-content;
    align-items: center;
    position: sticky;
    inset-block-start: 0;
    z-index: var(--lr-layer-content);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font-weight: var(--lr-font-weight-semibold);
    border-block-end: var(--lr-border-width-medium) solid var(--lr-color-border);
  }
  [part='cell'] {
    padding: var(--lr-space-2xs) var(--lr-space-xs);
    border-inline-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text);
  }
  /* renderRow()/renderCell()'s output for a DATA row goes to <lr-virtual-list> as its .renderItem
     callback and renders inside THAT component's shadow root, so a plain [part=] selector above
     only reaches the header row this component renders directly. ::part() reaches one shadow
     boundary in, matching dataset-viewer. */
  lr-virtual-list::part(data-row) {
    display: grid;
    min-inline-size: max-content;
    align-items: center;
  }
  lr-virtual-list::part(cell) {
    padding: var(--lr-space-2xs) var(--lr-space-xs);
    border-inline-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text);
  }
  /* Body cell highlights live in lr-virtual-list's shadow root, so the cell and its nested native
     action are styled through exported parts; header highlights use the local part selectors. A
     private per-cell active default crosses the boundary without shadowing the inherited or
     direct public highlight-color input. */
  [part~='cell-highlight'],
  lr-virtual-list::part(cell-highlight) {
    outline: var(--lr-border-width-medium) solid
      var(
        --lr-spreadsheet-viewer-highlight-color,
        var(--_lr-spreadsheet-viewer-highlight-color, var(--lr-color-brand))
      );
    outline-offset: var(
      --lr-spreadsheet-viewer-highlight-outline-offset,
      calc(-1 * var(--lr-border-width-medium))
    );
    padding: 0;
  }
  [part='cell-highlight-action'],
  lr-virtual-list::part(cell-highlight-action) {
    all: unset;
    box-sizing: border-box;
    display: block;
    inline-size: 100%;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: var(--lr-space-2xs) var(--lr-space-xs);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
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
  [part='spinner'] {
    display: flex;
    justify-content: center;
    padding: var(--lr-space-l);
  }
`;
