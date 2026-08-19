import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    /* Query container, so the @container rule below reacts to the group's own allocated width (a
       sidebar, a split pane, a dialog) rather than the viewport's: a group can be narrow on a wide
       screen and vice versa. */
    container-type: inline-size;
    /* Size containment removes content-based intrinsic sizing; this compact fallback keeps an
       unallocated group wide enough for ordinary actions and lets its narrow query wrap longer
       sets. The hit-area minimum stays the hard lower bound under tighter allocation. */
    contain-intrinsic-inline-size: var(--lr-size-12rem);
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
