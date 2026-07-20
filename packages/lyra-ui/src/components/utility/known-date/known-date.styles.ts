import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    --lr-known-date-field-padding-block: var(--lr-space-s);
    --lr-known-date-field-padding-inline: var(--lr-space-s);
    --lr-known-date-field-font-size: var(--lr-font-size-md-sm);
    --lr-known-date-field-gap: var(--lr-space-s);
    --lr-known-date-year-field-width: var(--lr-size-5em);
    --lr-known-date-day-field-width: var(--lr-size-3-5em);
    --lr-known-date-month-field-width: var(--lr-size-3-5em);
    /* Per-tier minimum block size of each field input, reassigned by the same size tiers as
       padding/font-size above -- reusing lr-input's own min-height scale values (xs=1.5rem,
       s=1.875rem, m=2.5rem, l=3rem, xl=3.5rem) so a birthdate <lr-known-date> sitting in a form
       row next to a regular <lr-input>/<lr-date-input> at the same declared size renders at the
       same height instead of a visibly shorter box (previously matched lr-button's scale
       instead, an 8px/25% mismatch at the default tier). At the xs/s/m tiers the floor is now
       taller than the field's own padding/font-driven content height, so it actively pins the
       rendered box (byte-identical is no longer the invariant there); at l/xl the natural content
       height already exceeds the floor, so those two tiers render unchanged. */
    --lr-known-date-field-min-height: var(--lr-size-2-5rem);
    /* --lr-known-date-field-height is intentionally NOT declared here. It is a consumer-facing
       exact-height escape hatch consumed only through the var() fallbacks on [part='field-input']
       below; declaring any value for it (even 'auto') would make those fallback arms unreachable
       and turn --lr-known-date-field-min-height into dead code (the lr-select trap). Left
       undeclared, both arms stay live: the per-tier floor falls out of the fallback, and setting
       the property pins an exact height. */
  }
  :host([size='xs']) {
    --lr-known-date-field-padding-block: var(--lr-size-0-125rem);
    --lr-known-date-field-padding-inline: var(--lr-space-xs);
    --lr-known-date-field-font-size: var(--lr-font-size-xs);
    --lr-known-date-field-min-height: var(--lr-size-1-5rem);
  }
  :host([size='s']) {
    --lr-known-date-field-padding-block: var(--lr-space-xs);
    --lr-known-date-field-padding-inline: var(--lr-space-xs);
    --lr-known-date-field-font-size: var(--lr-font-size-sm);
    --lr-known-date-field-min-height: var(--lr-size-1-875rem);
  }
  :host([size='l']) {
    --lr-known-date-field-padding-block: var(--lr-space-m);
    --lr-known-date-field-padding-inline: var(--lr-space-m);
    --lr-known-date-field-font-size: var(--lr-font-size-lg);
    --lr-known-date-field-min-height: var(--lr-size-3rem);
  }
  :host([size='xl']) {
    --lr-known-date-field-padding-block: var(--lr-space-l);
    --lr-known-date-field-padding-inline: var(--lr-space-l);
    --lr-known-date-field-font-size: var(--lr-font-size-xl);
    --lr-known-date-field-min-height: var(--lr-size-3-5rem);
  }

  [part='form-control'] {
    min-inline-size: 0;
  }

  [part='fieldset'] {
    margin: 0;
    padding: 0;
    border: none;
    min-inline-size: 0;
  }

  [part='legend'] {
    display: block;
    padding: 0;
    margin-block-end: var(--lr-space-xs);
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-md-sm);
    font-weight: var(--lr-font-weight-semibold);
  }
  /* [part] always contains a literal <slot> child regardless of assigned
     content, so :empty never matches -- real emptiness is tracked in JS
     (hasLabelSlot) and reflected via [hidden] instead (same fix as every
     other lyra form control's label/hint/error chrome). Without this the
     required-asterisk ::after below (attached to this box) would render a
     stray ' *' with nothing before it whenever no label is set. */
  [part='legend'][hidden] {
    display: none;
  }
  :host([required]) [part='legend']::after {
    content: ' *';
    color: var(--lr-color-danger);
  }

  [part='fields'] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--lr-known-date-field-gap);
  }

  [part='field'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-2xs);
  }

  [part='field-label'] {
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }

  [part='field-input'] {
    box-sizing: border-box;
    min-block-size: var(--lr-known-date-field-height, var(--lr-known-date-field-min-height));
    /* Pinned only when --lr-known-date-field-height is set; 'auto' otherwise, so the field keeps
       growing to fit its own padding/font content. */
    block-size: var(--lr-known-date-field-height, auto);
    padding-block: var(--lr-known-date-field-padding-block);
    padding-inline: var(--lr-known-date-field-padding-inline);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font-family: inherit;
    font-size: var(--lr-known-date-field-font-size);
    text-align: center;
  }
  [part='field'][data-field='day'] [part='field-input'] {
    inline-size: var(--lr-known-date-day-field-width);
  }
  [part='field'][data-field='month'] [part='field-input'] {
    inline-size: var(--lr-known-date-month-field-width);
  }
  [part='field'][data-field='year'] [part='field-input'] {
    inline-size: var(--lr-known-date-year-field-width);
  }
  /* Mouse-hover parity with the keyboard :focus-visible ring below -- same border-retint
     treatment as lr-color-picker's own bordered [part='input']:hover. */
  [part='field-input']:hover {
    border-color: var(--lr-color-brand);
  }
  [part='field-input']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* --lr-known-date-invalid-border-color indirection (rather than the bare --lr-color-danger
     token) lets a consumer retheme just this component's invalid-field border without
     repainting every other component in the app that reads the same shared danger token. */
  :host([data-invalid]) [part='field-input'] {
    border-color: var(--lr-known-date-invalid-border-color, var(--lr-color-danger));
  }
  [part='field-input']:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }

  [part='hint'] {
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  [part='hint'][hidden] {
    display: none;
  }
  [part='error'] {
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-danger);
  }
  [part='error'][hidden] {
    display: none;
  }
`;
