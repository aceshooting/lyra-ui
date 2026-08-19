import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    /* The public marker/rail hooks stay undeclared so a theme wrapper can supply them; this
       private marker default is swapped per variant and consumed only when no public value
       inherits from an ancestor or is set on the item. */
    --_lr-timeline-marker-color-default: var(--lr-color-text-quiet);
  }
  :host([variant='brand']) {
    --_lr-timeline-marker-color-default: var(--lr-color-brand);
  }
  :host([variant='success']) {
    --_lr-timeline-marker-color-default: var(--lr-color-success);
  }
  :host([variant='warning']) {
    --_lr-timeline-marker-color-default: var(--lr-color-warning);
  }
  :host([variant='danger']) {
    --_lr-timeline-marker-color-default: var(--lr-color-danger);
  }

  [part='base'] {
    display: flex;
    min-inline-size: 0;
    /* Driven by the private orientation property inherited from <lr-timeline>'s :host across the
       slot boundary: row (marker beside content) when the timeline is vertical, column (marker
       above) when horizontal. This component has no orientation attribute of its own;
       <lr-timeline>'s styles are the source of truth. */
    flex-direction: var(--_lr-timeline-item-direction, row);
    gap: var(--lr-space-s);
  }

  [part='track'] {
    display: flex;
    /* Always the *opposite* axis from [part='base'] -- see the class doc's rail-mechanism note. A
       second property from the same <lr-timeline> source, since CSS cannot derive the other of
       row/column from one custom property's value. */
    flex-direction: var(--_lr-timeline-item-track-direction, column);
    align-items: center;
    flex: 0 0 auto;
  }

  [part='marker'] {
    inline-size: var(--lr-timeline-marker-size, var(--lr-size-1-25rem));
    block-size: var(--lr-timeline-marker-size, var(--lr-size-1-25rem));
    border-radius: 50%;
    flex: 0 0 auto;
    background: var(--lr-timeline-marker-color, var(--_lr-timeline-marker-color-default));
    /* A slotted <lr-icon>, or any currentColor-stroked glyph, inherits the variant tint with no
       extra wiring. */
    color: var(--lr-timeline-marker-color, var(--_lr-timeline-marker-color-default));
    display: inline-flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  /* The icon slot overrides the fallback dot outright -- only the fill is suppressed, not color,
     so a slotted <lr-icon> still inherits the variant tint. */
  [part='marker'][data-has-icon] {
    background: transparent;
  }

  /* The pulsing in-progress treatment -- same token/guard shape as lr-stream-status's
     streaming-phase dot pulse. */
  :host([active]) [part='marker'] {
    outline: var(--lr-border-width-medium) solid
      var(
        --lr-timeline-active-ring-color,
        var(--lr-timeline-marker-color, var(--_lr-timeline-marker-color-default))
      );
    outline-offset: var(--lr-space-2xs);
    animation: lr-timeline-item-pulse var(--lr-transition-ambient) infinite;
  }
  @keyframes lr-timeline-item-pulse {
    0%,
    100% {
      transform: scale(0.85);
      opacity: 0.6;
    }
    50% {
      transform: scale(1);
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    [part='marker'] {
      animation: none !important;
    }
  }

  [part='rail'] {
    flex: 1 1 auto;
    /* Both dimensions take the same fixed thickness: whichever is [part='track']'s cross axis is
       the rail's visible width, while the main-axis one is only flex-basis's start, immediately
       overridden by flex-grow filling whatever length [part='content']'s own padding/height
       creates (see the class doc's rail mechanism). One declaration covers both orientations. */
    inline-size: var(--lr-timeline-rail-width, var(--lr-border-width-medium));
    block-size: var(--lr-timeline-rail-width, var(--lr-border-width-medium));
    background: var(--lr-timeline-rail-color, var(--lr-color-border));
    /* Suppressed for the last item by <lr-timeline>'s own ::slotted(:last-child) rule; visibility,
       not display, keeps the layout box every other item's track has, so marker alignment stays
       consistent down the list. */
    visibility: var(--_lr-timeline-item-rail-visibility, visible);
  }

  [part='content'] {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-inline-size: 0;
    gap: var(--lr-space-2xs);
    /* Reaches into the gap before the next item so the rail, which stretches to match this
       element's own size (see [part='track']), meets the next item's marker with no seam. Exactly
       one of the two is non-zero at a time, set together by <lr-timeline>'s
       :host / :host([orientation='horizontal']) rules; both default to 0 standalone. */
    padding-block-end: var(--_lr-timeline-item-gap-block-end, 0);
    padding-inline-end: var(--_lr-timeline-item-gap-inline-end, 0);
  }

  [part='header'] {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--lr-space-xs);
  }

  [part='title'] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
    color: var(--lr-color-text);
    font-weight: var(--lr-font-weight-semibold);
    line-height: var(--lr-line-height-snug);
  }

  [part='timestamp'] {
    flex: 0 0 auto;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
    white-space: nowrap;
  }
  [part='timestamp'][hidden] {
    display: none;
  }

  [part='description'] {
    min-inline-size: 0;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-md-sm);
    line-height: var(--lr-line-height-1-4);
    overflow-wrap: anywhere;
  }
  [part='description'][hidden] {
    display: none;
  }
`;
