import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    /* Makes the host a query container so the @container rule below reacts to the
       group's own allocated width (a sidebar, a split pane, a dialog) instead of the
       viewport's — a group can be narrow on a wide screen and vice versa. */
    container-type: inline-size;
    /* Floors the host so a shrink-to-fit flex/grid parent (which gives inline-flex children a 0
       basis, not their content size, absent an explicit width) can't collapse it to ~0 -- a group
       with no explicit width must still render its buttons. NOTE: this can't be a content-based
       keyword (fit-content/max-content/auto) -- container-type implies inline-size containment on
       *this* box, and per the CSS Containment spec a size-contained box's content-dependent sizing
       resolves as if it had no content at all (verified in Chromium: fit-content collapsed to the
       same 0 this rule exists to prevent). Only a length/token floor survives containment, so this
       reuses the hit-area floor already used as a "smallest a control should ever be" minimum
       throughout the library instead of inventing a group-specific magic number. */
    min-inline-size: var(--lr-icon-button-size);
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
