import { css } from "lit";
import { formControlRequiredMarker } from "../../../internal/form-control.styles.js";

export const styles = css`
  ${formControlRequiredMarker}

  :host {
    display: block;
    /* Every per-tier value below comes from the library's one shared size ladder
       (internal/sizes.styles.ts), which re-points --lr-form-control-* per :host([size='...']) and
       matches BOTH spellings of every tier in the same selector list -- so small/medium/large work
       here for free. This component's own --lr-known-date-field-* surface is unchanged and still
       the documented override point; only the values behind it moved, which is what keeps a
       birthdate field the same height as the <lr-input>/<lr-date-input> beside it in a form row at
       every tier instead of drifting from a hand-kept copy of that scale. */
    --_lr-known-date-field-padding-block: var(--lr-form-control-padding-block);
    --_lr-known-date-field-padding-inline: var(
      --lr-form-control-padding-inline
    );
    --_lr-known-date-field-font-size: var(--lr-form-control-font-size);
    /* Not --lr-form-control-gap: that knob is the rhythm between one control's own inline
       affordances, an order of magnitude tighter than the gap between three separate field
       blocks. Constant across tiers by design. */
    --_lr-known-date-field-gap: var(--lr-space-s);
    --_lr-known-date-year-field-width: var(--lr-size-5em);
    --_lr-known-date-day-field-width: var(--lr-size-3-5em);
    --_lr-known-date-month-field-width: var(--lr-size-3-5em);
    /* max() rather than the bare ladder height: the ladder's 2xs tier resolves to 1.25rem/20px,
       and a field a pointer has to hit floors at WCAG 2.2 SC 2.5.8's 24px minimum. Above that the
       floor tracks the ladder exactly. At the small tiers the floor exceeds the field's own
       padding/font-driven content height and actively pins the rendered box; at l/xl the content
       height stays under it, so the floor is inert there. */
    --_lr-known-date-field-min-height: max(
      var(--lr-form-control-height),
      var(--lr-size-24px)
    );
    /* --lr-known-date-field-height is intentionally NOT declared here. It is a consumer-facing
       exact-height escape hatch consumed only through the var() fallbacks on [part='field-input']
       below; declaring any value for it (even 'auto') would make those fallback arms unreachable
       and turn --lr-known-date-field-min-height into dead code (the lr-select trap). Left
       undeclared, both arms stay live: the per-tier floor falls out of the fallback, and setting
       the property pins an exact height. */
  }

  [part~="form-control"] {
    min-inline-size: 0;
  }

  :host([appearance="filled"]) [part="field-input"] {
    border-color: transparent;
    background: var(--lr-color-surface-raised);
  }
  :host([appearance="filled-outlined"]) [part="field-input"] {
    background: var(--lr-color-surface-raised);
  }
  :host([pill]) [part="field-input"] {
    border-radius: var(--lr-radius-pill);
  }

  [part="fieldset"] {
    margin: 0;
    padding: 0;
    border: none;
    min-inline-size: 0;
  }

  [part="legend"] {
    display: block;
    padding: 0;
    margin-block-end: var(--lr-space-xs);
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-md-sm);
    font-weight: var(--lr-font-weight-semibold);
    overflow-wrap: anywhere;
  }
  /* [part] always contains a literal <slot> child regardless of assigned
     content, so :empty never matches -- real emptiness is tracked in JS
     (hasLabelSlot) and reflected via [hidden] instead (same fix as every
     other lyra form control's label/hint/error chrome). Without this the
     required marker below (attached to this box) would render a stray glyph
     with nothing before it whenever no label is set. */
  [part="legend"][hidden] {
    display: none;
  }
  [part~="fields"] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-known-date-field-gap, var(--_lr-known-date-field-gap));
  }

  [part~="field"] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-2xs);
    min-inline-size: 0;
  }

  [part="field-label"] {
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
    overflow-wrap: anywhere;
  }

  [part="field-input"] {
    box-sizing: border-box;
    min-block-size: var(
      --lr-known-date-field-height,
      var(
        --lr-known-date-field-min-height,
        var(--_lr-known-date-field-min-height)
      )
    );
    /* Pinned only when --lr-known-date-field-height is set; 'auto' otherwise, so the field keeps
       growing to fit its own padding/font content. */
    block-size: var(--lr-known-date-field-height, auto);
    padding-block: var(
      --lr-known-date-field-padding-block,
      var(--_lr-known-date-field-padding-block)
    );
    padding-inline: var(
      --lr-known-date-field-padding-inline,
      var(--_lr-known-date-field-padding-inline)
    );
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-form-control-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font-family: inherit;
    font-size: var(
      --lr-known-date-field-font-size,
      var(--_lr-known-date-field-font-size)
    );
    text-align: center;
  }
  [part~="field"][data-field="day"] [part="field-input"] {
    inline-size: var(
      --lr-known-date-day-field-width,
      var(--_lr-known-date-day-field-width)
    );
  }
  [part~="field"][data-field="month"] [part="field-input"] {
    inline-size: var(
      --lr-known-date-month-field-width,
      var(--_lr-known-date-month-field-width)
    );
  }
  [part~="field"][data-field="year"] [part="field-input"] {
    inline-size: var(
      --lr-known-date-year-field-width,
      var(--_lr-known-date-year-field-width)
    );
  }
  /* Mouse-hover parity with the keyboard :focus-visible ring below -- same border-retint
     treatment as lr-color-picker's own bordered [part='input']:hover.
     no-pressed-state: a press on a number field lands the caret rather than activating a control,
     so a pressed tint would show only for the length of the mousedown and then be replaced by the
     :focus-visible ring below, which is the state that actually persists and communicates. */
  [part="field-input"]:hover {
    border-color: var(--lr-color-brand);
  }
  [part="field-input"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* --lr-known-date-invalid-border-color indirection (rather than the bare --lr-color-danger
     token) lets a consumer retheme just this component's invalid-field border without
     repainting every other component in the app that reads the same shared danger token. */
  :host([data-invalid]) [part="field-input"] {
    border-color: var(
      --lr-known-date-invalid-border-color,
      var(--lr-color-danger)
    );
  }
  [part="field-input"]:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }

  [part="hint"] {
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
    overflow-wrap: anywhere;
  }
  [part="hint"][hidden] {
    display: none;
  }
  [part="error"] {
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-danger);
    overflow-wrap: anywhere;
  }
  [part="error"][hidden] {
    display: none;
  }
`;
