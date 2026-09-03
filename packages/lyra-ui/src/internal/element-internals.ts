/**
 * `ElementInternals` attachment helpers, deliberately in their own module rather than in
 * `form-associated.ts`.
 *
 * `form-associated.ts` calls `resolveLyraString(...)` for its validation messages, so the
 * default-string slice generator treats ANY import from it as pulling that message key into the
 * importing component's slice. `lr-toast` needs only `attachInternalsSafely()` and is not a form
 * control, so importing it from there would ship a `fieldRequired` string in a toast region --
 * exactly the incidental-key bloat 9.0.0 removed elsewhere. This module has no localization
 * dependency at all, so importing it costs nothing.
 *
 * `form-associated.ts` re-exports both symbols, so existing importers are unaffected.
 */

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
 * Direct property access is deliberately avoided: a partial DOM can expose `attachInternals`
 * through an accessor that throws before a callable can be saved. Only an own or inherited data
 * descriptor is eligible, and the saved callable is invoked exactly once. Constructing a control
 * must never be the thing that breaks a downstream consumer's non-browser test suite.
 */
export function attachInternalsSafely(host: HTMLElement): ElementInternals {
  type AttachInternals = (this: HTMLElement) => ElementInternals;
  let current: object | null = host;
  let attachInternals: AttachInternals | undefined;
  try {
    while (current) {
      const descriptor = Object.getOwnPropertyDescriptor(current, 'attachInternals');
      if (descriptor) {
        if ('value' in descriptor && typeof descriptor.value === 'function') {
          attachInternals = descriptor.value as AttachInternals;
        }
        break;
      }
      current = Object.getPrototypeOf(current) as object | null;
    }
  } catch {
    return createFallbackInternals();
  }
  if (!attachInternals) return createFallbackInternals();
  try {
    return Reflect.apply(attachInternals, host, []) ?? createFallbackInternals();
  } catch {
    return createFallbackInternals();
  }
}
