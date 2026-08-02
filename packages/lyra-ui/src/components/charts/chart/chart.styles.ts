import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    position: relative;
    inline-size: 100%;
    min-inline-size: 0;
    min-block-size: var(--lr-chart-height, var(--lr-size-280px));
    block-size: auto;
    container-type: inline-size;
    /* Chart.js renders to canvas, not the DOM, so it can't consume CSS
       var() directly — chart.ts's themeColors() resolves these once per
       draw() via getComputedStyle, same pattern as heatmap.ts's scale-lo/-hi.
       Each is its own token (rather than reusing the semantic ones directly)
       so a host can retheme just the chart's grid/ticks/legend/tooltip
       without affecting unrelated text/border/surface colors elsewhere in
       the component, while still defaulting to those semantic tokens. */
    --lr-chart-grid-color: var(--lr-color-border);
    --lr-chart-tick-color: var(--lr-color-text-quiet);
    --lr-chart-legend-color: var(--lr-color-text);
    --lr-chart-tooltip-bg: var(--lr-color-surface);
    --lr-chart-tooltip-text: var(--lr-color-text);
  }
  [part='base'] {
    position: relative;
    inline-size: 100%;
    min-inline-size: 0;
    display: grid;
    grid-template-areas:
      'plot'
      'legend'
      'table';
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
  }
  .config-slot {
    display: none;
  }
  [part='plot'] {
    grid-area: plot;
    position: relative;
    inline-size: 100%;
    block-size: var(--lr-chart-height, var(--lr-size-280px));
    min-inline-size: 0;
  }
  [part='data-table'] {
    grid-area: table;
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-x: auto;
    overflow-y: hidden;
  }
  [part='data-table'] table {
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
  [part='legend'] {
    grid-area: legend;
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
    max-inline-size: 100%;
    padding-block: var(--lr-space-xs);
  }
  [part='legend-item'] {
    display: inline-flex;
    align-items: center;
    /* Both axes: a short series name leaves the swatch+label pair narrower than the
       min-inline-size hit-area floor below, and the default justify-content
       (normal => flex-start) dumped that slack on the trailing side. Safe against long names --
       overflow-wrap below wraps them instead of overflowing, so there is no slack left to
       redistribute and this becomes a no-op. */
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    max-inline-size: 100%;
    border: 0;
    border-radius: var(--lr-radius);
    padding: var(--lr-space-2xs);
    gap: var(--lr-space-2xs);
    background: transparent;
    color: var(--lr-chart-legend-color);
    font: inherit;
    text-align: start;
    overflow-wrap: anywhere;
    cursor: pointer;
  }
  [part='legend-item']:where(:hover) {
    background: var(--lr-color-brand-quiet);
  }
  /* Pressed: the same quiet brand tint pushed further toward the text colour, so the
     mousedown that toggles the series is visibly distinct from merely pointing at it. */
  [part='legend-item']:where(:active) {
    background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='legend-item']:where(:focus-visible) {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='legend-swatch'] {
    inline-size: var(--lr-space-s);
    block-size: var(--lr-space-s);
    flex: 0 0 auto;
    border-radius: var(--lr-radius-xs);
    --lr-chart-pattern-step: var(--lr-space-2xs);
  }
  /* These attributes are emitted only while (forced-colors: active) matches. The inline system
     color remains one channel; texture mirrors the canvas pattern so repeated colors stay distinct
     in the DOM legend as well. The swatch is the data key, while its enclosing button/focus chrome
     remains system-controlled. */
  [part='legend-swatch'][data-encoding] {
    forced-color-adjust: none;
    border: var(--lr-border-width-thin) solid currentColor;
    background-size: var(--lr-chart-pattern-step) var(--lr-chart-pattern-step);
  }
  [part='legend-swatch'][data-encoding='solid'] {
    background-image: none;
  }
  [part='legend-swatch'][data-encoding='horizontal'] {
    background-image: repeating-linear-gradient(
      0deg,
      transparent 0 calc(var(--lr-chart-pattern-step) - var(--lr-border-width-thin)),
      var(--lr-color-surface) calc(var(--lr-chart-pattern-step) - var(--lr-border-width-thin))
        var(--lr-chart-pattern-step)
    );
  }
  [part='legend-swatch'][data-encoding='vertical'] {
    background-image: repeating-linear-gradient(
      90deg,
      transparent 0 calc(var(--lr-chart-pattern-step) - var(--lr-border-width-thin)),
      var(--lr-color-surface) calc(var(--lr-chart-pattern-step) - var(--lr-border-width-thin))
        var(--lr-chart-pattern-step)
    );
  }
  [part='legend-swatch'][data-encoding='diagonal'] {
    background-image: repeating-linear-gradient(
      45deg,
      transparent 0 calc(var(--lr-chart-pattern-step) - var(--lr-border-width-thin)),
      var(--lr-color-surface) calc(var(--lr-chart-pattern-step) - var(--lr-border-width-thin))
        var(--lr-chart-pattern-step)
    );
  }
  [part='legend-swatch'][data-encoding='reverse-diagonal'] {
    background-image: repeating-linear-gradient(
      -45deg,
      transparent 0 calc(var(--lr-chart-pattern-step) - var(--lr-border-width-thin)),
      var(--lr-color-surface) calc(var(--lr-chart-pattern-step) - var(--lr-border-width-thin))
        var(--lr-chart-pattern-step)
    );
  }
  [part='legend-swatch'][data-encoding='crosshatch'] {
    background-image:
      linear-gradient(
        0deg,
        transparent calc(50% - var(--lr-border-width-thin)),
        var(--lr-color-surface) calc(50% - var(--lr-border-width-thin)) 50%,
        transparent 50%
      ),
      linear-gradient(
        90deg,
        transparent calc(50% - var(--lr-border-width-thin)),
        var(--lr-color-surface) calc(50% - var(--lr-border-width-thin)) 50%,
        transparent 50%
      );
  }
  [part='legend-swatch'][data-encoding='dots'] {
    background-image: radial-gradient(
      circle,
      var(--lr-color-surface) 0 var(--lr-border-width-thin),
      transparent var(--lr-border-width-medium)
    );
  }
  [part='legend-swatch'][data-encoding='checker'] {
    background-image: conic-gradient(
      var(--lr-color-surface) 0 25%,
      transparent 25% 50%,
      var(--lr-color-surface) 50% 75%,
      transparent 75%
    );
  }
  [part='base']:where([data-legend-position='top']) {
    grid-template-areas:
      'legend'
      'plot'
      'table';
  }
  [part='base']:where([data-legend-position='left']) {
    grid-template-areas:
      'legend plot'
      'table table';
    grid-template-columns: minmax(0, auto) minmax(0, 1fr);
  }
  [part='base']:where([data-legend-position='right']) {
    grid-template-areas:
      'plot legend'
      'table table';
    grid-template-columns: minmax(0, 1fr) minmax(0, auto);
  }
  @container (max-width: 479px) {
    [part='base']:where([data-legend-position='left']),
    [part='base']:where([data-legend-position='right']) {
      grid-template-areas:
        'plot'
        'legend'
        'table';
      grid-template-columns: minmax(0, 1fr);
    }
  }
  lr-skeleton {
    --lr-skeleton-w: 100%;
    --lr-skeleton-h: var(--lr-chart-height, var(--lr-size-280px));
  }
  canvas {
    inline-size: 100% !important;
    block-size: 100% !important;
  }
  [part='canvas'] {
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
  }
  /* no-pressed-state: the canvas is a role="application" keyboard surface with no click handler of
     its own -- pressing it activates a datum *inside* the bitmap, which no CSS rule can reach, and
     re-outlining the whole plot on mousedown would read as the entire chart being the target. */
  [part='canvas']:hover {
    /* Scoped so a consumer can retint/resize just this hover outline (e.g. to make it more
       prominent) without also affecting every other --lr-border-width-thin consumer on the page
       -- the same indirection rationale as the --lr-chart-grid-color/-tick-color/etc. block
       above, applied to a state-specific rule instead of a :host-level default. */
    outline: var(--lr-chart-canvas-hover-outline-width, var(--lr-border-width-thin)) solid var(--lr-chart-grid-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='canvas']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='data-table'] button {
    font: inherit;
    color: inherit;
    border: 0;
    border-radius: var(--lr-radius);
    background: transparent;
    padding: var(--lr-space-2xs);
    cursor: pointer;
  }
  [part='data-table'] button:hover {
    background: var(--lr-color-brand-quiet);
  }
  [part='data-table'] button:active {
    background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='data-table'] button:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='center'] {
    position: absolute;
    transform: translate(-50%, -50%);
    pointer-events: none;
    text-align: center;
  }
  [part='reset-zoom-button'] {
    position: absolute;
    inset-block-start: var(--lr-space-xs);
    inset-inline-end: var(--lr-space-xs);
    font: inherit;
    font-size: var(--lr-font-size-xs);
    padding: var(--lr-size-0-15rem) var(--lr-size-0-5rem);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    max-inline-size: calc(100% - var(--lr-space-xs) - var(--lr-space-xs));
    white-space: normal;
    overflow-wrap: anywhere;
    cursor: pointer;
  }
  [part='reset-zoom-button']:hover {
    background: var(--lr-color-brand-quiet);
  }
  [part='reset-zoom-button']:active {
    background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='reset-zoom-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* Mirrors map.styles.ts's identical [part='error'] treatment for the same "optional
     peer dependency missing" failure shape. */
  [part='error'] {
    margin: 0;
    padding: var(--lr-space-l);
    color: var(--lr-color-danger);
    font-size: var(--lr-font-size-md-sm);
    text-align: center;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
`;
