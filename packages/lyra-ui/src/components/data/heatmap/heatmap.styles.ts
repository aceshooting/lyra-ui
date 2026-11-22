import { activeFill, focusRingOffset, focusRingOutline, iconHitTarget } from '../../../internal/interactive-control.styles.js';
import { css } from 'lit';
import { blockHost } from '../../../internal/layout-fragments.styles.js';

export const styles = css`
  .source-axes { display: flex; justify-content: space-between; gap: var(--lr-space-xs); font-size: var(--lr-font-size-sm); }
  [part="source-exact-window"] { overflow: auto; max-inline-size: 100%; contain: inline-size; }
  [part="source-exact-window"] [role="row"] { display: flex; inline-size: max-content; }
  [part="source-exact-window"] [role="gridcell"] { flex: none; }
  [part="source-exact-window"] [part="cell"] {
    position: relative; inline-size: auto; block-size: auto;
    min-inline-size: var(--lr-icon-button-size); min-block-size: var(--lr-icon-button-size);
    padding: var(--lr-space-xs); white-space: nowrap;
    color: var(--lr-color-text); background: var(--lr-color-surface);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
  }

  :host {
    ${blockHost}
    /* Sequential ramp endpoints for the data-driven cell colors. Canvas can't consume var(), so
       heatmap.class.ts resolves these through getComputedStyle and interpolates between them; tokens,
       not literals, so hosts retheme the ramp without raw hex in the public API. */
    --_lr-heatmap-scale-lo: var(--lr-color-brand-quiet);
    --_lr-heatmap-scale-hi: var(--lr-color-brand);
    /* No-data cell fill (the -1 sentinel / NaN case), resolved like the ramp above -- a token so
       hosts can retheme it rather than a literal in heatmap.class.ts. */
    --_lr-heatmap-no-data-fill: var(--lr-color-no-data);
    /* Canvas-drawn axis/month/weekday label font, resolved like the ramp above. */
    --_lr-heatmap-label-font: var(--lr-size-10px) var(--lr-font);
    /* [part="tooltip"] is real DOM, so it consumes these var()s directly -- no getComputedStyle.
       Own tokens rather than bare --lr-color-surface/-text so a host can retheme just the heatmap
       tooltip, as chart.class.ts does with its own tooltip properties. */
    --_lr-heatmap-tooltip-bg: var(--lr-color-surface);
    --_lr-heatmap-tooltip-color: var(--lr-color-text);
    /* Canvas-drawn focus ring on the keyboard-focused cell, resolved like the ramp above. Own
       token, defaulting to --lr-focus-ring-color, so it retunes apart from every other
       :focus-visible outline; [part="canvas"]:focus-visible below reuses it. */
    --_lr-heatmap-focus-ring-color: var(--lr-focus-ring-color);
    /* Canvas-drawn ring around annotated cells, resolved like the ramp above. --lr-color-danger is
       loud and distinct from the sequential data ramp, so it reads against any point on it. */
    --_lr-heatmap-annotation-color: var(--lr-color-danger);
    /* Canvas-drawn ring around the persistent selectedCell, resolved like the ramp above. Its own
       token so it retunes apart from the focus ring (--lr-heatmap-focus-ring-color) and annotation
       ring (--lr-heatmap-annotation-color) it is drawn between. */
    --_lr-heatmap-selected-color: var(--lr-color-success);
    /* Backdrop painted under a frozen sticky-labels band, resolved like the ramp above. It covers
       the same labels the scrolling cell canvas painted underneath it, so it has to be an opaque
       surface color rather than a transparent one. */
    --_lr-heatmap-sticky-label-bg: var(--lr-color-surface);
  }
  [part="base"] {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  /* A suspended fitted bitmap can outlive its previous allocation. Keep that stale frame and
     its cell projection contained until the next visible draw restores their shared geometry. */
  /* fill: the host and base take a definite parent's block size, and the scrollport takes what the
     legend leaves, so the grid -- not an outer container -- scrolls, keeping frozen bands working. */
  :host([fill]) {
    block-size: 100%;
    min-block-size: 0;
  }
  :host([fill]) [part="base"] {
    block-size: 100%;
    box-sizing: border-box;
  }
  :host([fill]) [part="grid"] {
    flex: 1 1 auto;
    min-block-size: 0;
  }
  /* fit-block: no definite parent needed. The base inherits the host's own max-block-size, so the
     heatmap takes its content height up to that ceiling and the scrollport shrinks to what the
     legend leaves inside it. */
  :host([fit-block]) {
    min-block-size: 0;
  }
  :host([fit-block]) [part="base"] {
    max-block-size: inherit;
    box-sizing: border-box;
  }
  :host([fit-block]) [part="grid"] {
    flex: 1 1 auto;
    min-block-size: 0;
  }
  [part="base"]:where([data-fit-frame-contained]) {
    overflow: clip;
  }
  [part="base"]:where([data-fit-frame-contained]) [part="canvas"] {
    max-inline-size: 100%;
  }
  canvas {
    display: block;
    inline-size: 100%;
    /* ctx.direction defaults to 'inherit' and labels use the default textAlign:'start', so under
       an ancestor dir="rtl" a left-drawn row label (x=2/x=4) anchors right, runs off the left edge
       and keeps only its trailing glyph. The grid is positioned physically either way (see the
       [part='cells'] direction:ltr pin and heatmap.class.ts's arrow-key note), so the canvas is
       pinned LTR too. */
    direction: ltr;
    /* Visible only while the canvas is the clickable surface (the default, accessible-cells
       unset): [part='canvas'][aria-hidden] below drops pointer-events once the overlay takes over
       hit-testing, so no pointer appears over a canvas the mouse can't use. */
    cursor: pointer;
  }
  [part="canvas"]:hover {
    outline: var(--lr-border-width-thin) solid
      var(--lr-heatmap-hover-ring-color, var(--lr-heatmap-focus-ring-color, var(--_lr-heatmap-focus-ring-color)));
    ${focusRingOffset}
  }
  :host([multiple]) [part='canvas'],
  :host([multiple]) [part='cell'] {
    touch-action: none;
    user-select: none;
  }
  /* Neither the canvas nor a cell has a background to tint -- the fill under the pointer is
     painted into the bitmap from consumer data -- so the outline carries the feedback, and the
     pressed step is the ring thickening from a hairline to the full focus-ring width. */
  [part="canvas"]:active {
    ${focusRingOutline('var(--lr-heatmap-focus-ring-color, var(--_lr-heatmap-focus-ring-color))')}
    ${focusRingOffset}
  }
  [part="cells"] {
    position: absolute;
    inset: 0;
    direction: ltr;
    pointer-events: none;
  }
  /* Frozen sticky-labels bands, rendered only while stickyLabels freezes an axis.
     [part='grid'] is the scrollport the bands stick to -- position:sticky needs a scroll container
     ancestor, and without one the whole feature is silently inert. Pinned direction:ltr for the
     same reason the canvas and [part='cells'] above are: both grid modes keep physical LTR
     geometry, so the logical inset-inline-start below has to resolve to the physical left in RTL
     too, where the gutter the band covers is still painted. */
  [part="grid"] {
    position: relative;
    overflow: auto;
    direction: ltr;
    min-inline-size: 0;
    max-inline-size: 100%;
    max-block-size: var(--lr-heatmap-grid-max-block-size, none);
  }
  /* A single-area grid, so every layer is placed at the same origin: a band's static position is
     the cell canvas's own start corner, which is what makes the sticky offset -- and therefore the
     band -- pixel-aligned with the cells without measuring anything. */
  .grid-stack {
    position: relative;
    display: grid;
    grid-template-areas: 'stack';
  }
  .grid-stack > * {
    grid-area: stack;
    align-self: start;
    justify-self: start;
  }
  [part="row-labels"],
  [part="col-labels"] {
    position: sticky;
    display: block;
    /* The band duplicates pixels the cell canvas already painted, so it must never take the
       pointer: hit-testing reads offsetX/offsetY against the cell canvas, and an intercepting band
       would report coordinates in its own box instead. */
    pointer-events: none;
    z-index: var(--lr-layer-content);
  }
  /* One axis each: the frozen band holds its own axis and scrolls freely along the other, which is
     what keeps every label beside the row or above the column it describes. */
  [part="row-labels"] {
    inset-inline-start: 0;
  }
  [part="col-labels"] {
    inset-block-start: 0;
  }
  .cell-row {
    display: contents;
  }
  /* A top legend precedes the surface; this frame restores the canvas origin for the overlays. */
  .surface-frame {
    position: relative;
  }
  /* axisSelection label buttons: transparent targets laid over the painted labels, physical LTR
     like the grid they describe. Inside the stickyLabels stack a frozen axis keeps its buttons. */
  .axis-targets {
    position: absolute;
    inset-block-start: 0;
    inset-inline-start: 0;
    direction: ltr;
    pointer-events: none;
    z-index: var(--lr-layer-content);
  }
  .grid-stack > .axis-targets {
    position: relative;
  }
  .grid-stack > .axis-targets[data-frozen-rows] {
    position: sticky;
    inset-inline-start: 0;
  }
  .grid-stack > .axis-targets[data-frozen-cols] {
    position: sticky;
    inset-block-start: 0;
  }
  [part~="row-label"],
  [part~="col-label"] {
    position: absolute;
    box-sizing: border-box;
    padding: 0;
    border: 0;
    border-radius: var(--lr-radius-xs);
    background: transparent;
    color: transparent;
    cursor: pointer;
    pointer-events: auto;
    transition: var(--lr-transition-interactive);
    ${iconHitTarget}
  }
  [part~="row-label"]:disabled,
  [part~="col-label"]:disabled {
    cursor: default;
  }
  [part~="row-label-pressed"] {
    box-shadow: inset var(--lr-border-width-thick) 0 0 0 var(--lr-heatmap-axis-pressed-color, var(--lr-color-brand));
  }
  [part~="col-label-pressed"] {
    box-shadow: inset 0 calc(-1 * var(--lr-border-width-thick)) 0 0 var(--lr-heatmap-axis-pressed-color, var(--lr-color-brand));
  }
  [part~="row-label"]:enabled:hover,
  [part~="col-label"]:enabled:hover {
    background: var(--lr-heatmap-axis-hover-bg, color-mix(in srgb, var(--lr-color-brand) 12%, transparent));
  }
  [part~="row-label"]:enabled:active,
  [part~="col-label"]:enabled:active {
    background: ${activeFill('var(--lr-heatmap-axis-hover-bg, color-mix(in srgb, var(--lr-color-brand) 12%, transparent))')};
  }
  [part~="row-label"]:focus-visible,
  [part~="col-label"]:focus-visible {
    ${focusRingOutline('var(--lr-heatmap-focus-ring-color, var(--_lr-heatmap-focus-ring-color))')}
    ${focusRingOffset}
  }
  [part="cell"] {
    position: absolute;
    display: block;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: transparent;
    cursor: pointer;
    pointer-events: auto;
    ${iconHitTarget}
  }
  [part="cell"]:hover {
    outline: var(--lr-border-width-thin) solid
      var(--lr-heatmap-hover-ring-color, var(--lr-heatmap-focus-ring-color, var(--_lr-heatmap-focus-ring-color)));
    ${focusRingOffset}
  }
  [part="cell"]:active {
    ${focusRingOutline('var(--lr-heatmap-focus-ring-color, var(--_lr-heatmap-focus-ring-color))')}
    ${focusRingOffset}
  }
  [part="cell"]:focus-visible {
    ${focusRingOutline('var(--lr-heatmap-focus-ring-color, var(--_lr-heatmap-focus-ring-color))')}
    ${focusRingOffset}
  }
  [part="canvas"]:focus-visible {
    ${focusRingOutline('var(--lr-heatmap-focus-ring-color, var(--_lr-heatmap-focus-ring-color))')}
    ${focusRingOffset}
  }
  [part="tooltip"] {
    position: absolute;
    transform: translate(-50%, -100%);
    margin-block-start: var(--lr-size-neg-6px);
    padding: var(--lr-size-2px) var(--lr-size-6px);
    border-radius: var(--lr-radius);
    background: var(--lr-heatmap-tooltip-bg, var(--_lr-heatmap-tooltip-bg));
    color: var(
      --lr-heatmap-tooltip-color,
      var(--_lr-heatmap-tooltip-color)
    );
    font-size: var(--lr-font-size-xs);
    white-space: nowrap;
    box-shadow: var(--lr-shadow-m);
    pointer-events: none;
    z-index: var(--lr-layer-content);
  }
  /* Formatted text -- the cellText tooltip, the numeric scale endpoints, legendStops captions --
     is its own bidi paragraph whose direction comes from its first strong character, like
     <bdi>: a number-first value (2.4 MiB/s, -3) otherwise inherits an RTL host's base direction
     and paints unit- or sign-last. Each is a shrink-wrapped box, so nothing is realigned. */
  [part="tooltip"],
  [part="legend-lo"],
  [part="legend-hi"],
  [part="legend-stop-label"] {
    unicode-bidi: plaintext;
  }
  /* Flipped to below the cell when the frozen band, or the block start of the scrollport, leaves
     no room above it -- an unfrozen heatmap never takes this branch, because nothing clips it
     there. The gap mirrors the negative one above, so the tooltip keeps the same distance from
     the cell either way. */
  [part="tooltip"].tooltip-below {
    transform: translate(-50%, 0);
    margin-block-start: var(--lr-size-6px);
  }
  [part="tooltip"][hidden] {
    display: none;
  }
  [part="legend"] {
    display: flex;
    flex: none;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-heatmap-legend-gap, var(--lr-space-xs));
    justify-content: var(--lr-heatmap-legend-justify, normal);
    /* The base column already gaps the grid and legend by --lr-space-xs; the margin on the edge
       facing the grid makes --lr-heatmap-legend-offset the whole distance. */
    --_lr-heatmap-legend-offset: calc(var(--lr-heatmap-legend-offset, var(--lr-space-xs)) - var(--lr-space-xs));
    margin-block-start: var(--_lr-heatmap-legend-offset);
    min-inline-size: 0;
    max-inline-size: 100%;
    box-sizing: border-box;
    padding: var(--lr-heatmap-legend-padding, 0);
    border-radius: var(--lr-heatmap-legend-radius, 0);
    background: var(--lr-heatmap-legend-bg, transparent);
    font-family: var(--lr-heatmap-legend-font-family, inherit);
    font-size: var(--lr-heatmap-legend-font-size, var(--lr-font-size-xs));
    color: var(--lr-heatmap-legend-color, var(--lr-color-text-quiet));
    overflow-wrap: anywhere;
    /* The divider sits on the edge facing the grid: above a bottom legend, below a top one. */
    border-block-start: var(--lr-heatmap-legend-divider, none);
  }
  :host([legend-placement="top"]) [part="legend"] {
    margin-block: 0 var(--_lr-heatmap-legend-offset);
    border-block-start: none;
    border-block-end: var(--lr-heatmap-legend-divider, none);
  }
  [part="legend"] .bar {
    flex: 0 1 var(--lr-heatmap-legend-ramp-inline-size, var(--lr-size-6rem));
    min-inline-size: 0;
    inline-size: var(--lr-heatmap-legend-ramp-inline-size, var(--lr-size-6rem));
    block-size: var(--lr-heatmap-legend-ramp-block-size, var(--lr-size-0-5rem));
    border-radius: var(--lr-heatmap-legend-ramp-radius, var(--lr-size-2px));
    background: var(
      --lr-heatmap-color-steps-gradient,
      linear-gradient(
        to right,
        var(--lr-heatmap-scale-lo, var(--_lr-heatmap-scale-lo)),
        var(--lr-heatmap-scale-hi, var(--_lr-heatmap-scale-hi))
      )
    );
  }
  /* Flex row order already follows inherited direction, putting the low endpoint at inline-start;
     mirror the physical gradient too so its colors stay aligned with those labels, custom step
     ramps included. */
  :host(:dir(rtl)) [part="legend"] .bar {
    transform: scaleX(-1);
  }
  /* One discrete legendStops entry. Same swatch-then-text shape (and the same gap) as
     [part='legend-annotation'] below, so a legend mixing stops and annotations reads as one row. */
  [part="legend-stop"] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-size-3px);
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
  /* The swatch's background is the consumer-supplied stop color, applied inline per stop --
     it's data, not a themeable design value, so it can't live here. */
  [part="legend-swatch"] {
    flex: 0 0 auto;
    inline-size: var(--lr-heatmap-legend-swatch-size, var(--lr-size-0-6rem));
    block-size: var(--lr-heatmap-legend-swatch-size, var(--lr-size-0-6rem));
    border-radius: var(--lr-heatmap-legend-swatch-radius, var(--lr-radius-xs));
  }
  [part="legend-stop-label"] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
    font-variant-numeric: tabular-nums;
  }
  [part="legend-lo"],
  [part="legend-hi"],
  [part="legend-value-label"] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
  [part="legend-annotation"] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-size-3px);
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
  [part="legend-annotation"] .ring-swatch {
    flex: 0 0 auto;
    inline-size: var(--lr-heatmap-legend-swatch-size, var(--lr-size-0-6rem));
    block-size: var(--lr-heatmap-legend-swatch-size, var(--lr-size-0-6rem));
    border-radius: 50%;
    border: var(--lr-border-width-medium) solid
      var(--lr-heatmap-annotation-color, var(--_lr-heatmap-annotation-color));
  }

  @media (forced-colors: active) {
    [part="legend"] .bar,
    [part="legend-swatch"],
    [part="legend-annotation"] .ring-swatch {
      forced-color-adjust: none;
      outline: var(--lr-border-width-thin) solid CanvasText;
    }
    /* Forced colors drop the inset pressed bar and the hover tint, so a system-colour border
       carries both states. */
    [part~="row-label"]:enabled:hover,
    [part~="col-label"]:enabled:hover {
      border: var(--lr-border-width-thin) solid ButtonText;
    }
    [part~="row-label-pressed"],
    [part~="col-label-pressed"] {
      border: var(--lr-border-width-thick) solid Highlight;
    }
  }
`;
