/**
 * Opt-in shim for a downstream consumer's own Vitest+happy-dom test suite -- NOT used by this
 * package's own tests (which run against real browsers via `@web/test-runner`, where
 * `ElementInternals` already exists natively). happy-dom has no `ElementInternals`
 * implementation at all, and every form-associated `lyra-*` component (`lyra-switch`,
 * `lyra-combobox`, `lyra-select`, `lyra-checkbox`, `lyra-model-select`, `lyra-time-range`,
 * `lyra-tool-param-form`, plus anything built on the shared `FormAssociated` mixin) calls
 * `this.attachInternals()` unconditionally in its constructor, so instantiating any of them
 * under happy-dom throws immediately without this. The stub also implements `setValidity()`
 * as a no-op -- `AnchoredValidityController` (the shared validity-refresh controller every
 * form-associated component uses) calls `internals.setValidity()` on every update, which would
 * otherwise throw the moment any of those components' `value` changes, not just at construction.
 *
 * `attachInternals()` is specified on the `HTMLElement` interface (not `Element`), and every
 * `lyra-*` component is an `HTMLElement` subclass (via `LitElement`), so this patches
 * `HTMLElement.prototype.attachInternals` -- the exact lookup `this.attachInternals()` resolves
 * through.
 *
 * Call `installHappyDomFormAssociatedShims()` once, in a Vitest `setupFiles` entry, before
 * importing any `lyra-ui` component. It is a no-op wherever `attachInternals` already exists
 * (any real browser, or an environment that already supports it) -- safe to call unconditionally
 * from a shared setup file used across multiple test environments.
 */

interface StubValidityState {
  valid: boolean;
}

interface StubElementInternals {
  form: HTMLFormElement | null;
  labels: NodeList;
  validity: StubValidityState;
  validationMessage: string;
  willValidate: boolean;
  setFormValue(value: string | File | FormData | null, state?: string | FormData | null): void;
  checkValidity(): boolean;
  reportValidity(): boolean;
  setValidity(flags?: Partial<ValidityStateFlags>, message?: string, anchor?: HTMLElement): void;
}

function createStubInternals(): StubElementInternals {
  return {
    form: null,
    labels: document.createDocumentFragment().querySelectorAll('label'),
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
  if (typeof HTMLElement.prototype.attachInternals === 'function') return;
  HTMLElement.prototype.attachInternals = function attachInternals(): ElementInternals {
    return createStubInternals() as unknown as ElementInternals;
  };
}

/** Test-only: returns a fresh stub `ElementInternals`-shaped object, independent of whether
 *  `attachInternals` already exists natively -- exists purely so this module's own test can
 *  verify the stub's call-shape coverage without needing to run under happy-dom itself. */
export function installStubInternalsForTest(_host: Element): StubElementInternals {
  return createStubInternals();
}
