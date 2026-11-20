import { activeFill, focusRing, focusRingShorthand, hoverFill } from '../../../internal/interactive-control.styles.js';
import { css } from 'lit';
import { chartDataTableStyles, chartLegendPositionStyles } from './chart-surface.styles.js';
import { forcedColorLegendSwatchStyles } from './chart-forced-colors.js';
import { inlineSizeContainer } from '../../../internal/layout-fragments.styles.js';

export const styles = css`
  :host {
    display: block;
    position: relative;
    inline-size: 100%;
    min-inline-size: 0;
    min-block-size: var(--lr-chart-height, var(--_lr-chart-height, var(--lr-size-280px)));
    block-size: auto;
    ${inlineSizeContainer}
    /* Same token names and fallback chain as chart.ts's --lr-chart-* set, so
       theming either component themes the other for free. Unlike chart.ts
       (canvas-rendered, cannot consume var() directly), this one is plain
       SVG/DOM, so the CSS below reads them natively -- no getComputedStyle()
       or JS-side resolution needed. */
    --_lr-chart-grid-color: var(--lr-color-border-subtle);
    --_lr-chart-tick-color: var(--lr-color-text-quiet);
    --_lr-chart-tick-font-size: var(--lr-font-size-2xs);
    --_lr-chart-legend-color: var(--lr-color-text);
    --_lr-chart-tooltip-bg: var(--lr-color-surface);
    --_lr-chart-tooltip-color: var(--lr-color-text);
  }
  [part='base'] {
    position: relative;
    inline-size: 100%;
    /* :host's block-size stays auto (a chart shrink-wraps to its content by default), but a
       CSS-Grid/flex-stretched host (default align-items: stretch) grows taller than that content --
       without this, [part='base'] keeps shrink-wrapping instead of filling the stretched host,
       leaving dead space below the chart. Same fix as lr-card/lr-stat/lr-word-cloud/
       lr-context-meter's own [part='base']. */
    block-size: 100%;
    box-sizing: border-box;
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
    font-size: var(--lr-chart-tick-font-size, var(--_lr-chart-tick-font-size));
    font-family: var(--lr-font);
  }
  [part='axis-title'] {
    fill: var(--lr-chart-tick-color, var(--_lr-chart-tick-color));
    font-size: var(--lr-font-size-xs);
    font-weight: var(--lr-font-weight-semibold);
    font-family: var(--lr-font);
  }
  /* Every tick and axis title is its own bidi paragraph whose direction comes from its first
     strong character, like a first-strong isolate. Without it a number-first formatted label
     (2.4 MiB/s, 9:00 AM, -3) inherits the chart's RTL base direction and paints unit-first.
     A declaration rather than U+2068/U+2069 in the text: WebKit's SVG text ignores the isolate
     controls, and the text nodes stay free of characters a screen reader or braille display would
     meet. text-anchor keeps following the inherited direction, so axis placement is unchanged. */
  [part='axis-label'],
  [part='axis-title'] {
    unicode-bidi: plaintext;
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
  :where(svg:not([data-forced-colors])) :where([part='bar']):hover,
  :where(svg:not([data-forced-colors])) :where([part='point']):hover,
  :where(svg:not([data-forced-colors])) :where(.mark-hit-group):hover [part='bar'],
  :where(svg:not([data-forced-colors])) :where(.mark-hit-group):hover [part='point'] {
    fill: ${hoverFill('currentColor')};
  }
  :where(svg:not([data-forced-colors])) :where([part='bar']):active,
  :where(svg:not([data-forced-colors])) :where([part='point']):active,
  :where(svg:not([data-forced-colors])) :where(.mark-hit-group):active [part='bar'],
  :where(svg:not([data-forced-colors])) :where(.mark-hit-group):active [part='point'] {
    fill: ${activeFill('currentColor')};
  }
  /* Forced colors keep the series texture as the fill (a flat hover fill would erase it), so hover
     and press are an edge in a system colour instead. */
  :where(svg[data-forced-colors]) :where([part='bar']):hover,
  :where(svg[data-forced-colors]) :where([part='point']):hover,
  :where(svg[data-forced-colors]) :where(.mark-hit-group):hover [part='bar'],
  :where(svg[data-forced-colors]) :where(.mark-hit-group):hover [part='point'] {
    stroke: Highlight;
    stroke-width: var(--lr-border-width-medium);
  }
  :where(svg[data-forced-colors]) :where([part='bar']):active,
  :where(svg[data-forced-colors]) :where([part='point']):active,
  :where(svg[data-forced-colors]) :where(.mark-hit-group):active [part='bar'],
  :where(svg[data-forced-colors]) :where(.mark-hit-group):active [part='point'] {
    stroke: ButtonText;
    stroke-width: var(--lr-border-width-thick, var(--lr-border-width-medium));
  }
  [part='bar'][data-selected],
  [part='point'][data-selected] {
    stroke: var(--lr-lite-chart-selected-outline-color, var(--lr-color-brand));
    stroke-width: var(--lr-lite-chart-selected-outline-width, var(--lr-border-width-medium));
  }
  [part='bar']:focus-visible,
  [part='point']:focus-visible {
    ${focusRing}
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
  ${chartDataTableStyles}
  .notices { grid-area: notice; }
  [part='limit'],
  [part='data-truncation'] {
    margin: 0;
    padding: var(--lr-space-xs);
    color: var(--lr-color-warning);
    font-size: var(--lr-font-size-sm);
    overflow-wrap: anywhere;
  }
  [part='base']:where([data-table-toggle]) {
    grid-template-areas:
      'plot'
      'notice'
      'legend'
      'table-toggle'
      'table';
  }
  ${chartLegendPositionStyles('notice', false)}
  ${chartLegendPositionStyles('notice', true)}
  [part='data-table-toggle'] {
    --_lr-chart-toggle-border-color: var(--lr-lite-chart-data-table-toggle-border-color);
    --_lr-chart-toggle-bg: var(--lr-lite-chart-data-table-toggle-bg);
    --_lr-chart-toggle-color: var(--lr-lite-chart-data-table-toggle-color);
    --_lr-chart-toggle-inline-size: var(--lr-lite-chart-data-table-toggle-inline-size);
    --_lr-chart-toggle-justify: var(--lr-lite-chart-data-table-toggle-justify);
  }
  [part='data-table-toggle']:hover {
    background: var(
      --lr-lite-chart-data-table-toggle-hover-bg,
      var(--lr-chart-data-table-toggle-hover-bg, var(--lr-color-brand-quiet))
    );
  }
  [part='data-table-toggle']:active {
    background: var(
      --lr-lite-chart-data-table-toggle-active-bg,
      var(
        --lr-chart-data-table-toggle-active-bg,
        ${activeFill('var(--lr-color-brand-quiet)')}
      )
    );
  }
  [part='data-table-toggle']:focus-visible {
    ${focusRingShorthand}
  }
`;
