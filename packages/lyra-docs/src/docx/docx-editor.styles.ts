import { css } from 'lit';

export const styles = css`
  :host {
    display: flex;
    flex-direction: column;
    min-block-size: 0;
    min-inline-size: 0;
    color: var(--lr-color-text);
    font-family: var(--lr-font);
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-20rem);
  }

  [part='base'] {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    min-block-size: 0;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    overflow: hidden;
  }

  [part='toolbar'] {
    --_docx-control-height: calc(max(var(--lr-icon-button-size), var(--lr-theme-form-control-height-s, var(--lr-icon-button-size))) + var(--lr-border-width-thin) * 2);
    position: relative;
    flex: none;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-xs) var(--lr-space-s);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: var(--lr-color-surface);
  }

  [part='file-actions'], [part='format-actions'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
  }

  .history-tools, .insert-tools, [part='format-actions'], [part='alignment-actions'], [part='list-actions'], .color-tools {
    padding-inline-start: var(--lr-space-s);
    border-inline-start: var(--lr-border-width-thin) solid var(--lr-color-border);
  }

  .toolbar-row, [part='editing-tools'] {
    display: flex;
    flex: 1 1 100%;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
  }

  .toolbar-row {
    flex-wrap: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
    block-size: calc(var(--_docx-control-height) + var(--lr-space-s));
    scrollbar-width: thin;
    max-inline-size: 100%;
  }
  .toolbar-row > * { flex-shrink: 0; }
  .toolbar-row :is(.insert-tools, [part='table-tools'], [part='table-actions'], [part='image-tools']) {
    flex-wrap: nowrap;
    flex-shrink: 0;
  }

  .history-tools, .font-tools, .color-tools, .insert-tools,
  [part='alignment-actions'], [part='list-actions'], [part='link-actions'],
  [part='table-tools'], [part='table-actions'], [part='table-dialog-actions'],
  [part='image-insert-actions'], [part='image-tools'], [part='image-resize-actions'], [part='image-description-actions'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
  }

  [part='toolbar'] [data-tool-key], [part='file-actions'] > [part] {
    --lr-button-size-s: var(--_docx-control-height);
  }
  [part='paragraph-style'] { --lr-select-trigger-min-height: var(--_docx-control-height); }
  [part='font-family'] { --lr-combobox-trigger-min-height: var(--_docx-control-height); }
  [part='font-size'] { --lr-input-control-min-height: var(--_docx-control-height); }
  [part='text-color'] { --lr-color-picker-swatch-size: var(--_docx-control-height); }

  [part='paragraph-style'], [part='font-family'] {
    flex: 0 1 var(--lr-size-8rem);
    inline-size: var(--lr-size-8rem);
    min-inline-size: 0;
    max-inline-size: 100%;
  }

  [part='font-size'] {
    flex: 0 0 var(--lr-size-10rem);
    inline-size: var(--lr-size-10rem);
    min-inline-size: 0;
    max-inline-size: 100%;
  }

  .font-tools { flex: 0 1 auto; }
  .color-tools, [part='alignment-actions'], [part='list-actions'] {
    flex-wrap: nowrap;
  }
  [part='editing-tools'] {
    padding-block-start: var(--lr-space-xs);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  @container (min-width: 112rem) {
    [part='toolbar'] {
      display: grid;
      grid-template-columns: minmax(0, max-content) max-content;
      justify-content: start;
    }
    .toolbar-row, [part='editing-tools'] { flex: none; }
    .toolbar-row {
      padding-inline-end: var(--lr-space-xs);
      border-inline-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    }
    [part='editing-tools'], .font-tools, [part='format-actions'] { flex-wrap: nowrap; }
    [part='editing-tools'] {
      padding-block-start: 0;
      border-block-start: 0;
    }
    .font-tools { flex: none; }
  }
  .tool-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--lr-font-size-lg);
    block-size: var(--lr-font-size-lg);
  }
  :host(:dir(rtl)) :is(#tool-undo, #tool-redo, #tool-image-previous, #tool-image-next) .tool-icon {
    transform: scaleX(-1);
  }
  .tool-icon ::slotted(*) { inline-size: 100%; block-size: 100%; }
  .tooltips { position: absolute; inline-size: 0; block-size: 0; }
  [part='new-button'], [part='open-button'], [part='save-button'],
  [part='format-button'], [part='edit-button'], [part='link-trigger'], [part='find-toggle'],
  [part='image-insert-trigger'], [part='table-insert-trigger'], [part='image-previous'], [part='image-next'] {
    --lr-icon-size: var(--lr-font-size-lg);
  }

  [part='text-color'] {
    display: flex;
    flex: none;
  }

  [part='color-state'] {
    max-inline-size: var(--lr-size-8rem);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }

  [part='link-fields'], [part='table-fields'], [part='image-insert-fields'], [part='image-resize-fields'], [part='image-description-fields'] {
    display: grid;
    box-sizing: border-box;
    gap: var(--lr-space-s);
    min-inline-size: 0;
    inline-size: min(var(--lr-size-20rem), 100%);
    padding: var(--lr-space-s);
  }

  [part='table-tools'], [part='image-tools'] { flex: 0 1 auto; }
  [part='table-context'], [part='table-hint'], [part='image-context'],
  [part='image-insert-hint'], [part='image-insert-status'], [part='image-resize-hint'], [part='image-description-hint'], [part='image-navigation-status'] {
    margin: 0;
    overflow-wrap: anywhere;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }

  [part='image-insert-width'], [part='image-insert-height'], [part='image-insert-title'],
  [part='image-insert-description'], [part='image-insert-ratio'], [part='image-width'], [part='image-height'], [part='image-title'], [part='image-description'], [part='image-ratio'] {
    min-inline-size: 0;
    max-inline-size: 100%;
  }

  [part='image-insert-trigger'], [part='image-previous'], [part='image-next'], [part='image-resize-trigger'], [part='image-description-trigger'], [part='image-delete'] {
    min-inline-size: 0;
    max-inline-size: 100%;
  }

  [part='image-insert-dialog'], [part='image-resize-popover'], [part='image-description-popover'] {
    --lr-overlay-max-inline-size: min(var(--lr-size-20rem), calc(100vw - var(--lr-space-s) * 2));
    min-inline-size: 0;
  }

  [part='find'] {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: var(--lr-space-s);
    min-inline-size: 0;
    padding: var(--lr-space-s);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: var(--lr-color-surface);
  }

  [part='find-query'], [part='find-replace'] {
    flex: 1 1 var(--lr-size-12rem);
    min-inline-size: 0;
  }

  [part='find-count'] {
    min-inline-size: 0;
    overflow-wrap: anywhere;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }

  [part='file-input'], [part='image-insert-file'] {
    position: absolute;
    inset-inline-start: 0;
    inset-block-start: 0;
    inline-size: var(--lr-size-1px);
    block-size: var(--lr-size-1px);
    padding: 0;
    margin: calc(-1 * var(--lr-size-1px));
    border: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  [part='document'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    min-block-size: 0;
    overflow: auto;
  }

  [part='document'] { position: relative; }

  .image-layer {
    position: absolute;
    overflow: hidden;
    pointer-events: none;
  }

  [part='image-frame'] {
    position: absolute;
    box-sizing: border-box;
    border: var(--lr-border-width-thin) solid var(--lr-color-brand);
  }
  [part='image-frame'][data-dragging='true'] { border-style: dashed; }

  [part='image-handle'] {
    --_handle-size: var(--lr-space-s);
    position: absolute;
    box-sizing: border-box;
    inline-size: var(--_handle-size);
    block-size: var(--_handle-size);
    margin: calc(var(--_handle-size) / -2);
    border: var(--lr-border-width-thin) solid var(--lr-color-brand);
    border-radius: var(--lr-radius-xs);
    background: var(--lr-color-surface);
    pointer-events: auto;
    touch-action: none;
  }
  [part='image-handle']::before {
    content: '';
    position: absolute;
    inset: calc((var(--lr-icon-button-size) - var(--_handle-size)) / -2);
  }
  [part='image-handle']:hover { background: var(--lr-color-brand); }
  [part='image-handle'][data-handle='nw'] { inset-block-start: 0; left: 0; cursor: nwse-resize; }
  [part='image-handle'][data-handle='n'] { inset-block-start: 0; left: 50%; cursor: ns-resize; }
  [part='image-handle'][data-handle='ne'] { inset-block-start: 0; left: 100%; cursor: nesw-resize; }
  [part='image-handle'][data-handle='e'] { inset-block-start: 50%; left: 100%; cursor: ew-resize; }
  [part='image-handle'][data-handle='se'] { inset-block-start: 100%; left: 100%; cursor: nwse-resize; }
  [part='image-handle'][data-handle='s'] { inset-block-start: 100%; left: 50%; cursor: ns-resize; }
  [part='image-handle'][data-handle='sw'] { inset-block-start: 100%; left: 0; cursor: nesw-resize; }
  [part='image-handle'][data-handle='w'] { inset-block-start: 50%; left: 0; cursor: ew-resize; }

  [part='image-size'] {
    position: absolute;
    inset-block-start: 100%;
    left: 0;
    margin-block-start: var(--lr-space-s);
    padding: var(--lr-space-2xs) var(--lr-space-xs);
    border-radius: var(--lr-radius);
    background: var(--lr-color-text);
    color: var(--lr-color-surface);
    font-size: var(--lr-font-size-sm);
    white-space: nowrap;
  }

  @media (prefers-reduced-motion: no-preference) {
    [part='image-handle'] { transition: background-color var(--lr-transition-fast); }
  }

  [part='document']:hover {
    outline: var(--lr-border-width-thin) solid var(--lr-color-border);
    outline-offset: calc(-1 * var(--lr-border-width-thin));
  }

  [part='document']:focus-visible {
    outline: var(--lr-focus-ring);
    outline-offset: calc(-1 * var(--lr-focus-ring-width));
  }

  [part='confirm'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-s);
    padding: var(--lr-space-s);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: var(--lr-color-surface);
  }

  slot[name='document'] { display: contents; }

  ::slotted([slot='document']) {
    display: block;
    min-inline-size: 0;
    block-size: 100%;
    min-block-size: 0;
  }

  [part='status'] {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--lr-space-s);
    min-inline-size: 0;
    padding: var(--lr-space-xs) var(--lr-space-s);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }

  [part='error'], [part='edit-error'] {
    margin: 0;
    padding: var(--lr-space-s);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
    color: var(--lr-color-danger);
    background: var(--lr-color-surface);
    overflow-wrap: anywhere;
  }

  [part='filename'] {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  [part='state'] {
    margin-inline-start: auto;
    text-align: end;
  }

  @container (max-width: 35rem) {
    [part='toolbar'] { gap: var(--lr-space-xs); }
    .font-tools { flex-basis: 100%; }
    [part='paragraph-style'], [part='font-family'] { flex: 1 1 var(--lr-size-6rem); }
    [part='find-query'], [part='find-replace'] { flex-basis: 100%; }
    [part='color-state'] { max-inline-size: var(--lr-size-6rem); }
  }
`;
