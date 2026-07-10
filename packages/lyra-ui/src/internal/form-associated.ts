import type { LitElement, PropertyValues } from 'lit';

type Constructor<T> = new (...args: any[]) => T;

/** Public surface a `FormAssociated`-mixed element exposes to consumers and subclasses. */
export interface FormAssociatedInterface {
  internals: ElementInternals;
  name: string;
  value: string;
  disabled: boolean;
  required: boolean;
  setFormValue(next: string): void;
  checkValidity(): boolean;
  reportValidity(): boolean;
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
      name: {},
      value: { noAccessor: true },
      disabled: { type: Boolean, reflect: true },
      required: { type: Boolean, reflect: true },
    };

    internals: ElementInternals;

    name = '';
    disabled = false;
    required = false;

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

    constructor(...args: any[]) {
      super(...args);
      this.internals = this.attachInternals();
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
     * blocks form submission — the single highest-leverage correctness gap
     * the 2026-07-10 cross-repo audit found (forms-core §internal/, High).
     */
    protected updateValidity(): void {
      if (this.required && this._value === '') {
        this.internals.setValidity({ valueMissing: true }, 'Please fill out this field.');
      } else {
        this.internals.setValidity({});
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

    formDisabledCallback(disabled: boolean): void {
      this.disabled = disabled;
    }

    connectedCallback(): void {
      super.connectedCallback();
      // `required` may already be set from an attribute by the time this
      // runs; reflect validity from the start, not only after the first
      // `value` write.
      this.updateValidity();
    }

    protected updated(changed: PropertyValues): void {
      super.updated(changed);
      if (changed.has('required')) this.updateValidity();
    }
  }

  return FormAssociatedElement as unknown as T & Constructor<FormAssociatedInterface>;
}
