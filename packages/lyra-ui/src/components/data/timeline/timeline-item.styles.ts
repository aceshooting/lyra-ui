import { activeFill, focusRing, hoverFill, iconHitTarget, interactiveTransition } from '../../../internal/interactive-control.styles.js';
import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    --_lr-timeline-marker-color-default: var(--lr-timeline-marker-neutral-color, var(--lr-color-text-quiet));
    --_lr-timeline-rail-width: var(--lr-timeline-connector-width, var(--lr-timeline-rail-width, var(--lr-border-width-medium)));
    --_lr-timeline-rail-color: var(--lr-timeline-connector-color, var(--lr-timeline-rail-color, var(--lr-color-border-subtle)));
  }
  :host([variant='brand']) {
    --_lr-timeline-marker-color-default: var(--lr-timeline-marker-brand-color, var(--lr-color-brand));
  }
  :host([variant='success']) {
    --_lr-timeline-marker-color-default: var(--lr-timeline-marker-success-color, var(--lr-color-success));
  }
  :host([variant='warning']) {
    --_lr-timeline-marker-color-default: var(--lr-timeline-marker-warning-color, var(--lr-color-warning));
  }
  :host([variant='danger']) {
    --_lr-timeline-marker-color-default: var(--lr-timeline-marker-danger-color, var(--lr-color-danger));
  }

  [part~='base'] {
    /* flex normally; an alternating parent timeline switches it to three grid columns with the
       rail in the middle one. */
    display: var(--_lr-timeline-item-base-display, flex);
    grid-template-columns: 1fr auto 1fr;
    min-inline-size: 0;
    flex-direction: var(--_lr-timeline-item-direction, row);
    gap: var(--lr-space-s);
  }

  [part='track'] {
    position: relative;
    display: flex;
    flex-direction: var(--_lr-timeline-item-track-direction, column);
    justify-content: var(--_lr-timeline-item-track-justify, flex-start);
    align-items: center;
    flex: 0 0 auto;
    grid-column: var(--_lr-timeline-item-track-col, auto);
    grid-row: 1;
    /* The marker's resting size, which the rail halves of a centered marker measure around. */
    --_lr-timeline-marker-extent: var(--lr-timeline-marker-size, var(--lr-size-1-25rem));
    padding-block-end: var(--_lr-timeline-item-track-pad, 0);
  }
  [part='track'][data-has-icon] {
    --_lr-timeline-marker-extent: var(--lr-timeline-icon-marker-size, var(--lr-timeline-marker-size, var(--lr-size-1-25rem)));
  }

  [part='marker'] {
    inline-size: var(--_lr-timeline-marker-extent, var(--lr-timeline-marker-size, var(--lr-size-1-25rem)));
    block-size: var(--_lr-timeline-marker-extent, var(--lr-timeline-marker-size, var(--lr-size-1-25rem)));
    border-radius: 50%;
    flex: 0 0 auto;
    background: var(--lr-timeline-marker-color, var(--_lr-timeline-marker-color-default));
    color: var(--lr-timeline-marker-color, var(--_lr-timeline-marker-color-default));
    display: inline-flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  [part='marker'][data-has-icon] {
    background: transparent;
  }

  /* Ordered timeline: the step number is the marker's content, so the marker becomes a ring around
     real text -- the variant tint moves to the border and the number keeps body-text contrast on
     whatever surface the timeline sits on. It is at least the marker size and grows for a long
     number instead of clipping it. */
  [part='marker'][data-ordered] {
    --_lr-timeline-ordered-marker-size: var(--lr-timeline-ordered-marker-size, var(--lr-timeline-marker-size, var(--lr-size-1-5rem)));
    box-sizing: border-box;
    inline-size: auto;
    min-inline-size: var(--_lr-timeline-ordered-marker-size);
    block-size: var(--_lr-timeline-ordered-marker-size);
    padding-inline: var(--lr-space-2xs);
    border: var(--lr-border-width-medium) solid
      var(--lr-timeline-marker-color, var(--_lr-timeline-marker-color-default));
    border-radius: var(--lr-radius-pill);
    background: transparent;
    color: var(--lr-timeline-marker-number-color, var(--lr-color-text));
    font-size: var(--lr-font-size-xs);
    font-weight: var(--lr-font-weight-semibold);
    font-variant-numeric: tabular-nums;
    line-height: var(--lr-line-height-none);
  }

  :host([active]) [part='marker'] {
    outline: var(--lr-border-width-medium) solid
      var(
        --lr-timeline-active-ring-color,
        var(--lr-timeline-marker-color, var(--_lr-timeline-marker-color-default))
      );
    outline-offset: var(--lr-space-2xs);
    animation: var(--_lr-motion-animation, lr-timeline-item-pulse var(--lr-transition-ambient) infinite);
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

  [part~='rail'] {
    flex: 1 1 auto;
    position: var(--_lr-timeline-item-rail-position, static);
    inset: 0;
    inline-size: var(--_lr-timeline-item-rail-inline, var(--_lr-timeline-rail-width));
    block-size: var(--_lr-timeline-item-rail-block, var(--_lr-timeline-rail-width));
    margin-block: var(--_lr-timeline-item-rail-gap-block, var(--lr-timeline-connector-gap, 0px));
    margin-inline: var(--_lr-timeline-item-rail-gap-inline, 0px);
    background: var(--_lr-timeline-item-rail-bg, var(--_lr-timeline-rail-color));
    /* Suppressed for the last item by <lr-timeline>'s own ::slotted(:last-child) rule; visibility,
       not display, keeps the layout box every other item's track has, so marker alignment stays
       consistent down the list. */
    visibility: var(--_lr-timeline-item-rail-visibility-center, var(--_lr-timeline-item-rail-visibility, visible));
  }

  /* A centered marker splits its rail into the half above and the half below, each stopping one
     connector gap short of the marker. The first item has nothing above it and the last nothing
     below; the empty content value keeps both halves out of every other layout. */
  [part~='rail']::before,
  [part~='rail']::after {
    content: var(--_lr-timeline-item-rail-halves, none);
    position: absolute;
    inset-inline: 0;
    margin-inline: auto;
    inline-size: var(--_lr-timeline-rail-width);
    background: var(--_lr-timeline-rail-color);
  }
  [part~='rail']::before {
    inset-block-start: 0;
    block-size: calc(
      (100% - var(--_lr-timeline-item-gap-block-end, 0px)) / 2 - var(--_lr-timeline-marker-extent) / 2 -
        var(--lr-timeline-connector-gap, 0px)
    );
  }
  [part~='rail']::after {
    inset-block-end: 0;
    block-size: calc(
      (100% + var(--_lr-timeline-item-gap-block-end, 0px)) / 2 - var(--_lr-timeline-marker-extent) / 2 -
        var(--lr-timeline-connector-gap, 0px)
    );
  }
  :host(:first-child) [part~='rail']::before,
  :host(:last-child) [part~='rail']::after {
    display: none;
  }

  [part='content'] {
    grid-column: var(--_lr-timeline-alt-content-col, auto);
    grid-row: 1;
    text-align: var(--_lr-timeline-item-content-align, start);
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

  /* The opposite column: a fixed share beside the rail so every item's rail lines up, or the other
     grid column of an alternating timeline. */
  [part='opposite'] {
    grid-column: var(--_lr-timeline-alt-opposite-col, auto);
    grid-row: 1;
    flex: 0 0 var(--_lr-timeline-item-opposite-basis, var(--lr-timeline-opposite-size, 30%));
    min-inline-size: 0;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-xs);
    line-height: var(--lr-line-height-snug);
    overflow-wrap: anywhere;
    text-align: var(--_lr-timeline-item-opposite-align, end);
  }
  [part='opposite'][hidden] {
    display: none;
  }

  /* Every other item of an alternating timeline switches sides. */
  :host(:nth-of-type(even)) [part='content'] {
    grid-column: var(--_lr-timeline-alt-flip-content-col, var(--_lr-timeline-alt-content-col, auto));
    text-align: var(--_lr-timeline-alt-flip-content-align, var(--_lr-timeline-item-content-align, start));
  }
  :host(:nth-of-type(even)) [part='opposite'] {
    grid-column: var(--_lr-timeline-alt-flip-opposite-col, var(--_lr-timeline-alt-opposite-col, auto));
    text-align: var(--_lr-timeline-alt-flip-opposite-align, var(--_lr-timeline-item-opposite-align, end));
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
    font-weight: var(--lr-timeline-title-font-weight, var(--lr-font-weight-semibold));
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

  [part='cluster'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    ${iconHitTarget}
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  [part='cluster-count'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    min-inline-size: var(--lr-timeline-cluster-size, var(--lr-size-2rem));
    min-block-size: var(--lr-timeline-cluster-size, var(--lr-size-2rem));
    padding-inline: var(--lr-space-xs);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-timeline-cluster-bg, var(--lr-color-brand));
    color: var(--lr-timeline-cluster-color, var(--lr-color-on-brand));
    font-size: var(--lr-font-size-sm);
    font-weight: var(--lr-font-weight-semibold);
    line-height: var(--lr-line-height-snug);
    ${interactiveTransition}
  }
  [part='cluster']:hover [part='cluster-count'] {
    background: ${hoverFill('var(--lr-timeline-cluster-bg, var(--lr-color-brand))')};
  }
  [part='cluster']:active [part='cluster-count'] {
    background: ${activeFill('var(--lr-timeline-cluster-bg, var(--lr-color-brand))')};
  }
  [part='cluster']:focus-visible {
    ${focusRing}
  }

  @media (forced-colors: active) {
    [part='marker']:not([data-has-icon]):not([data-ordered]) {
      background: CanvasText;
    }
    [part='marker'][data-ordered] {
      border-color: CanvasText;
    }
    :host([active]) [part='marker'] {
      outline-color: Highlight;
    }
    [part~='rail'],
    [part~='rail']::before,
    [part~='rail']::after {
      background: CanvasText;
    }
    [part='cluster-count'] {
      border: var(--lr-border-width-medium) solid ButtonText;
      background: ButtonFace;
      color: ButtonText;
      forced-color-adjust: auto;
    }
    [part='cluster']:hover [part='cluster-count'] {
      border-color: Highlight;
    }
    [part='cluster']:focus-visible {
      outline-color: Highlight;
    }
  }
`;
