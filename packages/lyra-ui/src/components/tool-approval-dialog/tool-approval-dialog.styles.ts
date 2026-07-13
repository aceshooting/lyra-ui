import { css } from 'lit';

export const styles = css`
  :host {
    /* Backdrop scrim color -- component-specific so a host can retheme it
       without a raw literal leaking into the public API (no shared
       --wa-*-overlay token exists in the design system to resolve through,
       same rationale as lyra-dialog's --lyra-dialog-overlay-color and
       lyra-tool-select-dialog's --lyra-tool-select-dialog-overlay-color). */
    --lyra-tool-approval-dialog-overlay-color: var(--lyra-color-overlay);
    /* Contained here (rather than a bare font-family literal on the
       textarea) so a host page can retheme it -- same rationale as
       lyra-json-viewer's --lyra-json-viewer-font; raw args are code, not
       prose, so the editor gets the same monospace treatment as that
       viewer's own tree rendering. */
    --lyra-tool-approval-dialog-mono-font: var(--lyra-font-mono);
    display: none;
    position: fixed;
    inset: 0;
    z-index: var(--lyra-overlay-stack-index, var(--lyra-layer-modal));
    align-items: center;
    justify-content: center;
    padding-block-start: max(var(--lyra-space-l), var(--lyra-safe-area-top));
    padding-block-end: max(var(--lyra-space-l), var(--lyra-safe-area-bottom));
    padding-inline-start: max(var(--lyra-space-l), var(--lyra-safe-area-inline-start));
    padding-inline-end: max(var(--lyra-space-l), var(--lyra-safe-area-inline-end));
  }
  :host([open]) {
    display: flex;
  }
  [part='backdrop'] {
    position: absolute;
    inset: 0;
    background: var(--lyra-tool-approval-dialog-overlay-color);
  }
  [part='panel'] {
    position: relative;
    display: flex;
    flex-direction: column;
    inline-size: min(var(--lyra-size-32rem), 100%);
    max-block-size: min(var(--lyra-size-36rem), 100%);
    background: var(--lyra-color-surface);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    box-shadow: var(--lyra-shadow);
    overflow: hidden;
  }
  [part='header'] {
    padding: var(--lyra-space-l) var(--lyra-space-l) 0;
  }
  [part='header'] h2 {
    margin: 0;
    font-size: var(--lyra-size-1-0625rem);
    font-weight: var(--lyra-font-weight-semibold);
  }
  [part='tool-name'] {
    font-family: var(--lyra-tool-approval-dialog-mono-font);
    font-weight: var(--lyra-font-weight-bold);
    color: var(--lyra-color-brand);
    word-break: break-word;
  }

  [part='body'] {
    flex: 1 1 auto;
    min-block-size: 0;
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-xs);
    padding: var(--lyra-space-m) var(--lyra-space-l) var(--lyra-space-l);
    overflow: auto;
  }
  [part='args-view'] {
    /* lyra-json-viewer grows with its content by default (its own
       max-height is 'none'); this component's [part='body'] is what caps
       and scrolls it instead, so it stays consistent with the plain
       [part='args-editor'] textarea below, which has no scroll cap of its
       own either. */
    flex: 1 1 auto;
    min-block-size: 0;
  }
  [part='args-editor'] {
    flex: 1 1 auto;
    min-block-size: var(--lyra-size-10rem);
    box-sizing: border-box;
    resize: vertical;
    padding: var(--lyra-space-s) var(--lyra-space-m);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    color: inherit;
    font-family: var(--lyra-tool-approval-dialog-mono-font);
    font-size: var(--lyra-font-size-sm);
    line-height: var(--lyra-line-height-normal);
  }
  [part='args-editor']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='args-editor'][aria-invalid='true'] {
    border-color: var(--lyra-color-danger);
  }
  [part='error'] {
    margin: 0;
    font-size: var(--lyra-font-size-sm);
    color: var(--lyra-color-danger);
  }
  [part='error'][hidden] {
    display: none;
  }

  [part='footer'] {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--lyra-space-s);
    padding: var(--lyra-space-m) var(--lyra-space-l);
    border-block-start: var(--lyra-border-width-thin) solid var(--lyra-color-border);
  }
  [part='footer'] ::slotted(*) {
    /* Any consumer-supplied footer content sits ahead of the built-in
       buttons and soaks up the row's remaining space, so it reads as
       start-aligned while Deny/Edit/Approve stay pinned to the end (the
       row itself is justify-content: flex-end for the empty-slot case). */
    margin-inline-end: auto;
  }

  [part='deny-button'],
  [part='edit-button'],
  [part='approve-button'] {
    font: inherit;
    font-size: var(--lyra-font-size-md-sm);
    padding: var(--lyra-space-xs) var(--lyra-space-m);
    border-radius: var(--lyra-radius);
    cursor: pointer;
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
  }
  [part='deny-button'],
  [part='edit-button'] {
    background: var(--lyra-color-surface);
    color: var(--lyra-color-text);
  }
  [part='deny-button']:hover,
  [part='edit-button']:hover {
    background: var(--lyra-color-brand-quiet);
  }
  [part='approve-button'] {
    background: var(--lyra-color-brand);
    color: var(--lyra-color-on-brand);
    border-color: var(--lyra-color-brand);
  }
  [part='approve-button']:hover:not(:disabled) {
    filter: brightness(1.1);
  }
  [part='approve-button']:disabled {
    cursor: not-allowed;
    opacity: var(--lyra-opacity-disabled);
  }
  [part='deny-button']:focus-visible,
  [part='edit-button']:focus-visible,
  [part='approve-button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
`;
