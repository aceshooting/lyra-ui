import type { ComplexAttributeConverter, LitElement, PropertyValues } from 'lit';
import { LYRA_DEFAULT_fieldRequired } from './default-strings.generated.js';
import { resolveLyraString } from './localization-runtime.js';
import type { LyraLocaleStrings } from './localization-types.js';
import {
  AnchoredValidityController,
  SET_ANCHORED_VALIDITY,
  VALIDITY_ANCHOR,
} from './anchored-validity.js';
import { syncValidityStates } from './custom-states.js';
import { installInvalidEventAlias } from './invalid-event-alias.js';
import { omittedEmptyStringConverter } from './converters.js';

type Constructor<T> = new (...args: any[]) => T;

const FORM_ASSOCIATED_DEFAULT_STRINGS = Object.freeze({ fieldRequired: LYRA_DEFAULT_fieldRequired });

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
  if (typeof FormData !== 'function') return [];
  let entries: FormDataEntryValue[];
  try {
    // Invoke the intrinsic rather than an instance-supplied method. Web IDL's FormData brand check
    // accepts a genuine object from another realm while rejecting structural/Symbol.toStringTag
    // lookalikes, and it keeps this restoration path fail-closed when the callback receives a
    // malformed state object.
    entries = [...FormData.prototype.values.call(state as FormData)];
  } catch {
    return [];
  }
  if (entries.some((entry) => typeof entry !== 'string')) return [];
  return entries as string[];
}

/**
 * What `ElementInternals.setFormValue()` accepts for both the submission entry and the
 * session-history/autofill state.
 */
export type FormSubmissionValue = File | string | FormData | null;

/**
 * The seam that lets {@linkcode FormAssociated} carry a value of any type.
 *
 * The mixin owns the *behaviour* (synchronous accessors, dirty/default tracking, the interaction
 * signal, barred-validation short-circuiting, anchored validity layering, reset and state
 * restoration); an adapter supplies only the type-dependent facts the behaviour needs — what
 * "empty" is, how the value reaches `setFormValue()`, whether a given value counts as missing, and
 * how it round-trips through the reflected `value` content attribute. Every member except
 * {@linkcode empty} and {@linkcode toFormValue} has a documented default, so the smallest useful
 * adapter is two lines.
 *
 * Without this seam a control whose value is not a string had no choice but to hand-roll the entire
 * `ElementInternals` dance, which is why dirty/default tracking was copy-pasted four different ways
 * and `formResetCallback` was simply missing from one control: the duplication, not any one file,
 * was the defect.
 */
export interface FormValueAdapter<TValue> {
  /**
   * The value of a control that has never been assigned one, the value a form reset falls back to
   * when no `value` attribute is present, and the substitute for a `null`/`undefined` assignment.
   *
   * Handed to every instance by reference, so it must be treated as immutable — freeze an array or
   * object empty value rather than letting one instance's mutation reach every other.
   */
  readonly empty: TValue;

  /**
   * Serializes the live value into the entry the owning `<form>` submits. Returning `null` omits
   * the control from `FormData` entirely, exactly as an unchecked native checkbox does.
   */
  toFormValue(value: TValue): FormSubmissionValue;

  /**
   * Serializes the session-history/autofill state, when it must differ from the submission entry —
   * an unchecked checkbox submits nothing but still has to *restore* as unchecked, and a
   * multi-valued control submits one entry per value but restores from a single `FormData`
   * ({@linkcode createStringArrayFormDataState} builds that shape).
   *
   * Omitted entirely means "the state is the submission value", which is `setFormValue()`'s own
   * one-argument behaviour — not the same as returning `null`, which would erase the state.
   */
  toFormState?(value: TValue): FormSubmissionValue;

  /**
   * Whether this value counts as missing for `valueMissing`. Defaults to
   * {@linkcode isEmptyFormValue}, which is `=== ''` for a string and never assumes it for anything
   * else. Override it whenever the default is wrong for the type — a `0`-valued rating is empty,
   * an epoch `Date` is not.
   */
  isEmpty?(value: TValue): boolean;

  /**
   * Parses the reflected `value` content attribute (never `null` — an absent attribute is handled
   * by the mixin and does not reach here). Defaults to the identity, which is only correct when
   * `TValue` is `string`; any other type must supply one or its declarative markup is ignored.
   */
  fromAttribute?(attribute: string): TValue;

  /**
   * Serializes the reset default back to the `value` content attribute. Returning `null` removes
   * the attribute. Defaults to `String(value)`, which is only meaningful when `TValue` is `string`.
   */
  toAttribute?(value: TValue): string | null;

  /**
   * Reads back what {@linkcode toFormState} (or {@linkcode toFormValue}) persisted, for
   * `formStateRestoreCallback`. Defaults to "a string state restores verbatim, anything else falls
   * back to {@linkcode empty}" — the string mixin's long-standing behaviour, which fails closed
   * rather than restoring a wrongly-shaped state.
   */
  fromFormState?(state: FormSubmissionValue): TValue;
}

/** An adapter with every optional member resolved, so the mixin never branches on `undefined`. */
type ResolvedFormValueAdapter<TValue> = Required<Omit<FormValueAdapter<TValue>, 'toFormState'>> &
  Pick<FormValueAdapter<TValue>, 'toFormState'>;

/**
 * The default `valueMissing` emptiness test: `null`/`undefined`, the empty string, an empty array,
 * and an empty plain object are missing; everything else — including `0`, `false`, a `Date`, a
 * `File`, and any class instance — is a real value.
 *
 * Deliberately conservative about objects: only a *plain* object is inspected by key count, because
 * `Object.keys()` reports `0` for a populated `FormData`, `Map` or `Set` and would silently call a
 * filled-in control empty.
 */
export function isEmptyFormValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype === null) return Object.keys(value).length === 0;
    // A plain object's prototype is its creator realm's Object.prototype, whose own prototype is
    // null and whose own constructor points back to it. Unlike an ambient Object.prototype
    // identity comparison, this remains exact after values cross an iframe boundary while still
    // rejecting class instances and custom prototype chains.
    if (Object.getPrototypeOf(prototype) === null) {
      const constructor = Object.getOwnPropertyDescriptor(prototype, 'constructor')?.value;
      if (
        typeof constructor === 'function' &&
        constructor.name === 'Object' &&
        constructor.prototype === prototype
      ) {
        return Object.keys(value).length === 0;
      }
    }
  }
  return false;
}

/**
 * The string adapter — the mixin's default, and a byte-for-byte statement of the behaviour every
 * existing consumer already has. Exported so a control that wraps or extends the string contract
 * can spread it rather than restating it.
 */
export const stringFormValueAdapter: ResolvedFormValueAdapter<string> = {
  empty: '',
  toFormValue: (value) => value,
  isEmpty: (value) => value === '',
  fromAttribute: (attribute) => attribute,
  toAttribute: (value) => value,
  fromFormState: (state) => (typeof state === 'string' ? state : ''),
};

/** Fills an adapter's optional members with their documented defaults. */
function resolveFormValueAdapter<TValue>(
  adapter: FormValueAdapter<TValue> | undefined,
): ResolvedFormValueAdapter<TValue> {
  if (adapter === undefined) {
    return stringFormValueAdapter as unknown as ResolvedFormValueAdapter<TValue>;
  }
  return {
    empty: adapter.empty,
    toFormValue: (value) => adapter.toFormValue(value),
    ...(adapter.toFormState ? { toFormState: (value: TValue) => adapter.toFormState!(value) } : {}),
    isEmpty: adapter.isEmpty ? (value) => adapter.isEmpty!(value) : isEmptyFormValue,
    fromAttribute: adapter.fromAttribute
      ? (attribute) => adapter.fromAttribute!(attribute)
      : (attribute) => attribute as unknown as TValue,
    toAttribute: adapter.toAttribute
      ? (value) => adapter.toAttribute!(value)
      : (value) => (value == null ? null : String(value)),
    fromFormState: adapter.fromFormState
      ? (state) => adapter.fromFormState!(state)
      : (state) => (typeof state === 'string' ? (state as unknown as TValue) : adapter.empty),
  };
}

/**
 * The shape {@linkcode isBarredFromValidation} reads. Every member is optional because the same
 * predicate answers for the mixin and for the eighteen controls that drive `ElementInternals`
 * directly, and those differ in which barring conditions they can even express (`<lr-checkbox>`
 * has no `readonly`, `<lr-rating>` has no fieldset-independent `effectiveDisabled`, and a control
 * constructed under a DOM shim has no real `ElementInternals` at all).
 */
export interface ValidationCandidate {
  /** Own `disabled` OR any inherited disablement (fieldset, owning group). Preferred over `disabled`. */
  readonly effectiveDisabled?: boolean;
  readonly disabled?: boolean;
  readonly readonly?: boolean;
}

/**
 * Whether constraint validation must not run for this control — the single predicate behind every
 * "barred from constraint validation" condition, so no control can implement three of the four and
 * silently miss the fourth (`<lr-rating required readonly>` reported `valueMissing` while
 * `<lr-otp-input required readonly>` did not, because the `readonly` bar was copy-pasted into four
 * files and never reached the fifth).
 *
 * A barred control is neither `:valid` nor `:invalid` natively — verified against a real
 * `<input required disabled>` and `<input required readonly>`, both of which match neither — so
 * publishing `:state(invalid)`/`:state(user-invalid)` from a disabled required field is what makes
 * the documented `lr-input:state(user-invalid) { border-color: red }` rule paint every disabled
 * field red.
 *
 * `internals.willValidate` is consulted last and only for a real `ElementInternals`: it folds in the
 * platform conditions this library does not model itself (fieldset cascading, a `<datalist>`
 * ancestor), but the `createFallbackInternals()` substitute reports `false` unconditionally, and
 * treating that as "barred" would silently disable validation everywhere `attachInternals()` is
 * missing.
 */
export function isBarredFromValidation(
  host: ValidationCandidate,
  internals?: ElementInternals,
): boolean {
  if (host.effectiveDisabled ?? host.disabled) return true;
  if (host.readonly) return true;
  if (internals) {
    const willValidate = readNativeWillValidate(internals);
    if (willValidate !== undefined) return !willValidate;
  }
  return false;
}

/** Reads the branded platform value while rejecting {@linkcode createFallbackInternals}'s stand-in. */
function readNativeWillValidate(internals: ElementInternals): boolean | undefined {
  if (typeof ElementInternals !== 'function') return undefined;
  const getter = Object.getOwnPropertyDescriptor(ElementInternals.prototype, 'willValidate')?.get;
  if (typeof getter !== 'function') return undefined;
  try {
    const value = getter.call(internals);
    return typeof value === 'boolean' ? value : undefined;
  } catch {
    return undefined;
  }
}

interface DirectCustomErrorHost extends LitElement {
  setCustomValidity(message: string): void;
}

/**
 * Installs the reflected `customError` IDL on a direct-FACE control. The shared string-valued mixin
 * owns the same accessor itself; controls with array/object/number/checked values use this helper
 * so the public validity contract cannot drift across seventeen hand-written implementations.
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

/**
 * Public surface a `FormAssociated`-mixed element exposes to consumers and subclasses.
 *
 * `TValue` defaults to `string`, so every existing reference to the bare
 * `FormAssociatedInterface` keeps its exact former meaning.
 */
export interface FormAssociatedInterface<TValue = string> {
  internals: ElementInternals;
  get name(): string;
  set name(next: string | null);
  value: TValue;
  defaultValue: TValue;
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
  setFormValue(next: TValue): void;
  getForm(): HTMLFormElement | null;
  checkValidity(): boolean;
  reportValidity(): boolean;
  setCustomValidity(message: string): void;
  resetValidity(): void;
  formResetCallback(): void;
  formStateRestoreCallback(
    state: FormSubmissionValue,
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
 * Exported for the form-associated controls that still manage `ElementInternals` directly instead
 * of through this mixin -- `<lr-voice-picker>` and friends call `attachInternalsSafely()` below
 * rather than hand-maintaining a second copy of this shape. ("Their value isn't a plain string" was
 * the reason for years and no longer is: the mixin takes a `FormValueAdapter` and carries any value
 * type. Those controls are a migration backlog, frozen shrink-only by rule (f) of
 * `scripts/check-form-associated.mjs`, not a second supported pattern.)
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
 * The value type is a parameter, not a fixture. `FormAssociated(Base)` is the string control every
 * existing consumer already has — `TValue` defaults to `string` and the supplied-adapter branches
 * below all collapse to the literal code that shipped before. `FormAssociated(Base, adapter)`
 * carries any other type through the same one implementation: `Date`, `string[]`, a structured
 * record. See {@linkcode FormValueAdapter} for the facts an adapter supplies; everything else
 * — the synchronous `noAccessor` accessors, dirty/default tracking, the `input`/`change`/`focusout`
 * interaction signal, `isBarredFromValidation()` short-circuiting, anchored intrinsic/custom
 * validity layering, `formResetCallback` (restores the default, clears dirty and interacted, and
 * deliberately preserves a `setCustomValidity()` message) — is type-independent and is not
 * reimplemented per value type.
 *
 * The explicit return-type annotation is required so TypeScript can emit a
 * declaration file for the (otherwise anonymous) mixin class (avoids TS4094).
 */
export function FormAssociated<T extends Constructor<LitElement>, TValue = string>(
  Base: T,
  valueAdapter?: FormValueAdapter<TValue>,
): T & Constructor<FormAssociatedInterface<TValue>> {
  const adapter = resolveFormValueAdapter<TValue>(valueAdapter);

  // Installed ONLY when a caller supplied an adapter. The string case keeps Lit's own default
  // converter, byte for byte, rather than an equivalent-looking hand-written one: the reflected
  // `value` attribute is the reset default of every shipped control, and "equivalent-looking" is
  // how a `null` (attribute removed) quietly becomes `''` (attribute set to empty).
  const defaultValueConverter: ComplexAttributeConverter<TValue | null> = {
    fromAttribute: (attribute) => (attribute === null ? null : adapter.fromAttribute(attribute)),
    toAttribute: (value) => (value == null ? null : adapter.toAttribute(value)),
  };

  class FormAssociatedElement extends Base {
    static formAssociated = true;

    static properties = {
      name: { reflect: true, noAccessor: true, converter: omittedEmptyStringConverter },
      value: { attribute: false, noAccessor: true },
      defaultValue: {
        attribute: 'value',
        reflect: true,
        useDefault: true,
        noAccessor: true,
        ...(valueAdapter ? { converter: defaultValueConverter } : {}),
      },
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

    private _value: TValue = adapter.empty;
    // What native `defaultValue`/`form.reset()` restores to. Mirrors the
    // `value` *content attribute* only (see `attributeChangedCallback`
    // below) — exactly like native `<input>`: setting the `.value` IDL
    // property (whether from a user typing, a picker commit, or a
    // consumer's own script) never touches `defaultValue`, only
    // `setAttribute('value', ...)`/declarative markup does. Using the
    // property setter itself to capture "whichever assignment happens
    // first" would wrongly let a user's first-ever edit become permanent
    // (a required field could never be reset back to blank again).
    private _defaultValue: TValue = adapter.empty;
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
      // absent from FormData instead of present as "". An adapter whose empty
      // value serializes to `null` (an unchecked checkbox's shape) opts out of
      // that on purpose, which is the platform's own behaviour for it.
      this.commitFormValue(this._value);
      installInvalidEventAlias(this, (init: { cancelable: true }) =>
        (
          this as unknown as {
            emit(name: string, detail?: undefined, options?: { cancelable: boolean }): CustomEvent<undefined>;
          }
        ).emit('lr-invalid', undefined, init),
      );
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
     * `internal/custom-states.ts` because only 11 of the library's 31 form-associated components
     * use this mixin today — 18 still drive `ElementInternals` directly (and publish the same six
     * states by calling the same helper), and 2 carry no value at all. That split is a migration
     * backlog, not a design: since the mixin became value-generic there is no value type it cannot
     * carry.
     */
    protected syncValidityStates(): void {
      syncValidityStates(this.internals, {
        required: this.required,
        hasInteracted: this._hasInteracted,
        barred: this.isBarredFromValidation(),
      });
    }

    /**
     * Whether constraint validation is currently barred — own `disabled`, an ancestor
     * `<fieldset disabled>`, a subclass's `readonly`, or any platform condition `willValidate`
     * knows about. Subclasses read this instead of rebuilding the condition list; overriding it is
     * how a control with an extra barring channel of its own extends the set.
     */
    protected isBarredFromValidation(): boolean {
      return isBarredFromValidation(this as ValidationCandidate, this.internals);
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

    /**
     * Pushes `value` to `ElementInternals` through the adapter. The two-argument form is used only
     * when the adapter distinguishes the restored state from the submitted entry — passing
     * `undefined` as a second argument is NOT the same as omitting it (it erases the state), so the
     * call is branched rather than parameterised.
     */
    private commitFormValue(value: TValue): void {
      const submitted = adapter.toFormValue(value);
      if (adapter.toFormState) this.internals.setFormValue(submitted, adapter.toFormState(value));
      else this.internals.setFormValue(submitted);
    }

    get value(): TValue {
      return this._value;
    }

    set value(next: TValue | null) {
      const old = this._value;
      this._value = next ?? adapter.empty;
      if (!this.settingDefaultValue) this._valueDirty = true;
      this.commitFormValue(this._value);
      this.updateValidity();
      this.requestUpdate('value', old);
    }

    /** The reflected reset default. Changing it does not overwrite a dirty live value. */
    get defaultValue(): TValue {
      return this._defaultValue;
    }

    set defaultValue(next: TValue | null) {
      if (this.reflectingDefaultValue) return;
      const old = this._defaultValue;
      this._defaultValue = next ?? adapter.empty;

      this.reflectingDefaultValue = true;
      try {
        // `next == null` is the "attribute removed" signal and must remove it rather than serialize
        // the empty value; a non-null value whose adapter serializes to `null` (a value with no
        // markup representation) removes it too, which is what Lit's own reflection would do.
        const attribute = next == null ? null : adapter.toAttribute(this._defaultValue);
        if (attribute == null) this.removeAttribute('value');
        else this.setAttribute('value', attribute);
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
      // Disabling bars constraint validation, so the intrinsic violation and the `invalid`/
      // `user-invalid` states have to go with it — synchronously, for the same reason the
      // attribute does.
      this.updateValidity();
      this.syncValidityStates();
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
    setFormValue(next: TValue): void {
      this.value = next;
    }

    /**
     * Recomputes `ElementInternals`'s validity state. Without this,
     * `internals` defaults to permanently "valid" and `required` never
     * blocks form submission.
     *
     * A control barred from constraint validation (disabled, fieldset-disabled, readonly) reports
     * no violation at all, exactly like a native control: the browser already refuses to *enforce*
     * such a state, and leaving `valueMissing` raised anyway is what leaked `:state(invalid)` onto
     * every disabled required field. Subclasses that override this must start with the same guard;
     * `isBarredFromValidation()` is shared for exactly that reason.
     */
    protected updateValidity(): void {
      if (this.isBarredFromValidation()) {
        this[SET_ANCHORED_VALIDITY]({});
        return;
      }
      // Emptiness is the adapter's answer, never `=== ''`: a `[]`, a `null` date and a `0` rating
      // are each "missing" for their own control and none of them is the empty string.
      if (this.required && adapter.isEmpty(this._value)) {
        const overrides = (this as unknown as { strings?: LyraLocaleStrings }).strings;
        const message = resolveLyraString(
          this,
          'fieldRequired',
          overrides,
          undefined,
          undefined,
          FORM_ASSOCIATED_DEFAULT_STRINGS,
        );
        this[SET_ANCHORED_VALIDITY]({ valueMissing: true }, message);
      } else {
        this[SET_ANCHORED_VALIDITY]({});
      }
    }

    /**
     * Pushes any constraint change still queued in Lit's async update onto the internal native
     * control, so a validity query answers from the constraints the consumer has *already* set
     * rather than from the previous render's.
     *
     * `pattern`/`min`/`max`/`step`/`minlength`/`maxlength` reach the inner `<input>`/`<textarea>`
     * through the component's own template, one Lit cycle after assignment — so
     * `el.pattern = '[0-9]+'; el.checkValidity()` in one synchronous block used to answer from the
     * pre-change constraints. Flushing the pending render is what makes them current, rather than
     * re-writing a hand-listed set of attributes here: the template is the only place that knows
     * which constraints a control actually forwards, and several forward a *computed* value
     * (`<lr-time-input>` converts `step` before handing it to its native input), which a blind
     * attribute copy would silently overwrite with the wrong one.
     *
     * Only ever flushes an already-rendered control: forcing the FIRST render early (from the
     * `connectedCallback()` validity pass, say) would move every control's `firstUpdated`/
     * `slotchange` timing, which is not this method's business.
     */
    protected syncConstraintsToNative(): void {
      // Cast rather than `this.performUpdate()`: `performUpdate`/`hasUpdated` are protected on
      // `ReactiveElement`, and this class extends a *generic* base, so they are not statically
      // reachable through `super`'s type here.
      const host = this as unknown as { hasUpdated: boolean; performUpdate(): void };
      if (!host.hasUpdated) return;
      host.performUpdate();
    }

    checkValidity(): boolean {
      this.syncConstraintsToNative();
      this.updateValidity();
      return this.internals.checkValidity();
    }

    reportValidity(): boolean {
      this.syncConstraintsToNative();
      this.updateValidity();
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
      state: FormSubmissionValue,
      reason: 'autocomplete' | 'restore',
    ): void {
      void reason;
      this.value = adapter.fromFormState(state);
    }

    /**
     * Called by the browser whenever the FACE-computed disabled state changes — an ancestor
     * `<fieldset disabled>` toggling, but ALSO the element's own `disabled` content attribute
     * being added or removed directly (confirmed via a captured stack trace: the platform enqueues
     * this as a second, independent custom-element reaction to the very same attribute mutation
     * that also drives the `disabled` property setter below). `_fieldsetDisabled` is tracked
     * separately from the consumer's own `disabled` (see `effectiveDisabled`) — a native
     * `<input>`'s own `disabled` IDL property/attribute is never mutated by fieldset cascading, so
     * a consumer's explicit `disabled` must survive the fieldset re-enabling.
     *
     * Only recomputes when doing so would actually change `effectiveDisabled`. Own `disabled`
     * changing already ran this exact validity/state/render sequence via its own setter in the
     * same synchronous tick — redoing it here for a callback that turns out to just be an echo of
     * that same transition was pure redundant work, and, being a second call site, could land
     * inside a *different* in-flight update's `updated()`/`hostUpdated()` window and trip Lit's
     * dev-mode "scheduled an update after an update completed" warning for a render nothing
     * observable ever needed (fr_asxOgk4UhNB07xevCWwFVQ).
     */
    formDisabledCallback(fieldsetDisabled: boolean): void {
      const before = this.effectiveDisabled;
      this._fieldsetDisabled = fieldsetDisabled;
      if (this.effectiveDisabled === before) return;
      // Cascaded disablement bars constraint validation exactly like the control's own `disabled`,
      // so validity has to be recomputed here rather than merely re-rendered — recording the flag
      // and requesting an update left `valueMissing` (and `:state(invalid)`) raised on every
      // required control inside a `<fieldset disabled>`.
      this.updateValidity();
      this.syncValidityStates();
      this.requestUpdate();
    }

    /**
     * Recomputes validity after a barring-relevant property has been reflected. `disabled` has a
     * hand-written setter that already does this synchronously; a subclass's `readonly` is a plain
     * reactive property, and the platform reads its reflected *attribute* when it answers
     * `internals.willValidate`, so the recomputation can only be correct once `update()` has run.
     */
    protected override updated(changed: PropertyValues): void {
      super.updated(changed);
      if (!changed.has('readonly') && !changed.has('disabled')) return;
      this.updateValidity();
      this.syncValidityStates();
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

  return FormAssociatedElement as unknown as T & Constructor<FormAssociatedInterface<TValue>>;
}
