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
  [part='cell'] {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--lr-space-s);
    padding: var(--lr-space-s);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='cell'][data-active] {
    background: var(--lr-notebook-viewer-active-bg, var(--lr-color-brand-quiet));
  }
  [part='cell-gutter'] {
    min-inline-size: var(--lr-size-4rem);
    color: var(--lr-color-text-quiet);
    font-family: var(--lr-font-mono);
    font-size: var(--lr-font-size-xs);
    text-align: end;
  }
  [part='outputs'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    margin-block-start: var(--lr-space-xs);
  }
  [part='output'] {
    font-family: var(--lr-font-mono);
    font-size: var(--lr-font-size-sm);
    white-space: pre-wrap;
  }
  [part='output'][data-stream='stderr'],
  [part='output'][data-output-type='error'] {
    color: var(--lr-color-danger);
  }
  /* block display gives the label its own line ahead of the traceback text
     without baking a joiner character into the translated string */
  [part='output'] .error-output-label {
    display: block;
    font-weight: var(--lr-font-weight-semibold);
  }
  [part='output-toggle'] {
    align-self: flex-start;
    border: none;
    background: none;
    color: var(--lr-color-brand);
    cursor: pointer;
    padding: 0;
    font: inherit;
  }
  [part='error'] {
    color: var(--lr-color-danger);
    padding: var(--lr-space-l);
    text-align: center;
  }
  @container (max-inline-size: 30rem) {
    [part='cell'] {
      grid-template-columns: 1fr;
    }
    [part='cell-gutter'] {
      text-align: start;
    }
  }
`;
