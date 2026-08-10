import { html, nothing, type TemplateResult } from 'lit';
import { LyraElement } from '../../../internal/lyra-element.js';
import { sizes } from '../../../internal/sizes.styles.js';
import { LyraRadio } from './radio.class.js';
import { styles } from './radio-button.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_open, LYRA_DEFAULT_restore } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/**
 * `<lr-radio-button>` — a single-choice control rendered as a button rather than a circle.
 *
 * The same control as `<lr-radio>`, and deliberately a subclass of it: form association,
 * validity, `form.reset()` restoration and the whole `<lr-radio-group>` ownership/roving-focus
 * contract are inherited rather than reimplemented, so the two can never drift apart. Only the
 * chrome differs. A `<lr-radio-group>` accepts either tag, and the two can be mixed.
 *
 * Consecutive `<lr-radio-button>` siblings collapse their shared borders into one segmented
 * control automatically — nothing needs to be set on the group.
 * A host `aria-label` is forwarded to the internal `role="radio"` by attribute presence, so an
 * explicitly empty value remains authoritative rather than restoring a label-text fallback.
 * Standalone button chrome is bounded by its allocation: unbroken labels wrap, while long
 * start/prefix and end/suffix adornments truncate inside their capped portions instead of widening
 * the page.
 *
 * @customElement lr-radio-button
 * @slot - Label text.
 * @slot start - Content placed before the label, typically an icon.
 * @slot prefix - Shoelace-compatible alias for `start`, rendered through the same wrapper.
 * @slot end - Content placed after the label.
 * @slot suffix - Shoelace-compatible alias for `end`, rendered through the same wrapper.
 * @event input - The user selected this radio.
 * @event change - The user selected this radio.
 * @event lr-change - A standalone radio button was selected. `detail: { checked, value }`. An
 * owning radio group emits its aggregate event instead.
 * @event focus - The internal control received focus.
 * @event blur - The internal control lost focus.
 * @event lr-invalid - The standalone radio button failed a validity check. Aggregate groups emit
 *   their own alias instead. Cancelable: calling `preventDefault()` also cancels the native
 *   `invalid` event behind it, suppressing the browser's own validation bubble so an app can
 *   present the failure its own way.
 * @cssstate required - Matches while the control is required, either by its own `required`
 * attribute or by an owning `<lr-radio-group required>`. Style with
 * `lr-radio-button:state(required)`.
 * @cssstate optional - Matches while it is neither — the complement of `required`.
 * @cssstate valid - Matches while the control satisfies its constraints, including any
 * `setCustomValidity()` error.
 * @cssstate invalid - Matches while it does not — from the very first render, before the user has
 * touched anything.
 * @cssstate user-valid - `valid`, but only after the user has interacted with this control:
 * selecting it, blurring it, or a `reportValidity()` call (which is what a submit attempt runs).
 * @cssstate user-invalid - `invalid` after that same interaction. Style validation errors with this
 * rather than `invalid`: a pristine required control is genuinely invalid, but colouring it red
 * before the user has done anything is hostile.
 * @csspart base - The interactive button. Carries `checked` and `disabled` in the part name so a
 * consumer can target either state through `::part()`.
 * @csspart button - Shoelace name for the interactive button.
 * @csspart button--checked - Shoelace state alias on the selected button.
 * @csspart control - Compatibility alias for the interactive control.
 * @csspart start - The leading-content wrapper.
 * @csspart prefix - Shoelace-compatible alias for `start`; both names are on the same wrapper.
 * @csspart label - The default slot wrapper.
 * @csspart end - The trailing-content wrapper.
 * @csspart suffix - Shoelace-compatible alias for `end`; both names are on the same wrapper.
 * @cssprop [--lr-radio-radius=var(--lr-form-control-radius)] - Corner radius of the outer edges of
 * the button row. Inherited from `<lr-radio>` and re-pointed here at the shared control radius;
 * `pill` swaps it for `--lr-radius-pill`.
 * @cssprop [--lr-radio-button-gap=var(--lr-space-xs)] - Gap between the start/prefix wrapper,
 * label, and end/suffix wrapper in both `<lr-radio-button>` and `<lr-radio appearance="button">`.
 * @cssprop [--lr-radio-button-hover-bg=var(--lr-color-brand-quiet)] - Unchecked button background
 * while hovered.
 * @cssprop [--lr-radio-button-hover-border-color=var(--lr-color-brand)] - Unchecked button border
 * while hovered.
 * @cssprop [--lr-radio-button-active-bg=color-mix(...)] - Unchecked button background while
 * pressed.
 * @cssprop [--lr-radio-button-active-border-color=var(--lr-radio-button-hover-border-color)] -
 * Unchecked button border while pressed.
 * @cssprop [--lr-radio-button-checked-bg=var(--lr-color-brand)] - Checked button background.
 * @cssprop [--lr-radio-button-checked-border-color=var(--lr-color-brand)] - Checked button border.
 * @cssprop [--lr-radio-button-checked-color=var(--lr-color-on-brand)] - Checked button text color.
 * @cssprop [--lr-radio-button-checked-hover-bg=color-mix(...)] - Checked button background while
 * hovered.
 * @cssprop [--lr-radio-button-checked-hover-border-color=var(--lr-radio-button-checked-border-color)] -
 * Checked button border while hovered.
 * @cssprop [--lr-radio-button-checked-active-bg=color-mix(...)] - Checked button background while
 * pressed.
 * @cssprop [--lr-radio-button-checked-active-border-color=var(--lr-radio-button-checked-hover-border-color)] -
 * Checked button border while pressed.
 * @status stable
 * @since 8.0.0
 */
export class LyraRadioButton extends LyraRadio {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    open: LYRA_DEFAULT_open,
    restore: LYRA_DEFAULT_restore,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, sizes, styles];

  override render(): TemplateResult {
    const disabled = this.effectiveDisabled;
    const parts = [
      'base',
      'button',
      'control',
      this.checked ? 'checked button--checked' : '',
      disabled ? 'disabled' : '',
    ].filter(Boolean).join(' ');
    return html`
      <span
        part=${parts}
        role="radio"
        tabindex=${disabled || !this.groupTabbable ? '-1' : '0'}
        aria-checked=${this.checked ? 'true' : 'false'}
        aria-disabled=${disabled ? 'true' : 'false'}
        aria-required=${this.effectiveRequired ? 'true' : 'false'}
        aria-label=${this.getAttribute('aria-label') ?? nothing}
        @click=${this.onClick}
        @keydown=${this.onKeyDown}
        @focus=${this.onFocus}
        @blur=${this.onBlur}
      >
        <span part="start prefix"><slot name="start"></slot><slot name="prefix"></slot></span>
        <span part="label"><slot></slot></span>
        <span part="end suffix"><slot name="end"></slot><slot name="suffix"></slot></span>
      </span>
    `;
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-radio-button': LyraRadioButton; } }
