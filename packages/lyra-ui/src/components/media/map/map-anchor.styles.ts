import { css } from 'lit';
import { mapOverlayPanel, mapOverlayPanelLayer, mapOverlayCloseButton, mapOverlayCloseButtonHover, mapOverlayCloseButtonActive } from '../../../internal/map-overlay-panel.styles.js';
import { focusRing, focusRingOffsetInset, iconHitTarget } from '../../../internal/interactive-control.styles.js';

export const styles = css`
  /* The host never generates a box, so application layout cannot become the containing block of
     the panel, which is positioned inside the owning map. The hidden attribute still removes it. */
  :host {
    display: contents !important;
  }
  :host([hidden]) {
    display: none !important;
  }
  /* The safe-area fence of this anchor inside the map allocation; placement writes its insets. */
  .fence {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  /* Placement writes position and coordinates. The rank orders the overlapping anchors of one map;
     a z-index authored on the part replaces it. Its size never tracks anything but the available
     space placement publishes, which it measures against. */
  [part~='base'] {
    ${mapOverlayPanelLayer}
    ${mapOverlayPanel}
    display: flex;
    overflow: hidden;
  }
  /* Placement and close state must survive consumer display rules on the public part. */
  [part~='base']:where([hidden]) {
    display: none !important;
  }
  [part~='body'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow: auto;
    overscroll-behavior: contain;
    padding: var(--lr-space-m);
  }
  /* Its own column at the block-start, inline-end corner, so content never renders under it. */
  [part~='close-button'] {
    ${iconHitTarget}
    flex: none;
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin: var(--lr-space-xs);
    ${mapOverlayCloseButton}
    transition: var(--lr-transition-interactive);
  }
  [part~='close-button']:where(:hover) {
    ${mapOverlayCloseButtonHover}
  }
  [part~='close-button']:where(:active) {
    ${mapOverlayCloseButtonActive}
  }
  [part~='close-button']:focus-visible {
    ${focusRing}
    ${focusRingOffsetInset}
  }
  [part~='close-icon'] {
    display: inline-flex;
    font-size: var(--lr-font-size-lg);
  }
`;
