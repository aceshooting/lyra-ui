import { css } from 'lit';

export const styles = css`
  :host { display: block; min-inline-size: 0; }
  [part='base'], [part='sheet'] { display: flex; flex-direction: column; min-inline-size: 0; }
  [part='sheet'] { overflow-x: auto; }
  [part='header-row'] { display: grid; min-inline-size: max-content; align-items: center; position: sticky; inset-block-start: 0; z-index: var(--lr-layer-content); background: var(--lr-color-surface); color: var(--lr-color-text); font-weight: var(--lr-font-weight-semibold); border-block-end: var(--lr-border-width-medium) solid var(--lr-color-border); }
  [part='cell'] { padding: var(--lr-space-2xs) var(--lr-space-xs); border-inline-end: var(--lr-border-width-thin) solid var(--lr-color-border); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--lr-font-size-sm); color: var(--lr-color-text); }
  /* renderRow()/renderCell()'s output for a DATA row is passed to <lr-virtual-list> as its
     .renderItem callback and ends up rendered inside THAT component's own shadow root -- a plain
     [part=] selector above, scoped to this component's own shadow root, only ever reaches the
     header row (rendered directly by this component, not through virtual-list). ::part() is what
     reaches one shadow boundary in, matching dataset-viewer's identical precedent. */
  lr-virtual-list::part(data-row) { display: grid; min-inline-size: max-content; align-items: center; }
  lr-virtual-list::part(cell) { padding: var(--lr-space-2xs) var(--lr-space-xs); border-inline-end: var(--lr-border-width-thin) solid var(--lr-color-border); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--lr-font-size-sm); color: var(--lr-color-text); }
  [part='rows'] { --lr-virtual-list-height: var(--lr-size-20rem); min-inline-size: max-content; }
  .empty-note, [part='error'] { margin: 0; padding: var(--lr-space-m); color: var(--lr-color-text-quiet); font-size: var(--lr-font-size-md-sm); }
  [part='error'] { color: var(--lr-color-danger); text-align: center; }
  [part='spinner'] { display: flex; justify-content: center; padding: var(--lr-space-l); }
`;
