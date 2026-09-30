import { css } from 'lit';
import { glassSurface } from '../../../internal/glass-surface.styles.js';
import { glassScrollLayerStyles } from '../../../internal/glass-scroll-layer.styles.js';
import { glassIndependentRootStyles } from '../../../internal/glass-independent-root.styles.js';

// Keep popover-only material initialization outside the module also consumed by tooltips.
export const glassPopoverStyles = css`
  ${glassIndependentRootStyles}
  ${glassScrollLayerStyles}
  ${glassSurface(
  '[part~="popup"]',
  css`var(--lr-overlay-surface, var(--_lr-overlay-surface, var(--lr-color-surface-container-high)))`,
  undefined,
  true,
  )}
`;
