---
"@aceshooting/lyra-ui": patch
---

Fix `installHappyDomFormAssociatedShims()`'s stub `ElementInternals` missing a `states`
(`CustomStateSet`) property. Any form-associated component that calls
`this.internals.states.add()`/`.delete()`/`.has()` (added in 8.0's custom-state work, e.g.
`lr-input`'s `blank` state) threw on its very first update under the documented happy-dom test
setup.
