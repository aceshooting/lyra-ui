---
"@aceshooting/lyra-ui": minor
---

Three fixes to `<lr-select>` and `<lr-combobox>`'s controlled-value contract and popup rendering.

- **fr_bdEBpfRnxOyltgEOif44sA -- an empty-valued `<lr-option>` is now a stable controlled
  selection.** Both pickers' `value`/`defaultValue` setters used to test the incoming value with a
  bare truthiness check (`next ? [next] : []`), so assigning `''` was indistinguishable from
  clearing the selection -- even when an option declared `value=""`. The contract is now explicit:
  assigning `undefined` or `null` clears the selection (the documented "unset" behavior, unchanged);
  every string, INCLUDING `''`, is instead a candidate value resolved against the current options,
  exactly like any other string. `value`/`defaultValue`'s setter types widen to accept
  `string | string[] | null | undefined` to make the `undefined`/`null` "clear" contract explicit at
  the type level; their getters are unchanged. This closes the asymmetry where clicking an
  empty-valued option already selected it (`lr-select`'s pointer path builds its committed array
  directly, with no truthiness filtering) while assigning the same value programmatically silently
  cleared instead -- both components now behave identically across the programmatic and pointer
  paths. A handful of internal call sites that previously used `''` as an implicit "nothing to
  restore/default to" sentinel (`formStateRestoreCallback`, `formResetCallback`,
  `refreshOptionDefaults`, `applySelectedRowValues`, `onOptionChange`'s deselect branch) now pass an
  explicit `[]`/`undefined` instead, so they keep meaning "clear" under the corrected contract.
- **fr_j78P1f--O__WYl1AIDwRvA -- a committed value matching no option no longer leaks its raw
  string with no explanation.** Both components' `labelFor()`-style resolution already fell back to
  the raw value for a stale or programmatically mistyped value; that raw value is still fully
  reachable through `value`/`selectedOptions`/`selectedRows` and JSDoc's fallback description is
  unchanged. What's new is presentation: mirroring `<lr-model-select>`'s synthetic "not in catalog"
  stale-value row, the closed trigger label (`<lr-select>`) or filter input (`<lr-combobox>`), and
  any `multiple`-mode tag/chip for such a value, now render a dashed/italic
  `[part='unknown-value']` badge (reusing the existing localized `notInCatalog` string) instead of
  an unexplained bare label. New `--lr-select-unknown-value-border-*` /
  `--lr-combobox-unknown-value-border-*` custom properties retheme the dashed border.
  `<lr-combobox>` additionally suppresses the badge while an async `source` fetch is still in
  flight (not yet resolved is not the same as genuinely unknown) and never flags an
  `allowCustomValue` commit, which is a sanctioned unmatched value, not a stale one.
- **fr_JdccfkynRjnbGPuSsmLLtQ -- `<lr-select>` now renders `<lr-option>`'s `start`/`end`
  adornments in its listbox rows**, mirroring `<lr-combobox>`'s existing `option-start`/`option-end`
  parts and clone-based rendering (`cloneNode(true)`, never `createElementNS`, so a custom-element
  adornment still upgrades). Previously `<lr-select>`'s rows read only `dotColor`/`label`/`sub` and
  silently dropped a slotted `start`/`end`/`prefix`/`suffix` adornment. A plain option with no
  adornment renders no extra wrapper, and the new parts mirror correctly under `dir="rtl"` like
  every other flex-row adornment pair in the library.

Deferred: fr_f26OnwTQYTBgrkrM60FoJw (a `data` payload channel on `<lr-option>`) needs an API design
decision and is not part of this change.
