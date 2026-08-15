import { css } from "lit";
import { formControlRequiredMarker } from "../../../internal/form-control.styles.js";

export const styles = css`
  :host {
    display: block;
    --_lr-textarea-max-block-size: none;
    /* Geometry from the shared form-control ladder (internal/sizes.styles.ts, pulled in ahead of
       this sheet by textarea.class.ts), so this field's scale and lr-input's are the same scale
       rather than two copies. The ladder's INLINE gutter is used on all four sides on purpose: its
       block padding is 0 at the two tightest tiers because a control row's height floor supplies
       the space there, and a textarea has no floor -- the first line would sit on the border. */
    --_lr-textarea-padding: var(--lr-form-control-padding-inline);
    --_lr-textarea-font-size: var(--lr-form-control-font-size);
    --_lr-textarea-radius: var(--lr-form-control-radius);
    /* Fill/border pair swapped per appearance below; the mapped default is outlined. */
    --_lr-textarea-fill: transparent;
    --_lr-textarea-border-color: var(--lr-color-border);
  }
  /* Changes the private radius default rather than declaring border-radius on [part='textarea'],
     so that one consumption point below stays the only place a corner radius is read -- and an
     inherited or direct --lr-textarea-radius override remains authoritative. */
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
  [part="form-control-label"] {
    display: block;
    margin-block-end: var(--lr-space-xs);
    font-size: var(--lr-font-size-md-sm);
    font-weight: var(--lr-font-weight-semibold);
  }
  /* :empty never matches here -- the part always contains a literal slot child element regardless
     of assigned/text content -- so real emptiness is tracked in JS (hasLabelSlot) and reflected
     via the hidden attribute instead (same fix as lr-select's identical part). */
  [part="form-control-label"][hidden] {
    display: none;
  }
  ${formControlRequiredMarker}
  /* A plain block box around the native control: the native resize grip writes its own inline
     width/height onto the <textarea> itself, so the wrapper deliberately imposes no size of its
     own and lets the field drive it. */
  [part~='textarea-wrapper'] {
    display: block;
    min-inline-size: 0;
  }
  [part="textarea"] {
    display: block;
    inline-size: 100%;
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
  /* Gives mouse users the same 'this is interactive' cue the :focus-visible ring above already
     gives keyboard users -- mirrors lr-checkbox's/lr-radio's [part='base']:hover pattern, gated
     via :host(:not(:disabled)) rather than a same-selector [part='textarea']:hover:not(:disabled)
     (which would exceed a consumer's ::part(textarea):hover specificity -- see
     lr-attachment-trigger's :where() fix for that class of bug). */
  /* no-pressed-state: pressing inside a text surface places a caret, it does not actuate anything.
     The mousedown that would match :active is the same gesture that focuses the field, so a pressed
     treatment would render for one frame between the hover border and the focus ring and read as a
     flicker; focus is this control's real "you are acting on me" state. */
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
