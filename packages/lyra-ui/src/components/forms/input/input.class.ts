import { property } from 'lit/decorators.js';
import { LyraInputShared, createInputValidators } from './input-shared.js';
import type { LyraFormValidator } from '../form-validator.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_fieldRequired } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type { LyraInputType, LyraInputEventMap } from './input-shared.js';

/**
 * `<lr-input>` — a single-line plain-text input primitive, the `lr-*` equivalent of a plain
 * `wa-input`, form-associated via the `FormAssociated` mixin (same shape as `<lr-textarea>`).
 *
 * Ships the same opt-in `label`/`hint`/`errorText` form-control chrome as `<lr-textarea>`/
 * `<lr-select>` (props + matching named slots + `form-control`/`form-control-label`/`hint`/`error`
 * parts) — left unset, the chrome stays hidden. `size` uses the same `xs`–`xl` scale as
 * `<lr-select>`/`<lr-combobox>`, and `appearance` the shared fill/border vocabulary.
 * `type="password"` renders a `password-toggle` eye-icon button — opt-in via the
 * `password-toggle` attribute — that flips the internal native input between
 * `type="password"`/`type="text"` and tracks `passwordVisible`. `type="email"`/`type="number"`
 * (with `min`/`max`/`step`) delegate constraint validation to the internal native `<input>`'s own
 * browser-computed `validity`, bridged into this element's `ElementInternals` by `updateValidity()`
 * — as do `minlength`/`maxlength`/`pattern`, which constrain the text-bearing types.
 * `type="date"`/`type="datetime-local"`/`type="search"`/`type="tel"`/`type="time"`/`type="url"`
 * forward straight through to the matching native input behavior, the same as `type="text"`.
 *
 * A host `aria-label` is forwarded to the internal textbox via the typed `accessibleLabel` property.
 * A host `aria-describedby` is resolved onto that native input, ahead of its own hint/error/
 * required descriptions, so externally-owned guidance remains valid across the shadow boundary.
 * Host `aria-labelledby` is deliberately not projected: the native `<label>` already owns this
 * control's visible label relationship.
 *
 * Forwards the full native selection/editing surface (`selectionStart`/`selectionEnd`,
 * `setSelectionRange()`, `setRangeText()`), the same as `<lr-textarea>`, in addition to
 * `focus()`/`blur()`/`select()`, `showPicker()`, and `stepUp()`/`stepDown()`.
 *
 * The declarative `match` property pairs this field with a sibling one (by id, resolved in this
 * element's own root, or by direct element reference) and fails validity — a localized
 * `customError` — whenever the two values disagree, once every other constraint already reports
 * valid; see its own doc comment for the full contract. There is no dedicated password-purpose
 * preset, by deliberate decision rather than an oversight: the one platform detail a preset would
 * actually save — `autocomplete` — has no single correct value for "a password field" (`new-password`
 * on a set/change/reset flow, `current-password` on a login one, never derivable from the other), so
 * a `purpose`/`preset` property would still take a second parameter carrying that same distinction,
 * trading the existing attributes for an invented vocabulary that a migrating `wa-`/`sl-`/native
 * `<input type="password">` author would have to learn instead of carrying over unchanged. Compose
 * `type="password"`, `password-toggle`, `autocomplete="new-password"`, and `match` directly for a
 * set/change/reset confirmation pair; a login field needs only `type="password"` and
 * `autocomplete="current-password"`.
 *
 * Pressing Enter submits the ancestor `<form>`, the implicit submission a native `<input>`
 * performs — the internal input is inside a shadow root and has no form owner of its own, so the
 * platform can never do it here. The form's first enabled submit control becomes
 * `SubmitEvent.submitter` (an `<lr-button type="submit">` included, via its own `click()`), a
 * modifier-held or IME-composition Enter is ignored, and a form with no submit button submits only
 * from a single field — all of it the platform's own rules, shared with every other lyra text
 * control through `internal/submit-on-enter.ts`.
 *
 * Component-scoped theme inputs remain undeclared on the host, so values inherited from an
 * ancestor theme wrapper override size, appearance, and pill fallbacks. A value set directly on
 * the input still wins. The same theme contract applies to `<lr-number-input>` and `<lr-native-time-input>`,
 * which reuse the shared input implementation. Only `<lr-number-input>` subclasses `LyraInput`.
 *
 * When a clear or password action is rendered, compact tiers grow only enough to contain its
 * shared `--lr-icon-button-size` hit target. The `l` and `xl` tiers retain their larger shared
 * control heights.
 *
 * Removing label, hint, help-text, or error-text safely omits the content while retaining
 * native null property readback. Explicit empty strings remain empty.
 *
 * @customElement lr-input
 * @status stable
 * @since 4.0.0
 */
export class LyraInput extends LyraInputShared {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  /** Shoelace alias for {@link withoutSpinButtons}. */
  @property({ type: Boolean, attribute: 'no-spin-buttons' }) noSpinButtons = false;

  protected override get hidesSpinButtons(): boolean {
    return this.withoutSpinButtons || this.noSpinButtons;
  }

  static get validators(): LyraFormValidator<LyraInput>[] {
    return createInputValidators<LyraInput>();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-input': LyraInput;
  }
}
