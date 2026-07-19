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
  [part='row'] {
    display: flex;
    align-items: flex-start;
    gap: var(--lr-space-xs);
    padding-inline: var(--lr-space-s);
    padding-block: var(--lr-space-s);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  /* Virtualized mode: the internal `<lr-virtual-list>` supplies its own per-row wrapper (exported
     as `row` above), so this component's own row content -- the checkbox + `[part="row-body"]`
     rendered directly inside that wrapper -- needs the identical flex layout applied from here,
     one shadow hop in via `::part()`. */
  lr-virtual-list::part(row) {
    display: flex;
    align-items: flex-start;
    gap: var(--lr-space-xs);
    padding-inline: var(--lr-space-s);
    padding-block: var(--lr-space-s);
  }
  [part='select'] {
    flex: 0 0 auto;
    margin-block-start: var(--lr-space-2xs);
  }
  [part='row-body'] {
    flex: 1 1 auto;
    min-inline-size: 0;
  }
  [part='row-body'][data-selected] {
    background: var(--lr-color-brand-quiet);
  }
  [part='metadata'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-space-2xs) var(--lr-space-s);
    margin: var(--lr-space-2xs) 0 0;
    padding: 0;
    font-size: var(--lr-font-size-2xs);
    color: var(--lr-color-text-quiet);
  }
  [part='metadata-entry'] {
    display: flex;
    gap: var(--lr-space-2xs);
  }
  [part='metadata-entry'] dt {
    font-weight: var(--lr-font-weight-medium);
  }
  [part='metadata-entry'] dt::after {
    content: ':';
  }
  [part='metadata-entry'] dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
  [part='load-more-row'] {
    display: flex;
    justify-content: center;
    padding: var(--lr-space-s);
  }
  [part='load-more'] {
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: transparent;
    color: var(--lr-color-brand);
    font: inherit;
    font-size: var(--lr-font-size-sm);
    padding: var(--lr-space-2xs) var(--lr-space-m);
    cursor: pointer;
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
