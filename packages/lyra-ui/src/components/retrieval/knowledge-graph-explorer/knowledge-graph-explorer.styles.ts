import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    block-size: var(--lr-canvas-reserved-height, var(--lr-size-24rem));
    /* Capture the shared host setting before composed Lyra hosts establish their own fallback. */
    --_lr-knowledge-graph-explorer-detail-clamp: var(
      --lr-popover-viewport-clamp
    );
  }
  /* Makes an explicit host height actually bound the explorer. Without this chain the column sized
     itself from content alone -- chiefly the composed graph's intrinsic svg/canvas aspect ratio --
     so a host height left a dead gap or was overflowed. Same block-size: 100% propagation
     lr-multi-split and lr-widget use; min-block-size: 0 lets the graph shrink past its intrinsic
     size rather than forcing the column taller than its allocation. */
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
  /* Type filters are a consumer-data-driven list (nodeTypes) with no library-imposed size limit;
     uncapped it floors at full content height (browser-default flex-item min-height: auto) and
     starves 100% of the shrinkage onto [part='graph'] below, the part set up to shrink. Same
     max-block-size + overflow-y pattern as [part='search-results'] above. */
  [part='legend'] {
    flex: 0 1 auto;
    max-block-size: var(--lr-size-12rem);
    overflow-y: auto;
    overflow-x: clip;
  }
  /* The one flexible row: it takes what the toolbar, search results, pinned row and path strip
     leave. flex-basis stays auto so the graph contributes its configured block size when room is
     distributed; min-block-size: 0 drops the content-based minimum that would stop it shrinking. */
  [part='graph'] {
    display: block;
    inline-size: 100%;
    flex: 1 1 auto;
    min-block-size: 0;
  }
  [part='detail-card'] {
    max-inline-size: min(
      var(--_lr-knowledge-graph-explorer-detail-clamp),
      var(--lr-size-24rem)
    );
  }
`;
