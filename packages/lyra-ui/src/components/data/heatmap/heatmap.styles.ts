import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    /* Sequential ramp endpoints for the data-driven cell colors (canvas can't
       consume var() directly, so heatmap.ts resolves these via
       getComputedStyle and interpolates between them). Component-specific
       business color — exposed so hosts can retheme
       the ramp without raw hex leaking into the public API. */
    --lr-heatmap-scale-lo: var(--lr-color-brand-quiet);
    --lr-heatmap-scale-hi: var(--lr-color-brand);
    /* No-data cell fill (the -1 sentinel / NaN case) — same resolve-via-
       getComputedStyle pattern as the ramp endpoints above, so hosts can
       retheme it instead of it being a hardcoded literal in heatmap.ts. */
    --lr-heatmap-no-data-fill: var(--lr-color-no-data);
    /* Canvas-drawn axis/month/weekday label font — same resolve-via-
       getComputedStyle pattern as the ramp endpoints above (canvas can't
       consume var() directly). */
    --lr-heatmap-label-font: var(--lr-size-10px) var(--lr-font);
    /* [part="tooltip"] is a real DOM element (not canvas-drawn), so unlike
       the tokens above it consumes these var()s directly — no getComputedStyle
       resolution needed. Own tokens (not the bare --lr-color-surface/-text)
       so a host can retheme just the heatmap tooltip, same rationale as
       chart.ts's --lr-chart-tooltip-bg/-text. */
    --lr-heatmap-tooltip-bg: var(--lr-color-surface);
    --lr-heatmap-tooltip-text: var(--lr-color-text);
    /* Canvas-drawn focus-ring stroke around the keyboard-focused cell — same
       resolve-via-getComputedStyle pattern as the ramp endpoints (canvas
       can't consume var() directly). A dedicated token (rather than reusing
       --lr-focus-ring-color straight from tokens.styles.ts) so a host can
       retheme the in-canvas ring independently of every other :focus-visible
       outline in the library, while defaulting to that same brand color —
       also reused by the [part="canvas"]:focus-visible outline below so the
       two stay visually in sync. */
    --lr-heatmap-focus-ring-color: var(--lr-focus-ring-color);
    /* Canvas-drawn ring around annotated cells — same resolve-via-
       getComputedStyle pattern. Defaults to --lr-color-danger (a loud,
       attention-grabbing color distinct from the sequential data ramp) so an
       annotation reads clearly against any point on that ramp. */
    --lr-heatmap-annotation-color: var(--lr-color-danger);
    /* Canvas-drawn ring around the persistently selectedCell — same
       resolve-via-getComputedStyle pattern. A dedicated token so a host can
       retheme it independently of the focus ring
       (--lr-heatmap-focus-ring-color) and the annotation ring
       (--lr-heatmap-annotation-color) it's drawn between. */
    --lr-heatmap-selected-color: var(--lr-color-success);
  }
  [part='base'] {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
  }
  canvas {
    display: block;
    inline-size: 100%;
    /* The 2D context defaults ctx.direction to 'inherit' (the canvas element's computed
       direction), and the axis labels are drawn with the default textAlign:'start'. Under an
       ancestor dir="rtl" that 'start' anchors to the right, so a left-drawn row label (x=2/x=4)
       runs off the left edge and only its trailing glyph survives ("Mon" -> "n"). The grid is
       positioned physically regardless of direction (see the [part='cells'] direction:ltr pin
       and the arrow-key note in heatmap.class.ts), so the canvas is pinned LTR to match. */
    direction: ltr;
  }
  [part='canvas'][aria-hidden] {
    pointer-events: none;
  }
  [part='cells'] {
    position: absolute;
    inset: 0;
    direction: ltr;
    pointer-events: none;
  }
  [part='cell'] {
    position: absolute;
    display: block;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: transparent;
    cursor: pointer;
    pointer-events: auto;
  }
  [part='cell']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-heatmap-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='canvas']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-heatmap-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='tooltip'] {
    position: absolute;
    transform: translate(-50%, -100%);
    margin-block-start: var(--lr-size-neg-6px);
    padding: var(--lr-size-2px) var(--lr-size-6px);
    border-radius: var(--lr-radius);
    background: var(--lr-heatmap-tooltip-bg);
    color: var(--lr-heatmap-tooltip-text);
    font-size: var(--lr-font-size-xs);
    white-space: nowrap;
    box-shadow: var(--lr-shadow);
    pointer-events: none;
    z-index: var(--lr-layer-content);
  }
  [part='tooltip'][hidden] {
    display: none;
  }
  [part='legend'] {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
  }
  [part='legend'] .bar {
    inline-size: var(--lr-size-6rem);
    block-size: var(--lr-size-0-5rem);
    border-radius: var(--lr-size-2px);
    background: var(
      --lr-heatmap-color-steps-gradient,
      linear-gradient(to right, var(--lr-heatmap-scale-lo), var(--lr-heatmap-scale-hi))
    );
  }
  /* Flex row order already follows inherited direction, placing the low
     endpoint at inline-start. Mirror the physical CSS gradient as well so
     its colors stay aligned with those labels, including custom step ramps. */
  :host(:dir(rtl)) [part='legend'] .bar {
    transform: scaleX(-1);
  }
  /* One discrete legendStops entry. Same swatch-then-text shape (and the same gap) as
     [part='legend-annotation'] below, so a legend mixing stops and annotations reads as one row. */
  [part='legend-stop'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-size-3px);
  }
  /* The swatch's background is the consumer-supplied stop color, applied inline per stop --
     it's data, not a themeable design value, so it can't live here. */
  [part='legend-swatch'] {
    flex: 0 0 auto;
    inline-size: var(--lr-size-0-6rem);
    block-size: var(--lr-size-0-6rem);
    border-radius: var(--lr-radius-xs);
  }
  [part='legend-stop-label'] {
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  [part='legend-annotation'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-size-3px);
  }
  [part='legend-annotation'] .ring-swatch {
    inline-size: var(--lr-size-0-6rem);
    block-size: var(--lr-size-0-6rem);
    border-radius: 50%;
    border: var(--lr-border-width-medium) solid var(--lr-heatmap-annotation-color);
  }
`;
