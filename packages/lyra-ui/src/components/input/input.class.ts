import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { FormAssociated } from '../../internal/form-associated.js';
import { SET_ANCHORED_VALIDITY } from '../../internal/anchored-validity.js';
import { closeIcon, eyeIcon, eyeOffIcon } from '../../internal/icons.js';
import { styles } from './input.styles.js';

export type LyraInputType = 'text' | 'password' | 'email' | 'number' | 'time' | 'search';
export type LyraInputSize = '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl';

const spellcheckConverter = {
  fromAttribute: (value: string | null): boolean => value !== 'false',
  toAttribute: (value: boolean): string => (value ? 'true' : 'false'),
};

export interface LyraInputEventMap {
  input: CustomEvent<undefined>;
  change: CustomEvent<undefined>;
  'lr-input': CustomEvent<{ value: string }>;
  'lr-change': CustomEvent<{ value: string }>;
  'lr-clear': CustomEvent<undefined>;
  blur: CustomEvent<undefined>;
  focus: CustomEvent<undefined>;
}
class LyraInputBase extends LyraElement<LyraInputEventMap> {}

/**
 * `<lr-input>` — a single-line plain-text input primitive, the `lr-*` equivalent of a plain
 * `wa-input`, form-associated via the `FormAssociated` mixin (same shape as `<lr-textarea>`).
 *
 * Ships the same opt-in `label`/`hint`/`errorText` form-control chrome as `<lr-textarea>`/
 * `<lr-select>` (props + matching named slots + `form-control`/`form-control-label`/`hint`/`error`
 * parts) — left unset, the chrome stays hidden. `size` uses the same `xs`–`xl` scale as
 * `<lr-select>`/`<lr-combobox>`. `type="password"` always renders a
 * `password-toggle` eye-icon button that flips the internal native input between
 * `type="password"`/`type="text"` and tracks `passwordVisible`. `type="email"`/`type="number"`
 * (with `min`/`max`/`step`) delegate constraint validation to the internal native `<input>`'s own
 * browser-computed `validity`, bridged into this element's `ElementInternals` by `updateValidity()`.
 * `type="search"`/`type="time"` forward straight through to the native input with no additional
 * chrome or validation, the same as `type="text"`.
 *
 * A host `aria-label` is forwarded to the internal textbox via the typed `accessibleLabel` property;
 * external `aria-labelledby`/`aria-describedby` idrefs are not copied across the shadow boundary.
 *
 * @customElement lr-input
 * @event input - Native-style composed event fired on every user-driven edit.
 * @event change - Native-style composed event fired at the native `change` timing.
 * @event lr-input - Compatibility alias for `input`; `detail: { value }`.
 * @event lr-change - Compatibility alias for `change`; `detail: { value }`.
 * @event lr-clear - The built-in clear button cleared a text/search value, after the input/change events.
 * @event blur - Re-dispatched from the internal native `<input>`'s own `blur` — bubbling and
 *   composed (unlike the native event, which is neither).
 * @event focus - Re-dispatched from the internal native `<input>`'s own `focus`, for the same reason as `blur`.
 * @slot label - Custom label content.
 * @slot hint - Custom hint content.
 * @slot error - Custom error content.
 * @slot start - Adornment before the native input.
 * @slot end - Adornment after the native input and built-in actions.
 * @csspart form-control - The outer wrapper around label, input, error and hint.
 * @csspart form-control-label - The `<label>` element.
 * @csspart input-wrapper - The row wrapping the native input and the password-toggle button.
 * @csspart input - The native `<input>` element.
 * @csspart start - Wrapper around the `start` adornment slot.
 * @csspart end - Wrapper around the `end` adornment slot.
 * @csspart clear-button - The clear action, rendered for non-empty clearable text/search inputs.
 * @csspart password-toggle - The show/hide-password button, present only when `type="password"`.
 * @csspart hint - The hint message.
 * @csspart error - The error message.
 * @cssprop --lr-input-control-min-height - Outer control height floor, scaled by `size`.
 */
export class LyraInput extends FormAssociated(LyraInputBase) {
  static styles = [LyraElement.styles, styles];

  @property() type: LyraInputType = 'text';
  /** Visual size — same `2xs`–`xl` scale as `lr-select`/`lr-combobox`'s own `size`. `'2xs'` is
   *  the tightest tier, for dense toolbar-embedded controls. */
  @property({ reflect: true }) size: LyraInputSize = 'm';
  @property() placeholder = '';
  /** Shows a built-in clear action for non-empty `text` and `search` inputs. */
  @property({ type: Boolean, reflect: true }) clearable = false;
  /** Forwards native read-only behavior to the internal input and disables the clear action. */
  @property({ type: Boolean, reflect: true }) readonly = false;
  @property() label = '';
  @property() hint = '';
  @property({ attribute: 'error-text' }) errorText = '';
  /** Accessible name overriding the label/placeholder-derived default. Takes precedence over both
   *  `label` and `placeholder` when set, matching `<lr-textarea>`'s `accessibleLabel`. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;
  @property() autocomplete = '';
  @property({ converter: spellcheckConverter }) spellcheck = true;
  @property() autocapitalize = '';
  @property({ attribute: 'autocorrect' }) autoCorrect = '';
  @property({ attribute: 'inputmode' }) inputMode = '';
  @property({ attribute: 'enterkeyhint' }) enterKeyHint = '';
  /** `type="number"` only — forwarded to the internal native `<input>`'s own `min`/`max`/`step`
   *  and consulted by that same native input's constraint validation (see `updateValidity()`). */
  // numeric-guard-exempt: passed straight through to the native <input min> and its own
  // ValidityState.rangeUnderflow check, both of which already tolerate a non-finite value
  // without throwing; never used in arithmetic in this file.
  @property({ type: Number }) min?: number;
  // numeric-guard-exempt: same rationale as `min` above, for the native <input max> attribute.
  @property({ type: Number }) max?: number;
  /** Accepts `'any'` (the native way to disable step validation) in addition to a numeric step. */
  @property() step?: number | 'any';
  /** `type="password"` only — whether the field currently reveals its raw text. Toggled by the
   *  built-in `password-toggle` button; also settable by a consumer up front. */
  @property({ type: Boolean, attribute: 'password-visible' }) passwordVisible = false;

  @state() private hasHintSlot = false;
  @state() private hasErrorSlot = false;
  @state() private hasLabelSlot = false;
  @state() private touched = false;
  @state() private hasStartSlot = false;
  @state() private hasEndSlot = false;

  @query('input') private inputEl?: HTMLInputElement;

  constructor() {
    super();
    this.addEventListener('invalid', () => { this.touched = true; });
  }

  formResetCallback(): void {
    super.formResetCallback();
    this.touched = false;
  }

  /** The internal native `<input>` element, for direct DOM access — mirrors `<lr-textarea>`'s own `input` getter. */
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
    if (this.readonly) {
      this[SET_ANCHORED_VALIDITY]({});
      return;
    }
    if (!native) {
      if (this.required && this.value === '') {
        this[SET_ANCHORED_VALIDITY]({ valueMissing: true }, this.localize('fieldRequired'));
      } else {
        this[SET_ANCHORED_VALIDITY]({});
      }
      return;
    }
    if (native.value !== this.value) native.value = this.value;
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
    if (changed.has('type') || changed.has('min') || changed.has('max') || changed.has('step') || changed.has('readonly')) {
      this.updateValidity();
    }
  }

  protected willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!this.hasUpdated) {
      this.hasStartSlot = Array.from(this.children).some((element) => element.getAttribute('slot') === 'start');
      this.hasEndSlot = Array.from(this.children).some((element) => element.getAttribute('slot') === 'end');
    }
  }

  private onInput = (): void => {
    if (!this.inputEl) return;
    this.value = this.inputEl.value;
    this.emit('input');
    this.emit('lr-input', { value: this.value });
  };

  private onChange = (): void => {
    if (!this.inputEl) return;
    this.value = this.inputEl.value;
    this.emit('change');
    this.emit('lr-change', { value: this.value });
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

  private onClear = (): void => {
    if (this.effectiveDisabled || this.readonly || this.value === '') return;
    this.value = '';
    if (this.inputEl) this.inputEl.value = '';
    this.emit('input');
    this.emit('lr-input', { value: this.value });
    this.emit('change');
    this.emit('lr-change', { value: this.value });
    this.emit('lr-clear');
    this.inputEl?.focus();
  };

  private onStartSlotChange = (e: Event): void => {
    this.hasStartSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onEndSlotChange = (e: Event): void => {
    this.hasEndSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
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
    const canClear = this.clearable && (this.type === 'text' || this.type === 'search') && this.value !== '';
    return html`
      <div part="form-control">
        <label part="form-control-label" for="input" ?hidden=${!hasLabel}>
          ${this.label}<slot name="label" @slotchange=${this.onLabelSlotChange}></slot>
        </label>
        <div part="input-wrapper">
          <span part="start" ?hidden=${!this.hasStartSlot}>
            <slot name="start" @slotchange=${this.onStartSlotChange}></slot>
          </span>
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
            ?readonly=${this.readonly}
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
          ${canClear
            ? html`<button
                part="clear-button"
                type="button"
                ?disabled=${this.effectiveDisabled || this.readonly}
                aria-label=${this.localize('clear')}
                @click=${this.onClear}
              >
                ${closeIcon()}
              </button>`
            : nothing}
          <span part="end" ?hidden=${!this.hasEndSlot}>
            <slot name="end" @slotchange=${this.onEndSlotChange}></slot>
          </span>
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
    'lr-input': LyraInput;
  }
}
