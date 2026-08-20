import { css } from 'lit';
import { forcedColorLegendSwatchStyles } from './chart-forced-colors.js';

export const styles = css`
  :host {
    display: block;
    position: relative;
    inline-size: 100%;
    min-inline-size: 0;
    min-block-size: var(--lr-chart-height, var(--_lr-chart-height, var(--lr-size-280px)));
    block-size: auto;
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-20rem);
    /* Same token names and fallback chain as chart.ts's --lr-chart-* set, so
       theming either component themes the other for free. Unlike chart.ts
       (canvas-rendered, cannot consume var() directly), this one is plain
       SVG/DOM, so the CSS below reads them natively -- no getComputedStyle()
       or JS-side resolution needed. */
    --_lr-chart-grid-color: var(--lr-color-border);
    --_lr-chart-tick-color: var(--lr-color-text-quiet);
    --_lr-chart-legend-color: var(--lr-color-text);
    --_lr-chart-tooltip-bg: var(--lr-color-surface);
    --_lr-chart-tooltip-text: var(--lr-color-text);
  }
  [part='base'] {
    position: relative;
    inline-size: 100%;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      'plot'
      'notice'
      'legend'
      'table';
    gap: var(--lr-space-xs);
  }
  /* layout="scroll": the svg below gets an explicit inline-size (its computed
     content width, set inline per-render since it depends on category
     count/barWidth) instead of the 100% below, and can end up wider than this
     container -- scroll to reveal the rest instead of squeezing. Scoped
     strictly to the reflected [layout='scroll'] attribute so layout="fit",
     the default, never triggers it. */
  :host([layout='scroll']) [part='base'] {
    overflow-x: auto;
    overflow-y: hidden;
  }
  svg {
    grid-area: plot;
    display: block;
    inline-size: 100%;
    block-size: var(--lr-chart-height, var(--_lr-chart-height, var(--lr-size-280px)));
    min-block-size: var(--lr-icon-button-size);
    overflow: hidden;
  }
  [part='grid-line'] {
    stroke: var(--lr-chart-grid-color, var(--_lr-chart-grid-color));
    stroke-width: var(--lr-border-width-thin);
  }
  [part='axis-label'] {
    fill: var(--lr-chart-tick-color, var(--_lr-chart-tick-color));
    font-size: var(--lr-font-size-2xs);
    font-family: var(--lr-font);
  }
  [part='axis-title'] {
    fill: var(--lr-chart-tick-color, var(--_lr-chart-tick-color));
    font-size: var(--lr-font-size-xs);
    font-weight: var(--lr-font-weight-semibold);
    font-family: var(--lr-font);
  }
  [part='bar'] {
    cursor: pointer;
  }
  [data-mark-hit-target] {
    cursor: pointer;
  }
  /* A mark's resting colour is its series colour -- anything a consumer passes, including pure
     white or pure black. brightness() multiplies every channel, so it is a no-op on those two and
     elsewhere moves whichever way the colour sits, not the way the mark needs; mixing toward
     --lr-color-mix-partner (which follows the text colour) always moves, and always away from the
     plot background. The base is currentColor because each mark carries its series colour in an
     inline 'color' beside its fill attribute -- CSS cannot read a fill presentation attribute. */
  :where([part='bar']):hover,
  :where([part='point']):hover,
  :where(.mark-hit-group):hover [part='bar'],
  :where(.mark-hit-group):hover [part='point'] {
    fill: color-mix(in oklab, currentColor, var(--lr-color-mix-partner) var(--lr-color-mix-hover));
  }
  :where([part='bar']):active,
  :where([part='point']):active,
  :where(.mark-hit-group):active [part='bar'],
  :where(.mark-hit-group):active [part='point'] {
    fill: color-mix(in oklab, currentColor, var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='bar'][data-selected],
  [part='point'][data-selected] {
    stroke: var(--lr-lite-chart-selected-outline-color, var(--lr-color-brand));
    stroke-width: var(--lr-lite-chart-selected-outline-width, var(--lr-size-2px));
  }
  [part='bar']:focus-visible,
  [part='point']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  :where(.mark-hit-group):has([part='bar']:focus-visible, [part='point']:focus-visible)
    [data-mark-hit-target] {
    stroke: var(--lr-focus-ring-color);
    stroke-width: var(--lr-focus-ring-width);
  }
  [part='line'] {
    fill: none;
    stroke-width: var(--lr-border-width-medium);
  }
  /* The marks are the data key, so their pixels survive forced colors: their colors already come
     from the forced-colors system-color remap of the --lr-color-chart-* ramp, and the per-series
     texture/dash over it keeps repeated system colors apart. Forcing fill/stroke again would
     collapse every series onto one color. Axes, gridlines, labels and legend text stay
     system-controlled. forced-color-adjust is inherited, so it sits on the marks and pattern tiles
     rather than the svg, which would opt the chrome out too -- same placement rationale as
     swatch-picker.styles.ts's swatch-fill. */
  [part='bar'],
  [part='line'],
  [part='point'],
  pattern {
    forced-color-adjust: none;
  }
  [part='point'] {
    cursor: pointer;
  }
  [part='legend'] {
    grid-area: legend;
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-s);
    justify-content: center;
    flex: 0 0 auto;
  }
  [part='legend-item'] {
    display: inline-flex;
    align-items: center;
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
    gap: var(--lr-size-0-35em);
    font-size: var(--lr-size-0-8rem);
    color: var(--lr-chart-legend-color, var(--_lr-chart-legend-color));
  }
  [part='legend-swatch'] {
    inline-size: var(--lr-size-0-7em);
    block-size: var(--lr-size-0-7em);
    border-radius: var(--lr-size-2px);
    flex: 0 0 auto;
  }
  ${forcedColorLegendSwatchStyles}
  [part='legend-text'] {
    margin-inline-start: var(--lr-space-2xs);
    color: var(--lr-chart-tick-color, var(--_lr-chart-tick-color));
  }
  [part='data-table'][data-visually-hidden] {
    position: absolute;
    inline-size: var(--lr-size-1px);
    block-size: var(--lr-size-1px);
    overflow: clip;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  [part='data-table'] {
    grid-area: table;
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-x: auto;
    overflow-y: hidden;
  }
  [part='data-truncation'] {
    grid-area: notice;
    margin: 0;
    padding: var(--lr-space-xs);
    color: var(--lr-color-warning);
    font-size: var(--lr-font-size-sm);
    overflow-wrap: anywhere;
  }
  [part='base']:where([data-legend-position='top']) {
    grid-template-areas:
      'legend'
      'plot'
      'notice'
      'table';
  }
  [part='base']:where([data-legend-position='inline-start']) {
    grid-template-areas:
      'legend plot'
      'notice notice'
      'table table';
    grid-template-columns:
      minmax(0, min(33cqi, var(--lr-chart-legend-side-max, var(--lr-size-15rem))))
      minmax(0, 1fr);
  }
  [part='base']:where([data-legend-position='inline-end']) {
    grid-template-areas:
      'plot legend'
      'notice notice'
      'table table';
    grid-template-columns:
      minmax(0, 1fr)
      minmax(0, min(33cqi, var(--lr-chart-legend-side-max, var(--lr-size-15rem))));
  }
  @container (max-width: 479px) {
    [part='base']:where([data-legend-position='inline-start']),
    [part='base']:where([data-legend-position='inline-end']) {
      grid-template-areas:
        'plot'
        'notice'
        'legend'
        'table';
      grid-template-columns: minmax(0, 1fr);
    }
  }

  [part='data-table-toggle'] {
    align-self: flex-start;
    font: inherit;
    font-size: var(--lr-font-size-xs);
    min-block-size: var(--lr-icon-button-size);
    padding: var(--lr-size-0-15rem) var(--lr-size-0-5rem);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    max-inline-size: 100%;
    white-space: normal;
    overflow-wrap: break-word;
    cursor: pointer;
  }
  [part='data-table-toggle']:hover {
    background: var(--lr-lite-chart-data-table-toggle-hover-bg, var(--lr-color-brand-quiet));
  }
  [part='data-table-toggle']:active {
    background: var(
      --lr-lite-chart-data-table-toggle-active-bg,
      color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active))
    );
  }
  [part='data-table-toggle']:focus-visible {
    outline: var(--lr-focus-ring);
    outline-offset: var(--lr-focus-ring-offset);
  }
`;
