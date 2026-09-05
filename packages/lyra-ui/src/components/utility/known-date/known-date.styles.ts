import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    /* Per-tier values come from the shared size ladder (internal/sizes.styles.ts), which re-points
       --lr-form-control-* per :host([size='...']) and matches BOTH tier spellings in one selector
       list, so small/medium/large work for free. --lr-known-date-field-* stays the documented
       override point; the ladder keeps this field the height of an adjacent
       <lr-input>/<lr-date-input> at every tier, not a hand-kept copy's. */
    --_lr-known-date-field-padding-block: var(--lr-form-control-padding-block);
    --_lr-known-date-field-padding-inline: var(
      --lr-form-control-padding-inline
    );
    --_lr-known-date-field-font-size: var(--lr-form-control-font-size);
    /* Not --lr-form-control-gap: that knob spaces one control's own inline affordances, an order of
       magnitude tighter than the gap between three separate field blocks. Constant across tiers by
       design. */
    --_lr-known-date-field-gap: var(--lr-space-s);
    /* Fill/border pair swapped per appearance, as lr-input/lr-textarea/lr-otp-input/lr-time-input
       do. Re-pointed on :host, not a :host([appearance='…']) [part='field-input'] rule: that form
       is (0,3,0), out-ranks [part='field-input']:hover at (0,2,0), and appearance="filled" then
       reinstated its transparent border over the hover brand one -- hover being border-only, filled
       fields lost pointer feedback entirely. No [part] rule out-ranks another, so re-pointing
       cannot; the deliberately stronger :host([data-invalid]) [part='field-input'] rule below does,
       as intended. */
    --_lr-known-date-field-fill: var(--lr-color-surface);
    --_lr-known-date-field-border-color: var(--lr-color-border);
    --_lr-known-date-year-field-width: var(--lr-size-5em);
    --_lr-known-date-day-field-width: var(--lr-size-3-5em);
    --_lr-known-date-month-field-width: var(--lr-size-3-5em);
    /* max() rather than the bare ladder height: the ladder's 2xs tier resolves to 1.25rem/20px, and
       a field a pointer has to hit floors at WCAG 2.2 SC 2.5.8's 24px minimum; above that the floor
       tracks the ladder exactly. At the small tiers it exceeds the padding/font-driven content
       height and pins the rendered box; at l/xl content height wins and the floor is inert. */
    --_lr-known-date-field-min-height: max(
      var(--lr-form-control-height),
      var(--lr-size-24px)
    );
    /* --lr-known-date-field-height is intentionally NOT declared here: it is a consumer-facing
       exact-height escape hatch read only through the var() fallbacks on [part='field-input']
       below, and declaring any value (even 'auto') would deaden those arms and turn
       --lr-known-date-field-min-height into dead code (the lr-select trap). */
  }

  [part~="form-control"] {
    min-inline-size: 0;
  }

  :host([appearance="filled"]) {
    --_lr-known-date-field-border-color: transparent;
    --_lr-known-date-field-fill: var(--lr-color-surface-raised);
  }
  :host([appearance="filled-outlined"]) {
    --_lr-known-date-field-fill: var(--lr-color-surface-raised);
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
  /* [part] always contains a literal <slot> child, so :empty never matches -- emptiness is tracked
     in JS (hasLabelSlot) and reflected via [hidden], as in every other lyra form control's
     label/hint/error chrome. Otherwise the required marker below, attached to this box, renders a
     stray glyph with nothing before it. */
  [part="legend"][hidden] {
    display: none;
  }
  /* The one component taking only the custom properties from internal/form-control.styles.ts, not
     its marker rule: that sheet attaches the marker to [part~="form-control-label"], a span INSIDE
     this legend, but the marker belongs to the legend box itself, after the whole label. Same three
     consumer-settable glyph/colour/offset properties -- keep these declarations identical. */
  :host([required]) [part="legend"]::after {
    content: var(--lr-form-control-required-content, ' *');
    color: var(--lr-form-control-required-color, var(--lr-color-danger));
    margin-inline-start: var(--lr-form-control-required-offset, 0);
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
    /* Pinned only when --lr-known-date-field-height is set; 'auto' otherwise, so the field grows to
       fit its own padding/font content. */
    block-size: var(--lr-known-date-field-height, auto);
    padding-block: var(
      --lr-known-date-field-padding-block,
      var(--_lr-known-date-field-padding-block)
    );
    padding-inline: var(
      --lr-known-date-field-padding-inline,
      var(--_lr-known-date-field-padding-inline)
    );
    border: var(--lr-border-width-thin) solid
      var(--_lr-known-date-field-border-color);
    border-radius: var(--lr-form-control-radius);
    background: var(--_lr-known-date-field-fill);
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
  /* Mouse-hover parity with the keyboard :focus-visible ring below -- same border-retint as
     lr-color-picker's own bordered [part='input']:hover.
     no-pressed-state: a press on a number field lands the caret, so a pressed tint would last only
     for the mousedown before the persistent :focus-visible ring replaced it. */
  [part="field-input"]:where(:not(:disabled)):hover {
    border-color: var(--lr-color-brand);
  }
  [part="field-input"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* --lr-known-date-invalid-border-color rethemes just this component's invalid-field border; the
     bare --lr-color-danger token would repaint every other component reading it. */
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
