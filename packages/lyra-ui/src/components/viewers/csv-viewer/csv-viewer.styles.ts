import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    --_lr-csv-viewer-max-height: none;
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
      --lr-csv-viewer-max-height,
      var(--_lr-csv-viewer-max-height)
    );
  }
  /* [part='body'] above caps the allocation while the nested virtual-list owns data-row scrolling;
     horizontal overflow of the grid is this element's own concern. Both axes pinned non-visible
     deliberately: per the CSS overflow
     spec, pinning only overflow-x forces overflow-y's used value to 'auto', risking a phantom
     scrollbar from sub-pixel rounding on a grid that never overflows vertically. Same fix as
     tabs.styles.ts. */
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
  /* renderRow()/renderCell()'s output for a DATA row is <lr-virtual-list>'s .renderItem callback,
     so it renders inside THAT component's shadow root: a plain [part=] selector above reaches only
     the header row, which this component renders directly. ::part() reaches one shadow boundary
     in, matching dataset-viewer. */
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
  /* A highlighted cell arrives through that same virtualized path, so it needs the same
     one-shadow-hop selector and the same outline tokens <lr-dataset-viewer> gives its own
     cell-highlight, keeping highlights identical across the table viewers. A [data-active]
     selector cannot chain onto ::part() (unsupported), so renderCell() sets a private active
     default inline; the public hook stays an inheritable input and wins over it. The nested action
     owns the focus ring, the structural cell the highlight outline. */
  /* no-hover-state: pointer feedback belongs to the nested [part='cell-highlight-action'], sized
     to cover this cell edge to edge (see its inline-size/min-block-size rules below), so a pointer
     anywhere on the highlighted cell already hovers that button; a second treatment here would
     double-tint the same gesture. */
  [part~='cell-highlight'],
  lr-virtual-list::part(cell-highlight) {
    outline: var(--lr-border-width-medium) solid
      var(
        --lr-csv-viewer-highlight-color,
        var(--_lr-csv-viewer-highlight-color, var(--lr-color-brand))
      );
    outline-offset: calc(-1 * var(--lr-border-width-medium));
    cursor: pointer;
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
  /* Mouse users get the interactive feedback keyboard users already get from the focus-visible
     ring below -- matching dataset-viewer's cell-highlight-action hover treatment. */
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
`;
