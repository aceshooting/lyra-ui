import { focusRing } from '../../../internal/interactive-control.styles.js';
import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    /* --_lr-graph-requested-height is written from the normalized height property (see
       willUpdate()) -- a private fallback so an author-set --lr-canvas-reserved-height still wins,
       exactly like --_lr-chart-height beneath --lr-chart-height in chart.styles.ts. */
    block-size: var(
      --lr-canvas-reserved-height,
      var(--_lr-graph-requested-height, var(--lr-size-24rem))
    );
  }
  .source-layout {
    display: flex;
    flex-direction: column;
    block-size: 100%;
    min-inline-size: 0;
    min-block-size: 0;
  }
  .source-diagram { flex: 1 1 50%; min-block-size: 0; }
  [part="source-navigator"] {
    flex: 0 1 50%;
    min-block-size: 0;
    min-inline-size: 0;
    overflow: auto;
    padding: var(--lr-space-s);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  .source-list [part="source-navigator"] { flex: 1 1 auto; }
  .source-toolbar { display: flex; flex-wrap: wrap; gap: var(--lr-space-s); }
  .source-toolbar input { flex: 1 1 auto; min-inline-size: 0; }
  .source-rows { list-style: none; padding: 0; margin-block: var(--lr-space-s); }
  .source-rows li { display: flex; flex-wrap: wrap; gap: var(--lr-space-xs); margin-block: var(--lr-space-xs); }
  [part="source-navigator"] :where(button, input, select), [part="source-status"] button {
    --_lr-source-fill: var(--lr-color-neutral-fill-quiet);
    min-block-size: var(--lr-icon-button-size);
    min-inline-size: var(--lr-icon-button-size);
    max-inline-size: 100%;
    padding: var(--lr-space-xs) var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-xs);
    font: inherit;
    color: var(--lr-color-text);
    background: var(--_lr-source-fill);
    transition: var(--lr-transition-interactive);
    overflow-wrap: anywhere;
  }
  [part~="source-row"] { flex: 1 1 auto; text-align: start; }
  [part~="source-row"]:where([aria-pressed="true"]) { --_lr-source-fill: var(--lr-color-brand-fill-quiet); }
  [part="source-navigator"] button, [part="source-status"] button { cursor: pointer; }
  [part="source-navigator"] :where(button, input, select):hover, [part="source-status"] button:hover {
    background: color-mix(in oklab, var(--_lr-source-fill), var(--lr-color-mix-partner) var(--lr-color-mix-hover));
  }
  [part="source-navigator"] button:active, [part="source-status"] button:active {
    background: color-mix(in oklab, var(--_lr-source-fill), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part="source-navigator"] :where(button, input, select):focus-visible, [part="source-status"] button:focus-visible { ${focusRing} }
  [part="source-status"], [part="source-coverage"] { overflow-wrap: anywhere; margin-block: var(--lr-space-s); }
  [part="base"] {
    position: relative;
    inline-size: 100%;
    block-size: 100%;
  }
  .spatial-base {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    overflow: hidden;
  }
  [part="spatial-toolbar"],
  [part="spatial-pagination"] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-s);
    padding: var(--lr-space-s);
  }
  [part="spatial-control"],
  [part="spatial-list-item"] {
    --_lr-spatial-fill: var(--lr-color-neutral-fill-quiet);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: var(--lr-space-s) var(--lr-space-m);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-xs);
    background: var(--_lr-spatial-fill);
    color: var(--lr-color-text);
    font: inherit;
    cursor: pointer;
    transition: var(--lr-transition-interactive);
    overflow-wrap: anywhere;
  }
  [part="spatial-control"]:where([aria-pressed="true"]),
  [part="spatial-list-item"]:where([aria-pressed="true"], [aria-current="true"]) {
    --_lr-spatial-fill: var(--lr-color-brand-fill-quiet);
  }
  [part="spatial-control"]:hover:where(:not(:disabled)),
  [part="spatial-list-item"]:hover {
    background: color-mix(in oklab, var(--_lr-spatial-fill), var(--lr-color-mix-partner) var(--lr-color-mix-hover));
  }
  [part="spatial-control"]:active:where(:not(:disabled)),
  [part="spatial-list-item"]:active {
    background: color-mix(in oklab, var(--_lr-spatial-fill), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part="spatial-control"]:focus-visible,
  [part="spatial-list-item"]:focus-visible,
  [part="spatial-canvas"]:focus-visible {
    ${focusRing}
  }
  [part="spatial-control"]:disabled {
    cursor: default;
    opacity: var(--lr-opacity-disabled);
  }
  [part="spatial-instructions"],
  [part="spatial-page-count"] {
    margin: 0;
    padding: var(--lr-space-s);
    font-size: var(--lr-font-size-sm);
    overflow-wrap: anywhere;
  }
  [part="spatial-canvas"] {
    min-inline-size: var(--lr-icon-button-size);
    display: block;
    flex: 1 1 auto;
    inline-size: 100%;
    block-size: 0;
    min-block-size: var(--lr-icon-button-size);
    touch-action: none;
    transition: var(--lr-transition-interactive);
  }
  .webgl-surface { position: relative; }
  .webgl-surface[hidden] { display: none; }
  [data-graph-labels] { position: absolute; inset: 0; inline-size: 100%; block-size: 100%; pointer-events: none; }
  [part="spatial-list"] {
    min-block-size: 0;
    overflow: auto;
    padding: var(--lr-space-s);
  }
  [part="spatial-list"] ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  [part="spatial-list-item"] {
    inline-size: 100%;
    text-align: start;
    margin-block-end: var(--lr-space-xs);
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
    transition: background-color var(--lr-transition-fast);
  }
  [part="canvas"]:focus-visible {
    ${focusRing}
  }
  /* A background wash on the canvas box, not filter: brightness(). A filter applies to the element's
     own painted output, so it re-tinted every drawn node, link and label, and multiplied nothing on
     a pure-white or pure-black one. The canvas is transparent wherever nothing is drawn, so a
     background tints only the empty plot area.

     no-pressed-state: both d3-zoom and the spatial camera bind pan/drag to their canvas, so a
     pressed wash would sit under the whole graph for the entire gesture and dim the data being
     moved into view; a press also lands on a painted node, which cannot carry DOM :active. */
  [part="canvas"]:hover,
  [part="spatial-canvas"]:hover {
    background: color-mix(
      in oklab,
      transparent,
      var(--lr-color-mix-partner) var(--lr-color-mix-hover)
    );
  }
  [part="tooltip"] {
    position: absolute;
    /* Physical left/top on purpose: the inline position written on hover is a physical offset from
       getBoundingClientRect() targeting these same properties. A logical inset-inline-start would
       compute to right under RTL, pinning both edges and stretching the box. */
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
    border: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
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
    stroke: var(--lr-graph-edge-color, var(--lr-color-border));
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
  /* This part's color is per-instance and data-driven (--lr-graph-edge-color,
     --lr-graph-node-fill, --lr-graph-hull-fill), so no single hardcoded hover color works -- and
     neither did filter: brightness(), which multiplies every channel: it lightened a dark stroke,
     did nothing on a pure-white or pure-black one, and, being a filter, re-tinted the arrowhead
     marker painted from the same stroke. Mixing that same custom property toward
     --lr-color-mix-partner keeps the per-instance color and always moves in the direction
     needed. */
  [part="link"]:hover {
    stroke: color-mix(
      in oklab,
      var(--lr-graph-edge-color, var(--lr-color-border)),
      var(--lr-color-mix-partner) var(--lr-color-mix-hover)
    );
  }
  [part="link"]:active {
    stroke: color-mix(
      in oklab,
      var(--lr-graph-edge-color, var(--lr-color-border)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part="arrowhead"] {
    fill: context-stroke;
  }
  [part="link"]:focus-visible {
    ${focusRing}
  }
  [part="link"][data-dangling] {
    stroke-dasharray: var(--lr-size-2px) var(--lr-size-2px);
    opacity: var(--lr-opacity-disabled);
  }
  [part="node"] {
    /* --lr-graph-node-fill is set inline per node (see graph.ts) from LyraGraphNode.color, falling
       back to the brand token. An inline style declaration
       always wins the cascade over this selector, so fill has to be set here, not via the
       presentation attribute, for a per-node color to apply. */
    fill: var(--lr-graph-node-fill, var(--lr-color-brand));
    cursor: pointer;
  }
  [part="node"]:hover {
    fill: color-mix(
      in oklab,
      var(--lr-graph-node-fill, var(--lr-color-brand)),
      var(--lr-color-mix-partner) var(--lr-color-mix-hover)
    );
  }
  [part="node"]:active {
    fill: color-mix(
      in oklab,
      var(--lr-graph-node-fill, var(--lr-color-brand)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part="node"]:focus-visible {
    ${focusRing}
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
    stroke-width: var(--lr-border-width-thick);
  }
  g[data-edge-labels-hidden] [part="link-label"],
  g[data-edge-labels-hidden] [part="community-label"] {
    display: none;
  }
  g[data-node-labels-hidden] [part="label"] {
    display: none;
  }
  [part="empty"] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-md-sm);
  }
  /* Mirrors map.styles.ts's identical [part='error'] treatment for the same
     missing-optional-peer-dependency failure shape. */
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
    stroke-width: var(--lr-border-width-thin);
  }
  [part="expand-indicator"] path {
    stroke: var(--lr-color-text);
    stroke-width: var(--lr-border-width-thin);
    fill: none;
  }
  [part="focus-halo"] {
    fill: none;
    stroke: var(--lr-graph-focus-halo-color, var(--lr-color-brand));
    stroke-width: var(--lr-border-width-medium);
    pointer-events: none;
  }
  [part="node"][data-selected] {
    stroke: var(--lr-graph-selected-color, var(--lr-color-success));
    stroke-width: var(--lr-border-width-medium);
  }
  [part="link"][data-selected] {
    stroke: var(--lr-graph-selected-color, var(--lr-color-success)) !important;
    stroke-width: var(--lr-border-width-thick);
  }
  [part="link"][data-selected]:hover {
    stroke: color-mix(
      in oklab,
      var(--lr-graph-selected-color, var(--lr-color-success)),
      var(--lr-color-mix-partner) var(--lr-color-mix-hover)
    ) !important;
  }
  [part="link"][data-selected]:active {
    stroke: color-mix(
      in oklab,
      var(--lr-graph-selected-color, var(--lr-color-success)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    ) !important;
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
    ${focusRing}
  }
  [part="community-label"] {
    font-size: var(--lr-font-size-2xs);
    fill: var(--lr-color-text);
    font-family: var(--lr-font);
    text-anchor: middle;
    pointer-events: none;
    paint-order: stroke;
    stroke: var(--lr-graph-edge-label-halo, var(--lr-color-surface));
    stroke-width: var(--lr-border-width-thick);
  }
`;
