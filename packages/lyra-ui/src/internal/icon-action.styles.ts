import { css } from 'lit';
import { activeFill, hoverFill, interactiveTransition } from './interactive-control.styles.js';

// Hover and press mix from the public resting fill when a theme sets one, so a retuned
// `--lr-icon-button-bg` keeps its identity under the pointer.
const restingFill = 'var(--lr-icon-button-bg, var(--lr-color-surface))';

export const iconAction = css`
  font: inherit; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: var(--lr-icon-button-border, var(--_lr-icon-button-border-default, 0)); border-radius: var(--lr-icon-button-radius, var(--_lr-icon-button-radius-default, var(--lr-radius))); background: var(--lr-icon-button-bg, var(--_lr-icon-button-background-default, transparent)); color: var(--lr-icon-button-color, var(--_lr-icon-button-color-default, inherit)); cursor: pointer; text-decoration: none;
  ${interactiveTransition}
`;

export const iconActionHover = css`
  border: var(--lr-icon-button-border-hover, var(--_lr-icon-button-border-hover-default, var(--lr-icon-button-border, 0))); background: var(--lr-icon-button-bg-hover, var(--_lr-icon-button-background-hover-default, ${hoverFill(restingFill)})); color: var(--lr-icon-button-color-hover, var(--_lr-icon-button-color-hover-default, var(--lr-icon-button-color, inherit)));
  @media (forced-colors: active) { background: Highlight; color: HighlightText; }
`;

export const iconActionActive = css`
  border: var(--lr-icon-button-border-active, var(--_lr-icon-button-border-active-default, var(--lr-icon-button-border-hover, var(--lr-icon-button-border, 0)))); background: var(--lr-icon-button-bg-active, var(--_lr-icon-button-background-active-default, ${activeFill(restingFill)})); color: var(--lr-icon-button-color-active, var(--_lr-icon-button-color-active-default, var(--lr-icon-button-color-hover, var(--lr-icon-button-color, inherit))));
  @media (forced-colors: active) { background: Highlight; color: HighlightText; }
`;
