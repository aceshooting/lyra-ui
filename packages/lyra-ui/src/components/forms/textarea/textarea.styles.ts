import { css } from 'lit';
import {
  formControlFocusHalo,
  formControlRequiredMarker,
} from '../../../internal/form-control.styles.js';

export const styles = css`
  :host {
    display: block;
    /* A percentage block-size against an auto-height ancestor resolves to auto, so this is a
       no-op for the content-sized default; it bites only once an ancestor gives this host a
       definite block size. The chain must continue through [part="form-control"],
       [part~="textarea-wrapper"] and [part="textarea"] below or the fill breaks at whichever one
       is missing it. */
    block-size: 100%;
    --_lr-textarea-max-block-size: none;
    /* Geometry from the shared form-control ladder (internal/sizes.styles.ts, loaded ahead of this
       sheet by textarea.class.ts), so this field and lr-input share one scale. Its INLINE gutter
       is used on all four sides: the ladder's block padding is 0 at the two tightest tiers, where
       a row's height floor supplies the space -- a textarea has no floor and the first line would
       sit on the border. */
    --_lr-textarea-padding: var(--lr-form-control-padding-inline);
    --_lr-textarea-font-size: var(--lr-form-control-font-size);
    --_lr-textarea-radius: var(--lr-form-control-radius);
    /* Fill/border pair swapped per appearance below; the mapped default is outlined. */
    --_lr-textarea-fill: transparent;
    --_lr-textarea-border-color: var(--lr-color-border);
    /* The shared field focus halo (internal/form-control.styles.ts). Only this private copy is
       declared; the PUBLIC name stays undeclared, so a value set on :root or any ancestor still
       reaches this field. */
    --_lr-form-control-focus-shadow: var(--lr-form-control-focus-shadow, none);
  }
  /* Changes the private radius default rather than declaring border-radius on [part='textarea'],
     keeping one consumption point below and leaving a --lr-textarea-radius override
     authoritative. */
  :host([pill]) {
    --_lr-textarea-radius: var(--lr-radius-pill);
  }
  :host([appearance="filled-outlined"]) {
    --_lr-textarea-fill: var(--lr-color-surface);
    --_lr-textarea-border-color: var(--lr-color-border);
  }
  :host([appearance="outlined"]) {
    --_lr-textarea-fill: transparent;
    --_lr-textarea-border-color: var(--lr-color-border);
  }
  :host([appearance="filled"]) {
    --_lr-textarea-fill: var(--lr-color-surface-raised);
    --_lr-textarea-border-color: transparent;
  }
  :host([filled]) {
    --_lr-textarea-fill: var(--lr-color-surface-raised);
    --_lr-textarea-border-color: transparent;
  }
  :host([appearance="plain"]) {
    --_lr-textarea-fill: transparent;
    --_lr-textarea-border-color: transparent;
  }
  /* Quiet brand tint as the fill, loud brand only on the border -- same reasoning as lr-input's
     accent tier: the user's own text has to stay legible on it. */
  :host([appearance="accent"]) {
    --_lr-textarea-fill: var(--lr-color-brand-quiet);
    --_lr-textarea-border-color: var(--lr-color-brand);
  }
  [part="form-control"] {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    /* Chain continued from :host -- a no-op until :host has a definite block size (see its own
       comment above). flex-direction: column keeps the label/error/hint/footer at their natural
       size while [part~="textarea-wrapper"] below grows to fill whatever is left. */
    block-size: 100%;
  }
  [part="form-control-label"] {
    display: block;
    margin-block-end: var(--lr-space-xs);
    font-size: var(--lr-font-size-md-sm);
    font-weight: var(--lr-font-weight-semibold);
  }
  /* :empty never matches -- the part always holds a literal slot child -- so emptiness is tracked
     in JS (hasLabelSlot) and reflected as the hidden attribute, as in lr-select. */
  [part="form-control-label"][hidden] {
    display: none;
  }
  ${formControlRequiredMarker}
  /* A plain block box: the native resize grip writes inline width/height onto the <textarea>
     itself, so the wrapper imposes no size and lets the field drive it -- except for the block
     axis, continued unconditionally from [part="form-control"] below so a definite-height host
     can reach the textarea itself. flex/min-block-size: 0 let this item shrink inside the
     form-control column instead of being floored at the textarea's own intrinsic content size. */
  [part~='textarea-wrapper'] {
    display: block;
    flex: 1 1 auto;
    min-inline-size: 0;
    min-block-size: 0;
    block-size: 100%;
  }
  [part="textarea"] {
    display: block;
    inline-size: 100%;
    /* Continues the chain from [part~="textarea-wrapper"] -- a no-op default (see :host's
       comment), and superseded by fitToContent()'s own inline style whenever resize="auto" is
       actively managing this element's height. The [data-auto-resize] max-block-size cap below is
       unaffected either way. */
    block-size: 100%;
    box-sizing: border-box;
    padding: var(--lr-textarea-padding, var(--_lr-textarea-padding));
    border: var(--lr-border-width-thin) solid
      var(--lr-textarea-border-color, var(--_lr-textarea-border-color));
    border-radius: var(--lr-textarea-radius, var(--_lr-textarea-radius));
    background: var(--lr-textarea-fill, var(--_lr-textarea-fill));
    color: var(--lr-color-text);
    font: inherit;
    font-size: var(--lr-textarea-font-size, var(--_lr-textarea-font-size));
    line-height: var(--lr-line-height-normal);
    /* Hover below only repaints border-color, so that is all this needs; without it this field's
       edge snaps while lr-button/lr-icon-button ease. */
    transition: border-color var(--lr-transition-fast);
  }
  [part="textarea"][data-auto-resize] {
    max-block-size: var(
      --lr-textarea-max-block-size,
      var(--_lr-textarea-max-block-size)
    );
  }
  [part="textarea"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* The opt-in focus halo, on :focus rather than :focus-visible: the outline above is the
     accessibility answer to KEYBOARD focus and is untouched, while a halo a consumer deliberately
     configured should read on a pointer focus too. Unset it resolves to none. The border-color
     alongside it is the sibling controls' focus-border hook (--lr-input-focus-border-color and
     friends), but its own unset fallback deliberately chains back to this field's OWN resting
     border -- var(--lr-textarea-border-color, var(--_lr-textarea-border-color)), the exact value
     [part='textarea'] above already paints -- rather than to --lr-color-brand the way those
     siblings do. Before this hook existed the border never repainted on focus at all, only the
     outline and halo did; chaining to the resting value keeps that unset rendering pixel-identical
     while still giving a consumer a named hook to change it. */
  [part="textarea"]:focus {
    border-color: var(
      --lr-textarea-focus-border-color,
      var(--lr-textarea-border-color, var(--_lr-textarea-border-color))
    );
    ${formControlFocusHalo}
  }
  /* The same 'this is interactive' cue the :focus-visible ring above gives keyboard users --
     mirrors lr-checkbox's and lr-radio's [part='base']:hover, gating on the host's own :disabled
     rather than the inner control's, so all three read the same way. */
  /* no-pressed-state: pressing inside a text surface places a caret, it actuates nothing. The
     mousedown matching :active is the same gesture that focuses the field, so a pressed treatment
     would flicker for one frame between the hover border and the focus ring; focus is this
     control's real acting-on-me state. */
  :host(:not(:disabled)) [part="textarea"]:hover {
    border-color: var(--lr-textarea-hover-border-color, var(--lr-color-brand));
  }
  [part="textarea"]:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part="textarea"]::placeholder {
    color: var(--lr-color-text-quiet);
  }
  [part~="hint"] {
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  [part~="hint"][hidden] {
    display: none;
  }
  [part="error"] {
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-danger);
  }
  [part="error"][hidden] {
    display: none;
  }
  [part="footer"] {
    display: flex;
    justify-content: flex-end;
    margin-block-start: var(--lr-space-xs);
  }
  [part="footer"][hidden] {
    display: none;
  }
  [part="count"] {
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  /* Inspection mirror only -- the visible [part='count'] carries the same text for sighted users,
     while the spoken copy is appended to the shared light-DOM polite sink. */
  .count-announcement {
    position: absolute;
    inline-size: var(--lr-size-1px);
    block-size: var(--lr-size-1px);
    padding: 0;
    margin: var(--lr-size-neg-1px);
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }
  [part="form-control"],
  [part="form-control-label"],
  [part~="hint"],
  [part="error"],
  [part="footer"] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
`;
