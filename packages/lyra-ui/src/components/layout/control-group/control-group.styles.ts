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
     matching lr-button-group's own container-query approach -- opt-in only, see the class doc's
     responsive property. */
  :host([responsive]) {
    container-type: inline-size;
  }

  [part='base'] {
    display: inline-flex;
    flex-wrap: wrap;
    /* center, not stretch: unlike lr-button-group's uniform-height button rows,
       this group's children are commonly different intrinsic heights (a select, a
       segmented control, a plain button) -- stretching would misalign them since
       none of those components re-center their own content inside a taller host box. */
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
