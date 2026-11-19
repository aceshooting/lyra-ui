import { css } from 'lit';

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
