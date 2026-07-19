import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --lr-ingestion-queue-max-height: none;
  }
  [part='base'] {
    display: block;
    box-sizing: border-box;
  }
  [part='list'] {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    max-block-size: var(--lr-ingestion-queue-max-height);
    overflow-y: auto;
  }
  lr-virtual-list {
    display: block;
    --lr-virtual-list-height: var(--lr-ingestion-queue-max-height, var(--lr-size-24rem));
  }
  /* [part='item'] and its descendants below also target lr-virtual-list::part(x): above
     virtualize-threshold, itemTemplate()'s return value is <lr-virtual-list>'s .renderItem, and
     Lit commits that content wherever virtual-list's own render() is currently updating --
     i.e. inside *its* shadow root, not this component's. A plain [part=] selector here, scoped
     to this component's own shadow root, would never match a node living in that different
     shadow tree; lr-virtual-list::part(x) reaches that one shadow boundary in, the same
     technique <lr-dataset-viewer>/<lr-terminal> already use for their own virtualized rows. */
  [part='item'],
  lr-virtual-list::part(item) {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    box-sizing: border-box;
    padding: var(--lr-space-s) var(--lr-space-m);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='item-header'],
  lr-virtual-list::part(item-header) {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--lr-space-s);
  }
  [part='item-name'],
  lr-virtual-list::part(item-name) {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: var(--lr-font-weight-medium);
    color: var(--lr-color-text);
  }
  [part='item-progress'],
  lr-virtual-list::part(item-progress) {
    display: block;
  }
  [part='item-meta'],
  lr-virtual-list::part(item-meta) {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-s);
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
  }
  [part='item-error'],
  lr-virtual-list::part(item-error) {
    margin: 0;
    color: var(--lr-color-danger);
    font-size: var(--lr-font-size-sm);
  }
  [part='item-actions'],
  lr-virtual-list::part(item-actions) {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-s);
  }
  [part='retry-button'],
  lr-virtual-list::part(retry-button),
  [part='cancel-button'],
  lr-virtual-list::part(cancel-button) {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-size-0-35em);
    box-sizing: border-box;
    padding: var(--lr-size-0-25rem) var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    font-size: var(--lr-font-size-xs);
    cursor: pointer;
    transition:
      background-color var(--lr-transition-fast),
      border-color var(--lr-transition-fast),
      color var(--lr-transition-fast);
  }
  [part='retry-button']:hover,
  lr-virtual-list::part(retry-button):hover {
    border-color: var(--lr-color-brand);
    color: var(--lr-color-brand);
  }
  [part='cancel-button']:hover,
  lr-virtual-list::part(cancel-button):hover {
    border-color: var(--lr-color-danger);
    color: var(--lr-color-danger);
  }
  [part='retry-button']:focus-visible,
  lr-virtual-list::part(retry-button):focus-visible,
  [part='cancel-button']:focus-visible,
  lr-virtual-list::part(cancel-button):focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  @media (prefers-reduced-motion: reduce) {
    [part='retry-button'],
    lr-virtual-list::part(retry-button),
    [part='cancel-button'],
    lr-virtual-list::part(cancel-button) {
      transition: none !important;
    }
  }
`;
