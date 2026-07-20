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
  /* [part="base"] unconditionally carries tabindex="0" (a real, always-focusable target, not a
     decorative element) -- this pairs a subtler preview of the same outline treatment for mouse
     users, who otherwise get no indication the scroll region is interactive/keyboard-navigable at
     all. Deliberately a plain border color rather than the focus-ring's own brand color, so hover
     still reads as a preview and the eventual :focus-visible ring stays visually distinct.
     Negative (inward) offset for the same reason as :focus-visible above. */
  [part='base']:hover {
    outline: var(--lr-border-width-thin) solid var(--lr-color-border-strong);
    outline-offset: calc(-1 * var(--lr-border-width-thin));
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
  /* The pinned copy of the group the viewport is currently inside. Native position: sticky cannot
     be used on the group markers or rows themselves -- they are absolutely positioned and
     transform-offset by the windowing math, which makes sticky structurally inert -- so this is a
     separate in-flow layer.

     It lives inside [part='spacer'] rather than beside it: the spacer's own height is set explicitly
     from the offsets array and every row inside it is absolutely positioned, so an in-flow child
     here contributes nothing to any other element's position. An in-flow sibling of the spacer would
     instead consume real flow height at the top of the scroll container and push every row down by
     its own height. Sticking still works because the scrollport is [part='base'] and the spacer's
     box spans the entire scrollable extent.

     z-index matches [part='group'] and a focused [part='row'] rather than exceeding it: this layer
     is rendered after both, so DOM order already paints it on top. */
  [part='sticky-group'] {
    position: sticky;
    inset-block-start: 0;
    z-index: var(--lr-layer-content);
    /* The group content a consumer copies in here is frequently interactive (a collapse toggle, a
       menu), but this is a *copy* of a row that already exists in the list, so interactivity is
       opt-in: a consumer that wants the pinned copy clickable sets
       lr-virtual-list::part(sticky-group) { pointer-events: auto; }. Left as-is, clicks and hover
       fall through to the rows underneath. */
    pointer-events: none;
  }
  /* Scrolled above the first group there is nothing to pin. The band stays in the DOM anyway so its
     height remains measurable (the scroll inset is sized from it), but it must show nothing:
     visibility, not display, because a display: none box has no height to measure. */
  [part='sticky-group'][data-inactive] {
    visibility: hidden;
  }
  :host([loading]) [part='base'] {
    cursor: progress;
  }
`;
