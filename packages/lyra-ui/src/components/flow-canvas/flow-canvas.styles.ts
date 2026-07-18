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
    z-index: var(--lyra-layer-content);
  }
  ::slotted([slot='top-start']) {
    inset-block-start: var(--lyra-space-s);
    inset-inline-start: var(--lyra-space-s);
  }
  ::slotted([slot='top-end']) {
    inset-block-start: var(--lyra-space-s);
    inset-inline-end: var(--lyra-space-s);
  }
  ::slotted([slot='bottom-start']) {
    inset-block-end: var(--lyra-space-s);
    inset-inline-start: var(--lyra-space-s);
  }
  ::slotted([slot='bottom-end']) {
    inset-block-end: var(--lyra-space-s);
    inset-inline-end: var(--lyra-space-s);
  }
  [part='node'] {
    position: absolute;
    inset-block-start: 0;
    inset-inline-start: 0;
    will-change: transform;
  }
  [part='edge'] {
    fill: none;
    stroke: var(--lyra-color-border);
    stroke-width: 1.5;
    pointer-events: stroke;
    cursor: pointer;
  }
  [part='edge'][data-tone='accent'] {
    stroke: var(--lyra-color-brand);
  }
  [part='edge'][data-tone='success'] {
    stroke: var(--lyra-color-success);
  }
  [part='edge'][data-tone='warning'] {
    stroke: var(--lyra-color-warning);
  }
  [part='edge'][data-tone='danger'] {
    stroke: var(--lyra-color-danger);
  }
  [part='arrowhead'] {
    fill: var(--lyra-color-border);
  }
  [part='stub'] {
    stroke: var(--lyra-color-border);
    stroke-width: 1.5;
    stroke-dasharray: 3 3;
    opacity: 0.6;
  }
  [part='edge-label'] {
    fill: var(--lyra-color-text);
    font: var(--lyra-font-size-xs) / 1 var(--lyra-font);
    text-anchor: middle;
    stroke: var(--lyra-color-surface);
    stroke-width: var(--lyra-size-3px);
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
    background-image: radial-gradient(circle, var(--lyra-color-border) var(--lyra-size-1px), transparent var(--lyra-size-1px));
    background-size: var(--lyra-flow-canvas-grid-size, var(--lyra-size-0-5rem)) var(--lyra-flow-canvas-grid-size, var(--lyra-size-0-5rem));
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
  [part='node']:focus-visible,
  [part='edge']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='node'][aria-current='true'] {
    outline: var(--lyra-size-2px) solid var(--lyra-color-brand);
    outline-offset: var(--lyra-size-2px);
    border-radius: var(--lyra-radius);
  }
  [part='edge'][aria-pressed='true'] {
    stroke-width: 2.5;
  }
  [part='connection-line'] {
    fill: none;
    stroke: var(--lyra-color-brand);
    stroke-width: 1.5;
    stroke-dasharray: 4 4;
    pointer-events: none;
  }
  [part='node'][data-connect-invalid] {
    outline: var(--lyra-size-2px) solid var(--lyra-color-danger);
    outline-offset: var(--lyra-size-2px);
  }
  [part='node'][data-connect-target] {
    outline: var(--lyra-size-2px) dashed var(--lyra-color-brand);
    outline-offset: var(--lyra-size-2px);
  }
  [part='viewport'][data-drop-active] {
    outline: var(--lyra-size-2px) dashed var(--lyra-color-brand);
    outline-offset: calc(-1 * var(--lyra-size-2px));
  }
  [part='edge'][data-running] {
    stroke-dasharray: 6 4;
    animation: lyra-flow-canvas-march var(--lyra-flow-canvas-march-duration, var(--lyra-transition-ambient)) linear infinite;
  }
  [part='edge'][data-running-static] {
    stroke-dasharray: 6 4;
  }
  @keyframes lyra-flow-canvas-march {
    to {
      stroke-dashoffset: -20;
    }
  }
`;
