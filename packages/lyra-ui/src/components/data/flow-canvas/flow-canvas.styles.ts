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
    pointer-events: none;
  }
  [part='overlay-rail'] {
    position: absolute;
    inset-inline: var(--lr-space-s);
    z-index: var(--lr-layer-content);
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: var(--lr-space-s);
    pointer-events: none;
  }
  [part='overlay-rail'][data-edge='top'] {
    inset-block-start: var(--lr-space-s);
  }
  [part='overlay-rail'][data-edge='bottom'] {
    inset-block-end: var(--lr-space-s);
  }
  .overlay-group {
    display: flex;
    flex-wrap: wrap;
    max-inline-size: 100%;
    gap: var(--lr-space-s);
    pointer-events: auto;
  }
  .overlay-group[data-align='end'] {
    margin-inline-start: auto;
  }
  [part='node'] {
    position: absolute;
    inset-block-start: 0;
    inset-inline-start: 0;
    will-change: transform;
    /* WCAG 2.5.8 floor. This element carries the pointer handlers, but its size comes entirely
       from the consumer-authored card slotted into it, which the component invites and cannot
       constrain. The one part that already had a floor, node-control, renders sr-only and so is
       a keyboard proxy no pointer can reach. 24px rather than the 40px --lr-icon-button-size:
       a node is an ordinary composite card, not a compact icon control -- same reasoning as
       lr-media-card. */
    min-inline-size: var(--lr-size-1-5rem);
    min-block-size: var(--lr-size-1-5rem);
  }
  [part='node-control'] {
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
  }
  .portable-node-card {
    display: flex;
    align-items: stretch;
    gap: var(--lr-space-xs);
    min-inline-size: calc(var(--lr-size-10rem) + var(--lr-size-1rem));
    padding: var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    box-shadow: var(--lr-shadow-s);
  }
  .portable-node-content {
    display: flex;
    flex: 1 1 auto;
    min-inline-size: 0;
    flex-direction: column;
    overflow-wrap: anywhere;
  }
  .portable-handles {
    display: flex;
    flex-direction: column;
    justify-content: space-around;
  }
  .portable-handles > span {
    inline-size: var(--lr-size-0-5rem);
    block-size: var(--lr-size-0-5rem);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-border-strong);
  }
  [part='node']:focus-within {
    z-index: var(--lr-layer-content);
  }
  [part='edge'] {
    fill: none;
    stroke: var(--lr-flow-canvas-edge-neutral-color, var(--lr-color-border));
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
  [part='edge'][data-tone='brand'] {
    stroke: var(--lr-flow-canvas-edge-brand-color, var(--lr-color-brand));
  }
  [part='edge'][data-tone='success'] {
    stroke: var(--lr-flow-canvas-edge-success-color, var(--lr-color-success));
  }
  [part='edge'][data-tone='warning'] {
    stroke: var(--lr-flow-canvas-edge-warning-color, var(--lr-color-warning));
  }
  [part='edge'][data-tone='danger'] {
    stroke: var(--lr-flow-canvas-edge-danger-color, var(--lr-color-danger));
  }
  [part='arrowhead'] {
    fill: var(--lr-flow-canvas-edge-neutral-color, var(--lr-color-border));
  }
  [part='arrowhead'][data-tone='brand'] {
    fill: var(--lr-flow-canvas-edge-brand-color, var(--lr-color-brand));
  }
  [part='arrowhead'][data-tone='success'] {
    fill: var(--lr-flow-canvas-edge-success-color, var(--lr-color-success));
  }
  [part='arrowhead'][data-tone='warning'] {
    fill: var(--lr-flow-canvas-edge-warning-color, var(--lr-color-warning));
  }
  [part='arrowhead'][data-tone='danger'] {
    fill: var(--lr-flow-canvas-edge-danger-color, var(--lr-color-danger));
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
  [part='layout-limit'] {
    position: absolute;
    inset-inline: var(--lr-space-s);
    inset-block-end: var(--lr-space-s);
    z-index: var(--lr-layer-content);
    max-inline-size: calc(100% - 2 * var(--lr-space-s));
    padding: var(--lr-space-2xs) var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-warning);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-xs);
    overflow-wrap: anywhere;
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
    background-size: var(--lr-flow-canvas-grid-size, var(--_lr-flow-canvas-grid-size, var(--lr-size-0-5rem))) var(--lr-flow-canvas-grid-size, var(--_lr-flow-canvas-grid-size, var(--lr-size-0-5rem)));
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
  /* MUST stay before :hover/:active below: all three resolve to the same specificity (0,2,0),
     so whichever is declared last always wins regardless of which states are actually active on
     the element. Declaring the static selected ring first lets the pointer-feedback rules below
     still read on top of it when a selected node is hovered or press-dragged. */
  [part='node'][data-selected] {
    outline: var(--lr-size-2px) solid
      var(--lr-flow-canvas-node-selected-outline-color, var(--lr-color-brand));
    outline-offset: var(--lr-size-2px);
    border-radius: var(--lr-radius);
  }
  [part='node']:hover {
    outline: var(--lr-size-1px) solid
      var(--lr-flow-canvas-node-hover-outline-color, var(--lr-color-border-strong));
    outline-offset: var(--lr-size-2px);
  }
  /* A node is pressed for two different gestures -- a click that selects it and a pointerdown that
     starts a drag -- and both need to read immediately. The pointer-feedback colour is shared with
     the hover rule above (one knob for "the pointer is on this node"); only the weight steps up, so
     the pressed ring is unmistakably heavier than the hovered one without introducing a second
     colour that would then have to stay in sync with it. */
  [part='node']:active {
    outline: var(--lr-size-2px) solid
      var(--lr-flow-canvas-node-hover-outline-color, var(--lr-color-border-strong));
    outline-offset: var(--lr-size-2px);
  }
  [part='edge']:hover {
    stroke-width: 2.5;
  }
  /* Stroke weight is the only channel an edge has: its stroke colour is the tone the consumer
     assigned it (see the [data-tone] rules above), so tinting it on press would read as a tone
     change rather than as feedback. 3.5 also clears the 2.5 an already-selected edge carries. */
  [part='edge']:active {
    stroke-width: 3.5;
  }
  [part='node']:has([part='node-control']:focus-visible),
  [part='edge']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
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
    animation: lr-flow-canvas-march var(--lr-flow-canvas-march-duration, var(--lr-duration-ambient)) linear infinite;
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
