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
       --lyra-focus-ring-color from tokens.styles.ts) so a host can retheme the
       selection indicator independently of the :focus-visible outline and every
       other ring color in the library, while defaulting to the brand color. */
    --lyra-swatch-picker-selected-color: var(--lyra-color-brand);
    /* Blur radius of that same ring -- 0 by default (a crisp ring, today's look for every
       existing consumer). A host that wants a soft glow instead sets this to a real length
       (e.g. 0.4rem) rather than reaching for ::part(swatch)[aria-checked] from outside, which
       isn't reliably selectable: the CSS Shadow Parts spec only allows a fixed set of
       pseudo-classes after ::part(), not arbitrary attribute selectors, so that combinator can
       silently fail to match depending on the engine. */
    --lyra-swatch-picker-selected-blur: 0;
    /* Pulsing "shine" duration for the selected swatch -- 0s (the default) is a no-op (today's
       static look for every existing consumer, and unaffected by this token at all: a 0-duration
       animation resolves to its end state instantly and imperceptibly). A host sets a real
       duration (e.g. 1.6s) to make the selected swatch rhythmically brighten and settle back. A
       separate filter: brightness() animation (not box-shadow, which
       --lyra-swatch-picker-selected-blur above already owns) so the two compose freely without
       fighting over the same CSS property, and so this reads identically for a plain color circle
       and an icon swatch alike -- filter applies to the whole element including a slotted icon,
       with no icon-specific branching needed (unlike the box-shadow/drop-shadow split below, which
       needs one precisely because box-shadow doesn't reach into a transparent box's own content). */
    --lyra-swatch-picker-shine-duration: 0s;
  }
  [part='base'] {
    display: inline-flex;
    flex-wrap: wrap;
    min-inline-size: 0;
    gap: var(--lyra-space-xs);
  }
  [part='swatch'] {
    box-sizing: border-box;
    inline-size: var(--lyra-size-1-5rem);
    block-size: var(--lyra-size-1-5rem);
    padding: 0;
    border: var(--lyra-border-width-thin) solid var(--lyra-color-border);
    border-radius: 50%;
    /* Per-swatch fill from the option's color, set inline by swatch-picker.class.ts.
       Read through a var() (rather than an inline background-color declaration) so a
       consumer's ::part(swatch) background rule can still win when overriding it. */
    background-color: var(--lyra-swatch-color);
    /* Exposes the option's color to a slotted icon (part='swatch-icon') via currentColor,
       so a consumer's stroke="currentColor"/fill="currentColor" SVG is tinted automatically --
       inert when no icon is present. */
    color: var(--lyra-swatch-color);
    cursor: pointer;
    transition: transform var(--lyra-transition-fast);
  }
  /* An icon option renders its own shape instead of the plain filled circle, so drop the
     circle's fill/border and let the icon (tinted via currentColor above) stand on its own --
     matches how consumers hand-rolled a plain unfilled/unbordered icon button before this field
     existed. */
  [part='swatch']:has([part='swatch-icon']) {
    background-color: transparent;
    border-color: transparent;
  }
  [part='swatch-icon'] {
    display: flex;
    align-items: center;
    justify-content: center;
    inline-size: 100%;
    block-size: 100%;
  }
  [part='swatch']:hover {
    transform: scale(1.2);
  }
  [part='swatch']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  [part='swatch'][aria-checked='true'] {
    transform: scale(1.2);
    box-shadow: 0 0 var(--lyra-swatch-picker-selected-blur) var(--lyra-border-width-thick) var(--lyra-swatch-picker-selected-color);
    animation: lyra-swatch-picker-shine var(--lyra-swatch-picker-shine-duration) ease-in-out infinite;
  }
  @keyframes lyra-swatch-picker-shine {
    0%,
    100% {
      filter: brightness(1);
    }
    50% {
      filter: brightness(1.4);
    }
  }
  /* A plain color swatch is a filled circle, so the ring/glow above (drawn around the box)
     already hugs its true shape. An icon option's swatch box is transparent/unbordered (see
     above) and the icon rarely fills it edge-to-edge -- a box-shadow there would glow around an
     invisible circle instead of the icon's actual silhouette. Swap to a drop-shadow on the icon
     itself, which follows its real rendered shape, and suppress the box's own ring so the two
     don't double up. */
  [part='swatch'][aria-checked='true']:has([part='swatch-icon']) {
    box-shadow: none;
  }
  [part='swatch'][aria-checked='true'] [part='swatch-icon'] {
    filter: drop-shadow(0 0 var(--lyra-swatch-picker-selected-blur) var(--lyra-swatch-picker-selected-color));
  }
  /* The scale is redundant selection feedback (the ring already conveys it), so keep the
     transform but drop its easing under reduced-motion -- the swatch snaps rather than glides.
     The shine animation stops outright (a steady brightness, not a pulsing one) rather than
     merely losing its own easing, matching prefers-reduced-motion's intent for anything that
     loops -- a host that opted into --lyra-swatch-picker-shine-duration still gets a selected
     swatch, just without the rhythmic brightening. */
  @media (prefers-reduced-motion: reduce) {
    [part='swatch'] {
      transition: none;
    }
    [part='swatch'][aria-checked='true'] {
      animation: none;
    }
  }
`;
