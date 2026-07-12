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
    block-size: 1.5rem;
  }
  [part='track'] {
    position: absolute;
    inset-inline: 0;
    inset-block-start: 50%;
    block-size: 4px;
    transform: translateY(-50%);
    border-radius: 2px;
    background: var(--lyra-color-border);
  }
  [part='fill'] {
    position: absolute;
    inset-inline-start: 0;
    inset-block-start: 50%;
    block-size: 4px;
    transform: translateY(-50%);
    border-radius: 2px;
    background: var(--lyra-color-brand);
  }
  [part='thumb'] {
    position: absolute;
    inset-block-start: 50%;
    inline-size: 16px;
    block-size: 16px;
    border-radius: 50%;
    background: var(--lyra-color-brand);
    border: 2px solid var(--lyra-color-surface);
    box-shadow: var(--lyra-shadow);
    transform: translate(-50%, -50%);
    cursor: grab;
    touch-action: none;
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
    inline-size: 28px;
    block-size: 28px;
    transform: translate(-50%, -50%);
    border-radius: 50%;
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
    font-size: 0.8125rem;
    color: var(--lyra-color-text-quiet);
    /* Numeric readout ticks as the thumb moves; tabular-nums keeps its own
       inline-size stable instead of jittering the layout next to it. */
    font-variant-numeric: tabular-nums;
    min-inline-size: 2.5ch;
    text-align: end;
  }
  :host([disabled]) {
    opacity: var(--lyra-opacity-disabled);
    cursor: not-allowed;
  }
  :host([disabled]) [part='thumb'] {
    cursor: not-allowed;
  }
`;
