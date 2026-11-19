import { css } from 'lit';

/** Shared minimum target dimensions. */
export const iconHitTarget = css`
  min-inline-size: var(--lr-icon-button-size);
  min-block-size: var(--lr-icon-button-size);
`;

/** Shared keyboard focus outline. */
export const focusRing = css`
  outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
  outline-offset: var(--lr-focus-ring-offset);
`;
