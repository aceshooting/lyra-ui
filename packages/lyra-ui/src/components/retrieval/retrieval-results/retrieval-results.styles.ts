import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='error'] {
    padding: var(--lr-space-m);
    color: var(--lr-color-danger);
    font-size: var(--lr-font-size-sm);
  }
  /* Two rendering paths, one presentation. Ungrouped and below 'virtualize-at', rows commit into
     this component's own shadow root and a plain [part~='x'] selector matches. Grouped mode, and
     any list past the threshold, virtualize: the same template becomes <lr-virtual-list>'s
     .renderItem and Lit commits it in *its* shadow root, so every row-level part also needs
     lr-virtual-list::part(x), which crosses that one boundary. Pairing follows
     <lr-ingestion-queue>'s own dual-path rows.

     [part='row'] is asymmetric: virtualized, the wrapper is <lr-virtual-list>'s own "row" part
     re-exported under the same name, not an element this component renders, so the arms differ.
     The virtualized arm omits the separator -- those wrappers are absolutely positioned and
     measured by <lr-virtual-list>, and the nested chunk row already draws its block-end border. */
  [part='row'] {
    display: flex;
    align-items: flex-start;
    gap: var(--lr-space-xs);
    padding-inline: var(--lr-space-s);
    padding-block: var(--lr-space-s);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  lr-virtual-list::part(row) {
    display: flex;
    align-items: flex-start;
    gap: var(--lr-space-xs);
    padding-inline: var(--lr-space-s);
    padding-block: var(--lr-space-s);
  }
  /* The group header is <lr-virtual-list>'s own "group" part -- this component passes .groups, not
     a renderGroup callback -- re-exported here as "group-header". The list already gives it the
     surface/quiet/semibold treatment but has no opinion on the boundary to the first row beneath
     it, which this component draws with the same separator its rows use. */
  lr-virtual-list::part(group) {
    box-sizing: border-box;
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part~='select'],
  lr-virtual-list::part(select) {
    flex: 0 0 auto;
    margin-block-start: var(--lr-space-2xs);
  }
  [part~='row-body'],
  lr-virtual-list::part(row-body) {
    flex: 1 1 auto;
    min-inline-size: 0;
    /* A border rather than a background-color change: this row's text -- the nested
       lr-chunk-inspector's quiet-toned score in particular -- is sized and colored for the page's
       default surface, and a tinted background can drop it below the required contrast ratio. */
    border-inline-start: var(--lr-space-2xs) solid transparent;
    padding-inline-start: var(--lr-space-xs);
  }
  /* A second part token rather than the row's data-selected attribute: Shadow Parts forbids an
     attribute selector after ::part(), so ::part(row-body)[data-selected] is invalid CSS and the
     rule would drop entirely while virtualized. data-selected stays on the element for consumers
     selecting within their own tree. */
  [part~='row-body-selected'],
  lr-virtual-list::part(row-body-selected) {
    border-inline-start-color: var(--lr-retrieval-results-selected-border, var(--lr-color-brand));
  }
  [part~='metadata'],
  lr-virtual-list::part(metadata) {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-2xs) var(--lr-space-s);
    margin: var(--lr-space-2xs) 0 0;
    padding: 0;
    font-size: var(--lr-font-size-2xs);
    color: var(--lr-color-text-quiet);
  }
  [part~='metadata-entry'],
  lr-virtual-list::part(metadata-entry) {
    display: flex;
    gap: var(--lr-space-2xs);
  }
  /* The <dt>/<dd> carry their own part names: ::part() matches one element and takes no descendant
     combinator -- ::part(metadata-entry) dt reaches nothing. */
  [part~='metadata-term'],
  lr-virtual-list::part(metadata-term) {
    font-weight: var(--lr-font-weight-medium);
  }
  [part~='metadata-value'],
  lr-virtual-list::part(metadata-value) {
    margin: 0;
    overflow-wrap: anywhere;
  }
  [part='load-more-row'] {
    display: flex;
    justify-content: center;
    padding: var(--lr-space-s);
  }
  [part='load-more'] {
    box-sizing: border-box;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: transparent;
    color: var(--lr-color-brand);
    font: inherit;
    font-size: var(--lr-font-size-sm);
    padding: var(--lr-space-2xs) var(--lr-space-m);
    cursor: pointer;
  }
  [part='load-more']:hover {
    background: var(--lr-color-brand-quiet);
  }
  [part='load-more']:active {
    background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='load-more']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='empty'],
  [part='spinner'] {
    padding: var(--lr-space-l);
  }
`;
