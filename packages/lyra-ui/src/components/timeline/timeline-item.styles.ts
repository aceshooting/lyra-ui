import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --lyra-timeline-marker-size: var(--lyra-size-1-25rem);
    --lyra-timeline-rail-width: var(--lyra-border-width-medium);
    --lyra-timeline-rail-color: var(--lyra-color-border);
    /* Swapped per-variant by the :host([variant]) rules below -- same one-custom-property-per-tone
       shape as lyra-stream-status's --lyra-stream-status-dot-color. */
    --lyra-timeline-marker-color: var(--lyra-color-text-quiet);
  }
  :host([variant='brand']) {
    --lyra-timeline-marker-color: var(--lyra-color-brand);
  }
  :host([variant='success']) {
    --lyra-timeline-marker-color: var(--lyra-color-success);
  }
  :host([variant='warning']) {
    --lyra-timeline-marker-color: var(--lyra-color-warning);
  }
  :host([variant='danger']) {
    --lyra-timeline-marker-color: var(--lyra-color-danger);
  }

  [part='base'] {
    display: flex;
    /* Driven by the --lyra-timeline-item-direction custom property inherited from <lyra-timeline>'s
       :host across the slot boundary -- row (marker beside content) in vertical-timeline mode,
       column (marker above content) in horizontal-timeline mode. This component has no orientation
       attribute of its own; see <lyra-timeline>'s styles for the source of truth. */
    flex-direction: var(--lyra-timeline-item-direction, row);
    gap: var(--lyra-space-s);
  }

  [part='track'] {
    display: flex;
    /* Always the *opposite* axis from [part='base'] -- see the class doc's rail-mechanism note.
       Paired with --lyra-timeline-item-direction at the same <lyra-timeline> source, since CSS has
       no way to derive "the other one of row/column" from a single custom property's value. */
    flex-direction: var(--lyra-timeline-item-track-direction, column);
    align-items: center;
    flex: 0 0 auto;
  }

  [part='marker'] {
    inline-size: var(--lyra-timeline-marker-size);
    block-size: var(--lyra-timeline-marker-size);
    border-radius: 50%;
    flex: 0 0 auto;
    background: var(--lyra-timeline-marker-color);
    /* A slotted <lyra-icon> (or any currentColor-stroked glyph) automatically inherits the correct
       variant tint with no extra wiring. */
    color: var(--lyra-timeline-marker-color);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  /* The pulsing "in-progress" treatment -- same token/guard shape as lyra-stream-status's
     streaming-phase dot pulse. */
  :host([active]) [part='marker'] {
    animation: lyra-timeline-item-pulse var(--lyra-transition-ambient) infinite;
  }
  @keyframes lyra-timeline-item-pulse {
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
    /* Both dimensions set to the same fixed thickness: whichever one ends up being [part='track']'s
       cross axis (see above) is the one that visually matters as the rail's width -- the main-axis
       dimension is just flex-basis's starting point, immediately overridden by flex-grow filling
       whatever length [part='content']'s own padding/height creates (see the class doc's rail
       mechanism). One declaration handles both orientations with no extra conditional. */
    inline-size: var(--lyra-timeline-rail-width);
    block-size: var(--lyra-timeline-rail-width);
    background: var(--lyra-timeline-rail-color);
    /* Suppressed for the last item in a <lyra-timeline> via this custom property, set by
       <lyra-timeline>'s own ::slotted(:last-child) rule -- visibility (not display) keeps the same
       layout box every other item's track has, so marker alignment stays consistent down the list. */
    visibility: var(--lyra-timeline-item-rail-visibility, visible);
  }

  [part='content'] {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-inline-size: 0;
    gap: var(--lyra-space-2xs);
    /* Reaches into the gap before the next item so the rail (which stretches to match this
       element's own size -- see [part='track']) visually meets the next item's marker with no seam.
       Exactly one of these two is non-zero at a time, set together by <lyra-timeline>'s
       :host / :host([orientation='horizontal']) rules; both default to 0 when this item is used
       standalone (no <lyra-timeline> ancestor). */
    padding-block-end: var(--lyra-timeline-item-gap-block-end, 0px);
    padding-inline-end: var(--lyra-timeline-item-gap-inline-end, 0px);
  }

  [part='header'] {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--lyra-space-xs);
  }

  [part='title'] {
    min-inline-size: 0;
    color: var(--lyra-color-text);
    font-weight: var(--lyra-font-weight-semibold);
    line-height: var(--lyra-line-height-snug);
  }

  [part='timestamp'] {
    flex: 0 0 auto;
    color: var(--lyra-color-text-quiet);
    font-size: var(--lyra-font-size-xs);
    white-space: nowrap;
  }
  [part='timestamp'][hidden] {
    display: none;
  }

  [part='description'] {
    min-inline-size: 0;
    color: var(--lyra-color-text-quiet);
    font-size: var(--lyra-font-size-md-sm);
    line-height: var(--lyra-line-height-1-4);
    overflow-wrap: anywhere;
  }
  [part='description'][hidden] {
    display: none;
  }
`;
