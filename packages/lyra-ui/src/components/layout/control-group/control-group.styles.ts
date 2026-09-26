import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    container-type: normal;
    min-inline-size: 0;
    max-inline-size: 100%;
    vertical-align: middle;
  }

  /* Query container so a future @container rule can react to this group's own allocated width,
     matching lr-button-group. Opt-in only -- see the class doc's responsive property. The fill
     below is unconditional and does not depend on this. */
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
    /* Unconditional fill chain, matching the established pattern in
       media/file-input/file-input.styles.ts: :host is 'inline-flex' (an inline-level box that
       never auto-fills a block ancestor the way a block box does), and this single flex item has
       no flex-grow of its own, so even a host given an explicit definite width previously left
       this part shrink-wrapped around its content. A percentage inline-size against an
       indefinite/shrink-to-fit containing block resolves as if 'auto' per the flex sizing
       algorithm, so this is a byte-identical no-op for the default toolbar-in-a-shrink-to-fit-row
       case and only takes effect once an ancestor gives the host itself a definite inline size.
       lr-button-group deliberately keeps the narrow-only (@container) shape instead of this
       unconditional one -- see button-group.styles.ts's comment on that rule for why a uniform
       button row and a mixed-control toolbar want opposite wide-host defaults. */
    inline-size: 100%;
    max-inline-size: 100%;
  }

  ::slotted(*) {
    min-inline-size: 0;
  }
`;
