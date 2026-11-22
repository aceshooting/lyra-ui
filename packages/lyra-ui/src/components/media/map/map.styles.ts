import { forcedColorsPart } from '../../../internal/forced-colors.styles.js';
import { activeFill, disabledControl, focusRing, focusRingInset, focusRingShorthandInward, hoverFill, iconHitTarget, interactiveTransition } from '../../../internal/interactive-control.styles.js';
import { css } from 'lit';
import { mapOverlayPanel, mapOverlayPanelLayer, mapOverlayCloseButton, mapOverlayCloseButtonHover, mapOverlayCloseButtonActive } from '../../../internal/map-overlay-panel.styles.js';
import { glassSurface } from '../../../internal/glass-surface.styles.js';
import { glassScrollLayerStyles } from '../../../internal/glass-scroll-layer.styles.js';

export const styles = css`
  :host {
    display: block;
    position: relative;
    inline-size: 100%;
    block-size: var(--lr-map-height, var(--lr-size-24rem));
  }
  [part='scene-panel'] {
    ${mapOverlayPanel}
    position: absolute;
    grid-row: 2;
    justify-self: start;
    inline-size: fit-content;
    max-inline-size: calc(100% - var(--lr-space-s) - var(--lr-space-s));
    inset-inline-start: var(--lr-space-s);
    inset-block-end: var(--lr-space-s);
    z-index: var(--lr-layer-content);
    max-block-size: 60%;
    min-inline-size: 0;
    overflow: auto;
    padding: var(--lr-space-s);
  }
  [part='scene-list'] { list-style: none; margin: var(--lr-space-s) 0; padding: 0; min-inline-size: 0; }
  [part='scene-list'] > li { min-inline-size: 0; margin-block: var(--lr-space-xs); }
  [part='scene-item'] { display: block; inline-size: 100%; text-align: start; }
  .scene-kind { display: block; color: var(--lr-color-text-quiet); font-size: var(--lr-font-size-sm); }
  [part='scene-status'] { margin-block-start: var(--lr-space-xs); }
  [part='scene-pagination'] { display: flex; flex-wrap: wrap; align-items: center; gap: var(--lr-space-xs); }
  [part='scene-toggle'], button[part='scene-item'], [part='scene-pagination'] button {
    ${iconHitTarget}
    position: relative;
    max-inline-size: 100%;
    padding: var(--lr-space-xs) var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-button);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    text-align: start;
    white-space: normal;
    overflow-wrap: anywhere;
    cursor: pointer;
  }
  [part='scene-toggle']:where(:not(:disabled):hover), button[part='scene-item']:where(:not(:disabled):hover), [part='scene-pagination'] button:where(:not(:disabled):hover) {
    --_lr-map-action-fill: var(--lr-map-action-hover-bg, var(--lr-color-surface-raised));
  }
  [part='scene-toggle']:where(:not(:disabled):active), button[part='scene-item']:where(:not(:disabled):active), [part='scene-pagination'] button:where(:not(:disabled):active) {
    --_lr-map-action-fill: var(--lr-map-action-active-bg, ${activeFill('var(--lr-color-surface-raised)')});
  }
  [part='scene-toggle']:focus-visible, button[part='scene-item']:focus-visible, [part='scene-pagination'] button:focus-visible {
    ${focusRing}
  }
  :is([part='scene-toggle'], button[part='scene-item'], [part='scene-pagination'] button):where(:disabled) { ${disabledControl} }
  [part='initialization-placeholder'] { position: absolute; inset: 0; pointer-events: none; background: var(--lr-map-initialization-placeholder-bg, transparent); }
  /* lr-skeleton's own host display is inline-block; the token only takes it out of the layout. */
  .initialization-skeleton { display: var(--lr-map-initialization-skeleton-display, inline-block); inline-size: 100%; block-size: 100%; }
  .initialization-controls { position: absolute; inset: 0; box-sizing: border-box; display: grid; grid-template-rows: auto 1fr auto; pointer-events: none; }
  /* App chrome that owns part of a map edge pushes every corner control stack inward by the same
     logical inset, before and after construction. */
  .initialization-controls, .maplibregl-control-container {
    padding-block: var(--_lr-map-controls-inset-block-start, var(--lr-map-controls-inset-block-start, 0px)) var(--_lr-map-controls-inset-block-end, var(--lr-map-controls-inset-block-end, 0px));
    padding-inline: var(--_lr-map-controls-inset-inline-start, var(--lr-map-controls-inset-inline-start, 0px)) var(--_lr-map-controls-inset-inline-end, var(--lr-map-controls-inset-inline-end, 0px));
  }
  .initialization-row { display: grid; grid-template-columns: minmax(0, max-content) minmax(0, max-content); justify-content: space-between; min-inline-size: 0; }
  .initialization-row-top { grid-row: 1; }
  .initialization-row-bottom { grid-row: 3; }
  .initialization-corner { display: flex; flex-direction: column; min-inline-size: 0; gap: 0; }
  .initialization-row-bottom .initialization-corner { justify-content: flex-end; }
  .initialization-corner-left { grid-column: 1; align-items: flex-start; }
  .initialization-corner-right { grid-column: 2; align-items: flex-end; }
  /* Covers the whole placeholder: any press on it starts the map, and the label stays centered. */
  [part='initialization-activate'] {
    ${iconHitTarget}
    position: absolute; inset: 0; z-index: 1; pointer-events: auto;
    display: grid; place-items: center; padding: var(--lr-space-m);
    border: 0; background: transparent; color: var(--lr-color-text); font: inherit; cursor: pointer;
    overflow-wrap: anywhere;
    ${interactiveTransition}
  }
  [part='initialization-activate']::after {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background: ${hoverFill('transparent')};
    opacity: 0;
  }
  [part='initialization-activate']:where(:hover)::after { opacity: 1; }
  [part='initialization-activate']:where(:active)::after {
    opacity: 1; background: ${activeFill('transparent')};
  }
  [part='initialization-activate']:focus-visible { ${focusRingInset} }
  /* Hiding the visible prompt keeps the covering button and its localized accessible name. */
  .activate-label { display: var(--lr-map-initialization-activate-label-display, inline); position: relative; padding: var(--lr-space-xs) var(--lr-space-s); border: var(--lr-border-width-thin) solid var(--lr-color-border); border-radius: var(--lr-radius-button); background: var(--lr-color-surface); }
  /* The fill comes from the shared control material below, so loading and installed controls match. */
  [part~='initialization-control'] {
    position: relative; flex-shrink: 0; margin: var(--lr-map-control-gap, var(--lr-space-xs));
    inline-size: var(--lr-map-control-size, var(--lr-icon-button-size)); block-size: var(--lr-map-control-size, var(--lr-icon-button-size));
    border: var(--lr-map-control-border, var(--lr-border-width-thin) solid var(--lr-color-border));
    border-radius: var(--lr-map-control-radius, var(--lr-radius-button));
    box-shadow: var(--lr-map-control-shadow, none);
    color: var(--lr-map-control-color, var(--lr-color-text));
  }
  [part='pick-controls'], [part='drawing-controls'] {
    position: relative;
    grid-area: 3 / 1;
    margin-inline: var(--lr-space-s);
    z-index: calc(var(--lr-layer-content) + 1);
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-xs);
    pointer-events: none;
  }
  /* no-transition-needed: the drawing and pick controls are the one map surface that stays free of animation under every motion preference. */
  [part='pick-center'], [part='pick-cancel'], [part='drawing-add'], [part='drawing-undo'], [part='drawing-complete'], [part='drawing-cancel'], [part='anchor-close'] {
    ${iconHitTarget}
    pointer-events: auto;
    max-inline-size: 100%;
    white-space: normal;
    overflow-wrap: anywhere;
    padding: var(--lr-space-xs) var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-button);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    cursor: pointer;
  }
  [part='pick-controls'] button, [part='drawing-controls'] button, [part='anchor-close'] { position: relative; }
  :is([part='pick-center'], [part='pick-cancel'], [part='drawing-add'], [part='drawing-undo'], [part='drawing-complete'], [part='drawing-cancel'], [part='anchor-close']):where(:not(:disabled):hover) {
    --_lr-map-action-fill: var(--lr-map-action-hover-bg, var(--lr-color-surface-raised));
  }
  :is([part='pick-center'], [part='pick-cancel'], [part='drawing-add'], [part='drawing-undo'], [part='drawing-complete'], [part='drawing-cancel'], [part='anchor-close']):where(:not(:disabled):active) {
    --_lr-map-action-fill: var(--lr-map-action-active-bg, ${activeFill('var(--lr-color-surface-raised)')});
  }
  :is([part='pick-center'], [part='pick-cancel'], [part='drawing-add'], [part='drawing-undo'], [part='drawing-complete'], [part='drawing-cancel'], [part='anchor-close']):focus-visible { ${focusRing} }
  :is([part='pick-center'], [part='pick-cancel'], [part='drawing-add'], [part='drawing-undo'], [part='drawing-complete'], [part='drawing-cancel'], [part='anchor-close']):where(:disabled) { ${disabledControl} }
  [part='drawing-handles'] { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
  [part='drawing-vertex'] {
    ${iconHitTarget}
    position: absolute; transform: translate(-50%, -50%); pointer-events: auto;
    display: grid; place-items: center; touch-action: none; padding: 0; border: 0; background: transparent; color: var(--lr-color-text); cursor: grab;
  }
  [part='drawing-vertex'] > span { inline-size: var(--lr-space-s); block-size: var(--lr-space-s); border-radius: var(--lr-radius-pill); background: var(--lr-map-drawing-color, var(--lr-color-brand)); border: var(--lr-border-width-thin) solid var(--lr-color-surface); }
  [part='drawing-vertex']:where(:not(:disabled):hover) > span { background: var(--lr-map-drawing-vertex-hover-bg, ${hoverFill('var(--lr-map-drawing-color, var(--lr-color-brand))')}); }
  [part='drawing-vertex']:where(:not(:disabled):active) { cursor: grabbing; }
  [part='drawing-vertex']:where(:not(:disabled):active) > span { background: var(--lr-map-drawing-vertex-active-bg, ${activeFill('var(--lr-map-drawing-color, var(--lr-color-brand))')}); }
  [part='drawing-measurements'] { position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 1; }
  [part='drawing-measurement'] {
    position: absolute; transform: translate(-50%, -50%); white-space: nowrap; unicode-bidi: plaintext;
    padding: 0 var(--lr-space-2xs); border-radius: var(--lr-radius-xs);
    background: var(--lr-color-surface); color: var(--lr-color-text); font-size: var(--lr-font-size-sm);
    box-shadow: var(--lr-shadow-s);
  }
  [part='drawing-measurement'][data-kind='length'] { transform: translate(-50%, calc(var(--lr-space-s) + 50%)); }
  [part='drawing-measurement'][data-kind='area'] { font-weight: var(--lr-font-weight-semibold); }
  [part='drawing-summary'] { position: relative; align-self: center; unicode-bidi: plaintext; padding: var(--lr-space-xs) var(--lr-space-s); border-radius: var(--lr-radius-button); background: var(--lr-color-surface); color: var(--lr-color-text); }
  [part='drawing-vertex']:focus-visible { ${focusRing} }
  [part='drawing-vertex']:where(:disabled) { ${disabledControl} }
  [part='drawing-status'] { position: relative; border-radius: var(--lr-radius-button); color: var(--lr-color-text); background: var(--lr-color-surface); padding: var(--lr-space-xs); overflow-wrap: anywhere; }
  [part='base'] {
    position: relative;
    inline-size: 100%;
    block-size: 100%;
  }
  /* Pick and drawing bars and the scene panel all join one grid that reserves the native corner
     control rows, so none of them paints over attribution, scale, zoom or the legend. */
  [part='base']:has(> :is([part='pick-controls'], [part='drawing-controls'], [part='scene-panel'])) {
    box-sizing: border-box;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) fit-content(60%) auto;
    row-gap: var(--lr-space-xs);
    padding-block: calc(var(--lr-space-s) + var(--_lr-map-controls-top, 0px) + var(--_lr-map-controls-inset-block-start, var(--lr-map-controls-inset-block-start, 0px)))
      calc(var(--lr-space-s) + var(--_lr-map-controls-bottom, 0px) + var(--_lr-map-controls-inset-block-end, var(--lr-map-controls-inset-block-end, 0px)));
    padding-inline: var(--_lr-map-controls-inset-inline-start, var(--lr-map-controls-inset-inline-start, 0px)) var(--_lr-map-controls-inset-inline-end, var(--lr-map-controls-inset-inline-end, 0px));
  }
  [part='base']:has(> :is([part='pick-controls'], [part='drawing-controls'], [part='scene-panel']))
    > :is([part='legend'], [part='scene-panel']) {
    position: relative;
    inset: auto;
    grid-column: 1;
    align-self: end;
    margin-inline: var(--lr-space-s);
    min-block-size: 0;
    max-block-size: 100%;
  }
  [part='base']:has(> :is([part='pick-controls'], [part='drawing-controls'], [part='scene-panel'])) > [part='legend']:where([data-placement^='top']) { align-self: start; }
  [part='base']:has(> :is([part='pick-controls'], [part='drawing-controls'], [part='scene-panel'])) > [part='legend']:where([data-placement='start'], [data-placement='end']) { align-self: center; }
  [part='base']:has(> :is([part='pick-controls'], [part='drawing-controls'], [part='scene-panel'])) > [part='legend']:where([data-placement$='-end'], [data-placement='end']) { justify-self: end; }
  [part='base']:has(> :is([part='pick-controls'], [part='drawing-controls'], [part='scene-panel'])) > [part='legend']:where([data-placement='top'], [data-placement='bottom']) { justify-self: center; }
  lr-skeleton {
    --lr-skeleton-w: 100%;
    --lr-skeleton-h: 100%;
  }
  [part='container'] {
    position: absolute;
    /* policy-allow(physical-css): canvas placement follows physical DOM rectangle coordinates. */
    left: var(--_lr-map-canvas-left, 0);
    top: var(--_lr-map-canvas-top, 0);
    width: var(--_lr-map-canvas-width, 100%);
    height: var(--_lr-map-canvas-height, 100%);
    overflow: hidden;
    container-type: size;
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
    color: var(--lr-color-brand);
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
  /* A halo, not brightness(): multiplying every channel leaves a pure black or white marker
     unchanged, while a drop-shadow follows any marker silhouette in any colour. */
  .maplibregl-marker[role='button']:hover {
    filter: drop-shadow(0 0 var(--lr-size-2px) var(--lr-map-marker-hover-halo-color, var(--lr-color-brand)));
  }
  .maplibregl-marker[role='button']:active {
    filter: drop-shadow(0 0 calc(2 * var(--lr-size-2px)) var(--lr-map-marker-hover-halo-color, var(--lr-color-brand)));
  }
  .maplibregl-marker[role='button']:focus-visible {
    ${focusRingShorthandInward}
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
  .maplibregl-popup-anchor-left {
    flex-direction: row;
  }
  .maplibregl-popup-anchor-right {
    flex-direction: row-reverse;
  }
  /* MapLibre chooses anchors in physical viewport coordinates. Only the decorative tip needs a fixed direction. */
  :host(:dir(rtl)) :is(.maplibregl-popup-anchor-left, .maplibregl-popup-anchor-right) > .maplibregl-popup-tip { order: 1; }
  .maplibregl-popup-tip {
    direction: ltr;
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
    align-self: self-start;
    border-block-start: none;
    border-inline-start: none;
    border-block-end-color: var(--lr-color-surface-overlay);
  }
  .maplibregl-popup-anchor-top-right .maplibregl-popup-tip {
    align-self: self-end;
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
    align-self: self-start;
    border-block-end: none;
    border-inline-start: none;
    border-block-start-color: var(--lr-color-surface-overlay);
  }
  .maplibregl-popup-anchor-bottom-right .maplibregl-popup-tip {
    align-self: self-end;
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
    ${mapOverlayPanel}
    position: relative;
    inline-size: auto;
    max-inline-size: 100%;
    max-block-size: calc(100cqb - var(--lr-space-s) - var(--lr-space-s));
    overflow: auto;
    min-inline-size: var(--lr-icon-button-size);
    padding: var(--lr-space-m);
    padding-inline-end: calc(var(--lr-icon-button-size) + var(--lr-space-xs));
    pointer-events: auto;
  }
  .maplibregl-popup-close-button {
    position: absolute;
    inset-block-start: 0;
    inset-inline-end: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    ${iconHitTarget}
    ${mapOverlayCloseButton}
    transition: background-color var(--lr-transition-fast), color var(--lr-transition-fast);
  }
  .maplibregl-popup-close-button:where(:hover) {
    ${mapOverlayCloseButtonHover}
  }
  .maplibregl-popup-close-button:where(:active) {
    ${mapOverlayCloseButtonActive}
  }
  .maplibregl-popup-close-button:where(:focus-visible) {
    ${focusRingShorthandInward}
  }
  /* Mirrors docx-viewer.styles.ts's identical [part='error'] treatment for the same
     missing-optional-peer-dependency failure shape. */
  [part='error'], [part='configuration-error'] {
    margin: 0;
    padding: var(--lr-space-l);
    color: var(--lr-color-danger);
    font-size: var(--lr-font-size-md-sm);
    text-align: center;
  }
  /* The map container is absolutely positioned, so in-flow messages would paint underneath the
     canvas. Configuration errors therefore float over the map as one stacked banner on a surface. */
  .configuration-errors {
    position: absolute;
    inset-inline: var(--lr-space-s);
    inset-block-start: var(--lr-space-s);
    z-index: calc(var(--lr-layer-content) + 1);
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    pointer-events: none;
  }
  .configuration-errors > [part='configuration-error'] {
    padding: var(--lr-space-s) var(--lr-space-m);
    border: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface-overlay);
    overflow-wrap: anywhere;
    pointer-events: auto;
  }
  /* The anchor slot's wrapper. place() writes position and the coordinates; the surface mirrors a
     marker popup, and the layer sits above the legend and controls so anchored content is never
     covered by them. Its size never depends on the placement's published available-size variables:
     the placement observes this element, and a size that tracked them would loop. */
  .anchor-boundary { position: absolute; inset: 0; pointer-events: none; }
  [part='anchor-close'] { display: block; flex: none; margin-inline-start: auto; margin-block-start: var(--lr-space-xs); }
  [part='anchor'] {
    ${mapOverlayPanelLayer}
    ${mapOverlayPanel}
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: var(--lr-space-m);
  }
  /* The body scrolls inside the panel, so the close action below it never scrolls away. */
  [part='anchor-body'] {
    flex: 1 1 auto;
    min-block-size: 0;
    min-inline-size: 0;
    overflow: auto;
    overscroll-behavior: contain;
    padding-inline-end: var(--lr-map-anchor-close-reservation, 0);
  }
  /* anchorFill: the body stops scrolling and shrinks the slotted content to the panel, so a card
     owns its own scroll region; the close reservation is left to the card's header. */
  :host([anchor-fill]) [part='anchor-body'] {
    display: flex;
    flex-direction: column;
    overflow: clip;
    padding-inline-end: 0;
  }
  :host([anchor-fill]) [part='anchor-body'] ::slotted(*) {
    flex: 1 1 auto;
    min-block-size: 0;
  }
  /* Placement and close state must survive consumer display rules on the public part. */
  [part='anchor']:where([hidden]) { display: none !important; }
  [part='legend'] {
    /* Each edge offset folds the panel inset, the measured native control rows and the authored
       control insets together, so the panel clears the controls in every placement. */
    --_lr-map-legend-block-start: calc(var(--lr-map-legend-inset-block, var(--lr-space-s)) + var(--_lr-map-legend-controls-top, var(--_lr-map-controls-top, 0px)) + var(--_lr-map-controls-inset-block-start, var(--lr-map-controls-inset-block-start, 0px)));
    --_lr-map-legend-block-end: calc(var(--lr-map-legend-inset-block, var(--lr-space-s)) + var(--_lr-map-legend-controls-bottom, var(--_lr-map-controls-bottom, 0px)) + var(--_lr-map-controls-inset-block-end, var(--lr-map-controls-inset-block-end, 0px)));
    --_lr-map-legend-inline-start: calc(var(--lr-map-legend-inset-inline, var(--lr-space-s)) + var(--_lr-map-controls-inset-inline-start, var(--lr-map-controls-inset-inline-start, 0px)));
    --_lr-map-legend-inline-end: calc(var(--lr-map-legend-inset-inline, var(--lr-space-s)) + var(--_lr-map-controls-inset-inline-end, var(--lr-map-controls-inset-inline-end, 0px)));
    position: absolute;
    grid-row: 1;
    justify-self: start;
    inset-block-end: var(--_lr-map-legend-block-end);
    inset-inline-start: var(--_lr-map-legend-inline-start);
    z-index: var(--lr-layer-content);
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    max-inline-size: var(--lr-map-legend-max-inline-size, calc(100% - var(--_lr-map-legend-inline-start) - var(--_lr-map-legend-inline-end)));
    max-block-size: var(--lr-map-legend-max-block-size, calc(100% - var(--_lr-map-legend-block-start) - var(--_lr-map-legend-block-end)));
    overflow: auto;
    /* Reserve the scrollbar gutter so this scrolling overlay does not punch a transparent
       rectangle into the composited WebGL canvas in Chromium. */
    scrollbar-gutter: stable;
    box-sizing: border-box;
    gap: var(--lr-map-legend-gap, var(--lr-space-xs));
    padding: var(--lr-map-legend-padding, var(--lr-space-xs) var(--lr-space-s));
    background: var(--lr-map-legend-bg, var(--lr-color-surface));
    color: var(--lr-map-legend-color, var(--lr-color-text));
    border: var(--lr-map-legend-border, var(--lr-border-width-thin) solid var(--lr-color-border-subtle));
    border-radius: var(--lr-map-legend-radius, var(--lr-radius));
    /* The legend is pinned over the tiles, so it reads as a layer above the map, not a panel
       beside it. */
    box-shadow: var(--lr-map-legend-shadow, var(--lr-shadow-m));
    font-size: var(--lr-map-legend-font-size, var(--lr-font-size-xs));
  }
  /* legendClearance='corner': a corner or side placement clears only the control corners in its
     own logical column (the left corners are the start corners, mirrored under RTL); the centred
     top and bottom placements keep clearing the whole row. */
  [part='legend']:where([data-clearance='corner']):where([data-placement$='start']) {
    --_lr-map-legend-controls-top: calc(var(--_lr-map-controls-top-left, 0px) + var(--lr-map-controls-top-left-inset-block, 0px));
    --_lr-map-legend-controls-bottom: calc(var(--_lr-map-controls-bottom-left, 0px) + var(--lr-map-controls-bottom-left-inset-block, 0px));
  }
  [part='legend']:where([data-clearance='corner']):where([data-placement$='end']) {
    --_lr-map-legend-controls-top: calc(var(--_lr-map-controls-top-right, 0px) + var(--lr-map-controls-top-right-inset-block, 0px));
    --_lr-map-legend-controls-bottom: calc(var(--_lr-map-controls-bottom-right, 0px) + var(--lr-map-controls-bottom-right-inset-block, 0px));
  }
  /* legendClearance='none': the legend insets alone place the panel from the map edge, with no
     measured control rows and no authored control insets folded in. */
  [part='legend']:where([data-clearance='none']) {
    --_lr-map-legend-block-start: var(--lr-map-legend-inset-block, var(--lr-space-s));
    --_lr-map-legend-block-end: var(--lr-map-legend-inset-block, var(--lr-space-s));
    --_lr-map-legend-inline-start: var(--lr-map-legend-inset-inline, var(--lr-space-s));
    --_lr-map-legend-inline-end: var(--lr-map-legend-inset-inline, var(--lr-space-s));
  }
  [part='legend']:where([data-placement^='top']) { inset-block-start: var(--_lr-map-legend-block-start); inset-block-end: auto; }
  [part='legend']:where([data-placement$='-end'], [data-placement='end']) { inset-inline-start: auto; inset-inline-end: var(--_lr-map-legend-inline-end); }
  [part='legend']:where([data-placement='top'], [data-placement='bottom']) {
    inset-inline: var(--_lr-map-legend-inline-start) var(--_lr-map-legend-inline-end); margin-inline: auto; inline-size: fit-content;
  }
  [part='legend']:where([data-placement='start'], [data-placement='end']) {
    inset-block: var(--_lr-map-legend-block-start) var(--_lr-map-legend-block-end); margin-block: auto; block-size: fit-content;
  }
  /* Further cards slotted into legend-start or legend stack in the panel's own column. */
  [part='legend'] ::slotted(*) { min-inline-size: 0; max-inline-size: 100%; }
  .legend-list {
    display: grid;
    grid-template-columns: repeat(var(--lr-map-legend-columns, 1), minmax(0, 1fr));
    gap: var(--lr-map-legend-row-gap, var(--lr-map-legend-gap, var(--lr-space-xs))) var(--lr-map-legend-gap, var(--lr-space-xs));
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
    /* WCAG 2.5.8, matching the interactive legend rows above, in both axes. */
    ${iconHitTarget}
    max-inline-size: 100%;
    border: none;
    border-radius: var(--lr-radius-xs);
    padding: var(--lr-map-legend-disclosure-padding, var(--lr-size-2px) var(--lr-space-xs));
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
  button[part='legend-disclosure']:where(:not(:disabled):hover) {
    background: ${hoverFill('transparent')};
  }
  button[part='legend-disclosure']:where(:not(:disabled):active) {
    background: ${activeFill('transparent')};
  }
  button[part='legend-disclosure']:where(:focus-visible) {
    ${focusRing}
  }
  button[part='legend-disclosure']:where(:disabled) {
    ${disabledControl}
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
    flex: 0 1 auto;
    min-inline-size: 0;
    max-inline-size: 35%;
    white-space: normal;
    overflow-wrap: anywhere;
  }
  /* The bar and its tick row share one track so a tick lines up with the exact point of the ramp it
     names, whatever width the two captions leave the bar. */
  .legend-gradient .gradient-track {
    display: flex;
    flex: 1 1 var(--lr-size-6rem);
    inline-size: var(--lr-size-6rem);
    flex-direction: column;
    gap: var(--lr-size-2px);
    min-inline-size: 0;
  }
  .gradient-track .gradient-bar {
    flex: none;
    inline-size: 100%;
  }
  .gradient-ticks {
    position: relative;
    block-size: calc(var(--lr-space-m) + var(--lr-space-xs));
    min-inline-size: 0;
  }
  /* Positioned from the inline start, so under RTL the ticks mirror together with the flipped bar. */
  [part='legend-tick'] {
    position: absolute;
    inset-block-start: 0;
    inset-inline-start: var(--_lr-map-tick-position, 0%);
    display: flex;
    flex-direction: column;
    align-items: center;
    translate: -50% 0;
    color: var(--lr-color-text-quiet);
    white-space: nowrap;
  }
  :host(:dir(rtl)) [part='legend-tick'] {
    translate: 50% 0;
  }
  [part='legend-tick']::before {
    content: '';
    inline-size: var(--lr-size-1px);
    block-size: calc(var(--lr-size-2px) * 2);
    background: currentColor;
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
    gap: var(--lr-map-legend-gap, var(--lr-space-xs));
    min-inline-size: 0;
  }
  /* Rows inside one section follow the row gap and flow into the group columns; the
     heading-to-rows gap stays on the panel gap. */
  .legend-section-list {
    display: grid;
    grid-template-columns: repeat(var(--lr-map-legend-group-columns, 1), minmax(0, 1fr));
    gap: var(--lr-map-legend-row-gap, var(--lr-map-legend-gap, var(--lr-space-xs))) var(--lr-map-legend-gap, var(--lr-space-xs));
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
    ${iconHitTarget}
    max-inline-size: 100%;
    border: none;
    border-radius: var(--lr-radius-xs);
    padding: var(--lr-map-legend-toggle-padding, var(--lr-size-2px) var(--lr-space-xs));
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
  button[part~='legend-toggle']:where(:not(:disabled):hover) {
    background: ${hoverFill('transparent')};
  }
  button[part~='legend-toggle']:where(:not(:disabled):active) {
    background: ${activeFill('transparent')};
  }
  button[part~='legend-toggle']:where(:focus-visible) {
    ${focusRing}
  }
  button[part~='legend-toggle']:where(:disabled) {
    ${disabledControl}
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
    inline-size: var(--lr-map-legend-swatch-size, var(--lr-size-0-75rem));
    block-size: var(--lr-map-legend-swatch-size, var(--lr-size-0-75rem));
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
  /* A row carrying a glyph paints the shape itself in the entry color, so the solid block, border
     and pattern overlay would frame or cover the thing they identify. The glyph silhouette is the
     non-color cue for this row, including in forced colors where the entry color is collapsed.
     The square, unclipped box also keeps a dotted pattern's circular radius from shaving the
     glyph's corners. The extra [data-pattern] qualifier wins over [data-pattern='dots'] rather
     than relying on source order. */
  [part='legend-swatch'][data-pattern][data-icon='true'] {
    inline-size: var(--lr-size-1rem);
    block-size: var(--lr-size-1rem);
    border: none;
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
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
    color: var(--lr-color-text-quiet);
    overflow-wrap: anywhere;
  }

  /* MapLibre's attribution control is generated in the same shadow-local container: anchored over
     the map, on Lyra's own surface, typography, and interaction tokens. */
  .maplibregl-control-container {
    position: absolute;
    inset: var(--_lr-map-canvas-inset-top, 0) var(--_lr-map-canvas-inset-right, 0)
      var(--_lr-map-canvas-inset-bottom, 0) var(--_lr-map-canvas-inset-left, 0);
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto 1fr auto;
    pointer-events: none;
  }
  .map-control-row {
    display: grid;
    grid-template-columns: minmax(0, max-content) minmax(0, max-content);
    justify-content: space-between;
    min-inline-size: 0;
    pointer-events: none;
  }
  .map-control-row-top { grid-row: 1; }
  .map-control-row-bottom { grid-row: 3; }
  .maplibregl-ctrl-top-left,
  .maplibregl-ctrl-top-right,
  .maplibregl-ctrl-bottom-left,
  .maplibregl-ctrl-bottom-right {
    position: relative;
    min-inline-size: 0;
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
  /* One corner's own inset, from its row edge and its column's map edge, before and after
     construction. The left corners are the start corners (mirrored under RTL). */
  :is(.maplibregl-ctrl-top-left, .initialization-row-top .initialization-corner-left) {
    padding-block-start: var(--lr-map-controls-top-left-inset-block, 0px);
    padding-inline-start: var(--lr-map-controls-top-left-inset-inline, 0px);
  }
  :is(.maplibregl-ctrl-top-right, .initialization-row-top .initialization-corner-right) {
    padding-block-start: var(--lr-map-controls-top-right-inset-block, 0px);
    padding-inline-end: var(--lr-map-controls-top-right-inset-inline, 0px);
  }
  :is(.maplibregl-ctrl-bottom-left, .initialization-row-bottom .initialization-corner-left) {
    padding-block-end: var(--lr-map-controls-bottom-left-inset-block, 0px);
    padding-inline-start: var(--lr-map-controls-bottom-left-inset-inline, 0px);
  }
  :is(.maplibregl-ctrl-bottom-right, .initialization-row-bottom .initialization-corner-right) {
    padding-block-end: var(--lr-map-controls-bottom-right-inset-block, 0px);
    padding-inline-end: var(--lr-map-controls-bottom-right-inset-inline, 0px);
  }
  .maplibregl-ctrl-top-left { grid-column: 1; }
  .maplibregl-ctrl-top-right { grid-column: 2; }
  .maplibregl-ctrl-bottom-left { grid-column: 1; justify-content: flex-end; }
  .maplibregl-ctrl-bottom-right { grid-column: 2; justify-content: flex-end; }
  .maplibregl-ctrl {
    box-sizing: border-box;
    /* The corner shrinks to fit, so this percentage resolves against the control's own width.
       The floor keeps a control at least as wide as its content when a part changes its margin;
       wrapping controls such as attribution still narrow to the map. */
    min-inline-size: min-content;
    max-inline-size: calc(100% - 2 * var(--lr-map-control-gap, var(--lr-space-xs)));
    flex-shrink: 0;
    margin: var(--lr-map-control-gap, var(--lr-space-xs));
    pointer-events: auto;
    transform: translate(0);
  }
  .maplibregl-ctrl-attrib {
    position: relative;
    padding: var(--lr-map-attribution-padding, 0 var(--lr-space-xs));
    border: var(--lr-map-attribution-border, none);
    border-radius: var(--lr-map-attribution-radius, var(--lr-radius));
    background: var(--lr-color-surface);
    color: var(--lr-color-text-quiet);
    font-family: var(--lr-map-attribution-font-family, inherit);
    font-size: var(--lr-map-attribution-font-size, var(--lr-font-size-xs));
    line-height: var(--lr-map-attribution-line-height, inherit);
  }
  /* The shared control ceiling stays the outer bound, so a wide token never escapes the map. */
  .maplibregl-ctrl.maplibregl-ctrl-attrib {
    max-inline-size: min(var(--lr-map-attribution-max-inline-size, 100%), calc(100% - 2 * var(--lr-map-control-gap, var(--lr-space-xs))));
  }
  .maplibregl-ctrl-group {
    position: relative;
    display: flex;
    flex-direction: column;
    inline-size: fit-content;
    border: var(--lr-map-control-group-border, var(--lr-map-control-border, var(--lr-border-width-thin) solid var(--lr-color-border)));
    border-radius: var(--lr-map-control-group-radius, var(--lr-map-control-radius, var(--lr-radius)));
    box-shadow: var(--lr-map-control-shadow, var(--lr-shadow));
    color: var(--lr-map-control-color, var(--lr-color-text));
  }
  .maplibregl-ctrl-group button {
    display: grid;
    place-items: center;
    ${iconHitTarget}
    inline-size: var(--lr-map-control-size, auto);
    block-size: var(--lr-map-control-size, auto);
    padding: var(--lr-space-xs);
    border: 0;
    border-radius: var(--lr-map-control-button-radius, inherit);
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
    transition: background-color var(--lr-transition-fast), color var(--lr-transition-fast);
  }
  /* The group's outer corners stay on its first and last buttons, so a fill never squares the end
     of a pill whose inner corners --lr-map-control-button-radius has squared. */
  .maplibregl-ctrl-group button:where(:first-child) {
    border-start-start-radius: inherit;
    border-start-end-radius: inherit;
  }
  .maplibregl-ctrl-group button:where(:last-child) {
    border-end-start-radius: inherit;
    border-end-end-radius: inherit;
  }
  .maplibregl-ctrl-group button:where(:not(:first-child)) {
    border-block-start: var(--lr-map-control-divider, var(--lr-border-width-thin) solid var(--lr-color-border));
  }
  /* The native controls own their pointer tokens; the action tokens style scene, pick and drawing actions only. */
  .maplibregl-ctrl-group button:hover:where(:not(:disabled)) {
    background: var(--lr-map-control-hover-bg, var(--lr-color-brand-quiet));
    color: var(--lr-color-brand);
  }
  .maplibregl-ctrl-group button:active:where(:not(:disabled)) {
    background: var(--lr-map-control-active-bg, ${activeFill('var(--lr-map-control-hover-bg, var(--lr-color-brand-quiet))')});
  }
  .maplibregl-ctrl-group button:focus-visible {
    ${focusRingShorthandInward}
  }
  .maplibregl-ctrl-group button:disabled {
    ${disabledControl}
  }
  .map-scene-control-icon {
    display: block;
    inline-size: var(--lr-size-1em);
    block-size: var(--lr-size-1em);
    margin-inline: auto;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .maplibregl-ctrl-group button:where([aria-pressed='true'], [aria-pressed='mixed']) {
    --_map-scene-control-fill: var(--lr-map-control-pressed-bg, var(--lr-color-brand-quiet));
    background: var(--_map-scene-control-fill);
    color: var(--lr-map-control-pressed-color, var(--lr-color-brand));
  }
  .maplibregl-ctrl-group button:where([aria-pressed='true'], [aria-pressed='mixed']):hover:where(:not(:disabled)) {
    background: var(--lr-map-control-hover-bg, ${hoverFill('var(--_map-scene-control-fill)')});
  }
  .maplibregl-ctrl-group button:where([aria-pressed='true'], [aria-pressed='mixed']):active:where(:not(:disabled)) {
    background: var(--lr-map-control-active-bg, ${activeFill('var(--_map-scene-control-fill)')});
  }
  .maplibregl-ctrl-icon {
    position: relative;
    display: block;
    inline-size: var(--lr-size-1em);
    block-size: var(--lr-size-1em);
    font-size: var(--lr-font-size-lg);
  }
  .maplibregl-ctrl-icon::before,
  .maplibregl-ctrl-compass .maplibregl-ctrl-icon::after {
    content: '';
    position: absolute;
    inset: 0;
    background: currentColor;
    mask-position: center;
    mask-size: contain;
    mask-repeat: no-repeat;
  }
  .maplibregl-ctrl-zoom-in .maplibregl-ctrl-icon::before {
    mask-image: url('data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Cpath d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/%3E%3C/svg%3E');
  }
  .maplibregl-ctrl-zoom-out .maplibregl-ctrl-icon::before {
    mask-image: url('data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Cpath d="M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/%3E%3C/svg%3E');
  }
  .maplibregl-ctrl-compass .maplibregl-ctrl-icon::before {
    mask-image: url('data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Cpath d="M12 2 18 12H6Z"/%3E%3C/svg%3E');
  }
  .maplibregl-ctrl-compass .maplibregl-ctrl-icon::after {
    mask-image: url('data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Cpath d="m12 22 6-10H6Z"/%3E%3C/svg%3E');
    opacity: var(--lr-opacity-disabled);
  }
  .maplibregl-ctrl-geolocate .maplibregl-ctrl-icon::before {
    mask-image: url('data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Ccircle cx="12" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="2"/%3E%3Ccircle cx="12" cy="12" r="2"/%3E%3Cpath d="M12 2v4m0 12v4M2 12h4m12 0h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/%3E%3C/svg%3E');
  }
  .maplibregl-ctrl-scale {
    position: relative;
    box-sizing: border-box;
    min-inline-size: max-content;
    /* The block end always adds the scale bar's own height, so a padding token never covers it. */
    padding-block: var(--lr-map-scale-padding-block, var(--lr-space-2xs));
    padding-inline: var(--lr-map-scale-padding-inline, var(--lr-space-xs));
    padding-block-end: calc(var(--lr-map-scale-padding-block, var(--lr-space-2xs)) + var(--lr-space-xs));
    border: var(--lr-map-scale-border, none);
    border-radius: var(--lr-map-scale-radius, 0);
    background: var(--lr-color-surface);
    color: var(--lr-map-scale-color, var(--lr-color-text));
    font-family: var(--lr-font);
    font-size: var(--lr-map-scale-font-size, var(--lr-font-size-xs));
    text-align: center;
    white-space: nowrap;
  }
  .maplibregl-ctrl-scale::after {
    content: '';
    display: var(--lr-map-scale-bar-display, block);
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
    display: inline-flex;
    align-items: center;
    min-inline-size: var(--lr-size-24px);
    min-block-size: var(--lr-size-24px);
    padding: var(--lr-map-attribution-link-padding, 0);
    color: var(--lr-color-text-quiet);
    text-decoration: none;
  }
  .maplibregl-ctrl-attrib a:hover {
    text-decoration: underline;
  }
  .maplibregl-ctrl-attrib a:focus-visible {
    ${focusRing}
  }
  .maplibregl-ctrl-attrib-inner {
    overflow-wrap: anywhere;
  }
  .maplibregl-ctrl-attrib-button {
    display: none;
    position: absolute;
    inset-block-start: 0;
    inset-inline-end: 0;
    inline-size: var(--lr-map-attribution-toggle-size, var(--lr-map-control-size, var(--lr-icon-button-size)));
    block-size: var(--lr-map-attribution-toggle-size, var(--lr-map-control-size, var(--lr-icon-button-size)));
    padding: 0;
    border: 0;
    border-radius: var(--lr-map-attribution-toggle-radius, var(--lr-map-control-radius, var(--lr-radius-pill)));
    background: transparent;
    color: var(--lr-map-control-color, var(--lr-color-text));
    cursor: pointer;
    place-items: center;
    ${interactiveTransition}
  }
  .maplibregl-ctrl-attrib-button::before {
    content: '';
    display: block;
    inline-size: var(--lr-map-attribution-toggle-icon-size, var(--lr-size-1rem));
    block-size: var(--lr-map-attribution-toggle-icon-size, var(--lr-size-1rem));
    background: currentColor;
    mask: url('data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Ccircle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/%3E%3Cpath d="M12 10v7m0-10v.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/%3E%3C/svg%3E') center / contain no-repeat;
  }
  .maplibregl-ctrl-attrib.maplibregl-compact {
    position: relative;
    min-block-size: var(--lr-map-attribution-toggle-size, var(--lr-map-control-size, var(--lr-icon-button-size)));
    padding-inline-end: var(--lr-map-attribution-toggle-size, var(--lr-map-control-size, var(--lr-icon-button-size)));
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
  /* Open is the expanded state, painted like a pressed scene control; hover and press follow the
     shared action pointer tokens and stay distinct from it. */
  .maplibregl-ctrl-attrib:where([open]) .maplibregl-ctrl-attrib-button {
    --_map-attrib-fill: var(--lr-map-control-pressed-bg, var(--lr-color-brand-quiet));
    --_map-attrib-hover-fill: ${hoverFill('var(--_map-attrib-fill)')};
    background: var(--_map-attrib-fill);
  }
  .maplibregl-ctrl-attrib-button:hover {
    background: var(--lr-map-control-hover-bg, var(--_map-attrib-hover-fill, var(--lr-color-brand-quiet)));
  }
  .maplibregl-ctrl-attrib-button:active {
    background: var(--lr-map-control-active-bg, ${activeFill('var(--_map-attrib-fill, var(--lr-color-brand-quiet))')});
  }
  .maplibregl-ctrl-attrib-button:focus-visible {
    ${focusRingShorthandInward}
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

  /* One material for chrome and actions: only the action parts set the private action fill, and no
     chrome surface sits inside an action, so the chrome resolves the plain surface fill. */
  ${glassSurface('.maplibregl-ctrl-group, .maplibregl-ctrl-scale, .maplibregl-ctrl-attrib, [part~="initialization-control"], [part="drawing-summary"], [part="drawing-status"], [part="drawing-measurement"], [part="pick-center"], [part="pick-cancel"], [part="drawing-add"], [part="drawing-undo"], [part="drawing-complete"], [part="drawing-cancel"], [part="anchor-close"], [part="scene-toggle"], button[part="scene-item"], [part="scene-pagination"] button', css`var(--_lr-map-action-fill, var(--_lr-map-control-fill, var(--lr-color-surface)))`)}
  /* Only the control chrome reads the public control fill; actions keep the action fill. */
  .maplibregl-ctrl-group, .maplibregl-ctrl-scale, .maplibregl-ctrl-attrib, [part~='initialization-control'] {
    --_lr-map-control-fill: var(--lr-map-control-bg, var(--lr-color-surface));
  }
  .maplibregl-ctrl-scale {
    --_lr-map-control-fill: var(--lr-map-scale-bg, var(--lr-map-control-bg, var(--lr-color-surface)));
  }
  [part='anchor-close']:where(:hover) {
    --_lr-map-action-fill: var(--lr-map-popup-close-button-hover-bg, var(--lr-map-action-hover-bg, var(--lr-color-brand-quiet)));
    color: var(--lr-map-popup-close-button-hover-color, var(--lr-color-brand));
  }
  [part='anchor-close']:where(:active) {
    --_lr-map-action-fill: var(--lr-map-popup-close-button-active-bg, var(--lr-map-action-active-bg, ${activeFill('var(--lr-color-brand-quiet)')}));
    color: var(--lr-map-popup-close-button-active-color, var(--lr-color-brand));
  }
  ${glassScrollLayerStyles}
  [part='legend'] > .glass-scroll-layer {
    /* The zero-size anchor must not add a flex gap before the visible legend content. */
    margin-block-end: calc(-1 * var(--lr-map-legend-gap, var(--lr-space-xs)));
  }
  ${glassSurface('[part="legend"]', css`var(--lr-map-legend-bg, var(--lr-color-surface))`, css`var(--lr-map-legend-bg, var(--lr-color-surface))`, true)}

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
       on CanvasText, which would erase the symbol entirely. Its border is already removed by the
       base icon rule; the glyph silhouette remains the non-color cue. */
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
    /* Author fills are replaced here, so hover on a native control gets a system-colour edge. */
    .maplibregl-ctrl-group button:hover:not(:disabled),
    .maplibregl-ctrl-attrib-button:hover {
      outline: var(--lr-border-width-thin) solid Highlight;
      outline-offset: calc(-1 * var(--lr-border-width-thin));
    }
  }
  ${forcedColorsPart(".maplibregl-ctrl-group button:is([aria-pressed='true'], [aria-pressed='mixed']), .maplibregl-ctrl-attrib[open] .maplibregl-ctrl-attrib-button")}
`;
