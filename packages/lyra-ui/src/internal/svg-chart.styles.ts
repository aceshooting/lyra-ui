import { css } from 'lit';
import { visuallyHidden } from './a11y.js';
import { tightContainerQuery } from './container-breakpoints.styles.js';
import { focusRing, iconHitTarget } from './interactive-control.styles.js';
import { specialistTokens } from './specialist-host-tokens.styles.js';

export const svgChartStyles = css`
  ${specialistTokens}
  :host {
    display: block;
    min-inline-size: 0;
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-20rem);
  }
  [part='base'] {
    display: grid;
    gap: var(--lr-space-s);
    min-inline-size: 0;
    color: var(--lr-color-text);
    overflow-wrap: anywhere;
  }
  .graphic { position: relative; min-inline-size: 0; }
  [part='plot'] { display: block; inline-size: 100%; block-size: auto; overflow: visible; }
  g[role='button'] { cursor: pointer; }
  g[role='button']:where([data-muted]) { opacity: var(--lr-opacity-disabled); }
  g[role='button']:hover, g[role='button']:focus-visible { ${focusRing} }
  g[role='button']:active { outline: var(--lr-focus-ring); }
  [part='tooltip'] {
    position: absolute;
    inset-inline-start: 0;
    inset-block-end: 0;
    max-inline-size: 100%;
    box-sizing: border-box;
    padding: var(--lr-space-xs) var(--lr-space-s);
    background: var(--lr-color-surface);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
  }
  [part='legend'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-s) var(--lr-space-m);
    list-style: none;
    padding: 0;
    margin: 0;
  }
  [part='legend-item'] { display: inline-flex; align-items: baseline; gap: var(--lr-space-xs); }
  [part='legend-swatch'] {
    display: inline-block;
    flex: none;
    inline-size: var(--lr-size-0-75rem);
    block-size: var(--lr-size-0-75rem);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='description'], [part='empty'], [part='loading'], [part='error'], [part='limit'] { margin: 0; }
  [part='data-table-toggle'] {
    ${iconHitTarget}
    justify-self: start;
    font: inherit;
    color: inherit;
    padding: var(--lr-space-xs) var(--lr-space-m);
    background: var(--lr-color-surface);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    transition: var(--lr-transition-interactive);
    cursor: pointer;
  }
  [part='data-table-toggle']:hover { background: var(--lr-color-brand-quiet); }
  [part='data-table-toggle']:active { background: var(--lr-color-surface-raised); }
  [part='data-table-toggle']:focus-visible { ${focusRing} }
  [part='data-table'] { border-collapse: collapse; table-layout: fixed; inline-size: 100%; }
  th, td { padding: var(--lr-space-xs); text-align: start; border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border); }
  .sr-only { ${visuallyHidden} }
  @container ${tightContainerQuery} {
    [part='base'], [part='legend'] { gap: var(--lr-space-xs); }
  }
  @media (forced-colors: active) {
    g[role='button'] :where(rect, path, polygon) { stroke: CanvasText; }
    g[role='button']:focus-visible { outline-color: Highlight; }
  }
  @media (prefers-reduced-motion: reduce) {
    [part='data-table-toggle'] { transition: none; }
  }
`;
