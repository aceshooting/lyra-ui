---
"@aceshooting/lyra-ui": patch
---

`installHappyDomFormAssociatedShims()`'s stub `ElementInternals` now implements `setValidity()` as a no-op. `AnchoredValidityController` (used by every form-associated component) calls `internals.setValidity()` on every update, not just at construction, so a consumer's happy-dom test suite installing the shim would throw the moment any shimmed component's value changed after mount.
