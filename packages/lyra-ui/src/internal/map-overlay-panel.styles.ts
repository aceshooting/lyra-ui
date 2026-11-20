import { css } from 'lit';
import { activeFill } from './interactive-control.styles.js';

/**
 * The surface chrome of an overlay panel anchored inside a map (`lr-map` anchor slot and
 * `lr-map-anchor`): sizing against the placement's published available space, border, radius,
 * surface, text and elevation. The caller owns position, z-index, display and overflow, which
 * differ per surface.
 */
export const mapOverlayPanel = css`
  box-sizing: border-box;
  inline-size: max-content;
  max-inline-size: var(--lr-positioner-available-inline-size, calc(100% - var(--lr-space-s) - var(--lr-space-s)));
  max-block-size: var(--lr-positioner-available-block-size, calc(100% - var(--lr-space-s) - var(--lr-space-s)));
  border: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
  border-radius: var(--lr-radius);
  background: var(--lr-color-surface-overlay);
  color: var(--lr-color-text);
  box-shadow: var(--lr-shadow-m);
  overflow-wrap: anywhere;
`;

/** The stacking order shared by every map overlay panel, including the rank of sibling anchors. */
export const mapOverlayPanelLayer = css`
  position: absolute;
  z-index: calc(var(--lr-layer-content) + 1 + var(--_lr-map-anchor-rank, 0));
`;

/** Resting chrome of a panel close button, excluding the hit target and focus ring the caller composes. */
export const mapOverlayCloseButton = css`
  padding: 0;
  border: 0;
  border-radius: var(--lr-radius);
  background: transparent;
  color: var(--lr-color-text-quiet);
  font: inherit;
  cursor: pointer;
`;

/** Declarations for the hover state of a panel close button. */
export const mapOverlayCloseButtonHover = css`
  background: var(--lr-map-popup-close-button-hover-bg, var(--lr-color-brand-quiet));
  color: var(--lr-map-popup-close-button-hover-color, var(--lr-color-brand));
`;

/** Declarations for the pressed state of a panel close button. */
export const mapOverlayCloseButtonActive = css`
  background: var(--lr-map-popup-close-button-active-bg, ${activeFill('var(--lr-color-brand-quiet)')});
  color: var(--lr-map-popup-close-button-active-color, var(--lr-color-brand));
`;
