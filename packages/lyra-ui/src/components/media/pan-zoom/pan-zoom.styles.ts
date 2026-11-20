import { iconAction, iconActionActive, iconActionHover, outlinedIconActionDefaults } from '../../../internal/icon-action.styles.js';
import { disabledControl, focusRingShorthand, iconHitTarget, interactiveTransition } from '../../../internal/interactive-control.styles.js';
import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
  }
  [part='base'] {
    display: grid;
    gap: var(--lr-space-s);
    min-inline-size: 0;
  }
  [part='viewport'] {
    min-block-size: var(--lr-pan-zoom-min-block-size, var(--lr-size-10rem));
    overflow: auto;
    overscroll-behavior: contain;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface-raised);
    outline: none;
    transition: var(--lr-transition-interactive);
  }
  [part='viewport']:focus-visible {
    ${focusRingShorthand}
  }
  /* no-pressed-state: the viewport is a focusable scroll surface, not an activation target. */
  [part='viewport']:hover {
    border-color: var(--lr-color-brand);
  }
  [part='content'] {
    display: grid;
    place-items: center;
    min-inline-size: 100%;
    min-block-size: 100%;
    inline-size: max-content;
    block-size: max-content;
    /* CSS zoom participates in layout, so scaled content expands the scrollable footprint instead
       of painting into an unreachable area outside transform-based scroll geometry. */
    zoom: var(--lr-pan-zoom-zoom, 1);
  }
  [part='content'] ::slotted(*) {
    max-inline-size: none;
  }
  [part='content'] img {
    display: block;
    max-inline-size: none;
  }
  /* Actual keeps the historical max-content layout. The other policies establish a definite
     viewport-sized basis, so CSS can resolve image sizing both before and after a delayed load and
     again whenever the containing lightbox is resized. */
  :host([fit='contain']) [part='content'],
  :host([fit='width']) [part='content'] {
    inline-size: 100%;
  }
  :host([fit='contain']) [part='content'] {
    block-size: 100%;
  }
  :host([fit='contain']) [part='content'] img {
    min-inline-size: 0;
    min-block-size: 0;
    inline-size: 100%;
    block-size: 100%;
    object-fit: contain;
  }
  :host([fit='width']) [part='content'] img {
    max-inline-size: 100%;
    inline-size: 100%;
    block-size: auto;
  }
  [part='controls'] {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
  }
  [part='zoom-out'],
  [part='zoom-in'],
  [part='reset'] {
    ${outlinedIconActionDefaults('var(--lr-pan-zoom-control-hover-bg, var(--lr-color-brand-quiet))')}
    ${iconHitTarget}
    ${iconAction}
    ${interactiveTransition}
    padding: revert;
  }
  [part='reset'] {
    position: relative;
    max-inline-size: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part='zoom-out']:not(:disabled):hover,
  [part='zoom-in']:not(:disabled):hover,
  [part='reset']:hover {
    ${iconActionHover}
  }
  [part='zoom-out']:not(:disabled):active,
  [part='zoom-in']:not(:disabled):active,
  [part='reset']:active {
    ${iconActionActive}
  }
  [part='zoom-out']:disabled,
  [part='zoom-in']:disabled {
    ${disabledControl}
  }
  [part='zoom-out']:focus-visible,
  [part='zoom-in']:focus-visible,
  [part='reset']:focus-visible {
    ${focusRingShorthand}
  }
`;
