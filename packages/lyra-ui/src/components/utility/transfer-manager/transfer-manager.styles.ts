import { css } from 'lit';
import { mediumContainerQuery } from '../../../internal/container-breakpoints.styles.js';
import { outlinedActionStyles } from '../../../internal/icon-action.styles.js';
import { blockHost, inlineSizeContainer } from '../../../internal/layout-fragments.styles.js';

export const styles = css`
  :host {
    ${blockHost}
    ${inlineSizeContainer}
  }
  :host([placement='floating']) {
    position: fixed;
    inset-inline-end: var(--lr-space-m);
    inset-block-end: var(--lr-space-m);
    inline-size: min(var(--lr-size-28rem), calc(100% - 2 * var(--lr-space-m)));
    z-index: var(--lr-layer-popover);
  }
  [part='base'] {
    box-sizing: border-box;
    min-inline-size: 0;
    max-block-size: inherit;
    overflow-wrap: anywhere;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
  }
  :host([placement='floating']) [part='base'] {
    max-block-size: calc(100dvb - 2 * var(--lr-space-m));
    overflow: auto;
    box-shadow: var(--lr-shadow-l);
  }
  [part='header'], [part='summary'], [part='panel'] {
    padding: var(--lr-space-xs) var(--lr-space-s);
  }
  [part='summary'], [part='metrics'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-2xs) var(--lr-space-s);
    min-inline-size: 0;
    font-size: var(--lr-font-size-sm);
    font-variant-numeric: tabular-nums;
  }
  progress {
    display: block;
    inline-size: 100%;
    max-inline-size: 100%;
    min-inline-size: 0;
    accent-color: var(--lr-color-brand);
  }
  [part='overall-progress'], [part='progress'] {
    flex-basis: 100%;
  }
  [part='panel'] {
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='list'] {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  [part='item'] {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--lr-space-2xs) var(--lr-space-s);
    padding-block: var(--lr-space-s);
  }
  [part='item'] + [part='item'] {
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='name'] { font-weight: var(--lr-font-weight-semibold); }
  [part='status'] { font-size: var(--lr-font-size-sm); }
  [part='item'] [part='progress'], [part='metrics'], [part='item-actions'] {
    grid-column: 1 / -1;
  }
  [part='bulk-actions'], [part='item-actions'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-2xs);
  }
  [part='empty'] {
    margin: 0;
    padding-block: var(--lr-space-s);
    color: var(--lr-color-text-quiet);
  }
  ${outlinedActionStyles('[part="action"]')}
  ${outlinedActionStyles('[part="disclosure"]', {
    extra: 'display: inline-flex; align-items: center; gap: var(--lr-space-xs); font-weight: var(--lr-font-weight-semibold);',
  })}
  [part='action'], [part='disclosure'] {
    box-sizing: border-box;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
    text-align: start;
  }
  @container ${mediumContainerQuery} {
    [part='item'] { grid-template-columns: minmax(0, 1fr); }
  }
  @media (prefers-reduced-motion: reduce) {
    [part='action'], [part='disclosure'] { transition: none; }
  }
`;
