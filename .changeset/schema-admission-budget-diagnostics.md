---
'@aceshooting/lyra-gen': patch
---

Preserve resource-limit diagnostics when a schema exceeds JSON admission budgets, including the original error code and path. Unsafe or malformed schemas remain rejected as `schema.invalid`.

Clarify that `maxNodes` counts JSON values in input and schema snapshots and separately bounds schema validation work, rather than rendered components.
