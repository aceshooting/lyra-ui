import { css } from 'lit';
import { compactContainerQuery } from '../../../internal/container-breakpoints.styles.js';
import { focusRing, iconHitTarget, nativeControlSurface } from '../../../internal/interactive-control.styles.js';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-20rem);
  }

  [part='base'] {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    min-inline-size: 0;
    gap: var(--lr-space-s);
    color: var(--lr-color-text);
  }

  p {
    margin: 0;
    overflow-wrap: anywhere;
  }

  /* Measured, never painted: its width and top border carry the point-size and line-width tokens so
     their units resolve live. It is capped to the chart so a huge token cannot widen the page. */
  [data-style-probe] {
    position: absolute;
    visibility: hidden;
    pointer-events: none;
    inline-size: var(--lr-chart-3d-point-size, var(--lr-space-s));
    max-inline-size: 100%;
    block-size: 0;
    border-block-start: var(--lr-chart-3d-line-width, var(--lr-border-width-thin)) solid transparent;
  }

  [part='engine'] {
    inline-size: 100%;
    min-inline-size: 0;
    block-size: var(--lr-chart-3d-height, var(--lr-size-24rem));
    overflow: hidden;
    background: var(--lr-color-surface);
    border-radius: var(--lr-radius-xs);
  }

  [part='engine'][hidden] {
    display: none;
  }

  [part='toolbar'],
  [part='pagination'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-s);
  }

  [part='cursor'],
  [part='fit-button'],
  [part='row-button'],
  [part='page-button'] {
    ${nativeControlSurface}
    ${iconHitTarget}
    padding: var(--lr-space-xs) var(--lr-space-s);
    border-radius: var(--lr-radius-xs);
    cursor: pointer;
    overflow-wrap: anywhere;
    transition: var(--lr-transition-interactive);
  }

  [part='cursor']:hover,
  [part='fit-button']:hover,
  [part='row-button']:hover,
  [part='page-button']:hover {
    background: var(--lr-color-surface-raised);
  }

  [part='cursor']:active,
  [part='fit-button']:active,
  [part='row-button']:active,
  [part='page-button']:active {
    border-color: var(--lr-color-brand);
  }

  [part='cursor']:focus-visible,
  [part='fit-button']:focus-visible,
  [part='row-button']:focus-visible,
  [part='page-button']:focus-visible,
  [part='table-container']:focus-visible {
    ${focusRing}
  }

  [part='page-button']:disabled {
    cursor: default;
    opacity: var(--lr-opacity-disabled);
  }

  [part='row-button']:where([aria-pressed='true']) {
    background: var(--lr-color-brand);
    color: var(--lr-color-on-brand);
  }

  [part='row-button']:where([aria-pressed='true']):hover {
    background: color-mix(in srgb, var(--lr-color-brand), var(--lr-color-text) 12%);
  }

  [part='cursor'] {
    flex: 1;
    text-align: start;
  }

  [part='row-button'] {
    text-align: start;
  }

  [part='instructions'],
  [part='engine-notice'] {
    color: var(--lr-color-text-quiet);
  }

  [part='error'] {
    color: var(--lr-color-danger);
  }

  [part='table-container'] {
    ${iconHitTarget}
    max-inline-size: 100%;
    overflow: auto;
  }

  table {
    inline-size: 100%;
    border-collapse: collapse;
    font-size: inherit;
  }

  caption {
    text-align: start;
    font-weight: var(--lr-font-weight-semibold);
    padding-block: var(--lr-space-s);
  }

  th,
  td {
    text-align: start;
    vertical-align: top;
    padding: var(--lr-space-xs);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
    overflow-wrap: anywhere;
  }

  th[scope='col'] {
    font-weight: var(--lr-font-weight-semibold);
  }

  td {
    font-variant-numeric: tabular-nums;
  }

  @container ${compactContainerQuery} {
    [part='toolbar'] {
      flex-direction: column;
      align-items: stretch;
    }

    [part='pagination'] {
      justify-content: space-between;
    }
  }

  @media (forced-colors: active) {
    [part='row-button']:where([aria-pressed='true']) {
      outline: var(--lr-border-width-medium) solid Highlight;
    }
  }
`;
