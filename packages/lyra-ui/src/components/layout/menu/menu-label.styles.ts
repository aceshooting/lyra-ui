import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    padding: var(--lr-menu-label-padding, var(--lr-space-xs) var(--lr-space-s));
    font-size: var(--lr-menu-label-font-size, var(--lr-font-size-sm));
    font-weight: var(--lr-menu-label-font-weight, var(--lr-font-weight-semibold));
    letter-spacing: var(--lr-menu-label-letter-spacing, normal);
    line-height: var(--lr-menu-label-line-height, var(--lr-line-height-snug));
    font-family: var(--lr-menu-label-font-family, inherit);
    text-transform: var(--lr-menu-label-text-transform, inherit);
    color: var(--lr-menu-label-color, var(--lr-color-text-quiet));
    /* A group heading is not an action: no pointer cursor, no hover/active feedback, and it is
       skipped by <lr-menu>'s roving tabindex because it is not a LyraMenuItem. */
    cursor: default;
    user-select: none;
  }
`;
