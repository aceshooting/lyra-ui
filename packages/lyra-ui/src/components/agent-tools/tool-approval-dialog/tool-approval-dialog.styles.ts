import { css } from 'lit';

export const styles = css`
  :host {
    /* Backdrop scrim color -- component-specific so a host can retheme it
       without a raw literal leaking into the public API (no shared
       --lr-*-overlay token exists in the design system to resolve through,
       same rationale as lr-dialog's --lr-dialog-overlay-color and
       lr-tool-select-dialog's --lr-tool-select-dialog-overlay-color). */
    --lr-tool-approval-dialog-overlay-color: var(--lr-color-overlay);
    /* Contained here (rather than a bare font-family literal on the
       textarea) so a host page can retheme it -- same rationale as
       lr-json-viewer's --lr-json-viewer-font; raw args are code, not
       prose, so the editor gets the same monospace treatment as that
       viewer's own tree rendering. */
    --lr-tool-approval-dialog-mono-font: var(--lr-font-mono);
    display: none;
    position: fixed;
    inset: 0;
    z-index: var(--lr-overlay-stack-index, var(--lr-layer-modal));
    align-items: center;
    justify-content: center;
    padding-block-start: max(var(--lr-space-l), var(--lr-safe-area-top));
    padding-block-end: max(var(--lr-space-l), var(--lr-safe-area-bottom));
    padding-inline-start: max(var(--lr-space-l), var(--lr-safe-area-inline-start));
    padding-inline-end: max(var(--lr-space-l), var(--lr-safe-area-inline-end));
  }
  :host([open]) {
    display: flex;
  }
  [part='backdrop'] {
    position: absolute;
    inset: 0;
    background: var(--lr-tool-approval-dialog-overlay-color);
  }
  [part='panel'] {
    position: relative;
    display: flex;
    flex-direction: column;
    inline-size: min(var(--lr-size-32rem), 100%);
    max-block-size: min(var(--lr-size-36rem), 100%);
    background: var(--lr-color-surface);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    box-shadow: var(--lr-shadow);
    overflow: hidden;
  }
  [part='header'] {
    padding: var(--lr-space-l) var(--lr-space-l) 0;
  }
  [part='header'] h2 {
    margin: 0;
    font-size: var(--lr-size-1-0625rem);
    font-weight: var(--lr-font-weight-semibold);
  }
  [part='tool-name'] {
    font-family: var(--lr-tool-approval-dialog-mono-font);
    font-weight: var(--lr-font-weight-bold);
    color: var(--lr-color-brand);
    word-break: break-word;
  }

  [part='body'] {
    flex: 1 1 auto;
    min-block-size: 0;
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-m) var(--lr-space-l) var(--lr-space-l);
    overflow: auto;
  }
  [part='args-view'] {
    /* lr-json-viewer grows with its content by default (its own
       max-height is 'none'); this component's [part='body'] is what caps
       and scrolls it instead, so it stays consistent with the plain
       [part='args-editor'] textarea below, which has no scroll cap of its
       own either. */
    flex: 1 1 auto;
    min-block-size: 0;
  }
  [part='args-editor'] {
    flex: 1 1 auto;
    min-block-size: var(--lr-size-10rem);
    box-sizing: border-box;
    resize: vertical;
    padding: var(--lr-space-s) var(--lr-space-m);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: inherit;
    font-family: var(--lr-tool-approval-dialog-mono-font);
    font-size: var(--lr-font-size-sm);
    line-height: var(--lr-line-height-normal);
  }
  [part='args-editor']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='args-editor'][aria-invalid='true'] {
    border-color: var(--lr-color-danger);
  }
  [part='error'] {
    margin: 0;
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-danger);
  }
  [part='error'][hidden] {
    display: none;
  }

  [part='footer'] {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--lr-space-s);
    padding: var(--lr-space-m) var(--lr-space-l);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='footer'] ::slotted(*) {
    /* Any consumer-supplied footer content sits ahead of the built-in
       buttons and soaks up the row's remaining space, so it reads as
       start-aligned while Deny/Edit/Approve stay pinned to the end (the
       row itself is justify-content: flex-end for the empty-slot case). */
    margin-inline-end: auto;
  }

  /* deny-button/approve-button are <lr-button> hosts (see tool-approval-dialog.class.ts's
     render()); their own padding/border/background/color/hover/focus-visible/disabled chrome now
     lives entirely inside lr-button's own styles.ts. edit-button alone stays a raw <button> and
     keeps its own rules below. */
  [part='edit-button'] {
    font: inherit;
    font-size: var(--lr-font-size-md-sm);
    padding: var(--lr-space-xs) var(--lr-space-m);
    border-radius: var(--lr-radius);
    cursor: pointer;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
  }
  [part='edit-button']:hover {
    background: var(--lr-color-brand-quiet);
  }
  [part='edit-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
`;
