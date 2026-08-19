import { css } from 'lit';
import { formControlRequiredMarker } from '../../../internal/form-control.styles.js';

export const styles = css`
  :host {
    /* Every dimension rides the shared size ladder (internal/sizes.styles.ts), so a slider lines
       up with an lr-input/lr-select/lr-button of the same size. At the default "m" tier the three
       knobs resolve to the pre-size 1rem thumb, 0.25rem track and 1.5rem row. */
    --_lr-slider-thumb-size: calc(var(--lr-form-control-height) * 0.4);
    --_lr-slider-track-thickness: calc(
      var(--lr-slider-thumb-size, var(--_lr-slider-thumb-size)) * 0.25
    );
    --_lr-slider-row-size: calc(var(--lr-form-control-height) * 0.6);
    display: flex;
    align-items: center;
    /* The hint is a full-basis flex item, wrapping onto its own line under the track row;
       without wrapping the whole control collapses into one over-long row. */
    flex-wrap: wrap;
    gap: var(--lr-slider-gap, var(--lr-space-s));
    inline-size: 100%;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part~="base"] {
    position: relative;
    flex: 1 1 auto;
    min-inline-size: 0;
    block-size: var(--lr-slider-row-size, var(--_lr-slider-row-size));
  }
  [part="track"] {
    position: absolute;
    inset-inline: 0;
    inset-block-start: 50%;
    block-size: var(
      --track-size,
      var(
        --track-height,
        var(--lr-slider-track-thickness, var(--_lr-slider-track-thickness))
      )
    );
    transform: translateY(-50%);
    border-radius: calc(
      var(
          --track-size,
          var(
            --track-height,
            var(--lr-slider-track-thickness, var(--_lr-slider-track-thickness))
          )
        ) * 0.5
    );
    background: var(--track-color-inactive, var(--lr-color-border));
  }
  [part="indicator"] {
    position: absolute;
    inset-block-start: 50%;
    block-size: var(
      --track-size,
      var(
        --track-height,
        var(--lr-slider-track-thickness, var(--_lr-slider-track-thickness))
      )
    );
    transform: translateY(-50%);
    border-radius: calc(
      var(
          --track-size,
          var(
            --track-height,
            var(--lr-slider-track-thickness, var(--_lr-slider-track-thickness))
          )
        ) * 0.5
    );
    background: var(--track-color-active, var(--lr-color-brand));
    translate: var(--track-active-offset, 0) 0;
  }
  /* Tick marks for with-markers, painted in the surface color so they stay visible over both the
     unfilled track and the brand-colored indicator. */
  [part="markers"] {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  [part="marker"] {
    position: absolute;
    inset-block-start: 50%;
    inline-size: var(
      --marker-width,
      calc(
        var(--lr-slider-track-thickness, var(--_lr-slider-track-thickness)) *
          0.5
      )
    );
    block-size: var(
      --marker-height,
      calc(
        var(--lr-slider-track-thickness, var(--_lr-slider-track-thickness)) *
          1.5
      )
    );
    transform: translate(-50%, -50%);
    border-radius: var(--lr-radius-xs);
    background: var(--lr-color-surface);
  }
  [part~="thumb"] {
    position: absolute;
    inset-block-start: 50%;
    inline-size: var(
      --thumb-width,
      var(
        --thumb-size,
        var(--lr-slider-thumb-size, var(--_lr-slider-thumb-size))
      )
    );
    block-size: var(
      --thumb-height,
      var(
        --thumb-size,
        var(--lr-slider-thumb-size, var(--_lr-slider-thumb-size))
      )
    );
    border-radius: 50%;
    background: var(--lr-slider-thumb-bg, var(--lr-color-brand));
    border: var(--lr-border-width-medium) solid
      var(--lr-slider-thumb-border-color, var(--lr-color-surface));
    /* Resting chrome, not an overlay: a knob on its own track sits one step above it, not at the
       anchored-panel tier. */
    box-shadow: var(--lr-shadow-s);
    transform: translate(-50%, -50%);
    cursor: grab;
    touch-action: none;
  }
  /* [part~='thumb'] rides a logical inset-inline-start:<pct>% set in render(), anchored to the
     box's start edge -- physically the right edge under :dir(rtl). The fixed -50% above assumes an
     LTR anchor, so it flips sign under RTL or the dot lands a full thumb-width off. Mirrors
     lr-time-range's handle rule. */
  :host(:dir(rtl)) [part~="thumb"],
  :host(:dir(rtl)) [part="marker"] {
    transform: translate(50%, -50%);
  }
  /* The dot is 16px at the default tier and smaller below, under the ~24px touch-target minimum,
     so a transparent ::before widens the hit/drag area instead of the thumb. Additive only:
     onPointerMove reads just [part="track"]'s rect and the pointer coordinate, and a pointerdown
     in the ::before still reports e.target as the thumb (pseudo-elements have no event target).
     Mirrors lr-time-range's handle::before. */
  [part~="thumb"]::before {
    content: "";
    position: absolute;
    inset-block-start: 50%;
    inset-inline-start: 50%;
    /* A floor, not a fixed size: the drag area never drops below 28px however small the tier
       makes the dot, and grows past it at larger tiers. */
    inline-size: max(
      var(--lr-size-28px),
      calc(var(--lr-slider-thumb-size, var(--_lr-slider-thumb-size)) * 1.75)
    );
    block-size: max(
      var(--lr-size-28px),
      calc(var(--lr-slider-thumb-size, var(--_lr-slider-thumb-size)) * 1.75)
    );
    transform: translate(-50%, -50%);
    border-radius: 50%;
  }
  /* Same logical-inset-vs-physical-transform mismatch as the thumb: centered on
     inset-inline-start: 50%, so its horizontal translate flips sign under RTL too or the drag hit
     zone detaches from the thumb. Mirrors lr-time-range's handle::before. Centered inside its own
     thumb in both orientations, so it does NOT vary with orientation. */
  :host(:dir(rtl)) [part~="thumb"]::before {
    transform: translate(50%, -50%);
  }
  [part~="thumb"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* Hover matches the focus-visible outline a keyboard user gets -- a soft ring, not a recolor,
     since the thumb already carries the indicator's brand color. Gated on
     :host(:not(:disabled):not([readonly])) like lr-radio's [part='circle'] hover rule, so a
     disabled or read-only thumb shows no feedback for a gesture that changes nothing. */
  :host(:not(:disabled):not([readonly])) [part~="thumb"]:hover {
    /* Same elevation tier as the resting thumb -- hover adds the ring, not height. */
    box-shadow: var(--lr-shadow-s),
      0 0 0 var(--lr-slider-track-thickness, var(--_lr-slider-track-thickness))
        var(--lr-slider-thumb-hover-ring-color, var(--lr-color-brand-quiet));
  }
  :host(:not(:disabled):not([readonly])) [part~="thumb"]:active {
    box-shadow: var(--lr-shadow-s),
      0 0 0 var(--lr-slider-track-thickness, var(--_lr-slider-track-thickness))
        var(
          --lr-slider-thumb-active-ring-color,
          var(--lr-slider-thumb-hover-ring-color, var(--lr-color-brand-quiet))
        );
    cursor: grabbing;
  }
  /* Live value bubble for with-tooltip, anchored at the handle point then moved to the requested
     physical side. The numeric property becomes a length via the 1px design token; Shoelace's
     length-valued --tooltip-offset stays a direct override. */
  [part~="tooltip"] {
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
  [part~="tooltip"][data-placement="top"] {
    transform: translate(
      -50%,
      calc(
        -100% - var(
            --thumb-height,
            var(
              --thumb-size,
              var(--lr-slider-thumb-size, var(--_lr-slider-thumb-size))
            )
          ) * 0.5 - var(--tooltip-offset, calc(var(
                  --lr-slider-tooltip-distance,
                  8
                ) * var(--lr-size-1px)))
      )
    );
  }
  [part~="tooltip"][data-placement="bottom"] {
    transform: translate(
      -50%,
      calc(
        var(
            --thumb-height,
            var(
              --thumb-size,
              var(--lr-slider-thumb-size, var(--_lr-slider-thumb-size))
            )
          ) * 0.5 +
          var(
            --tooltip-offset,
            calc(var(--lr-slider-tooltip-distance, 8) * var(--lr-size-1px))
          )
      )
    );
  }
  [part~="tooltip"][data-placement="left"] {
    transform: translate(
      calc(
        -100% - var(
            --thumb-width,
            var(
              --thumb-size,
              var(--lr-slider-thumb-size, var(--_lr-slider-thumb-size))
            )
          ) * 0.5 - var(--tooltip-offset, calc(var(
                  --lr-slider-tooltip-distance,
                  8
                ) * var(--lr-size-1px)))
      ),
      -50%
    );
  }
  [part~="tooltip"][data-placement="right"] {
    transform: translate(
      calc(
        var(
            --thumb-width,
            var(
              --thumb-size,
              var(--lr-slider-thumb-size, var(--_lr-slider-thumb-size))
            )
          ) * 0.5 +
          var(
            --tooltip-offset,
            calc(var(--lr-slider-tooltip-distance, 8) * var(--lr-size-1px))
          )
      ),
      -50%
    );
  }
  :host(:dir(rtl)) [part~="tooltip"][data-placement="top"],
  :host(:dir(rtl)) [part~="tooltip"][data-placement="bottom"] {
    transform: translate(
      50%,
      calc(
        -100% - var(
            --thumb-height,
            var(
              --thumb-size,
              var(--lr-slider-thumb-size, var(--_lr-slider-thumb-size))
            )
          ) * 0.5 - var(--tooltip-offset, calc(var(
                  --lr-slider-tooltip-distance,
                  8
                ) * var(--lr-size-1px)))
      )
    );
  }
  :host(:dir(rtl)) [part~="tooltip"][data-placement="bottom"] {
    transform: translate(
      50%,
      calc(
        var(
            --thumb-height,
            var(
              --thumb-size,
              var(--lr-slider-thumb-size, var(--_lr-slider-thumb-size))
            )
          ) * 0.5 +
          var(
            --tooltip-offset,
            calc(var(--lr-slider-tooltip-distance, 8) * var(--lr-size-1px))
          )
      )
    );
  }
  [part~="tooltip-visible"] {
    opacity: 1;
  }
  [part="tooltip__arrow"] {
    position: absolute;
    inline-size: var(--lr-space-xs);
    block-size: var(--lr-space-xs);
    background: inherit;
    transform: rotate(45deg);
  }
  [data-placement="top"] [part="tooltip__arrow"] {
    inset-block-end: calc(var(--lr-space-xs) * -0.5);
    inset-inline-start: calc(50% - var(--lr-space-xs) * 0.5);
  }
  [data-placement="bottom"] [part="tooltip__arrow"] {
    inset-block-start: calc(var(--lr-space-xs) * -0.5);
    inset-inline-start: calc(50% - var(--lr-space-xs) * 0.5);
  }
  [data-placement="left"] [part="tooltip__arrow"] {
    inset-inline-end: calc(var(--lr-space-xs) * -0.5);
    inset-block-start: calc(50% - var(--lr-space-xs) * 0.5);
  }
  [data-placement="right"] [part="tooltip__arrow"] {
    inset-inline-start: calc(var(--lr-space-xs) * -0.5);
    inset-block-start: calc(50% - var(--lr-space-xs) * 0.5);
  }
  [part~="label"],
  [part="references"] {
    flex: 1 0 100%;
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
  [part~="label"] {
    font-weight: var(--lr-font-weight-semibold);
    color: var(--lr-color-text);
  }
  [part="references"] {
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  [part~="label"][hidden],
  [part="references"][hidden] {
    display: none;
  }
  /* Accepts required and renders a visible label like every other field in the library, so it
     marks it the same way -- the [hidden] rule above keeps the marker from orphaning a stray
     glyph when no label is set. */
  ${formControlRequiredMarker}
  [part='value'] {
    flex: 0 0 auto;
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
    /* The readout ticks as the thumb moves; tabular-nums holds its inline-size stable instead of
       jittering the layout beside it. */
    font-variant-numeric: tabular-nums;
    min-inline-size: var(--lr-size-2-5ch);
    text-align: end;
  }
  [part="error"],
  [part~="hint"] {
    /* Full basis so supporting text gets its own wrapped line under the track row, however wide
       the track and readout are. */
    flex: 1 0 100%;
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  [part="error"] {
    color: var(--lr-color-danger);
  }
  [part="error"][hidden],
  [part~="hint"][hidden] {
    display: none;
  }
  /* Vertical orientation, declared after every horizontal rule so the shared :host(:dir(rtl))
     transforms above never win by source order. The value axis moves to the block axis with the
     domain minimum at the block end -- the bottom in a horizontal writing mode. */
  :host([orientation="vertical"]) {
    display: inline-flex;
    flex-direction: column;
    inline-size: auto;
  }
  :host([orientation="vertical"]) [part~="base"] {
    flex: 0 0 auto;
    inline-size: var(--lr-slider-row-size, var(--_lr-slider-row-size));
    block-size: var(--lr-slider-track-length, var(--lr-size-10rem));
  }
  :host([orientation="vertical"]) [part="track"] {
    inset-inline: auto;
    inset-inline-start: 50%;
    inset-block: 0;
    inline-size: var(
      --track-size,
      var(
        --track-height,
        var(--lr-slider-track-thickness, var(--_lr-slider-track-thickness))
      )
    );
    block-size: auto;
    transform: translateX(-50%);
  }
  :host([orientation="vertical"]) [part="indicator"] {
    inset-block-start: auto;
    inset-inline-start: 50%;
    inline-size: var(
      --track-size,
      var(
        --track-height,
        var(--lr-slider-track-thickness, var(--_lr-slider-track-thickness))
      )
    );
    transform: translateX(-50%);
  }
  :host([orientation="vertical"]) [part~="thumb"] {
    inset-block-start: auto;
    inset-inline-start: 50%;
    transform: translate(-50%, 50%);
  }
  :host([orientation="vertical"]) [part="marker"] {
    inset-block-start: auto;
    inset-inline-start: 50%;
    inline-size: var(
      --marker-width,
      calc(
        var(--lr-slider-track-thickness, var(--_lr-slider-track-thickness)) *
          1.5
      )
    );
    block-size: var(
      --marker-height,
      calc(
        var(--lr-slider-track-thickness, var(--_lr-slider-track-thickness)) *
          0.5
      )
    );
    transform: translate(-50%, 50%);
  }
  :host([orientation="vertical"]) [part~="tooltip"] {
    inset-block-start: auto;
    inset-inline-start: 50%;
  }
  :host([orientation="vertical"]) [part="error"],
  :host([orientation="vertical"]) [part~="hint"] {
    flex: 0 0 auto;
  }
  :host([orientation="vertical"]:dir(rtl)) [part="track"],
  :host([orientation="vertical"]:dir(rtl)) [part="indicator"] {
    transform: translateX(50%);
  }
  :host([orientation="vertical"]:dir(rtl)) [part~="thumb"],
  :host([orientation="vertical"]:dir(rtl)) [part="marker"] {
    transform: translate(50%, 50%);
  }
  :host(:disabled) {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  :host(:disabled) [part~="thumb"] {
    cursor: not-allowed;
  }
  /* A read-only slider stays legible and focusable, unlike a disabled one, so only the drag
     affordance is withdrawn. */
  :host([readonly]) [part~="thumb"] {
    cursor: default;
  }
  @media (prefers-reduced-motion: reduce) {
    [part~="tooltip"] {
      transition: none;
    }
  }
`;
