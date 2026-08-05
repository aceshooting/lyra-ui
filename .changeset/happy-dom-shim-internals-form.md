---
"@aceshooting/lyra-ui": patch
---

`@aceshooting/lyra-ui/testing`'s `installHappyDomFormAssociatedShims()` now resolves the stub `ElementInternals.form` live via `host.closest('form')` instead of always `null` — a form-associated component that calls `attachInternals()` from its constructor (before it's inserted anywhere) previously got a permanently-`null` form owner even after being placed inside a real `<form>`, silently breaking anything (like `<lr-button>`) that resolves its submit target through `internals.form`.
