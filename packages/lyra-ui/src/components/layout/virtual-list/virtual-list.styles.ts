import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    /* Consumer-tunable viewport height, same pattern as --lr-chart-height --
       a virtualized list is meaningless without a bounded scroll extent, so
       this ships a sane default rather than collapsing to 0 when a caller
       forgets to size the host. */
    --lr-virtual-list-height: var(--lr-size-24rem);
  }
  [part='base'] {
    position: relative;
    block-size: var(--lr-virtual-list-height);
    overflow-x: hidden;
    overflow-y: auto;
    /* A fast fling shouldn't also scroll the page behind this list once it
       hits either end. */
    overscroll-behavior: contain;
  }
  [part='base']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    /* Negative (inward) so the ring isn't clipped by this element's own
       overflow:auto -- an outward ring (every other component's convention)
       would otherwise be cut off along the scrolling edges. */
    outline-offset: calc(-1 * var(--lr-focus-ring-offset));
  }
  [part='spacer'] {
    position: relative;
    inline-size: 100%;
  }
  [part='row'] {
    position: absolute;
    inset-inline-start: 0;
    inset-block-start: 0;
    inline-size: 100%;
    box-sizing: border-box;
    /* Every row's position updates via this transform on every scroll-driven
       re-render -- hinting the compositor avoids a full repaint per frame. */
    will-change: transform;
  }
  /* The will-change: transform above makes every row its own stacking context, and rows otherwise
     carry no z-index -- so they paint in DOM order and each row paints over the previous one.
     Anything a row renders that overflows its own box (a popup from an lr-menu in a row action, a
     tooltip, an outward focus ring) is therefore painted *underneath* the following rows, no matter
     how high its own z-index is: that z-index only orders siblings inside the row's own context.
     The last row always looks correct, which is why a small fixture never catches it.

     :focus-within lifts the row for exactly as long as something inside it holds focus -- the
     lifetime of an open popup -- and costs nothing the rest of the time. The value deliberately
     matches [part='group'] below rather than exceeding it, so the two land on the same layer and
     DOM order decides: groups render before the rows, so a row wins while (and only while) it holds
     focus -- which is the right outcome, since a group header is a non-interactive
     (pointer-events: none) label and the focused row is where the user is working. */
  [part='row']:focus-within {
    z-index: var(--lr-layer-content);
  }
  [part='group'] {
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
  :host([loading]) [part='base'] {
    cursor: progress;
  }
`;
