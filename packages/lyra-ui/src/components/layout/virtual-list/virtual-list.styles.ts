import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    /* Consumer-tunable viewport height, same pattern as --lr-chart-height -- a virtualized list
       needs a bounded scroll extent, not a collapse to 0. */
    --_lr-virtual-list-height: var(--lr-size-24rem);
  }
  [part="base"] {
    position: relative;
    min-inline-size: 0;
    block-size: var(--lr-virtual-list-height, var(--_lr-virtual-list-height));
    /* Rows inherit overflow-wrap: anywhere below; content opting out with white-space: nowrap
       stays reachable through this scrollport. */
    overflow-x: auto;
    overflow-y: auto;
    /* A fast fling must not scroll the page behind this list at either end. */
    overscroll-behavior: contain;
  }
  [part="base"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    /* Inward: the outward ring every other component uses is clipped along the scrolling edges by
       this element's own overflow:auto. */
    outline-offset: calc(-1 * var(--lr-focus-ring-offset));
  }
  /* [part="base"] always carries tabindex="0", so mouse users need a hint it is interactive. A plain
     border color, not the focus ring's brand color, keeps the ring distinct; inward offset for the
     reason above. */
  /* no-pressed-state: the scroll port activates nothing, and :active matches the ancestors of
     whatever was pressed, so clicking any row would flash this outline around the entire list. */
  [part="base"]:hover {
    outline-width: var(
      --lr-virtual-list-hover-outline-width,
      var(--lr-border-width-thin)
    );
    outline-style: var(--lr-virtual-list-hover-outline-style, solid);
    outline-color: var(
      --lr-virtual-list-hover-outline-color,
      var(--lr-color-border-strong)
    );
    outline-offset: var(
      --lr-virtual-list-hover-outline-offset,
      calc(-1 * var(--lr-border-width-thin))
    );
  }
  [part="spacer"] {
    position: relative;
    min-inline-size: 0;
    inline-size: 100%;
  }
  [part="row"] {
    position: absolute;
    inset-inline-start: 0;
    inset-block-start: 0;
    min-inline-size: 0;
    inline-size: 100%;
    box-sizing: border-box;
    /* Caller-supplied renderItem content: a wrapping opportunity keeps a long unbroken value from
       widening the list or staying at the fallback auto-row estimate. A consumer opts out with
       white-space: nowrap for horizontal scrolling. */
    overflow-wrap: anywhere;
    /* Row positions update via this transform on every scroll-driven re-render -- the compositor
       hint avoids a full repaint per frame. */
    will-change: transform;
  }
  /* will-change: transform makes each row its own stacking context and rows carry no z-index, so
     they paint in DOM order: anything overflowing a row (an lr-menu popup, a tooltip, an outward
     focus ring) paints under the following rows however high its own z-index, which only orders
     siblings within that row.

     lr-dropdown[open] joins :focus-within because a measurement/render pass after the menu moves
     focus can transiently drop focus to <body> with the fixed popup still open. The value matches
     [part='group'] below rather than exceeding it, so both share a layer and DOM order decides:
     groups render first, so an active row wins. */
  [part="row"]:where(:focus-within, :has(lr-dropdown[open])) {
    z-index: var(--lr-layer-content);
  }
  /* lr-thread-list's renderItem output lands in this shadow root, so an excerpt's <mark> is
     unreachable from the thread-list stylesheet or a rule following ::part(row-excerpt). Pinned to
     that callback's own part so other virtualized row hooks keep their semantics; the public
     properties inherit from lr-thread-list through this host and stay component-scoped. */
  [part="row"] [part~="row-excerpt"] mark {
    background: var(
      --lr-thread-list-excerpt-highlight-background,
      var(--lr-color-warning-quiet)
    );
    color: var(--lr-thread-list-excerpt-highlight-foreground, inherit);
    border-radius: var(
      --lr-thread-list-excerpt-highlight-radius,
      var(--lr-radius-xs)
    );
    padding: var(--lr-thread-list-excerpt-highlight-padding, 0);
  }
  [part="group"] {
    position: absolute;
    inset-inline: 0;
    inset-block-start: 0;
    z-index: var(--lr-layer-content);
    padding: var(--lr-space-xs) var(--lr-space-s);
    background: var(--lr-color-surface);
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-size-0-875em);
    font-weight: var(--lr-font-weight-semibold);
    pointer-events: none;
  }
  /* Pinned copy of the group the viewport is inside. position: sticky is inert on the group markers
     and rows -- they are absolutely positioned and transform-offset by the windowing math -- so
     this is a separate in-flow layer. Inside [part='spacer'], not beside it: the spacer's height
     comes from the offsets array and its rows are absolutely positioned, so an in-flow child moves
     nothing, while an in-flow sibling would consume flow height at the top of the scroll container
     and push every row down. Sticking works because the scrollport is [part='base'] and the spacer
     spans the whole scrollable extent. z-index matches [part='group'] and a focused [part='row']
     rather than exceeding it: this renders after both, so DOM order already paints it on top. */
  [part="sticky-group"] {
    position: sticky;
    inset-block-start: 0;
    z-index: var(--lr-layer-content);
    /* An inert, aria-hidden copy of a real row: pointer input passes through so it never creates a
       mouse-only action while its semantic/keyboard owner is virtualized. */
    pointer-events: none;
  }
  /* Nothing to pin above the first group. The band stays in the DOM so its height stays measurable
     (the scroll inset is sized from it) -- visibility, not display, since a display: none box has
     no height to measure. */
  [part="sticky-group"][data-inactive] {
    visibility: hidden;
  }
  :host([loading]) [part="base"] {
    cursor: progress;
  }
`;
