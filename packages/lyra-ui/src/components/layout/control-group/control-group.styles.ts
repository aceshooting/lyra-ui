import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    container-type: normal;
    min-inline-size: 0;
    max-inline-size: 100%;
    vertical-align: middle;
  }

  /* Query container so the @container rule below reacts to this group's own allocated width,
     matching lr-button-group. Opt-in only -- see the class doc's responsive property. */
  :host([responsive]) {
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-12rem);
  }

  [part='base'] {
    display: inline-flex;
    flex-wrap: wrap;
    /* center, not stretch: unlike lr-button-group's uniform-height button rows,
       this group's children commonly differ in intrinsic height (a select, a
       segmented control, a plain button), and none re-centers its own content
       inside a taller host box, so stretching would misalign them. */
    align-items: center;
    gap: var(--lr-control-group-gap, var(--lr-space-xs));
    max-inline-size: 100%;
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
