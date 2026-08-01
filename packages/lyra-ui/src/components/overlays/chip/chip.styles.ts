import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    max-inline-size: 100%;
    vertical-align: middle;
    /* One custom-property trio swapped by the single non-neutral rule below,
       rather than repeating background/color/border per part per variant —
       mirrors lr-tool-call-chip's/lr-attachment-chip's identical
       -accent/-bg/-border trio so a chip's colour vocabulary reads the same
       everywhere in the library. These are the 'neutral' values: neutral
       deliberately opts out of the semantic grid's own neutral row (see the
       class doc) and reads as a plain bordered surface instead. */
    --lr-chip-accent: var(--lr-color-text);
    --lr-chip-bg: var(--lr-color-surface);
    --lr-chip-border: var(--lr-color-border);
    /* The medium defaults exactly reproduce the original fixed chip treatment. */
    --lr-chip-font-size: var(--lr-font-size-sm);
    --lr-chip-padding-block: var(--lr-size-0-25rem);
    --lr-chip-padding-inline: var(--lr-space-s);
    --lr-chip-gap: var(--lr-space-xs);
    --lr-chip-icon-size: var(--lr-font-size-sm);
    /* Doesn't vary by size tier, so it's declared once here rather than re-assigned per
       :host([size='…']) block -- same precedent as lr-button's --lr-button-radius. Consumed on
       both [part='base'] and [part='remove-button'] below so a consumer retuning the chip's
       corner shape gets a consistent remove-button corner too, not a mismatched one.
       The rounded rectangle is the default and the pill is opt-in via [pill] below, matching
       lr-badge/lr-tag: while this was unconditionally --lr-radius-pill, a 'pill' attribute would
       have been indistinguishable from its own absence. */
    --lr-chip-radius: var(--lr-radius);
    /* Component density floor. Interactive controls also enforce the shared
       --lr-icon-button-size hit target; non-interactive display chips get no floor. */
    --lr-chip-min-height: var(--lr-size-1-5rem);
    /* --lr-chip-height is intentionally NOT declared here. It is a consumer-facing exact-height
       escape hatch consumed only through the var() fallbacks on [part='base'] below; declaring
       any value for it (even 'auto') would make those fallback arms unreachable and turn
       --lr-chip-min-height into dead code. Left undeclared, both arms stay live: the per-tier
       floor falls out of the fallback, and setting the property pins an exact height. */
  }

  :host([pill]) {
    --lr-chip-radius: var(--lr-radius-pill);
  }

  :host([size='3xs']) {
    --lr-chip-font-size: var(--lr-font-size-3xs);
    --lr-chip-padding-block: 0;
    /* Below --lr-space-2xs (the space scale's own floor, still used by the 2xs tier) --
       same precedent as 2xs's own padding-block above, which already bottoms out below
       the space scale via a raw --lr-size-* token rather than reusing --lr-space-2xs. */
    --lr-chip-padding-inline: var(--lr-size-0-0625rem);
    --lr-chip-gap: var(--lr-space-2xs);
    --lr-chip-icon-size: var(--lr-font-size-3xs);
  }
  :host([size='2xs']) {
    --lr-chip-font-size: var(--lr-font-size-2xs);
    --lr-chip-padding-block: var(--lr-size-0-0625rem);
    --lr-chip-padding-inline: var(--lr-space-2xs);
    --lr-chip-gap: var(--lr-space-2xs);
    --lr-chip-icon-size: var(--lr-font-size-2xs);
  }
  :host([size='xs']) {
    --lr-chip-font-size: var(--lr-font-size-xs);
    --lr-chip-padding-block: var(--lr-size-0-125rem);
    --lr-chip-padding-inline: var(--lr-space-xs);
    --lr-chip-gap: var(--lr-space-2xs);
    --lr-chip-icon-size: var(--lr-font-size-xs);
  }
  :host([size='s']) {
    --lr-chip-font-size: var(--lr-font-size-xs);
    --lr-chip-padding-block: var(--lr-size-0-125rem);
    --lr-chip-padding-inline: var(--lr-size-0-375rem);
    --lr-chip-gap: var(--lr-space-2xs);
    --lr-chip-icon-size: var(--lr-font-size-xs);
  }
  :host([size='l']) {
    --lr-chip-font-size: var(--lr-font-size-m);
    --lr-chip-padding-block: var(--lr-size-0-375rem);
    --lr-chip-padding-inline: var(--lr-space-m);
    --lr-chip-gap: var(--lr-size-0-375rem);
    --lr-chip-icon-size: var(--lr-font-size-m);
    --lr-chip-min-height: var(--lr-size-1-75rem);
  }
  :host([size='xl']) {
    --lr-chip-font-size: var(--lr-font-size-lg);
    --lr-chip-padding-block: var(--lr-space-s);
    --lr-chip-padding-inline: var(--lr-space-l);
    --lr-chip-gap: var(--lr-space-s);
    --lr-chip-icon-size: var(--lr-font-size-lg);
    --lr-chip-min-height: var(--lr-size-2rem);
  }

  /* One rule for all four non-neutral variants, in place of the four near-identical blocks that
     stood here: the shared variants sheet has already re-pointed --lr-color-fill-* at the active
     variant's row of the semantic grid, so the chip reads generic slots and never names a variant.
     Neutral is excluded rather than mapped, because it keeps the plain bordered-surface "no
     signal" treatment declared on :host above instead of the grid's grey neutral row. Matching
     [variant] as well as :not([variant='neutral']) keeps a host that has not yet reflected its
     default attribute on the same neutral values. */
  :host([variant]:not([variant='neutral'])) {
    --lr-chip-accent: var(--lr-color-fill-loud);
    --lr-chip-bg: var(--lr-color-fill-quiet);
    --lr-chip-border: transparent;
  }

  [part='base'] {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: var(--lr-chip-gap);
    max-inline-size: 100%;
    box-sizing: border-box;
    padding: var(--lr-chip-padding-block) var(--lr-chip-padding-inline);
    border: var(--lr-border-width-thin) solid var(--lr-chip-border);
    border-radius: var(--lr-chip-radius);
    background: var(--lr-chip-bg);
    color: var(--lr-chip-accent);
    font: inherit;
    font-size: var(--lr-chip-font-size);
    font-weight: var(--lr-font-weight-medium);
    line-height: var(--lr-line-height-snug);
    /* Pinned only when --lr-chip-height is set; 'auto' otherwise, so a display chip keeps growing
       to fit its own content. Applies to interactive and non-interactive chips alike -- the
       interactive floor lives on the toggleable-host rule below. */
    block-size: var(--lr-chip-height, auto);
  }

  :host([toggleable]:not([removable])) [part='base'] {
    min-block-size: var(--lr-chip-height, max(var(--lr-chip-min-height), var(--lr-icon-button-size)));
    -webkit-tap-highlight-color: transparent;
    transition: background-color var(--lr-transition-fast);
  }
  :host([toggleable]:not([removable])) [part='base']:hover {
    background: color-mix(in srgb, var(--lr-chip-accent) 8%, var(--lr-chip-bg));
  }
  /* Pressed deepens the hover's own accent wash to the shared --lr-color-mix-active share --
     roughly triple the hover's 8%, so the press is unmistakably a step past it. The accent, not
     --lr-color-mix-partner, is the partner here: on every non-neutral variant the chip is a loud
     accent on a quiet fill, so the accent already IS this surface's contrast partner, while the
     shared partner follows the page text and would wash the variant's hue out at the exact moment
     of the click. :active matches here even though the actual button is [part='toggle-button']
     stretched over the base, because :active applies to the activated element's ancestors too. */
  :host([toggleable]:not([removable])) [part='base']:active {
    background: color-mix(in srgb, var(--lr-chip-accent) var(--lr-color-mix-active), var(--lr-chip-bg));
  }
  [part='toggle-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  :host([selected]:not([removable])) [part='base'] {
    /* Falls back to --lr-chip-bg (today's exact value) so every existing consumer renders
       byte-identical when unset. A consumer wanting a distinct "active" tint independent of the
       resting background sets --lr-chip-pressed-bg directly. */
    background: var(--lr-chip-pressed-bg, var(--lr-chip-bg));
    /* Falls back to --lr-chip-accent (today's exact value) so every
       existing consumer, including all four non-neutral variants, renders
       byte-identical when unset. A consumer with a per-item arbitrary
       color sets --lr-chip-pressed-border directly, leaving
       --lr-chip-accent (and therefore the label text color) untouched. */
    border-color: var(--lr-chip-pressed-border, var(--lr-chip-accent));
  }

  [part='icon'] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    font-size: var(--lr-chip-icon-size);
  }
  [part='icon'] ::slotted(*) {
    display: block;
  }
  /* Defeats [part='icon']'s own 'display: inline-flex' above -- the native
     [hidden] UA rule alone would lose to it at equal specificity. Same fix
     lr-stat's identical [part='icon'][hidden] override already applies. */
  [part='icon'][hidden] {
    display: none;
  }

  [part='label'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  [part='toggle-button'] {
    position: absolute;
    inset: 0;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: 0;
    border: none;
    border-radius: var(--lr-chip-radius);
    background: transparent;
    color: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  /* The interactive hit target meets the shared minimum tappable size (same --lr-icon-button-size
     floor as lr-swatch-picker's [part='swatch']/lr-token-input's [part='remove']), while the
     *visible* glyph stays a compact 0.75em × close icon -- a chip is a small horizontal pill, and
     growing the whole button box to 40px would visually balloon the row. Since the button sits at
     the pill's trailing edge with nothing after it, the extra hit-target growth is pulled back via
     a matching negative margin (rather than growing outward into the next chip in a wrapped row) so
     the *visible* pill footprint is unchanged -- the enlarged hit area simply overlaps into the
     pill's own padding/background rather than expanding the row's layout box. */
  [part='remove-button'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    margin-block: calc((var(--lr-icon-button-size) - var(--lr-size-1-25rem)) / -2);
    margin-inline-start: calc(var(--lr-size-1-25rem) - var(--lr-icon-button-size));
    margin-inline-end: 0;
    padding: 0;
    border: none;
    border-radius: var(--lr-chip-radius);
    background: transparent;
    color: inherit;
    font-size: var(--lr-size-0-75em);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background-color var(--lr-transition-fast);
  }
  [part='remove-button']:hover {
    background: color-mix(in srgb, currentColor 16%, transparent);
  }
  /* Pressed lays the shared --lr-color-mix-active share of currentColor over the hover's own
     scrim, which more than doubles the tint the hover produced -- a step past it, not a repeat.
     currentColor rather than --lr-color-mix-partner: this button sits INSIDE the pill, whose
     variant may have painted a loud fill beneath it, so the pill's own ink is the only colour
     guaranteed to contrast there, while --lr-color-mix-partner follows the PAGE text and would
     point the opposite way from the hover on a non-neutral chip. The hover value is restated
     rather than referenced because it is a literal here, not a public custom property (unlike
     <lr-tag>'s --lr-tag-remove-hover-background). */
  [part='remove-button']:active {
    background: color-mix(in srgb, currentColor var(--lr-color-mix-active), color-mix(in srgb, currentColor 16%, transparent));
  }
  [part='remove-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='remove-button'] svg {
    display: block;
  }

  @media (prefers-reduced-motion: reduce) {
    [part='remove-button'],
    [part='toggle-button'],
    :host([toggleable]:not([removable])) [part='base'] {
      transition: none !important;
    }
  }
`;
