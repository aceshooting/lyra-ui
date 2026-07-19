import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    /* Makes the host a query container so the narrow-allocation rule below reacts to the
       component's own allocated width (a sidebar, a split pane, a dialog) rather than the
       viewport. */
    container-type: inline-size;
  }

  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-m);
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-sm);
    min-inline-size: 0;
  }

  [part='combinator'] {
    align-self: flex-start;
    max-inline-size: var(--lr-size-14rem);
  }

  [part='conditions'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
  }

  [part='condition'] {
    display: flex;
    align-items: flex-start;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
  }

  [part='field-select'],
  [part='operator-select'],
  [part='value'] {
    flex: 1 1 0;
    min-inline-size: 0;
  }

  .value-placeholder {
    display: block;
  }

  [part='remove-button'] {
    flex: 0 0 auto;
  }

  [part='add-button'] {
    align-self: flex-start;
  }

  [part='empty'] {
    margin: 0;
    color: var(--lr-color-text-quiet);
  }

  /* Container-query lengths cannot reference custom properties. This is the documented 320px
     narrow-allocation baseline expressed in root-relative units so it still follows the page's
     type scale. */
  @container (max-inline-size: 20rem) {
    [part='condition'] {
      flex-direction: column;
      align-items: stretch;
    }
    [part='remove-button'] {
      align-self: flex-end;
    }
  }
`;
