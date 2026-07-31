import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    max-inline-size: 100%;
    /* The 'm' defaults exactly reproduce the original fixed badge treatment -- mirrors
       <lr-chip>'s identical --lr-chip-font-size/-padding-inline/-min-height trio so a consumer
       moving between the two sibling components finds the same size vocabulary. */
    --lr-badge-font-size: var(--lr-font-size-sm);
    --lr-badge-padding-inline: var(--lr-space-s);
    --lr-badge-min-height: var(--lr-size-1-25rem);
    /* Space between the start slot, the label and the end slot. Collapses to nothing on its own
       when a wrapper is empty, because the empty wrapper is display:none rather than zero-width. */
    --lr-badge-gap: var(--lr-space-2xs);
    /* Rounded rectangle by default; the pill treatment is opt-in through the 'pill' attribute
       below, matching the badge/tag shape vocabulary. Doesn't vary by size tier, so it's declared
       once here rather than re-assigned per :host([size='...']) block -- mirrors lr-button's
       identical --lr-button-radius. */
    --lr-badge-radius: var(--lr-radius);

    /* --- Palette: what the 'variant' axis chooses. -------------------------------------------
       Five semantic slots per variant, so the 'appearance' axis below can route them onto the
       surface without every (variant, appearance) pair needing its own rule. Neutral is the
       default set declared here: it is the only variant whose border color and text color differ
       (a plain bordered surface reading as "no signal"), which is why -edge and -ink are separate
       slots rather than one loud color. */
    --lr-badge-tint: var(--lr-color-surface);
    --lr-badge-solid: var(--lr-color-neutral);
    --lr-badge-edge: var(--lr-color-border);
    --lr-badge-ink: var(--lr-color-text);
    --lr-badge-on-solid: var(--lr-color-on-neutral);

    /* --- Surface: what the 'appearance' axis chooses from that palette. ----------------------
       Kept separate from the public --lr-badge-background/-border/-color trio so those three stay
       *undeclared* and therefore still inherit from a consumer's ancestor rule; they are consumed
       as the first arm of the var() fallbacks on [part='base'] below. The values here are the
       'filled-outlined' default, restated per appearance further down. */
    --lr-badge-fill: var(--lr-badge-tint);
    --lr-badge-stroke: var(--lr-badge-edge);
    --lr-badge-text: var(--lr-badge-ink);

    /* --- Attention: the opt-in attention-seeking animation. ----------------------------------
       Duration and easing are separate custom properties (not one compound transition token) so
       the 'animation' shorthand below expands to exactly one timing function. */
    --lr-badge-attention-duration: var(--lr-duration-ambient, 1.8s);
    --lr-badge-attention-easing: var(--lr-easing-emphasized, ease-in-out);
    --lr-badge-pulse-color: color-mix(in srgb, currentColor 40%, transparent);
    --lr-badge-pulse-spread: var(--lr-size-0-25rem);
    --lr-badge-bounce-distance: var(--lr-size-0-1875rem);
  }

  :host([pill]) {
    --lr-badge-radius: var(--lr-radius-pill);
  }

  [part='base'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-badge-gap);
    max-inline-size: 100%;
    min-block-size: var(--lr-badge-min-height);
    box-sizing: border-box;
    padding-inline: var(--lr-badge-padding-inline);
    border: var(--lr-border-width-thin) solid var(--lr-badge-border, var(--lr-badge-stroke));
    border-radius: var(--lr-badge-radius);
    background: var(--lr-badge-background, var(--lr-badge-fill));
    color: var(--lr-badge-color, var(--lr-badge-text));
    font-size: var(--lr-badge-font-size);
    font-weight: var(--lr-font-weight-medium);
    line-height: var(--lr-line-height-compact);
  }

  [part='start'],
  [part='end'] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
  }
  /* Defeats the display:inline-flex above -- the native [hidden] UA rule alone would lose to it at
     equal specificity. Same fix <lr-chip>'s identical [part='icon'][hidden] override applies. */
  [part='start'][hidden],
  [part='end'][hidden] {
    display: none;
  }
  [part='start'] ::slotted(*),
  [part='end'] ::slotted(*) {
    display: block;
  }

  /* The label truncates, not the whole surface: keeping overflow off [part='base'] lets the
     removable tag's oversized hit target overhang the compact pill without being clipped. */
  [part='content'] {
    flex: 0 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* --- variant: the palette ---------------------------------------------------------------- */
  :host([variant='brand']) {
    --lr-badge-tint: var(--lr-color-brand-quiet);
    --lr-badge-solid: var(--lr-color-brand);
    --lr-badge-edge: var(--lr-color-brand);
    --lr-badge-ink: var(--lr-color-brand);
    --lr-badge-on-solid: var(--lr-color-on-brand);
  }
  :host([variant='success']) {
    --lr-badge-tint: var(--lr-color-success-quiet);
    --lr-badge-solid: var(--lr-color-success);
    --lr-badge-edge: var(--lr-color-success);
    --lr-badge-ink: var(--lr-color-success);
    --lr-badge-on-solid: var(--lr-color-on-success);
  }
  :host([variant='warning']) {
    --lr-badge-tint: var(--lr-color-warning-quiet);
    --lr-badge-solid: var(--lr-color-warning);
    --lr-badge-edge: var(--lr-color-warning);
    --lr-badge-ink: var(--lr-color-warning);
    --lr-badge-on-solid: var(--lr-color-on-warning);
  }
  :host([variant='danger']) {
    --lr-badge-tint: var(--lr-color-danger-quiet);
    --lr-badge-solid: var(--lr-color-danger);
    --lr-badge-edge: var(--lr-color-danger);
    --lr-badge-ink: var(--lr-color-danger);
    --lr-badge-on-solid: var(--lr-color-on-danger);
  }

  /* --- appearance: palette to surface ------------------------------------------------------
     'transparent' rather than 'none' for the border-less appearances, so switching appearance
     never changes the badge's own layout box. */
  :host([appearance='filled-outlined']) {
    --lr-badge-fill: var(--lr-badge-tint);
    --lr-badge-stroke: var(--lr-badge-edge);
    --lr-badge-text: var(--lr-badge-ink);
  }
  :host([appearance='filled']) {
    --lr-badge-fill: var(--lr-badge-tint);
    --lr-badge-stroke: transparent;
    --lr-badge-text: var(--lr-badge-ink);
  }
  :host([appearance='outlined']) {
    --lr-badge-fill: transparent;
    --lr-badge-stroke: var(--lr-badge-edge);
    --lr-badge-text: var(--lr-badge-ink);
  }
  :host([appearance='accent']) {
    --lr-badge-fill: var(--lr-badge-solid);
    --lr-badge-stroke: var(--lr-badge-solid);
    --lr-badge-text: var(--lr-badge-on-solid);
  }
  :host([appearance='plain']) {
    --lr-badge-fill: transparent;
    --lr-badge-stroke: transparent;
    --lr-badge-text: var(--lr-badge-ink);
  }

  /* --- size --------------------------------------------------------------------------------- */
  :host([size='2xs']) {
    --lr-badge-font-size: var(--lr-font-size-2xs);
    --lr-badge-padding-inline: var(--lr-space-2xs);
    --lr-badge-min-height: var(--lr-size-0-9375rem);
  }
  :host([size='xs']) {
    --lr-badge-font-size: var(--lr-font-size-xs);
    --lr-badge-padding-inline: var(--lr-space-xs);
    --lr-badge-min-height: var(--lr-size-1rem);
  }
  :host([size='s']) {
    --lr-badge-font-size: var(--lr-font-size-xs);
    --lr-badge-padding-inline: var(--lr-size-0-375rem);
    --lr-badge-min-height: var(--lr-size-1-1rem);
  }
  :host([size='l']) {
    --lr-badge-font-size: var(--lr-font-size-m);
    --lr-badge-padding-inline: var(--lr-space-m);
    --lr-badge-min-height: var(--lr-size-1-5rem);
  }
  :host([size='xl']) {
    --lr-badge-font-size: var(--lr-font-size-lg);
    --lr-badge-padding-inline: var(--lr-space-l);
    --lr-badge-min-height: var(--lr-size-1-75rem);
  }

  /* --- attention ---------------------------------------------------------------------------- */
  :host([attention='pulse']) [part='base'] {
    animation: lr-badge-pulse var(--lr-badge-attention-duration) var(--lr-badge-attention-easing)
      infinite;
  }
  :host([attention='bounce']) [part='base'] {
    animation: lr-badge-bounce var(--lr-badge-attention-duration) var(--lr-badge-attention-easing)
      infinite;
  }

  @keyframes lr-badge-pulse {
    0% {
      box-shadow: 0 0 0 0 var(--lr-badge-pulse-color);
    }
    70% {
      box-shadow: 0 0 0 var(--lr-badge-pulse-spread) transparent;
    }
    100% {
      box-shadow: 0 0 0 0 transparent;
    }
  }

  /* Vertical, so it needs no logical-property mirroring: block-direction motion means the same
     thing under dir="rtl". */
  @keyframes lr-badge-bounce {
    0%,
    25%,
    55%,
    100% {
      transform: translateY(0);
    }
    40% {
      transform: translateY(calc(-1 * var(--lr-badge-bounce-distance)));
    }
  }

  /* The attention animations are decorative and infinite, so they stop outright rather than
     merely shortening. The shared token layer already clamps every animation's duration and
     iteration count under this query; naming animation itself keeps the badge provably still. */
  @media (prefers-reduced-motion: reduce) {
    [part='base'] {
      animation: none !important;
    }
  }
`;
