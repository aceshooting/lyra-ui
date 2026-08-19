import { css } from 'lit';
import { formControlRequiredMarker } from '../../../internal/form-control.styles.js';

export const styles = css`
  :host {
    display: inline-block;
    /* Square swatch whose edge IS the shared form-control height, so it reads the one ladder
       (internal/sizes.styles.ts), which matches both spellings per tier -- size="small" and
       size="s" resolve identically, no alias rules. The fallback arm names the default tier's own
       value, keeping the documented size without the ladder sheet. */
    --_lr-color-picker-swatch-size: var(
      --lr-form-control-height,
      var(--lr-size-2-5rem)
    );
    --_lr-color-picker-gap: var(--lr-space-xs);
    --_lr-color-picker-radius: var(--lr-radius);
    --_lr-color-picker-grid-inline-size: var(
      --grid-width,
      var(--lr-size-15rem)
    );
    --_lr-color-picker-grid-block-size: var(--grid-height, var(--lr-size-8rem));
    --_lr-color-picker-grid-handle-size: var(
      --grid-handle-size,
      var(--lr-size-1rem)
    );
    --_lr-color-picker-slider-block-size: var(
      --slider-height,
      var(--lr-size-0-75rem)
    );
    --_lr-color-picker-slider-handle-size: var(
      --slider-handle-size,
      var(--lr-size-1-25rem)
    );
    --_lr-color-picker-palette-swatch-size: var(
      --swatch-size,
      var(--lr-size-1-5rem)
    );
    --_lr-color-picker-checker-color: var(--lr-color-border);
    --_lr-color-picker-checker-size: var(--lr-size-0-5rem);
    /* The sRGB hue wheel's own stops -- algorithm data, not a design decision, but exposed as one
       overridable list for a wide-gamut or perceptually-uniform ramp. Both text directions read
       this list; only the gradient direction differs. */
    --_lr-color-picker-hue-stops: hsl(0 100% 50%), hsl(60 100% 50%),
      hsl(120 100% 50%), hsl(180 100% 50%), hsl(240 100% 50%), hsl(300 100% 50%),
      hsl(360 100% 50%);
    /* Private first-render fallbacks; live public values are written inline on the color-bearing
       elements, where an authored public value still wins. */
    --_lr-color-picker-swatch-color: transparent;
    --_lr-color-picker-grid-hue: transparent;
    --_lr-color-picker-opacity-gradient: none;
  }
  [part~="form-control"] {
    display: inline-flex;
    position: relative;
    flex-direction: column;
    gap: var(--lr-color-picker-gap, var(--_lr-color-picker-gap));
  }
  [part~="label"] {
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-md-sm);
  }
  /* [part]:empty never matches -- the part always holds a literal <slot> child -- so emptiness is
     tracked in JS (hasLabel/hasHint/hasError) and reflected via hidden; otherwise the required
     marker attached to this box renders a stray glyph when label is unset. */
  [part~="label"][hidden] {
    display: none;
  }
  ${formControlRequiredMarker}

  /* The alpha checkerboard every translucent surface sits on. A conic-gradient tile beats four
     stacked linear gradients and needs no extra element. */
  [part~='preview'],
  [part~='swatch'] {
    background-color: var(--lr-color-surface);
    background-image: conic-gradient(
      var(
          --lr-color-picker-checker-color,
          var(--_lr-color-picker-checker-color)
        )
        0deg 90deg,
      transparent 90deg 180deg,
      var(
          --lr-color-picker-checker-color,
          var(--_lr-color-picker-checker-color)
        )
        180deg 270deg,
      transparent 270deg 360deg
    );
    background-size: var(
        --lr-color-picker-checker-size,
        var(--_lr-color-picker-checker-size)
      )
      var(--lr-color-picker-checker-size, var(--_lr-color-picker-checker-size));
  }

  /* Forced-colors substitution would flatten every hue, alpha value and palette entry into system
     colors. forced-color-adjust INHERITS, so the opt-out sits on the color-bearing ELEMENTS, not
     the pseudo-elements painting them: a ::before-only opt-out left the slider element itself
     answering auto and its own background and alpha checkerboard rewritten anyway. Limited to the
     surfaces that ARE the data -- the panel, text field, action buttons, focus outlines, disabled
     chrome and the trigger's own border, focus ring and disabled treatment keep the UA default,
     only its two swatch-painting pseudo-elements being the value. */
  [part~="grid"],
  [part~="preview"],
  [part~="swatch"],
  [part~="hue-slider"],
  [part~="opacity-slider"],
  [part~="slider-handle"],
  [part~="trigger"]::before,
  [part~="trigger"]::after {
    forced-color-adjust: none;
  }

  [part="trigger-container"] {
    display: flex;
    align-items: center;
  }
  [part~="trigger"] {
    position: relative;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    inline-size: max(
      var(--lr-color-picker-swatch-size, var(--_lr-color-picker-swatch-size)),
      var(--lr-icon-button-size)
    );
    block-size: max(
      var(--lr-color-picker-swatch-size, var(--_lr-color-picker-swatch-size)),
      var(--lr-icon-button-size)
    );
    padding: 0;
    border: var(--lr-border-width-thin) solid transparent;
    border-radius: var(
      --lr-color-picker-radius,
      var(--_lr-color-picker-radius)
    );
    background: transparent;
    cursor: pointer;
  }
  [part~="trigger"]::before {
    content: "";
    position: absolute;
    inset-inline-start: 50%;
    inset-block-start: 50%;
    box-sizing: border-box;
    inline-size: var(
      --lr-color-picker-swatch-size,
      var(--_lr-color-picker-swatch-size)
    );
    block-size: var(
      --lr-color-picker-swatch-size,
      var(--_lr-color-picker-swatch-size)
    );
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(
      --lr-color-picker-radius,
      var(--_lr-color-picker-radius)
    );
    background-color: var(--lr-color-surface);
    background-image: conic-gradient(
      var(
          --lr-color-picker-checker-color,
          var(--_lr-color-picker-checker-color)
        )
        0deg 90deg,
      transparent 90deg 180deg,
      var(
          --lr-color-picker-checker-color,
          var(--_lr-color-picker-checker-color)
        )
        180deg 270deg,
      transparent 270deg 360deg
    );
    background-size: var(
        --lr-color-picker-checker-size,
        var(--_lr-color-picker-checker-size)
      )
      var(--lr-color-picker-checker-size, var(--_lr-color-picker-checker-size));
    transform: translate(-50%, -50%);
    pointer-events: none;
  }
  [part~="trigger"]::after {
    content: "";
    position: absolute;
    inset-inline-start: 50%;
    inset-block-start: 50%;
    inline-size: calc(
      var(--lr-color-picker-swatch-size, var(--_lr-color-picker-swatch-size)) -
        var(--lr-border-width-thin) - var(--lr-border-width-thin)
    );
    block-size: calc(
      var(--lr-color-picker-swatch-size, var(--_lr-color-picker-swatch-size)) -
        var(--lr-border-width-thin) - var(--lr-border-width-thin)
    );
    border-radius: var(
      --lr-color-picker-radius,
      var(--_lr-color-picker-radius)
    );
    background-color: var(
      --lr-color-picker-swatch-color,
      var(--_lr-color-picker-swatch-color)
    );
    transform: translate(-50%, -50%);
    pointer-events: none;
  }
  :host(:dir(rtl)) [part~="trigger"]::before,
  :host(:dir(rtl)) [part~="trigger"]::after {
    transform: translate(50%, -50%);
  }
  [part~="preview"]::after,
  [part~="swatch"]::after {
    content: "";
    display: block;
    block-size: 100%;
    inline-size: 100%;
    border-radius: inherit;
    background-color: var(
      --lr-color-picker-swatch-color,
      var(--_lr-color-picker-swatch-color)
    );
  }
  [part~="trigger"]:where(:hover),
  [part~="trigger"]:where(:hover)::before {
    border-color: var(
      --lr-color-picker-hover-border-color,
      var(--lr-color-brand)
    );
  }
  /* Pressed deepens the same edge rather than tinting the box: its pseudo-element paints the
     selected colour, so mixing the fill would misreport the value the swatch exists to show. */
  [part~="trigger"]:where(:active),
  [part~="trigger"]:where(:active)::before {
    border-color: color-mix(
      in oklab,
      var(--lr-color-picker-hover-border-color, var(--lr-color-brand)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part~="trigger"]:where(:focus-visible) {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part~="panel"] {
    /* Absolute from the start, not only once JS positions it on open, so the closed panel
       occupies no box in normal flow; hoist switches place() to fixed. Physical top/left, not
       logical insets: place() writes style.left/style.top, and under RTL inset-inline-start
       resolves to physical right -- right:0 and left:Npx both active, so over-constraint discards
       the JS value and pins the panel to the viewport edge. */
    position: absolute;
    top: 0;
    /* policy-allow(physical-css): must stay the physical property positioner.ts's place()
       overwrites via style.left; see above. */
    left: 0;
    z-index: var(--lr-overlay-stack-index, var(--lr-layer-popover));
    display: flex;
    flex-direction: column;
    gap: var(--lr-color-picker-gap, var(--_lr-color-picker-gap));
    padding: var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(
      --lr-color-picker-radius,
      var(--_lr-color-picker-radius)
    );
    background: var(--lr-color-surface);
    /* Anchored overlay: a positioner-placed picker panel floating over page content. */
    box-shadow: var(--lr-shadow-m);
    max-inline-size: var(--lr-positioner-available-inline-size, none);
  }
  [part~="panel"][hidden] {
    display: none;
  }
  :host([inline]) [part~="panel"] {
    position: static;
    inset: auto;
    box-shadow: none;
  }
  .row {
    display: flex;
    align-items: center;
    gap: var(--lr-color-picker-gap, var(--_lr-color-picker-gap));
  }
  .sliders {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: var(--lr-color-picker-gap, var(--_lr-color-picker-gap));
    min-inline-size: 0;
  }

  [part~="grid"] {
    position: relative;
    inline-size: var(
      --lr-color-picker-grid-inline-size,
      var(--_lr-color-picker-grid-inline-size)
    );
    max-inline-size: 100%;
    block-size: var(
      --lr-color-picker-grid-block-size,
      var(--_lr-color-picker-grid-block-size)
    );
    border-radius: var(
      --lr-color-picker-radius,
      var(--_lr-color-picker-radius)
    );
    cursor: crosshair;
    touch-action: none;
    background-color: var(
      --lr-color-picker-grid-hue,
      var(--_lr-color-picker-grid-hue)
    );
    /* Saturation/value square: white-to-transparent across the inline axis over
       transparent-to-shade down the block axis. Both endpoints are the achromatic extremes the
       model requires, in hsl() so no raw hex literal. */
    background-image: linear-gradient(to bottom, transparent, hsl(0 0% 0%)),
      linear-gradient(to right, hsl(0 0% 100%), transparent);
  }
  :host(:dir(rtl)) [part~="grid"] {
    background-image: linear-gradient(to bottom, transparent, hsl(0 0% 0%)),
      linear-gradient(to left, hsl(0 0% 100%), transparent);
  }
  [part~="grid-handle"] {
    position: absolute;
    inline-size: var(
      --lr-color-picker-grid-handle-size,
      var(--_lr-color-picker-grid-handle-size)
    );
    block-size: var(
      --lr-color-picker-grid-handle-size,
      var(--_lr-color-picker-grid-handle-size)
    );
    border: var(--lr-border-width-medium) solid var(--lr-color-surface);
    border-radius: 50%;
    /* Resting chrome, not an overlay: a knob on the grid it edits, inside a panel that is itself
       the anchored overlay -- it stays a step below its own container. */
    box-shadow: var(--lr-shadow-s);
    transform: translate(-50%, -50%);
    cursor: grab;
  }
  :host(:dir(rtl)) [part~="grid-handle"] {
    transform: translate(50%, -50%);
  }

  /* The slider element is the pointer target, floored at 24px (WCAG 2.5.8); the visible ramp is
     the thinner --lr-color-picker-slider-block-size bar ::before draws inside it. Growing the bar
     would look like progress bars; shrinking the target leaves a 12px-tall touch target. */
  [part~="slider"] {
    position: relative;
    block-size: var(--lr-size-1-5rem);
    cursor: pointer;
    touch-action: pan-y;
  }
  [part~="slider"]::before {
    content: "";
    position: absolute;
    inset-inline: 0;
    inset-block-start: 50%;
    block-size: var(
      --lr-color-picker-slider-block-size,
      var(--_lr-color-picker-slider-block-size)
    );
    border-radius: var(--lr-radius-pill);
    transform: translateY(-50%);
  }
  [part~="slider"]:where(:hover)::before {
    box-shadow: 0 0 0 var(--lr-border-width-thin)
      var(--lr-color-picker-hover-border-color, var(--lr-color-brand));
  }
  [part~="slider"]:where(:hover) {
    outline: var(--lr-border-width-thin) solid
      var(--lr-color-picker-hover-border-color, var(--lr-color-brand));
  }
  [part~="slider"]:where(:active)::before {
    box-shadow: 0 0 0 var(--lr-border-width-medium)
      color-mix(
        in oklab,
        var(--lr-color-picker-hover-border-color, var(--lr-color-brand)),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      );
  }
  [part~="slider"]:where(:active) {
    outline: var(--lr-border-width-medium) solid
      color-mix(
        in oklab,
        var(--lr-color-picker-hover-border-color, var(--lr-color-brand)),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      );
  }
  [part~="hue-slider"]::before {
    background-image: linear-gradient(
      to right,
      var(--lr-color-picker-hue-stops, var(--_lr-color-picker-hue-stops))
    );
  }
  :host(:dir(rtl)) [part~="hue-slider"]::before {
    background-image: linear-gradient(
      to left,
      var(--lr-color-picker-hue-stops, var(--_lr-color-picker-hue-stops))
    );
  }
  [part~="opacity-slider"]::before {
    background-image: var(
        --lr-color-picker-opacity-gradient,
        var(--_lr-color-picker-opacity-gradient)
      ),
      conic-gradient(
        var(
            --lr-color-picker-checker-color,
            var(--_lr-color-picker-checker-color)
          )
          0deg 90deg,
        transparent 90deg 180deg,
        var(
            --lr-color-picker-checker-color,
            var(--_lr-color-picker-checker-color)
          )
          180deg 270deg,
        transparent 270deg 360deg
      );
    background-size: auto,
      var(--lr-color-picker-checker-size, var(--_lr-color-picker-checker-size))
        var(
          --lr-color-picker-checker-size,
          var(--_lr-color-picker-checker-size)
        );
    background-color: var(--lr-color-surface);
  }
  [part~="slider-handle"] {
    position: absolute;
    inset-block-start: 50%;
    inline-size: var(
      --lr-color-picker-slider-handle-size,
      var(--_lr-color-picker-slider-handle-size)
    );
    block-size: var(
      --lr-color-picker-slider-handle-size,
      var(--_lr-color-picker-slider-handle-size)
    );
    border: var(--lr-border-width-medium) solid var(--lr-color-surface);
    border-radius: 50%;
    /* Resting chrome, same tier as the grid handle above: a knob on a track, not a floating panel. */
    box-shadow: var(--lr-shadow-s);
    background-color: var(
      --lr-color-picker-swatch-color,
      var(--_lr-color-picker-swatch-color)
    );
    transform: translate(-50%, -50%);
    cursor: grab;
  }
  :host(:dir(rtl)) [part~="slider-handle"] {
    transform: translate(50%, -50%);
  }
  [part~="grid-handle"]:where(:hover),
  [part~="slider-handle"]:where(:hover) {
    border-color: var(
      --lr-color-picker-hover-border-color,
      var(--lr-color-brand)
    );
  }
  /* A knob's pressed state is the grab: the ring deepens and the cursor closes, the whole
     feedback before the value moves. Its fill is the live colour, so it stays untouched, as with
     the trigger. */
  [part~="grid-handle"]:where(:active),
  [part~="slider-handle"]:where(:active) {
    border-color: color-mix(
      in oklab,
      var(--lr-color-picker-hover-border-color, var(--lr-color-brand)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
    cursor: grabbing;
  }
  [part~="grid-handle"]:where(:focus-visible),
  [part~="slider-handle"]:where(:focus-visible) {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part~="preview"] {
    flex: 0 0 auto;
    inline-size: var(
      --lr-color-picker-palette-swatch-size,
      var(--_lr-color-picker-palette-swatch-size)
    );
    block-size: var(
      --lr-color-picker-palette-swatch-size,
      var(--_lr-color-picker-palette-swatch-size)
    );
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: 50%;
  }

  [part~="input"] {
    flex: 1 1 auto;
    min-inline-size: 0;
    padding: var(--lr-space-2xs) var(--lr-space-xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(
      --lr-color-picker-radius,
      var(--_lr-color-picker-radius)
    );
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font-family: var(--lr-font-mono);
    font-size: var(--lr-font-size-sm);
  }
  /* no-pressed-state: pressing a text field places a caret rather than activating a target, and
     the engaged state is already drawn by :focus-visible below. Native text inputs have no
     pressed treatment either. */
  [part~="input"]:where(:hover) {
    border-color: var(
      --lr-color-picker-hover-border-color,
      var(--lr-color-brand)
    );
  }
  [part~="input"]:where(:focus-visible) {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part~="format-button"],
  [part~="eyedropper-button"] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: var(--lr-space-2xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(
      --lr-color-picker-radius,
      var(--_lr-color-picker-radius)
    );
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-xs);
    cursor: pointer;
  }
  [part~="format-button"]:where(:hover),
  [part~="eyedropper-button"]:where(:hover) {
    border-color: var(
      --lr-color-picker-hover-border-color,
      var(--lr-color-brand)
    );
  }
  /* These two carry their own surface fill, unlike the swatches, so pressed is the shared
     background mix: the button sinks toward the text colour over the deeper edge, the same
     direction in light and dark. */
  [part~="format-button"]:where(:active),
  [part~="eyedropper-button"]:where(:active) {
    border-color: color-mix(
      in oklab,
      var(--lr-color-picker-hover-border-color, var(--lr-color-brand)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
    background: color-mix(
      in oklab,
      var(--lr-color-surface),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part~="format-button"]:where(:focus-visible),
  [part~="eyedropper-button"]:where(:focus-visible) {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part~="swatches"] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-color-picker-gap, var(--_lr-color-picker-gap));
    max-inline-size: var(
      --lr-color-picker-grid-inline-size,
      var(--_lr-color-picker-grid-inline-size)
    );
  }
  [part~="swatch"] {
    position: relative;
    inline-size: var(
      --lr-color-picker-palette-swatch-size,
      var(--_lr-color-picker-palette-swatch-size)
    );
    block-size: var(
      --lr-color-picker-palette-swatch-size,
      var(--_lr-color-picker-palette-swatch-size)
    );
    padding: 0;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: 50%;
    cursor: pointer;
  }
  [part~="swatch"]:where(:hover) {
    border-color: var(
      --lr-color-picker-hover-border-color,
      var(--lr-color-brand)
    );
  }
  /* Edge only, again: ::after paints the palette entry's own colour over this box. */
  [part~="swatch"]:where(:active) {
    border-color: color-mix(
      in oklab,
      var(--lr-color-picker-hover-border-color, var(--lr-color-brand)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part~="swatch"]:where(:focus-visible) {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* Ring AND check mark, so selection never rides on colour alone. Encoded in the part name -- an
     attribute selector after ::part() never matches -- so consumers can restyle it. */
  [part~="swatch-selected"] {
    border-color: var(--lr-color-picker-selected-border, var(--lr-color-brand));
    border-width: var(--lr-border-width-medium);
  }
  [part~="swatch-selected"]::before {
    content: "✓";
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--lr-color-picker-selected-check-color, var(--lr-color-surface));
    font-size: var(--lr-font-size-xs);
    text-shadow: 0 0 var(--lr-size-2px) var(--lr-color-shadow);
    z-index: var(--lr-layer-content);
  }

  :host(:disabled) {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  :host(:disabled) [part~="trigger"],
  :host(:disabled) [part~="grid"],
  :host(:disabled) [part~="grid-handle"],
  :host(:disabled) [part~="slider"],
  :host(:disabled) [part~="slider-handle"],
  :host(:disabled) [part~="input"],
  :host(:disabled) [part~="swatch"],
  :host(:disabled) [part~="format-button"],
  :host(:disabled) [part~="eyedropper-button"] {
    cursor: not-allowed;
  }

  [part="hint"] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }
  [part="hint"][hidden] {
    display: none;
  }
  [part="error"] {
    color: var(--lr-color-danger);
    font-size: var(--lr-font-size-sm);
  }
  [part="error"][hidden] {
    display: none;
  }
  [part~="form-control"],
  [part~="form-control-label"],
  [part="hint"],
  [part="error"] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
`;
