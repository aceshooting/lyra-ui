import { css } from 'lit';

export const styles = css`
  :host { display: block; min-inline-size: 0; --lyra-dataset-viewer-max-height: none; }
  [part='base'] { display: flex; flex-direction: column; box-sizing: border-box; min-inline-size: 0; border: var(--lyra-border-width-thin) solid var(--lyra-color-border); border-radius: var(--lyra-radius); background: var(--lyra-color-surface); overflow: hidden; }
  [part='body'] { box-sizing: border-box; overflow: auto; max-block-size: var(--lyra-dataset-viewer-max-height); }
  [part='table'] { display: flex; flex-direction: column; min-inline-size: max-content; font-size: var(--lyra-font-size-sm); }
  [part='header-row'] {
    position: sticky;
    inset-block-start: 0;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(var(--lyra-size-8rem), 1fr);
    z-index: var(--lyra-layer-content);
    background: var(--lyra-color-brand-quiet);
    color: var(--lyra-color-text);
    font-weight: var(--lyra-font-weight-semibold);
    border-block-end: var(--lyra-border-width-medium) solid var(--lyra-color-border);
  }
  [part='header-cell'] { padding: var(--lyra-space-xs) var(--lyra-space-s); border-inline-end: var(--lyra-border-width-thin) solid var(--lyra-color-border); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  /* [part='data-row']/[part~='cell']/etc. below render inside <lyra-virtual-list>'s own shadow
     root (they're renderRow()'s return value, passed in as virtual-list's .renderItem) -- a plain
     [part=] selector here, scoped to this component's own shadow root, would never match a node
     living in a *different* shadow tree. lyra-virtual-list::part(x) is what reaches one shadow
     boundary in. */
  lyra-virtual-list::part(data-row) { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(var(--lyra-size-8rem), 1fr); }
  lyra-virtual-list::part(cell) { padding: var(--lyra-space-xs) var(--lyra-space-s); border-inline-end: var(--lyra-border-width-thin) solid var(--lyra-color-border); border-block-end: var(--lyra-border-width-thin) solid var(--lyra-color-border); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--lyra-color-text); }
  /* The cell's padding moves onto the nested action button so the button's hit area covers the
     whole cell and the rendered text position is unchanged. The active/warning outline color
     can't be expressed as a [data-active] attribute selector chained onto ::part() (unsupported),
     so renderCell() sets the --lyra-dataset-viewer-highlight-color custom property inline instead
     -- custom properties inherit through the shadow boundary the same as anywhere else. */
  lyra-virtual-list::part(cell-highlight) { outline: var(--lyra-border-width-medium) solid var(--lyra-dataset-viewer-highlight-color, var(--lyra-color-brand)); outline-offset: calc(-1 * var(--lyra-border-width-medium)); cursor: pointer; padding: 0; }
  /* A real action button (not a plain grid cell -- see [part='header-cell']/::part(cell) above),
     so it gets the shared minimum tappable floor in the block dimension via a min-block-size on
     top of the "all: unset" reset above; its inline size already spans the full cell
     (inline-size: 100%) so no min-inline-size is strictly needed to reach the floor there, but it
     is set anyway so the part is self-describing independent of its container. */
  lyra-virtual-list::part(cell-highlight-action) {
    all: unset;
    box-sizing: border-box;
    display: block;
    inline-size: 100%;
    min-inline-size: var(--lyra-icon-button-size);
    min-block-size: var(--lyra-icon-button-size);
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
  }
  lyra-virtual-list::part(cell-highlight-action):focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: calc(var(--lyra-focus-ring-offset) * -1);
  }
  lyra-virtual-list { --lyra-virtual-list-height: var(--lyra-size-20rem); min-inline-size: max-content; }
  .empty-note, [part='error'] { margin: 0; padding: var(--lyra-space-m); color: var(--lyra-color-text-quiet); font-size: var(--lyra-font-size-md-sm); }
  [part='error'] { padding: var(--lyra-space-l); color: var(--lyra-color-danger); text-align: center; }
  [part='spinner'] { display: flex; justify-content: center; padding: var(--lyra-space-l); }
`;
