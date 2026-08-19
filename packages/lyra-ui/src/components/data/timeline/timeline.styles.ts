import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    /* Private implementation properties propagate orientation into every
       slotted <lr-timeline-item>'s own
       stylesheet, via ordinary CSS custom-property inheritance across the slot boundary -- no JS
       coordination between the two components is needed for orientation to propagate.
       --_lr-timeline-item-direction drives an item's own [part='base'] flex-direction; the
       remaining three are its paired companions so an item's [part='track'] (always the *opposite*
       axis from its [part='base']) and [part='content'] (which single logical padding side reaches
       into the inter-item gap) can react to the same orientation switch with no conditional logic of
       their own -- see timeline-item.styles.ts for the consuming side. flex-direction: row is
       inherently the CSS *inline* axis and column the *block* axis, which is also why none of this
       needs an RTL-specific override: a row flex container already reverses its visual child order
       under dir="rtl" for free. */
    --_lr-timeline-item-direction: row; /* vertical (default): marker beside content */
    --_lr-timeline-item-track-direction: column; /* opposite axis, for [part='track'] */
    --_lr-timeline-item-gap-block-end: var(--lr-timeline-gap, var(--lr-space-l));
    --_lr-timeline-item-gap-inline-end: 0;
  }
  :host([orientation='horizontal']) {
    --_lr-timeline-item-direction: column; /* marker above content */
    --_lr-timeline-item-track-direction: row;
    --_lr-timeline-item-gap-block-end: 0;
    --_lr-timeline-item-gap-inline-end: var(--lr-timeline-gap, var(--lr-space-l));
  }

  [part='base'] {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    margin: 0;
    padding: 0;
  }

  /* scale="time": items are positioned at their true proportion of the range instead of being
     evenly spaced, so the shape of the history is visible. Absolute positioning needs a definite
     extent to resolve against -- percentages against an auto-sized track resolve to zero -- hence
     the tokenized --lr-timeline-time-extent below rather than relying on content height. Items
     sharing an instant deliberately overlap: lane assignment, brushing and per-event selection
     belong to a denser component than this passive one. */
  :host([scale='time']) [part='base'] {
    position: relative;
    display: block;
    block-size: var(--lr-timeline-time-extent, var(--lr-size-20rem));
  }
  :host([scale='time'][orientation='horizontal']) [part='base'] {
    block-size: auto;
    inline-size: var(--lr-timeline-time-extent, var(--lr-size-20rem));
  }
  :host([scale='time']) ::slotted(*) {
    position: absolute;
    inset-block-start: var(--_lr-timeline-item-offset, 0%);
    inset-inline-start: 0;
    inline-size: 100%;
  }
  /* collision="stack": coincident items step along the CROSS axis (inline when the timeline runs
     vertically) so they stop covering one another. The lane index is written per item by
     applyCollisionLanes(); the step is tokenized so a consumer can widen it for larger markers.
     Only the inline start moves -- the item keeps its own inline size minus the indent, so a
     stacked run stays inside the host instead of overflowing it. */
  :host([scale='time'][collision='stack']) ::slotted(*) {
    --_lr-timeline-lane-indent: calc(
      var(--_lr-timeline-item-lane, 0) * var(--lr-timeline-collision-offset, var(--lr-space-l))
    );
    inset-inline-start: var(--_lr-timeline-lane-indent);
    inline-size: calc(100% - var(--_lr-timeline-lane-indent));
  }
  /* Horizontal timelines run along the inline axis, so their cross axis is the block axis. */
  :host([scale='time'][collision='stack'][orientation='horizontal']) ::slotted(*) {
    inset-inline-start: var(--_lr-timeline-item-offset, 0%);
    inset-block-start: var(--_lr-timeline-lane-indent);
    inline-size: auto;
  }
  /* Horizontal runs along the inline axis instead, so the offset moves to inset-inline-start. That
     is a logical property, so an RTL timeline reverses for free -- the same reasoning the
     orientation custom properties above rely on. */
  :host([scale='time'][orientation='horizontal']) ::slotted(*) {
    inset-block-start: 0;
    inset-inline-start: var(--_lr-timeline-item-offset, 0%);
    inline-size: auto;
  }
  :host([orientation='horizontal']) [part='base'] {
    flex-direction: row;
    /* Mirrors <lr-tab-group>'s identical horizontal-overflow handling -- a horizontal timeline
       becomes a horizontally-scrollable strip rather than breaking layout. overflow-y is pinned
       explicitly alongside overflow-x: per the CSS overflow spec, leaving one axis unset once the
       other is non-'visible' forces its used value to 'auto' too, which can show a phantom/empty
       scrollbar from sub-pixel rounding even when the content never actually overflows block-wise. */
    overflow-x: auto;
    overflow-y: hidden;
  }
  /* Edge affordance, gated on the strip actually overflowing -- ScrollOverflowController toggles
     data-scroll-overflow from a real scrollWidth/clientWidth measurement. Unconditional (as this
     used to be) it fades the first and last item of a strip that fits. One-sided and RTL-aware,
     matching lr-tab-group/lr-segmented/lr-stepper/lr-widget: data-scroll-start/data-scroll-end
     (also from ScrollOverflowController, logical and live-updated on scroll) report which edge(s)
     genuinely still have more to reach, so a strip scrolled fully to one edge fades only the
     other -- a strip resting at its start no longer dims that already-fully-visible start edge.
     data-scroll-start/data-scroll-end are wrapped in :where() purely to keep these rules'
     specificity pinned to the same [data-scroll-overflow]-only baseline as before -- so the later
     forced-colors override (same base selectors, later in the stylesheet) still wins its tie by
     source order rather than losing to these more-specific-looking selectors. */
  :host([orientation='horizontal'])
    [part='base'][data-scroll-overflow]:where(
      [data-scroll-start][data-scroll-end]
    ) {
    -webkit-mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-mask-opaque) var(--lr-scroll-fade-size),
      var(--lr-mask-opaque) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
    mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-mask-opaque) var(--lr-scroll-fade-size),
      var(--lr-mask-opaque) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
  }
  :host([orientation='horizontal'])
    [part='base'][data-scroll-overflow]:where(
      [data-scroll-end]:not([data-scroll-start])
    ) {
    -webkit-mask-image: linear-gradient(
      to right,
      var(--lr-mask-opaque),
      var(--lr-mask-opaque) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
    mask-image: linear-gradient(
      to right,
      var(--lr-mask-opaque),
      var(--lr-mask-opaque) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
  }
  :host([orientation='horizontal'])
    [part='base'][data-scroll-overflow]:where(
      [data-scroll-start]:not([data-scroll-end])
    ) {
    -webkit-mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-mask-opaque) var(--lr-scroll-fade-size),
      var(--lr-mask-opaque)
    );
    mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-mask-opaque) var(--lr-scroll-fade-size),
      var(--lr-mask-opaque)
    );
  }
  :host(:dir(rtl)[orientation='horizontal'])
    [part='base'][data-scroll-overflow]:where(
      [data-scroll-end]:not([data-scroll-start])
    ) {
    -webkit-mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-mask-opaque) var(--lr-scroll-fade-size),
      var(--lr-mask-opaque)
    );
    mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-mask-opaque) var(--lr-scroll-fade-size),
      var(--lr-mask-opaque)
    );
  }
  :host(:dir(rtl)[orientation='horizontal'])
    [part='base'][data-scroll-overflow]:where(
      [data-scroll-start]:not([data-scroll-end])
    ) {
    -webkit-mask-image: linear-gradient(
      to right,
      var(--lr-mask-opaque),
      var(--lr-mask-opaque) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
    mask-image: linear-gradient(
      to right,
      var(--lr-mask-opaque),
      var(--lr-mask-opaque) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
  }
  @media (forced-colors: active) {
    :host([orientation='horizontal']) [part='base'][data-scroll-overflow],
    :host(:dir(rtl)[orientation='horizontal'])
      [part='base'][data-scroll-overflow] {
      -webkit-mask-image: none;
      mask-image: none;
    }
  }

  /* Matches by role rather than tag name (<lr-timeline-item> sets role="listitem" on itself in
     connectedCallback) so this selector keeps working regardless of the registered tag prefix --
     mirrors <lr-breadcrumb>'s identical ::slotted structural-position technique. Suppresses the
     last item's trailing rail (nothing left to connect to) with no JS coordination between the two
     components -- consumed by <lr-timeline-item>'s own [part='rail'] rule. */
  ::slotted([role='listitem']:last-child) {
    --_lr-timeline-item-rail-visibility: hidden;
  }
`;
