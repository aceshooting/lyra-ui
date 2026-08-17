import { css } from 'lit';

export const styles = css`
  :host { display: block; container-type: inline-size; contain-intrinsic-inline-size: var(--lr-size-20rem); }
  ul { display: flex; flex-direction: column; gap: var(--lr-space-xs); margin: 0; padding-inline-start: 0; list-style: none; }
  [part='tree'] { padding-inline-start: 0; }
  [part~='node'] {
    --_lr-schema-indent: min(
      calc(var(--_lr-schema-depth, 0) * var(--lr-space-s)),
      var(--lr-schema-viewer-max-indent, var(--lr-size-12rem))
    );
    min-inline-size: 0;
    border-inline-start: var(--lr-border-width-thin) solid var(--lr-color-border);
    padding-inline-start: 0;
  }
  [part~='node'] > :not(ul) {
    margin-inline-start: var(--_lr-schema-indent);
    max-inline-size: calc(100% - var(--_lr-schema-indent));
    box-sizing: border-box;
  }
  [part~='node-selected'] {
    border-inline-start-color: var(--lr-schema-viewer-selected-border, var(--lr-color-brand));
  }
  [part='node-trigger'] {
    display: flex; flex-wrap: wrap; gap: var(--lr-space-xs); align-items: center; inline-size: 100%; min-block-size: var(--lr-icon-button-size);
    padding: var(--lr-space-xs); border: 0; border-radius: var(--lr-radius); background: transparent; color: var(--lr-color-text); font: inherit; text-align: start; cursor: pointer;
  }
  [part='node-trigger']:hover { background: var(--lr-color-surface-raised); }
  /* Pressed is the hovered tint pushed a further --lr-color-mix-active toward
     --lr-color-mix-partner (which follows the text colour), so it reads as a distinctly deeper step
     than hover in both light and dark themes rather than repeating it. */
  [part='node-trigger']:active {
    background: color-mix(in oklab, var(--lr-color-surface-raised), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='node-trigger']:focus-visible { outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: var(--lr-focus-ring-offset); }
  [part='name'] { min-inline-size: 0; overflow-wrap: break-word; }
  [part='description'], [part='issue'] { margin: var(--lr-space-2xs) var(--lr-space-xs); font-size: var(--lr-font-size-sm); overflow-wrap: break-word; }
  [part='description'] { color: var(--lr-color-text-quiet); }
  [part='issue'] {
    padding: var(--lr-space-xs);
    border-inline-start: var(--lr-border-width-thick) solid
      var(--lr-schema-viewer-error-border, var(--lr-color-danger));
    background: var(--lr-schema-viewer-error-bg, var(--lr-color-danger-quiet));
  }
  [part='issue'][data-severity='warning'] {
    border-inline-start-color: var(--lr-schema-viewer-warning-border, var(--lr-color-warning));
    background: var(--lr-schema-viewer-warning-bg, var(--lr-color-warning-quiet));
  }
  [part='issue'][data-severity='info'] {
    border-inline-start-color: var(--lr-schema-viewer-info-border, var(--lr-color-brand));
    background: var(--lr-schema-viewer-info-bg, var(--lr-color-brand-quiet));
  }
  [part='constraints'] { display: flex; flex-flow: row wrap; gap: var(--lr-space-xs); padding: var(--lr-space-xs); color: var(--lr-color-text-quiet); font-family: var(--lr-font-mono); font-size: var(--lr-font-size-xs); }
  @container (max-inline-size: 319.98px) {
    [part~='node'] {
      --_lr-schema-indent: min(
        calc(var(--_lr-schema-depth, 0) * var(--lr-space-xs)),
        var(--lr-schema-viewer-max-indent, var(--lr-size-12rem))
      );
    }
  }
`;
