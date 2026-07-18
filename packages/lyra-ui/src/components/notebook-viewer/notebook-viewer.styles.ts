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
    max-block-size: var(--lyra-notebook-viewer-max-height, none);
    overflow: auto;
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
  }
  [part='cell'] {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--lyra-space-s);
    padding: var(--lyra-space-s);
    border-block-end: var(--lyra-border-width-thin) solid var(--lyra-color-border);
  }
  [part='cell'][data-active] {
    background: var(--lyra-color-brand-quiet);
  }
  [part='cell-gutter'] {
    min-inline-size: var(--lyra-size-4rem);
    color: var(--lyra-color-text-quiet);
    font-family: var(--lyra-font-mono);
    font-size: var(--lyra-font-size-xs);
    text-align: end;
  }
  [part='outputs'] {
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-xs);
    margin-block-start: var(--lyra-space-xs);
  }
  [part='output'] {
    font-family: var(--lyra-font-mono);
    font-size: var(--lyra-font-size-sm);
    white-space: pre-wrap;
  }
  [part='output'][data-stream='stderr'],
  [part='output'][data-output-type='error'] {
    color: var(--lyra-color-danger);
  }
  /* block display gives the label its own line ahead of the traceback text
     without baking a joiner character into the translated string */
  [part='output'] .error-output-label {
    display: block;
    font-weight: var(--lyra-font-weight-semibold);
  }
  [part='output-toggle'] {
    align-self: flex-start;
    border: none;
    background: none;
    color: var(--lyra-color-brand);
    cursor: pointer;
    padding: 0;
    font: inherit;
  }
  [part='error'] {
    color: var(--lyra-color-danger);
    padding: var(--lyra-space-l);
    text-align: center;
  }
  @container (max-width: 30rem) {
    [part='cell'] {
      grid-template-columns: 1fr;
    }
    [part='cell-gutter'] {
      text-align: start;
    }
  }
`;
