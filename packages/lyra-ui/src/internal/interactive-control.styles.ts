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

/** Shared fieldset panel frame. */
export const panelFrame = css`
  box-sizing: border-box;
  min-inline-size: 0;
  max-inline-size: 100%;
  margin: 0;
  padding: var(--lr-space-s);
  border: var(--lr-border-width-thin) solid var(--lr-color-border);
  border-radius: var(--lr-radius-xs);
`;

/** Shared native field surface. */
export const nativeControlSurface = css`
  border: var(--lr-border-width-thin) solid var(--lr-color-border);
  background: var(--lr-color-surface);
  color: var(--lr-color-text);
  font: inherit;
`;
