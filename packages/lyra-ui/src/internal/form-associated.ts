import type { LitElement } from 'lit';
import { resolveLyraString } from './localization.js';
import {
  AnchoredValidityController,
  SET_ANCHORED_VALIDITY,
  VALIDITY_ANCHOR,
} from './anchored-validity.js';

type Constructor<T> = new (...args: any[]) => T;

/** Public surface a `FormAssociated`-mixed element exposes to consumers and subclasses. */
export interface FormAssociatedInterface {
  internals: ElementInternals;
  name: string;
  value: string;
  disabled: boolean;
  required: boolean;
  readonly effectiveDisabled: boolean;
  readonly form: HTMLFormElement | null;
  readonly labels: NodeList;
  readonly validity: ValidityState;
  readonly validationMessage: string;
  readonly willValidate: boolean;
  setFormValue(next: string): void;
  checkValidity(): boolean;
  reportValidity(): boolean;
  formResetCallback(): void;
  formStateRestoreCallback(state: string | File | FormData | null, mode?: 'restore' | 'autocomplete'): void;
  /** @internal */
  [SET_ANCHORED_VALIDITY](flags: ValidityStateFlags, message?: string): void;
}

/**
 * Mixin that turns a Lit component into a form-associated custom element via
 * `ElementInternals`, so it participates in native `<form>` submission,
 * validation, and reset — matching Web Awesome's free form controls.
 *
 * `value` uses a hand-written accessor (`noAccessor`) so `setFormValue` runs
 * synchronously on assignment rather than on the async update cycle.
 *
 * The explicit return-type annotation is required so TypeScript can emit a
 * declaration file for the (otherwise anonymous) mixin class (avoids TS4094).
 */
export function FormAssociated<T extends Constructor<LitElement>>(
  Base: T,
): T & Constructor<FormAssociatedInterface> {
  class FormAssociatedElement extends Base {
    static formAssociated = true;

    static properties = {
      name: { reflect: true, noAccessor: true },
      value: { noAccessor: true },
      disabled: { type: Boolean, reflect: true, noAccessor: true },
      required: { type: Boolean, reflect: true, noAccessor: true },
    };

    internals: ElementInternals;
    private validityController: AnchoredValidityController;

    private _fieldsetDisabled = false;
    private _disabled = false;

    // Hand-written accessor (mirrors `value`/`required` below): native form
    // submission for a form-associated custom element keys its `FormData`
    // entry off the `name` *content attribute*, read synchronously at
    // submission time — an async (Lit-scheduled) reflection would leave a
    // property-only assignment like `el.name = 'foo'` invisible to a
    // same-tick `new FormData(form)`/submit.
    private _name = '';

    private _value = '';
    // What native `defaultValue`/`form.reset()` restores to. Mirrors the
    // `value` *content attribute* only (see `attributeChangedCallback`
    // below) — exactly like native `<input>`: setting the `.value` IDL
    // property (whether from a user typing, a picker commit, or a
    // consumer's own script) never touches `defaultValue`, only
    // `setAttribute('value', ...)`/declarative markup does. Using the
    // property setter itself to capture "whichever assignment happens
    // first" would wrongly let a user's first-ever edit become permanent
    // (a required field could never be reset back to blank again).
    private _defaultValue = '';

    private _required = false;

    constructor(...args: any[]) {
      super(...args);
      this.internals = this.attachInternals();
      this.validityController = new AnchoredValidityController(
        this,
        this.internals,
        () => this[VALIDITY_ANCHOR](),
      );
      // Native <input> always has a submission value ("") from construction —
      // without this, a control whose `value` is never touched is entirely
      // absent from FormData instead of present as "".
      this.internals.setFormValue('');
    }

    get form(): HTMLFormElement | null {
      return this.internals.form;
    }

    get labels(): NodeList {
      return this.internals.labels;
    }

    get validity(): ValidityState {
      return this.internals.validity;
    }

    get validationMessage(): string {
      return this.internals.validationMessage;
    }

    get willValidate(): boolean {
      return this.internals.willValidate;
    }

    /** @internal */
    [VALIDITY_ANCHOR](): HTMLElement | null {
      return this.renderRoot?.querySelector(
        "input:not([type='hidden']), textarea, select, button, [tabindex]:not([tabindex='-1'])",
      ) ?? null;
    }

    /** @internal */
    [SET_ANCHORED_VALIDITY](flags: ValidityStateFlags, message = ''): void {
      this.validityController.setValidity(flags, message);
    }

    get name(): string {
      return this._name;
    }

    set name(next: string) {
      const old = this._name;
      this._name = next ?? '';
      if (this._name) {
        this.setAttribute('name', this._name);
      } else {
        this.removeAttribute('name');
      }
      this.requestUpdate('name', old);
    }

    get value(): string {
      return this._value;
    }

    set value(next: string) {
      const old = this._value;
      this._value = next ?? '';
      this.internals.setFormValue(this._value);
      this.updateValidity();
      this.requestUpdate('value', old);
    }

    get disabled(): boolean {
      return this._disabled;
    }

    set disabled(next: boolean) {
      const old = this._disabled;
      this._disabled = Boolean(next);
      // FACE omission and barred validation are driven by the live host
      // attribute, so reflection must happen before same-tick form APIs run.
      this.toggleAttribute('disabled', this._disabled);
      this.requestUpdate('disabled', old);
    }

    get required(): boolean {
      return this._required;
    }

    set required(next: boolean) {
      const old = this._required;
      this._required = next;
      this.toggleAttribute('required', next);
      this.updateValidity();
      this.requestUpdate('required', old);
    }

    /** Effective disabled state: this element's own `disabled` OR an ancestor
     *  `<fieldset disabled>`'s inherited state — mirrors native `<input>`, whose
     *  own `disabled` IDL property/attribute is never mutated by a fieldset. */
    get effectiveDisabled(): boolean {
      return this.disabled || this._fieldsetDisabled;
    }

    attributeChangedCallback(name: string, old: string | null, value: string | null): void {
      super.attributeChangedCallback(name, old, value);
      if (name === 'value') {
        // Runs after the base class has already applied the attribute to
        // the `value` property (via the setter above), so `_value` here
        // reflects the newly-parsed/assigned attribute value.
        this._defaultValue = this._value;
      }
    }

    /** Programmatically set the submitted value (alias kept for clarity). */
    setFormValue(next: string): void {
      this.value = next;
    }

    /**
     * Recomputes `ElementInternals`'s validity state. Without this,
     * `internals` defaults to permanently "valid" and `required` never
     * blocks form submission.
     */
    protected updateValidity(): void {
      if (this.required && this._value === '') {
        const localize = (this as unknown as { localize?: (key: string) => string }).localize;
        const message = localize?.call(this, 'fieldRequired') ?? resolveLyraString(this, 'fieldRequired');
        this[SET_ANCHORED_VALIDITY]({ valueMissing: true }, message);
      } else {
        this[SET_ANCHORED_VALIDITY]({});
      }
    }

    checkValidity(): boolean {
      return this.internals.checkValidity();
    }

    reportValidity(): boolean {
      return this.internals.reportValidity();
    }

    formResetCallback(): void {
      // Restore the constructed default value (native `defaultValue`
      // semantics) — previously this unconditionally blanked the field.
      this.value = this._defaultValue;
    }

    formStateRestoreCallback(
      state: string | File | FormData | null,
      _mode?: 'restore' | 'autocomplete',
    ): void {
      this.value = typeof state === 'string' ? state : '';
    }

    /**
     * Called by the browser when an ancestor `<fieldset disabled>` toggles.
     * Tracked separately from the consumer's own `disabled` (see
     * `effectiveDisabled`) — a native `<input>`'s own `disabled` IDL
     * property/attribute is never mutated by fieldset cascading, so a
     * consumer's explicit `disabled` must survive the fieldset re-enabling.
     */
    formDisabledCallback(fieldsetDisabled: boolean): void {
      this._fieldsetDisabled = fieldsetDisabled;
      this.requestUpdate();
    }

    connectedCallback(): void {
      super.connectedCallback();
      // `required` may already be set from an attribute by the time this
      // runs; reflect validity from the start, not only after the first
      // `value` write.
      this.updateValidity();
    }
  }

  return FormAssociatedElement as unknown as T & Constructor<FormAssociatedInterface>;
}
