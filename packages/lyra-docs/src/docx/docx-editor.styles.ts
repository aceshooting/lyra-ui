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
    /* Preserve inherited button overrides; semantic defaults resolve on each tool. */
    --_docx-tool-border: var(--lr-docx-editor-tool-border, var(--lr-button-border));
    --_docx-tool-quiet-border: var(--lr-docx-editor-tool-border, var(--lr-button-quiet-border));
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

  :host([toolbar-placement='layout']), :host([toolbar-placement='layout']) [part='base'] {
    display: contents;
    container-type: normal;
  }
  :host([hidden]) { display: none; }

  [part='workspace'] { display: contents; }
  :host([toolbar-placement='layout']) [part='workspace'] {
    display: flex;
    flex-direction: column;
    min-block-size: 0;
    min-inline-size: 0;
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-20rem);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    overflow: hidden;
  }
  [part='toolbar-area'] {
    flex: none;
    min-inline-size: 0;
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-20rem);
    --_docx-default-control-height: calc(max(var(--lr-icon-button-size), var(--lr-theme-form-control-height-s, var(--lr-icon-button-size))) + var(--lr-border-width-thin) * 2);
    --_docx-hit-floor: var(--lr-size-24px);
    --_docx-custom-tool-size: var(--lr-docx-editor-tool-size, var(--_docx-compact-tool-size));
    --_docx-control-height: max(
      calc(var(--_docx-hit-floor) + var(--lr-border-width-thin) * 2),
      var(--_docx-custom-tool-size, var(--_docx-default-control-height))
    );
    --_docx-tool-hit-size: max(var(--_docx-hit-floor), calc(var(--_docx-custom-tool-size) - var(--lr-border-width-thin) * 2));
    --_docx-inherited-hit-scope: var(--lr-icon-button-size-scope);
    --_docx-inherited-icon-size: var(--lr-icon-size);
    --_docx-tool-icon-size: var(--lr-docx-editor-tool-icon-size, var(--_docx-compact-icon-size));
    --_docx-tool-gap: var(--lr-docx-editor-tool-gap, var(--_docx-compact-gap, var(--lr-space-xs)));
    --_docx-group-gap: var(--lr-docx-editor-group-gap, var(--_docx-compact-gap, var(--lr-space-xs)));
    --_docx-group-padding: var(--lr-space-s);
    --_docx-focus-gutter: calc(var(--lr-focus-ring-width) + max(0px, var(--lr-focus-ring-offset)));
  }
  :host([density='compact']) [part='toolbar-area'] {
    --_docx-compact-tool-size: var(--lr-size-1-75rem);
    --_docx-compact-icon-size: var(--lr-size-1rem);
    --_docx-compact-gap: var(--lr-space-2xs);
    --_docx-group-padding: var(--lr-space-xs);
    --_docx-font-name-width: var(--lr-size-6rem);
  }
  @media (hover: none), (pointer: coarse) {
    [part='toolbar-area'] { --_docx-hit-floor: var(--lr-icon-button-size); }
    :host([density='compact']) [part='toolbar-area'] {
      --_docx-compact-tool-size: var(--_docx-default-control-height);
    }
  }

  [part='toolbar'] {
    position: relative;
    flex: none;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--_docx-group-gap);
    padding: var(--lr-space-xs) var(--lr-space-s);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: var(--lr-color-surface);
  }

  .insert-tools, [part='format-actions'], [part='alignment-actions'], [part='list-actions'], .color-tools,
  .toolbar-row > [part='navigation-tools'], [part='editing-tools'] {
    padding-inline-start: var(--_docx-group-padding);
    border-inline-start: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  .toolbar-row > :first-child {
    padding-inline-start: 0;
    border-inline-start: 0;
  }

  .toolbar-row, [part='editing-tools'] {
    /* Fit the two groups at their natural widths. Each can still use a full line on its own. */
    box-sizing: border-box;
    display: flex;
    flex: none;
    align-items: center;
    gap: var(--_docx-group-gap);
    inline-size: max-content;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  .toolbar-row {
    overflow: auto hidden;
    scrollbar-width: thin;
    padding: var(--_docx-focus-gutter);
    min-block-size: calc(var(--_docx-control-height) + var(--lr-space-s));
  }
  .toolbar-row > * { flex-shrink: 0; }
  .toolbar-row > [part='navigation-tools'] {
    flex-wrap: nowrap;
    padding-block: 0;
    padding-inline-end: 0;
    border-block-end: 0;
    gap: var(--_docx-tool-gap);
  }
  .toolbar-row :is([part='file-actions'], .insert-tools, [part='table-tools'], [part='table-actions'], [part='image-tools']) {
    flex-wrap: nowrap;
    flex-shrink: 0;
  }
  [part='editing-tools'] {
    flex-wrap: wrap;
    padding-block: var(--_docx-focus-gutter);
  }
  :host([toolbar-layout='two-rows']) .toolbar-row {
    flex-basis: 100%;
  }
  :host([toolbar-layout='single-row']) [part='toolbar'] {
    flex-wrap: nowrap;
    overflow: auto hidden;
    scrollbar-width: thin;
  }
  :host([toolbar-layout='single-row']) :is(.toolbar-row, [part='editing-tools']) {
    max-inline-size: none;
    overflow: visible;
  }
  :host([toolbar-layout='single-row']) :is([part='editing-tools'], .font-tools, [part='format-actions']) {
    flex-wrap: nowrap;
  }

  [part='file-actions'], [part='format-actions'], .font-tools, .color-tools, .insert-tools,
  [part='alignment-actions'], [part='list-actions'], [part='table-tools'], [part='table-actions'], [part='image-tools'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--_docx-tool-gap);
    min-inline-size: 0;
  }
  [part='link-actions'], [part='table-dialog-actions'], [part='image-insert-actions'],
  [part='image-resize-actions'], [part='image-description-actions'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
  }

  :where([part='toolbar-area']) :is([data-tool-key], [part='new-button'], [part='open-button'], [part='save-button'],
    [part~='document-panel-toggle'], [part='commands-button'], [part='image-replace-trigger']) {
    --lr-button-size-s: var(--_docx-control-height);
    --lr-icon-button-size-scope: var(--_docx-tool-hit-size, var(--_docx-inherited-hit-scope));
    --lr-icon-size: var(--_docx-tool-icon-size, var(--_docx-inherited-icon-size));
    --lr-button-border: var(--_docx-tool-border, var(--lr-color-border-normal));
    --lr-button-quiet-border: var(--_docx-tool-quiet-border, var(--lr-color-border));
  }
  [part='paragraph-style'] { --lr-select-trigger-min-height: var(--_docx-control-height); }
  [part='font-family'] { --lr-combobox-trigger-min-height: var(--_docx-control-height); }
  [part='font-size'] {
    /* Its native steppers need the same target floor without shrinking steppers in dialog fields. */
    --lr-input-control-min-height: var(--_docx-control-height);
    --lr-icon-button-size-scope: var(--_docx-tool-hit-size, var(--_docx-inherited-hit-scope));
  }

  [part='paragraph-style'] { --_docx-field-width: var(--lr-docx-editor-paragraph-style-inline-size, var(--_docx-font-name-width, var(--lr-size-8rem))); }
  [part='font-family'] { --_docx-field-width: var(--lr-docx-editor-font-family-inline-size, var(--_docx-font-name-width, var(--lr-size-8rem))); }
  [part='font-size'] { --_docx-field-width: var(--lr-docx-editor-font-size-inline-size, var(--lr-size-8rem)); }
  :is([part='paragraph-style'], [part='font-family'], [part='font-size']) {
    flex: 0 0 auto;
    inline-size: var(--_docx-field-width);
    min-inline-size: 0;
    max-inline-size: 100%;
  }

  .font-tools { max-inline-size: 100%; }
  .color-tools, [part='alignment-actions'], [part='list-actions'] {
    flex-wrap: nowrap;
  }
  .tool-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--_docx-tool-icon-size, var(--lr-font-size-lg));
    block-size: var(--_docx-tool-icon-size, var(--lr-font-size-lg));
  }
  :host(:dir(rtl)) :is(#tool-undo, #tool-redo, #tool-image-previous, #tool-image-next) .tool-icon {
    transform: scaleX(-1);
  }
  .tool-icon ::slotted(*) { inline-size: 100%; block-size: 100%; }
  .tooltips { position: absolute; inline-size: 0; block-size: 0; }
  [part='new-button'], [part='open-button'], [part='save-button'], [part='commands-button'], [part~='document-panel-toggle'], [part='image-replace-trigger'], [part='table-format-trigger'],
  [part='format-button'], [part='edit-button'], [part='link-trigger'], [part='find-toggle'],
  [part='image-insert-trigger'], [part='table-insert-trigger'], [part='image-previous'], [part='image-next'] {
    --lr-icon-size: var(--_docx-tool-icon-size, var(--lr-font-size-lg));
  }

  .tool-glyph { position: relative; display: flex; }
  /* The last applied text or highlight color, as Word's split color buttons show it; drawn over the
     glyph's empty lower band so the icon keeps the shared toolbar centering. */
  .tool-glyph[style]::after {
    content: '';
    position: absolute;
    inset-inline: 0;
    inset-block-end: 0;
    block-size: calc(var(--lr-size-1px) * 3);
    border-radius: var(--lr-size-1px);
    background: var(--_tool-swatch);
    box-shadow: 0 0 0 var(--lr-size-1px) var(--lr-color-border);
  }

  .color-fields, [part='line-spacing-options'] {
    display: grid;
    gap: var(--lr-space-s);
    padding: var(--lr-space-s);
    max-inline-size: var(--lr-size-20rem);
  }
  [part='line-spacing-options'] { gap: var(--lr-space-2xs); }
  [part='line-spacing-option'] { justify-self: stretch; }
  [part='text-color-swatches'], [part='highlight-swatches'] { --lr-swatch-picker-wrap: wrap; }

  [part='link-fields'], [part='table-fields'], [part='image-insert-fields'], [part='image-resize-fields'], [part='image-description-fields'] {
    display: grid;
    box-sizing: border-box;
    gap: var(--lr-space-s);
    min-inline-size: 0;
    inline-size: min(var(--lr-size-20rem), 100%);
    padding: var(--lr-space-s);
  }

  [part='table-tools'], [part='image-tools'] { flex: 0 1 auto; }
  [part='table-context'], [part='table-hint'],
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

  [part='find-count'], [part='find-current'] {
    min-inline-size: 0;
    overflow-wrap: anywhere;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }

  [part='find-results'] {
    flex: 1 1 100%;
    list-style: none;
    margin: 0;
    padding: 0;
    max-block-size: var(--lr-size-12rem);
    overflow: auto;
    min-inline-size: 0;
  }

  [part='find-match'] {
    --_docx-match-fill: var(--lr-color-surface);
    display: flex;
    gap: var(--lr-space-s);
    inline-size: 100%;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: var(--lr-space-xs) var(--lr-space-s);
    border: 0;
    border-radius: var(--lr-radius-s);
    background: var(--_docx-match-fill);
    color: var(--lr-color-text);
    font: inherit;
    text-align: start;
    overflow-wrap: anywhere;
    cursor: pointer;
  }
  [part='find-match']:where([aria-current='true']) { --_docx-match-fill: var(--lr-color-brand-quiet); }
  [part='find-match']:where(:hover:not(:disabled)) {
    background: color-mix(in srgb, var(--_docx-match-fill), var(--lr-color-text) var(--lr-color-mix-hover));
  }
  [part='find-match']:focus-visible { outline: var(--lr-focus-ring); outline-offset: var(--lr-focus-ring-offset); }
  [part='find-match']:disabled { cursor: default; opacity: var(--lr-opacity-disabled); }
  [part='find-match'] mark { background: var(--lr-color-brand-quiet); color: var(--lr-color-text); }

  [part='navigation-tools'], [part='table-format-actions'], [part='review-actions'], [part='document-panel-header'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-xs);
    align-items: center;
    min-inline-size: 0;
  }
  [part='navigation-tools'] {
    flex: none;
    gap: var(--_docx-tool-gap);
    padding: var(--lr-space-xs) var(--lr-space-s);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: var(--lr-color-surface);
  }
  [part='document-panel'] {
    min-inline-size: 0;
    padding: var(--lr-space-s);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: var(--lr-color-surface);
  }
  [part='document-panel-heading'] { flex: 1 1 auto; margin: 0; font-size: var(--lr-font-size-m); }
  [part='document-panel-heading']:focus { outline: none; }
  [part='document-panel-content'] { max-block-size: var(--lr-size-20rem); overflow: auto; overflow-wrap: anywhere; }
  [part='document-panel-content'] p { margin-block: var(--lr-space-s); }
  [part='outline-items'], [part='review-items'] { list-style: none; padding: 0; margin-block: var(--lr-space-s); }
  [part='inspection-items'], [part='inspection-capabilities'] { padding-inline-start: var(--lr-space-l); }
  [part='review-items'] > li { padding-block: var(--lr-space-s); border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border); }
  [part='document-target'] {
    display: flex;
    gap: var(--lr-space-s);
    inline-size: 100%;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: var(--lr-space-xs) var(--lr-space-s);
    border: 0;
    border-radius: var(--lr-radius-s);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    text-align: start;
    overflow-wrap: anywhere;
    cursor: pointer;
  }
  [part='document-target']:where(:hover:not(:disabled)) { background: var(--lr-color-brand-quiet); }
  [part='document-target']:focus-visible { outline: var(--lr-focus-ring); outline-offset: var(--lr-focus-ring-offset); }
  [part='document-target']:disabled { opacity: var(--lr-opacity-disabled); cursor: default; }
  [part='review-draft'], [part='table-format-fields'] { display: grid; gap: var(--lr-space-s); min-inline-size: 0; }
  [part='review-item-text'] { white-space: pre-wrap; overflow-wrap: anywhere; }
  [part='review-draft'] > *, [part='table-format-fields'] > * { min-inline-size: 0; max-inline-size: 100%; }
  [part='table-format-popover'] { --lr-overlay-max-inline-size: min(var(--lr-size-20rem), calc(100vw - var(--lr-space-s) * 2)); }
  [part='table-format-fields'] { max-block-size: 60vh; overflow: auto; }
  [part='image-replace-file'] {
    position: absolute;
    inline-size: var(--lr-size-1px);
    block-size: var(--lr-size-1px);
    overflow: hidden;
    clip-path: inset(50%);
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

  .overlay-layer {
    position: absolute;
    overflow: hidden;
    pointer-events: none;
  }

  /* Charts sit on white paper in every theme, so their chrome uses paper-legible colors. */
  [part='chart'] {
    position: absolute;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: white;
    color: black;
    color-scheme: light;
    --lr-chart-grid-color: #d9d9d9;
    --lr-chart-tick-color: #595959;
    --lr-chart-legend-color: black;
  }
  .chart-title {
    flex: none;
    overflow: hidden;
    font-size: var(--lr-font-size-sm);
    font-weight: var(--lr-font-weight-semibold, 600);
    line-height: 20px;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

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

  [part='zoom'] {
    flex: none;
    inline-size: var(--lr-size-8rem);
  }

  @container (max-width: 35rem) {
    /* Phones keep both toolbar rows one control tall; each scrolls and keyboard focus reveals offscreen tools. */
    :host(:not([toolbar-layout='single-row'])) [part='editing-tools'] {
      flex-wrap: nowrap;
      overflow: auto hidden;
      scrollbar-width: thin;
      padding-inline-end: var(--_docx-focus-gutter);
    }
    :host(:not([toolbar-layout='single-row'])) [part='editing-tools'] > * {
      flex-shrink: 0;
      max-inline-size: none;
    }
    :is(.font-tools, [part='format-actions']) { flex-wrap: nowrap; }
    [part='editing-tools'] { --_docx-font-name-width: var(--lr-size-6rem); }
    [part='find-query'], [part='find-replace'] { flex-basis: 100%; }
  }
`;
