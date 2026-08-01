import { html, nothing, type TemplateResult } from 'lit';
import { LyraElement } from '../../../internal/lyra-element.js';
import { sizes } from '../../../internal/sizes.styles.js';
import { LyraRadio } from './radio.class.js';
import { styles } from './radio-button.styles.js';

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
 *
 * @customElement lr-radio-button
 * @slot - Label text.
 * @slot prefix - Content placed before the label, typically an icon.
 * @slot suffix - Content placed after the label.
 * @event input - The user selected this radio.
 * @event change - The user selected this radio.
 * @event lr-change - A standalone radio button was selected. `detail: { checked, value }`. An
 * owning radio group emits its aggregate event instead.
 * @event focus - The internal control received focus.
 * @event blur - The internal control lost focus.
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
 * @csspart prefix - The leading-content wrapper.
 * @csspart label - The default slot wrapper.
 * @csspart suffix - The trailing-content wrapper.
 * @cssprop [--lr-radio-radius=var(--lr-form-control-radius)] - Corner radius of the outer edges of
 * the button row. Inherited from `<lr-radio>` and re-pointed here at the shared control radius;
 * `pill` swaps it for `--lr-radius-pill`.
 */
export class LyraRadioButton extends LyraRadio {
  static override styles = [LyraElement.styles, sizes, styles];

  override render(): TemplateResult {
    const disabled = this.effectiveDisabled;
    const parts = ['base', this.checked ? 'checked' : '', disabled ? 'disabled' : ''].filter(Boolean).join(' ');
    return html`
      <span
        part=${parts}
        role="radio"
        tabindex=${disabled || !this.groupTabbable ? '-1' : '0'}
        aria-checked=${this.checked ? 'true' : 'false'}
        aria-disabled=${disabled ? 'true' : 'false'}
        aria-required=${this.effectiveRequired ? 'true' : 'false'}
        aria-label=${this.getAttribute('aria-label') || nothing}
        @click=${this.onClick}
        @keydown=${this.onKeyDown}
        @focus=${this.onFocus}
        @blur=${this.onBlur}
      >
        <span part="prefix"><slot name="prefix"></slot></span>
        <span part="label"><slot></slot></span>
        <span part="suffix"><slot name="suffix"></slot></span>
      </span>
    `;
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-radio-button': LyraRadioButton; } }
