import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    /* Private properties carry orientation into every slotted <lr-timeline-item>'s own stylesheet
       by custom-property inheritance across the slot boundary -- no JS coordination.
       --_lr-timeline-item-direction drives an item's [part='base'] flex-direction; the other three
       are companions, so [part='track'] (always the *opposite* axis from [part='base']) and
       [part='content'] (which logical padding side reaches into the inter-item gap) follow with no
       conditional logic -- consumed by timeline-item.styles.ts. flex-direction: row is inherently
       the CSS *inline* axis and column the *block* axis, so no RTL override is needed: a row flex
       container already reverses its visual child order under dir="rtl". */
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

  /* scale="time": items sit at their true proportion of the range, not evenly spaced, so the shape
     of the history shows. Absolute positioning needs a definite extent -- percentages against an
     auto-sized track resolve to zero -- hence tokenized --lr-timeline-time-extent, not content
     height. Coincident items deliberately overlap; lane assignment, brushing and per-event
     selection belong to a denser component. */
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
     vertically) so they stop covering one another. applyCollisionLanes() writes the lane index per
     item; the step is tokenized so a consumer can widen it for larger markers. Only the inline
     start moves, and the item keeps its inline size minus the indent, so a stack stays inside the
     host. */
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
  /* Horizontal runs along the inline axis, so the offset moves to inset-inline-start -- a logical
     property, so an RTL timeline reverses for free, the same reasoning as the orientation
     properties above. */
  :host([scale='time'][orientation='horizontal']) ::slotted(*) {
    inset-block-start: 0;
    inset-inline-start: var(--_lr-timeline-item-offset, 0%);
    inline-size: auto;
  }
  :host([orientation='horizontal']) [part='base'] {
    flex-direction: row;
    /* Mirrors <lr-tab-group>: a horizontal timeline becomes a horizontally-scrollable strip rather
       than breaking layout. overflow-y is pinned explicitly because the overflow spec forces an
       unset axis to 'auto' once the other is non-'visible', showing a phantom scrollbar from
       sub-pixel rounding even when nothing overflows block-wise. */
    overflow-x: auto;
    overflow-y: hidden;
  }
  /* Edge affordance gated on real overflow: ScrollOverflowController toggles data-scroll-overflow
     from a scrollWidth/clientWidth measurement; unconditional, it fades the first and last item of
     a strip that fits. One-sided and RTL-aware, matching
     lr-tab-group/lr-segmented/lr-stepper/lr-widget -- data-scroll-start/data-scroll-end (same
     controller, logical, live on scroll) report which edges still have more to reach, so a strip
     scrolled to one edge fades only the other. :where() pins them to the same
     [data-scroll-overflow]-only specificity, so the later forced-colors override (same base
     selectors) still wins its tie on source order. */
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

  /* Matches by role, not tag name (<lr-timeline-item> sets role="listitem" in connectedCallback),
     so the selector survives any registered tag prefix -- <lr-breadcrumb>'s ::slotted
     structural-position technique. Suppresses the last item's trailing rail (nothing left to
     connect to) with no JS coordination; consumed by <lr-timeline-item>'s [part='rail'] rule. */
  ::slotted([role='listitem']:last-child) {
    --_lr-timeline-item-rail-visibility: hidden;
  }
`;
