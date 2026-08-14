import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    color: var(--lr-color-warning);
    /* The 'm' step reproduces exactly the fixed symbol size this component had before the size
       property existed; every other step of the library's shared six-step ladder re-declares it
       below. Declared here (rather than left to a var() fallback at the use site) so an unset size
       and size="m" resolve identically. The steps are a type ramp rather than the shared
       --lr-form-control-* ladder: a rating has no control box to fit text inside, only glyphs
       whose size IS the control. */
    --lr-rating-size: var(--symbol-size, var(--lr-font-size-xl));
  }
  :host([data-effective-size='2xs']) { --lr-rating-size: var(--symbol-size, var(--lr-font-size-sm)); }
  :host([data-effective-size='xs']) { --lr-rating-size: var(--symbol-size, var(--lr-font-size-m)); }
  :host([data-effective-size='s']) { --lr-rating-size: var(--symbol-size, var(--lr-font-size-lg)); }
  :host([data-effective-size='m']) { --lr-rating-size: var(--symbol-size, var(--lr-font-size-xl)); }
  :host([data-effective-size='l']) { --lr-rating-size: var(--symbol-size, var(--lr-font-size-2xl)); }
  :host([data-effective-size='xl']) { --lr-rating-size: var(--symbol-size, var(--lr-font-size-3xl)); }
  /* justify-content pairs with the min-inline-size hit-area floor below: a low-max rating (a
     single star, say) is narrower than that floor, and the default justify-content
     (normal => flex-start) would push the stars against the leading edge of an otherwise
     centred control. A no-op once the stars already fill the floor. */
  [part~='base'] { display: inline-flex; justify-content: center; align-items: center; gap: var(--lr-rating-gap, var(--symbol-spacing, var(--lr-space-xs))); min-inline-size: var(--lr-icon-button-size); max-inline-size: 100%; min-block-size: var(--lr-icon-button-size); }
  /* Pointer cursor only while the rating is actually settable -- a readonly or disabled rating is
     not editable via click/drag, so an unconditional cursor: pointer here would misleadingly cue
     an interaction that setValue() (rating.class.ts) refuses to apply. :disabled rather than
     [disabled] because only the former also tracks an ancestor <fieldset disabled>, which
     formDisabledCallback() honours but never writes to the host's own attribute. */
  :host(:not(:disabled):not([readonly])) [part~='base'] { cursor: pointer; }
  :host(:focus-visible) [part~='base'] { outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: var(--lr-focus-ring-offset); }
  /* Gives mouse users the same 'this is interactive' cue the :focus-visible outline above already
     gives keyboard users -- mirrors lr-checkbox's/lr-radio's [part~='base']:hover pattern, gated via
     :host(:not(:disabled):not([readonly])) (matching the pointer-cursor rule above -- a readonly
     rating is still focusable, see rating.class.ts's tabindex, but neither settable nor "hoverable"
     as an affordance) rather than a same-selector [part='star']:hover:not(:disabled) (which would
     exceed a consumer's ::part(star):hover specificity). */
  :host(:not(:disabled):not([readonly])) [part~='base']:hover [part='star'] { color: var(--lr-rating-empty-color, var(--symbol-color, var(--lr-color-border-strong))); }
  /* Pressing commits a value, so the pressed cue is on the star the pointer is over rather than
     the whole row -- the row-wide hover cue says "settable", this says "this one". */
  :host(:not(:disabled):not([readonly])) [part~='base']:active [part='star'] { color: var(--lr-rating-active-color, color-mix(in oklab, var(--lr-rating-empty-color, var(--symbol-color, var(--lr-color-border-strong))), var(--lr-color-mix-partner) var(--lr-color-mix-active))); }
  [part='star'] { position: relative; display: inline-flex; flex: 1 1 var(--lr-rating-size); min-inline-size: 0; max-inline-size: var(--lr-rating-size); overflow: hidden; color: var(--lr-rating-empty-color, var(--symbol-color, var(--lr-color-border))); font-size: var(--lr-rating-size); line-height: var(--lr-line-height-none); }
  [part='star'] svg { display: block; max-inline-size: 100%; }
  [part='star'] [aria-hidden='true'] { display: inline-flex; inline-size: 100%; max-inline-size: 100%; overflow: hidden; }
  [part='star'] [aria-hidden='true'] > * { max-inline-size: 100%; }
  /* white-space keeps a consumer getSymbol() glyph at its natural width inside the percentage-wide
     overlay, so overflow: hidden clips it mid-symbol (the partial fill) instead of reflowing it. */
  [part='star-fill'] { position: absolute; inset-block-start: 0; inset-inline-start: 0; block-size: 100%; overflow: hidden; white-space: nowrap; color: var(--lr-rating-fill, var(--symbol-color-active, var(--lr-color-warning))); }
  :host(:disabled) [part~='base'] { cursor: not-allowed; opacity: var(--lr-opacity-disabled); }
  :host([readonly]) [part~='base'] { cursor: default; }
`;
