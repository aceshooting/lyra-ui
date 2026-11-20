import { css } from 'lit';
import { compactContainerQuery } from '../../../internal/container-breakpoints.styles.js';
import { inlineSizeContainer } from '../../../internal/layout-fragments.styles.js';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    /* Query container, so the narrow-allocation rule below reacts to the component's own
       allocated width -- a sidebar, a split pane, a dialog -- rather than the viewport. */
    ${inlineSizeContainer}
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
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
  }

  [part='field-select'],
  [part='operator-select'],
  [part='value'] {
    flex: 1 1 var(--lr-size-8rem);
    min-inline-size: min(var(--lr-size-8rem), 100%);
  }

  .value-placeholder {
    display: block;
    flex-basis: 0;
    min-inline-size: 0;
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

  /* Container-query lengths cannot reference custom properties, so the documented 320px
     narrow-allocation baseline is expressed in root-relative units and still follows the page's
     type scale. */
  @container ${compactContainerQuery} {
    [part='condition'] {
      flex-direction: column;
      align-items: stretch;
    }
    [part='remove-button'] {
      align-self: flex-end;
    }
  }
`;
