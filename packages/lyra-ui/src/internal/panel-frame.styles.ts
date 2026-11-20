import { css } from 'lit';

/**
 * Shared fieldset panel frame. Every paint value sits behind a `--lr-panel-frame-*` hook, so one
 * declaration on a transcript retunes every embedded panel, and every panel fills with the same
 * surface so a row of them reads as one family on a tinted background.
 */
export const panelFrame = css`
  box-sizing: border-box;
  min-inline-size: 0;
  max-inline-size: 100%;
  margin: 0;
  padding: var(--lr-panel-frame-padding, var(--lr-space-s));
  border: var(--lr-border-width-thin) solid var(--lr-panel-frame-border-color, var(--lr-color-border));
  border-radius: var(--lr-panel-frame-radius, var(--lr-radius-xs));
  background: var(--lr-panel-frame-bg, var(--lr-color-surface));
  color: var(--lr-color-text);
`;

/**
 * The shared `frame="plain"` escape for a {@link panelFrame} `[part='base']`: drops the border,
 * radius, fill and padding, so a panel nested in a container that already draws a border does
 * not double it.
 */
export const panelFramePlain = css`
  :host([frame='plain']) [part='base'] {
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }
`;
