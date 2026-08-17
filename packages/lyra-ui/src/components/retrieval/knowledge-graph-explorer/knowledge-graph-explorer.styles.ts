import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  /* An explicit height on the host has to actually bound the rendered explorer. Without this chain
     the column only ever sized itself from its content -- chiefly the composed graph's own
     intrinsic svg/canvas aspect ratio -- so a host height either left a dead gap below the graph or
     was overflowed by it. The same block-size: 100% propagation lr-multi-split and lr-widget use.
     min-block-size: 0 lets the graph below shrink past its intrinsic size instead of forcing the
     column taller than its allocation; with no height on the host both percentages resolve to auto
     and the content-sized behaviour is unchanged. */
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    min-inline-size: 0;
    block-size: 100%;
    min-block-size: 0;
  }
  [part='toolbar'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-s);
  }
  [part='search'] {
    flex: 1 1 var(--lr-size-12rem);
    min-inline-size: 0;
  }
  [part='search-results'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-size-2px);
    max-block-size: var(--lr-size-12rem);
    overflow-y: auto;
    overflow-x: clip;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
  }
  [part='search-result'] {
    display: block;
  }
  [part='search-result'] button {
    display: block;
    inline-size: 100%;
    box-sizing: border-box;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    text-align: start;
    padding: var(--lr-space-xs) var(--lr-space-s);
    border: none;
    background: transparent;
    color: var(--lr-color-text);
    font: inherit;
    overflow-wrap: anywhere;
    cursor: pointer;
  }
  [part='search-result'] button:hover {
    background: color-mix(in srgb, var(--lr-color-text) 8%, transparent);
  }
  [part='search-result'] button:active {
    background: color-mix(in oklab, transparent, var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='search-result'] button:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-width));
  }
  [part='search-empty'] {
    padding: var(--lr-space-xs) var(--lr-space-s);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }
  [part='pinned'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
  }
  [part='pinned-heading'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }
  /* Type filters are a consumer-data-driven list (nodeTypes) with no library-imposed size limit --
     without a cap it floors at its full content height (browser-default flex-item min-height:
     auto) and starves 100% of the shrinkage onto [part='graph'] below, even though that part is
     explicitly set up to be the one that shrinks. Same max-block-size + overflow-y pattern as
     [part='search-results'] above. */
  [part='legend'] {
    flex: 0 1 auto;
    max-block-size: var(--lr-size-12rem);
    overflow-y: auto;
    overflow-x: clip;
  }
  /* The one flexible row: it takes whatever the toolbar, search results, pinned row and path strip
     leave over. flex-basis stays auto so an unsized host still gets the graph's intrinsic height,
     while min-block-size: 0 removes the automatic content-based flex minimum that would otherwise
     stop it shrinking into a shorter allocation. */
  [part='graph'] {
    display: block;
    inline-size: 100%;
    flex: 1 1 auto;
    min-block-size: 0;
  }
  [part='detail-card'] {
    max-inline-size: min(var(--lr-popover-viewport-clamp), var(--lr-size-24rem));
  }
`;
