import { css } from 'lit';

export const styles = css`
  :host {
    /* Backdrop scrim color -- component-specific so a host retunes it without a raw literal in
       the public API, there being no shared overlay token to resolve through. Same as lr-dialog's
       --lr-dialog-overlay-color and lr-tool-select-dialog's
       --lr-tool-select-dialog-overlay-color. */
    --_lr-tool-approval-dialog-overlay-color: var(--lr-color-overlay);
    /* A token rather than a bare font-family literal on the textarea, so a host page can retheme
       it -- as lr-json-viewer's --lr-json-viewer-font. Raw args are code, not prose, so the editor
       gets that viewer's monospace treatment. */
    --_lr-tool-approval-dialog-mono-font: var(--lr-font-mono);
    display: none;
    position: fixed;
    inset: 0;
    z-index: var(--lr-overlay-stack-index, var(--lr-layer-modal));
    align-items: center;
    justify-content: center;
    padding-block-start: max(var(--lr-space-l), var(--lr-safe-area-top));
    padding-block-end: max(var(--lr-space-l), var(--lr-safe-area-bottom));
    padding-inline-start: max(
      var(--lr-space-l),
      var(--lr-safe-area-inline-start)
    );
    padding-inline-end: max(var(--lr-space-l), var(--lr-safe-area-inline-end));
  }
  :host([open]) {
    display: flex;
  }
  [part="backdrop"] {
    position: absolute;
    inset: 0;
    background: var(
      --lr-tool-approval-dialog-overlay-color,
      var(--_lr-tool-approval-dialog-overlay-color)
    );
  }
  [part="panel"] {
    position: relative;
    display: flex;
    flex-direction: column;
    inline-size: min(var(--lr-size-32rem), 100%);
    max-block-size: min(var(--lr-size-36rem), 100%);
    /* Modal-panel surface, not the page surface -- in dark mode the two resolve to the same
       near-black and the dialog reads as a scrim with floating text instead of a panel. */
    background: var(--lr-color-surface-overlay);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    /* Modal layer, top step: a centered, scrimmed dialog floating free on all four edges --
       the same role as lr-dialog, so the same elevation. */
    box-shadow: var(--lr-shadow-xl);
    overflow: hidden;
  }
  [part="header"] {
    padding: var(--lr-space-l) var(--lr-space-l) 0;
  }
  [part="header"] h2 {
    margin: 0;
    font-size: var(--lr-size-1-0625rem);
    font-weight: var(--lr-font-weight-semibold);
  }
  [part="tool-name"] {
    font-family: var(
      --lr-tool-approval-dialog-mono-font,
      var(--_lr-tool-approval-dialog-mono-font)
    );
    font-weight: var(--lr-font-weight-bold);
    color: var(--lr-color-brand);
    word-break: break-word;
  }

  [part="body"] {
    flex: 1 1 auto;
    min-block-size: 0;
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-m) var(--lr-space-l) var(--lr-space-l);
    overflow: auto;
  }
  [part="args-view"] {
    /* lr-json-viewer grows with its content (its own max-height is 'none'); [part='body'] caps and
       scrolls it instead, matching the [part='args-editor'] textarea below, which has no scroll
       cap of its own either. */
    flex: 1 1 auto;
    min-block-size: 0;
  }
  [part="args-editor"] {
    flex: 1 1 auto;
    min-block-size: var(--lr-size-10rem);
    box-sizing: border-box;
    resize: vertical;
    padding: var(--lr-space-s) var(--lr-space-m);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: inherit;
    font-family: var(
      --lr-tool-approval-dialog-mono-font,
      var(--_lr-tool-approval-dialog-mono-font)
    );
    font-size: var(--lr-font-size-sm);
    line-height: var(--lr-line-height-normal);
  }
  [part="args-editor"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* The mouse-side counterpart of the :focus-visible ring above, mirroring lr-textarea's
     [part='textarea']:hover. Gated on :host(:not([pending])), not :not(:disabled): this raw
     <textarea> is not form-associated and has no disabled state, and pending freezes it to
     readonly, so hover shouldn't relight it. */
  /* no-pressed-state: pressing inside a text surface places a caret, it actuates nothing. The
     mousedown matching :active is the gesture that focuses the field, so a pressed treatment would
     flicker for a frame between hover border and focus ring; focus is the real acting-on-me state,
     as in lr-textarea's [part='textarea']. */
  :host(:not([pending])) [part="args-editor"]:not([aria-invalid="true"]):hover {
    border-color: var(
      --lr-tool-approval-dialog-hover-border-color,
      var(--lr-color-brand)
    );
  }
  [part="args-editor"][aria-invalid="true"] {
    border-color: var(
      --lr-tool-approval-dialog-invalid-border-color,
      var(--lr-color-danger)
    );
  }
  [part="error"] {
    margin: 0;
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-danger);
  }
  [part="error"][hidden] {
    display: none;
  }

  [part="footer"] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: var(--lr-space-s);
    padding: var(--lr-space-m) var(--lr-space-l);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part="footer"] ::slotted(*) {
    /* Consumer-supplied footer content precedes the built-in buttons and soaks up the remaining
       space, reading as start-aligned while Deny/Edit/Approve stay pinned to the end; the row's own
       justify-content: flex-end covers the empty-slot case. */
    margin-inline-end: auto;
  }

  /* deny-button/approve-button are <lr-button> hosts (see tool-approval-dialog.class.ts's
     render()), so all their chrome lives inside lr-button's own styles.ts. edit-button alone stays
     a raw <button> and keeps its own rules below. */
  [part="edit-button"] {
    font: inherit;
    font-size: var(--lr-font-size-md-sm);
    padding: var(--lr-space-xs) var(--lr-space-m);
    border-radius: var(--lr-radius);
    cursor: pointer;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
  }
  :where([part="edit-button"]):not(:disabled):hover {
    background: var(--lr-color-brand-quiet);
  }
  /* Pressed is the hover tint pushed a further --lr-color-mix-active toward --lr-color-mix-partner
     (which follows the text colour), a deeper step in both themes. The lr-button-hosted
     Deny/Approve siblings get the equivalent from lr-button's own styles. */
  :where([part="edit-button"]):not(:disabled):active {
    background: color-mix(
      in oklab,
      var(--lr-color-brand-quiet),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part="edit-button"]:disabled {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }
  [part="edit-button"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
`;
