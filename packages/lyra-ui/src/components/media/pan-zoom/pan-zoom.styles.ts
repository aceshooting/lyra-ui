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
    grid-template-rows: minmax(0, 1fr) auto;
    block-size: 100%;
    min-inline-size: 0;
  }
  /* Give an intrinsic frame its minimum height without preventing a bounded viewport from
     shrinking to leave room for the controls. The sizing box never contributes scroll overflow. */
  [part='base']::before {
    content: '';
    grid-area: 1 / 1;
    block-size: var(--lr-pan-zoom-min-block-size, var(--lr-size-10rem));
    max-block-size: 100%;
    overflow: clip;
    pointer-events: none;
  }
  [part='viewport'] {
    grid-area: 1 / 1;
    box-sizing: border-box;
    min-block-size: 0;
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
    user-select: none;
  }
  [part='content'] img:where([data-panning]) {
    cursor: grabbing;
  }
  /* Auto margins center fitted images while positive and leave overflowing edges reachable. */
  :host(:where([fit='contain'], [fit='width'])) [part='viewport']:where([data-image]) {
    display: flex;
    flex-direction: column;
  }
  /* Percentages on the zoomed box resolve in viewport pixels. Multiply the fitted box
     explicitly so its base size scales with the selected zoom. */
  :host(:where([fit='contain'], [fit='width'])) [part='viewport']:where([data-image]) [part='content'] {
    flex: none;
    margin: auto;
    min-inline-size: 0;
    inline-size: calc(100% * var(--lr-pan-zoom-zoom, 1));
  }
  :host([fit='contain']) [part='viewport']:where([data-image]) [part='content'] {
    min-block-size: 0;
    block-size: calc(100% * var(--lr-pan-zoom-zoom, 1));
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
    grid-area: 2 / 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
    margin-block-start: var(--lr-space-s);
  }
  [part='zoom-out'],
  [part='zoom-in'],
  [part='reset'] {
    ${iconHitTarget}
    ${outlinedIconActionDefaults('var(--lr-pan-zoom-control-hover-bg, var(--lr-color-brand-quiet))')}
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
