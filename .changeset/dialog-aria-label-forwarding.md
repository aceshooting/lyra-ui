---
"@aceshooting/lyra-ui": minor
---

`lyra-dialog` now lets a host-level `aria-label` attribute win over its computed accessible name (a slotted heading, `heading`, or `label`), matching `<lyra-date-input>`'s `accessibleLabel` pattern. Previously a consumer setting `aria-label` directly on `<lyra-dialog>` was silently ignored in favor of the bespoke `label`/`heading` props. Additive — left unset, today's existing three-tier fallback is unchanged.
