import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    position: relative;
    inline-size: 100%;
    block-size: 100%;
    min-inline-size: 0;
    min-block-size: 0;
    overflow: hidden;
  }
  [part='base'] {
    position: relative;
    inline-size: 100%;
    block-size: 100%;
  }
  [part='viewport'] {
    position: relative;
    inline-size: 100%;
    block-size: 100%;
    overflow: hidden;
    outline: none;
    touch-action: none;
    cursor: grab;
  }
  [part='viewport']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-width));
  }
  [part='background'],
  [part='edges'] {
    position: absolute;
    inset: 0;
  }
  [part='edges'] {
    inline-size: 100%;
    block-size: 100%;
    overflow: visible;
    pointer-events: none;
  }
  [part='empty'] {
    inline-size: 100%;
    block-size: 100%;
  }
  ::slotted([slot='top-start']),
  ::slotted([slot='top-end']),
  ::slotted([slot='bottom-start']),
  ::slotted([slot='bottom-end']) {
    position: absolute;
    z-index: var(--lr-layer-content);
  }
  ::slotted([slot='top-start']) {
    inset-block-start: var(--lr-space-s);
    inset-inline-start: var(--lr-space-s);
  }
  ::slotted([slot='top-end']) {
    inset-block-start: var(--lr-space-s);
    inset-inline-end: var(--lr-space-s);
  }
  ::slotted([slot='bottom-start']) {
    inset-block-end: var(--lr-space-s);
    inset-inline-start: var(--lr-space-s);
  }
  ::slotted([slot='bottom-end']) {
    inset-block-end: var(--lr-space-s);
    inset-inline-end: var(--lr-space-s);
  }
  [part='node'] {
    position: absolute;
    inset-block-start: 0;
    inset-inline-start: 0;
    will-change: transform;
  }
  [part='node-control'] {
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
  }
  [part='node']:focus-within {
    z-index: var(--lr-layer-content);
  }
  [part='edge'] {
    fill: none;
    stroke: var(--lr-color-border);
    stroke-width: 1.5;
    pointer-events: stroke;
    cursor: pointer;
  }
  [part='edge-hit-area'] {
    fill: none;
    stroke: transparent;
    stroke-width: var(--lr-icon-button-size);
    pointer-events: stroke;
    cursor: pointer;
  }
  [part='edge'][data-tone='accent'] {
    stroke: var(--lr-color-brand);
  }
  [part='edge'][data-tone='success'] {
    stroke: var(--lr-color-success);
  }
  [part='edge'][data-tone='warning'] {
    stroke: var(--lr-color-warning);
  }
  [part='edge'][data-tone='danger'] {
    stroke: var(--lr-color-danger);
  }
  [part='arrowhead'] {
    fill: var(--lr-color-border);
  }
  [part='stub'] {
    stroke: var(--lr-color-border);
    stroke-width: 1.5;
    stroke-dasharray: 3 3;
    opacity: 0.6;
  }
  [part='edge-label'] {
    fill: var(--lr-color-text);
    font: var(--lr-font-size-xs) / 1 var(--lr-font);
    text-anchor: middle;
    stroke: var(--lr-color-surface);
    stroke-width: var(--lr-size-3px);
  }
  .world {
    position: absolute;
    inset-block-start: 0;
    inset-inline-start: 0;
    transform-origin: 0 0;
    will-change: transform;
  }
  [part='background'] {
    position: absolute;
    inset-block-start: -200%;
    inset-inline-start: -200%;
    inline-size: 500%;
    block-size: 500%;
    background-image: radial-gradient(circle, var(--lr-color-border) var(--lr-size-1px), transparent var(--lr-size-1px));
    background-size: var(--lr-flow-canvas-grid-size, var(--lr-size-0-5rem)) var(--lr-flow-canvas-grid-size, var(--lr-size-0-5rem));
    cursor: grab;
  }
  [part='viewport'][data-panning] [part='background'] {
    cursor: grabbing;
  }
  :host([locked]) [part='background'] {
    cursor: default;
  }
  :host([orientation='horizontal']:dir(rtl)) [part='viewport'] {
    transform: scaleX(-1);
  }
  :host([orientation='horizontal']:dir(rtl)) [part='node'] ::slotted(*) {
    transform: scaleX(-1);
  }
  [part='node']:hover {
    outline: var(--lr-size-1px) solid
      var(--lr-flow-canvas-node-hover-outline-color, var(--lr-color-border-strong));
    outline-offset: var(--lr-size-2px);
  }
  [part='edge']:hover {
    stroke-width: 2.5;
  }
  [part='node']:has([part='node-control']:focus-visible),
  [part='edge']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='node'][data-selected] {
    outline: var(--lr-size-2px) solid
      var(
        --lr-flow-canvas-node-selected-outline-color,
        var(--lr-flow-canvas-node-current-outline-color, var(--lr-color-brand))
      );
    outline-offset: var(--lr-size-2px);
    border-radius: var(--lr-radius);
  }
  [part='edge'][aria-pressed='true'] {
    stroke-width: 2.5;
  }
  [part='connection-line'] {
    fill: none;
    stroke: var(--lr-color-brand);
    stroke-width: 1.5;
    stroke-dasharray: 4 4;
    pointer-events: none;
  }
  [part='node'][data-connect-invalid] {
    outline: var(--lr-size-2px) solid var(--lr-flow-canvas-node-connect-invalid-outline-color, var(--lr-color-danger));
    outline-offset: var(--lr-size-2px);
  }
  [part='node'][data-connect-target] {
    outline: var(--lr-size-2px) dashed var(--lr-flow-canvas-node-connect-target-outline-color, var(--lr-color-brand));
    outline-offset: var(--lr-size-2px);
  }
  [part='viewport'][data-drop-active] {
    outline: var(--lr-size-2px) dashed var(--lr-flow-canvas-drop-active-outline-color, var(--lr-color-brand));
    outline-offset: calc(-1 * var(--lr-size-2px));
  }
  [part='edge'][data-running] {
    stroke-dasharray: 6 4;
    animation: lr-flow-canvas-march var(--lr-flow-canvas-march-duration, var(--lr-transition-ambient)) linear infinite;
  }
  [part='edge'][data-running-static] {
    stroke-dasharray: 6 4;
  }
  /* The JS gate only evaluates the preference at render time; this CSS branch also covers a
     preference change while an already-rendered edge is still marching. */
  @media (prefers-reduced-motion: reduce) {
    [part='edge'][data-running] {
      animation: none;
    }
  }
  @keyframes lr-flow-canvas-march {
    to {
      stroke-dashoffset: -20;
    }
  }
`;
