import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { FormAssociated } from '../../internal/form-associated.js';
import { SET_ANCHORED_VALIDITY } from '../../internal/anchored-validity.js';
import { eyeIcon, eyeOffIcon } from '../../internal/icons.js';
import { styles } from './input.styles.js';

export type LyraInputType = 'text' | 'password' | 'email' | 'number' | 'time';
export type LyraInputSize = 'xs' | 's' | 'm' | 'l' | 'xl';

const spellcheckConverter = {
  fromAttribute: (value: string | null): boolean => value !== 'false',
  toAttribute: (value: boolean): string => (value ? 'true' : 'false'),
};

export interface LyraInputEventMap {
  input: CustomEvent<undefined>;
  change: CustomEvent<undefined>;
  'lyra-input': CustomEvent<{ value: string }>;
  'lyra-change': CustomEvent<{ value: string }>;
  blur: CustomEvent<undefined>;
  focus: CustomEvent<undefined>;
}
class LyraInputBase extends LyraElement<LyraInputEventMap> {}

/**
 * `<lyra-input>` — a single-line plain-text input primitive, the `lyra-*` equivalent of a plain
 * `wa-input`, form-associated via the `FormAssociated` mixin (same shape as `<lyra-textarea>`).
 *
 * Ships the same opt-in `label`/`hint`/`errorText` form-control chrome as `<lyra-textarea>`/
 * `<lyra-select>` (props + matching named slots + `form-control`/`form-control-label`/`hint`/`error`
 * parts) — left unset, the chrome stays hidden. `size` uses the same `xs`–`xl` scale as
 * `<lyra-select>`/`<lyra-combobox>`. `type="password"` always renders a
 * `password-toggle` eye-icon button that flips the internal native input between
 * `type="password"`/`type="text"` and tracks `passwordVisible`. `type="email"`/`type="number"`
 * (with `min`/`max`/`step`) delegate constraint validation to the internal native `<input>`'s own
 * browser-computed `validity`, bridged into this element's `ElementInternals` by `updateValidity()`.
 *
 * A host `aria-label` is forwarded to the internal textbox via the typed `accessibleLabel` property;
 * external `aria-labelledby`/`aria-describedby` idrefs are not copied across the shadow boundary.
 *
 * @customElement lyra-input
 * @event input - Native-style composed event fired on every user-driven edit.
 * @event change - Native-style composed event fired at the native `change` timing.
 * @event lyra-input - Compatibility alias for `input`; `detail: { value }`.
 * @event lyra-change - Compatibility alias for `change`; `detail: { value }`.
 * @event blur - Re-dispatched from the internal native `<input>`'s own `blur` — bubbling and
 *   composed (unlike the native event, which is neither).
 * @event focus - Re-dispatched from the internal native `<input>`'s own `focus`, for the same reason as `blur`.
 * @slot label - Custom label content.
 * @slot hint - Custom hint content.
 * @slot error - Custom error content.
 * @csspart form-control - The outer wrapper around label, input, error and hint.
 * @csspart form-control-label - The `<label>` element.
 * @csspart input-wrapper - The row wrapping the native input and the password-toggle button.
 * @csspart input - The native `<input>` element.
 * @csspart password-toggle - The show/hide-password button, present only when `type="password"`.
 * @csspart hint - The hint message.
 * @csspart error - The error message.
 */
export class LyraInput extends FormAssociated(LyraInputBase) {
  static styles = [LyraElement.styles, styles];

  @property() type: LyraInputType = 'text';
  /** Visual size — same `xs`–`xl` scale as `lyra-select`/`lyra-combobox`'s own `size`. */
  @property({ reflect: true }) size: LyraInputSize = 'm';
  @property() placeholder = '';
  @property() label = '';
  @property() hint = '';
  @property({ attribute: 'error-text' }) errorText = '';
  /** Accessible name overriding the label/placeholder-derived default. Takes precedence over both
   *  `label` and `placeholder` when set, matching `<lyra-textarea>`'s `accessibleLabel`. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;
  @property() autocomplete = '';
  @property({ converter: spellcheckConverter }) spellcheck = true;
  @property() autocapitalize = '';
  @property({ attribute: 'autocorrect' }) autoCorrect = '';
  @property({ attribute: 'inputmode' }) inputMode = '';
  @property({ attribute: 'enterkeyhint' }) enterKeyHint = '';
  /** `type="number"` only — forwarded to the internal native `<input>`'s own `min`/`max`/`step`
   *  and consulted by that same native input's constraint validation (see `updateValidity()`). */
  @property({ type: Number }) min?: number;
  @property({ type: Number }) max?: number;
  @property({ type: Number }) step?: number;
  /** `type="password"` only — whether the field currently reveals its raw text. Toggled by the
   *  built-in `password-toggle` button; also settable by a consumer up front. */
  @property({ type: Boolean, attribute: 'password-visible' }) passwordVisible = false;

  @state() private hasHintSlot = false;
  @state() private hasErrorSlot = false;
  @state() private hasLabelSlot = false;
  @state() private touched = false;

  @query('input') private inputEl?: HTMLInputElement;

  /** The internal native `<input>` element, for direct DOM access — mirrors `<lyra-textarea>`'s own `input` getter. */
  get input(): HTMLInputElement | null {
    return this.inputEl ?? null;
  }

  override focus(options?: FocusOptions): void {
    this.inputEl?.focus(options);
  }

  override blur(): void {
    this.inputEl?.blur();
  }

  select(): void {
    this.inputEl?.select();
  }

  /**
   * Bridges the internal native `<input>`'s own browser-computed constraint validation (format for
   * `type="email"`, range/step for `type="number"`) into this element's `ElementInternals`, instead
   * of hand-rolling a second regex-based check — a real native input of the right `type` already
   * computes `typeMismatch`/`rangeUnderflow`/`rangeOverflow`/`stepMismatch` correctly. Falls back to
   * the base mixin's plain required-and-empty check before the first render (`inputEl` unset).
   *
   * A typed native input (`number`, `email`, …) also runs its own value-sanitization algorithm on
   * assignment, which silently rewrites an unparseable non-empty value to `''` without setting any
   * `ValidityState` flag — left unchecked, `native.validity.valid` would then read `true` (empty is
   * fine when not required) while `this.value`/the bridged form value still held the literal invalid
   * string. Detect that mismatch and report it as `badInput` instead of trusting native blindly.
   */
  protected updateValidity(): void {
    const native = this.inputEl;
    if (!native) {
      if (this.required && this.value === '') {
        this[SET_ANCHORED_VALIDITY]({ valueMissing: true }, 'Please fill out this field.');
      } else {
        this[SET_ANCHORED_VALIDITY]({});
      }
      return;
    }
    native.value = this.value;
    const sanitizedAway = this.value !== '' && native.value === '';
    const v = native.validity;
    if (v.valid) {
      if (sanitizedAway) {
        this[SET_ANCHORED_VALIDITY]({ badInput: true }, this.localize('valueInvalid'));
        return;
      }
      this[SET_ANCHORED_VALIDITY]({});
      return;
    }
    this[SET_ANCHORED_VALIDITY](
      {
        valueMissing: v.valueMissing,
        typeMismatch: v.typeMismatch,
        rangeUnderflow: v.rangeUnderflow,
        rangeOverflow: v.rangeOverflow,
        stepMismatch: v.stepMismatch,
        badInput: v.badInput,
      },
      native.validationMessage,
    );
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('type') || changed.has('min') || changed.has('max') || changed.has('step')) {
      this.updateValidity();
    }
  }

  private onInput = (): void => {
    if (!this.inputEl) return;
    this.value = this.inputEl.value;
    this.emit('input');
    this.emit('lyra-input', { value: this.value });
  };

  private onChange = (): void => {
    if (!this.inputEl) return;
    this.value = this.inputEl.value;
    this.emit('change');
    this.emit('lyra-change', { value: this.value });
  };

  private onFocus = (): void => {
    this.emit('focus');
  };

  private onBlur = (): void => {
    this.touched = true;
    this.emit('blur');
  };

  private onTogglePasswordVisible = (): void => {
    this.passwordVisible = !this.passwordVisible;
  };

  private onHintSlotChange = (e: Event): void => {
    this.hasHintSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onErrorSlotChange = (e: Event): void => {
    this.hasErrorSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onLabelSlotChange = (e: Event): void => {
    this.hasLabelSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  render(): TemplateResult {
    const hasHint = this.hasHintSlot || this.hint.length > 0;
    const hasError = this.hasErrorSlot || this.errorText.length > 0;
    const hasLabel = this.hasLabelSlot || this.label.length > 0;
    const describedBy = [hasError ? 'input-error' : '', hasHint ? 'input-hint' : ''].filter(Boolean).join(' ');
    const isPassword = this.type === 'password';
    const nativeType = isPassword && this.passwordVisible ? 'text' : this.type;
    return html`
      <div part="form-control">
        <label part="form-control-label" for="input" ?hidden=${!hasLabel}>
          ${this.label}<slot name="label" @slotchange=${this.onLabelSlotChange}></slot>
        </label>
        <div part="input-wrapper">
          <input
            id="input"
            part="input"
            type=${nativeType}
            placeholder=${this.placeholder}
            aria-label=${this.accessibleLabel ||
            (hasLabel ? nothing : this.placeholder || this.localize('inputLabel'))}
            aria-describedby=${describedBy || nothing}
            aria-required=${this.required ? 'true' : 'false'}
            aria-invalid=${hasError || (this.touched && !this.internals.validity.valid) ? 'true' : 'false'}
            autocomplete=${this.autocomplete || nothing}
            spellcheck=${this.spellcheck}
            autocapitalize=${this.autocapitalize || nothing}
            autocorrect=${this.autoCorrect || nothing}
            inputmode=${this.inputMode || nothing}
            enterkeyhint=${this.enterKeyHint || nothing}
            min=${this.min ?? nothing}
            max=${this.max ?? nothing}
            step=${this.step ?? nothing}
            .value=${this.value}
            ?required=${this.required}
            ?disabled=${this.effectiveDisabled}
            @input=${this.onInput}
            @change=${this.onChange}
            @focus=${this.onFocus}
            @blur=${this.onBlur}
          />
          ${isPassword
            ? html`<button
                part="password-toggle"
                type="button"
                ?disabled=${this.effectiveDisabled}
                aria-label=${this.localize(this.passwordVisible ? 'hidePassword' : 'showPassword')}
                aria-pressed=${this.passwordVisible ? 'true' : 'false'}
                @click=${this.onTogglePasswordVisible}
              >
                ${this.passwordVisible ? eyeOffIcon() : eyeIcon()}
              </button>`
            : ''}
        </div>
        <div id="input-error" part="error" ?hidden=${!hasError}>
          ${this.errorText}<slot name="error" @slotchange=${this.onErrorSlotChange}></slot>
        </div>
        <div id="input-hint" part="hint" ?hidden=${!hasHint}>
          ${this.hint}<slot name="hint" @slotchange=${this.onHintSlotChange}></slot>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lyra-input': LyraInput;
  }
}
