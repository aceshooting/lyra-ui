import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { chevronIcon } from '../../../internal/icons.js';
import {
  presenceTrueDefaultBooleanConverter,
  trueDefaultBooleanConverter,
} from '../../../internal/converters.js';
import { LyraInput, type LyraInputEventMap } from './input.class.js';
import { dispatchNativeEvent, dispatchNativeInputEvent } from '../../../internal/native-event-relay.js';
import { styles as inputStyles } from './input.styles.js';
import { styles as numberInputStyles } from './number-input.styles.js';
import type { LyraAppearance } from '../../../internal/variants.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_date, LYRA_DEFAULT_details, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_numberInputDecrease, LYRA_DEFAULT_numberInputIncrease, LYRA_DEFAULT_open, LYRA_DEFAULT_restore, LYRA_DEFAULT_search } from '../../../internal/default-strings.generated.js';
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
 * and both properties are independently settable, so `steppers="false"
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
    collapse: LYRA_DEFAULT_collapse,
    date: LYRA_DEFAULT_date,
    details: LYRA_DEFAULT_details,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    numberInputDecrease: LYRA_DEFAULT_numberInputDecrease,
    numberInputIncrease: LYRA_DEFAULT_numberInputIncrease,
    open: LYRA_DEFAULT_open,
    restore: LYRA_DEFAULT_restore,
    search: LYRA_DEFAULT_search,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, inputStyles, numberInputStyles];

  protected override get inputWrapperParts(): string {
    return `${super.inputWrapperParts} number-input`;
  }

  /** Renders the increment/decrement pair inside the control row. Set `steppers="false"` for a
   *  bare numeric field. */
  @property({ converter: trueDefaultBooleanConverter, reflect: true }) steppers = true;
  /** Positive upstream spelling for hiding the stepper pair. The established `steppers` switch
   * remains supported; either `without-steppers` or `steppers="false"` hides the same controls. */
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

  constructor() {
    super();
    this.type = 'number';
    this.addEventListener('focusin', this.onFocusWithin);
    this.addEventListener('focusout', this.onBlurWithin);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.type = 'number';
    this.syncMappedStates();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('value')) this.syncMappedStates();
  }

  private syncMappedStates(): void {
    if (this.value === '') this.internals.states.add('blank');
    else this.internals.states.delete('blank');
  }

  private onFocusWithin = (): void => {
    this.internals.states.add('focused');
  };

  private onBlurWithin = (): void => {
    this.internals.states.delete('focused');
  };

  private stepFromButton(direction: 'up' | 'down'): void {
    if (this.effectiveDisabled || this.readonly) return;
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
    if (!this.steppers || this.withoutSteppers) return nothing;
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
        <slot name="decrement-icon">${chevronIcon()}</slot>
      </button>
      <button
        part="stepper stepper-increment stepper-up"
        type="button"
        tabindex="-1"
        ?disabled=${inert}
        aria-label=${this.localize('numberInputIncrease')}
        @click=${this.onStepUp}
      >
        <slot name="increment-icon">${chevronIcon()}</slot>
      </button>
    `;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-number-input': LyraNumberInput; } }
