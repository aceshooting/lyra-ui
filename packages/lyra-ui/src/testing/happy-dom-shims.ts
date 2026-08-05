/**
 * Opt-in shim for a downstream consumer's own Vitest+happy-dom test suite -- NOT used by this
 * package's own tests (which run against real browsers via `@web/test-runner`, where
 * `ElementInternals` already exists natively). happy-dom has no `ElementInternals`
 * implementation at all, and every form-associated `lr-*` component (`lr-switch`,
 * `lr-combobox`, `lr-select`, `lr-checkbox`, `lr-model-select`, `lr-time-range`,
 * `lr-tool-param-form`, plus anything built on the shared `FormAssociated` mixin) calls
 * `this.attachInternals()` unconditionally in its constructor, so instantiating any of them
 * under happy-dom throws immediately without this. The stub also implements `setValidity()`
 * as a no-op -- `AnchoredValidityController` (the shared validity-refresh controller every
 * form-associated component uses) calls `internals.setValidity()` on every update, which would
 * otherwise throw the moment any of those components' `value` changes, not just at construction.
 * `states` is a real `Set` -- several controls (e.g. `lr-input`) call
 * `internals.states.add('blank')`/`.delete('blank')` on every update to drive a custom-state
 * pseudo-class, which would otherwise throw on `add` of `undefined`.
 *
 * `attachInternals()` is specified on the `HTMLElement` interface (not `Element`), and every
 * `lr-*` component is an `HTMLElement` subclass (via `LitElement`), so this patches
 * `HTMLElement.prototype.attachInternals` -- the exact lookup `this.attachInternals()` resolves
 * through.
 *
 * Call `installHappyDomFormAssociatedShims()` once, in a Vitest `setupFiles` entry, before
 * importing any `lyra-ui` component. It is a no-op wherever `attachInternals` already exists
 * (any real browser, or an environment that already supports it) or where `HTMLElement` isn't
 * even a global (a plain Node test environment with no DOM at all) -- safe to call
 * unconditionally from a shared setup file used across multiple test environments/projects,
 * including ones that mix DOM and non-DOM test files under one `setupFiles` entry.
 */

interface StubValidityState {
  valid: boolean;
}

interface StubElementInternals {
  form: HTMLFormElement | null;
  labels: NodeList;
  states: Set<string>;
  validity: StubValidityState;
  validationMessage: string;
  willValidate: boolean;
  setFormValue(value: string | File | FormData | null, state?: string | FormData | null): void;
  checkValidity(): boolean;
  reportValidity(): boolean;
  setValidity(flags?: Partial<ValidityStateFlags>, message?: string, anchor?: HTMLElement): void;
}

function createStubInternals(host: Element): StubElementInternals {
  return {
    // A live getter, not a value captured once here: a form-associated component calls
    // attachInternals() from its own constructor, which the platform always runs BEFORE the
    // element is inserted anywhere -- host.closest('form') at that instant can only ever see
    // null, even when the element is later appended into a real <form>. Snapshotting it here
    // would leave every such component's `internals.form` permanently null under this shim
    // regardless of where it actually ends up in the DOM -- silently breaking anything (like
    // `<lr-button>`) that resolves its submit target through `internals.form` rather than
    // `closest('form')`.
    get form(): HTMLFormElement | null {
      return host.closest('form');
    },
    labels: document.createDocumentFragment().querySelectorAll('label'),
    // `CustomStateSet` is Set-like (add/delete/has), which is the entire surface this library's
    // form-associated components call -- a real Set covers it without reimplementing the DOM type.
    states: new Set<string>(),
    validity: { valid: true },
    validationMessage: '',
    willValidate: true,
    setFormValue(): void {
      // Intentional no-op -- happy-dom has no real form-submission pipeline to feed.
    },
    checkValidity(): boolean {
      return true;
    },
    reportValidity(): boolean {
      return true;
    },
    setValidity(): void {
      // Intentional no-op -- happy-dom has no real constraint-validation pipeline to feed.
    },
  };
}

export function installHappyDomFormAssociatedShims(): void {
  if (typeof HTMLElement === 'undefined') return;
  if (typeof HTMLElement.prototype.attachInternals === 'function') return;
  HTMLElement.prototype.attachInternals = function attachInternals(): ElementInternals {
    return createStubInternals(this) as unknown as ElementInternals;
  };
}

/** Test-only: returns a fresh stub `ElementInternals`-shaped object, independent of whether
 *  `attachInternals` already exists natively -- exists purely so this module's own test can
 *  verify the stub's call-shape coverage without needing to run under happy-dom itself. */
export function installStubInternalsForTest(host: Element): StubElementInternals {
  return createStubInternals(host);
}
