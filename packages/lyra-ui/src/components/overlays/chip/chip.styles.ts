import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    max-inline-size: 100%;
    vertical-align: middle;
    /* One custom-property trio swapped by the single non-neutral rule below, rather than repeating
       background/color/border per part per variant -- the same -accent/-bg/-border trio
       lr-tool-call-chip and lr-attachment-chip use. These are the neutral values: neutral
       deliberately opts out of the semantic grid's own neutral row (see the class doc) and reads as
       a plain bordered surface. */
    --_lr-chip-accent: var(--lr-color-text);
    --_lr-chip-bg: var(--lr-color-surface);
    --_lr-chip-border: var(--lr-color-border);
    /* The medium defaults exactly reproduce the original fixed chip treatment. */
    --_lr-chip-font-size: var(--lr-font-size-sm);
    --_lr-chip-padding-block: var(--lr-size-0-25rem);
    --_lr-chip-padding-inline: var(--lr-space-s);
    --_lr-chip-gap: var(--lr-space-xs);
    --_lr-chip-icon-size: var(--lr-font-size-sm);
    /* Does not vary by size tier, so it is declared once here rather than per :host([size='...'])
       block -- lr-button's --lr-button-radius precedent. Consumed on both [part='base'] and
       [part='remove-button'] so a retuned corner shape stays consistent. The rounded rectangle is
       the default and the pill is opt-in via [pill] below, matching lr-badge/lr-tag: while this was
       unconditionally --lr-radius-pill, a pill attribute was indistinguishable from its absence. */
    --_lr-chip-radius: var(--lr-radius);
    /* Component density floor. Interactive controls also enforce the shared
       --lr-icon-button-size hit target; non-interactive display chips get no floor. */
    --_lr-chip-min-height: var(--lr-size-1-5rem);
    /* --lr-chip-height is deliberately undeclared: it is an exact-height escape hatch read only
       through the var() fallbacks on [part='base'] below, so declaring any value (even 'auto')
       would dead-arm them and turn --lr-chip-min-height into dead code. Undeclared, the per-tier
       floor falls out of the fallback and setting the property pins an exact height. */
  }

  :host([pill]) {
    --_lr-chip-radius: var(--lr-radius-pill);
  }

  :host([disabled]) {
    opacity: var(--lr-opacity-disabled);
  }

  :host([size='3xs']) {
    --_lr-chip-font-size: var(--lr-font-size-3xs);
    --_lr-chip-padding-block: 0;
    /* Below --lr-space-2xs, the space scale's own floor (still used by the 2xs tier) -- as 2xs's
       padding-block above already does, via a raw --lr-size token rather than --lr-space-2xs. */
    --_lr-chip-padding-inline: var(--lr-size-0-0625rem);
    --_lr-chip-gap: var(--lr-space-2xs);
    --_lr-chip-icon-size: var(--lr-font-size-3xs);
  }
  :host([size='2xs']) {
    --_lr-chip-font-size: var(--lr-font-size-2xs);
    --_lr-chip-padding-block: var(--lr-size-0-0625rem);
    --_lr-chip-padding-inline: var(--lr-space-2xs);
    --_lr-chip-gap: var(--lr-space-2xs);
    --_lr-chip-icon-size: var(--lr-font-size-2xs);
  }
  :host([size='xs']) {
    --_lr-chip-font-size: var(--lr-font-size-xs);
    --_lr-chip-padding-block: var(--lr-size-0-125rem);
    --_lr-chip-padding-inline: var(--lr-space-xs);
    --_lr-chip-gap: var(--lr-space-2xs);
    --_lr-chip-icon-size: var(--lr-font-size-xs);
  }
  /* 'small'/'large' are the Web Awesome/Shoelace spellings of these tiers, accepted verbatim by
     CHIP_SIZE (chip.class.ts) rather than normalised away, as sizes.styles.ts and
     contextual-vocabulary.styles.ts do. 'medium' needs no rule: it is the default already on :host,
     like the unaliased 'm'. */
  :host([size='s']),
  :host([size='small']) {
    --_lr-chip-font-size: var(--lr-font-size-xs);
    --_lr-chip-padding-block: var(--lr-size-0-125rem);
    --_lr-chip-padding-inline: var(--lr-size-0-375rem);
    --_lr-chip-gap: var(--lr-space-2xs);
    --_lr-chip-icon-size: var(--lr-font-size-xs);
  }
  :host([size='l']),
  :host([size='large']) {
    --_lr-chip-font-size: var(--lr-font-size-m);
    --_lr-chip-padding-block: var(--lr-size-0-375rem);
    --_lr-chip-padding-inline: var(--lr-space-m);
    --_lr-chip-gap: var(--lr-size-0-375rem);
    --_lr-chip-icon-size: var(--lr-font-size-m);
    --_lr-chip-min-height: var(--lr-size-1-75rem);
  }
  :host([size='xl']) {
    --_lr-chip-font-size: var(--lr-font-size-lg);
    --_lr-chip-padding-block: var(--lr-space-s);
    --_lr-chip-padding-inline: var(--lr-space-l);
    --_lr-chip-gap: var(--lr-space-s);
    --_lr-chip-icon-size: var(--lr-font-size-lg);
    --_lr-chip-min-height: var(--lr-size-2rem);
  }

  /* One rule for all four non-neutral variants: the shared variants sheet has already re-pointed
     --lr-color-fill-* at the active variant's row, so the chip reads generic slots and never names
     a variant. Neutral is excluded rather than mapped -- it keeps the plain bordered-surface "no
     signal" treatment on :host, not the grid's grey row. Matching [variant] as well as
     :not([variant='neutral']) keeps a host that has not yet reflected its default attribute on
     those neutral values. */
  :host([variant]:not([variant='neutral'])) {
    --_lr-chip-accent: var(--lr-color-fill-loud);
    --_lr-chip-bg: var(--lr-color-fill-quiet);
    --_lr-chip-border: transparent;
  }

  [part='base'] {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: var(--lr-chip-gap, var(--_lr-chip-gap));
    max-inline-size: 100%;
    box-sizing: border-box;
    padding: var(--lr-chip-padding-block, var(--_lr-chip-padding-block)) var(--lr-chip-padding-inline, var(--_lr-chip-padding-inline));
    border: var(--lr-border-width-thin) solid var(--lr-chip-border, var(--_lr-chip-border));
    border-radius: var(--lr-chip-radius, var(--_lr-chip-radius));
    background: var(--lr-chip-bg, var(--_lr-chip-bg));
    color: var(--lr-chip-accent, var(--_lr-chip-accent));
    font: inherit;
    font-size: var(--lr-chip-font-size, var(--_lr-chip-font-size));
    font-weight: var(--lr-font-weight-medium);
    line-height: var(--lr-line-height-snug);
    /* Pinned only when --lr-chip-height is set, 'auto' otherwise, so a display chip grows to fit
       its content. Interactive and non-interactive alike -- the interactive floor is on the
       toggleable-host rule below. */
    block-size: var(--lr-chip-height, auto);
  }

  :host(:where([toggleable], [removable])) [part='base'] {
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-chip-height, max(var(--lr-chip-min-height, var(--_lr-chip-min-height)), var(--lr-icon-button-size)));
  }
  :host([toggleable]:not([removable])) [part='base'] {
    -webkit-tap-highlight-color: transparent;
    transition: background-color var(--lr-transition-fast);
  }
  :host([toggleable]:not([removable]):not([disabled])) [part='base']:hover {
    background: color-mix(in srgb, var(--lr-chip-accent, var(--_lr-chip-accent)) 8%, var(--lr-chip-bg, var(--_lr-chip-bg)));
  }
  /* Pressed deepens the hover's accent wash to --lr-color-mix-active, roughly triple the hover's
     8%. The accent is the mix partner, not --lr-color-mix-partner: a non-neutral chip is a loud
     accent on a quiet fill, so the accent already IS this surface's contrast partner, while the
     shared partner follows the page text and would wash the hue out at the moment of the click.
     :active matches even though the button is [part='toggle-button'] stretched over the base, since
     :active applies to the activated element's ancestors too. */
  :host([toggleable]:not([removable]):not([disabled])) [part='base']:active {
    background: color-mix(in srgb, var(--lr-chip-accent, var(--_lr-chip-accent)) var(--lr-color-mix-active), var(--lr-chip-bg, var(--_lr-chip-bg)));
  }
  [part='toggle-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  :host([toggleable][selected]:not([removable])) [part='base'] {
    /* Falls back to --lr-chip-bg, so an unset consumer renders byte-identical. A distinct active
       tint independent of the resting background comes from setting --lr-chip-pressed-bg. */
    background: var(--lr-chip-pressed-bg, var(--lr-chip-bg, var(--_lr-chip-bg)));
    /* Falls back to --lr-chip-accent, so an unset consumer -- all four non-neutral variants
       included -- renders byte-identical. A per-item arbitrary color sets --lr-chip-pressed-border,
       leaving --lr-chip-accent, and so the label text color, untouched. */
    border-color: var(--lr-chip-pressed-border, var(--lr-chip-accent, var(--_lr-chip-accent)));
  }

  [part='start'] {
    display: inline-flex;
    flex: 0 1 auto;
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow: hidden;
    align-items: center;
    justify-content: center;
    font-size: var(--lr-chip-icon-size, var(--_lr-chip-icon-size));
  }
  [part='start'] ::slotted(*) {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  /* The display declaration above is author-origin, so it beats the UA's [hidden] { display: none }
     and a hidden slotted child would still paint a hit-testable box. Restated here, find-in-page
     carve-out included. */
  [part='start'] ::slotted([hidden]:not([hidden='until-found' i])) {
    display: none;
  }
  /* Defeats [part='start']'s display: inline-flex above -- the UA [hidden] rule alone loses at
     equal specificity. Same fix as lr-stat's slotted-adornment override. */
  [part='start'][hidden] {
    display: none;
  }

  [part='label'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  [part='end'] {
    display: inline-flex;
    flex: 0 1 auto;
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow: hidden;
    align-items: center;
    justify-content: center;
    font-size: var(--lr-chip-icon-size, var(--_lr-chip-icon-size));
  }
  [part='end'] ::slotted(*) {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  /* The display declaration above is author-origin, so it beats the UA's [hidden] { display: none }
     and a hidden slotted child would still paint a hit-testable box. Restated here, find-in-page
     carve-out included. */
  [part='end'] ::slotted([hidden]:not([hidden='until-found' i])) {
    display: none;
  }
  /* Defeats [part='end']'s display: inline-flex above -- the UA [hidden] rule alone loses at equal
     specificity. Same fix as [part='start'][hidden] above. */
  [part='end'][hidden] {
    display: none;
  }

  [part='toggle-button'] {
    position: absolute;
    inset: 0;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: 0;
    border: none;
    border-radius: var(--lr-chip-radius, var(--_lr-chip-radius));
    background: transparent;
    color: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  [part='toggle-button']:disabled {
    cursor: not-allowed;
  }

  /* Keeps the full target inside the chip's layout box: negative margins made compact or
     custom-height chips overlap adjacent controls, and could let the target escape its painted
     owner. */
  [part='remove-button'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    margin: 0;
    padding: 0;
    border: none;
    border-radius: var(--lr-chip-radius, var(--_lr-chip-radius));
    background: transparent;
    color: inherit;
    font-size: var(--lr-size-0-75em);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background-color var(--lr-transition-fast);
  }
  [part='remove-button']:not(:disabled):hover {
    background: color-mix(in srgb, currentColor 16%, transparent);
  }
  /* Pressed lays --lr-color-mix-active of currentColor over the hover's scrim, more than doubling
     the tint the hover produced. currentColor rather than --lr-color-mix-partner: this button sits
     INSIDE the pill, whose variant may have painted a loud fill beneath it, so the pill's own ink
     is the only colour guaranteed to contrast there, while --lr-color-mix-partner follows the PAGE
     text and would point the opposite way from the hover on a non-neutral chip. The hover value is
     restated rather than referenced because it is a literal here, not a public custom property
     (unlike lr-tag's --lr-tag-remove-hover-background). */
  [part='remove-button']:not(:disabled):active {
    background: color-mix(in srgb, currentColor var(--lr-color-mix-active), color-mix(in srgb, currentColor 16%, transparent));
  }
  [part='remove-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='remove-button']:disabled {
    cursor: not-allowed;
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
