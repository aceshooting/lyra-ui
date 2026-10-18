import { css } from 'lit';

/** Flat hierarchy chrome shared by the source adapters. */
export const hierarchySourceStyles = css`
  .source-tree { display: flex; flex-direction: column; min-inline-size: 0; block-size: var(--lr-size-20rem); max-block-size: 100%; }
  [part~='source-list'] { --lr-virtual-list-height: 100%; display: block; min-block-size: 0; block-size: var(--lr-size-20rem); flex: 1; min-inline-size: 0; }
  [part~='source-row'] {
    display: flex; align-items: center; min-inline-size: 0;
    min-block-size: var(--lr-icon-button-size); gap: var(--lr-space-xs);
    padding-inline-start: calc(var(--source-depth) * var(--lr-space-m));
    padding-inline-end: var(--lr-space-xs); cursor: pointer;
    color: var(--lr-color-text); --_source-row-fill: var(--lr-color-surface); background: var(--_source-row-fill);
  }
  [part~='source-row']:where(:hover) { background: color-mix(in srgb, var(--_source-row-fill), var(--lr-color-text) 8%); }
  [part~='source-row']:where(:active) { background: color-mix(in srgb, var(--_source-row-fill), var(--lr-color-text) 12%); }
  [part~='source-row']:where([aria-selected='true']) { --_source-row-fill: var(--lr-color-brand-fill-quiet); }
  [part~='source-row']:where([aria-disabled='true']) { cursor: default; opacity: var(--lr-opacity-disabled); }
  [part~='source-row']:where(:focus-visible), .source-tree:where(:focus-visible), [part~='source-toggle']:where(:focus-visible) {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: var(--lr-focus-ring-offset);
  }
  [part~='source-label'] { display: flex; align-items: center; flex-wrap: wrap; gap: var(--lr-space-xs); min-inline-size: 0; overflow-wrap: anywhere; }
  [part~='source-toggle'] {
    font: inherit; color: inherit; background: transparent; border: 0; cursor: pointer;
    min-inline-size: var(--lr-icon-button-size); min-block-size: var(--lr-icon-button-size); flex-shrink: 0;
  }
  [part~='source-toggle']:where(:hover) { background: var(--lr-color-neutral-fill-quiet); }
  [part~='source-toggle']:where(:active) { background: color-mix(in srgb, var(--lr-color-neutral-fill-quiet), var(--lr-color-text) 12%); }
  [part~='source-toggle']:where(:disabled) { cursor: default; opacity: var(--lr-opacity-disabled); }
  .source-toggle-space { inline-size: var(--lr-icon-button-size); flex-shrink: 0; }
  [part~='source-status'], [part~='source-error'] { padding: var(--lr-space-xs); overflow-wrap: anywhere; }
  [part~='source-error'] { color: var(--lr-color-danger-text-normal); }
`;
