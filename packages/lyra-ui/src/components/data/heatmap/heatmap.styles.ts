import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
    /* Sequential ramp endpoints for the data-driven cell colors. Canvas can't consume var(), so
       heatmap.ts resolves these through getComputedStyle and interpolates between them; tokens,
       not literals, so hosts retheme the ramp without raw hex in the public API. */
    --_lr-heatmap-scale-lo: var(--lr-color-brand-quiet);
    --_lr-heatmap-scale-hi: var(--lr-color-brand);
    /* No-data cell fill (the -1 sentinel / NaN case), resolved like the ramp above -- a token so
       hosts can retheme it rather than a literal in heatmap.ts. */
    --_lr-heatmap-no-data-fill: var(--lr-color-no-data);
    /* Canvas-drawn axis/month/weekday label font, resolved like the ramp above. */
    --_lr-heatmap-label-font: var(--lr-size-10px) var(--lr-font);
    /* [part="tooltip"] is real DOM, so it consumes these var()s directly -- no getComputedStyle.
       Own tokens rather than bare --lr-color-surface/-text so a host can retheme just the heatmap
       tooltip, as chart.ts does with --lr-chart-tooltip-bg/-text. */
    --_lr-heatmap-tooltip-bg: var(--lr-color-surface);
    --_lr-heatmap-tooltip-text: var(--lr-color-text);
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
  }
  [part="base"] {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
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
    outline: var(--lr-size-1px) solid
      var(--lr-heatmap-focus-ring-color, var(--_lr-heatmap-focus-ring-color));
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* Neither the canvas nor a cell has a background to tint -- the fill under the pointer is
     painted into the bitmap from consumer data -- so the outline carries the feedback, and the
     pressed step is the ring thickening from a hairline to the full focus-ring width. */
  [part="canvas"]:active {
    outline: var(--lr-focus-ring-width) solid
      var(--lr-heatmap-focus-ring-color, var(--_lr-heatmap-focus-ring-color));
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part="cells"] {
    position: absolute;
    inset: 0;
    direction: ltr;
    pointer-events: none;
  }
  .cell-row {
    display: contents;
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
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
  }
  [part="cell"]:hover {
    outline: var(--lr-size-1px) solid
      var(--lr-heatmap-focus-ring-color, var(--_lr-heatmap-focus-ring-color));
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part="cell"]:active {
    outline: var(--lr-focus-ring-width) solid
      var(--lr-heatmap-focus-ring-color, var(--_lr-heatmap-focus-ring-color));
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part="cell"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid
      var(--lr-heatmap-focus-ring-color, var(--_lr-heatmap-focus-ring-color));
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part="canvas"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid
      var(--lr-heatmap-focus-ring-color, var(--_lr-heatmap-focus-ring-color));
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part="tooltip"] {
    position: absolute;
    transform: translate(-50%, -100%);
    margin-block-start: var(--lr-size-neg-6px);
    padding: var(--lr-size-2px) var(--lr-size-6px);
    border-radius: var(--lr-radius);
    background: var(--lr-heatmap-tooltip-bg, var(--_lr-heatmap-tooltip-bg));
    color: var(--lr-heatmap-tooltip-text, var(--_lr-heatmap-tooltip-text));
    font-size: var(--lr-font-size-xs);
    white-space: nowrap;
    box-shadow: var(--lr-shadow-m);
    pointer-events: none;
    z-index: var(--lr-layer-content);
  }
  [part="tooltip"][hidden] {
    display: none;
  }
  [part="legend"] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
    max-inline-size: 100%;
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
    overflow-wrap: anywhere;
  }
  [part="legend"] .bar {
    flex: 0 1 var(--lr-size-6rem);
    min-inline-size: 0;
    inline-size: var(--lr-size-6rem);
    block-size: var(--lr-size-0-5rem);
    border-radius: var(--lr-size-2px);
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
    inline-size: var(--lr-size-0-6rem);
    block-size: var(--lr-size-0-6rem);
    border-radius: var(--lr-radius-xs);
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
    inline-size: var(--lr-size-0-6rem);
    block-size: var(--lr-size-0-6rem);
    border-radius: 50%;
    border: var(--lr-border-width-medium) solid
      var(--lr-heatmap-annotation-color, var(--_lr-heatmap-annotation-color));
  }
`;
