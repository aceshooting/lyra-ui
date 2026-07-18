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
  [part='header-cell'], [part~='cell'] { padding: var(--lyra-space-xs) var(--lyra-space-s); border-inline-end: var(--lyra-border-width-thin) solid var(--lyra-color-border); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  [part~='cell'] { border-block-end: var(--lyra-border-width-thin) solid var(--lyra-color-border); color: var(--lyra-color-text); }
  [part='data-row'] { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(var(--lyra-size-8rem), 1fr); }
  /* The cell's padding moves onto the nested action button so the button's hit area covers the
     whole cell and the rendered text position is unchanged. */
  [part~='cell-highlight'] { outline: var(--lyra-border-width-medium) solid var(--lyra-color-brand); outline-offset: calc(-1 * var(--lyra-border-width-medium)); cursor: pointer; padding: 0; }
  [part~='cell-highlight'][data-active] { outline-color: var(--lyra-color-warning, var(--lyra-color-brand)); }
  [part='cell-highlight-action'] {
    all: unset;
    box-sizing: border-box;
    display: block;
    inline-size: 100%;
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
  }
  [part='cell-highlight-action']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: calc(var(--lyra-focus-ring-offset) * -1);
  }
  lyra-virtual-list { --lyra-virtual-list-height: var(--lyra-size-20rem); min-inline-size: max-content; }
  .empty-note, [part='error'] { margin: 0; padding: var(--lyra-space-m); color: var(--lyra-color-text-quiet); font-size: var(--lyra-font-size-md-sm); }
  [part='error'] { padding: var(--lyra-space-l); color: var(--lyra-color-danger); text-align: center; }
  [part='spinner'] { display: flex; justify-content: center; padding: var(--lyra-space-l); }
`;
