import { shouldIgnoreNavigationKey } from '../../../internal/list-navigation.js';
import { isLiveDisabled } from '../../../internal/form-associated.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { chevronIcon } from '../../../internal/icons.js';
import {
  presenceTrueDefaultBooleanConverter,
} from '../../../internal/converters.js';
import { LyraInput } from './input.class.js';
import type { LyraInputEventMap } from './input-shared.js';
import { dispatchNativeEvent, dispatchNativeInputEvent } from '../../../internal/native-event-relay.js';
import { setCustomState } from '../../../internal/custom-states.js';
import { styles as numberInputStyles } from './number-input.styles.js';
import type { LyraAppearance } from '../../../internal/variants.js';
import type { LyraFormValidator } from '../form-validator.js';
import { isBarredFromValidation } from '../../../internal/form-associated.js';
import { SET_ANCHORED_VALIDITY } from '../../../internal/anchored-validity.js';
import { formatLocaleNumber, parseLocaleNumber } from './number-input-locale.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_numberInputDecrease, LYRA_DEFAULT_numberInputIncrease } from '../../../internal/default-strings/forms.generated.js';
import { LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_valueInvalid } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** Number-input events, including the native cancelable edit veto exposed by its mapped API. */
export interface LyraNumberInputEventMap extends LyraInputEventMap {
  beforeinput: InputEvent;
}

/**
 * `<lr-number-input>` — a numeric field with the complete `lr-input` form, validation, and native
 * editing contract, plus its own increment/decrement stepper pair.
 *
 * The steppers replace the browser's built-in spin buttons rather than sitting beside them:
 * `withoutSpinButtons` therefore defaults to `true` here (it defaults to `false` on `<lr-input>`),
 * and both properties are independently settable, so `without-steppers
 * without-spin-buttons="false"` returns the field to a plain native `<input type="number">`.
 *
 * Each stepper drives the inherited `stepUp()`/`stepDown()`, so `min`/`max` clamping and decimal
 * handling are the platform's. Unlike those silent methods, a stepper *click* is a user edit and
 * emits the same `input`/`lr-input`/`change`/`lr-change` sequence typing would — but only when the
 * value actually moved, so clicking at a bound is inert rather than emitting a no-op edit.
 *
 * The steppers are deliberately outside the tab order (`tabindex="-1"`), like the native spin
 * buttons they stand in for: a keyboard user steps the value with ArrowUp/ArrowDown on the field
 * itself, which the native `<input type="number">` already handles, so making them tab stops would
 * add two stops per field for no new capability. A click returns focus to the field.
 *
 * The component retains the complete shared size sheet inherited conceptually from `lr-input`:
 * compact tiers grow only enough for the stepper hit targets, while `l` and `xl` retain their
 * larger control heights. The mirrored `small`, `medium`, and `large` spellings render exactly as
 * canonical `s`, `m`, and `l`, including row height, padding, and native-input font size.
 *
 * `localized` opts into locale-aware entry: the field then reads and shows numbers with the
 * grouping and decimal separators of the effective locale (`25.000` and `10,24` in `de`), while
 * `value`, the submitted form value, `valueAsNumber` and range/step validity keep the native
 * `type="number"` form (`25000`, `10.24`). The internal input becomes a text field with spinbutton
 * semantics; ArrowUp/ArrowDown step the value as the native field does. Grouping is checked, so
 * text the locale would not write (`10.24` in `de`, `10,24` in `en`) reports `badInput` instead
 * of being misread. Typed text stays as entered until `change` or blur, which re-format it.
 *
 * Inherited stepUp/stepDown use pending value, step, min, and max properties synchronously
 * and remain event-silent. Removed label/hint/help-text/error-text content is safely omitted.
 *
 * @customElement lr-number-input
 * @event beforeinput - The internal native input's cancelable `InputEvent`, which bubbles and
 *   composes through the host. Calling `preventDefault()` on the host vetoes the edit.
 * @slot decrement-icon - Replaces the decrement stepper's built-in chevron.
 * @slot increment-icon - Replaces the increment stepper's built-in chevron.
 * @csspart base - Compatibility name for the control row; use `number-input`.
 * @csspart number-input - The numeric control row. It is the same node as `base` and the inherited
 *   `input-wrapper` part.
 * @csspart stepper - Shared part on both stepper buttons.
 * @csspart stepper-increment - The increment button.
 * @csspart stepper-decrement - The decrement button.
 * @csspart stepper-up - Lyra compatibility name on `stepper-increment`.
 * @csspart stepper-down - Lyra compatibility name on `stepper-decrement`.
 * @cssstate blank - The live value is empty.
 * @cssstate focused - Focus is within the numeric input.
 * @status stable
 * @since 4.0.0
 */
export class LyraNumberInput extends LyraInput {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    numberInputDecrease: LYRA_DEFAULT_numberInputDecrease,
    numberInputIncrease: LYRA_DEFAULT_numberInputIncrease,
    valueInvalid: LYRA_DEFAULT_valueInvalid,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  /** Public WA-compatible catalog, inherited without narrowing its accepted base-input type. */
  static override get validators(): LyraFormValidator<LyraInput>[] {
    return super.validators;
  }
  static override styles = [...LyraInput.styles, numberInputStyles];

  protected override get inputWrapperParts(): string {
    return `${super.inputWrapperParts} number-input`;
  }

  /** Reads and shows numbers with the grouping and decimal separators of the effective locale
   *  (`lang`/`locale`), e.g. `25.000` and `10,24` in `de`. `value` and the submitted form value stay
   *  in the native `type="number"` form (`25000`, `10.24`). Unset (the default) keeps the native
   *  number field unchanged. Pair it with `inputmode="decimal"` when fractions are expected, so
   *  touch keyboards offer the decimal separator. */
  @property({ type: Boolean, reflect: true }) localized = false;

  /** Hides the increment/decrement pair for a bare numeric field. */
  @property({ type: Boolean, attribute: 'without-steppers' }) withoutSteppers = false;

  /** Numeric inputs use the outlined field treatment by default. */
  @property({ reflect: true }) override appearance: LyraAppearance = 'outlined';
  /** Requests a numeric virtual keyboard unless the consumer chooses `decimal`. */
  @property({ attribute: 'inputmode' }) override inputMode = 'numeric';
  /** Native step-grid default. */
  @property() override step: number | 'any' | undefined = 1;
  /** Defaults to `true` here (unlike `<lr-input>`) so the component's own steppers are not shown
   *  alongside the browser's built-in spin buttons. `without-spin-buttons="false"` brings the
   *  native pair back. */
  @property({ attribute: 'without-spin-buttons', converter: presenceTrueDefaultBooleanConverter, reflect: true })
  override withoutSpinButtons = true;

  // Text typed in localized mode, kept as entered until the edit is committed; `null` shows the
  // formatted `value`. `pendingTextEdit` carries a parse from `valueFromNativeText()` into the
  // `value` write that immediately follows it, so only that write keeps the typed text.
  private draftText: string | null = null;
  private pendingTextEdit?: { text: string; value: string };
  private localizedProbe?: HTMLInputElement;

  constructor() {
    super();
    this.type = 'number';
    this.addEventListener('focusin', this.onFocusWithin);
    this.addEventListener('focusout', this.onBlurWithin);
    this.addEventListener('change', this.commitDraft);
    this.addEventListener('keydown', this.onLocalizedKeyDown);
  }

  override get value(): string {
    return super.value;
  }

  override set value(next: string | null) {
    const edit = this.pendingTextEdit;
    this.pendingTextEdit = undefined;
    this.draftText = edit !== undefined && edit.value === (next ?? '') ? edit.text : null;
    super.value = next;
  }

  protected override get nativeInputType(): string {
    return this.localized ? 'text' : super.nativeInputType;
  }

  protected override get nativeInputText(): string {
    if (!this.localized) return super.nativeInputText;
    return this.draftText ?? formatLocaleNumber(this.value, this.effectiveLocale);
  }

  protected override valueFromNativeText(text: string): string {
    if (!this.localized) return super.valueFromNativeText(text);
    const value = parseLocaleNumber(text, this.effectiveLocale) ?? '';
    this.pendingTextEdit = { text, value };
    return value;
  }

  /** A detached `type="number"` input carrying the live constraints, so a localized field keeps
   *  the platform's own stepping, `valueAsNumber` and range/step/required validity. */
  protected override get constraintControl(): HTMLInputElement | null {
    const rendered = super.constraintControl;
    if (!this.localized || !rendered) return rendered;
    const probe = (this.localizedProbe ??= this.ownerDocument.createElement('input'));
    probe.type = 'number';
    probe.min = this.min == null ? '' : String(this.min);
    probe.max = this.max == null ? '' : String(this.max);
    probe.step = this.step == null ? '' : String(this.step);
    probe.required = this.required;
    return probe;
  }

  /** Whether the localized field holds typed text that does not parse in the effective locale. */
  private get hasUnparsedDraft(): boolean {
    return this.localized && this.draftText !== null && parseLocaleNumber(this.draftText, this.effectiveLocale) === null;
  }

  protected override updateValidity(): void {
    if (this.hasUnparsedDraft && !isBarredFromValidation(this, this.internals)) {
      this[SET_ANCHORED_VALIDITY]({ badInput: true }, this.localize('valueInvalid'));
      return;
    }
    super.updateValidity();
  }

  private commitDraft = (): void => {
    if (this.draftText === null || this.hasUnparsedDraft) return;
    this.draftText = null;
    this.requestUpdate();
  };

  private onLocalizedKeyDown = (event: KeyboardEvent): void => {
    if (!this.localized || event.defaultPrevented || shouldIgnoreNavigationKey(event)) return;
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    if (event.composedPath()[0] !== this.input) return;
    event.preventDefault();
    this.stepFromButton(event.key === 'ArrowUp' ? 'up' : 'down');
  };

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('localized')) this.updateValidity();
    this.syncSpinbuttonSemantics();
  }

  /** A text field loses the implicit spinbutton role of `type="number"`; restore it, and its
   *  value attributes, while localized. Lit does not own these attributes, so they are cleared
   *  again when the field returns to the native number input. */
  private syncSpinbuttonSemantics(): void {
    const native = this.input;
    if (!native) return;
    const attributes: Record<string, string | null> = { role: null, 'aria-valuenow': null, 'aria-valuetext': null, 'aria-valuemin': null, 'aria-valuemax': null };
    if (this.localized) {
      const number = this.valueAsNumber;
      const min = Number(this.min);
      const max = Number(this.max);
      attributes['role'] = 'spinbutton';
      attributes['aria-valuenow'] = Number.isFinite(number) ? String(number) : null;
      attributes['aria-valuetext'] = native.value === '' ? null : native.value;
      attributes['aria-valuemin'] = this.min != null && String(this.min) !== '' && Number.isFinite(min) ? String(min) : null;
      attributes['aria-valuemax'] = this.max != null && String(this.max) !== '' && Number.isFinite(max) ? String(max) : null;
    }
    for (const [name, value] of Object.entries(attributes)) {
      if (value === null) native.removeAttribute(name);
      else if (native.getAttribute(name) !== value) native.setAttribute(name, value);
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.type = 'number';
    this.syncMappedStates();
  }

  private syncMappedStates(): void {
    setCustomState(this.internals, 'blank', this.value === '');
  }

  private onFocusWithin = (): void => {
    setCustomState(this.internals, 'focused', true);
  };

  private onBlurWithin = (): void => {
    setCustomState(this.internals, 'focused', false);
    this.commitDraft();
  };

  private stepFromButton(direction: 'up' | 'down'): void {
    if (isLiveDisabled(this) || this.readonly) return;
    const before = this.value;
    if (direction === 'up') this.stepUp();
    else this.stepDown();
    if (this.value !== before) {
      dispatchNativeInputEvent(this, { inputType: 'insertReplacementText' });
      this.emit('lr-input', { value: this.value });
      dispatchNativeEvent(this, 'change');
      this.emit('lr-change', { value: this.value });
    }
    // The buttons are not tab stops, so a click would otherwise leave focus nowhere useful --
    // hand it to the field the user is editing, matching the clear button's own behavior.
    this.input?.focus();
  }

  private onStepUp = (): void => {
    this.stepFromButton('up');
  };

  private onStepDown = (): void => {
    this.stepFromButton('down');
  };

  protected override renderControls(): TemplateResult | typeof nothing {
    if (this.withoutSteppers) return nothing;
    const inert = this.effectiveDisabled || this.readonly;
    return html`
      <button
        part="stepper stepper-decrement stepper-down"
        type="button"
        tabindex="-1"
        ?disabled=${inert}
        aria-label=${this.localize('numberInputDecrease')}
        @click=${this.onStepDown}
      >
        <span aria-hidden="true" inert><slot name="decrement-icon">${chevronIcon()}</slot></span>
      </button>
      <button
        part="stepper stepper-increment stepper-up"
        type="button"
        tabindex="-1"
        ?disabled=${inert}
        aria-label=${this.localize('numberInputIncrease')}
        @click=${this.onStepUp}
      >
        <span aria-hidden="true" inert><slot name="increment-icon">${chevronIcon()}</slot></span>
      </button>
    `;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-number-input': LyraNumberInput; } }
