import { css } from 'lit';

export const styles = css`
  :host {
    /* Private default for the public gap: horizontal toggles touch so the group can join them into
       one bordered run; any real gap keeps every toggle's corners. */
    --_lr-toggle-group-gap: 0;
    display: inline-flex;
    vertical-align: middle;
    max-inline-size: 100%;
  }

  :host([orientation='vertical']) {
    --_lr-toggle-group-gap: var(--lr-space-2xs);
  }

  /* Narrow allocations wrap intrinsically; each wrapped line is measured as a new run. */
  [part='base'] {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: stretch;
    min-inline-size: 0;
    max-inline-size: 100%;
    column-gap: var(--lr-toggle-group-gap, var(--_lr-toggle-group-gap));
    row-gap: var(--lr-toggle-group-wrap-gap, var(--lr-space-2xs));
  }

  :host([orientation='vertical']) [part='base'] {
    flex-direction: column;
    row-gap: var(--lr-toggle-group-gap, var(--_lr-toggle-group-gap));
    column-gap: var(--lr-toggle-group-wrap-gap, var(--lr-space-2xs));
  }
`;
