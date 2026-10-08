import { focusRing } from '../../../internal/interactive-control.styles.js';
import { css } from 'lit';
import { formControlPresetButton } from '../../../internal/form-control.styles.js';

export const styles = css`
  :host {
    display: block;
    inline-size: 100%;
    --_lr-time-range-handle-size: calc(
      var(--lr-size-14px) *
        var(--lr-time-range-size-scale, var(--_lr-time-range-size-scale))
    );
    --_lr-time-range-hit-size: max(
      var(--lr-size-24px),
      calc(
        var(--lr-size-28px) *
          var(--lr-time-range-size-scale, var(--_lr-time-range-size-scale))
      )
    );
    --_lr-time-range-track-size: calc(
      var(--lr-size-4px) *
        var(--lr-time-range-size-scale, var(--_lr-time-range-size-scale))
    );
    --_lr-time-range-base-size: calc(
      var(--lr-size-1-5rem) *
        var(--lr-time-range-size-scale, var(--_lr-time-range-size-scale))
    );
    --_lr-preset-hover-bg: var(--lr-time-range-preset-hover-bg, var(--lr-color-surface));
    --_lr-preset-pressed-base: var(--lr-color-surface);
    --_lr-preset-hover-border-color: var(--lr-time-range-preset-hover-border-color);
    --_lr-preset-pressed-bg: var(--lr-time-range-preset-pressed-bg);
    --_lr-preset-pressed-border-color: var(--lr-time-range-preset-pressed-border-color);
    --_lr-preset-selected-bg: var(--lr-time-range-preset-selected-bg, var(--lr-time-range-preset-active-bg));
    --_lr-preset-selected-border-color: var(
      --lr-time-range-preset-selected-border-color,
      var(--lr-time-range-preset-active-border-color)
    );
    --_lr-preset-selected-color: var(--lr-time-range-preset-selected-color, var(--lr-time-range-preset-active-color));
    --_lr-time-range-preset-gap: var(--lr-space-xs);
    --_lr-time-range-preset-radius: var(--lr-radius);
    --_lr-time-range-preset-padding: calc(
        var(--lr-space-xs) *
          var(--lr-time-range-size-scale, var(--_lr-time-range-size-scale))
      )
      calc(
        var(--lr-space-s) *
          var(--lr-time-range-size-scale, var(--_lr-time-range-size-scale))
      );
    --_lr-time-range-preset-font-size: calc(
      var(--lr-font-size-sm) *
        var(--lr-time-range-size-scale, var(--_lr-time-range-size-scale))
    );
    /* No fixed block-size: [part="base"] carries its own 1.5rem below, so the host is just the
       stack height of its children -- with presets empty, still exactly 1.5rem, unchanged from
       before presets existed. */
    --_lr-time-range-size-scale: 1;
  }
  /* size scales the brush track, its handles and the preset chips together, so a tier is one
     multiplier rather than the shared --lr-form-control-height ladder -- there is no form-control
     row to floor. Both tier spellings still match, as in internal/sizes.styles.ts. */
  :host([size="2xs"]) {
    --_lr-time-range-size-scale: 0.5;
  }
  :host([size="xs"]) {
    --_lr-time-range-size-scale: 0.6;
  }
  :host([size="s"]),
  :host([size="small"]) {
    --_lr-time-range-size-scale: 0.75;
  }
  :host([size="l"]),
  :host([size="large"]) {
    --_lr-time-range-size-scale: 1.2;
  }
  :host([size="xl"]) {
    --_lr-time-range-size-scale: 1.4;
  }
  [part="presets"] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-time-range-preset-gap, var(--_lr-time-range-preset-gap));
    margin-block-end: var(--lr-space-s);
  }
  ${formControlPresetButton}
  [part="preset-button"] {
    display: inline-flex;
    align-items: center;
    /* Floors, not fixed sizes, per --lr-icon-button-size's contract. m/l/xl already clear 24px from
       padding and font-size alone (28px/33.6px/37.2px), but 2xs/xs/s scale to ~15-21px tall --
       under the WCAG 2.5.8 24px minimum for a real <button>. min-inline-size floors the other axis:
       a short label like "1h" measures under 24px wide at 2xs/xs. */
    min-block-size: var(--lr-size-24px);
    min-inline-size: var(--lr-size-24px);
    padding: var(
      --lr-time-range-preset-padding,
      var(--_lr-time-range-preset-padding)
    );
    border-radius: var(
      --lr-time-range-preset-radius,
      var(--_lr-time-range-preset-radius)
    );
    font-size: var(
      --lr-time-range-preset-font-size,
      var(--_lr-time-range-preset-font-size)
    );
  }
  [part="base"] {
    position: relative;
    inline-size: 100%;
    block-size: var(--lr-time-range-base-size, var(--_lr-time-range-base-size));
    display: flex;
    align-items: center;
  }
  [part="track"] {
    position: absolute;
    inset-inline: 0;
    block-size: var(
      --lr-time-range-track-size,
      var(--_lr-time-range-track-size)
    );
    border-radius: var(--lr-size-2px);
    background: var(--lr-color-border);
  }
  [part="range"] {
    position: absolute;
    block-size: var(
      --lr-time-range-track-size,
      var(--_lr-time-range-track-size)
    );
    border-radius: var(--lr-size-2px);
    background: var(--lr-color-brand);
  }
  [part^="handle"] {
    position: absolute;
    inline-size: var(
      --lr-time-range-handle-size,
      var(--_lr-time-range-handle-size)
    );
    block-size: var(
      --lr-time-range-handle-size,
      var(--_lr-time-range-handle-size)
    );
    border-radius: 50%;
    background: var(--lr-time-range-handle-bg, var(--lr-color-brand));
    border: var(--lr-border-width-medium) solid
      var(--lr-time-range-handle-border-color, var(--lr-color-surface));
    /* Resting chrome, not an overlay: a knob riding on its own track, matching lr-slider's thumb. */
    box-shadow: var(--lr-shadow-s);
    transform: translateX(-50%);
    cursor: grab;
    touch-action: none;
  }
  [part^="handle"][data-at-domain-start] {
    transform: translateX(0);
  }
  [part^="handle"][data-at-domain-end] {
    transform: translateX(-100%);
  }
  /* [part^='handle'] is placed with a logical inset-inline-start percentage (set inline in
     render()), anchored to the box's start edge -- the physical right edge under :dir(rtl). The
     translateX(-50%) above assumes an LTR left anchor, so it must flip sign or the dot sits a full
     handle-width off its true position. */
  :host(:dir(rtl)) [part^="handle"] {
    transform: translateX(50%);
  }
  :host(:dir(rtl)) [part^="handle"][data-at-domain-start] {
    transform: translateX(0);
  }
  :host(:dir(rtl)) [part^="handle"][data-at-domain-end] {
    transform: translateX(100%);
  }
  /* The dot's base size is var(--lr-size-14px), literal only at the default m tier; elsewhere it
     scales with --lr-time-range-size-scale, 7px at 2xs to 19.6px at xl -- always well under the
     var(--lr-size-24px) touch-target minimum, despite touch-action: none advertising a touch drag.
     So a transparent ::before widens the hit area instead of the handle box, floored at 24px via
     max() below: the drag area never shrinks with the dot at small tiers, and only grows past 24px
     once the scaled 28px base overtakes the floor (m and up). Purely additive -- onPointerMove
     (time-range.ts) measures only [part="base"]'s rect and e.clientX/e.clientY, never the handle's
     own, and a pointerdown inside the ::before still reports e.target as the real handle, since
     pseudo-elements have no event target. */
  [part^="handle"]::before {
    content: "";
    position: absolute;
    inset-block-start: 50%;
    inset-inline-start: 50%;
    inline-size: var(--lr-time-range-hit-size, var(--_lr-time-range-hit-size));
    block-size: var(--lr-time-range-hit-size, var(--_lr-time-range-hit-size));
    transform: translate(-50%, -50%);
    border-radius: 50%;
  }
  [part^="handle"][data-at-domain-start]::before {
    inset-inline-start: 0;
    transform: translate(0, -50%);
  }
  [part^="handle"][data-at-domain-end]::before {
    inset-inline-start: 100%;
    transform: translate(-100%, -50%);
  }
  /* Same logical-inset versus physical-transform mismatch as the handle: this hit-area is centered
     on inset-inline-start: 50%, so its translate must flip sign under RTL or the drag zone detaches
     from the visible handle. */
  :host(:dir(rtl))
    [part^="handle"]:not([data-at-domain-start]):not(
      [data-at-domain-end]
    )::before {
    transform: translate(50%, -50%);
  }
  :host(:dir(rtl)) [part^="handle"][data-at-domain-start]::before {
    transform: translate(0, -50%);
  }
  :host(:dir(rtl)) [part^="handle"][data-at-domain-end]::before {
    transform: translate(100%, -50%);
  }
  [part^="handle"]:focus-visible {
    ${focusRing}
  }
  /* The mouse cue matching the :focus-visible ring above and the sibling
     [part='preset-button']:hover -- gated on :host(:not(:disabled)), as lr-checkbox's and
     lr-radio's [part='base']:hover are, so a disabled handle never brightens. */
  :host(:not(:disabled)) [part^="handle"]:hover {
    background: var(
      --lr-time-range-handle-hover-bg,
      color-mix(
        in oklab,
        var(--lr-time-range-handle-bg, var(--lr-color-brand)),
        var(--lr-color-mix-partner) var(--lr-color-mix-hover)
      )
    );
  }
  /* Pressed = the grab, the only feedback a drag has before the value moves: the knob mixes a step
     further toward the text colour and the cursor closes. Both states mix the fill rather than run
     filter: brightness(), which applied to the whole subtree -- washing out the ring and shadow
     that separate knob from track -- and did nothing at all on a pure white or pure black brand
     colour. */
  :host(:not(:disabled)) [part^="handle"]:active {
    background: var(
      --lr-time-range-handle-pressed-bg,
      color-mix(
        in oklab,
        var(--lr-time-range-handle-bg, var(--lr-color-brand)),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
    cursor: grabbing;
  }
  /* :host(:disabled), not :host([disabled]): as a form-associated element (static formAssociated =
     true) the UA computes :disabled like a native <input>'s -- from the disabled attribute OR an
     ancestor <fieldset disabled>. The attribute selector caught only the first, so a
     fieldset-disabled time-range gated interaction, tabindex and aria-disabled correctly but still
     rendered at full opacity with a normal cursor. Mirrors lr-radio's and lr-checkbox's fix. */
  :host(:disabled) {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  :host(:disabled) [part^="handle"] {
    /* [part^='handle'] sets cursor: grab unconditionally and is not gated on [disabled], so it
       keeps beating the inherited :host cursor -- restate not-allowed here or the cursor changes
       only over the track. */
    cursor: not-allowed;
  }
  @media (prefers-reduced-motion: reduce) {
    [part="preset-button"],
    [part^="handle"],
    [part="range"] {
      transition: none !important;
    }
  }
  [part="presets"] {
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part="preset-button"] {
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
`;
