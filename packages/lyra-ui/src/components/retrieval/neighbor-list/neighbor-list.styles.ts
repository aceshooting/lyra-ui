import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  /* Every row rule below has an lr-virtual-list::part(x) twin because rows render through two
     paths: at or below virtualize-at, renderNeighborRow()'s result lands in this component's own
     shadow root and the plain [part=] selector matches; above it, the same content becomes
     <lr-virtual-list>'s .renderItem and lands in *its* shadow root, which only ::part() reaches.
     Dropping either unstyles one path.

     [part='row'] is the one name shared with lr-virtual-list's own per-row wrapper -- hence
     renderItem returns only the row's *content*: a nested second part="row" would match ::part(row)
     too (part~= semantics, any depth), doubling this rule's padding and divider border on every
     virtualized row. */
  [part='row'],
  lr-virtual-list::part(row) {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    padding-block: var(--lr-space-xs);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='node-label'],
  lr-virtual-list::part(node-label) {
    flex: 1 1 auto;
    display: flex;
    align-items: baseline;
    gap: var(--lr-space-xs);
    box-sizing: border-box;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: var(--lr-size-2px) 0;
    border: none;
    background: transparent;
    color: var(--lr-color-text);
    font: inherit;
    text-align: start;
    cursor: pointer;
  }
  [part='node-label']:focus-visible,
  lr-virtual-list::part(node-label):focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='node-label']:hover,
  lr-virtual-list::part(node-label):hover {
    background: var(--lr-color-brand-quiet);
  }
  [part='node-label']:active,
  lr-virtual-list::part(node-label):active {
    background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='direction'],
  lr-virtual-list::part(direction) {
    flex: 0 0 auto;
    color: var(--lr-color-text-quiet);
  }
  [part='relation'],
  lr-virtual-list::part(relation) {
    flex: 0 0 auto;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
  }
  [part='node-meta'],
  lr-virtual-list::part(node-meta) {
    /* A flex item's default min-inline-size is auto, a content-based minimum. Where the host's
       width resolves intrinsically (as a flex/grid item -- a common sidebar/detail-panel layout)
       rather than against a definite available width, that minimum -- node-meta's nowrap text --
       propagates up through row and host and grows the layout past its container instead of
       eliding. Pinning it to 0 keeps node-meta and its containers out of that contribution, so
       overflow/text-overflow can clip. */
    min-inline-size: 0;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part='expand-button'],
  lr-virtual-list::part(expand-button) {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    /* Keep the glyph compact while giving the interactive box the shared minimum target size --
       same split as lr-code-block's own [part='toggle']. */
    inline-size: var(--lr-size-1-25rem);
    block-size: var(--lr-size-1-25rem);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    border: none;
    border-radius: var(--lr-radius-xs);
    background: transparent;
    color: var(--lr-color-text-quiet);
    cursor: pointer;
  }
  [part='expand-button']:hover,
  lr-virtual-list::part(expand-button):hover {
    background: color-mix(in srgb, var(--lr-color-text) 8%, transparent);
  }
  [part='expand-button']:active,
  lr-virtual-list::part(expand-button):active {
    background: color-mix(in oklab, transparent, var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='expand-button']:focus-visible,
  lr-virtual-list::part(expand-button):focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* Virtualized, the groups property's relation headers render through lr-virtual-list's own
     "group" part (re-exported here as "group-header"), not this component's [part='group-header'],
     so both need the same presentation or the headers change the moment the list crosses
     virtualize-at. Only typography is shared: virtual-list positions and inline-pads its own
     labels. */
  [part='group-header'],
  lr-virtual-list::part(group) {
    padding-block: var(--lr-space-xs);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
    font-weight: var(--lr-font-weight-semibold);
    text-transform: uppercase;
  }
`;
