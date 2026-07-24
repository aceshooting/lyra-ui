import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  /* Every row rule below is paired with an lr-virtual-list::part(x) twin because this component
     renders rows through two paths. At or below virtualize-at, renderNeighborRow()'s result is
     committed into this component's own shadow root and the plain [part=] selector matches. Above
     it, the exact same content becomes <lr-virtual-list>'s .renderItem, and Lit commits it wherever
     virtual-list's own render() is updating -- i.e. inside *its* shadow root, a different shadow
     tree that a [part=] selector scoped to this one can never reach. ::part() crosses that single
     boundary. Both selectors are load-bearing; dropping either silently unstyles one path.

     [part='row'] is the one name shared with lr-virtual-list's own per-row wrapper, which is
     exactly why renderItem returns only the row's *content*: a nested second part="row" would be
     matched by ::part(row) too (::part uses part~= semantics and reaches any depth of the target
     shadow tree), doubling this rule's padding and divider border on every virtualized row. */
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
  [part='expand-button']:focus-visible,
  lr-virtual-list::part(expand-button):focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* Virtualized mode renders the relation headers from the groups property through
     lr-virtual-list's own "group" part (re-exported from here as "group-header"), not through this
     component's
     [part='group-header'] element -- so the same presentation has to be stated for both, or the
     headers change appearance the moment the list crosses virtualize-at. Only the typographic
     treatment is shared: virtual-list positions and inline-pads its own group labels, which is
     layout this rule deliberately leaves alone. */
  [part='group-header'],
  lr-virtual-list::part(group) {
    padding-block: var(--lr-space-xs);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
    font-weight: var(--lr-font-weight-semibold);
    text-transform: uppercase;
  }
`;
