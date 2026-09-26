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

  /* Deliberately narrow-only, unlike lr-control-group's unconditional [part='base'] fill: a button
     group is a compact row of uniform-height actions, and unconditionally filling a wide
     definite-width host would stretch two or three buttons across it with a large trailing gap
     instead of the shrink-wrapped row a toolbar wants. lr-control-group's own use case -- a mixed
     row of controls meant to line up with a definite-width toolbar -- has the opposite default.
     Below this allocation, filling and (via the vertical/wrap flex-wrap above) letting actions
     stack is what keeps them individually tappable instead of shrinking below their hit-area
     minimum; see button-group.test.ts's 'goes full-width when its own allocation is narrow' test,
     which pins this as the intended behavior at both breakpoints. */
  @container (max-inline-size: 20rem) {
    [part='base'] {
      inline-size: 100%;
    }
  }
`;
