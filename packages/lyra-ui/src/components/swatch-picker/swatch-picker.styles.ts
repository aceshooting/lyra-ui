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
    /* Per-swatch fill from the option's `color`, set inline by swatch-picker.class.ts.
       Read through a var() (rather than an inline `background-color`) so a consumer's
       ::part(swatch) background rule can still win when they want to override it. */
    background-color: var(--lyra-swatch-color);
    cursor: pointer;
    transition: transform var(--lyra-transition-fast);
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
    box-shadow: 0 0 0 var(--lyra-border-width-thick) var(--lyra-swatch-picker-selected-color);
  }
  /* The scale is redundant selection feedback (the ring already conveys it), so keep the
     transform but drop its easing under reduced-motion -- the swatch snaps rather than glides. */
  @media (prefers-reduced-motion: reduce) {
    [part='swatch'] {
      transition: none;
    }
  }
`;
