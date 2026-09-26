import { css } from 'lit';
import { overlaySurface } from '../../../internal/overlay-surface.styles.js';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
  }

  [part~='base'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--lr-space-xs);
    box-sizing: border-box;
    max-inline-size: 100%;
    min-inline-size: var(--lr-icon-button-size);
    /* Every var() arm ends in a guaranteed-valid length, so the max() can never become invalid at
       computed-value time and drop the hit-area floor with it. The item does not compose the size
       ladder: that sheet carries attribute-keyed host rules this item has no property for. */
    min-block-size: max(
      var(
        --lr-navigation-menu-item-min-block-size,
        var(--lr-form-control-height-m, var(--lr-theme-form-control-height-m, var(--lr-size-2-5rem)))
      ),
      var(--lr-icon-button-size)
    );
    margin: 0;
    padding-block: 0;
    padding-inline: var(--lr-navigation-menu-item-padding-inline, var(--lr-space-l));
    border: 0;
    border-radius: var(--lr-radius);
    background: transparent;
    color: var(--lr-color-text);
    font: inherit;
    font-size: var(--lr-navigation-menu-item-font-size, var(--lr-font-size-m));
    font-weight: var(--lr-navigation-menu-item-font-weight, var(--lr-font-weight-medium));
    text-align: start;
    text-decoration: none;
    overflow-wrap: anywhere;
    cursor: pointer;
    transition: var(--lr-transition-interactive);
  }

  /* The collapsed menu's column: the whole row is the control, with the caret at the far end. */
  [part~='base']:where([data-layout='stacked']) {
    display: flex;
    inline-size: 100%;
    justify-content: flex-start;
  }

  [part~='base']:where([data-layout='stacked']) [part='expand-icon'] {
    margin-inline-start: auto;
  }

  [part~='base']:where(:hover) {
    background: var(--lr-navigation-menu-item-hover-bg, var(--lr-color-brand-quiet));
    color: var(--lr-navigation-menu-item-hover-color, var(--lr-color-brand));
  }

  [part~='base']:where(:active) {
    background: var(
      --lr-navigation-menu-item-active-bg,
      color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active))
    );
    color: var(--lr-navigation-menu-item-active-color, var(--lr-color-text));
  }

  [part~='base']:where(:focus-visible) {
    outline: var(--lr-focus-ring);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part~='base-current'] {
    color: var(--lr-navigation-menu-item-current-color, var(--lr-color-brand));
    font-weight: var(--lr-navigation-menu-item-current-font-weight, var(--lr-font-weight-semibold));
    transition: var(--lr-transition-interactive);
  }

  [part~='base-current']:where(:hover) {
    background: var(--lr-navigation-menu-item-hover-bg, var(--lr-color-brand-quiet));
    color: var(--lr-navigation-menu-item-hover-color, var(--lr-color-brand));
  }

  [part~='base-current']:where(:active) {
    background: var(
      --lr-navigation-menu-item-active-bg,
      color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active))
    );
    color: var(--lr-navigation-menu-item-active-color, var(--lr-color-text));
  }

  [part~='base-open'] {
    background: var(--lr-navigation-menu-item-open-bg, var(--lr-color-brand-quiet));
    transition: var(--lr-transition-interactive);
  }

  [part~='base-open']:where(:hover) {
    background: var(--lr-navigation-menu-item-hover-bg, var(--lr-color-brand-quiet));
    color: var(--lr-navigation-menu-item-hover-color, var(--lr-color-brand));
  }

  [part~='base-open']:where(:active) {
    background: var(
      --lr-navigation-menu-item-active-bg,
      color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active))
    );
    color: var(--lr-navigation-menu-item-active-color, var(--lr-color-text));
  }

  [part='start'],
  [part='end'] {
    display: inline-flex;
    align-items: center;
    flex: none;
  }

  [part='label'] {
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }

  [part='start'][hidden],
  [part='end'][hidden],
  [part='expand-icon'][hidden] {
    display: none;
  }

  /* The shared chevron points to the inline end; the wrapper turns it down, and up while open. A
     vertical glyph needs no mirroring under RTL. */
  [part='expand-icon'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    rotate: 90deg;
    transition: rotate var(--lr-transition-base);
  }

  [part~='base-open'] [part='expand-icon'] {
    rotate: 270deg;
  }

  [part='panel'] {
    box-sizing: border-box;
    color: var(--lr-color-text);
  }

  [part='panel'][hidden] {
    display: none;
  }

  /* Floating layout. Fixed from the start rather than only once the positioner runs, so a panel
     revealed for its first measurement never occupies a box in normal flow. The positioner
     overwrites the physical top and left, which is why they are physical here (see overlay.styles.ts
     for the right-to-left over-constraint this avoids). */
  [part='panel']:where([data-layout='floating']) {
    position: fixed;
    top: 0;
    /* policy-allow(physical-css): must stay the same physical property the positioner overwrites
       through style.left; a logical inset would leave the opposite edge active under RTL. */
    left: 0;
    z-index: var(--lr-overlay-stack-index, var(--lr-layer-dropdown));
    ${overlaySurface}
    box-shadow: var(--lr-overlay-shadow-anchored, var(--lr-shadow-m));
    padding: var(--lr-navigation-menu-panel-padding, var(--lr-space-s));
    max-inline-size: min(
      var(--lr-navigation-menu-panel-max-inline-size, var(--lr-size-48rem)),
      var(--lr-positioner-available-inline-size, var(--lr-size-48rem))
    );
    max-block-size: var(--lr-positioner-available-block-size, var(--lr-size-48rem));
    overflow: auto;
    overscroll-behavior: contain;
  }

  /* Only present while one open panel resizes into another. The switch duration is read solely
     here, through its token fallback, so reduced motion flattens it with every other duration. */
  [part='panel']:where([data-layout='floating'][data-morphing]) {
    overflow: hidden;
    transition:
      inline-size var(--lr-navigation-menu-switch-duration, var(--lr-duration-base)) var(--lr-easing-standard),
      block-size var(--lr-navigation-menu-switch-duration, var(--lr-duration-base)) var(--lr-easing-standard);
  }

  /* In-flow layout: the collapsed menu and an item with no owning menu. The rule on the start edge
     is decorative -- the panel is not a control -- so it takes the subtle border tier. */
  [part='panel']:where([data-layout='flow']) {
    position: static;
    margin-inline-start: var(--lr-navigation-menu-panel-indent, var(--lr-space-l));
    padding: var(--lr-navigation-menu-panel-padding, var(--lr-space-s));
    border-inline-start: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
  }

  .panel-content {
    min-inline-size: 0;
  }

  /* The hover bridge, copied from overlay.styles.ts rather than shared: a shared sheet would publish
     the positioner's private hover-bridge coordinates as consumer hooks on every component composing
     it. A full-viewport box clipped to the quad between the anchor and the panel, so a pointer
     crossing the gap never leaves the item. Every corner defaults to the same point until the first
     placement, which clips it to nothing. */
  /* policy-allow(physical-css): the quad's coordinates are viewport pixels from the anchor and panel
     rects, which no logical property can express. */
  .hover-bridge {
    position: fixed;
    inset: 0;
    z-index: var(--lr-overlay-stack-index, var(--lr-layer-dropdown));
    clip-path: polygon(
      var(--lr-positioner-hover-bridge-top-left-x, 0) var(--lr-positioner-hover-bridge-top-left-y, 0),
      var(--lr-positioner-hover-bridge-top-right-x, 0) var(--lr-positioner-hover-bridge-top-right-y, 0),
      var(--lr-positioner-hover-bridge-bottom-right-x, 0) var(--lr-positioner-hover-bridge-bottom-right-y, 0),
      var(--lr-positioner-hover-bridge-bottom-left-x, 0) var(--lr-positioner-hover-bridge-bottom-left-y, 0)
    );
  }

  @media (forced-colors: active) {
    [part='panel'] {
      border-color: CanvasText;
    }

    [part~='base-current'] {
      text-decoration: underline;
    }
  }
`;
