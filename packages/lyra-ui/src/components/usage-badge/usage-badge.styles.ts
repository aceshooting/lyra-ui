import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    max-inline-size: 100%;
  }
  [part='base'] {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--lyra-space-xs);
    max-inline-size: 100%;
    color: var(--lyra-color-text-quiet);
    font-size: var(--lyra-font-size-sm);
    font-variant-numeric: tabular-nums;
  }
  [part='base'][tabindex]:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='base'] > *:not(:first-child)::before {
    content: '·';
    margin-inline-end: var(--lyra-size-0-4em);
    opacity: 0.6;
  }
  [part='cost'] {
    color: var(--lyra-color-text);
  }
  [part='tooltip'] {
    position: fixed;
    z-index: var(--lyra-layer-dropdown);
    box-sizing: border-box;
    max-inline-size: min(90vw, var(--lyra-size-24rem));
    padding: var(--lyra-space-s) var(--lyra-space-m);
    background: var(--lyra-color-surface);
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    box-shadow: var(--lyra-shadow);
    font-size: var(--lyra-font-size-sm);
    line-height: var(--lyra-line-height-1-4);
    color: var(--lyra-color-text);
  }
  [part='tooltip'][hidden] {
    display: none;
  }
  .row {
    display: flex;
    justify-content: space-between;
    gap: var(--lyra-space-m);
  }
  .row:not(:last-child) {
    margin-block-end: var(--lyra-space-2xs);
  }
  .row > span:first-child {
    color: var(--lyra-color-text-quiet);
  }
  .row > span:last-child {
    font-variant-numeric: tabular-nums;
    font-weight: var(--lyra-font-weight-semibold);
  }
`;
