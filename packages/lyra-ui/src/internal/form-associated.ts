import type { LitElement } from 'lit';
import { resolveLyraString } from './localization.js';
import {
  AnchoredValidityController,
  SET_ANCHORED_VALIDITY,
  VALIDITY_ANCHOR,
} from './anchored-validity.js';
import { syncValidityStates } from './custom-states.js';
import { installInvalidEventAlias } from './invalid-event-alias.js';
import { omittedEmptyStringConverter } from './converters.js';

type Constructor<T> = new (...args: any[]) => T;

/** A write to the public `form` IDL may name an owner by id while reads stay element-valued. */
export type FormOwnerValue = string | HTMLFormElement | null;

/** Reflects a form-owner ID without changing the element-valued read contract. */
export function setFormOwner(host: HTMLElement, owner: FormOwnerValue): void {
  const id = typeof owner === 'string' ? owner : owner?.id ?? '';
  if (id) host.setAttribute('form', id);
  else host.removeAttribute('form');
}

/** Returns the browser-resolved form owner for a form-associated custom element. */
export function getFormOwner(internals: ElementInternals): HTMLFormElement | null {
  return internals.form;
}

/**
 * Builds the session-history/autofill state for a control whose public value is a string array.
 * The state is private to one FACE control, so its key only needs to remain self-consistent; using
 * the current submission name keeps direct callback tests and browser diagnostics intuitive while
 * the reader below intentionally treats the entries as name-independent.
 */
export function createStringArrayFormDataState(name: string, values: readonly string[]): FormData {
  const state = new FormData();
  const key = name || 'value';
  for (const value of values) state.append(key, value);
  return state;
}

/**
 * Reads a string-array FACE state without depending on the control's current `name`. A form owner
 * can rename a control between persistence and restoration; the browser still restores the state
 * that belongs to that element. Wrong state shapes fail closed to an empty value.
 */
export function readStringArrayFormDataState(
  state: string | File | FormData | null,
): string[] {
  if (!(state instanceof FormData)) return [];
  const entries = [...state.values()];
  if (entries.some((entry) => typeof entry !== 'string')) return [];
  return entries as string[];
}

interface DirectCustomErrorHost extends LitElement {
  setCustomValidity(message: string): void;
}

/**
 * Installs the reflected `customError` IDL on a direct-FACE control. The shared string-valued mixin
 * owns the same accessor itself; controls with array/object/number/checked values use this helper
 * so the public validity contract cannot drift across fourteen hand-written implementations.
 */
export function installCustomErrorProperty(
  host: DirectCustomErrorHost,
  getCustomValidityMessage: () => string,
): void {
  if (Object.prototype.hasOwnProperty.call(host, 'customError')) return;
  let reflecting = false;
  Object.defineProperty(host, 'customError', {
    configurable: true,
    enumerable: true,
    get: (): string | null => getCustomValidityMessage() || null,
    set: (next: string | null): void => {
      if (reflecting) return;
      const old = getCustomValidityMessage() || null;
      const message = next ?? '';
      reflecting = true;
      try {
        if (next == null) {
          if (host.hasAttribute('custom-error')) host.removeAttribute('custom-error');
        } else if (host.getAttribute('custom-error') !== message) {
          host.setAttribute('custom-error', message);
        }
      } finally {
        reflecting = false;
      }
      host.setCustomValidity(message);
      host.requestUpdate('customError', old);
    },
  });
}

/** Public surface a `FormAssociated`-mixed element exposes to consumers and subclasses. */
export interface FormAssociatedInterface {
  internals: ElementInternals;
  get name(): string;
  set name(next: string | null);
  value: string;
  defaultValue: string;
  customError: string | null;
  disabled: boolean;
  required: boolean;
  readonly effectiveDisabled: boolean;
  get form(): HTMLFormElement | null;
  set form(owner: FormOwnerValue);
  readonly labels: NodeList;
  readonly validity: ValidityState;
  readonly validationMessage: string;
  readonly willValidate: boolean;
  setFormValue(next: string): void;
  getForm(): HTMLFormElement | null;
  checkValidity(): boolean;
  reportValidity(): boolean;
  setCustomValidity(message: string): void;
  resetValidity(): void;
  formResetCallback(): void;
  formStateRestoreCallback(
    state: string | File | FormData | null,
    reason: 'autocomplete' | 'restore',
  ): void;
  /** @internal */
  [SET_ANCHORED_VALIDITY](flags: ValidityStateFlags, message?: string): void;
}

/**
 * Minimal ElementInternals substitute for DOM implementations that expose
 * form-associated custom elements but do not implement `attachInternals()` yet.
 * Keeping the shape here means components remain constructible in SSR/test DOMs;
 * native browsers still use their real internals and form participation.
 *
 * Form participation (`setFormValue`, `form`, `labels`) is inert, since there is nothing to
 * participate in, but `validity` and `states` are real: both are read back by components
 * (`internals.validity.valid`, `internals.states.has(...)`), so a stub that always answers
 * "empty" would report a *wrong* answer rather than a missing one. `states` can't drive CSS
 * `:state()` matching without a real `ElementInternals` behind it — it degrades to an
 * observable-but-unstyled record of the same state names a browser would expose.
 *
 * Exported for the form-associated controls that manage `ElementInternals` directly instead of
 * through this mixin (their value isn't a plain string, so the mixin's contract doesn't fit) --
 * `<lr-voice-picker>` and friends call `attachInternalsSafely()` below rather than hand-maintaining
 * a second copy of this shape.
 */
export function createFallbackInternals(): ElementInternals {
  let flags: ValidityStateFlags = {};
  let message = '';
  const validity = {} as ValidityState;
  const validityKeys: (keyof ValidityStateFlags)[] = [
    'badInput',
    'customError',
    'patternMismatch',
    'rangeOverflow',
    'rangeUnderflow',
    'stepMismatch',
    'tooLong',
    'tooShort',
    'typeMismatch',
    'valueMissing',
  ];
  for (const key of validityKeys) {
    Object.defineProperty(validity, key, { enumerable: true, get: () => Boolean(flags[key]) });
  }
  Object.defineProperty(validity, 'valid', {
    enumerable: true,
    get: () => validityKeys.every((key) => !flags[key]),
  });
  // A plain `Set<string>` already implements every member `CustomStateSet` exposes
  // (`add`/`delete`/`has`/`clear`/`size`/iteration); only the CSS side is missing here.
  const states = new Set<string>() as unknown as CustomStateSet;
  return {
    form: null,
    labels: [] as unknown as NodeList,
    validity,
    get validationMessage(): string { return message; },
    willValidate: false,
    states,
    setFormValue(): void {},
    setValidity(next: ValidityStateFlags = {}, nextMessage = ''): void {
      flags = { ...next };
      message = nextMessage;
    },
    checkValidity(): boolean { return validity.valid; },
    reportValidity(): boolean { return validity.valid; },
  } as unknown as ElementInternals;
}

/**
 * `host.attachInternals()`, degrading to `createFallbackInternals()` rather than throwing when the
 * host environment either has no such method at all (a DOM shim that stops short of
 * `ElementInternals`) or has one that throws (already-attached internals, a partial polyfill).
 * Both failure modes must be handled: `typeof` alone leaves the throwing case, and `try`/`catch`
 * alone is fine in practice but reads as accidental. Constructing a control must never be the thing
 * that breaks a downstream consumer's non-browser test suite.
 */
export function attachInternalsSafely(host: HTMLElement): ElementInternals {
  if (typeof host.attachInternals !== 'function') return createFallbackInternals();
  try {
    return host.attachInternals() ?? createFallbackInternals();
  } catch {
    return createFallbackInternals();
  }
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
      name: { reflect: true, noAccessor: true, converter: omittedEmptyStringConverter },
      value: { attribute: false, noAccessor: true },
      defaultValue: { attribute: 'value', reflect: true, useDefault: true, noAccessor: true },
      customError: { attribute: 'custom-error', reflect: true, noAccessor: true },
      form: { noAccessor: true },
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
    private _valueDirty = false;
    private settingDefaultValue = false;
    private reflectingDefaultValue = false;
    private reflectingCustomError = false;
    private reflectingFormOwner = false;

    private _required = false;

    // Gates `:state(user-valid)`/`:state(user-invalid)`, which must stay off a pristine control
    // however invalid it already is — a required-and-empty field is not a user error until the
    // user has had a turn. Mirrors native `:user-invalid`.
    private _hasInteracted = false;

    constructor(...args: any[]) {
      super(...args);
      this.internals = attachInternalsSafely(this);
      this.validityController = new AnchoredValidityController(
        this,
        this.internals,
        () => this[VALIDITY_ANCHOR](),
      );
      // Native <input> always has a submission value ("") from construction —
      // without this, a control whose `value` is never touched is entirely
      // absent from FormData instead of present as "".
      this.internals.setFormValue('');
      installInvalidEventAlias(this, () => {
        (this as unknown as { emit(name: string): CustomEvent<undefined> }).emit('lr-invalid');
      });
      // Interaction signals, listened for on the host itself so subclasses need no wiring:
      // `input`/`change` from an internal native control are composed and reach the host (as are
      // the components' own re-emitted copies), and `focusout` is the blur signal — native `blur`
      // neither bubbles nor crosses a shadow boundary, so it can never be observed here.
      // Registered once, in the constructor, so reconnecting cannot stack duplicates.
      // Idempotent: a drag-driven control (`lr-slider`) fires `input` per pointermove, and only
      // the first one can change anything here.
      const markInteracted = (): void => {
        if (this._hasInteracted) return;
        this._hasInteracted = true;
        this.syncValidityStates();
      };
      this.addEventListener('input', markInteracted);
      this.addEventListener('change', markInteracted);
      this.addEventListener('focusout', markInteracted);
      this.syncValidityStates();
    }

    get form(): HTMLFormElement | null {
      return getFormOwner(this.internals);
    }

    set form(owner: FormOwnerValue) {
      if (this.reflectingFormOwner) return;
      this.reflectingFormOwner = true;
      try {
        setFormOwner(this, owner);
      } finally {
        this.reflectingFormOwner = false;
      }
    }

    getForm(): HTMLFormElement | null {
      return getFormOwner(this.internals);
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
      this.syncValidityStates();
    }

    /**
     * Sets or clears a consumer-supplied validation error — the standard channel for a
     * server-side rejection ("that email is already registered") that no client-side constraint
     * can express. A non-empty `message` raises `customError` and becomes `validationMessage`,
     * so the control fails `checkValidity()`, blocks submission, and matches `:invalid`; `''`
     * clears it.
     *
     * Clearing restores the control's own computed validity rather than forcing it valid: a
     * required-and-empty field whose custom error is cleared stays `valueMissing`. The custom
     * error also survives every intrinsic recomputation in between (each `value`/constraint
     * change re-runs `updateValidity()`), and a form reset, exactly like a native control —
     * only another `setCustomValidity('')` clears it.
     *
     * The message is caller-supplied content, so it is used verbatim and never localized here.
     */
    setCustomValidity(message: string): void {
      this.validityController.setCustomValidity(message ?? '');
      this.syncValidityStates();
    }

    /** Clears consumer-supplied validity and restores the current intrinsic constraints. */
    resetValidity(): void {
      this.validityController.setCustomValidity('');
      this.updateValidity();
      this.syncValidityStates();
    }

    /**
     * Publishes the six validity custom states. The implementation lives in
     * `internal/custom-states.ts` because only 11 of the library's 28 form-associated controls use
     * this mixin — the rest drive `ElementInternals` directly, and they publish the same six
     * states by calling the same helper.
     */
    protected syncValidityStates(): void {
      syncValidityStates(this.internals, { required: this.required, hasInteracted: this._hasInteracted });
    }

    get name(): string {
      return this._name;
    }

    set name(next: string | null) {
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
      if (!this.settingDefaultValue) this._valueDirty = true;
      this.internals.setFormValue(this._value);
      this.updateValidity();
      this.requestUpdate('value', old);
    }

    /** The reflected reset default. Changing it does not overwrite a dirty live value. */
    get defaultValue(): string {
      return this._defaultValue;
    }

    set defaultValue(next: string | null) {
      if (this.reflectingDefaultValue) return;
      const old = this._defaultValue;
      this._defaultValue = next ?? '';

      this.reflectingDefaultValue = true;
      try {
        if (next == null) this.removeAttribute('value');
        else this.setAttribute('value', this._defaultValue);
      } finally {
        this.reflectingDefaultValue = false;
      }

      if (!this._valueDirty) this.restoreLiveValueFromDefault();
      this.requestUpdate('defaultValue', old);
    }

    /** Consumer-supplied validity message, reflected through `custom-error`. */
    get customError(): string | null {
      return this.validityController.customValidityMessage || null;
    }

    set customError(next: string | null) {
      if (this.reflectingCustomError) return;
      const old = this.customError;
      const message = next ?? '';

      this.reflectingCustomError = true;
      try {
        if (next == null) this.removeAttribute('custom-error');
        else this.setAttribute('custom-error', message);
      } finally {
        this.reflectingCustomError = false;
      }

      this.setCustomValidity(message);
      this.requestUpdate('customError', old);
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
      // Also synced from `[SET_ANCHORED_VALIDITY]`, but `required`/`optional` must flip even for a
      // subclass whose `updateValidity()` override short-circuits without touching validity.
      this.syncValidityStates();
      this.requestUpdate('required', old);
    }

    /** Effective disabled state: this element's own `disabled` OR an ancestor
     *  `<fieldset disabled>`'s inherited state — mirrors native `<input>`, whose
     *  own `disabled` IDL property/attribute is never mutated by a fieldset. */
    get effectiveDisabled(): boolean {
      return this.disabled || this._fieldsetDisabled;
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
      // Reporting is what a submit attempt does, and a failed submit is precisely when native
      // `:user-invalid` starts matching — so it counts as interaction.
      this._hasInteracted = true;
      this.syncValidityStates();
      return this.internals.reportValidity();
    }

    formResetCallback(): void {
      // Restore the constructed default value (native `defaultValue`
      // semantics) — previously this unconditionally blanked the field.
      this._valueDirty = false;
      this.restoreLiveValueFromDefault();
      // A reset form is pristine again: drop the interaction flag so the `user-*` states stop
      // matching. The custom error deliberately survives (native `setCustomValidity()` semantics).
      this._hasInteracted = false;
      this.syncValidityStates();
    }

    private restoreLiveValueFromDefault(): void {
      this.settingDefaultValue = true;
      try {
        this.value = this._defaultValue;
      } finally {
        this.settingDefaultValue = false;
      }
      this._valueDirty = false;
    }

    formStateRestoreCallback(
      state: string | File | FormData | null,
      reason: 'autocomplete' | 'restore',
    ): void {
      void reason;
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

    override connectedCallback(): void {
      super.connectedCallback();
      // `required` may already be set from an attribute by the time this
      // runs; reflect validity from the start, not only after the first
      // `value` write.
      this.updateValidity();
      this.syncValidityStates();
    }
  }

  return FormAssociatedElement as unknown as T & Constructor<FormAssociatedInterface>;
}
