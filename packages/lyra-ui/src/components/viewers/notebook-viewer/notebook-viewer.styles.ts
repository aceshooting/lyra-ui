import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    /* Query container, so the @container rule below reacts to this viewer's own allocated width
       -- a chat transcript, a split pane, a narrow dialog on a wide desktop -- not the page
       viewport's. */
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-20rem);
  }
  [part='base'] {
    display: block;
    max-block-size: var(--lr-notebook-viewer-max-height, none);
    overflow: auto;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
  }
  lr-virtual-list::part(base) {
    max-block-size: calc(var(--lr-notebook-viewer-max-height, none) - 2 * var(--lr-border-width-thin));
  }
  /* Every cell part below is emitted by renderCell()/renderOutput() but committed into
     <lr-virtual-list>'s OWN shadow root, so a bare [part='...'] selector here resolves against
     this component's tree and never reaches it; the one-shadow-hop ::part() form does, and
     exportparts on the <lr-virtual-list> element re-exposes the names to consumers.

     State variants ride a part list (part="cell cell-active"), not an attribute: ::part() has
     part~= semantics but Shadow Parts forbids an attribute selector after it, so
     ::part(cell)[data-active] is invalid CSS. The data-* attributes stay for scripting and
     semantics; the part token is what the stylesheet keys off. */
  lr-virtual-list::part(cell) {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--lr-space-s);
    padding: var(--lr-space-s);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  lr-virtual-list::part(cell-active) {
    background: var(--lr-notebook-viewer-active-bg, var(--lr-color-brand-quiet));
  }
  /* The tone rules below override only the custom property; this base rule declares the
     accent-tone default and alone reads it into background, so whichever tone rule matches
     alongside -- later, same specificity -- supplies the value. Mirrors docx-viewer.styles.ts's
     --_lr-docx-viewer-highlight-background pattern. */
  lr-virtual-list::part(cell-highlighted) {
    --_lr-notebook-viewer-highlight-background: var(
      --lr-notebook-viewer-highlight-accent-background,
      var(--lr-color-brand-quiet)
    );
    background: var(--_lr-notebook-viewer-highlight-background);
  }
  lr-virtual-list::part(cell-highlighted-success) {
    --_lr-notebook-viewer-highlight-background: var(
      --lr-notebook-viewer-highlight-success-background,
      var(--lr-color-success-quiet)
    );
  }
  lr-virtual-list::part(cell-highlighted-warning) {
    --_lr-notebook-viewer-highlight-background: var(
      --lr-notebook-viewer-highlight-warning-background,
      var(--lr-color-warning-quiet)
    );
  }
  lr-virtual-list::part(cell-highlighted-danger) {
    --_lr-notebook-viewer-highlight-background: var(
      --lr-notebook-viewer-highlight-danger-background,
      var(--lr-color-danger-quiet)
    );
  }
  lr-virtual-list::part(cell-highlighted-neutral) {
    --_lr-notebook-viewer-highlight-background: var(
      --lr-notebook-viewer-highlight-neutral-background,
      var(--lr-color-surface-raised)
    );
  }
  /* Applied alongside cell-highlighted/cell-highlighted-<tone>: an inset outline rather than
     cell-active's background swap, so it layers over any highlight tone above instead of
     replacing it. */
  lr-virtual-list::part(cell-highlight-active) {
    outline: var(--lr-focus-ring-width) solid
      var(--lr-notebook-viewer-highlight-active-outline, var(--lr-focus-ring-color));
    outline-offset: calc(-1 * var(--lr-focus-ring-width));
  }
  lr-virtual-list::part(cell-gutter) {
    min-inline-size: var(--lr-size-4rem);
    color: var(--lr-color-text-quiet);
    font-family: var(--lr-font-mono);
    font-size: var(--lr-font-size-xs);
    text-align: end;
  }
  lr-virtual-list::part(cell-source) {
    min-inline-size: 0;
  }
  lr-virtual-list::part(raw-source) {
    box-sizing: border-box;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    max-inline-size: 100%;
    overflow: auto;
  }
  /* no-pressed-state: raw-source is a <pre tabindex="0"> horizontal scroll surface, not a control
     -- the tint tells the pointer which cell it is about to scroll, and mousedown there starts a
     text selection rather than activating anything. */
  lr-virtual-list::part(raw-source):hover {
    background: var(--lr-color-surface-raised);
  }
  lr-virtual-list::part(raw-source):focus-visible {
    outline: var(--lr-focus-ring);
    outline-offset: var(--lr-focus-ring-offset);
  }
  lr-virtual-list::part(outputs) {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    margin-block-start: var(--lr-space-xs);
  }
  lr-virtual-list::part(output) {
    font-family: var(--lr-font-mono);
    font-size: var(--lr-font-size-sm);
    white-space: pre-wrap;
    /* Output is raw code-like content (stdout/stderr, tracebacks, text/plain), read left-to-right
       whatever the document direction -- same reasoning as code-block.styles.ts's [part=pre]
       rule. Otherwise an ambient dir="rtl" bidi-reorders and right-aligns it (text-align: start
       resolving to right), leaving input pinned left and output flipped right; isolate stops an
       RTL run inside the output leaking out. */
    direction: ltr;
    unicode-bidi: isolate;
  }
  lr-virtual-list::part(output-error) {
    color: var(--lr-color-danger);
  }
  /* block display gives the label its own line ahead of the traceback text without baking a
     joiner character into the translated string. */
  lr-virtual-list::part(error-output-label) {
    display: block;
    font-weight: var(--lr-font-weight-semibold);
  }
  lr-virtual-list::part(output-toggle) {
    align-self: flex-start;
    border: none;
    background: none;
    color: var(--lr-color-brand);
    cursor: pointer;
    padding: 0;
    font: inherit;
  }
  lr-virtual-list::part(output-toggle):hover {
    text-decoration: underline;
  }
  /* The toggle is a borderless text button with no fill to deepen, so the press keeps the hover
     underline and shifts the label itself toward the text colour -- a stronger, visibly different
     step rather than a repeat of hover. */
  lr-virtual-list::part(output-toggle):active {
    text-decoration: underline;
    color: color-mix(in oklab, var(--lr-color-brand), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  lr-virtual-list::part(output-toggle):focus-visible {
    outline: var(--lr-focus-ring);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='error'] {
    color: var(--lr-color-danger);
    padding: var(--lr-space-l);
    text-align: center;
  }
  /* Container-query evaluation walks the flat tree, so it crosses the <lr-virtual-list> shadow
     boundary and still resolves against the :host container above -- these narrow-allocation
     ::part() rules keep working. */
  @container (max-inline-size: 30rem) {
    lr-virtual-list::part(cell) {
      grid-template-columns: 1fr;
    }
    lr-virtual-list::part(cell-gutter) {
      text-align: start;
    }
  }
`;
