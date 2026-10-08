import { visuallyHidden } from '../../../internal/a11y.js';
import { css } from 'lit';
import {
  formControlTextWrap,
  formControlChrome,
  formControlAppearance,
  formControlFocusHalo,
  formControlRequiredMarker,
} from '../../../internal/form-control.styles.js';

export const styles = css`
  :host {
    display: block;
    /* Unsized, the host follows its content even inside a stretched grid/flex item; an explicit
       host size gives the chain below a definite size to fill. The chain must continue through
       [part="form-control"], [part~="textarea-wrapper"] and [part="textarea"] below or the fill
       breaks at whichever one is missing it. */
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
    --_lr-textarea-fill: var(--_lr-form-control-fill);
    --_lr-textarea-border-color: var(--_lr-form-control-border-color);
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
    ${formControlAppearance}
  [part="form-control"] {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    /* Fills an explicitly sized host and is content-sized otherwise. flex-direction: column keeps
       the label/error/hint/footer at their natural size while [part~="textarea-wrapper"] below
       grows to fill whatever is left. */
    block-size: 100%;
  }
  ${formControlChrome}

  ${formControlRequiredMarker}
  /* A column flex box: the native resize grip writes inline width/height onto the <textarea>
     itself, so the wrapper imposes no size and lets the field drive it -- except for the block
     axis, continued from [part="form-control"] above so an explicitly sized host can reach the
     textarea itself. flex/min-block-size: 0 let this item shrink inside the
     form-control column instead of being floored at the textarea's own intrinsic content size. */
  [part~='textarea-wrapper'] {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-inline-size: 0;
    min-block-size: 0;
    block-size: 100%;
  }
  [part="textarea"] {
    display: block;
    /* Shrinkable inside the flex wrapper, so a resize="auto" height set inline by JS yields to a
       constraining parent instead of overflowing it. */
    flex: 0 1 auto;
    min-block-size: 0;
    inline-size: 100%;
    /* Continues the chain from [part~="textarea-wrapper"]; superseded by fitToContent()'s own
       inline style whenever resize="auto" is actively managing this element's height. The
       [data-auto-resize] max-block-size cap below is unaffected either way. */
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
  /* Brand edge plus the opt-in halo; :focus so a pointer focus reads too. */
  [part="textarea"]:focus {
    outline: none;
    border-color: var(--lr-textarea-focus-border-color, var(--lr-color-brand));
    ${formControlFocusHalo}
  }
  /* Pointer hover cue, gated on the host's own :disabled like lr-checkbox and lr-radio. */
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
    ${visuallyHidden}
    margin: var(--lr-size-neg-1px);
  }
  [part="form-control"],
  [part="form-control-label"],
  [part~="hint"],
  [part="error"],
  [part="footer"] {
    ${formControlTextWrap}
  }
`;
