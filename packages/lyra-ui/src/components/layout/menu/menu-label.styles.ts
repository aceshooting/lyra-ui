import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    padding: var(--lr-space-xs) var(--lr-space-s);
    font-size: var(--lr-font-size-sm);
    font-weight: var(--lr-font-weight-semibold);
    line-height: var(--lr-line-height-snug);
    color: var(--lr-color-text-quiet);
    /* A group heading is not an action: no pointer cursor, no hover/active feedback, and it is
       skipped by <lr-menu>'s roving tabindex because it is not a LyraMenuItem. */
    cursor: default;
    user-select: none;
  }
`;
