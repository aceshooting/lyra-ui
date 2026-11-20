import { overlaySurface } from '../../../internal/overlay-surface.styles.js';
import { dialogChrome, dialogOpenHost, dialogBackdrop } from '../../../internal/modal-surface.styles.js';
import { focusRing } from '../../../internal/interactive-control.styles.js';
import { css } from 'lit';
import { modalHostStyles } from '../../../internal/native-modal-carrier.styles.js';

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
    ${modalHostStyles}
    ${dialogChrome}
  }
  ${dialogOpenHost}
  ${dialogBackdrop('tool-approval-dialog')}
  [part="panel"] {
    position: relative;
    display: flex;
    flex-direction: column;
    inline-size: min(var(--lr-size-32rem), 100%);
    max-block-size: min(var(--lr-size-36rem), 100%);
    ${overlaySurface}
    box-shadow: var(--lr-overlay-shadow-modal, var(--lr-shadow-xl));
    overflow: hidden;
  }
  [part="header"] {
    padding: var(--lr-space-l) var(--lr-space-l) 0;
  }
  [part="header"] > :first-child {
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
    /* JSON is left-to-right notation whatever the surrounding direction. */
    direction: ltr;
    text-align: start;
    flex: 1 1 auto;
    min-block-size: var(--lr-size-10rem);
    box-sizing: border-box;
    resize: vertical;
    /* Inline geometry and corner follow the shared form-control chain, like lr-tool-param-form's
       fields, so a theme or size tier that retunes the form controls reaches this editor too. */
    padding: var(--lr-space-s) var(--lr-form-control-padding-inline);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-form-control-radius);
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
    ${focusRing}
  }
  /* The mouse-side counterpart of the :focus-visible ring above, mirroring lr-textarea's
     [part='textarea']:hover. Gated on :host(:not([pending-action])), not :not(:disabled): this raw
     <textarea> is not form-associated and has no disabled state, and pending freezes it to
     readonly, so hover shouldn't relight it. */
  /* no-pressed-state: pressing inside a text surface places a caret, it actuates nothing. The
     mousedown matching :active is the gesture that focuses the field, so a pressed treatment would
     flicker for a frame between hover border and focus ring; focus is the real acting-on-me state,
     as in lr-textarea's [part='textarea']. */
  :host(:not([pending-action])) [part="args-editor"]:not([aria-invalid="true"]):hover {
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
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
  }
  [part="footer"] ::slotted(*) {
    /* Consumer-supplied footer content precedes the built-in buttons and soaks up the remaining
       space, reading as start-aligned while Deny/Edit/Approve stay pinned to the end; the row's own
       justify-content: flex-end covers the empty-slot case. */
    margin-inline-end: auto;
  }

`;
