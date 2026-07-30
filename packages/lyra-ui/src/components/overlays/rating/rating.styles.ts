import { css } from 'lit';

export const styles = css`
  :host { display: inline-block; color: var(--lr-color-warning); }
  [part='base'] { display: inline-flex; align-items: center; gap: var(--lr-space-xs); min-inline-size: var(--lr-icon-button-size); min-block-size: var(--lr-icon-button-size); }
  /* Pointer cursor only while the rating is actually settable -- a readonly or disabled rating is
     not editable via click/drag, so an unconditional cursor: pointer here would misleadingly cue
     an interaction that setValue() (rating.class.ts) refuses to apply. */
  :host(:not([readonly]):not([disabled])) [part='base'] { cursor: pointer; }
  [part='base']:focus-visible { outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: var(--lr-focus-ring-offset); }
  /* Gives mouse users the same 'this is interactive' cue the :focus-visible outline above already
     gives keyboard users -- mirrors lr-checkbox's/lr-radio's [part='base']:hover pattern, gated via
     :host(:not([readonly]):not([disabled])) (matching the pointer-cursor rule above -- a readonly
     rating is still focusable, see rating.class.ts's tabindex, but neither settable nor "hoverable"
     as an affordance) rather than a same-selector [part='star']:hover:not(:disabled) (which would
     exceed a consumer's ::part(star):hover specificity). */
  :host(:not([readonly]):not([disabled])) [part='base']:hover [part='star'] { color: var(--lr-rating-empty-color, var(--lr-color-border-strong)); }
  [part='star'] { position: relative; display: inline-flex; color: var(--lr-rating-empty-color, var(--lr-color-border)); font-size: var(--lr-rating-size, var(--lr-font-size-xl)); line-height: var(--lr-line-height-none); }
  [part='star'] svg { display: block; }
  [part='star-fill'] { position: absolute; inset-block-start: 0; inset-inline-start: 0; block-size: 100%; overflow: hidden; color: var(--lr-rating-fill, var(--lr-color-warning)); }
  :host([disabled]) [part='base'] { cursor: not-allowed; opacity: var(--lr-opacity-disabled); }
  :host([readonly]) [part='base'] { cursor: default; }
`;
