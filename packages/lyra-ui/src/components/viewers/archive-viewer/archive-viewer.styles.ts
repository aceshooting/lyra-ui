import { highlightToneStyles } from '../../../internal/text-highlight.styles.js';
import { css } from 'lit';
import { visuallyHidden } from '../../../internal/a11y.js';

/** Highlight rules installed into the embedded virtual list's shadow root: archive entry rows
 * render there, so highlight pseudos and fallback marks must be styled in that tree too. */
export const virtualListHighlightStyles = css`
  ${highlightToneStyles('archive-viewer', { scope: '', activeOutlineToken: '--lr-archive-viewer-highlight-active-outline' })}
  @media (forced-colors: active) {
    ::highlight(lr-highlight-accent),
    ::highlight(lr-highlight-success),
    ::highlight(lr-highlight-warning),
    ::highlight(lr-highlight-danger),
    ::highlight(lr-highlight-neutral) {
      background-color: Mark;
      color: MarkText;
    }
    ::highlight(lr-highlight-active) {
      background-color: Highlight;
      color: HighlightText;
    }
    mark[data-lr-highlight-tone] {
      background: Mark;
      color: MarkText;
      outline: var(--lr-border-width-thin) solid CanvasText;
    }
  }
`;

export const styles = css`
  :host { display: block; }
  [part='body'] { min-block-size: 0; max-block-size: var(--lr-archive-viewer-max-height, none); overflow-y: auto; overflow-x: hidden; }
  lr-virtual-list::part(base) {
    block-size: auto;
    max-block-size: var(--lr-archive-viewer-max-height, var(--lr-virtual-list-height, var(--lr-size-24rem)));
  }
  lr-virtual-list::part(entry) { display: flex; align-items: center; gap: var(--lr-space-s); box-sizing: border-box; block-size: 100%; padding: var(--lr-space-xs) var(--lr-space-m); border-block-end: var(--_lr-archive-viewer-entry-divider, var(--lr-border-width-thin)) solid var(--lr-color-border-subtle); font-size: var(--lr-font-size-sm); }
  lr-virtual-list::part(entry-icon) { display: inline-flex; flex: 0 0 auto; inline-size: var(--lr-size-1em); block-size: var(--lr-size-1em); color: var(--lr-color-text-quiet); }
  lr-virtual-list::part(entry-kind) { ${visuallyHidden} }
  lr-virtual-list::part(entry-name) { flex: 1 1 auto; min-inline-size: 0; overflow: hidden; color: var(--lr-color-text); text-overflow: ellipsis; white-space: nowrap; }
  lr-virtual-list::part(entry-name-dir) { font-weight: var(--lr-font-weight-semibold); }
  lr-virtual-list::part(entry-size) { flex: 0 0 auto; color: var(--lr-color-text-quiet); font-size: var(--lr-font-size-md-sm); }
  .empty-note { margin: 0; padding: var(--lr-space-m); color: var(--lr-color-text-quiet); font-size: var(--lr-font-size-md-sm); }
  [part='error'] { margin: 0; padding: var(--lr-space-l); color: var(--lr-color-danger); font-size: var(--lr-font-size-md-sm); text-align: center; }
`;
