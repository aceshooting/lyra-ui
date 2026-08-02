import { css } from 'lit';
import { formControlRequiredMarker } from '../../../internal/form-control.styles.js';

export const styles = css`
  :host {
    /* Every dimension below rides the shared size ladder (internal/sizes.styles.ts) so a slider
       lines up with an lr-input/lr-select/lr-button of the same size. At the default "m" tier the
       three knobs resolve to exactly the 1rem thumb, 0.25rem track and 1.5rem row the control
       shipped with before it had a size at all. */
    --lr-slider-thumb-size: calc(var(--lr-form-control-height) * 0.4);
    --lr-slider-track-thickness: calc(var(--lr-slider-thumb-size) * 0.25);
    --lr-slider-row-size: calc(var(--lr-form-control-height) * 0.6);
    display: flex;
    align-items: center;
    /* The hint is a full-basis flex item, so it wraps onto its own line
       underneath the track row instead of squeezing it. Without wrapping
       allowed the whole control would collapse into one over-long row. */
    flex-wrap: wrap;
    gap: var(--lr-space-s);
    inline-size: 100%;
  }
  [part~='base'] {
    position: relative;
    flex: 1 1 auto;
    block-size: var(--lr-slider-row-size);
  }
  [part='track'] {
    position: absolute;
    inset-inline: 0;
    inset-block-start: 50%;
    block-size: var(--track-size, var(--track-height, var(--lr-slider-track-thickness)));
    transform: translateY(-50%);
    border-radius: calc(var(--track-size, var(--track-height, var(--lr-slider-track-thickness))) * 0.5);
    background: var(--track-color-inactive, var(--lr-color-border));
  }
  [part='indicator'] {
    position: absolute;
    inset-block-start: 50%;
    block-size: var(--track-size, var(--track-height, var(--lr-slider-track-thickness)));
    transform: translateY(-50%);
    border-radius: calc(var(--track-size, var(--track-height, var(--lr-slider-track-thickness))) * 0.5);
    background: var(--track-color-active, var(--lr-color-brand));
    translate: var(--track-active-offset, 0) 0;
  }
  /* Tick marks for with-markers. Painted in the surface color so they stay
     visible over both the unfilled track and the brand-colored indicator. */
  [part='markers'] {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  [part='marker'] {
    position: absolute;
    inset-block-start: 50%;
    inline-size: var(--marker-width, calc(var(--lr-slider-track-thickness) * 0.5));
    block-size: var(--marker-height, calc(var(--lr-slider-track-thickness) * 1.5));
    transform: translate(-50%, -50%);
    border-radius: var(--lr-radius-xs);
    background: var(--lr-color-surface);
  }
  [part~='thumb'] {
    position: absolute;
    inset-block-start: 50%;
    inline-size: var(--thumb-width, var(--thumb-size, var(--lr-slider-thumb-size)));
    block-size: var(--thumb-height, var(--thumb-size, var(--lr-slider-thumb-size)));
    border-radius: 50%;
    background: var(--lr-color-brand);
    border: var(--lr-border-width-medium) solid var(--lr-color-surface);
    /* Resting chrome, not an overlay: a knob riding on its own track, so it sits one step above
       the track rather than at the anchored-panel tier. */
    box-shadow: var(--lr-shadow-s);
    transform: translate(-50%, -50%);
    cursor: grab;
    touch-action: none;
  }
  /* [part~='thumb'] is positioned with a logical inset-inline-start:<pct>% (set inline in
     render()), which the browser anchors to the box's own *start* edge -- the physical right
     edge under :dir(rtl). The fixed horizontal -50% above assumes an LTR left-edge anchor, so
     it has to flip sign under RTL or the visible dot ends up a full thumb-width off from its
     true track position. Mirrors lr-time-range's identical handle rule. */
  :host(:dir(rtl)) [part~='thumb'],
  :host(:dir(rtl)) [part='marker'] {
    transform: translate(50%, -50%);
  }
  /* The visible dot is 16px at the default tier and smaller below it, under the ~24px
     touch-target minimum. Widen the hit/drag area with a transparent ::before instead of growing
     the thumb itself — onPointerMove never reads the thumb's own
     getBoundingClientRect() (only [part="track"]'s rect and the pointer
     coordinate), and a pointerdown inside the ::before still reports
     e.target as the thumb element (pseudo-elements have no separate DOM
     node/event target), so this is purely additive and cannot change the
     drag math. Mirrors lr-time-range's identical handle::before. */
  [part~='thumb']::before {
    content: '';
    position: absolute;
    inset-block-start: 50%;
    inset-inline-start: 50%;
    /* A floor, not a fixed size: the drag area never drops below 28px however small the tier
       makes the visible dot, and grows past it at the larger tiers. */
    inline-size: max(var(--lr-size-28px), calc(var(--lr-slider-thumb-size) * 1.75));
    block-size: max(var(--lr-size-28px), calc(var(--lr-slider-thumb-size) * 1.75));
    transform: translate(-50%, -50%);
    border-radius: 50%;
  }
  /* Same logical-inset-vs-physical-transform mismatch as the thumb itself: this enlarged
     hit-area is centered on inset-inline-start: 50%, so its horizontal translate must flip
     sign under RTL too or the actual drag hit zone detaches from the visible thumb. Mirrors
     lr-time-range's identical handle::before rule. The pseudo-element is centered inside its
     own thumb in both orientations, so this one does NOT vary with orientation. */
  :host(:dir(rtl)) [part~='thumb']::before {
    transform: translate(50%, -50%);
  }
  [part~='thumb']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* Mouse-hover feedback to match the focus-visible outline a keyboard user already sees --
     a soft ring rather than a background/border change, since the thumb's background is already
     the same brand color as the indicator (a hover recolor would read as no change at all).
     Gated on :host(:not(:disabled):not([readonly])), the same disabled-state gating convention as
     lr-radio's identical [part='circle'] hover rule, so neither a disabled nor a read-only thumb
     shows interactive feedback for a gesture that cannot change anything. */
  :host(:not(:disabled):not([readonly])) [part~='thumb']:hover {
    /* Same elevation tier as the resting thumb -- hover adds the ring, it must not also change
       how high the thumb reads. */
    box-shadow: var(--lr-shadow-s), 0 0 0 var(--lr-slider-track-thickness)
      var(--lr-color-brand-quiet);
  }
  [part~='thumb']:active {
    cursor: grabbing;
  }
  /* Live value bubble for with-tooltip. It is anchored at the handle point and then moved to the
     requested physical side. The numeric property becomes a length through the 1px design token;
     Shoelace's length-valued --tooltip-offset remains a direct override. */
  [part~='tooltip'] {
    position: absolute;
    inset-block-start: 50%;
    padding-block: var(--lr-space-2xs);
    padding-inline: var(--lr-space-xs);
    border-radius: var(--lr-radius);
    background: var(--lr-color-neutral);
    color: var(--lr-color-on-neutral);
    font-size: var(--lr-font-size-sm);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity var(--lr-transition-fast);
  }
  [part~='tooltip'][data-placement='top'] {
    transform: translate(
      -50%,
      calc(-100% - var(--thumb-height, var(--thumb-size, var(--lr-slider-thumb-size))) * 0.5 - var(--tooltip-offset, calc(var(--lr-slider-tooltip-distance, 8) * var(--lr-size-1px))))
    );
  }
  [part~='tooltip'][data-placement='bottom'] {
    transform: translate(
      -50%,
      calc(var(--thumb-height, var(--thumb-size, var(--lr-slider-thumb-size))) * 0.5 + var(--tooltip-offset, calc(var(--lr-slider-tooltip-distance, 8) * var(--lr-size-1px))))
    );
  }
  [part~='tooltip'][data-placement='left'] {
    transform: translate(
      calc(-100% - var(--thumb-width, var(--thumb-size, var(--lr-slider-thumb-size))) * 0.5 - var(--tooltip-offset, calc(var(--lr-slider-tooltip-distance, 8) * var(--lr-size-1px)))),
      -50%
    );
  }
  [part~='tooltip'][data-placement='right'] {
    transform: translate(
      calc(var(--thumb-width, var(--thumb-size, var(--lr-slider-thumb-size))) * 0.5 + var(--tooltip-offset, calc(var(--lr-slider-tooltip-distance, 8) * var(--lr-size-1px)))),
      -50%
    );
  }
  :host(:dir(rtl)) [part~='tooltip'][data-placement='top'],
  :host(:dir(rtl)) [part~='tooltip'][data-placement='bottom'] {
    transform: translate(
      50%,
      calc(-100% - var(--thumb-height, var(--thumb-size, var(--lr-slider-thumb-size))) * 0.5 - var(--tooltip-offset, calc(var(--lr-slider-tooltip-distance, 8) * var(--lr-size-1px))))
    );
  }
  :host(:dir(rtl)) [part~='tooltip'][data-placement='bottom'] {
    transform: translate(
      50%,
      calc(var(--thumb-height, var(--thumb-size, var(--lr-slider-thumb-size))) * 0.5 + var(--tooltip-offset, calc(var(--lr-slider-tooltip-distance, 8) * var(--lr-size-1px))))
    );
  }
  [part~='tooltip-visible'] {
    opacity: 1;
  }
  [part='tooltip__arrow'] {
    position: absolute;
    inline-size: var(--lr-space-xs);
    block-size: var(--lr-space-xs);
    background: inherit;
    transform: rotate(45deg);
  }
  [data-placement='top'] [part='tooltip__arrow'] {
    inset-block-end: calc(var(--lr-space-xs) * -0.5);
    inset-inline-start: calc(50% - var(--lr-space-xs) * 0.5);
  }
  [data-placement='bottom'] [part='tooltip__arrow'] {
    inset-block-start: calc(var(--lr-space-xs) * -0.5);
    inset-inline-start: calc(50% - var(--lr-space-xs) * 0.5);
  }
  [data-placement='left'] [part='tooltip__arrow'] {
    inset-inline-end: calc(var(--lr-space-xs) * -0.5);
    inset-block-start: calc(50% - var(--lr-space-xs) * 0.5);
  }
  [data-placement='right'] [part='tooltip__arrow'] {
    inset-inline-start: calc(var(--lr-space-xs) * -0.5);
    inset-block-start: calc(50% - var(--lr-space-xs) * 0.5);
  }
  [part~='label'],
  [part='references'] {
    flex: 1 0 100%;
  }
  [part~='label'] {
    font-weight: var(--lr-font-weight-semibold);
    color: var(--lr-color-text);
  }
  [part='references'] {
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  [part~='label'][hidden],
  [part='references'][hidden] {
    display: none;
  }
  /* This control accepts a required attribute and renders a visible label like every other field
     in the library, so it marks it the same way -- the [hidden] rule above is what keeps the
     marker from orphaning a stray glyph when no label is set. */
  ${formControlRequiredMarker}
  [part='value'] {
    flex: 0 0 auto;
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
    /* Numeric readout ticks as the thumb moves; tabular-nums keeps its own
       inline-size stable instead of jittering the layout next to it. */
    font-variant-numeric: tabular-nums;
    min-inline-size: var(--lr-size-2-5ch);
    text-align: end;
  }
  [part~='hint'] {
    /* Full basis so the hint always occupies its own wrapped line under the
       track row, however wide the track and readout are. */
    flex: 1 0 100%;
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  [part~='hint'][hidden] {
    display: none;
  }
  /* Vertical orientation. Declared after every horizontal rule so the shared
     :host(:dir(rtl)) transforms above never win by source order. The value
     axis moves to the block axis, with the domain minimum at the block end
     (visually the bottom in a horizontal writing mode). */
  :host([orientation='vertical']) {
    display: inline-flex;
    flex-direction: column;
    inline-size: auto;
  }
  :host([orientation='vertical']) [part~='base'] {
    flex: 0 0 auto;
    inline-size: var(--lr-slider-row-size);
    block-size: var(--lr-slider-track-length, var(--lr-size-10rem));
  }
  :host([orientation='vertical']) [part='track'] {
    inset-inline: auto;
    inset-inline-start: 50%;
    inset-block: 0;
    inline-size: var(--track-size, var(--track-height, var(--lr-slider-track-thickness)));
    block-size: auto;
    transform: translateX(-50%);
  }
  :host([orientation='vertical']) [part='indicator'] {
    inset-block-start: auto;
    inset-inline-start: 50%;
    inline-size: var(--track-size, var(--track-height, var(--lr-slider-track-thickness)));
    transform: translateX(-50%);
  }
  :host([orientation='vertical']) [part~='thumb'] {
    inset-block-start: auto;
    inset-inline-start: 50%;
    transform: translate(-50%, 50%);
  }
  :host([orientation='vertical']) [part='marker'] {
    inset-block-start: auto;
    inset-inline-start: 50%;
    inline-size: var(--marker-width, calc(var(--lr-slider-track-thickness) * 1.5));
    block-size: var(--marker-height, calc(var(--lr-slider-track-thickness) * 0.5));
    transform: translate(-50%, 50%);
  }
  :host([orientation='vertical']) [part~='tooltip'] {
    inset-block-start: auto;
    inset-inline-start: 50%;
  }
  :host([orientation='vertical']) [part~='hint'] {
    flex: 0 0 auto;
  }
  :host([orientation='vertical']:dir(rtl)) [part='track'],
  :host([orientation='vertical']:dir(rtl)) [part='indicator'] {
    transform: translateX(50%);
  }
  :host([orientation='vertical']:dir(rtl)) [part~='thumb'],
  :host([orientation='vertical']:dir(rtl)) [part='marker'] {
    transform: translate(50%, 50%);
  }
  :host(:disabled) {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  :host(:disabled) [part~='thumb'] {
    cursor: not-allowed;
  }
  /* A read-only slider stays fully legible and focusable (unlike a disabled
     one), so only the "you can drag this" affordance is withdrawn. */
  :host([readonly]) [part~='thumb'] {
    cursor: default;
  }
  @media (prefers-reduced-motion: reduce) {
    [part~='tooltip'] {
      transition: none;
    }
  }
`;
