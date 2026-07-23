import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --lr-diff-view-font: var(--lr-font-mono);
    --lr-diff-view-add-background: var(--lr-color-success-quiet);
    --lr-diff-view-add-color: var(--lr-color-success);
    --lr-diff-view-remove-background: var(--lr-color-danger-quiet);
    --lr-diff-view-remove-color: var(--lr-color-danger);
    --lr-diff-view-fold-background: var(--lr-color-surface-raised);
    --lr-diff-view-fold-color: var(--lr-color-text-quiet);
  }
  [part='base'] {
    position: relative;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    overflow: auto;
  }
  pre {
    margin: 0;
    padding: var(--lr-space-s);
  }
  .split-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--lr-space-s);
    align-items: start;
    padding: var(--lr-space-s);
  }
  [part='side'] {
    overflow-x: auto;
    overflow-y: hidden;
    min-inline-size: 0;
  }
  [part='line'] {
    /* Lives here (rather than on the ancestor pre element) so layout="split" -- whose lines sit
       inside [part='side'], not a pre -- inherits the same monospace typography as the default
       unified pre. font-family/font-size/line-height are all inheritable, so moving them here
       from pre is visually identical for the unified layout (same computed values, just set
       directly instead of inherited). */
    font-family: var(--lr-diff-view-font);
    font-size: var(--lr-font-size-sm);
    line-height: var(--lr-line-height-snug);
    white-space: pre-wrap;
  }
  [part='line'][data-type='add'] {
    background: var(--lr-diff-view-add-background);
    color: var(--lr-diff-view-add-color);
  }
  [part='line'][data-type='remove'] {
    background: var(--lr-diff-view-remove-background);
    color: var(--lr-diff-view-remove-color);
  }
  [part='line'][data-type='fold'] {
    color: var(--lr-diff-view-fold-color);
    background: var(--lr-diff-view-fold-background);
    text-align: center;
  }
  [part='copy-button'] {
    position: absolute;
    inset-block-start: var(--lr-space-xs);
    inset-inline-end: var(--lr-space-xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-xs);
    padding: var(--lr-size-0-125rem) var(--lr-space-s);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    cursor: pointer;
  }
  [part='copy-button']:hover {
    border-color: var(--lr-color-brand);
  }
  [part='copy-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
`;
