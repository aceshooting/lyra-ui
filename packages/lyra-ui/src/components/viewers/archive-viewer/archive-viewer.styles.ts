import { css } from 'lit';

export const styles = css`
  :host { display: block; }
  [part='base'] { display: flex; flex-direction: column; box-sizing: border-box; border: var(--lr-border-width-thin) solid var(--lr-color-border); border-radius: var(--lr-radius); background: var(--lr-color-surface); overflow: hidden; }
  /* Entry rows are produced by this component's renderItem but are committed into the embedded
     lr-virtual-list's OWN shadow root, one boundary deeper than this stylesheet: a bare
     [part='entry'] selector can never match one, so every row-level rule reaches through
     ::part(). ::part() also cannot be followed by a descendant combinator, so a directory row's
     name element carries a second part name -- ::part() matches with part~= semantics, so that
     element is both entry-name and entry-name-dir. */
  lr-virtual-list::part(entry) { display: flex; align-items: center; gap: var(--lr-space-s); box-sizing: border-box; block-size: 100%; padding: var(--lr-space-xs) var(--lr-space-m); border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border); font-size: var(--lr-font-size-sm); }
  lr-virtual-list::part(entry-icon) { display: inline-flex; flex: 0 0 auto; inline-size: var(--lr-size-1em); block-size: var(--lr-size-1em); color: var(--lr-color-text-quiet); }
  lr-virtual-list::part(entry-name) { flex: 1 1 auto; min-inline-size: 0; overflow: hidden; color: var(--lr-color-text); text-overflow: ellipsis; white-space: nowrap; }
  lr-virtual-list::part(entry-name-dir) { font-weight: var(--lr-font-weight-semibold); }
  lr-virtual-list::part(entry-size) { flex: 0 0 auto; color: var(--lr-color-text-quiet); font-size: var(--lr-font-size-md-sm); }
  .empty-note { margin: 0; padding: var(--lr-space-m); color: var(--lr-color-text-quiet); font-size: var(--lr-font-size-md-sm); }
  [part='error'] { margin: 0; padding: var(--lr-space-l); color: var(--lr-color-danger); font-size: var(--lr-font-size-md-sm); text-align: center; }
  [part='spinner'] { display: flex; justify-content: center; padding: var(--lr-space-l); }
`;
