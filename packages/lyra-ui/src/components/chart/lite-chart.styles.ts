import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    position: relative;
    block-size: var(--lyra-chart-height, 280px);
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
  }
  [part='base'] {
    position: relative;
    inline-size: 100%;
    block-size: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--lyra-space-xs);
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
    font-size: 10px;
    font-family: var(--lyra-font-family, inherit);
  }
  [part='axis-title'] {
    fill: var(--lyra-chart-tick-color);
    font-size: 11px;
    font-weight: 600;
    font-family: var(--lyra-font-family, inherit);
  }
  [part='bar'] {
    cursor: pointer;
  }
  [part='bar']:focus-visible,
  [part='point']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: 1px;
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
    gap: 0.35em;
    font-size: 0.8rem;
    color: var(--lyra-chart-legend-color);
  }
  [part='legend-swatch'] {
    inline-size: 0.7em;
    block-size: 0.7em;
    border-radius: 2px;
    flex: 0 0 auto;
  }
`;
