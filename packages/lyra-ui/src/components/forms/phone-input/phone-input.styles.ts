import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    --lr-phone-input-padding-block: var(--lr-space-s);
    --lr-phone-input-font-size: var(--lr-font-size-md-sm);
    --lr-phone-input-flag-size: var(--lr-font-size-lg);
    --lr-phone-input-glyph-size: var(--lr-font-size-md-sm);
    --lr-phone-input-gap: var(--lr-space-xs);
    --lr-phone-input-radius: var(--lr-radius);
    --lr-phone-input-control-min-height: var(--lr-size-2-5rem);
    /* --lr-phone-input-control-height is intentionally NOT declared here -- same convention as
       lr-input/lr-select/lr-combobox/lr-date-input: a consumer-facing exact-height escape hatch
       consumed only through the var() fallback on [part='input-wrapper'] below; declaring any
       value for it here would make that fallback arm unreachable. */
  }
  :host([size='2xs']) {
    --lr-phone-input-padding-block: var(--lr-size-0-0625rem);
    --lr-phone-input-font-size: var(--lr-font-size-2xs);
    --lr-phone-input-flag-size: var(--lr-font-size-sm);
    --lr-phone-input-glyph-size: var(--lr-font-size-2xs);
    --lr-phone-input-control-min-height: var(--lr-size-1-25rem);
  }
  :host([size='xs']) {
    --lr-phone-input-padding-block: var(--lr-size-0-125rem);
    --lr-phone-input-font-size: var(--lr-font-size-xs);
    --lr-phone-input-flag-size: var(--lr-font-size-md-sm);
    --lr-phone-input-glyph-size: var(--lr-font-size-xs);
    --lr-phone-input-control-min-height: var(--lr-size-1-5rem);
  }
  :host([size='s']) {
    --lr-phone-input-padding-block: var(--lr-space-xs);
    --lr-phone-input-font-size: var(--lr-font-size-sm);
    --lr-phone-input-flag-size: var(--lr-font-size-md);
    --lr-phone-input-glyph-size: var(--lr-font-size-sm);
    --lr-phone-input-control-min-height: var(--lr-size-1-875rem);
  }
  :host([size='l']) {
    --lr-phone-input-padding-block: var(--lr-space-m);
    --lr-phone-input-font-size: var(--lr-font-size-lg);
    --lr-phone-input-flag-size: var(--lr-font-size-xl);
    --lr-phone-input-glyph-size: var(--lr-font-size-lg);
    --lr-phone-input-control-min-height: var(--lr-size-3rem);
  }
  :host([size='xl']) {
    --lr-phone-input-padding-block: var(--lr-space-l);
    --lr-phone-input-font-size: var(--lr-font-size-xl);
    --lr-phone-input-flag-size: var(--lr-font-size-2xl);
    --lr-phone-input-glyph-size: var(--lr-font-size-xl);
    --lr-phone-input-control-min-height: var(--lr-size-3-5rem);
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

  :host([required]) [part='form-control-label']::after {
    content: ' *';
    color: var(--lr-color-danger);
  }

  [part='input-wrapper'] {
    display: flex;
    align-items: center;
    min-inline-size: 0;
    inline-size: 100%;
    min-block-size: var(--lr-phone-input-control-height, var(--lr-phone-input-control-min-height));
    block-size: var(--lr-phone-input-control-height, auto);
    font-size: var(--lr-phone-input-font-size);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-phone-input-radius);
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
    gap: var(--lr-phone-input-gap);
    padding-inline: var(--lr-space-s);
    border-start-start-radius: var(--lr-phone-input-radius);
    border-end-start-radius: var(--lr-phone-input-radius);
    transition: background-color var(--lr-transition-fast);
  }

  [part='country-select']:not(:disabled):hover + [part='country-trigger'] {
    background: var(--lr-phone-input-country-hover-bg, var(--lr-color-brand-quiet));
  }

  /* The wrapper's focus-within ring marks the whole field; this inner ring additionally marks
     that keyboard focus sits on the (invisible) country select rather than the telephone input. */
  [part='country-select']:focus-visible + [part='country-trigger'] {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-width));
  }

  [part='flag'] {
    font-size: var(--lr-phone-input-flag-size);
  }

  [part='country-code'] {
    font-size: var(--lr-phone-input-font-size);
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
    font-size: var(--lr-phone-input-glyph-size);
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
    font-size: var(--lr-phone-input-font-size);
    unicode-bidi: isolate;
  }

  [part='input'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    inline-size: 100%;
    padding-block: var(--lr-phone-input-padding-block);
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

`;
