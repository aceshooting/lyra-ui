import { activeFill, focusRing, hoverFill, iconHitTarget, interactiveTransition } from '../../../internal/interactive-control.styles.js';
import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    --_lr-timeline-marker-color-default: var(--lr-timeline-marker-neutral-color, var(--lr-color-text-quiet));
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

  [part='base'] {
    display: flex;
    min-inline-size: 0;
    flex-direction: var(--_lr-timeline-item-direction, row);
    gap: var(--lr-space-s);
  }

  [part='track'] {
    display: flex;
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

  [part='rail'] {
    flex: 1 1 auto;
    inline-size: var(--lr-timeline-rail-width, var(--lr-border-width-medium));
    block-size: var(--lr-timeline-rail-width, var(--lr-border-width-medium));
    background: var(--lr-timeline-rail-color, var(--lr-color-border-subtle));
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
    [part='rail'] {
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
