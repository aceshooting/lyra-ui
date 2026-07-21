import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    /* Lets the host shrink below its row's max-content width when it's a flex/grid
       item in a consumer's own narrow layout -- the default min-width:auto for flex
       items would otherwise force the row wide regardless of [part='base']'s
       flex-wrap below. */
    min-inline-size: 0;
    /* Ring drawn around the selected swatch. A dedicated token (rather than reusing
       --lr-focus-ring-color from tokens.styles.ts) so a host can retheme the
       selection indicator independently of the :focus-visible outline and every
       other ring color in the library, while defaulting to the brand color. */
    --lr-swatch-picker-selected-color: var(--lr-color-brand);
    /* Blur radius of that same ring -- 0 by default (a crisp ring, today's look for every
       existing consumer). A host that wants a soft glow instead sets this to a real length
       (e.g. 0.4rem) rather than reaching for ::part(swatch)[aria-checked] from outside, which
       isn't reliably selectable: the CSS Shadow Parts spec only allows a fixed set of
       pseudo-classes after ::part(), not arbitrary attribute selectors, so that combinator can
       silently fail to match depending on the engine. */
    --lr-swatch-picker-selected-blur: 0;
    /* Pulsing "shine" duration for the selected swatch -- 0s (the default) is a no-op (today's
       static look for every existing consumer, and unaffected by this token at all: a 0-duration
       animation resolves to its end state instantly and imperceptibly). A host sets a real
       duration (e.g. 1.6s) to make the selected swatch rhythmically brighten and settle back. A
       separate filter: brightness() animation (not box-shadow, which
       --lr-swatch-picker-selected-blur above already owns) so the two compose freely without
       fighting over the same CSS property, and so this reads identically for a plain color circle
       and an icon swatch alike -- filter applies to the whole element including a slotted icon,
       with no icon-specific branching needed (unlike the box-shadow/drop-shadow split below, which
       needs one precisely because box-shadow doesn't reach into a transparent box's own content). */
    --lr-swatch-picker-shine-duration: 0s;
    --lr-swatch-picker-hit-size: var(--lr-size-2-5rem);
    --lr-swatch-picker-fill-size: var(--lr-size-1-5rem);
  }
  :host([size='2xs']) {
    --lr-swatch-picker-hit-size: var(--lr-size-1-5rem);
    --lr-swatch-picker-fill-size: var(--lr-size-0-75rem);
  }
  :host([size='xs']) {
    --lr-swatch-picker-hit-size: var(--lr-size-1-75rem);
    --lr-swatch-picker-fill-size: var(--lr-size-1rem);
  }
  :host([size='s']) {
    --lr-swatch-picker-hit-size: var(--lr-size-2rem);
    --lr-swatch-picker-fill-size: var(--lr-size-1-25rem);
  }
  :host([size='l']) {
    --lr-swatch-picker-hit-size: var(--lr-size-3rem);
    --lr-swatch-picker-fill-size: var(--lr-size-1-75rem);
  }
  :host([size='xl']) {
    --lr-swatch-picker-hit-size: var(--lr-size-3-5rem);
    --lr-swatch-picker-fill-size: var(--lr-size-2rem);
  }
  [part='base'] {
    display: inline-flex;
    flex-wrap: wrap;
    min-inline-size: 0;
    gap: var(--lr-space-xs);
  }
  [part='swatch'] {
    box-sizing: border-box;
    /* The interactive hit target is sized via the component-scoped --lr-swatch-picker-hit-size
       (default --lr-size-2-5rem, swapped per size tier below, floored at 24px for WCAG 2.5.8),
       while the *visible* fill is sized independently via --lr-swatch-picker-fill-size (default
       --lr-size-1-5rem, also swapped per tier) -- rendered on the separate
       [part='swatch-fill']/[part='swatch-icon'] child below and centered via flex, not by resizing
       this button itself. A swatch's own fill/icon is what previously doubled as the clickable box;
       splitting them keeps the dense picker grid's visual density unchanged while still growing the
       real click/tap area. */
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-swatch-picker-hit-size);
    min-block-size: var(--lr-swatch-picker-hit-size);
    padding: 0;
    border: none;
    border-radius: 50%;
    background: none;
    /* Exposes the option's color to a slotted icon (part='swatch-icon') via currentColor -- inert
       when no icon is present, since [part='swatch-fill'] paints its own background-color instead. */
    color: var(--lr-swatch-color);
    cursor: pointer;
  }
  [part='swatch-fill'] {
    box-sizing: border-box;
    display: block;
    inline-size: var(--lr-swatch-picker-fill-size);
    block-size: var(--lr-swatch-picker-fill-size);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: 50%;
    /* Per-swatch fill from the option's color, set inline by swatch-picker.class.ts.
       Read through a var() (rather than an inline background-color declaration) so a
       consumer's ::part(swatch-fill) background rule can still win when overriding it. */
    background-color: var(--lr-swatch-color);
    transition: transform var(--lr-transition-fast);
  }
  [part='swatch-icon'] {
    display: flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--lr-swatch-picker-fill-size);
    block-size: var(--lr-swatch-picker-fill-size);
    transition: transform var(--lr-transition-fast);
  }
  [part='swatch']:hover [part='swatch-fill'],
  [part='swatch']:hover [part='swatch-icon'] {
    transform: scale(1.2);
  }
  [part='swatch']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='swatch'][aria-checked='true'] [part='swatch-fill'] {
    transform: scale(1.2);
    box-shadow: 0 0 var(--lr-swatch-picker-selected-blur) var(--lr-border-width-thick) var(--lr-swatch-picker-selected-color);
    animation: lr-swatch-picker-shine var(--lr-swatch-picker-shine-duration) ease-in-out infinite;
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
  /* An icon option renders its own shape instead of the plain filled circle, so the box-shadow ring
     above (drawn around [part='swatch-fill']'s true shape) doesn't apply to it at all -- render()
     only ever mounts one of [part='swatch-fill']/[part='swatch-icon'] per swatch (see
     swatch-picker.class.ts), so this selector and the one above never both match the same swatch.
     Swap to a drop-shadow on the icon itself, which follows its real rendered shape. */
  [part='swatch'][aria-checked='true'] [part='swatch-icon'] {
    transform: scale(1.2);
    filter: drop-shadow(0 0 var(--lr-swatch-picker-selected-blur) var(--lr-swatch-picker-selected-color));
  }
  /* The scale is redundant selection feedback (the ring already conveys it), so keep the
     transform but drop its easing under reduced-motion -- the swatch snaps rather than glides.
     The shine animation stops outright (a steady brightness, not a pulsing one) rather than
     merely losing its own easing, matching prefers-reduced-motion's intent for anything that
     loops -- a host that opted into --lr-swatch-picker-shine-duration still gets a selected
     swatch, just without the rhythmic brightening. */
  @media (prefers-reduced-motion: reduce) {
    [part='swatch-fill'],
    [part='swatch-icon'] {
      transition: none;
    }
    [part='swatch'][aria-checked='true'] [part='swatch-fill'] {
      animation: none;
    }
  }
`;
