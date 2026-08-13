/**
 * Historical entry point for `attachInternals()` with a fallback, kept only as a name.
 *
 * It used to build its OWN inert fallback: `validity` was a bare `{}` and there was no `states` at
 * all. That second shape was a silent bug rather than a conservative choice -- `setCustomState()`
 * (`internal/custom-states.ts`) early-returns when `internals.states` is falsy, so in any
 * environment lacking `ElementInternals` every control routed through here published NONE of the
 * six validity custom states, while the controls calling `attachInternalsSafely()` published all
 * six. A consumer stylesheet written against `:state(user-invalid)` therefore worked on some of
 * this library's form controls and quietly did nothing on the others, which is the exact failure
 * mode `custom-states.ts` exists to prevent.
 *
 * `attachInternalsSafely()`'s `createFallbackInternals()` already builds a real `ValidityState`
 * (live getters, a computed `valid`, a recorded `validationMessage`) and a real `states` set, so
 * there is one fallback shape again.
 *
 * @deprecated Call `attachInternalsSafely()` from `internal/form-associated.ts` directly; this
 * alias exists only so the nine call sites that still spell it this way keep resolving.
 */
export { attachInternalsSafely as attachLegacyNoopInternalsSafely } from './form-associated.js';
