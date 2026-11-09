---
'@aceshooting/lyra-ui': patch
---

Restore theme tokens when an adopted stylesheet is disabled or an imported token stylesheet's media stops matching. Reuse the original provider when it becomes active again without retaining a duplicate fallback.

Recognize token imports preceded by CSS layer-order declarations so those providers can be replaced and restored correctly.
