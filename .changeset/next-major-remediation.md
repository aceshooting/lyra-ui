---
'@aceshooting/lyra-ui': major
---

Distinguish omitted text overrides from explicit empty strings in `lr-agent-workspace` (`label`, `composerPlaceholder`), `lr-copy-button` (`copyLabel`, `successLabel`, `errorLabel`), `lr-file-input` (`label`), and `lr-retrieval-search` (`placeholder`). Omission uses the localized fallback; an explicit empty string suppresses it.

These properties now read `undefined` when unset. Code that assumes an unset value is a string must handle the optional value, for example with `value ?? ''`. Remove an empty override to restore the localized fallback.
