import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    /* A host width is meaningful for the public component, so the native
       button follows it. The variable keeps the contract opt-out-able for
       compact inline compositions. */
    --lr-button-width: 100%;
    /* The whole size scale now comes from the shared form-control ladder (internal/sizes.styles.ts,
       pulled in ahead of this sheet by button.class.ts), so a button and an lr-input/lr-select/
       lr-combobox/lr-date-input of the same tier are the same height BY CONSTRUCTION rather than by
       two hand-maintained lists agreeing -- which is exactly how they drifted apart before 8.0.0.
       These per-tier names survive as the button's own override points; only their values moved. */
    --lr-button-size-2xs: var(--lr-form-control-height-2xs);
    --lr-button-size-xs: var(--lr-form-control-height-xs);
    --lr-button-size-s: var(--lr-form-control-height-s);
    --lr-button-size-m: var(--lr-form-control-height-m);
    --lr-button-size-l: var(--lr-form-control-height-l);
    --lr-button-size-xl: var(--lr-form-control-height-xl);
    /* Geometry knobs, each pointed at the ladder's active-tier value. No per-tier rule declares a
       CSS property on [part~='base'], so a consumer can still retune a tier (e.g. pin a size="s"
       button into a compact toolbar row) without a ::part(base) rule. The ladder matches BOTH
       spellings of every tier in one selector list, so size="small" is size="s" for free. */
    --lr-button-padding-block: var(--lr-form-control-padding-block);
    --lr-button-padding-inline: var(--lr-form-control-padding-inline);
    --lr-button-font-size: var(--lr-form-control-font-size);
    --lr-button-min-height: var(--lr-button-size-m);
    --lr-button-gap: var(--lr-form-control-gap);
    --lr-button-radius: var(--lr-form-control-radius);
    /* Relative to the button's own font-size, so the with-caret chevron tracks every size tier
       without a per-tier rule -- same sizing stance as lr-attachment-trigger's expand-icon. */
    --lr-button-caret-size: var(--lr-size-0-75em);
    /* The nine generic colour slots below are re-pointed at the active variant's row of the
       semantic grid by internal/variants.styles.ts, so this component needs no :host([variant='…'])
       block of its own -- it carried five near-identical ones before 8.0.0.
       "filled" reads the QUIET tier and "accent" the LOUD one: they used to share the same loud
       token for every chromatic variant (rendering identically) while neutral's "filled" was the
       page surface, i.e. no fill at all. */
    --lr-button-accent: var(--lr-color-fill-loud);
    --lr-button-fill: var(--lr-color-fill-quiet);
    --lr-button-on-fill: var(--lr-color-on-quiet);
    --lr-button-border: var(--lr-color-border-normal);
    --lr-button-outlined-border: var(--lr-color-border-strong);
    /* Transparent by default (byte-identical to the previous hardcoded "background: transparent").
       Set it to tint an outlined button -- e.g. a faint surface wash behind the outline -- without
       reaching for a ::part(base) rule. Like --lr-button-quiet-*, it is deliberately NOT swapped
       per "variant": an outlined button's fill is a surface decision, not a semantic tone. */
    --lr-button-outlined-fill: transparent;
    --lr-button-quiet-border: var(--lr-color-border);
    --lr-button-quiet-text: var(--lr-color-text-quiet);
    --lr-button-accent-fill: var(--lr-color-fill-loud);
    --lr-button-accent-on-fill: var(--lr-color-on-loud);
    /* Hover and press feedback, as a colour MIX rather than the filter: brightness() multiplier
       this carried before 8.0.0. A filter multiplies every channel, so it lightened a dark button
       and darkened a light one only by luck, did nothing whatsoever to a pure white or pure black
       fill, and -- because filter applies to the whole subtree -- dimmed the label and the icons
       along with the box. Mixing toward --lr-color-mix-partner (which follows the text colour)
       always moves, and always in the direction the surface needs.
       --lr-button-hover-base is the colour the two mixes move AWAY from: the fill the active
       appearance actually paints. The chrome-less tiers (outlined, plain, quiet, link) paint no
       fill of their own, so they mix from the page surface they sit on -- quiet's hover used to BE
       var(--lr-color-surface), i.e. the page background itself, so hovering a quiet button on a
       default page changed nothing at all. A consumer who tints --lr-button-outlined-fill should
       point this at the same colour so the pair keeps moving together. */
    --lr-button-hover-base: var(--lr-color-surface);
    --lr-button-hover-background: color-mix(
      in oklab,
      var(--lr-button-hover-base),
      var(--lr-color-mix-partner) var(--lr-color-mix-hover)
    );
    --lr-button-active-background: color-mix(
      in oklab,
      var(--lr-button-hover-base),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  /* Each painted tier names its own fill as the mix base, so retuning --lr-button-fill or
     --lr-button-accent-fill retunes that tier's hover and press with it. */
  :host([appearance='filled']),
  :host([appearance='filled-outlined']) {
    --lr-button-hover-base: var(--lr-button-fill);
  }
  :host([appearance='accent']) {
    --lr-button-hover-base: var(--lr-button-accent-fill);
  }
  /* Shoelace's boolean outline surface is an additive alias. It never rewrites appearance, so
     removing it restores the exact Lyra treatment the author selected. */
  :host([outline]) {
    --lr-button-hover-base: var(--lr-color-surface);
  }
  /* The one place a variant still needs naming. The four chromatic variants use their loud fill as
     the chrome-less foreground -- brand text on the page surface IS the brand colour. Neutral's
     loud fill is a mid grey chosen to carry LIGHT text, so reusing it as dark-on-surface text would
     wash out every plain, outlined and link button and collapse the deliberate gap between
     appearance="plain" and appearance="quiet". Neutral keeps the body text colour instead. The
     :not([variant]) arm covers a host whose reflected attribute was removed by hand. */
  :host(:not([variant])),
  :host([variant='neutral']) {
    --lr-button-accent: var(--lr-color-text);
  }
  /* Fully rounded ends. Re-assigning the radius knob rather than declaring border-radius on
     [part~='base'] keeps one corner-radius declaration in the sheet, and leaves
     appearance="link"'s own literal "border-radius: 0" winning (a pill inline link would be a
     button-shaped box, which is exactly what that appearance exists to avoid). */
  :host([pill]) {
    --lr-button-radius: var(--lr-radius-pill);
  }
  :host([circle]) {
    --lr-button-radius: var(--lr-radius-pill);
  }
  [part~='base'] {
    display: inline-flex;
    position: relative;
    box-sizing: border-box;
    inline-size: var(--lr-button-width);
    min-inline-size: 0;
    max-inline-size: 100%;
    /* --lr-button-height is deliberately left UNDECLARED on :host, so both var()s below take their
       fallback arm: a floor at the active tier's --lr-button-min-height and an auto height --
       byte-identical to the behaviour before this property existed. Setting it (e.g. to pin the
       button to a fixed toolbar row height) both floors and caps the button. Declaring it as
       "auto" on :host would break exactly this: a declared "auto" is a *defined* value, so the
       fallback arm would never fire and every tier's floor would become dead code (lr-select
       documents its own instance of that trap in select.styles.ts). */
    min-block-size: var(--lr-button-height, var(--lr-button-min-height));
    block-size: var(--lr-button-height, auto);
    align-items: center;
    justify-content: center;
    gap: var(--lr-button-gap);
    padding-inline: var(--lr-button-padding-inline);
    padding-block: var(--lr-button-padding-block);
    border-radius: var(--lr-button-radius);
    border: var(--lr-border-width-thin) solid var(--lr-button-border);
    font: inherit;
    font-weight: var(--lr-font-weight-semibold);
    /* After the "font" shorthand, which would otherwise reset font-size back to the inherited one. */
    font-size: var(--lr-button-font-size);
    cursor: pointer;
    /* Undeclared by default (byte-identical to today's absent box-shadow); set it to add a
       drop shadow (e.g. an elevated/floating action button) without a ::part(base) rule. */
    box-shadow: var(--lr-button-shadow, none);
  }
  :host([appearance='filled']) [part~='base'] {
    background: var(--lr-button-fill);
    color: var(--lr-button-on-fill);
  }
  :host([appearance='accent']) [part~='base'] {
    background: var(--lr-button-accent-fill);
    color: var(--lr-button-accent-on-fill);
    border-color: var(--lr-button-accent-fill);
  }
  :host([appearance='outlined']) [part~='base'] {
    background: var(--lr-button-outlined-fill);
    color: var(--lr-button-accent);
    border-color: var(--lr-button-outlined-border);
  }
  :host([outline]) [part~='base'] {
    background: var(--lr-button-outlined-fill);
    color: var(--lr-button-accent);
    border-color: var(--lr-button-outlined-border);
  }
  /* The filled fill and foreground, but carrying the outlined tier's own border color instead of
     the variant-tinted --lr-button-border -- a filled button whose edge still reads against a
     same-toned surface. Both halves stay on their existing knobs, so retuning either tier retunes
     this one with it. */
  :host([appearance='filled-outlined']) [part~='base'] {
    background: var(--lr-button-fill);
    color: var(--lr-button-on-fill);
    border-color: var(--lr-button-outlined-border);
  }
  :host([appearance='plain']) [part~='base'] {
    background: transparent;
    color: var(--lr-button-accent);
    border-color: transparent;
  }
  :host([appearance='quiet']) [part~='base'] {
    background: transparent;
    color: var(--lr-button-quiet-text);
    border-color: var(--lr-button-quiet-border);
  }
  [part~='base']:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part~='base']:not(:disabled) {
    transition:
      background-color var(--lr-transition-fast),
      color var(--lr-transition-fast),
      transform var(--lr-transition-fast);
  }
  /* One hover and one press rule for every appearance -- what moves per tier is the mix BASE
     declared above, not the rule. Both out-specify each :host([appearance='…']) [part~='base']
     block, so no tier silently loses its pointer feedback. */
  [part~='base']:not(:disabled):hover {
    background: var(--lr-button-hover-background);
  }
  [part~='base']:not(:disabled):active {
    background: var(--lr-button-active-background);
    transform: scale(var(--lr-button-active-scale, 0.9875));
  }
  @media (prefers-reduced-motion: reduce) {
    [part~='base']:not(:disabled):active {
      transform: none;
    }
  }
  [part~='base']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part~='start'],
  [part~='end'] {
    display: inline-flex;
    flex: 0 1 40%;
    min-inline-size: 0;
    max-inline-size: 40%;
    align-items: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part='label'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* When the matching slot has no assigned content, button.class.ts stamps the hidden attribute
     on the wrapper (a bare slot is an element child, so the old :empty rule could never match).
     This higher-specificity selector wins over the display: inline-flex above so the empty
     wrapper collapses and stops contributing a dead --lr-button-gap of inline space -- mirrors
     input.styles.ts's identical [part='start'][hidden]/[part='end'][hidden] rule. */
  [part~='start'][hidden],
  [part~='end'][hidden] {
    display: none;
  }
  /* A declared circle and an automatically detected icon-only label both use a square control.
     circle additionally takes the pill radius above; an icon-only WA button keeps its selected
     appearance's ordinary radius. */
  :host([circle]) [part~='base'],
  [part~='base'][data-icon-button] {
    inline-size: var(--lr-button-height, var(--lr-button-min-height));
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    aspect-ratio: 1;
    padding-inline: var(--lr-button-padding-block);
  }
  /* Decorative dropdown chevron. The shared chevronIcon() points right, so the glyph -- not the
     wrapping part -- is rotated to point down, matching lr-select's expand-icon; a down caret is
     direction-neutral, so nothing here mirrors under RTL. */
  [part='caret'] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    font-size: var(--lr-button-caret-size);
  }
  [part='caret'] svg {
    transform: rotate(90deg);
  }
  /* Padding and font-size per tier come straight from the ladder (see the :host block above), so
     nothing here restates a scale. These five rules exist only so the button's own per-tier
     --lr-button-size-* names stay LIVE override points rather than becoming decorative aliases:
     deleting them would leave a documented custom property that silently does nothing, which is
     worse than removing it outright. Both spellings of each aliased tier are matched, exactly as
     the ladder does, so size="small" can never take the s tier's padding with the m tier's floor.
     The "m"/"medium" tier needs no rule -- :host already declares it. */
  :host([size='2xs']) {
    --lr-button-min-height: var(--lr-button-size-2xs);
  }
  :host([size='xs']) {
    --lr-button-min-height: var(--lr-button-size-xs);
  }
  :host([size='s']),
  :host([size='small']) {
    --lr-button-min-height: var(--lr-button-size-s);
  }
  :host([size='l']),
  :host([size='large']) {
    --lr-button-min-height: var(--lr-button-size-l);
  }
  :host([size='xl']) {
    --lr-button-min-height: var(--lr-button-size-xl);
  }
  /* A true inline-link appearance: zero chrome (no padding, border, radius, or min-height floor),
     underlined, colored from the same accent token "plain" uses, and inheriting the ambient font
     so it flows within surrounding text. Kept after the size rules -- and it must stay there: it
     resets padding/font with literals rather than the --lr-button-padding-* and
     --lr-button-font-size knobs, so it wins over any tier's (and any consumer's) geometry, and it
     zeroes both min-block-size and block-size so a pinned --lr-button-height cannot give an inline
     link a button-shaped box either. */
  :host([appearance='link']) [part~='base'] {
    inline-size: auto;
    padding: 0;
    border: 0;
    min-block-size: 0;
    block-size: auto;
    border-radius: 0;
    background: transparent;
    color: var(--lr-button-accent);
    font: inherit;
    text-decoration: underline;
    text-underline-offset: var(--lr-size-0-15rem);
  }
  /* The one appearance whose pointer feedback is NOT a fill. A link has zero chrome and zero
     padding, so the shared hover/press background would paint a tight rectangle around bare
     inline text in the middle of a paragraph -- exactly the button-shaped box this appearance
     exists to avoid. It moves its text by the same two mix tokens instead. */
  :host([appearance='link']) [part~='base']:not(:disabled):hover {
    background: transparent;
    color: color-mix(in oklab, var(--lr-button-accent), var(--lr-color-mix-partner) var(--lr-color-mix-hover));
  }
  :host([appearance='link']) [part~='base']:not(:disabled):active {
    background: transparent;
    color: color-mix(in oklab, var(--lr-button-accent), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='spinner'] {
    display: inline-flex;
    position: absolute;
    inset: 0;
    align-items: center;
    justify-content: center;
    animation: lr-button-spin var(--lr-button-spinner-duration, var(--lr-transition-ambient)) infinite;
  }
  :host([loading]) [part~='start'],
  :host([loading]) [part='label'],
  :host([loading]) [part~='end'],
  :host([loading]) [part='caret'] {
    opacity: 0;
  }
  @keyframes lr-button-spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    [part='spinner'] {
      animation-duration: 0.001ms;
      animation-iteration-count: 1;
    }
  }
`;
