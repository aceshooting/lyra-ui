import { css } from 'lit';
import { formControlRequiredMarker } from '../../../internal/form-control.styles.js';

export const styles = css`
  :host {
    display: block;
    /* Geometry from the shared form-control ladder (internal/sizes.styles.ts, pulled in ahead of
       this sheet by input.class.ts): one scale for lr-button/lr-input/lr-select/lr-combobox/
       lr-date-input instead of five hand-maintained copies that had already drifted (this
       component's own l and xl tiers used to overshoot their declared floor by 2px and 5px, so an
       input never actually lined up with the button beside it). The ladder matches both spellings
       of every tier in one selector list, so size="small" is size="s" here for free. */
    --_lr-input-padding-block-default: var(--lr-form-control-padding-block);
    --_lr-input-padding-inline-default: var(--lr-form-control-padding-inline);
    --_lr-input-font-size-default: var(--lr-form-control-font-size);
    --_lr-input-control-min-height-default: var(--lr-form-control-height);
    /* --lr-input-control-height is intentionally NOT declared here. It is a consumer-facing escape
       hatch consumed only through the two var() fallbacks on [part~='input-wrapper'] below;
       declaring any value for it (even 'auto') would make those fallback arms unreachable and
       silently turn --lr-input-control-min-height into dead code. Left undeclared, both arms stay
       live: the per-tier floor falls out of the fallback, and setting the property from anywhere
       (inline style, an ancestor, an outer-tree rule) pins an exact height. */
    /* The adornment gap is deliberately NOT taken from the ladder: it does not vary by tier there
       either, and the ladder's value is tuned for a button's icon-beside-label spacing, which is
       tighter than a text field wants between an adornment and the caret. */
    --_lr-input-gap-default: var(--lr-space-xs);
    --_lr-input-radius-default: var(--lr-form-control-radius);
    /* Fill/border pair swapped per appearance below. The mapped default is outlined, so an element
       whose appearance attribute has not reflected yet still paints the correct border-only box. */
    --_lr-input-fill-default: transparent;
    --_lr-input-border-color-default: var(--lr-color-border);
  }
  :host([appearance='filled-outlined']) {
    --_lr-input-fill-default: var(--lr-color-surface);
    --_lr-input-border-color-default: var(--lr-color-border);
  }
  :host([appearance='outlined']) {
    --_lr-input-fill-default: transparent;
    --_lr-input-border-color-default: var(--lr-color-border);
  }
  :host([appearance='filled']) {
    --_lr-input-fill-default: var(--lr-color-surface-raised);
    --_lr-input-border-color-default: transparent;
  }
  :host([filled]) {
    --_lr-input-fill-default: var(--lr-color-surface-raised);
    --_lr-input-border-color-default: transparent;
  }
  :host([appearance='plain']) {
    --_lr-input-fill-default: transparent;
    --_lr-input-border-color-default: transparent;
  }
  /* The loudest tier still has to read as an editable text surface, so it takes the *quiet* brand
     tint as its fill and the loud brand color on the border only -- a loud fill would put user
     text on a saturated background at an unpredictable contrast ratio. */
  :host([appearance='accent']) {
    --_lr-input-fill-default: var(--lr-color-brand-quiet);
    --_lr-input-border-color-default: var(--lr-color-brand);
  }
  :host([pill]) {
    --_lr-input-radius-default: var(--lr-radius-pill);
  }
  [part='form-control-label'] {
    display: block;
    margin-block-end: var(--lr-space-xs);
    font-size: var(--lr-font-size-md-sm);
    font-weight: var(--lr-font-weight-semibold);
  }
  [part='form-control-label'][hidden] {
    display: none;
  }
  ${formControlRequiredMarker}
  [part~='input-wrapper'] {
    display: flex;
    align-items: center;
    gap: var(--lr-input-gap, var(--_lr-input-gap-default));
    inline-size: 100%;
    box-sizing: border-box;
    min-block-size: var(--lr-input-control-height, var(--lr-input-control-min-height, var(--_lr-input-control-min-height-default)));
    /* Pinned only when --lr-input-control-height is set; 'auto' otherwise, so the row keeps
       growing to fit its own content. */
    block-size: var(--lr-input-control-height, auto);
    padding-inline: var(--lr-input-padding-inline, var(--_lr-input-padding-inline-default));
    border: var(--lr-border-width-thin) solid var(--lr-input-border-color, var(--_lr-input-border-color-default));
    border-radius: var(--lr-input-radius, var(--_lr-input-radius-default));
    background: var(--lr-input-fill, var(--_lr-input-fill-default));
  }
  [part~='input-wrapper']:focus-within {
    border-color: var(--lr-input-focus-border-color, var(--lr-color-brand));
  }
  /* :host(:disabled), not :host([disabled]) -- lr-input is form-associated
     (FormAssociated mixin), so the UA computes its disabled state (and
     therefore :disabled/:enabled matching) the same way it does for a
     native form control: from its own disabled content attribute *or* an
     ancestor <fieldset disabled>'s cascade. The attribute selector alone
     only ever matched the first case; disabled purely via an ancestor
     fieldset left the whole wrapper chrome (adornments, password-toggle/
     clear buttons, border) at full opacity with a normal cursor. Dims the
     wrapper as one unit rather than [part='input'] alone (the previous,
     narrower rule this replaces): a per-element opacity compounds with an
     ancestor's, so keeping both would have doubly faded the text relative
     to the buttons/adornments beside it. Mirrors lr-date-input's/lr-radio's
     identical fix. */
  :host(:disabled) [part~='input-wrapper'] {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part='input'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    box-sizing: border-box;
    padding-block: var(--lr-input-padding-block, var(--_lr-input-padding-block-default));
    border: none;
    outline: none;
    background: transparent;
    color: var(--lr-color-text);
    font: inherit;
    font-size: var(--lr-input-font-size, var(--_lr-input-font-size-default));
  }
  [part='input']::placeholder {
    color: var(--lr-input-action-color, var(--lr-color-text-quiet));
  }
  [part='input'][type='search']::-webkit-search-cancel-button,
  [part='input'][type='search']::-webkit-search-decoration {
    appearance: none;
  }
  /* Gated on the rendered data attribute rather than :host([without-spin-buttons]) so the
     suppression tracks the property on the very first render, independent of when Lit reflects
     the host attribute -- and so a subclass defaulting the property the other way (see
     <lr-number-input>) needs no converter gymnastics to keep the two in step. */
  [part='input'][type='number'][data-without-spin-buttons] {
    appearance: textfield;
  }
  [part='input'][type='number'][data-without-spin-buttons]::-webkit-outer-spin-button,
  [part='input'][type='number'][data-without-spin-buttons]::-webkit-inner-spin-button {
    appearance: none;
    margin: 0;
  }
  /* Restyled, not suppressed -- this is the only mouse/touch affordance to open the native time
     picker, unlike the search-cancel/number-spinner glyphs above which this component/lr-pagination
     both already provide their own alternative for. */
  [part='input'][type='time']::-webkit-calendar-picker-indicator {
    cursor: pointer;
    border-radius: var(--lr-radius-xs);
    background-color: transparent;
    outline: var(--lr-focus-ring-width) solid transparent;
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='input'][type='time']:not(:disabled):hover::-webkit-calendar-picker-indicator {
    background-color: var(--lr-input-time-picker-hover-bg, var(--lr-color-brand-quiet));
  }
  [part='input'][type='time']:not(:disabled):active::-webkit-calendar-picker-indicator {
    background-color: var(--lr-input-time-picker-active-bg, var(--lr-color-brand));
  }
  [part='input'][type='time']:not(:disabled):focus-visible::-webkit-calendar-picker-indicator {
    background-color: var(--lr-input-time-picker-focus-bg, var(--lr-color-brand-quiet));
    outline-color: var(--lr-input-time-picker-focus-ring, var(--lr-focus-ring-color));
  }
  [part='start'],
  [part='end'] {
    flex: 0 1 auto;
    display: inline-flex;
    align-items: center;
    min-inline-size: 0;
    max-inline-size: 50%;
    overflow: hidden;
    color: var(--lr-color-text-quiet);
  }
  [part='start'] slot,
  [part='end'] slot,
  [part='start'] slot::slotted(*),
  [part='end'] slot::slotted(*) {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [part='start'][hidden],
  [part='end'][hidden] {
    display: none;
  }
  [part='password-toggle'],
  [part='clear-button'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    /* Invisible while the background is none; it exists so the pressed fill below (and the
       focus ring, which follows the same corner) is a rounded chip rather than a hard rectangle. */
    border-radius: var(--lr-radius);
    background: none;
    cursor: pointer;
    color: var(--lr-color-text-quiet);
    padding: var(--lr-space-xs);
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    line-height: var(--lr-line-height-none);
    font-size: var(--lr-font-size-m);
  }
  [part='password-toggle']:not(:disabled):hover {
    color: var(--lr-input-action-hover-color, var(--lr-color-text));
  }
  [part='clear-button']:not(:disabled):hover {
    color: var(--lr-input-action-hover-color, var(--lr-color-text));
  }
  /* Pressed: the hover's quiet-to-full text step PLUS a fill, mixing the page surface toward
     --lr-color-mix-partner. Deliberately more than the hover rather than a repeat of it -- these
     two sit inside a text field whose own hover already moves the field border, so a fill at
     rest-or-hover would compete with it, while a fill under the thumb only while the pointer is
     down cannot. */
  [part='password-toggle']:not(:disabled):active,
  [part='clear-button']:not(:disabled):active {
    color: var(--lr-input-action-active-color, var(--lr-input-action-hover-color, var(--lr-color-text)));
    background: var(
      --lr-input-action-active-bg,
      color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-active))
    );
  }
  [part='password-toggle']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part='clear-button']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part~='hint'] {
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  [part~='hint'][hidden] {
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
  [part='form-control'],
  [part='form-control-label'],
  [part~='hint'],
  [part='error'] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
`;
