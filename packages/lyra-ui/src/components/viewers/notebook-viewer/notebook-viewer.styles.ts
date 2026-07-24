import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    /* Makes the host a query container so the @container rule below reacts to this viewer's own
       allocated width (a chat transcript, a split pane, a narrow dialog) instead of the page
       viewport's -- a reusable primitive can be squeezed into a narrow panel on a wide desktop. */
    container-type: inline-size;
  }
  [part='base'] {
    display: block;
    max-block-size: var(--lr-notebook-viewer-max-height, none);
    overflow: auto;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
  }
  /* Every cell part below is emitted by renderCell()/renderOutput() but committed into
     <lr-virtual-list>'s OWN shadow root, so a bare [part='...'] selector here can never reach it --
     it would resolve against this component's shadow tree, which holds none of those nodes. The
     one-shadow-hop ::part() form is what actually matches, and the paired exportparts on the
     <lr-virtual-list> element re-exposes the same names to a consumer.

     State variants ride a part *list* (e.g. part="cell cell-active") rather than an attribute:
     ::part() has part~= semantics, but Shadow Parts forbids an attribute selector after ::part(),
     so ::part(cell)[data-active] is invalid CSS. The data-* attributes stay on the elements for
     scripting and semantics; the extra part token is what the stylesheet keys off. */
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
  lr-virtual-list::part(raw-source):hover {
    background: var(--lr-color-surface-raised);
  }
  lr-virtual-list::part(raw-source):focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
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
  }
  lr-virtual-list::part(output-error) {
    color: var(--lr-color-danger);
  }
  /* block display gives the label its own line ahead of the traceback text
     without baking a joiner character into the translated string */
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
  lr-virtual-list::part(output-toggle):focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='error'] {
    color: var(--lr-color-danger);
    padding: var(--lr-space-l);
    text-align: center;
  }
  /* Container-query evaluation walks the flat tree, so it crosses the <lr-virtual-list> shadow
     boundary and still resolves against the :host container declared above -- the narrow-allocation
     rules keep working on the ::part() selectors. */
  @container (max-inline-size: 30rem) {
    lr-virtual-list::part(cell) {
      grid-template-columns: 1fr;
    }
    lr-virtual-list::part(cell-gutter) {
      text-align: start;
    }
  }
`;
