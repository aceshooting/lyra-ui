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
    gap: var(--lr-space-xs);
    max-inline-size: 100%;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
    font-variant-numeric: tabular-nums;
  }
  [part='base'][tabindex]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='base'] > *:not(:first-child)::before {
    content: '·';
    margin-inline-end: var(--lr-size-0-4em);
    opacity: 0.6;
  }
  [part='cost'] {
    color: var(--lr-color-text);
  }
  [part='tooltip'] {
    position: fixed;
    z-index: var(--lr-layer-dropdown);
    box-sizing: border-box;
    max-inline-size: min(90vw, var(--lr-size-24rem));
    padding: var(--lr-space-s) var(--lr-space-m);
    background: var(--lr-color-surface);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    box-shadow: var(--lr-shadow);
    font-size: var(--lr-font-size-sm);
    line-height: var(--lr-line-height-1-4);
    color: var(--lr-color-text);
  }
  [part='tooltip'][hidden] {
    display: none;
  }
  .row {
    display: flex;
    justify-content: space-between;
    gap: var(--lr-space-m);
  }
  .row:not(:last-child) {
    margin-block-end: var(--lr-space-2xs);
  }
  .row > span:first-child {
    color: var(--lr-color-text-quiet);
  }
  .row > span:last-child {
    font-variant-numeric: tabular-nums;
    font-weight: var(--lr-font-weight-semibold);
  }
`;
