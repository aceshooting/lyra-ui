import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    max-inline-size: 100%;
    /* The 'm' defaults exactly reproduce the original fixed badge treatment -- mirrors
       <lr-chip>'s identical --lr-chip-font-size/-padding-inline/-min-height trio so a consumer
       moving between the two sibling components finds the same size vocabulary. */
    --_lr-badge-font-size: var(--lr-font-size-sm);
    --_lr-badge-padding-inline: var(--lr-space-s);
    --_lr-badge-min-height: var(--lr-size-1-25rem);
    /* Space between the start slot, the label and the end slot. Collapses to nothing on its own
       when a wrapper is empty, because the empty wrapper is display:none rather than zero-width. */
    --_lr-badge-gap: var(--lr-space-2xs);
    /* Rounded rectangle by default; the pill treatment is opt-in through the 'pill' attribute
       below, matching the badge/tag shape vocabulary. Doesn't vary by size tier, so it's declared
       once here rather than re-assigned per effective-size block -- mirrors lr-button's
       identical --lr-button-radius. */
    --_lr-badge-radius: var(--lr-radius);

    /* --- Palette: what the 'variant' axis chooses. -------------------------------------------
       Five semantic slots per variant, so the 'appearance' axis below can route them onto the
       surface without every (variant, appearance) pair needing its own rule. Neutral is the
       default set declared here: it is the only variant whose border color and text color differ
       (a plain bordered surface reading as "no signal"), which is why -edge and -ink are separate
       slots rather than one loud color.
       -solid and -on-solid read the shared variants sheet's generic slots unconditionally, because
       neutral's own values there already ARE the grid's neutral row; only -tint, -edge and -ink
       need the non-neutral rule below. */
    --_lr-badge-tint: var(--lr-color-surface);
    --_lr-badge-solid: var(--lr-color-fill-loud);
    --_lr-badge-edge: var(--lr-color-border);
    --_lr-badge-ink: var(--lr-color-text);
    --_lr-badge-on-solid: var(--lr-color-on-loud);

    /* --- Surface: what the 'appearance' axis chooses from that palette. ----------------------
       Kept separate from the public --lr-badge-background/-border/-color trio so those three stay
       *undeclared* and therefore still inherit from a consumer's ancestor rule; they are consumed
       as the first arm of the var() fallbacks on [part~='base'] below. The values here are the
       'filled-outlined' default, restated per appearance further down. */
    --_lr-badge-fill: var(--lr-badge-tint, var(--_lr-badge-tint));
    --_lr-badge-stroke: var(--lr-badge-edge, var(--_lr-badge-edge));
    --_lr-badge-text: var(--lr-badge-ink, var(--_lr-badge-ink));

    /* --- Attention: the opt-in attention-seeking animation. ----------------------------------
       Duration and easing are separate custom properties (not one compound transition token) so
       the 'animation' shorthand below expands to exactly one timing function. */
    --_lr-badge-attention-duration: var(--lr-duration-ambient, 1.8s);
    --_lr-badge-attention-easing: var(--lr-easing-emphasized, ease-in-out);
    --_lr-badge-pulse-color: var(
      --pulse-color,
      color-mix(in srgb, currentColor 40%, transparent)
    );
    --_lr-badge-pulse-spread: var(--lr-size-0-25rem);
    --_lr-badge-bounce-distance: var(--lr-size-0-1875rem);
  }

  :host([pill]) {
    --_lr-badge-radius: var(--lr-radius-pill);
  }

  [part~='base'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-badge-gap, var(--_lr-badge-gap));
    max-inline-size: 100%;
    min-block-size: var(--lr-badge-min-height, var(--_lr-badge-min-height));
    box-sizing: border-box;
    padding-inline: var(--lr-badge-padding-inline, var(--_lr-badge-padding-inline));
    border: var(--lr-border-width-thin) solid var(--lr-badge-border, var(--lr-badge-stroke, var(--_lr-badge-stroke)));
    border-radius: var(--lr-badge-radius, var(--_lr-badge-radius));
    background: var(--lr-badge-background, var(--lr-badge-fill, var(--_lr-badge-fill)));
    color: var(--lr-badge-color, var(--lr-badge-text, var(--_lr-badge-text)));
    font-size: var(--lr-badge-font-size, var(--_lr-badge-font-size));
    font-weight: var(--lr-font-weight-medium);
    line-height: var(--lr-line-height-compact);
  }

  [part='start'],
  [part='end'] {
    display: inline-flex;
    flex: 0 1 auto;
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow: hidden;
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
    min-inline-size: 0;
    max-inline-size: 100%;
  }

  /* The label truncates, not the whole surface: keeping overflow off [part~='base'] lets the
     removable tag's oversized hit target overhang the compact pill without being clipped. */
  [part='content'] {
    flex: 0 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* --- variant: the palette ----------------------------------------------------------------
     One rule for all four non-neutral variants, in place of the four near-identical blocks that
     stood here: the shared variants sheet has already re-pointed --lr-color-fill-* at the active
     variant's row of the semantic grid, so the badge reads generic slots and never names a
     variant. Neutral is excluded rather than mapped, because it keeps the ambient
     surface/border/text "no signal" treatment declared on :host above instead of the grid's grey
     neutral row. Matching [variant] as well as :not([variant='neutral']) keeps a host that has not
     yet reflected its default attribute on the same neutral values. */
  :host([data-effective-variant]:not([data-effective-variant='neutral'])) {
    --_lr-badge-tint: var(--lr-color-fill-quiet);
    --_lr-badge-edge: var(--lr-color-fill-loud);
    --_lr-badge-ink: var(--lr-color-fill-loud);
  }

  /* --- appearance: palette to surface ------------------------------------------------------
     'transparent' rather than 'none' for the border-less appearances, so switching appearance
     never changes the badge's own layout box. */
  :host([appearance='filled-outlined']) {
    --_lr-badge-fill: var(--lr-badge-tint, var(--_lr-badge-tint));
    --_lr-badge-stroke: var(--lr-badge-edge, var(--_lr-badge-edge));
    --_lr-badge-text: var(--lr-badge-ink, var(--_lr-badge-ink));
  }
  :host([appearance='filled']) {
    --_lr-badge-fill: var(--lr-badge-tint, var(--_lr-badge-tint));
    --_lr-badge-stroke: transparent;
    --_lr-badge-text: var(--lr-badge-ink, var(--_lr-badge-ink));
  }
  :host([appearance='outlined']) {
    --_lr-badge-fill: transparent;
    --_lr-badge-stroke: var(--lr-badge-edge, var(--_lr-badge-edge));
    --_lr-badge-text: var(--lr-badge-ink, var(--_lr-badge-ink));
  }
  :host([appearance='accent']) {
    --_lr-badge-fill: var(--lr-badge-solid, var(--_lr-badge-solid));
    --_lr-badge-stroke: var(--lr-badge-solid, var(--_lr-badge-solid));
    --_lr-badge-text: var(--lr-badge-on-solid, var(--_lr-badge-on-solid));
  }
  :host([appearance='plain']) {
    --_lr-badge-fill: transparent;
    --_lr-badge-stroke: transparent;
    --_lr-badge-text: var(--lr-badge-ink, var(--_lr-badge-ink));
  }

  /* --- size --------------------------------------------------------------------------------- */
  :host([data-effective-size='2xs']) {
    --_lr-badge-font-size: var(--lr-font-size-2xs);
    --_lr-badge-padding-inline: var(--lr-space-2xs);
    --_lr-badge-min-height: var(--lr-size-0-9375rem);
  }
  :host([data-effective-size='xs']) {
    --_lr-badge-font-size: var(--lr-font-size-xs);
    --_lr-badge-padding-inline: var(--lr-space-xs);
    --_lr-badge-min-height: var(--lr-size-1rem);
  }
  :host([data-effective-size='s']) {
    --_lr-badge-font-size: var(--lr-font-size-xs);
    --_lr-badge-padding-inline: var(--lr-size-0-375rem);
    --_lr-badge-min-height: var(--lr-size-1-1rem);
  }
  :host([data-effective-size='l']) {
    --_lr-badge-font-size: var(--lr-font-size-m);
    --_lr-badge-padding-inline: var(--lr-space-m);
    --_lr-badge-min-height: var(--lr-size-1-5rem);
  }
  :host([data-effective-size='xl']) {
    --_lr-badge-font-size: var(--lr-font-size-lg);
    --_lr-badge-padding-inline: var(--lr-space-l);
    --_lr-badge-min-height: var(--lr-size-1-75rem);
  }

  /* --- attention ---------------------------------------------------------------------------- */
  :host([pulse]:not([attention])) [part~='base'],
  :host([attention='pulse']) [part~='base'] {
    animation: lr-badge-pulse var(--lr-badge-attention-duration, var(--_lr-badge-attention-duration)) var(--lr-badge-attention-easing, var(--_lr-badge-attention-easing))
      infinite;
  }
  :host([attention='bounce']) [part~='base'] {
    animation: lr-badge-bounce var(--lr-badge-attention-duration, var(--_lr-badge-attention-duration)) var(--lr-badge-attention-easing, var(--_lr-badge-attention-easing))
      infinite;
  }

  @keyframes lr-badge-pulse {
    0% {
      box-shadow: 0 0 0 0 var(--lr-badge-pulse-color, var(--_lr-badge-pulse-color));
    }
    70% {
      box-shadow: 0 0 0 var(--lr-badge-pulse-spread, var(--_lr-badge-pulse-spread)) transparent;
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
      transform: translateY(calc(-1 * var(--lr-badge-bounce-distance, var(--_lr-badge-bounce-distance))));
    }
  }

  /* The attention animations are decorative and infinite, so they stop outright rather than
     merely shortening. The shared token layer already clamps every animation's duration and
     iteration count under this query; naming animation itself keeps the badge provably still. */
  @media (prefers-reduced-motion: reduce) {
    [part~='base'] {
      animation: none !important;
    }
  }
`;
