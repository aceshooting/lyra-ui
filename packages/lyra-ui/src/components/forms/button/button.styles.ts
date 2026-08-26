import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    min-inline-size: 0;
    max-inline-size: 100%;
    /* The native button follows a host width, which is meaningful on the public component; the
       variable opts out for compact inline compositions. */
    --_lr-button-width: 100%;
    /* The size scale comes from the shared form-control ladder (internal/sizes.styles.ts, loaded
       ahead of this sheet by button.class.ts), so a button shares each same-tier control's
       minimum-height floor instead of maintaining a second list. Content and nested action floors
       can still make a composed control taller. The per-tier names survive as override points. */
    --_lr-button-size-2xs: var(--lr-form-control-height-2xs);
    --_lr-button-size-xs: var(--lr-form-control-height-xs);
    --_lr-button-size-s: var(--lr-form-control-height-s);
    --_lr-button-size-m: var(--lr-form-control-height-m);
    --_lr-button-size-l: var(--lr-form-control-height-l);
    --_lr-button-size-xl: var(--lr-form-control-height-xl);
    /* Geometry knobs pointed at the ladder's active-tier value. No per-tier rule declares a CSS
       property on [part~='base'], so a consumer can retune a tier without a ::part(base) rule. The
       ladder matches both tier spellings, so size="small" is size="s" for free. */
    --_lr-button-padding-block: var(--lr-form-control-padding-block);
    --_lr-button-padding-inline: var(--lr-form-control-padding-inline);
    --_lr-button-font-size: var(--lr-form-control-font-size);
    --_lr-button-min-height: var(--lr-button-size-m, var(--_lr-button-size-m));
    --_lr-button-gap: var(--lr-form-control-gap);
    --_lr-button-radius: var(--lr-form-control-radius);
    /* Relative to the button's own font-size, so the with-caret chevron tracks every tier without a
       per-tier rule -- as lr-attachment-trigger's expand-icon does. */
    --_lr-button-caret-size: var(--lr-size-0-75em);
    /* internal/variants.styles.ts re-points the nine colour slots below at the active variant's
       row, so no :host([variant='...']) block is needed -- there were five before 8.0.0. "filled"
       reads the QUIET tier, "accent" the LOUD one; they used to share one loud token per chromatic
       variant (identical rendering) while neutral's "filled" was the page surface, i.e. no fill. */
    --_lr-button-accent: var(--lr-color-fill-loud);
    --_lr-button-fill: var(--lr-color-fill-quiet);
    --_lr-button-on-fill: var(--lr-color-on-quiet);
    --_lr-button-border: var(--lr-color-border-normal);
    --_lr-button-outlined-border: var(--lr-color-border-strong);
    /* Transparent by default (byte-identical to the old hardcoded background: transparent); set it
       to tint an outlined button without a ::part(base) rule. Like --lr-button-quiet-*,
       deliberately NOT swapped per variant: an outlined fill is a surface decision, not a semantic
       tone. */
    --_lr-button-outlined-fill: transparent;
    --_lr-button-quiet-border: var(--lr-color-border);
    --_lr-button-quiet-text: var(--lr-color-text-quiet);
    --_lr-button-accent-fill: var(--lr-color-fill-loud);
    --_lr-button-accent-on-fill: var(--lr-color-on-loud);
    /* Hover/press is a colour MIX, not the pre-8.0.0 filter: brightness(): a filter multiplies
       every channel, so it moved dark and light fills only by luck, no-op'd on pure white or black,
       and dimmed the label and icons with the box. Mixing toward --lr-color-mix-partner (which
       follows the text colour) always moves the way the surface needs. --lr-button-hover-base is
       what both mixes move AWAY from -- the fill the active appearance paints. The chrome-less
       tiers (outlined, plain, quiet, link) paint none, so they mix from the page surface; quiet's
       hover used to BE var(--lr-color-surface), i.e. no hover at all. Tint
       --lr-button-outlined-fill and point this at the same colour. */
    --_lr-button-hover-base: var(--lr-color-surface);
    --_lr-button-hover-background: color-mix(
      in oklab,
      var(--lr-button-hover-base, var(--_lr-button-hover-base)),
      var(--lr-color-mix-partner) var(--lr-color-mix-hover)
    );
    --_lr-button-active-background: color-mix(
      in oklab,
      var(--lr-button-hover-base, var(--_lr-button-hover-base)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  /* Each painted tier names its own fill as the mix base, so retuning --lr-button-fill or
     --lr-button-accent-fill retunes that tier's hover and press with it. */
  :host([appearance="filled"]),
  :host([appearance="filled-outlined"]) {
    --_lr-button-hover-base: var(--lr-button-fill, var(--_lr-button-fill));
  }
  :host([appearance="accent"]) {
    --_lr-button-hover-base: var(
      --lr-button-accent-fill,
      var(--_lr-button-accent-fill)
    );
  }
  /* Shoelace's boolean outline surface is an additive alias. It never rewrites appearance, so
     removing it restores the exact Lyra treatment the author selected. */
  :host([outline]) {
    --_lr-button-hover-base: var(--lr-color-surface);
  }
  /* The one place a variant still needs naming. The four chromatic variants use their loud fill as
     the chrome-less foreground -- brand text on the surface IS the brand colour. Neutral's loud
     fill is a mid grey built for LIGHT text; as dark-on-surface text it washes out every plain,
     outlined and link button and collapses the plain/quiet gap, so neutral keeps the body text
     colour. The :not([variant]) arm covers a host whose reflected attribute was removed by hand. */
  :host(:not([variant])),
  :host([variant="neutral"]) {
    --_lr-button-accent: var(--lr-color-text);
  }
  /* Fully rounded ends. Retuning the private radius default rather than declaring border-radius on
     [part~='base'] keeps one corner-radius declaration, lets an inherited or public radius win, and
     leaves appearance="link"'s literal border-radius: 0 intact -- a pill inline link is the
     button-shaped box that appearance exists to avoid. */
  :host([pill]) {
    --_lr-button-radius: var(--lr-radius-pill);
  }
  :host([circle]) {
    --_lr-button-radius: var(--lr-radius-pill);
  }
  [part~="base"] {
    display: inline-flex;
    position: relative;
    box-sizing: border-box;
    inline-size: var(--lr-button-width, var(--_lr-button-width));
    min-inline-size: 0;
    max-inline-size: 100%;
    /* --lr-button-height is deliberately UNDECLARED on :host, so both var()s below take their
       fallback arm: a floor at the tier's --lr-button-min-height and an auto height. Setting it
       floors and caps the button. A declared "auto" would break that -- it is a defined value, so
       the fallback never fires and every tier's floor becomes dead code (the trap select.styles.ts
       documents). */
    min-block-size: var(
      --lr-button-height,
      var(--lr-button-min-height, var(--_lr-button-min-height))
    );
    block-size: var(--lr-button-height, auto);
    align-items: center;
    justify-content: center;
    gap: var(--lr-button-gap, var(--_lr-button-gap));
    padding-inline: var(
      --lr-button-padding-inline,
      var(--_lr-button-padding-inline)
    );
    padding-block: var(
      --lr-button-padding-block,
      var(--_lr-button-padding-block)
    );
    border-radius: var(--lr-button-radius, var(--_lr-button-radius));
    border: var(--lr-border-width-thin) solid
      var(--lr-button-border, var(--_lr-button-border));
    font: inherit;
    font-weight: var(--lr-font-weight-semibold);
    /* After the "font" shorthand, which would otherwise reset font-size back to the inherited one. */
    font-size: var(--lr-button-font-size, var(--_lr-button-font-size));
    cursor: pointer;
    /* Undeclared by default (byte-identical to today's absent box-shadow); set it for an elevated
       button without a ::part(base) rule. */
    box-shadow: var(--lr-button-shadow, none);
  }
  :host([appearance="filled"]) [part~="base"] {
    background: var(--lr-button-fill, var(--_lr-button-fill));
    color: var(--lr-button-on-fill, var(--_lr-button-on-fill));
  }
  :host([appearance="accent"]) [part~="base"] {
    background: var(--lr-button-accent-fill, var(--_lr-button-accent-fill));
    color: var(--lr-button-accent-on-fill, var(--_lr-button-accent-on-fill));
    border-color: var(--lr-button-accent-fill, var(--_lr-button-accent-fill));
  }
  :host([appearance="outlined"]) [part~="base"] {
    background: var(--lr-button-outlined-fill, var(--_lr-button-outlined-fill));
    color: var(--lr-button-accent, var(--_lr-button-accent));
    border-color: var(
      --lr-button-outlined-border,
      var(--_lr-button-outlined-border)
    );
  }
  :host([outline]) [part~="base"] {
    background: var(--lr-button-outlined-fill, var(--_lr-button-outlined-fill));
    color: var(--lr-button-accent, var(--_lr-button-accent));
    border-color: var(
      --lr-button-outlined-border,
      var(--_lr-button-outlined-border)
    );
  }
  /* The filled fill and foreground, but with the outlined tier's border color instead of the
     variant-tinted --lr-button-border -- a filled button whose edge still reads against a
     same-toned surface. Both halves stay on their own knobs, so retuning either tier retunes this
     one. */
  :host([appearance="filled-outlined"]) [part~="base"] {
    background: var(--lr-button-fill, var(--_lr-button-fill));
    color: var(--lr-button-on-fill, var(--_lr-button-on-fill));
    border-color: var(
      --lr-button-outlined-border,
      var(--_lr-button-outlined-border)
    );
  }
  :host([appearance="plain"]) [part~="base"] {
    background: transparent;
    color: var(--lr-button-accent, var(--_lr-button-accent));
    border-color: transparent;
  }
  :host([appearance="quiet"]) [part~="base"] {
    background: transparent;
    color: var(--lr-button-quiet-text, var(--_lr-button-quiet-text));
    border-color: var(--lr-button-quiet-border, var(--_lr-button-quiet-border));
  }
  /* Two selectors for one state: the native <button> matches :disabled (own attribute or fieldset
     cascade), but an <a> is not a form control, so :disabled never matches it whatever
     aria-disabled says. The disabled-link path renders an href-less, tabindex="-1",
     aria-disabled="true" anchor, so the second arm keys off that attribute -- without it a disabled
     link rendered fully opaque with a pointer cursor. Every :not(:disabled) below excludes it too.
     */
  [part~="base"]:disabled,
  [part~="base"][aria-disabled="true"] {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part~="base"]:not(:disabled, [aria-disabled="true"]) {
    transition: background-color var(--lr-transition-fast),
      color var(--lr-transition-fast), transform var(--lr-transition-fast);
  }
  /* One hover and one press rule for every appearance -- what moves per tier is the mix BASE above,
     not the rule. Both out-specify each :host([appearance='...']) [part~='base'] block, so no tier
     loses its pointer feedback. */
  [part~="base"]:not(:disabled, [aria-disabled="true"]):hover {
    background: var(
      --lr-button-hover-background,
      var(--_lr-button-hover-background)
    );
  }
  [part~="base"]:not(:disabled, [aria-disabled="true"]):active {
    background: var(
      --lr-button-active-background,
      var(--_lr-button-active-background)
    );
    transform: scale(var(--lr-button-active-scale, 0.9875));
  }
  @media (prefers-reduced-motion: reduce) {
    [part~="base"]:not(:disabled, [aria-disabled="true"]):active {
      transform: none;
    }
  }
  [part~="base"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part~="start"],
  [part~="end"] {
    display: inline-flex;
    flex: 0 0 auto;
    min-inline-size: 0;
    max-inline-size: 40%;
    align-items: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part="label"] {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* button.class.ts stamps hidden on the wrapper when the slot has no assigned content (a bare slot
     is an element child, so :empty never matched). This higher-specificity rule beats the display:
     inline-flex above, collapsing the wrapper so it stops contributing a dead --lr-button-gap --
     mirrors input.styles.ts's [part='start'][hidden] and [part='end'][hidden]. */
  [part~="start"][hidden],
  [part~="end"][hidden] {
    display: none;
  }
  /* A declared circle and a detected icon-only label both use a square control. circle also takes
     the pill radius above; an icon-only WA button keeps its appearance's ordinary radius. */
  :host([circle]) [part~="base"],
  [part~="base"][data-icon-button] {
    inline-size: var(
      --lr-button-height,
      var(--lr-button-min-height, var(--_lr-button-min-height))
    );
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    aspect-ratio: 1;
    padding-inline: var(
      --lr-button-padding-block,
      var(--_lr-button-padding-block)
    );
  }
  /* Decorative dropdown chevron. chevronIcon() points right, so the glyph -- not the wrapping part
     -- is rotated down, matching lr-select's expand-icon; a down caret is direction-neutral, so
     nothing mirrors under RTL. */
  [part="caret"] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    font-size: var(--lr-button-caret-size, var(--_lr-button-caret-size));
  }
  [part="caret"] svg {
    transform: rotate(90deg);
  }
  /* Padding and font-size per tier come from the ladder (see :host above); nothing here restates a
     scale. These five rules exist only to keep the --lr-button-size-* names LIVE override points
     rather than decorative aliases -- a documented property that silently does nothing is worse
     than none. Both spellings of each aliased tier are matched, as the ladder does, so size="small"
     cannot take the s tier's padding with the m tier's floor. m/medium needs no rule: :host carries
     that default. */
  :host([size="2xs"]) {
    --_lr-button-min-height: var(
      --lr-button-size-2xs,
      var(--_lr-button-size-2xs)
    );
  }
  :host([size="xs"]) {
    --_lr-button-min-height: var(
      --lr-button-size-xs,
      var(--_lr-button-size-xs)
    );
  }
  :host([size="s"]),
  :host([size="small"]) {
    --_lr-button-min-height: var(--lr-button-size-s, var(--_lr-button-size-s));
  }
  :host([size="l"]),
  :host([size="large"]) {
    --_lr-button-min-height: var(--lr-button-size-l, var(--_lr-button-size-l));
  }
  :host([size="xl"]) {
    --_lr-button-min-height: var(
      --lr-button-size-xl,
      var(--_lr-button-size-xl)
    );
  }
  /* A true inline-link appearance: zero chrome (no padding, border, radius or min-height floor),
     underlined, coloured from the accent token "plain" uses, inheriting the ambient font. It must
     stay after the size rules: it resets padding and font with literals rather than the
     --lr-button-padding-* and --lr-button-font-size knobs, so it beats any tier's and any
     consumer's geometry, and it zeroes min-block-size and block-size so a pinned --lr-button-height
     cannot box an inline link. */
  :host([appearance="link"]) [part~="base"] {
    inline-size: auto;
    padding: 0;
    border: 0;
    min-block-size: 0;
    block-size: auto;
    border-radius: 0;
    background: transparent;
    color: var(--lr-button-accent, var(--_lr-button-accent));
    font: inherit;
    text-decoration: underline;
    text-underline-offset: var(--lr-size-0-15rem);
  }
  /* The one appearance whose pointer feedback is NOT a fill: a link has zero chrome and zero
     padding, so the shared hover/press background would paint a tight rectangle around bare inline
     text -- the button-shaped box this appearance exists to avoid. It moves its text by the same
     two mix tokens instead. */
  :host([appearance="link"])
    [part~="base"]:not(:disabled, [aria-disabled="true"]):hover {
    background: transparent;
    color: color-mix(
      in oklab,
      var(--lr-button-accent, var(--_lr-button-accent)),
      var(--lr-color-mix-partner) var(--lr-color-mix-hover)
    );
  }
  :host([appearance="link"])
    [part~="base"]:not(:disabled, [aria-disabled="true"]):active {
    background: transparent;
    color: color-mix(
      in oklab,
      var(--lr-button-accent, var(--_lr-button-accent)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part="spinner"] {
    display: inline-flex;
    position: absolute;
    inset: 0;
    align-items: center;
    justify-content: center;
    animation: lr-button-spin
      var(--lr-button-spinner-duration, var(--lr-transition-ambient)) infinite;
  }
  :host([loading]) [part~="start"],
  :host([loading]) [part="label"],
  :host([loading]) [part~="end"],
  :host([loading]) [part="caret"] {
    opacity: 0;
  }
  @keyframes lr-button-spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    [part="spinner"] {
      animation-duration: 0.001ms;
      animation-iteration-count: 1;
    }
  }
`;
