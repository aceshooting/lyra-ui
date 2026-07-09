import type { LitElement } from 'lit';

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
      this.requestUpdate('value', old);
    }

    /** Programmatically set the submitted value (alias kept for clarity). */
    setFormValue(next: string): void {
      this.value = next;
    }

    checkValidity(): boolean {
      return this.internals.checkValidity();
    }

    reportValidity(): boolean {
      return this.internals.reportValidity();
    }

    formResetCallback(): void {
      this.value = '';
    }

    formDisabledCallback(disabled: boolean): void {
      this.disabled = disabled;
    }
  }

  return FormAssociatedElement as unknown as T & Constructor<FormAssociatedInterface>;
}
