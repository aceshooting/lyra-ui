---
"@aceshooting/lyra-ui": patch
---

`createScopedRegistry(definitions, { document })` now constructs its elements in Firefox when `document` is an iframe or detached document. Firefox, which now ships native scoped custom element registries, left such elements unconstructed and logged a `NotSupportedError`; the registry now upgrades each element after adopting it into the owner document, and throws if a definition still fails to construct instead of returning an inert element.
