import type { FormControlController } from './form-control-controller.js';

/** What one validator run reports: the flags to raise and the message to show, or `{}` when valid. */
export interface FormValidatorOutcome {
  flags?: ValidityStateFlags;
  message?: string;
}

const VALIDITY_FLAG_KEYS: ReadonlySet<string> = new Set([
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
]);

function isValidityFlagKey(value: unknown): value is keyof ValidityStateFlags {
  return typeof value === 'string' && VALIDITY_FLAG_KEYS.has(value);
}

function isObjectValidator(validator: unknown): validator is {
  checkValidity(host: unknown): { isValid?: unknown; invalidKeys?: unknown; message?: unknown } | undefined;
  message?: unknown;
  observedAttributes?: unknown;
} {
  return typeof validator === 'object' && validator !== null && 'checkValidity' in validator;
}

function readValidators(validators: unknown): unknown[] | undefined {
  try {
    return Array.isArray(validators) ? Array.from(validators) : [];
  } catch {
    return undefined;
  }
}

/**
 * Runs `validators` in order and returns the first failure. A validator may be a function, a
 * `{ validate }` object or a Web Awesome style `{ checkValidity }` object. Application code never
 * escapes: a thrown validator, a hostile list or an unreadable result fails closed with
 * `fallbackMessage` and `customError`. Only the ten standard validity flag names are honored.
 *
 * @param fallbackMessage the localized generic message, or a function returning it (read lazily)
 */
export function runFormValidators(
  validators: unknown,
  value: unknown,
  host: unknown,
  fallbackMessage: string | (() => string),
): FormValidatorOutcome {
  const generic = (): string => (typeof fallbackMessage === 'function' ? fallbackMessage() : fallbackMessage);
  const list = readValidators(validators);
  if (!list) return { flags: { customError: true }, message: generic() };
  for (const validator of list) {
    try {
      if (isObjectValidator(validator)) {
        const checked = validator.checkValidity(host);
        if (checked?.isValid === true) continue;
        const flags: ValidityStateFlags = {};
        for (const key of Array.isArray(checked?.invalidKeys) ? checked.invalidKeys : []) {
          if (isValidityFlagKey(key)) flags[key] = true;
        }
        if (!Object.values(flags).some(Boolean)) flags.customError = true;
        let message = typeof checked?.message === 'string' ? checked.message : '';
        if (!message && typeof validator.message === 'string') message = validator.message;
        if (!message && typeof validator.message === 'function') {
          message = String((validator.message as (element: unknown) => unknown)(host) ?? '');
        }
        return { flags, message: message || generic() };
      }
      const result: unknown = typeof validator === 'function'
        ? (validator as (current: unknown, element: unknown) => unknown)(value, host)
        : (validator as { validate(current: unknown, element: unknown): unknown } | undefined)?.validate(value, host);
      if (result === undefined || result === true) continue;
      if (typeof result === 'string') return { flags: { customError: true }, message: result };
      if (result === false) return { flags: { customError: true }, message: generic() };
      if (result && typeof result === 'object') {
        const flags: ValidityStateFlags = {};
        for (const key of VALIDITY_FLAG_KEYS) {
          if (Object.prototype.hasOwnProperty.call(result, key) && (result as Record<string, unknown>)[key]) {
            flags[key as keyof ValidityStateFlags] = true;
          }
        }
        if (Object.values(flags).some(Boolean)) return { flags, message: generic() };
      }
    } catch {
      return { flags: { customError: true }, message: generic() };
    }
  }
  return {};
}

/** Attribute names any object validator lists in `observedAttributes`; hostile entries are skipped. */
function observedValidatorAttributes(validators: unknown): string[] {
  const attributes = new Set<string>();
  for (const validator of readValidators(validators) ?? []) {
    try {
      if (!isObjectValidator(validator)) continue;
      const observed: unknown = validator.observedAttributes;
      if (!Array.isArray(observed)) continue;
      for (const name of observed) {
        if (typeof name === 'string' && name.length > 0) attributes.add(name);
      }
    } catch {
      // A validator is application code; a revoked proxy must not stop its siblings being observed.
    }
  }
  return [...attributes];
}

/**
 * Revalidates live when a host attribute an object validator lists in `observedAttributes`
 * changes. The observer belongs to the host's owning window: a re-parent into another document, a
 * disconnect or the returned disposer ends it, so a stale observer never calls `onChange`.
 * Returns a disposer (a no-op when nothing needs observing). Call again after `validators` changes.
 */
export function observeValidatorAttributes(
  host: HTMLElement,
  validators: unknown,
  onChange: () => void,
): () => void {
  const owner = host.ownerDocument.defaultView;
  const Observer = owner?.MutationObserver;
  if (!host.isConnected || !owner || typeof Observer !== 'function') return () => undefined;
  const attributeFilter = observedValidatorAttributes(validators);
  if (attributeFilter.length === 0) return () => undefined;
  let active = true;
  const observer = new Observer(() => {
    if (!active || !host.isConnected || host.ownerDocument.defaultView !== owner) return;
    onChange();
  });
  try {
    observer.observe(host, { attributes: true, attributeFilter });
  } catch {
    observer.disconnect();
    return () => undefined;
  }
  return () => {
    active = false;
    observer.disconnect();
  };
}

interface StructuredValidityHost extends HTMLElement {
  readonly willValidate: boolean;
  readonly validationMessage: string;
  readonly validity: ValidityState;
}

/** The detail of `lr-validity-change`. */
export interface StructuredValiditySnapshot {
  readonly valid: boolean;
  readonly errors: Readonly<Record<string, string>>;
}

/**
 * The validity snapshot and `reportValidity()` plumbing shared by controls whose errors are keyed
 * per field (`errors` plus a whole-control `base` entry): `lr-tool-param-form`,
 * `lr-graph-query-builder`, `lr-rubric-form`.
 *
 * `baseErrorMessage()` is the one place a control says whether a whole-control error exists (a
 * non-empty string): the `base` entry is present exactly when it is non-empty and the control
 * validates, and carries the host's `validationMessage`.
 */
export class StructuredFormValidityController {
  private lastKey = '';

  constructor(
    private readonly host: StructuredValidityHost,
    private readonly options: {
      baseErrorMessage(): string;
      fieldErrors(): Readonly<Record<string, string>>;
      validityController(): FormControlController;
      /** Reveals every outstanding error and republishes the form state before reporting. */
      reveal(): void;
      emit(snapshot: StructuredValiditySnapshot): void;
    },
  ) {}

  /** The host's effective validity. */
  get validity(): ValidityState {
    return this.host.validity;
  }

  /** The current effective validation errors, `base` for a whole-control error. */
  get errors(): Readonly<Record<string, string>> {
    const errors: Record<string, string> = { ...this.options.fieldErrors() };
    if (this.host.willValidate && this.options.baseErrorMessage()) errors['base'] = this.host.validationMessage;
    return Object.freeze(errors);
  }

  /** Emits the snapshot only when it differs from the last one emitted. */
  publish(): void {
    if (!this.host.isConnected) return;
    const valid = !this.host.willValidate || this.host.validity.valid;
    const errors = valid ? Object.freeze({}) : this.errors;
    const key = JSON.stringify({ valid, errors });
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.options.emit(Object.freeze({ valid, errors }));
  }

  /** Syncs constraints, reveals outstanding errors, then reports through ElementInternals. */
  reportValidity(): boolean {
    return this.options.validityController().reportValidity(() => this.options.reveal());
  }
}
