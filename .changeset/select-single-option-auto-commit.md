---
"@aceshooting/lyra-ui": minor
---

`<lyra-select>`: when exactly one `<lyra-option>` is enabled, the trigger now auto-commits that
option on click or Arrow Up/Down instead of opening a single-row listbox — no chevron, no popup,
`role="button"` instead of `role="combobox"`. Avoids an unnecessary extra click for "only one
choice available" states (e.g. a filtered picker that's converged to a single match). Multi-option
selects are unaffected; `value`/validity defaults are unchanged. Not gated behind a new prop — this
is the new default trigger behavior for any select with a single enabled option.
