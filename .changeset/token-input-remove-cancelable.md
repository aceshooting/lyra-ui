---
"@aceshooting/lyra-ui": minor
---

Make `lr-token-input`'s `lr-remove` event cancelable: a listener calling `preventDefault()` (for
example to run async removal validation, or to protect a token) keeps the token in place instead
of it being removed unconditionally. Scoped to direct removal; multi-candidate paste/edit flows
are unaffected.
