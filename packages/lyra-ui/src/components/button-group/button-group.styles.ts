import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    /* Makes the host a query container so the @container rule below reacts to the
       group's own allocated width (a sidebar, a split pane, a dialog) instead of the
       viewport's — a group can be narrow on a wide screen and vice versa. */
    container-type: inline-size;
    min-inline-size: 0;
    max-inline-size: 100%;
    vertical-align: middle;
  }

  [part='base'] {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: stretch;
    gap: var(--lr-button-group-gap, var(--lr-space-2xs));
    max-inline-size: 100%;
  }

  :host([orientation='vertical']) [part='base'] {
    flex-direction: column;
    align-items: stretch;
  }

  ::slotted(*) {
    min-inline-size: 0;
  }

  @container (max-inline-size: 20rem) {
    [part='base'] {
      inline-size: 100%;
    }
  }
`;
