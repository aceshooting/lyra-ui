---
"@aceshooting/lyra-ui": minor
---

`lyra-tree` now forwards a host-level `aria-label` attribute onto the internal `role="tree"` element's accessible name as a fallback when `label` is left unset, matching `lyra-slider`/`lyra-select` — previously a host `aria-label` was silently dropped since `role="tree"` lives on an internal element, not the host.
