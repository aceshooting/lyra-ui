import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    /* Lets the host shrink below its row's max-content width as a flex/grid item; the default
       min-width: auto would force the row wide despite [part='base']'s flex-wrap below. */
    min-inline-size: 0;
    /* Ring around the selected swatch. Its own token, not --lr-focus-ring-color, so the selection
       indicator rethemes independently of the :focus-visible outline; defaults to brand. */
    --_lr-swatch-picker-selected-color: var(--lr-color-brand);
    /* Blur radius of that ring, 0 by default (a crisp ring). A host wanting a soft glow sets a real
       length rather than ::part(swatch)[aria-checked], which Shadow Parts does not allow -- only a
       fixed set of pseudo-classes may follow ::part(), so an attribute selector there can silently
       fail to match. */
    --_lr-swatch-picker-selected-blur: 0;
    /* Pulsing shine duration for the selected swatch; 0s (the default) is a no-op, since a
       0-duration animation resolves to its end state instantly. It animates filter: brightness()
       rather than box-shadow, which --lr-swatch-picker-selected-blur above already owns, so the two
       compose without fighting over one property. filter also covers a slotted icon, so this reads
       the same for a plain color circle and an icon swatch with no branching -- unlike the
       box-shadow and drop-shadow split below, which needs one because box-shadow does not reach
       into a transparent box's content. */
    --_lr-swatch-picker-shine-duration: 0s;
    --_lr-swatch-picker-gemstone-selected-blur: var(--lr-size-0-5rem);
    --_lr-swatch-picker-gemstone-shine-duration: var(--lr-transition-ambient);
    --_lr-swatch-picker-hit-size: var(--lr-size-2-5rem);
    --_lr-swatch-picker-fill-size: var(
      --lr-theme-swatch-picker-fill-size,
      var(--lr-size-1-5rem)
    );
    --_lr-swatch-picker-gap: var(--lr-space-xs);
  }
  /* A swatch is a square tap target in a wrapping grid, not a form-control row, so it has its own
     ladder: it agrees with --lr-form-control-height from m up, but the shared 2xs/xs steps
     (20/24px) would land at or under the WCAG 2.5.8 minimum. Both tier spellings still match, as in
     internal/sizes.styles.ts. */
  :host([size="2xs"]) {
    --_lr-swatch-picker-hit-size: var(--lr-size-1-5rem);
    --_lr-swatch-picker-fill-size: var(
      --lr-theme-swatch-picker-fill-size,
      var(--lr-size-0-75rem)
    );
  }
  :host([size="xs"]) {
    --_lr-swatch-picker-hit-size: var(--lr-size-1-75rem);
    --_lr-swatch-picker-fill-size: var(
      --lr-theme-swatch-picker-fill-size,
      var(--lr-size-1rem)
    );
  }
  :host([size="s"]),
  :host([size="small"]) {
    --_lr-swatch-picker-hit-size: var(--lr-size-2rem);
    --_lr-swatch-picker-fill-size: var(
      --lr-theme-swatch-picker-fill-size,
      var(--lr-size-1-25rem)
    );
  }
  :host([size="l"]),
  :host([size="large"]) {
    --_lr-swatch-picker-hit-size: var(--lr-size-3rem);
    --_lr-swatch-picker-fill-size: var(
      --lr-theme-swatch-picker-fill-size,
      var(--lr-size-1-75rem)
    );
  }
  :host([size="xl"]) {
    --_lr-swatch-picker-hit-size: var(--lr-size-3-5rem);
    --_lr-swatch-picker-fill-size: var(
      --lr-theme-swatch-picker-fill-size,
      var(--lr-size-2rem)
    );
  }
  :host([mode="gemstone"]) {
    --_lr-swatch-picker-selected-blur: var(
      --lr-swatch-picker-gemstone-selected-blur,
      var(--_lr-swatch-picker-gemstone-selected-blur)
    );
    --_lr-swatch-picker-shine-duration: var(
      --lr-swatch-picker-gemstone-shine-duration,
      var(--_lr-swatch-picker-gemstone-shine-duration)
    );
  }
  [part="base"] {
    display: inline-flex;
    flex-wrap: wrap;
    min-inline-size: 0;
    gap: var(--lr-swatch-picker-gap, var(--_lr-swatch-picker-gap));
  }
  [part="swatch"] {
    box-sizing: border-box;
    /* The hit target is sized by --lr-swatch-picker-hit-size (default --lr-size-2-5rem, per tier
       below, floored at 24px for WCAG 2.5.8); the VISIBLE fill by --lr-swatch-picker-fill-size
       (default --lr-size-1-5rem, also per tier) on the separate
       [part='swatch-fill']/[part='swatch-icon'] child, centered via flex rather than by resizing
       this button. The fill used to double as the clickable box; splitting them grows the tap area
       without changing the dense grid's density. */
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(
      --lr-swatch-picker-hit-size,
      var(--_lr-swatch-picker-hit-size)
    );
    min-block-size: var(
      --lr-swatch-picker-hit-size,
      var(--_lr-swatch-picker-hit-size)
    );
    padding: 0;
    border: none;
    border-radius: 50%;
    background: none;
    /* Exposes the option's color to a slotted icon (part='swatch-icon') via currentColor -- inert
       with no icon, since [part='swatch-fill'] paints its own background. */
    color: var(--lr-swatch-color);
    cursor: pointer;
  }
  [part="swatch-fill"] {
    box-sizing: border-box;
    display: block;
    inline-size: var(
      --lr-swatch-picker-fill-size,
      var(--_lr-swatch-picker-fill-size)
    );
    block-size: var(
      --lr-swatch-picker-fill-size,
      var(--_lr-swatch-picker-fill-size)
    );
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: 50%;
    /* Per-swatch fill from the option's color, set inline by swatch-picker.class.ts. Read through a
       var(), not an inline background-color, so a consumer's ::part(swatch-fill) rule can still
       win. */
    background-color: var(--lr-swatch-color);
    transition: transform var(--lr-transition-fast);
    /* The fill is the option's data, not chrome: keep it while the button and its focus/selection
       affordances use system colors in forced-colors mode. */
    forced-color-adjust: none;
  }
  [part="swatch-icon"] {
    display: flex;
    align-items: center;
    justify-content: center;
    inline-size: var(
      --lr-swatch-picker-fill-size,
      var(--_lr-swatch-picker-fill-size)
    );
    block-size: var(
      --lr-swatch-picker-fill-size,
      var(--_lr-swatch-picker-fill-size)
    );
    /* Sets the em from the visible fill token: gemstoneGlyph() -- and any em-sized consumer icon --
       has a 1em intrinsic box, which would otherwise inherit the browser's smaller default button
       font-size. */
    font-size: var(
      --lr-swatch-picker-fill-size,
      var(--_lr-swatch-picker-fill-size)
    );
    transition: transform var(--lr-transition-fast);
    forced-color-adjust: none;
  }
  /* Keys off the button's own native :disabled, which is what render() binds, so the swatch that is
     inert is the swatch that dims. :host(:disabled) would be dead code: this control is
     deliberately not form-associated, so the UA computes no disabled state for the host. */
  [part="swatch"]:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part="swatch"]:not(:disabled):hover [part="swatch-fill"],
  [part="swatch"]:not(:disabled):hover [part="swatch-icon"] {
    transform: scale(1.2);
  }
  [part="swatch"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part="swatch"][aria-checked="true"] [part="swatch-fill"],
  [part="swatch"][aria-checked="true"] [part="swatch-icon"] {
    transform: scale(1.2);
  }
  /* A scale, not a colour mix: this part's fill IS the option's colour, and tinting it would
     misreport the value the swatch exists to show. The press pushes the raised swatch back below
     its resting size, so it reads as a depress against the hover lift, not a second lift.
     Deliberately AFTER the aria-checked rule above -- both are (0,3,0), so order is the only thing
     giving the already-selected swatch, the likeliest one to be pressed again, any pressed
     feedback. */
  [part="swatch"]:not(:disabled):active [part="swatch-fill"],
  [part="swatch"]:not(:disabled):active [part="swatch-icon"] {
    transform: scale(0.95);
  }
  [part="swatch"][aria-checked="true"] [part="swatch-fill"] {
    box-shadow: 0 0
      var(
        --lr-swatch-picker-selected-blur,
        var(--_lr-swatch-picker-selected-blur)
      )
      var(--lr-border-width-thick)
      var(
        --lr-swatch-picker-selected-color,
        var(--_lr-swatch-picker-selected-color)
      );
    animation: lr-swatch-picker-shine
      var(
        --lr-swatch-picker-shine-duration,
        var(--_lr-swatch-picker-shine-duration)
      )
      infinite;
  }
  @keyframes lr-swatch-picker-shine {
    0%,
    100% {
      filter: brightness(1);
    }
    50% {
      filter: brightness(1.4);
    }
  }
  /* An icon option renders its own shape, so the box-shadow ring above (drawn around
     [part='swatch-fill']'s shape) does not apply -- render() mounts only one of
     [part='swatch-fill'] and [part='swatch-icon'] per swatch, so the two selectors never both
     match. Use a drop-shadow, which follows the icon's real rendered shape. The shine needs its OWN
     keyframe: both effects land on filter for an icon, and a running animation outranks an
     author-normal declaration, so a brightness-only keyframe would blank this glow for the whole
     animation -- every mode="gemstone" swatch, where the shine is on by default. The keyframe
     therefore re-states drop-shadow alongside brightness; the static declaration below covers the
     not-running case (--lr-swatch-picker-shine-duration: 0s, and prefers-reduced-motion). */
  [part="swatch"][aria-checked="true"] [part="swatch-icon"] {
    filter: drop-shadow(
      0 0
        var(
          --lr-swatch-picker-selected-blur,
          var(--_lr-swatch-picker-selected-blur)
        )
        var(
          --lr-swatch-picker-selected-color,
          var(--_lr-swatch-picker-selected-color)
        )
    );
    animation: lr-swatch-picker-shine-icon
      var(
        --lr-swatch-picker-shine-duration,
        var(--_lr-swatch-picker-shine-duration)
      )
      infinite;
  }
  @keyframes lr-swatch-picker-shine-icon {
    0%,
    100% {
      filter: drop-shadow(
          0 0
            var(
              --lr-swatch-picker-selected-blur,
              var(--_lr-swatch-picker-selected-blur)
            )
            var(
              --lr-swatch-picker-selected-color,
              var(--_lr-swatch-picker-selected-color)
            )
        )
        brightness(1);
    }
    50% {
      filter: drop-shadow(
          0 0
            var(
              --lr-swatch-picker-selected-blur,
              var(--_lr-swatch-picker-selected-blur)
            )
            var(
              --lr-swatch-picker-selected-color,
              var(--_lr-swatch-picker-selected-color)
            )
        )
        brightness(1.4);
    }
  }
  /* Under reduced motion the scale keeps its transform but loses its easing -- the ring already
     conveys selection, so the swatch may snap. The looping shine stops outright at a steady
     brightness rather than merely losing its easing, per prefers-reduced-motion's intent for
     anything that loops. */
  @media (prefers-reduced-motion: reduce) {
    [part="swatch-fill"],
    [part="swatch-icon"] {
      transition: none;
    }
    [part="swatch"][aria-checked="true"] [part="swatch-fill"],
    [part="swatch"][aria-checked="true"] [part="swatch-icon"] {
      animation: none;
    }
  }
`;
