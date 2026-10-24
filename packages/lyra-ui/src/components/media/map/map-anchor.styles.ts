import { css } from 'lit';
import { focusRing, iconHitTarget } from '../../../internal/interactive-control.styles.js';

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
    position: absolute;
    z-index: calc(var(--lr-layer-content) + 1 + var(--_lr-map-anchor-rank, 0));
    display: flex;
    box-sizing: border-box;
    inline-size: max-content;
    max-inline-size: var(--lr-positioner-available-inline-size, calc(100% - var(--lr-space-s) - var(--lr-space-s)));
    max-block-size: var(--lr-positioner-available-block-size, calc(100% - var(--lr-space-s) - var(--lr-space-s)));
    overflow: hidden;
    border: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface-overlay);
    color: var(--lr-color-text);
    box-shadow: var(--lr-shadow-m);
    overflow-wrap: anywhere;
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
    padding: 0;
    border: 0;
    border-radius: var(--lr-radius);
    background: transparent;
    color: var(--lr-color-text-quiet);
    font: inherit;
    cursor: pointer;
    transition: var(--lr-transition-interactive);
  }
  [part~='close-button']:where(:hover) {
    background: var(--lr-map-popup-close-button-hover-bg, var(--lr-color-brand-quiet));
    color: var(--lr-map-popup-close-button-hover-color, var(--lr-color-brand));
  }
  [part~='close-button']:where(:active) {
    background: var(--lr-map-popup-close-button-active-bg, color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active)));
    color: var(--lr-map-popup-close-button-active-color, var(--lr-color-brand));
  }
  [part~='close-button']:focus-visible {
    ${focusRing}
    outline-offset: calc(-1 * var(--lr-focus-ring-width));
  }
  [part~='close-icon'] {
    display: inline-flex;
    font-size: var(--lr-font-size-lg);
  }
`;
