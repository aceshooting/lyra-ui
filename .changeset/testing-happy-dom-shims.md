---
"@aceshooting/lyra-ui": minor
---

Add a new `./testing` subpath exporting `installHappyDomFormAssociatedShims()` -- an opt-in,
environment-guarded polyfill for `HTMLElement.prototype.attachInternals`, for a downstream
consumer's own Vitest+happy-dom test suite (happy-dom has no `ElementInternals` implementation,
and every form-associated `lyra-*` component calls `attachInternals()` unconditionally in its
constructor). Not used by this package's own tests, which already run against real browsers.
