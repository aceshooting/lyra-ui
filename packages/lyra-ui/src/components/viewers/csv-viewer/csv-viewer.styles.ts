import { css } from 'lit';

export const styles = css`
  :host { display: block; min-inline-size: 0; --lr-csv-viewer-max-height: none; }
  [part='base'], [part='body'], [part='sheet'] { display: flex; flex-direction: column; min-inline-size: 0; }
  [part='body'] { box-sizing: border-box; overflow-y: auto; overflow-x: hidden; max-block-size: var(--lr-csv-viewer-max-height); }
  /* Vertical overflow is capped/scrolled by [part='body'] above; horizontal overflow of the grid
     itself is this element's own concern -- both axes are pinned non-visible on purpose (per the
     CSS overflow spec, pinning only overflow-x forces overflow-y's used value to 'auto' too,
     risking a phantom/empty scrollbar from sub-pixel rounding on a grid that never actually
     overflows vertically -- matching tabs.styles.ts's fix for the identical bug shape). */
  [part='sheet'] { overflow-x: auto; overflow-y: hidden; }
  [part='header-row'] { display: grid; min-inline-size: max-content; align-items: center; position: sticky; inset-block-start: 0; z-index: var(--lr-layer-content); background: var(--lr-color-surface); color: var(--lr-color-text); font-weight: var(--lr-font-weight-semibold); border-block-end: var(--lr-border-width-medium) solid var(--lr-color-border); }
  [part='cell'] { padding: var(--lr-space-2xs) var(--lr-space-xs); border-inline-end: var(--lr-border-width-thin) solid var(--lr-color-border); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--lr-font-size-sm); color: var(--lr-color-text); }
  /* renderRow()/renderCell()'s output for a DATA row is passed to <lr-virtual-list> as its
     .renderItem callback and ends up rendered inside THAT component's own shadow root -- a plain
     [part=] selector above, scoped to this component's own shadow root, only ever reaches the
     header row (rendered directly by this component, not through virtual-list). ::part() is what
     reaches one shadow boundary in, matching dataset-viewer's identical precedent. */
  lr-virtual-list::part(data-row) { display: grid; min-inline-size: max-content; align-items: center; }
  lr-virtual-list::part(cell) { padding: var(--lr-space-2xs) var(--lr-space-xs); border-inline-end: var(--lr-border-width-thin) solid var(--lr-color-border); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--lr-font-size-sm); color: var(--lr-color-text); }
  /* A highlighted cell reaches the DOM through that same virtualized path, so it needs the same
     one-shadow-hop selector -- and the same outline tokens <lr-dataset-viewer> gives its own
     cell-highlight, so a highlight reads identically across the table viewers. The active/inactive
     distinction can't be expressed as a [data-active] attribute selector chained onto ::part()
     (unsupported), so renderCell() sets --lr-csv-viewer-highlight-color inline instead -- custom
     properties inherit through the shadow boundary the same as anywhere else. The nested action
     owns the focus ring while the structural cell keeps the highlight outline. */
  [part~='cell-highlight'], lr-virtual-list::part(cell-highlight) { outline: var(--lr-border-width-medium) solid var(--lr-csv-viewer-highlight-color, var(--lr-color-brand)); outline-offset: calc(-1 * var(--lr-border-width-medium)); cursor: pointer; padding: 0; }
  [part='cell-highlight-action'], lr-virtual-list::part(cell-highlight-action) { all: unset; box-sizing: border-box; display: block; inline-size: 100%; min-inline-size: var(--lr-icon-button-size); min-block-size: var(--lr-icon-button-size); padding: var(--lr-space-2xs) var(--lr-space-xs); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
  /* Mouse users get the same "this is interactive" feedback keyboard users already get from the
     focus-visible ring below -- matching dataset-viewer's cell-highlight-action hover treatment. */
  [part='cell-highlight-action']:hover, lr-virtual-list::part(cell-highlight-action):hover { background: var(--lr-color-brand-quiet); }
  [part='cell-highlight-action']:focus-visible, lr-virtual-list::part(cell-highlight-action):focus-visible { outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: calc(var(--lr-focus-ring-offset) * -1); }
  [part='rows'] { --lr-virtual-list-height: var(--lr-size-20rem); min-inline-size: max-content; }
  .empty-note, [part='error'] { margin: 0; padding: var(--lr-space-m); color: var(--lr-color-text-quiet); font-size: var(--lr-font-size-md-sm); }
  [part='error'] { color: var(--lr-color-danger); text-align: center; }
  [part='spinner'] { display: flex; justify-content: center; padding: var(--lr-space-l); }
`;
