import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    position: relative;
    block-size: var(--lyra-chart-height, var(--lyra-size-280px));
    /* Same token names/fallback chain as chart.ts's --lyra-chart-* — a host
       already theming lyra-chart gets lyra-lite-chart themed for free, and
       vice versa. Unlike chart.ts (canvas-rendered, can't consume var()
       directly), this component is plain SVG/DOM, so these are read natively
       by the CSS below — no getComputedStyle()/JS-side resolution needed. */
    --lyra-chart-grid-color: var(--lyra-color-border);
    --lyra-chart-tick-color: var(--lyra-color-text-quiet);
    --lyra-chart-legend-color: var(--lyra-color-text);
    --lyra-chart-tooltip-bg: var(--lyra-color-surface);
    --lyra-chart-tooltip-text: var(--lyra-color-text);
    --lyra-chart-color-1: var(--lyra-color-chart-1);
    --lyra-chart-color-2: var(--lyra-color-chart-2);
    --lyra-chart-color-3: var(--lyra-color-chart-3);
    --lyra-chart-color-4: var(--lyra-color-chart-4);
    --lyra-chart-color-5: var(--lyra-color-chart-5);
    --lyra-chart-color-6: var(--lyra-color-chart-6);
    --lyra-chart-color-7: var(--lyra-color-chart-7);
    --lyra-chart-color-8: var(--lyra-color-chart-8);
  }
  [part='base'] {
    position: relative;
    inline-size: 100%;
    block-size: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-xs);
  }
  /* layout="scroll": the svg below gets an explicit inline-size (its
     computed content width, set inline per-render since it depends on
     category count/barWidth) instead of the 100% below, and can end up
     wider than this container -- scroll to reveal the rest instead of
     squeezing. Scoped strictly to the reflected [layout='scroll'] attribute
     so layout="fit" (the default) never triggers this rule. */
  :host([layout='scroll']) [part='base'] {
    overflow-x: auto;
  }
  svg {
    flex: 1 1 auto;
    inline-size: 100%;
    block-size: 100%;
    min-block-size: 0;
    overflow: visible;
  }
  [part='grid-line'] {
    stroke: var(--lyra-chart-grid-color);
    stroke-width: 1;
  }
  [part='axis-label'] {
    fill: var(--lyra-chart-tick-color);
    font-size: var(--lyra-size-10px);
    font-family: var(--lyra-font-family, inherit);
  }
  [part='axis-title'] {
    fill: var(--lyra-chart-tick-color);
    font-size: var(--lyra-size-11px);
    font-weight: var(--lyra-font-weight-semibold);
    font-family: var(--lyra-font-family, inherit);
  }
  [part='bar'] {
    cursor: pointer;
  }
  [part='bar']:focus-visible,
  [part='point']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-size-1px);
  }
  [part='line'] {
    fill: none;
    stroke-width: 2;
  }
  [part='point'] {
    cursor: pointer;
  }
  [part='legend'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lyra-space-s);
    justify-content: center;
    flex: 0 0 auto;
  }
  [part='legend-item'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lyra-size-0-35em);
    font-size: var(--lyra-size-0-8rem);
    color: var(--lyra-chart-legend-color);
  }
  [part='legend-swatch'] {
    inline-size: var(--lyra-size-0-7em);
    block-size: var(--lyra-size-0-7em);
    border-radius: var(--lyra-size-2px);
    flex: 0 0 auto;
  }
`;
