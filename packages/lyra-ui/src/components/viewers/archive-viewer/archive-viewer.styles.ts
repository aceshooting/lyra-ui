import { css } from 'lit';

/** Highlight rules installed into the embedded virtual list's shadow root: archive entry rows
 * render there, so highlight pseudos and fallback marks must be styled in that tree too. */
export const virtualListHighlightStyles = css`
  ::highlight(lr-highlight-accent) {
    background-color: var(--lr-archive-viewer-highlight-accent-background, var(--lr-color-brand-quiet));
  }
  ::highlight(lr-highlight-success) {
    background-color: var(--lr-archive-viewer-highlight-success-background, var(--lr-color-success-quiet));
  }
  ::highlight(lr-highlight-warning) {
    background-color: var(--lr-archive-viewer-highlight-warning-background, var(--lr-color-warning-quiet));
  }
  ::highlight(lr-highlight-danger) {
    background-color: var(--lr-archive-viewer-highlight-danger-background, var(--lr-color-danger-quiet));
  }
  /* --lr-color-surface-raised, not --lr-color-surface: entry rows paint no background, so they
     show the viewer's own --lr-color-surface, and falling back to that token would leave a neutral
     highlight with zero contrast against the row it marks. Matches highlight-layer's neutral
     fallback. */
  ::highlight(lr-highlight-neutral) {
    background-color: var(--lr-archive-viewer-highlight-neutral-background, var(--lr-color-surface-raised));
  }
  ::highlight(lr-highlight-active) {
    background-color: var(--lr-archive-viewer-highlight-active-background, var(--lr-color-brand-quiet));
    text-decoration: underline;
  }
  mark[data-lr-highlight-tone] {
    background: var(--lr-archive-viewer-highlight-accent-background, var(--lr-color-brand-quiet));
    color: inherit;
    border-radius: calc(var(--lr-radius) * 0.5);
  }
  mark[data-lr-highlight-tone='success'] {
    background: var(--lr-archive-viewer-highlight-success-background, var(--lr-color-success-quiet));
  }
  mark[data-lr-highlight-tone='warning'] {
    background: var(--lr-archive-viewer-highlight-warning-background, var(--lr-color-warning-quiet));
  }
  mark[data-lr-highlight-tone='danger'] {
    background: var(--lr-archive-viewer-highlight-danger-background, var(--lr-color-danger-quiet));
  }
  mark[data-lr-highlight-tone='neutral'] {
    background: var(--lr-archive-viewer-highlight-neutral-background, var(--lr-color-surface-raised));
  }
  mark[data-lr-highlight-name='lr-highlight-active'] {
    outline: var(--lr-border-width-thin) solid
      var(--lr-archive-viewer-highlight-active-outline, var(--lr-color-brand));
    outline-offset: var(--lr-focus-ring-offset);
  }
`;

export const styles = css`
  :host { display: block; }
  [part='base'] { display: flex; flex-direction: column; box-sizing: border-box; border: var(--lr-border-width-thin) solid var(--lr-color-border); border-radius: var(--lr-radius); background: var(--lr-color-surface); overflow: hidden; }
  [part='body'] { min-block-size: 0; max-block-size: var(--lr-archive-viewer-max-height, none); overflow-y: auto; overflow-x: hidden; }
  /* Entry rows come from this component's renderItem but land in the embedded lr-virtual-list's
     OWN shadow root, a boundary deeper than this stylesheet, so a bare [part='entry'] never matches
     and every row rule goes through ::part(). ::part() takes no descendant combinator either, so a
     directory row's name element carries a second part name: part~= makes it both entry-name and
     entry-name-dir. */
  lr-virtual-list::part(entry) { display: flex; align-items: center; gap: var(--lr-space-s); box-sizing: border-box; block-size: 100%; padding: var(--lr-space-xs) var(--lr-space-m); border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border); font-size: var(--lr-font-size-sm); }
  lr-virtual-list::part(entry-icon) { display: inline-flex; flex: 0 0 auto; inline-size: var(--lr-size-1em); block-size: var(--lr-size-1em); color: var(--lr-color-text-quiet); }
  lr-virtual-list::part(entry-name) { flex: 1 1 auto; min-inline-size: 0; overflow: hidden; color: var(--lr-color-text); text-overflow: ellipsis; white-space: nowrap; }
  lr-virtual-list::part(entry-name-dir) { font-weight: var(--lr-font-weight-semibold); }
  lr-virtual-list::part(entry-size) { flex: 0 0 auto; color: var(--lr-color-text-quiet); font-size: var(--lr-font-size-md-sm); }
  .empty-note { margin: 0; padding: var(--lr-space-m); color: var(--lr-color-text-quiet); font-size: var(--lr-font-size-md-sm); }
  [part='error'] { margin: 0; padding: var(--lr-space-l); color: var(--lr-color-danger); font-size: var(--lr-font-size-md-sm); text-align: center; }
`;
