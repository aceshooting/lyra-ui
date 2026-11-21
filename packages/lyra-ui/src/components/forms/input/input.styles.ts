import { activeFill, disabledControl, focusRing, focusRingOffset, focusRingOutline, formControlIconHitTarget, interactiveTransition } from '../../../internal/interactive-control.styles.js';
import { css } from 'lit';
import {
  formControlFocusHalo,
  formControlInvalidBorder,
  formControlRequiredMarker,
  formControlTextWrap,
} from '../../../internal/form-control.styles.js';
import { formControlChrome } from '../../../internal/form-control/chrome.styles.js';
import { formControlAppearance } from '../../../internal/form-control/appearance.styles.js';

export const styles = css`
  :host {
    display: block;
    /* Geometry from the shared form-control ladder (internal/sizes.styles.ts, pulled in ahead of
       this sheet by input.class.ts): one scale across lr-button/lr-input/lr-select/lr-combobox/
       lr-date-input, replacing five drifting copies whose l and xl tiers overshot their floor by
       2px and 5px. The ladder matches both tier spellings in one selector list, so size="small"
       is size="s" for free. */
    --_lr-input-padding-block-default: var(--lr-form-control-padding-block);
    --_lr-input-padding-inline-default: var(--lr-form-control-padding-inline);
    --_lr-input-font-size-default: var(--lr-form-control-font-size);
    --_lr-input-control-min-height-default: var(--lr-form-control-height);
    /* --lr-input-control-height is deliberately NOT declared: it is read only through the two var()
       fallbacks on [part~='input-wrapper'] below, and declaring any value (even 'auto') would make
       those arms unreachable, turning --lr-input-control-min-height into dead code. Undeclared, the
       per-tier floor falls out of the fallback and setting it from anywhere pins an exact height.
       */
    /* The adornment gap is deliberately NOT from the ladder: it does not vary by tier there either,
       and the ladder's value is tuned for a button's icon-beside-label spacing, tighter than a text
       field wants between an adornment and the caret. */
    --_lr-input-gap-default: var(--lr-space-xs);
    --_lr-input-radius-default: var(--lr-form-control-radius);
    /* Fill/border pair swapped per appearance below; the default is outlined, so an element whose
       appearance attribute has not reflected yet still paints the correct border-only box. */
    --_lr-input-fill-default: var(--_lr-form-control-fill);
    --_lr-input-border-color-default: var(--_lr-form-control-border-color);
    /* The shared field focus halo (internal/form-control.styles.ts). Only this private copy is
       declared; the PUBLIC name stays undeclared, so a value set on :root or any ancestor still
       reaches this field. */
    --_lr-form-control-focus-shadow: var(--lr-form-control-focus-shadow, none);
  }
  ${formControlAppearance}
  :host([pill]) {
    --_lr-input-radius-default: var(--lr-radius-pill);
  }
  ${formControlChrome}

  ${formControlRequiredMarker}
  [part~='input-wrapper'] {
    display: flex;
    align-items: center;
    gap: var(--lr-input-gap, var(--_lr-input-gap-default));
    inline-size: 100%;
    box-sizing: border-box;
    min-block-size: var(--lr-input-control-height, var(--lr-input-control-min-height, var(--_lr-input-control-min-height-default)));
    /* Pinned only when --lr-input-control-height is set; 'auto' otherwise, so the row keeps growing
       to fit its own content. */
    block-size: var(--lr-input-control-height, auto);
    padding-inline: var(--lr-input-padding-inline, var(--_lr-input-padding-inline-default));
    border: var(--lr-border-width-thin) solid var(--lr-input-border-color, var(--_lr-input-border-color-default));
    border-radius: var(--lr-input-radius, var(--_lr-input-radius-default));
    background: var(--lr-input-fill, var(--_lr-input-fill-default));
  }
  [part~='input-wrapper']:focus-within {
    border-color: var(--lr-input-focus-border-color, var(--lr-color-brand));
    /* Transparent until forced colours paint it: there the brand border alone is too thin a
       focus cue, as in lr-combobox. */
    outline: var(--lr-border-width-medium) solid transparent;
    ${formControlFocusHalo}
  }
  /* :host(:disabled), not :host([disabled]) -- lr-input is form-associated (FormAssociated mixin),
     so the UA matches :disabled from its own disabled attribute *or* an ancestor <fieldset
     disabled>'s cascade; the attribute selector caught only the first, leaving a fieldset-disabled
     field's whole wrapper chrome (adornments, password-toggle/clear buttons, border) at full
     opacity with a normal cursor. Dims the wrapper as one unit rather than [part='input'] alone: a
     per-element opacity compounds with an ancestor's, doubly fading the text against the buttons
     beside it. Same fix as lr-date-input and lr-radio. */
  :host(:disabled) [part~='input-wrapper'] {
    ${disabledControl}
  }
  /* A small basis, not auto: a native field's intrinsic width comes from its size attribute, not
     its value, so an auto basis made a 4-digit number claim ~20 characters and clip a short end
     unit (kWh) in proportion. The field now takes what the adornments leave and gives it back
     first; only then do the adornments (capped at 50% below) shrink and ellipsize. Shrink-to-fit
     sizing still reads the intrinsic width. */
  [part='input'] {
    flex: 1 1 var(--lr-size-4ch);
    min-inline-size: 0;
    box-sizing: border-box;
    padding-block: var(--lr-input-padding-block, var(--_lr-input-padding-block-default));
    border: none;
    outline: none;
    background: transparent;
    color: var(--lr-color-text);
    font: inherit;
    font-family: var(--lr-input-font-family, inherit);
    font-size: var(--lr-input-font-size, var(--_lr-input-font-size-default));
  }
  :host([dir='ltr' i]) [part='input'][dir='auto'] {
    direction: ltr;
  }
  :host([dir='rtl' i]) [part='input'][dir='auto'] {
    direction: rtl;
  }
  [part='input']::placeholder {
    color: var(--lr-input-placeholder-color, var(--lr-input-action-color, var(--lr-color-text-quiet)));
  }
  /* The 4-character floor holds only while an adornment is shown: shrink is shared in proportion
     to base size, so long adornments would otherwise squeeze the field out. Without one the field
     is the only item that can shrink and must still yield to the fixed actions (clear, password,
     steppers) in a narrow row. */
  :where([part~='input-wrapper']:has(> [part='start']:not([hidden]), > [part='end']:not([hidden])))
    > [part='input'] {
    min-inline-size: min(var(--lr-size-4ch), 100%);
  }
  [part='input'][type='search']::-webkit-search-cancel-button,
  [part='input'][type='search']::-webkit-search-decoration {
    appearance: none;
  }
  /* Gated on the rendered data attribute, not :host([without-spin-buttons]), so suppression tracks
     the property from the first render regardless of when Lit reflects the host attribute, and a
     subclass defaulting it the other way (<lr-number-input>) needs no converter gymnastics. */
  [part='input'][type='number'][data-without-spin-buttons] {
    appearance: textfield;
  }
  [part='input'][type='number'][data-without-spin-buttons]::-webkit-outer-spin-button,
  [part='input'][type='number'][data-without-spin-buttons]::-webkit-inner-spin-button {
    appearance: none;
    margin: 0;
  }
  /* Restyled, not suppressed: the only mouse/touch affordance for opening the native time picker,
     unlike the search-cancel/number-spinner glyphs above, for which this component and
     lr-pagination already provide their own alternative. */
  [part='input'][type='time']::-webkit-calendar-picker-indicator {
    cursor: pointer;
    border-radius: var(--lr-radius-xs);
    background-color: transparent;
    ${focusRingOutline('transparent')}
    ${focusRingOffset}
    /* Hover/active below only repaint background-color, so that is all this needs; without it
       this indicator's fill snaps while lr-button/lr-icon-button ease. */
    ${interactiveTransition}
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
  /* Icon or image adornments keep their size: only text content shrinks and ellipsizes, so an
     icon is never clipped by a long neighbouring adornment. */
  [part='start']:where([data-textless]),
  [part='end']:where([data-textless]) {
    flex-shrink: 0;
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
    /* Invisible while the background is none; it makes the pressed fill below, and the focus ring
       that follows the same corner, a rounded chip rather than a hard rectangle. */
    border-radius: var(--lr-radius);
    background: none;
    cursor: pointer;
    color: var(--lr-input-action-color, var(--lr-color-text-quiet));
    padding: var(--lr-space-xs);
    ${formControlIconHitTarget}
    line-height: var(--lr-line-height-none);
    font-size: var(--lr-font-size-m);
    ${interactiveTransition}
  }
  [part='password-toggle']:not(:disabled):hover {
    color: var(--lr-input-action-hover-color, var(--lr-color-text));
  }
  [part='clear-button']:not(:disabled):hover {
    color: var(--lr-input-action-hover-color, var(--lr-color-text));
  }
  /* Pressed adds a fill mixing the page surface toward --lr-color-mix-partner on top of the hover's
     quiet-to-full text step: the surrounding field's own hover already moves its border, so a fill
     at rest or hover would compete with it while a fill held only under the pointer cannot. */
  [part='password-toggle']:not(:disabled):active,
  [part='clear-button']:not(:disabled):active {
    color: var(--lr-input-action-active-color, var(--lr-input-action-hover-color, var(--lr-color-text)));
    background: var(
      --lr-input-action-active-bg,
      ${activeFill('var(--lr-color-surface)')}
    );
  }
  [part='password-toggle']:focus-visible {
    ${focusRing}
  }
  [part='clear-button']:focus-visible {
    ${focusRing}
  }

  [part='form-control'],
  [part='form-control-label'],
  [part~='hint'],
  [part='error'] {
    ${formControlTextWrap}
  }
  ${formControlInvalidBorder(css`[part~='input-wrapper']`)}
`;
