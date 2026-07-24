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
  /* Two rendering paths, one presentation. Below \`virtualize-at\` (and only while ungrouped) rows
     are committed into this component's own shadow root, where a plain [part~='x'] selector matches
     them. Grouped mode always virtualizes, and so does any list past the threshold; then the
     identical row template becomes <lr-virtual-list>'s .renderItem and Lit commits it inside *that*
     component's shadow root -- a different tree, unreachable from a selector scoped to this one.
     lr-virtual-list::part(x) crosses exactly that one boundary, so both selectors are needed for
     every row-level part; the pairing follows <lr-ingestion-queue>'s own dual-path rows.

     [part='row'] is the one asymmetric case: in the virtualized path the row wrapper is
     <lr-virtual-list>'s own "row" part (re-exported here under the same name), not an element this
     component renders, so the two arms carry different declarations. The virtualized arm omits the
     row separator: those wrappers are absolutely positioned and measured by <lr-virtual-list>
     itself, and the nested chunk row already draws its own block-end border there. */
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
  /* The group header comes from <lr-virtual-list>'s own "group" part (this component passes
     .groups rather than a renderGroup callback), re-exported here as "group-header". The list's
     own default already gives it the surface/quiet/semibold treatment; what it has no opinion on
     is the boundary between the header and the first row beneath it, which this component draws
     with the same separator its rows use. */
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
    /* A border rather than a background-color change: this row's own text (the nested
       lr-chunk-inspector's quiet-toned score text in particular) is sized/colored for the
       page's default surface, and a tinted background can drop that text below the required
       contrast ratio against it -- a border-only indicator carries no such risk. */
    border-inline-start: var(--lr-space-2xs) solid transparent;
    padding-inline-start: var(--lr-space-xs);
  }
  /* The selected state is a second part token rather than the row's data-selected attribute:
     Shadow Parts forbids an attribute selector after ::part(), so ::part(row-body)[data-selected]
     is invalid CSS and the rule would be dropped entirely while virtualized. data-selected stays
     on the element for consumers selecting within their own tree. */
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
  /* The <dt>/<dd> carry their own part names because ::part() matches a single element and cannot
     be followed by a descendant combinator -- ::part(metadata-entry) dt reaches nothing. */
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
  [part='load-more']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='empty'],
  [part='spinner'] {
    padding: var(--lr-space-l);
  }
`;
