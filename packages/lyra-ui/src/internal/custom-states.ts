/**
 * CSS custom states (`:state()`), and the six validity states every form-associated control in the
 * library publishes.
 *
 * These functions exist standalone because only 11 of the library's 28 form-associated controls use
 * the `FormAssociated` mixin — the rest drive `ElementInternals` directly, because their value is
 * not a string. The validity states were therefore reachable on some controls and silently absent
 * on others, which is worse than absent everywhere: a consumer writes
 * `lr-thing:state(user-invalid) { … }`, sees it work on `lr-input`, and ships a stylesheet that
 * quietly does nothing on `lr-checkbox`.
 */

/**
 * Adds or removes one CSS custom state, tolerating every environment that cannot take it: a DOM
 * with no `ElementInternals` at all (`states` undefined behind a shim), and the engines that
 * shipped `CustomStateSet` accepting only dashed idents. A custom state is a styling convenience,
 * so a rejected state name must never break the validity it describes.
 */
export function setCustomState(internals: ElementInternals | undefined, name: string, present: boolean): void {
  const states: CustomStateSet | undefined = internals?.states;
  if (!states) return;
  try {
    if (present) states.add(name);
    else states.delete(name);
  } catch {
    /* Engine rejected the state name; styling hooks are optional, validity is not. */
  }
}

/** The six states {@linkcode syncValidityStates} publishes, in the order they are documented. */
export const VALIDITY_STATES = ['required', 'optional', 'valid', 'invalid', 'user-valid', 'user-invalid'] as const;

export type LyraValidityState = (typeof VALIDITY_STATES)[number];

/**
 * Publishes the six validity custom states — `required`/`optional`, `valid`/`invalid`,
 * `user-valid`/`user-invalid` — so a consumer can style a control's validation state with
 * `lr-thing:state(user-invalid) { … }` without reaching into its shadow root.
 *
 * `valid` mirrors `validity.valid`. The `user-*` pair additionally requires that the user has
 * INTERACTED (an `input`/`change`/blur on this control, or a `reportValidity()` call, which is what
 * a submit attempt runs) — that is the whole point of the pair: a pristine required field is
 * invalid, but styling it red before the user has typed anything is hostile.
 *
 * `barred` (see `isBarredFromValidation()` in `internal/form-associated.ts`) silences BOTH pairs:
 * a control barred from constraint validation — disabled, fieldset-disabled, readonly — matches
 * neither `:valid` nor `:invalid` natively, and publishing `invalid`/`user-invalid` from one is
 * what made the documented `lr-input:state(user-invalid) { border-color: red }` rule paint every
 * disabled required field red. `required`/`optional` describe the attribute rather than the
 * validation outcome, so they keep publishing exactly like native `:required`/`:optional`.
 */
export function syncValidityStates(
  internals: ElementInternals | undefined,
  options: { required: boolean; hasInteracted: boolean; barred?: boolean },
): void {
  const { required, hasInteracted, barred = false } = options;
  const valid = !barred && internals?.validity?.valid !== false;
  const invalid = !barred && internals?.validity?.valid === false;
  setCustomState(internals, 'required', required);
  setCustomState(internals, 'optional', !required);
  setCustomState(internals, 'valid', valid);
  setCustomState(internals, 'invalid', invalid);
  setCustomState(internals, 'user-valid', valid && hasInteracted);
  setCustomState(internals, 'user-invalid', invalid && hasInteracted);
}
