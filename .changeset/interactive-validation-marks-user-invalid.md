---
"@aceshooting/lyra-ui": minor
---

A blocked native form submission — clicking a `type="submit"` control, calling
`form.requestSubmit()`, or implicit Enter submission — now marks every invalid participant as
user-interacted, so `:state(user-invalid)` (and `:state(user-valid)` once corrected) matches
exactly like native `:user-invalid`/`:user-valid` do. Previously only an explicit
`control.reportValidity()`/`form.reportValidity()` call counted: a submission attempt drives
`ElementInternals` directly and never calls a control's own `reportValidity()` method, so
`aria-invalid` correctly went `true` on a blocked submit while the `user-invalid` custom state
silently stayed unset.

A control's own silent `checkValidity()` query continues to never count as interaction, however
invalid the control already is — this is unchanged and is the one path interactive validation is
deliberately distinguished from.

Affects every form control that manages `ElementInternals` directly rather than through the
`FormAssociated` mixin (the mixin itself already got this fix): `<lr-radio>`, `<lr-radio-button>`,
`<lr-radio-group>`, `<lr-checkbox>`, `<lr-checkbox-group>`, `<lr-switch>`, `<lr-slider>`,
`<lr-select>`, `<lr-combobox>`, `<lr-token-input>`, `<lr-time-range>`, `<lr-file-input>`,
`<lr-rating>`, `<lr-model-select>`, `<lr-voice-picker>`, `<lr-locale-picker>`,
`<lr-graph-query-builder>`, `<lr-tool-param-form>`, and `<lr-rubric-form>`. Every affected
component's `@cssstate user-valid`/`user-invalid` JSDoc is corrected to document the rule above
instead of the looser "or a native validity check"/"or an explicit validity report" wording some
of them previously carried.
