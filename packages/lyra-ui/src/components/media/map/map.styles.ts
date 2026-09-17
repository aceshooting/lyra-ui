import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    position: relative;
    inline-size: 100%;
    block-size: var(--lr-map-height, var(--lr-size-24rem));
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
  /* MapLibre creates these nodes inside the container above, so inside this shadow root: page-level
     peer CSS cannot reach them, and the wrapper owns their layout and interaction rules. */
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
    top: 0;
    /* policy-allow(physical-css): MapLibre projects marker transforms from the canvas top-left. */
    left: 0;
    inline-size: max-content;
    min-inline-size: var(--lr-size-1-5rem);
    min-block-size: var(--lr-size-1-5rem);
    box-sizing: border-box;
    will-change: transform;
  }
  /* Interactive markers get role="button"/tabindex in configureMarkerInteraction() -- filter
     (not transform, which MapLibre owns inline for positioning) and outline keep the hover/focus
     affordance from fighting the marker's own placement. */
  .maplibregl-marker[role='button'] {
    cursor: pointer;
  }
  .maplibregl-marker[role='button']:hover {
    filter: brightness(0.9);
  }
  .maplibregl-marker[role='button']:focus-visible {
    outline: var(--lr-focus-ring);
    outline-offset: calc(-1 * var(--lr-focus-ring-offset));
  }
  .maplibregl-popup {
    position: absolute;
    top: 0;
    /* policy-allow(physical-css): popup transforms share the peer's physical projection origin. */
    left: 0;
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
   * anchor-left/anchor-right are assigned by MapLibre at runtime from physical viewport collision
   * detection -- which side of the container has room for the popup -- not page text direction, and
   * must never be re-mirrored for dir="rtl", or the popup's tip decouples from its marker.
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
    transition: background-color var(--lr-transition-fast), color var(--lr-transition-fast);
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
    outline: var(--lr-focus-ring);
    outline-offset: calc(-1 * var(--lr-focus-ring-offset));
  }
  /* Mirrors docx-viewer.styles.ts's identical [part='error'] treatment for the same
     missing-optional-peer-dependency failure shape. */
  [part='error'] {
    margin: 0;
    padding: var(--lr-space-l);
    color: var(--lr-color-danger);
    font-size: var(--lr-font-size-md-sm);
    text-align: center;
  }
  [part='legend'] {
    position: absolute;
    inset-block-end: calc(var(--lr-space-s) + var(--_lr-map-controls-bottom, calc(var(--lr-space-xs) * 0)));
    inset-inline-start: var(--lr-space-s);
    z-index: var(--lr-layer-content);
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    max-inline-size: calc(100% - var(--lr-space-s) - var(--lr-space-s));
    max-block-size: calc(100% - var(--lr-space-s) - var(--lr-space-s) - var(--_lr-map-controls-bottom, calc(var(--lr-space-xs) * 0)) - var(--_lr-map-controls-top, calc(var(--lr-space-xs) * 0)));
    overflow: auto;
    box-sizing: border-box;
    gap: var(--lr-space-xs);
    padding: var(--lr-space-xs) var(--lr-space-s);
    background: var(--lr-color-surface);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    /* The legend is pinned over the tiles, so it reads as a layer above the map, not a panel
       beside it. */
    box-shadow: var(--lr-shadow-m);
    font-size: var(--lr-font-size-xs);
  }
  .legend-list {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
  }
  /* A collapsed panel hides its gradient, rows, limit summary and trailing slot with the plain
     hidden attribute -- but every one of those carries an author display declaration above,
     which outranks the UA sheet's own [hidden] rule. This descendant selector restores the
     platform meaning at author specificity, so hidden keeps removing the subtree from layout,
     from the accessibility tree and from the tab order rather than being silently ignored. */
  [part='legend'] [hidden] {
    display: none;
  }
  /* The whole-panel disclosure rendered by legendCollapsible. A native button, so Enter/Space
     are the platform's own activation; its visible localized text is its accessible name and
     aria-expanded carries the state, so the chevron stays decorative. */
  button[part='legend-disclosure'] {
    display: flex;
    align-items: center;
    align-self: flex-start;
    gap: var(--lr-space-xs);
    box-sizing: border-box;
    /* WCAG 2.5.8, matching the interactive legend rows above. */
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    min-width: 0;
    max-inline-size: 100%;
    border: none;
    border-radius: var(--lr-radius-xs);
    padding: var(--lr-size-2px) var(--lr-space-xs);
    background: transparent;
    color: inherit;
    font: inherit;
    font-weight: var(--lr-font-weight-semibold);
    text-align: start;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: var(--lr-transition-interactive);
  }
  button[part='legend-disclosure'] > span:last-child {
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  button[part='legend-disclosure']:where(:hover) {
    background: color-mix(in srgb, var(--lr-color-text) 8%, transparent);
  }
  button[part='legend-disclosure']:where(:active) {
    background: color-mix(in oklab, var(--lr-color-text-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  button[part='legend-disclosure']:where(:focus-visible) {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* The shared icon set ships one right-pointing chevron and asks callers to rotate the WRAPPING
     part, never the svg. Collapsed points along the reading direction; expanded points down in
     both directions. --lr-transition-fast collapses to ~0ms under prefers-reduced-motion in
     tokens.styles.ts, so the rotation needs no separate media query here. */
  [part='legend-disclosure-icon'] {
    display: inline-flex;
    flex: 0 0 auto;
    transition: transform var(--lr-transition-fast);
  }
  :host(:dir(rtl)) [part='legend-disclosure-icon'] {
    transform: rotate(180deg);
  }
  button[part='legend-disclosure'][aria-expanded='true'] [part='legend-disclosure-icon'],
  :host(:dir(rtl)) button[part='legend-disclosure'][aria-expanded='true'] [part='legend-disclosure-icon'] {
    transform: rotate(90deg);
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
    inline-size: var(--lr-size-6rem);
    min-inline-size: 0;
    block-size: var(--lr-size-0-5rem);
    border-radius: var(--lr-size-2px);
  }
  [part='legend-lo'],
  [part='legend-hi'] {
    flex: 0 0 auto;
    white-space: nowrap;
  }
  /* Flex row order already follows inherited direction, putting the low caption at inline-start, so
     the physical gradient mirrors to keep its colors aligned -- same fix as lr-heatmap's RTL rule.
     */
  :host(:dir(rtl)) .legend-gradient .gradient-bar {
    transform: scaleX(-1);
  }
  /* One consecutive run of rows sharing a group. Stacked like the list itself so a section reads
     as a slice of the same key rather than a separate panel; the heading carries the name. */
  .legend-group,
  .legend-section-list {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
  }
  [part='legend-group-heading'] {
    min-inline-size: 0;
    color: var(--lr-color-text-quiet);
    font-weight: var(--lr-font-weight-semibold);
    overflow-wrap: anywhere;
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
  /* The opt-in interactive legend row. A native button, so Enter/Space are the platform's own
     activation and no roving tabindex is involved. Every declaration is logical, so the row keeps
     its swatch at the inline start under RTL. */
  button[part~='legend-toggle'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    box-sizing: border-box;
    /* WCAG 2.5.8: a legend row is ~18px tall on its own, so the toggle carries the shared
       icon-button floor in both axes. The panel's own max-block-size + overflow:auto above
       contains the taller list. */
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    min-width: 0;
    max-inline-size: 100%;
    border: none;
    border-radius: var(--lr-radius-xs);
    padding: var(--lr-size-2px) var(--lr-space-xs);
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: var(--lr-transition-interactive);
  }
  button[part~='legend-toggle'] > span:last-child {
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  button[part~='legend-toggle']:where(:hover) {
    background: color-mix(in srgb, var(--lr-color-text) 8%, transparent);
  }
  button[part~='legend-toggle']:where(:active) {
    background: color-mix(in oklab, var(--lr-color-text-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  button[part~='legend-toggle']:where(:focus-visible) {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* Opacity dims only the decorative, aria-hidden swatch; the label re-colors through the quiet
     text token instead. Opacity on the whole button would drop the label below 4.5:1. */
  button[part~='legend-toggle-hidden'] [part='legend-swatch'] {
    opacity: var(--lr-map-legend-hidden-swatch-opacity, 0.5);
  }
  button[part~='legend-toggle-hidden'] > span:last-child {
    color: var(--lr-color-text-quiet);
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
  /* A row carrying a glyph paints the shape itself in the entry color, so the solid block and the
     pattern overlay would both sit on top of the thing they are meant to identify. The pattern
     BORDER does not sit on top of it: it frames the swatch, so it stays, and a glyph row keeps the
     same solid/dashed/dotted/double edge a color-only row carries. That edge is the only non-color
     differentiator left once forced colors collapse every authored color to one system color, and
     two rows may legitimately share one glyph and differ only by category color.
     Only the radius is dropped: the dots pattern rounds the swatch to a circle, and this swatch
     clips its contents, so that radius would shave the corners off the very shape it frames.
     The extra [data-pattern] qualifier is what wins that radius, rather than source order --
     [data-pattern='dots'] sets it at otherwise equal specificity. */
  [part='legend-swatch'][data-pattern][data-icon='true'] {
    inline-size: var(--lr-size-1rem);
    block-size: var(--lr-size-1rem);
    border-radius: 0;
    background: none;
  }
  [part='legend-swatch'][data-icon='true']::before,
  [part='legend-swatch'][data-icon='true']::after {
    content: none;
  }
  .legend-icon {
    display: block;
    inline-size: 100%;
    block-size: 100%;
  }
  [part='legend-limit'] {
    min-inline-size: 0;
    padding-block-start: var(--lr-space-xs);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
    color: var(--lr-color-text-quiet);
    overflow-wrap: anywhere;
  }

  /* MapLibre's attribution control is generated in the same shadow-local container: anchored over
     the map, on Lyra's own surface, typography, and interaction tokens. */
  .maplibregl-ctrl-top-left,
  .maplibregl-ctrl-top-right,
  .maplibregl-ctrl-bottom-left,
  .maplibregl-ctrl-bottom-right {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    max-inline-size: 100%;
    z-index: var(--lr-layer-content);
    pointer-events: none;
  }
  .maplibregl-ctrl-top-right,
  .maplibregl-ctrl-bottom-right {
    align-items: flex-end;
  }
  /* Opposing occupied corners each retain usable space when attribution expands. */
  .maplibregl-control-container:where(:has(.maplibregl-ctrl-top-left:not(:empty))):where(:has(.maplibregl-ctrl-top-right:not(:empty))) :where(.maplibregl-ctrl-top-left, .maplibregl-ctrl-top-right),
  .maplibregl-control-container:where(:has(.maplibregl-ctrl-bottom-left:not(:empty))):where(:has(.maplibregl-ctrl-bottom-right:not(:empty))) :where(.maplibregl-ctrl-bottom-left, .maplibregl-ctrl-bottom-right) {
    max-inline-size: 50%;
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
    box-sizing: border-box;
    max-inline-size: calc(100% - 2 * var(--lr-space-xs));
    flex-shrink: 0;
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
  .maplibregl-ctrl-group {
    display: flex;
    flex-direction: column;
    inline-size: fit-content;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    box-shadow: var(--lr-shadow);
    color: var(--lr-color-text);
  }
  .maplibregl-ctrl-group button {
    display: grid;
    place-items: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: var(--lr-space-xs);
    border: 0;
    border-radius: inherit;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
    transition: background-color var(--lr-transition-fast), color var(--lr-transition-fast);
  }
  .maplibregl-ctrl-group button:where(:not(:first-child)) {
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  .maplibregl-ctrl-group button:hover:where(:not(:disabled)) {
    background: var(--lr-color-brand-quiet);
    color: var(--lr-color-brand);
  }
  .maplibregl-ctrl-group button:active:where(:not(:disabled)) {
    background: var(--lr-color-brand);
    color: var(--lr-color-on-brand);
  }
  .maplibregl-ctrl-group button:focus-visible {
    outline: var(--lr-focus-ring);
    outline-offset: calc(-1 * var(--lr-focus-ring-offset));
  }
  .maplibregl-ctrl-group button:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  .maplibregl-ctrl-icon {
    display: grid;
    place-items: center;
    inline-size: var(--lr-size-1em);
    block-size: var(--lr-size-1em);
    font-size: var(--lr-font-size-lg);
    line-height: var(--lr-line-height-none);
  }
  .maplibregl-ctrl-zoom-in .maplibregl-ctrl-icon::before {
    content: '+';
  }
  .maplibregl-ctrl-zoom-out .maplibregl-ctrl-icon::before {
    content: '−';
  }
  .maplibregl-ctrl-compass .maplibregl-ctrl-icon::before {
    content: '▲';
  }
  .maplibregl-ctrl-scale {
    position: relative;
    box-sizing: border-box;
    min-inline-size: max-content;
    padding: var(--lr-space-2xs) var(--lr-space-xs);
    padding-block-end: calc(var(--lr-space-2xs) + var(--lr-space-xs));
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font-family: var(--lr-font);
    font-size: var(--lr-font-size-xs);
    text-align: center;
    white-space: nowrap;
  }
  .maplibregl-ctrl-scale::after {
    content: '';
    position: absolute;
    inset-inline-start: 0;
    inset-block-end: 0;
    box-sizing: border-box;
    inline-size: var(--_lr-map-scale-width, 100%);
    block-size: var(--lr-space-xs);
    border: var(--lr-border-width-medium) solid currentColor;
    border-block-start: 0;
    pointer-events: none;
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
    place-items: center;
    transition: background-color var(--lr-transition-fast);
  }
  .maplibregl-ctrl-attrib-button::before {
    content: '';
    display: block;
    inline-size: var(--lr-size-1rem);
    block-size: var(--lr-size-1rem);
    background: currentColor;
    mask: url('data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Ccircle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/%3E%3Cpath d="M12 10v7m0-10v.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/%3E%3C/svg%3E') center / contain no-repeat;
  }
  .maplibregl-ctrl-attrib.maplibregl-compact {
    position: relative;
    min-block-size: var(--lr-icon-button-size);
    padding-inline-end: var(--lr-icon-button-size);
  }
  .maplibregl-ctrl-attrib.maplibregl-compact .maplibregl-ctrl-attrib-inner {
    display: none;
  }
  .maplibregl-ctrl-attrib.maplibregl-compact .maplibregl-ctrl-attrib-button {
    display: grid;
  }
  .maplibregl-ctrl-attrib.maplibregl-compact-show .maplibregl-ctrl-attrib-inner {
    display: block;
  }
  .maplibregl-ctrl-attrib-button:hover,
  .maplibregl-ctrl-attrib-button:active,
  .maplibregl-ctrl-attrib:where([open]) .maplibregl-ctrl-attrib-button {
    background: var(--lr-color-brand-quiet);
  }
  .maplibregl-ctrl-attrib-button:focus-visible {
    outline: var(--lr-focus-ring);
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
    .maplibregl-ctrl-attrib-button {
      color: ButtonText;
    }
    .maplibregl-ctrl-attrib-button::before {
      forced-color-adjust: none;
    }
    [part='legend-swatch'] {
      background: Canvas !important;
      border-color: CanvasText;
      color: CanvasText;
    }
    [part='legend-swatch'][data-pattern='solid'] {
      background: CanvasText !important;
    }
    /* A glyph row keeps its shape readable: the system text color reaches the path through
       currentColor, so the swatch must not be filled with that same color behind it. The extra
       [data-pattern] qualifier OUTRANKS the solid-pattern fill above instead of merely following
       it, so no later edit to this block can leave a solid-pattern glyph row painting CanvasText
       on CanvasText, which would erase the symbol entirely. The pattern border is untouched here
       and stays this row's non-color cue. */
    [part='legend-swatch'][data-pattern][data-icon='true'] {
      background: Canvas !important;
    }
    /* Forced colors collapse the quiet-text recolor and the swatch opacity above into the same
       system colors as a visible row, so the hidden toggle needs a cue that survives that
       collapse. Line-through is the one lr-chart's hidden legend item already uses. */
    button[part~='legend-toggle-hidden'] {
      text-decoration-line: line-through;
      text-decoration-thickness: var(--lr-border-width-medium);
    }
  }
`;
