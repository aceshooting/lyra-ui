import { css } from 'lit';

export const styles = css`
  :host { display: block; min-inline-size: 0; --lr-dataset-viewer-max-height: none; }
  [part='base'] { display: flex; flex-direction: column; box-sizing: border-box; min-inline-size: 0; border: var(--lr-border-width-thin) solid var(--lr-color-border); border-radius: var(--lr-radius); background: var(--lr-color-surface); overflow: hidden; }
  [part='body'] { box-sizing: border-box; overflow: auto; max-block-size: var(--lr-dataset-viewer-max-height); }
  [part='table'] { display: flex; flex-direction: column; min-inline-size: max-content; font-size: var(--lr-font-size-sm); }
  [part='header-row'] {
    position: sticky;
    inset-block-start: 0;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(var(--lr-size-8rem), 1fr);
    z-index: var(--lr-layer-content);
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-text);
    font-weight: var(--lr-font-weight-semibold);
    border-block-end: var(--lr-border-width-medium) solid var(--lr-color-border);
  }
  [part='header-cell'] { padding: var(--lr-space-xs) var(--lr-space-s); border-inline-end: var(--lr-border-width-thin) solid var(--lr-color-border); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  /* [part='data-row']/[part~='cell']/etc. below render inside <lr-virtual-list>'s own shadow
     root (they're renderRow()'s return value, passed in as virtual-list's .renderItem) -- a plain
     [part=] selector here, scoped to this component's own shadow root, would never match a node
     living in a *different* shadow tree. lr-virtual-list::part(x) is what reaches one shadow
     boundary in. */
  lr-virtual-list::part(data-row) { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(var(--lr-size-8rem), 1fr); }
  lr-virtual-list::part(cell) { padding: var(--lr-space-xs) var(--lr-space-s); border-inline-end: var(--lr-border-width-thin) solid var(--lr-color-border); border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--lr-color-text); }
  /* The cell's padding moves onto the nested action button so the button's hit area covers the
     whole cell and the rendered text position is unchanged. The active/warning outline color
     can't be expressed as a [data-active] attribute selector chained onto ::part() (unsupported),
     so renderCell() sets the --lr-dataset-viewer-highlight-color custom property inline instead
     -- custom properties inherit through the shadow boundary the same as anywhere else. */
  lr-virtual-list::part(cell-highlight) { outline: var(--lr-border-width-medium) solid var(--lr-dataset-viewer-highlight-color, var(--lr-color-brand)); outline-offset: calc(-1 * var(--lr-border-width-medium)); cursor: pointer; padding: 0; }
  /* A real action button (not a plain grid cell -- see [part='header-cell']/::part(cell) above),
     so it gets the shared minimum tappable floor in the block dimension via a min-block-size on
     top of the "all: unset" reset above; its inline size already spans the full cell
     (inline-size: 100%) so no min-inline-size is strictly needed to reach the floor there, but it
     is set anyway so the part is self-describing independent of its container. */
  lr-virtual-list::part(cell-highlight-action) {
    all: unset;
    box-sizing: border-box;
    display: block;
    inline-size: 100%;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: var(--lr-space-xs) var(--lr-space-s);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
  }
  lr-virtual-list::part(cell-highlight-action):focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(var(--lr-focus-ring-offset) * -1);
  }
  lr-virtual-list { --lr-virtual-list-height: var(--lr-size-20rem); min-inline-size: max-content; }
  .empty-note, [part='error'] { margin: 0; padding: var(--lr-space-m); color: var(--lr-color-text-quiet); font-size: var(--lr-font-size-md-sm); }
  [part='error'] { padding: var(--lr-space-l); color: var(--lr-color-danger); text-align: center; }
  [part='spinner'] { display: flex; justify-content: center; padding: var(--lr-space-l); }
`;
