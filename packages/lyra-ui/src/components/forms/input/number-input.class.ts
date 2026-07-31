import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { chevronIcon } from '../../../internal/icons.js';
import {
  presenceTrueDefaultBooleanConverter,
  trueDefaultBooleanConverter,
} from '../../../internal/converters.js';
import { LyraInput } from './input.class.js';
import { styles as inputStyles } from './input.styles.js';
import { styles as numberInputStyles } from './number-input.styles.js';

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
 * @csspart stepper-up - The increment button, rendered while `steppers` is set.
 * @csspart stepper-down - The decrement button, rendered while `steppers` is set.
 */
export class LyraNumberInput extends LyraInput {
  static override styles = [LyraElement.styles, inputStyles, numberInputStyles];

  /** Renders the increment/decrement pair inside the control row. Set `steppers="false"` for a
   *  bare numeric field. */
  @property({ converter: trueDefaultBooleanConverter, reflect: true }) steppers = true;
  /** Defaults to `true` here (unlike `<lr-input>`) so the component's own steppers are not shown
   *  alongside the browser's built-in spin buttons. `without-spin-buttons="false"` brings the
   *  native pair back. */
  @property({ attribute: 'without-spin-buttons', converter: presenceTrueDefaultBooleanConverter, reflect: true })
  override withoutSpinButtons = true;

  constructor() {
    super();
    this.type = 'number';
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.type = 'number';
  }

  private stepFromButton(direction: 'up' | 'down'): void {
    if (this.effectiveDisabled || this.readonly) return;
    const before = this.value;
    if (direction === 'up') this.stepUp();
    else this.stepDown();
    if (this.value !== before) {
      this.emit('input');
      this.emit('lr-input', { value: this.value });
      this.emit('change');
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
    if (!this.steppers) return nothing;
    const inert = this.effectiveDisabled || this.readonly;
    return html`
      <button
        part="stepper-down"
        type="button"
        tabindex="-1"
        ?disabled=${inert}
        aria-label=${this.localize('numberInputDecrease')}
        @click=${this.onStepDown}
      >
        ${chevronIcon()}
      </button>
      <button
        part="stepper-up"
        type="button"
        tabindex="-1"
        ?disabled=${inert}
        aria-label=${this.localize('numberInputIncrease')}
        @click=${this.onStepUp}
      >
        ${chevronIcon()}
      </button>
    `;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-number-input': LyraNumberInput; } }
