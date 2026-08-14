import { css } from "lit";

export const styles = css`
  :host {
    display: block;
  }
  [part="base"] {
    position: relative;
    inline-size: 100%;
    block-size: 100%;
  }
  svg {
    display: block;
    inline-size: 100%;
    block-size: 100%;
  }
  [part="canvas"] {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    touch-action: none;
  }
  [part="canvas"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* A background wash on the canvas box rather than filter: brightness(). A filter applies to the
     element's own painted output, so it re-tinted every drawn node, link and label the renderer had
     just computed -- and multiplied nothing at all on a pure-white or pure-black one. The canvas is
     cleared to transparent wherever nothing is drawn, so a background tints only the empty plot
     area and leaves the drawn scene exactly as rendered.

     no-pressed-state: this canvas is the surface d3-zoom binds its pan/drag to, so a pressed wash
     would sit under the whole graph for the entire duration of a pan and dim the very data the user
     is dragging into view; a press here also lands on a painted node, which is not a DOM element and
     cannot carry :active at all. The hover tint alone confirms the surface is live. */
  [part="canvas"]:hover {
    background: color-mix(
      in oklab,
      transparent,
      var(--lr-color-mix-partner) var(--lr-color-mix-hover)
    );
  }
  [part="tooltip"] {
    position: absolute;
    /* Physical left/top on purpose: the inline position written on hover is a physical offset
       derived from getBoundingClientRect(), and it targets these same physical properties. A
       logical inset-inline-start would compute to right under RTL, leaving both edges pinned
       (stretching the box) once the inline left lands on top of it. */
    /* policy-allow(physical-css): must match the physical style.left the hover positioner writes. */
    left: 0;
    top: 0;
    pointer-events: none;
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-2xs);
    font-family: var(--lr-font);
    padding-block: var(--lr-size-2px);
    padding-inline: var(--lr-size-6px);
    border-radius: var(--lr-radius-xs);
    border: var(--lr-size-1px) solid var(--lr-color-border);
    z-index: var(--lr-layer-content);
    transform: translate(var(--lr-size-6px), calc(-100% - var(--lr-size-6px)));
    max-inline-size: min(
      calc(100% - var(--lr-size-0-75rem)),
      calc(100vw - var(--lr-size-0-75rem))
    );
    overflow-wrap: anywhere;
    white-space: normal;
  }
  [part="tooltip"][hidden] {
    display: none;
  }
  [part="link"] {
    stroke: var(--lr-link-color, var(--lr-color-border));
    fill: none;
    cursor: pointer;
  }
  [data-hit-area] {
    fill: none;
    /* WebKit excludes a fully transparent SVG stroke from native pointer targeting. */
    stroke: var(--lr-color-text);
    stroke-opacity: 0.001;
    stroke-width: calc(
      var(--lr-size-24px) * var(--_lr-graph-hit-area-scale, 1)
    );
    cursor: pointer;
  }
  [data-hit-area="node"],
  [data-hit-area="link"] {
    stroke-linecap: round;
    pointer-events: stroke;
  }
  [data-hit-area="hull"] {
    fill: transparent;
    stroke-linecap: round;
    stroke-linejoin: round;
    pointer-events: all;
  }
  /* This part's own color is per-instance/data-driven (--lr-link-color, --lr-node-fill,
     --lr-graph-hull-fill), so a single hardcoded hover color can't work across every value it might
     take -- but neither could filter: brightness(), which multiplies every channel and so lightens a
     dark stroke, darkens nothing at all on a pure-white or pure-black one, and (being a filter)
     re-tinted the arrowhead marker painted from the same stroke. Mixing the very same custom
     property toward --lr-color-mix-partner keeps the per-instance color and always moves, in the
     direction the surface actually needs. */
  [part="link"]:hover {
    stroke: color-mix(
      in oklab,
      var(--lr-link-color, var(--lr-color-border)),
      var(--lr-color-mix-partner) var(--lr-color-mix-hover)
    );
  }
  [part="link"]:active {
    stroke: color-mix(
      in oklab,
      var(--lr-link-color, var(--lr-color-border)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part="arrowhead"] {
    fill: context-stroke;
  }
  [part="link"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part="link"][data-dangling] {
    stroke-dasharray: var(--lr-size-2px) var(--lr-size-2px);
    opacity: var(--lr-opacity-disabled);
  }
  [part="node"] {
    /* --lr-node-fill is set inline per-node (see graph.ts) from LyraGraphNode.color;
       falls back to the brand token when a node doesn't supply one. An inline
       style declaration always wins the cascade over this selector, so setting
       fill directly here (rather than via the presentation attribute) is what
       lets a per-node color actually take effect. */
    fill: var(--lr-node-fill, var(--lr-color-brand));
    cursor: pointer;
  }
  [part="node"]:hover {
    fill: color-mix(
      in oklab,
      var(--lr-node-fill, var(--lr-color-brand)),
      var(--lr-color-mix-partner) var(--lr-color-mix-hover)
    );
  }
  [part="node"]:active {
    fill: color-mix(
      in oklab,
      var(--lr-node-fill, var(--lr-color-brand)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part="node"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part="label"] {
    font-size: var(--lr-font-size-2xs);
    fill: var(--lr-color-text);
    font-family: var(--lr-font);
    pointer-events: none;
  }
  [part="link-label"] {
    font-size: var(--lr-font-size-2xs);
    fill: var(--lr-color-text);
    font-family: var(--lr-font);
    pointer-events: none;
    paint-order: stroke;
    stroke: var(--lr-graph-edge-label-halo, var(--lr-color-surface));
    stroke-width: var(--lr-size-3px);
  }
  g[data-edge-labels-hidden] [part="link-label"],
  g[data-edge-labels-hidden] [part="community-label"] {
    display: none;
  }
  [part="empty"] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-md-sm);
  }
  /* Mirrors map.styles.ts's identical [part='error'] treatment for the same "optional
     peer dependency missing" failure shape. */
  [part="error"] {
    margin: 0;
    padding: var(--lr-space-l);
    color: var(--lr-color-danger);
    font-size: var(--lr-font-size-md-sm);
    text-align: center;
  }
  [part="expand-indicator"] circle {
    fill: var(--lr-color-surface);
    stroke: var(--lr-color-border-strong);
    stroke-width: var(--lr-size-1px);
  }
  [part="expand-indicator"] path {
    stroke: var(--lr-color-text);
    stroke-width: var(--lr-size-1px);
    fill: none;
  }
  [part="focus-halo"] {
    fill: none;
    stroke: var(--lr-graph-focus-halo-color, var(--lr-color-brand));
    stroke-width: var(--lr-size-2px);
    pointer-events: none;
  }
  [part="node"][data-selected] {
    stroke: var(--lr-graph-selected-color, var(--lr-color-success));
    stroke-width: var(--lr-size-2px);
  }
  [part="link"][data-selected] {
    stroke: var(--lr-graph-selected-color, var(--lr-color-success)) !important;
    stroke-width: var(--lr-size-3px);
  }
  [part="node"][data-dimmed] {
    opacity: var(--lr-graph-dimmed-opacity, 0.35);
  }
  [part="link"][data-dimmed] {
    opacity: var(--lr-graph-dimmed-opacity, 0.35);
  }
  [data-hit-area="link"][data-inert] {
    pointer-events: none;
  }
  [part="hull"] {
    fill: var(--lr-graph-hull-fill, var(--lr-color-brand));
    stroke: var(--lr-graph-hull-fill, var(--lr-color-brand));
    stroke-width: calc(var(--lr-size-24px) * 2);
    stroke-linejoin: round;
    stroke-linecap: round;
    opacity: var(--lr-graph-hull-opacity, 0.12);
    cursor: pointer;
  }
  [part="hull"]:hover {
    fill: color-mix(
      in oklab,
      var(--lr-graph-hull-fill, var(--lr-color-brand)),
      var(--lr-color-mix-partner) var(--lr-color-mix-hover)
    );
    stroke: color-mix(
      in oklab,
      var(--lr-graph-hull-fill, var(--lr-color-brand)),
      var(--lr-color-mix-partner) var(--lr-color-mix-hover)
    );
  }
  [part="hull"]:active {
    fill: color-mix(
      in oklab,
      var(--lr-graph-hull-fill, var(--lr-color-brand)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
    stroke: color-mix(
      in oklab,
      var(--lr-graph-hull-fill, var(--lr-color-brand)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part="hull"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part="community-label"] {
    font-size: var(--lr-font-size-2xs);
    fill: var(--lr-color-text);
    font-family: var(--lr-font);
    text-anchor: middle;
    pointer-events: none;
    paint-order: stroke;
    stroke: var(--lr-graph-edge-label-halo, var(--lr-color-surface));
    stroke-width: var(--lr-size-3px);
  }
`;
