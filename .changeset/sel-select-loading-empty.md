---
"@aceshooting/lyra-ui": minor
---

`<lr-select>`: `loading` now covers the whole pending state, not only its committed-value half.
It already rewrote an unresolved committed value's label to the localized `loading` text and
suppressed the "not in catalog" badge; with nothing selected at all -- a create form whose option
catalogue is still being fetched, or an edit form whose saved selection is legitimately empty --
`labelFor()` was never reached and the trigger fell through to the consumer's own `placeholder`.
Covering that half meant hand-writing a conditional placeholder bound to the same flag and
re-localizing, in the consuming app's own catalogue, the exact string this control already owns.

The trigger now renders the same localized text in place of `placeholder` while `loading` is
`true` and the selection is empty -- the existing `loading` message key, so both halves always read
the same words and a `registerLyraLocale()` translation reaches them both. With `loading` false an
empty selection renders the consumer's `placeholder` exactly as before, `value` is never touched,
and the trigger's accessible name is unchanged: a host `aria-label` still wins, then `label`, then
`placeholder`, then the localized `select` fallback.
