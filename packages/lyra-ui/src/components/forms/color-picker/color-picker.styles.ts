import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    /* The trigger swatch is square and sits in toolbar rows beside real form controls, so its edge
       IS the shared form-control height: it reads the ONE ladder (internal/sizes.styles.ts) rather
       than a private copy of the same six values. That ladder matches both spellings of every tier
       in one selector list, so size="small" and size="s" resolve identically here with no
       per-component alias rules. The fallback arm names the default tier's own value, so the swatch
       still paints at its documented size if this rule is ever applied without the shared ladder
       sheet alongside it. */
    --lr-color-picker-swatch-size: var(--lr-form-control-height, var(--lr-size-2-5rem));
    --lr-color-picker-gap: var(--lr-space-xs);
    --lr-color-picker-radius: var(--lr-radius);
    --lr-color-picker-grid-inline-size: var(--grid-width, var(--lr-size-15rem));
    --lr-color-picker-grid-block-size: var(--grid-height, var(--lr-size-8rem));
    --lr-color-picker-grid-handle-size: var(--grid-handle-size, var(--lr-size-1rem));
    --lr-color-picker-slider-block-size: var(--slider-height, var(--lr-size-0-75rem));
    --lr-color-picker-slider-handle-size: var(--slider-handle-size, var(--lr-size-1-25rem));
    --lr-color-picker-palette-swatch-size: var(--swatch-size, var(--lr-size-1-5rem));
    --lr-color-picker-checker-color: var(--lr-color-border);
    --lr-color-picker-checker-size: var(--lr-size-0-5rem);
    /* The sRGB hue wheel's own stops. These are the algorithm's data, not a design decision, so
       they stay literal -- but they are exposed as one overridable list because a consumer
       theming a wide-gamut or perceptually-uniform ramp needs to replace exactly this. Both text
       directions read the same list; only the gradient's direction differs. */
    --lr-color-picker-hue-stops:
      hsl(0 100% 50%),
      hsl(60 100% 50%),
      hsl(120 100% 50%),
      hsl(180 100% 50%),
      hsl(240 100% 50%),
      hsl(300 100% 50%),
      hsl(360 100% 50%);
    /* Overwritten inline per render with the live colour; declared here so every consumer of it
       below still paints something sensible before the first update commits. */
    --lr-color-picker-swatch-color: transparent;
    --lr-color-picker-grid-hue: transparent;
    --lr-color-picker-opacity-gradient: none;
  }
  [part~='form-control'] {
    display: inline-flex;
    position: relative;
    flex-direction: column;
    gap: var(--lr-color-picker-gap);
  }
  [part~='label'] {
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-md-sm);
  }
  /* [part]:empty never matches -- the part always contains a literal <slot> child element
     regardless of assigned content -- so real emptiness is tracked in JS (hasLabel/hasHint/
     hasError) and reflected via the hidden attribute instead. Without this, the required-asterisk
     ::after below (which attaches to this box) would render a stray ' *' with nothing before it
     whenever label is unset. */
  [part~='label'][hidden] {
    display: none;
  }
  :host([required]) [part~='label']::after {
    content: ' *';
    color: var(--lr-color-danger);
  }

  /* The alpha checkerboard every translucent surface sits on. A conic-gradient tile beats four
     stacked linear gradients and needs no extra element. */
  [part~='preview'],
  [part~='swatch'] {
    background-color: var(--lr-color-surface);
    background-image: conic-gradient(
      var(--lr-color-picker-checker-color) 0deg 90deg,
      transparent 90deg 180deg,
      var(--lr-color-picker-checker-color) 180deg 270deg,
      transparent 270deg 360deg
    );
    background-size: var(--lr-color-picker-checker-size) var(--lr-color-picker-checker-size);
  }

  [part='trigger-container'] {
    display: flex;
    align-items: center;
  }
  [part~='trigger'] {
    position: relative;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    inline-size: max(var(--lr-color-picker-swatch-size), var(--lr-icon-button-size));
    block-size: max(var(--lr-color-picker-swatch-size), var(--lr-icon-button-size));
    padding: 0;
    border: var(--lr-border-width-thin) solid transparent;
    border-radius: var(--lr-color-picker-radius);
    background: transparent;
    cursor: pointer;
  }
  [part~='trigger']::before {
    content: '';
    position: absolute;
    inset-inline-start: 50%;
    inset-block-start: 50%;
    box-sizing: border-box;
    inline-size: var(--lr-color-picker-swatch-size);
    block-size: var(--lr-color-picker-swatch-size);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-color-picker-radius);
    background-color: var(--lr-color-surface);
    background-image: conic-gradient(
      var(--lr-color-picker-checker-color) 0deg 90deg,
      transparent 90deg 180deg,
      var(--lr-color-picker-checker-color) 180deg 270deg,
      transparent 270deg 360deg
    );
    background-size: var(--lr-color-picker-checker-size) var(--lr-color-picker-checker-size);
    transform: translate(-50%, -50%);
    pointer-events: none;
  }
  [part~='trigger']::after {
    content: '';
    position: absolute;
    inset-inline-start: 50%;
    inset-block-start: 50%;
    inline-size: calc(
      var(--lr-color-picker-swatch-size) - var(--lr-border-width-thin) - var(--lr-border-width-thin)
    );
    block-size: calc(
      var(--lr-color-picker-swatch-size) - var(--lr-border-width-thin) - var(--lr-border-width-thin)
    );
    border-radius: var(--lr-color-picker-radius);
    background-color: var(--lr-color-picker-swatch-color);
    transform: translate(-50%, -50%);
    pointer-events: none;
  }
  :host(:dir(rtl)) [part~='trigger']::before,
  :host(:dir(rtl)) [part~='trigger']::after {
    transform: translate(50%, -50%);
  }
  [part~='preview']::after,
  [part~='swatch']::after {
    content: '';
    display: block;
    block-size: 100%;
    inline-size: 100%;
    border-radius: inherit;
    background-color: var(--lr-color-picker-swatch-color);
  }
  [part~='trigger']:where(:hover),
  [part~='trigger']:where(:hover)::before {
    border-color: var(--lr-color-picker-hover-border-color, var(--lr-color-brand));
  }
  /* Pressed deepens the same edge rather than tinting the box: its pseudo-element paints the
     selected colour, so mixing the fill would misreport the value the swatch exists to show. */
  [part~='trigger']:where(:active),
  [part~='trigger']:where(:active)::before {
    border-color: color-mix(
      in oklab,
      var(--lr-color-picker-hover-border-color, var(--lr-color-brand)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part~='trigger']:where(:focus-visible) {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part~='panel'] {
    /* Absolutely positioned from the start (not only once JS positions it on open) so the closed
       panel never occupies a box in the host's normal flow. The hoist option makes place() switch this to
       fixed at runtime. Physical top/left, not the logical inset properties: place() overwrites
       these via style.left/style.top, and under RTL inset-inline-start resolves to the physical
       right, leaving both right:0 and left:Npx active -- the over-constrained resolution would
       discard the JS value and pin the panel to the viewport edge. */
    position: absolute;
    top: 0;
    /* policy-allow(physical-css): must stay the same physical property positioner.ts's place()
       overwrites via style.left; see the comment above. */
    left: 0;
    z-index: var(--lr-overlay-stack-index, var(--lr-layer-popover));
    display: flex;
    flex-direction: column;
    gap: var(--lr-color-picker-gap);
    padding: var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-color-picker-radius);
    background: var(--lr-color-surface);
    /* Anchored overlay: a positioner-placed picker panel floating over page content. */
    box-shadow: var(--lr-shadow-m);
    max-inline-size: var(--lr-positioner-available-inline-size, none);
  }
  [part~='panel'][hidden] {
    display: none;
  }
  :host([inline]) [part~='panel'] {
    position: static;
    inset: auto;
    box-shadow: none;
  }
  .row {
    display: flex;
    align-items: center;
    gap: var(--lr-color-picker-gap);
  }
  .sliders {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: var(--lr-color-picker-gap);
    min-inline-size: 0;
  }

  [part~='grid'] {
    position: relative;
    inline-size: var(--lr-color-picker-grid-inline-size);
    max-inline-size: 100%;
    block-size: var(--lr-color-picker-grid-block-size);
    border-radius: var(--lr-color-picker-radius);
    cursor: crosshair;
    touch-action: none;
    background-color: var(--lr-color-picker-grid-hue);
    /* The saturation/value square is defined as a white-to-transparent tint across the inline axis
       over a transparent-to-shade wash down the block axis. Both endpoints are the achromatic
       extremes the model itself requires, written in hsl() so no raw hex literal is involved. */
    background-image:
      linear-gradient(to bottom, transparent, hsl(0 0% 0%)),
      linear-gradient(to right, hsl(0 0% 100%), transparent);
  }
  :host(:dir(rtl)) [part~='grid'] {
    background-image:
      linear-gradient(to bottom, transparent, hsl(0 0% 0%)),
      linear-gradient(to left, hsl(0 0% 100%), transparent);
  }
  [part~='grid-handle'] {
    position: absolute;
    inline-size: var(--lr-color-picker-grid-handle-size);
    block-size: var(--lr-color-picker-grid-handle-size);
    border: var(--lr-border-width-medium) solid var(--lr-color-surface);
    border-radius: 50%;
    /* Resting chrome, not an overlay: a knob riding directly on the grid it edits, inside a panel
       that is itself the anchored overlay -- it has to stay a step below its own container. */
    box-shadow: var(--lr-shadow-s);
    transform: translate(-50%, -50%);
    cursor: grab;
  }
  :host(:dir(rtl)) [part~='grid-handle'] {
    transform: translate(50%, -50%);
  }

  /* The slider element is the pointer target and is floored at 24px (WCAG 2.5.8) even though the
     visible ramp is the thinner --lr-color-picker-slider-block-size bar drawn by ::before inside
     it. Growing the visible bar instead would make a colour picker look like a pair of progress
     bars; shrinking the target to the bar would leave a 12px-tall touch target. */
  [part~='slider'] {
    position: relative;
    block-size: var(--lr-size-1-5rem);
    cursor: pointer;
    touch-action: pan-y;
  }
  [part~='slider']::before {
    content: '';
    position: absolute;
    inset-inline: 0;
    inset-block-start: 50%;
    block-size: var(--lr-color-picker-slider-block-size);
    border-radius: var(--lr-radius-pill);
    transform: translateY(-50%);
  }
  [part~='slider']:where(:hover)::before {
    box-shadow: 0 0 0 var(--lr-border-width-thin)
      var(--lr-color-picker-hover-border-color, var(--lr-color-brand));
  }
  [part~='slider']:where(:hover) {
    outline: var(--lr-border-width-thin) solid
      var(--lr-color-picker-hover-border-color, var(--lr-color-brand));
  }
  [part~='slider']:where(:active)::before {
    box-shadow: 0 0 0 var(--lr-border-width-medium)
      color-mix(
        in oklab,
        var(--lr-color-picker-hover-border-color, var(--lr-color-brand)),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      );
  }
  [part~='slider']:where(:active) {
    outline: var(--lr-border-width-medium) solid
      color-mix(
        in oklab,
        var(--lr-color-picker-hover-border-color, var(--lr-color-brand)),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      );
  }
  [part~='hue-slider']::before {
    background-image: linear-gradient(to right, var(--lr-color-picker-hue-stops));
  }
  :host(:dir(rtl)) [part~='hue-slider']::before {
    background-image: linear-gradient(to left, var(--lr-color-picker-hue-stops));
  }
  [part~='opacity-slider']::before {
    background-image:
      var(--lr-color-picker-opacity-gradient),
      conic-gradient(
        var(--lr-color-picker-checker-color) 0deg 90deg,
        transparent 90deg 180deg,
        var(--lr-color-picker-checker-color) 180deg 270deg,
        transparent 270deg 360deg
      );
    background-size: auto, var(--lr-color-picker-checker-size) var(--lr-color-picker-checker-size);
    background-color: var(--lr-color-surface);
  }
  [part~='slider-handle'] {
    position: absolute;
    inset-block-start: 50%;
    inline-size: var(--lr-color-picker-slider-handle-size);
    block-size: var(--lr-color-picker-slider-handle-size);
    border: var(--lr-border-width-medium) solid var(--lr-color-surface);
    border-radius: 50%;
    /* Resting chrome, same tier as the grid handle above: a knob on a track, not a floating panel. */
    box-shadow: var(--lr-shadow-s);
    background-color: var(--lr-color-picker-swatch-color);
    transform: translate(-50%, -50%);
    cursor: grab;
  }
  :host(:dir(rtl)) [part~='slider-handle'] {
    transform: translate(50%, -50%);
  }
  [part~='grid-handle']:where(:hover),
  [part~='slider-handle']:where(:hover) {
    border-color: var(--lr-color-picker-hover-border-color, var(--lr-color-brand));
  }
  /* A knob's pressed state is the grab itself: the ring deepens and the cursor closes, which is
     the whole feedback a drag has before the value starts moving. The handle's own fill is the
     live colour, so it stays untouched here for the same reason as the trigger above. */
  [part~='grid-handle']:where(:active),
  [part~='slider-handle']:where(:active) {
    border-color: color-mix(
      in oklab,
      var(--lr-color-picker-hover-border-color, var(--lr-color-brand)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
    cursor: grabbing;
  }
  [part~='grid-handle']:where(:focus-visible),
  [part~='slider-handle']:where(:focus-visible) {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part~='preview'] {
    flex: 0 0 auto;
    inline-size: var(--lr-color-picker-palette-swatch-size);
    block-size: var(--lr-color-picker-palette-swatch-size);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: 50%;
  }

  [part~='input'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    padding: var(--lr-space-2xs) var(--lr-space-xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-color-picker-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font-family: var(--lr-font-mono);
    font-size: var(--lr-font-size-sm);
  }
  /* no-pressed-state: pressing a text field places a caret, it does not activate a target -- there
     is no "did my click register?" gap to fill, and the engaged state it leads to is already drawn
     by the :focus-visible rule below. Native text inputs have no pressed treatment either. */
  [part~='input']:where(:hover) {
    border-color: var(--lr-color-picker-hover-border-color, var(--lr-color-brand));
  }
  [part~='input']:where(:focus-visible) {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part~='format-button'],
  [part~='eyedropper-button'] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: var(--lr-space-2xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-color-picker-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-xs);
    cursor: pointer;
  }
  [part~='format-button']:where(:hover),
  [part~='eyedropper-button']:where(:hover) {
    border-color: var(--lr-color-picker-hover-border-color, var(--lr-color-brand));
  }
  /* These two carry their own surface fill (unlike the swatches), so the pressed state is the
     shared background mix: the button visibly sinks toward the text colour, on top of the deeper
     edge, and lands in the same direction whether the theme is light or dark. */
  [part~='format-button']:where(:active),
  [part~='eyedropper-button']:where(:active) {
    border-color: color-mix(
      in oklab,
      var(--lr-color-picker-hover-border-color, var(--lr-color-brand)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
    background: color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part~='format-button']:where(:focus-visible),
  [part~='eyedropper-button']:where(:focus-visible) {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  [part~='swatches'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-color-picker-gap);
    max-inline-size: var(--lr-color-picker-grid-inline-size);
  }
  [part~='swatch'] {
    position: relative;
    inline-size: var(--lr-color-picker-palette-swatch-size);
    block-size: var(--lr-color-picker-palette-swatch-size);
    padding: 0;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: 50%;
    cursor: pointer;
  }
  [part~='swatch']:where(:hover) {
    border-color: var(--lr-color-picker-hover-border-color, var(--lr-color-brand));
  }
  /* Edge only, again: ::after paints the palette entry's own colour over this box. */
  [part~='swatch']:where(:active) {
    border-color: color-mix(
      in oklab,
      var(--lr-color-picker-hover-border-color, var(--lr-color-brand)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part~='swatch']:where(:focus-visible) {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* The selected palette entry is marked by a ring AND a check mark, so the selection never rides
     on colour alone. Encoded in the part name (not an attribute selector after ::part(), which
     never matches) so consumers can restyle the selected state too. */
  [part~='swatch-selected'] {
    border-color: var(--lr-color-brand);
    border-width: var(--lr-border-width-medium);
  }
  [part~='swatch-selected']::before {
    content: '✓';
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--lr-color-surface);
    font-size: var(--lr-font-size-xs);
    text-shadow: 0 0 var(--lr-size-2px) var(--lr-color-shadow);
    z-index: var(--lr-layer-content);
  }

  :host(:disabled) {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  :host(:disabled) [part~='trigger'],
  :host(:disabled) [part~='grid'],
  :host(:disabled) [part~='grid-handle'],
  :host(:disabled) [part~='slider'],
  :host(:disabled) [part~='slider-handle'],
  :host(:disabled) [part~='input'],
  :host(:disabled) [part~='swatch'],
  :host(:disabled) [part~='format-button'],
  :host(:disabled) [part~='eyedropper-button'] {
    cursor: not-allowed;
  }

  [part='hint'] {
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-font-size-sm);
  }
  [part='hint'][hidden] {
    display: none;
  }
  [part='error'] {
    color: var(--lr-color-danger);
    font-size: var(--lr-font-size-sm);
  }
  [part='error'][hidden] {
    display: none;
  }
  [part~='form-control'],
  [part~='form-control-label'],
  [part='hint'],
  [part='error'] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
`;
