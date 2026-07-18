import { css } from 'lit';

export const styles = css`
  :host {
    display: flex;
    align-items: center;
    gap: var(--lyra-space-s);
    inline-size: 100%;
  }
  [part='base'] {
    position: relative;
    flex: 1 1 auto;
    block-size: var(--lyra-size-1-5rem);
  }
  [part='track'] {
    position: absolute;
    inset-inline: 0;
    inset-block-start: 50%;
    block-size: var(--lyra-size-4px);
    transform: translateY(-50%);
    border-radius: var(--lyra-size-2px);
    background: var(--lyra-color-border);
  }
  [part='fill'] {
    position: absolute;
    inset-inline-start: 0;
    inset-block-start: 50%;
    block-size: var(--lyra-size-4px);
    transform: translateY(-50%);
    border-radius: var(--lyra-size-2px);
    background: var(--lyra-color-brand);
  }
  [part='thumb'] {
    position: absolute;
    inset-block-start: 50%;
    inline-size: var(--lyra-size-16px);
    block-size: var(--lyra-size-16px);
    border-radius: 50%;
    background: var(--lyra-color-brand);
    border: var(--lyra-border-width-medium) solid var(--lyra-color-surface);
    box-shadow: var(--lyra-shadow);
    transform: translate(-50%, -50%);
    cursor: grab;
    touch-action: none;
  }
  /* [part='thumb'] is positioned with a logical inset-inline-start:<pct>% (set inline in
     render()), which the browser anchors to the box's own *start* edge -- the physical right
     edge under :dir(rtl). The fixed horizontal -50% above assumes an LTR left-edge anchor, so
     it has to flip sign under RTL or the visible dot ends up a full thumb-width off from its
     true track position. Mirrors lyra-time-range's identical handle rule. */
  :host(:dir(rtl)) [part='thumb'] {
    transform: translate(50%, -50%);
  }
  /* The visible dot is 16px, under the ~24px touch-target minimum. Widen the
     hit/drag area with a transparent ::before instead of growing the thumb
     itself — onPointerMove never reads the thumb's own
     getBoundingClientRect() (only [part="track"]'s rect and e.clientX), and a
     pointerdown inside the ::before still reports e.target as the thumb
     element (pseudo-elements have no separate DOM node/event target), so
     this is purely additive and cannot change the drag math. Mirrors
     lyra-time-range's identical handle::before. */
  [part='thumb']::before {
    content: '';
    position: absolute;
    inset-block-start: 50%;
    inset-inline-start: 50%;
    inline-size: var(--lyra-size-28px);
    block-size: var(--lyra-size-28px);
    transform: translate(-50%, -50%);
    border-radius: 50%;
  }
  /* Same logical-inset-vs-physical-transform mismatch as the thumb itself: this enlarged
     hit-area is centered on inset-inline-start: 50%, so its horizontal translate must flip
     sign under RTL too or the actual drag hit zone detaches from the visible thumb. Mirrors
     lyra-time-range's identical handle::before rule. */
  :host(:dir(rtl)) [part='thumb']::before {
    transform: translate(50%, -50%);
  }
  [part='thumb']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='thumb']:active {
    cursor: grabbing;
  }
  [part='value'] {
    flex: 0 0 auto;
    font-size: var(--lyra-font-size-sm);
    color: var(--lyra-color-text-quiet);
    /* Numeric readout ticks as the thumb moves; tabular-nums keeps its own
       inline-size stable instead of jittering the layout next to it. */
    font-variant-numeric: tabular-nums;
    min-inline-size: var(--lyra-size-2-5ch);
    text-align: end;
  }
  :host(:disabled) {
    opacity: var(--lyra-opacity-disabled);
    cursor: not-allowed;
  }
  :host(:disabled) [part='thumb'] {
    cursor: not-allowed;
  }
`;
