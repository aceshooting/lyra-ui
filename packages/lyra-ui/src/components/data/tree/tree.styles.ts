import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    /* An unset size starts a fresh tier context even within another tree's content. */
    --_lr-tree-tier-row-height: initial;
    --_lr-tree-tier-row-padding: initial;
    --_lr-tree-tier-toggle-size: calc(var(--_lr-tree-tier-row-height) - var(--lr-space-xs));
  }
  :host([size]) {
    --_lr-tree-tier-row-padding: 0;
  }
  :host([size='2xs']) {
    --_lr-tree-tier-row-height: var(--lr-size-1-25rem);
  }
  :host([size='xs']) {
    --_lr-tree-tier-row-height: var(--lr-size-1-5rem);
  }
  :host([size='s']),
  :host([size='small']) {
    --_lr-tree-tier-row-height: var(--lr-size-2rem);
  }
  :host([size='m']),
  :host([size='medium']) {
    --_lr-tree-tier-row-height: var(--lr-size-2-25rem);
  }
  :host([size='l']),
  :host([size='large']) {
    --_lr-tree-tier-row-height: var(--lr-size-2-5rem);
  }
  :host([size='xl']) {
    --_lr-tree-tier-row-height: var(--lr-size-3-5rem);
  }
  [part='drop-indicator'] {
    position: absolute;
    z-index: var(--lr-layer-content);
    pointer-events: none;
    block-size: var(--lr-border-width-medium);
    background: var(--lr-tree-drop-indicator-color, var(--lr-color-brand));
    transform: translateY(-50%);
  }
  [part~='base'] {
    position: relative;
    display: flex;
    flex-direction: column;
    /* Fallback for a deeply-indented node whose row still overflows despite the [part=label]
       truncation and padding-inline-start cap in tree-item.ts. overflow-y is pinned explicitly:
       per spec, leaving one axis unset once the other is non-'visible' forces it to 'auto' too,
       which sub-pixel rounding can turn into a phantom vertical scrollbar even though this tree
       grows tall rather than scrolling block-wise -- mirrors <lr-tab-group>'s fix. */
    overflow-x: auto;
    overflow-y: hidden;
  }
  [part='limit'] {
    padding: var(--lr-space-s);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }
`;
