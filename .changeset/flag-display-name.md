---
"@aceshooting/lyra-ui": minor
---

`<lyra-flag>`: the default accessible name (`alt`, used when `label` is unset) is now a human-readable
region name via `Intl.DisplayNames` (e.g. `language="en"` → `"United Kingdom"`) instead of the bare
uppercase country code (`"GB"`, previously read letter-by-letter by most screen readers).
