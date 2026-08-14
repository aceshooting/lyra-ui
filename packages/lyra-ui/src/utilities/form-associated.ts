/**
 * The form-association mixin and its interface: `FormAssociated()`, `attachInternalsSafely()`,
 * `createFallbackInternals()`.
 *
 * Part of the curated `@aceshooting/lyra-ui/utilities/*` surface: these re-exports are the
 * supported entry points, and they are covered by semver. The `internal/` modules they forward to
 * are not — that tree is free to move.
 *
 * This is the helper an application reaches for when it builds its own form-associated control
 * alongside Lyra's, so that the control participates in a form, restores on reset, and reports
 * validity the same way every `lr-` control does.
 */
export {
  attachInternalsSafely,
  createFallbackInternals,
  createStringArrayFormDataState,
  FormAssociated,
  isEmptyFormValue,
  readStringArrayFormDataState,
  stringFormValueAdapter,
} from '../internal/form-associated.js';
export type {
  FormAssociatedInterface,
  FormAssociatedSubclassInterface,
  FormOwnerValue,
  FormSubmissionValue,
  FormValueAdapter,
} from '../internal/form-associated.js';
