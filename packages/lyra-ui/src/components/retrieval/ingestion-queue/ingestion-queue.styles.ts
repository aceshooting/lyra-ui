import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --_lr-ingestion-queue-max-height: none;
  }
  [part="base"] {
    display: block;
    box-sizing: border-box;
    min-inline-size: 0;
  }
  [part="list"] {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    max-block-size: var(
      --lr-ingestion-queue-max-height,
      var(--_lr-ingestion-queue-max-height)
    );
    overflow-y: auto;
    overflow-x: clip;
  }
  /* Deliberately NOT derived from --lr-ingestion-queue-max-height (whose own default is the
     keyword 'none', valid for [part='list']'s max-block-size above but not for a length-only
     custom property): chaining var(--lr-ingestion-queue-max-height, var(--lr-size-24rem)) here
     would make that 'none' win unconditionally (a var() fallback only applies when the referenced
     property is *unset*, not when it resolves to a keyword that happens to be invalid for this
     use), leaving --lr-virtual-list-height literally 'none' -- an invalid block-size that resolves
     to 'auto', which is the one sizing lr-virtual-list's own windowing math cannot tolerate: its
     viewport height would then depend on its rendered rows' height while the rendered rows
     themselves depend on the viewport height, a genuine circular layout dependency that surfaces
     as a real "ResizeObserver loop completed with undelivered notifications" browser error, not
     mere test flakiness. A fixed token default, independent of the non-virtualized list's own cap,
     is the same choice <lr-dataset-viewer>'s own lr-virtual-list sizing rule makes. */
  lr-virtual-list {
    display: block;
    --lr-virtual-list-height: var(--lr-size-24rem);
  }
  /* [part='item'] and its descendants below also target lr-virtual-list::part(x): above
     virtualize-at, itemTemplate()'s return value is <lr-virtual-list>'s .renderItem, and
     Lit commits that content wherever virtual-list's own render() is currently updating --
     i.e. inside *its* shadow root, not this component's. A plain [part=] selector here, scoped
     to this component's own shadow root, would never match a node living in that different
     shadow tree; lr-virtual-list::part(x) reaches that one shadow boundary in, the same
     technique <lr-dataset-viewer>/<lr-terminal> already use for their own virtualized rows. */
  [part="item"],
  lr-virtual-list::part(item) {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    box-sizing: border-box;
    padding: var(--lr-space-s) var(--lr-space-m);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part="item-header"],
  lr-virtual-list::part(item-header) {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--lr-space-s);
  }
  [part="item-name"],
  lr-virtual-list::part(item-name) {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: var(--lr-font-weight-medium);
    color: var(--lr-color-text);
  }
  [part="item-progress"],
  lr-virtual-list::part(item-progress) {
    display: block;
  }
  [part="item-meta"],
  lr-virtual-list::part(item-meta) {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-s);
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
  }
  /* Each meta fragment (chunk count, embedding status, attempt count) interpolates a
     locale-formatted number into fixed surrounding words -- resolve each from its own first
     strong character so the digits stay in reading order instead of being bidi-reordered against
     the page's own direction, matching toast-item.styles.ts's identical [part="content"] rule. */
  [part="item-chunk-count"],
  lr-virtual-list::part(item-chunk-count),
  [part="item-embedding-status"],
  lr-virtual-list::part(item-embedding-status),
  [part="item-attempts"],
  lr-virtual-list::part(item-attempts) {
    unicode-bidi: plaintext;
  }
  [part="item-error"],
  lr-virtual-list::part(item-error) {
    margin: 0;
    color: var(--lr-color-danger);
    font-size: var(--lr-font-size-sm);
    overflow-wrap: anywhere;
  }
  [part="item-actions"],
  lr-virtual-list::part(item-actions) {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-s);
  }
  [part="retry-button"],
  lr-virtual-list::part(retry-button),
  [part="cancel-button"],
  lr-virtual-list::part(cancel-button) {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-size-0-35em);
    box-sizing: border-box;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: var(--lr-size-0-25rem) var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    font-size: var(--lr-font-size-xs);
    cursor: pointer;
    transition: background-color var(--lr-transition-fast),
      border-color var(--lr-transition-fast), color var(--lr-transition-fast);
  }
  [part="retry-button"]:hover,
  lr-virtual-list::part(retry-button):hover {
    border-color: var(--lr-color-brand);
    color: var(--lr-color-brand);
  }
  /* Pressed keeps the hover's retinted border and label and adds the fill the hover has none of --
     the button's own --lr-color-surface base mixed toward --lr-color-mix-partner. */
  [part="retry-button"]:active,
  lr-virtual-list::part(retry-button):active {
    border-color: var(--lr-color-brand);
    color: var(--lr-color-brand);
    background: color-mix(
      in oklab,
      var(--lr-color-surface),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part="cancel-button"]:hover,
  lr-virtual-list::part(cancel-button):hover {
    border-color: var(--lr-color-danger);
    color: var(--lr-color-danger);
  }
  [part="cancel-button"]:active,
  lr-virtual-list::part(cancel-button):active {
    border-color: var(--lr-color-danger);
    color: var(--lr-color-danger);
    background: color-mix(
      in oklab,
      var(--lr-color-surface),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part="retry-button"]:focus-visible,
  lr-virtual-list::part(retry-button):focus-visible,
  [part="cancel-button"]:focus-visible,
  lr-virtual-list::part(cancel-button):focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  @media (prefers-reduced-motion: reduce) {
    [part="retry-button"],
    lr-virtual-list::part(retry-button),
    [part="cancel-button"],
    lr-virtual-list::part(cancel-button) {
      transition: none !important;
    }
  }
`;
