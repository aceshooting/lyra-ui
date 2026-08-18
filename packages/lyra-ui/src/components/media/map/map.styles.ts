import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    position: relative;
    inline-size: 100%;
    block-size: var(--lr-size-24rem);
  }
  [part='base'] {
    position: relative;
    inline-size: 100%;
    block-size: 100%;
  }
  lr-skeleton {
    --lr-skeleton-w: 100%;
    --lr-skeleton-h: 100%;
  }
  [part='container'] {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    overflow: hidden;
  }
  /* MapLibre creates these nodes inside the container above, hence inside this component's
     shadow root. Page-level peer CSS cannot reach them; the wrapper owns the layout and
     interaction rules for the MapLibre capabilities it exposes. */
  .maplibregl-canvas-container {
    inline-size: 100%;
    block-size: 100%;
  }
  .maplibregl-canvas {
    position: absolute;
    inset-block-start: 0;
    inset-inline-start: 0;
  }
  .maplibregl-canvas-container.maplibregl-interactive {
    cursor: grab;
    user-select: none;
  }
  .maplibregl-canvas-container.maplibregl-interactive:active {
    cursor: grabbing;
  }
  .maplibregl-canvas-container.maplibregl-touch-zoom-rotate,
  .maplibregl-canvas-container.maplibregl-touch-zoom-rotate .maplibregl-canvas {
    touch-action: pan-x pan-y;
  }
  .maplibregl-canvas-container.maplibregl-touch-drag-pan,
  .maplibregl-canvas-container.maplibregl-touch-drag-pan .maplibregl-canvas {
    touch-action: pinch-zoom;
  }
  .maplibregl-canvas-container.maplibregl-touch-zoom-rotate.maplibregl-touch-drag-pan,
  .maplibregl-canvas-container.maplibregl-touch-zoom-rotate.maplibregl-touch-drag-pan .maplibregl-canvas {
    touch-action: none;
  }
  .maplibregl-marker {
    position: absolute;
    inset-block-start: 0;
    inset-inline-start: 0;
    inline-size: max-content;
    min-inline-size: var(--lr-size-1-5rem);
    min-block-size: var(--lr-size-1-5rem);
    box-sizing: border-box;
    will-change: transform;
  }
  .maplibregl-popup {
    position: absolute;
    inset-block-start: 0;
    inset-inline-start: 0;
    z-index: var(--lr-layer-content);
    display: flex;
    will-change: transform;
    pointer-events: none;
    color: var(--lr-color-text);
    font-family: var(--lr-font);
    font-size: var(--lr-font-size-sm);
    line-height: var(--lr-line-height-normal);
  }
  .maplibregl-popup-anchor-top,
  .maplibregl-popup-anchor-top-left,
  .maplibregl-popup-anchor-top-right {
    flex-direction: column;
  }
  .maplibregl-popup-anchor-bottom,
  .maplibregl-popup-anchor-bottom-left,
  .maplibregl-popup-anchor-bottom-right {
    flex-direction: column-reverse;
  }
  /*
   * anchor-left/anchor-right are assigned by MapLibre at runtime from physical viewport
   * collision detection (which side of the map container has room for the popup relative to
   * the marker's screen position) -- they are not related to page text direction and must
   * never be re-mirrored for dir="rtl", or the popup's tip decouples from the marker it points
   * at.
   */
  .maplibregl-popup-anchor-left {
    flex-direction: row;
  }
  .maplibregl-popup-anchor-right {
    flex-direction: row-reverse;
  }
  .maplibregl-popup-tip {
    inline-size: 0;
    block-size: 0;
    border: var(--lr-size-0-625rem) solid transparent;
    z-index: var(--lr-layer-content);
  }
  .maplibregl-popup-anchor-top .maplibregl-popup-tip {
    align-self: center;
    border-block-start: none;
    border-block-end-color: var(--lr-color-surface-overlay);
  }
  .maplibregl-popup-anchor-top-left .maplibregl-popup-tip {
    align-self: flex-start;
    border-block-start: none;
    border-inline-start: none;
    border-block-end-color: var(--lr-color-surface-overlay);
  }
  .maplibregl-popup-anchor-top-right .maplibregl-popup-tip {
    align-self: flex-end;
    border-block-start: none;
    border-inline-end: none;
    border-block-end-color: var(--lr-color-surface-overlay);
  }
  .maplibregl-popup-anchor-bottom .maplibregl-popup-tip {
    align-self: center;
    border-block-end: none;
    border-block-start-color: var(--lr-color-surface-overlay);
  }
  .maplibregl-popup-anchor-bottom-left .maplibregl-popup-tip {
    align-self: flex-start;
    border-block-end: none;
    border-inline-start: none;
    border-block-start-color: var(--lr-color-surface-overlay);
  }
  .maplibregl-popup-anchor-bottom-right .maplibregl-popup-tip {
    align-self: flex-end;
    border-block-end: none;
    border-inline-end: none;
    border-block-start-color: var(--lr-color-surface-overlay);
  }
  .maplibregl-popup-anchor-left .maplibregl-popup-tip {
    align-self: center;
    border-inline-start: none;
    border-inline-end-color: var(--lr-color-surface-overlay);
  }
  .maplibregl-popup-anchor-right .maplibregl-popup-tip {
    align-self: center;
    border-inline-end: none;
    border-inline-start-color: var(--lr-color-surface-overlay);
  }
  .maplibregl-popup-content {
    position: relative;
    min-inline-size: var(--lr-icon-button-size);
    padding: var(--lr-space-m);
    padding-inline-end: calc(var(--lr-icon-button-size) + var(--lr-space-xs));
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface-overlay);
    box-shadow: var(--lr-shadow-m);
    pointer-events: auto;
    overflow-wrap: anywhere;
  }
  .maplibregl-popup-close-button {
    position: absolute;
    inset-block-start: 0;
    inset-inline-end: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: 0;
    border: 0;
    border-radius: var(--lr-radius);
    background: transparent;
    color: var(--lr-color-text-quiet);
    font: inherit;
    cursor: pointer;
  }
  .maplibregl-popup-close-button:where(:hover) {
    background: var(--lr-map-popup-close-button-hover-bg, var(--lr-color-brand-quiet));
    color: var(--lr-map-popup-close-button-hover-color, var(--lr-color-brand));
  }
  .maplibregl-popup-close-button:where(:active) {
    background: var(--lr-map-popup-close-button-active-bg, color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active)));
    color: var(--lr-map-popup-close-button-active-color, var(--lr-color-brand));
  }
  .maplibregl-popup-close-button:where(:focus-visible) {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-offset));
  }
  /* Mirrors docx-viewer.styles.ts's identical [part='error'] treatment for the same "optional
     peer dependency missing" failure shape. */
  [part='error'] {
    margin: 0;
    padding: var(--lr-space-l);
    color: var(--lr-color-danger);
    font-size: var(--lr-font-size-md-sm);
    text-align: center;
  }
  [part='legend'] {
    position: absolute;
    inset-block-end: var(--lr-space-s);
    inset-inline-start: var(--lr-space-s);
    z-index: var(--lr-layer-content);
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    max-inline-size: calc(100% - var(--lr-space-s) - var(--lr-space-s));
    max-block-size: calc(100% - var(--lr-space-s) - var(--lr-space-s));
    overflow: auto;
    box-sizing: border-box;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-xs) var(--lr-space-s);
    background: var(--lr-color-surface);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    /* Overlay step: the legend is a floating cluster pinned over the tiles, so it reads as a layer
       above the map rather than a panel resting beside it. */
    box-shadow: var(--lr-shadow-m);
    font-size: var(--lr-font-size-xs);
  }
  .legend-list {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
  }
  /* Continuous choropleth key: low caption, ramp bar, high caption on one row -- the same shape
     lr-heatmap's gradient legend uses, so the two components read alike. */
  .legend-gradient {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
  }
  .legend-gradient .gradient-bar {
    flex: 1 1 var(--lr-size-6rem);
    min-inline-size: 0;
    block-size: var(--lr-size-0-5rem);
    border-radius: var(--lr-size-2px);
  }
  [part='legend-lo'],
  [part='legend-hi'] {
    flex: 0 0 auto;
    white-space: nowrap;
  }
  /* Flex row order already follows inherited direction, putting the low caption at inline-start.
     Mirror the physical gradient so its colors stay aligned with those captions -- same fix, and
     same reasoning, as lr-heatmap's own RTL rule. */
  :host(:dir(rtl)) .legend-gradient .gradient-bar {
    transform: scaleX(-1);
  }
  .legend-row {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
  }
  .legend-row > span:last-child {
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  [part='legend-swatch'] {
    position: relative;
    overflow: hidden;
    inline-size: var(--lr-size-0-75rem);
    block-size: var(--lr-size-0-75rem);
    box-sizing: border-box;
    border: var(--lr-border-width-thin) solid currentColor;
    border-radius: var(--lr-size-2px);
    flex: 0 0 auto;
  }
  [part='legend-swatch'][data-pattern='diagonal'] {
    border-style: dashed;
  }
  [part='legend-swatch'][data-pattern='dots'] {
    border-style: dotted;
    border-radius: 50%;
  }
  [part='legend-swatch'][data-pattern='crosshatch'] {
    border-style: double;
    border-radius: 0;
  }
  [part='legend-swatch'][data-pattern='diagonal']::before,
  [part='legend-swatch'][data-pattern='crosshatch']::before,
  [part='legend-swatch'][data-pattern='crosshatch']::after,
  [part='legend-swatch'][data-pattern='dots']::before {
    content: '';
    position: absolute;
    inset-block-start: 50%;
    inset-inline-start: 50%;
    inline-size: 150%;
    block-size: var(--lr-border-width-thin);
    background: currentColor;
    transform: translate(-50%, -50%) rotate(-45deg);
  }
  [part='legend-swatch'][data-pattern='crosshatch']::after {
    transform: translate(-50%, -50%) rotate(45deg);
  }
  [part='legend-swatch'][data-pattern='dots']::before {
    inline-size: var(--lr-size-2px);
    block-size: var(--lr-size-2px);
    border-radius: 50%;
    transform: translate(-50%, -50%);
  }
  [part='legend-limit'] {
    min-inline-size: 0;
    padding-block-start: var(--lr-space-xs);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
    color: var(--lr-color-text-quiet);
    overflow-wrap: anywhere;
  }

  /* MapLibre's attribution control is generated in the same shadow-local container. Keep it
     anchored over the map and use Lyra's own surface, typography, and interaction tokens. */
  .maplibregl-ctrl-top-left,
  .maplibregl-ctrl-top-right,
  .maplibregl-ctrl-bottom-left,
  .maplibregl-ctrl-bottom-right {
    position: absolute;
    z-index: var(--lr-layer-content);
    pointer-events: none;
  }
  .maplibregl-ctrl-top-left {
    inset-block-start: 0;
    inset-inline-start: 0;
  }
  .maplibregl-ctrl-top-right {
    inset-block-start: 0;
    inset-inline-end: 0;
  }
  .maplibregl-ctrl-bottom-left {
    inset-block-end: 0;
    inset-inline-start: 0;
  }
  .maplibregl-ctrl-bottom-right {
    inset-block-end: 0;
    inset-inline-end: 0;
  }
  .maplibregl-ctrl {
    margin: var(--lr-space-xs);
    pointer-events: auto;
    transform: translate(0);
  }
  .maplibregl-ctrl-attrib {
    padding: 0 var(--lr-space-xs);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
  }
  .maplibregl-ctrl-attrib a {
    color: var(--lr-color-text-quiet);
    text-decoration: none;
  }
  .maplibregl-ctrl-attrib a:hover {
    text-decoration: underline;
  }
  .maplibregl-ctrl-attrib-inner {
    overflow-wrap: anywhere;
  }
  .maplibregl-ctrl-attrib-button {
    display: none;
    position: absolute;
    inset-block-start: 0;
    inset-inline-end: 0;
    inline-size: var(--lr-icon-button-size);
    block-size: var(--lr-icon-button-size);
    padding: 0;
    border: 0;
    border-radius: var(--lr-radius-pill);
    background: transparent;
    color: var(--lr-color-text);
    cursor: pointer;
  }
  .maplibregl-ctrl-attrib.maplibregl-compact {
    position: relative;
    min-block-size: var(--lr-icon-button-size);
    padding-inline-end: var(--lr-icon-button-size);
  }
  .maplibregl-ctrl-attrib.maplibregl-compact .maplibregl-ctrl-attrib-inner {
    display: none;
  }
  .maplibregl-ctrl-attrib.maplibregl-compact .maplibregl-ctrl-attrib-button,
  .maplibregl-ctrl-attrib.maplibregl-compact-show .maplibregl-ctrl-attrib-inner {
    display: block;
  }
  .maplibregl-ctrl-attrib-button:hover,
  .maplibregl-ctrl-attrib-button:active {
    background: var(--lr-color-brand-quiet);
  }
  .maplibregl-ctrl-attrib-button:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-offset));
  }
  /* Remove the native <summary> disclosure marker (the stray "▼") on the compact-toggle button. */
  .maplibregl-ctrl-attrib summary {
    list-style: none;
    appearance: none;
    -webkit-appearance: none;
  }
  .maplibregl-ctrl-attrib summary::-webkit-details-marker {
    display: none;
  }
  .maplibregl-ctrl-attrib summary::marker {
    content: '';
  }

  @media (forced-colors: active) {
    [part='legend-swatch'] {
      background: Canvas !important;
      border-color: CanvasText;
      color: CanvasText;
    }
    [part='legend-swatch'][data-pattern='solid'] {
      background: CanvasText !important;
    }
  }
`;
