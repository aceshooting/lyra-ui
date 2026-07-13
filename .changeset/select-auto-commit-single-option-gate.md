---
"@aceshooting/lyra-ui": minor
---

`<lyra-select>`'s single-enabled-option auto-commit trigger (added 1.3.0) is now gated behind a new `autoCommitSingleOption` property, default `false`. Previously this behavior was unconditional as soon as exactly one `<lyra-option>` was enabled, silently swapping the trigger's ARIA role and keyboard model on any consumer whose option list happened to narrow to one entry at runtime. Existing consumers now get the pre-1.3.0 combobox trigger unless they explicitly opt in with `auto-commit-single-option`.
