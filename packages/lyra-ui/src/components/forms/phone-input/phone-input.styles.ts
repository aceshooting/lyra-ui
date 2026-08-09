import { css } from 'lit';
import { formControlRequiredMarker } from '../../../internal/form-control.styles.js';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    --_lr-phone-input-padding-block-default: var(--lr-form-control-padding-block);
    --_lr-phone-input-font-size-default: var(--lr-font-size-md-sm);
    --_lr-phone-input-flag-size-default: var(--lr-font-size-lg);
    --_lr-phone-input-glyph-size-default: var(--lr-font-size-md-sm);
    --_lr-phone-input-gap-default: var(--lr-space-xs);
    --_lr-phone-input-radius-default: var(--lr-radius);
    /* The floor's six values come from the ONE shared form-control ladder
       (internal/sizes.styles.ts) rather than a private copy, so retuning
       --lr-theme-form-control-height-* moves this control and every sibling field together. That
       ladder matches both spellings of every tier, which is what makes size="small" resolve here
       without a per-component alias rule. */
    --_lr-phone-input-control-min-height-default: var(--lr-form-control-height);
    /* --lr-phone-input-control-height is intentionally NOT declared here -- same convention as
       lr-input/lr-select/lr-combobox/lr-date-input: a consumer-facing exact-height escape hatch
       consumed only through the var() fallback on [part='input-wrapper'] below; declaring any
       value for it here would make that fallback arm unreachable. */
  }
  :host([pill]) {
    --_lr-phone-input-radius-default: var(--lr-radius-pill);
  }
  /* What remains per tier is this component's own glyph geometry. Padding follows the shared
     form-control ladder above so the country-selector action and sibling fields resolve to one
     outer height; both spellings of a tier still match for the component-specific glyph values. */
  :host([size='2xs']) {
    --_lr-phone-input-font-size-default: var(--lr-font-size-2xs);
    --_lr-phone-input-flag-size-default: var(--lr-font-size-sm);
    --_lr-phone-input-glyph-size-default: var(--lr-font-size-2xs);
  }
  :host([size='xs']) {
    --_lr-phone-input-font-size-default: var(--lr-font-size-xs);
    --_lr-phone-input-flag-size-default: var(--lr-font-size-md-sm);
    --_lr-phone-input-glyph-size-default: var(--lr-font-size-xs);
  }
  :host([size='s']),
  :host([size='small']) {
    --_lr-phone-input-font-size-default: var(--lr-font-size-sm);
    --_lr-phone-input-flag-size-default: var(--lr-font-size-m);
    --_lr-phone-input-glyph-size-default: var(--lr-font-size-sm);
  }
  :host([size='l']),
  :host([size='large']) {
    --_lr-phone-input-font-size-default: var(--lr-font-size-lg);
    --_lr-phone-input-flag-size-default: var(--lr-font-size-xl);
    --_lr-phone-input-glyph-size-default: var(--lr-font-size-lg);
  }
  :host([size='xl']) {
    --_lr-phone-input-font-size-default: var(--lr-font-size-xl);
    --_lr-phone-input-flag-size-default: var(--lr-font-size-2xl);
    --_lr-phone-input-glyph-size-default: var(--lr-font-size-xl);
  }

  [part='form-control'] {
    min-inline-size: 0;
  }

  [part='form-control-label'] {
    display: block;
    margin-block-end: var(--lr-space-xs);
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-md-sm);
    font-weight: var(--lr-font-weight-semibold);
  }

  [part='form-control-label'][hidden],
  [part='country-prefix'][hidden],
  [part='hint'][hidden],
  [part='error'][hidden] {
    display: none;
  }

  ${formControlRequiredMarker}

  [part='input-wrapper'] {
    display: flex;
    align-items: center;
    box-sizing: border-box;
    min-inline-size: 0;
    inline-size: 100%;
    min-block-size: var(--lr-phone-input-control-height, var(--lr-phone-input-control-min-height, var(--_lr-phone-input-control-min-height-default)));
    block-size: var(--lr-phone-input-control-height, auto);
    font-size: var(--lr-phone-input-font-size, var(--_lr-phone-input-font-size-default));
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-phone-input-radius, var(--_lr-phone-input-radius-default));
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
  }

  [part='input-wrapper']:focus-within {
    border-color: var(--lr-phone-input-focus-border-color, var(--lr-color-brand));
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  :host([data-invalid]) [part='input-wrapper'] {
    border-color: var(--lr-phone-input-invalid-border-color, var(--lr-color-danger));
  }

  /* :host(:disabled), not :host([disabled]) -- this is a form-associated
     custom element (FormAssociated mixin -> static formAssociated = true),
     so the UA computes its disabled state (and therefore :disabled/:enabled
     matching) the same way it does for a native form control: from its own
     disabled content attribute *or* an ancestor <fieldset disabled>'s
     cascade. Keying this off the attribute selector only ever matched the
     first case -- a field disabled purely via an ancestor fieldset had
     effectiveDisabled correctly gating the country select/telephone input
     underneath, but the wrapper around them still rendered at full opacity
     with a normal cursor. */
  :host(:disabled) [part='input-wrapper'] {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }

  [part='country-prefix'] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    padding-inline-start: var(--lr-space-s);
  }

  /* The country selector keeps the real native <select> (its popup, keyboard type-ahead, and
     mobile pickers are irreplaceable) but stretches it invisibly over a compact decorative
     trigger, so the closed control never clips a long localized country name and never repeats
     the calling code shown right next to it. */
  [part='country'] {
    position: relative;
    display: inline-flex;
    align-items: stretch;
    flex: 0 0 auto;
    align-self: stretch;
    min-block-size: var(--lr-icon-button-size);
    border-inline-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }

  [part='country-select'] {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    margin: 0;
    padding: 0;
    border: none;
    appearance: none;
    opacity: 0;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  [part='country-select']:disabled {
    cursor: not-allowed;
  }

  /* The invisible select's popup list is still painted by the browser from these options; without
     an explicit surface/text pairing it falls back to UA colors (a white panel in dark themes). */
  [part='country-select'] option {
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
  }

  [part='country-trigger'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-phone-input-gap, var(--_lr-phone-input-gap-default));
    padding-inline: var(--lr-space-s);
    border-start-start-radius: var(--lr-phone-input-radius, var(--_lr-phone-input-radius-default));
    border-end-start-radius: var(--lr-phone-input-radius, var(--_lr-phone-input-radius-default));
    transition: background-color var(--lr-transition-fast);
  }

  [part='country-select']:not(:disabled):hover + [part='country-trigger'] {
    background: var(--lr-phone-input-country-hover-bg, var(--lr-color-brand-quiet));
  }

  /* The press lands on the invisible <select> stretched over the trigger, so the pressed tint is
     driven from the same sibling combinator as the hover above -- styling [part='country-trigger']
     itself with :active would never match, since it is not the element being pressed. Mixing the
     hover tint one shared step further toward the text colour keeps a consumer's
     --lr-phone-input-country-hover-bg override in charge of both states. */
  [part='country-select']:not(:disabled):active + [part='country-trigger'] {
    background: color-mix(
      in oklab,
      var(--lr-phone-input-country-hover-bg, var(--lr-color-brand-quiet)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }

  /* The wrapper's focus-within ring marks the whole field; this inner ring additionally marks
     that keyboard focus sits on the (invisible) country select rather than the telephone input. */
  [part='country-select']:focus-visible + [part='country-trigger'] {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-width));
  }

  [part='flag'] {
    font-size: var(--lr-phone-input-flag-size, var(--_lr-phone-input-flag-size-default));
  }

  [part='country-code'] {
    font-size: var(--lr-phone-input-font-size, var(--_lr-phone-input-font-size-default));
    font-weight: var(--lr-font-weight-semibold);
  }

  [part='country-code'][data-placeholder] {
    color: var(--lr-color-text-quiet);
    font-weight: var(--lr-font-weight-normal);
  }

  [part='expand-icon'] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--lr-color-text-quiet);
    font-size: var(--lr-phone-input-glyph-size, var(--_lr-phone-input-glyph-size-default));
    line-height: var(--lr-line-height-none);
  }

  [part='expand-icon'] svg {
    transform: rotate(90deg);
  }

  [part='input']:focus {
    outline: none;
  }

  [part='calling-code'] {
    flex: 0 0 auto;
    padding-inline-start: var(--lr-space-s);
    color: var(--lr-color-text-quiet);
    direction: ltr;
    font-size: var(--lr-phone-input-font-size, var(--_lr-phone-input-font-size-default));
    unicode-bidi: isolate;
  }

  [part='input'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    inline-size: 100%;
    padding-block: var(--lr-phone-input-padding-block, var(--_lr-phone-input-padding-block-default));
    padding-inline: var(--lr-space-s);
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: start;
  }

  [part='input']::placeholder {
    color: var(--lr-color-text-quiet);
  }

  [part='hint'],
  [part='error'] {
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
  }

  [part='hint'] {
    color: var(--lr-color-text-quiet);
  }

  [part='error'] {
    color: var(--lr-color-danger);
  }

  [part='form-control'],
  [part='form-control-label'],
  [part='hint'],
  [part='error'] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
`;
