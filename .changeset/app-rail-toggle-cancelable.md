---
"@aceshooting/lyra-ui": minor
---

Make `lr-app-rail`'s `lr-toggle` event cancelable: a listener calling `preventDefault()` keeps the
rail open/closed as it was. The one exception is the forced close that fires when `mode` leaves
`'mobile'` while open, which stays unconditional since it's a consistency fix-up rather than a
user dismissal.
