import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    /* A host width is meaningful for the public component, so the native
       button follows it. The variable keeps the contract opt-out-able for
       compact inline compositions. */
    --lr-button-width: 100%;
    /* Matches lr-input/lr-select/lr-combobox's shared min-height scale tier-for-tier (2xs=1.25rem,
       xs=1.5rem, s=1.875rem, default m=2.5rem, l=3rem, xl=3.5rem) so a default-size lr-button sitting
       next to a default-size lr-input/lr-select/lr-combobox in the same toolbar row is the same
       height at every tier -- see input.styles.ts's identical :host([size='…']) scale. */
    --lr-button-size-2xs: var(--lr-size-1-25rem);
    --lr-button-size-xs: var(--lr-size-1-5rem);
    --lr-button-size-s: var(--lr-size-1-875rem);
    --lr-button-size-m: var(--lr-size-2-5rem);
    --lr-button-size-l: var(--lr-size-3rem);
    --lr-button-size-xl: var(--lr-size-3-5rem);
    /* Geometry knobs for the default ("m") tier. Every :host([size='…']) block below only
       re-assigns these four -- no per-tier rule declares a CSS property on [part='base'] -- so a
       consumer can retune a tier (e.g. pin a size="s" button into a compact toolbar row) without a
       ::part(base) rule, exactly as lr-input/lr-select/lr-combobox/lr-segmented/lr-date-input do.
       "size" reflects and defaults to 'm', so these :host declarations *are* the m tier; a
       :host([size='m']) block would only restate them. */
    --lr-button-padding-block: var(--lr-space-xs);
    --lr-button-padding-inline: var(--lr-space-m);
    --lr-button-font-size: var(--lr-font-size-m);
    --lr-button-min-height: var(--lr-button-size-m);
    /* Gap and radius don't vary by size tier (unlike the four knobs above), so each is declared
       once here rather than re-assigned per :host([size='…']) block. */
    --lr-button-gap: var(--lr-space-2xs);
    --lr-button-radius: var(--lr-radius);
    --lr-button-accent: var(--lr-color-text);
    --lr-button-fill: var(--lr-color-surface);
    --lr-button-on-fill: var(--lr-color-text);
    --lr-button-border: var(--lr-color-border);
    --lr-button-outlined-border: var(--lr-color-border-strong);
    /* Transparent by default (byte-identical to the previous hardcoded "background: transparent").
       Set it to tint an outlined button -- e.g. a faint surface wash behind the outline -- without
       reaching for a ::part(base) rule. Like --lr-button-quiet-*, it is deliberately NOT swapped
       per "variant": an outlined button's fill is a surface decision, not a semantic tone. */
    --lr-button-outlined-fill: transparent;
    --lr-button-quiet-border: var(--lr-color-border);
    --lr-button-quiet-text: var(--lr-color-text-quiet);
    /* appearance="accent"'s loud fill for the neutral variant -- every other variant's own
       --lr-button-fill/-on-fill (below) already reads its semantic loud Lyra token, so those
       variants' accent-fill/-on-fill blocks reuse it. Only neutral needs a dedicated loud fill. */
    --lr-button-accent-fill: var(--lr-color-neutral);
    --lr-button-accent-on-fill: var(--lr-color-on-neutral);
  }
  :host([variant='brand']) {
    --lr-button-accent: var(--lr-color-brand);
    --lr-button-fill: var(--lr-color-brand);
    --lr-button-on-fill: var(--lr-color-on-brand);
    --lr-button-border: var(--lr-color-brand);
    --lr-button-accent-fill: var(--lr-color-brand);
    --lr-button-accent-on-fill: var(--lr-color-on-brand);
  }
  :host([variant='success']) {
    --lr-button-accent: var(--lr-color-success);
    --lr-button-fill: var(--lr-color-success);
    --lr-button-on-fill: var(--lr-color-on-success);
    --lr-button-border: var(--lr-color-success);
    --lr-button-accent-fill: var(--lr-color-success);
    --lr-button-accent-on-fill: var(--lr-color-on-success);
  }
  :host([variant='warning']) {
    --lr-button-accent: var(--lr-color-warning);
    --lr-button-fill: var(--lr-color-warning);
    --lr-button-on-fill: var(--lr-color-on-warning);
    --lr-button-border: var(--lr-color-warning);
    --lr-button-accent-fill: var(--lr-color-warning);
    --lr-button-accent-on-fill: var(--lr-color-on-warning);
  }
  :host([variant='danger']) {
    --lr-button-accent: var(--lr-color-danger);
    --lr-button-fill: var(--lr-color-danger);
    --lr-button-on-fill: var(--lr-color-on-danger);
    --lr-button-border: var(--lr-color-danger);
    --lr-button-accent-fill: var(--lr-color-danger);
    --lr-button-accent-on-fill: var(--lr-color-on-danger);
  }
  [part='base'] {
    display: inline-flex;
    position: relative;
    inline-size: var(--lr-button-width);
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
  }
  :host([appearance='filled']) [part='base'] {
    background: var(--lr-button-fill);
    color: var(--lr-button-on-fill);
  }
  :host([appearance='accent']) [part='base'] {
    background: var(--lr-button-accent-fill);
    color: var(--lr-button-accent-on-fill);
    border-color: var(--lr-button-accent-fill);
  }
  :host([appearance='outlined']) [part='base'] {
    background: var(--lr-button-outlined-fill);
    color: var(--lr-button-accent);
    border-color: var(--lr-button-outlined-border);
  }
  :host([appearance='plain']) [part='base'] {
    background: transparent;
    color: var(--lr-button-accent);
    border-color: transparent;
  }
  :host([appearance='quiet']) [part='base'] {
    background: transparent;
    color: var(--lr-button-quiet-text);
    border-color: var(--lr-button-quiet-border);
  }
  :host([appearance='quiet']) [part='base']:not(:disabled):hover {
    background: var(--lr-color-surface);
  }
  [part='base']:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part='base']:not(:disabled) {
    transition: filter var(--lr-transition-fast), transform var(--lr-transition-fast);
  }
  [part='base']:not(:disabled):hover {
    filter: brightness(var(--lr-button-hover-brightness, 1.08));
  }
  [part='base']:not(:disabled):active {
    transform: scale(var(--lr-button-active-scale, 0.9875));
  }
  @media (prefers-reduced-motion: reduce) {
    [part='base']:not(:disabled):active {
      transform: none;
    }
  }
  [part='base']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='start'],
  [part='end'] {
    display: inline-flex;
    align-items: center;
  }
  /* When the matching slot has no assigned content, button.class.ts stamps the hidden attribute
     on the wrapper (a bare slot is an element child, so the old :empty rule could never match).
     This higher-specificity selector wins over the display: inline-flex above so the empty
     wrapper collapses and stops contributing a dead --lr-button-gap of inline space -- mirrors
     input.styles.ts's identical [part='start'][hidden]/[part='end'][hidden] rule. */
  [part='start'][hidden],
  [part='end'][hidden] {
    display: none;
  }
  /* Per-tier geometry: cssprop re-assignment only. The "m" tier lives on :host above ("size"
     reflects and defaults to 'm', so :host always matches it). */
  :host([size='2xs']) {
    --lr-button-padding-block: var(--lr-space-2xs);
    --lr-button-padding-inline: var(--lr-space-2xs);
    --lr-button-font-size: var(--lr-font-size-2xs);
    --lr-button-min-height: var(--lr-button-size-2xs);
  }
  :host([size='xs']) {
    --lr-button-padding-block: var(--lr-space-2xs);
    --lr-button-padding-inline: var(--lr-space-xs);
    --lr-button-font-size: var(--lr-font-size-xs);
    --lr-button-min-height: var(--lr-button-size-xs);
  }
  :host([size='s']) {
    --lr-button-padding-block: var(--lr-space-2xs);
    --lr-button-padding-inline: var(--lr-space-s);
    --lr-button-font-size: var(--lr-font-size-sm);
    --lr-button-min-height: var(--lr-button-size-s);
  }
  :host([size='l']) {
    --lr-button-padding-block: var(--lr-space-s);
    --lr-button-padding-inline: var(--lr-space-l);
    --lr-button-font-size: var(--lr-font-size-md);
    --lr-button-min-height: var(--lr-button-size-l);
  }
  :host([size='xl']) {
    --lr-button-padding-block: var(--lr-space-m);
    --lr-button-padding-inline: var(--lr-space-2xl);
    --lr-button-font-size: var(--lr-font-size-lg);
    --lr-button-min-height: var(--lr-button-size-xl);
  }
  /* A true inline-link appearance: zero chrome (no padding, border, radius, or min-height floor),
     underlined, colored from the same accent token "plain" uses, and inheriting the ambient font
     so it flows within surrounding text. Kept after the size rules -- and it must stay there: it
     resets padding/font with literals rather than the --lr-button-padding-* and
     --lr-button-font-size knobs, so it wins over any tier's (and any consumer's) geometry, and it
     zeroes both min-block-size and block-size so a pinned --lr-button-height cannot give an inline
     link a button-shaped box either. */
  :host([appearance='link']) [part='base'] {
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
  [part='spinner'] {
    display: inline-flex;
    position: absolute;
    inset: 0;
    align-items: center;
    justify-content: center;
    animation: lr-button-spin var(--lr-button-spinner-duration, 1s) linear infinite;
  }
  :host([loading]) [part='start'],
  :host([loading]) [part='label'],
  :host([loading]) [part='end'] {
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
