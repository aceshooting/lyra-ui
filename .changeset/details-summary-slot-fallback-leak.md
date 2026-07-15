---
"@aceshooting/lyra-ui": patch
---

`lyra-details`/`lyra-accordion-item` no longer render the localized "Details" fallback text alongside rich content slotted into `summary` when the plain-string `summary` prop is left unset. The fallback previously always rendered whenever `summary` was empty, regardless of whether a `slot="summary"` child was present — visible only when a consumer needed markup (an icon, multiple spans) in the summary rather than a plain string.
