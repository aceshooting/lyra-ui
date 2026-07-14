---
"@aceshooting/lyra-ui": minor
---

`lyra-map` now forwards a host-level `aria-label` attribute onto `[part="base"]`'s accessible name as a fallback when `label` is left unset, matching `lyra-slider`/`lyra-checkbox`/`lyra-switch` — previously a host `aria-label` was silently dropped in favor of the localized `'map'` default.
