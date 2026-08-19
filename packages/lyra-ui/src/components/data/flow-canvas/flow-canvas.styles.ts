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
    /* WCAG 2.5.8 floor: this element carries the pointer handlers, but its size comes from the
       consumer-authored slotted card, which the component cannot constrain. node-control, the one
       part that already had a floor, is sr-only -- a keyboard proxy no pointer can reach. 24px
       rather than the 40px --lr-icon-button-size: a node is an ordinary composite card, not a
       compact icon control, same as lr-media-card. */
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
  /* MUST stay before the :hover/:active rules below: all three are (0,2,0), so whichever is
     declared last wins regardless of the states actually active. The static selected ring first
     lets the pointer-feedback rules read on top of it when a selected node is hovered or
     press-dragged. */
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
  /* A node is pressed for two gestures -- a click that selects it and a pointerdown that starts a
     drag -- and both must read immediately. The colour is shared with the hover rule above (one
     knob for the pointer being on this node); only the weight steps up, so the press reads heavier
     without a second colour to keep in sync. */
  [part='node']:active {
    outline: var(--lr-size-2px) solid
      var(--lr-flow-canvas-node-hover-outline-color, var(--lr-color-border-strong));
    outline-offset: var(--lr-size-2px);
  }
  /* The selected edge's static weight. MUST stay above the :hover/:active rules below, the same
     ordering discipline as [part='node'][data-selected] above: this and [part='edge']:active are
     both (0,2,0) and both declare stroke-width, so source order alone settles them -- placed last
     it clamped the press's 3.5 back to 2.5. Only the bare :active arm was affected; the
     [part='edge-hit-area']:active + [part='edge'] arm is (0,3,0), three compound selectors, and
     out-ranked it either way, so the press still worked through the fat hit target. */
  [part='edge'][aria-pressed='true'] {
    stroke-width: 2.5;
  }
  /* The hit area is the wide transparent twin painted immediately before its edge, so it wins the
     hit test everywhere outside the drawn 1.5px stroke; without the sibling selector the edge lit
     only on the pixels it did not cover. Matching the selected rule's 2.5 is deliberate: hovering
     an already-selected edge is a no-op because there is nothing further to say, not masking. */
  [part='edge']:hover,
  [part='edge-hit-area']:hover + [part='edge'] {
    stroke-width: 2.5;
  }
  /* Stroke weight is the only channel an edge has: the stroke colour is the consumer's assigned
     tone (the [data-tone] rules above), so tinting on press would read as a tone change, not
     feedback. 3.5 also clears the 2.5 an already-selected edge carries, which it can only do from
     below that rule -- hence the ordering above. */
  [part='edge']:active,
  [part='edge-hit-area']:active + [part='edge'] {
    stroke-width: 3.5;
  }
  [part='node']:has([part='node-control']:focus-visible),
  [part='edge']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
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
  /* Declared after [part='viewport']:focus-visible at the same (0,2,0), so it takes the outline
     channel from the focus ring while an external drag is over the canvas. The drop target has no
     other channel, but that must not leave a keyboard user with no focus indicator, so the rule
     below re-draws the ring on a second channel -- same shape as lr-dashboard-grid's
     [part="cell"][data-collision] pair. */
  [part='viewport'][data-drop-active] {
    outline: var(--lr-size-2px) dashed var(--lr-flow-canvas-drop-active-outline-color, var(--lr-color-brand));
    outline-offset: calc(-1 * var(--lr-size-2px));
  }
  /* Inset like the viewport's own focus ring (negative outline-offset): the viewport fills the
     host, so a ring drawn outside its border box would be clipped by the host's overflow:
     hidden. */
  [part='viewport'][data-drop-active]:focus-visible {
    box-shadow: inset 0 0 0 var(--lr-focus-ring-width) var(--lr-focus-ring-color);
  }
  [part='edge'][data-running] {
    stroke-dasharray: 6 4;
    animation: lr-flow-canvas-march var(--lr-flow-canvas-march-duration, var(--lr-duration-ambient)) linear infinite;
  }
  [part='edge'][data-running-static] {
    stroke-dasharray: 6 4;
  }
  /* The JS gate evaluates the preference only at render time; this branch also covers a change
     while an already-rendered edge is still marching. */
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
