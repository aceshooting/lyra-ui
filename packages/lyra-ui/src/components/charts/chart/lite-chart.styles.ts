import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    position: relative;
    inline-size: 100%;
    min-inline-size: 0;
    block-size: var(--lr-chart-height, var(--lr-size-280px));
    /* Same token names/fallback chain as chart.ts's --lr-chart-* — a host
       already theming lr-chart gets lr-lite-chart themed for free, and
       vice versa. Unlike chart.ts (canvas-rendered, can't consume var()
       directly), this component is plain SVG/DOM, so these are read natively
       by the CSS below — no getComputedStyle()/JS-side resolution needed. */
    --lr-chart-grid-color: var(--lr-color-border);
    --lr-chart-tick-color: var(--lr-color-text-quiet);
    --lr-chart-legend-color: var(--lr-color-text);
    --lr-chart-tooltip-bg: var(--lr-color-surface);
    --lr-chart-tooltip-text: var(--lr-color-text);
    --lr-chart-color-1: var(--lr-color-chart-1);
    --lr-chart-color-2: var(--lr-color-chart-2);
    --lr-chart-color-3: var(--lr-color-chart-3);
    --lr-chart-color-4: var(--lr-color-chart-4);
    --lr-chart-color-5: var(--lr-color-chart-5);
    --lr-chart-color-6: var(--lr-color-chart-6);
    --lr-chart-color-7: var(--lr-color-chart-7);
    --lr-chart-color-8: var(--lr-color-chart-8);
  }
  [part='base'] {
    position: relative;
    inline-size: 100%;
    block-size: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
  }
  /* layout="scroll": the svg below gets an explicit inline-size (its
     computed content width, set inline per-render since it depends on
     category count/barWidth) instead of the 100% below, and can end up
     wider than this container -- scroll to reveal the rest instead of
     squeezing. Scoped strictly to the reflected [layout='scroll'] attribute
     so layout="fit" (the default) never triggers this rule. */
  :host([layout='scroll']) [part='base'] {
    overflow-x: auto;
    overflow-y: hidden;
  }
  svg {
    flex: 1 1 auto;
    inline-size: 100%;
    block-size: 100%;
    min-block-size: 0;
    overflow: visible;
  }
  [part='grid-line'] {
    stroke: var(--lr-chart-grid-color);
    stroke-width: var(--lr-border-width-thin);
  }
  [part='axis-label'] {
    fill: var(--lr-chart-tick-color);
    font-size: var(--lr-font-size-2xs);
    font-family: var(--lr-font);
  }
  [part='axis-title'] {
    fill: var(--lr-chart-tick-color);
    font-size: var(--lr-font-size-xs);
    font-weight: var(--lr-font-weight-semibold);
    font-family: var(--lr-font);
  }
  [part='bar'] {
    cursor: pointer;
  }
  :where([part='bar']):hover,
  :where([part='point']):hover {
    filter: brightness(var(--lr-hover-brightness));
  }
  [part='bar'][data-selected],
  [part='point'][data-selected] {
    stroke: var(--lr-lite-chart-selected-outline-color, var(--lr-color-brand));
    stroke-width: var(--lr-size-2px);
  }
  [part='bar']:focus-visible,
  [part='point']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='line'] {
    fill: none;
    stroke-width: var(--lr-border-width-medium);
  }
  [part='point'] {
    cursor: pointer;
  }
  [part='legend'] {
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
    color: var(--lr-chart-legend-color);
  }
  [part='legend-swatch'] {
    inline-size: var(--lr-size-0-7em);
    block-size: var(--lr-size-0-7em);
    border-radius: var(--lr-size-2px);
    flex: 0 0 auto;
  }
  [part='legend-text'] {
    margin-inline-start: var(--lr-space-2xs);
    color: var(--lr-chart-tick-color);
  }
`;
