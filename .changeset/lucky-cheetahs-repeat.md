---
"@aceshooting/lyra-ui": patch
---

`lr-time-input` now accepts `min`/`max` as attributes. It inherits both from `lr-input`, where they
are declared `type: Number` for the `type="number"` contract, so a `min="09:00"` attribute parsed to
`NaN` and reached the native `<input type="time">` as the literal string `"NaN"` — which the browser
discards, silently dropping the bound. Only a direct property assignment worked, and it needed a
TypeScript widening cast to do so.

`LyraTimeInput` now redeclares `min`/`max` with a converter that forwards the attribute verbatim, so
`<lr-time-input min="09:00" max="17:00">` reaches the native input intact and its own constraint
validation reports `rangeUnderflow`/`rangeOverflow` as it should. Seconds-precision bounds
(`min="09:00:30"` alongside `step="1"`) work the same way, removing the attribute clears the bound,
and both are typed `string | number | undefined` so an assignment no longer needs a cast.

`<lr-input type="number">` is unchanged: its `min`/`max` attributes still parse to numbers.
